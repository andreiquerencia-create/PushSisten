/**
 * FASE 7 — ETAPA 5B: Worker de backup (fila + processamento serial + retenção).
 *
 * REUSO PURO do Backup Engine existente (lib/backup-engine.ts). NÃO altera
 * Motor Financeiro, Ledger, Multiempresa, IA, Auditoria nem correções 2/3/4.
 * Apenas LÊ dados das empresas (export) e grava em BackupRecord / ActivityLog.
 *
 * Princípios:
 *  - BackupRecord é a fila (status: pending -> running -> completed|failed).
 *  - Claim ATÔMICO (updateMany condicional) garante 1 worker por backup.
 *  - Processamento SERIAL (1 empresa por vez) respeita limite de conexões/timeout.
 *  - Recuperação de órfãos: running antigo demais vira failed (nunca fica preso).
 *  - Retenção GFS (diário/semanal/mensal) preservando SEMPRE o último válido.
 */
import { prisma } from '@/lib/db';
import { exportCompanyBackup, buildBackupKey } from '@/lib/backup-engine';
import { BACKUP_VERSION } from '@/lib/backup-registry';
import { deleteFile } from '@/lib/s3';

/** running além disso é considerado órfão (processo interrompido). */
export const ORPHAN_MS = 30 * 60 * 1000; // 30 min
/** Acima deste nº de vendas, o backup manual é enfileirado (background). */
export const LARGE_SALES_THRESHOLD = 2000;
/** Teto de iterações do loop de fila (proteção contra loop infinito). */
export const MAX_QUEUE_ITERATIONS = 500;

const BRT_OFFSET_MS = 3 * 60 * 60 * 1000; // UTC-3

async function logActivity(
  action: string,
  description: string,
  companyId: string | null,
  metadata?: any,
) {
  try {
    await prisma.activityLog.create({
      data: {
        action,
        description,
        entityType: 'backup',
        companyId: companyId ?? undefined,
        userName: 'Sistema (backup automático)',
        metadata: metadata ?? undefined,
      },
    });
  } catch (e) {
    // Log de auditoria nunca deve derrubar o worker.
    console.error('[backup-worker] falha ao gravar ActivityLog:', e);
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Instante UTC correspondente a 00:00 BRT do dia corrente. */
function startOfTodayBRT(): Date {
  const nowBrt = new Date(Date.now() - BRT_OFFSET_MS);
  nowBrt.setUTCHours(0, 0, 0, 0);
  return new Date(nowBrt.getTime() + BRT_OFFSET_MS);
}

/** Chave ano-semana ISO (para agrupamento semanal da retenção). */
function isoWeekKey(d: Date): string {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** Chave ano-mês (para agrupamento mensal da retenção). */
function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Uma empresa é "grande" se ultrapassa o limiar de vendas. */
export async function isLargeCompany(companyId: string): Promise<boolean> {
  const sales = await prisma.sale.count({ where: { companyId } });
  return sales > LARGE_SALES_THRESHOLD;
}

/**
 * Recupera backups presos em 'running' há tempo demais (órfãos) marcando-os
 * como 'failed'. Garante que nenhum backup fique preso indefinidamente.
 */
export async function recoverOrphans(): Promise<number> {
  const cutoff = new Date(Date.now() - ORPHAN_MS);
  const stuck = await prisma.backupRecord.findMany({
    where: { status: 'running', startedAt: { lt: cutoff } },
    select: { id: true, companyId: true, companyName: true },
  });
  for (const r of stuck) {
    await prisma.backupRecord.update({
      where: { id: r.id },
      data: {
        status: 'failed',
        error: 'Processo interrompido (órfão) — recuperado automaticamente pela varredura.',
        completedAt: new Date(),
      },
    });
    await logActivity('backup_failed', `Backup órfão recuperado: ${r.companyName}`, r.companyId, {
      backupId: r.id,
      reason: 'orphan_recovery',
    });
  }
  return stuck.length;
}

/**
 * Cria registros 'pending' (type=auto) para todas as empresas ativas.
 * Idempotente por dia: pula empresa que já tem backup auto hoje.
 */
export async function enqueueAutoBackups(): Promise<{ created: number; skipped: number; total: number }> {
  const companies = await prisma.company.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
  });
  const since = startOfTodayBRT();
  let created = 0;
  let skipped = 0;

  for (const c of companies) {
    const existing = await prisma.backupRecord.findFirst({
      where: {
        companyId: c.id,
        type: 'auto',
        createdAt: { gte: since },
        status: { in: ['pending', 'running', 'completed'] },
      },
      select: { id: true },
    });
    if (existing) {
      skipped++;
      continue;
    }
    await prisma.backupRecord.create({
      data: {
        companyId: c.id,
        companyName: c.name,
        type: 'auto',
        status: 'pending',
        version: BACKUP_VERSION,
        schemaVersion: BACKUP_VERSION,
        createdByName: 'Agendador automático',
        appCheckpoint: process.env.APP_CHECKPOINT ?? null,
      },
    });
    created++;
  }
  return { created, skipped, total: companies.length };
}

/**
 * Reivindica UM backup pendente de forma ATÔMICA e o processa.
 * Retorna 'done' | 'failed' | 'skipped' (skipped = outro worker reivindicou).
 */
export async function claimAndRun(recordId: string): Promise<'done' | 'failed' | 'skipped'> {
  // Claim atômico: só vence quem conseguir mudar pending -> running.
  const claim = await prisma.backupRecord.updateMany({
    where: { id: recordId, status: 'pending' },
    data: { status: 'running', startedAt: new Date() },
  });
  if (claim.count === 0) return 'skipped';

  const record = await prisma.backupRecord.findUnique({ where: { id: recordId } });
  if (!record) return 'skipped';

  if (!record.companyId) {
    await prisma.backupRecord.update({
      where: { id: record.id },
      data: { status: 'failed', error: 'companyId ausente no registro de backup.', completedAt: new Date() },
    });
    await logActivity('backup_failed', `Backup sem empresa: ${record.companyName}`, null, { backupId: record.id });
    return 'failed';
  }

  const cloudStoragePath = buildBackupKey(record.companyId, record.id);
  try {
    const result = await exportCompanyBackup({
      companyId: record.companyId,
      companyName: record.companyName,
      cloudStoragePath,
      createdById: record.createdById,
      createdByName: record.createdByName,
      appCheckpoint: record.appCheckpoint,
    });
    await prisma.backupRecord.update({
      where: { id: record.id },
      data: {
        status: 'completed',
        cloudStoragePath: result.cloudStoragePath,
        fileSizeBytes: result.fileSizeBytes,
        recordCounts: result.recordCounts,
        totalRecords: result.totalRecords,
        durationMs: result.durationMs,
        completedAt: new Date(),
      },
    });
    await logActivity(
      'backup_create',
      `Backup ${record.type} da empresa ${record.companyName}: ${result.totalRecords} registros, ${(result.fileSizeBytes / 1024).toFixed(0)} KB`,
      record.companyId,
      { backupId: record.id, type: record.type, totalRecords: result.totalRecords, durationMs: result.durationMs },
    );
    return 'done';
  } catch (error: any) {
    await prisma.backupRecord.update({
      where: { id: record.id },
      data: { status: 'failed', error: (error?.message || 'erro desconhecido').slice(0, 500), completedAt: new Date() },
    });
    await logActivity('backup_failed', `Falha no backup da empresa ${record.companyName}`, record.companyId, {
      backupId: record.id,
      error: (error?.message || 'erro').slice(0, 300),
    });
    return 'failed';
  }
}

/**
 * Processa a fila inteira de forma SERIAL (1 por vez), reivindicando sempre o
 * pendente mais antigo. Recupera órfãos antes. Protegido por teto de iterações.
 */
export async function processQueue(maxIterations = MAX_QUEUE_ITERATIONS): Promise<{ processed: number; failed: number; remaining: number }> {
  await recoverOrphans();
  let processed = 0;
  let failed = 0;

  for (let i = 0; i < maxIterations; i++) {
    const next = await prisma.backupRecord.findFirst({
      where: { status: 'pending' },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    if (!next) break;
    const r = await claimAndRun(next.id);
    if (r === 'done') processed++;
    else if (r === 'failed') failed++;
    // pausa educada entre empresas (alivia o banco)
    await sleep(200);
  }
  const remaining = await prisma.backupRecord.count({ where: { status: 'pending' } });
  return { processed, failed, remaining };
}

/**
 * Retenção GFS por empresa sobre backups AUTO concluídos:
 *   - mantém os N diários mais recentes;
 *   - mantém o mais recente de cada uma das últimas N semanas;
 *   - mantém o mais recente de cada um dos últimos N meses;
 *   - NUNCA exclui o último backup válido (completed) da empresa (qualquer tipo).
 * Expurga (S3 + DB) o restante e gera ActivityLog por empresa.
 */
export async function applyRetention(opts: {
  daily: number;
  weekly: number;
  monthly: number;
}): Promise<{ purged: number; companiesAffected: number }> {
  const { daily, weekly, monthly } = opts;

  // empresas que possuem ao menos um backup auto concluído
  const grouped = await prisma.backupRecord.groupBy({
    by: ['companyId'],
    where: { type: 'auto', status: 'completed', companyId: { not: null } },
    _count: { _all: true },
  });

  let purged = 0;
  let companiesAffected = 0;

  for (const g of grouped) {
    const companyId = g.companyId as string;
    const autos = await prisma.backupRecord.findMany({
      where: { companyId, type: 'auto', status: 'completed' },
      orderBy: { createdAt: 'desc' },
      select: { id: true, createdAt: true, cloudStoragePath: true, companyName: true },
    });

    const keep = new Set<string>();
    // diários: N mais recentes
    autos.slice(0, daily).forEach((b) => keep.add(b.id));
    // semanais: mais recente por semana ISO (últimas N semanas)
    const weekMap = new Map<string, string>();
    for (const b of autos) {
      const k = isoWeekKey(b.createdAt);
      if (!weekMap.has(k)) weekMap.set(k, b.id);
    }
    Array.from(weekMap.values()).slice(0, weekly).forEach((id) => keep.add(id));
    // mensais: mais recente por mês (últimos N meses)
    const monthMap = new Map<string, string>();
    for (const b of autos) {
      const k = monthKey(b.createdAt);
      if (!monthMap.has(k)) monthMap.set(k, b.id);
    }
    Array.from(monthMap.values()).slice(0, monthly).forEach((id) => keep.add(id));

    // NUNCA excluir o último backup válido (completed) da empresa — qualquer tipo.
    const lastValid = await prisma.backupRecord.findFirst({
      where: { companyId, status: 'completed' },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    if (lastValid) keep.add(lastValid.id);

    const toDelete = autos.filter((b) => !keep.has(b.id));
    if (toDelete.length === 0) continue;

    const purgedIds: string[] = [];
    for (const b of toDelete) {
      try {
        if (b.cloudStoragePath) await deleteFile(b.cloudStoragePath);
      } catch (e) {
        console.error('[backup-worker] falha ao excluir objeto S3:', b.cloudStoragePath, e);
      }
      await prisma.backupRecord.delete({ where: { id: b.id } });
      purgedIds.push(b.id);
      purged++;
    }

    companiesAffected++;
    await logActivity(
      'backup_purge',
      `Retenção: ${purgedIds.length} backup(s) automático(s) expurgado(s) da empresa ${autos[0]?.companyName ?? companyId}`,
      companyId,
      { purgedBackupIds: purgedIds, kept: Array.from(keep), policy: { daily, weekly, monthly } },
    );
  }

  return { purged, companiesAffected };
}

/** Lê (ou cria) a configuração singleton de agendamento. */
export async function getSchedule() {
  let sched = await prisma.backupSchedule.findUnique({ where: { id: 'global' } });
  if (!sched) {
    sched = await prisma.backupSchedule.create({ data: { id: 'global' } });
  }
  return sched;
}

/**
 * Pipeline noturno completo (idempotente): recupera órfãos -> enfileira autos
 * -> processa fila serial -> aplica retenção. Tudo gera ActivityLog.
 * Projetado para rodar em background (sem bloquear requisição HTTP).
 */
export async function runFullPipeline(): Promise<{
  enqueue: { created: number; skipped: number; total: number };
  queue: { processed: number; failed: number; remaining: number };
  retention: { purged: number; companiesAffected: number };
}> {
  const sched = await getSchedule();

  await prisma.backupSchedule.update({
    where: { id: 'global' },
    data: { lastRunAt: new Date(), lastRunStatus: 'running' },
  });
  await logActivity('backup_auto_run', 'Ciclo de backup automático iniciado.', null, {
    policy: { daily: sched.retentionDaily, weekly: sched.retentionWeekly, monthly: sched.retentionMonthly },
  });

  try {
    const enqueue = await enqueueAutoBackups();
    const queue = await processQueue();
    const retention = await applyRetention({
      daily: sched.retentionDaily,
      weekly: sched.retentionWeekly,
      monthly: sched.retentionMonthly,
    });

    const summary = { enqueue, queue, retention };
    await prisma.backupSchedule.update({
      where: { id: 'global' },
      data: { lastRunStatus: 'completed', lastRunSummary: summary as any },
    });
    await logActivity(
      'backup_auto_run',
      `Ciclo concluído: ${enqueue.created} enfileirados, ${queue.processed} processados, ${queue.failed} falhas, ${retention.purged} expurgados.`,
      null,
      summary,
    );
    return summary;
  } catch (error: any) {
    await prisma.backupSchedule.update({
      where: { id: 'global' },
      data: { lastRunStatus: 'failed', lastRunSummary: { error: (error?.message || 'erro').slice(0, 300) } as any },
    });
    await logActivity('backup_auto_run', `Ciclo de backup automático falhou: ${error?.message || 'erro'}`, null);
    throw error;
  }
}
