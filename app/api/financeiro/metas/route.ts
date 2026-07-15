export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const companyId = (session.user as any).companyId;
    const role = (session.user as any).role;
    if (role !== 'administrador' && role !== 'socio' && role !== 'master' && role !== 'gerente') {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    }

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const dayOfMonth = now.getDate();
    const daysRemaining = daysInMonth - dayOfMonth;
    const weeksRemaining = Math.ceil(daysRemaining / 7);

    // Parallel queries
    const [
      salesMonth, profitData,
      payablesMonth, fixedExpenses, variableExpenses,
    ] = await Promise.all([
      // Sales this month
      prisma.$queryRaw<any[]>`
        SELECT COALESCE(SUM(total), 0)::float as revenue, COUNT(*)::int as count
        FROM sales WHERE "companyId" = ${companyId} AND status = 'concluida'
        AND "createdAt" >= ${startOfMonth} AND "createdAt" < ${endOfMonth}
      `,
      // Profit data: revenue vs cost
      prisma.$queryRaw<any[]>`
        SELECT
          COALESCE(SUM(si.total), 0)::float as revenue,
          COALESCE(SUM(COALESCE(pv."costPrice", p."costPrice", 0) * si.quantity), 0)::float as cost
        FROM sale_items si
        JOIN sales s ON si."saleId" = s.id
        JOIN products p ON si."productId" = p.id
        LEFT JOIN product_variations pv ON si."variationId" = pv.id
        WHERE s."companyId" = ${companyId} AND s.status = 'concluida'
        AND s."createdAt" >= ${startOfMonth} AND s."createdAt" < ${endOfMonth}
      `,
      // Accounts payable this month (pending + overdue)
      prisma.$queryRaw<any[]>`
        SELECT COALESCE(SUM(amount), 0)::float as total
        FROM accounts_payable
        WHERE "companyId" = ${companyId} AND status = 'pendente'
        AND "dueDate" >= ${startOfMonth} AND "dueDate" < ${endOfMonth}
      `,
      // Fixed expenses estimate (recurring financial records - last 3 months average)
      prisma.$queryRaw<any[]>`
        SELECT COALESCE(AVG(monthly_total), 0)::float as avg_fixed
        FROM (
          SELECT DATE_TRUNC('month', date) as month, SUM(amount) as monthly_total
          FROM financial_records
          WHERE "companyId" = ${companyId} AND type = 'saida'
          AND date >= ${new Date(now.getFullYear(), now.getMonth() - 3, 1)}
          AND date < ${startOfMonth}
          GROUP BY DATE_TRUNC('month', date)
        ) sub
      `,
      // Variable expenses this month
      prisma.$queryRaw<any[]>`
        SELECT COALESCE(SUM(amount), 0)::float as total
        FROM financial_records
        WHERE "companyId" = ${companyId} AND type = 'saida'
        AND date >= ${startOfMonth} AND date < ${endOfMonth}
      `,
    ]);

    const sm = salesMonth[0] || { revenue: 0, count: 0 };
    const pd = profitData[0] || { revenue: 0, cost: 0 };
    const payables = Number(payablesMonth[0]?.total || 0);
    const avgFixed = Number(fixedExpenses[0]?.avg_fixed || 0);
    const varExpenses = Number(variableExpenses[0]?.total || 0);

    const faturamentoRealizado = Number(sm.revenue);
    const custoMercadoria = Number(pd.cost);
    const lucroAtual = Number(pd.revenue) - custoMercadoria;
    const margemMedia = Number(pd.revenue) > 0 ? (lucroAtual / Number(pd.revenue)) * 100 : 0;

    // Total de despesas do mês (contas a pagar + despesas fixas estimadas)
    const despesasMes = Math.max(payables, avgFixed) + varExpenses;

    // Ponto de equilíbrio: quanto precisa vender para cobrir despesas
    const margemDecimal = margemMedia > 0 ? margemMedia / 100 : 0.3; // fallback 30%
    const pontoEquilibrio = margemDecimal > 0 ? despesasMes / margemDecimal : 0;

    // Meta diária e semanal
    const faltaVender = Math.max(0, pontoEquilibrio - faturamentoRealizado);
    const metaDiaria = daysRemaining > 0 ? faltaVender / daysRemaining : 0;
    const metaSemanal = weeksRemaining > 0 ? faltaVender / weeksRemaining : 0;

    // Lucro projetado se manter o ritmo
    const ritmoAtual = dayOfMonth > 0 ? faturamentoRealizado / dayOfMonth : 0;
    const projecaoMes = ritmoAtual * daysInMonth;
    const lucroProjetado = projecaoMes > 0 ? projecaoMes * margemDecimal - despesasMes : 0;

    // Simulações de crescimento
    const simulations = [10, 20, 30].map(pct => {
      const metaCrescimento = faturamentoRealizado * (1 + pct / 100) * (daysInMonth / Math.max(dayOfMonth, 1));
      const lucroCrescimento = metaCrescimento * margemDecimal - despesasMes;
      return {
        crescimento: pct,
        metaMensal: metaCrescimento,
        metaDiaria: metaCrescimento / daysInMonth,
        metaSemanal: metaCrescimento / 4,
        lucroEstimado: lucroCrescimento,
      };
    });

    return NextResponse.json({
      periodo: {
        diasNoMes: daysInMonth,
        diaAtual: dayOfMonth,
        diasRestantes: daysRemaining,
        semanasRestantes: weeksRemaining,
      },
      realizado: {
        faturamento: faturamentoRealizado,
        vendas: Number(sm.count),
        custoMercadoria,
        lucroAtual,
        margemMedia,
        despesasMes,
        varExpenses,
      },
      metas: {
        pontoEquilibrio,
        faltaVender,
        metaDiaria,
        metaSemanal,
        lucroProjetado,
        projecaoMes,
        ritmoAtual,
      },
      simulations,
    });
  } catch (error: any) {
    console.error('Metas error:', error);
    return NextResponse.json({ error: 'Erro ao calcular metas' }, { status: 500 });
  }
}

// Simulador de crescimento
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const body = await req.json();
    const { despesasMensais, margemMedia, crescimentoDesejado, lucroDesejado, faturamentoAtual } = body || {};

    const margem = (margemMedia || 30) / 100;
    const despesas = despesasMensais || 0;
    const faturamento = faturamentoAtual || 0;

    const empatar = margem > 0 ? despesas / margem : 0;
    const lucrar = margem > 0 ? (despesas + (lucroDesejado || 0)) / margem : 0;
    const crescer = faturamento * (1 + (crescimentoDesejado || 0) / 100);

    const metaFinal = Math.max(empatar, lucrar, crescer);

    return NextResponse.json({
      empatar,
      lucrar,
      crescer,
      metaFinal,
      metaDiaria: metaFinal / 30,
      metaSemanal: metaFinal / 4,
      risco: faturamento < empatar ? 'Faturamento atual não cobre as despesas. Risco de prejuízo.' : faturamento < metaFinal ? 'Faturamento atual abaixo da meta. Precisa aumentar vendas.' : 'Faturamento saudável. Manter o ritmo.',
      sugestao: faturamento < empatar
        ? 'Revise custos, aumente preços ou volume de vendas imediatamente.'
        : faturamento < metaFinal
        ? 'Invista em marketing e fidelização de clientes para atingir a meta.'
        : 'Continue monitorando margem e custos para manter a rentabilidade.',
    });
  } catch (error: any) {
    console.error('Simulator error:', error);
    return NextResponse.json({ error: 'Erro no simulador' }, { status: 500 });
  }
}
