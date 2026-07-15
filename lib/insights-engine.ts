/**
 * INSIGHTS ENGINE — Motor Oficial de Insights do PushSisten
 *
 * Gera insights acionáveis DETERMINÍSTICOS a partir de métricas já homologadas.
 * Sem IA, sem heurísticas inventadas — apenas regras claras com thresholds configuráveis.
 *
 * Fontes oficiais (somente leitura):
 * - financial-engine.ts (calculateSalesMetrics, getCashBalance, calculateStockMetrics, calculateOperatingExpenses, getReceivables, pctChange)
 * - Prisma models: Product, Customer, Installment, Sale, AccountReceivable
 * - crediario-sync.ts (syncOverdueInstallments — chamado antes da análise de crediário)
 *
 * Regras:
 * - Determinísticos: mesmos dados → mesmos insights
 * - Idempotentes: @@unique([companyId, date, code]) → upsert por dia
 * - Multiempresa: companyId em todos os queries
 * - Thresholds configuráveis via INSIGHT_THRESHOLDS (defaults sensatos para moda)
 * - EM_FORMACAO: empresa nova (< MIN_OPERATION_DAYS ou < MIN_SALES) → nenhum insight
 */

import { prisma } from '@/lib/db';
import {
  calculateSalesMetrics,
  getCashBalance,
  calculateStockMetrics,
  calculateOperatingExpenses,
  getReceivables,
  pctChange,
  type SalesMetrics,
  type CashBalance,
  type StockMetrics,
  type OperatingExpenses,
  type ReceivablesBreakdown,
} from '@/lib/financial-engine';
import { MIN_OPERATION_DAYS, MIN_SALES } from '@/lib/push-score-engine';

// ========================
// TYPES
// ========================
export type InsightType = 'ESTOQUE' | 'CLIENTE' | 'FINANCEIRO' | 'CREDIARIO';
export type InsightSeverity = 'ALTO' | 'MEDIO' | 'BAIXO';

export interface InsightRecord {
  id: string;
  type: InsightType;
  code: string;
  message: string;
  severity: InsightSeverity;
  relatedMetrics: Record<string, any> | null;
  timestamp: Date;
}

export interface InsightGenerationResult {
  companyId: string;
  date: Date;
  status: 'ATIVO' | 'EM_FORMACAO';
  insights: InsightRecord[];
  generatedAt: Date;
  stats: {
    total: number;
    alto: number;
    medio: number;
    baixo: number;
    byType: Record<string, number>;
  };
}

// ========================
// THRESHOLDS (configuráveis, defaults para moda)
// ========================
export const INSIGHT_THRESHOLDS = {
  // Estoque
  ESTOQUE_PARADO_DIAS: 60,           // Produtos sem venda há X dias
  ESTOQUE_BAIXO_FATOR: 1.0,          // stockQuantity <= minStock * fator
  ESTOQUE_EXCESSIVO_FATOR: 3.0,      // stockQuantity >= minStock * fator (se minStock > 0)
  ESTOQUE_TOP_VENDAS: 5,             // Top N produtos campeões

  // Clientes
  CLIENTE_SUMIDO_DIAS: 30,           // Sem compra há X dias
  CLIENTE_VIP_MIN_COMPRAS: 5,        // Mínimo de compras para VIP
  CLIENTE_VIP_TICKET_PERCENTIL: 1.5, // Ticket médio >= média * fator
  CLIENTE_CRESCIMENTO_RECENTE_DIAS: 30, // Janela para aumento de compra
  CLIENTE_CHAMAR_DIAS_MIN: 15,       // Clientes entre X e Y dias sem compra
  CLIENTE_CHAMAR_DIAS_MAX: 30,

  // Financeiro
  MARGEM_QUEDA_THRESHOLD: -5,        // Queda de margem >= X pontos percentuais
  CAIXA_RISCO_MESES: 1,             // Cobertura de caixa < X meses = risco
  RECEITA_DESACELERACAO_PCT: -10,    // Queda de receita MoM >= X%

  // Crediário
  INADIMPLENCIA_CRESCIMENTO_PCT: 5,  // Aumento de inadimplência >= X pontos %
  PARCELAS_VENCIDAS_PROXIMO_DIAS: 7, // Parcelas vencendo nos próximos X dias
  CREDIARIO_RISCO_PCT: 15,           // % inadimplente >= X = risco
} as const;

// ========================
// HELPERS
// ========================

/** Normaliza data para 00:00 BRT (UTC-3) */
function startOfDayBRT(d: Date = new Date()): Date {
  const brt = new Date(d.getTime() - 3 * 3600000);
  brt.setUTCHours(0, 0, 0, 0);
  return new Date(brt.getTime() + 3 * 3600000);
}

function fmt(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtPct(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
}

// ========================
// GERADORES DE INSIGHTS
// ========================

interface RawInsight {
  code: string;
  type: InsightType;
  severity: InsightSeverity;
  message: string;
  relatedMetrics: Record<string, any>;
}

// ------- ESTOQUE -------

async function generateEstoqueInsights(companyId: string): Promise<RawInsight[]> {
  const insights: RawInsight[] = [];
  const now = new Date();
  const T = INSIGHT_THRESHOLDS;

  // Produtos ativos da empresa
  const products = await prisma.product.findMany({
    where: { companyId, isActive: true },
    select: {
      id: true,
      name: true,
      stockQuantity: true,
      minStock: true,
      avgCost: true,
      costPrice: true,
      salePrice: true,
    },
  });

  if (products.length === 0) return insights;

  // Últimas vendas por produto (para detectar parados)
  const cutoffParado = new Date(now.getTime() - T.ESTOQUE_PARADO_DIAS * 86400000);
  const recentSaleItems = await prisma.saleItem.findMany({
    where: {
      sale: { companyId, status: 'concluida', createdAt: { gte: cutoffParado } },
    },
    select: { productId: true },
    distinct: ['productId'],
  });
  const recentProductIds = new Set(recentSaleItems.map(s => s.productId));

  // a) Produtos parados > X dias
  const produtosParados = products.filter(
    p => p.stockQuantity > 0 && !recentProductIds.has(p.id)
  );
  if (produtosParados.length > 0) {
    const capitalParado = produtosParados.reduce(
      (sum, p) => sum + (p.avgCost || p.costPrice || 0) * p.stockQuantity, 0
    );
    insights.push({
      code: 'ESTOQUE_PARADO',
      type: 'ESTOQUE',
      severity: produtosParados.length >= 10 ? 'ALTO' : produtosParados.length >= 5 ? 'MEDIO' : 'BAIXO',
      message: `${produtosParados.length} produto(s) sem venda há mais de ${T.ESTOQUE_PARADO_DIAS} dias. Capital parado: ${fmt(capitalParado)}.`,
      relatedMetrics: {
        count: produtosParados.length,
        capitalParado,
        threshold: T.ESTOQUE_PARADO_DIAS,
        topProducts: produtosParados.slice(0, 5).map(p => ({ id: p.id, name: p.name, qty: p.stockQuantity })),
      },
    });
  }

  // b) Produtos campeões (top vendas últimos 30d)
  const cutoff30d = new Date(now.getTime() - 30 * 86400000);
  const topSales = await prisma.saleItem.groupBy({
    by: ['productId'],
    where: {
      sale: { companyId, status: 'concluida', createdAt: { gte: cutoff30d } },
    },
    _sum: { quantity: true, total: true },
    orderBy: { _sum: { total: 'desc' } },
    take: T.ESTOQUE_TOP_VENDAS,
  });

  if (topSales.length > 0) {
    const topIds = topSales.map(t => t.productId);
    const topProducts = await prisma.product.findMany({
      where: { id: { in: topIds } },
      select: { id: true, name: true, stockQuantity: true },
    });
    const productMap = new Map(topProducts.map(p => [p.id, p]));

    const campeoes = topSales.map(t => {
      const prod = productMap.get(t.productId);
      return {
        id: t.productId,
        name: prod?.name || 'Desconhecido',
        qtdVendida: t._sum.quantity || 0,
        receita: t._sum.total || 0,
        estoque: prod?.stockQuantity || 0,
      };
    });

    insights.push({
      code: 'ESTOQUE_CAMPEOES',
      type: 'ESTOQUE',
      severity: 'BAIXO',
      message: `Top ${campeoes.length} produto(s) campeão(ões) de vendas nos últimos 30 dias: ${campeoes.map(c => c.name).join(', ')}.`,
      relatedMetrics: { campeoes },
    });
  }

  // c) Estoque baixo (stockQuantity <= minStock, onde minStock > 0)
  const estoqueBaixo = products.filter(
    p => p.minStock > 0 && p.stockQuantity <= p.minStock * T.ESTOQUE_BAIXO_FATOR && p.stockQuantity > 0
  );
  if (estoqueBaixo.length > 0) {
    insights.push({
      code: 'ESTOQUE_BAIXO',
      type: 'ESTOQUE',
      severity: estoqueBaixo.length >= 5 ? 'ALTO' : 'MEDIO',
      message: `${estoqueBaixo.length} produto(s) com estoque abaixo do mínimo. Risco de ruptura.`,
      relatedMetrics: {
        count: estoqueBaixo.length,
        products: estoqueBaixo.slice(0, 10).map(p => ({
          id: p.id, name: p.name, stock: p.stockQuantity, minStock: p.minStock,
        })),
      },
    });
  }

  // Estoque zerado
  const estoqueZerado = products.filter(p => p.stockQuantity === 0);
  if (estoqueZerado.length > 0) {
    insights.push({
      code: 'ESTOQUE_ZERADO',
      type: 'ESTOQUE',
      severity: estoqueZerado.length >= 5 ? 'ALTO' : 'MEDIO',
      message: `${estoqueZerado.length} produto(s) com estoque zerado. Reponha para não perder vendas.`,
      relatedMetrics: {
        count: estoqueZerado.length,
        products: estoqueZerado.slice(0, 10).map(p => ({ id: p.id, name: p.name })),
      },
    });
  }

  // d) Estoque excessivo (stockQuantity >= minStock * fator, se minStock > 0)
  const estoqueExcessivo = products.filter(
    p => p.minStock > 0 && p.stockQuantity >= p.minStock * T.ESTOQUE_EXCESSIVO_FATOR
  );
  if (estoqueExcessivo.length > 0) {
    const capitalExcesso = estoqueExcessivo.reduce(
      (sum, p) => sum + (p.avgCost || p.costPrice || 0) * (p.stockQuantity - p.minStock), 0
    );
    insights.push({
      code: 'ESTOQUE_EXCESSIVO',
      type: 'ESTOQUE',
      severity: estoqueExcessivo.length >= 10 ? 'MEDIO' : 'BAIXO',
      message: `${estoqueExcessivo.length} produto(s) com estoque acima de ${T.ESTOQUE_EXCESSIVO_FATOR}x o mínimo. Capital excedente estimado: ${fmt(capitalExcesso)}.`,
      relatedMetrics: {
        count: estoqueExcessivo.length,
        capitalExcesso,
        products: estoqueExcessivo.slice(0, 10).map(p => ({
          id: p.id, name: p.name, stock: p.stockQuantity, minStock: p.minStock,
        })),
      },
    });
  }

  return insights;
}

// ------- CLIENTES -------

async function generateClienteInsights(companyId: string): Promise<RawInsight[]> {
  const insights: RawInsight[] = [];
  const now = new Date();
  const T = INSIGHT_THRESHOLDS;

  const customers = await prisma.customer.findMany({
    where: { companyId, isActive: true },
    select: {
      id: true,
      name: true,
      lastPurchase: true,
      purchaseCount: true,
      avgTicket: true,
      totalPurchased: true,
    },
  });

  if (customers.length === 0) return insights;

  const avgTicketGeral = customers.reduce((s, c) => s + (c.avgTicket || 0), 0) / customers.length;

  // a) Clientes sumidos (>30 dias sem compra)
  const cutoffSumido = new Date(now.getTime() - T.CLIENTE_SUMIDO_DIAS * 86400000);
  const sumidos = customers.filter(
    c => c.lastPurchase && c.lastPurchase < cutoffSumido && c.purchaseCount >= 2
  );
  if (sumidos.length > 0) {
    insights.push({
      code: 'CLIENTE_SUMIDO',
      type: 'CLIENTE',
      severity: sumidos.length >= 10 ? 'ALTO' : sumidos.length >= 5 ? 'MEDIO' : 'BAIXO',
      message: `${sumidos.length} cliente(s) recorrente(s) sem compra há mais de ${T.CLIENTE_SUMIDO_DIAS} dias. Oportunidade de reativação.`,
      relatedMetrics: {
        count: sumidos.length,
        threshold: T.CLIENTE_SUMIDO_DIAS,
        topClients: sumidos
          .sort((a, b) => (b.totalPurchased || 0) - (a.totalPurchased || 0))
          .slice(0, 10)
          .map(c => ({ id: c.id, name: c.name, lastPurchase: c.lastPurchase, totalPurchased: c.totalPurchased })),
      },
    });
  }

  // b) Clientes para chamar hoje (entre 15 e 30 dias sem compra)
  const cutoffMin = new Date(now.getTime() - T.CLIENTE_CHAMAR_DIAS_MAX * 86400000);
  const cutoffMax = new Date(now.getTime() - T.CLIENTE_CHAMAR_DIAS_MIN * 86400000);
  const paraChamar = customers.filter(
    c => c.lastPurchase && c.lastPurchase >= cutoffMin && c.lastPurchase <= cutoffMax && c.purchaseCount >= 1
  );
  if (paraChamar.length > 0) {
    insights.push({
      code: 'CLIENTE_CHAMAR_HOJE',
      type: 'CLIENTE',
      severity: 'BAIXO',
      message: `${paraChamar.length} cliente(s) entre ${T.CLIENTE_CHAMAR_DIAS_MIN} e ${T.CLIENTE_CHAMAR_DIAS_MAX} dias sem comprar. Bom momento para contato.`,
      relatedMetrics: {
        count: paraChamar.length,
        clients: paraChamar.slice(0, 10).map(c => ({ id: c.id, name: c.name, lastPurchase: c.lastPurchase })),
      },
    });
  }

  // c) Clientes VIP (recorrência alta + ticket médio alto)
  const vips = customers.filter(
    c => c.purchaseCount >= T.CLIENTE_VIP_MIN_COMPRAS &&
         (c.avgTicket || 0) >= avgTicketGeral * T.CLIENTE_VIP_TICKET_PERCENTIL
  );
  if (vips.length > 0) {
    insights.push({
      code: 'CLIENTE_VIP',
      type: 'CLIENTE',
      severity: 'BAIXO',
      message: `${vips.length} cliente(s) VIP identificado(s) — alta recorrência e ticket acima da média. Valorize e fidelize.`,
      relatedMetrics: {
        count: vips.length,
        avgTicketGeral,
        clients: vips
          .sort((a, b) => (b.totalPurchased || 0) - (a.totalPurchased || 0))
          .slice(0, 10)
          .map(c => ({ id: c.id, name: c.name, purchaseCount: c.purchaseCount, avgTicket: c.avgTicket, totalPurchased: c.totalPurchased })),
      },
    });
  }

  // d) Clientes que aumentaram compra recentemente
  const cutoffRecente = new Date(now.getTime() - T.CLIENTE_CRESCIMENTO_RECENTE_DIAS * 86400000);
  const cutoffAnterior = new Date(cutoffRecente.getTime() - T.CLIENTE_CRESCIMENTO_RECENTE_DIAS * 86400000);

  // Vendas do período recente e anterior por cliente
  const [vendasRecentes, vendasAnterior] = await Promise.all([
    prisma.sale.groupBy({
      by: ['customerId'],
      where: { companyId, status: 'concluida', createdAt: { gte: cutoffRecente }, customerId: { not: null } },
      _sum: { total: true },
      _count: true,
    }),
    prisma.sale.groupBy({
      by: ['customerId'],
      where: { companyId, status: 'concluida', createdAt: { gte: cutoffAnterior, lt: cutoffRecente }, customerId: { not: null } },
      _sum: { total: true },
      _count: true,
    }),
  ]);

  const anteriorMap = new Map(vendasAnterior.map(v => [v.customerId, v._sum.total || 0]));
  const cresceram = vendasRecentes.filter(v => {
    const anterior = anteriorMap.get(v.customerId) || 0;
    const recente = v._sum.total || 0;
    return anterior > 0 && recente > anterior * 1.3; // 30% de aumento
  });

  if (cresceram.length > 0) {
    const customerIds = cresceram.map(c => c.customerId).filter(Boolean) as string[];
    const clientNames = await prisma.customer.findMany({
      where: { id: { in: customerIds } },
      select: { id: true, name: true },
    });
    const nameMap = new Map(clientNames.map(c => [c.id, c.name]));

    insights.push({
      code: 'CLIENTE_CRESCIMENTO',
      type: 'CLIENTE',
      severity: 'BAIXO',
      message: `${cresceram.length} cliente(s) aumentou(aram) o gasto em mais de 30% nos últimos ${T.CLIENTE_CRESCIMENTO_RECENTE_DIAS} dias. Tendência positiva!`,
      relatedMetrics: {
        count: cresceram.length,
        clients: cresceram.slice(0, 10).map(c => ({
          id: c.customerId,
          name: nameMap.get(c.customerId!) || 'Desconhecido',
          gastoRecente: c._sum.total || 0,
          gastoAnterior: anteriorMap.get(c.customerId) || 0,
        })),
      },
    });
  }

  return insights;
}

// ------- FINANCEIRO -------

async function generateFinanceiroInsights(
  companyId: string,
  salesMetrics: SalesMetrics,
  cashBalance: CashBalance,
  opExpenses: OperatingExpenses,
): Promise<RawInsight[]> {
  const insights: RawInsight[] = [];
  const T = INSIGHT_THRESHOLDS;

  // Comparar com período anterior (30d atrás)
  const now = new Date();
  const prev30Start = new Date(now.getTime() - 60 * 86400000);
  const prev30End = new Date(now.getTime() - 30 * 86400000);
  const prevMetrics = await calculateSalesMetrics(companyId, { gte: prev30Start, lte: prev30End });

  // a) Queda de margem
  const margemDelta = salesMetrics.margemBruta - prevMetrics.margemBruta;
  if (margemDelta <= T.MARGEM_QUEDA_THRESHOLD && prevMetrics.totalVendas >= 5) {
    insights.push({
      code: 'FINANCEIRO_MARGEM_QUEDA',
      type: 'FINANCEIRO',
      severity: margemDelta <= -10 ? 'ALTO' : 'MEDIO',
      message: `Margem bruta caiu ${Math.abs(margemDelta).toFixed(1)} pontos percentuais (de ${prevMetrics.margemBruta.toFixed(1)}% para ${salesMetrics.margemBruta.toFixed(1)}%). Analise custos e preços.`,
      relatedMetrics: {
        margemAtual: salesMetrics.margemBruta,
        margemAnterior: prevMetrics.margemBruta,
        delta: margemDelta,
      },
    });
  }

  // b) Risco de caixa
  const despesasMensais = opExpenses.totalDespesasOperacionais + opExpenses.totalDespesasFinanceiras;
  const coberturaMeses = despesasMensais > 0 ? cashBalance.saldo / despesasMensais : Infinity;
  if (coberturaMeses < T.CAIXA_RISCO_MESES && coberturaMeses !== Infinity) {
    insights.push({
      code: 'FINANCEIRO_RISCO_CAIXA',
      type: 'FINANCEIRO',
      severity: coberturaMeses < 0.5 ? 'ALTO' : 'MEDIO',
      message: `Saldo de caixa (${fmt(cashBalance.saldo)}) cobre apenas ${coberturaMeses.toFixed(1)} mês(es) de despesas operacionais (${fmt(despesasMensais)}/mês). Risco de liquidez.`,
      relatedMetrics: {
        saldoCaixa: cashBalance.saldo,
        despesasMensais,
        coberturaMeses,
      },
    });
  }

  // c) Receita desacelerando (MoM)
  const receitaAtual = salesMetrics.faturamentoLiquido;
  const receitaAnterior = prevMetrics.faturamentoLiquido;
  const receitaVariacao = pctChange(receitaAtual, receitaAnterior);
  if (receitaVariacao <= T.RECEITA_DESACELERACAO_PCT && receitaAnterior > 0) {
    insights.push({
      code: 'FINANCEIRO_RECEITA_DESACEL',
      type: 'FINANCEIRO',
      severity: receitaVariacao <= -20 ? 'ALTO' : 'MEDIO',
      message: `Receita caiu ${fmtPct(receitaVariacao)} comparando os últimos 30 dias com o período anterior (${fmt(receitaAnterior)} → ${fmt(receitaAtual)}). Investigue causas.`,
      relatedMetrics: {
        receitaAtual,
        receitaAnterior,
        variacao: receitaVariacao,
      },
    });
  }

  return insights;
}

// ------- CREDIÁRIO -------

async function generateCrediarioInsights(companyId: string): Promise<RawInsight[]> {
  const insights: RawInsight[] = [];
  const now = new Date();
  const T = INSIGHT_THRESHOLDS;

  // Verificar se empresa usa crediário
  const totalCredits = await prisma.customerCredit.count({ where: { companyId } });
  if (totalCredits === 0) return insights; // Sem crediário, sem insights

  // Parcelas ativas (PENDING/PARTIAL/OVERDUE)
  const parcelas = await prisma.installment.findMany({
    where: {
      companyId,
      status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] },
    },
    select: {
      id: true,
      status: true,
      amount: true,
      paidAmount: true,
      dueDate: true,
      customerId: true,
    },
  });

  if (parcelas.length === 0) return insights;

  const totalCarteira = parcelas.reduce((s, p) => s + (p.amount - (p.paidAmount || 0)), 0);
  const vencidas = parcelas.filter(p => p.status === 'OVERDUE');
  const totalVencido = vencidas.reduce((s, p) => s + (p.amount - (p.paidAmount || 0)), 0);

  // a) Inadimplência crescente
  const taxaInadimplencia = totalCarteira > 0 ? (totalVencido / totalCarteira) * 100 : 0;
  if (taxaInadimplencia >= T.CREDIARIO_RISCO_PCT) {
    insights.push({
      code: 'CREDIARIO_INADIMPLENCIA_ALTA',
      type: 'CREDIARIO',
      severity: taxaInadimplencia >= 30 ? 'ALTO' : 'MEDIO',
      message: `Inadimplência no crediário está em ${taxaInadimplencia.toFixed(1)}% (${fmt(totalVencido)} vencido de ${fmt(totalCarteira)} total). Ação de cobrança recomendada.`,
      relatedMetrics: {
        taxaInadimplencia,
        totalVencido,
        totalCarteira,
        parcelasVencidas: vencidas.length,
      },
    });
  }

  // b) Parcelas vencendo nos próximos X dias
  const cutoffProximo = new Date(now.getTime() + T.PARCELAS_VENCIDAS_PROXIMO_DIAS * 86400000);
  const parcelasProximas = parcelas.filter(
    p => p.status !== 'OVERDUE' && p.dueDate >= now && p.dueDate <= cutoffProximo
  );
  if (parcelasProximas.length > 0) {
    const totalProximo = parcelasProximas.reduce((s, p) => s + (p.amount - (p.paidAmount || 0)), 0);
    insights.push({
      code: 'CREDIARIO_VENCENDO_PROXIMO',
      type: 'CREDIARIO',
      severity: parcelasProximas.length >= 10 ? 'MEDIO' : 'BAIXO',
      message: `${parcelasProximas.length} parcela(s) vence(m) nos próximos ${T.PARCELAS_VENCIDAS_PROXIMO_DIAS} dias (${fmt(totalProximo)}). Prepare a cobrança.`,
      relatedMetrics: {
        count: parcelasProximas.length,
        total: totalProximo,
        threshold: T.PARCELAS_VENCIDAS_PROXIMO_DIAS,
      },
    });
  }

  // c) Clientes em risco (com parcelas OVERDUE)
  const clientesOverdueIds = [...new Set(vencidas.map(p => p.customerId))];
  if (clientesOverdueIds.length > 0) {
    const clientesRisco = await prisma.customer.findMany({
      where: { id: { in: clientesOverdueIds } },
      select: { id: true, name: true },
    });

    // Calcular débito vencido por cliente
    const debitosPorCliente = new Map<string, number>();
    vencidas.forEach(p => {
      const current = debitosPorCliente.get(p.customerId) || 0;
      debitosPorCliente.set(p.customerId, current + (p.amount - (p.paidAmount || 0)));
    });

    insights.push({
      code: 'CREDIARIO_CLIENTES_RISCO',
      type: 'CREDIARIO',
      severity: clientesRisco.length >= 5 ? 'ALTO' : 'MEDIO',
      message: `${clientesRisco.length} cliente(s) com parcelas vencidas no crediário. Total vencido: ${fmt(totalVencido)}.`,
      relatedMetrics: {
        count: clientesRisco.length,
        totalVencido,
        clients: clientesRisco.map(c => ({
          id: c.id,
          name: c.name,
          debitoVencido: debitosPorCliente.get(c.id) || 0,
        })).sort((a, b) => b.debitoVencido - a.debitoVencido),
      },
    });
  }

  return insights;
}

// ========================
// MOTOR PRINCIPAL
// ========================

/**
 * Verifica se a empresa está em formação (< MIN_OPERATION_DAYS ou < MIN_SALES).
 * Usa mesma lógica do Push Score.
 */
async function isEmFormacao(companyId: string): Promise<{ emFormacao: boolean; daysOperation: number; totalSales: number }> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { createdAt: true },
  });
  if (!company) return { emFormacao: true, daysOperation: 0, totalSales: 0 };

  const daysOperation = Math.floor((Date.now() - company.createdAt.getTime()) / 86400000);
  const totalSales = await prisma.sale.count({
    where: { companyId, status: 'concluida' },
  });

  return {
    emFormacao: daysOperation < MIN_OPERATION_DAYS || totalSales < MIN_SALES,
    daysOperation,
    totalSales,
  };
}

/**
 * Gera todos os insights para uma empresa e persiste no banco.
 * Idempotente por dia (upsert via @@unique([companyId, date, code])).
 *
 * @param companyId ID da empresa
 * @param refDate Data de referência (default: hoje BRT)
 * @returns InsightGenerationResult com todos os insights gerados
 */
export async function generateInsights(
  companyId: string,
  refDate?: Date,
): Promise<InsightGenerationResult> {
  const date = startOfDayBRT(refDate || new Date());
  const generatedAt = new Date();

  // Verificar EM_FORMACAO
  const formacao = await isEmFormacao(companyId);
  if (formacao.emFormacao) {
    return {
      companyId,
      date,
      status: 'EM_FORMACAO',
      insights: [],
      generatedAt,
      stats: { total: 0, alto: 0, medio: 0, baixo: 0, byType: {} },
    };
  }

  // Buscar métricas centralizadas (últimos 30 dias)
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
  const dateFilter = { gte: thirtyDaysAgo, lte: now };

  const [salesMetrics, cashBalance, stockMetrics, opExpenses] = await Promise.all([
    calculateSalesMetrics(companyId, dateFilter),
    getCashBalance(companyId),
    calculateStockMetrics(companyId),
    calculateOperatingExpenses(companyId, dateFilter),
  ]);

  // Gerar insights de todas as dimensões
  const [estoqueInsights, clienteInsights, financeiroInsights, crediarioInsights] = await Promise.all([
    generateEstoqueInsights(companyId),
    generateClienteInsights(companyId),
    generateFinanceiroInsights(companyId, salesMetrics, cashBalance, opExpenses),
    generateCrediarioInsights(companyId),
  ]);

  const allRaw = [...estoqueInsights, ...clienteInsights, ...financeiroInsights, ...crediarioInsights];

  // Persistir via upsert (idempotente por dia)
  const persisted: InsightRecord[] = [];

  for (const raw of allRaw) {
    const result = await prisma.insight.upsert({
      where: {
        unique_insight_per_company_day_code: {
          companyId,
          date,
          code: raw.code,
        },
      },
      create: {
        companyId,
        date,
        type: raw.type,
        code: raw.code,
        severity: raw.severity,
        message: raw.message,
        relatedMetrics: raw.relatedMetrics as any,
      },
      update: {
        severity: raw.severity,
        message: raw.message,
        relatedMetrics: raw.relatedMetrics as any,
      },
    });

    persisted.push({
      id: result.id,
      type: result.type as InsightType,
      code: result.code,
      message: result.message,
      severity: result.severity as InsightSeverity,
      relatedMetrics: result.relatedMetrics as Record<string, any> | null,
      timestamp: result.createdAt,
    });
  }

  // Limpar insights antigos que não foram re-gerados hoje
  // (insight que existia ontem mas já não é mais verdadeiro hoje)
  const currentCodes = allRaw.map(r => r.code);
  if (currentCodes.length > 0) {
    await prisma.insight.deleteMany({
      where: {
        companyId,
        date,
        code: { notIn: currentCodes },
      },
    });
  } else {
    // Nenhum insight gerado: limpar todos do dia
    await prisma.insight.deleteMany({
      where: { companyId, date },
    });
  }

  // Calcular stats
  const stats = {
    total: persisted.length,
    alto: persisted.filter(i => i.severity === 'ALTO').length,
    medio: persisted.filter(i => i.severity === 'MEDIO').length,
    baixo: persisted.filter(i => i.severity === 'BAIXO').length,
    byType: {} as Record<string, number>,
  };
  for (const i of persisted) {
    stats.byType[i.type] = (stats.byType[i.type] || 0) + 1;
  }

  return {
    companyId,
    date,
    status: 'ATIVO',
    insights: persisted,
    generatedAt,
    stats,
  };
}

/**
 * Recupera insights persistidos para uma empresa em um intervalo de datas.
 * Leitura pura — não gera novos insights.
 */
export async function getInsightHistory(
  companyId: string,
  options?: { startDate?: Date; endDate?: Date; type?: InsightType; severity?: InsightSeverity; limit?: number }
): Promise<InsightRecord[]> {
  const where: any = { companyId };

  if (options?.startDate || options?.endDate) {
    where.date = {};
    if (options?.startDate) where.date.gte = options.startDate;
    if (options?.endDate) where.date.lte = options.endDate;
  }
  if (options?.type) where.type = options.type;
  if (options?.severity) where.severity = options.severity;

  const records = await prisma.insight.findMany({
    where,
    orderBy: [{ date: 'desc' }, { severity: 'asc' }],
    take: options?.limit || 100,
  });

  return records.map(r => ({
    id: r.id,
    type: r.type as InsightType,
    code: r.code,
    message: r.message,
    severity: r.severity as InsightSeverity,
    relatedMetrics: r.relatedMetrics as Record<string, any> | null,
    timestamp: r.createdAt,
  }));
}
