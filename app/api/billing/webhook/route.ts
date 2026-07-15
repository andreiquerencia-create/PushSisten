export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getGateway } from '@/lib/billing';
import { processWebhookEvent } from '@/lib/billing-engine';

/**
 * POST /api/billing/webhook  (PÚBLICO)
 * Recebe notificações do processador de pagamento. Valida a autenticidade,
 * normaliza o evento e delega ao billing-engine (idempotente).
 * Sempre responde 200 rapidamente para evitar reenvios desnecessários, exceto
 * quando a assinatura é inválida (401).
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const headers: Record<string, string | null> = {};
  request.headers.forEach((v, k) => { headers[k] = v; });
  const query: Record<string, string | null> = {};
  request.nextUrl.searchParams.forEach((v, k) => { query[k] = v; });

  const gateway = getGateway();
  const raw = { headers, rawBody, query };

  try {
    const valid = await gateway.verifyWebhook(raw);
    if (!valid) {
      return NextResponse.json({ error: 'Assinatura inválida.' }, { status: 401 });
    }

    const evt = await gateway.interpretWebhook(raw);
    if (!evt) {
      // Notificação que não conseguimos interpretar — aceitamos sem ação.
      return NextResponse.json({ ok: true, ignored: true });
    }

    let payload: any = undefined;
    try { payload = rawBody ? JSON.parse(rawBody) : undefined; } catch { /* corpo não-JSON */ }

    const result = await processWebhookEvent(evt, payload);
    return NextResponse.json(result);
  } catch (e: any) {
    console.error('billing/webhook error:', e?.message);
    // 200 evita reenvios em loop; o erro fica registrado em WebhookEvent.result.
    return NextResponse.json({ ok: false, error: 'Erro ao processar webhook.' });
  }
}
