export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { generateNextSku, isSkuDuplicate } from '@/lib/sku';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const companyId = session.user.companyId;
    const url = new URL(request.url);
    const search = url.searchParams.get('search') ?? '';
    const categoryId = url.searchParams.get('categoryId') ?? '';
    const page = parseInt(url.searchParams.get('page') ?? '1');
    const limit = parseInt(url.searchParams.get('limit') ?? '20');

    const where: any = { companyId, isActive: true };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (categoryId) where.categoryId = categoryId;

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: { category: { select: { id: true, name: true } }, variations: { where: { isActive: true }, orderBy: { size: 'asc' } }, priceTables: { where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }, { minQuantity: 'asc' }] } },
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.product.count({ where }),
    ]);

    return NextResponse.json({ products: products ?? [], total, pages: Math.ceil(total / limit) });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: 'Erro ao buscar produtos' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const role = session.user.role;
    if (role === 'vendedor') return NextResponse.json({ error: 'Sem permissão para criar produtos' }, { status: 403 });
    const companyId = session.user.companyId;
    const body = await request.json();
    const { name, sku, barcode, description, costPrice, salePrice, stockQuantity, minStock, categoryId, imageUrl, cloudStoragePath, isPublic } = body ?? {};
    if (!name) return NextResponse.json({ error: 'Nome obrigatório' }, { status: 400 });

    // SKU: usar manual se fornecido, senão gerar automaticamente
    let finalSku: string;
    const providedSku = sku?.trim() || '';

    if (providedSku) {
      // SKU manual — validar unicidade dentro da empresa
      const duplicate = await isSkuDuplicate(providedSku, companyId);
      if (duplicate) {
        return NextResponse.json(
          { error: `SKU "${providedSku}" já existe nesta empresa. Escolha outro ou deixe em branco para gerar automaticamente.` },
          { status: 400 }
        );
      }
      finalSku = providedSku;
    } else {
      // SKU automático — gerar sequencial
      finalSku = await generateNextSku(companyId);
    }

    const cost = parseFloat(costPrice) || 0;
    const sale = parseFloat(salePrice) || 0;
    const margin = sale > 0 ? ((sale - cost) / sale) * 100 : 0;

    const product = await prisma.product.create({
      data: {
        name,
        sku: finalSku,
        barcode: barcode ?? null,
        description: description ?? null,
        costPrice: cost,
        salePrice: sale,
        margin,
        stockQuantity: parseInt(stockQuantity) || 0,
        minStock: minStock !== undefined && minStock !== '' ? parseInt(minStock) : 0,
        categoryId: categoryId || null,
        imageUrl: imageUrl ?? null,
        cloudStoragePath: cloudStoragePath ?? null,
        isPublic: isPublic ?? true,
        companyId,
      },
      include: { category: { select: { id: true, name: true } } },
    });
    return NextResponse.json(product, { status: 201 });
  } catch (error: any) {
    console.error('Erro ao criar produto:', error);
    // Tratar erro de constraint único
    if (error?.code === 'P2002') {
      return NextResponse.json(
        { error: 'SKU já existe nesta empresa. Tente novamente.' },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: 'Erro ao criar produto' }, { status: 500 });
  }
}
