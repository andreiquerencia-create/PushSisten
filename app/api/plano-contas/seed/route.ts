export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { seedAccountPlanForCompany } from '@/lib/account-plan-seed';

export async function POST(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const companyId = (session.user as any).companyId;
    const role = (session.user as any).role;
    if (!companyId) return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 400 });
    if (role !== 'administrador' && role !== 'socio' && role !== 'master') {
      return NextResponse.json({ error: 'Sem permissão para gerar plano padrão' }, { status: 403 });
    }

    const beforeCount = await prisma.accountPlan.count({ where: { companyId } });
    const result = await seedAccountPlanForCompany(companyId);
    const afterCount = await prisma.accountPlan.count({ where: { companyId } });

    return NextResponse.json({
      message: 'Plano de contas padrão aplicado com sucesso',
      stats: {
        before: beforeCount,
        after: afterCount,
        created: result.created,
        updated: result.updated,
        total: result.total,
      },
    });
  } catch (error: any) {
    console.error('Erro ao gerar plano padrão:', error);
    return NextResponse.json({ error: 'Erro ao gerar plano padrão de contas' }, { status: 500 });
  }
}
