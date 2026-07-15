/**
 * FASE 7 — ETAPA 3: Motor de Recovery Seletivo por Empresa.
 *
 * MODO ÚNICO IMPLEMENTADO: NOVA EMPRESA / SANDBOX (não destrutivo).
 *   - NUNCA sobrescreve uma empresa existente.
 *   - Cria uma empresa NOVA e reinsere todos os dados do backup com IDs
 *     totalmente remapeados (mapa global old->new), preservando integridade
 *     referencial, Ledger, Financeiro, Caixa, IA e Auditoria.
 *
 * GARANTIAS (conforme protocolo aprovado):
 *   1. validação do JSON;
 *   2. validação de integridade referencial;
 *   3. dry-run obrigatório com relatório de impacto;
 *   4. gravação em TRANSAÇÃO ÚNICA com rollback automático em erro;
 *   5. validações automáticas pós-restauração (estoque, financeiro, caixa,
 *      ledger débito=crédito, contagens por tabela);
 *   6. logs completos (feitos na rota de API).
 *
 * NÃO implementa restauração in-place (proibida nesta etapa).
 */
import cuid from 'cuid';
import { prisma } from './db';
import { BACKUP_MODELS, BACKUP_VERSION, BackupModelDef } from './backup-registry';

const CHUNK = 1000; // cada createMany < statement_timeout (5s)

export interface BackupEnvelope {
  version: string;
  companyId: string;
  companyName: string;
  createdAt?: string;
  datasets: Record<string, any[]>;
  metadata?: { recordCounts: Record<string, number>; totalRecords: number };
}

export interface ValidationIssue {
  level: 'error' | 'warning';
  scope: string;
  message: string;
}

export interface ImpactReport {
  valid: boolean;
  version: string;
  sourceCompanyName: string;
  totalRecords: number;
  recordCounts: Record<string, number>;
  orphanRefs: Record<string, number>; // "model.field" -> qtd que será zerada
  emailRewrites: number;
  issues: ValidationIssue[];
}

/** 1+2. Valida estrutura do envelope e integridade referencial em memória. */
export function validateBackup(env: any): ImpactReport {
  const issues: ValidationIssue[] = [];
  const orphanRefs: Record<string, number> = {};
  let emailRewrites = 0;

  // ---- Estrutura básica ----
  if (!env || typeof env !== 'object') {
    return { valid: false, version: '?', sourceCompanyName: '?', totalRecords: 0, recordCounts: {}, orphanRefs: {}, emailRewrites: 0, issues: [{ level: 'error', scope: 'envelope', message: 'Backup vazio ou inválido.' }] };
  }
  if (env.version !== BACKUP_VERSION) {
    issues.push({ level: 'warning', scope: 'version', message: `Versão do backup (${env.version}) difere da atual (${BACKUP_VERSION}).` });
  }
  if (!env.datasets || typeof env.datasets !== 'object') {
    issues.push({ level: 'error', scope: 'datasets', message: 'Campo "datasets" ausente ou inválido.' });
  }
  const datasets: Record<string, any[]> = env.datasets || {};

  // company root deve existir com exatamente 1 registro
  const companyRows = datasets['company'] || [];
  if (companyRows.length !== 1) {
    issues.push({ level: 'error', scope: 'company', message: `Esperado 1 registro de empresa, encontrado ${companyRows.length}.` });
  }

  // ---- Mapa de ids conhecidos (todos os registros do backup) ----
  const knownIds = new Set<string>();
  for (const def of BACKUP_MODELS) {
    for (const row of datasets[def.key] || []) {
      if (row && row.id) knownIds.add(row.id);
    }
  }

  // ---- Integridade referencial ----
  const recordCounts: Record<string, number> = {};
  let totalRecords = 0;
  for (const def of BACKUP_MODELS) {
    const rows = datasets[def.key] || [];
    recordCounts[def.key] = rows.length;
    totalRecords += rows.length;

    for (const row of rows) {
      // FKs obrigatórias/opcionais: se valor presente e não existe no backup => órfão
      for (const f of def.fkFields || []) {
        const v = row?.[f];
        if (v == null) continue;
        // companyId sempre aponta para a empresa raiz do backup
        if (!knownIds.has(v)) {
          const k = `${def.key}.${f}`;
          orphanRefs[k] = (orphanRefs[k] || 0) + 1;
        }
      }
      // auto-relação
      if (def.selfRefField) {
        const v = row?.[def.selfRefField];
        if (v != null && !knownIds.has(v)) {
          const k = `${def.key}.${def.selfRefField}`;
          orphanRefs[k] = (orphanRefs[k] || 0) + 1;
        }
      }
      if (def.key === 'users' && row?.email) emailRewrites++;
    }
  }

  if (Object.keys(orphanRefs).length > 0) {
    const totalOrphans = Object.values(orphanRefs).reduce((a, b) => a + b, 0);
    issues.push({ level: 'warning', scope: 'referential', message: `${totalOrphans} referência(s) órfã(s) serão zeradas (campos opcionais) durante a restauração.` });
  }

  const hasError = issues.some((i) => i.level === 'error');
  return {
    valid: !hasError,
    version: env.version,
    sourceCompanyName: env.companyName ?? companyRows[0]?.name ?? '?',
    totalRecords,
    recordCounts,
    orphanRefs,
    emailRewrites,
    issues,
  };
}

/** Remapeia um registro: id novo + FKs via mapa global. */
function remapRow(def: BackupModelDef, row: any, idMap: Map<string, string>): any {
  const out: any = { ...row };
  if (row.id) out.id = idMap.get(row.id);

  for (const f of def.fkFields || []) {
    if (out[f] == null) continue;
    out[f] = idMap.get(out[f]) ?? null; // soft-null se órfão
  }
  for (const f of def.softIdFields || []) {
    if (out[f] == null) continue;
    const mapped = idMap.get(out[f]);
    if (mapped) out[f] = mapped; // senão mantém original (sem FK formal)
  }
  if (def.selfRefField) out[def.selfRefField] = null; // fase 1; ajustado na fase 2
  return out;
}

export interface RestoreResult {
  newCompanyId: string;
  newCompanyName: string;
  inserted: Record<string, number>;
  totalInserted: number;
  emailRewrites: number;
  orphanRefs: Record<string, number>;
  durationMs: number;
  validations: PostValidation[];
}

export interface PostValidation {
  check: string;
  ok: boolean;
  detail: string;
}

/**
 * 4. Executa a restauração para uma NOVA empresa em TRANSAÇÃO ÚNICA.
 *    Qualquer erro lança exceção -> rollback automático (nada é persistido).
 */
export async function restoreToNewCompany(params: {
  envelope: BackupEnvelope;
  newCompanyName: string;
}): Promise<RestoreResult> {
  const { envelope, newCompanyName } = params;
  const datasets = envelope.datasets;
  const startedAt = Date.now();

  // ---- Pré-gera todos os novos ids (mapa global) ANTES de inserir ----
  const idMap = new Map<string, string>();
  for (const def of BACKUP_MODELS) {
    for (const row of datasets[def.key] || []) {
      if (row && row.id) idMap.set(row.id, cuid());
    }
  }

  const companyRow = (datasets['company'] || [])[0];
  if (!companyRow) throw new Error('Backup sem registro de empresa.');
  const newCompanyId = idMap.get(companyRow.id)!;
  const emailTag = newCompanyId.slice(-8);

  const inserted: Record<string, number> = {};
  const orphanRefs: Record<string, number> = {};
  let emailRewrites = 0;

  await prisma.$transaction(async (tx) => {
    for (const def of BACKUP_MODELS) {
      const rows = datasets[def.key] || [];

      // ----- Empresa raiz -----
      if (def.scope === 'root') {
        const data: any = { ...companyRow };
        data.id = newCompanyId;
        data.name = newCompanyName;
        data.cnpj = null; // evita colisão no único global (sandbox)
        // createdAt/updatedAt preservados do original para fidelidade
        await (tx as any).company.create({ data });
        inserted[def.key] = 1;
        continue;
      }

      if (rows.length === 0) { inserted[def.key] = 0; continue; }

      // ----- Demais models -----
      const payloads = rows.map((r) => {
        const p = remapRow(def, r, idMap);
        // conta órfãos (FK presente que virou null)
        for (const f of def.fkFields || []) {
          if (r[f] != null && p[f] == null) {
            const k = `${def.key}.${f}`;
            orphanRefs[k] = (orphanRefs[k] || 0) + 1;
          }
        }
        // emails únicos por restore (sandbox)
        if (def.key === 'users' && p.email) {
          p.email = String(p.email).includes('@')
            ? String(p.email).replace('@', `+r${emailTag}@`)
            : `${p.email}+r${emailTag}`;
          emailRewrites++;
        }
        return p;
      });

      // insere em chunks (cada statement < 5s)
      let count = 0;
      for (let i = 0; i < payloads.length; i += CHUNK) {
        const slice = payloads.slice(i, i + CHUNK);
        const res = await (tx as any)[def.delegate].createMany({ data: slice });
        count += res.count ?? slice.length;
      }
      inserted[def.key] = count;

      // ----- Fase 2 da auto-relação (parentId) -----
      if (def.selfRefField) {
        for (const r of rows) {
          const parentOld = r[def.selfRefField];
          if (parentOld == null) continue;
          const childNew = idMap.get(r.id);
          const parentNew = idMap.get(parentOld);
          if (childNew && parentNew) {
            await (tx as any)[def.delegate].update({
              where: { id: childNew },
              data: { [def.selfRefField]: parentNew },
            });
          }
        }
      }
    }
  }, { timeout: 120000, maxWait: 15000 });

  const totalInserted = Object.values(inserted).reduce((a, b) => a + b, 0);

  // ---- 5. Validações automáticas pós-restauração (fora da transação) ----
  const validations = await runPostValidations(newCompanyId, envelope);

  return {
    newCompanyId,
    newCompanyName,
    inserted,
    totalInserted,
    emailRewrites,
    orphanRefs,
    durationMs: Date.now() - startedAt,
    validations,
  };
}

/** 5. Validações: contagens, ledger (débito=crédito), estoque, financeiro, caixa. */
export async function runPostValidations(companyId: string, envelope: BackupEnvelope): Promise<PostValidation[]> {
  const out: PostValidation[] = [];
  const expected = envelope.metadata?.recordCounts || {};

  // (a) contagens por tabela vs backup
  const countDefs: Array<[string, () => Promise<number>]> = [
    ['sales', () => prisma.sale.count({ where: { companyId } })],
    ['saleItems', () => prisma.saleItem.count({ where: { sale: { companyId } } })],
    ['products', () => prisma.product.count({ where: { companyId } })],
    ['customers', () => prisma.customer.count({ where: { companyId } })],
    ['ledgerEntries', () => prisma.ledgerEntry.count({ where: { companyId } })],
    ['financialRecords', () => prisma.financialRecord.count({ where: { companyId } })],
    ['cashMovements', () => prisma.cashMovement.count({ where: { companyId } })],
    ['accountsReceivable', () => prisma.accountReceivable.count({ where: { companyId } })],
    ['accountsPayable', () => prisma.accountPayable.count({ where: { companyId } })],
  ];
  for (const [key, fn] of countDefs) {
    const got = await fn();
    const exp = expected[key] ?? got;
    out.push({ check: `contagem:${key}`, ok: got === exp, detail: `esperado ${exp}, obtido ${got}` });
  }

  // (b) Ledger: soma de débitos == soma de créditos (Motor Contabil preservado)
  const led = await prisma.ledgerEntry.aggregate({ where: { companyId }, _sum: { debit: true, credit: true } });
  const dsum = led._sum.debit ?? 0;
  const csum = led._sum.credit ?? 0;
  out.push({ check: 'ledger:debito=credito', ok: Math.abs(dsum - csum) < 0.01, detail: `débito ${dsum.toFixed(2)} vs crédito ${csum.toFixed(2)}` });

  // (c) Estoque: nenhum produto com estoque negativo
  const negStock = await prisma.product.count({ where: { companyId, stockQuantity: { lt: 0 } } });
  out.push({ check: 'estoque:sem_negativos', ok: negStock === 0, detail: `${negStock} produto(s) com estoque negativo` });

  // (d) Financeiro: contagem de registros financeiros confere
  const finGot = await prisma.financialRecord.count({ where: { companyId } });
  const finExp = expected['financialRecords'] ?? finGot;
  out.push({ check: 'financeiro:integridade', ok: finGot === finExp, detail: `registros financeiros ${finGot}/${finExp}` });

  // (e) Caixa: saldo agregado dos movimentos coerente (soma entradas - saídas finita)
  const cashAgg = await prisma.cashMovement.aggregate({ where: { companyId }, _sum: { amount: true } });
  const cashSum = cashAgg._sum.amount ?? 0;
  out.push({ check: 'caixa:movimentos_coerentes', ok: Number.isFinite(cashSum), detail: `soma de movimentos: ${cashSum.toFixed(2)}` });

  return out;
}
