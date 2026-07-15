export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { evaluateSubscription } from '@/lib/subscription-engine';

/**
 * Status efetivo da assinatura da empresa logada.
 * Usado pela tela de bloqueio (/assinatura-expirada) para mostrar plano,
 * data de expiração, status e mensagem amigável.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const companyId = (session.user as any).companyId as string | undefined;
    // Master não tem empresa — nunca bloqueado
    if ((session.user as any).isMaster || !companyId) {
      return NextResponse.json({
        status: 'ACTIVE',
        blocked: false,
        reason: null,
        plan: 'master',
        trialEndsAt: null,
        daysRemaining: null,
        alertLevel: null,
        label: 'Master',
        companyName: (session.user as any).companyName ?? null,
      });
    }

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: {
        name: true,
        isActive: true,
        plan: true,
        subscriptionStatus: true,
        trialEndsAt: true,
        billingStatus: true,
        gracePeriodEndsAt: true,
      },
    });

    if (!company) {
      return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 404 });
    }

    const evalResult = evaluateSubscription(company);
    return NextResponse.json({
      ...evalResult,
      trialEndsAt: evalResult.trialEndsAt ? evalResult.trialEndsAt.toISOString() : null,
      companyName: company.name,
    });
  } catch (error: any) {
    console.error('Subscription status error:', error?.message);
    return NextResponse.json({ error: 'Erro' }, { status: 500 });
  }
}
