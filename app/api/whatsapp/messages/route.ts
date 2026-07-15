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
    if (!companyId) return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 400 });

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') ?? '50');
    const phone = searchParams.get('phone');

    const config = await prisma.whatsAppConfig.findUnique({ where: { companyId } });
    if (!config) return NextResponse.json({ messages: [] });

    const where: any = { configId: config.id };
    if (phone) where.phone = phone;

    const messages = await prisma.whatsAppMessage.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return NextResponse.json({ messages });
  } catch (error: any) {
    console.error('WhatsApp messages GET error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
