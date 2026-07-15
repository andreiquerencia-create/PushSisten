/**
 * REPROCESSAMENTO GLOBAL
 *
 * IMPORTANTE — escopo correto do reprocessamento:
 *
 * Os indicadores financeiros (faturamento, CMV, lucro, contas a receber, saldo de
 * caixa, DRE) são calculados AO VIVO pelo financial-engine a partir das tabelas
 * de origem (sales, sale_items, sale_payments, cash_accounts, accounts_receivable).
 * Eles NÃO possuem cache e portanto NÃO precisam ser reprocessados — qualquer
 * correção nos dados aparece imediatamente em todos os módulos (comprovado pelo
 * teste de consistência cross-módulo).
 *
 * O que REALMENTE pode divergir são os campos DESNORMALIZADOS (valores gravados
 * que são cópia/agregação de outras tabelas):
 *   - Customer.totalPurchased / purchaseCount / avgTicket / lastPurchase
 *
 * Este reprocessamento recalcula esses campos a partir da fonte da verdade
 * (vendas concluídas) e corrige apenas os registros divergentes.
 */

import { prisma } from '@/lib/db';

export interface ReprocessResult {
  generatedAt: string;
  customers: {
    analisados: number;
    corrigidos: number;
    detalhes: { name: string; de: number; para: number; countDe: number; countPara: number }[];
  };
  observacoes: string[];
}

function round2(v: number) { return Math.round(v * 100) / 100; }

/**
 * Recalcula estatísticas desnormalizadas dos clientes a partir das vendas concluídas.
 * Atualiza somente quem está divergente. Seguro para rodar em produção.
 */
export async function reprocessGlobal(companyId: string): Promise<ReprocessResult> {
  const observacoes: string[] = [];
  observacoes.push('Indicadores financeiros (faturamento, CMV, lucro, recebiveis, saldo, DRE) são calculados ao vivo e não requerem reprocessamento.');

  const customers = await prisma.customer.findMany({
    where: { companyId },
    select: { id: true, name: true, totalPurchased: true, purchaseCount: true },
  });

  const detalhes: ReprocessResult['customers']['detalhes'] = [];
  let corrigidos = 0;

  for (const c of customers) {
    const agg = await prisma.sale.aggregate({
      where: { customerId: c.id, status: 'concluida' },
      _sum: { total: true },
      _count: true,
    });
    const last = await prisma.sale.findFirst({
      where: { customerId: c.id, status: 'concluida' },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });

    const realTotal = round2(agg._sum?.total ?? 0);
    const realCount = agg._count ?? 0;
    const realAvg = realCount > 0 ? round2(realTotal / realCount) : 0;

    const divergeTotal = Math.abs(realTotal - (c.totalPurchased ?? 0)) > 0.01;
    const divergeCount = realCount !== (c.purchaseCount ?? 0);

    if (divergeTotal || divergeCount) {
      await prisma.customer.update({
        where: { id: c.id },
        data: {
          totalPurchased: realTotal,
          purchaseCount: realCount,
          avgTicket: realAvg,
          lastPurchase: last?.createdAt ?? null,
        },
      });
      corrigidos++;
      detalhes.push({ name: c.name, de: c.totalPurchased ?? 0, para: realTotal, countDe: c.purchaseCount ?? 0, countPara: realCount });
    }
  }

  if (corrigidos === 0) observacoes.push('Nenhuma estatística de cliente estava divergente.');

  return {
    generatedAt: new Date().toISOString(),
    customers: { analisados: customers.length, corrigidos, detalhes },
    observacoes,
  };
}
