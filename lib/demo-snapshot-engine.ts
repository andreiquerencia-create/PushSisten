/**
 * PushSisten — Motor da DEMO Oficial (Loja Modelo PushSisten).
 *
 * Fornece 3 operações EXCLUSIVAS da empresa DEMO:
 *   1. createDemoSnapshot  → captura integral do estado calibrado (DEMO_V1), idempotente.
 *   2. restoreDemoSnapshot → restauração destrutiva IN-PLACE, apenas na empresa DEMO.
 *   3. refreshDemoDates    → deslocamento temporal preservando relações relativas.
 *
 * GUARDA-CHUVAS DE SEGURANÇA (todos no BACKEND):
 *   - Toda operação resolve a empresa DEMO pelo nome oficial e valida o id.
 *   - Restauração/atualização SOMENTE na empresa cujo name === DEMO_COMPANY_NAME.
 *   - NUNCA toca em dados de assinatura/cobrança (Billing*, campos SaaS da empresa).
 *   - NUNCA deleta a linha da empresa (evita cascata em Billing); atualiza in-place
 *     apenas campos de perfil/operação via allowlist.
 *
 * Não altera o motor financeiro, Push Score, Saúde da Loja, IA nem o backup genérico.
 */
import { prisma } from './db';
import {
  DEMO_MODELS, DemoModelDef, buildDemoWhere,
  DEMO_COMPANY_NAME, DEMO_SNAPSHOT_LABEL, DEMO_SNAPSHOT_VERSION,
} from './demo-registry';
import { computePushScore } from './push-score-engine';

const READ_PAGE = 2000;
const WRITE_CHUNK = 500;

/** Campos da empresa que a restauração PODE sobrescrever (perfil/operação).
 *  Tudo que envolve assinatura/plano/cobrança/acesso fica de fora. */
const COMPANY_RESTORE_FIELDS = [
  'name', 'cnpj', 'email', 'phone', 'whatsapp', 'instagram', 'logoUrl',
  'address', 'city', 'state', 'isActive', 'createdAt', 'updatedAt',
  'priceTableMinQtyBehavior', 'whatsappDefaultApp', 'lastSaleNumber',
];

export interface DemoCompanyRef { id: string; name: string; }

/** Resolve a empresa DEMO pelo nome oficial. Retorna null se não existir. */
export async function resolveDemoCompany(): Promise<DemoCompanyRef | null> {
  const matches = await prisma.company.findMany({
    where: { name: DEMO_COMPANY_NAME },
    select: { id: true, name: true },
    orderBy: { createdAt: 'asc' },
  });
  if (matches.length === 0) return null;
  return matches[0];
}

/**
 * Valida que o companyId informado é EXATAMENTE a empresa DEMO.
 * Lança erro caso contrário — barreira final contra qualquer operação
 * destrutiva em empresa real/produção.
 */
export async function assertIsDemoCompany(companyId: string): Promise<DemoCompanyRef> {
  if (!companyId) throw new Error('companyId ausente.');
  const company = await prisma.company.findUnique({
    where: { id: companyId }, select: { id: true, name: true },
  });
  if (!company) throw new Error('Empresa não encontrada.');
  if (company.name !== DEMO_COMPANY_NAME) {
    throw new Error('Operação permitida apenas na empresa DEMO oficial (Loja Modelo PushSisten).');
  }
  return company;
}

/** Lê todas as linhas de um model isolado por empresa (paginado por cursor). */
async function readAll(def: DemoModelDef, companyId: string): Promise<any[]> {
  const delegate = (prisma as any)[def.delegate];
  const where = buildDemoWhere(def, companyId);
  if (def.scope === 'root') {
    return delegate.findMany({ where });
  }
  const out: any[] = [];
  let cursor: string | null = null;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const args: any = { where, take: READ_PAGE, orderBy: { id: 'asc' } };
    if (cursor) { args.cursor = { id: cursor }; args.skip = 1; }
    const page: any[] = await delegate.findMany(args);
    if (page.length === 0) break;
    out.push(...page);
    cursor = page[page.length - 1].id;
    if (page.length < READ_PAGE) break;
  }
  return out;
}

/** Converte ISO strings de volta para Date nos campos DateTime do model. */
function reviveDates(def: DemoModelDef, row: any): any {
  const out: any = { ...row };
  for (const f of def.dateFields) {
    if (out[f] != null) out[f] = new Date(out[f]);
  }
  return out;
}

export interface DemoSnapshotEnvelope {
  label: string;
  version: string;
  companyId: string;
  companyName: string;
  createdAt: string;
  datasets: Record<string, any[]>;
  recordCounts: Record<string, number>;
  totalRecords: number;
}

/** Monta o envelope completo do estado atual da empresa DEMO. */
export async function buildDemoSnapshot(companyId: string): Promise<DemoSnapshotEnvelope> {
  const company = await assertIsDemoCompany(companyId);
  const datasets: Record<string, any[]> = {};
  const recordCounts: Record<string, number> = {};
  let totalRecords = 0;
  for (const def of DEMO_MODELS) {
    const rows = await readAll(def, companyId);
    datasets[def.key] = rows;
    recordCounts[def.key] = rows.length;
    totalRecords += rows.length;
  }
  return {
    label: DEMO_SNAPSHOT_LABEL,
    version: DEMO_SNAPSHOT_VERSION,
    companyId,
    companyName: company.name,
    createdAt: new Date().toISOString(),
    datasets,
    recordCounts,
    totalRecords,
  };
}

/** Metadados do snapshot oficial (sem o payload pesado). */
export async function getDemoSnapshotStatus() {
  const snap = await prisma.demoSnapshot.findUnique({
    where: { label: DEMO_SNAPSHOT_LABEL },
    select: {
      id: true, label: true, companyId: true, companyName: true, version: true,
      recordCounts: true, totalRecords: true, createdById: true, createdByName: true,
      createdAt: true, updatedAt: true,
    },
  });
  return snap;
}

export interface CreateSnapshotResult {
  created: boolean;
  alreadyExisted: boolean;
  label: string;
  totalRecords: number;
  recordCounts: Record<string, number>;
  companyId: string;
}

/**
 * ETAPA 1 — Cria o snapshot oficial DEMO_V1. Idempotente: se já existe e
 * force !== true, retorna o existente sem recapturar/duplicar.
 */
export async function createDemoSnapshot(opts: {
  createdById?: string | null;
  createdByName?: string | null;
  force?: boolean;
} = {}): Promise<CreateSnapshotResult> {
  const company = await resolveDemoCompany();
  if (!company) throw new Error('Empresa DEMO não encontrada. Rode o seed da DEMO primeiro.');

  const existing = await prisma.demoSnapshot.findUnique({ where: { label: DEMO_SNAPSHOT_LABEL } });
  if (existing && !opts.force) {
    return {
      created: false, alreadyExisted: true, label: DEMO_SNAPSHOT_LABEL,
      totalRecords: existing.totalRecords,
      recordCounts: (existing.recordCounts as any) || {},
      companyId: existing.companyId,
    };
  }

  const envelope = await buildDemoSnapshot(company.id);
  const data = {
    companyId: envelope.companyId,
    companyName: envelope.companyName,
    version: envelope.version,
    payload: envelope as any,
    recordCounts: envelope.recordCounts as any,
    totalRecords: envelope.totalRecords,
    createdById: opts.createdById ?? null,
    createdByName: opts.createdByName ?? null,
  };
  await prisma.demoSnapshot.upsert({
    where: { label: DEMO_SNAPSHOT_LABEL },
    create: { label: DEMO_SNAPSHOT_LABEL, ...data },
    update: data,
  });

  return {
    created: true, alreadyExisted: !!existing, label: DEMO_SNAPSHOT_LABEL,
    totalRecords: envelope.totalRecords, recordCounts: envelope.recordCounts,
    companyId: envelope.companyId,
  };
}

export interface RestoreResult {
  companyId: string;
  deleted: Record<string, number>;
  inserted: Record<string, number>;
  totalDeleted: number;
  totalInserted: number;
  recompute: Record<string, string>;
  durationMs: number;
}

/**
 * ETAPA 2 — Restauração destrutiva IN-PLACE do snapshot DEMO_V1.
 * Apaga integralmente os dados de negócio da empresa DEMO e reinsere o
 * estado canônico com os MESMOS ids. Em transação única (rollback automático).
 * NUNCA deleta a empresa; NUNCA toca assinatura/cobrança.
 */
export async function restoreDemoSnapshot(opts: {
  actorId?: string | null; actorName?: string | null;
} = {}): Promise<RestoreResult> {
  const startedAt = Date.now();
  const company = await resolveDemoCompany();
  if (!company) throw new Error('Empresa DEMO não encontrada.');
  const companyId = company.id;
  await assertIsDemoCompany(companyId); // barreira dupla

  const snap = await prisma.demoSnapshot.findUnique({ where: { label: DEMO_SNAPSHOT_LABEL } });
  if (!snap) throw new Error('Snapshot DEMO_V1 inexistente. Crie o snapshot antes de restaurar.');
  if (snap.companyId !== companyId) {
    throw new Error('Snapshot DEMO_V1 pertence a outra empresa. Restauração bloqueada por segurança.');
  }
  const envelope = snap.payload as unknown as DemoSnapshotEnvelope;
  const datasets = envelope.datasets || {};

  const deleted: Record<string, number> = {};
  const inserted: Record<string, number> = {};

  await prisma.$transaction(async (tx) => {
    // ---- 1. LIMPEZA: filhos → pais (ordem inversa), pulando a raiz (empresa) ----
    for (let i = DEMO_MODELS.length - 1; i >= 0; i--) {
      const def = DEMO_MODELS[i];
      if (def.scope === 'root') continue;
      const where = buildDemoWhere(def, companyId);
      const res = await (tx as any)[def.delegate].deleteMany({ where });
      deleted[def.key] = res.count ?? 0;
    }

    // ---- 2. INSERÇÃO: pais → filhos (ordem direta) ----
    for (const def of DEMO_MODELS) {
      const rows = datasets[def.key] || [];

      if (def.scope === 'root') {
        const src = reviveDates(def, rows[0] || {});
        const data: any = {};
        for (const f of COMPANY_RESTORE_FIELDS) {
          if (f in src) data[f] = src[f];
        }
        await (tx as any).company.update({ where: { id: companyId }, data });
        inserted[def.key] = 1;
        continue;
      }

      if (rows.length === 0) { inserted[def.key] = 0; continue; }

      const revived = rows.map((r) => reviveDates(def, r));
      const payloads = def.selfRefField
        ? revived.map((r) => ({ ...r, [def.selfRefField!]: null }))
        : revived;

      for (let i = 0; i < payloads.length; i += WRITE_CHUNK) {
        await (tx as any)[def.delegate].createMany({ data: payloads.slice(i, i + WRITE_CHUNK) });
      }

      // Fase 2 da auto-relação (parentId) — agora que todos os pais existem.
      if (def.selfRefField) {
        for (const r of revived) {
          const parent = r[def.selfRefField];
          if (parent != null) {
            await (tx as any)[def.delegate].update({
              where: { id: r.id }, data: { [def.selfRefField]: parent },
            });
          }
        }
      }
      inserted[def.key] = rows.length;
    }
  }, { timeout: 120000, maxWait: 20000 });

  const totalDeleted = Object.values(deleted).reduce((a, b) => a + b, 0);
  const totalInserted = Object.values(inserted).reduce((a, b) => a + b, 0);

  const recompute = await recomputeDemoAnalytics(companyId);

  return {
    companyId, deleted, inserted, totalDeleted, totalInserted,
    recompute, durationMs: Date.now() - startedAt,
  };
}

export interface RefreshDatesResult {
  companyId: string;
  shifted: boolean;
  reason?: string;
  deltaMs: number;
  deltaDays: number;
  anchorBefore: string | null;
  anchorAfter: string | null;
  fieldsUpdated: number;
  recompute: Record<string, string>;
  durationMs: number;
}

/**
 * ETAPA 3 — Atualização de Datas DEMO.
 * Desloca TODAS as referências temporais por um único delta (agora - última venda),
 * preservando integralmente as relações relativas entre elas. Não altera nenhum
 * valor financeiro, de venda ou de estoque. Não toca datas de assinatura/trial.
 */
export async function refreshDemoDates(opts: {
  actorId?: string | null; actorName?: string | null;
} = {}): Promise<RefreshDatesResult> {
  const startedAt = Date.now();
  const company = await resolveDemoCompany();
  if (!company) throw new Error('Empresa DEMO não encontrada.');
  const companyId = company.id;
  await assertIsDemoCompany(companyId);

  // Âncora = venda mais recente da DEMO.
  const agg = await prisma.sale.aggregate({ where: { companyId }, _max: { createdAt: true } });
  const anchor = agg._max.createdAt;
  if (!anchor) {
    return {
      companyId, shifted: false, reason: 'DEMO sem vendas para ancorar.', deltaMs: 0,
      deltaDays: 0, anchorBefore: null, anchorAfter: null, fieldsUpdated: 0,
      recompute: {}, durationMs: Date.now() - startedAt,
    };
  }
  const now = new Date();
  const deltaMs = now.getTime() - anchor.getTime();
  if (deltaMs <= 0) {
    return {
      companyId, shifted: false, reason: 'DEMO já está atual (âncora >= agora).', deltaMs,
      deltaDays: 0, anchorBefore: anchor.toISOString(), anchorAfter: anchor.toISOString(),
      fieldsUpdated: 0, recompute: {}, durationMs: Date.now() - startedAt,
    };
  }
  const deltaSecs = deltaMs / 1000;
  let fieldsUpdated = 0;

  await prisma.$transaction(async (tx) => {
    for (const def of DEMO_MODELS) {
      const exclude = new Set(def.shiftExclude || []);
      const shiftFields = def.dateFields.filter((f) => !exclude.has(f));
      if (shiftFields.length === 0) continue;

      // WHERE de isolamento por empresa (SQL cru).
      let whereSql: string;
      if (def.scope === 'root') {
        whereSql = `"id" = $2`;
      } else if (def.scope === 'company') {
        whereSql = `"companyId" = $2`;
      } else if (def.scope === 'relation' && def.shiftJoin) {
        whereSql = `"${def.shiftJoin.fkColumn}" IN (SELECT "id" FROM "${def.shiftJoin.parentTable}" WHERE "companyId" = $2)`;
      } else {
        continue; // relation sem join definido e sem datas relevantes
      }

      for (const col of shiftFields) {
        const sql =
          `UPDATE "${def.table}" SET "${col}" = "${col}" + make_interval(secs => $1) ` +
          `WHERE ${whereSql} AND "${col}" IS NOT NULL`;
        const affected: number = await (tx as any).$executeRawUnsafe(sql, deltaSecs, companyId);
        fieldsUpdated += Number(affected) || 0;
      }
    }
  }, { timeout: 120000, maxWait: 20000 });

  const recompute = await recomputeDemoAnalytics(companyId);

  return {
    companyId, shifted: true, deltaMs, deltaDays: Math.round(deltaMs / 86400000),
    anchorBefore: anchor.toISOString(), anchorAfter: now.toISOString(),
    fieldsUpdated, recompute, durationMs: Date.now() - startedAt,
  };
}

/**
 * Reflexo dos motores derivados após restauração/atualização da DEMO.
 *
 * DECISÃO DE PROJETO (preserva a calibração):
 *   - O Push Score, a Saúde da Loja, a DRE, o Fluxo de Caixa, a IA Gerente,
 *     os Insights e os Relatórios são TODOS calculados sob demanda (em tempo
 *     de leitura) pelas rotas oficiais do app a partir dos dados atuais.
 *   - Portanto, NÃO persistimos/recalculamos nada aqui que pudesse SOBRESCREVER
 *     o snapshot de Push Score CALIBRADO (que faz parte dos dados canônicos e
 *     é reinserido intacto pela restauração). Recomputar e regravar destruiria
 *     o valor calibrado — proibido pelas restrições da tarefa.
 *   - Esta função é SOMENTE LEITURA: valida/relata o estado calibrado restaurado
 *     sem alterar nenhum dado. Os motores refletem o novo estado automaticamente
 *     na próxima visualização de cada tela.
 */
export async function recomputeDemoAnalytics(companyId: string): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  try {
    const snap = await prisma.pushScoreSnapshot.findFirst({
      where: { companyId }, orderBy: { date: 'desc' },
    });
    out.pushScore = snap
      ? `Calibrado preservado (score ${snap.score}, ${snap.classification})`
      : 'Sem snapshot de Push Score.';
  } catch (e: any) {
    out.pushScore = `AVISO: ${e?.message || e}`;
  }
  out.saudeLoja = 'Derivada sob demanda (leitura) — reflete o estado restaurado.';
  out.dreFluxoCaixa = 'Derivados sob demanda (leitura).';
  out.iaGerente = 'Resumo gerado sob demanda na visualização.';
  out.insights = 'Gerados sob demanda por dia na visualização.';
  out.relatorios = 'Calculados sob demanda a partir dos dados restaurados.';
  return out;
}

/** Utilitário de verificação (não persiste): calcula o Push Score de leitura. */
export async function peekPushScore(companyId: string, date: Date = new Date()) {
  return computePushScore(companyId, date);
}
