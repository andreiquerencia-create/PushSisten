export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const companyId = session.user.companyId;
    const customer = await prisma.customer.findFirst({
      where: { id: params?.id, companyId },
      include: {
        sales: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: { items: { include: { product: { select: { name: true } } } } },
        },
      },
    });
    if (!customer) return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 });
    return NextResponse.json(customer);
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: 'Erro' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const companyId = session.user.companyId;
    const existing = await prisma.customer.findFirst({ where: { id: params?.id, companyId } });
    if (!existing) return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 });
    const body = await request.json();
    const customer = await prisma.customer.update({
      where: { id: params?.id },
      data: {
        name: body?.name,
        email: body?.email ?? null,
        phone: body?.phone ?? null,
        whatsapp: body?.whatsapp ?? null,
        city: body?.city ?? null,
        state: body?.state ?? null,
        type: body?.type ?? 'varejo',
        tags: body?.tags ?? [],
      },
    });
    return NextResponse.json(customer);
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
    const existing = await prisma.customer.findFirst({ where: { id: params?.id, companyId } });
    if (!existing) return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 });
    await prisma.customer.update({ where: { id: params?.id }, data: { isActive: false } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: 'Erro ao excluir' }, { status: 500 });
  }
}
