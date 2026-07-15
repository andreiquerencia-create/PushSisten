export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const companyId = session.user.companyId;
    const record = await prisma.financialRecord.findFirst({
      where: { id: params.id, companyId },
      include: { category: { select: { id: true, name: true } }, accountPlan: { select: { id: true, name: true, code: true } } },
    });
    if (!record) return NextResponse.json({ error: 'Registro não encontrado' }, { status: 404 });
    return NextResponse.json(record);
  } catch (error: any) {
    console.error('GET /api/financeiro/[id] error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    if (session.user.role === 'vendedor') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    const companyId = session.user.companyId;
    const body = await request.json();

    const current = await prisma.financialRecord.findFirst({ where: { id: params.id, companyId } });
    if (!current) return NextResponse.json({ error: 'Registro não encontrado' }, { status: 404 });

    // Se vinculado a CashMovement, bloquear edição de valor e tipo (só permite descrição, data, plano de contas)
    const hasCashLink = !!current.cashMovementId;
    if (hasCashLink) {
      const newAmount = body.amount != null ? parseFloat(body.amount) : current.amount;
      const newType = body.type ?? current.type;
      if (Math.abs(newAmount - current.amount) > 0.01) {
        return NextResponse.json({ error: 'Não é possível alterar o valor de um lançamento já vinculado ao caixa. Use estorno para corrigir.' }, { status: 400 });
      }
      if (newType !== current.type) {
        return NextResponse.json({ error: 'Não é possível alterar o tipo de um lançamento já vinculado ao caixa. Use estorno para corrigir.' }, { status: 400 });
      }
    }

    const updated = await prisma.financialRecord.update({
      where: { id: params.id },
      data: {
        description: body.description ?? current.description,
        amount: hasCashLink ? current.amount : (body.amount != null ? parseFloat(body.amount) : current.amount),
        type: hasCashLink ? current.type : (body.type ?? current.type),
        paymentMethod: body.paymentMethod ?? current.paymentMethod,
        categoryId: body.categoryId || null,
        accountPlanId: body.accountPlanId || null,
        date: body.date ? new Date(body.date) : current.date,
      },
      include: { category: { select: { name: true } }, accountPlan: { select: { id: true, name: true, code: true } } },
    });

    // Audit log
    try {
      await prisma.activityLog.create({
        data: {
          action: 'financeiro_update',
          description: `Registro financeiro editado: ${current.description}`,
          entityType: 'FinancialRecord',
          entityId: params.id,
          metadata: { before: { description: current.description, amount: current.amount, type: current.type }, after: { description: updated.description, amount: updated.amount, type: updated.type }, hasCashLink },
          userId: (session.user as any)?.id ?? null,
          userName: session.user?.name ?? 'Sistema',
          companyId,
        },
      });
    } catch (e) { /* audit log optional */ }

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('PUT /api/financeiro/[id] error:', error);
    return NextResponse.json({ error: 'Erro ao atualizar registro' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    if (session.user.role === 'vendedor') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    const companyId = session.user.companyId;
    const userId = (session.user as any)?.id ?? null;
    const userName = session.user?.name ?? 'Sistema';

    const current = await prisma.financialRecord.findFirst({ where: { id: params.id, companyId } });
    if (!current) return NextResponse.json({ error: 'Registro não encontrado' }, { status: 404 });

    // Se vinculado a CashMovement + CashAccount, reverter saldo atomicamente
    if (current.cashMovementId && current.cashAccountId) {
      await prisma.$transaction(async (tx) => {
        const account = await tx.cashAccount.findFirst({ where: { id: current.cashAccountId!, companyId } });
        if (!account) throw new Error('Caixa vinculado não encontrado');

        const isEntry = current.type === 'entrada';
        const balanceBefore = account.currentBalance;
        // Reverter: entrada vira sub, saída vira add
        const balanceAfter = isEntry ? balanceBefore - current.amount : balanceBefore + current.amount;

        // Criar CM de reversão para audit trail
        await tx.cashMovement.create({
          data: {
            cashAccountId: current.cashAccountId!,
            companyId,
            type: isEntry ? 'saida' : 'entrada',
            amount: current.amount,
            balanceBefore,
            balanceAfter,
            origin: 'exclusao_financeiro',
            description: `Exclusão de lançamento: ${current.description}`,
            userId, userName,
            notes: `Reversão por exclusão do FR#${current.id.slice(-6)}`,
          },
        });

        await tx.cashAccount.update({ where: { id: current.cashAccountId! }, data: { currentBalance: balanceAfter } });
        await tx.financialRecord.delete({ where: { id: params.id } });

        await tx.activityLog.create({
          data: {
            action: 'financeiro_delete',
            description: `Registro financeiro excluído (+ reversão de caixa): ${current.description} - R$ ${current.amount.toFixed(2)}`,
            entityType: 'FinancialRecord',
            entityId: params.id,
            metadata: { deleted: { description: current.description, amount: current.amount, type: current.type, cashAccountId: current.cashAccountId, cashMovementId: current.cashMovementId } },
            companyId, userId, userName,
          },
        });
      });
    } else {
      // Sem link de caixa (registro legado), excluir diretamente
      await prisma.financialRecord.delete({ where: { id: params.id } });

      try {
        await prisma.activityLog.create({
          data: {
            action: 'financeiro_delete',
            description: `Registro financeiro excluído: ${current.description} - R$ ${current.amount.toFixed(2)}`,
            entityType: 'FinancialRecord',
            entityId: params.id,
            metadata: { deleted: { description: current.description, amount: current.amount, type: current.type } },
            companyId, userId, userName,
          },
        });
      } catch (e) { /* audit log optional */ }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('DELETE /api/financeiro/[id] error:', error);
    return NextResponse.json({ error: error?.message ?? 'Erro ao excluir registro' }, { status: 500 });
  }
}
