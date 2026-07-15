export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { recordPushScoreSnapshot } from '@/lib/push-score-engine';

/**
 * DASHBOARD DO PUSH SCORE™ (PRIORIDADE 3.5) — SOMENTE LEITURA/CONSUMO.
 *
 * Esta rota NÃO cria métricas novas nem cálculos paralelos: ela apenas
 * (1) garante o snapshot de HOJE chamando a função CANÔNICA da engine
 * `recordPushScoreSnapshot` (idempotente — upsert por empresa+dia), e
 * (2) LÊ o histórico já persistido em `PushScoreSnapshot`.
 *
 * Toda a explicabilidade (evolução, forças, riscos, explicação) é
 * DERIVADA dos subscores/pesos persistidos — sem IA, sem recomputar.
 */

// Metadados das 6 dimensões (rótulos PT-BR + chave de peso + campo no snapshot)
const DIMENSIONS = [
  { key: 'rentability', label: 'Rentabilidade', field: 'rentabilityScore', weightKey: 'rentability' },
  { key: 'liquidity', label: 'Liquidez', field: 'liquidityScore', weightKey: 'liquidity' },
  { key: 'inventory', label: 'Estoque', field: 'inventoryScore', weightKey: 'inventory' },
  { key: 'default', label: 'Inadimplência', field: 'defaultScore', weightKey: 'default' },
  { key: 'customer', label: 'Clientes', field: 'customerBaseScore', weightKey: 'customer' },
  { key: 'growth', label: 'Crescimento', field: 'growthScore', weightKey: 'growth' },
] as const;

/** Encontra o snapshot ATIVO mais próximo de uma data alvo (tolerância em dias). */
function nearestSnapshot(snaps: any[], targetTime: number, toleranceDays: number) {
  let best: any = null;
  let bestDiff = Infinity;
  const tol = toleranceDays * 86400000;
  for (const s of snaps) {
    if (s.score === null || s.status !== 'ATIVO') continue;
    const diff = Math.abs(new Date(s.date).getTime() - targetTime);
    if (diff <= tol && diff < bestDiff) { best = s; bestDiff = diff; }
  }
  return best;
}

/**
 * Gera explicação DETERMINÍSTICA (sem IA) com base nos próprios componentes.
 * Compara o snapshot atual com o anterior (variação) e destaca o componente
 * que mais influenciou, além do ponto de atenção atual.
 */
function buildExplanation(current: any, previous: any | null, components: any[]): string[] {
  const lines: string[] = [];
  const applicable = components.filter(c => c.score !== null);
  if (applicable.length === 0) return ['Ainda não há componentes suficientes para explicar o score.'];

  // 1) Variação vs snapshot anterior — qual dimensão mais mudou
  if (previous && previous.score !== null && current.score !== null) {
    const delta = Math.round(current.score - previous.score);
    if (delta !== 0) {
      let bestKey: string | null = null;
      let bestMove = 0;
      for (const d of DIMENSIONS) {
        const cur = current[d.field];
        const prev = previous[d.field];
        if (cur === null || prev === null || cur === undefined || prev === undefined) continue;
        const move = cur - prev;
        // direção do movimento alinhada à direção do score
        if (Math.sign(move) === Math.sign(delta) && Math.abs(move) > Math.abs(bestMove)) {
          bestMove = move; bestKey = d.label;
        }
      }
      if (delta > 0) {
        lines.push(bestKey
          ? `Seu Push Score subiu ${delta} ponto${delta > 1 ? 's' : ''}, puxado principalmente pela melhora em ${bestKey}.`
          : `Seu Push Score subiu ${delta} ponto${delta > 1 ? 's' : ''}.`);
      } else {
        const ad = Math.abs(delta);
        lines.push(bestKey
          ? `Seu Push Score caiu ${ad} ponto${ad > 1 ? 's' : ''}, principalmente pela piora em ${bestKey}.`
          : `Seu Push Score caiu ${ad} ponto${ad > 1 ? 's' : ''}.`);
      }
    } else {
      lines.push('Seu Push Score está estável em relação ao último registro.');
    }
  }

  // 2) Maior ponto de atenção atual (componente mais fraco)
  const sorted = [...applicable].sort((a, b) => a.score - b.score);
  const weakest = sorted[0];
  const strongest = sorted[sorted.length - 1];
  if (weakest && weakest.score < 55) {
    lines.push(`${weakest.label} é hoje o que mais reduz a saúde da sua loja.`);
  } else if (strongest && strongest.score >= 70) {
    lines.push(`${strongest.label} é o que mais sustenta a saúde da sua loja.`);
  }

  return lines.length ? lines : ['Sua loja está com os indicadores equilibrados.'];
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    const companyId = (session.user as any).companyId;
    if (!companyId) {
      return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 400 });
    }

    // (1) Garante o snapshot de HOJE via função canônica (idempotente).
    //     NÃO é cálculo paralelo: é a Única engine oficial.
    const today = await recordPushScoreSnapshot(companyId);

    // (2) LÊ o histórico já persistido (últimos 30 dias) — isolado por empresa.
    const since = new Date(Date.now() - 31 * 86400000);
    const snaps = await prisma.pushScoreSnapshot.findMany({
      where: { companyId, date: { gte: since } },
      orderBy: { date: 'asc' },
    });

    const todaySnap = snaps[snaps.length - 1] ?? null;

    // EM_FORMACAO → resposta enxuta com progresso de ativação
    if (today.status === 'EM_FORMACAO') {
      const raw: any = today.rawMetrics ?? {};
      const minDays = raw.minOperationDays ?? 30;
      const minSales = raw.minSales ?? 10;
      return NextResponse.json({
        status: 'EM_FORMACAO',
        score: null,
        classification: null,
        date: today.date,
        formacao: {
          daysOperation: raw.daysOperation ?? 0,
          totalSales: raw.totalSales ?? 0,
          minOperationDays: minDays,
          minSales,
          daysRemaining: Math.max(0, minDays - (raw.daysOperation ?? 0)),
          salesRemaining: Math.max(0, minSales - (raw.totalSales ?? 0)),
        },
        components: [],
        strengths: [],
        risks: [],
        explanation: [],
        evolution: null,
        history: [],
      });
    }

    // ATIVO → monta componentes a partir do snapshot persistido
    const weights: any = today.appliedWeights ?? {};
    const components = DIMENSIONS.map(d => ({
      key: d.key,
      label: d.label,
      score: (today.subscores as any)[d.field] ?? null,
      weight: weights[d.weightKey] ?? 0,
    }));

    const applicable = components.filter(c => c.score !== null);
    const strengths = [...applicable].sort((a, b) => (b.score as number) - (a.score as number)).slice(0, 3);
    const risks = [...applicable].sort((a, b) => (a.score as number) - (b.score as number)).slice(0, 3);

    // Evolução: hoje vs ~7 dias vs ~30 dias (a partir do histórico persistido)
    const nowTime = new Date(todaySnap.date).getTime();
    const prior = snaps.filter(s => new Date(s.date).getTime() < nowTime);
    const prevSnap = prior.length ? prior[prior.length - 1] : null;
    const d7 = nearestSnapshot(prior, nowTime - 7 * 86400000, 3);
    const d30 = nearestSnapshot(prior, nowTime - 30 * 86400000, 5);

    const evolution = {
      today: today.score,
      d7: d7 ? { score: d7.score, delta: Math.round((today.score as number) - d7.score) } : null,
      d30: d30 ? { score: d30.score, delta: Math.round((today.score as number) - d30.score) } : null,
    };

    const explanation = buildExplanation(
      { ...today.subscores, score: today.score },
      prevSnap ? { ...prevSnap, score: prevSnap.score } : null,
      components,
    );

    const history = snaps
      .filter(s => s.score !== null && s.status === 'ATIVO')
      .map(s => ({ date: s.date, score: s.score }));

    return NextResponse.json({
      status: 'ATIVO',
      score: today.score,
      classification: today.classification,
      date: today.date,
      components,
      strengths,
      risks,
      explanation,
      evolution,
      history,
      rawMetrics: today.rawMetrics,
    });
  } catch (err: any) {
    console.error('[push-score] erro:', err);
    return NextResponse.json({ error: 'Erro ao carregar o Push Score' }, { status: 500 });
  }
}
