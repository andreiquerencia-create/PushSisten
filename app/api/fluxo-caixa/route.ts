export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { getCashFlowProjection } from '@/lib/financial-engine';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const companyId = session.user.companyId;
    const url = new URL(request.url);
    const days = parseInt(url.searchParams.get('days') ?? '30');

    const now = new Date();

    // === PROJEÇÃO UNIFICADA: fórmula oficial centralizada no financial-engine ===
    const proj = await getCashFlowProjection(companyId, days);
    const saldoBruto = proj.saldoBruto;
    const cashAccounts = await prisma.cashAccount.findMany({
      where: { companyId, isActive: true },
      select: { id: true, name: true, type: true, currentBalance: true },
    });

    // === OBRIGAÇÕES FUTURAS: TODAS as contas a pagar pendentes ===
    const allPendingPayables = await prisma.accountPayable.aggregate({
      where: { companyId, status: 'pendente' },
      _sum: { amount: true },
      _count: true,
    });
    const obrigacoesFuturas = allPendingPayables._sum?.amount ?? 0;

    // === SALDO DISPONÍVEL: saldo bruto - obrigações ===
    const saldoDisponivel = saldoBruto - obrigacoesFuturas;

    // Saldo financeiro calculado apenas por FRs vinculados a caixa (exclui FRs legados/órfãos)
    const financialAggLinked = await prisma.financialRecord.groupBy({
      by: ['type'],
      where: { companyId, cashMovementId: { not: null } },
      _sum: { amount: true },
    });
    const totalEntradas = financialAggLinked.find(a => a.type === 'entrada')?._sum?.amount ?? 0;
    const totalSaidas = financialAggLinked.find(a => a.type === 'saida')?._sum?.amount ?? 0;
    const saldoFinanceiro = totalEntradas - totalSaidas;

    // Use saldoBruto as the primary reference (real cash in accounts)
    const saldoAtual = saldoBruto;

    // Average daily sales (last 30 days) — vindo da função unificada
    const avgDailySales = proj.avgDailySales;
    const recentSalesCount = proj.recentSalesCount;

    // Future receivables/payables — janela [hoje, hoje+days] da função unificada
    const receivables = proj.receivables;
    const totalRecebiveis = proj.totalRecebiveis;
    const payables = proj.payables;
    const totalPagaveis = proj.totalPagaveis;

    // Overdue amounts
    const overduePayables = await prisma.accountPayable.aggregate({
      where: { companyId, status: 'pendente', dueDate: { lt: now } },
      _sum: { amount: true }, _count: true,
    });
    const overdueReceivables = await prisma.accountReceivable.aggregate({
      where: { companyId, status: 'pendente', dueDate: { lt: now } },
      _sum: { amount: true }, _count: true,
    });

    // Recurring expenses detection (repeated payable descriptions in last 90 days)
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const recentPayables = await prisma.accountPayable.findMany({
      where: { companyId, createdAt: { gte: ninetyDaysAgo } },
      select: { description: true, amount: true },
    });
    const descCount: Record<string, { count: number; avgAmount: number; total: number }> = {};
    for (const p of recentPayables) {
      const key = p.description.toLowerCase().trim();
      if (!descCount[key]) descCount[key] = { count: 0, avgAmount: 0, total: 0 };
      descCount[key].count++;
      descCount[key].total += p.amount;
    }
    const recurringExpenses = Object.entries(descCount)
      .filter(([, v]) => v.count >= 2)
      .map(([desc, v]) => ({ description: desc, count: v.count, avgAmount: Math.round((v.total / v.count) * 100) / 100 }))
      .sort((a, b) => b.avgAmount - a.avgAmount)
      .slice(0, 10);
    const estimatedMonthlyRecurring = recurringExpenses.reduce((s, e) => s + e.avgAmount, 0);

    const saldoProjetado = proj.saldoProjetado;

    // Build daily projection with avg sales included
    const projection: { date: string; saldo: number; saldoComVendas: number }[] = [];
    let runningBalance = saldoAtual;
    let runningBalanceWithSales = saldoAtual;
    for (let d = 0; d <= days; d++) {
      const date = new Date(now);
      date.setDate(now.getDate() + d);
      const dateStr = date.toISOString().split('T')[0];

      const dayReceivables = receivables.filter(r => r.dueDate.toISOString().split('T')[0] === dateStr);
      const dayPayables = payables.filter(p => p.dueDate.toISOString().split('T')[0] === dateStr);

      const dayIn = dayReceivables.reduce((s, r) => s + r.amount, 0);
      const dayOut = dayPayables.reduce((s, p) => s + p.amount, 0);
      runningBalance += dayIn - dayOut;
      runningBalanceWithSales += dayIn - dayOut + (d > 0 ? avgDailySales : 0);
      projection.push({
        date: dateStr,
        saldo: Math.round(runningBalance * 100) / 100,
        saldoComVendas: Math.round(runningBalanceWithSales * 100) / 100,
      });
    }

    return NextResponse.json({
      // === 4 Conceitos Financeiros ===
      saldoBruto,                   // soma real dos caixas (fonte da verdade)
      obrigacoesFuturas,            // total de contas a pagar pendentes
      obrigacoesFuturasCount: allPendingPayables._count,
      saldoDisponivel,              // bruto - obrigações
      saldoProjetado: Math.round(saldoProjetado * 100) / 100,
      // === Composição ===
      cashAccounts,                 // breakdown por conta/caixa
      saldoFinanceiro,              // reconciliação via registros financeiros
      // === Compatibilidade ===
      saldoAtual,                   // alias para saldoBruto (legado)
      // === Detalhamento ===
      totalRecebiveis,
      totalPagaveis,
      avgDailySales: Math.round(avgDailySales * 100) / 100,
      recentSalesCount,
      overduePayables: { count: overduePayables._count, total: overduePayables._sum?.amount ?? 0 },
      overdueReceivables: { count: overdueReceivables._count, total: overdueReceivables._sum?.amount ?? 0 },
      recurringExpenses,
      estimatedMonthlyRecurring,
      projection,
      receivables: receivables.slice(0, 10),
      payables: payables.slice(0, 10),
    });
  } catch (error) {
    console.error('GET /api/fluxo-caixa error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
