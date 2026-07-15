/**
 * AUTOMATION ENGINE — PRIORIDADE 6
 * ============================================================================
 * Transforma o plano de ação da IA Gerente (que por sua vez consome os
 * Insights oficiais + Push Score) em AÇÕES AUTOMÁTICAS acionáveis,
 * persistidas, idempotentes, auditáveis e multi-tenant.
 *
 * PRINCÍPIOS:
 *  - NÃO cria cálculos próprios nem insights próprios. Consome a fonte oficial
 *    via generateExecutiveSummary(companyId).
 *  - NÃO envia WhatsApp/e-mail real nesta fase. "Executar automação" =
 *    gerar a ação + registrar log + deixar pronta para execução futura.
 *  - Idempotente por (companyId, dia BRT, type, reference) via upsert.
 *  - Respeita EM_FORMACAO → ZERO ações automáticas.
 *  - 100% multi-tenant: tudo filtrado por companyId.
 * ============================================================================
 */

import { prisma } from '@/lib/db';
import { generateExecutiveSummary, ExecutiveSummary } from '@/lib/ia-gerente-engine';

// ========================
// TIPOS
// ========================

export type AutomationType =
  | 'ALERTA_INTERNO'
  | 'CLIENTE_INATIVO'
  | 'COBRANCA_CREDIARIO'
  | 'PRODUTO_PARADO'
  | 'ESTOQUE_BAIXO'
  | 'RELATORIO_GERENCIAL';

export type AutomationStatus = 'PENDENTE' | 'EXECUTADO' | 'IGNORADO' | 'ERRO';
export type AutomationSeverity = 'ALTO' | 'MEDIO' | 'BAIXO';
export type AutomationChannel = 'INTERNO' | 'WHATSAPP' | 'EMAIL';

export interface PlannedAction {
  type: AutomationType;
  severity: AutomationSeverity;
  reference: string;
  title: string;
  description: string;
  channel: AutomationChannel;
  insightCode: string | null;
  pushScoreImpact: number;
  payload: Record<string, any> | null;
}

export interface RunResult {
  companyId: string;
  date: Date;
  status: 'ATIVO' | 'EM_FORMACAO';
  created: number;
  existing: number;
  total: number;
  byType: Record<string, number>;
  bySeverity: Record<string, number>;
  actions: {
    id: string;
    type: string;
    status: string;
    severity: string;
    reference: string;
    title: string;
    wasCreated: boolean;
  }[];
}

// ========================
// HELPERS
// ========================

/** Normaliza data para 00:00 BRT (UTC-3) — mesma convenção dos engines oficiais. */
function startOfDayBRT(d: Date = new Date()): Date {
  const brt = new Date(d.getTime() - 3 * 3600000);
  brt.setUTCHours(0, 0, 0, 0);
  return new Date(brt.getTime() + 3 * 3600000);
}

function normSeverity(sev: string | undefined): AutomationSeverity {
  const s = (sev || '').toUpperCase();
  if (s === 'ALTO') return 'ALTO';
  if (s === 'MEDIO' || s === 'MÉDIO') return 'MEDIO';
  return 'BAIXO';
}

/**
 * Mapa: código de insight oficial → tipo de automação.
 * O engine NÃO inventa categorias; apenas roteia o que a IA Gerente já priorizou.
 */
const INSIGHT_TO_AUTOMATION: Record<string, AutomationType> = {
  // Clientes
  CLIENTE_SUMIDO: 'CLIENTE_INATIVO',
  CLIENTE_CHAMAR_HOJE: 'CLIENTE_INATIVO',
  // Crediário
  CREDIARIO_CLIENTES_RISCO: 'COBRANCA_CREDIARIO',
  CREDIARIO_INADIMPLENCIA_ALTA: 'COBRANCA_CREDIARIO',
  CREDIARIO_VENCENDO_PROXIMO: 'COBRANCA_CREDIARIO',
  // Estoque parado
  ESTOQUE_PARADO: 'PRODUTO_PARADO',
  ESTOQUE_EXCESSIVO: 'PRODUTO_PARADO',
  // Estoque baixo / ruptura
  ESTOQUE_BAIXO: 'ESTOQUE_BAIXO',
  ESTOQUE_ZERADO: 'ESTOQUE_BAIXO',
  // Financeiro → alerta interno
  FINANCEIRO_MARGEM_QUEDA: 'ALERTA_INTERNO',
  FINANCEIRO_RISCO_CAIXA: 'ALERTA_INTERNO',
  FINANCEIRO_RECEITA_DESACEL: 'ALERTA_INTERNO',
};

/**
 * Mapa de COMPATIBILIDADE: gatilhos do construtor legado (modelo `Automation`,
 * usados como preferências/rótulos pelo lojista) → código de insight oficial.
 *
 * IMPORTANTE: este mapa é APENAS documentação/vocabulário. NÃO existe executor
 * paralelo: a geração real das ações continua 100% baseada nos insights da
 * IA Gerente (ver INSIGHT_TO_AUTOMATION acima). Serve para alinhar o vocabulário
 * antigo da UI de configurações com a fila oficial AutomationAction.
 */
export const LEGACY_TRIGGER_TO_INSIGHT: Record<string, string> = {
  customer_inactive: 'CLIENTE_SUMIDO',
  vip_inactive: 'CLIENTE_CHAMAR_HOJE',
  low_stock: 'ESTOQUE_BAIXO',
  zero_stock: 'ESTOQUE_ZERADO',
  stagnant_product: 'ESTOQUE_PARADO',
  negative_balance: 'FINANCEIRO_RISCO_CAIXA',
  due_accounts: 'CREDIARIO_VENCENDO_PROXIMO',
  low_margin: 'FINANCEIRO_MARGEM_QUEDA',
  revenue_drop: 'FINANCEIRO_RECEITA_DESACEL',
  ticket_drop: 'FINANCEIRO_RECEITA_DESACEL',
};

/** Canal sugerido (rótulo apenas — NENHUM envio real é feito nesta fase). */
const TYPE_TO_CHANNEL: Record<AutomationType, AutomationChannel> = {
  ALERTA_INTERNO: 'INTERNO',
  CLIENTE_INATIVO: 'WHATSAPP',
  COBRANCA_CREDIARIO: 'WHATSAPP',
  PRODUTO_PARADO: 'INTERNO',
  ESTOQUE_BAIXO: 'INTERNO',
  RELATORIO_GERENCIAL: 'INTERNO',
};

const TYPE_TITLE: Record<AutomationType, string> = {
  ALERTA_INTERNO: 'Alerta interno',
  CLIENTE_INATIVO: 'Reativar cliente inativo',
  COBRANCA_CREDIARIO: 'Cobrança de crediário',
  PRODUTO_PARADO: 'Produto parado em estoque',
  ESTOQUE_BAIXO: 'Estoque baixo / ruptura',
  RELATORIO_GERENCIAL: 'Relatório gerencial do dia',
};

// ========================
// PLANEJAMENTO (consumindo a fonte oficial)
// ========================

/**
 * Constrói a lista de ações planejadas a partir do ExecutiveSummary da IA Gerente.
 * Cada recomendação oficial (1:1 com um insight) vira no máximo uma ação,
 * usando o insightCode como reference (garante idempotência e rastreabilidade).
 */
function buildPlannedActions(summary: ExecutiveSummary): PlannedAction[] {
  // EM_FORMACAO → nenhuma ação automática (regra de governança).
  if (summary.status === 'EM_FORMACAO') return [];

  const planned: PlannedAction[] = [];
  const seenRefs = new Set<string>();

  // Mapa insightCode → mensagem sugerida (para anexar no payload das ações de contato)
  const messageByCode = new Map<string, string>();
  for (const m of summary.suggestedMessages) {
    if (!messageByCode.has(m.insightCode)) messageByCode.set(m.insightCode, m.template);
  }

  for (const rec of summary.recommendations) {
    const type = INSIGHT_TO_AUTOMATION[rec.insightCode];
    if (!type) continue; // insight sem mapeamento de automação (ex.: forças/positivos)

    const reference = rec.insightCode; // 1 ação por insight/dia → idempotente
    if (seenRefs.has(reference)) continue;
    seenRefs.add(reference);

    const severity = normSeverity(rec.severity);
    const channel = TYPE_TO_CHANNEL[type];
    const template = messageByCode.get(rec.insightCode) || null;

    // Impacto no Push Score: ação crítica pesa mais (apenas rótulo informativo)
    const pushScoreImpact = severity === 'ALTO' ? 3 : severity === 'MEDIO' ? 2 : 1;

    planned.push({
      type,
      severity,
      reference,
      title: TYPE_TITLE[type],
      description: rec.action,
      channel,
      insightCode: rec.insightCode,
      pushScoreImpact,
      payload: {
        impactoEsperado: rec.impact,
        prioridade: rec.priority,
        ...(template ? { mensagemSugerida: template } : {}),
        // Marcador explícito: nenhuma mensagem é enviada nesta fase.
        envioReal: false,
      },
    });
  }

  // Relatório gerencial diário — sempre presente para empresa ATIVA.
  // Reference = data ISO do dia (1 relatório por dia → idempotente).
  const dayRef = startOfDayBRT(summary.generatedAt).toISOString().slice(0, 10);
  planned.push({
    type: 'RELATORIO_GERENCIAL',
    severity: 'BAIXO',
    reference: `RELATORIO_${dayRef}`,
    title: TYPE_TITLE.RELATORIO_GERENCIAL,
    description: summary.summary,
    channel: 'INTERNO',
    insightCode: null,
    pushScoreImpact: 0,
    payload: {
      pushScore: summary.pushScore,
      classification: summary.classification,
      totalInsights: summary.totalInsights,
      topRisks: summary.topRisks,
      envioReal: false,
    },
  });

  return planned;
}

// ========================
// PERSISTÊNCIA IDEMPOTENTE
// ========================

/**
 * Gera (ou reaproveita) as ações de automação do dia para uma empresa.
 * Idempotente: rodar 2x no mesmo dia NÃO duplica nada (upsert por chave única).
 * NÃO altera o status de ações já existentes (preserva EXECUTADO/IGNORADO).
 */
export async function generateAutomationActions(
  companyId: string,
  refDate: Date = new Date(),
): Promise<RunResult> {
  const date = startOfDayBRT(refDate);

  // 1. Consome a fonte oficial (IA Gerente → Insights + Push Score).
  const summary = await generateExecutiveSummary(companyId);

  // 2. Planeja ações a partir do resumo executivo.
  const planned = buildPlannedActions(summary);

  const resultActions: RunResult['actions'] = [];
  let created = 0;
  let existing = 0;
  const byType: Record<string, number> = {};
  const bySeverity: Record<string, number> = {};

  // 3. Upsert idempotente de cada ação planejada.
  for (const p of planned) {
    // Verifica se já existe (para distinguir created vs existing sem perder status).
    const existingRow = await prisma.automationAction.findUnique({
      where: {
        unique_action_per_company_day_type_ref: {
          companyId,
          date,
          type: p.type,
          reference: p.reference,
        },
      },
      select: { id: true, status: true },
    });

    let row;
    if (existingRow) {
      // Já existe: atualiza apenas o conteúdo informativo, preserva status.
      row = await prisma.automationAction.update({
        where: { id: existingRow.id },
        data: {
          severity: p.severity,
          title: p.title,
          description: p.description,
          channel: p.channel,
          payload: p.payload ?? undefined,
          insightCode: p.insightCode,
          pushScoreImpact: p.pushScoreImpact,
        },
      });
      existing++;
    } else {
      row = await prisma.automationAction.create({
        data: {
          companyId,
          date,
          type: p.type,
          status: 'PENDENTE',
          severity: p.severity,
          reference: p.reference,
          title: p.title,
          description: p.description,
          channel: p.channel,
          payload: p.payload ?? undefined,
          insightCode: p.insightCode,
          pushScoreImpact: p.pushScoreImpact,
        },
      });
      created++;
    }

    byType[p.type] = (byType[p.type] || 0) + 1;
    bySeverity[p.severity] = (bySeverity[p.severity] || 0) + 1;
    resultActions.push({
      id: row.id,
      type: row.type,
      status: row.status,
      severity: row.severity,
      reference: row.reference,
      title: row.title,
      wasCreated: !existingRow,
    });
  }

  return {
    companyId,
    date,
    status: summary.status,
    created,
    existing,
    total: planned.length,
    byType,
    bySeverity,
    actions: resultActions,
  };
}

/**
 * Execução manual segura das automações do dia.
 * = gera as ações + registra log de auditoria (ActivityLog).
 * NÃO dispara nenhuma mensagem real.
 */
export async function runAutomations(
  companyId: string,
  refDate: Date = new Date(),
  actor?: { userId?: string | null; userName?: string | null },
): Promise<RunResult> {
  const result = await generateAutomationActions(companyId, refDate);

  // Auditoria da execução (best-effort).
  try {
    await prisma.activityLog.create({
      data: {
        action: 'automation_run',
        description: `Automações geradas: ${result.created} nova(s), ${result.existing} já existente(s) (status ${result.status}).`,
        entityType: 'AutomationAction',
        entityId: null,
        metadata: {
          date: result.date.toISOString(),
          status: result.status,
          created: result.created,
          existing: result.existing,
          byType: result.byType,
          bySeverity: result.bySeverity,
        },
        userId: actor?.userId ?? null,
        userName: actor?.userName ?? 'Sistema',
        companyId,
      },
    });
  } catch (e) {
    /* auditoria é opcional, não bloqueia a geração */
  }

  return result;
}

// ========================
// CONSULTA DA FILA
// ========================

export interface QueueOptions {
  status?: AutomationStatus | AutomationStatus[];
  type?: AutomationType;
  date?: Date;
  limit?: number;
}

/**
 * Lista ações de automação de uma empresa (default: PENDENTE).
 * Sempre filtrado por companyId (multi-tenant).
 */
export async function getAutomationQueue(companyId: string, options: QueueOptions = {}) {
  const where: any = { companyId };

  if (options.status) {
    where.status = Array.isArray(options.status) ? { in: options.status } : options.status;
  } else {
    where.status = 'PENDENTE';
  }
  if (options.type) where.type = options.type;
  if (options.date) where.date = startOfDayBRT(options.date);

  const SEVERITY_ORDER = ['ALTO', 'MEDIO', 'BAIXO'];

  const actions = await prisma.automationAction.findMany({
    where,
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    take: options.limit ?? 200,
  });

  // Ordenação secundária por severidade (ALTO primeiro).
  actions.sort((a, b) => {
    if (a.date.getTime() !== b.date.getTime()) return b.date.getTime() - a.date.getTime();
    return SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity);
  });

  return actions;
}

/**
 * Atualiza o status de uma ação (EXECUTADO | IGNORADO | ERRO | PENDENTE).
 * Sempre valida companyId para impedir cross-tenant.
 * NÃO envia mensagem real — apenas marca o estado e o timestamp.
 */
export async function updateAutomationStatus(
  companyId: string,
  actionId: string,
  status: AutomationStatus,
  opts?: { error?: string | null },
) {
  const action = await prisma.automationAction.findFirst({
    where: { id: actionId, companyId },
  });
  if (!action) return null;

  return prisma.automationAction.update({
    where: { id: action.id },
    data: {
      status,
      executedAt: status === 'EXECUTADO' ? new Date() : action.executedAt,
      error: status === 'ERRO' ? (opts?.error ?? 'Erro não especificado') : null,
    },
  });
}
