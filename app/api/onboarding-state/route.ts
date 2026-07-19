export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const userId = (session.user as any).id;

    const state = await prisma.onboardingState.findUnique({
      where: { userId },
    });

    return NextResponse.json({ state });
  } catch (error: any) {
    console.error('GET /api/onboarding-state error:', error?.message);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const userId = (session.user as any).id;
    const body = await req.json();

    const {
      phase,
      currentStep,
      status,
      completedSteps,
      skippedSteps,
      metadata,
      completedAt,
      pausedAt,
    } = body;

    const updateData: any = { lastStepAt: new Date() };
    if (phase !== undefined) updateData.phase = phase;
    if (currentStep !== undefined) updateData.currentStep = currentStep;
    if (status !== undefined) updateData.status = status;
    if (completedSteps !== undefined) updateData.completedSteps = completedSteps;
    if (skippedSteps !== undefined) updateData.skippedSteps = skippedSteps;
    if (metadata !== undefined) updateData.metadata = metadata;
    if (completedAt !== undefined) updateData.completedAt = completedAt;
    if (pausedAt !== undefined) updateData.pausedAt = pausedAt;

    const state = await prisma.onboardingState.upsert({
      where: { userId },
      create: {
        userId,
        ...updateData,
        startedAt: new Date(),
      },
      update: updateData,
    });

    return NextResponse.json({ state });
  } catch (error: any) {
    console.error('PATCH /api/onboarding-state error:', error?.message);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
