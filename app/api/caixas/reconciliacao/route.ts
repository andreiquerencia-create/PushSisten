export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

// POST /api/caixas/reconciliacao — recalculate all caixa balances from movements
// Body: { fix?: boolean } — if fix=true, updates the balances; otherwise dry-run
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const role = session.user.role;
    if (role !== 'administrador' && role !== 'socio')
      return NextResponse.json({ error: 'Apenas admin/sócio pode reconciliar saldos' }, { status: 403 });
    const companyId = session.user.companyId;
    const body = await request.json().catch(() => ({}));
    const shouldFix = body?.fix === true;
    const userId = (session.user as any)?.id ?? null;
    const userName = session.user?.name ?? 'Sistema';

    // Fetch all active cash accounts for the company
    const accounts = await prisma.cashAccount.findMany({
      where: { companyId },
      orderBy: { name: 'asc' },
    });

    const results: Array<{
      accountId: string;
      accountName: string;
      initialBalance: number;
      currentBalance: number;
      calculatedBalance: number;
      difference: number;
      movementCount: number;
      fixed: boolean;
    }> = [];

    for (const acc of accounts) {
      // Get all movements for this account, sorted chronologically
      const movements = await prisma.cashMovement.findMany({
        where: { cashAccountId: acc.id, companyId },
        orderBy: { createdAt: 'asc' },
      });

      // Calculate expected balance from initial + all movements
      let calculatedBalance = acc.initialBalance;
      for (const m of movements) {
        if (m.type === 'entrada' || m.type === 'transferencia_entrada') {
          calculatedBalance += m.amount;
        } else {
          calculatedBalance -= m.amount;
        }
      }

      // Round to avoid floating point drift
      calculatedBalance = Math.round(calculatedBalance * 100) / 100;
      const currentBalance = Math.round(acc.currentBalance * 100) / 100;
      const difference = Math.round((currentBalance - calculatedBalance) * 100) / 100;

      let fixed = false;
      if (shouldFix && difference !== 0) {
        await prisma.cashAccount.update({
          where: { id: acc.id },
          data: { currentBalance: calculatedBalance },
        });
        fixed = true;
      }

      results.push({
        accountId: acc.id,
        accountName: acc.name,
        initialBalance: acc.initialBalance,
        currentBalance,
        calculatedBalance,
        difference,
        movementCount: movements.length,
        fixed,
      });
    }

    const hasDiscrepancies = results.some(r => r.difference !== 0);

    // Log the reconciliation
    try {
      await prisma.activityLog.create({
        data: {
          action: 'reconciliacao_saldos',
          description: shouldFix
            ? `Reconciliação executada e saldos corrigidos. ${results.filter(r => r.fixed).length} caixas ajustados.`
            : `Verificação de reconciliação. ${hasDiscrepancies ? 'Divergências encontradas.' : 'Todos saldos conferem.'}`,
          entityType: 'CashAccount',
          entityId: 'bulk',
          metadata: {
            fix: shouldFix,
            accounts: results.map(r => ({
              name: r.accountName,
              current: r.currentBalance,
              calculated: r.calculatedBalance,
              diff: r.difference,
              fixed: r.fixed,
            })),
          },
          companyId,
          userId,
          userName,
        },
      });
    } catch (e) { /* audit optional */ }

    return NextResponse.json({
      results,
      hasDiscrepancies,
      totalAccounts: results.length,
      fixedCount: results.filter(r => r.fixed).length,
    });
  } catch (error: any) {
    console.error('POST /api/caixas/reconciliacao error:', error);
    return NextResponse.json({ error: error?.message ?? 'Erro na reconciliação' }, { status: 500 });
  }
}
