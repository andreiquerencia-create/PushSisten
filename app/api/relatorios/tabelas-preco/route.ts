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
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');

    const dateFilter: any = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate);

    // Get all sale items that used price tables within period
    const saleItemsWithTable = await prisma.saleItem.findMany({
      where: {
        priceTableId: { not: null },
        sale: {
          companyId,
          status: 'concluida',
          ...(startDate || endDate ? { createdAt: dateFilter } : {}),
        },
      },
      include: {
        sale: { select: { createdAt: true, saleNumber: true, companySaleNumber: true } },
        product: { select: { name: true, salePrice: true, costPrice: true } },
        priceTable: { select: { name: true, minQuantity: true, unitPrice: true } },
      },
    });

    // Total sales in the same period (for comparison)
    const totalSalesInPeriod = await prisma.sale.count({
      where: {
        companyId,
        status: 'concluida',
        ...(startDate || endDate ? { createdAt: dateFilter } : {}),
      },
    });

    const totalSaleItemsInPeriod = await prisma.saleItem.count({
      where: {
        sale: {
          companyId,
          status: 'concluida',
          ...(startDate || endDate ? { createdAt: dateFilter } : {}),
        },
      },
    });

    // Aggregate by price table name
    const tableMap = new Map<string, {
      tableName: string;
      count: number;
      totalQuantity: number;
      totalRevenue: number;
      totalOriginalRevenue: number;
      totalDiscount: number;
    }>();

    for (const item of saleItemsWithTable) {
      const tableName = item.priceTableName || item.priceTable?.name || 'Desconhecida';
      const existing = tableMap.get(tableName) || {
        tableName,
        count: 0,
        totalQuantity: 0,
        totalRevenue: 0,
        totalOriginalRevenue: 0,
        totalDiscount: 0,
      };
      existing.count += 1;
      existing.totalQuantity += item.quantity;
      existing.totalRevenue += item.total;
      const origPrice = item.originalPrice ?? item.product.salePrice;
      existing.totalOriginalRevenue += origPrice * item.quantity;
      existing.totalDiscount += (item.priceDiscount ?? 0) * item.quantity;
      tableMap.set(tableName, existing);
    }

    const byTable = Array.from(tableMap.values()).sort((a, b) => b.totalRevenue - a.totalRevenue);

    // Summary stats
    const totalItemsWithTable = saleItemsWithTable.length;
    const totalRevenueWithTable = saleItemsWithTable.reduce((s, i) => s + i.total, 0);
    const totalDiscountGiven = saleItemsWithTable.reduce((s, i) => s + ((i.priceDiscount ?? 0) * i.quantity), 0);
    const avgDiscount = totalItemsWithTable > 0 ? totalDiscountGiven / totalItemsWithTable : 0;
    const usagePercent = totalSaleItemsInPeriod > 0 ? (totalItemsWithTable / totalSaleItemsInPeriod) * 100 : 0;

    // Top products using price tables
    const productMap = new Map<string, { name: string; count: number; revenue: number }>(); 
    for (const item of saleItemsWithTable) {
      const key = item.productId;
      const existing = productMap.get(key) || { name: item.product.name, count: 0, revenue: 0 };
      existing.count += item.quantity;
      existing.revenue += item.total;
      productMap.set(key, existing);
    }
    const topProducts = Array.from(productMap.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 10);

    // Daily trend
    const dailyMap = new Map<string, { date: string; count: number; revenue: number }>();
    for (const item of saleItemsWithTable) {
      const date = item.sale.createdAt.toISOString().split('T')[0];
      const existing = dailyMap.get(date) || { date, count: 0, revenue: 0 };
      existing.count += 1;
      existing.revenue += item.total;
      dailyMap.set(date, existing);
    }
    const dailyTrend = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json({
      summary: {
        totalItemsWithTable,
        totalSaleItemsInPeriod,
        totalSalesInPeriod,
        totalRevenueWithTable,
        totalDiscountGiven,
        avgDiscount,
        usagePercent,
      },
      byTable,
      topProducts,
      dailyTrend,
    });
  } catch (error: any) {
    console.error('Error generating price table report:', error);
    return NextResponse.json({ error: 'Erro ao gerar relatório' }, { status: 500 });
  }
}
