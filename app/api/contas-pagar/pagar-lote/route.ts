export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

// POST: Pay multiple AP entries at once
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const companyId = session.user.companyId;
    const body = await request.json();

    const { ids, cashAccountId } = body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'Selecione pelo menos uma conta' }, { status: 400 });
    }
    if (!cashAccountId) {
      return NextResponse.json({ error: 'Selecione o caixa para pagamento' }, { status: 400 });
    }

    // Fetch all selected AP
    const accounts = await prisma.accountPayable.findMany({
      where: { id: { in: ids }, companyId, status: { in: ['pendente', 'vencido'] } },
    });

    if (accounts.length === 0) {
      return NextResponse.json({ error: 'Nenhuma conta pendente encontrada' }, { status: 400 });
    }

    const totalAmount = accounts.reduce((sum, a) => sum + a.amount, 0);

    // Check cash balance
    const cashAccount = await prisma.cashAccount.findFirst({
      where: { id: cashAccountId, companyId },
    });
    if (!cashAccount) {
      return NextResponse.json({ error: 'Caixa não encontrado' }, { status: 404 });
    }

    // Execute in transaction
    await prisma.$transaction(async (tx) => {
      let runningBalance = cashAccount.currentBalance;

      for (const ap of accounts) {
        const balanceBefore = runningBalance;
        const balanceAfter = balanceBefore - ap.amount;

        await tx.cashMovement.create({
          data: {
            cashAccountId,
            companyId,
            type: 'saida',
            amount: ap.amount,
            balanceBefore,
            balanceAfter,
            origin: 'pagamento_conta',
            description: `Pagamento em lote: ${ap.description}`,
            reference: `AP#${ap.id.slice(-6)}`,
            userId: (session.user as any)?.id ?? null,
            userName: session.user?.name ?? null,
          },
        });

        await tx.financialRecord.create({
          data: {
            description: `Pagamento em lote: ${ap.description}`,
            amount: ap.amount,
            type: 'saida',
            paymentMethod: 'pagamento_conta',
            companyId,
            reference: `AP#${ap.id.slice(-6)}`,
          },
        });

        await tx.accountPayable.update({
          where: { id: ap.id },
          data: { status: 'pago', paidDate: new Date() },
        });

        runningBalance = balanceAfter;
      }

      // Update cash account balance
      await tx.cashAccount.update({
        where: { id: cashAccountId },
        data: { currentBalance: runningBalance },
      });

      // Activity log
      await tx.activityLog.create({
        data: {
          action: 'bulk_payment_ap',
          description: `Pagamento em lote de ${accounts.length} conta(s) - Total: R$ ${totalAmount.toFixed(2)}`,
          entityType: 'accountPayable',
          entityId: accounts[0]?.id,
          companyId,
          userId: (session.user as any)?.id ?? null,
          userName: session.user?.name ?? null,
          metadata: { count: accounts.length, totalAmount, cashAccountId, ids },
        },
      });
    });

    return NextResponse.json({
      success: true,
      count: accounts.length,
      totalPaid: totalAmount,
    });
  } catch (error) {
    console.error('POST /api/contas-pagar/pagar-lote error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
