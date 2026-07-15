export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { validateTransfer } from '@/lib/data-guards';

// POST /api/caixas/transferencias — transfer between two cash accounts
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    if (session.user.role === 'vendedor') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    const companyId = session.user.companyId;
    const body = await request.json();

    const { fromAccountId, toAccountId, amount, notes } = body;

    // === DATA GUARD ===
    const guard = validateTransfer({ amount, originId: fromAccountId, destinationId: toAccountId });
    if (!guard.valid) return NextResponse.json({ error: guard.errors.join(' | ') }, { status: 400 });

    if (!fromAccountId || !toAccountId || !amount) {
      return NextResponse.json({ error: 'Campos obrigatórios: caixa origem, caixa destino, valor' }, { status: 400 });
    }
    if (fromAccountId === toAccountId) {
      return NextResponse.json({ error: 'Origem e destino não podem ser o mesmo caixa' }, { status: 400 });
    }

    const parsedAmount = Math.abs(parseFloat(amount));
    if (parsedAmount <= 0) return NextResponse.json({ error: 'Valor deve ser positivo' }, { status: 400 });

    const [fromAccount, toAccount] = await Promise.all([
      prisma.cashAccount.findFirst({ where: { id: fromAccountId, companyId } }),
      prisma.cashAccount.findFirst({ where: { id: toAccountId, companyId } }),
    ]);

    if (!fromAccount || !toAccount) {
      return NextResponse.json({ error: 'Caixa não encontrado' }, { status: 404 });
    }

    const fromBefore = fromAccount.currentBalance;
    const fromAfter = fromBefore - parsedAmount;
    const toBefore = toAccount.currentBalance;
    const toAfter = toBefore + parsedAmount;

    const userName = session.user?.name ?? null;
    const userId = (session.user as any)?.id ?? null;

    const result = await prisma.$transaction(async (tx) => {
      // Create exit movement on source
      const exitMov = await tx.cashMovement.create({
        data: {
          cashAccountId: fromAccountId,
          companyId,
          type: 'transferencia_saida',
          amount: parsedAmount,
          balanceBefore: fromBefore,
          balanceAfter: fromAfter,
          origin: 'transferencia',
          description: `Transferência para ${toAccount.name}`,
          notes: notes ?? null,
          userId,
          userName,
        },
      });

      // Create entry movement on destination
      const entryMov = await tx.cashMovement.create({
        data: {
          cashAccountId: toAccountId,
          companyId,
          type: 'transferencia_entrada',
          amount: parsedAmount,
          balanceBefore: toBefore,
          balanceAfter: toAfter,
          origin: 'transferencia',
          description: `Transferência de ${fromAccount.name}`,
          notes: notes ?? null,
          userId,
          userName,
          linkedMovementId: exitMov.id,
        },
      });

      // Link the exit to the entry
      await tx.cashMovement.update({
        where: { id: exitMov.id },
        data: { linkedMovementId: entryMov.id },
      });

      // Update balances
      await tx.cashAccount.update({ where: { id: fromAccountId }, data: { currentBalance: fromAfter } });
      await tx.cashAccount.update({ where: { id: toAccountId }, data: { currentBalance: toAfter } });

      // Audit log
      await tx.activityLog.create({
        data: {
          action: 'transferencia_create',
          description: `Transferência: R$ ${parsedAmount.toFixed(2)} de ${fromAccount.name} → ${toAccount.name}`,
          entityType: 'CashMovement',
          entityId: exitMov.id,
          metadata: { amount: parsedAmount, fromAccountId, fromAccountName: fromAccount.name, toAccountId, toAccountName: toAccount.name },
          companyId, userId, userName,
        },
      });

      return { exitMov, entryMov };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/caixas/transferencias error:', error);
    return NextResponse.json({ error: 'Erro ao realizar transferência' }, { status: 500 });
  }
}

// DELETE /api/caixas/transferencias?movementId=xxx — reverse a transfer
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const role = session.user.role;
    if (role !== 'administrador' && role !== 'socio') return NextResponse.json({ error: 'Apenas admin/sócio pode estornar transferências' }, { status: 403 });
    const companyId = session.user.companyId;
    const url = new URL(request.url);
    const movementId = url.searchParams.get('movementId');
    if (!movementId) return NextResponse.json({ error: 'movementId é obrigatório' }, { status: 400 });

    // Find the movement + linked
    const mov = await prisma.cashMovement.findFirst({ where: { id: movementId, companyId, origin: 'transferencia' } });
    if (!mov) return NextResponse.json({ error: 'Movimentação não encontrada' }, { status: 404 });
    if (!mov.linkedMovementId) return NextResponse.json({ error: 'Movimentação sem par vinculado' }, { status: 400 });

    const linked = await prisma.cashMovement.findFirst({ where: { id: mov.linkedMovementId, companyId } });
    if (!linked) return NextResponse.json({ error: 'Par vinculado não encontrado' }, { status: 404 });

    // Determine which is exit and which is entry
    const exitMov = mov.type === 'transferencia_saida' ? mov : linked;
    const entryMov = mov.type === 'transferencia_entrada' ? mov : linked;

    const userName = session.user?.name ?? null;
    const userId = (session.user as any)?.id ?? null;

    await prisma.$transaction(async (tx) => {
      // Fetch current balances
      const fromAccount = await tx.cashAccount.findUnique({ where: { id: exitMov.cashAccountId } });
      const toAccount = await tx.cashAccount.findUnique({ where: { id: entryMov.cashAccountId } });
      if (!fromAccount || !toAccount) throw new Error('Caixas não encontrados');

      const fromBefore = fromAccount.currentBalance;
      const toBefore = toAccount.currentBalance;

      // Reverse: add back to source, subtract from destination
      await tx.cashMovement.create({
        data: {
          cashAccountId: exitMov.cashAccountId,
          companyId,
          type: 'entrada',
          amount: exitMov.amount,
          balanceBefore: fromBefore,
          balanceAfter: fromBefore + exitMov.amount,
          origin: 'estorno_transferencia',
          description: `Estorno de transferência para ${toAccount.name}`,
          userId, userName,
          notes: `Estorno ref. movimentação ${exitMov.id.slice(-6)}`,
        },
      });
      await tx.cashMovement.create({
        data: {
          cashAccountId: entryMov.cashAccountId,
          companyId,
          type: 'saida',
          amount: entryMov.amount,
          balanceBefore: toBefore,
          balanceAfter: toBefore - entryMov.amount,
          origin: 'estorno_transferencia',
          description: `Estorno de transferência de ${fromAccount.name}`,
          userId, userName,
          notes: `Estorno ref. movimentação ${entryMov.id.slice(-6)}`,
        },
      });

      await tx.cashAccount.update({ where: { id: exitMov.cashAccountId }, data: { currentBalance: fromBefore + exitMov.amount } });
      await tx.cashAccount.update({ where: { id: entryMov.cashAccountId }, data: { currentBalance: toBefore - entryMov.amount } });

      // Activity log
      await tx.activityLog.create({
        data: {
          action: 'reverse_transfer',
          description: `Estorno de transferência: R$ ${exitMov.amount.toFixed(2)} de ${fromAccount.name} → ${toAccount.name}`,
          entityType: 'cashMovement',
          entityId: movementId,
          companyId, userId, userName,
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('DELETE /api/caixas/transferencias error:', error);
    return NextResponse.json({ error: error?.message ?? 'Erro ao estornar transferência' }, { status: 500 });
  }
}
