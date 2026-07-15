export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const companyId = session.user.companyId;
    const url = new URL(request.url);
    const groupBy = url.searchParams.get('groupBy') ?? 'category';
    const days = parseInt(url.searchParams.get('days') ?? '30');

    const since = new Date();
    since.setDate(since.getDate() - days);

    // Get completed sales with items in the period
    const saleItems = await prisma.saleItem.findMany({
      where: {
        sale: {
          companyId,
          status: 'concluida',
          createdAt: { gte: since },
        },
      },
      include: {
        product: {
          select: {
            id: true, name: true, sku: true,
            costPrice: true, avgCost: true, lastCost: true, replacementCost: true,
            salePrice: true, stockQuantity: true,
            categoryId: true, supplierId: true,
            category: { select: { id: true, name: true } },
            supplier: { select: { id: true, name: true } },
          },
        },
        variation: {
          select: {
            id: true, color: true, size: true, grade: true,
            costPrice: true, avgCost: true, salePrice: true, stockQuantity: true,
          },
        },
        sale: {
          select: {
            id: true, sellerId: true, discount: true, total: true, subtotal: true,
            payments: { select: { feeAmount: true, feePercent: true } },
            seller: { select: { id: true, name: true, seller: { select: { commissionRate: true } } } },
          },
        },
      },
    });

    // Build profitability data
    const groups: Record<string, {
      key: string; label: string; qtySold: number; revenue: number;
      costTotal: number; feeTotal: number; commissionTotal: number;
      discountTotal: number; profit: number; stockQty: number;
      grossMargin: number; netMargin: number; itemCount: number;
    }> = {};

    let totalRevenue = 0;
    let totalCost = 0;
    let totalProfit = 0;
    let totalFees = 0;
    let totalCommissions = 0;
    let totalDiscount = 0;
    let totalItems = 0;

    for (const si of saleItems) {
      const product = si.product;
      const variation = si.variation;
      const sale = si.sale;
      if (!product) continue;

      // Determine cost (prefer avgCost, then costPrice)
      const unitCost = variation?.avgCost || variation?.costPrice || product.avgCost || product.costPrice || 0;
      const itemRevenue = si.total || (si.quantity * si.unitPrice);
      const itemCost = unitCost * si.quantity;

      // Proportional fees from sale payments
      const saleFees = (sale?.payments ?? []).reduce((s: number, p: any) => s + (p.feeAmount || 0), 0);
      const saleTotal = sale?.total || 1;
      const feeShare = saleFees * (itemRevenue / saleTotal);

      // Commission
      const commRate = sale?.seller?.seller?.commissionRate ?? 0;
      const commissionShare = itemRevenue * (commRate / 100);

      // Discount share
      const saleDiscount = sale?.discount || 0;
      const discountShare = saleDiscount * (itemRevenue / (sale?.subtotal || saleTotal));

      const netProfit = itemRevenue - itemCost - feeShare - commissionShare;

      // Group key
      let key = '';
      let label = '';
      switch (groupBy) {
        case 'category':
          key = product.categoryId || 'sem-categoria';
          label = product.category?.name || 'Sem categoria';
          break;
        case 'product':
          key = product.id;
          label = product.name;
          break;
        case 'supplier':
          key = product.supplierId || 'sem-fornecedor';
          label = product.supplier?.name || 'Sem fornecedor';
          break;
        case 'seller':
          key = sale?.sellerId || 'sem-vendedor';
          label = sale?.seller?.name || 'Sem vendedor';
          break;
        case 'color':
          key = variation?.color || 'sem-cor';
          label = variation?.color || 'Sem cor';
          break;
        case 'size':
          key = variation?.size || 'sem-tamanho';
          label = variation?.size || 'Sem tamanho';
          break;
        case 'grade':
          key = variation?.grade || 'sem-grade';
          label = variation?.grade || 'Sem grade';
          break;
        default:
          key = product.categoryId || 'sem-categoria';
          label = product.category?.name || 'Sem categoria';
      }

      if (!groups[key]) {
        groups[key] = {
          key, label, qtySold: 0, revenue: 0, costTotal: 0,
          feeTotal: 0, commissionTotal: 0, discountTotal: 0,
          profit: 0, stockQty: 0, grossMargin: 0, netMargin: 0, itemCount: 0,
        };
      }

      const g = groups[key];
      g.qtySold += si.quantity;
      g.revenue += itemRevenue;
      g.costTotal += itemCost;
      g.feeTotal += feeShare;
      g.commissionTotal += commissionShare;
      g.discountTotal += discountShare;
      g.profit += netProfit;
      g.itemCount += 1;

      // Track stock (avoid double counting)
      if (groupBy === 'product') {
        g.stockQty = product.stockQuantity;
      } else if (groupBy === 'color' || groupBy === 'size' || groupBy === 'grade') {
        g.stockQty += variation?.stockQuantity ?? 0;
      } else {
        g.stockQty += product.stockQuantity;
      }

      totalRevenue += itemRevenue;
      totalCost += itemCost;
      totalProfit += netProfit;
      totalFees += feeShare;
      totalCommissions += commissionShare;
      totalDiscount += discountShare;
      totalItems += si.quantity;
    }

    // Calculate margins
    const data = Object.values(groups).map(g => {
      g.grossMargin = g.revenue > 0 ? Math.round(((g.revenue - g.costTotal) / g.revenue) * 10000) / 100 : 0;
      g.netMargin = g.revenue > 0 ? Math.round((g.profit / g.revenue) * 10000) / 100 : 0;
      return g;
    }).sort((a, b) => b.profit - a.profit);

    const avgGrossMargin = totalRevenue > 0 ? Math.round(((totalRevenue - totalCost) / totalRevenue) * 10000) / 100 : 0;
    const avgNetMargin = totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 10000) / 100 : 0;
    const avgTicket = totalItems > 0 ? totalRevenue / totalItems : 0;

    return NextResponse.json({
      summary: {
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalCost: Math.round(totalCost * 100) / 100,
        totalProfit: Math.round(totalProfit * 100) / 100,
        totalFees: Math.round(totalFees * 100) / 100,
        totalCommissions: Math.round(totalCommissions * 100) / 100,
        totalDiscount: Math.round(totalDiscount * 100) / 100,
        avgGrossMargin,
        avgNetMargin,
        avgTicket: Math.round(avgTicket * 100) / 100,
        totalItems,
      },
      data,
    });
  } catch (error: any) {
    console.error('Erro rentabilidade:', error);
    return NextResponse.json({ error: 'Erro ao calcular rentabilidade' }, { status: 500 });
  }
}
