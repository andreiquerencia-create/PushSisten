export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

// GET — list sessions for the company (with filters)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    if (session.user.role === 'vendedor') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    const companyId = session.user.companyId;
    const url = new URL(request.url);
    const cashAccountId = url.searchParams.get('cashAccountId') ?? '';
    const status = url.searchParams.get('status') ?? '';
    const page = parseInt(url.searchParams.get('page') ?? '1');
    const limit = 15;

    const where: any = { companyId };
    if (cashAccountId) where.cashAccountId = cashAccountId;
    if (status) where.status = status;

    const [sessions, total] = await Promise.all([
      prisma.cashSession.findMany({
        where,
        include: { cashAccount: { select: { name: true, type: true } } },
        orderBy: { openedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.cashSession.count({ where }),
    ]);

    // Check if there's an open session
    const openSession = await prisma.cashSession.findFirst({ where: { companyId, status: 'aberto' }, include: { cashAccount: { select: { name: true, type: true } } } });

    return NextResponse.json({ sessions, total, totalPages: Math.ceil(total / limit), openSession });
  } catch (error: any) {
    console.error('GET /api/caixas/sessoes error:', error);
    return NextResponse.json({ error: 'Erro ao buscar sessões' }, { status: 500 });
  }
}

// POST — open a new cash session
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    if (session.user.role === 'vendedor') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    const companyId = session.user.companyId;
    const body = await request.json();
    const { cashAccountId, openingBalance } = body;

    if (!cashAccountId) return NextResponse.json({ error: 'Selecione um caixa' }, { status: 400 });

    // Check for existing open session on this company
    const existing = await prisma.cashSession.findFirst({ where: { companyId, status: 'aberto' } });
    if (existing) return NextResponse.json({ error: 'Já existe um caixa aberto. Feche-o antes de abrir outro.' }, { status: 400 });

    const account = await prisma.cashAccount.findFirst({ where: { id: cashAccountId, companyId } });
    if (!account) return NextResponse.json({ error: 'Caixa não encontrado' }, { status: 404 });

    const bal = parseFloat(openingBalance) || account.currentBalance;

    const cashSession = await prisma.cashSession.create({
      data: {
        cashAccountId,
        companyId,
        openingBalance: bal,
        openedById: (session.user as any)?.id ?? null,
        openedByName: session.user?.name ?? null,
      },
      include: { cashAccount: { select: { name: true, type: true } } },
    });

    return NextResponse.json(cashSession, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/caixas/sessoes error:', error);
    return NextResponse.json({ error: 'Erro ao abrir caixa' }, { status: 500 });
  }
}
