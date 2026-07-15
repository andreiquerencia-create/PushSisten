export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { exportCompanyBackup, buildBackupKey } from '@/lib/backup-engine';
import { BACKUP_VERSION } from '@/lib/backup-registry';
import { isLargeCompany, claimAndRun } from '@/lib/backup-worker';

// GET /api/master/backup -> lista backups (mais recentes primeiro)
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  if (!(session.user as any).isMaster) return NextResponse.json({ error: 'Apenas master' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get('companyId') || undefined;

  const backups = await prisma.backupRecord.findMany({
    where: companyId ? { companyId } : undefined,
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  return NextResponse.json({ backups });
}

// POST /api/master/backup { companyId, type? } -> cria um backup lógico da empresa
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  if (!(session.user as any).isMaster) return NextResponse.json({ error: 'Apenas master pode criar backups' }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const companyId: string | undefined = body?.companyId;
  const type: string = body?.type === 'pre_delete' ? 'pre_delete' : 'manual';
  if (!companyId) return NextResponse.json({ error: 'companyId obrigatório' }, { status: 400 });

  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { id: true, name: true } });
  if (!company) return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 404 });

  // ── ETAPA 5B: empresas grandes são ENFILEIRADAS e processadas em background
  //    (sem depender do timeout do HTTP). Empresas pequenas seguem inline.
  const large = await isLargeCompany(company.id);
  if (large) {
    const queued = await prisma.backupRecord.create({
      data: {
        companyId: company.id,
        companyName: company.name,
        type,
        status: 'pending',
        version: BACKUP_VERSION,
        schemaVersion: BACKUP_VERSION,
        createdById: (session.user as any).id ?? null,
        createdByName: session.user.name ?? null,
        appCheckpoint: process.env.APP_CHECKPOINT ?? null,
      },
    });
    // Dispara o processamento em background (servidor persistente continua após a resposta).
    void claimAndRun(queued.id).catch((e) => console.error('[backup] background falhou:', e));
    return NextResponse.json({ backup: queued, queued: true });
  }

  // Cria o registro em estado 'running'
  const record = await prisma.backupRecord.create({
    data: {
      companyId: company.id,
      companyName: company.name,
      type,
      status: 'running',
      version: BACKUP_VERSION,
      schemaVersion: BACKUP_VERSION,
      createdById: (session.user as any).id ?? null,
      createdByName: session.user.name ?? null,
      appCheckpoint: process.env.APP_CHECKPOINT ?? null,
    },
  });

  const cloudStoragePath = buildBackupKey(company.id, record.id);

  try {
    const result = await exportCompanyBackup({
      companyId: company.id,
      companyName: company.name,
      cloudStoragePath,
      createdById: (session.user as any).id ?? null,
      createdByName: session.user.name ?? null,
      appCheckpoint: process.env.APP_CHECKPOINT ?? null,
    });

    const updated = await prisma.backupRecord.update({
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

    // Auditoria (não altera Auditoria existente; apenas registra a ação)
    await prisma.activityLog.create({
      data: {
        action: 'backup_create',
        description: `Backup ${type} da empresa ${company.name}: ${result.totalRecords} registros, ${(result.fileSizeBytes / 1024).toFixed(0)} KB`,
        entityType: 'company',
        entityId: company.id,
        companyId: company.id,
        userId: (session.user as any).id ?? null,
        userName: session.user.name ?? null,
        metadata: { backupId: record.id, totalRecords: result.totalRecords, durationMs: result.durationMs },
      },
    });

    return NextResponse.json({ backup: updated });
  } catch (error: any) {
    console.error('Erro no backup:', error);
    await prisma.backupRecord.update({
      where: { id: record.id },
      data: { status: 'failed', error: (error?.message || 'erro desconhecido').slice(0, 500), completedAt: new Date() },
    });
    return NextResponse.json({ error: 'Falha ao gerar backup: ' + (error?.message || 'erro') }, { status: 500 });
  }
}
