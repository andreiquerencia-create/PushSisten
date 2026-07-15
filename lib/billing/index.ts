/**
 * billing/index.ts — Factory do gateway de pagamento (P8.4)
 * ---------------------------------------------------------------------------
 * Resolve qual gateway concreto usar com base em variáveis de ambiente, sempre
 * com FALLBACK SEGURO para o MockGateway. Isso garante que, sem credenciais
 * reais (fase 1), o sistema continua 100% operável em modo simulado.
 *
 *   BILLING_PROVIDER = mock (padrão) | mercadopago
 *   - mercadopago só é usado quando MP_ACCESS_TOKEN estiver configurado;
 *     caso contrário cai para mock automaticamente.
 */

import { PaymentGateway, BillingProvider } from './types';
import { MockGateway } from './mock-gateway';
import { MercadoPagoGateway } from './mercadopago-gateway';

let cached: PaymentGateway | null = null;

export function getGateway(): PaymentGateway {
  if (cached) return cached;

  const desired = (process.env.BILLING_PROVIDER || 'mock').toLowerCase();

  if (desired === 'mercadopago') {
    const mp = new MercadoPagoGateway();
    if (mp.isLive) {
      cached = mp;
      return cached;
    }
    // Sem credenciais reais: fallback seguro para o mock.
    console.warn('[billing] BILLING_PROVIDER=mercadopago sem MP_ACCESS_TOKEN — usando MockGateway.');
  }

  cached = new MockGateway();
  return cached;
}

/** Apenas para testes: permite limpar o cache do factory. */
export function __resetGatewayCache() {
  cached = null;
}

export type { PaymentGateway, BillingProvider };
