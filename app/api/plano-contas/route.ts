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
    if (!companyId) return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 400 });

    const type = req.nextUrl.searchParams.get('type') || '';
    const activeOnly = req.nextUrl.searchParams.get('active') !== 'false';

    const where: any = { companyId };
    if (type) where.type = type;
    if (activeOnly) where.isActive = true;

    const plans = await prisma.accountPlan.findMany({
      where,
      include: { children: { where: { isActive: activeOnly ? true : undefined }, orderBy: { sortOrder: 'asc' } }, _count: { select: { financialRecords: true } } },
      orderBy: { sortOrder: 'asc' },
    });

    return NextResponse.json(plans);
  } catch (error: any) {
    console.error('Erro ao buscar plano de contas:', error);
    return NextResponse.json({ error: 'Erro ao buscar plano de contas' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const companyId = (session.user as any).companyId;
    const role = (session.user as any).role;
    if (role !== 'administrador' && role !== 'socio' && role !== 'master') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });

    const body = await req.json();
    if (!body?.name || !body?.type) return NextResponse.json({ error: 'Nome e tipo são obrigatórios' }, { status: 400 });

    // Auto-generate code based on type
    const typePrefix: Record<string, string> = { receita: '1', custo: '2', despesa: '3', imposto: '4', financeiro: '5', investimento: '6' };
    const prefix = typePrefix[body.type] || '9';
    const lastPlan = await prisma.accountPlan.findFirst({
      where: { companyId, code: { startsWith: prefix + '.' } },
      orderBy: { code: 'desc' },
    });
    const nextNum = lastPlan?.code ? parseInt(lastPlan.code.split('.')[1] || '0') + 1 : 1;
    const code = body.code || `${prefix}.${String(nextNum).padStart(2, '0')}`;

    const plan = await prisma.accountPlan.create({
      data: {
        name: body.name,
        code,
        type: body.type,
        dreGroup: body.dreGroup || null,
        showInDre: body.showInDre ?? true,
        parentId: body.parentId || null,
        sortOrder: body.sortOrder || nextNum * 10,
        isSystem: false,
        companyId,
      },
    });

    return NextResponse.json(plan, { status: 201 });
  } catch (error: any) {
    console.error('Erro ao criar plano de contas:', error);
    return NextResponse.json({ error: 'Erro ao criar conta' }, { status: 500 });
  }
}
