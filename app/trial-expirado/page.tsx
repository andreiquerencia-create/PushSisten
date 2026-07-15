import { redirect } from 'next/navigation';

/**
 * Rota legada mantida para compatibilidade. A tela oficial de bloqueio de
 * assinatura passou a ser /assinatura-expirada (PRIORIDADE 8.1B).
 */
export default function TrialExpiradoRedirect() {
  redirect('/assinatura-expirada');
}
