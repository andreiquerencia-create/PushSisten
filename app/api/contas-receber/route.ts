export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { validateAccountEntry } from '@/lib/data-guards';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const companyId = session.user.companyId;
    const url = new URL(request.url);
    const status = url.searchParams.get('status') ?? '';
    const page = parseInt(url.searchParams.get('page') ?? '1');
    const limit = parseInt(url.searchParams.get('limit') ?? '50');
    const search = url.searchParams.get('search') ?? '';
    const unclassified = url.searchParams.get('unclassified') === 'true';
    const accountPlanId = url.searchParams.get('accountPlanId') ?? '';

    const where: any = { companyId };
    if (status) where.status = status;
    if (search) where.description = { contains: search, mode: 'insensitive' };
    if (unclassified) where.accountPlanId = null;
    else if (accountPlanId) where.accountPlanId = accountPlanId;

    const [records, total] = await Promise.all([
      prisma.accountReceivable.findMany({
        where, skip: (page - 1) * limit, take: limit,
        orderBy: { dueDate: 'asc' },
        include: {
          customer: { select: { id: true, name: true } },
          accountPlan: { select: { id: true, name: true, code: true } },
        },
      }),
      prisma.accountReceivable.count({ where }),
    ]);

    const summary = await prisma.accountReceivable.groupBy({
      by: ['status'],
      where: { companyId },
      _sum: { amount: true },
      _count: true,
    });

    const totalPendente = summary.find(s => s.status === 'pendente')?._sum?.amount ?? 0;
    const totalRecebido = summary.find(s => s.status === 'recebido')?._sum?.amount ?? 0;
    const totalVencido = summary.find(s => s.status === 'vencido')?._sum?.amount ?? 0;

    return NextResponse.json({ records, total, pages: Math.ceil(total / limit), summary: { totalPendente, totalRecebido, totalVencido } });
  } catch (error) {
    console.error('GET /api/contas-receber error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const companyId = session.user.companyId;
    const body = await request.json();

    // === DATA GUARD ===
    const guard = validateAccountEntry(body);
    if (!guard.valid) return NextResponse.json({ error: guard.errors.join(' | ') }, { status: 400 });

    if (!body.description || !body.amount || !body.dueDate) {
      return NextResponse.json({ error: 'Campos obrigatórios não preenchidos' }, { status: 400 });
    }

    // Default accountPlanId to 1.01 "Receita de Vendas" when not provided
    let accountPlanId: string | null = body.accountPlanId || null;
    if (!accountPlanId) {
      const receitaPlan = await prisma.accountPlan.findFirst({
        where: { companyId, code: '1.1', isActive: true },
      });
      accountPlanId = receitaPlan?.id || null;
    }

    const record = await prisma.accountReceivable.create({
      data: {
        description: body.description,
        amount: parseFloat(body.amount),
        dueDate: new Date(body.dueDate),
        status: body.status || 'pendente',
        customerId: body.customerId || null,
        saleId: body.saleId || null,
        accountPlanId,
        notes: body.notes || null,
        companyId,
      },
    });
    return NextResponse.json(record, { status: 201 });
  } catch (error) {
    console.error('POST /api/contas-receber error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
