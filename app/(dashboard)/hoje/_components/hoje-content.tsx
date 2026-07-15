'use client';

/**
 * CENTRAL DO DIA (/hoje) — PRIORIDADE 7.2
 *
 * Tela AGREGADORA. NÃO calcula nada, NÃO cria motores, NÃO duplica lógica.
 * Apenas LÊ fontes oficiais já homologadas e as apresenta num único lugar:
 *
 *  1. Push Score          → GET /api/push-score          (Push Score Engine)
 *  2. Resumo Executivo     → GET /api/ia-gerente/resumo    (generateExecutiveSummary)
 *  3. Top 5 ações          → GET /api/automation/queue      (Automation Engine)
 *     concluir/ignorar      → PATCH /api/automation/[id]     (Automation Engine)
 *  4. Cobranças do dia      → GET /api/crediario/dashboard   (Crediário oficial)
 *  5. Caixa do dia          → GET /api/caixas/sessoes         (Caixa oficial)
 */

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { AppHeader } from '@/components/app-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
  HeartPulse, Brain, Zap, HandCoins, Wallet, ChevronRight, ArrowUpRight, ArrowDownRight,
  Minus, CheckCircle2, XCircle, AlertTriangle, Clock, Sparkles, Lock, Unlock,
} from 'lucide-react';

/* ─── Tipos (apenas o que consumimos das APIs oficiais) ─── */
interface EvolutionPoint { score: number; delta: number }
interface PushScoreData {
  status: 'ATIVO' | 'EM_FORMACAO';
  score: number | null;
  classification: string | null;
  evolution?: { today: number; d7: EvolutionPoint | null; d30: EvolutionPoint | null } | null;
  formacao?: { daysRemaining: number; salesRemaining: number };
}
interface ResumoData {
  status: 'ATIVO' | 'EM_FORMACAO';
  summary: string;
  recommendedActions?: { rank: number; action: string; reason: string; severity: string }[];
}
interface ActionItem {
  id: string;
  type: string;
  title: string;
  description: string;
  severity: 'ALTO' | 'MEDIO' | 'BAIXO';
  status: string;
}
interface CrediarioData {
  totalAReceber: number;
  totalVencido: number;
  totalEmDia: number;
  clientesInadimplentes: number;
  topDevedores?: { customerId: string; customerName: string; totalDevido: number }[];
}
interface CaixaSessao {
  openSession: {
    id: string;
    openingBalance: number;
    openedAt: string;
    cashAccount?: { name: string; type: string };
  } | null;
}

const CLASSIFICATION: Record<string, { label: string; text: string; bg: string; color: string }> = {
  SAUDAVEL: { label: 'Saudável', text: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10', color: '#10b981' },
  ESTAVEL: { label: 'Estável', text: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-500/10', color: '#3b82f6' },
  ATENCAO: { label: 'Atenção', text: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10', color: '#f59e0b' },
  RISCO: { label: 'Risco', text: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-500/10', color: '#f97316' },
  CRITICO: { label: 'Crítico', text: 'text-red-600 dark:text-red-400', bg: 'bg-red-500/10', color: '#ef4444' },
};

const SEVERITY: Record<string, { label: string; dot: string; badge: string }> = {
  ALTO: { label: 'Alta', dot: 'bg-red-500', badge: 'bg-red-500/10 text-red-600 dark:text-red-400' },
  MEDIO: { label: 'Média', dot: 'bg-amber-500', badge: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  BAIXO: { label: 'Baixa', dot: 'bg-blue-500', badge: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
};

function fmt(v: number) {
  return (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/* Tendência derivada da leitura oficial (evolution.d7 do Push Score). */
function TrendIndicator({ delta }: { delta: number | null | undefined }) {
  if (delta === null || delta === undefined) {
    return <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Minus className="w-3 h-3" /> sem histórico ainda</span>;
  }
  if (delta > 0) {
    return <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400"><ArrowUpRight className="w-3.5 h-3.5" /> +{delta} em 7 dias</span>;
  }
  if (delta < 0) {
    return <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 dark:text-red-400"><ArrowDownRight className="w-3.5 h-3.5" /> {delta} em 7 dias</span>;
  }
  return <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Minus className="w-3 h-3" /> sem mudança em 7 dias</span>;
}

export function HojeContent() {
  const [loading, setLoading] = useState(true);
  const [pushScore, setPushScore] = useState<PushScoreData | null>(null);
  const [resumo, setResumo] = useState<ResumoData | null>(null);
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [crediario, setCrediario] = useState<CrediarioData | null>(null);
  const [caixa, setCaixa] = useState<CaixaSessao | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const [psR, rsR, acR, crR, cxR] = await Promise.allSettled([
        fetch('/api/push-score'),
        fetch('/api/ia-gerente/resumo'),
        fetch('/api/automation/queue?status=PENDENTE&limit=5'),
        fetch('/api/crediario/dashboard'),
        fetch('/api/caixas/sessoes?limit=1'),
      ]);

      if (psR.status === 'fulfilled' && psR.value.ok) setPushScore(await psR.value.json());
      if (rsR.status === 'fulfilled' && rsR.value.ok) setResumo(await rsR.value.json());
      if (acR.status === 'fulfilled' && acR.value.ok) {
        const j = await acR.value.json();
        setActions(j.actions ?? []);
      }
      if (crR.status === 'fulfilled' && crR.value.ok) setCrediario(await crR.value.json());
      if (cxR.status === 'fulfilled' && cxR.value.ok) setCaixa(await cxR.value.json());
    } catch (e) {
      console.error('[hoje] erro ao carregar:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  /* Concluir / ignorar uma ação — via fonte oficial PATCH /api/automation/[id]. */
  const handleAction = useCallback(async (id: string, status: 'EXECUTADO' | 'IGNORADO') => {
    setUpdatingId(id);
    try {
      const res = await fetch(`/api/automation/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setActions(prev => prev.filter(a => a.id !== id));
        toast.success(status === 'EXECUTADO' ? 'Ação concluída' : 'Ação dispensada');
      } else {
        toast.error('Não foi possível atualizar a ação');
      }
    } catch {
      toast.error('Erro de conexão');
    } finally {
      setUpdatingId(null);
    }
  }, []);

  /* ─── Loading ─── */
  if (loading) {
    return (
      <div>
        <AppHeader title="Central do Dia" />
        <div className="p-4 lg:p-6 space-y-6">
          <Skeleton className="h-32 w-full rounded-2xl" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Skeleton className="h-64 w-full rounded-xl" />
            <Skeleton className="h-64 w-full rounded-xl lg:col-span-2" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Skeleton className="h-40 w-full rounded-xl" />
            <Skeleton className="h-40 w-full rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  const psStatus = pushScore?.status;
  const cls = pushScore?.classification ? CLASSIFICATION[pushScore.classification] : null;
  const d7delta = pushScore?.evolution?.d7?.delta ?? null;
  const today = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div>
      <AppHeader title="Central do Dia" />
      <div className="p-4 lg:p-6 space-y-6">

        {/* ══════ BLOCO 1 — PUSH SCORE (termômetro do dia) ══════ */}
        <Link href="/push-score" className="block group">
          <div className="glass-card rounded-2xl p-5 lg:p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <HeartPulse className="w-5 h-5 text-primary" />
                <div>
                  <h2 className="text-base font-bold font-display">Saúde da Loja Hoje</h2>
                  <p className="text-[11px] text-muted-foreground capitalize">{today}</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
            </div>

            {psStatus === 'EM_FORMACAO' ? (
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-full bg-muted/40 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-8 h-8 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-lg font-bold">Saúde da loja em formação</p>
                  <p className="text-sm text-muted-foreground">
                    Faltam {pushScore?.formacao?.daysRemaining ?? 0} dia(s) e {pushScore?.formacao?.salesRemaining ?? 0} venda(s)
                    para ativar o seu score oficial.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-center gap-5">
                <div
                  className="w-24 h-24 rounded-full flex flex-col items-center justify-center flex-shrink-0"
                  style={{ background: cls ? `${cls.color}1a` : 'hsl(var(--muted))' }}
                >
                  <span className="text-3xl font-extrabold font-mono" style={{ color: cls?.color }}>
                    {pushScore?.score ?? '—'}
                  </span>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">/ 100</span>
                </div>
                <div className="flex-1 text-center sm:text-left">
                  {cls && (
                    <span className={`inline-block px-3 py-1 rounded-full text-sm font-bold ${cls.bg} ${cls.text}`}>
                      {cls.label}
                    </span>
                  )}
                  <div className="mt-2"><TrendIndicator delta={d7delta} /></div>
                  <p className="text-xs text-muted-foreground mt-1">Toque para ver a saúde completa da loja</p>
                </div>
              </div>
            )}
          </div>
        </Link>

        {/* ══════ LINHA: RESUMO EXECUTIVO + TOP 5 AÇÕES ══════ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* BLOCO 2 — RESUMO EXECUTIVO */}
          <Card className="lg:col-span-1 card-premium">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-display flex items-center gap-2">
                <Brain className="w-4 h-4 text-violet-500" /> Resumo do Gerente IA
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-line">
                {resumo?.summary || 'Sem resumo disponível no momento.'}
              </p>
              <Link href="/ia-gerente">
                <Button variant="outline" size="sm" className="w-full mt-1">
                  Conversar com a IA Gerente <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* BLOCO 3 — TOP 5 AÇÕES PRIORITÁRIAS */}
          <Card className="lg:col-span-2 card-premium">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-display flex items-center justify-between">
                <span className="flex items-center gap-2"><Zap className="w-4 h-4 text-amber-500" /> O que fazer hoje</span>
                <Link href="/automacoes" className="text-xs font-normal text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                  Ver fila <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {actions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500 mb-2" />
                  <p className="font-semibold">Tudo em dia!</p>
                  <p className="text-sm text-muted-foreground">Nenhuma ação pendente na fila de automações.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {actions.map((a) => {
                    const sev = SEVERITY[a.severity] ?? SEVERITY.BAIXO;
                    return (
                      <div key={a.id} className="flex items-start gap-3 p-3 rounded-xl border border-border/50 bg-muted/20">
                        <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${sev.dot}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold">{a.title}</p>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${sev.badge}`}>{sev.label}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{a.description}</p>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Button
                            size="icon" variant="ghost"
                            className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10"
                            disabled={updatingId === a.id}
                            onClick={() => handleAction(a.id, 'EXECUTADO')}
                            title="Concluir"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon" variant="ghost"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted"
                            disabled={updatingId === a.id}
                            onClick={() => handleAction(a.id, 'IGNORADO')}
                            title="Dispensar"
                          >
                            <XCircle className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ══════ LINHA: COBRANÇAS DO DIA + CAIXA DO DIA ══════ */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* BLOCO 4 — COBRANÇAS DO DIA */}
          <Card className="card-premium">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-display flex items-center justify-between">
                <span className="flex items-center gap-2"><HandCoins className="w-4 h-4 text-orange-500" /> Cobranças do dia</span>
                <Link href="/crediario" className="text-xs font-normal text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                  Crediário <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-muted/30 p-3">
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wide">A receber</p>
                  <p className="text-lg font-bold font-mono">{fmt(crediario?.totalAReceber ?? 0)}</p>
                </div>
                <div className="rounded-xl bg-red-500/5 p-3">
                  <p className="text-[11px] text-red-600 dark:text-red-400 uppercase tracking-wide flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Vencido</p>
                  <p className="text-lg font-bold font-mono text-red-600 dark:text-red-400">{fmt(crediario?.totalVencido ?? 0)}</p>
                </div>
              </div>
              {crediario && crediario.clientesInadimplentes > 0 && (
                <p className="text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">{crediario.clientesInadimplentes}</span> cliente(s) com parcelas vencidas.
                </p>
              )}
              {crediario?.topDevedores && crediario.topDevedores.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Maiores devedores</p>
                  {crediario.topDevedores.slice(0, 3).map((d) => (
                    <div key={d.customerId} className="flex items-center justify-between text-sm">
                      <span className="truncate mr-2">{d.customerName}</span>
                      <span className="font-mono font-semibold flex-shrink-0">{fmt(d.totalDevido)}</span>
                    </div>
                  ))}
                </div>
              )}
              {(!crediario || crediario.totalAReceber === 0) && (
                <p className="text-sm text-muted-foreground">Nenhuma cobrança de crediário em aberto.</p>
              )}
            </CardContent>
          </Card>

          {/* BLOCO 5 — CAIXA DO DIA */}
          <Card className="card-premium">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-display flex items-center justify-between">
                <span className="flex items-center gap-2"><Wallet className="w-4 h-4 text-cyan-500" /> Caixa do dia</span>
                <Link href="/caixas" className="text-xs font-normal text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                  Caixas <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {caixa?.openSession ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
                      <Unlock className="w-3.5 h-3.5" /> Caixa aberto
                    </span>
                    <span className="text-sm text-muted-foreground">{caixa.openSession.cashAccount?.name}</span>
                  </div>
                  <div className="rounded-xl bg-muted/30 p-3">
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Saldo de abertura</p>
                    <p className="text-lg font-bold font-mono">{fmt(caixa.openSession.openingBalance ?? 0)}</p>
                  </div>
                  <p className="text-xs text-muted-foreground inline-flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Aberto em {new Date(caixa.openSession.openedAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted text-muted-foreground text-xs font-bold mb-2">
                    <Lock className="w-3.5 h-3.5" /> Nenhum caixa aberto
                  </span>
                  <p className="text-sm text-muted-foreground">Abra um caixa para iniciar as vendas do dia.</p>
                  <Link href="/caixas" className="mt-3">
                    <Button size="sm" variant="outline">Abrir caixa <ChevronRight className="w-4 h-4 ml-1" /></Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
