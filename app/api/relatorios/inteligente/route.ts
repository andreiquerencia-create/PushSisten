export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { calculateSalesMetrics } from '@/lib/financial-engine';

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}
function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}
function monthsAgo(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth() - n, 1, 0, 0, 0, 0);
}

const GROUP_LABELS: Record<string, { code: string; label: string; color: string }> = {
  '1': { code: '1', label: 'Receitas', color: '#10b981' },
  '2': { code: '2', label: 'Custos', color: '#f59e0b' },
  '3': { code: '3', label: 'Despesas Operacionais', color: '#ef4444' },
  '4': { code: '4', label: 'Impostos', color: '#8b5cf6' },
  '5': { code: '5', label: 'Financeiro', color: '#3b82f6' },
  '6': { code: '6', label: 'Investimentos', color: '#06b6d4' },
};

function firstDigit(code?: string | null): string | null {
  if (!code) return null;
  const c = code.trim();
  return c.length > 0 ? c[0] : null;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const companyId = session.user.companyId;
    const url = new URL(request.url);
    const periodo = url.searchParams.get('periodo') ?? 'mes';

    const now = new Date();
    let currentStart: Date;
    let currentEnd: Date;
    let prevStart: Date;
    let prevEnd: Date;

    if (periodo === 'trimestre') {
      const tStart = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      currentStart = tStart;
      currentEnd = endOfMonth(now);
      prevStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      prevEnd = endOfMonth(new Date(now.getFullYear(), now.getMonth() - 3, 1));
    } else if (periodo === 'ano') {
      currentStart = new Date(now.getFullYear(), 0, 1);
      currentEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
      prevStart = new Date(now.getFullYear() - 1, 0, 1);
      prevEnd = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
    } else {
      currentStart = startOfMonth(now);
      currentEnd = endOfMonth(now);
      prevStart = monthsAgo(now, 1);
      prevEnd = endOfMonth(monthsAgo(now, 1));
    }

    // Buscar todos os planos de contas da empresa
    const allPlans = await prisma.accountPlan.findMany({
      where: { companyId, isActive: true },
      select: { id: true, code: true, name: true, type: true, parentId: true },
    });
    const planById = new Map(allPlans.map(p => [p.id, p]));

    // Função auxiliar: buscar movimentos pagos/recebidos de um período
    async function fetchMovements(start: Date, end: Date) {
      const [paid, received, finRecords, sales] = await Promise.all([
        prisma.accountPayable.findMany({
          where: { companyId, status: 'pago', paidDate: { gte: start, lte: end } },
          select: { amount: true, accountPlanId: true, description: true, paidDate: true },
        }),
        prisma.accountReceivable.findMany({
          where: { companyId, status: 'recebido', receivedDate: { gte: start, lte: end } },
          select: { amount: true, accountPlanId: true, description: true, receivedDate: true },
        }),
        prisma.financialRecord.findMany({
          where: { companyId, date: { gte: start, lte: end } },
          select: { amount: true, accountPlanId: true, type: true, description: true, date: true },
        }),
        prisma.sale.findMany({
          where: { companyId, status: 'concluida', createdAt: { gte: start, lte: end } },
          select: { total: true },
        }),
      ]);
      return { paid, received, finRecords, sales };
    }

    const currentData = await fetchMovements(currentStart, currentEnd);
    const prevData = await fetchMovements(prevStart, prevEnd);

    // ========================
    // 1) FATURAMENTO TOTAL — Fonte Única: financial-engine
    // ========================
    const salesMetricsEngine = await calculateSalesMetrics(
      companyId,
      { gte: currentStart, lte: currentEnd }
    );
    // CORRIGIDO: Faturamento = vendas concluídas (sale.total), sem Math.max
    const totalRevenue = salesMetricsEngine.faturamentoLiquido;
    const salesRevenue = totalRevenue;
    // Recebimentos extras são os não-venda (grupo 1 mas fora de sales)
    const receivableRevenue = currentData.received.reduce((s, v) => {
      const plan = v.accountPlanId ? planById.get(v.accountPlanId) : null;
      const g = firstDigit(plan?.code);
      if (g === '1') return s + v.amount;
      return s;
    }, 0);
    const finIncomeRevenue = currentData.finRecords.reduce((s, v) => {
      const plan = v.accountPlanId ? planById.get(v.accountPlanId) : null;
      const g = firstDigit(plan?.code);
      if (v.type === 'entrada' && g === '1') return s + v.amount;
      return s;
    }, 0);
    // Recebimentos extras = total recebido que não é venda
    const recebimentosExtras = (receivableRevenue + finIncomeRevenue);

    // ========================
    // 2) GASTOS POR GRUPO
    // ========================
    const groupTotals: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, '6': 0 };
    const groupTotalsPrev: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, '6': 0 };

    function addGroup(target: Record<string, number>, accountPlanId: string | null | undefined, amount: number) {
      if (!accountPlanId) return;
      const plan = planById.get(accountPlanId);
      const g = firstDigit(plan?.code);
      if (g && target[g] !== undefined) target[g] += amount;
    }

    currentData.paid.forEach(p => addGroup(groupTotals, p.accountPlanId, p.amount));
    currentData.finRecords.forEach(f => {
      if (f.type === 'saída' || f.type === 'saida') addGroup(groupTotals, f.accountPlanId, f.amount);
    });
    prevData.paid.forEach(p => addGroup(groupTotalsPrev, p.accountPlanId, p.amount));
    prevData.finRecords.forEach(f => {
      if (f.type === 'saída' || f.type === 'saida') addGroup(groupTotalsPrev, f.accountPlanId, f.amount);
    });

    const gastosPorGrupo = Object.entries(groupTotals)
      .filter(([k]) => k !== '1') // exclui receitas
      .map(([k, total]) => {
        const prev = groupTotalsPrev[k] || 0;
        const variacao = prev > 0 ? ((total - prev) / prev) * 100 : (total > 0 ? 100 : 0);
        const percentReceita = totalRevenue > 0 ? (total / totalRevenue) * 100 : 0;
        return {
          grupo: k,
          label: GROUP_LABELS[k]?.label || `Grupo ${k}`,
          color: GROUP_LABELS[k]?.color || '#64748b',
          total,
          totalPrev: prev,
          variacao,
          percentReceita,
        };
      })
      .sort((a, b) => b.total - a.total);

    // ========================
    // 3) TOP DESPESAS POR PLANO DE CONTAS
    // ========================
    const planTotals = new Map<string, number>();
    const planTotalsPrev = new Map<string, number>();

    function addPlan(target: Map<string, number>, accountPlanId: string | null | undefined, amount: number) {
      if (!accountPlanId) return;
      const plan = planById.get(accountPlanId);
      const g = firstDigit(plan?.code);
      // Considera apenas saídas (grupos 2-6)
      if (!g || g === '1') return;
      target.set(accountPlanId, (target.get(accountPlanId) || 0) + amount);
    }

    currentData.paid.forEach(p => addPlan(planTotals, p.accountPlanId, p.amount));
    currentData.finRecords.forEach(f => {
      if (f.type === 'saída' || f.type === 'saida') addPlan(planTotals, f.accountPlanId, f.amount);
    });
    prevData.paid.forEach(p => addPlan(planTotalsPrev, p.accountPlanId, p.amount));
    prevData.finRecords.forEach(f => {
      if (f.type === 'saída' || f.type === 'saida') addPlan(planTotalsPrev, f.accountPlanId, f.amount);
    });

    const topDespesas = Array.from(planTotals.entries())
      .map(([planId, total]) => {
        const plan = planById.get(planId);
        const prev = planTotalsPrev.get(planId) || 0;
        const variacao = prev > 0 ? ((total - prev) / prev) * 100 : (total > 0 ? 100 : 0);
        return {
          accountPlanId: planId,
          code: plan?.code || '',
          name: plan?.name || 'Sem nome',
          total,
          prev,
          variacao,
          percentReceita: totalRevenue > 0 ? (total / totalRevenue) * 100 : 0,
        };
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, 15);

    // ========================
    // 4) % FATURAMENTO (KPIs Chave)
    // ========================
    function sumByPrefix(prefix: string): number {
      let total = 0;
      planTotals.forEach((amount, planId) => {
        const plan = planById.get(planId);
        if (plan?.code?.startsWith(prefix)) total += amount;
      });
      // adiciona também receitas se prefix começa com '1'
      if (prefix.startsWith('1')) {
        currentData.received.forEach(r => {
          const plan = r.accountPlanId ? planById.get(r.accountPlanId) : null;
          if (plan?.code?.startsWith(prefix)) total += r.amount;
        });
        currentData.finRecords.forEach(f => {
          if (f.type !== 'entrada') return;
          const plan = f.accountPlanId ? planById.get(f.accountPlanId) : null;
          if (plan?.code?.startsWith(prefix)) total += f.amount;
        });
      }
      return total;
    }

    // CORRIGIDO: CMV vem do financial-engine (avgCost × qty vendida)
    const cmv = salesMetricsEngine.cmv;
    const cmvOLD_planBased = sumByPrefix('2'); // mantido para referência, mas não usado como KPI
    const marketing = sumByPrefix('3.3');
    const taxasCartao = sumByPrefix('3.4.3');
    const aluguel = sumByPrefix('3.1.1');
    const pessoal = sumByPrefix('3.2');
    const impostos = sumByPrefix('4');
    const comissoes = sumByPrefix('3.4.1');
    const descontos = sumByPrefix('3.4.6');

    function pct(v: number): number {
      return totalRevenue > 0 ? (v / totalRevenue) * 100 : 0;
    }

    const kpis = [
      { code: 'CMV', label: 'CMV (Custo Mercadoria)', value: cmv, percent: pct(cmv), ideal: 50, status: pct(cmv) <= 50 ? 'ok' : 'alerta' },
      { code: '3.2', label: 'Pessoal', value: pessoal, percent: pct(pessoal), ideal: 15, status: pct(pessoal) <= 15 ? 'ok' : 'alerta' },
      { code: '3.3', label: 'Marketing', value: marketing, percent: pct(marketing), ideal: 8, status: pct(marketing) <= 8 ? 'ok' : 'alerta' },
      { code: '3.1.1', label: 'Aluguel', value: aluguel, percent: pct(aluguel), ideal: 7, status: pct(aluguel) <= 7 ? 'ok' : 'alerta' },
      { code: '3.4.3', label: 'Taxas de Cartão', value: taxasCartao, percent: pct(taxasCartao), ideal: 3, status: pct(taxasCartao) <= 3 ? 'ok' : 'alerta' },
      { code: '3.4.1', label: 'Comissões', value: comissoes, percent: pct(comissoes), ideal: 5, status: pct(comissoes) <= 5 ? 'ok' : 'alerta' },
      { code: '3.4.6', label: 'Descontos Concedidos', value: descontos, percent: pct(descontos), ideal: 3, status: pct(descontos) <= 3 ? 'ok' : 'alerta' },
      { code: '4', label: 'Impostos', value: impostos, percent: pct(impostos), ideal: 8, status: pct(impostos) <= 8 ? 'ok' : 'alerta' },
    ];

    // ========================
    // 5) DESPESAS QUE MAIS CRESCERAM
    // ========================
    const crescimentoDespesas = Array.from(planTotals.entries())
      .map(([planId, total]) => {
        const plan = planById.get(planId);
        const prev = planTotalsPrev.get(planId) || 0;
        const variacao = prev > 0 ? ((total - prev) / prev) * 100 : (total > 0 ? 100 : 0);
        const diff = total - prev;
        return {
          accountPlanId: planId,
          code: plan?.code || '',
          name: plan?.name || 'Sem nome',
          total,
          prev,
          variacao,
          diff,
        };
      })
      .filter(d => d.total > 0)
      .sort((a, b) => b.diff - a.diff)
      .slice(0, 10);

    // ========================
    // 6) LANÇAMENTOS SEM CLASSIFICAÇÃO
    // ========================
    const [unclAP, unclAR, unclFR] = await Promise.all([
      prisma.accountPayable.count({ where: { companyId, accountPlanId: null } }),
      prisma.accountReceivable.count({ where: { companyId, accountPlanId: null } }),
      prisma.financialRecord.count({ where: { companyId, accountPlanId: null } }),
    ]);

    return NextResponse.json({
      periodo,
      currentStart: currentStart.toISOString(),
      currentEnd: currentEnd.toISOString(),
      prevStart: prevStart.toISOString(),
      prevEnd: prevEnd.toISOString(),
      faturamento: {
        total: totalRevenue,
        vendas: salesRevenue,
        recebimentos: recebimentosExtras,
      },
      gastosPorGrupo,
      topDespesas,
      kpis,
      crescimentoDespesas,
      semClassificacao: { ap: unclAP, ar: unclAR, fr: unclFR, total: unclAP + unclAR + unclFR },
    });
  } catch (error) {
    console.error('GET /api/relatorios/inteligente error:', error);
    return NextResponse.json({ error: 'Erro interno ao gerar relatório inteligente' }, { status: 500 });
  }
}
