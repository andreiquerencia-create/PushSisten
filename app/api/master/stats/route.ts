export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { evaluateSubscription } from '@/lib/subscription-engine';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.isMaster) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalCompanies,
      totalUsers,
      newCompaniesThisMonth,
      totalSales,
      planBreakdown,
      companiesForEval,
    ] = await Promise.all([
      prisma.company.count(),
      prisma.user.count({ where: { isMaster: false } }),
      prisma.company.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      prisma.sale.count(),
      prisma.company.groupBy({ by: ['plan'], _count: { id: true } }),
      // Campos mínimos para avaliar o status EFETIVO via motor único
      prisma.company.findMany({
        select: { isActive: true, plan: true, subscriptionStatus: true, trialEndsAt: true },
      }),
    ]);

    // ── Status EFETIVO calculado pelo motor de assinaturas (TAREFA 8/9) ──
    let activeCompanies = 0;   // status efetivo ACTIVE
    let trialCompanies = 0;    // status efetivo TRIAL (trial válido)
    let blockedCompanies = 0;  // EXPIRED + SUSPENDED + CANCELED
    let expiringCompanies = 0; // trial válido com alerta (7/3/1 dias)
    for (const c of companiesForEval) {
      const ev = evaluateSubscription(c, now);
      if (ev.status === 'ACTIVE') activeCompanies++;
      else if (ev.status === 'TRIAL') {
        trialCompanies++;
        if (ev.alertLevel) expiringCompanies++;
      } else if (ev.blocked) blockedCompanies++;
    }

    // Total AI calls across platform
    const aiAgg = await prisma.company.aggregate({ _sum: { aiCallsThisMonth: true } });
    const totalAiCalls = aiAgg._sum?.aiCallsThisMonth ?? 0;

    const planCounts: Record<string, number> = {};
    for (const p of planBreakdown ?? []) {
      planCounts[p.plan] = p._count?.id ?? 0;
    }

    return NextResponse.json({
      totalCompanies,
      totalUsers,
      activeCompanies,
      trialCompanies,
      blockedCompanies,
      expiringCompanies,
      newCompaniesThisMonth,
      totalSales,
      totalAiCalls,
      planCounts,
    });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: 'Erro' }, { status: 500 });
  }
}
