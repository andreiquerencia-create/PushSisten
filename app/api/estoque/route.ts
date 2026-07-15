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
    const filter = url.searchParams.get('filter') ?? '';
    const search = url.searchParams.get('search') ?? '';

    const where: any = { companyId, isActive: true };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
      ];
    }

    let products = await prisma.product.findMany({
      where,
      include: { category: { select: { name: true } } },
      orderBy: { name: 'asc' },
    });

    if (filter === 'baixo') {
      products = (products ?? []).filter((p: any) => (p?.stockQuantity ?? 0) <= (p?.minStock ?? 0));
    } else if (filter === 'parado') {
      // FONTE OFICIAL: 60 dias (mesma definição de calculateStockMetrics)
      const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
      const recentSaleProductIds = await prisma.saleItem.findMany({
        where: { sale: { companyId, status: 'concluida', createdAt: { gte: sixtyDaysAgo } } },
        select: { productId: true },
        distinct: ['productId'],
      });
      const activeIds = new Set((recentSaleProductIds ?? []).map((p: any) => p?.productId));
      products = (products ?? []).filter((p: any) => !activeIds.has(p?.id));
    }

    return NextResponse.json(products ?? []);
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: 'Erro ao buscar estoque' }, { status: 500 });
  }
}
