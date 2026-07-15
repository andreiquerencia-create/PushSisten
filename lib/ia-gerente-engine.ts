/**
 * IA GERENTE ENGINE 2.0 — Motor de Análise, Explicação e Recomendação
 *
 * Fluxo: Insights Engine → IA Gerente → Plano de Ação
 *
 * A IA NÃO executa ações. Apenas:
 * - Analisa (consome insights oficiais)
 * - Explica (transforma dados em explicações PT-BR)
 * - Prioriza (ordena por severidade + impacto)
 * - Recomenda (sugere ações concretas)
 *
 * Single Source of Truth: Push Score + Insights Engine + métricas homologadas.
 * Sem cálculos próprios. Sem IA generativa. 100% determinístico.
 */

import { generateInsights, type InsightRecord, type InsightGenerationResult } from '@/lib/insights-engine';
import { recordPushScoreSnapshot, computePushScore, classifyScore, MIN_OPERATION_DAYS, MIN_SALES } from '@/lib/push-score-engine';
import { prisma } from '@/lib/db';

// ========================
// TYPES
// ========================

export interface Explanation {
  insightCode: string;
  insightType: string;
  severity: string;
  explanation: string; // O que significa para o lojista
}

export interface Recommendation {
  insightCode: string;
  insightType: string;
  severity: string;
  action: string; // Ação concreta recomendada
  priority: number; // 1 = mais urgente
  impact: string; // Impacto esperado
}

export interface SuggestedMessage {
  insightCode: string;
  context: string;
  template: string; // Mensagem sugerida (com placeholders)
}

export interface Strength {
  area: string;
  description: string;
}

export interface ActionPlanItem {
  rank: number;
  action: string;
  reason: string;
  insightCode: string;
  severity: string;
}

export interface ExecutiveSummary {
  companyId: string;
  generatedAt: Date;
  status: 'ATIVO' | 'EM_FORMACAO';

  // Push Score
  pushScore: number | null;
  classification: string | null;
  pushScoreExplanation: string;

  // Components do Push Score
  components: { label: string; score: number | null; weight: number }[];

  // Insights consumidos
  totalInsights: number;
  insightsByType: Record<string, number>;
  insightsBySeverity: Record<string, number>;

  // Análise
  topRisks: { code: string; message: string; severity: string }[];
  topStrengths: Strength[];

  // Plano de Ação
  recommendedActions: ActionPlanItem[];

  // Explicações e recomendações detalhadas
  explanations: Explanation[];
  recommendations: Recommendation[];
  suggestedMessages: SuggestedMessage[];

  // Resumo
  summary: string;

  // EM_FORMACAO data
  formacao?: {
    daysOperation: number;
    totalSales: number;
    minOperationDays: number;
    minSales: number;
    daysRemaining: number;
    salesRemaining: number;
  };
}

// ========================
// EXPLICAÇÕES (Parte 2)
// ========================

const EXPLANATIONS: Record<string, (metrics: any) => string> = {
  ESTOQUE_PARADO: (m) =>
    `Você possui ${m.count} produto(s) sem venda há mais de ${m.threshold} dias, representando ${fmtBRL(m.capitalParado)} em capital parado. Esse dinheiro poderia estar gerando receita. Considere promoções ou liquidações.`,
  ESTOQUE_CAMPEOES: (m) =>
    `Seus produtos campeões de vendas nos últimos 30 dias são: ${m.campeoes?.slice(0, 3).map((c: any) => c.name).join(', ')}. Mantenha o estoque desses itens sempre abastecido para não perder vendas.`,
  ESTOQUE_BAIXO: (m) =>
    `${m.count} produto(s) estão com estoque abaixo do mínimo configurado. Isso significa risco de ruptura — clientes podem procurar e não encontrar. Faça reposição urgente.`,
  ESTOQUE_ZERADO: (m) =>
    `${m.count} produto(s) estão com estoque zerado. Você já está perdendo vendas desses itens. Priorize a reposição imediata dos mais vendidos.`,
  ESTOQUE_EXCESSIVO: (m) =>
    `${m.count} produto(s) têm estoque muito acima do necessário (${fmtBRL(m.capitalExcesso)} em excesso). Isso imobiliza capital. Avalie promoções ou negociação com fornecedores.`,
  CLIENTE_SUMIDO: (m) =>
    `Você tem ${m.count} cliente(s) recorrente(s) que não compram há mais de ${m.threshold} dias. Isso reduz sua base ativa e pode afetar vendas futuras. A reativação desses clientes é uma oportunidade de baixo custo.`,
  CLIENTE_CHAMAR_HOJE: (m) =>
    `${m.count} cliente(s) estão entre 15 e 30 dias sem comprar. É o momento ideal para um contato — antes que se tornem inativos. Uma ligação ou mensagem pode reativá-los.`,
  CLIENTE_VIP: (m) =>
    `Você identificou ${m.count} cliente(s) VIP com alta recorrência e ticket médio acima da média. Esses clientes são o coracão do seu negócio. Ofereça atendimento diferenciado e fidelize.`,
  CLIENTE_CRESCIMENTO: (m) =>
    `${m.count} cliente(s) aumentou(aram) o gasto em mais de 30% recentemente. Essa é uma tendência positiva — esses clientes estão se tornando mais valiosos. Mantenha o bom atendimento.`,
  FINANCEIRO_MARGEM_QUEDA: (m) =>
    `Sua margem bruta caiu ${Math.abs(m.delta).toFixed(1)} pontos percentuais (de ${m.margemAnterior?.toFixed(1)}% para ${m.margemAtual?.toFixed(1)}%). Isso pode indicar aumento de custos ou preços baixos demais. Revise sua precificação e negocie com fornecedores.`,
  FINANCEIRO_RISCO_CAIXA: (m) =>
    `Seu saldo de caixa (${fmtBRL(m.saldoCaixa)}) cobre apenas ${m.coberturaMeses?.toFixed(1)} mês(es) de despesas operacionais. Isso coloca sua loja em risco de liquidez. Priorize recebimentos e controle gastos.`,
  FINANCEIRO_RECEITA_DESACEL: (m) =>
    `Sua receita caiu ${Math.abs(m.variacao).toFixed(1)}% comparando os últimos 30 dias com o período anterior. Investigue as causas: sazonalidade, concorrência, mix de produtos ou atendimento.`,
  CREDIARIO_INADIMPLENCIA_ALTA: (m) =>
    `A inadimplência no crediário está em ${m.taxaInadimplencia?.toFixed(1)}% (${fmtBRL(m.totalVencido)} vencido). Isso compromete seu fluxo de caixa. Inicie ações de cobrança imediatas.`,
  CREDIARIO_VENCENDO_PROXIMO: (m) =>
    `${m.count} parcela(s) vencem nos próximos ${m.threshold} dias (${fmtBRL(m.total)}). Prepare a cobrança preventiva para evitar que se tornem inadimplência.`,
  CREDIARIO_CLIENTES_RISCO: (m) =>
    `${m.count} cliente(s) têm parcelas vencidas no crediário, totalizando ${fmtBRL(m.totalVencido)}. Esses clientes precisam de atenção imediata: cobrança, renegociação ou bloqueio de crédito.`,
};

// ========================
// RECOMENDAÇÕES (Parte 3)
// ========================

const RECOMMENDATIONS: Record<string, (metrics: any) => { action: string; impact: string }> = {
  ESTOQUE_PARADO: (m) => ({
    action: `Crie uma ação promocional para os ${Math.min(m.count, 10)} produtos sem venda há mais de ${m.threshold} dias. Ofereça descontos de 20-40% para girar o estoque.`,
    impact: `Pode liberar até ${fmtBRL(m.capitalParado)} em capital parado.`,
  }),
  ESTOQUE_CAMPEOES: (m) => ({
    action: `Garanta estoque dos campeões: ${m.campeoes?.slice(0, 3).map((c: any) => `${c.name} (${c.estoque} un.)`).join(', ')}. Negocie volumes maiores com fornecedores para melhorar o custo.`,
    impact: 'Mantém as vendas dos produtos mais lucrativos.',
  }),
  ESTOQUE_BAIXO: (m) => ({
    action: `Reponha urgentemente ${m.count} produto(s) com estoque crítico. Comece pelos mais vendidos: ${m.products?.slice(0, 3).map((p: any) => p.name).join(', ')}.`,
    impact: 'Evita ruptura e perda de vendas imediatas.',
  }),
  ESTOQUE_ZERADO: (m) => ({
    action: `Faça pedido de compra IMEDIATO para os ${m.count} produto(s) zerados. Priorize os que tinham maior giro antes de zerar.`,
    impact: 'Cada dia sem estoque é receita perdida.',
  }),
  ESTOQUE_EXCESSIVO: (m) => ({
    action: `Avalie promoção para reduzir o excesso de ${m.count} produto(s). Negocie devolução com fornecedores se possível.`,
    impact: `Pode liberar até ${fmtBRL(m.capitalExcesso)} para investir em itens mais rentáveis.`,
  }),
  CLIENTE_SUMIDO: (m) => ({
    action: `Ligue para os 10 clientes sumidos com maior histórico de compra. ${m.topClients?.[0] ? `Começe por ${m.topClients[0].name} (${fmtBRL(m.topClients[0].totalPurchased)} em compras).` : ''}`,
    impact: 'Reativar 20% dos inativos pode gerar aumento significativo no faturamento.',
  }),
  CLIENTE_CHAMAR_HOJE: (m) => ({
    action: `Entre em contato com ${Math.min(m.count, 10)} cliente(s) que estão entre 15-30 dias sem comprar. Ofereça novidades ou condições especiais.`,
    impact: 'Contato no momento certo evita que se tornem inativos.',
  }),
  CLIENTE_VIP: (m) => ({
    action: `Crie um programa de fidelidade ou benefício exclusivo para seus ${m.count} clientes VIP. Ofereça pré-visualização de novas coleções ou descontos especiais.`,
    impact: 'Clientes VIP são responsáveis pela maior parte da receita recorrente.',
  }),
  CLIENTE_CRESCIMENTO: (m) => ({
    action: `Parabenize os ${m.count} cliente(s) que aumentaram compras. Ofereça condições especiais para continuar a tendência de crescimento.`,
    impact: 'Fortalecer o vínculo com clientes em crescimento aumenta o lifetime value.',
  }),
  FINANCEIRO_MARGEM_QUEDA: () => ({
    action: 'Revise sua tabela de preços e renegocie com fornecedores. Identifique quais produtos estão com margem comprimida e ajuste.',
    impact: 'Recuperar a margem protege a saúde financeira a longo prazo.',
  }),
  FINANCEIRO_RISCO_CAIXA: (m) => ({
    action: `Priorize recebimentos pendentes e suspenda gastos não-essenciais. Seu caixa (${fmtBRL(m.saldoCaixa)}) precisa crescer para cobrir pelo menos 2 meses de operação.`,
    impact: 'Evita insolvência e garante capacidade de reposição de estoque.',
  }),
  FINANCEIRO_RECEITA_DESACEL: () => ({
    action: 'Analise se a queda é sazonal ou estrutural. Se estrutural: revise mix de produtos, campanhas de marketing e atendimento ao cliente.',
    impact: 'Identificar a causa permite corrigir antes que vire tendência.',
  }),
  CREDIARIO_INADIMPLENCIA_ALTA: (m) => ({
    action: `Priorize cobrança dos clientes com parcelas vencidas. Inicie pelo maior devedor. Se necessário, ofereça renegociação com condições flexíveis.`,
    impact: `Pode recuperar até ${fmtBRL(m.totalVencido)} em recebíveis vencidos.`,
  }),
  CREDIARIO_VENCENDO_PROXIMO: (m) => ({
    action: `Envie lembrete de vencimento para os ${m.count} cliente(s) com parcelas vencendo nos próximos dias. Cobrança preventiva é mais eficaz.`,
    impact: 'Reduz inadimplência futura e mantém o fluxo de caixa.',
  }),
  CREDIARIO_CLIENTES_RISCO: (m) => ({
    action: `Contate os ${m.count} cliente(s) inadimplentes. ${m.clients?.[0] ? `Comece por ${m.clients[0].name} (${fmtBRL(m.clients[0].debitoVencido)} vencido).` : ''} Ofereça renegociação ou bloqueie o crédito.`,
    impact: 'Evita crescimento da inadimplência e protege o capital.',
  }),
};

// ========================
// MENSAGENS SUGERIDAS (Parte 9)
// ========================

const SUGGESTED_MESSAGES: Record<string, (metrics: any) => SuggestedMessage[]> = {
  CLIENTE_SUMIDO: (m) => {
    const clients = m.topClients?.slice(0, 3) || [];
    return clients.map((c: any) => ({
      insightCode: 'CLIENTE_SUMIDO',
      context: `Cliente ${c.name} sem comprar há ${m.threshold}+ dias`,
      template: `Olá ${c.name}, sentimos sua falta! 😊 Temos novidades incríveis na loja. Que tal passar aqui para conferir? Temos condições especiais esperando por você!`,
    }));
  },
  CLIENTE_CHAMAR_HOJE: (m) => {
    const clients = m.clients?.slice(0, 3) || [];
    return clients.map((c: any) => ({
      insightCode: 'CLIENTE_CHAMAR_HOJE',
      context: `Cliente ${c.name} entre 15-30 dias sem compra`,
      template: `Olá ${c.name}! Tudo bem? Passando para avisar que chegaram peças novas que combinam com seu estilo. Quer que eu separe algumas para você dar uma olhada?`,
    }));
  },
  CREDIARIO_CLIENTES_RISCO: (m) => {
    const clients = m.clients?.slice(0, 3) || [];
    return clients.map((c: any) => ({
      insightCode: 'CREDIARIO_CLIENTES_RISCO',
      context: `Cliente ${c.name} com ${fmtBRL(c.debitoVencido)} vencido`,
      template: `Olá ${c.name}, identificamos uma parcela em aberto no valor de ${fmtBRL(c.debitoVencido)}. Gostaríamos de ajudar a regularizar sua situação. Podemos conversar sobre as melhores condições para você?`,
    }));
  },
  CREDIARIO_VENCENDO_PROXIMO: (m) => [{
    insightCode: 'CREDIARIO_VENCENDO_PROXIMO',
    context: `${m.count} parcela(s) vencendo em breve`,
    template: `Olá [Nome], passando para lembrar que sua parcela vence nos próximos dias. Se precisar de qualquer ajuda, estamos à disposição!`,
  }],
  CLIENTE_VIP: (m) => {
    const clients = m.clients?.slice(0, 2) || [];
    return clients.map((c: any) => ({
      insightCode: 'CLIENTE_VIP',
      context: `Cliente VIP ${c.name}`,
      template: `Olá ${c.name}! Como nosso(a) cliente especial, quero te contar em primeira mão: chegou coleção nova! Separei algumas peças que são a sua cara. Quando você pode passar aqui?`,
    }));
  },
};

// ========================
// HELPERS
// ========================

function fmtBRL(value: number | null | undefined): string {
  return (value ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Prioridade: ALTO=3, MEDIO=2, BAIXO=1
const SEVERITY_WEIGHT: Record<string, number> = { ALTO: 3, MEDIO: 2, BAIXO: 1 };

// Impacto no Push Score por tipo de insight (heurística baseada nos pesos das dimensões)
const PUSHSCORE_IMPACT: Record<string, number> = {
  ESTOQUE_PARADO: 15, ESTOQUE_CAMPEOES: 5, ESTOQUE_BAIXO: 15, ESTOQUE_ZERADO: 15, ESTOQUE_EXCESSIVO: 10,
  CLIENTE_SUMIDO: 15, CLIENTE_CHAMAR_HOJE: 10, CLIENTE_VIP: 5, CLIENTE_CRESCIMENTO: 5,
  FINANCEIRO_MARGEM_QUEDA: 25, FINANCEIRO_RISCO_CAIXA: 20, FINANCEIRO_RECEITA_DESACEL: 20,
  CREDIARIO_INADIMPLENCIA_ALTA: 15, CREDIARIO_VENCENDO_PROXIMO: 10, CREDIARIO_CLIENTES_RISCO: 15,
};

// Urgência (0-10): 10=mais urgente
const URGENCY: Record<string, number> = {
  ESTOQUE_ZERADO: 10, FINANCEIRO_RISCO_CAIXA: 9, CREDIARIO_INADIMPLENCIA_ALTA: 9,
  ESTOQUE_BAIXO: 8, CREDIARIO_CLIENTES_RISCO: 8, FINANCEIRO_MARGEM_QUEDA: 7,
  FINANCEIRO_RECEITA_DESACEL: 7, ESTOQUE_PARADO: 6, CLIENTE_SUMIDO: 6,
  CREDIARIO_VENCENDO_PROXIMO: 6, CLIENTE_CHAMAR_HOJE: 5, ESTOQUE_EXCESSIVO: 4,
  CLIENTE_VIP: 3, CLIENTE_CRESCIMENTO: 2, ESTOQUE_CAMPEOES: 2,
};

function calculatePriority(insight: InsightRecord): number {
  const sev = SEVERITY_WEIGHT[insight.severity] || 1;
  const impact = PUSHSCORE_IMPACT[insight.code] || 5;
  const urgency = URGENCY[insight.code] || 5;
  return sev * 40 + impact * 35 + urgency * 25; // Score composto (maior = mais prioritário)
}

// ========================
// FORÇAS (Parte 7)
// ========================

function identifyStrengths(
  insights: InsightRecord[],
  pushScoreResult: any,
): Strength[] {
  const strengths: Strength[] = [];
  const codes = new Set(insights.map(i => i.code));

  // Se não tem insight de margem → margem está saudável
  if (!codes.has('FINANCEIRO_MARGEM_QUEDA') && !codes.has('FINANCEIRO_RECEITA_DESACEL')) {
    strengths.push({ area: 'Financeiro', description: 'Margem e receita estáveis — saúde financeira preservada.' });
  }
  if (!codes.has('FINANCEIRO_RISCO_CAIXA')) {
    strengths.push({ area: 'Liquidez', description: 'Caixa saudável — cobertura adequada para operações.' });
  }
  if (!codes.has('ESTOQUE_ZERADO') && !codes.has('ESTOQUE_BAIXO')) {
    strengths.push({ area: 'Estoque', description: 'Níveis de estoque adequados — sem risco de ruptura.' });
  }
  if (!codes.has('CLIENTE_SUMIDO')) {
    strengths.push({ area: 'Clientes', description: 'Base de clientes ativa e engajada.' });
  }
  if (!codes.has('CREDIARIO_INADIMPLENCIA_ALTA') && !codes.has('CREDIARIO_CLIENTES_RISCO')) {
    strengths.push({ area: 'Crediário', description: 'Crediário saudável — inadimplência controlada.' });
  }
  if (codes.has('CLIENTE_VIP')) {
    strengths.push({ area: 'Fidelização', description: 'Clientes VIP identificados — base fiel gerando receita recorrente.' });
  }
  if (codes.has('CLIENTE_CRESCIMENTO')) {
    strengths.push({ area: 'Crescimento', description: 'Clientes aumentando gastos — tendência positiva de crescimento.' });
  }
  if (codes.has('ESTOQUE_CAMPEOES')) {
    strengths.push({ area: 'Produtos', description: 'Produtos campeões identificados — mix de vendas eficiente.' });
  }

  // Forças do Push Score (subscores >= 70)
  if (pushScoreResult?.status === 'ATIVO') {
    const labels: Record<string, string> = {
      rentabilityScore: 'Rentabilidade', liquidityScore: 'Liquidez', inventoryScore: 'Estoque',
      defaultScore: 'Inadimplência', customerBaseScore: 'Clientes', growthScore: 'Crescimento',
    };
    for (const [field, label] of Object.entries(labels)) {
      const score = (pushScoreResult as any)[field];
      if (score != null && score >= 70 && !strengths.some(s => s.area === label)) {
        strengths.push({ area: label, description: `${label} com nota ${score.toFixed(0)}/100 no Push Score — acima da média.` });
      }
    }
  }

  return strengths.slice(0, 5); // Max 5
}

// ========================
// EXPLICAÇÃO DO PUSH SCORE (Parte 8)
// ========================

function explainPushScore(
  pushScore: number | null,
  classification: string | null,
  components: { label: string; score: number | null; weight: number }[],
  insights: InsightRecord[],
): string {
  if (pushScore == null) {
    return 'Seu Push Score ainda está em formação. Precisamos de mais dados para calcular a saúde da sua loja.';
  }

  const classLabel = classification || classifyScore(pushScore);
  let explanation = `Seu Push Score é ${pushScore.toFixed(0)} (${classLabel}). `;

  // Componentes que estão puxando para baixo (score < 50) e para cima (score >= 70)
  const weak = components.filter(c => c.score != null && c.score < 50).sort((a, b) => (a.score ?? 0) - (b.score ?? 0));
  const strong = components.filter(c => c.score != null && c.score >= 70).sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  if (weak.length > 0) {
    explanation += `Os maiores pontos de atenção são: ${weak.map(c => `${c.label} (${c.score?.toFixed(0)}/100, peso ${c.weight}%)`).join(', ')}. `;
  }
  if (strong.length > 0) {
    explanation += `Seus pontos fortes são: ${strong.map(c => `${c.label} (${c.score?.toFixed(0)}/100)`).join(', ')}. `;
  }

  // Insights que mais impactam
  const highSevInsights = insights.filter(i => i.severity === 'ALTO');
  if (highSevInsights.length > 0) {
    explanation += `Há ${highSevInsights.length} alerta(s) crítico(s) que afetam diretamente seu score. Resolvê-los pode melhorar significativamente sua nota.`;
  } else if (insights.length === 0) {
    explanation += 'Não há alertas críticos. Continue com as boas práticas!';
  } else {
    explanation += 'Resolver os alertas de atenção pode elevar seu score.';
  }

  return explanation;
}

// ========================
// RESUMO EXECUTIVO (Parte 5)
// ========================

function generateSummary(
  pushScore: number | null,
  classification: string | null,
  insights: InsightRecord[],
  strengths: Strength[],
  actions: ActionPlanItem[],
): string {
  if (pushScore == null) {
    return 'Sua loja está em período de formação. Continue operando para acumular dados suficientes para uma análise completa.';
  }

  const altos = insights.filter(i => i.severity === 'ALTO').length;
  const medios = insights.filter(i => i.severity === 'MEDIO').length;

  let summary = '';

  if (pushScore >= 85) {
    summary = `Parabéns! Sua loja está saudável com Push Score ${pushScore.toFixed(0)}. `;
    if (strengths.length > 0) {
      summary += `Destaques: ${strengths.slice(0, 2).map(s => s.description.split(' — ')[0]).join(' e ')}. `;
    }
    summary += 'Foco: manter a excelência e buscar crescimento.';
  } else if (pushScore >= 70) {
    summary = `Sua loja está estável com Push Score ${pushScore.toFixed(0)}, mas há espaço para melhorar. `;
    if (actions.length > 0) {
      summary += `Prioridade do dia: ${actions[0].action.substring(0, 80)}... `;
    }
  } else if (pushScore >= 55) {
    summary = `Atenção: Push Score ${pushScore.toFixed(0)}. `;
    if (altos > 0) summary += `Há ${altos} alerta(s) crítico(s) que precisam de ação imediata. `;
    if (actions.length > 0) summary += `Começe por: ${actions[0].action.substring(0, 80)}...`;
  } else if (pushScore >= 40) {
    summary = `Alerta: Push Score ${pushScore.toFixed(0)} — sua loja está em risco. `;
    summary += `${altos + medios} problema(s) identificado(s). Foco em sobrevivência: ${actions.length > 0 ? actions[0].action.substring(0, 60) + '...' : 'resolva os alertas críticos.'}`;
  } else {
    summary = `CRÍTICO: Push Score ${pushScore.toFixed(0)} — ação urgente necessária! `;
    summary += `${altos} alerta(s) de alta severidade. Priorize: caixa, cobranças e reposição de estoque.`;
  }

  return summary;
}

// ========================
// MOTOR PRINCIPAL
// ========================

/**
 * Gera o resumo executivo completo da IA Gerente para uma empresa.
 * Consome Insights Engine + Push Score oficiais (Single Source of Truth).
 * Determinístico e idempotente.
 */
export async function generateExecutiveSummary(companyId: string): Promise<ExecutiveSummary> {
  const generatedAt = new Date();

  // 1. Verificar EM_FORMACAO
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { createdAt: true },
  });
  const daysOperation = company ? Math.floor((Date.now() - company.createdAt.getTime()) / 86400000) : 0;
  const totalSales = await prisma.sale.count({ where: { companyId, status: 'concluida' } });
  const emFormacao = daysOperation < MIN_OPERATION_DAYS || totalSales < MIN_SALES;

  if (emFormacao) {
    return {
      companyId,
      generatedAt,
      status: 'EM_FORMACAO',
      pushScore: null,
      classification: null,
      pushScoreExplanation: 'Sua loja está em período de formação. Precisamos de mais dias de operação e vendas para gerar uma análise completa.',
      components: [],
      totalInsights: 0,
      insightsByType: {},
      insightsBySeverity: {},
      topRisks: [],
      topStrengths: [{ area: 'Boas-vindas', description: 'Você está começando! Continue registrando vendas e operações para desbloquear a análise completa.' }],
      recommendedActions: [{
        rank: 1,
        action: 'Continue cadastrando produtos, registrando vendas e operando normalmente.',
        reason: 'Dados insuficientes para gerar recomendações específicas.',
        insightCode: 'EM_FORMACAO',
        severity: 'BAIXO',
      }],
      explanations: [],
      recommendations: [],
      suggestedMessages: [],
      summary: `Sua loja tem ${daysOperation} dia(s) de operação e ${totalSales} venda(s). Precisamos de pelo menos ${MIN_OPERATION_DAYS} dias e ${MIN_SALES} vendas para gerar o diagnóstico completo. Faltam ${Math.max(0, MIN_OPERATION_DAYS - daysOperation)} dia(s) e ${Math.max(0, MIN_SALES - totalSales)} venda(s).`,
      formacao: {
        daysOperation,
        totalSales,
        minOperationDays: MIN_OPERATION_DAYS,
        minSales: MIN_SALES,
        daysRemaining: Math.max(0, MIN_OPERATION_DAYS - daysOperation),
        salesRemaining: Math.max(0, MIN_SALES - totalSales),
      },
    };
  }

  // 2. Gerar insights oficiais (idempotente)
  const insightResult = await generateInsights(companyId);

  // 3. Obter Push Score (idempotente)
  const pushScoreResult = await computePushScore(companyId);
  await recordPushScoreSnapshot(companyId); // garante persistência

  const pushScore = pushScoreResult.score;
  const classification = pushScore != null ? classifyScore(pushScore) : null;

  // 4. Montar componentes do Push Score
  const DIMENSION_LABELS: Record<string, string> = {
    rentabilityScore: 'Rentabilidade', liquidityScore: 'Liquidez', inventoryScore: 'Estoque',
    defaultScore: 'Inadimplência', customerBaseScore: 'Clientes', growthScore: 'Crescimento',
  };
  const DIMENSION_WEIGHTS: Record<string, string> = {
    rentabilityScore: 'rentability', liquidityScore: 'liquidity', inventoryScore: 'inventory',
    defaultScore: 'default', customerBaseScore: 'customer', growthScore: 'growth',
  };
  const components = Object.entries(DIMENSION_LABELS).map(([field, label]) => ({
    label,
    score: (pushScoreResult as any)[field] as number | null,
    weight: (pushScoreResult.appliedWeights as any)?.[DIMENSION_WEIGHTS[field]] ?? 0,
  }));

  // 5. Gerar explicações
  const explanations: Explanation[] = insightResult.insights.map(insight => {
    const explainFn = EXPLANATIONS[insight.code];
    const metrics = insight.relatedMetrics || {};
    return {
      insightCode: insight.code,
      insightType: insight.type,
      severity: insight.severity,
      explanation: explainFn ? explainFn(metrics) : insight.message,
    };
  });

  // 6. Gerar recomendações priorizadas (Parte 3 + 4)
  const sortedInsights = [...insightResult.insights].sort((a, b) => calculatePriority(b) - calculatePriority(a));

  const recommendations: Recommendation[] = sortedInsights.map((insight, idx) => {
    const recFn = RECOMMENDATIONS[insight.code];
    const metrics = insight.relatedMetrics || {};
    const rec = recFn ? recFn(metrics) : { action: insight.message, impact: 'Melhoria geral da operação.' };
    return {
      insightCode: insight.code,
      insightType: insight.type,
      severity: insight.severity,
      action: rec.action,
      priority: idx + 1,
      impact: rec.impact,
    };
  });

  // 7. Plano de ação (Top 3) — Parte 6
  const recommendedActions: ActionPlanItem[] = recommendations.slice(0, 3).map((rec, idx) => ({
    rank: idx + 1,
    action: rec.action,
    reason: rec.impact,
    insightCode: rec.insightCode,
    severity: rec.severity,
  }));

  // 8. Top riscos
  const topRisks = sortedInsights
    .filter(i => i.severity === 'ALTO' || i.severity === 'MEDIO')
    .slice(0, 5)
    .map(i => ({ code: i.code, message: i.message, severity: i.severity }));

  // 9. Forças
  const topStrengths = identifyStrengths(insightResult.insights, pushScoreResult);

  // 10. Mensagens sugeridas (Parte 9)
  const suggestedMessages: SuggestedMessage[] = [];
  for (const insight of insightResult.insights) {
    const msgFn = SUGGESTED_MESSAGES[insight.code];
    if (msgFn) {
      suggestedMessages.push(...msgFn(insight.relatedMetrics || {}));
    }
  }

  // 11. Explicação do Push Score (Parte 8)
  const pushScoreExplanation = explainPushScore(pushScore, classification, components, insightResult.insights);

  // 12. Resumo textual (Parte 5)
  const summary = generateSummary(pushScore, classification, insightResult.insights, topStrengths, recommendedActions);

  return {
    companyId,
    generatedAt,
    status: 'ATIVO',
    pushScore,
    classification,
    pushScoreExplanation,
    components,
    totalInsights: insightResult.stats.total,
    insightsByType: insightResult.stats.byType,
    insightsBySeverity: { alto: insightResult.stats.alto, medio: insightResult.stats.medio, baixo: insightResult.stats.baixo },
    topRisks,
    topStrengths,
    recommendedActions,
    explanations,
    recommendations,
    suggestedMessages,
    summary,
  };
}
