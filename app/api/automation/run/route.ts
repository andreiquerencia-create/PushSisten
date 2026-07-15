/**
 * POST /api/automation/run — Geração manual segura das automações do dia.
 *
 * "Executar" nesta fase = GERAR as ações a partir do plano oficial da IA Gerente
 * + REGISTRAR log de auditoria. NENHUMA mensagem de WhatsApp/e-mail é enviada.
 *
 * Idempotente: chamar 2x no mesmo dia NÃO duplica ações (upsert por chave única).
 * Respeita EM_FORMACAO → retorna zero ações geradas.
 * Sempre escopado por companyId da sessão (multi-tenant).
 */

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { runAutomations } from '@/lib/automation-engine';

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const companyId = (session.user as any).companyId;
    if (!companyId) {
      return NextResponse.json({ error: 'Empresa não encontrada na sessão' }, { status: 400 });
    }

    const result = await runAutomations(companyId, new Date(), {
      userId: (session.user as any).id ?? null,
      userName: session.user.name ?? 'Sistema',
    });

    return NextResponse.json({
      ok: true,
      status: result.status,
      created: result.created,
      existing: result.existing,
      total: result.total,
      byType: result.byType,
      bySeverity: result.bySeverity,
      actions: result.actions,
      message:
        result.status === 'EM_FORMACAO'
          ? 'Empresa em formação: nenhuma automação gerada.'
          : `Automações processadas: ${result.created} nova(s), ${result.existing} já existente(s).`,
    });
  } catch (error: any) {
    console.error('[automation/run] Erro:', error);
    return NextResponse.json(
      { error: 'Erro ao executar automações', details: error?.message },
      { status: 500 }
    );
  }
}
