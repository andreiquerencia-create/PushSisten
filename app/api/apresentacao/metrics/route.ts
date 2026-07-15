export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { DEMO_COMPANY_NAME } from '@/lib/demo-registry';
import { computePushScore } from '@/lib/push-score-engine';

/**
 * Métricas reais da empresa DEMO para o Modo Apresentação.
 * Somente leitura. Exige que a empresa da sessão seja a DEMO oficial
 * (validação no backend). Não altera nenhum dado.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    const companyId = (session.user as any).companyId as string | undefined;
    const companyName = (session.user as any).companyName as string | undefined;
    const isMaster = (session.user as any).isMaster === true;

    // Resolve a empresa DEMO: Master sempre usa a DEMO oficial; demais usam a própria sessão (se for DEMO).
    let targetId = companyId || null;
    if (isMaster || companyName !== DEMO_COMPANY_NAME) {
      const demo = await prisma.company.findFirst({ where: { name: DEMO_COMPANY_NAME }, select: { id: true } });
      targetId = demo?.id || targetId;
    }
    if (!targetId) return NextResponse.json({ error: 'Empresa DEMO não encontrada.' }, { status: 404 });

    const company = await prisma.company.findUnique({ where: { id: targetId }, select: { id: true, name: true } });
    if (!company || company.name !== DEMO_COMPANY_NAME) {
      return NextResponse.json({ error: 'Modo Apresentação disponível apenas na loja de demonstração.' }, { status: 403 });
    }
    const cid = company.id;
    const now = new Date();
    const d30 = new Date(now.getTime() - 30 * 86400000);

    const [salesAll, sales30, prodCount, custCount, ps,
      arOpen, apOpen, instOpen, instOverdue, cashSum] = await Promise.all([
      prisma.sale.aggregate({ where: { companyId: cid }, _sum: { total: true }, _count: true }),
      prisma.sale.aggregate({ where: { companyId: cid, createdAt: { gte: d30 } }, _sum: { total: true }, _count: true }),
      prisma.product.count({ where: { companyId: cid } }),
      prisma.customer.count({ where: { companyId: cid } }),
      computePushScore(cid, now).catch(() => null),
      prisma.accountReceivable.aggregate({ where: { companyId: cid, receivedDate: null }, _sum: { amount: true }, _count: true }),
      prisma.accountPayable.aggregate({ where: { companyId: cid, paidDate: null }, _sum: { amount: true }, _count: true }),
      prisma.installment.aggregate({ where: { companyId: cid, status: { notIn: ['PAID','CANCELLED'] } }, _sum: { amount: true }, _count: true }),
      prisma.installment.aggregate({ where: { companyId: cid, status: { notIn: ['PAID','CANCELLED'] }, dueDate: { lt: now } }, _sum: { amount: true }, _count: true }),
      prisma.cashMovement.aggregate({ where: { companyId: cid }, _sum: { amount: true } }),
    ]);

    const num = (v: any) => Number(v || 0);
    return NextResponse.json({
      company: { id: cid, name: company.name },
      executive: {
        faturamentoTotal: num(salesAll._sum.total),
        vendasTotal: salesAll._count,
        faturamento30: num(sales30._sum.total),
        vendas30: sales30._count,
        ticketMedio30: sales30._count ? num(sales30._sum.total) / sales30._count : 0,
        produtos: prodCount,
        clientes: custCount,
      },
      pushScore: ps ? {
        score: ps.score, classification: ps.classification, status: ps.status,
        subscores: ps.subscores,
      } : null,
      fluxoCaixa: {
        aReceber: num(arOpen._sum.amount), aReceberQtd: arOpen._count,
        aPagar: num(apOpen._sum.amount), aPagarQtd: apOpen._count,
        saldoCaixa: num(cashSum._sum.amount),
      },
      crediario: {
        emAberto: num(instOpen._sum.amount), parcelasAbertas: instOpen._count,
        emAtraso: num(instOverdue._sum.amount), parcelasAtraso: instOverdue._count,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erro ao carregar métricas.' }, { status: 500 });
  }
}
