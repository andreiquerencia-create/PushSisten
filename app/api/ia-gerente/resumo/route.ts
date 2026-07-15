/**
 * GET /api/ia-gerente/resumo — Resumo Executivo da IA Gerente 2.0
 *
 * Retorna:
 * - Push Score + classificação + explicação
 * - Top riscos + forças
 * - Plano de ação (Top 3)
 * - Recomendações priorizadas
 * - Explicações detalhadas
 * - Mensagens sugeridas
 * - Resumo textual
 *
 * Consome: Insights Engine + Push Score (Single Source of Truth)
 * A IA não executa — apenas analisa, explica, prioriza e recomenda.
 */

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { generateExecutiveSummary } from '@/lib/ia-gerente-engine';

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

    const summary = await generateExecutiveSummary(companyId);
    return NextResponse.json(summary);
  } catch (error: any) {
    console.error('[ia-gerente/resumo] Erro:', error);
    return NextResponse.json(
      { error: 'Erro ao gerar resumo executivo', details: error?.message },
      { status: 500 }
    );
  }
}
