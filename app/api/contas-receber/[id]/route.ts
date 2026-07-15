export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { recordARReceipt } from '@/lib/ledger-engine';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const companyId = session.user.companyId;
    const record = await prisma.accountReceivable.findFirst({
      where: { id: params.id, companyId },
      include: {
        customer: { select: { id: true, name: true } },
        accountPlan: { select: { id: true, name: true, code: true } },
      },
    });
    if (!record) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 });
    return NextResponse.json(record);
  } catch (error) {
    console.error('GET /api/contas-receber/[id] error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const companyId = session.user.companyId;
    const body = await request.json();
    const userId = (session.user as any)?.id ?? null;
    const userName = session.user?.name ?? null;

    const current = await prisma.accountReceivable.findFirst({ where: { id: params.id, companyId } });
    if (!current) return NextResponse.json({ error: 'Conta não encontrada' }, { status: 404 });

    // === RECEBIMENTO: status muda para 'recebido' → criar FR + CM + atualizar saldo ===
    if (body.status === 'recebido' && current.status !== 'recebido') {
      if (!body.cashAccountId) {
        return NextResponse.json({ error: 'Selecione um caixa para registrar o recebimento' }, { status: 400 });
      }

      const receiveAmount = parseFloat(body.receiveAmount) || current.amount;

      const result = await prisma.$transaction(async (tx) => {
        const account = await tx.cashAccount.findFirst({ where: { id: body.cashAccountId, companyId } });
        if (!account) throw new Error('Caixa não encontrado');

        const balanceBefore = account.currentBalance;
        const balanceAfter = balanceBefore + receiveAmount;

        // 1. CashMovement (entrada)
        const movement = await tx.cashMovement.create({
          data: {
            cashAccountId: body.cashAccountId,
            companyId,
            type: 'entrada',
            amount: receiveAmount,
            balanceBefore,
            balanceAfter,
            origin: 'recebimento_conta',
            description: `Recebimento: ${current.description}`,
            reference: `AR#${current.id.slice(-6)}`,
            userId, userName,
          },
        });

        // 2. FinancialRecord (entrada, vinculado ao CM)
        // Para ARs oriundas de vendas, pode existir um FR legado (criado antes da estabilização).
        // Se existir, atualizar com o link de caixa em vez de criar duplicata.
        let existingLegacyFR: any = null;
        if (current.saleId) {
          existingLegacyFR = await tx.financialRecord.findFirst({
            where: {
              reference: current.saleId,
              type: 'entrada',
              cashMovementId: null,
              companyId,
            },
            orderBy: { createdAt: 'asc' },
          });
        }

        // Determine accountPlanId: inherit from AR, fallback to 1.01 'Receita de Vendas'
        let frAccountPlanId: string | null = current.accountPlanId || null;
        if (!frAccountPlanId) {
          const receitaPlan = await tx.accountPlan.findFirst({
            where: { companyId, code: '1.1', isActive: true },
          });
          frAccountPlanId = receitaPlan?.id || null;
        }

        if (existingLegacyFR) {
          // Atualizar FR legado com link de caixa (evita dupla contagem)
          await tx.financialRecord.update({
            where: { id: existingLegacyFR.id },
            data: {
              cashAccountId: body.cashAccountId,
              cashMovementId: movement.id,
              description: `Recebimento: ${current.description}`,
              amount: receiveAmount,
              accountPlanId: frAccountPlanId,
              date: new Date(),
            },
          });
        } else {
          // Sem FR legado — criar novo (normal para vendas novas e ARs manuais)
          await tx.financialRecord.create({
            data: {
              description: `Recebimento: ${current.description}`,
              amount: receiveAmount,
              type: 'entrada',
              paymentMethod: 'recebimento_conta',
              cashAccountId: body.cashAccountId,
              cashMovementId: movement.id,
              accountPlanId: frAccountPlanId,
              companyId,
              reference: current.saleId || `AR#${current.id.slice(-6)}`,
              date: new Date(),
            },
          });
        }

        // 3. Atualizar saldo
        await tx.cashAccount.update({
          where: { id: body.cashAccountId },
          data: { currentBalance: balanceAfter },
        });

        // 4. Atualizar AR como recebido
        const updated = await tx.accountReceivable.update({
          where: { id: params.id },
          data: { status: 'recebido', receivedDate: new Date() },
        });

        // 5. Audit
        await tx.activityLog.create({
          data: {
            action: 'receive_ar',
            description: `Recebimento de R$ ${receiveAmount.toFixed(2)} - ${current.description} no caixa ${account.name}`,
            entityType: 'accountReceivable',
            entityId: params.id,
            companyId, userId, userName,
            metadata: { receiveAmount, cashAccountId: body.cashAccountId, cashAccountName: account.name },
          },
        });

        return updated;
      });

      // ═══ LEDGER: registrar recebimento no ledger ═══
      try {
        await recordARReceipt({
          companyId,
          receivableId: params.id,
          amount: parseFloat(body.receiveAmount) || current.amount,
          receiptDate: new Date(),
        });
      } catch (ledgerErr) {
        console.error('[LEDGER] Erro ao registrar recebimento AR:', ledgerErr);
      }

      return NextResponse.json({ success: true, record: result });
    }

    // === EDIÇÃO NORMAL (não é recebimento) ===
    const changes: string[] = [];
    const data: any = {};

    if (body.description !== undefined && body.description !== current.description) {
      changes.push(`descrição: "${current.description}" → "${body.description}"`);
      data.description = body.description;
    }
    if (body.amount !== undefined) {
      const newAmt = parseFloat(body.amount);
      if (!isNaN(newAmt) && Math.abs(newAmt - current.amount) > 0.001) {
        changes.push(`valor: R$ ${current.amount.toFixed(2)} → R$ ${newAmt.toFixed(2)}`);
        data.amount = newAmt;
      }
    }
    if (body.dueDate !== undefined) {
      const newDate = new Date(body.dueDate);
      if (newDate.getTime() !== current.dueDate.getTime()) {
        changes.push(`vencimento: ${current.dueDate.toLocaleDateString('pt-BR')} → ${newDate.toLocaleDateString('pt-BR')}`);
        data.dueDate = newDate;
      }
    }
    if (body.status !== undefined && body.status !== current.status) {
      data.status = body.status;
      changes.push(`status: ${current.status} → ${body.status}`);
    }
    if (body.customerId !== undefined && body.customerId !== current.customerId) {
      data.customerId = body.customerId || null;
      changes.push('cliente alterado');
    }
    if (body.accountPlanId !== undefined && body.accountPlanId !== current.accountPlanId) {
      data.accountPlanId = body.accountPlanId || null;
      changes.push('plano de contas alterado');
    }
    if (body.notes !== undefined && body.notes !== current.notes) {
      data.notes = body.notes;
    }

    const record = await prisma.accountReceivable.update({ where: { id: params.id }, data });

    if (changes.length > 0) {
      await prisma.activityLog.create({
        data: {
          action: 'edit_ar',
          description: `Conta a receber editada: ${changes.join(', ')}`,
          entityType: 'accountReceivable',
          entityId: params.id,
          companyId, userId, userName,
          metadata: { changes, previous: { amount: current.amount, dueDate: current.dueDate, description: current.description, status: current.status } },
        },
      }).catch(() => {});
    }

    return NextResponse.json(record);
  } catch (error: any) {
    console.error('PUT /api/contas-receber error:', error);
    return NextResponse.json({ error: error?.message ?? 'Erro interno' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const companyId = session.user.companyId;
    const current = await prisma.accountReceivable.findFirst({ where: { id: params.id, companyId } });
    if (!current) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 });
    if (current.status === 'recebido') return NextResponse.json({ error: 'Não é possível excluir conta já recebida' }, { status: 400 });
    await prisma.accountReceivable.delete({ where: { id: params.id } });
    await prisma.activityLog.create({
      data: {
        action: 'delete_ar',
        description: `Conta a receber excluída: ${current.description} - R$ ${current.amount.toFixed(2)}`,
        entityType: 'accountReceivable',
        entityId: params.id,
        companyId,
        userId: (session.user as any)?.id ?? null,
        userName: session.user?.name ?? null,
      },
    }).catch(() => {});
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/contas-receber error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
