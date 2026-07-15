export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

// PUT /api/caixas/transferencias/[id] — edit a transfer (amount, origin, destination)
// [id] = any one of the two linked CashMovement IDs in the transfer pair
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const role = session.user.role;
    if (role !== 'administrador' && role !== 'socio')
      return NextResponse.json({ error: 'Apenas admin/sócio pode editar transferências' }, { status: 403 });
    const companyId = session.user.companyId;
    const body = await request.json();

    const { amount, fromAccountId, toAccountId, notes } = body;
    if (!amount && !fromAccountId && !toAccountId && notes === undefined) {
      return NextResponse.json({ error: 'Nenhum campo para atualizar' }, { status: 400 });
    }

    // 1. Find the movement and its linked pair
    const mov = await prisma.cashMovement.findFirst({
      where: { id: params.id, companyId, origin: 'transferencia' },
    });
    if (!mov) return NextResponse.json({ error: 'Movimentação de transferência não encontrada' }, { status: 404 });
    if (!mov.linkedMovementId)
      return NextResponse.json({ error: 'Movimentação sem par vinculado' }, { status: 400 });

    const linked = await prisma.cashMovement.findFirst({
      where: { id: mov.linkedMovementId, companyId },
    });
    if (!linked) return NextResponse.json({ error: 'Par vinculado não encontrado' }, { status: 404 });

    // Determine which is exit (saida) and which is entry (entrada)
    const exitMov = mov.type === 'transferencia_saida' ? mov : linked;
    const entryMov = mov.type === 'transferencia_entrada' ? mov : linked;

    const oldAmount = exitMov.amount;
    const oldFromId = exitMov.cashAccountId;
    const oldToId = entryMov.cashAccountId;

    const newAmount = amount ? Math.abs(parseFloat(amount)) : oldAmount;
    const newFromId = fromAccountId || oldFromId;
    const newToId = toAccountId || oldToId;

    if (newAmount <= 0) return NextResponse.json({ error: 'Valor deve ser positivo' }, { status: 400 });
    if (newFromId === newToId) return NextResponse.json({ error: 'Origem e destino não podem ser iguais' }, { status: 400 });

    const userName = session.user?.name ?? null;
    const userId = (session.user as any)?.id ?? null;

    const result = await prisma.$transaction(async (tx) => {
      // ====== STEP 1: REVERSE ORIGINAL TRANSFER ======
      // Fetch current balances of the OLD accounts
      const oldFromAccount = await tx.cashAccount.findUnique({ where: { id: oldFromId } });
      const oldToAccount = await tx.cashAccount.findUnique({ where: { id: oldToId } });
      if (!oldFromAccount || !oldToAccount) throw new Error('Caixas originais não encontrados');

      // Reverse: add back to source (was subtracted), subtract from dest (was added)
      const reversedFromBalance = oldFromAccount.currentBalance + oldAmount;
      const reversedToBalance = oldToAccount.currentBalance - oldAmount;

      await tx.cashAccount.update({ where: { id: oldFromId }, data: { currentBalance: reversedFromBalance } });
      await tx.cashAccount.update({ where: { id: oldToId }, data: { currentBalance: reversedToBalance } });

      // ====== STEP 2: APPLY NEW TRANSFER ======
      // Fetch balances of new accounts (could be same accounts, now with reversed balance)
      const newFromAccount = await tx.cashAccount.findUnique({ where: { id: newFromId } });
      const newToAccount = await tx.cashAccount.findUnique({ where: { id: newToId } });
      if (!newFromAccount || !newToAccount) throw new Error('Novos caixas não encontrados');

      const newFromBefore = newFromAccount.currentBalance;
      const newFromAfter = newFromBefore - newAmount;
      const newToBefore = newToAccount.currentBalance;
      const newToAfter = newToBefore + newAmount;

      // Update the existing movement records in-place
      const updatedExit = await tx.cashMovement.update({
        where: { id: exitMov.id },
        data: {
          cashAccountId: newFromId,
          amount: newAmount,
          balanceBefore: newFromBefore,
          balanceAfter: newFromAfter,
          description: `Transferência para ${newToAccount.name}`,
          notes: notes !== undefined ? (notes || null) : exitMov.notes,
        },
      });

      const updatedEntry = await tx.cashMovement.update({
        where: { id: entryMov.id },
        data: {
          cashAccountId: newToId,
          amount: newAmount,
          balanceBefore: newToBefore,
          balanceAfter: newToAfter,
          description: `Transferência de ${newFromAccount.name}`,
          notes: notes !== undefined ? (notes || null) : entryMov.notes,
        },
      });

      // Update balances of new accounts
      await tx.cashAccount.update({ where: { id: newFromId }, data: { currentBalance: newFromAfter } });
      await tx.cashAccount.update({ where: { id: newToId }, data: { currentBalance: newToAfter } });

      // ====== STEP 3: AUDIT LOG ======
      await tx.activityLog.create({
        data: {
          action: 'transferencia_update',
          description: `Transferência editada: ${oldFromAccount.name} → ${oldToAccount.name} (R$ ${oldAmount.toFixed(2)}) ⇒ ${newFromAccount.name} → ${newToAccount.name} (R$ ${newAmount.toFixed(2)})`,
          entityType: 'CashMovement',
          entityId: exitMov.id,
          metadata: {
            before: {
              amount: oldAmount,
              fromAccountId: oldFromId,
              fromAccountName: oldFromAccount.name,
              toAccountId: oldToId,
              toAccountName: oldToAccount.name,
            },
            after: {
              amount: newAmount,
              fromAccountId: newFromId,
              fromAccountName: newFromAccount.name,
              toAccountId: newToId,
              toAccountName: newToAccount.name,
            },
            changedFields: [
              ...(oldAmount !== newAmount ? ['amount'] : []),
              ...(oldFromId !== newFromId ? ['fromAccountId'] : []),
              ...(oldToId !== newToId ? ['toAccountId'] : []),
              ...(notes !== undefined && notes !== exitMov.notes ? ['notes'] : []),
            ],
          },
          companyId,
          userId,
          userName,
        },
      });

      return { exitMov: updatedExit, entryMov: updatedEntry };
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('PUT /api/caixas/transferencias/[id] error:', error);
    return NextResponse.json({ error: error?.message ?? 'Erro ao editar transferência' }, { status: 500 });
  }
}
