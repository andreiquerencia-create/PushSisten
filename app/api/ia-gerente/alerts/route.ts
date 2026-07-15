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
    if (!companyId) return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 400 });

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const category = searchParams.get('category');
    const resolved = searchParams.get('resolved');
    const limit = parseInt(searchParams.get('limit') ?? '50');

    const where: any = { companyId };
    if (type) where.type = type;
    if (category) where.category = category;
    if (resolved !== null && resolved !== undefined && resolved !== '') {
      where.isResolved = resolved === 'true';
    }

    const alerts = await prisma.iAAlert.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      take: limit,
    });

    const counts = await Promise.all([
      prisma.iAAlert.count({ where: { companyId, type: 'critical', isResolved: false } }),
      prisma.iAAlert.count({ where: { companyId, type: 'important', isResolved: false } }),
      prisma.iAAlert.count({ where: { companyId, type: 'observation', isResolved: false } }),
      prisma.iAAlert.count({ where: { companyId, isResolved: false } }),
    ]);

    return NextResponse.json({
      alerts,
      counts: {
        critical: counts[0],
        important: counts[1],
        observation: counts[2],
        total: counts[3],
      },
    });
  } catch (error: any) {
    console.error('Alerts GET error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const companyId = session.user.companyId;
    if (!companyId) return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 400 });

    const body = await request.json();
    const { id, isResolved } = body;

    if (!id) return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 });

    const alert = await prisma.iAAlert.updateMany({
      where: { id, companyId },
      data: {
        isResolved: isResolved ?? true,
        resolvedAt: isResolved ? new Date() : null,
        resolvedBy: session.user.name ?? session.user.email ?? null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Alerts PUT error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const companyId = session.user.companyId;
    if (!companyId) return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 400 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (id) {
      await prisma.iAAlert.deleteMany({ where: { id, companyId } });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Alerts DELETE error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
