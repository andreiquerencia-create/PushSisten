export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { createCheckout } from '@/lib/billing-engine';

/**
 * POST /api/billing/checkout
 * Inicia a assinatura de um plano pago para a empresa logada.
 * Body: { plan: 'starter' | 'pro' | 'enterprise' }
 * Retorna { initPoint } para redirecionar o cliente ao checkout.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const companyId = (session.user as any).companyId as string | undefined;
    if ((session.user as any).isMaster || !companyId) {
      return NextResponse.json({ error: 'Apenas empresas podem assinar um plano.' }, { status: 403 });
    }
    // R5: apenas administradores da empresa podem gerenciar a assinatura.
    if ((session.user as any).role !== 'administrador') {
      return NextResponse.json({ error: 'Apenas administradores podem gerenciar a assinatura.' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const plan = String(body?.plan || '').trim();
    if (!plan) return NextResponse.json({ error: 'Plano não informado.' }, { status: 400 });

    const base = process.env.NEXTAUTH_URL || new URL(request.url).origin;
    const result = await createCheckout({
      companyId,
      targetPlan: plan,
      payerEmail: (session.user as any).email || null,
      backUrl: `${base}/billing/retorno`,
      webhookUrl: `${base}/api/billing/webhook`,
    });

    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({
      ok: true,
      initPoint: result.initPoint,
      externalSubscriptionId: result.externalSubscriptionId,
    });
  } catch (e: any) {
    console.error('billing/checkout error:', e?.message);
    return NextResponse.json({ error: 'Erro ao iniciar checkout.' }, { status: 500 });
  }
}
