/**
 * billing/mock-gateway.ts — Gateway SIMULADO (P8.4 fase inicial)
 * ---------------------------------------------------------------------------
 * Usado quando NÃO há credenciais reais (desenvolvimento/testes). Gera ids
 * determinísticos e um init_point local. Permite validar TODO o fluxo de
 * billing (checkout, webhook, sincronização, inadimplência) sem conectar o
 * Mercado Pago de produção, conforme autorizado.
 *
 * Também expõe helpers estáticos para os testes construírem notificações de
 * webhook normalizadas de forma simples.
 */

import {
  PaymentGateway, CreateCheckoutParams, CreateCheckoutResult, CancelResult,
  UpdateSubscriptionParams, UpdateResult, RawWebhook, NormalizedWebhookEvent,
  NormalizedEventKind,
} from './types';

export class MockGateway implements PaymentGateway {
  readonly provider = 'mock' as const;
  readonly isLive = false;

  async createCheckout(params: CreateCheckoutParams): Promise<CreateCheckoutResult> {
    const externalSubscriptionId = `mock_sub_${params.companyId}_${Date.now()}`;
    // init_point local: uma página interna simula o retorno do gateway.
    const initPoint = `${params.backUrl}${params.backUrl.includes('?') ? '&' : '?'}mock_sub=${encodeURIComponent(externalSubscriptionId)}&status=pending`;
    return { externalSubscriptionId, initPoint, status: 'pending' };
  }

  async cancelSubscription(_externalSubscriptionId: string): Promise<CancelResult> {
    return { status: 'cancelled' };
  }

  async updateSubscription(_params: UpdateSubscriptionParams): Promise<UpdateResult> {
    return { status: 'authorized' };
  }

  // No mock, a assinatura é sempre válida.
  async verifyWebhook(_raw: RawWebhook): Promise<boolean> {
    return true;
  }

  // O mock espera um corpo JSON JÁ no formato normalizado (gerado pelos testes /
  // pela página de simulação). Apenas valida campos mínimos.
  async interpretWebhook(raw: RawWebhook): Promise<NormalizedWebhookEvent | null> {
    let body: any = {};
    try { body = raw.rawBody ? JSON.parse(raw.rawBody) : {}; } catch { return null; }
    if (!body || !body.externalEventId || !body.kind) return null;
    return MockGateway.buildEvent(body);
  }

  /** Helper: monta um evento normalizado completo a partir de campos parciais. */
  static buildEvent(partial: Partial<NormalizedWebhookEvent> & { externalEventId: string; kind: NormalizedEventKind }): NormalizedWebhookEvent {
    return {
      provider: 'mock',
      externalEventId: partial.externalEventId,
      resourceId: partial.resourceId ?? null,
      rawType: partial.rawType ?? partial.kind,
      kind: partial.kind,
      externalReference: partial.externalReference ?? null,
      externalSubscriptionId: partial.externalSubscriptionId ?? null,
      externalPaymentId: partial.externalPaymentId ?? null,
      amount: partial.amount ?? null,
      method: partial.method ?? null,
      paymentBrand: partial.paymentBrand ?? null,
      paymentLast4: partial.paymentLast4 ?? null,
      paidAt: partial.paidAt ?? null,
      nextBillingDate: partial.nextBillingDate ?? null,
    };
  }
}
