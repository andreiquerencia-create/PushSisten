export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const variations = await prisma.productVariation.findMany({
      where: { productId: params?.id, isActive: true },
      orderBy: [{ color: 'asc' }, { size: 'asc' }],
    });
    return NextResponse.json(variations);
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: 'Erro ao buscar variações' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const companyId = session.user.companyId;
    const body = await request.json();

    // Support bulk creation
    const items = Array.isArray(body) ? body : [body];
    const created: any[] = [];
    for (const item of items) {
      const product = await prisma.product.findFirst({ where: { id: params?.id, companyId } });
      if (!product) return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 });

      const variation = await prisma.productVariation.create({
        data: {
          productId: params?.id,
          color: item?.color ?? null,
          size: item?.size ?? null,
          grade: item?.grade ?? null,
          sku: item?.sku ?? null,
          barcode: item?.barcode ?? null,
          costPrice: parseFloat(item?.costPrice) || product.costPrice,
          salePrice: parseFloat(item?.salePrice) || product.salePrice,
          stockQuantity: parseInt(item?.stockQuantity) || 0,
          minStock: item?.minStock !== undefined && item?.minStock !== '' ? parseInt(item.minStock) : 0,
        },
      });
      created.push(variation as any);
    }

    // Recalculate product total stock
    const totalStock = await prisma.productVariation.aggregate({
      where: { productId: params?.id, isActive: true },
      _sum: { stockQuantity: true },
    });
    await prisma.product.update({
      where: { id: params?.id },
      data: { stockQuantity: totalStock._sum?.stockQuantity ?? 0 },
    });

    return NextResponse.json(created.length === 1 ? created[0] : created, { status: 201 });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: 'Erro ao criar variação' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const body = await request.json();
    const { variationId, ...data } = body ?? {};
    if (!variationId) return NextResponse.json({ error: 'variationId obrigatório' }, { status: 400 });

    const variation = await prisma.productVariation.update({
      where: { id: variationId },
      data: {
        color: data?.color,
        size: data?.size,
        grade: data?.grade,
        sku: data?.sku,
        barcode: data?.barcode,
        costPrice: data?.costPrice !== undefined ? parseFloat(data.costPrice) : undefined,
        salePrice: data?.salePrice !== undefined ? parseFloat(data.salePrice) : undefined,
        stockQuantity: data?.stockQuantity !== undefined ? parseInt(data.stockQuantity) : undefined,
        minStock: data?.minStock !== undefined ? parseInt(data.minStock) : undefined,
      },
    });

    // Recalculate total stock
    const totalStock = await prisma.productVariation.aggregate({
      where: { productId: params?.id, isActive: true },
      _sum: { stockQuantity: true },
    });
    await prisma.product.update({
      where: { id: params?.id },
      data: { stockQuantity: totalStock._sum?.stockQuantity ?? 0 },
    });

    return NextResponse.json(variation);
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: 'Erro ao atualizar variação' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const url = new URL(request.url);
    const variationId = url.searchParams.get('variationId');
    if (!variationId) return NextResponse.json({ error: 'variationId obrigatório' }, { status: 400 });

    await prisma.productVariation.update({ where: { id: variationId }, data: { isActive: false } });

    // Recalculate total stock
    const totalStock = await prisma.productVariation.aggregate({
      where: { productId: params?.id, isActive: true },
      _sum: { stockQuantity: true },
    });
    await prisma.product.update({
      where: { id: params?.id },
      data: { stockQuantity: totalStock._sum?.stockQuantity ?? 0 },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: 'Erro ao excluir variação' }, { status: 500 });
  }
}
