export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

// GET — Retorna o progresso de todos os módulos do usuário
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const userId = (session.user as any).id;

    const progress = await prisma.academyProgress.findMany({
      where: { userId },
      orderBy: { moduleId: 'asc' },
    });

    return NextResponse.json({ progress });
  } catch (error: any) {
    console.error('GET /api/academy-progress error:', error?.message);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

// PATCH — Atualiza progresso de um módulo específico
export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const userId = (session.user as any).id;
    const body = await req.json();
    const { moduleId, currentStep, totalSteps, status } = body;

    if (!moduleId) {
      return NextResponse.json({ error: 'moduleId obrigatório' }, { status: 400 });
    }

    const updateData: any = {};
    if (currentStep !== undefined) updateData.currentStep = currentStep;
    if (totalSteps !== undefined) updateData.totalSteps = totalSteps;
    if (status !== undefined) updateData.status = status;

    if (status === 'in_progress' && !updateData.startedAt) {
      updateData.startedAt = new Date();
    }
    if (status === 'completed') {
      updateData.completedAt = new Date();
    }
    updateData.lastStepAt = new Date();

    const progress = await prisma.academyProgress.upsert({
      where: { userId_moduleId: { userId, moduleId } },
      create: {
        userId,
        moduleId,
        currentStep: currentStep ?? 0,
        totalSteps: totalSteps ?? 0,
        status: status ?? 'in_progress',
        startedAt: new Date(),
        lastStepAt: new Date(),
      },
      update: updateData,
    });

    return NextResponse.json({ progress });
  } catch (error: any) {
    console.error('PATCH /api/academy-progress error:', error?.message);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
