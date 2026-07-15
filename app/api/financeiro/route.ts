export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { getCashBalance } from '@/lib/financial-engine';
import { validateFinancialEntry } from '@/lib/data-guards';
import { recordManualEntry } from '@/lib/ledger-engine';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const companyId = session.user.companyId;
    const url = new URL(request.url);
    const type = url.searchParams.get('type') ?? '';
    const page = parseInt(url.searchParams.get('page') ?? '1');
    const limit = parseInt(url.searchParams.get('limit') ?? '30');
    const unclassified = url.searchParams.get('unclassified') === 'true';
    const accountPlanId = url.searchParams.get('accountPlanId') ?? '';

    const where: any = { companyId };
    if (type) where.type = type;
    if (unclassified) where.accountPlanId = null;
    else if (accountPlanId) where.accountPlanId = accountPlanId;

    const [records, total, totalEntradas, totalSaidas, cashBalance] = await Promise.all([
      prisma.financialRecord.findMany({
        where,
        include: { category: { select: { name: true } }, accountPlan: { select: { id: true, name: true, code: true } } },
        orderBy: { date: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.financialRecord.count({ where }),
      prisma.financialRecord.aggregate({
        where: { companyId, type: 'entrada' },
        _sum: { amount: true },
      }),
      prisma.financialRecord.aggregate({
        where: { companyId, type: 'saida' },
        _sum: { amount: true },
      }),
      getCashBalance(companyId), // CORRIGIDO: saldo vem de CashAccount
    ]);

    const categories = await prisma.financialCategory.findMany({ where: { companyId } });

    return NextResponse.json({
      records: records ?? [],
      total,
      pages: Math.ceil(total / limit),
      summary: {
        entradas: totalEntradas._sum?.amount ?? 0,
        saidas: totalSaidas._sum?.amount ?? 0,
        saldo: cashBalance.saldo, // CORRIGIDO: fonte única = CashAccount.currentBalance
      },
      categories: categories ?? [],
    });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: 'Erro ao buscar financeiro' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const companyId = session.user.companyId;
    const body = await request.json();

    // === DATA GUARD ===
    const guard = validateFinancialEntry(body);
    if (!guard.valid) return NextResponse.json({ error: guard.errors.join(' | ') }, { status: 400 });

    if (!body?.description || !body?.amount || !body?.type) {
      return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 });
    }

    const parsedAmount = Math.abs(parseFloat(body.amount) || 0);
    if (parsedAmount <= 0) return NextResponse.json({ error: 'Valor deve ser positivo' }, { status: 400 });

    // Lançamento manual EXIGE um caixa vinculado (sincronia financeiro ↔ caixa)
    if (!body.cashAccountId) {
      return NextResponse.json({ error: 'Selecione um caixa para este lançamento' }, { status: 400 });
    }

    // Lançamento manual EXIGE classificação por plano de contas (para DRE e análises)
    if (!body.accountPlanId) {
      return NextResponse.json({ error: 'Selecione um plano de contas para classificar este lançamento' }, { status: 400 });
    }

    const userId = (session.user as any)?.id ?? null;
    const userName = session.user?.name ?? 'Sistema';

    // Transação atômica: FinancialRecord + CashMovement + saldo
    const result = await prisma.$transaction(async (tx) => {
      const account = await tx.cashAccount.findFirst({ where: { id: body.cashAccountId, companyId } });
      if (!account) throw new Error('Caixa não encontrado');

      const balanceBefore = account.currentBalance;
      const isEntry = body.type === 'entrada';
      const balanceAfter = isEntry ? balanceBefore + parsedAmount : balanceBefore - parsedAmount;

      // 1. Criar CashMovement
      const movement = await tx.cashMovement.create({
        data: {
          cashAccountId: body.cashAccountId,
          companyId,
          type: isEntry ? 'entrada' : 'saida',
          amount: parsedAmount,
          balanceBefore,
          balanceAfter,
          origin: isEntry ? 'entrada_financeira' : 'saida_financeira',
          description: body.description,
          userId,
          userName,
        },
      });

      // 2. Criar FinancialRecord vinculado ao CashMovement
      const record = await tx.financialRecord.create({
        data: {
          description: body.description,
          amount: parsedAmount,
          type: body.type,
          paymentMethod: body?.paymentMethod ?? null,
          categoryId: body?.categoryId || null,
          accountPlanId: body?.accountPlanId || null,
          cashAccountId: body.cashAccountId,
          cashMovementId: movement.id,
          companyId,
          date: body?.date ? new Date(body.date) : new Date(),
        },
        include: { category: { select: { name: true } }, accountPlan: { select: { id: true, name: true, code: true } } },
      });

      // 3. Atualizar saldo do caixa
      await tx.cashAccount.update({
        where: { id: body.cashAccountId },
        data: { currentBalance: balanceAfter },
      });

      // 4. Audit log
      await tx.activityLog.create({
        data: {
          action: 'financeiro_create',
          description: `Lançamento financeiro: ${body.description} - R$ ${parsedAmount.toFixed(2)} (${body.type}) no caixa ${account.name}`,
          entityType: 'FinancialRecord',
          entityId: record.id,
          metadata: { amount: parsedAmount, type: body.type, cashAccountId: body.cashAccountId, cashAccountName: account.name, cashMovementId: movement.id },
          companyId, userId, userName,
        },
      });

      return record;
    });

    // ═══ LEDGER: registrar lançamento manual no ledger ═══
    try {
      await recordManualEntry({
        companyId,
        financialRecordId: result.id,
        amount: parsedAmount,
        entryDate: body?.date ? new Date(body.date) : new Date(),
        type: body.type as 'entrada' | 'saida',
        accountPlanId: body.accountPlanId,
        description: body.description,
      });
    } catch (ledgerErr) {
      console.error('[LEDGER] Erro ao registrar lançamento manual:', ledgerErr);
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/financeiro error:', error);
    return NextResponse.json({ error: error?.message ?? 'Erro ao criar registro' }, { status: 500 });
  }
}
