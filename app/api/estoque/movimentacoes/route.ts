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
    const productId = url.searchParams.get('productId') ?? '';
    const type = url.searchParams.get('type') ?? '';
    const userId = url.searchParams.get('userId') ?? '';
    const supplierId = url.searchParams.get('supplierId') ?? '';
    const search = url.searchParams.get('search') ?? '';
    const startDate = url.searchParams.get('startDate') ?? '';
    const endDate = url.searchParams.get('endDate') ?? '';
    const page = parseInt(url.searchParams.get('page') ?? '1');
    const limit = parseInt(url.searchParams.get('limit') ?? '30');

    const where: any = { companyId };
    if (productId) where.productId = productId;
    if (type) where.type = type;
    if (userId) where.userId = userId;
    if (supplierId) {
      where.stockEntry = { supplierId };
    }
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate + 'T23:59:59');
    }
    if (search) {
      where.OR = [
        { product: { name: { contains: search, mode: 'insensitive' } } },
        { product: { sku: { contains: search, mode: 'insensitive' } } },
        { reason: { contains: search, mode: 'insensitive' } },
        { reference: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [movements, total] = await Promise.all([
      prisma.inventoryMovement.findMany({
        where,
        include: {
          product: { select: { id: true, name: true, sku: true } },
          variation: { select: { id: true, color: true, size: true, grade: true } },
          stockEntry: { select: { id: true, entryNumber: true, supplier: { select: { name: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.inventoryMovement.count({ where }),
    ]);

    return NextResponse.json({ movements: movements ?? [], total, pages: Math.ceil(total / limit) });
  } catch (error: any) {
    console.error('Erro movimentações GET:', error);
    return NextResponse.json({ error: 'Erro ao buscar movimentações' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const role = session.user.role;
    if (role === 'vendedor') return NextResponse.json({ error: 'Sem permissão para movimentar estoque' }, { status: 403 });
    if (role === 'gerente') return NextResponse.json({ error: 'Sem permissão para ajustar estoque' }, { status: 403 });
    const companyId = session.user.companyId;
    const body = await request.json();
    const { productId, variationId, type, quantity, reason } = body ?? {};

    if (!productId || !type || quantity === undefined) {
      return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 });
    }

    const qty = parseInt(quantity) || 0;
    if (qty <= 0 && type !== 'ajuste_manual' && type !== 'inventario') {
      return NextResponse.json({ error: 'Quantidade inválida' }, { status: 400 });
    }

    // If variation, update variation stock; otherwise product stock
    const isVariation = !!variationId;

    let previousQty = 0;
    let newQty = 0;

    if (isVariation) {
      const variation = await prisma.productVariation.findUnique({ where: { id: variationId } });
      if (!variation) return NextResponse.json({ error: 'Variação não encontrada' }, { status: 404 });
      previousQty = variation.stockQuantity;

      if (type === 'entrada') {
        newQty = previousQty + qty;
        await prisma.productVariation.update({ where: { id: variationId }, data: { stockQuantity: { increment: qty } } });
        await prisma.product.update({ where: { id: productId }, data: { stockQuantity: { increment: qty } } });
      } else if (type === 'saida') {
        if (previousQty < qty) return NextResponse.json({ error: 'Estoque insuficiente' }, { status: 400 });
        newQty = previousQty - qty;
        await prisma.productVariation.update({ where: { id: variationId }, data: { stockQuantity: { decrement: qty } } });
        await prisma.product.update({ where: { id: productId }, data: { stockQuantity: { decrement: qty } } });
      } else if (type === 'ajuste_manual' || type === 'inventario') {
        const targetQty = qty;
        newQty = targetQty;
        const diff = targetQty - previousQty;
        await prisma.productVariation.update({ where: { id: variationId }, data: { stockQuantity: targetQty } });
        await prisma.product.update({ where: { id: productId }, data: { stockQuantity: { increment: diff } } });
      }
    } else {
      const product = await prisma.product.findUnique({ where: { id: productId } });
      if (!product) return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 });
      previousQty = product.stockQuantity;

      if (type === 'entrada') {
        newQty = previousQty + qty;
        await prisma.product.update({ where: { id: productId }, data: { stockQuantity: { increment: qty } } });
      } else if (type === 'saida') {
        if (previousQty < qty) return NextResponse.json({ error: 'Estoque insuficiente' }, { status: 400 });
        newQty = previousQty - qty;
        await prisma.product.update({ where: { id: productId }, data: { stockQuantity: { decrement: qty } } });
      } else if (type === 'ajuste_manual' || type === 'inventario') {
        const targetQty = qty;
        newQty = targetQty;
        await prisma.product.update({ where: { id: productId }, data: { stockQuantity: targetQty } });
      }
    }

    const movement = await prisma.inventoryMovement.create({
      data: {
        productId,
        variationId: variationId || null,
        companyId,
        type,
        quantity: type === 'ajuste_manual' || type === 'inventario' ? Math.abs(newQty - previousQty) : qty,
        previousQty,
        newQty,
        reason: reason ?? null,
        userId: session.user.id,
        userName: session.user.name,
      },
      include: { product: { select: { name: true } }, variation: { select: { color: true, size: true } } },
    });

    return NextResponse.json(movement, { status: 201 });
  } catch (error: any) {
    console.error('Erro movimentação POST:', error);
    return NextResponse.json({ error: 'Erro ao criar movimentação' }, { status: 500 });
  }
}
