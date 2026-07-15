/**
 * FASE 7 — ETAPA 5B: autenticação dos endpoints internos do worker de backup.
 * Protegidos por segredo (header), NÃO por sessão de usuário.
 */
import { NextRequest } from 'next/server';

export function isAuthorizedWorker(request: NextRequest): boolean {
  const secret = process.env.BACKUP_WORKER_SECRET;
  if (!secret) return false;
  const header = request.headers.get('x-backup-secret');
  return !!header && header === secret;
}
