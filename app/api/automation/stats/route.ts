/**
 * GET /api/automation/stats — Contadores REAIS de automação da empresa logada.
 *
 * Tudo derivado das fontes oficiais (sem campos fake):
 *  - Contagem de ações por status (AutomationAction).
 *  - Total e timestamp da última execução (ActivityLog action='automation_run').
 *
 * Não executa nem envia nada. Sempre escopado por companyId da sessão.
 */

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const companyId = (session.user as any).companyId;
    if (!companyId) {
      return NextResponse.json({ error: 'Empresa não encontrada na sessão' }, { status: 400 });
    }

    // Contagem real por status (fonte: AutomationAction).
    const grouped = await prisma.automationAction.groupBy({
      by: ['status'],
      where: { companyId },
      _count: { _all: true },
    });

    const byStatus: Record<string, number> = {
      PENDENTE: 0,
      EXECUTADO: 0,
      IGNORADO: 0,
      ERRO: 0,
    };
    let totalActions = 0;
    for (const g of grouped) {
      byStatus[g.status] = g._count._all;
      totalActions += g._count._all;
    }

    // Telemetria oficial de execuções (fonte: ActivityLog).
    const totalRuns = await prisma.activityLog.count({
      where: { companyId, action: 'automation_run' },
    });

    const lastRunLog = await prisma.activityLog.findFirst({
      where: { companyId, action: 'automation_run' },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true, metadata: true, userName: true },
    });

    return NextResponse.json({
      companyId,
      totalActions,
      byStatus,
      totalRuns,
      lastRun: lastRunLog?.createdAt ?? null,
      lastRunBy: lastRunLog?.userName ?? null,
      lastRunMeta: lastRunLog?.metadata ?? null,
    });
  } catch (error: any) {
    console.error('[automation/stats] Erro:', error);
    return NextResponse.json(
      { error: 'Erro ao carregar estatísticas de automação', details: error?.message },
      { status: 500 }
    );
  }
}
