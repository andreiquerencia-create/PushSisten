export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { isSkuDuplicate } from '@/lib/sku';

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const companyId = session.user.companyId;
    const product = await prisma.product.findFirst({
      where: { id: params?.id, companyId },
      include: { category: true, variations: { where: { isActive: true }, orderBy: { size: 'asc' } } },
    });
    if (!product) return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 });
    return NextResponse.json(product);
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: 'Erro' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const role = session.user.role;
    if (role === 'vendedor') return NextResponse.json({ error: 'Sem permissão para editar produtos' }, { status: 403 });
    // Gerente can't change prices/costs
    if (role === 'gerente') {
      const body2 = await request.clone().json();
      if (body2?.costPrice !== undefined || body2?.salePrice !== undefined) {
        return NextResponse.json({ error: 'Gerente não pode alterar preços' }, { status: 403 });
      }
    }
    const companyId = session.user.companyId;
    const body = await request.json();

    // Validar unicidade do SKU na edição (excluindo o próprio produto)
    const newSku = body?.sku?.trim() || null;
    if (newSku) {
      const duplicate = await isSkuDuplicate(newSku, companyId, params?.id);
      if (duplicate) {
        return NextResponse.json(
          { error: `SKU "${newSku}" já existe nesta empresa. Escolha outro valor.` },
          { status: 400 }
        );
      }
    }

    const cost = parseFloat(body?.costPrice) || 0;
    const sale = parseFloat(body?.salePrice) || 0;
    const margin = sale > 0 ? ((sale - cost) / sale) * 100 : 0;

    // Tenant guard: verify ownership before update
    const existing = await prisma.product.findFirst({ where: { id: params?.id, companyId } });
    if (!existing) return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 });

    const product = await prisma.product.update({
      where: { id: params?.id },
      data: {
        name: body?.name,
        sku: newSku,
        barcode: body?.barcode ?? null,
        description: body?.description ?? null,
        costPrice: cost,
        salePrice: sale,
        margin,
        minStock: body?.minStock !== undefined ? parseInt(body.minStock) : undefined,
        categoryId: body?.categoryId || null,
        imageUrl: body?.imageUrl ?? null,
        cloudStoragePath: body?.cloudStoragePath ?? null,
        isPublic: body?.isPublic ?? true,
      },
      include: { category: true },
    });
    return NextResponse.json(product);
  } catch (error: any) {
    console.error('Erro ao atualizar produto:', error);
    if (error?.code === 'P2002') {
      return NextResponse.json(
        { error: 'SKU já existe nesta empresa. Escolha outro valor.' },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: 'Erro ao atualizar' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const role = session.user.role;
    if (role === 'vendedor' || role === 'gerente') return NextResponse.json({ error: 'Sem permissão para excluir produtos' }, { status: 403 });
    const companyId = session.user.companyId;
    const existing = await prisma.product.findFirst({ where: { id: params?.id, companyId } });
    if (!existing) return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 });
    await prisma.product.update({ where: { id: params?.id }, data: { isActive: false } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: 'Erro ao excluir' }, { status: 500 });
  }
}
