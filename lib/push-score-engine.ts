/**
 * PUSH SCORE™ — ENGINE OFICIAL DE CÁLCULO (PRIORIDADE 3.3)
 * ============================================================
 * Calcula e persiste o Push Score (0-100) de uma empresa usando
 * EXCLUSIVAMENTE métricas homologadas e NORMALIZADAS.
 *
 * REGRA CRÍTICA: NUNCA usa valores absolutos (ex.: "caixa = R$ 20.000").
 * Todas as dimensões usam indicadores relativos para que o score funcione
 * para qualquer tamanho de empresa:
 *   - Rentabilidade  → margem líquida %
 *   - Liquidez       → cobertura de caixa (meses) + projeção
 *   - Estoque        → giro (ratio) + capital parado %
 *   - Inadimplência  → % vencido sobre carteira
 *   - Clientes       → % clientes ativos + % recorrência
 *   - Crescimento    → variação % de faturamento (MoM)
 *
 * NÃO contém: dashboard, gráficos, IA, alertas, WhatsApp, scheduler.
 * Apenas: motor de cálculo + persistência de snapshot.
 *
 * Fontes oficiais (todas já homologadas em lib/financial-engine.ts e crediário):
 *   calculateDRE, calculateSalesMetrics, getCashBalance,
 *   calculateOperatingExpenses, getCashFlowProjection,
 *   calculateStockMetrics, getReceivables, Installment (crediário), Customer.
 */

import { prisma } from '@/lib/db';
import {
  calculateDRE,
  calculateSalesMetrics,
  getCashBalance,
  calculateOperatingExpenses,
  getCashFlowProjection,
  calculateStockMetrics,
  getReceivables,
  pctChange,
} from '@/lib/financial-engine';

// ============================================================
// PESOS OFICIAIS V1 (fallback quando não há PushScoreConfig)
// ============================================================
export const DEFAULT_WEIGHTS = {
  rentability: 25,
  liquidity: 20,
  inventory: 15,
  default: 15,
  customer: 15,
  growth: 10,
} as const;

// ============================================================
// REGRA "EM FORMAÇÃO"
// ------------------------------------------------------------
// Uma loja entra em EM_FORMACAO (score = null) quando ainda não
// possui base estatística mínima para um score confiável:
//   - menos de 30 dias de operação (a dimensão Crescimento compara
//     mês atual × mês anterior — exige ao menos 1 ciclo mensal), OU
//   - menos de MIN_SALES vendas concluídas no total.
//
// MIN_SALES = 10: abaixo disso métricas como margem, giro e
// crescimento oscilam de forma errática (uma única venda ou
// devolução distorce o percentual), gerando um número enganoso.
// 10 vendas é o piso prático onde médias começam a ter significado
// para o varejo de moda sem exigir um volume alto demais.
// ============================================================
export const MIN_OPERATION_DAYS = 30;
export const MIN_SALES = 10;

// ============================================================
// CLASSIFICAÇÃO (faixas oficiais)
// ============================================================
export function classifyScore(score: number): string {
  if (score >= 85) return 'SAUDAVEL';
  if (score >= 70) return 'ESTAVEL';
  if (score >= 55) return 'ATENCAO';
  if (score >= 40) return 'RISCO';
  return 'CRITICO';
}

// ============================================================
// HELPERS DE NORMALIZAÇÃO
// ============================================================

/**
 * Interpolação linear por partes (piecewise).
 * `points` = lista [valor, score] ordenada ASC por valor.
 * Abaixo do primeiro ponto → score do primeiro; acima do último →
 * score do último; entre dois pontos → interpolação linear.
 * Resultado sempre em [0, 100].
 */
function piecewise(value: number, points: [number, number][]): number {
  if (points.length === 0) return 0;
  if (value <= points[0][0]) return clamp(points[0][1]);
  if (value >= points[points.length - 1][0]) return clamp(points[points.length - 1][1]);
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[i + 1];
    if (value >= x0 && value <= x1) {
      const t = x1 === x0 ? 0 : (value - x0) / (x1 - x0);
      return clamp(y0 + t * (y1 - y0));
    }
  }
  return clamp(points[points.length - 1][1]);
}

function clamp(v: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, v));
}

/** Winsorização: limita um valor a [lo, hi] para conter outliers. */
function winsorize(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

// ============================================================
// ESCALAS DE NORMALIZAÇÃO (justificadas em cada dimensão)
// ============================================================

// Rentabilidade — margem líquida %. Benchmark moda: ~10-15% saudável,
// 20%+ excelente, ≤0 crítico.
const RENTABILITY_SCALE: [number, number][] = [
  [0, 0], [5, 20], [10, 40], [15, 60], [20, 80], [25, 100],
];

// Liquidez — cobertura de caixa em meses (saldo / burn mensal).
// <0,5 mês = frágil; 1 mês = mínimo; 2 meses = confortável; 3+ = forte.
const LIQUIDITY_SCALE: [number, number][] = [
  [0, 0], [0.5, 30], [1, 50], [2, 80], [3, 100],
];

// Estoque — Giro anualizado (CMV anualizado / capital investido).
// Moda gira ~2-4×/ano; 6+ é excelente; 0 = parado.
const TURNOVER_SCALE: [number, number][] = [
  [0, 0], [1, 25], [2, 45], [4, 75], [6, 100],
];

// Estoque — Capital parado % (quanto MENOR melhor).
const STAGNANT_SCALE: [number, number][] = [
  [0, 100], [15, 70], [30, 40], [50, 10], [100, 0],
];

// Inadimplência — % vencido sobre carteira (quanto MENOR melhor).
const DEFAULT_SCALE: [number, number][] = [
  [0, 100], [5, 80], [10, 55], [20, 25], [30, 0],
];

// Clientes ativos — % da base que comprou nos últimos 90 dias.
const CUSTOMER_ACTIVE_SCALE: [number, number][] = [
  [0, 0], [25, 35], [50, 65], [75, 90], [90, 100],
];

// Clientes recorrência — % da base com mais de 1 compra.
const CUSTOMER_RECURRENCE_SCALE: [number, number][] = [
  [0, 0], [20, 40], [40, 70], [60, 100],
];

// Crescimento — variação % MoM do faturamento (winsorizado a ±50).
const GROWTH_SCALE: [number, number][] = [
  [-20, 0], [-10, 30], [0, 60], [10, 85], [20, 100],
];

// Janela para considerar um cliente "ativo" (dias)
const CUSTOMER_ACTIVE_WINDOW_DAYS = 90;

// ============================================================
// TIPOS
// ============================================================
export interface PushScoreWeights {
  rentability: number;
  liquidity: number;
  inventory: number;
  default: number;
  customer: number;
  growth: number;
}

export interface PushScoreResult {
  status: 'EM_FORMACAO' | 'ATIVO';
  score: number | null;
  classification: string | null;
  subscores: {
    rentabilityScore: number | null;
    liquidityScore: number | null;
    inventoryScore: number | null;
    defaultScore: number | null;
    customerBaseScore: number | null;
    growthScore: number | null;
  };
  rawMetrics: Record<string, any>;
  appliedWeights: PushScoreWeights | null;
  date: Date;
}

// ============================================================
// HELPERS DE DATA
// ============================================================

/** Normaliza para 00:00 do dia em BRT (UTC-3), retornando um Date UTC. */
function startOfDayBRT(ref: Date): Date {
  // BRT = UTC-3. Convertendo: meia-noite BRT = 03:00 UTC do mesmo dia.
  const brt = new Date(ref.getTime() - 3 * 60 * 60 * 1000);
  const y = brt.getUTCFullYear();
  const m = brt.getUTCMonth();
  const d = brt.getUTCDate();
  return new Date(Date.UTC(y, m, d, 3, 0, 0, 0));
}

// ============================================================
// RESOLUÇÃO DE CONFIGURAÇÃO (pesos)
// ------------------------------------------------------------
// Prioridade: config da empresa (active) → config global (companyId
// null, active) → DEFAULT_WEIGHTS.
// ============================================================
export async function resolveWeights(companyId: string): Promise<PushScoreWeights> {
  const cfgCompany = await prisma.pushScoreConfig.findFirst({
    where: { companyId, active: true },
  });
  const cfg = cfgCompany ?? (await prisma.pushScoreConfig.findFirst({
    where: { companyId: null, active: true },
  }));

  if (cfg) {
    return {
      rentability: cfg.rentabilityWeight,
      liquidity: cfg.liquidityWeight,
      inventory: cfg.inventoryWeight,
      default: cfg.defaultWeight,
      customer: cfg.customerWeight,
      growth: cfg.growthWeight,
    };
  }
  return { ...DEFAULT_WEIGHTS };
}

// ============================================================
// SUBSCORES — uma função independente por dimensão
// Cada função retorna { score (0-100|null), raw (insumos) }.
// score=null sinaliza dimensão NÃO APLICÁVEL (dispara repesagem).
// ============================================================

/** RENTABILIDADE → calculateDRE().margemLiquidaPct */
export async function calculateRentabilityScore(
  companyId: string,
  period: { gte: Date; lte: Date }
): Promise<{ score: number; raw: Record<string, any> }> {
  const dre = await calculateDRE(companyId, period);
  const margem = dre.margemLiquidaPct ?? 0;
  return {
    score: round1(piecewise(margem, RENTABILITY_SCALE)),
    raw: { margemLiquidaPct: round1(margem), receitaLiquida: dre.receitaLiquida, lucroLiquido: dre.lucroLiquido },
  };
}

/**
 * LIQUIDEZ → getCashBalance() + calculateOperatingExpenses() + getCashFlowProjection()
 * Indicador principal: cobertura de caixa (meses) = saldo / burn mensal.
 * Burn mensal = despesas operacionais + financeiras dos últimos 30 dias.
 * Penalidade: se a projeção de 30 dias (fonte oficial Fluxo de Caixa) for
 * negativa, o subscore é reduzido (×0,6) por sinalizar aperto futuro.
 */
export async function calculateLiquidityScore(
  companyId: string
): Promise<{ score: number; raw: Record<string, any> }> {
  const now = new Date();
  const last30 = { gte: new Date(now.getTime() - 30 * 86400000), lte: now };

  const [cash, expenses, projection] = await Promise.all([
    getCashBalance(companyId),
    calculateOperatingExpenses(companyId, last30),
    getCashFlowProjection(companyId, 30),
  ]);

  const monthlyBurn = (expenses.totalDespesasOperacionais ?? 0) + (expenses.totalDespesasFinanceiras ?? 0);
  // cobertura em meses (normalizada — não usa valor absoluto no score)
  let cashMonths: number;
  if (monthlyBurn > 0) {
    cashMonths = cash.saldo / monthlyBurn;
  } else {
    // sem despesas registradas: se há caixa positivo, cobertura alta (cap 3);
    // se caixa <= 0, cobertura 0.
    cashMonths = cash.saldo > 0 ? 3 : 0;
  }
  cashMonths = winsorize(cashMonths, 0, 6);

  let score = piecewise(cashMonths, LIQUIDITY_SCALE);
  const projectedNegative = projection.saldoProjetado < 0;
  if (projectedNegative) score = score * 0.6;

  return {
    score: round1(clamp(score)),
    raw: {
      cashMonths: round1(cashMonths),
      saldoCaixa: cash.saldo,
      monthlyBurn: Math.round(monthlyBurn * 100) / 100,
      saldoProjetado30d: Math.round(projection.saldoProjetado * 100) / 100,
      projectedNegative,
    },
  };
}

/**
 * SAÚDE DO ESTOQUE → calculateStockMetrics() + calculateSalesMetrics()
 * Divisão interna (arquitetura aprovada): 50% Giro + 50% Capital Parado.
 * Giro anualizado = (CMV dos últimos 30 dias × 12) / capital investido.
 */
export async function calculateInventoryScore(
  companyId: string
): Promise<{ score: number | null; raw: Record<string, any> }> {
  const now = new Date();
  const last30 = { gte: new Date(now.getTime() - 30 * 86400000), lte: now };

  const [stock, sales30] = await Promise.all([
    calculateStockMetrics(companyId),
    calculateSalesMetrics(companyId, last30),
  ]);

  // Sem capital investido (loja sem estoque cadastrado) → dimensão não aplicável.
  if ((stock.capitalInvestido ?? 0) <= 0) {
    return { score: null, raw: { capitalInvestido: 0, motivo: 'sem_estoque' } };
  }

  const capitalParadoPct = (stock.capitalParado / stock.capitalInvestido) * 100;
  const cmvAnualizado = (sales30.cmv ?? 0) * 12;
  const giro = cmvAnualizado / stock.capitalInvestido;

  const giroScore = piecewise(giro, TURNOVER_SCALE);
  const stagnantScore = piecewise(capitalParadoPct, STAGNANT_SCALE);
  const score = 0.5 * giroScore + 0.5 * stagnantScore;

  return {
    score: round1(clamp(score)),
    raw: {
      giroEstoque: round1(giro),
      capitalParadoPct: round1(capitalParadoPct),
      capitalInvestido: stock.capitalInvestido,
      capitalParado: stock.capitalParado,
      giroScore: round1(giroScore),
      stagnantScore: round1(stagnantScore),
    },
  };
}

/**
 * INADIMPLÊNCIA → crediário (Installment) + getReceivables() (AR)
 * Indicador: % vencido sobre a carteira total a receber.
 * Se NÃO há carteira (sem crediário e sem AR pendente) → dimensão NÃO
 * APLICÁVEL (score=null) → dispara repesagem dinâmica (peso redistribuído).
 */
export async function calculateDefaultScore(
  companyId: string
): Promise<{ score: number | null; raw: Record<string, any> }> {
  const now = new Date();

  const pendingInstallments = await prisma.installment.findMany({
    where: { companyId, status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] } },
    select: { amount: true, paidAmount: true, dueDate: true },
  });
  const crediarioTotal = pendingInstallments.reduce((s, i) => s + (i.amount - i.paidAmount), 0);
  const crediarioVencido = pendingInstallments
    .filter(i => i.dueDate < now)
    .reduce((s, i) => s + (i.amount - i.paidAmount), 0);

  const receivables = await getReceivables(companyId);
  const arPendente = receivables.saldoAccountReceivablePendente ?? 0;
  const arVencido = receivables.vencidasAccountReceivable ?? 0;

  const carteira = crediarioTotal + arPendente;
  const vencido = crediarioVencido + arVencido;

  if (carteira <= 0) {
    return { score: null, raw: { carteira: 0, motivo: 'sem_recebiveis' } };
  }

  const inadimplenciaPct = (vencido / carteira) * 100;
  return {
    score: round1(piecewise(inadimplenciaPct, DEFAULT_SCALE)),
    raw: {
      inadimplenciaPct: round1(inadimplenciaPct),
      carteiraTotal: Math.round(carteira * 100) / 100,
      totalVencido: Math.round(vencido * 100) / 100,
      crediarioTotal: Math.round(crediarioTotal * 100) / 100,
      arPendente: Math.round(arPendente * 100) / 100,
    },
  };
}

/**
 * BASE DE CLIENTES → Customer (CRM oficial)
 * Blend: 70% % clientes ativos (compra nos últimos 90 dias) +
 *        30% % recorrência (clientes com mais de 1 compra).
 * Se não há clientes cadastrados → dimensão NÃO APLICÁVEL (score=null).
 */
export async function calculateCustomerScore(
  companyId: string
): Promise<{ score: number | null; raw: Record<string, any> }> {
  const activeWindow = new Date(Date.now() - CUSTOMER_ACTIVE_WINDOW_DAYS * 86400000);

  const [totalClientes, ativos, recorrentes] = await Promise.all([
    prisma.customer.count({ where: { companyId, isActive: true } }),
    prisma.customer.count({ where: { companyId, isActive: true, lastPurchase: { gte: activeWindow } } }),
    prisma.customer.count({ where: { companyId, isActive: true, purchaseCount: { gt: 1 } } }),
  ]);

  if (totalClientes <= 0) {
    return { score: null, raw: { totalClientes: 0, motivo: 'sem_clientes' } };
  }

  const ativosPct = (ativos / totalClientes) * 100;
  const recorrenciaPct = (recorrentes / totalClientes) * 100;
  const ativosScore = piecewise(ativosPct, CUSTOMER_ACTIVE_SCALE);
  const recorrenciaScore = piecewise(recorrenciaPct, CUSTOMER_RECURRENCE_SCALE);
  const score = 0.7 * ativosScore + 0.3 * recorrenciaScore;

  return {
    score: round1(clamp(score)),
    raw: {
      clientesAtivosPct: round1(ativosPct),
      recorrenciaPct: round1(recorrenciaPct),
      totalClientes,
      clientesAtivos: ativos,
      clientesRecorrentes: recorrentes,
    },
  };
}

/**
 * CRESCIMENTO → calculateSalesMetrics (mês atual × mês anterior)
 * Variação % do faturamento líquido, winsorizada a ±50% para conter
 * picos de venda atacado que distorceriam o score.
 */
export async function calculateGrowthScore(
  companyId: string,
  ref: Date
): Promise<{ score: number; raw: Record<string, any> }> {
  const startCurrent = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), 1, 3, 0, 0));
  const startPrev = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() - 1, 1, 3, 0, 0));
  const endPrev = new Date(startCurrent.getTime() - 1);

  const [current, previous] = await Promise.all([
    calculateSalesMetrics(companyId, { gte: startCurrent, lte: ref }),
    calculateSalesMetrics(companyId, { gte: startPrev, lte: endPrev }),
  ]);

  const crescimentoPct = pctChange(current.faturamentoLiquido, previous.faturamentoLiquido);
  const winsorized = winsorize(crescimentoPct, -50, 50);

  return {
    score: round1(piecewise(winsorized, GROWTH_SCALE)),
    raw: {
      crescimentoPct: round1(crescimentoPct),
      faturamentoAtual: current.faturamentoLiquido,
      faturamentoAnterior: previous.faturamentoLiquido,
    },
  };
}

// ============================================================
// COMPUTAÇÃO DO SCORE (sem persistir) — núcleo da engine
// ============================================================
export async function computePushScore(
  companyId: string,
  ref: Date = new Date()
): Promise<PushScoreResult> {
  const date = startOfDayBRT(ref);

  // --- Regra EM FORMAÇÃO ---
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { createdAt: true },
  });
  const totalSales = await prisma.sale.count({ where: { companyId, status: 'concluida' } });
  const daysOperation = company?.createdAt
    ? Math.floor((ref.getTime() - new Date(company.createdAt).getTime()) / 86400000)
    : 0;

  if (daysOperation < MIN_OPERATION_DAYS || totalSales < MIN_SALES) {
    return {
      status: 'EM_FORMACAO',
      score: null,
      classification: null,
      subscores: {
        rentabilityScore: null, liquidityScore: null, inventoryScore: null,
        defaultScore: null, customerBaseScore: null, growthScore: null,
      },
      rawMetrics: {
        emFormacao: true,
        daysOperation,
        totalSales,
        minOperationDays: MIN_OPERATION_DAYS,
        minSales: MIN_SALES,
      },
      appliedWeights: null,
      date,
    };
  }

  // Período de referência para dimensões mensais: mês corrente (até ref)
  const startCurrentMonth = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), 1, 3, 0, 0));
  const period = { gte: startCurrentMonth, lte: ref };

  // --- Subscores (paralelo) ---
  const [rent, liq, inv, def, cust, growth, baseWeights] = await Promise.all([
    calculateRentabilityScore(companyId, period),
    calculateLiquidityScore(companyId),
    calculateInventoryScore(companyId),
    calculateDefaultScore(companyId),
    calculateCustomerScore(companyId),
    calculateGrowthScore(companyId, ref),
    resolveWeights(companyId),
  ]);

  // --- Repesagem dinâmica ---
  // Dimensões não aplicáveis (score=null) têm seu peso redistribuído
  // proporcionalmente entre as dimensões aplicáveis.
  const dims: { key: keyof PushScoreWeights; score: number | null; weight: number }[] = [
    { key: 'rentability', score: rent.score, weight: baseWeights.rentability },
    { key: 'liquidity', score: liq.score, weight: baseWeights.liquidity },
    { key: 'inventory', score: inv.score, weight: baseWeights.inventory },
    { key: 'default', score: def.score, weight: baseWeights.default },
    { key: 'customer', score: cust.score, weight: baseWeights.customer },
    { key: 'growth', score: growth.score, weight: baseWeights.growth },
  ];

  const applicable = dims.filter(d => d.score !== null);
  const totalApplicableWeight = applicable.reduce((s, d) => s + d.weight, 0);

  const appliedWeights: PushScoreWeights = {
    rentability: 0, liquidity: 0, inventory: 0, default: 0, customer: 0, growth: 0,
  };
  let finalScore = 0;
  if (totalApplicableWeight > 0) {
    for (const d of applicable) {
      const normalizedWeight = (d.weight / totalApplicableWeight) * 100;
      appliedWeights[d.key] = round1(normalizedWeight);
      finalScore += (d.score as number) * (normalizedWeight / 100);
    }
  }
  finalScore = Math.round(clamp(finalScore));

  return {
    status: 'ATIVO',
    score: finalScore,
    classification: classifyScore(finalScore),
    subscores: {
      rentabilityScore: rent.score,
      liquidityScore: liq.score,
      inventoryScore: inv.score,
      defaultScore: def.score,
      customerBaseScore: cust.score,
      growthScore: growth.score,
    },
    rawMetrics: {
      daysOperation,
      totalSales,
      rentability: rent.raw,
      liquidity: liq.raw,
      inventory: inv.raw,
      default: def.raw,
      customer: cust.raw,
      growth: growth.raw,
    },
    appliedWeights,
    date,
  };
}

// ============================================================
// HISTÓRICO OFICIAL DO PUSH SCORE™ (PRIORIDADE 3.4)
// ------------------------------------------------------------
// A tabela `PushScoreSnapshot` (push_score_snapshots) É a fonte
// oficial e ÚNICA do histórico do Push Score. Cada registro é um
// snapshot diário por empresa, contendo:
//   - score final + classificação + status (ATIVO | EM_FORMACAO)
//   - os 6 subscores por dimensão
//   - rawMetrics  (insumos brutos → auditoria/reconstrução)
//   - appliedWeights (pesos efetivos após repesagem dinâmica)
//
// Garantias:
//   • Multiempresa: chaveado por companyId; snapshots NUNCA se
//     misturam entre empresas (unique composto + índices).
//   • Idempotência: @@unique([companyId, date]) + upsert ⇒ o mesmo
//     dia NUNCA gera duplicidade; recalcular sobrescreve o registro.
//   • Auditabilidade: rawMetrics + appliedWeights permitem
//     reconstruir o score de QUALQUER dia sem reexecutar a engine.
//
// NÃO há scheduler/dashboard/IA/alertas aqui; apenas persistência.
// ============================================================

/**
 * FUNÇÃO CANÔNICA DE PERSISTÊNCIA DO HISTÓRICO (PRIORIDADE 3.4).
 *
 * Calcula o Push Score da empresa para o dia de referência e PERSISTE
 * o snapshot na tabela oficial `PushScoreSnapshot` via upsert
 * (chave única companyId+date → idempotente).
 *
 * @param companyId  empresa alvo (isolamento multiempresa)
 * @param date       data de referência (default: agora). É normalizada
 *                   internamente para 00:00 BRT pelo cálculo da engine.
 * @returns          o resultado completo do cálculo (mesma forma persistida)
 */
export async function recordPushScoreSnapshot(
  companyId: string,
  date: Date = new Date()
): Promise<PushScoreResult> {
  const result = await computePushScore(companyId, date);

  const payload = {
    status: result.status,
    score: result.score,
    classification: result.classification,
    rentabilityScore: result.subscores.rentabilityScore,
    liquidityScore: result.subscores.liquidityScore,
    inventoryScore: result.subscores.inventoryScore,
    defaultScore: result.subscores.defaultScore,
    customerBaseScore: result.subscores.customerBaseScore,
    growthScore: result.subscores.growthScore,
    rawMetrics: result.rawMetrics,
    appliedWeights: (result.appliedWeights as any) ?? undefined,
  };

  await prisma.pushScoreSnapshot.upsert({
    where: { companyId_date: { companyId, date: result.date } },
    create: {
      companyId,
      date: result.date,
      ...payload,
    },
    update: payload,
  });

  return result;
}

/**
 * @deprecated Use `recordPushScoreSnapshot`. Mantido apenas como alias
 * de compatibilidade para chamadas existentes. A persistência do
 * histórico é feita EXCLUSIVAMENTE por `recordPushScoreSnapshot` para
 * evitar duplicidade conceitual (Single Source of Truth — FASE 0.1).
 */
export async function generatePushScoreSnapshot(
  companyId: string,
  ref: Date = new Date()
): Promise<PushScoreResult> {
  return recordPushScoreSnapshot(companyId, ref);
}
