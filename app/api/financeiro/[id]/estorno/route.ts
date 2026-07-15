export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

// POST /api/financeiro/[id]/estorno — create an inverse financial record (reversal/chargeback)
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const role = session.user.role;
    if (role !== 'administrador' && role !== 'socio')
      return NextResponse.json({ error: 'Apenas admin/sócio pode realizar estornos' }, { status: 403 });
    const companyId = session.user.companyId;
    const userId = (session.user as any)?.id ?? null;
    const userName = session.user?.name ?? 'Sistema';

    const body = await request.json().catch(() => ({}));
    const reason = body?.reason || '';

    // Find the original record
    const original = await prisma.financialRecord.findFirst({
      where: { id: params.id, companyId },
      include: { category: { select: { id: true, name: true } }, accountPlan: { select: { id: true, name: true, code: true } } },
    });
    if (!original) return NextResponse.json({ error: 'Registro não encontrado' }, { status: 404 });

    // Check if already reversed
    const existingReversal = await prisma.financialRecord.findFirst({
      where: { reference: `ESTORNO#${original.id}`, companyId },
    });
    if (existingReversal) {
      return NextResponse.json({ error: 'Este registro já foi estornado' }, { status: 409 });
    }

    // Create inverse: entrada → saida, saida → entrada
    const inverseType = original.type === 'entrada' ? 'saida' : 'entrada';
    const hasCashLink = !!(original.cashAccountId);

    // Transação atômica: FR reverso + CM reverso (se vinculado) + saldo
    const reversal = await prisma.$transaction(async (tx) => {
      let reversalMovementId: string | null = null;
      let cashAccountName = '';

      // Se o original estava vinculado a um caixa, reverter o saldo
      if (hasCashLink && original.cashAccountId) {
        const account = await tx.cashAccount.findFirst({ where: { id: original.cashAccountId, companyId } });
        if (!account) throw new Error('Caixa vinculado não encontrado');
        cashAccountName = account.name;

        const balanceBefore = account.currentBalance;
        // Estorno reverte: entrada original → saída no caixa, saída original → entrada no caixa
        const isOriginalEntry = original.type === 'entrada';
        const balanceAfter = isOriginalEntry ? balanceBefore - original.amount : balanceBefore + original.amount;

        const reversalMovement = await tx.cashMovement.create({
          data: {
            cashAccountId: original.cashAccountId,
            companyId,
            type: isOriginalEntry ? 'saida' : 'entrada',
            amount: original.amount,
            balanceBefore,
            balanceAfter,
            origin: 'estorno_financeiro',
            description: `Estorno: ${original.description}${reason ? ' | ' + reason : ''}`,
            reference: `ESTORNO#${original.id.slice(-6)}`,
            userId, userName,
          },
        });
        reversalMovementId = reversalMovement.id;

        await tx.cashAccount.update({
          where: { id: original.cashAccountId },
          data: { currentBalance: balanceAfter },
        });
      }

      // Criar FR reverso (vinculado ao CM reverso se existir)
      const reversalRecord = await tx.financialRecord.create({
        data: {
          description: `Estorno: ${original.description}${reason ? ' | Motivo: ' + reason : ''}`,
          amount: original.amount,
          type: inverseType,
          paymentMethod: original.paymentMethod,
          categoryId: original.categoryId,
          accountPlanId: original.accountPlanId,
          cashAccountId: original.cashAccountId,
          cashMovementId: reversalMovementId,
          companyId,
          reference: `ESTORNO#${original.id}`,
          date: new Date(),
        },
      });

      // Audit log
      await tx.activityLog.create({
        data: {
          action: 'financeiro_estorno',
          description: `Estorno do registro "${original.description}" - R$ ${original.amount.toFixed(2)} (${original.type} → ${inverseType})${hasCashLink ? ` | Caixa: ${cashAccountName}` : ''}`,
          entityType: 'FinancialRecord',
          entityId: original.id,
          metadata: {
            originalId: original.id,
            originalDescription: original.description,
            originalType: original.type,
            originalAmount: original.amount,
            reversalType: inverseType,
            reversalRecordId: reversalRecord.id,
            cashAccountId: original.cashAccountId,
            cashMovementId: reversalMovementId,
            hasCashLink,
            reason,
          },
          companyId, userId, userName,
        },
      });

      return reversalRecord;
    });

    return NextResponse.json(reversal, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/financeiro/[id]/estorno error:', error);
    return NextResponse.json({ error: error?.message ?? 'Erro ao realizar estorno' }, { status: 500 });
  }
}
