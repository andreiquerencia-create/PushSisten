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
    const page = parseInt(url.searchParams.get('page') ?? '1');
    const limit = parseInt(url.searchParams.get('limit') ?? '20');

    const where: any = { companyId, isActive: true };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { cnpj: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [suppliers, total] = await Promise.all([
      prisma.supplier.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { name: 'asc' } }),
      prisma.supplier.count({ where }),
    ]);

    return NextResponse.json({ suppliers, total, pages: Math.ceil(total / limit) });
  } catch (error) {
    console.error('GET /api/fornecedores error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const companyId = session.user.companyId;
    const body = await request.json();

    if (!body.name) return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 });

    const supplier = await prisma.supplier.create({
      data: {
        name: body.name,
        phone: body.phone || null,
        whatsapp: body.whatsapp || null,
        email: body.email || null,
        city: body.city || null,
        state: body.state || null,
        cnpj: body.cnpj || null,
        notes: body.notes || null,
        companyId,
      },
    });

    return NextResponse.json(supplier, { status: 201 });
  } catch (error) {
    console.error('POST /api/fornecedores error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
