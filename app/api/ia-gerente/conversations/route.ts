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

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') ?? '20');
    const id = searchParams.get('id');

    if (id) {
      const conversation = await prisma.iAConversation.findFirst({
        where: { id, companyId },
      });
      return NextResponse.json({ conversation });
    }

    const conversations = await prisma.iAConversation.findMany({
      where: { companyId },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      select: {
        id: true,
        title: true,
        summary: true,
        tags: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ conversations });
  } catch (error: any) {
    console.error('Conversations GET error:', error);
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
    const { id, title, messages, summary, tags } = body;

    if (id) {
      // Update existing conversation
      const conversation = await prisma.iAConversation.update({
        where: { id },
        data: {
          messages: typeof messages === 'string' ? messages : JSON.stringify(messages ?? []),
          title: title ?? undefined,
          summary: summary ?? undefined,
          tags: tags ?? undefined,
        },
      });
      return NextResponse.json({ conversation });
    }

    // Create new conversation
    const conversation = await prisma.iAConversation.create({
      data: {
        companyId,
        userId: session.user.id,
        title: title ?? 'Nova conversa',
        messages: typeof messages === 'string' ? messages : JSON.stringify(messages ?? []),
        summary: summary ?? null,
        tags: tags ?? [],
      },
    });

    return NextResponse.json({ conversation });
  } catch (error: any) {
    console.error('Conversations POST error:', error);
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
      await prisma.iAConversation.deleteMany({ where: { id, companyId } });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Conversations DELETE error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
