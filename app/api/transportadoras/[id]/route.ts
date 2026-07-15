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
    const existing = await prisma.carrier.findFirst({ where: { id: params.id, companyId } });
    if (!existing) return NextResponse.json({ error: 'Transportadora não encontrada' }, { status: 404 });
    const body = await request.json();
    const carrier = await prisma.carrier.update({
      where: { id: params.id },
      data: { name: body.name, phone: body.phone || null, city: body.city || null, state: body.state || null, notes: body.notes || null },
    });
    return NextResponse.json(carrier);
  } catch (error) {
    console.error('PUT /api/transportadoras error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const companyId = session.user.companyId;
    const existing = await prisma.carrier.findFirst({ where: { id: params.id, companyId } });
    if (!existing) return NextResponse.json({ error: 'Transportadora não encontrada' }, { status: 404 });
    await prisma.carrier.update({ where: { id: params.id }, data: { isActive: false } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/transportadoras error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
