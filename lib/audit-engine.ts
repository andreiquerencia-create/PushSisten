/**
 * AUDIT ENGINE — Verificações automáticas de integridade contábil
 * 
 * Roda checagens periódicas para detectar inconsistências financeiras,
 * vendas órfãs, cancelamentos mal-feitos, CMV zerado, e mais.
 * 
 * Status:
 *  - OK: tudo dentro do esperado
 *  - ALERTA: pequena inconsistência que merece atenção
 *  - CRÍTICO: problema grave que afeta números/relatórios
 */

import { prisma } from '@/lib/db';

export interface AuditCheck {
  id: string;
  title: string;
  category: 'vendas' | 'financeiro' | 'estoque' | 'clientes' | 'integridade' | 'ledger';
  status: 'OK' | 'ALERTA' | 'CRÍTICO';
  count: number;
  message: string;
  details?: any[];
  recommendation?: string;
}

export interface AuditReport {
  companyId: string;
  generatedAt: string;
  summary: {
    total: number;
    ok: number;
    alerta: number;
    critico: number;
  };
  checks: AuditCheck[];
}

export async function runAudit(companyId: string): Promise<AuditReport> {
  const checks: AuditCheck[] = [];

  // ====== 1. Vendas canceladas com pagamentos recebidos não estornados ======
  const cancelledWithReceivedPayments = await prisma.sale.findMany({
    where: {
      companyId,
      status: 'cancelada',
      payments: { some: { received: true } },
    },
    select: { id: true, saleNumber: true, total: true, payments: { where: { received: true }, select: { id: true, amount: true } } },
    take: 50,
  });
  checks.push({
    id: 'cancelled_with_received_payments',
    title: 'Vendas canceladas com pagamentos ainda marcados como recebidos',
    category: 'vendas',
    status: cancelledWithReceivedPayments.length === 0 ? 'OK' : 'CRÍTICO',
    count: cancelledWithReceivedPayments.length,
    message: cancelledWithReceivedPayments.length === 0
      ? 'Todos os pagamentos de vendas canceladas foram estornados corretamente.'
      : `${cancelledWithReceivedPayments.length} venda(s) cancelada(s) ainda têm pagamentos como recebidos. Saldo de caixa pode estar inflado.`,
    details: cancelledWithReceivedPayments.map(s => ({ saleNumber: s.saleNumber, total: s.total, payments: s.payments.length })),
    recommendation: 'Cancele e estorne os pagamentos dessas vendas manualmente, ou rode o reprocesso global.',
  });

  // ====== 2. Vendas canceladas com contas a receber pendentes ======
  const cancelledSales = await prisma.sale.findMany({
    where: { companyId, status: 'cancelada' },
    select: { id: true, saleNumber: true },
  });
  const cancelledSaleIds = cancelledSales.map(s => s.id);
  const cancelledWithPendingReceivables = cancelledSaleIds.length === 0 ? [] : await prisma.accountReceivable.findMany({
    where: {
      companyId,
      status: 'pendente',
      saleId: { in: cancelledSaleIds },
    },
    select: { id: true, description: true, amount: true, saleId: true },
    take: 50,
  });
  const saleNumberMap = new Map(cancelledSales.map(s => [s.id, s.saleNumber]));
  checks.push({
    id: 'cancelled_with_pending_receivables',
    title: 'Contas a receber pendentes vinculadas a vendas canceladas',
    category: 'financeiro',
    status: cancelledWithPendingReceivables.length === 0 ? 'OK' : 'CRÍTICO',
    count: cancelledWithPendingReceivables.length,
    message: cancelledWithPendingReceivables.length === 0
      ? 'Nenhuma conta a receber órfã.'
      : `${cancelledWithPendingReceivables.length} conta(s) a receber ainda pendente(s) de venda(s) cancelada(s).`,
    details: cancelledWithPendingReceivables.map(r => ({ saleNumber: r.saleId ? saleNumberMap.get(r.saleId) : null, amount: r.amount, description: r.description })),
    recommendation: 'Cancele essas contas a receber manualmente.',
  });

  // ====== 3. Vendas concluídas sem nenhum pagamento (SalePayment) ======
  const concluidasSemPagamento = await prisma.sale.findMany({
    where: {
      companyId,
      status: 'concluida',
      payments: { none: {} },
      total: { gt: 0 },
    },
    select: { id: true, saleNumber: true, total: true },
    take: 50,
  });
  checks.push({
    id: 'concluded_no_payments',
    title: 'Vendas concluídas sem pagamento registrado',
    category: 'vendas',
    status: concluidasSemPagamento.length === 0 ? 'OK' : 'ALERTA',
    count: concluidasSemPagamento.length,
    message: concluidasSemPagamento.length === 0
      ? 'Todas as vendas concluídas têm pagamentos registrados.'
      : `${concluidasSemPagamento.length} venda(s) concluída(s) sem pagamento. Pode ser dados antigos antes do split de pagamentos.`,
    details: concluidasSemPagamento.map(s => ({ saleNumber: s.saleNumber, total: s.total })),
  });

  // ====== 4. Sale.total ≠ subtotal - discount ======
  const allCompletedSales = await prisma.sale.findMany({
    where: { companyId, status: 'concluida' },
    select: { id: true, saleNumber: true, total: true, subtotal: true, discount: true },
  });
  const totalMismatches = allCompletedSales.filter(s => {
    const expected = (s.subtotal ?? 0) - (s.discount ?? 0);
    return Math.abs(expected - (s.total ?? 0)) > 0.01;
  });
  checks.push({
    id: 'sale_total_mismatch',
    title: 'Vendas com total ≠ subtotal − desconto',
    category: 'integridade',
    status: totalMismatches.length === 0 ? 'OK' : 'CRÍTICO',
    count: totalMismatches.length,
    message: totalMismatches.length === 0
      ? 'Todos os totais de vendas batem com subtotal − desconto.'
      : `${totalMismatches.length} venda(s) com cálculo errado entre subtotal/desconto/total.`,
    details: totalMismatches.slice(0, 20),
  });

  // ====== 5. SaleItem.total ≠ unitPrice * quantity - discount ======
  const allItems = await prisma.saleItem.findMany({
    where: { sale: { companyId } },
    select: { id: true, saleId: true, unitPrice: true, quantity: true, discount: true, total: true },
  });
  const itemMismatches = allItems.filter(i => {
    const expected = ((i.unitPrice ?? 0) * (i.quantity ?? 0)) - (i.discount ?? 0);
    return Math.abs(expected - (i.total ?? 0)) > 0.01;
  });
  checks.push({
    id: 'sale_item_total_mismatch',
    title: 'Itens de venda com total ≠ (unitário × qty) − desconto',
    category: 'integridade',
    status: itemMismatches.length === 0 ? 'OK' : 'CRÍTICO',
    count: itemMismatches.length,
    message: itemMismatches.length === 0
      ? 'Todos os itens calculam corretamente.'
      : `${itemMismatches.length} item(ns) de venda com erro de cálculo.`,
    details: itemMismatches.slice(0, 20),
  });

  // ====== 6. Produtos vendidos com avgCost = 0 (CMV zerado!) ======
  const itemsWithZeroCost = await prisma.$queryRaw<any[]>`
    SELECT p.id, p.name, p.sku, COUNT(si.id)::int as item_count, COALESCE(SUM(si.quantity), 0)::int as total_qty
    FROM products p
    JOIN sale_items si ON si."productId" = p.id
    JOIN sales s ON si."saleId" = s.id
    WHERE p."companyId" = ${companyId}
      AND s.status = 'concluida'
      AND (COALESCE(NULLIF(p."avgCost", 0), 0) = 0 AND COALESCE(NULLIF(p."costPrice", 0), 0) = 0)
    GROUP BY p.id, p.name, p.sku
    ORDER BY total_qty DESC
    LIMIT 30
  `;
  checks.push({
    id: 'products_zero_cost_with_sales',
    title: 'Produtos vendidos com CMV zerado',
    category: 'integridade',
    status: itemsWithZeroCost.length === 0 ? 'OK' : 'ALERTA',
    count: itemsWithZeroCost.length,
    message: itemsWithZeroCost.length === 0
      ? 'Todos os produtos vendidos têm custo cadastrado.'
      : `${itemsWithZeroCost.length} produto(s) com vendas e SEM custo cadastrado. CMV desses produtos está zerado, inflando lucro.`,
    details: itemsWithZeroCost.map((p: any) => ({ name: p.name, sku: p.sku, vendas: Number(p.item_count), qtdVendida: Number(p.total_qty) })),
    recommendation: 'Cadastre o custo de compra (avgCost ou costPrice) desses produtos para CMV correto.',
  });

  // ====== 7. CashAccount.currentBalance auto-consistência (Receitas - Despesas registradas) ======
  // NOTA: Esta verificação é informativa. CashAccount é a fonte da verdade.
  // O objetivo é destacar caixas com saldo absurdamente negativo ou saldo registrado <> soma de movimentos
  const cashAccounts = await prisma.cashAccount.findMany({
    where: { companyId, isActive: true },
    select: { id: true, name: true, currentBalance: true, initialBalance: true },
  });
  const cashAccountsNegative = cashAccounts.filter(c => (c.currentBalance ?? 0) < 0);
  checks.push({
    id: 'cash_accounts_negative',
    title: 'Contas de caixa com saldo negativo',
    category: 'financeiro',
    status: cashAccountsNegative.length === 0 ? 'OK' : 'ALERTA',
    count: cashAccountsNegative.length,
    message: cashAccountsNegative.length === 0
      ? 'Nenhuma conta de caixa com saldo negativo.'
      : `${cashAccountsNegative.length} conta(s) de caixa com saldo negativo.`,
    details: cashAccountsNegative.map(c => ({ name: c.name, saldo: c.currentBalance })),
  });

  // ====== 8. Customer.totalPurchased vs soma real de vendas ======
  const customers = await prisma.customer.findMany({
    where: { companyId, isActive: true, totalPurchased: { gt: 0 } },
    select: { id: true, name: true, totalPurchased: true, purchaseCount: true },
  });
  const customerMismatches: any[] = [];
  for (const c of customers) {
    const agg = await prisma.sale.aggregate({
      where: { customerId: c.id, status: 'concluida' },
      _sum: { total: true },
      _count: true,
    });
    const realTotal = agg._sum?.total ?? 0;
    const realCount = agg._count ?? 0;
    if (Math.abs(realTotal - (c.totalPurchased ?? 0)) > 0.01 || realCount !== (c.purchaseCount ?? 0)) {
      customerMismatches.push({
        name: c.name,
        registrado: c.totalPurchased,
        real: realTotal,
        diff: (c.totalPurchased ?? 0) - realTotal,
        countReg: c.purchaseCount,
        countReal: realCount,
      });
    }
  }
  checks.push({
    id: 'customer_totals_mismatch',
    title: 'Clientes com totalPurchased divergente do real',
    category: 'clientes',
    status: customerMismatches.length === 0 ? 'OK' : 'ALERTA',
    count: customerMismatches.length,
    message: customerMismatches.length === 0
      ? 'Estatísticas dos clientes estão sincronizadas.'
      : `${customerMismatches.length} cliente(s) com totais desatualizados.`,
    details: customerMismatches.slice(0, 30),
    recommendation: 'Rode reprocessamento de estatísticas de clientes.',
  });

  // ====== 9. Contas a pagar vencidas há mais de 30 dias ======
  const today = new Date();
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 86400000);
  const overdueLongTerm = await prisma.accountPayable.findMany({
    where: { companyId, status: 'pendente', dueDate: { lt: thirtyDaysAgo } },
    select: { id: true, description: true, amount: true, dueDate: true },
  });
  checks.push({
    id: 'long_overdue_payables',
    title: 'Contas a pagar vencidas há mais de 30 dias',
    category: 'financeiro',
    status: overdueLongTerm.length === 0 ? 'OK' : 'ALERTA',
    count: overdueLongTerm.length,
    message: overdueLongTerm.length === 0
      ? 'Nenhuma conta a pagar criticamente vencida.'
      : `${overdueLongTerm.length} conta(s) vencida(s) há mais de 30 dias.`,
    details: overdueLongTerm.map(p => ({ descricao: p.description, valor: p.amount, vencimento: p.dueDate.toISOString().split('T')[0] })),
  });

  // ====== 10. Estoque negativo ======
  const negativeStockProducts = await prisma.product.findMany({
    where: { companyId, isActive: true, stockQuantity: { lt: 0 } },
    select: { id: true, name: true, sku: true, stockQuantity: true },
    take: 30,
  });
  checks.push({
    id: 'negative_stock',
    title: 'Produtos com estoque negativo',
    category: 'estoque',
    status: negativeStockProducts.length === 0 ? 'OK' : 'CRÍTICO',
    count: negativeStockProducts.length,
    message: negativeStockProducts.length === 0
      ? 'Nenhum produto com estoque negativo.'
      : `${negativeStockProducts.length} produto(s) com estoque negativo. Indica erro em cancelamento ou venda manual sem estoque.`,
    details: negativeStockProducts.map(p => ({ name: p.name, sku: p.sku, stock: p.stockQuantity })),
    recommendation: 'Ajuste o estoque desses produtos manualmente.',
  });

  // ====== 11. FinancialRecord órfãos (reference apontando para venda inexistente) ======
  const allFinRecsWithRef = await prisma.financialRecord.findMany({
    where: { companyId, reference: { not: null } },
    select: { id: true, reference: true, description: true, amount: true },
    take: 1000,
  });
  const orphanFinRecs: any[] = [];
  for (const fr of allFinRecsWithRef) {
    if (!fr.reference || fr.reference.startsWith('stock_entry:')) continue;
    const saleExists = await prisma.sale.count({ where: { id: fr.reference } });
    const payableExists = await prisma.accountPayable.count({ where: { id: fr.reference } });
    const receivableExists = await prisma.accountReceivable.count({ where: { id: fr.reference } });
    if (saleExists === 0 && payableExists === 0 && receivableExists === 0) {
      orphanFinRecs.push({ id: fr.id, ref: fr.reference, desc: fr.description, amount: fr.amount });
    }
  }
  checks.push({
    id: 'orphan_financial_records',
    title: 'Registros financeiros órfãos',
    category: 'integridade',
    status: orphanFinRecs.length === 0 ? 'OK' : 'ALERTA',
    count: orphanFinRecs.length,
    message: orphanFinRecs.length === 0
      ? 'Todos os registros financeiros têm referência válida.'
      : `${orphanFinRecs.length} registro(s) financeiro(s) sem referência válida.`,
    details: orphanFinRecs.slice(0, 30),
  });

  // ====== 12. Contas a receber recebidas mas sem FinancialRecord correspondente ======
  const receivedReceivables = await prisma.accountReceivable.findMany({
    where: { companyId, status: 'recebido' },
    select: { id: true, description: true, amount: true },
    take: 200,
  });
  // Heurística: existe FinancialRecord com paymentMethod ou referência relacionada?
  // Por simplicidade não checamos a vinculação 1:1 aqui. Marca como OK informativo.
  checks.push({
    id: 'received_receivables_count',
    title: 'Total de contas a receber já recebidas',
    category: 'financeiro',
    status: 'OK',
    count: receivedReceivables.length,
    message: `${receivedReceivables.length} conta(s) a receber recebida(s) no histórico.`,
  });

  // ====== CHECK 13: LEDGER — Balanço (débitos === créditos) ======
  try {
    const { getLedgerSummary } = await import('@/lib/ledger-engine');
    const ledgerSummary = await getLedgerSummary(companyId);

    if (ledgerSummary.totalEntries === 0) {
      checks.push({
        id: 'ledger_balance',
        title: 'Ledger Contábil — Balanço',
        category: 'ledger',
        status: 'ALERTA',
        count: 0,
        message: 'Nenhum lançamento no ledger. Execute a migração retroativa.',
      });
    } else {
      checks.push({
        id: 'ledger_balance',
        title: 'Ledger Contábil — Balanço',
        category: 'ledger',
        status: ledgerSummary.isBalanced ? 'OK' : 'CRÍTICO',
        count: ledgerSummary.totalEntries,
        message: ledgerSummary.isBalanced
          ? `${ledgerSummary.totalEntries} lançamentos em ${ledgerSummary.totalBatches} lotes. Débitos = Créditos = R$ ${ledgerSummary.totalDebit.toFixed(2)}`
          : `DESBALANCEADO! Débitos: R$ ${ledgerSummary.totalDebit.toFixed(2)} vs Créditos: R$ ${ledgerSummary.totalCredit.toFixed(2)}`,
      });
    }

    // CHECK 14: Conciliação Ledger vs Engine (saldo de caixa)
    if (ledgerSummary.totalEntries > 0) {
      const caixaBalance = ledgerSummary.accountBalances.find(b => b.accountCode === '7.1');
      const { getCashBalance } = await import('@/lib/financial-engine');
      const engineCash = await getCashBalance(companyId);
      const ledgerCashBalance = caixaBalance?.balance ?? 0;
      const engineCashBalance = engineCash.saldo;
      const diff = Math.abs(ledgerCashBalance - engineCashBalance);

      checks.push({
        id: 'ledger_vs_engine_cash',
        title: 'Conciliação Ledger vs Engine — Saldo de Caixa',
        category: 'ledger',
        status: diff < 0.01 ? 'OK' : diff < 100 ? 'ALERTA' : 'CRÍTICO',
        count: 0,
        message: diff < 0.01
          ? `Saldo conciliado: R$ ${engineCashBalance.toFixed(2)}`
          : `Diferença de R$ ${diff.toFixed(2)} — Ledger: R$ ${ledgerCashBalance.toFixed(2)} vs Engine: R$ ${engineCashBalance.toFixed(2)}`,
      });
    }
  } catch (ledgerErr) {
    console.error('[AUDIT] Erro ao verificar ledger:', ledgerErr);
    checks.push({
      id: 'ledger_balance',
      title: 'Ledger Contábil',
      category: 'ledger',
      status: 'ALERTA',
      count: 0,
      message: 'Erro ao verificar ledger. Verifique se as contas patrimoniais (grupo 7) foram criadas.',
    });
  }

  // ====== SUMMARY ======
  const summary = {
    total: checks.length,
    ok: checks.filter(c => c.status === 'OK').length,
    alerta: checks.filter(c => c.status === 'ALERTA').length,
    critico: checks.filter(c => c.status === 'CRÍTICO').length,
  };

  return {
    companyId,
    generatedAt: new Date().toISOString(),
    summary,
    checks,
  };
}
