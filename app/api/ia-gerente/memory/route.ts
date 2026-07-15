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
    const type = searchParams.get('type');
    const category = searchParams.get('category');
    const limit = parseInt(searchParams.get('limit') ?? '50');

    const where: any = { companyId };
    if (type) where.type = type;
    if (category) where.category = category;

    // Filter out expired memories
    where.OR = [{ expiresAt: null }, { expiresAt: { gt: new Date() } }];

    const memories = await prisma.iAMemory.findMany({
      where,
      orderBy: [{ importance: 'desc' }, { createdAt: 'desc' }],
      take: limit,
    });

    return NextResponse.json({ memories });
  } catch (error: any) {
    console.error('Memory GET error:', error);
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
    const { type, category, content, metadata, importance, expiresAt } = body;

    if (!content) return NextResponse.json({ error: 'Conteúdo é obrigatório' }, { status: 400 });

    const memory = await prisma.iAMemory.create({
      data: {
        companyId,
        type: type ?? 'long',
        category: category ?? 'general',
        content,
        metadata: metadata ? JSON.stringify(metadata) : null,
        importance: importance ?? 5,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
    });

    return NextResponse.json({ memory });
  } catch (error: any) {
    console.error('Memory POST error:', error);
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
      await prisma.iAMemory.deleteMany({ where: { id, companyId } });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Memory DELETE error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
