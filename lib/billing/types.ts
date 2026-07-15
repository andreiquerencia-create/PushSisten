/**
 * billing/types.ts — Contratos do gateway de pagamento (P8.4)
 * ---------------------------------------------------------------------------
 * Abstrai o GATEWAY (Mercado Pago hoje, Stripe no futuro). O billing-engine só
 * conhece estas interfaces, nunca o provider concreto. Isso desacopla a regra
 * de negócio do gateway e mantém o plan-engine como fonte da verdade do plano.
 */

export type BillingProvider = 'mercadopago' | 'stripe' | 'mock';

/** Tipos de evento NORMALIZADOS que o billing-engine entende. */
export type NormalizedEventKind =
  | 'payment.approved'
  | 'payment.rejected'
  | 'payment.refunded'
  | 'subscription.created'
  | 'subscription.updated'
  | 'subscription.cancelled';

/** Parâmetros para criar uma assinatura/checkout no gateway. */
export interface CreateCheckoutParams {
  companyId: string;
  /** Plano alvo (chave técnica: starter | pro | enterprise). */
  plan: string;
  /** Valor mensal (vindo do plan-engine — fonte da verdade). */
  amount: number;
  currency: string;
  payerEmail: string;
  /** URL de retorno após o checkout. */
  backUrl: string;
  /** URL pública do webhook (configurada na criação da assinatura no MP). */
  webhookUrl: string;
  /** Referência externa para conciliação (ex.: companyId). */
  externalReference: string;
}

export interface CreateCheckoutResult {
  externalSubscriptionId: string;
  /** URL para redirecionar o cliente ao checkout do gateway. */
  initPoint: string;
  status: string;
}

export interface CancelResult {
  status: string;
}

export interface UpdateSubscriptionParams {
  externalSubscriptionId: string;
  plan: string;
  amount: number;
}

export interface UpdateResult {
  status: string;
}

/** Evento de webhook já NORMALIZADO e resolvido (independente do provider). */
export interface NormalizedWebhookEvent {
  provider: BillingProvider;
  /** Id único do evento/notificação (idempotência). */
  externalEventId: string;
  /** Id do recurso referenciado (payment/subscription) no gateway. */
  resourceId: string | null;
  /** Tipo bruto reportado pelo gateway (auditoria). */
  rawType: string;
  /** Tipo normalizado entendido pelo motor (null = ignorar). */
  kind: NormalizedEventKind | null;
  /** Referência externa (ex.: companyId) quando disponível. */
  externalReference: string | null;
  externalSubscriptionId: string | null;
  externalPaymentId: string | null;
  amount: number | null;
  method: string | null;
  paymentBrand: string | null;
  paymentLast4: string | null;
  paidAt: Date | null;
  /** Próxima cobrança informada pelo gateway, se houver. */
  nextBillingDate: Date | null;
}

/** Cabeçalhos + corpo cru de uma notificação de webhook. */
export interface RawWebhook {
  headers: Record<string, string | null>;
  /** Corpo cru (string) — necessário p/ validação de assinatura. */
  rawBody: string;
  /** Query string params (?type=&data.id=) usados por alguns gateways. */
  query: Record<string, string | null>;
}

/** Contrato que todo gateway concreto precisa implementar. */
export interface PaymentGateway {
  readonly provider: BillingProvider;
  /** true quando há credenciais reais (sandbox/produção). false = modo mock. */
  readonly isLive: boolean;

  createCheckout(params: CreateCheckoutParams): Promise<CreateCheckoutResult>;
  cancelSubscription(externalSubscriptionId: string): Promise<CancelResult>;
  updateSubscription(params: UpdateSubscriptionParams): Promise<UpdateResult>;

  /** Valida a autenticidade da notificação (x-signature etc.). */
  verifyWebhook(raw: RawWebhook): Promise<boolean>;
  /** Converte a notificação crua em evento normalizado (pode consultar a API). */
  interpretWebhook(raw: RawWebhook): Promise<NormalizedWebhookEvent | null>;
}
