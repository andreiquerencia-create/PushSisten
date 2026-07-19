export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * Endpoint leve para checagem de onboarding feita pelo middleware.
 * Chamado internamente — rápido, query mínima.
 * Retorna { needsOnboarding: true/false }
 */
export async function GET(request: NextRequest) {
  try {
    // Apenas chamadas internas do middleware
    const isMiddleware = request.headers.get('x-middleware-check') === '1';
    if (!isMiddleware) {
      console.log('[ONBOARDING-CHECK] Non-middleware call, returning false');
      return NextResponse.json({ needsOnboarding: false });
    }

    const userId = request.nextUrl.searchParams.get('userId');
    if (!userId) {
      console.log('[ONBOARDING-CHECK] No userId provided, returning false');
      return NextResponse.json({ needsOnboarding: false });
    }

    console.log('[ONBOARDING-CHECK] Checking userId:', userId);

    const progress = await prisma.onboardingProgress.findUnique({
      where: { userId },
      select: { completed: true, abandoned: true, currentStep: true },
    });

    console.log('[ONBOARDING-CHECK] DB result:', JSON.stringify(progress));

    // Caso 1: nunca iniciou → precisa de onboarding
    if (!progress) {
      console.log('[ONBOARDING-CHECK] No progress found → needsOnboarding: true');
      return NextResponse.json({ needsOnboarding: true });
    }

    // Caso 2: iniciou mas não completou e não abandonou → precisa continuar
    if (!progress.completed && !progress.abandoned) {
      console.log('[ONBOARDING-CHECK] In progress (not completed, not abandoned) → needsOnboarding: true');
      return NextResponse.json({ needsOnboarding: true });
    }

    // Caso 3: completou ou abandonou → não redirecionar
    console.log('[ONBOARDING-CHECK] Completed or abandoned → needsOnboarding: false');
    return NextResponse.json({ needsOnboarding: false });
  } catch (error: any) {
    console.error('[ONBOARDING-CHECK] ERROR:', error?.message);
    // Fail-open: não redireciona em caso de erro
    return NextResponse.json({ needsOnboarding: false });
  }
}
