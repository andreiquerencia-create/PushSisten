export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

// POST — close a cash session
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    if (session.user.role === 'vendedor') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    const companyId = session.user.companyId;
    const sessionId = params?.id;

    const body = await request.json();
    const { informedBalance, closingNotes } = body;

    if (informedBalance === undefined || informedBalance === null || informedBalance === '') {
      return NextResponse.json({ error: 'Informe o valor conferido no caixa' }, { status: 400 });
    }

    const cashSession = await prisma.cashSession.findFirst({
      where: { id: sessionId, companyId, status: 'aberto' },
    });
    if (!cashSession) return NextResponse.json({ error: 'Sessão não encontrada ou já fechada' }, { status: 404 });

    // Get all movements during this session
    const movements = await prisma.cashMovement.findMany({
      where: { cashSessionId: sessionId },
    });

    // Calculate breakdown
    let totalEntries = 0, totalExits = 0, totalSangrias = 0, totalReforcos = 0;
    for (const m of movements) {
      if (m.type === 'entrada' || m.type === 'transferencia_entrada') totalEntries += m.amount;
      if (m.type === 'saida' || m.type === 'transferencia_saida') totalExits += m.amount;
      if (m.origin === 'sangria') totalSangrias += m.amount;
      if (m.origin === 'reforco') totalReforcos += m.amount;
    }

    // Get sales breakdown from sale_payments during session
    const salePayments = await prisma.salePayment.findMany({
      where: {
        cashAccountId: cashSession.cashAccountId,
        companyId,
        createdAt: { gte: cashSession.openedAt },
      },
      include: { paymentMethod: { select: { type: true } } },
    });

    let totalSales = 0, totalCash = 0, totalPix = 0, totalCard = 0;
    for (const sp of salePayments) {
      totalSales += sp.amount;
      const t = sp.paymentMethod?.type ?? '';
      if (t === 'dinheiro') totalCash += sp.amount;
      else if (t === 'pix') totalPix += sp.amount;
      else if (t.includes('cartao') || t.includes('credito') || t.includes('debito')) totalCard += sp.amount;
    }

    const expectedBalance = cashSession.openingBalance + totalEntries - totalExits;
    const informed = parseFloat(String(informedBalance));
    const difference = +(informed - expectedBalance).toFixed(2);

    // Get current account balance
    const account = await prisma.cashAccount.findUnique({ where: { id: cashSession.cashAccountId } });

    const closedSession = await prisma.cashSession.update({
      where: { id: sessionId },
      data: {
        status: 'fechado',
        closingBalance: account?.currentBalance ?? expectedBalance,
        expectedBalance,
        informedBalance: informed,
        difference,
        closedById: (session.user as any)?.id ?? null,
        closedByName: session.user?.name ?? null,
        closedAt: new Date(),
        closingNotes: closingNotes ?? null,
        totalSales,
        totalCash,
        totalPix,
        totalCard,
        totalEntries,
        totalExits,
        totalSangrias,
        totalReforcos,
      },
      include: { cashAccount: { select: { name: true, type: true } } },
    });

    return NextResponse.json(closedSession);
  } catch (error: any) {
    console.error('POST /api/caixas/sessoes/[id]/fechar error:', error);
    return NextResponse.json({ error: 'Erro ao fechar caixa' }, { status: 500 });
  }
}
