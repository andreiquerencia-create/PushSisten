export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const companyId = session.user.companyId;
    if (!companyId) return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 400 });

    // Apenas preferências de categoria (lojista liga/desliga). NÃO executa nada.
    // Campos legados runCount/lastRun e o relacionamento AutomationLog não são
    // mais expostos — telemetria oficial vive em AutomationAction + ActivityLog.
    const automations = await prisma.automation.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        description: true,
        category: true,
        isActive: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ automations });
  } catch (error: any) {
    console.error('Automations GET error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const companyId = session.user.companyId;
    if (!companyId) return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 400 });

    const body = await request.json();
    const { name, description, category, trigger, actions } = body;

    if (!name || !trigger || !actions) {
      return NextResponse.json({ error: 'Nome, gatilho e ações são obrigatórios' }, { status: 400 });
    }

    const automation = await prisma.automation.create({
      data: {
        companyId,
        name,
        description: description ?? null,
        category: category ?? 'general',
        trigger: typeof trigger === 'string' ? trigger : JSON.stringify(trigger),
        actions: typeof actions === 'string' ? actions : JSON.stringify(actions),
      },
    });

    return NextResponse.json({ automation });
  } catch (error: any) {
    console.error('Automations POST error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const companyId = session.user.companyId;
    if (!companyId) return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 400 });

    const body = await request.json();
    const { id, name, description, category, trigger, actions, isActive } = body;

    if (!id) return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 });

    const data: any = {};
    if (name !== undefined) data.name = name;
    if (description !== undefined) data.description = description;
    if (category !== undefined) data.category = category;
    if (trigger !== undefined) data.trigger = typeof trigger === 'string' ? trigger : JSON.stringify(trigger);
    if (actions !== undefined) data.actions = typeof actions === 'string' ? actions : JSON.stringify(actions);
    if (isActive !== undefined) data.isActive = isActive;

    await prisma.automation.updateMany({
      where: { id, companyId },
      data,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Automations PUT error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const companyId = session.user.companyId;
    if (!companyId) return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 400 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (id) {
      await prisma.automation.deleteMany({ where: { id, companyId } });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Automations DELETE error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
