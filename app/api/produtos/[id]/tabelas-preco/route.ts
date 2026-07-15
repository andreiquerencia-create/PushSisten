export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

// GET /api/produtos/[id]/tabelas-preco — list all price tables for a product
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const companyId = session.user.companyId;

    const tables = await prisma.priceTable.findMany({
      where: { productId: params.id, companyId },
      orderBy: [{ sortOrder: 'asc' }, { minQuantity: 'asc' }],
    });

    return NextResponse.json(tables);
  } catch (error: any) {
    console.error('Error fetching price tables:', error);
    return NextResponse.json({ error: 'Erro ao buscar tabelas de preço' }, { status: 500 });
  }
}

// POST /api/produtos/[id]/tabelas-preco — create a new price table (admin only)
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const role = (session.user as any).role;
    if (role !== 'administrador' && role !== 'socio' && role !== 'master') {
      return NextResponse.json({ error: 'Apenas administradores podem criar tabelas de preço' }, { status: 403 });
    }
    const companyId = session.user.companyId;
    const body = await request.json();
    const { name, minQuantity, unitPrice, notes, sortOrder } = body;

    if (!name || !unitPrice) {
      return NextResponse.json({ error: 'Nome e preço unitário são obrigatórios' }, { status: 400 });
    }

    // Verify product belongs to company
    const product = await prisma.product.findFirst({
      where: { id: params.id, companyId },
    });
    if (!product) {
      return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 });
    }

    const table = await prisma.priceTable.create({
      data: {
        name,
        minQuantity: parseInt(String(minQuantity)) || 1,
        unitPrice: parseFloat(String(unitPrice)),
        notes: notes || null,
        sortOrder: parseInt(String(sortOrder)) || 0,
        productId: params.id,
        companyId,
      },
    });

    return NextResponse.json(table, { status: 201 });
  } catch (error: any) {
    console.error('Error creating price table:', error);
    return NextResponse.json({ error: 'Erro ao criar tabela de preço' }, { status: 500 });
  }
}

// PUT /api/produtos/[id]/tabelas-preco — update a price table (admin only)
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const role = (session.user as any).role;
    if (role !== 'administrador' && role !== 'socio' && role !== 'master') {
      return NextResponse.json({ error: 'Apenas administradores podem editar tabelas de preço' }, { status: 403 });
    }
    const companyId = session.user.companyId;
    const body = await request.json();
    const { tableId, name, minQuantity, unitPrice, notes, isActive, sortOrder } = body;

    if (!tableId) {
      return NextResponse.json({ error: 'ID da tabela é obrigatório' }, { status: 400 });
    }

    // Verify table belongs to this product and company
    const existing = await prisma.priceTable.findFirst({
      where: { id: tableId, productId: params.id, companyId },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Tabela de preço não encontrada' }, { status: 404 });
    }

    const updated = await prisma.priceTable.update({
      where: { id: tableId },
      data: {
        ...(name !== undefined && { name }),
        ...(minQuantity !== undefined && { minQuantity: parseInt(String(minQuantity)) || 1 }),
        ...(unitPrice !== undefined && { unitPrice: parseFloat(String(unitPrice)) }),
        ...(notes !== undefined && { notes: notes || null }),
        ...(isActive !== undefined && { isActive: Boolean(isActive) }),
        ...(sortOrder !== undefined && { sortOrder: parseInt(String(sortOrder)) || 0 }),
      },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('Error updating price table:', error);
    return NextResponse.json({ error: 'Erro ao atualizar tabela de preço' }, { status: 500 });
  }
}

// DELETE /api/produtos/[id]/tabelas-preco — soft-delete (deactivate) a price table (admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const role = (session.user as any).role;
    if (role !== 'administrador' && role !== 'socio' && role !== 'master') {
      return NextResponse.json({ error: 'Apenas administradores podem remover tabelas de preço' }, { status: 403 });
    }
    const companyId = session.user.companyId;
    const url = new URL(request.url);
    const tableId = url.searchParams.get('tableId');

    if (!tableId) {
      return NextResponse.json({ error: 'ID da tabela é obrigatório' }, { status: 400 });
    }

    const existing = await prisma.priceTable.findFirst({
      where: { id: tableId, productId: params.id, companyId },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Tabela de preço não encontrada' }, { status: 404 });
    }

    // Soft delete — set isActive = false
    await prisma.priceTable.update({
      where: { id: tableId },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting price table:', error);
    return NextResponse.json({ error: 'Erro ao remover tabela de preço' }, { status: 500 });
  }
}
