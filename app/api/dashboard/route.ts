export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import {
  calculateSalesMetrics,
  getCashBalance,
  calculateDRE,
} from '@/lib/financial-engine';
// Push Score oficial (Single Source of Truth) — lido, NUNCA recalculado aqui.
import { recordPushScoreSnapshot } from '@/lib/push-score-engine';
// Insights Engine oficial — ÚNICA fonte de diagnóstico
import { generateInsights, type InsightRecord } from '@/lib/insights-engine';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const companyId = session.user.companyId;
    if (!companyId) {
      return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 400 });
    }

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const yesterday = new Date(startOfDay.getTime() - 86400000);
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    // ===== FONTE ÚNICA DE VERDADE: financial-engine =====
    const [salesMonth, salesTodayMetrics, salesYesterdayMetrics, salesPrevMonth, cashBalance, dreMonth] = await Promise.all([
      calculateSalesMetrics(companyId, { gte: startOfMonth }),
      calculateSalesMetrics(companyId, { gte: startOfDay }),
      calculateSalesMetrics(companyId, { gte: yesterday, lte: startOfDay }),
      calculateSalesMetrics(companyId, { gte: prevMonthStart, lte: prevMonthEnd }),
      getCashBalance(companyId),
      calculateDRE(companyId, { gte: startOfMonth }),
    ]);

    // Sales last 7 days for chart
    const salesLast7 = await prisma.sale.findMany({
      where: { companyId, status: 'concluida', createdAt: { gte: sevenDaysAgo } },
      select: { total: true, createdAt: true },
    });
    const dailySales: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().split('T')[0] ?? '';
      dailySales[key] = 0;
    }
    for (const s of salesLast7 ?? []) {
      const key = (s?.createdAt ?? new Date()).toISOString().split('T')[0] ?? '';
      if (dailySales[key] !== undefined) {
        dailySales[key] = (dailySales[key] ?? 0) + (s?.total ?? 0);
      }
    }

    // Top 5 products
    const topProducts = await prisma.saleItem.groupBy({
      by: ['productId'],
      where: {
        sale: { companyId, status: 'concluida', createdAt: { gte: startOfMonth } },
      },
      _sum: { quantity: true, total: true },
      orderBy: { _sum: { total: 'desc' } },
      take: 5,
    });
    const topProductIds = topProducts?.map?.((p: any) => p?.productId)?.filter?.(Boolean) ?? [];
    const productDetails = await prisma.product.findMany({
      where: { id: { in: topProductIds } },
      select: { id: true, name: true },
    });
    const topProductsFormatted = (topProducts ?? []).map((tp: any) => {
      const product = (productDetails ?? []).find((p: any) => p?.id === tp?.productId);
      return {
        name: product?.name ?? 'Desconhecido',
        quantity: tp?._sum?.quantity ?? 0,
        total: tp?._sum?.total ?? 0,
      };
    });

    // Low stock alerts
    const lowStock = await prisma.$queryRaw`
      SELECT id, name, "stockQuantity", "minStock"
      FROM products
      WHERE "companyId" = ${companyId}
        AND "isActive" = true
        AND "stockQuantity" <= "minStock"
      LIMIT 10
    ` as any[];

    // Inactive customers (no purchase in 30+ days)
    const inactiveCustomers = await prisma.customer.findMany({
      where: {
        companyId,
        isActive: true,
        OR: [
          { lastPurchase: { lt: thirtyDaysAgo } },
          { lastPurchase: null },
        ],
      },
      select: { id: true, name: true, lastPurchase: true, totalPurchased: true },
      take: 10,
      orderBy: { totalPurchased: 'desc' },
    });

    // Seller ranking
    const sellerRanking = await prisma.sale.groupBy({
      by: ['sellerId'],
      where: { companyId, status: 'concluida', createdAt: { gte: startOfMonth } },
      _sum: { total: true },
      _count: true,
      orderBy: { _sum: { total: 'desc' } },
      take: 5,
    });
    const sellerIds = sellerRanking?.map?.((s: any) => s?.sellerId)?.filter?.(Boolean) ?? [];
    const sellerDetails = await prisma.user.findMany({
      where: { id: { in: sellerIds } },
      select: { id: true, name: true },
    });
    const sellerRankingFormatted = (sellerRanking ?? []).map((sr: any) => {
      const seller = (sellerDetails ?? []).find((s: any) => s?.id === sr?.sellerId);
      return {
        name: seller?.name ?? 'Desconhecido',
        total: sr?._sum?.total ?? 0,
        count: sr?._count ?? 0,
      };
    });

    // === Insights OFICIAIS (Insights Engine — fonte única de diagnóstico) ===
    const SEVERITY_MAP: Record<string, 'info' | 'warning' | 'success' | 'danger'> = {
      ALTO: 'danger',
      MEDIO: 'warning',
      BAIXO: 'info',
    };
    const TYPE_ICON: Record<string, string> = {
      ESTOQUE: 'package',
      CLIENTE: 'users',
      FINANCEIRO: 'alert-triangle',
      CREDIARIO: 'clock',
    };
    let insights: { type: string; icon: string; text: string; severity: 'info' | 'warning' | 'success' | 'danger'; value?: string; action?: string }[] = [];
    try {
      const insResult = await generateInsights(companyId);
      if (insResult.status === 'ATIVO') {
        insights = insResult.insights.slice(0, 6).map((ins: InsightRecord) => ({
          type: ins.type.toLowerCase(),
          icon: TYPE_ICON[ins.type] ?? 'alert-triangle',
          text: ins.message,
          severity: SEVERITY_MAP[ins.severity] ?? 'info',
        }));
      }
    } catch (e) {
      console.error('[dashboard] falha ao carregar insights oficiais:', e);
    }

    // === Push Score OFICIAL (substitui o antigo healthScore/riskScore paralelo) ===
    // Lê o snapshot canônico do dia (idempotente). NÃO é cálculo paralelo.
    let pushScore: number | null = null;
    let pushScoreClassification: string | null = null;
    let pushScoreStatus = 'EM_FORMACAO';
    try {
      const snap = await recordPushScoreSnapshot(companyId);
      pushScore = snap.score;
      pushScoreClassification = snap.classification;
      pushScoreStatus = snap.status;
    } catch (e) {
      console.error('[dashboard] falha ao ler Push Score oficial:', e);
    }

    return NextResponse.json({
      kpis: {
        faturamentoDia: salesTodayMetrics.faturamentoLiquido,
        faturamentoMes: salesMonth.faturamentoLiquido,
        lucroEstimado: dreMonth.lucroLiquido,
        lucroBruto: salesMonth.lucroBruto,
        margemMedia: dreMonth.margemLiquidaPct,
        margemBruta: salesMonth.margemBruta,
        totalTaxas: salesMonth.taxasCartao,
        saldoCaixa: cashBalance.saldo,
        ticketMedio: salesMonth.ticketMedio,
        totalVendasMes: salesMonth.totalVendas,
        faturamentoDiaAnterior: salesYesterdayMetrics.faturamentoLiquido,
        faturamentoMesAnterior: salesPrevMonth.faturamentoLiquido,
        ticketMedioAnterior: salesPrevMonth.ticketMedio,
      },
      dailySales: Object.entries(dailySales ?? {}).map(([date, total]: [string, any]) => ({ date, total: total ?? 0 })),
      topProducts: topProductsFormatted,
      lowStock: lowStock ?? [],
      inactiveCustomers: inactiveCustomers ?? [],
      sellerRanking: sellerRankingFormatted,
      insights,
      pushScore,
      pushScoreClassification,
      pushScoreStatus,
    });
  } catch (error: any) {
    console.error('Dashboard error:', error);
    return NextResponse.json({ error: 'Erro ao carregar dashboard' }, { status: 500 });
  }
}
