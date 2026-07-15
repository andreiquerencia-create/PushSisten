/**
 * ai-usage.ts — CONSUMO E CONTROLE DA QUOTA DE IA (PRIORIDADE 8.2 / TAREFA 5)
 * ---------------------------------------------------------------------------
 * Camada que toca o banco (prisma) para:
 *  - reiniciar o contador mensal (aiCallsThisMonth) quando vira o mês;
 *  - verificar a quota usando o motor único (lib/plan-engine.ts);
 *  - consumir 1 crédito de IA de forma atômica quando a chamada é permitida.
 *
 * Usado pelas rotas de IA conversacional (IA Gerente, Análise de Estoque por IA).
 * NÃO é aplicado a geração de PDF (comprovante) nem à microclassificação
 * automática do financeiro, para não regredir os fluxos de negócio.
 */

import { prisma } from '@/lib/db';
import { checkAiQuota, type AiQuotaCheck } from '@/lib/plan-engine';

/** Verifica se o contador mensal precisa ser reiniciado (novo mês/ano). */
function isNewBillingMonth(resetAt: Date | null | undefined, now: Date): boolean {
  if (!resetAt) return true;
  return resetAt.getUTCFullYear() !== now.getUTCFullYear() || resetAt.getUTCMonth() !== now.getUTCMonth();
}

export interface AiConsumeResult extends AiQuotaCheck {
  consumed: boolean;
}

/**
 * Verifica a quota e, se permitido, consome 1 crédito de IA.
 * Faz o reset mensal automaticamente. Retorna o resultado do motor + `consumed`.
 *
 * Fail-open: em caso de erro inesperado, libera a chamada (não quebra a IA),
 * mas tenta registrar o consumo.
 */
export async function consumeAiCredit(companyId: string | null | undefined): Promise<AiConsumeResult> {
  // Sem empresa (ex.: Master) — ilimitado, não consome.
  if (!companyId) {
    return { allowed: true, limit: -1, used: 0, remaining: -1, unlimited: true, percent: 0, alertLevel: null, reason: null, message: null, consumed: false };
  }

  try {
    const now = new Date();
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { plan: true, aiQuotaMonthly: true, aiCallsThisMonth: true, aiCallsResetAt: true },
    });

    if (!company) {
      return { allowed: true, limit: -1, used: 0, remaining: -1, unlimited: true, percent: 0, alertLevel: null, reason: null, message: null, consumed: false };
    }

    // Reset mensal do contador, se necessário.
    let used = company.aiCallsThisMonth ?? 0;
    if (isNewBillingMonth(company.aiCallsResetAt, now)) {
      used = 0;
      await prisma.company.update({
        where: { id: companyId },
        data: { aiCallsThisMonth: 0, aiCallsResetAt: now },
      });
    }

    const check = checkAiQuota(company, used);

    if (!check.allowed) {
      return { ...check, consumed: false };
    }

    // Consome 1 crédito (incremento atômico).
    const updated = await prisma.company.update({
      where: { id: companyId },
      data: { aiCallsThisMonth: { increment: 1 }, aiCallsResetAt: company.aiCallsResetAt ?? now },
      select: { aiCallsThisMonth: true },
    });

    return { ...check, used: updated.aiCallsThisMonth, consumed: true };
  } catch (error: any) {
    console.error('consumeAiCredit error:', error?.message);
    // Fail-open: não bloquear a IA por erro de infraestrutura.
    return { allowed: true, limit: -1, used: 0, remaining: -1, unlimited: true, percent: 0, alertLevel: null, reason: null, message: null, consumed: false };
  }
}

/** Apenas leitura do consumo de IA da empresa (sem consumir). */
export async function getAiUsage(companyId: string): Promise<AiQuotaCheck> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { plan: true, aiQuotaMonthly: true, aiCallsThisMonth: true },
  });
  return checkAiQuota(company ?? {}, company?.aiCallsThisMonth ?? 0);
}
