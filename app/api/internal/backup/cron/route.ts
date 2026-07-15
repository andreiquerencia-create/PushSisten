export const dynamic = 'force-dynamic';
export const maxDuration = 800;

import { NextRequest, NextResponse } from 'next/server';
import { isAuthorizedWorker } from '@/lib/backup-auth';
import { runFullPipeline } from '@/lib/backup-worker';

/**
 * POST /api/internal/backup/cron  (header x-backup-secret)
 *
 * Dispara o ciclo noturno completo (enfileira -> processa serial -> retenção).
 * Por padrão roda em BACKGROUND (não bloqueia a resposta): retorna 202 e o
 * servidor persistente continua processando. Use ?wait=1 para aguardar o
 * resultado (útil para execução por agendador/teste que tolera espera longa).
 */
export async function POST(request: NextRequest) {
  if (!isAuthorizedWorker(request)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const wait = new URL(request.url).searchParams.get('wait') === '1';

  if (wait) {
    try {
      const summary = await runFullPipeline();
      return NextResponse.json({ ok: true, summary });
    } catch (e: any) {
      return NextResponse.json({ ok: false, error: e?.message || 'erro' }, { status: 500 });
    }
  }

  // Fire-and-forget: o servidor standalone continua o processamento após a resposta.
  void runFullPipeline().catch((e) => console.error('[backup-cron] pipeline falhou:', e));
  return NextResponse.json({ ok: true, started: true }, { status: 202 });
}
