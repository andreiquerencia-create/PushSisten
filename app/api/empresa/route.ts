export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const company = await prisma.company.findUnique({
      where: { id: session.user.companyId },
      select: {
        id: true, name: true, cnpj: true, email: true,
        phone: true, whatsapp: true, instagram: true, logoUrl: true,
        address: true, city: true, state: true,
        priceTableMinQtyBehavior: true,
        whatsappDefaultApp: true,
      },
    });
    if (!company) return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 404 });
    return NextResponse.json(company);
  } catch (error: any) {
    console.error('GET /api/empresa error:', error);
    return NextResponse.json({ error: 'Erro ao buscar empresa' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    if (session.user.role !== 'administrador' && session.user.role !== 'socio') {
      return NextResponse.json({ error: 'Apenas administradores podem alterar' }, { status: 403 });
    }
    const body = await request.json();
    const { name, cnpj, email, phone, whatsapp, instagram, logoUrl, address, city, state, priceTableMinQtyBehavior, whatsappDefaultApp } = body;
    const updated = await prisma.company.update({
      where: { id: session.user.companyId },
      data: {
        ...(name !== undefined && { name }),
        ...(cnpj !== undefined && { cnpj: cnpj || null }),
        ...(email !== undefined && { email: email || null }),
        ...(phone !== undefined && { phone: phone || null }),
        ...(priceTableMinQtyBehavior !== undefined && { priceTableMinQtyBehavior }),
        ...(whatsappDefaultApp !== undefined && { whatsappDefaultApp }),
        ...(whatsapp !== undefined && { whatsapp: whatsapp || null }),
        ...(instagram !== undefined && { instagram: instagram || null }),
        ...(logoUrl !== undefined && { logoUrl: logoUrl || null }),
        ...(address !== undefined && { address: address || null }),
        ...(city !== undefined && { city: city || null }),
        ...(state !== undefined && { state: state || null }),
      },
    });
    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('PUT /api/empresa error:', error);
    return NextResponse.json({ error: 'Erro ao atualizar empresa' }, { status: 500 });
  }
}
