export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const companyId = session.user.companyId;
    const user = await prisma.user.findFirst({
      where: { id: params?.id, companyId },
      select: { id: true, name: true, email: true, role: true, phone: true, isActive: true, createdAt: true, seller: { select: { id: true, commissionRate: true, phone: true } } },
    });
    if (!user) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
    return NextResponse.json(user);
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: 'Erro ao buscar usuário' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    if (session.user.role !== 'administrador' && session.user.role !== 'socio') {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    }
    const companyId = session.user.companyId;
    const existingUser = await prisma.user.findFirst({ where: { id: params?.id, companyId } });
    if (!existingUser) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
    const body = await request.json();
    const data: any = {};
    if (body?.name !== undefined) data.name = body.name;
    if (body?.role !== undefined) data.role = body.role;
    if (body?.phone !== undefined) data.phone = body.phone || null;
    if (body?.isActive !== undefined) data.isActive = body.isActive;
    if (body?.email !== undefined) data.email = body.email;

    // Password change
    if (body?.password && body.password.length >= 6) {
      data.password = await bcrypt.hash(body.password, 12);
    }

    const user = await prisma.user.update({
      where: { id: params?.id },
      data,
      select: { id: true, name: true, email: true, role: true, phone: true, isActive: true },
    });

    // Sync seller record
    if (body?.role === 'vendedor') {
      const existingSeller = await prisma.seller.findUnique({ where: { userId: params?.id } });
      if (!existingSeller) {
        try {
          await prisma.seller.create({
            data: {
              name: user.name,
              phone: body.phone || null,
              commissionRate: body.commissionRate != null ? parseFloat(body.commissionRate) : 5,
              companyId: session.user.companyId,
              userId: user.id,
            },
          });
        } catch (sellerErr: any) {
          console.error('Erro ao criar vendedor vinculado:', sellerErr);
        }
      } else {
        // Update existing seller commission/phone/name
        const sellerUpdate: any = {};
        if (body?.name) sellerUpdate.name = body.name;
        if (body?.phone !== undefined) sellerUpdate.phone = body.phone || null;
        if (body?.commissionRate !== undefined) sellerUpdate.commissionRate = parseFloat(body.commissionRate) || 0;
        if (Object.keys(sellerUpdate).length > 0) {
          await prisma.seller.update({ where: { userId: params?.id }, data: sellerUpdate });
        }
      }
    }

    return NextResponse.json(user);
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: 'Erro ao atualizar' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    if (session.user.role !== 'administrador' && session.user.role !== 'socio') {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    }
    const companyId = session.user.companyId;
    const existingUser = await prisma.user.findFirst({ where: { id: params?.id, companyId } });
    if (!existingUser) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
    // Prevent self-deletion
    if (params?.id === session.user.id) {
      return NextResponse.json({ error: 'Você não pode excluir seu próprio usuário' }, { status: 400 });
    }

    // Check if user has sales — prefer deactivation
    const salesCount = await prisma.sale.count({ where: { sellerId: params?.id } });
    if (salesCount > 0) {
      // Deactivate instead of delete
      await prisma.user.update({ where: { id: params?.id }, data: { isActive: false } });
      return NextResponse.json({ deactivated: true, message: `Usuário desativado (possui ${salesCount} vendas no histórico)` });
    }

    // Delete seller record first if exists
    try {
      await prisma.seller.deleteMany({ where: { userId: params?.id } });
    } catch (e) { /* ignore */ }

    await prisma.user.delete({ where: { id: params?.id } });
    return NextResponse.json({ deleted: true, message: 'Usuário excluído com sucesso' });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: 'Erro ao excluir' }, { status: 500 });
  }
}
