export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { calculateSalesMetrics, getCashBalance, getReceivables } from '@/lib/financial-engine';
// Push Score oficial (Single Source of Truth) — lido, NUNCA recalculado aqui.
import { recordPushScoreSnapshot, classifyScore, type PushScoreResult } from '@/lib/push-score-engine';
// Insights Engine oficial — ÚNICA fonte de diagnóstico
import { generateInsights, type InsightRecord } from '@/lib/insights-engine';

function pct(cur: number, prev: number): number {
  if (prev === 0) return cur > 0 ? 100 : 0;
  return ((cur - prev) / prev) * 100;
}

function getPeriodDates(period: string) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  let start: Date, end: Date;
  switch (period) {
    case 'today':
      start = today; end = new Date(today.getTime() + 86400000); break;
    case 'week': {
      const dow = now.getDay() || 7;
      start = new Date(today.getTime() - (dow - 1) * 86400000);
      end = new Date(start.getTime() + 7 * 86400000); break;
    }
    case 'quarter': {
      const qm = Math.floor(now.getMonth() / 3) * 3;
      start = new Date(now.getFullYear(), qm, 1);
      end = new Date(now.getFullYear(), qm + 3, 1); break;
    }
    case 'year':
      start = new Date(now.getFullYear(), 0, 1);
      end = new Date(now.getFullYear() + 1, 0, 1); break;
    default:
      start = startOfMonth; end = new Date(now.getFullYear(), now.getMonth() + 1, 1); break;
  }
  return { now, today, yesterday, startOfMonth, startOfPrevMonth, start, end };
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const companyId = (session.user as any).companyId;
    if (!companyId) return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 400 });

    const period = req.nextUrl.searchParams.get('period') || 'month';
    const role = (session.user as any).role;
    const userId = (session.user as any).id;
    const isAdmin = role === 'administrador' || role === 'master';
    const sellerWhere = isAdmin ? {} : { sellerId: userId };
    const { now, today, yesterday, startOfMonth, startOfPrevMonth, start, end } = getPeriodDates(period);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 86400000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
    const in30days = new Date(now.getTime() + 30 * 86400000);

    // ===== PHASE 1: KPIs via Financial Engine (fonte única de verdade) =====
    const [
      salesMonthEngine, salesPrevMonthEngine, salesTodayEngine, salesYesterdayEngine,
      cashBalance,
      payablesPend, payablesOverdue,
      receivables,
      totalFeesPeriod,
    ] = await Promise.all([
      calculateSalesMetrics(companyId, { gte: startOfMonth }),
      calculateSalesMetrics(companyId, { gte: startOfPrevMonth, lte: new Date(now.getFullYear(), now.getMonth(), 0) }),
      calculateSalesMetrics(companyId, { gte: today }),
      calculateSalesMetrics(companyId, { gte: yesterday, lte: today }),
      getCashBalance(companyId),
      prisma.accountPayable.aggregate({ where: { companyId, status: 'pendente', dueDate: { gte: now, lte: in30days } }, _sum: { amount: true } }),
      prisma.accountPayable.aggregate({ where: { companyId, status: 'pendente', dueDate: { lt: now } }, _sum: { amount: true } }),
      getReceivables(companyId),
      prisma.salePayment.aggregate({ where: { companyId, sale: { status: 'concluida', createdAt: { gte: startOfMonth } } }, _sum: { feeAmount: true } }),
    ]);

    const cashAccounts = cashBalance.accounts;
    const curProfit = salesMonthEngine.lucroLiquido;
    const prevProfit = salesPrevMonthEngine.lucroLiquido;
    const curMargin = salesMonthEngine.margemLiquida;
    const prevMargin = salesPrevMonthEngine.margemLiquida;
    const totalCash = cashBalance.saldo;
    const recFuturos = receivables.totalGeral; // UNIFICADO
    const curTicket = salesMonthEngine.ticketMedio;
    const prevTicket = salesPrevMonthEngine.ticketMedio;

    const kpis = {
      faturamentoHoje: { value: salesTodayEngine.faturamentoLiquido, prev: salesYesterdayEngine.faturamentoLiquido, change: pct(salesTodayEngine.faturamentoLiquido, salesYesterdayEngine.faturamentoLiquido) },
      faturamentoMes: { value: salesMonthEngine.faturamentoLiquido, prev: salesPrevMonthEngine.faturamentoLiquido, change: pct(salesMonthEngine.faturamentoLiquido, salesPrevMonthEngine.faturamentoLiquido) },
      lucroLiquido: { value: curProfit, prev: prevProfit, change: pct(curProfit, prevProfit) },
      margemLiquida: { value: curMargin, prev: prevMargin, change: curMargin - prevMargin },
      caixaDisponivel: { value: totalCash },
      recebiveis: { value: recFuturos },
      ticketMedio: { value: curTicket, prev: prevTicket, change: pct(curTicket, prevTicket) },
      totalVendas: { value: salesMonthEngine.totalVendas, prev: salesPrevMonthEngine.totalVendas, change: pct(salesMonthEngine.totalVendas, salesPrevMonthEngine.totalVendas) },
    };

    // ===== PHASE 2: Commercial + Stock + CRM (parallel) =====
    const [
      dailySales, byCategory, topProducts, sellerRanking, peakHours, byPaymentMethod,
      stockValue, lowStockCount, zeroStockCount, deadStock, topDead, topByValue,
      totalActiveC, totalInactiveC, newCustomersC, topClients, recompraCount, totalWithPurchase,
      recentFlow,
    ] = await Promise.all([
      // Commercial
      prisma.$queryRaw<any[]>`
        SELECT DATE("createdAt") as date, COALESCE(SUM(total), 0)::float as total, COUNT(*)::int as count
        FROM sales WHERE "companyId" = ${companyId} AND status = 'concluida' AND "createdAt" >= ${start} AND "createdAt" < ${end}
        GROUP BY DATE("createdAt") ORDER BY date
      `,
      prisma.$queryRaw<any[]>`
        SELECT COALESCE(c.name, 'Sem Categoria') as name, COALESCE(SUM(si.total), 0)::float as total, COUNT(DISTINCT s.id)::int as count
        FROM sale_items si JOIN sales s ON si."saleId" = s.id JOIN products p ON si."productId" = p.id LEFT JOIN categories c ON p."categoryId" = c.id
        WHERE s."companyId" = ${companyId} AND s.status = 'concluida' AND s."createdAt" >= ${start} AND s."createdAt" < ${end}
        GROUP BY c.name ORDER BY total DESC LIMIT 10
      `,
      prisma.$queryRaw<any[]>`
        SELECT p.name, COALESCE(SUM(si.total), 0)::float as total, COALESCE(SUM(si.quantity), 0)::int as quantity
        FROM sale_items si JOIN sales s ON si."saleId" = s.id JOIN products p ON si."productId" = p.id
        WHERE s."companyId" = ${companyId} AND s.status = 'concluida' AND s."createdAt" >= ${start} AND s."createdAt" < ${end}
        GROUP BY p.id, p.name ORDER BY total DESC LIMIT 10
      `,
      prisma.$queryRaw<any[]>`
        SELECT COALESCE(u.name, 'Não identificado') as name, COALESCE(SUM(s.total), 0)::float as total, COUNT(*)::int as count
        FROM sales s LEFT JOIN users u ON s."sellerId" = u.id
        WHERE s."companyId" = ${companyId} AND s.status = 'concluida' AND s."createdAt" >= ${start} AND s."createdAt" < ${end}
        GROUP BY u.name ORDER BY total DESC LIMIT 10
      `,
      prisma.$queryRaw<any[]>`
        SELECT EXTRACT(HOUR FROM "createdAt")::int as hour, COUNT(*)::int as count, COALESCE(SUM(total), 0)::float as total
        FROM sales WHERE "companyId" = ${companyId} AND status = 'concluida' AND "createdAt" >= ${start} AND "createdAt" < ${end}
        GROUP BY EXTRACT(HOUR FROM "createdAt") ORDER BY hour
      `,
      prisma.$queryRaw<any[]>`
        SELECT pm.name, COALESCE(SUM(sp.amount), 0)::float as total, COUNT(*)::int as count, COALESCE(SUM(sp."feeAmount"), 0)::float as fee
        FROM sale_payments sp JOIN payment_methods pm ON sp."paymentMethodId" = pm.id JOIN sales s ON sp."saleId" = s.id
        WHERE s."companyId" = ${companyId} AND s.status = 'concluida' AND s."createdAt" >= ${start} AND s."createdAt" < ${end}
        GROUP BY pm.name ORDER BY total DESC
      `,
      // Stock
      prisma.$queryRaw<any[]>`
        SELECT COALESCE(SUM("salePrice" * "stockQuantity"), 0)::float as sale_value,
               COALESCE(SUM(COALESCE(NULLIF("avgCost",0), "costPrice", 0) * "stockQuantity"), 0)::float as cost_value,
               COALESCE(SUM("stockQuantity"), 0)::int as pieces
        FROM products WHERE "companyId" = ${companyId} AND "isActive" = true
      `,
      prisma.$queryRaw<any[]>`SELECT COUNT(*)::int as count FROM products WHERE "companyId" = ${companyId} AND "isActive" = true AND "stockQuantity" > 0 AND "stockQuantity" <= "minStock"`,
      prisma.product.count({ where: { companyId, isActive: true, stockQuantity: 0 } }),
      prisma.$queryRaw<any[]>`
        SELECT COUNT(*)::int as count, COALESCE(SUM(p."salePrice" * p."stockQuantity"), 0)::float as value
        FROM products p WHERE p."companyId" = ${companyId} AND p."isActive" = true AND p."stockQuantity" > 0
        AND NOT EXISTS (SELECT 1 FROM sale_items si JOIN sales s ON si."saleId" = s.id WHERE si."productId" = p.id AND s.status = 'concluida' AND s."createdAt" > ${sixtyDaysAgo})
      `,
      prisma.$queryRaw<any[]>`
        SELECT p.name, (p."salePrice" * p."stockQuantity")::float as value, p."stockQuantity"::int as quantity
        FROM products p WHERE p."companyId" = ${companyId} AND p."isActive" = true AND p."stockQuantity" > 0
        AND NOT EXISTS (SELECT 1 FROM sale_items si JOIN sales s ON si."saleId" = s.id WHERE si."productId" = p.id AND s.status = 'concluida' AND s."createdAt" > ${sixtyDaysAgo})
        ORDER BY value DESC LIMIT 10
      `,
      prisma.$queryRaw<any[]>`
        SELECT p.name, (p."salePrice" * p."stockQuantity")::float as value, p."stockQuantity"::int as quantity
        FROM products p WHERE p."companyId" = ${companyId} AND p."isActive" = true AND p."stockQuantity" > 0
        ORDER BY value DESC LIMIT 10
      `,
      // CRM
      prisma.customer.count({ where: { companyId, isActive: true, lastPurchase: { gte: thirtyDaysAgo } } }),
      prisma.customer.count({ where: { companyId, isActive: true, OR: [{ lastPurchase: { lt: thirtyDaysAgo } }, { lastPurchase: null }] } }),
      prisma.customer.count({ where: { companyId, createdAt: { gte: start } } }),
      prisma.customer.findMany({ where: { companyId, isActive: true }, select: { name: true, totalPurchased: true, purchaseCount: true, lastPurchase: true, type: true, avgTicket: true }, orderBy: { totalPurchased: 'desc' }, take: 10 }),
      prisma.customer.count({ where: { companyId, isActive: true, purchaseCount: { gte: 2 } } }),
      prisma.customer.count({ where: { companyId, isActive: true, purchaseCount: { gte: 1 } } }),
      // Cash flow recent
      prisma.$queryRaw<any[]>`
        SELECT DATE("createdAt") as date,
          COALESCE(SUM(CASE WHEN type IN ('entrada', 'transferencia_entrada') THEN amount ELSE 0 END), 0)::float as entries,
          COALESCE(SUM(CASE WHEN type IN ('saida', 'transferencia_saida') THEN amount ELSE 0 END), 0)::float as exits
        FROM cash_movements WHERE "companyId" = ${companyId} AND "createdAt" >= ${thirtyDaysAgo}
        GROUP BY DATE("createdAt") ORDER BY date
      `,
    ]);

    const sv = stockValue[0] || { sale_value: 0, cost_value: 0, pieces: 0 };
    const ds = deadStock[0] || { count: 0, value: 0 };
    const lsc = lowStockCount[0] || { count: 0 };
    const payPend = Number(payablesPend._sum?.amount || 0);
    const payOver = Number(payablesOverdue._sum?.amount || 0);
    const recPend = receivables.vencendoEm30Dias;
    const recOver = receivables.vencidasAccountReceivable;
    const feesTotal = Number(totalFeesPeriod._sum?.feeAmount || 0);
    const recompraRate = Number(totalWithPurchase) > 0 ? (Number(recompraCount) / Number(totalWithPurchase)) * 100 : 0;

    // ===== PUSH SCORE OFICIAL (substitui healthScore paralelo) =====
    // Lê snapshot canônico (idempotente). NUNCA recalculado inline.
    let health = { score: 0, status: 'saudavel', factors: [] as { label: string; score: number; status: string; detail: string }[], summary: 'Dados em formação. O score ficará disponível após o período mínimo de operação.' };
    try {
      const ps: PushScoreResult = await recordPushScoreSnapshot(companyId);
      if (ps.status === 'ATIVO' && ps.score !== null) {
        const cls = (ps.classification ?? classifyScore(ps.score)).toUpperCase();
        const statusMap: Record<string, string> = { SAUDAVEL: 'saudavel', ESTAVEL: 'saudavel', ATENCAO: 'atencao', RISCO: 'critico', CRITICO: 'critico' };
        const healthStatus = statusMap[cls] ?? 'atencao';
        const subLabel = (key: string, label: string): { label: string; score: number; status: string; detail: string } => {
          const v = (ps.subscores as any)[key] as number | null;
          const s = v ?? 0;
          return { label, score: Math.round(s), status: s >= 70 ? 'ok' : s >= 45 ? 'atencao' : 'critico', detail: `${Math.round(s)}/100` };
        };
        const factors = [
          subLabel('rentabilityScore', 'Rentabilidade'),
          subLabel('liquidityScore', 'Liquidez'),
          subLabel('inventoryScore', 'Estoque'),
          subLabel('growthScore', 'Crescimento'),
        ];
        const summaries: Record<string, string> = {
          saudavel: 'Empresa operando com indicadores saudáveis. Push Score reflete boa performance geral.',
          atencao: 'Alguns indicadores precisam de atenção. Revise os fatores sinalizados para manter a saúde da operação.',
          critico: 'Indicadores em nível crítico. Ação imediata necessária nos fatores com score baixo.',
        };
        health = { score: Math.round(ps.score), status: healthStatus, factors, summary: summaries[healthStatus] ?? summaries.atencao };
      }
    } catch (e) {
      console.error('[executivo-cockpit] falha ao ler Push Score oficial:', e);
    }

    // ===== INSIGHTS OFICIAIS (Insights Engine — fonte única de diagnóstico) =====
    const SEVERITY_MAP: Record<string, string> = { ALTO: 'danger', MEDIO: 'warning', BAIXO: 'info' };
    let insights: { type: string; title: string; description: string; metric?: string }[] = [];
    try {
      const insResult = await generateInsights(companyId);
      if (insResult.status === 'ATIVO') {
        insights = insResult.insights.slice(0, 10).map((ins: InsightRecord) => ({
          type: SEVERITY_MAP[ins.severity] ?? 'info',
          title: ins.message,
          description: ins.relatedMetrics
            ? Object.entries(ins.relatedMetrics).map(([k, v]) => `${k}: ${typeof v === 'number' ? v.toLocaleString('pt-BR') : v}`).join(' | ')
            : ins.code,
          metric: ins.relatedMetrics?.valor != null ? `R$ ${Number(ins.relatedMetrics.valor).toLocaleString('pt-BR')}` : undefined,
        }));
      }
    } catch (e) {
      console.error('[executivo-cockpit] falha ao carregar insights oficiais:', e);
    }

    return NextResponse.json({
      kpis,
      health,
      commercial: {
        dailySales: (dailySales || []).map((d: any) => ({ date: d.date instanceof Date ? d.date.toISOString().split('T')[0] : String(d.date).split('T')[0], total: Number(d.total), count: Number(d.count) })),
        byCategory: (byCategory || []).map((c: any) => ({ name: String(c.name), total: Number(c.total), count: Number(c.count) })),
        topProducts: (topProducts || []).map((p: any) => ({ name: String(p.name), total: Number(p.total), quantity: Number(p.quantity) })),
        sellerRanking: (sellerRanking || []).map((s: any) => ({ name: String(s.name), total: Number(s.total), count: Number(s.count), ticket: Number(s.count) > 0 ? Number(s.total) / Number(s.count) : 0 })),
        peakHours: (peakHours || []).map((h: any) => ({ hour: Number(h.hour), count: Number(h.count), total: Number(h.total) })),
        byPaymentMethod: (byPaymentMethod || []).map((m: any) => ({ name: String(m.name), total: Number(m.total), count: Number(m.count), fee: Number(m.fee) })),
      },
      financial: {
        cashAccounts: (cashAccounts || []).map(a => ({ name: a.name, type: a.type, balance: a.balance })),
        totalCash,
        receivablesNext30: recPend,
        payablesNext30: payPend,
        overdueReceivables: recOver,
        overduePayables: payOver,
        totalFees: feesTotal,
        projectedCash: totalCash + recPend + recFuturos - payPend - payOver,
        recentFlow: (recentFlow || []).map((f: any) => ({ date: f.date instanceof Date ? f.date.toISOString().split('T')[0] : String(f.date).split('T')[0], entries: Number(f.entries), exits: Number(f.exits) })),
      },
      stock: {
        totalValue: Number(sv.sale_value),
        totalCost: Number(sv.cost_value),
        totalPieces: Number(sv.pieces),
        deadStockValue: Number(ds.value),
        deadStockCount: Number(ds.count),
        lowStockCount: Number(lsc.count),
        zeroStockCount: Number(zeroStockCount),
        topByValue: (topByValue || []).map((p: any) => ({ name: String(p.name), value: Number(p.value), quantity: Number(p.quantity) })),
        topDead: (topDead || []).map((p: any) => ({ name: String(p.name), value: Number(p.value), quantity: Number(p.quantity) })),
      },
      crm: {
        totalActive: Number(totalActiveC),
        totalInactive: Number(totalInactiveC),
        newThisPeriod: Number(newCustomersC),
        recompraRate: Math.round(recompraRate),
        topClients: (topClients || []).map(c => ({ name: c.name, total: c.totalPurchased, count: c.purchaseCount, lastPurchase: c.lastPurchase?.toISOString().split('T')[0] ?? null, type: c.type, ticket: c.avgTicket })),
      },
      insights,
      isAdmin,
    });
  } catch (error: any) {
    console.error('Executivo cockpit error:', error);
    return NextResponse.json({ error: 'Erro ao carregar cockpit executivo' }, { status: 500 });
  }
}
