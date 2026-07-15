export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    if (session.user.role === 'vendedor') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    const companyId = session.user.companyId;

    const logs = await prisma.importLog.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return NextResponse.json({ logs });
  } catch (error: any) {
    console.error('GET /api/importacao/historico error:', error);
    return NextResponse.json({ error: 'Erro ao buscar histórico' }, { status: 500 });
  }
}
