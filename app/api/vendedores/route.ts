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

    const sellers = await prisma.seller.findMany({
      where: { companyId, isActive: true },
      orderBy: { name: 'asc' },
    });

    // Get sales totals per seller (by name match with User)
    const salesData = await prisma.sale.groupBy({
      by: ['sellerId'],
      where: { companyId, status: 'concluida' },
      _sum: { total: true },
      _count: true,
    });

    // Get seller user IDs
    const users = await prisma.user.findMany({
      where: { companyId },
      select: { id: true, name: true },
    });
    const userMap = new Map(users.map(u => [u.name, u.id]));

    const sellersWithStats = sellers.map(seller => {
      const userId = seller.userId || userMap.get(seller.name);
      const sellerSales = salesData.find(s => s.sellerId === userId);
      const totalSold = sellerSales?._sum?.total ?? 0;
      const salesCount = sellerSales?._count ?? 0;
      const commission = totalSold * (seller.commissionRate / 100);
      return { ...seller, totalSold, salesCount, commission };
    });

    sellersWithStats.sort((a, b) => b.totalSold - a.totalSold);
    return NextResponse.json({ sellers: sellersWithStats });
  } catch (error) {
    console.error('GET /api/vendedores error:', error);
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

    const seller = await prisma.seller.create({
      data: {
        name: body.name,
        phone: body.phone || null,
        commissionRate: parseFloat(body.commissionRate) || 5,
        canEditPrice: body.canEditPrice === true,
        companyId,
        userId: body.userId || null,
      },
    });
    return NextResponse.json(seller, { status: 201 });
  } catch (error) {
    console.error('POST /api/vendedores error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
