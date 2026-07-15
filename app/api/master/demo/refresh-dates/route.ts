export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { refreshDemoDates } from '@/lib/demo-snapshot-engine';

/**
 * POST → atualização de datas da DEMO (deslocamento temporal uniforme).
 * Requer body { confirm: true }. Somente Master. Não altera valores
 * financeiros/vendas/estoque nem datas de assinatura.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.isMaster) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    const body = await request.json().catch(() => ({}));
    if (body?.confirm !== true) {
      return NextResponse.json(
        { error: 'Confirmação obrigatória. Envie { confirm: true }.' },
        { status: 400 },
      );
    }
    const result = await refreshDemoDates({
      actorId: (session.user as any).id ?? null,
      actorName: session.user.name ?? null,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erro ao atualizar datas da DEMO.' }, { status: 500 });
  }
}
