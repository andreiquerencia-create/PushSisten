export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

/**
 * GET /api/sem-classificacao
 * 
 * Returns all unclassified entries from:
 *  - AccountPayable
 *  - AccountReceivable
 *  - FinancialRecord
 * 
 * Query params:
 *  - source: 'pagar' | 'receber' | 'financeiro' | 'all' (default 'all')
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    const companyId = session.user.companyId;
    if (!companyId) {
      return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const source = searchParams.get('source') || 'all';

    const results: any = { pagar: [], receber: [], financeiro: [] };

    if (source === 'all' || source === 'pagar') {
      const pagar = await prisma.accountPayable.findMany({
        where: { companyId, accountPlanId: null },
        orderBy: { dueDate: 'desc' },
        take: 500,
        include: { supplier: { select: { name: true } } },
      });
      results.pagar = pagar.map(p => ({
        id: p.id,
        source: 'pagar' as const,
        description: p.description,
        amount: p.amount,
        date: p.dueDate.toISOString(),
        direction: 'saida' as const,
        status: p.status,
        supplierName: p.supplier?.name || null,
      }));
    }

    if (source === 'all' || source === 'receber') {
      const receber = await prisma.accountReceivable.findMany({
        where: { companyId, accountPlanId: null },
        orderBy: { dueDate: 'desc' },
        take: 500,
        include: { customer: { select: { name: true } } },
      });
      results.receber = receber.map(r => ({
        id: r.id,
        source: 'receber' as const,
        description: r.description,
        amount: r.amount,
        date: r.dueDate.toISOString(),
        direction: 'entrada' as const,
        status: r.status,
        customerName: r.customer?.name || null,
      }));
    }

    if (source === 'all' || source === 'financeiro') {
      const fin = await prisma.financialRecord.findMany({
        where: { companyId, accountPlanId: null },
        orderBy: { date: 'desc' },
        take: 500,
      });
      results.financeiro = fin.map(f => ({
        id: f.id,
        source: 'financeiro' as const,
        description: f.description,
        amount: f.amount,
        date: f.date.toISOString(),
        direction: f.type === 'entrada' ? 'entrada' as const : 'saida' as const,
        status: 'concluido',
      }));
    }

    const total = results.pagar.length + results.receber.length + results.financeiro.length;

    return NextResponse.json({
      pagar: results.pagar,
      receber: results.receber,
      financeiro: results.financeiro,
      total,
    });
  } catch (error: any) {
    console.error('Sem classificação GET error:', error);
    return NextResponse.json({ error: 'Erro ao buscar' }, { status: 500 });
  }
}

/**
 * POST /api/sem-classificacao
 * 
 * Batch classifies entries.
 * 
 * Body:
 *  - items: [{ source, id, accountPlanId }, ...]
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    const companyId = session.user.companyId;
    if (!companyId) {
      return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 400 });
    }

    const body = await request.json();
    const items: Array<{ source: string; id: string; accountPlanId: string }> = body.items || [];

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Nenhum item informado' }, { status: 400 });
    }

    let updatedPagar = 0;
    let updatedReceber = 0;
    let updatedFinanceiro = 0;

    // Validate accountPlanIds: all must belong to this company
    const planIds = Array.from(new Set(items.map(i => i.accountPlanId).filter(Boolean)));
    const validPlans = await prisma.accountPlan.findMany({
      where: { companyId, id: { in: planIds } },
      select: { id: true },
    });
    const validIds = new Set(validPlans.map(p => p.id));

    for (const item of items) {
      if (!validIds.has(item.accountPlanId)) continue;

      try {
        if (item.source === 'pagar') {
          const r = await prisma.accountPayable.updateMany({
            where: { id: item.id, companyId, accountPlanId: null },
            data: { accountPlanId: item.accountPlanId },
          });
          updatedPagar += r.count;
        } else if (item.source === 'receber') {
          const r = await prisma.accountReceivable.updateMany({
            where: { id: item.id, companyId, accountPlanId: null },
            data: { accountPlanId: item.accountPlanId },
          });
          updatedReceber += r.count;
        } else if (item.source === 'financeiro') {
          const r = await prisma.financialRecord.updateMany({
            where: { id: item.id, companyId, accountPlanId: null },
            data: { accountPlanId: item.accountPlanId },
          });
          updatedFinanceiro += r.count;
        }
      } catch (err) {
        console.error(`Failed to update ${item.source} ${item.id}:`, err);
      }
    }

    return NextResponse.json({
      success: true,
      updated: updatedPagar + updatedReceber + updatedFinanceiro,
      details: { pagar: updatedPagar, receber: updatedReceber, financeiro: updatedFinanceiro },
    });
  } catch (error: any) {
    console.error('Sem classificação POST error:', error);
    return NextResponse.json({ error: 'Erro ao classificar' }, { status: 500 });
  }
}
