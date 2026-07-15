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

    const where: any = { companyId, isActive: true };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
      ];
    }

    const carriers = await prisma.carrier.findMany({ where, orderBy: { name: 'asc' } });
    return NextResponse.json({ carriers });
  } catch (error) {
    console.error('GET /api/transportadoras error:', error);
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

    const carrier = await prisma.carrier.create({
      data: {
        name: body.name,
        phone: body.phone || null,
        city: body.city || null,
        state: body.state || null,
        notes: body.notes || null,
        companyId,
      },
    });
    return NextResponse.json(carrier, { status: 201 });
  } catch (error) {
    console.error('POST /api/transportadoras error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
