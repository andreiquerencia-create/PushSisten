export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { evaluateSubscription } from '@/lib/subscription-engine';

/**
 * Endpoint leve para a checagem de assinatura/trial feita pelo middleware.
 * Chamado internamente pelo middleware — rápido, query mínima.
 *
 * TODA a regra de bloqueio vem do motor único (lib/subscription-engine.ts).
 */
export async function GET(request: NextRequest) {
  try {
    // Apenas chamadas internas do middleware
    const isMiddleware = request.headers.get('x-middleware-check') === '1';
    if (!isMiddleware) {
      return NextResponse.json({ blocked: false });
    }

    const companyId = request.nextUrl.searchParams.get('companyId');
    if (!companyId) {
      return NextResponse.json({ blocked: false });
    }

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: {
        isActive: true,
        plan: true,
        subscriptionStatus: true,
        trialEndsAt: true,
        billingStatus: true,
        gracePeriodEndsAt: true,
      },
    });

    if (!company) {
      return NextResponse.json({ blocked: true, reason: 'company_not_found' });
    }

    const evalResult = evaluateSubscription(company);
    return NextResponse.json({
      blocked: evalResult.blocked,
      reason: evalResult.reason,
      status: evalResult.status,
    });
  } catch (error: any) {
    console.error('Subscription check error:', error?.message);
    // Fail-open: não bloqueia em caso de erro
    return NextResponse.json({ blocked: false });
  }
}
