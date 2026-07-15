export const dynamic = 'force-dynamic';
export const maxDuration = 800;

import { NextRequest, NextResponse } from 'next/server';
import { isAuthorizedWorker } from '@/lib/backup-auth';
import { processQueue } from '@/lib/backup-worker';

/**
 * POST /api/internal/backup/run  (header x-backup-secret)
 * Processa a fila pendente de forma serial (sem enfileirar novos autos nem reter).
 * Útil para drenar manualmente backups enfileirados (ex.: manual grande).
 */
export async function POST(request: NextRequest) {
  if (!isAuthorizedWorker(request)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }
  try {
    const result = await processQueue();
    return NextResponse.json({ ok: true, ...result });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'erro' }, { status: 500 });
  }
}
