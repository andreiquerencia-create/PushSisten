/**
 * API /api/insights — Motor de Insights do PushSisten
 *
 * GET: Gera (ou recupera) insights do dia para a empresa da sessão.
 *      Idempotente: chamadas repetidas no mesmo dia retornam/atualizam os mesmos registros.
 *      Query params opcionais:
 *        - history=true : retorna histórico (sem gerar novos)
 *        - days=N : histórico dos últimos N dias (default 30)
 *        - type=ESTOQUE|CLIENTE|FINANCEIRO|CREDIARIO
 *        - severity=ALTO|MEDIO|BAIXO
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { generateInsights, getInsightHistory, type InsightType, type InsightSeverity } from '@/lib/insights-engine';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const companyId = (session.user as any).companyId;
    if (!companyId) {
      return NextResponse.json({ error: 'Empresa não encontrada na sessão' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const isHistory = searchParams.get('history') === 'true';

    if (isHistory) {
      // Modo histórico: retorna insights persistidos sem gerar novos
      const days = Math.min(parseInt(searchParams.get('days') || '30') || 30, 90);
      const type = searchParams.get('type') as InsightType | null;
      const severity = searchParams.get('severity') as InsightSeverity | null;

      const startDate = new Date(Date.now() - days * 86400000);
      const insights = await getInsightHistory(companyId, {
        startDate,
        type: type || undefined,
        severity: severity || undefined,
        limit: 500,
      });

      return NextResponse.json({
        mode: 'history',
        companyId,
        days,
        total: insights.length,
        insights,
      });
    }

    // Modo padrão: gerar insights do dia (idempotente)
    const result = await generateInsights(companyId);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[insights] Erro:', error);
    return NextResponse.json(
      { error: 'Erro ao gerar insights', details: error?.message },
      { status: 500 }
    );
  }
}
