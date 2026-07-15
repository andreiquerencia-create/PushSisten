export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { evaluateSubscription } from '@/lib/subscription-engine';
import { buildPlanUsageReport } from '@/lib/plan-engine';
import { evaluateUpgrade } from '@/lib/upgrade-engine';
import { getBillingOverview } from '@/lib/billing-engine';

/**
 * Plano + consumo + recomendação de upgrade da empresa logada (TAREFA 7/5).
 * Alimenta o card "Seu Plano" na área do cliente. Billing-neutral.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const companyId = (session.user as any).companyId as string | undefined;
    // Master não possui empresa
    if ((session.user as any).isMaster || !companyId) {
      return NextResponse.json({ isMaster: true });
    }

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: {
        name: true,
        isActive: true,
        plan: true,
        maxUsers: true,
        aiQuotaMonthly: true,
        aiCallsThisMonth: true,
        subscriptionStatus: true,
        trialEndsAt: true,
        billingStatus: true,
        gracePeriodEndsAt: true,
        _count: { select: { users: true } },
      },
    });

    if (!company) {
      return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 404 });
    }

    const usage = {
      userCount: company._count?.users ?? 0,
      aiCallsThisMonth: company.aiCallsThisMonth ?? 0,
    };

    const planUsage = buildPlanUsageReport(
      { plan: company.plan, maxUsers: company.maxUsers, aiQuotaMonthly: company.aiQuotaMonthly },
      usage,
    );

    const upgrade = evaluateUpgrade(
      { plan: company.plan, maxUsers: company.maxUsers, aiQuotaMonthly: company.aiQuotaMonthly },
      usage,
    );

    const subscription = evaluateSubscription({
      isActive: company.isActive,
      plan: company.plan,
      subscriptionStatus: company.subscriptionStatus,
      trialEndsAt: company.trialEndsAt,
      billingStatus: (company as any).billingStatus,
      gracePeriodEndsAt: (company as any).gracePeriodEndsAt,
    });

    // Visão de cobrança (P8.4) — assinatura, histórico e status. Pode ser vazia (NONE).
    let billing: Awaited<ReturnType<typeof getBillingOverview>> | null = null;
    try { billing = await getBillingOverview(companyId); } catch { /* não-crítico */ }

    return NextResponse.json({
      isMaster: false,
      companyName: company.name,
      planUsage,
      upgrade,
      subscription: {
        status: subscription.status,
        plan: subscription.plan,
        label: subscription.label,
        daysRemaining: subscription.daysRemaining,
        trialEndsAt: subscription.trialEndsAt ? subscription.trialEndsAt.toISOString() : null,
        alertLevel: subscription.alertLevel,
      },
      billing: billing ? {
        status: billing.billingStatus,
        gracePeriodEndsAt: billing.gracePeriodEndsAt ? billing.gracePeriodEndsAt.toISOString() : null,
        subscription: billing.subscription ? {
          plan: billing.subscription.plan,
          priceAmount: billing.subscription.priceAmount,
          status: billing.subscription.status,
          nextBillingDate: billing.subscription.nextBillingDate ? billing.subscription.nextBillingDate.toISOString() : null,
          lastPaymentDate: billing.subscription.lastPaymentDate ? billing.subscription.lastPaymentDate.toISOString() : null,
          lastPaymentStatus: billing.subscription.lastPaymentStatus,
          paymentMethodBrand: billing.subscription.paymentMethodBrand,
          paymentMethodLast4: billing.subscription.paymentMethodLast4,
        } : null,
        payments: billing.payments.map(p => ({
          id: p.id, amount: p.amount, status: p.status, method: p.method,
          paidAt: p.paidAt ? p.paidAt.toISOString() : null,
          createdAt: p.createdAt.toISOString(),
        })),
      } : null,
    });
  } catch (error: any) {
    console.error('Plano status error:', error?.message);
    return NextResponse.json({ error: 'Erro' }, { status: 500 });
  }
}
