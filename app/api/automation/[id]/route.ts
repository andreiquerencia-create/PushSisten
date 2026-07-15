/**
 * PATCH /api/automation/[id] — Atualiza o status de uma ação de automação.
 *
 * Body: { status: 'EXECUTADO' | 'IGNORADO' | 'ERRO' | 'PENDENTE', error?: string }
 *
 * "EXECUTADO" nesta fase apenas marca a ação como concluída (sem envio real).
 * Sempre valida companyId da sessão (impede cross-tenant).
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { updateAutomationStatus, AutomationStatus } from '@/lib/automation-engine';

const VALID: AutomationStatus[] = ['PENDENTE', 'EXECUTADO', 'IGNORADO', 'ERRO'];

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const companyId = (session.user as any).companyId;
    if (!companyId) {
      return NextResponse.json({ error: 'Empresa não encontrada na sessão' }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const status = body?.status as AutomationStatus;
    if (!status || !VALID.includes(status)) {
      return NextResponse.json(
        { error: `Status inválido. Use um de: ${VALID.join(', ')}` },
        { status: 400 }
      );
    }

    const updated = await updateAutomationStatus(companyId, params.id, status, {
      error: body?.error ?? null,
    });

    if (!updated) {
      return NextResponse.json({ error: 'Ação não encontrada' }, { status: 404 });
    }

    return NextResponse.json({ ok: true, action: updated });
  } catch (error: any) {
    console.error('[automation/[id]] Erro:', error);
    return NextResponse.json(
      { error: 'Erro ao atualizar ação', details: error?.message },
      { status: 500 }
    );
  }
}
