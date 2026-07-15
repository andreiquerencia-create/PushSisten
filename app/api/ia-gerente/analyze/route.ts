/**
 * POST /api/ia-gerente/analyze
 *
 * ADAPTADOR — consome o Insights Engine oficial (generateInsights)
 * e persiste como IAAlert para backward-compat com /alertas-ia.
 *
 * NENHUMA lógica de diagnóstico própria. Apenas transformação de formato:
 *   Insight (Engine) → IAAlert (tabela legada, /alertas-ia consome)
 */

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { generateInsights, type InsightSeverity } from '@/lib/insights-engine';

// Mapeia severity do Engine (ALTO/MEDIO/BAIXO) → type do IAAlert (critical/important/observation)
const SEVERITY_TO_TYPE: Record<string, string> = {
  ALTO: 'critical',
  MEDIO: 'important',
  BAIXO: 'observation',
};

// Mapeia InsightType → category do IAAlert
const TYPE_TO_CATEGORY: Record<string, string> = {
  ESTOQUE: 'stock',
  CLIENTE: 'crm',
  FINANCEIRO: 'financial',
  CREDIARIO: 'financial',
};

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const companyId = (session.user as any).companyId;
    if (!companyId) return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 400 });

    // 1. Gerar insights via Engine oficial (idempotente, persiste no modelo Insight)
    const result = await generateInsights(companyId);

    if (result.status === 'EM_FORMACAO') {
      return NextResponse.json({
        analyzed: true,
        newAlertsCount: 0,
        totalAlerts: 0,
        alerts: [],
        status: 'EM_FORMACAO',
      });
    }

    // 2. Converter insights oficiais → formato IAAlert para backward-compat
    const oneDayAgo = new Date(Date.now() - 24 * 3600000);
    const recentAlerts = await prisma.iAAlert.findMany({
      where: { companyId, createdAt: { gte: oneDayAgo } },
      select: { title: true },
    });
    const recentTitles = new Set(recentAlerts.map(a => a.title));

    const newAlerts = result.insights
      .filter(ins => !recentTitles.has(ins.message))
      .map(ins => ({
        companyId,
        type: SEVERITY_TO_TYPE[ins.severity] ?? 'observation',
        category: TYPE_TO_CATEGORY[ins.type] ?? 'general',
        title: ins.message,
        description: ins.message,
        suggestion: null as string | null,
        impact: null as string | null,
      }));

    if (newAlerts.length > 0) {
      await prisma.iAAlert.createMany({ data: newAlerts });
    }

    return NextResponse.json({
      analyzed: true,
      newAlertsCount: newAlerts.length,
      totalAlerts: result.insights.length,
      alerts: newAlerts,
    });
  } catch (error: any) {
    console.error('Analyze error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
