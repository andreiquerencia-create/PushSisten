export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { recordAPPayment } from '@/lib/ledger-engine';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const companyId = session.user.companyId;
    const record = await prisma.accountPayable.findFirst({
      where: { id: params.id, companyId },
      include: { supplier: { select: { id: true, name: true } }, stockEntry: { select: { id: true, entryNumber: true } }, accountPlan: { select: { id: true, name: true, code: true } } },
    });
    if (!record) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 });
    return NextResponse.json(record);
  } catch (error) {
    console.error('GET /api/contas-pagar/[id] error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const companyId = session.user.companyId;
    const body = await request.json();

    // Fetch current record for audit
    const current = await prisma.accountPayable.findFirst({ where: { id: params.id, companyId } });
    if (!current) return NextResponse.json({ error: 'Conta não encontrada' }, { status: 404 });

    // === Payment flow: partial or full ===
    if (body.payAction) {
      const payAmount = parseFloat(body.payAmount) || 0;
      if (payAmount <= 0) return NextResponse.json({ error: 'Valor de pagamento inválido' }, { status: 400 });

      const cashAccountIds: string[] = [];
      const paymentSources: { cashAccountId: string; amount: number }[] = body.paymentSources || [];

      // If single source (legacy)
      if (paymentSources.length === 0 && body.cashAccountId) {
        paymentSources.push({ cashAccountId: body.cashAccountId, amount: payAmount });
      }

      if (paymentSources.length === 0) {
        return NextResponse.json({ error: 'Selecione pelo menos um caixa para pagamento' }, { status: 400 });
      }

      const totalFromSources = paymentSources.reduce((s, p) => s + (parseFloat(String(p.amount)) || 0), 0);
      if (Math.abs(totalFromSources - payAmount) > 0.01) {
        return NextResponse.json({ error: 'Soma dos valores dos caixas não confere com o valor do pagamento' }, { status: 400 });
      }

      const isPartial = payAmount < current.amount;
      const isFullPay = !isPartial;

      // Transaction: debit each cash account, create movements, update AP
      await prisma.$transaction(async (tx) => {
        for (const src of paymentSources) {
          const amt = parseFloat(String(src.amount)) || 0;
          if (amt <= 0) continue;
          const account = await tx.cashAccount.findFirst({ where: { id: src.cashAccountId, companyId } });
          if (!account) throw new Error(`Caixa ${src.cashAccountId} não encontrado`);
          const balanceBefore = account.currentBalance;
          const balanceAfter = balanceBefore - amt;

          await tx.cashMovement.create({
            data: {
              cashAccountId: src.cashAccountId,
              companyId,
              type: 'saida',
              amount: amt,
              balanceBefore,
              balanceAfter,
              origin: 'pagamento_conta',
              description: `Pagamento: ${current.description}${isPartial ? ' (parcial)' : ''}`,
              reference: `AP#${current.id.slice(-6)}`,
              userId: (session.user as any)?.id ?? null,
              userName: session.user?.name ?? null,
            },
          });

          await tx.cashAccount.update({
            where: { id: src.cashAccountId },
            data: { currentBalance: balanceAfter },
          });

          cashAccountIds.push(src.cashAccountId);
        }

        // Create financial record (inherit accountPlanId from AP)
        await tx.financialRecord.create({
          data: {
            description: `Pagamento: ${current.description}${isPartial ? ' (parcial)' : ''}`,
            amount: payAmount,
            type: 'saida',
            paymentMethod: 'pagamento_conta',
            companyId,
            reference: `AP#${current.id.slice(-6)}`,
            accountPlanId: current.accountPlanId || null,
          },
        });

        if (isPartial) {
          // Partial: reduce amount, keep pending
          const remaining = current.amount - payAmount;
          await tx.accountPayable.update({
            where: { id: params.id },
            data: {
              amount: remaining,
              notes: `${current.notes || ''}\n[Pgto parcial R$ ${payAmount.toFixed(2)} em ${new Date().toLocaleDateString('pt-BR')} por ${session.user?.name || 'Sistema'}]`.trim(),
            },
          });
        } else {
          // Full pay
          await tx.accountPayable.update({
            where: { id: params.id },
            data: { status: 'pago', paidDate: new Date() },
          });
        }

        // Activity log
        await tx.activityLog.create({
          data: {
            action: 'payment_ap',
            description: `Pagamento ${isPartial ? 'parcial' : 'total'} de R$ ${payAmount.toFixed(2)} - ${current.description}`,
            entityType: 'accountPayable',
            entityId: params.id,
            companyId,
            userId: (session.user as any)?.id ?? null,
            userName: session.user?.name ?? null,
            metadata: { payAmount, isPartial, sources: paymentSources },
          },
        });
      });

      const updated = await prisma.accountPayable.findUnique({ where: { id: params.id } });

      // ═══ LEDGER: registrar pagamento no ledger ═══
      try {
        await recordAPPayment({
          companyId,
          payableId: params.id,
          amount: payAmount,
          paymentDate: new Date(),
          expenseAccountPlanId: current.accountPlanId || undefined,
        });
      } catch (ledgerErr) {
        console.error('[LEDGER] Erro ao registrar pagamento AP:', ledgerErr);
      }

      return NextResponse.json({ success: true, record: updated });
    }

    // === Edit flow ===
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
      if (body.status === 'pago') data.paidDate = new Date();
      changes.push(`status: ${current.status} → ${body.status}`);
    }
    if (body.supplierId !== undefined && body.supplierId !== current.supplierId) {
      data.supplierId = body.supplierId || null;
      changes.push(`fornecedor alterado`);
    }
    if (body.notes !== undefined && body.notes !== current.notes) {
      data.notes = body.notes;
    }
    if (body.accountPlanId !== undefined && body.accountPlanId !== current.accountPlanId) {
      data.accountPlanId = body.accountPlanId || null;
      changes.push('plano de contas alterado');
    }

    const record = await prisma.accountPayable.update({ where: { id: params.id }, data });

    // Audit log if there were meaningful changes
    if (changes.length > 0) {
      await prisma.activityLog.create({
        data: {
          action: 'edit_ap',
          description: `Conta a pagar editada: ${changes.join(', ')}`,
          entityType: 'accountPayable',
          entityId: params.id,
          companyId,
          userId: (session.user as any)?.id ?? null,
          userName: session.user?.name ?? null,
          metadata: { changes, previous: { amount: current.amount, dueDate: current.dueDate, description: current.description, status: current.status } },
        },
      }).catch(() => {}); // non-blocking
    }

    return NextResponse.json(record);
  } catch (error) {
    console.error('PUT /api/contas-pagar error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const companyId = session.user.companyId;
    const current = await prisma.accountPayable.findFirst({ where: { id: params.id, companyId } });
    if (!current) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 });
    if (current.status === 'pago') return NextResponse.json({ error: 'Não é possível excluir conta já paga' }, { status: 400 });
    await prisma.accountPayable.delete({ where: { id: params.id } });
    await prisma.activityLog.create({
      data: {
        action: 'delete_ap',
        description: `Conta a pagar excluída: ${current.description} - R$ ${current.amount.toFixed(2)}`,
        entityType: 'accountPayable',
        entityId: params.id,
        companyId,
        userId: (session.user as any)?.id ?? null,
        userName: session.user?.name ?? null,
      },
    }).catch(() => {});
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/contas-pagar error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
