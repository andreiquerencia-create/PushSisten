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
    const code = new URL(request.url).searchParams.get('code') ?? '';
    if (!code) return NextResponse.json({ error: 'Código não informado' }, { status: 400 });

    // Search in variations first (more specific)
    const variation = await prisma.productVariation.findFirst({
      where: { barcode: code, isActive: true, product: { companyId, isActive: true } },
      include: { product: { include: { category: { select: { name: true } } } } },
    });
    if (variation) {
      return NextResponse.json({
        type: 'variation',
        product: variation.product,
        variation: { id: variation.id, color: variation.color, size: variation.size, grade: variation.grade, sku: variation.sku, barcode: variation.barcode, salePrice: variation.salePrice, stockQuantity: variation.stockQuantity },
      });
    }

    // Search in products
    const product = await prisma.product.findFirst({
      where: { companyId, isActive: true, OR: [{ barcode: code }, { sku: code }] },
      include: { category: { select: { name: true } }, variations: { where: { isActive: true }, orderBy: { size: 'asc' } } },
    });
    if (product) {
      return NextResponse.json({ type: 'product', product });
    }

    // Also search variation SKU
    const varBySku = await prisma.productVariation.findFirst({
      where: { sku: code, isActive: true, product: { companyId, isActive: true } },
      include: { product: { include: { category: { select: { name: true } } } } },
    });
    if (varBySku) {
      return NextResponse.json({
        type: 'variation',
        product: varBySku.product,
        variation: { id: varBySku.id, color: varBySku.color, size: varBySku.size, grade: varBySku.grade, sku: varBySku.sku, barcode: varBySku.barcode, salePrice: varBySku.salePrice, stockQuantity: varBySku.stockQuantity },
      });
    }

    return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: 'Erro na busca' }, { status: 500 });
  }
}
