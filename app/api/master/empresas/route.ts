export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { deleteCompanyCascade, getProtectionMap, getCompanyRecordCounts } from '@/lib/company-deletion';
import { evaluateSubscription } from '@/lib/subscription-engine';
import { buildPlanUsageReport, getPlanDefinition, isUnlimited } from '@/lib/plan-engine';
import { evaluateUpgrade } from '@/lib/upgrade-engine';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.isMaster) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const companies = await prisma.company.findMany({
      include: {
        _count: { select: { users: true, sales: true, products: true, customers: true } },
        billingCustomer: {
          include: {
            subscriptions: { orderBy: { createdAt: 'desc' }, take: 1 },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Enrich with revenue data per company
    const enriched = await Promise.all(
      (companies ?? []).map(async (c: any) => {
        let totalRevenue = 0;
        try {
          const agg = await prisma.sale.aggregate({
            where: { companyId: c.id, status: 'concluida' },
            _sum: { total: true },
          });
          totalRevenue = agg._sum?.total ?? 0;
        } catch { /* */ }
        // Status efetivo CALCULADO pelo motor único (TAREFA 8 — não confia só no banco)
        const subscription = evaluateSubscription({
          isActive: c.isActive,
          plan: c.plan,
          subscriptionStatus: c.subscriptionStatus,
          trialEndsAt: c.trialEndsAt,
        });
        const usageInput = {
          userCount: c._count?.users ?? 0,
          aiCallsThisMonth: c.aiCallsThisMonth ?? 0,
        };
        // Relatório de uso x limites (TAREFA 7 — motor de planos)
        const planUsage = buildPlanUsageReport(
          { plan: c.plan, maxUsers: c.maxUsers, aiQuotaMonthly: c.aiQuotaMonthly },
          usageInput,
        );
        // Recomendação de upgrade (TAREFA 6 — motor de upgrade, billing-neutral)
        const upgrade = evaluateUpgrade(
          { plan: c.plan, maxUsers: c.maxUsers, aiQuotaMonthly: c.aiQuotaMonthly },
          usageInput,
        );
        // Resumo de COBRANÇA (P8.4) — baseado em billingStatus (fonte da verdade) +
        // espelho da assinatura no gateway. Empresas sem assinatura => NONE (nunca inadimplentes).
        const activeSub = c.billingCustomer?.subscriptions?.[0] || null;
        let graceDaysRemaining: number | null = null;
        if (c.billingStatus === 'PAST_DUE' && c.gracePeriodEndsAt) {
          const ms = new Date(c.gracePeriodEndsAt).getTime() - Date.now();
          graceDaysRemaining = Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
        }
        const billing = {
          status: c.billingStatus || 'NONE',
          provider: c.billingCustomer?.provider || null,
          gracePeriodEndsAt: c.gracePeriodEndsAt ? new Date(c.gracePeriodEndsAt).toISOString() : null,
          graceDaysRemaining,
          subscription: activeSub ? {
            plan: activeSub.plan,
            priceAmount: activeSub.priceAmount,
            status: activeSub.status,
            nextBillingDate: activeSub.nextBillingDate ? activeSub.nextBillingDate.toISOString() : null,
            lastPaymentDate: activeSub.lastPaymentDate ? activeSub.lastPaymentDate.toISOString() : null,
            lastPaymentStatus: activeSub.lastPaymentStatus || null,
            paymentMethodBrand: activeSub.paymentMethodBrand || null,
            paymentMethodLast4: activeSub.paymentMethodLast4 || null,
          } : null,
        };
        const { billingCustomer, ...rest } = c;
        return {
          ...rest,
          totalRevenue,
          subscription: {
            ...subscription,
            trialEndsAt: subscription.trialEndsAt ? subscription.trialEndsAt.toISOString() : null,
          },
          planUsage,
          upgrade,
          billing,
        };
      })
    );

    return NextResponse.json(enriched);
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: 'Erro' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.isMaster) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const body = await request.json();

    const updateData: any = {};
    if (typeof body?.isActive === 'boolean') updateData.isActive = body.isActive;
    if (typeof body?.isProtected === 'boolean') updateData.isProtected = body.isProtected;
    if (body?.plan) updateData.plan = body.plan;
    if (typeof body?.maxUsers === 'number') updateData.maxUsers = body.maxUsers;
    if (typeof body?.aiQuotaMonthly === 'number') updateData.aiQuotaMonthly = body.aiQuotaMonthly;

    // Ao trocar de plano, aplicar os limites padrão do catálogo automaticamente
    // (apenas quando o master não informou explicitamente um valor customizado).
    if (body?.plan) {
      const def = getPlanDefinition(body.plan);
      if (typeof body?.maxUsers !== 'number') {
        updateData.maxUsers = isUnlimited(def.maxUsers) ? 0 : def.maxUsers;
      }
      if (typeof body?.aiQuotaMonthly !== 'number') {
        updateData.aiQuotaMonthly = isUnlimited(def.aiQuotaMonthly) ? 0 : def.aiQuotaMonthly;
      }
    }
    if (body?.subscriptionStatus) updateData.subscriptionStatus = body.subscriptionStatus;

    // Handle trialDays change — recalculate trialEndsAt from company's createdAt
    if (typeof body?.trialDays === 'number' && body.trialDays > 0) {
      updateData.trialDays = body.trialDays;
      // Fetch the company to get createdAt
      const existing = await prisma.company.findUnique({
        where: { id: body.id },
        select: { createdAt: true },
      });
      if (existing) {
        const newTrialEnd = new Date(existing.createdAt);
        newTrialEnd.setDate(newTrialEnd.getDate() + body.trialDays);
        updateData.trialEndsAt = newTrialEnd;
      }
    }

    // If changing plan from trial to a paid plan, set subscription active
    if (body?.plan && body.plan !== 'trial') {
      updateData.subscriptionStatus = body.subscriptionStatus || 'active';
    }

    const company = await prisma.company.update({
      where: { id: body?.id },
      data: updateData,
    });

    // Log activity (fire and forget)
    try {
      const changes = Object.keys(updateData).join(', ');
      await prisma.activityLog.create({
        data: {
          action: 'company_edit',
          description: `Empresa "${company.name}" editada: ${changes}`,
          entityType: 'company',
          entityId: company.id,
          companyId: company.id,
          userId: session.user.id,
          userName: session.user.name || 'Master',
          metadata: updateData,
        },
      });
    } catch { /* non-critical */ }

    return NextResponse.json(company);
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: 'Erro' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.isMaster) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('id');
    if (!companyId) return NextResponse.json({ error: 'ID da empresa é obrigatório' }, { status: 400 });

    // Verify company exists
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { name: true, _count: { select: { users: true, sales: true } } },
    });
    if (!company) return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 404 });

    // MODO SEGURO: bloquear exclusão de empresas protegidas (produção / conta master)
    const protection = await getProtectionMap([companyId]);
    if (protection[companyId]?.protected) {
      return NextResponse.json(
        { error: `Empresa protegida e não pode ser excluída (${protection[companyId].reasons.join('; ')})` },
        { status: 403 }
      );
    }

    // Snapshot de contagens ANTES da exclusão (para auditoria)
    let recordCounts: any = null;
    try { recordCounts = await getCompanyRecordCounts(companyId); } catch { /* não crítico */ }

    // Exclusão COMPLETA e TRANSACIONAL (rollback automático em erro)
    await prisma.$transaction(
      async (tx: any) => { await deleteCompanyCascade(tx, companyId); },
      { timeout: 120000, maxWait: 20000 }
    );

    // Log de auditoria (global, sem companyId pois a empresa foi removida)
    try {
      await prisma.activityLog.create({
        data: {
          action: 'company_delete',
          description: `Empresa "${company.name}" excluída permanentemente (${company._count.users} usuários, ${company._count.sales} vendas${recordCounts ? `, ${recordCounts.total} registros` : ''})`,
          entityType: 'company',
          entityId: companyId,
          userId: session.user.id,
          userName: session.user.name || 'Master',
          metadata: { deletedCompanyName: company.name, deletedCompanyId: companyId, recordCounts },
        },
      });
    } catch { /* non-critical - company already deleted */ }

    return NextResponse.json({ success: true, message: `Empresa "${company.name}" excluída com sucesso` });
  } catch (error: any) {
    console.error('Delete company error:', error);
    return NextResponse.json({ error: 'Erro ao excluir empresa: ' + (error?.message || 'Erro desconhecido') }, { status: 500 });
  }
}
