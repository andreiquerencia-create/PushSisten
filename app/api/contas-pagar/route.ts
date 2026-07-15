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
      prisma.accountPayable.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { dueDate: 'asc' },
        include: { supplier: { select: { id: true, name: true } }, accountPlan: { select: { id: true, name: true, code: true } } },
      }),
      prisma.accountPayable.count({ where }),
    ]);

    const summary = await prisma.accountPayable.groupBy({
      by: ['status'],
      where: { companyId },
      _sum: { amount: true },
      _count: true,
    });

    const totalPendente = summary.find(s => s.status === 'pendente')?._sum?.amount ?? 0;
    const totalPago = summary.find(s => s.status === 'pago')?._sum?.amount ?? 0;
    const totalVencido = summary.find(s => s.status === 'vencido')?._sum?.amount ?? 0;
    const countPendente = summary.find(s => s.status === 'pendente')?._count ?? 0;

    return NextResponse.json({ records, total, pages: Math.ceil(total / limit), summary: { totalPendente, totalPago, totalVencido, countPendente } });
  } catch (error) {
    console.error('GET /api/contas-pagar error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

// Installment date calculation
function addPeriod(date: Date, periodicity: string, customDays: number, n: number): Date {
  const d = new Date(date);
  switch (periodicity) {
    case 'diaria': d.setDate(d.getDate() + n); break;
    case 'semanal': d.setDate(d.getDate() + (n * 7)); break;
    case 'quinzenal': d.setDate(d.getDate() + (n * 15)); break;
    case 'mensal': d.setMonth(d.getMonth() + n); break;
    case 'personalizada': d.setDate(d.getDate() + (n * (customDays || 30))); break;
    default: d.setMonth(d.getMonth() + n);
  }
  return d;
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
      return NextResponse.json({ error: 'Descrição, valor e vencimento são obrigatórios' }, { status: 400 });
    }

    const totalAmount = parseFloat(body.amount);
    if (isNaN(totalAmount) || totalAmount <= 0) {
      return NextResponse.json({ error: 'Valor inválido' }, { status: 400 });
    }

    const installments = parseInt(body.installments) || 1;
    const periodicity = body.periodicity || 'mensal';
    const customDays = parseInt(body.customDays) || 30;
    const firstDueDate = new Date(body.dueDate);
    const isRecurring = body.isRecurring === true;
    const recurringPeriodicity = body.recurringPeriodicity || null;
    const recurringEndDate = body.recurringEndDate ? new Date(body.recurringEndDate) : null;

    // Custom installment values/dates
    const customInstallments: { amount?: number; dueDate?: string }[] = body.customInstallments || [];

    const records: any[] = [];

    if (installments <= 1) {
      // Single payment
      const record = await prisma.accountPayable.create({
        data: {
          description: body.description,
          amount: totalAmount,
          dueDate: firstDueDate,
          status: body.status || 'pendente',
          supplierId: body.supplierId || null,
          notes: body.notes || null,
          companyId,
          accountPlanId: body.accountPlanId || null,
          installmentNum: 1,
          totalInstallments: 1,
          isRecurring,
          recurringPeriodicity: isRecurring ? recurringPeriodicity : null,
          recurringEndDate: isRecurring ? recurringEndDate : null,
        },
      });
      records.push(record);
    } else {
      // Generate installments
      const installmentAmount = Math.floor((totalAmount / installments) * 100) / 100;
      let remaining = totalAmount;

      for (let i = 0; i < installments; i++) {
        const isLast = i === installments - 1;
        // Custom values take priority
        const customInst = customInstallments[i];
        const amt = customInst?.amount ? parseFloat(String(customInst.amount)) : (isLast ? remaining : installmentAmount);
        const dueDate = customInst?.dueDate ? new Date(customInst.dueDate) : addPeriod(firstDueDate, periodicity, customDays, i);

        remaining -= amt;

        const record = await prisma.accountPayable.create({
          data: {
            description: `${body.description} (${i + 1}/${installments})`,
            amount: amt,
            dueDate,
            status: body.status || 'pendente',
            supplierId: body.supplierId || null,
            notes: body.notes || null,
            companyId,
            accountPlanId: body.accountPlanId || null,
            installmentNum: i + 1,
            totalInstallments: installments,
          },
        });
        records.push(record);
      }
    }

    // Activity log
    await prisma.activityLog.create({
      data: {
        action: 'create_ap',
        description: `Conta a pagar criada: ${body.description} - R$ ${totalAmount.toFixed(2)}${installments > 1 ? ` (${installments}x)` : ''}`,
        entityType: 'accountPayable',
        entityId: records[0]?.id,
        companyId,
        userId: (session.user as any)?.id ?? null,
        userName: session.user?.name ?? null,
        metadata: { totalAmount, installments, periodicity },
      },
    }).catch(() => {});

    return NextResponse.json({ records, count: records.length }, { status: 201 });
  } catch (error) {
    console.error('POST /api/contas-pagar error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
