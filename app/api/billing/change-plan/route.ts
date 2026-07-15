export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { changePlan } from '@/lib/billing-engine';

/**
 * POST /api/billing/change-plan — troca o plano da empresa logada.
 * Body: { plan: 'starter' | 'pro' | 'enterprise' }
 * Valida limites de downgrade ANTES de aplicar.
 */
export async function POST(request: NextRequest) {
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
    const body = await request.json().catch(() => ({}));
    const plan = String(body?.plan || '').trim();
    if (!plan) return NextResponse.json({ error: 'Plano não informado.' }, { status: 400 });

    const result = await changePlan(companyId, plan);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ ok: true, direction: result.direction });
  } catch (e: any) {
    console.error('billing/change-plan error:', e?.message);
    return NextResponse.json({ error: 'Erro ao trocar de plano.' }, { status: 500 });
  }
}
