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
    const type = url.searchParams.get('type') ?? 'vendas-periodo';
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');

    const dateFilter: any = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate);
    const hasDate = startDate || endDate;

    switch (type) {
      case 'vendas-periodo': {
        const where: any = { companyId, status: 'concluida' };
        if (hasDate) where.createdAt = dateFilter;
        const sales = await prisma.sale.findMany({
          where,
          include: { customer: { select: { name: true } }, seller: { select: { name: true } } },
          orderBy: { createdAt: 'desc' },
          take: 100,
        });
        const totalRevenue = sales.reduce((s, v) => s + v.total, 0);
        return NextResponse.json({ data: sales, summary: { total: sales.length, revenue: totalRevenue, avgTicket: sales.length > 0 ? totalRevenue / sales.length : 0 } });
      }
      case 'vendas-vendedor': {
        const where: any = { companyId, status: 'concluida' };
        if (hasDate) where.createdAt = dateFilter;
        const grouped = await prisma.sale.groupBy({
          by: ['sellerId'],
          where,
          _sum: { total: true },
          _count: true,
          orderBy: { _sum: { total: 'desc' } },
        });
        const sellerIds = grouped.map(g => g.sellerId).filter(Boolean) as string[];
        const sellers = await prisma.user.findMany({ where: { id: { in: sellerIds } }, select: { id: true, name: true } });
        const sellerMap = new Map(sellers.map(s => [s.id, s.name]));
        const data = grouped.map(g => ({ sellerId: g.sellerId, sellerName: sellerMap.get(g.sellerId ?? '') ?? 'N/A', totalSold: g._sum.total ?? 0, salesCount: g._count }));
        return NextResponse.json({ data });
      }
      case 'vendas-produto': {
        const where: any = { sale: { companyId, status: 'concluida' } };
        if (hasDate) where.sale.createdAt = dateFilter;
        const grouped = await prisma.saleItem.groupBy({
          by: ['productId'],
          where,
          _sum: { total: true, quantity: true },
          _count: true,
          orderBy: { _sum: { total: 'desc' } },
          take: 50,
        });
        const productIds = grouped.map(g => g.productId);
        const products = await prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, name: true, sku: true } });
        const productMap: Map<string, any> = new Map(products.map(p => [p.id, p]));
        const data = grouped.map(g => ({ productId: g.productId, productName: productMap.get(g.productId)?.name ?? 'N/A', sku: productMap.get(g.productId)?.sku ?? '', totalSold: g._sum.total ?? 0, qtdSold: g._sum.quantity ?? 0 }));
        return NextResponse.json({ data });
      }
      case 'estoque-atual': {
        const products = await prisma.product.findMany({
          where: { companyId, isActive: true },
          select: { id: true, name: true, sku: true, stockQuantity: true, minStock: true, costPrice: true, avgCost: true, salePrice: true, category: { select: { name: true } } },
          orderBy: { stockQuantity: 'desc' },
        });
        const totalItems = products.reduce((s, p) => s + p.stockQuantity, 0);
        // FONTE OFICIAL: Capital Parado = custo de produtos sem venda há 60+ dias (mesma definição de calculateStockMetrics)
        const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
        const recentSoldIds = new Set(
          (await prisma.saleItem.findMany({
            where: { sale: { companyId, status: 'concluida', createdAt: { gte: sixtyDaysAgo } } },
            select: { productId: true },
            distinct: ['productId'],
          })).map(p => p.productId)
        );
        const capitalParado = products.reduce((s, p) => {
          if (p.stockQuantity > 0 && !recentSoldIds.has(p.id)) {
            return s + ((p.avgCost || p.costPrice || 0) * p.stockQuantity);
          }
          return s;
        }, 0);
        const lowStock = products.filter(p => p.stockQuantity <= p.minStock).length;
        return NextResponse.json({ data: products, summary: { totalProducts: products.length, totalItems, capitalParado: Math.round(capitalParado * 100) / 100, lowStock } });
      }
      case 'produtos-parados': {
        // FONTE OFICIAL: 60 dias, custo = avgCost || costPrice (calculateStockMetrics)
        const sixtyDaysAgoPP = new Date(); sixtyDaysAgoPP.setDate(sixtyDaysAgoPP.getDate() - 60);
        const productsWithSales = await prisma.saleItem.findMany({
          where: { sale: { companyId, status: 'concluida', createdAt: { gte: sixtyDaysAgoPP } } },
          select: { productId: true },
          distinct: ['productId'],
        });
        const soldIds = productsWithSales.map(p => p.productId);
        const stagnant = await prisma.product.findMany({
          where: { companyId, isActive: true, id: { notIn: soldIds }, stockQuantity: { gt: 0 } },
          select: { id: true, name: true, sku: true, stockQuantity: true, costPrice: true, avgCost: true, salePrice: true },
          orderBy: { stockQuantity: 'desc' },
        });
        const capitalParado = stagnant.reduce((s, p) => s + (p.avgCost || p.costPrice || 0) * p.stockQuantity, 0);
        return NextResponse.json({ data: stagnant, summary: { total: stagnant.length, capitalParado: Math.round(capitalParado * 100) / 100 } });
      }
      case 'clientes-inativos': {
        const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const inactive = await prisma.customer.findMany({
          where: { companyId, isActive: true, OR: [{ lastPurchase: { lt: thirtyDaysAgo } }, { lastPurchase: null }] },
          select: { id: true, name: true, phone: true, whatsapp: true, type: true, totalPurchased: true, lastPurchase: true, purchaseCount: true },
          orderBy: { totalPurchased: 'desc' },
        });
        const totalLost = inactive.reduce((s, c) => s + c.totalPurchased, 0);
        return NextResponse.json({ data: inactive, summary: { total: inactive.length, totalPurchased: totalLost } });
      }
      case 'ranking-produtos': {
        const where: any = { sale: { companyId, status: 'concluida' } };
        if (hasDate) where.sale.createdAt = dateFilter;
        const grouped = await prisma.saleItem.groupBy({
          by: ['productId'],
          where,
          _sum: { total: true, quantity: true },
          orderBy: { _sum: { quantity: 'desc' } },
          take: 20,
        });
        const productIds = grouped.map(g => g.productId);
        const products = await prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, name: true, sku: true, category: { select: { name: true } } } });
        const productMap: Map<string, any> = new Map(products.map(p => [p.id, p]));
        const data = grouped.map((g, i) => ({ rank: i + 1, productName: productMap.get(g.productId)?.name ?? 'N/A', sku: productMap.get(g.productId)?.sku ?? '', category: productMap.get(g.productId)?.category?.name ?? '', qtdSold: g._sum.quantity ?? 0, totalSold: g._sum.total ?? 0 }));
        return NextResponse.json({ data });
      }
      case 'ranking-clientes': {
        const customers = await prisma.customer.findMany({
          where: { companyId, isActive: true, purchaseCount: { gt: 0 } },
          select: { id: true, name: true, phone: true, type: true, totalPurchased: true, purchaseCount: true, avgTicket: true, lastPurchase: true },
          orderBy: { totalPurchased: 'desc' },
          take: 20,
        });
        return NextResponse.json({ data: customers });
      }
      default:
        return NextResponse.json({ error: 'Tipo de relatório inválido' }, { status: 400 });
    }
  } catch (error) {
    console.error('GET /api/relatorios error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
