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

    // Get all active customers with purchase data
    const customers = await prisma.customer.findMany({
      where: { companyId, isActive: true },
      orderBy: { totalPurchased: 'desc' },
    });

    // ABC Curve calculation
    const totalRevenue = customers.reduce((s, c) => s + (c.totalPurchased ?? 0), 0);
    let cumulative = 0;
    const abcData = customers.map(c => {
      cumulative += c.totalPurchased ?? 0;
      const pct = totalRevenue > 0 ? (cumulative / totalRevenue) * 100 : 0;
      let abcClass = 'C';
      if (pct <= 80) abcClass = 'A';
      else if (pct <= 95) abcClass = 'B';
      return { ...c, abcClass, cumulativePct: Math.round(pct * 10) / 10 };
    });

    // Purchase frequency (average days between purchases)
    const customersWithSales = await prisma.customer.findMany({
      where: { companyId, isActive: true, purchaseCount: { gt: 1 } },
      select: { id: true, name: true, purchaseCount: true, createdAt: true, lastPurchase: true, totalPurchased: true, avgTicket: true },
    });

    const frequencyData = customersWithSales.map(c => {
      const daysSinceFirst = c.lastPurchase && c.createdAt
        ? Math.max(1, Math.floor((new Date(c.lastPurchase).getTime() - new Date(c.createdAt).getTime()) / (1000 * 60 * 60 * 24)))
        : 0;
      const avgFrequency = c.purchaseCount > 1 ? Math.round(daysSinceFirst / (c.purchaseCount - 1)) : 0;
      const daysSinceLast = c.lastPurchase ? Math.floor((Date.now() - new Date(c.lastPurchase).getTime()) / (1000 * 60 * 60 * 24)) : 999;
      const predictedNextDays = avgFrequency > 0 ? Math.max(0, avgFrequency - daysSinceLast) : null;
      const atRisk = avgFrequency > 0 && daysSinceLast > avgFrequency * 1.5;
      return { id: c.id, name: c.name, avgFrequency, daysSinceLast, predictedNextDays, atRisk, purchaseCount: c.purchaseCount, totalPurchased: c.totalPurchased, avgTicket: c.avgTicket };
    }).sort((a, b) => (a.predictedNextDays ?? 999) - (b.predictedNextDays ?? 999));

    // Summary stats
    const countA = abcData.filter(c => c.abcClass === 'A').length;
    const countB = abcData.filter(c => c.abcClass === 'B').length;
    const countC = abcData.filter(c => c.abcClass === 'C').length;
    const atRiskCount = frequencyData.filter(c => c.atRisk).length;
    const avgTicketAll = customers.length > 0 ? customers.reduce((s, c) => s + (c.avgTicket ?? 0), 0) / customers.length : 0;

    return NextResponse.json({
      total: customers.length,
      abc: { A: countA, B: countB, C: countC },
      atRiskCount,
      avgTicketAll: Math.round(avgTicketAll * 100) / 100,
      totalRevenue,
      abcData: abcData.slice(0, 50),
      frequencyData: frequencyData.slice(0, 50),
    });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: 'Erro' }, { status: 500 });
  }
}
