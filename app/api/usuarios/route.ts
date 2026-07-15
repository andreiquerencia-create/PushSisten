export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { canAddUser } from '@/lib/plan-engine';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    if (session.user.role !== 'administrador' && session.user.role !== 'socio' && session.user.role !== 'gerente') {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    }
    const companyId = session.user.companyId;
    const users = await prisma.user.findMany({
      where: { companyId, isMaster: false },
      select: { id: true, name: true, email: true, role: true, phone: true, isActive: true, createdAt: true, seller: { select: { id: true, commissionRate: true, phone: true } } },
      orderBy: { name: 'asc' },
    });
    return NextResponse.json(users ?? []);
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: 'Erro ao buscar usuários' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    if (session.user.role !== 'administrador' && session.user.role !== 'socio') {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    }
    const companyId = session.user.companyId;
    const body = await request.json();
    if (!body?.name || !body?.email || !body?.password) {
      return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 });
    }
    // Limite de usuários governado pelo motor de planos (TAREFA 4).
    // Trial e Enterprise = ilimitado; Starter/Pro = maxUsers do plano.
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { plan: true, maxUsers: true, _count: { select: { users: true } } },
    });
    if (company) {
      const check = canAddUser(company, company._count.users);
      if (!check.allowed) {
        return NextResponse.json({ error: check.message, reason: check.reason }, { status: 403 });
      }
    }

    const existing = await prisma.user.findUnique({ where: { email: body.email } });
    if (existing) return NextResponse.json({ error: 'Email já cadastrado' }, { status: 409 });

    const hashed = await bcrypt.hash(body.password, 12);
    const role = body?.role ?? 'vendedor';
    const user = await prisma.user.create({
      data: {
        name: body.name,
        email: body.email,
        password: hashed,
        role,
        companyId,
      },
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });

    // Auto-create Seller record when role is vendedor
    if (role === 'vendedor') {
      try {
        await prisma.seller.create({
          data: {
            name: body.name,
            phone: body.phone ?? null,
            commissionRate: body.commissionRate != null ? parseFloat(body.commissionRate) : 5,
            companyId,
            userId: user.id,
          },
        });
      } catch (sellerErr: any) {
        console.error('Erro ao criar vendedor vinculado:', sellerErr);
      }
    }

    return NextResponse.json(user, { status: 201 });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: 'Erro ao criar usuário' }, { status: 500 });
  }
}
