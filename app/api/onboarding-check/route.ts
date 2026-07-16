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
      return NextResponse.json({ needsOnboarding: false });
    }

    const userId = request.nextUrl.searchParams.get('userId');
    if (!userId) {
      return NextResponse.json({ needsOnboarding: false });
    }

    const progress = await prisma.onboardingProgress.findUnique({
      where: { userId },
      select: { completed: true, abandoned: true },
    });

    // Caso 1: nunca iniciou → precisa de onboarding
    if (!progress) {
      return NextResponse.json({ needsOnboarding: true });
    }

    // Caso 2: iniciou mas não completou e não abandonou → precisa continuar
    if (!progress.completed && !progress.abandoned) {
      return NextResponse.json({ needsOnboarding: true });
    }

    // Caso 3: completou ou abandonou → não redirecionar
    return NextResponse.json({ needsOnboarding: false });
  } catch (error: any) {
    console.error('Onboarding check error:', error?.message);
    // Fail-open: não redireciona em caso de erro
    return NextResponse.json({ needsOnboarding: false });
  }
}
