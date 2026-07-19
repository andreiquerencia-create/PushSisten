export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { getCategoriesForSegments } from '@/lib/onboarding/categories-map';

/**
 * POST /api/onboarding-state/setup
 *
 * Processa a Fase 0 do onboarding:
 * - Atualiza nome da empresa
 * - Cria categorias baseadas nos segmentos escolhidos
 * - Salva metadados do onboarding
 * - Inicia o estado do onboarding (step 1)
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const userId = (session.user as any).id;
    const companyId = (session.user as any).companyId;
    const body = await req.json();
    const { storeName, segments, controlMethod } = body;

    if (!storeName || !segments || !controlMethod) {
      return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 });
    }

    // 1. Atualizar nome da empresa
    if (companyId) {
      await prisma.company.update({
        where: { id: companyId },
        data: { name: storeName },
      });
    }

    // 2. Criar categorias baseadas nos segmentos
    if (companyId) {
      const categoryNames = getCategoriesForSegments(segments);

      // Buscar categorias já existentes para não duplicar
      const existing = await prisma.category.findMany({
        where: { companyId },
        select: { name: true },
      });
      const existingNames = new Set(existing.map(c => c.name.toLowerCase()));

      // Criar apenas as que não existem
      const toCreate = categoryNames.filter(name => !existingNames.has(name.toLowerCase()));

      if (toCreate.length > 0) {
        await prisma.category.createMany({
          data: toCreate.map(name => ({
            name,
            companyId,
          })),
          skipDuplicates: true,
        });
      }
    }

    // 3. Criar/atualizar estado do onboarding
    const state = await prisma.onboardingState.upsert({
      where: { userId },
      create: {
        userId,
        phase: 'activation',
        currentStep: 1, // Pula o welcome (já feito)
        status: 'active',
        completedSteps: ['welcome'],
        skippedSteps: [],
        metadata: { storeName, segments, controlMethod },
        startedAt: new Date(),
        lastStepAt: new Date(),
      },
      update: {
        phase: 'activation',
        currentStep: 1,
        status: 'active',
        completedSteps: ['welcome'],
        skippedSteps: [],
        metadata: { storeName, segments, controlMethod },
        lastStepAt: new Date(),
      },
    });

    return NextResponse.json({
      state,
      categoriesCreated: getCategoriesForSegments(segments).length,
    });
  } catch (error: any) {
    console.error('POST /api/onboarding-state/setup error:', error?.message);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
