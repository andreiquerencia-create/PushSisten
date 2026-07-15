export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const companyId = session.user.companyId;
    const url = new URL(request.url);
    const search = url.searchParams.get('search') ?? '';
    const type = url.searchParams.get('type') ?? '';
    const tag = url.searchParams.get('tag') ?? '';
    const page = parseInt(url.searchParams.get('page') ?? '1');
    const limit = parseInt(url.searchParams.get('limit') ?? '20');

    const where: any = { companyId, isActive: true };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (type) where.type = type;
    if (tag) where.tags = { has: tag };

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.customer.count({ where }),
    ]);

    return NextResponse.json({ customers: customers ?? [], total, pages: Math.ceil(total / limit) });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: 'Erro ao buscar clientes' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const companyId = session.user.companyId;
    const body = await request.json();
    if (!body?.name) return NextResponse.json({ error: 'Nome obrigatório' }, { status: 400 });

    // Auto-assign seller when vendedor creates a customer
    const sellerId = body?.sellerId ?? (session.user.sellerId || null);

    const customer = await prisma.customer.create({
      data: {
        name: body.name,
        email: body?.email ?? null,
        phone: body?.phone ?? null,
        whatsapp: body?.whatsapp ?? null,
        city: body?.city ?? null,
        state: body?.state ?? null,
        type: body?.type ?? 'varejo',
        tags: body?.tags ?? [],
        sellerId,
        companyId,
      },
    });
    return NextResponse.json(customer, { status: 201 });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: 'Erro ao criar cliente' }, { status: 500 });
  }
}
