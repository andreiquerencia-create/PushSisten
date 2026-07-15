export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { cancelSubscription } from '@/lib/billing-engine';

/** POST /api/billing/cancel — cancela a assinatura da empresa logada. */
export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const companyId = (session.user as any).companyId as string | undefined;
    if ((session.user as any).isMaster || !companyId) {
      return NextResponse.json({ error: 'Ação não permitida.' }, { status: 403 });
    }
    // R5: apenas administradores da empresa podem gerenciar a assinatura.
    if ((session.user as any).role !== 'administrador') {
      return NextResponse.json({ error: 'Apenas administradores podem gerenciar a assinatura.' }, { status: 403 });
    }
    const result = await cancelSubscription(companyId);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('billing/cancel error:', e?.message);
    return NextResponse.json({ error: 'Erro ao cancelar assinatura.' }, { status: 500 });
  }
}
