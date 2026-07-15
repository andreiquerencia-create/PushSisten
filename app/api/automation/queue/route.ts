/**
 * GET /api/automation/queue — Fila de ações de automação da empresa logada.
 *
 * Query params (opcionais):
 *  - status: PENDENTE | EXECUTADO | IGNORADO | ERRO (default: PENDENTE)
 *  - type:   ALERTA_INTERNO | CLIENTE_INATIVO | COBRANCA_CREDIARIO | PRODUTO_PARADO | ESTOQUE_BAIXO | RELATORIO_GERENCIAL
 *  - limit:  número máximo de itens (default 200)
 *
 * Consome a fonte oficial via Automation Engine. NÃO executa nem envia nada.
 * Sempre filtrado por companyId da sessão (multi-tenant).
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { getAutomationQueue, AutomationStatus, AutomationType } from '@/lib/automation-engine';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const companyId = (session.user as any).companyId;
    if (!companyId) {
      return NextResponse.json({ error: 'Empresa não encontrada na sessão' }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const statusParam = searchParams.get('status');
    const typeParam = searchParams.get('type');
    const limitParam = searchParams.get('limit');

    const actions = await getAutomationQueue(companyId, {
      status: (statusParam as AutomationStatus) || undefined,
      type: (typeParam as AutomationType) || undefined,
      limit: limitParam ? parseInt(limitParam, 10) : undefined,
    });

    // Resumo agregado para a UI.
    const byType: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    for (const a of actions) {
      byType[a.type] = (byType[a.type] || 0) + 1;
      bySeverity[a.severity] = (bySeverity[a.severity] || 0) + 1;
    }

    return NextResponse.json({
      companyId,
      total: actions.length,
      byType,
      bySeverity,
      actions,
    });
  } catch (error: any) {
    console.error('[automation/queue] Erro:', error);
    return NextResponse.json(
      { error: 'Erro ao carregar fila de automações', details: error?.message },
      { status: 500 }
    );
  }
}
