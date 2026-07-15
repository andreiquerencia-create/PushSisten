export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

/**
 * GET /api/financeiro/diagnostico
 * Relatório de saúde dos dados financeiros.
 * Identifica FRs órfãos, inconsistências de saldo, e registros legados.
 * Uso: apenas para administradores.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const role = (session.user as any)?.role;
    if (role !== 'administrador' && role !== 'socio') {
      return NextResponse.json({ error: 'Apenas administradores podem acessar o diagnóstico' }, { status: 403 });
    }
    const companyId = session.user.companyId;

    // 1. FRs sem vínculo de caixa (legados)
    const frsWithoutCashLink = await prisma.financialRecord.count({
      where: { companyId, cashMovementId: null },
    });
    const frsWithCashLink = await prisma.financialRecord.count({
      where: { companyId, cashMovementId: { not: null } },
    });

    // 2. FRs órfãos de vendas parceladas (entrada, sem cash link, com reference de sale)
    const orphanSaleFRs = await prisma.financialRecord.findMany({
      where: {
        companyId,
        type: 'entrada',
        cashMovementId: null,
        cashAccountId: null,
        reference: { not: '' },
      },
      select: { id: true, description: true, amount: true, date: true, reference: true },
      orderBy: { date: 'desc' },
      take: 50,
    });

    // Verificar quais desses têm ARs correspondentes ainda pendentes
    const orphanDetails: any[] = [];
    for (const fr of orphanSaleFRs) {
      if (!fr.reference || fr.reference.startsWith('AR#') || fr.reference.startsWith('stock_entry:')) continue;
      const ar = await prisma.accountReceivable.findFirst({
        where: { saleId: fr.reference, companyId },
        select: { id: true, status: true, amount: true },
      });
      if (ar) {
        orphanDetails.push({
          frId: fr.id,
          description: fr.description,
          amount: fr.amount,
          date: fr.date,
          arStatus: ar.status,
          arAmount: ar.amount,
          impacto: ar.status === 'pendente'
            ? 'FR será vinculado ao caixa quando AR for recebido (backward compat)'
            : ar.status === 'recebido'
            ? 'FR legado de AR já recebido (sem impacto de dupla contagem)'
            : 'AR cancelado — FR pode ser removido',
        });
      }
    }

    // 3. Saldo dos caixas vs saldo calculado por CMs
    const cashAccounts = await prisma.cashAccount.findMany({
      where: { companyId, isActive: true },
      select: { id: true, name: true, currentBalance: true, initialBalance: true },
    });

    const balanceChecks: any[] = [];
    for (const ca of cashAccounts) {
      const cmAgg = await prisma.cashMovement.groupBy({
        by: ['type'],
        where: { cashAccountId: ca.id },
        _sum: { amount: true },
      });
      const cmEntradas = cmAgg.find(a => a.type === 'entrada')?._sum?.amount ?? 0;
      const cmSaidas = cmAgg.find(a => a.type === 'saida')?._sum?.amount ?? 0;
      const calculatedBalance = ca.initialBalance + cmEntradas - cmSaidas;
      const diff = Math.abs(ca.currentBalance - calculatedBalance);

      balanceChecks.push({
        caixa: ca.name,
        saldoAtual: ca.currentBalance,
        saldoCalculado: Math.round(calculatedBalance * 100) / 100,
        diferenca: Math.round(diff * 100) / 100,
        status: diff < 0.01 ? 'OK' : 'DIVERGÊNCIA',
      });
    }

    // 4. CMs sem FR correspondente (movimentações sem registro financeiro)
    const cmsWithoutFR = await prisma.cashMovement.count({
      where: {
        companyId,
        id: {
          notIn: (await prisma.financialRecord.findMany({
            where: { companyId, cashMovementId: { not: null } },
            select: { cashMovementId: true },
          })).map(fr => fr.cashMovementId!),
        },
      },
    });

    return NextResponse.json({
      resumo: {
        totalFRs: frsWithCashLink + frsWithoutCashLink,
        frsVinculados: frsWithCashLink,
        frsLegados: frsWithoutCashLink,
        percentualVinculado: frsWithCashLink + frsWithoutCashLink > 0
          ? Math.round((frsWithCashLink / (frsWithCashLink + frsWithoutCashLink)) * 100)
          : 100,
        cmsOrfaos: cmsWithoutFR,
      },
      orphanSaleFRs: orphanDetails,
      balanceChecks,
      recomendacoes: [
        frsWithoutCashLink > 0 ? `${frsWithoutCashLink} registros financeiros sem vínculo de caixa (legados). Serão vinculados automaticamente ao receberem ARs correspondentes.` : null,
        cmsWithoutFR > 0 ? `${cmsWithoutFR} movimentações de caixa sem registro financeiro correspondente.` : null,
        balanceChecks.some(b => b.status === 'DIVERGÊNCIA') ? 'Há divergências entre saldo atual e saldo calculado em alguns caixas. Verifique na reconciliação.' : null,
      ].filter(Boolean),
    });
  } catch (error) {
    console.error('GET /api/financeiro/diagnostico error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
