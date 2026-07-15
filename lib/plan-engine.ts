/**
 * plan-engine.ts — MOTOR ÚNICO DE PLANOS E LIMITES (PRIORIDADE 8.2)
 * ---------------------------------------------------------------------------
 * Fonte ÚNICA de verdade para os limites de cada plano (usuários, quota de IA),
 * cálculo de consumo, percentuais e níveis de alerta (80/90/100%).
 *
 * IMPORTANTE: módulo PURO (sem import de prisma / sem I/O). Recebe os campos já
 * lidos do banco e devolve a avaliação. Seguro para Edge Runtime, APIs e UI.
 *
 * REGRA DE NEGÓCIO CRÍTICA (Trial):
 *  - O plano TRIAL tem acesso a TODAS as funcionalidades (produto completo).
 *  - NÃO se bloqueia módulos (Financeiro, Push Score, Insights, IA Gerente,
 *    Crediário, Automações, Relatórios, Dashboard, Central do Dia) por plano.
 *  - Restrições permitidas: tempo de uso (subscription-engine), quotas de IA e
 *    quotas de serviços que geram custo direto.
 *  - Trial = usuários ILIMITADOS (não é custo direto), com quota de IA generosa.
 *
 * NÃO altera nenhum motor de negócio. Apenas governança SaaS / limites.
 */

/** Planos oficiais do sistema. */
export type PlanId = 'trial' | 'starter' | 'pro' | 'enterprise';

/** Sentinela de "ilimitado". */
export const UNLIMITED = -1;
export function isUnlimited(limit: number | null | undefined): boolean {
  return limit === UNLIMITED || limit === null || limit === undefined;
}

/** Nível de alerta de utilização de um recurso (TAREFA 8). */
export type UsageAlertLevel = 'warning' | 'critical' | 'limit' | null;

/** Faixas de alerta (percentual de uso) — configuráveis num único lugar. */
export const USAGE_ALERT_THRESHOLDS = { warning: 80, critical: 90, limit: 100 } as const;

/** Definição de um plano no catálogo (técnico + comercial). */
export interface PlanDefinition {
  id: PlanId;
  /** Nome COMERCIAL exibido ao cliente (Trial / Essencial / Crescimento / Escala). */
  label: string;
  /** Limite de usuários. UNLIMITED = ilimitado. */
  maxUsers: number;
  /** Quota mensal de chamadas de IA. UNLIMITED = ilimitado. */
  aiQuotaMonthly: number;
  /** Dias de trial (apenas informativo p/ trial). */
  trialDays?: number;
  /** Descrição curta do plano. */
  description: string;
  // ---- Metadados COMERCIAIS (TAREFA 1/2/3) ----
  /** Frase de posicionamento (para quem é o plano). */
  tagline: string;
  /** Preço mensal de referência (R$). 0 = grátis/sob consulta. Neutro: sem gateway. */
  priceMonthly: number;
  /** Rótulo de preço já formatado para exibição (ex.: "R$ 97", "Grátis", "Sob consulta"). */
  priceLabel: string;
  /** Lista de benefícios para o cartão de plano. */
  features: string[];
  /** Destaque visual (plano recomendado — Crescimento). */
  highlight: boolean;
  /** Selo curto exibido no topo do cartão (ex.: "Mais popular"). */
  badge?: string;
  /** Nome do ícone (lucide) para o cartão. */
  icon: 'Clock' | 'Zap' | 'Crown' | 'Sparkles' | 'Rocket' | 'TrendingUp' | 'Building2';
  /** Cor de destaque (Tailwind gradient from-to) para o cartão. */
  accentGradient: string;
  /** Ordem comercial (do menor para o maior). */
  order: number;
}

/**
 * CATÁLOGO DE PLANOS (TAREFA 3) — usa APENAS recursos que já existem no sistema:
 * limite de usuários (maxUsers) e quota mensal de IA (aiQuotaMonthly).
 * Todos os módulos de negócio estão inclusos em TODOS os planos (inclusive trial).
 */
export const PLAN_CATALOG: Record<PlanId, PlanDefinition> = {
  trial: {
    id: 'trial',
    label: 'Trial',
    maxUsers: UNLIMITED,      // produto completo durante o teste
    aiQuotaMonthly: 100,      // quota generosa p/ experimentar a IA (custo direto)
    trialDays: 14,
    description: 'Experimente o PushSisten completo por 14 dias.',
    tagline: 'Conheça todo o sistema, sem limites de funcionalidade.',
    priceMonthly: 0,
    priceLabel: 'Grátis',
    features: [
      'Acesso COMPLETO a todos os módulos',
      'Central do Dia com orientação diária',
      'Usuários ilimitados durante o teste',
      '100 consultas de IA por mês',
      '14 dias para avaliar o resultado',
    ],
    highlight: false,
    icon: 'Clock',
    accentGradient: 'from-amber-400 to-orange-500',
    order: 0,
  },
  starter: {
    id: 'starter',
    label: 'Organização',
    maxUsers: 2,
    aiQuotaMonthly: 100,
    description: 'Comece a organizar seu negócio e gerenciar sua loja de forma profissional para crescer com mais controle.',
    tagline: 'Organize sua loja e gerencie seu negócio de forma profissional.',
    priceMonthly: 39.9,
    priceLabel: 'R$ 39,90',
    features: [
      'Até 2 usuários',
      'Acesso completo a todos os módulos',
      'PDV, estoque e financeiro completos',
      'Central do Dia diária',
      '100 consultas de IA por mês',
      'Suporte por WhatsApp',
    ],
    highlight: false,
    icon: 'Rocket',
    accentGradient: 'from-blue-500 to-blue-600',
    order: 1,
  },
  pro: {
    id: 'pro',
    label: 'Evolução',
    maxUsers: 10,
    aiQuotaMonthly: 500,
    description: 'Tenha mais inteligência na gestão, acompanhe indicadores e tome decisões com mais segurança.',
    tagline: 'Mais inteligência e indicadores para decidir com segurança.',
    priceMonthly: 57,
    priceLabel: 'R$ 57,00',
    features: [
      'Até 10 usuários',
      'Tudo do Organização',
      '500 consultas de IA por mês',
      'IA Gerente e análise de estoque por IA',
      'Indicadores e Insights aprofundados',
      'Suporte prioritário',
    ],
    highlight: true,
    badge: 'Mais popular',
    icon: 'TrendingUp',
    accentGradient: 'from-violet-500 to-violet-600',
    order: 2,
  },
  enterprise: {
    id: 'enterprise',
    label: 'Expansão',
    maxUsers: 25,
    aiQuotaMonthly: 1500,
    description: 'Estruture sua operação para crescer com equipe, processos e gestão em escala.',
    tagline: 'Estruture sua operação para crescer em escala.',
    priceMonthly: 97,
    priceLabel: 'R$ 97,00',
    features: [
      'Até 25 usuários',
      'Tudo do Evolução',
      '1.500 consultas de IA por mês',
      'Gestão em escala para equipe e processos',
      'Ideal para redes e atacados',
      'Atendimento premium',
    ],
    highlight: false,
    icon: 'Building2',
    accentGradient: 'from-emerald-500 to-emerald-600',
    order: 3,
  },
};

/**
 * SELO COMERCIAL DE FUNDADORES (TAREFA 1).
 * Exibido nos cartões de planos pagos e na página /planos como um destaque de
 * preço promocional para os primeiros clientes.
 */
export const FOUNDER_BADGE = {
  label: 'Fundadores PushSisten',
  info: 'Preço especial para os primeiros clientes fundadores.',
} as const;

/**
 * ESTRUTURA À PROVA DE FUTURO (TAREFA 1) — alteração de preços sem impactar
 * clientes já assinantes:
 *  - Os valores `priceMonthly` deste catálogo são o preço COMERCIAL VIGENTE,
 *    usado apenas para NOVAS contratações e exibição.
 *  - Cada assinatura ativa guarda o próprio valor cobrado (campo `priceAmount`
 *    em BillingSubscription). Reajustar os preços aqui NÃO altera o valor das
 *    assinaturas já existentes — elas mantêm o preço de fundador contratado.
 *  - Os limites (usuários/IA) de uma empresa já existente também são preservados
 *    pelos valores salvos por empresa (ver `resolveLimits`); o catálogo só define
 *    os padrões aplicados a novas contratações.
 */

/** Catálogo em ordem comercial (do menor ao maior). Útil para listagens. */
export const PLAN_CATALOG_ORDERED: PlanDefinition[] = Object.values(PLAN_CATALOG).sort((a, b) => a.order - b.order);

/** Planos pagos (exclui o trial) em ordem comercial. */
export const PAID_PLANS_ORDERED: PlanDefinition[] = PLAN_CATALOG_ORDERED.filter(p => p.id !== 'trial');

/** Rótulo comercial de um plano (helper de conveniência). */
export function getPlanLabel(plan: string | null | undefined): string {
  return getPlanDefinition(plan).label;
}

/**
 * CANDIDATOS A RECURSO PREMIUM (TAREFA 6) — apenas RELATÓRIO/mapa.
 * NENHUM destes é bloqueado atualmente (regra de negócio: trial = produto completo).
 * Servem como referência futura caso se decida diferenciar planos pagos.
 */
export const PREMIUM_FEATURE_CANDIDATES = [
  { key: 'ia_gerente', label: 'IA Gerente (chat estratégico)', note: 'Gera custo direto de IA — hoje governado por QUOTA, não por bloqueio de módulo.' },
  { key: 'estoque_ia', label: 'Análise de Estoque por IA', note: 'Gera custo direto de IA — governado por quota.' },
  { key: 'automacoes', label: 'Automações', note: 'Candidato a limite de quantidade em planos inferiores (não aplicado).' },
  { key: 'whatsapp', label: 'Disparos WhatsApp', note: 'Candidato a quota se houver custo de envio (não aplicado).' },
  { key: 'relatorios_avancados', label: 'Relatórios avançados / exportações', note: 'Candidato a exclusividade em planos superiores (não aplicado).' },
] as const;

/** Normaliza um valor de plano para um PlanId válido. */
export function normalizePlan(plan: string | null | undefined): PlanId {
  const p = (plan ?? 'trial').toLowerCase().trim();
  if (p === 'starter' || p === 'pro' || p === 'enterprise' || p === 'trial') return p;
  return 'trial';
}

/** Retorna a definição do plano (fallback trial). */
export function getPlanDefinition(plan: string | null | undefined): PlanDefinition {
  return PLAN_CATALOG[normalizePlan(plan)];
}

/** Calcula o percentual de uso (0–100+, arredondado). Ilimitado => 0. */
export function usagePercent(used: number, limit: number): number {
  if (isUnlimited(limit)) return 0;
  if (limit <= 0) return used > 0 ? 100 : 0;
  return Math.round((used / limit) * 100);
}

/** Nível de alerta a partir do percentual (TAREFA 8). */
export function usageAlertLevel(percent: number, unlimited = false): UsageAlertLevel {
  if (unlimited) return null;
  if (percent >= USAGE_ALERT_THRESHOLDS.limit) return 'limit';
  if (percent >= USAGE_ALERT_THRESHOLDS.critical) return 'critical';
  if (percent >= USAGE_ALERT_THRESHOLDS.warning) return 'warning';
  return null;
}

/** Avaliação de utilização de um recurso individual. */
export interface ResourceUsage {
  used: number;
  limit: number;       // UNLIMITED = ilimitado
  unlimited: boolean;
  percent: number;     // 0 quando ilimitado
  remaining: number;   // restante (>=0). Ilimitado => UNLIMITED
  alertLevel: UsageAlertLevel;
  exceeded: boolean;   // used >= limit (false quando ilimitado)
}

export function evaluateResource(used: number, limit: number): ResourceUsage {
  const unlimited = isUnlimited(limit);
  const safeUsed = Math.max(0, used || 0);
  const percent = usagePercent(safeUsed, limit);
  return {
    used: safeUsed,
    limit,
    unlimited,
    percent,
    remaining: unlimited ? UNLIMITED : Math.max(0, limit - safeUsed),
    alertLevel: usageAlertLevel(percent, unlimited),
    exceeded: unlimited ? false : safeUsed >= limit,
  };
}

/** Insumos da empresa para resolver limites efetivos. */
export interface CompanyLimitsInput {
  plan?: string | null;
  maxUsers?: number | null;
  aiQuotaMonthly?: number | null;
}

/**
 * Limites EFETIVOS da empresa.
 * - Usuários: TRIAL sempre ilimitado (produto completo). Demais planos usam o
 *   valor armazenado (customizável pelo Master) ou o padrão do catálogo.
 * - IA: usa o valor armazenado (customizável) ou o padrão do catálogo.
 */
export function resolveLimits(company: CompanyLimitsInput): { plan: PlanId; maxUsers: number; aiQuotaMonthly: number } {
  const plan = normalizePlan(company.plan);
  const def = PLAN_CATALOG[plan];

  // Sentinela por empresa: valor salvo === UNLIMITED (-1) concede ilimitado
  // independentemente do catálogo (mecanismo de cortesia / preservação de
  // clientes — retrocompatível: empresas com valores positivos ou 0 não mudam).
  const maxUsers = plan === 'trial'
    ? UNLIMITED
    : (company.maxUsers === UNLIMITED
        ? UNLIMITED
        : (typeof company.maxUsers === 'number' && company.maxUsers > 0 ? company.maxUsers : def.maxUsers));

  let aiQuotaMonthly: number;
  if (def.aiQuotaMonthly === UNLIMITED || company.aiQuotaMonthly === UNLIMITED) {
    aiQuotaMonthly = UNLIMITED; // catálogo ilimitado OU cortesia por empresa
  } else if (typeof company.aiQuotaMonthly === 'number' && company.aiQuotaMonthly > 0) {
    aiQuotaMonthly = company.aiQuotaMonthly;
  } else {
    aiQuotaMonthly = def.aiQuotaMonthly;
  }

  return { plan, maxUsers, aiQuotaMonthly };
}

/** Resultado de "posso adicionar mais um usuário?" (TAREFA 4). */
export interface AddUserCheck {
  allowed: boolean;
  limit: number;        // UNLIMITED = ilimitado
  current: number;
  unlimited: boolean;
  reason: string | null;
  message: string | null;
}

export function canAddUser(company: CompanyLimitsInput, currentUsers: number): AddUserCheck {
  const { plan, maxUsers } = resolveLimits(company);
  const unlimited = isUnlimited(maxUsers);

  // Trial e Enterprise: usuários ilimitados
  if (unlimited) {
    return { allowed: true, limit: UNLIMITED, current: currentUsers, unlimited: true, reason: null, message: null };
  }

  if (currentUsers >= maxUsers) {
    const def = PLAN_CATALOG[plan];
    return {
      allowed: false,
      limit: maxUsers,
      current: currentUsers,
      unlimited: false,
      reason: 'user_limit_reached',
      message: `Você atingiu o limite de ${maxUsers} usuário(s) do plano ${def.label}. Faça upgrade do plano para adicionar mais usuários.`,
    };
  }

  return { allowed: true, limit: maxUsers, current: currentUsers, unlimited: false, reason: null, message: null };
}

/** Resultado de "posso consumir mais uma chamada de IA?" (TAREFA 5). */
export interface AiQuotaCheck {
  allowed: boolean;
  limit: number;        // UNLIMITED = ilimitado
  used: number;
  remaining: number;    // UNLIMITED se ilimitado
  unlimited: boolean;
  percent: number;
  alertLevel: UsageAlertLevel;
  reason: string | null;
  message: string | null;
}

export function checkAiQuota(company: CompanyLimitsInput, aiCallsThisMonth: number): AiQuotaCheck {
  const { aiQuotaMonthly } = resolveLimits(company);
  const res = evaluateResource(aiCallsThisMonth, aiQuotaMonthly);

  if (res.unlimited) {
    return { allowed: true, limit: UNLIMITED, used: res.used, remaining: UNLIMITED, unlimited: true, percent: 0, alertLevel: null, reason: null, message: null };
  }

  if (res.exceeded) {
    return {
      allowed: false,
      limit: aiQuotaMonthly,
      used: res.used,
      remaining: 0,
      unlimited: false,
      percent: res.percent,
      alertLevel: 'limit',
      reason: 'ai_quota_exceeded',
      message: `Você atingiu o limite de ${aiQuotaMonthly} consultas de IA deste mês. A quota é renovada no início do próximo mês. Para mais consultas, faça upgrade do plano.`,
    };
  }

  return {
    allowed: true,
    limit: aiQuotaMonthly,
    used: res.used,
    remaining: res.remaining,
    unlimited: false,
    percent: res.percent,
    alertLevel: res.alertLevel,
    reason: null,
    message: null,
  };
}

/** Relatório completo de plano + consumo (TAREFA 7) para o Painel Master / UI. */
export interface PlanUsageReport {
  plan: PlanId;
  planLabel: string;
  users: ResourceUsage;
  ai: ResourceUsage;
}

export function buildPlanUsageReport(
  company: CompanyLimitsInput,
  usage: { userCount: number; aiCallsThisMonth: number }
): PlanUsageReport {
  const { plan, maxUsers, aiQuotaMonthly } = resolveLimits(company);
  return {
    plan,
    planLabel: PLAN_CATALOG[plan].label,
    users: evaluateResource(usage.userCount, maxUsers),
    ai: evaluateResource(usage.aiCallsThisMonth, aiQuotaMonthly),
  };
}
