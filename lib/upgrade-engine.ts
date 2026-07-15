/**
 * upgrade-engine.ts — MOTOR DE UPGRADE E RECOMENDAÇÃO COMERCIAL (PRIORIDADE 8.3)
 * ---------------------------------------------------------------------------
 * Avalia o consumo de uma empresa, identifica gargalos (usuários / IA) e
 * recomenda o próximo plano comercial mais adequado.
 *
 * IMPORTANTE: módulo PURO (sem prisma / sem I/O). Recebe os campos já lidos do
 * banco + o consumo atual e devolve a recomendação. Seguro para Edge, API e UI.
 *
 * REGRA DE NEGÓCIO: a recomendação é por CAPACIDADE (mais usuários / mais IA),
 * NUNCA por desbloqueio de módulo. O Trial mantém o produto completo.
 *
 * BILLING NEUTRO (TAREFA 8): expõe currentPlan / recommendedPlan / upgradeUrl
 * sem nenhuma integração de gateway de pagamento.
 */

import {
  PlanId, PlanDefinition, PLAN_CATALOG, PAID_PLANS_ORDERED, UNLIMITED, isUnlimited,
  normalizePlan, resolveLimits, buildPlanUsageReport, UsageAlertLevel,
  CompanyLimitsInput, USAGE_ALERT_THRESHOLDS,
} from './plan-engine';

/** Consumo atual da empresa. */
export interface UsageInput {
  userCount: number;
  aiCallsThisMonth: number;
}

/** Um recurso pressionado (>= 80% de uso). */
export interface UpgradeBottleneck {
  resource: 'users' | 'ai';
  label: string;
  used: number;
  limit: number;        // UNLIMITED = ilimitado
  percent: number;
  alertLevel: UsageAlertLevel;
}

/** Recomendação de upgrade (billing-neutral). */
export interface UpgradeRecommendation {
  currentPlan: PlanId;
  currentPlanLabel: string;
  recommendedPlan: PlanId | null;       // null = nenhum upgrade necessário / já no topo
  recommendedPlanLabel: string | null;
  shouldUpgrade: boolean;
  /** Motivo legível da recomendação (PT). null quando não há recomendação. */
  reason: string | null;
  /** Mensagem curta de alerta de proximidade do limite (PT). */
  alertMessage: string | null;
  /** Recursos pressionados (>= 80%). */
  bottlenecks: UpgradeBottleneck[];
  /** Maior nível de alerta entre os recursos. */
  highestAlertLevel: UsageAlertLevel;
  /** Estrutura NEUTRA para billing futuro (sem gateway). */
  upgradeUrl: string;
}

/** Ordem comercial de um plano. */
function planOrder(plan: PlanId): number {
  return PLAN_CATALOG[plan].order;
}

/**
 * Escolhe o menor plano (em ordem comercial) com ordem >= minOrder que acomoda
 * confortavelmente o consumo informado (com folga: limite estritamente maior).
 * Retorna null se nenhum plano pago comporta (sinaliza "plano de topo").
 */
function pickPlanForUsage(usage: UsageInput, minOrder: number): PlanDefinition | null {
  for (const p of PAID_PLANS_ORDERED) {
    if (p.order < minOrder) continue;
    const usersOk = isUnlimited(p.maxUsers) || p.maxUsers > usage.userCount;
    const aiOk = isUnlimited(p.aiQuotaMonthly) || p.aiQuotaMonthly > usage.aiCallsThisMonth;
    if (usersOk && aiOk) return p;
  }
  return null;
}

/** Monta a URL neutra de upgrade (preparação p/ billing — TAREFA 8). */
export function buildUpgradeUrl(from: PlanId, to: PlanId | null): string {
  if (!to) return '/planos';
  return `/planos?from=${from}&to=${to}`;
}

/**
 * Avalia o consumo e recomenda o próximo plano (TAREFA 4/5).
 */
export function evaluateUpgrade(company: CompanyLimitsInput, usage: UsageInput): UpgradeRecommendation {
  const report = buildPlanUsageReport(company, usage);
  const currentPlan = report.plan;
  const currentPlanLabel = PLAN_CATALOG[currentPlan].label;

  // Identifica gargalos (>= 80%).
  const bottlenecks: UpgradeBottleneck[] = [];
  if (!report.users.unlimited && report.users.alertLevel) {
    bottlenecks.push({
      resource: 'users', label: 'Usuários',
      used: report.users.used, limit: report.users.limit,
      percent: report.users.percent, alertLevel: report.users.alertLevel,
    });
  }
  if (!report.ai.unlimited && report.ai.alertLevel) {
    bottlenecks.push({
      resource: 'ai', label: 'Consultas de IA',
      used: report.ai.used, limit: report.ai.limit,
      percent: report.ai.percent, alertLevel: report.ai.alertLevel,
    });
  }

  const levelRank: Record<Exclude<UsageAlertLevel, null>, number> = { warning: 1, critical: 2, limit: 3 };
  let highestAlertLevel: UsageAlertLevel = null;
  for (const b of bottlenecks) {
    if (b.alertLevel && (!highestAlertLevel || levelRank[b.alertLevel] > levelRank[highestAlertLevel])) {
      highestAlertLevel = b.alertLevel;
    }
  }

  const baseResult: UpgradeRecommendation = {
    currentPlan, currentPlanLabel,
    recommendedPlan: null, recommendedPlanLabel: null,
    shouldUpgrade: false, reason: null, alertMessage: null,
    bottlenecks, highestAlertLevel,
    upgradeUrl: buildUpgradeUrl(currentPlan, null),
  };

  // Sem gargalo => sem recomendação de upgrade.
  if (bottlenecks.length === 0) return baseResult;

  // Para o Trial, qualquer plano pago serve de destino (conversão). Para pagos,
  // o destino precisa ser estritamente superior ao plano atual.
  const minOrder = currentPlan === 'trial' ? 1 : planOrder(currentPlan) + 1;
  const recommended = pickPlanForUsage(usage, minOrder)
    // Se nada comporta com folga, sobe para o plano de topo (Escala).
    ?? PAID_PLANS_ORDERED[PAID_PLANS_ORDERED.length - 1] ?? null;

  // Já está no topo e não há plano superior que ofereça mais capacidade.
  if (!recommended || (recommended.id === currentPlan)) {
    // Ainda assim, gera mensagem de alerta de proximidade do limite.
    return {
      ...baseResult,
      alertMessage: buildAlertMessage(bottlenecks, highestAlertLevel, currentPlanLabel),
    };
  }

  const reason = buildReason(bottlenecks, recommended);
  return {
    ...baseResult,
    recommendedPlan: recommended.id,
    recommendedPlanLabel: recommended.label,
    shouldUpgrade: true,
    reason,
    alertMessage: buildAlertMessage(bottlenecks, highestAlertLevel, currentPlanLabel),
    upgradeUrl: buildUpgradeUrl(currentPlan, recommended.id),
  };
}

/** Mensagem amigável de alerta de proximidade do limite (TAREFA 5). */
function buildAlertMessage(
  bottlenecks: UpgradeBottleneck[],
  level: UsageAlertLevel,
  planLabel: string,
): string | null {
  if (bottlenecks.length === 0 || !level) return null;
  const names = bottlenecks.map(b => b.label.toLowerCase()).join(' e ');
  if (level === 'limit') {
    return `Você atingiu o limite de ${names} do plano ${planLabel}.`;
  }
  if (level === 'critical') {
    return `Atenção: você já usou mais de 90% de ${names} do plano ${planLabel}.`;
  }
  return `Você está próximo do limite de ${names} do plano ${planLabel}.`;
}

/** Motivo da recomendação (TAREFA 5). */
function buildReason(bottlenecks: UpgradeBottleneck[], recommended: PlanDefinition): string {
  const names = bottlenecks.map(b => b.label.toLowerCase()).join(' e ');
  return `Seu uso atual de ${names} indica que o plano ${recommended.label} pode atender melhor sua operação.`;
}
