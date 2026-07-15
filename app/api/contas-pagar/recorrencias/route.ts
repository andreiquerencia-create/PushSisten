export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

function addPeriod(date: Date, periodicity: string, n: number): Date {
  const d = new Date(date);
  switch (periodicity) {
    case 'diaria': d.setDate(d.getDate() + n); break;
    case 'semanal': d.setDate(d.getDate() + (n * 7)); break;
    case 'quinzenal': d.setDate(d.getDate() + (n * 15)); break;
    case 'mensal': d.setMonth(d.getMonth() + n); break;
    case 'bimestral': d.setMonth(d.getMonth() + (n * 2)); break;
    case 'trimestral': d.setMonth(d.getMonth() + (n * 3)); break;
    case 'semestral': d.setMonth(d.getMonth() + (n * 6)); break;
    case 'anual': d.setFullYear(d.getFullYear() + n); break;
    default: d.setMonth(d.getMonth() + n);
  }
  return d;
}

// POST: Generate next recurring entries
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const companyId = session.user.companyId;

    // Find all recurring AP templates
    const templates = await prisma.accountPayable.findMany({
      where: {
        companyId,
        isRecurring: true,
        status: { in: ['pendente', 'pago'] },
      },
      include: { supplier: { select: { id: true, name: true } } },
    });

    // For each template, check if we need to generate the next occurrence
    const now = new Date();
    const generated: any[] = [];

    for (const tpl of templates) {
      if (!tpl.recurringPeriodicity) continue;
      // Check endDate
      if (tpl.recurringEndDate && tpl.recurringEndDate < now) continue;

      // Find existing generated entries for this parent
      const existing = await prisma.accountPayable.findMany({
        where: {
          companyId,
          parentRecurringId: tpl.id,
        },
        orderBy: { dueDate: 'desc' },
        take: 1,
      });

      // Calculate next due date
      const lastDueDate = existing.length > 0 ? existing[0].dueDate : tpl.dueDate;
      const nextDueDate = addPeriod(lastDueDate, tpl.recurringPeriodicity, 1);

      // Check end date
      if (tpl.recurringEndDate && nextDueDate > tpl.recurringEndDate) continue;

      // Generate if nextDueDate is within next 60 days
      const sixtyDaysFromNow = new Date();
      sixtyDaysFromNow.setDate(sixtyDaysFromNow.getDate() + 60);

      if (nextDueDate <= sixtyDaysFromNow) {
        // Check if an entry with this exact date already exists
        const alreadyExists = await prisma.accountPayable.findFirst({
          where: {
            companyId,
            parentRecurringId: tpl.id,
            dueDate: {
              gte: new Date(nextDueDate.getFullYear(), nextDueDate.getMonth(), nextDueDate.getDate()),
              lt: new Date(nextDueDate.getFullYear(), nextDueDate.getMonth(), nextDueDate.getDate() + 1),
            },
          },
        });

        if (!alreadyExists) {
          // Clean base description (remove old period suffixes)
          const baseDesc = tpl.description.replace(/\s*\(\d{2}\/\d{4}\)$/, '');
          const monthYear = `${String(nextDueDate.getMonth() + 1).padStart(2, '0')}/${nextDueDate.getFullYear()}`;

          const record = await prisma.accountPayable.create({
            data: {
              description: `${baseDesc} (${monthYear})`,
              amount: tpl.amount,
              dueDate: nextDueDate,
              status: 'pendente',
              supplierId: tpl.supplierId,
              companyId,
              notes: `Gerado automaticamente da recorrência: ${tpl.description}`,
              parentRecurringId: tpl.id,
            },
          });
          generated.push(record);
        }
      }
    }

    // Log
    if (generated.length > 0) {
      await prisma.activityLog.create({
        data: {
          action: 'generate_recurring',
          description: `${generated.length} conta(s) recorrente(s) gerada(s) automaticamente`,
          entityType: 'accountPayable',
          entityId: generated[0]?.id,
          companyId,
          userId: (session.user as any)?.id ?? null,
          userName: session.user?.name ?? null,
          metadata: { count: generated.length, ids: generated.map(g => g.id) },
        },
      }).catch(() => {});
    }

    return NextResponse.json({ generated, count: generated.length });
  } catch (error) {
    console.error('POST /api/contas-pagar/recorrencias error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

// GET: List recurring templates
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const companyId = session.user.companyId;

    const records = await prisma.accountPayable.findMany({
      where: { companyId, isRecurring: true },
      include: { supplier: { select: { id: true, name: true } } },
      orderBy: { description: 'asc' },
    });

    return NextResponse.json({ records });
  } catch (error) {
    console.error('GET /api/contas-pagar/recorrencias error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
