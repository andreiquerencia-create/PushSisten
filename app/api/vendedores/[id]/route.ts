export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const companyId = session.user.companyId;
    const existing = await prisma.seller.findFirst({ where: { id: params.id, companyId } });
    if (!existing) return NextResponse.json({ error: 'Vendedor não encontrado' }, { status: 404 });
    const body = await request.json();
    const seller = await prisma.seller.update({
      where: { id: params.id },
      data: {
        name: body.name,
        phone: body.phone || null,
        commissionRate: parseFloat(body.commissionRate) || 5,
        canEditPrice: body.canEditPrice === true,
        isActive: body.isActive !== undefined ? body.isActive : true,
      },
    });
    return NextResponse.json(seller);
  } catch (error) {
    console.error('PUT /api/vendedores error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const companyId = session.user.companyId;
    const existing = await prisma.seller.findFirst({ where: { id: params.id, companyId } });
    if (!existing) return NextResponse.json({ error: 'Vendedor não encontrado' }, { status: 404 });
    await prisma.seller.update({ where: { id: params.id }, data: { isActive: false } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/vendedores error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
