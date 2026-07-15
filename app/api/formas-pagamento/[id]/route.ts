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
    const existing = await prisma.paymentMethod.findFirst({ where: { id: params?.id, companyId } });
    if (!existing) return NextResponse.json({ error: 'Forma de pagamento não encontrada' }, { status: 404 });
    const body = await request.json();
    const data: any = {};
    if (body?.name !== undefined) data.name = body.name;
    if (body?.type !== undefined) data.type = body.type;
    if (body?.cashAccountId !== undefined) data.cashAccountId = body.cashAccountId;
    if (body?.defaultDays !== undefined) data.defaultDays = parseInt(body.defaultDays) || 0;
    if (body?.feePercent !== undefined) data.feePercent = parseFloat(body.feePercent) || 0;
    if (body?.feeFixed !== undefined) data.feeFixed = parseFloat(body.feeFixed) || 0;
    if (body?.businessDays !== undefined) data.businessDays = body.businessDays;
    if (body?.isActive !== undefined) data.isActive = body.isActive;

    const method = await prisma.paymentMethod.update({
      where: { id: params?.id },
      data,
      include: { cashAccount: { select: { id: true, name: true, type: true } } },
    });
    return NextResponse.json(method);
  } catch (error: any) {
    console.error('PUT /api/formas-pagamento error:', error);
    return NextResponse.json({ error: 'Erro ao atualizar' }, { status: 500 });
  }
}
