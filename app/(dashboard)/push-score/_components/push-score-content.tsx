'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { AppHeader } from '@/components/app-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Activity, RefreshCw, TrendingUp, TrendingDown, Minus, CheckCircle2,
  AlertTriangle, Sparkles, Clock, ShoppingCart, Info, Heart,
} from 'lucide-react';

const PushScoreHistoryChart = dynamic(
  () => import('./push-score-chart').then(m => ({ default: m.PushScoreHistoryChart })),
  { ssr: false, loading: () => <div className="h-56 animate-pulse bg-muted/40 rounded-xl" /> },
);

/* ===== Tipos ===== */
interface Component { key: string; label: string; score: number | null; weight: number }
interface EvolutionPoint { score: number; delta: number }
interface PushScoreData {
  status: 'ATIVO' | 'EM_FORMACAO';
  score: number | null;
  classification: string | null;
  date: string;
  formacao?: {
    daysOperation: number; totalSales: number;
    minOperationDays: number; minSales: number;
    daysRemaining: number; salesRemaining: number;
  };
  components: Component[];
  strengths: Component[];
  risks: Component[];
  explanation: string[];
  evolution: { today: number; d7: EvolutionPoint | null; d30: EvolutionPoint | null } | null;
  history: { date: string; score: number }[];
}

/* ===== Faixas oficiais ===== */
const CLASSIFICATION: Record<string, { label: string; color: string; text: string; bg: string; ring: string; desc: string }> = {
  SAUDAVEL: { label: 'Saudável', color: '#10b981', text: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10', ring: 'ring-emerald-500/30', desc: 'Sua loja está muito bem. Continue assim!' },
  ESTAVEL: { label: 'Estável', color: '#3b82f6', text: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-500/10', ring: 'ring-blue-500/30', desc: 'Sua loja vai bem, com espaço para melhorar.' },
  ATENCAO: { label: 'Atenção', color: '#f59e0b', text: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10', ring: 'ring-amber-500/30', desc: 'Alguns pontos pedem atenção no curto prazo.' },
  RISCO: { label: 'Risco', color: '#f97316', text: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-500/10', ring: 'ring-orange-500/30', desc: 'Há riscos importantes que merecem ação.' },
  CRITICO: { label: 'Crítico', color: '#ef4444', text: 'text-red-600 dark:text-red-400', bg: 'bg-red-500/10', ring: 'ring-red-500/30', desc: 'Situação crítica. Aja o quanto antes.' },
};

function classifFor(score: number | null, classification: string | null) {
  if (classification && CLASSIFICATION[classification]) return CLASSIFICATION[classification];
  return CLASSIFICATION.ATENCAO;
}

/* cor por valor de componente (0-100) */
function scoreColor(v: number | null): string {
  if (v === null) return 'text-muted-foreground';
  if (v >= 85) return 'text-emerald-600 dark:text-emerald-400';
  if (v >= 70) return 'text-blue-600 dark:text-blue-400';
  if (v >= 55) return 'text-amber-600 dark:text-amber-400';
  if (v >= 40) return 'text-orange-600 dark:text-orange-400';
  return 'text-red-600 dark:text-red-400';
}
function barColor(v: number | null): string {
  if (v === null) return 'bg-muted-foreground/40';
  if (v >= 85) return 'bg-emerald-500';
  if (v >= 70) return 'bg-blue-500';
  if (v >= 55) return 'bg-amber-500';
  if (v >= 40) return 'bg-orange-500';
  return 'bg-red-500';
}

/* ===== Delta (evolução) ===== */
function DeltaBadge({ delta }: { delta: number }) {
  if (delta > 0) return (
    <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold text-sm">
      <TrendingUp className="w-4 h-4" />+{delta}
    </span>
  );
  if (delta < 0) return (
    <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400 font-semibold text-sm">
      <TrendingDown className="w-4 h-4" />{delta}
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-muted-foreground font-semibold text-sm">
      <Minus className="w-4 h-4" />0
    </span>
  );
}

export function PushScoreContent() {
  const [data, setData] = useState<PushScoreData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/push-score', { cache: 'no-store' });
      if (!res.ok) throw new Error('Falha ao carregar');
      const json = await res.json();
      setData(json);
    } catch (e) {
      setError('Não foi possível carregar o Push Score. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  /* ===== Loading ===== */
  if (loading) {
    return (
      <div className="min-h-screen">
        <AppHeader title="Saúde da Loja" />
        <div className="p-4 lg:p-6 space-y-6 max-w-5xl mx-auto">
          <div className="h-64 animate-pulse bg-muted/40 rounded-2xl" />
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-28 animate-pulse bg-muted/40 rounded-2xl" />)}
          </div>
        </div>
      </div>
    );
  }

  /* ===== Erro ===== */
  if (error || !data) {
    return (
      <div className="min-h-screen">
        <AppHeader title="Saúde da Loja" />
        <div className="p-4 lg:p-6 max-w-3xl mx-auto">
          <Card>
            <CardContent className="py-12 text-center space-y-4">
              <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
              <p className="text-muted-foreground">{error ?? 'Sem dados.'}</p>
              <Button onClick={load} variant="outline"><RefreshCw className="w-4 h-4 mr-2" />Tentar novamente</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  /* ===== SEÇÃO 7 — EM FORMAÇÃO ===== */
  if (data.status === 'EM_FORMACAO') {
    const f = data.formacao!;
    const daysPct = Math.min(100, Math.round((f.daysOperation / f.minOperationDays) * 100));
    const salesPct = Math.min(100, Math.round((f.totalSales / f.minSales) * 100));
    return (
      <div className="min-h-screen">
        <AppHeader title="Saúde da Loja" />
        <div className="p-4 lg:p-6 space-y-6 max-w-3xl mx-auto">
          <Card className="overflow-hidden">
            <div className="bg-gradient-to-br from-indigo-500/10 via-violet-500/5 to-transparent p-6 lg:p-8 text-center">
              <div className="w-16 h-16 rounded-2xl bg-indigo-500/15 ring-1 ring-indigo-500/30 flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-8 h-8 text-indigo-500" />
              </div>
              <h2 className="text-2xl font-display font-bold tracking-tight">Seu Push Score está em formação</h2>
              <p className="text-muted-foreground mt-2 max-w-md mx-auto">
                Estamos coletando dados da sua loja. Assim que houver histórico suficiente,
                seu Push Score será calculado automaticamente.
              </p>
            </div>
            <CardContent className="p-6 space-y-6">
              {/* Dias de operação */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="flex items-center gap-2 text-sm font-medium"><Clock className="w-4 h-4 text-indigo-500" />Tempo de operação</span>
                  <span className="text-sm text-muted-foreground">{f.daysOperation} / {f.minOperationDays} dias</span>
                </div>
                <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${daysPct}%` }} />
                </div>
                {f.daysRemaining > 0 && <p className="text-xs text-muted-foreground mt-1.5">Faltam {f.daysRemaining} dia{f.daysRemaining > 1 ? 's' : ''} de operação.</p>}
              </div>
              {/* Vendas */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="flex items-center gap-2 text-sm font-medium"><ShoppingCart className="w-4 h-4 text-violet-500" />Vendas concluídas</span>
                  <span className="text-sm text-muted-foreground">{f.totalSales} / {f.minSales} vendas</span>
                </div>
                <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-violet-500 rounded-full transition-all" style={{ width: `${salesPct}%` }} />
                </div>
                {f.salesRemaining > 0 && <p className="text-xs text-muted-foreground mt-1.5">Faltam {f.salesRemaining} venda{f.salesRemaining > 1 ? 's' : ''} concluída{f.salesRemaining > 1 ? 's' : ''}.</p>}
              </div>
              <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/40 rounded-xl p-3">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <span>Continue registrando suas vendas normalmente. Não é preciso fazer nada além de operar a loja.</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  /* ===== ATIVO ===== */
  const score = data.score ?? 0;
  const cls = classifFor(data.score, data.classification);
  const ev = data.evolution;

  return (
    <div className="min-h-screen">
      <AppHeader title="Saúde da Loja" />
      <div className="p-4 lg:p-6 space-y-6 max-w-5xl mx-auto">

        {/* topo: refresh */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Heart className="w-5 h-5 text-indigo-500" />
            <h2 className="text-base font-display font-bold tracking-tight">Saúde da Loja</h2>
          </div>
          <Button onClick={load} variant="ghost" size="sm" className="text-muted-foreground">
            <RefreshCw className="w-4 h-4 mr-1.5" />Atualizar
          </Button>
        </div>

        {/* ===== SEÇÃO 1 — SCORE PRINCIPAL + SEÇÃO 2 — EVOLUÇÃO ===== */}
        <Card className="overflow-hidden">
          <div className={`p-6 lg:p-8 ${cls.bg}`}>
            <div className="flex flex-col lg:flex-row items-center gap-6 lg:gap-10">
              {/* gauge central */}
              <div className="relative shrink-0">
                <svg width="176" height="176" viewBox="0 0 176 176" className="-rotate-90">
                  <circle cx="88" cy="88" r="78" fill="none" stroke="hsl(var(--muted))" strokeWidth="12" />
                  <circle
                    cx="88" cy="88" r="78" fill="none" stroke={cls.color} strokeWidth="12" strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 78}
                    strokeDashoffset={2 * Math.PI * 78 * (1 - score / 100)}
                    style={{ transition: 'stroke-dashoffset 0.8s ease' }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-5xl font-display font-bold tracking-tight tabular-nums" style={{ color: cls.color }}>{score}</span>
                  <span className="text-xs text-muted-foreground font-medium">de 100</span>
                </div>
              </div>
              {/* classificação + evolução */}
              <div className="flex-1 text-center lg:text-left space-y-4">
                <div>
                  <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold ring-1 ${cls.bg} ${cls.text} ${cls.ring}`}>
                    <Activity className="w-4 h-4" />{cls.label}
                  </span>
                  <p className="text-muted-foreground mt-2 text-sm">{cls.desc}</p>
                </div>
                {/* evolução */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl bg-background/60 p-3 text-center">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">Hoje</p>
                    <p className="text-xl font-bold tabular-nums mt-0.5">{ev?.today ?? score}</p>
                  </div>
                  <div className="rounded-xl bg-background/60 p-3 text-center">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">7 dias</p>
                    {ev?.d7 ? (<div className="mt-0.5 flex flex-col items-center"><p className="text-xl font-bold tabular-nums leading-none">{ev.d7.score}</p><DeltaBadge delta={ev.d7.delta} /></div>) : <p className="text-sm text-muted-foreground mt-2">—</p>}
                  </div>
                  <div className="rounded-xl bg-background/60 p-3 text-center">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">30 dias</p>
                    {ev?.d30 ? (<div className="mt-0.5 flex flex-col items-center"><p className="text-xl font-bold tabular-nums leading-none">{ev.d30.score}</p><DeltaBadge delta={ev.d30.delta} /></div>) : <p className="text-sm text-muted-foreground mt-2">—</p>}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* ===== SEÇÃO 4 — EXPLICAÇÃO (determinística) ===== */}
        {data.explanation?.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2"><Info className="w-4 h-4 text-indigo-500" />O que isso significa</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pt-0">
              {data.explanation.map((line, i) => (
                <p key={i} className="text-sm text-foreground/90 flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />{line}
                </p>
              ))}
            </CardContent>
          </Card>
        )}

        {/* ===== SEÇÃO 3 — 6 COMPONENTES ===== */}
        <div>
          <h3 className="text-sm font-display font-bold mb-3 px-1">Componentes do seu score</h3>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {data.components.map(c => (
              <Card key={c.key} className="hover-lift">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <span className="text-sm font-medium text-muted-foreground">{c.label}</span>
                    <span className="text-[10px] font-semibold text-muted-foreground/70 bg-muted px-1.5 py-0.5 rounded">peso {c.weight}%</span>
                  </div>
                  <p className={`text-3xl font-bold tabular-nums mt-1 ${scoreColor(c.score)}`}>
                    {c.score === null ? '—' : c.score}
                    {c.score !== null && <span className="text-sm font-medium text-muted-foreground">/100</span>}
                  </p>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden mt-2">
                    <div className={`h-full rounded-full transition-all ${barColor(c.score)}`} style={{ width: `${c.score ?? 0}%` }} />
                  </div>
                  {c.score === null && <p className="text-[11px] text-muted-foreground mt-1.5">Não aplicável ainda</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* ===== SEÇÃO 5 — FORÇAS  +  SEÇÃO 6 — RISCOS ===== */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" />Maiores forças</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5 pt-0">
              {data.strengths.length === 0 && <p className="text-sm text-muted-foreground">Sem dados suficientes.</p>}
              {data.strengths.map(c => (
                <div key={c.key} className="flex items-center justify-between gap-3 rounded-lg bg-emerald-500/5 px-3 py-2">
                  <span className="flex items-center gap-2 text-sm font-medium"><CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />{c.label}</span>
                  <span className="text-sm font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{c.score}</span>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-500" />Maiores riscos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5 pt-0">
              {data.risks.length === 0 && <p className="text-sm text-muted-foreground">Sem dados suficientes.</p>}
              {data.risks.map(c => (
                <div key={c.key} className="flex items-center justify-between gap-3 rounded-lg bg-amber-500/5 px-3 py-2">
                  <span className="flex items-center gap-2 text-sm font-medium"><AlertTriangle className={`w-4 h-4 shrink-0 ${scoreColor(c.score)}`} />{c.label}</span>
                  <span className={`text-sm font-bold tabular-nums ${scoreColor(c.score)}`}>{c.score}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* ===== HISTÓRICO — últimos 30 dias ===== */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Activity className="w-4 h-4 text-indigo-500" />Histórico (últimos 30 dias)</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <PushScoreHistoryChart data={data.history} />
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
