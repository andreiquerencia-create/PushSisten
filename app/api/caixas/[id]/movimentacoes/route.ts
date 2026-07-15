export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

// GET /api/caixas/[id]/movimentacoes — history for a single cash account
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    if (session.user.role === 'vendedor') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    const companyId = session.user.companyId;
    const cashAccountId = params?.id;

    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') ?? '1');
    const limit = parseInt(url.searchParams.get('limit') ?? '30');
    const origin = url.searchParams.get('origin') ?? '';

    const where: any = { cashAccountId, companyId };
    if (origin) where.origin = origin;

    const [movements, total] = await Promise.all([
      prisma.cashMovement.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.cashMovement.count({ where }),
    ]);

    return NextResponse.json({ movements, total, totalPages: Math.ceil(total / limit) });
  } catch (error: any) {
    console.error('GET /api/caixas/[id]/movimentacoes error:', error);
    return NextResponse.json({ error: 'Erro ao buscar movimentações' }, { status: 500 });
  }
}

// POST /api/caixas/[id]/movimentacoes — manual entry/exit (cria CM + FR + saldo atomicamente)
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    if (session.user.role === 'vendedor') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    const companyId = session.user.companyId;
    const cashAccountId = params?.id;
    const body = await request.json();
    const userId = (session.user as any)?.id ?? null;
    const userName = session.user?.name ?? null;

    const { type, amount, description, notes, origin: reqOrigin, accountPlanId: reqAccountPlanId } = body;
    if (!type || !amount || !description) {
      return NextResponse.json({ error: 'Tipo, valor e descrição são obrigatórios' }, { status: 400 });
    }

    const parsedAmount = Math.abs(parseFloat(amount));
    if (parsedAmount <= 0) return NextResponse.json({ error: 'Valor deve ser positivo' }, { status: 400 });

    const origin = reqOrigin === 'ajuste_caixa' ? 'ajuste_caixa' : 'ajuste_manual';

    // Toda movimentação manual exige plano de contas
    // (para ajuste_caixa, default = 5.99 Ajuste de Caixa se não informado)
    let accountPlanId: string | null = reqAccountPlanId || null;
    if (!accountPlanId) {
      if (origin === 'ajuste_caixa') {
        let ajustePlan = await prisma.accountPlan.findFirst({
          where: { companyId, code: '5.99', isActive: true },
        });
        // Auto-cria 5.99 se ainda não existir nesta empresa (compatibilidade com seeds antigos)
        if (!ajustePlan) {
          // Buscar pai (código 5) se existir
          const parent5 = await prisma.accountPlan.findFirst({
            where: { companyId, code: '5', isActive: true },
          });
          try {
            ajustePlan = await prisma.accountPlan.create({
              data: {
                companyId,
                code: '5.99',
                name: 'Ajuste de Caixa',
                type: 'financeiro',
                dreGroup: 'Financeiro',
                showInDre: false,
                sortOrder: 599,
                isSystem: true,
                isActive: true,
                parentId: parent5?.id ?? null,
              },
            });
          } catch (e) {
            // Se houver conflito (race condition), tenta buscar de novo
            ajustePlan = await prisma.accountPlan.findFirst({
              where: { companyId, code: '5.99' },
            });
          }
        }
        accountPlanId = ajustePlan?.id || null;
      }
      if (!accountPlanId) {
        return NextResponse.json({ error: 'Selecione um plano de contas para classificar esta movimentação' }, { status: 400 });
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const account = await tx.cashAccount.findFirst({ where: { id: cashAccountId, companyId } });
      if (!account) throw new Error('Caixa não encontrado');

      const isEntry = type === 'entrada';
      const delta = isEntry ? parsedAmount : -parsedAmount;

      // FIX C2 (lost-update): atualização ATÔMICA do saldo PRIMEIRO.
      // O Postgres serializa o UPDATE via lock de linha, então transações
      // concorrentes não sobrescrevem o saldo umas das outras. O saldo final
      // (balanceAfter) é lido do valor já incrementado/decrementado, e o
      // balanceBefore é derivado dele — garantindo extrato consistente.
      const updatedAccount = await tx.cashAccount.update({
        where: { id: cashAccountId },
        data: { currentBalance: { increment: delta } },
      });
      const balanceAfter = updatedAccount.currentBalance;
      const balanceBefore = balanceAfter - delta;

      // 1. Criar CashMovement
      const movement = await tx.cashMovement.create({
        data: {
          cashAccountId,
          companyId,
          type: isEntry ? 'entrada' : 'saida',
          amount: parsedAmount,
          balanceBefore,
          balanceAfter,
          origin,
          description,
          notes: notes ?? null,
          userId, userName,
        },
      });

      // 2. Criar FinancialRecord vinculado (sincronia caixa ↔ financeiro)
      await tx.financialRecord.create({
        data: {
          description: `${origin === 'ajuste_caixa' ? 'Ajuste de caixa' : 'Movimentação manual'}: ${description}`,
          amount: parsedAmount,
          type: isEntry ? 'entrada' : 'saida',
          cashAccountId,
          cashMovementId: movement.id,
          accountPlanId,
          companyId,
          reference: `CM#${movement.id.slice(-6)}`,
          date: new Date(),
        },
      });

      // 3. Saldo já foi atualizado atomicamente acima (FIX C2)

      // 4. Audit log
      await tx.activityLog.create({
        data: {
          action: origin === 'ajuste_caixa' ? 'ajuste_caixa' : 'movimentacao_manual',
          description: `${origin === 'ajuste_caixa' ? 'Ajuste de caixa' : 'Movimentação manual'}: ${description} - R$ ${parsedAmount.toFixed(2)} (${type}) no caixa ${account.name}`,
          entityType: 'CashMovement',
          entityId: movement.id,
          metadata: { amount: parsedAmount, type, origin, cashAccountId, cashAccountName: account.name },
          companyId, userId, userName,
        },
      });

      return movement;
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/caixas/[id]/movimentacoes error:', error);
    return NextResponse.json({ error: error?.message ?? 'Erro ao criar movimentação' }, { status: 500 });
  }
}
