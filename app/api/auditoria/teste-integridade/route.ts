export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import {
  calculateSalesMetrics,
  getCashBalance,
  calculateStockMetrics,
  getReceivables,
  calculateDRE,
} from '@/lib/financial-engine';
import { runAudit } from '@/lib/audit-engine';
import { reprocessGlobal } from '@/lib/reprocess-engine';

/**
 * POST /api/auditoria/teste-integridade
 *
 * Teste automatizado de consistência financeira para a empresa logada.
 * Compara os números do financial-engine entre si (cross-module) e
 * roda as 12 verificações de auditoria.
 *
 * Apenas administradores.
 * 
 * Body opcional: { fix: true } — se true, roda reprocessamento antes.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const role = (session.user as any).role;
    if (role !== 'administrador') return NextResponse.json({ error: 'Apenas administradores' }, { status: 403 });
    const companyId = (session.user as any).companyId;
    if (!companyId) return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    let reprocessResult: any = null;
    if (body?.fix) {
      reprocessResult = await reprocessGlobal(companyId);
    }

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthFilter = { gte: startOfMonth };

    const [salesMetrics, cashBalance, stockMetrics, receivables, dre, audit] = await Promise.all([
      calculateSalesMetrics(companyId, monthFilter),
      getCashBalance(companyId),
      calculateStockMetrics(companyId),
      getReceivables(companyId),
      calculateDRE(companyId, monthFilter),
      runAudit(companyId),
    ]);

    // ==================== CROSS-MODULE ASSERTIONS ====================
    const assertions: { label: string; esperado: number; encontrado: number; ok: boolean }[] = [];
    function check(label: string, a: number, b: number) {
      const ok = Math.abs((a ?? 0) - (b ?? 0)) <= 0.01;
      assertions.push({ label, esperado: a, encontrado: b, ok });
    }

    // Sales engine vs DRE (devem usar a mesma fonte)
    check('Faturamento bruto (vendas vs DRE)', salesMetrics.faturamentoBruto, dre.faturamentoBruto);
    check('Receita líquida (vendas vs DRE)', salesMetrics.receitaLiquida, dre.receitaLiquida);
    check('CMV (vendas vs DRE)', salesMetrics.cmv, dre.cmv);
    check('Taxas cartão (vendas vs DRE)', salesMetrics.taxasCartao, dre.taxasCartao);
    check('Devoluções (vendas vs DRE)', salesMetrics.devolucoes, dre.devolucoes);
    check('Lucro bruto (vendas vs DRE)', salesMetrics.lucroBruto, dre.margemBruta);

    // Integridade matemática
    check('Receita líquida = fat.líq − devoluções', salesMetrics.faturamentoLiquido - salesMetrics.devolucoes, salesMetrics.receitaLiquida);
    check('Lucro bruto = receita líquida − CMV', salesMetrics.receitaLiquida - salesMetrics.cmv, salesMetrics.lucroBruto);
    check('Lucro líquido vendas = bruto − taxas', salesMetrics.lucroBruto - salesMetrics.taxasCartao, salesMetrics.lucroLiquido);

    // Ticket médio
    const expectedTicket = salesMetrics.totalVendas > 0 ? Math.round((salesMetrics.faturamentoLiquido / salesMetrics.totalVendas) * 100) / 100 : 0;
    check('Ticket médio = fat.líq / totalVendas', expectedTicket, salesMetrics.ticketMedio);

    const totalPassed = assertions.filter(a => a.ok).length;
    const totalFailed = assertions.filter(a => !a.ok).length;

    return NextResponse.json({
      generatedAt: now.toISOString(),
      periodo: { inicio: startOfMonth.toISOString(), fim: now.toISOString() },

      // Números canônicos
      numeros: {
        faturamentoBruto: salesMetrics.faturamentoBruto,
        faturamentoLiquido: salesMetrics.faturamentoLiquido,
        devolucoes: salesMetrics.devolucoes,
        receitaLiquida: salesMetrics.receitaLiquida,
        cmv: salesMetrics.cmv,
        taxasCartao: salesMetrics.taxasCartao,
        lucroBruto: salesMetrics.lucroBruto,
        lucroLiquidoVendas: salesMetrics.lucroLiquido,
        lucroLiquidoDRE: dre.lucroLiquido,
        saldoCaixa: cashBalance.saldo,
        contasReceber: receivables.totalGeral,
        capitalInvestido: stockMetrics.capitalInvestido,
        totalVendas: salesMetrics.totalVendas,
        ticketMedio: salesMetrics.ticketMedio,
      },

      // Asserções cross-module
      crossModule: {
        total: assertions.length,
        passaram: totalPassed,
        falharam: totalFailed,
        resultado: totalFailed === 0 ? 'CONSISTÊNCIA OK' : 'DIVERGÊNCIA DETECTADA',
        assertions,
      },

      // Auditoria
      auditoria: {
        resumo: audit.summary,
        checks: audit.checks.map(c => ({
          id: c.id,
          status: c.status,
          count: c.count,
          title: c.title,
        })),
      },

      // Reprocessamento (se solicitado)
      reprocessamento: reprocessResult,
    });
  } catch (error: any) {
    console.error('Integrity test error:', error);
    return NextResponse.json({ error: 'Erro no teste de integridade', detail: error?.message }, { status: 500 });
  }
}
