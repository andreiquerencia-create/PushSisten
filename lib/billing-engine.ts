/**
 * lib/billing-engine.ts — MOTOR DE COBRANÇA (P8.4) — FONTE ÚNICA DA VERDADE
 * ===========================================================================
 * Este módulo é o ÚNICO ponto que decide acesso/plano/status de cobrança de uma
 * empresa. Princípios invioláveis:
 *
 *   1. O PLANO/PREÇO/LIMITE vem SEMPRE do plan-engine (PLAN_CATALOG). O gateway
 *      (Mercado Pago / mock) é APENAS um processador de pagamento.
 *   2. A Company guarda apenas billingStatus + gracePeriodEndsAt. Todo o resto
 *      relacionado ao gateway vive em BillingCustomer/BillingSubscription.
 *   3. BillingPayment é ESPELHO histórico — nenhuma regra de acesso depende dele.
 *      Fluxo da verdade: Gateway -> Webhook -> Billing Engine -> Company.
 *   4. Toda mutação relevante é AUDITADA em BillingAuditLog (14 eventos).
 *   5. Webhooks são IDEMPOTENTES (WebhookEvent.unique[provider,externalEventId]).
 *   6. Tolerância (grace period) = BILLING_GRACE_DAYS (padrão 15 dias).
 *   7. Empresas SEM assinatura de gateway (billingStatus NONE) NUNCA são
 *      bloqueadas por inadimplência (legado/Master-manual permanecem intactas).
 *
 * Tudo que muta estado roda dentro de prisma.$transaction (atomicidade + rollback).
 */

import { prisma } from './db';
import { getGateway } from './billing';
import { NormalizedWebhookEvent } from './billing/types';
import {
  PLAN_CATALOG, getPlanDefinition, getPlanLabel, normalizePlan,
  isUnlimited, canAddUser, PlanId, PAID_PLANS_ORDERED,
} from './plan-engine';

// ---------------------------------------------------------------------------
// Eventos de auditoria financeira (BillingAuditLog.event)
// ---------------------------------------------------------------------------
export type BillingAuditEvent =
  | 'CHECKOUT_CREATED' | 'CHECKOUT_COMPLETED'
  | 'PAYMENT_APPROVED' | 'PAYMENT_REJECTED' | 'PAYMENT_REFUNDED'
  | 'SUBSCRIPTION_CREATED' | 'SUBSCRIPTION_UPDATED' | 'SUBSCRIPTION_CANCELLED'
  | 'PLAN_UPGRADED' | 'PLAN_DOWNGRADED'
  | 'PAST_DUE_ENTERED' | 'PAST_DUE_EXITED'
  | 'SUSPENDED' | 'REACTIVATED';

// billingStatus possíveis na Company
export type CompanyBillingStatus = 'NONE' | 'ACTIVE' | 'PAST_DUE' | 'SUSPENDED' | 'CANCELED';

const PROVIDER = () => (process.env.BILLING_PROVIDER || 'mock').toLowerCase();

function graceDays(): number {
  const n = parseInt(process.env.BILLING_GRACE_DAYS || '15', 10);
  return Number.isFinite(n) && n > 0 ? n : 15;
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

/** Limites de catálogo a aplicar na Company quando o plano muda (0 = ilimitado/armazenado). */
function catalogLimits(plan: PlanId) {
  const def = PLAN_CATALOG[plan];
  return {
    maxUsers: isUnlimited(def.maxUsers) ? 0 : def.maxUsers,
    aiQuotaMonthly: isUnlimited(def.aiQuotaMonthly) ? 0 : def.aiQuotaMonthly,
  };
}

// ===========================================================================
// AUDITORIA
// ===========================================================================
export async function logBillingEvent(
  tx: any,
  companyId: string,
  event: BillingAuditEvent,
  description: string,
  extra?: { fromPlan?: string | null; toPlan?: string | null; amount?: number | null; provider?: string | null; metadata?: any },
) {
  await tx.billingAuditLog.create({
    data: {
      companyId,
      event,
      description,
      fromPlan: extra?.fromPlan ?? null,
      toPlan: extra?.toPlan ?? null,
      amount: extra?.amount ?? null,
      provider: extra?.provider ?? PROVIDER(),
      metadata: extra?.metadata ?? undefined,
    },
  });
}

// ===========================================================================
// CHECKOUT — inicia a assinatura de um plano pago
// ===========================================================================
export interface CreateCheckoutInput {
  companyId: string;
  targetPlan: string;       // starter | pro | enterprise
  payerEmail?: string | null;
  backUrl: string;          // URL de retorno (sucesso) na nossa aplicação
  webhookUrl: string;       // URL pública do webhook
}

export interface CreateCheckoutOutput {
  ok: boolean;
  initPoint?: string;
  externalSubscriptionId?: string;
  subscriptionId?: string;
  error?: string;
}

export async function createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutOutput> {
  const plan = normalizePlan(input.targetPlan);
  if (plan === 'trial') return { ok: false, error: 'O plano Trial não requer pagamento.' };

  const def = getPlanDefinition(plan);
  const amount = def.priceMonthly;
  if (!amount || amount <= 0) return { ok: false, error: 'Plano sem preço configurado para cobrança.' };

  const company = await prisma.company.findUnique({
    where: { id: input.companyId },
    select: { id: true, name: true, email: true },
  });
  if (!company) return { ok: false, error: 'Empresa não encontrada.' };

  // R1: evita gerar múltiplas assinaturas. Se já existe assinatura ativa,
  // bloqueia novo checkout (a troca deve ser feita via mudança de plano).
  // Se existe apenas uma assinatura pendente, ela será reaproveitada (abaixo).
  const existingCustomer = await prisma.billingCustomer.findUnique({
    where: { companyId: company.id },
    include: {
      subscriptions: {
        where: { status: { in: ['active', 'authorized'] } },
        take: 1,
      },
    },
  });
  if (existingCustomer && existingCustomer.subscriptions.length > 0) {
    return { ok: false, error: 'Esta empresa já possui uma assinatura ativa. Use a opção de trocar de plano.' };
  }

  const gateway = getGateway();
  const payerEmail = input.payerEmail || company.email || 'sem-email@pushsisten.com';

  // 1) Cria o checkout no gateway (fora da transação — chamada externa).
  let checkout;
  try {
    checkout = await gateway.createCheckout({
      companyId: company.id,
      plan,
      amount,
      currency: 'BRL',
      payerEmail,
      backUrl: input.backUrl,
      webhookUrl: input.webhookUrl,
      externalReference: company.id,
    });
  } catch (e: any) {
    return { ok: false, error: `Falha ao criar checkout: ${e?.message || e}` };
  }

  // 2) Persiste BillingCustomer + BillingSubscription (pending) + auditoria.
  const result = await prisma.$transaction(async (tx) => {
    const customer = await tx.billingCustomer.upsert({
      where: { companyId: company.id },
      update: { provider: gateway.provider, email: payerEmail },
      create: { companyId: company.id, provider: gateway.provider, email: payerEmail },
    });

    // R1: reaproveita uma assinatura pendente existente (se houver) em vez de
    // criar uma nova linha a cada checkout. Assim nunca acumulamos duplicatas.
    const pending = await tx.billingSubscription.findFirst({
      where: { billingCustomerId: customer.id, status: 'pending' },
      orderBy: { createdAt: 'desc' },
    });

    const subData = {
      provider: gateway.provider,
      externalSubscriptionId: checkout.externalSubscriptionId,
      plan,
      priceAmount: amount,
      currency: 'BRL',
      cycle: 'monthly',
      status: checkout.status || 'pending',
    };

    const sub = pending
      ? await tx.billingSubscription.update({ where: { id: pending.id }, data: subData })
      : await tx.billingSubscription.create({ data: { billingCustomerId: customer.id, ...subData } });

    await logBillingEvent(tx, company.id, 'CHECKOUT_CREATED',
      `Checkout criado para o plano ${def.label} (R$ ${amount}).`,
      { toPlan: plan, amount, provider: gateway.provider, metadata: { externalSubscriptionId: checkout.externalSubscriptionId } });

    return sub;
  });

  return {
    ok: true,
    initPoint: checkout.initPoint,
    externalSubscriptionId: checkout.externalSubscriptionId,
    subscriptionId: result.id,
  };
}

// ===========================================================================
// SINCRONIZAÇÃO Company <- assinatura paga aprovada
// ===========================================================================
async function applyActivePlan(tx: any, companyId: string, plan: PlanId) {
  const limits = catalogLimits(plan);
  await tx.company.update({
    where: { id: companyId },
    data: {
      plan,
      subscriptionStatus: 'active',
      billingStatus: 'ACTIVE',
      gracePeriodEndsAt: null,
      maxUsers: limits.maxUsers,
      aiQuotaMonthly: limits.aiQuotaMonthly,
    },
  });
}

// ===========================================================================
// WEBHOOK — processa um evento normalizado (IDEMPOTENTE)
// ===========================================================================
export interface ProcessWebhookOutput {
  ok: boolean;
  duplicate?: boolean;
  handled?: boolean;
  kind?: string | null;
  error?: string;
}

export async function processWebhookEvent(
  evt: NormalizedWebhookEvent,
  rawPayload?: any,
): Promise<ProcessWebhookOutput> {
  // --- IDEMPOTÊNCIA: registra o evento; se já existe, decide se reprocessa. ---
  // F2: o registro é criado ANTES do processamento. Porém, se a primeira
  // tentativa terminou em ERRO ou não encontrou a assinatura, o mesmo evento
  // PRECISA poder ser reprocessado num reenvio (pagamento legítimo não pode
  // ser perdido). Só tratamos como duplicado "terminal" quando o evento já foi
  // processado com sucesso (handled:*) ou ignorado de forma definitiva.
  try {
    await prisma.webhookEvent.create({
      data: {
        provider: evt.provider,
        externalEventId: evt.externalEventId,
        resourceId: evt.resourceId,
        type: evt.rawType,
        payload: rawPayload ?? undefined,
      },
    });
  } catch (e: any) {
    // Violação de unique [provider, externalEventId] => evento já registrado.
    if (e?.code === 'P2002') {
      const existing = await prisma.webhookEvent.findUnique({
        where: { provider_externalEventId: { provider: evt.provider, externalEventId: evt.externalEventId } },
        select: { result: true },
      });
      const prev = existing?.result ?? null;
      // Resultados reprocessáveis: falha de processamento ou assinatura ainda
      // inexistente no momento da 1ª tentativa.
      const isRetryable = !!prev && (prev.startsWith('error') || prev === 'ignored:subscription-not-found');
      if (!isRetryable) {
        // Evento já consolidado (sucesso/ignorado definitivo) ou ainda em curso.
        return { ok: true, duplicate: true, handled: false, kind: evt.kind };
      }
      // Caso reprocessável: segue o fluxo normal abaixo (o markWebhookResult
      // fará update da linha existente, não um novo insert).
    } else {
      return { ok: false, error: `Falha ao registrar evento: ${e?.message || e}` };
    }
  }

  if (!evt.kind) {
    await markWebhookResult(evt, 'ignored:no-kind');
    return { ok: true, handled: false, kind: null };
  }

  // Resolve a assinatura pelo externalSubscriptionId ou pela referência externa (companyId).
  const sub = await resolveSubscription(evt);
  if (!sub) {
    await markWebhookResult(evt, 'ignored:subscription-not-found');
    return { ok: true, handled: false, kind: evt.kind };
  }
  const companyId = sub.billingCustomer.companyId;

  try {
    switch (evt.kind) {
      case 'payment.approved':
        await handlePaymentApproved(companyId, sub.id, sub.plan, evt);
        break;
      case 'payment.rejected':
        await handlePaymentRejected(companyId, sub.id, evt);
        break;
      case 'payment.refunded':
        await handlePaymentRefunded(companyId, sub.id, evt);
        break;
      case 'subscription.created':
      case 'subscription.updated':
        await handleSubscriptionUpserted(companyId, sub.id, evt);
        break;
      case 'subscription.cancelled':
        await handleSubscriptionCancelled(companyId, sub.id, evt);
        break;
    }
    await markWebhookResult(evt, `handled:${evt.kind}`);
    return { ok: true, handled: true, kind: evt.kind };
  } catch (e: any) {
    await markWebhookResult(evt, `error:${e?.message || e}`);
    return { ok: false, error: e?.message || String(e), kind: evt.kind };
  }
}

async function markWebhookResult(evt: NormalizedWebhookEvent, result: string) {
  try {
    await prisma.webhookEvent.update({
      where: { provider_externalEventId: { provider: evt.provider, externalEventId: evt.externalEventId } },
      data: { result, processedAt: new Date() },
    });
  } catch { /* não-crítico */ }
}

async function resolveSubscription(evt: NormalizedWebhookEvent) {
  if (evt.externalSubscriptionId) {
    const byExt = await prisma.billingSubscription.findFirst({
      where: { provider: evt.provider, externalSubscriptionId: evt.externalSubscriptionId },
      include: { billingCustomer: true },
      orderBy: { createdAt: 'desc' },
    });
    if (byExt) return byExt;
  }
  if (evt.externalReference) {
    const cust = await prisma.billingCustomer.findUnique({ where: { companyId: evt.externalReference } });
    if (cust) {
      const sub = await prisma.billingSubscription.findFirst({
        where: { billingCustomerId: cust.id },
        include: { billingCustomer: true },
        orderBy: { createdAt: 'desc' },
      });
      if (sub) return sub;
    }
  }
  return null;
}

// --- Handlers ---
async function handlePaymentApproved(companyId: string, subId: string, plan: string, evt: NormalizedWebhookEvent) {
  const planId = normalizePlan(plan);
  const def = getPlanDefinition(planId);
  const next = evt.nextBillingDate || addDays(evt.paidAt || new Date(), 30);

  await prisma.$transaction(async (tx) => {
    // Estado anterior p/ saber se estávamos inadimplentes e se é a 1ª aprovação.
    const before = await tx.company.findUnique({ where: { id: companyId }, select: { billingStatus: true } });
    const subBefore = await tx.billingSubscription.findUnique({ where: { id: subId }, select: { startedAt: true, status: true } });
    const isFirstPayment = !subBefore?.startedAt;

    // RESISTÊNCIA A WEBHOOK FORA DE ORDEM / ATRASADO:
    // Se a assinatura JÁ foi cancelada (ou a empresa está com cobrança CANCELED),
    // um pagamento aprovado que chega atrasado NÃO deve reativar o acesso
    // automaticamente. Registramos o espelho do pagamento e auditamos, mas o
    // estado de cobrança permanece cancelado (reativação exige novo fluxo).
    const isCanceled = subBefore?.status === 'cancelled' || before?.billingStatus === 'CANCELED';
    if (isCanceled) {
      if (evt.externalPaymentId) {
        await tx.billingPayment.upsert({
          where: { provider_externalPaymentId: { provider: evt.provider, externalPaymentId: evt.externalPaymentId } },
          update: { status: 'approved', amount: evt.amount ?? def.priceMonthly, method: evt.method, paidAt: evt.paidAt ?? new Date() },
          create: {
            billingSubscriptionId: subId, provider: evt.provider, externalPaymentId: evt.externalPaymentId,
            amount: evt.amount ?? def.priceMonthly, currency: 'BRL', status: 'approved',
            method: evt.method, paidAt: evt.paidAt ?? new Date(),
          },
        });
      }
      await logBillingEvent(tx, companyId, 'PAYMENT_APPROVED',
        `Pagamento aprovado (R$ ${evt.amount ?? def.priceMonthly}) recebido para assinatura CANCELADA — acesso NÃO reativado automaticamente.`,
        { toPlan: planId, amount: evt.amount ?? def.priceMonthly, provider: evt.provider, metadata: { externalPaymentId: evt.externalPaymentId, lateAfterCancel: true } });
      return;
    }

    // Espelho histórico do pagamento (NÃO é fonte da verdade).
    if (evt.externalPaymentId) {
      await tx.billingPayment.upsert({
        where: { provider_externalPaymentId: { provider: evt.provider, externalPaymentId: evt.externalPaymentId } },
        update: { status: 'approved', amount: evt.amount ?? def.priceMonthly, method: evt.method, paidAt: evt.paidAt ?? new Date() },
        create: {
          billingSubscriptionId: subId,
          provider: evt.provider,
          externalPaymentId: evt.externalPaymentId,
          amount: evt.amount ?? def.priceMonthly,
          currency: 'BRL',
          status: 'approved',
          method: evt.method,
          paidAt: evt.paidAt ?? new Date(),
        },
      });
    }

    await tx.billingSubscription.update({
      where: { id: subId },
      data: {
        status: 'active',
        nextBillingDate: next,
        lastPaymentDate: evt.paidAt ?? new Date(),
        lastPaymentStatus: 'approved',
        paymentMethodBrand: evt.paymentBrand ?? undefined,
        paymentMethodLast4: evt.paymentLast4 ?? undefined,
        startedAt: undefined,
      },
    });
    // Garante startedAt na primeira aprovação.
    await tx.billingSubscription.updateMany({
      where: { id: subId, startedAt: null },
      data: { startedAt: evt.paidAt ?? new Date() },
    });

    await applyActivePlan(tx, companyId, planId);

    // Primeira aprovação => checkout concluído.
    if (isFirstPayment) {
      await logBillingEvent(tx, companyId, 'CHECKOUT_COMPLETED',
        `Checkout concluído — assinatura do plano ${def.label} ativada.`,
        { toPlan: planId, amount: evt.amount ?? def.priceMonthly, provider: evt.provider });
    }

    await logBillingEvent(tx, companyId, 'PAYMENT_APPROVED',
      `Pagamento aprovado (R$ ${evt.amount ?? def.priceMonthly}) — plano ${def.label} ativo até ${next.toLocaleDateString('pt-BR')}.`,
      { toPlan: planId, amount: evt.amount ?? def.priceMonthly, provider: evt.provider, metadata: { externalPaymentId: evt.externalPaymentId } });

    // Se saímos de inadimplência/suspensão, registra a saída.
    if (before?.billingStatus === 'PAST_DUE' || before?.billingStatus === 'SUSPENDED') {
      await logBillingEvent(tx, companyId, 'PAST_DUE_EXITED',
        'Pagamento regularizado — acesso normalizado.', { toPlan: planId, provider: evt.provider });
    }
  });
}

async function handlePaymentRejected(companyId: string, subId: string, evt: NormalizedWebhookEvent) {
  const grace = graceDays();
  const until = addDays(new Date(), grace);
  await prisma.$transaction(async (tx) => {
    const company = await tx.company.findUnique({ where: { id: companyId }, select: { billingStatus: true } });

    if (evt.externalPaymentId) {
      await tx.billingPayment.upsert({
        where: { provider_externalPaymentId: { provider: evt.provider, externalPaymentId: evt.externalPaymentId } },
        update: { status: 'rejected', amount: evt.amount ?? 0, method: evt.method },
        create: {
          billingSubscriptionId: subId, provider: evt.provider, externalPaymentId: evt.externalPaymentId,
          amount: evt.amount ?? 0, currency: 'BRL', status: 'rejected', method: evt.method,
        },
      });
    }
    await tx.billingSubscription.update({
      where: { id: subId },
      data: { lastPaymentStatus: 'rejected', status: 'paused' },
    });

    // Só entra em PAST_DUE se ainda não estava inadimplente (preserva a data de início da tolerância).
    if (company?.billingStatus !== 'PAST_DUE' && company?.billingStatus !== 'SUSPENDED') {
      await tx.company.update({
        where: { id: companyId },
        data: { billingStatus: 'PAST_DUE', gracePeriodEndsAt: until },
      });
      await logBillingEvent(tx, companyId, 'PAST_DUE_ENTERED',
        `Pagamento recusado — período de tolerância de ${grace} dias iniciado (até ${until.toLocaleDateString('pt-BR')}).`,
        { provider: evt.provider });
    }
    await logBillingEvent(tx, companyId, 'PAYMENT_REJECTED',
      'Tentativa de pagamento recusada pelo processador.', { amount: evt.amount ?? 0, provider: evt.provider });
  });
}

async function handlePaymentRefunded(companyId: string, subId: string, evt: NormalizedWebhookEvent) {
  await prisma.$transaction(async (tx) => {
    if (evt.externalPaymentId) {
      await tx.billingPayment.upsert({
        where: { provider_externalPaymentId: { provider: evt.provider, externalPaymentId: evt.externalPaymentId } },
        update: { status: 'refunded' },
        create: {
          billingSubscriptionId: subId, provider: evt.provider, externalPaymentId: evt.externalPaymentId,
          amount: evt.amount ?? 0, currency: 'BRL', status: 'refunded', method: evt.method,
        },
      });
    }
    await tx.billingSubscription.update({ where: { id: subId }, data: { lastPaymentStatus: 'refunded' } });
    await logBillingEvent(tx, companyId, 'PAYMENT_REFUNDED',
      `Pagamento estornado (R$ ${evt.amount ?? 0}).`, { amount: evt.amount ?? 0, provider: evt.provider });
  });
}

async function handleSubscriptionUpserted(companyId: string, subId: string, evt: NormalizedWebhookEvent) {
  await prisma.$transaction(async (tx) => {
    await tx.billingSubscription.update({
      where: { id: subId },
      data: {
        status: evt.kind === 'subscription.created' ? 'authorized' : undefined,
        nextBillingDate: evt.nextBillingDate ?? undefined,
        externalSubscriptionId: evt.externalSubscriptionId ?? undefined,
      },
    });
    const event = evt.kind === 'subscription.created' ? 'SUBSCRIPTION_CREATED' : 'SUBSCRIPTION_UPDATED';
    await logBillingEvent(tx, companyId, event as BillingAuditEvent,
      evt.kind === 'subscription.created' ? 'Assinatura autorizada no processador.' : 'Assinatura atualizada no processador.',
      { provider: evt.provider });
  });
}

async function handleSubscriptionCancelled(companyId: string, subId: string, evt: NormalizedWebhookEvent) {
  await prisma.$transaction(async (tx) => {
    await tx.billingSubscription.update({
      where: { id: subId },
      data: { status: 'cancelled', canceledAt: new Date() },
    });
    await tx.company.update({
      where: { id: companyId },
      data: { billingStatus: 'CANCELED' },
    });
    await logBillingEvent(tx, companyId, 'SUBSCRIPTION_CANCELLED',
      'Assinatura cancelada no processador.', { provider: evt.provider });
  });
}

// ===========================================================================
// CANCELAMENTO (a pedido do cliente)
// ===========================================================================
export async function cancelSubscription(companyId: string): Promise<{ ok: boolean; error?: string }> {
  const customer = await prisma.billingCustomer.findUnique({ where: { companyId } });
  if (!customer) return { ok: false, error: 'Empresa sem assinatura ativa.' };
  const sub = await prisma.billingSubscription.findFirst({
    where: { billingCustomerId: customer.id, status: { in: ['active', 'authorized', 'paused', 'pending'] } },
    orderBy: { createdAt: 'desc' },
  });
  if (!sub) return { ok: false, error: 'Nenhuma assinatura ativa para cancelar.' };

  const gateway = getGateway();
  if (sub.externalSubscriptionId) {
    try { await gateway.cancelSubscription(sub.externalSubscriptionId); }
    catch (e: any) { return { ok: false, error: `Falha no processador: ${e?.message || e}` }; }
  }

  await prisma.$transaction(async (tx) => {
    await tx.billingSubscription.update({ where: { id: sub.id }, data: { status: 'cancelled', canceledAt: new Date() } });
    await tx.company.update({ where: { id: companyId }, data: { billingStatus: 'CANCELED' } });
    await logBillingEvent(tx, companyId, 'SUBSCRIPTION_CANCELLED',
      'Assinatura cancelada a pedido do cliente.', { provider: gateway.provider });
  });
  return { ok: true };
}

// ===========================================================================
// TROCA DE PLANO (upgrade / downgrade) — valida limites ANTES de aplicar
// ===========================================================================
export async function changePlan(companyId: string, targetPlan: string): Promise<{ ok: boolean; error?: string; direction?: 'upgrade' | 'downgrade' | 'same' }> {
  const planTo = normalizePlan(targetPlan);
  if (planTo === 'trial') return { ok: false, error: 'Não é possível trocar para o plano Trial.' };

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, plan: true, billingStatus: true, _count: { select: { users: true } } },
  });
  if (!company) return { ok: false, error: 'Empresa não encontrada.' };

  // F1: a troca de plano só é permitida para empresas com assinatura ativa.
  // Sem esta trava, uma empresa sem cobrança ativa poderia elevar o plano sem pagar.
  const billingCustomer = await prisma.billingCustomer.findUnique({
    where: { companyId },
    include: { subscriptions: { where: { status: { in: ['active', 'authorized'] } }, take: 1 } },
  });
  const hasActiveSubscription =
    company.billingStatus === 'ACTIVE' &&
    !!billingCustomer &&
    billingCustomer.subscriptions.length > 0;
  if (!hasActiveSubscription) {
    return {
      ok: false,
      error: 'É necessário ter uma assinatura ativa para trocar de plano. Realize a assinatura primeiro.',
    };
  }

  const planFrom = normalizePlan(company.plan);
  const orderFrom = PLAN_CATALOG[planFrom].order;
  const orderTo = PLAN_CATALOG[planTo].order;
  const direction: 'upgrade' | 'downgrade' | 'same' = orderTo > orderFrom ? 'upgrade' : orderTo < orderFrom ? 'downgrade' : 'same';

  // DOWNGRADE: validar que o uso atual cabe no novo plano ANTES de aplicar.
  if (direction === 'downgrade') {
    const check = canAddUser({ plan: planTo }, company._count.users - 1 < 0 ? 0 : company._count.users - 1);
    // Verifica se o total atual de usuários excede o limite do novo plano.
    const def = PLAN_CATALOG[planTo];
    if (!isUnlimited(def.maxUsers) && company._count.users > def.maxUsers) {
      return { ok: false, error: `O plano ${def.label} permite até ${def.maxUsers} usuário(s), mas a empresa possui ${company._count.users}. Remova usuários antes de fazer o downgrade.` };
    }
  }

  const def = getPlanDefinition(planTo);
  const gateway = getGateway();

  // Atualiza a assinatura no gateway (se existir) com o novo valor.
  const customer = await prisma.billingCustomer.findUnique({ where: { companyId } });
  if (customer) {
    const sub = await prisma.billingSubscription.findFirst({
      where: { billingCustomerId: customer.id, status: { in: ['active', 'authorized', 'paused'] } },
      orderBy: { createdAt: 'desc' },
    });
    if (sub?.externalSubscriptionId) {
      try { await gateway.updateSubscription({ externalSubscriptionId: sub.externalSubscriptionId, plan: planTo, amount: def.priceMonthly }); }
      catch (e: any) { return { ok: false, error: `Falha no processador: ${e?.message || e}` }; }
    }
  }

  await prisma.$transaction(async (tx) => {
    const limits = catalogLimits(planTo);
    await tx.company.update({
      where: { id: companyId },
      data: { plan: planTo, maxUsers: limits.maxUsers, aiQuotaMonthly: limits.aiQuotaMonthly },
    });
    if (customer) {
      await tx.billingSubscription.updateMany({
        where: { billingCustomerId: customer.id, status: { in: ['active', 'authorized', 'paused'] } },
        data: { plan: planTo, priceAmount: def.priceMonthly },
      });
    }
    if (direction !== 'same') {
      await logBillingEvent(tx, companyId, direction === 'upgrade' ? 'PLAN_UPGRADED' : 'PLAN_DOWNGRADED',
        `Plano alterado de ${getPlanLabel(planFrom)} para ${def.label}.`,
        { fromPlan: planFrom, toPlan: planTo, amount: def.priceMonthly, provider: gateway.provider });
    }
  });

  return { ok: true, direction };
}

// ===========================================================================
// SUSPENSÃO / REATIVAÇÃO (uso interno / cron de tolerância vencida)
// ===========================================================================
export async function suspendForNonPayment(companyId: string): Promise<{ ok: boolean }> {
  await prisma.$transaction(async (tx) => {
    await tx.company.update({ where: { id: companyId }, data: { billingStatus: 'SUSPENDED' } });
    await logBillingEvent(tx, companyId, 'SUSPENDED',
      'Período de tolerância expirado sem pagamento — acesso suspenso.', {});
  });
  return { ok: true };
}

export async function reactivate(companyId: string): Promise<{ ok: boolean }> {
  await prisma.$transaction(async (tx) => {
    await tx.company.update({ where: { id: companyId }, data: { billingStatus: 'ACTIVE', gracePeriodEndsAt: null } });
    await logBillingEvent(tx, companyId, 'REACTIVATED', 'Acesso reativado.', {});
  });
  return { ok: true };
}

/**
 * Varre empresas em PAST_DUE com tolerância vencida e as suspende.
 * Pode ser chamada por um endpoint protegido / tarefa agendada.
 */
export async function sweepExpiredGracePeriods(): Promise<{ suspended: number }> {
  const now = new Date();
  const overdue = await prisma.company.findMany({
    where: { billingStatus: 'PAST_DUE', gracePeriodEndsAt: { lt: now } },
    select: { id: true },
  });
  for (const c of overdue) {
    await suspendForNonPayment(c.id);
  }
  return { suspended: overdue.length };
}

// ===========================================================================
// HISTÓRICO / LEITURA (área cliente + painel master)
// ===========================================================================
export async function getBillingOverview(companyId: string) {
  const customer = await prisma.billingCustomer.findUnique({
    where: { companyId },
    include: {
      subscriptions: {
        orderBy: { createdAt: 'desc' },
        include: { payments: { orderBy: { createdAt: 'desc' }, take: 12 } },
      },
    },
  });
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { billingStatus: true, gracePeriodEndsAt: true, plan: true },
  });
  const auditLogs = await prisma.billingAuditLog.findMany({
    where: { companyId },
    orderBy: { createdAt: 'desc' },
    take: 30,
  });

  const activeSub = customer?.subscriptions.find(s => ['active', 'authorized', 'paused'].includes(s.status))
    || customer?.subscriptions[0] || null;

  const payments = (customer?.subscriptions || []).flatMap(s => s.payments)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 12);

  return {
    billingStatus: (company?.billingStatus || 'NONE') as CompanyBillingStatus,
    gracePeriodEndsAt: company?.gracePeriodEndsAt || null,
    subscription: activeSub ? {
      id: activeSub.id,
      provider: activeSub.provider,
      plan: activeSub.plan,
      priceAmount: activeSub.priceAmount,
      currency: activeSub.currency,
      status: activeSub.status,
      nextBillingDate: activeSub.nextBillingDate,
      lastPaymentDate: activeSub.lastPaymentDate,
      lastPaymentStatus: activeSub.lastPaymentStatus,
      paymentMethodBrand: activeSub.paymentMethodBrand,
      paymentMethodLast4: activeSub.paymentMethodLast4,
    } : null,
    payments: payments.map(p => ({
      id: p.id, amount: p.amount, currency: p.currency, status: p.status,
      method: p.method, paidAt: p.paidAt, createdAt: p.createdAt,
    })),
    auditLogs: auditLogs.map(a => ({
      id: a.id, event: a.event, description: a.description, amount: a.amount, createdAt: a.createdAt,
    })),
  };
}
