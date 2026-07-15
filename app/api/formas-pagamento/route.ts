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
    const url = new URL(request.url);
    const activeOnly = url.searchParams.get('active') === 'true';

    const where: any = { companyId };
    if (activeOnly) where.isActive = true;

    const methods = await prisma.paymentMethod.findMany({
      where,
      include: { cashAccount: { select: { id: true, name: true, type: true } } },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ methods: methods ?? [] });
  } catch (error: any) {
    console.error('GET /api/formas-pagamento error:', error);
    return NextResponse.json({ error: 'Erro ao buscar formas de pagamento' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    if (session.user.role !== 'administrador' && session.user.role !== 'socio') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    const companyId = session.user.companyId;
    const body = await request.json();

    if (!body?.name) return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 });
    if (!body?.cashAccountId) return NextResponse.json({ error: 'Caixa/conta é obrigatório' }, { status: 400 });

    const method = await prisma.paymentMethod.create({
      data: {
        name: body.name,
        type: body.type ?? 'dinheiro',
        cashAccountId: body.cashAccountId,
        defaultDays: parseInt(body.defaultDays) || 0,
        feePercent: parseFloat(body.feePercent) || 0,
        feeFixed: parseFloat(body.feeFixed) || 0,
        businessDays: body.businessDays ?? false,
        companyId,
      },
      include: { cashAccount: { select: { id: true, name: true, type: true } } },
    });

    return NextResponse.json(method, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/formas-pagamento error:', error);
    return NextResponse.json({ error: 'Erro ao criar forma de pagamento' }, { status: 500 });
  }
}
