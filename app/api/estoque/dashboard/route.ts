export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const companyId = session.user.companyId;

    const products = await prisma.product.findMany({
      where: { companyId, isActive: true },
      select: {
        id: true, name: true, sku: true, costPrice: true, salePrice: true,
        stockQuantity: true, minStock: true, categoryId: true,
        avgCost: true, lastCost: true, replacementCost: true,
        category: { select: { name: true } },
        saleItems: {
          select: { quantity: true, total: true, sale: { select: { createdAt: true, status: true } } },
        },
      },
    });

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 86400000);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 86400000);

    let totalValue = 0;
    let totalPieces = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;
    let totalCostInvested = 0;

    // ABC + parados + cobertura
    const productAnalysis: any[] = [];

    for (const p of products) {
      const stock = p.stockQuantity ?? 0;
      const cost = p.avgCost || p.costPrice || 0;
      const sale = p.salePrice ?? 0;
      const minSt = p.minStock ?? 0;

      totalPieces += stock;
      totalValue += stock * sale;
      totalCostInvested += stock * cost;
      if (stock <= 0) outOfStockCount++;
      else if (stock <= minSt) lowStockCount++;

      // Sales analytics (only completed sales)
      const completedItems = p.saleItems.filter((i: any) => i.sale?.status === 'concluida');
      const last30Items = completedItems.filter((i: any) => new Date(i.sale.createdAt) >= thirtyDaysAgo);
      const last90Items = completedItems.filter((i: any) => new Date(i.sale.createdAt) >= ninetyDaysAgo);

      const qtySold30 = last30Items.reduce((s: number, i: any) => s + i.quantity, 0);
      const qtySold90 = last90Items.reduce((s: number, i: any) => s + i.quantity, 0);
      const revenue30 = last30Items.reduce((s: number, i: any) => s + i.total, 0);
      const revenueTotal = completedItems.reduce((s: number, i: any) => s + i.total, 0);

      // Last sale date
      const saleDates = completedItems.map((i: any) => new Date(i.sale.createdAt).getTime());
      const lastSaleDate = saleDates.length > 0 ? new Date(Math.max(...saleDates)) : null;
      const daysSinceLastSale = lastSaleDate ? Math.floor((now.getTime() - lastSaleDate.getTime()) / 86400000) : 999;

      // Coverage: days stock will last at current rate
      const dailyRate30 = qtySold30 / 30;
      const coverageDays = dailyRate30 > 0 ? Math.round(stock / dailyRate30) : stock > 0 ? 999 : 0;

      // Turnover (giro): qtySold30 / avgStock — simplified as qtySold30 / stock
      const turnover = stock > 0 ? +(qtySold30 / stock).toFixed(2) : 0;

      // Profit
      const costOfSold30 = qtySold30 * cost;
      const profit30 = revenue30 - costOfSold30;
      const margin = revenue30 > 0 ? +((profit30 / revenue30) * 100).toFixed(1) : 0;

      productAnalysis.push({
        id: p.id,
        name: p.name,
        sku: p.sku,
        category: p.category?.name ?? '',
        stockQuantity: stock,
        costPrice: cost,
        salePrice: sale,
        minStock: minSt,
        stockValue: stock * sale,
        stockCost: stock * cost,
        qtySold30,
        qtySold90,
        revenue30,
        revenueTotal,
        lastSaleDate,
        daysSinceLastSale,
        coverageDays,
        turnover,
        profit30,
        margin,
        dailyRate30: +dailyRate30.toFixed(2),
      });
    }

    // ABC Classification by revenue
    const sorted = [...productAnalysis].sort((a, b) => b.revenueTotal - a.revenueTotal);
    const totalRevenue = sorted.reduce((s, p) => s + p.revenueTotal, 0);
    let cumulative = 0;
    for (const p of sorted) {
      cumulative += p.revenueTotal;
      const pct = totalRevenue > 0 ? (cumulative / totalRevenue) * 100 : 0;
      if (pct <= 80) p.abcClass = 'A';
      else if (pct <= 95) p.abcClass = 'B';
      else p.abcClass = 'C';
    }
    // products with no sales are always C
    for (const p of sorted) {
      if (p.revenueTotal === 0) p.abcClass = 'C';
    }

    // Parados (no sales in 60+ days and stock > 0)
    const stalled = productAnalysis
      .filter(p => p.daysSinceLastSale >= 60 && p.stockQuantity > 0)
      .sort((a, b) => b.stockValue - a.stockValue);

    const stalledCapital = stalled.reduce((s, p) => s + p.stockCost, 0);

    // Coverage stats
    const withStock = productAnalysis.filter(p => p.stockQuantity > 0);
    const avgCoverage = withStock.length > 0 ? Math.round(withStock.reduce((s, p) => s + Math.min(p.coverageDays, 365), 0) / withStock.length) : 0;
    const avgTurnover = withStock.length > 0 ? +(withStock.reduce((s, p) => s + p.turnover, 0) / withStock.length).toFixed(2) : 0;

    // Rupture risk (stock <= minStock and has sales)
    const ruptureRisk = productAnalysis.filter(p => p.stockQuantity <= p.minStock && p.stockQuantity >= 0 && p.dailyRate30 > 0);

    // Top rentáveis
    const topProfitable = [...productAnalysis].filter(p => p.revenue30 > 0).sort((a, b) => b.profit30 - a.profit30).slice(0, 10);

    // Purchase suggestion: products where coverageDays < 15 and has sales
    const purchaseSuggestion = productAnalysis
      .filter(p => p.coverageDays < 15 && p.dailyRate30 > 0)
      .map(p => ({
        ...p,
        suggestedQty: Math.max(Math.ceil(p.dailyRate30 * 30) - p.stockQuantity, 0),
        daysToRupture: p.coverageDays,
      }))
      .sort((a, b) => a.daysToRupture - b.daysToRupture);

    return NextResponse.json({
      kpis: {
        totalValue,
        totalPieces,
        totalCostInvested,
        stalledCapital,
        lowStockCount,
        outOfStockCount,
        avgCoverage,
        avgTurnover,
        totalProducts: products.length,
        ruptureRiskCount: ruptureRisk.length,
      },
      abc: {
        a: sorted.filter(p => p.abcClass === 'A'),
        b: sorted.filter(p => p.abcClass === 'B'),
        c: sorted.filter(p => p.abcClass === 'C'),
      },
      stalled,
      ruptureRisk,
      topProfitable,
      purchaseSuggestion,
      allProducts: sorted,
    });
  } catch (error: any) {
    console.error('GET /api/estoque/dashboard error:', error);
    return NextResponse.json({ error: 'Erro ao gerar dashboard estoque' }, { status: 500 });
  }
}
