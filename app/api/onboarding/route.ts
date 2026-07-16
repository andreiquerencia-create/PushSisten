export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

// GET — Retorna o estado atual do onboarding do usuário logado
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const userId = (session.user as any).id;

    const progress = await prisma.onboardingProgress.findUnique({
      where: { userId },
    });

    if (!progress) {
      // Usuário nunca iniciou onboarding — retorna estado "não iniciado"
      return NextResponse.json({ status: 'not_started', progress: null });
    }

    return NextResponse.json({ status: 'active', progress });
  } catch (error: any) {
    console.error('GET /api/onboarding error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

// POST — Inicia o onboarding ou atualiza etapa
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const userId = (session.user as any).id;
    const body = await req.json();
    const { action, data } = body;

    switch (action) {
      case 'start': {
        // Inicia o onboarding (cria registro se não existir)
        const progress = await prisma.onboardingProgress.upsert({
          where: { userId },
          create: {
            userId,
            currentStep: 'profile',
            startedAt: new Date(),
            lastAccessAt: new Date(),
          },
          update: {
            currentStep: 'profile',
            abandoned: false,
            abandonedAt: null,
            lastAccessAt: new Date(),
          },
        });
        return NextResponse.json({ progress });
      }

      case 'update_profile': {
        // Salva dados do perfil da loja (etapa 1)
        const { storeName, storeType, currentControl } = data || {};
        const progress = await prisma.onboardingProgress.update({
          where: { userId },
          data: {
            storeName,
            storeType,
            currentControl,
            profileCompleted: true,
            currentStep: 'product',
            lastAccessAt: new Date(),
          },
        });
        return NextResponse.json({ progress });
      }

      case 'product_created': {
        const progress = await prisma.onboardingProgress.update({
          where: { userId },
          data: {
            productCreated: true,
            currentStep: 'customer',
            lastAccessAt: new Date(),
          },
        });
        return NextResponse.json({ progress });
      }

      case 'customer_created': {
        const progress = await prisma.onboardingProgress.update({
          where: { userId },
          data: {
            customerCreated: true,
            currentStep: 'sale',
            lastAccessAt: new Date(),
          },
        });
        return NextResponse.json({ progress });
      }

      case 'sale_completed': {
        const progress = await prisma.onboardingProgress.update({
          where: { userId },
          data: {
            saleCompleted: true,
            currentStep: 'dashboard',
            lastAccessAt: new Date(),
          },
        });
        return NextResponse.json({ progress });
      }

      case 'dashboard_viewed': {
        const progress = await prisma.onboardingProgress.update({
          where: { userId },
          data: {
            dashboardViewed: true,
            currentStep: 'next_steps',
            lastAccessAt: new Date(),
          },
        });
        return NextResponse.json({ progress });
      }

      case 'complete': {
        const existing = await prisma.onboardingProgress.findUnique({ where: { userId } });
        const timeSpent = existing?.startedAt
          ? Math.floor((Date.now() - existing.startedAt.getTime()) / 1000)
          : 0;

        const progress = await prisma.onboardingProgress.update({
          where: { userId },
          data: {
            completed: true,
            completedAt: new Date(),
            currentStep: 'completed',
            timeSpent,
            lastAccessAt: new Date(),
          },
        });
        return NextResponse.json({ progress });
      }

      case 'abandon': {
        const progress = await prisma.onboardingProgress.update({
          where: { userId },
          data: {
            abandoned: true,
            abandonedAt: new Date(),
            lastAccessAt: new Date(),
          },
        });
        return NextResponse.json({ progress });
      }

      case 'resume': {
        const progress = await prisma.onboardingProgress.update({
          where: { userId },
          data: {
            abandoned: false,
            abandonedAt: null,
            lastAccessAt: new Date(),
          },
        });
        return NextResponse.json({ progress });
      }

      default:
        return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('POST /api/onboarding error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
