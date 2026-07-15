/**
 * subscription-engine.ts — MOTOR ÚNICO DE ASSINATURAS (PRIORIDADE 8.1B)
 * ---------------------------------------------------------------------------
 * Fonte ÚNICA de verdade para regras de assinatura/trial/bloqueio do PushSisten.
 * NENHUMA regra de assinatura pode ficar espalhada em middleware, APIs ou UI:
 * tudo passa por aqui.
 *
 * IMPORTANTE: este módulo é PURO (sem import de prisma / sem I/O). Recebe os
 * campos já lidos do banco e devolve a avaliação. Isso o torna seguro para uso
 * no Edge Runtime (middleware), em rotas de API e em componentes server/client.
 *
 * NÃO altera nenhum motor de negócio (Financeiro, Ledger, DRE, Push Score,
 * Insights, IA Gerente, Crediário). Apenas governança SaaS.
 */

/** Status oficiais padronizados (TAREFA 3 + P8.4 billing). */
export type SubscriptionStatus =
  | 'ACTIVE'
  | 'TRIAL'
  | 'PAST_DUE'   // inadimplência dentro do período de tolerância (continua usando)
  | 'SUSPENDED'
  | 'CANCELED'
  | 'EXPIRED';

/**
 * Período de tolerância padrão (dias) para inadimplência (P8.4 / TAREFA 10).
 * Configurável num único lugar. Pode ser sobrescrito por BILLING_GRACE_DAYS.
 */
export const DEFAULT_GRACE_PERIOD_DAYS = (() => {
  const raw = typeof process !== 'undefined' ? process.env?.BILLING_GRACE_DAYS : undefined;
  const n = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : 15;
})();

/** Nível de alerta de expiração de trial (TAREFA 9). */
export type SubscriptionAlertLevel = '7d' | '3d' | '1d' | 'expired' | null;

/** Insumos brutos lidos do banco (Company). */
export interface SubscriptionInput {
  isActive?: boolean | null;
  plan?: string | null;
  subscriptionStatus?: string | null;
  trialEndsAt?: Date | string | null;
  // --- Billing (P8.4) ---
  /** Estado financeiro vigente: NONE | ACTIVE | PAST_DUE | SUSPENDED | CANCELED. */
  billingStatus?: string | null;
  /** Fim do período de tolerância (quando billingStatus = PAST_DUE). */
  gracePeriodEndsAt?: Date | string | null;
}

/** Resultado completo da avaliação de assinatura. */
export interface SubscriptionEvaluation {
  /** Status efetivo CALCULADO (não confia apenas no banco). */
  status: SubscriptionStatus;
  /** true → empresa NÃO pode acessar áreas operacionais. */
  blocked: boolean;
  /** Código do motivo do bloqueio (auditoria / logs). */
  reason: string | null;
  /** Plano normalizado (lowercase). */
  plan: string;
  /** Data de término do trial (ou null). */
  trialEndsAt: Date | null;
  /** Dias restantes de trial (>=0). null se não for trial. */
  daysRemaining: number | null;
  /** Nível de alerta para o Painel Master. */
  alertLevel: SubscriptionAlertLevel;
  /** Rótulo amigável em PT-BR para exibição. */
  label: string;
}

/** Faixas de alerta (dias restantes) — configuráveis num único lugar. */
export const TRIAL_ALERT_THRESHOLDS = { d7: 7, d3: 3, d1: 1 } as const;

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

/** Dias inteiros entre agora e a data alvo (pode ser negativo se já passou). */
function daysUntil(target: Date | null, now: Date): number | null {
  if (!target) return null;
  const ms = target.getTime() - now.getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

function alertLevelFromDays(days: number | null): SubscriptionAlertLevel {
  if (days === null) return null;
  if (days <= 0) return 'expired';
  if (days <= TRIAL_ALERT_THRESHOLDS.d1) return '1d';
  if (days <= TRIAL_ALERT_THRESHOLDS.d3) return '3d';
  if (days <= TRIAL_ALERT_THRESHOLDS.d7) return '7d';
  return null;
}

const STATUS_LABELS: Record<SubscriptionStatus, string> = {
  ACTIVE: 'Ativa',
  TRIAL: 'Trial',
  PAST_DUE: 'Pagamento pendente',
  SUSPENDED: 'Suspensa',
  CANCELED: 'Cancelada',
  EXPIRED: 'Expirada',
};

/** Status efetivos que BLOQUEIAM o acesso operacional (TAREFA 5). */
export const BLOCKING_STATUSES: SubscriptionStatus[] = ['EXPIRED', 'SUSPENDED', 'CANCELED'];

/**
 * AVALIAÇÃO CENTRAL — calcula o status efetivo a partir dos campos do banco.
 *
 * Ordem de precedência (TAREFA 4):
 *  1. subscriptionStatus = canceled  → CANCELED
 *  2. subscriptionStatus = suspended → SUSPENDED
 *  3. isActive = false               → SUSPENDED (desativada pelo Master)
 *  4. plan = trial + trialEndsAt < hoje → EXPIRED (mesmo que salvo como active)
 *  5. plan = trial (válido)          → TRIAL
 *  6. demais (plano pago + active)   → ACTIVE
 */
export function evaluateSubscription(
  input: SubscriptionInput,
  now: Date = new Date()
): SubscriptionEvaluation {
  const plan = (input.plan ?? 'trial').toLowerCase().trim();
  const rawStatus = (input.subscriptionStatus ?? 'active').toLowerCase().trim();
  const trialEndsAt = toDate(input.trialEndsAt);
  const isActive = input.isActive !== false; // default true
  const billingStatus = (input.billingStatus ?? 'NONE').toUpperCase().trim();
  const gracePeriodEndsAt = toDate(input.gracePeriodEndsAt);

  const base = {
    plan,
    trialEndsAt,
    daysRemaining: null as number | null,
    alertLevel: null as SubscriptionAlertLevel,
  };

  // 1. Cancelada
  if (rawStatus === 'canceled' || rawStatus === 'cancelled') {
    return { ...base, status: 'CANCELED', blocked: true, reason: 'subscription_canceled', label: STATUS_LABELS.CANCELED };
  }

  // 2. Suspensa
  if (rawStatus === 'suspended') {
    return { ...base, status: 'SUSPENDED', blocked: true, reason: 'subscription_suspended', label: STATUS_LABELS.SUSPENDED };
  }

  // 3. Desativada manualmente pelo Master
  if (!isActive) {
    return { ...base, status: 'SUSPENDED', blocked: true, reason: 'inactive', label: STATUS_LABELS.SUSPENDED };
  }

  // 3.5 BILLING (P8.4) — estado financeiro automatizado pelo gateway via billing-engine.
  // Empresas sem assinatura no gateway ficam com billingStatus = NONE e seguem o
  // fluxo normal (trial/pago) — NUNCA inadimplentes (ex.: empresas legadas/Master manual).
  if (billingStatus === 'CANCELED') {
    return { ...base, status: 'CANCELED', blocked: true, reason: 'billing_canceled', label: STATUS_LABELS.CANCELED };
  }
  if (billingStatus === 'SUSPENDED') {
    return { ...base, status: 'SUSPENDED', blocked: true, reason: 'billing_suspended', label: STATUS_LABELS.SUSPENDED };
  }
  if (billingStatus === 'PAST_DUE') {
    // Dentro da tolerância → continua usando (NÃO bloqueia). Após o prazo → SUSPENDED.
    const withinGrace = gracePeriodEndsAt ? gracePeriodEndsAt.getTime() > now.getTime() : false;
    if (withinGrace) {
      return {
        ...base,
        status: 'PAST_DUE',
        blocked: false,
        reason: 'past_due_grace',
        daysRemaining: Math.max(daysUntil(gracePeriodEndsAt, now) ?? 0, 0),
        label: STATUS_LABELS.PAST_DUE,
      };
    }
    return { ...base, status: 'SUSPENDED', blocked: true, reason: 'past_due_expired', label: STATUS_LABELS.SUSPENDED };
  }

  // 4 & 5. Plano trial
  if (plan === 'trial') {
    const days = daysUntil(trialEndsAt, now);
    // trial expirado: data definida E já passou
    if (trialEndsAt && trialEndsAt.getTime() < now.getTime()) {
      return {
        ...base,
        status: 'EXPIRED',
        blocked: true,
        reason: 'trial_expired',
        daysRemaining: 0,
        alertLevel: 'expired',
        label: STATUS_LABELS.EXPIRED,
      };
    }
    // trial válido
    return {
      ...base,
      status: 'TRIAL',
      blocked: false,
      reason: null,
      daysRemaining: days !== null ? Math.max(days, 0) : null,
      alertLevel: alertLevelFromDays(days),
      label: STATUS_LABELS.TRIAL,
    };
  }

  // 6. Plano pago + ativo
  return { ...base, status: 'ACTIVE', blocked: false, reason: null, label: STATUS_LABELS.ACTIVE };
}

/**
 * FUNÇÃO ÚNICA (TAREFA 3) — retorna apenas o status efetivo padronizado.
 */
export function getSubscriptionStatus(
  input: SubscriptionInput,
  now: Date = new Date()
): SubscriptionStatus {
  return evaluateSubscription(input, now).status;
}

/** Atalho booleano — a empresa está bloqueada para áreas operacionais? */
export function isSubscriptionBlocked(
  input: SubscriptionInput,
  now: Date = new Date()
): boolean {
  return evaluateSubscription(input, now).blocked;
}

/** Rótulo PT-BR a partir do status. */
export function subscriptionStatusLabel(status: SubscriptionStatus): string {
  return STATUS_LABELS[status] ?? status;
}
