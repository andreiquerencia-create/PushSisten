export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    if (session.user.role !== 'administrador' && session.user.role !== 'socio') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    const companyId = session.user.companyId;
    const existing = await prisma.cashAccount.findFirst({ where: { id: params?.id, companyId } });
    if (!existing) return NextResponse.json({ error: 'Caixa não encontrado' }, { status: 404 });
    const body = await request.json();
    const data: any = {};
    if (body?.name !== undefined) data.name = body.name;
    if (body?.type !== undefined) data.type = body.type;
    if (body?.notes !== undefined) data.notes = body.notes;
    if (body?.isActive !== undefined) data.isActive = body.isActive;
    if (body?.currentBalance !== undefined) data.currentBalance = parseFloat(body.currentBalance) || 0;

    const account = await prisma.cashAccount.update({
      where: { id: params?.id },
      data,
    });
    return NextResponse.json(account);
  } catch (error: any) {
    console.error('PUT /api/caixas error:', error);
    return NextResponse.json({ error: 'Erro ao atualizar caixa' }, { status: 500 });
  }
}
