export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

// PUT — edit manual movement description/notes (amount cannot be changed)
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    if (session.user.role === 'vendedor') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    const companyId = session.user.companyId;
    const body = await request.json();

    const movement = await prisma.cashMovement.findFirst({ where: { id: params.id, companyId } });
    if (!movement) return NextResponse.json({ error: 'Movimentação não encontrada' }, { status: 404 });
    if (movement.origin !== 'ajuste_manual' && movement.origin !== 'ajuste_caixa') return NextResponse.json({ error: 'Apenas movimentações manuais/ajustes podem ser editadas' }, { status: 403 });

    const updated = await prisma.cashMovement.update({
      where: { id: params.id },
      data: {
        description: body.description ?? movement.description,
        notes: body.notes !== undefined ? (body.notes || null) : movement.notes,
      },
    });

    try {
      await prisma.activityLog.create({
        data: {
          action: 'movimentacao_update',
          description: `Movimentação editada: ${movement.description}`,
          entityType: 'CashMovement',
          entityId: params.id,
          metadata: { before: { description: movement.description, notes: movement.notes }, after: { description: updated.description, notes: updated.notes } },
          userId: (session.user as any)?.id ?? null,
          userName: session.user?.name ?? 'Sistema',
          companyId,
        },
      });
    } catch (e) { /* audit optional */ }

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('PUT /api/caixas/movimentacoes/[id] error:', error);
    return NextResponse.json({ error: 'Erro ao editar movimentação' }, { status: 500 });
  }
}

// DELETE — reverse a manual movement (restores balance)
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    if (session.user.role === 'vendedor') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    const companyId = session.user.companyId;

    const movement = await prisma.cashMovement.findFirst({ where: { id: params.id, companyId } });
    if (!movement) return NextResponse.json({ error: 'Movimentação não encontrada' }, { status: 404 });
    if (movement.origin !== 'ajuste_manual' && movement.origin !== 'ajuste_caixa') return NextResponse.json({ error: 'Apenas movimentações manuais/ajustes podem ser excluídas' }, { status: 403 });

    const account = await prisma.cashAccount.findFirst({ where: { id: movement.cashAccountId, companyId } });
    if (!account) return NextResponse.json({ error: 'Caixa não encontrado' }, { status: 404 });

    // Reverse the balance effect
    const isEntry = movement.type === 'entrada';
    const newBalance = isEntry ? account.currentBalance - movement.amount : account.currentBalance + movement.amount;

    await prisma.$transaction([
      prisma.cashMovement.delete({ where: { id: params.id } }),
      prisma.cashAccount.update({ where: { id: movement.cashAccountId }, data: { currentBalance: newBalance } }),
    ]);

    try {
      await prisma.activityLog.create({
        data: {
          action: 'movimentacao_delete',
          description: `Movimentação excluída: ${movement.description} - R$ ${movement.amount.toFixed(2)}`,
          entityType: 'CashMovement',
          entityId: params.id,
          metadata: { deleted: { description: movement.description, amount: movement.amount, type: movement.type, cashAccountId: movement.cashAccountId } },
          userId: (session.user as any)?.id ?? null,
          userName: session.user?.name ?? 'Sistema',
          companyId,
        },
      });
    } catch (e) { /* audit optional */ }

    return NextResponse.json({ success: true, newBalance });
  } catch (error: any) {
    console.error('DELETE /api/caixas/movimentacoes/[id] error:', error);
    return NextResponse.json({ error: 'Erro ao excluir movimentação' }, { status: 500 });
  }
}
