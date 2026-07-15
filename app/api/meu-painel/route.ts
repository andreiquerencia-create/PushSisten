export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const userId = session.user.id;
    const companyId = session.user.companyId;
    const sellerId = session.user.sellerId;

    // Get today's date range
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // Get month's date range
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    // Sales today
    const salesToday = await prisma.sale.findMany({
      where: {
        sellerId: userId,
        companyId,
        status: 'concluida',
        createdAt: { gte: todayStart, lte: todayEnd },
      },
      include: {
        customer: { select: { name: true } },
        items: { include: { product: { select: { name: true } }, variation: { select: { color: true, size: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Sales this month
    const salesMonth = await prisma.sale.aggregate({
      where: {
        sellerId: userId,
        companyId,
        status: 'concluida',
        createdAt: { gte: monthStart },
      },
      _sum: { total: true },
      _count: true,
    });

    // All-time stats
    const salesAllTime = await prisma.sale.aggregate({
      where: {
        sellerId: userId,
        companyId,
        status: 'concluida',
      },
      _sum: { total: true },
      _count: true,
    });

    // Get seller info for commission
    let commissionRate = 5;
    let sellerName = session.user.name;
    if (sellerId) {
      const seller = await prisma.seller.findUnique({ where: { id: sellerId } });
      if (seller) {
        commissionRate = seller.commissionRate;
        sellerName = seller.name;
      }
    }

    const totalVendidoMes = salesMonth._sum?.total ?? 0;
    const totalVendidoGeral = salesAllTime._sum?.total ?? 0;
    const comissaoMes = totalVendidoMes * (commissionRate / 100);
    const comissaoGeral = totalVendidoGeral * (commissionRate / 100);

    // Ranking - all sellers
    const allSalesGrouped = await prisma.sale.groupBy({
      by: ['sellerId'],
      where: { companyId, status: 'concluida', sellerId: { not: null } },
      _sum: { total: true },
    });
    const sorted = allSalesGrouped.sort((a, b) => (b._sum?.total ?? 0) - (a._sum?.total ?? 0));
    const myRank = sorted.findIndex(s => s.sellerId === userId) + 1;
    const totalSellers = sorted.length;

    // My clients (customers linked to seller)
    let myClients: any[] = [];
    if (sellerId) {
      myClients = await prisma.customer.findMany({
        where: { companyId, sellerId, isActive: true },
        orderBy: { totalPurchased: 'desc' },
        take: 20,
      });
    }

    // Clients I sold to (top 10 recent)
    const recentCustomerSales = await prisma.sale.findMany({
      where: { sellerId: userId, companyId, status: 'concluida', customerId: { not: null } },
      select: { customerId: true, customer: { select: { id: true, name: true, phone: true, whatsapp: true, totalPurchased: true, lastPurchase: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // Deduplicate customers
    const seenIds = new Set<string>();
    const recentClients = recentCustomerSales
      .filter(s => {
        if (!s.customerId || seenIds.has(s.customerId)) return false;
        seenIds.add(s.customerId);
        return true;
      })
      .map(s => s.customer)
      .slice(0, 10);

    // Daily sales trend (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);
    const last7Sales = await prisma.sale.findMany({
      where: {
        sellerId: userId,
        companyId,
        status: 'concluida',
        createdAt: { gte: sevenDaysAgo },
      },
      select: { total: true, createdAt: true },
    });

    const dailyMap: Record<string, number> = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const key = d.toISOString().split('T')[0];
      dailyMap[key] = 0;
    }
    last7Sales.forEach(s => {
      const key = s.createdAt.toISOString().split('T')[0];
      if (dailyMap[key] !== undefined) dailyMap[key] += s.total;
    });
    const dailyTrend = Object.entries(dailyMap).map(([date, total]) => ({ date, total }));

    return NextResponse.json({
      sellerName,
      commissionRate,
      vendaHoje: salesToday.length,
      totalHoje: salesToday.reduce((s, v) => s + v.total, 0),
      vendasHojeDetail: salesToday.map(s => ({
        id: s.id,
        saleNumber: s.saleNumber,
        companySaleNumber: s.companySaleNumber,
        total: s.total,
        customer: s.customer?.name ?? 'Consumidor',
        items: s.items.map(i => ({
          name: i.product.name,
          variation: [i.variation?.color, i.variation?.size].filter(Boolean).join(' '),
          quantity: i.quantity,
          total: i.total,
        })),
        createdAt: s.createdAt,
      })),
      vendasMes: salesMonth._count ?? 0,
      totalMes: totalVendidoMes,
      comissaoMes,
      totalGeral: totalVendidoGeral,
      comissaoGeral,
      ranking: myRank,
      totalVendedores: totalSellers,
      meusClientes: myClients,
      clientesRecentes: recentClients,
      dailyTrend,
    });
  } catch (error) {
    console.error('GET /api/meu-painel error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
