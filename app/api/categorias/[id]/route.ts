export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const companyId = session.user.companyId;
    const existing = await prisma.category.findFirst({ where: { id: params?.id, companyId } });
    if (!existing) return NextResponse.json({ error: 'Categoria não encontrada' }, { status: 404 });
    const body = await request.json();
    const category = await prisma.category.update({
      where: { id: params?.id },
      data: { name: body?.name, description: body?.description ?? null },
    });
    return NextResponse.json(category);
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: 'Erro ao atualizar' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const companyId = session.user.companyId;
    const existing = await prisma.category.findFirst({ where: { id: params?.id, companyId } });
    if (!existing) return NextResponse.json({ error: 'Categoria não encontrada' }, { status: 404 });
    await prisma.category.update({ where: { id: params?.id }, data: { isActive: false } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: 'Erro ao excluir' }, { status: 500 });
  }
}
