export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    if (session.user.role === 'vendedor') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    const companyId = session.user.companyId;

    const accounts = await prisma.cashAccount.findMany({
      where: { companyId },
      include: { paymentMethods: { where: { isActive: true }, select: { id: true, name: true } } },
      orderBy: { name: 'asc' },
    });

    const totalBalance = accounts.reduce((s, a) => s + (a.isActive ? a.currentBalance : 0), 0);

    return NextResponse.json({ accounts: accounts ?? [], totalBalance });
  } catch (error: any) {
    console.error('GET /api/caixas error:', error);
    return NextResponse.json({ error: 'Erro ao buscar caixas' }, { status: 500 });
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

    const account = await prisma.cashAccount.create({
      data: {
        name: body.name,
        type: body.type ?? 'dinheiro',
        initialBalance: parseFloat(body.initialBalance) || 0,
        currentBalance: parseFloat(body.initialBalance) || 0,
        notes: body.notes ?? null,
        companyId,
      },
    });

    return NextResponse.json(account, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/caixas error:', error);
    return NextResponse.json({ error: 'Erro ao criar caixa' }, { status: 500 });
  }
}
