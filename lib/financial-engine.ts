/**
 * FINANCIAL ENGINE — Fonte Única de Verdade para Cálculos Financeiros
 * 
 * Todas as APIs do sistema devem usar estas funções para garantir
 * consistência nos números exibidos ao usuário.
 * 
 * Regras:
 * - Saldo de caixa: SEMPRE = soma de CashAccount.currentBalance (fonte da verdade)
 * - CMV: SEMPRE = avgCost (ou fallback costPrice) × quantity dos itens vendidos
 * - Faturamento: SEMPRE = sale.total (valor final pago pelo cliente)
 * - Faturamento Bruto: SEMPRE = sale.subtotal (antes de descontos)
 * - Descontos: SEMPRE = sale.discount
 * - Devoluções: SEMPRE = soma dos totals de vendas canceladas
 * - Lucro Bruto: Receita Líquida - CMV
 * - Margem: (Lucro / Receita) × 100
 * - Capital Parado: custo dos produtos SEM VENDA nos últimos 60 dias
 * - Capital Investido: custo total de TODOS os produtos em estoque
 */

import { prisma } from '@/lib/db';

// ========================
// TYPES
// ========================
export interface SalesMetrics {
  faturamentoBruto: number;    // sum of sale.subtotal
  descontos: number;           // sum of sale.discount
  faturamentoLiquido: number;  // sum of sale.total (= bruto - descontos)
  devolucoes: number;          // sum of cancelled sale totals
  receitaLiquida: number;      // faturamentoLiquido - devolucoes
  cmv: number;                 // cost of goods sold (avgCost × qty)
  taxasCartao: number;         // sum of feeAmount from payments
  lucroBruto: number;          // receitaLiquida - cmv
  lucroLiquido: number;        // lucroBruto - taxasCartao
  margemBruta: number;         // (lucroBruto / receitaLiquida) × 100
  margemLiquida: number;       // (lucroLiquido / receitaLiquida) × 100
  totalVendas: number;         // count of completed sales
  ticketMedio: number;         // faturamentoLiquido / totalVendas
}

export interface CashBalance {
  saldo: number;               // soma dos CashAccount.currentBalance
  accounts: { name: string; type: string; balance: number }[];
}

export interface StockMetrics {
  totalProdutos: number;
  totalPecas: number;
  capitalInvestido: number;      // custo total de TODO o estoque
  capitalParado: number;         // custo dos produtos sem giro (60 dias)
  capitalParadoProdutos: number; // quantidade de produtos parados
  estoqueBaixo: number;          // produtos com stock <= minStock
  estoqueZerado: number;         // produtos com stock = 0
}

// ========================
// SALES METRICS
// ========================

/**
 * Calcula métricas de vendas para um período.
 * FONTE ÚNICA DE VERDADE para faturamento, CMV, lucro e margem.
 */
export async function calculateSalesMetrics(
  companyId: string,
  dateFilter?: { gte?: Date; lte?: Date }
): Promise<SalesMetrics> {
  const salesWhere: any = { companyId, status: 'concluida' };
  if (dateFilter) salesWhere.createdAt = dateFilter;

  // Buscar vendas com itens e pagamentos
  const sales = await prisma.sale.findMany({
    where: salesWhere,
    include: {
      items: {
        include: {
          product: { select: { costPrice: true, avgCost: true } },
          variation: { select: { costPrice: true, avgCost: true } },
        },
      },
      payments: { select: { feeAmount: true } },
    },
  });

  let faturamentoBruto = 0; // subtotal (antes de desconto)
  let descontos = 0;
  let faturamentoLiquido = 0; // total (após desconto)
  let cmv = 0;
  let taxasCartao = 0;

  for (const sale of sales) {
    faturamentoBruto += sale.subtotal ?? 0;
    descontos += sale.discount ?? 0;
    faturamentoLiquido += sale.total ?? 0;

    // CMV: sempre usar avgCost > costPrice (variação > produto)
    for (const item of sale.items ?? []) {
      const unitCost =
        item.variation?.avgCost || item.variation?.costPrice ||
        item.product?.avgCost || item.product?.costPrice || 0;
      cmv += unitCost * (item.quantity ?? 0);
    }

    // Taxas de cartão
    for (const p of sale.payments ?? []) {
      taxasCartao += p.feeAmount ?? 0;
    }
  }

  // Devoluções = total de vendas canceladas no período
  const cancelledWhere: any = { companyId, status: 'cancelada' };
  if (dateFilter) cancelledWhere.createdAt = dateFilter;
  const cancelledAgg = await prisma.sale.aggregate({
    where: cancelledWhere,
    _sum: { total: true },
  });
  const devolucoes = cancelledAgg._sum?.total ?? 0;

  // FIX P7.4: devoluções (canceladas) já NÃO entram em faturamentoLiquido
  // (filtro status='concluida' exclui). Subtrair aqui causava DUPLA DEDUÇÃO.
  // Devoluções é mantido como campo informativo, sem impacto no cálculo.
  const receitaLiquida = faturamentoLiquido;
  const lucroBruto = receitaLiquida - cmv;
  const lucroLiquido = lucroBruto - taxasCartao;
  const margemBruta = receitaLiquida > 0 ? (lucroBruto / receitaLiquida) * 100 : 0;
  const margemLiquida = receitaLiquida > 0 ? (lucroLiquido / receitaLiquida) * 100 : 0;
  const totalVendas = sales.length;
  const ticketMedio = totalVendas > 0 ? faturamentoLiquido / totalVendas : 0;

  return {
    faturamentoBruto: round2(faturamentoBruto),
    descontos: round2(descontos),
    faturamentoLiquido: round2(faturamentoLiquido),
    devolucoes: round2(devolucoes),
    receitaLiquida: round2(receitaLiquida),
    cmv: round2(cmv),
    taxasCartao: round2(taxasCartao),
    lucroBruto: round2(lucroBruto),
    lucroLiquido: round2(lucroLiquido),
    margemBruta: round1(margemBruta),
    margemLiquida: round1(margemLiquida),
    totalVendas,
    ticketMedio: round2(ticketMedio),
  };
}

// ========================
// CASH BALANCE
// ========================

/**
 * Retorna o saldo real de caixa.
 * FONTE ÚNICA DE VERDADE: CashAccount.currentBalance
 * NUNCA use soma de FinancialRecord para calcular saldo.
 */
export async function getCashBalance(companyId: string): Promise<CashBalance> {
  const accounts = await prisma.cashAccount.findMany({
    where: { companyId, isActive: true },
    select: { name: true, type: true, currentBalance: true },
    orderBy: { currentBalance: 'desc' },
  });

  const saldo = accounts.reduce((sum, a) => sum + (a.currentBalance ?? 0), 0);

  return {
    saldo: round2(saldo),
    accounts: accounts.map(a => ({
      name: a.name,
      type: a.type,
      balance: round2(a.currentBalance ?? 0),
    })),
  };
}

// ========================
// STOCK METRICS
// ========================

/**
 * Calcula métricas de estoque.
 * - capitalInvestido = custo (avgCost || costPrice) × stockQuantity de TODOS os produtos
 * - capitalParado = custo dos produtos SEM VENDA há 60+ dias
 */
export async function calculateStockMetrics(companyId: string): Promise<StockMetrics> {
  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

  const products = await prisma.product.findMany({
    where: { companyId, isActive: true },
    select: {
      id: true,
      stockQuantity: true,
      minStock: true,
      costPrice: true,
      avgCost: true,
    },
  });

  // IDs de produtos vendidos nos últimos 60 dias
  const recentSoldIds = new Set(
    (await prisma.saleItem.findMany({
      where: {
        sale: { companyId, status: 'concluida', createdAt: { gte: sixtyDaysAgo } },
      },
      select: { productId: true },
      distinct: ['productId'],
    })).map(p => p.productId)
  );

  let totalPecas = 0;
  let capitalInvestido = 0;
  let capitalParado = 0;
  let capitalParadoProdutos = 0;
  let estoqueBaixo = 0;
  let estoqueZerado = 0;

  for (const p of products) {
    const unitCost = p.avgCost || p.costPrice || 0;
    const stockCost = unitCost * p.stockQuantity;

    totalPecas += p.stockQuantity;
    capitalInvestido += stockCost;

    if (p.stockQuantity > 0 && !recentSoldIds.has(p.id)) {
      capitalParado += stockCost;
      capitalParadoProdutos++;
    }

    if (p.stockQuantity <= 0) {
      estoqueZerado++;
    } else if (p.stockQuantity <= p.minStock) {
      estoqueBaixo++;
    }
  }

  return {
    totalProdutos: products.length,
    totalPecas,
    capitalInvestido: round2(capitalInvestido),
    capitalParado: round2(capitalParado),
    capitalParadoProdutos,
    estoqueBaixo,
    estoqueZerado,
  };
}

// ========================
// OPERATING EXPENSES (for DRE)
// ========================

export interface OperatingExpenses {
  despesasAdministrativas: number;
  despesasComerciais: number;
  despesasFinanceiras: number;
  impostos: number;
  despesasOperacionaisOutras: number;
  totalDespesasOperacionais: number; // admin + comerciais + outras
  totalDespesasFinanceiras: number;  // financeiras + taxas cartão
}

/**
 * Calcula despesas operacionais a partir de FinancialRecord + DRE groups.
 * Exclui registros de estoque (reference starts with 'stock_entry:').
 */
export async function calculateOperatingExpenses(
  companyId: string,
  dateFilter?: { gte?: Date; lte?: Date }
): Promise<OperatingExpenses> {
  const where: any = { companyId, type: 'saida' };
  if (dateFilter) where.date = dateFilter;

  const records = await prisma.financialRecord.findMany({
    where,
    select: {
      amount: true,
      reference: true,
      accountPlan: { select: { dreGroup: true, type: true } },
    },
  });

  let despesasAdministrativas = 0;
  let despesasComerciais = 0;
  let despesasFinanceiras = 0;
  let impostos = 0;
  let despesasOperacionaisOutras = 0;

  for (const rec of records) {
    const amount = rec.amount ?? 0;
    const dreGroup = rec.accountPlan?.dreGroup;
    const accType = rec.accountPlan?.type;
    const ref = rec.reference || '';

    // Pular registros de estoque (já contados no CMV)
    if (ref.startsWith('stock_entry:')) continue;

    if (dreGroup === 'Despesas Administrativas') {
      despesasAdministrativas += amount;
    } else if (dreGroup === 'Despesas Comerciais') {
      despesasComerciais += amount;
    } else if (dreGroup === 'Despesas Financeiras') {
      despesasFinanceiras += amount;
    } else if (dreGroup === 'Impostos' || accType === 'imposto') {
      impostos += amount;
    } else if (accType === 'custo') {
      // Custos fora de CMV (já calculado pelos itens vendidos)
      continue;
    } else {
      despesasOperacionaisOutras += amount;
    }
  }

  const totalDespesasOperacionais = despesasAdministrativas + despesasComerciais + despesasOperacionaisOutras;

  return {
    despesasAdministrativas: round2(despesasAdministrativas),
    despesasComerciais: round2(despesasComerciais),
    despesasFinanceiras: round2(despesasFinanceiras),
    impostos: round2(impostos),
    despesasOperacionaisOutras: round2(despesasOperacionaisOutras),
    totalDespesasOperacionais: round2(totalDespesasOperacionais),
    totalDespesasFinanceiras: round2(despesasFinanceiras),
  };
}

// ========================
// FULL DRE
// ========================

export interface DREResult {
  faturamentoBruto: number;
  descontos: number;
  devolucoes: number;
  receitaLiquida: number;
  cmv: number;
  margemBruta: number;
  margemBrutaPct: number;
  despesasAdministrativas: number;
  despesasComerciais: number;
  despesasOperacionais: number;
  despesasFinanceiras: number;
  taxasCartao: number;
  impostos: number;
  lucroOperacional: number;
  lucroLiquido: number;
  margemLiquidaPct: number;
  totalVendas: number;
}

/**
 * Gera DRE completo usando cálculos centralizados.
 */
export async function calculateDRE(
  companyId: string,
  dateFilter?: { gte?: Date; lte?: Date }
): Promise<DREResult> {
  const [salesMetrics, expenses] = await Promise.all([
    calculateSalesMetrics(companyId, dateFilter),
    calculateOperatingExpenses(companyId, dateFilter),
  ]);

  const despesasFinanceirasTotal = expenses.totalDespesasFinanceiras + salesMetrics.taxasCartao;
  const lucroOperacional = salesMetrics.lucroBruto - expenses.totalDespesasOperacionais;
  const lucroLiquido = lucroOperacional - despesasFinanceirasTotal - expenses.impostos;
  const margemLiquidaPct = salesMetrics.receitaLiquida > 0
    ? (lucroLiquido / salesMetrics.receitaLiquida) * 100 : 0;

  return {
    faturamentoBruto: salesMetrics.faturamentoBruto,
    descontos: salesMetrics.descontos,
    devolucoes: salesMetrics.devolucoes,
    receitaLiquida: salesMetrics.receitaLiquida,
    cmv: salesMetrics.cmv,
    margemBruta: salesMetrics.lucroBruto,
    margemBrutaPct: salesMetrics.margemBruta,
    despesasAdministrativas: expenses.despesasAdministrativas,
    despesasComerciais: expenses.despesasComerciais,
    despesasOperacionais: expenses.totalDespesasOperacionais,
    despesasFinanceiras: round2(despesasFinanceirasTotal),
    taxasCartao: salesMetrics.taxasCartao,
    impostos: expenses.impostos,
    lucroOperacional: round2(lucroOperacional),
    lucroLiquido: round2(lucroLiquido),
    margemLiquidaPct: round1(margemLiquidaPct),
    totalVendas: salesMetrics.totalVendas,
  };
}

// ========================
// HELPERS
// ========================

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

export function pctChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return round1(((current - previous) / previous) * 100);
}

// ========================
// CONTAS A RECEBER (UNIFICADO)
// ========================

export interface ReceivablesBreakdown {
  saldoAccountReceivablePendente: number; // AccountReceivable.status='pendente'
  saldoSalePaymentNaoRecebido: number;    // SalePayment.received=false (vendas "a prazo")
  totalGeral: number;                      // soma dos dois
  vencidasAccountReceivable: number;       // AR pendente com dueDate < now
  vencendoEm30Dias: number;                // AR pendente com dueDate entre now e now+30d
}

// ========================
// PROJEÇÃO DE FLUXO DE CAIXA (UNIFICADO)
// ========================

export interface CashFlowProjectionResult {
  saldoBruto: number;        // soma real dos caixas (getCashBalance)
  avgDailySales: number;     // média de vendas/dia (30d) — não arredondada
  totalRecebiveis: number;   // AR pendente na janela [hoje, hoje+days]
  totalPagaveis: number;     // AP pendente na janela [hoje, hoje+days]
  days: number;
  saldoProjetado: number;    // saldoBruto + recebíveis − pagáveis + (avgDailySales × days)
  recentSalesCount: number;
  receivables: any[];        // AR da janela, ordenados por vencimento
  payables: any[];           // AP da janela, ordenados por vencimento (inclui supplier)
}

/**
 * Projeção de saldo de caixa — FONTE ÚNICA DE VERDADE.
 * Fórmula oficial (preservada do módulo Fluxo de Caixa):
 *   saldoProjetado = saldoBruto + totalRecebiveis - totalPagaveis + (avgDailySales * days)
 * onde saldoBruto = soma de CashAccount.currentBalance (getCashBalance).
 */
export async function getCashFlowProjection(
  companyId: string,
  days = 30
): Promise<CashFlowProjectionResult> {
  const now = new Date();
  const futureDate = new Date();
  futureDate.setDate(now.getDate() + days);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const cashBalance = await getCashBalance(companyId);
  const saldoBruto = cashBalance.saldo;

  const recentSales = await prisma.sale.aggregate({
    where: { companyId, status: 'concluida', createdAt: { gte: thirtyDaysAgo } },
    _sum: { total: true },
    _count: true,
  });
  const avgDailySales = (recentSales._sum?.total ?? 0) / 30;

  const receivables = await prisma.accountReceivable.findMany({
    where: { companyId, status: 'pendente', dueDate: { gte: now, lte: futureDate } },
    orderBy: { dueDate: 'asc' },
  });
  const totalRecebiveis = receivables.reduce((sum, r) => sum + r.amount, 0);

  const payables = await prisma.accountPayable.findMany({
    where: { companyId, status: 'pendente', dueDate: { gte: now, lte: futureDate } },
    orderBy: { dueDate: 'asc' },
    include: { supplier: { select: { name: true } } },
  });
  const totalPagaveis = payables.reduce((sum, p) => sum + p.amount, 0);

  const saldoProjetado = saldoBruto + totalRecebiveis - totalPagaveis + (avgDailySales * days);

  return {
    saldoBruto,
    avgDailySales,
    totalRecebiveis,
    totalPagaveis,
    days,
    saldoProjetado,
    recentSalesCount: recentSales._count,
    receivables,
    payables,
  };
}

/**
 * Calcula o total único de "Contas a Receber" usado em todos os módulos.
 * FONTE DE VERDADE: AccountReceivable.pendente é o recebível oficial.
 * SalePayment.received=false só é somado quando a venda NÃO possui um
 * AccountReceivable pendente correspondente — caso contrário haveria dupla
 * contagem (toda venda a prazo/crediário gera SalePayment received=false E
 * AccountReceivable pendente para o mesmo valor).
 */
export async function getReceivables(companyId: string): Promise<ReceivablesBreakdown> {
  const now = new Date();
  const in30days = new Date(now.getTime() + 30 * 86400000);

  // saleIds que já possuem AccountReceivable pendente (recebível já formalizado)
  const pendingARSales = await prisma.accountReceivable.findMany({
    where: { companyId, status: 'pendente', saleId: { not: null } },
    select: { saleId: true },
    distinct: ['saleId'],
  });
  const pendingARSaleIds = pendingARSales.map(a => a.saleId!).filter(Boolean);

  const [arPendente, spNaoRecebido, spDuplicado, arVencida, arVencendo30] = await Promise.all([
    prisma.accountReceivable.aggregate({ where: { companyId, status: 'pendente' }, _sum: { amount: true } }),
    prisma.salePayment.aggregate({ where: { companyId, received: false, sale: { status: 'concluida' } }, _sum: { amount: true } }),
    // Pagamentos (received=false) cuja venda JÁ tem AR pendente → já contabilizados via AR
    pendingARSaleIds.length > 0
      ? prisma.salePayment.aggregate({ where: { companyId, received: false, sale: { status: 'concluida' }, saleId: { in: pendingARSaleIds } }, _sum: { amount: true } })
      : Promise.resolve({ _sum: { amount: 0 } } as { _sum: { amount: number } }),
    prisma.accountReceivable.aggregate({ where: { companyId, status: 'pendente', dueDate: { lt: now } }, _sum: { amount: true } }),
    prisma.accountReceivable.aggregate({ where: { companyId, status: 'pendente', dueDate: { gte: now, lte: in30days } }, _sum: { amount: true } }),
  ]);

  const saldoAccountReceivablePendente = arPendente._sum?.amount ?? 0;
  // Remove a parcela duplicada (SalePayment cuja venda já tem AR pendente)
  const spDuplicadoValor = spDuplicado?._sum?.amount ?? 0;
  const saldoSalePaymentNaoRecebido = Math.max(0, (spNaoRecebido._sum?.amount ?? 0) - spDuplicadoValor);
  const vencidasAccountReceivable = arVencida._sum?.amount ?? 0;
  const vencendoEm30Dias = arVencendo30._sum?.amount ?? 0;

  return {
    saldoAccountReceivablePendente: round2(saldoAccountReceivablePendente),
    saldoSalePaymentNaoRecebido: round2(saldoSalePaymentNaoRecebido),
    totalGeral: round2(saldoAccountReceivablePendente + saldoSalePaymentNaoRecebido),
    vencidasAccountReceivable: round2(vencidasAccountReceivable),
    vencendoEm30Dias: round2(vencendoEm30Dias),
  };
}

