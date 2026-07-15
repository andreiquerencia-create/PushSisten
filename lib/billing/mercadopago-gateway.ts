/**
 * billing/mercadopago-gateway.ts — Gateway Mercado Pago (STUB da fase 1)
 * ---------------------------------------------------------------------------
 * Implementa o contrato PaymentGateway usando a API de Assinaturas (Preapproval)
 * do Mercado Pago via fetch nativo (sem SDK). Na FASE 1 NÃO há credenciais reais
 * configuradas, portanto este gateway fica pronto mas inativo (isLive=false) e o
 * factory cai automaticamente para o MockGateway. Quando as credenciais de
 * Sandbox/Produção forem autorizadas, basta definir MP_ACCESS_TOKEN +
 * MP_WEBHOOK_SECRET e BILLING_PROVIDER=mercadopago.
 *
 * Referência: https://www.mercadopago.com.br/developers (Assinaturas/Preapproval,
 * notificações Webhooks com validação x-signature HMAC-SHA256).
 */

import crypto from 'crypto';
import {
  PaymentGateway, CreateCheckoutParams, CreateCheckoutResult, CancelResult,
  UpdateSubscriptionParams, UpdateResult, RawWebhook, NormalizedWebhookEvent,
  NormalizedEventKind,
} from './types';

const MP_API = 'https://api.mercadopago.com';

export class MercadoPagoGateway implements PaymentGateway {
  readonly provider = 'mercadopago' as const;
  private readonly accessToken: string;
  private readonly webhookSecret: string;
  private readonly sandbox: boolean;

  constructor() {
    this.accessToken = process.env.MP_ACCESS_TOKEN || '';
    this.webhookSecret = process.env.MP_WEBHOOK_SECRET || '';
    // Alternância explícita Sandbox/Produção. Em Sandbox usamos a URL de
    // checkout de teste (sandbox_init_point). Token de teste do MP costuma
    // começar com "TEST-"; também aceita MP_SANDBOX=true como override.
    this.sandbox = process.env.MP_SANDBOX === 'true' || this.accessToken.startsWith('TEST-');
  }

  /** Só é "live" quando há um access token real configurado. */
  get isLive(): boolean {
    return Boolean(this.accessToken);
  }

  /** true quando operando com credenciais/URLs de Sandbox. */
  get isSandbox(): boolean {
    return this.sandbox;
  }

  private headers() {
    return {
      'Authorization': `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * fetch com RETENTATIVA AUTOMÁTICA para falhas transitórias do Mercado Pago.
   * A API de assinaturas (preapproval) apresenta instabilidade intermitente
   * (HTTP 5xx / 429 esporádicos). Reenviamos a mesma requisição até `attempts`
   * vezes, com backoff exponencial, antes de desistir. Erros 4xx (exceto 429)
   * NÃO são reenviados, pois indicam problema no pedido e não no servidor.
   */
  private async fetchWithRetry(
    url: string,
    init: RequestInit,
    attempts = 3,
    baseDelayMs = 600,
  ): Promise<Response> {
    let lastErr: any = null;
    for (let i = 0; i < attempts; i++) {
      try {
        const resp = await fetch(url, init);
        // Sucesso, ou erro definitivo do cliente (não reenvia 4xx, salvo 429).
        if (resp.ok || (resp.status < 500 && resp.status !== 429)) {
          return resp;
        }
        lastErr = new Error(`HTTP ${resp.status}`);
      } catch (e: any) {
        // Falha de rede/timeout — também é retentável.
        lastErr = e;
      }
      // Não dorme após a última tentativa.
      if (i < attempts - 1) {
        const delay = baseDelayMs * Math.pow(2, i); // 600ms, 1200ms, ...
        await new Promise((r) => setTimeout(r, delay));
      }
    }
    // Esgotou as tentativas: refaz uma última vez para devolver a Response real
    // (assim o chamador consegue ler corpo/status do erro para log).
    try {
      return await fetch(url, init);
    } catch (e: any) {
      throw lastErr || e;
    }
  }

  async createCheckout(params: CreateCheckoutParams): Promise<CreateCheckoutResult> {
    // Cria uma assinatura (preapproval) com cobrança recorrente mensal.
    // IMPORTANTE: NÃO enviar o campo `status` no corpo — o Mercado Pago recusa
    // a criação de preapproval com `status: pending` retornando HTTP 500.
    // O status inicial é definido pelo próprio gateway ("pending").
    const body = {
      reason: `PushSisten — Plano ${params.plan}`,
      external_reference: params.externalReference,
      payer_email: params.payerEmail,
      back_url: params.backUrl,
      auto_recurring: {
        frequency: 1,
        frequency_type: 'months',
        transaction_amount: params.amount,
        currency_id: params.currency || 'BRL',
      },
    };
    const resp = await this.fetchWithRetry(`${MP_API}/preapproval`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`MercadoPago createCheckout falhou (${resp.status}): ${text}`);
    }
    const data: any = await resp.json();
    return {
      externalSubscriptionId: String(data.id),
      initPoint: this.sandbox
        ? (data.sandbox_init_point || data.init_point || '')
        : (data.init_point || data.sandbox_init_point || ''),
      status: data.status || 'pending',
    };
  }

  async cancelSubscription(externalSubscriptionId: string): Promise<CancelResult> {
    const resp = await fetch(`${MP_API}/preapproval/${externalSubscriptionId}`, {
      method: 'PUT',
      headers: this.headers(),
      body: JSON.stringify({ status: 'cancelled' }),
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`MercadoPago cancelSubscription falhou (${resp.status}): ${text}`);
    }
    const data: any = await resp.json();
    return { status: data.status || 'cancelled' };
  }

  async updateSubscription(params: UpdateSubscriptionParams): Promise<UpdateResult> {
    const resp = await fetch(`${MP_API}/preapproval/${params.externalSubscriptionId}`, {
      method: 'PUT',
      headers: this.headers(),
      body: JSON.stringify({
        auto_recurring: { transaction_amount: params.amount },
      }),
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`MercadoPago updateSubscription falhou (${resp.status}): ${text}`);
    }
    const data: any = await resp.json();
    return { status: data.status || 'authorized' };
  }

  /**
   * Valida x-signature do Mercado Pago.
   * Manifesto: id:[data.id];request-id:[x-request-id];ts:[ts];
   * Assinado com HMAC-SHA256 usando MP_WEBHOOK_SECRET; compara com o hash v1.
   */
  async verifyWebhook(raw: RawWebhook): Promise<boolean> {
    if (!this.webhookSecret) return false;
    const signature = raw.headers['x-signature'] || raw.headers['X-Signature'];
    const requestId = raw.headers['x-request-id'] || raw.headers['X-Request-Id'] || '';
    if (!signature) return false;

    // x-signature: "ts=...,v1=..."
    const parts = signature.split(',').reduce((acc: Record<string, string>, p) => {
      const [k, v] = p.split('=');
      if (k && v) acc[k.trim()] = v.trim();
      return acc;
    }, {});
    const ts = parts['ts'];
    const v1 = parts['v1'];
    if (!ts || !v1) return false;

    // data.id alfanumérico deve ser considerado em minúsculas no manifesto (MP).
    const dataId = (raw.query['data.id'] || raw.query['id'] || '').toLowerCase();
    // Manifesto: cada componente AUSENTE deve ser OMITIDO por completo, senão a
    // assinatura não confere. Formato: id:<>;request-id:<>;ts:<>;
    let manifest = '';
    if (dataId) manifest += `id:${dataId};`;
    if (requestId) manifest += `request-id:${requestId};`;
    if (ts) manifest += `ts:${ts};`;
    const hmac = crypto.createHmac('sha256', this.webhookSecret).update(manifest).digest('hex');
    try {
      return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(v1));
    } catch {
      return false;
    }
  }

  /**
   * Converte a notificação crua em evento normalizado, consultando a API do MP
   * para resolver detalhes do recurso (payment / preapproval).
   */
  async interpretWebhook(raw: RawWebhook): Promise<NormalizedWebhookEvent | null> {
    let body: any = {};
    try { body = raw.rawBody ? JSON.parse(raw.rawBody) : {}; } catch { body = {}; }

    const topic = raw.query['type'] || raw.query['topic'] || body.type || body.topic || '';
    const dataId = raw.query['data.id'] || (body.data && body.data.id) || body.id || null;
    const externalEventId = String(body.id || `${topic}_${dataId}_${raw.query['ts'] || Date.now()}`);

    if (!dataId) return null;

    // payment / subscription_authorized_payment -> consulta /v1/payments/{id}
    if (topic.includes('payment')) {
      const resp = await this.fetchWithRetry(`${MP_API}/v1/payments/${dataId}`, { headers: this.headers() });
      if (!resp.ok) return null;
      const p: any = await resp.json();
      const status: string = p.status; // approved | rejected | refunded | ...
      let kind: NormalizedEventKind | null = null;
      if (status === 'approved') kind = 'payment.approved';
      else if (status === 'rejected' || status === 'cancelled') kind = 'payment.rejected';
      else if (status === 'refunded' || status === 'charged_back') kind = 'payment.refunded';
      return {
        provider: 'mercadopago',
        externalEventId,
        resourceId: String(dataId),
        rawType: topic,
        kind,
        externalReference: p.external_reference || null,
        externalSubscriptionId: p.metadata?.preapproval_id || p.point_of_interaction?.transaction_data?.subscription_id || null,
        externalPaymentId: String(p.id),
        amount: typeof p.transaction_amount === 'number' ? p.transaction_amount : null,
        method: p.payment_type_id || null,
        paymentBrand: p.payment_method_id || null,
        paymentLast4: p.card?.last_four_digits || null,
        paidAt: p.date_approved ? new Date(p.date_approved) : null,
        nextBillingDate: null,
      };
    }

    // preapproval / subscription_preapproval -> consulta /preapproval/{id}
    if (topic.includes('preapproval') || topic.includes('subscription')) {
      const resp = await this.fetchWithRetry(`${MP_API}/preapproval/${dataId}`, { headers: this.headers() });
      if (!resp.ok) return null;
      const s: any = await resp.json();
      const status: string = s.status; // authorized | paused | cancelled | pending
      let kind: NormalizedEventKind | null = 'subscription.updated';
      if (status === 'cancelled') kind = 'subscription.cancelled';
      else if (status === 'authorized') kind = 'subscription.created';
      return {
        provider: 'mercadopago',
        externalEventId,
        resourceId: String(dataId),
        rawType: topic,
        kind,
        externalReference: s.external_reference || null,
        externalSubscriptionId: String(s.id),
        externalPaymentId: null,
        amount: typeof s.auto_recurring?.transaction_amount === 'number' ? s.auto_recurring.transaction_amount : null,
        method: null,
        paymentBrand: null,
        paymentLast4: null,
        paidAt: null,
        nextBillingDate: s.next_payment_date ? new Date(s.next_payment_date) : null,
      };
    }

    return null;
  }
}
