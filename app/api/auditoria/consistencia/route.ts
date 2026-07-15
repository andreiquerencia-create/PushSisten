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

/**
 * VALIDAÇÃO DE CONSISTÊNCIA
 * 
 * Retorna números canônicos do financial-engine para o mês atual.
 * Esses números DEVEM ser idênticos aos exibidos em:
 *   - Dashboard
 *   - Executivo IA
 *   - Estatísticas
 *   - DRE
 *   - Fluxo de Caixa
 * 
 * Se algum módulo mostrar números diferentes, há BUG no consumidor.
 */
export async function GET(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const companyId = (session.user as any).companyId;
    if (!companyId) return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 400 });

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    const [salesMonth, salesPrevMonth, cashBalance, stockMetrics, receivables, dre] = await Promise.all([
      calculateSalesMetrics(companyId, { gte: startOfMonth }),
      calculateSalesMetrics(companyId, { gte: startOfPrevMonth, lte: endOfPrevMonth }),
      getCashBalance(companyId),
      calculateStockMetrics(companyId),
      getReceivables(companyId),
      calculateDRE(companyId, { gte: startOfMonth }),
    ]);

    return NextResponse.json({
      generatedAt: now.toISOString(),
      periodo: {
        inicio: startOfMonth.toISOString(),
        fim: now.toISOString(),
      },
      vendas: {
        faturamentoBruto: salesMonth.faturamentoBruto,
        descontos: salesMonth.descontos,
        faturamentoLiquido: salesMonth.faturamentoLiquido,
        devolucoes: salesMonth.devolucoes,
        receitaLiquida: salesMonth.receitaLiquida,
        cmv: salesMonth.cmv,
        taxasCartao: salesMonth.taxasCartao,
        lucroBruto: salesMonth.lucroBruto,
        lucroLiquido: salesMonth.lucroLiquido,
        margemBruta: salesMonth.margemBruta,
        margemLiquida: salesMonth.margemLiquida,
        totalVendas: salesMonth.totalVendas,
        ticketMedio: salesMonth.ticketMedio,
      },
      mesAnterior: {
        faturamentoLiquido: salesPrevMonth.faturamentoLiquido,
        lucroLiquido: salesPrevMonth.lucroLiquido,
        totalVendas: salesPrevMonth.totalVendas,
        ticketMedio: salesPrevMonth.ticketMedio,
      },
      caixa: {
        saldoTotal: cashBalance.saldo,
        contas: cashBalance.accounts,
      },
      estoque: {
        totalProdutos: stockMetrics.totalProdutos,
        totalPecas: stockMetrics.totalPecas,
        capitalInvestido: stockMetrics.capitalInvestido,
        capitalParado: stockMetrics.capitalParado,
        capitalParadoProdutos: stockMetrics.capitalParadoProdutos,
        estoqueBaixo: stockMetrics.estoqueBaixo,
        estoqueZerado: stockMetrics.estoqueZerado,
      },
      recebiveis: {
        accountReceivablePendente: receivables.saldoAccountReceivablePendente,
        salePaymentNaoRecebido: receivables.saldoSalePaymentNaoRecebido,
        totalGeral: receivables.totalGeral,
        vencidas: receivables.vencidasAccountReceivable,
        vencendo30d: receivables.vencendoEm30Dias,
      },
      dre: {
        faturamentoBruto: dre.faturamentoBruto,
        descontos: dre.descontos,
        devolucoes: dre.devolucoes,
        receitaLiquida: dre.receitaLiquida,
        cmv: dre.cmv,
        margemBruta: dre.margemBruta,
        margemBrutaPct: dre.margemBrutaPct,
        despesasOperacionais: dre.despesasOperacionais,
        despesasFinanceiras: dre.despesasFinanceiras,
        taxasCartao: dre.taxasCartao,
        impostos: dre.impostos,
        lucroOperacional: dre.lucroOperacional,
        lucroLiquidoDRE: dre.lucroLiquido,
        margemLiquidaDRE: dre.margemLiquidaPct,
      },
      _meta: {
        nota: 'Estes são os números canônicos. Se Dashboard, Executivo, Estatísticas, DRE ou Fluxo de Caixa mostrarem números diferentes, o módulo tem bug.',
        diferencaLucros: {
          descricao: 'O LucroLíquido (vendas) considera só CMV+TaxasCartão. O LucroLíquido (DRE) considera também despesas operacionais, financeiras, impostos.',
          lucroVendas: salesMonth.lucroLiquido,
          lucroDRE: dre.lucroLiquido,
          diferenca: salesMonth.lucroLiquido - dre.lucroLiquido,
        },
      },
    });
  } catch (error: any) {
    console.error('Consistency check error:', error);
    return NextResponse.json({ error: 'Erro na verificação de consistência', detail: error?.message }, { status: 500 });
  }
}
