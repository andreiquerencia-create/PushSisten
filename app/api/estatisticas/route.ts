export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import {
  calculateSalesMetrics,
  getCashBalance,
  calculateStockMetrics,
  getReceivables,
  calculateDRE,
  pctChange,
} from '@/lib/financial-engine';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const companyId = session.user.companyId;

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(now.getDate() - 30);

    // ===== FONTE ÚNICA: financial-engine =====
    const [salesMonth, salesLastMonth, cashBalance, stockMetrics, receivables, dreMonth] = await Promise.all([
      calculateSalesMetrics(companyId, { gte: startOfMonth }),
      calculateSalesMetrics(companyId, { gte: startOfLastMonth, lte: endOfLastMonth }),
      getCashBalance(companyId),
      calculateStockMetrics(companyId),
      getReceivables(companyId),
      calculateDRE(companyId, { gte: startOfMonth }),
    ]);

    const crescimento = pctChange(salesMonth.faturamentoLiquido, salesLastMonth.faturamentoLiquido);

    // Top products
    const topProducts = await prisma.saleItem.groupBy({
      by: ['productId'],
      where: { sale: { companyId, status: 'concluida', createdAt: { gte: startOfMonth } } },
      _sum: { quantity: true, total: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 5,
    });
    const topProdIds = topProducts.map(p => p.productId);
    const topProdNames = await prisma.product.findMany({ where: { id: { in: topProdIds } }, select: { id: true, name: true } });
    const topProdMap = new Map(topProdNames.map(p => [p.id, p.name]));

    // CRM
    const totalClientes = await prisma.customer.count({ where: { companyId, isActive: true } });
    const clientesAtivos = await prisma.customer.count({ where: { companyId, isActive: true, lastPurchase: { gte: thirtyDaysAgo } } });
    const clientesInativos = totalClientes - clientesAtivos;
    const retencao = totalClientes > 0 ? (clientesAtivos / totalClientes) * 100 : 0;
    const avgFrequency = await prisma.customer.aggregate({ where: { companyId, isActive: true, purchaseCount: { gt: 0 } }, _avg: { purchaseCount: true } });

    // Sales by category
    const salesByCategory = await prisma.saleItem.groupBy({
      by: ['productId'],
      where: { sale: { companyId, status: 'concluida', createdAt: { gte: startOfMonth } } },
      _sum: { total: true },
    });
    const catProductIds = salesByCategory.map(s => s.productId);
    const catProducts = await prisma.product.findMany({ where: { id: { in: catProductIds } }, select: { id: true, categoryId: true, category: { select: { name: true } } } });
    const catMap: Map<string, string> = new Map(catProducts.map(p => [p.id, p.category?.name ?? 'Sem categoria']));
    const categoryTotals: Record<string, number> = {};
    salesByCategory.forEach((s: any) => {
      const cat = catMap.get(s.productId) ?? 'Sem categoria';
      categoryTotals[cat] = (categoryTotals[cat] ?? 0) + (s._sum?.total ?? 0);
    });
    const vendasPorCategoria = Object.entries(categoryTotals).map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total);

    // Sellers
    const sellerRanking = await prisma.sale.groupBy({
      by: ['sellerId'],
      where: { companyId, status: 'concluida', createdAt: { gte: startOfMonth } },
      _sum: { total: true },
      _count: true,
      orderBy: { _sum: { total: 'desc' } },
      take: 10,
    });
    const sellerIds = sellerRanking.map(s => s.sellerId).filter(Boolean) as string[];
    const sellerUsers = await prisma.user.findMany({ where: { id: { in: sellerIds } }, select: { id: true, name: true } });
    const sellerNameMap = new Map(sellerUsers.map(u => [u.id, u.name]));

    return NextResponse.json({
      financeiro: {
        faturamentoMes: salesMonth.faturamentoLiquido,
        lucroEstimado: dreMonth.lucroLiquido,
        margemMedia: dreMonth.margemLiquidaPct,
        saldoCaixa: cashBalance.saldo, // CORRIGIDO: agora usa CashAccount.currentBalance
        contasReceber: receivables.totalGeral, // UNIFICADO: AR pendente + SalePayment não recebido
        crescimento,
      },
      estoque: {
        totalProdutos: stockMetrics.totalProdutos,
        totalItems: stockMetrics.totalPecas,
        estoqueBaixo: stockMetrics.estoqueBaixo,
        produtosParados: stockMetrics.capitalParadoProdutos,
        capitalParado: stockMetrics.capitalParado, // CORRIGIDO: agora é capital sem giro, não todo o estoque
        capitalInvestido: stockMetrics.capitalInvestido, // NOVO: capital total investido
        topProdutos: topProducts.map(p => ({ name: topProdMap.get(p.productId) ?? 'N/A', qty: p._sum.quantity ?? 0, total: p._sum.total ?? 0 })),
      },
      crm: {
        totalClientes,
        clientesAtivos,
        clientesInativos,
        retencao: Math.round(retencao * 10) / 10,
        frequenciaMedia: Math.round((avgFrequency._avg?.purchaseCount ?? 0) * 10) / 10,
      },
      comercial: {
        ticketMedio: salesMonth.ticketMedio,
        totalVendasMes: salesMonth.totalVendas,
        crescimento,
        vendasPorCategoria,
      },
      vendedores: sellerRanking.map((s, i) => ({
        rank: i + 1,
        name: sellerNameMap.get(s.sellerId ?? '') ?? 'N/A',
        totalSold: s._sum.total ?? 0,
        salesCount: s._count,
      })),
    });
  } catch (error) {
    console.error('GET /api/estatisticas error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
