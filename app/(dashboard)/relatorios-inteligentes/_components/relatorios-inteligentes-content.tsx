'use client';

import { useState, useEffect } from 'react';
import { AppHeader } from '@/components/app-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import {
  Sparkles, TrendingUp, TrendingDown, AlertTriangle, RefreshCw, Loader2,
  Target, BarChart3, DollarSign, Activity, ArrowUpRight, ArrowDownRight,
  PieChart as PieChartIcon, CheckCircle2, Eye,
} from 'lucide-react';
import Link from 'next/link';

const fmt = (v: number | null | undefined) => {
  if (v == null || isNaN(v)) return 'R$ 0,00';
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const fmtPct = (v: number | null | undefined) => {
  if (v == null || isNaN(v) || !isFinite(v)) return '0,0%';
  return v.toFixed(1).replace('.', ',') + '%';
};

interface GrupoData {
  grupo: string;
  label: string;
  color: string;
  total: number;
  totalPrev: number;
  variacao: number;
  percentReceita: number;
}

interface DespesaItem {
  accountPlanId: string;
  code: string;
  name: string;
  total: number;
  prev: number;
  variacao: number;
  percentReceita: number;
  diff?: number;
}

interface Kpi {
  code: string;
  label: string;
  value: number;
  percent: number;
  ideal: number;
  status: 'ok' | 'alerta';
}

interface Report {
  periodo: string;
  currentStart: string;
  currentEnd: string;
  faturamento: { total: number; vendas: number; recebimentos: number };
  gastosPorGrupo: GrupoData[];
  topDespesas: DespesaItem[];
  kpis: Kpi[];
  crescimentoDespesas: DespesaItem[];
  semClassificacao: { ap: number; ar: number; fr: number; total: number };
}

export default function RelatoriosInteligentesContent() {
  const [periodo, setPeriodo] = useState('mes');
  const [data, setData] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/relatorios/inteligente?periodo=${periodo}`);
      const json = await res.json();
      if (res.ok) setData(json);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [periodo]);

  const periodoLabel = periodo === 'trimestre' ? 'Últimos 3 meses'
    : periodo === 'ano' ? 'Ano atual'
    : 'Mês atual';

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50/30 via-white to-blue-50/30 dark:from-violet-950/10 dark:via-background dark:to-blue-950/10">
      <AppHeader title="Relatórios Inteligentes" />

      <div className="p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-500/30">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Análise Financeira Inteligente</h2>
              <p className="text-xs text-muted-foreground">Período: {periodoLabel}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Select value={periodo} onValueChange={setPeriodo}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mes">Mês atual</SelectItem>
                <SelectItem value="trimestre">Últimos 3 meses</SelectItem>
                <SelectItem value="ano">Ano atual</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {loading && !data ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
          </div>
        ) : !data ? (
          <Card><CardContent className="p-8 text-center text-muted-foreground">Sem dados</CardContent></Card>
        ) : (
          <>
            {/* Alert sem classificação */}
            {data.semClassificacao.total > 0 && (
              <Card className="border-amber-200 dark:border-amber-900/50 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20">
                <CardContent className="p-4 flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-amber-500">
                      <AlertTriangle className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="font-bold text-amber-900 dark:text-amber-100">
                        {data.semClassificacao.total} lançamentos sem classificação
                      </p>
                      <p className="text-xs text-amber-700 dark:text-amber-300">
                        {data.semClassificacao.ap} a pagar · {data.semClassificacao.ar} a receber · {data.semClassificacao.fr} no financeiro
                      </p>
                    </div>
                  </div>
                  <Button asChild size="sm" className="bg-amber-500 hover:bg-amber-600">
                    <Link href="/sem-classificacao">
                      <Eye className="w-4 h-4 mr-2" />Classificar agora
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Faturamento */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/20 border-0">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-emerald-100 text-xs uppercase tracking-wide">Faturamento total</p>
                      <p className="text-2xl font-bold mt-1">{fmt(data.faturamento.total)}</p>
                      <p className="text-xs text-emerald-100 mt-1">{periodoLabel}</p>
                    </div>
                    <DollarSign className="w-8 h-8 text-emerald-200" />
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/20 border-0">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-blue-100 text-xs uppercase tracking-wide">Vendas concluídas</p>
                      <p className="text-2xl font-bold mt-1">{fmt(data.faturamento.vendas)}</p>
                    </div>
                    <BarChart3 className="w-8 h-8 text-blue-200" />
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/20 border-0">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-violet-100 text-xs uppercase tracking-wide">Recebimentos extras</p>
                      <p className="text-2xl font-bold mt-1">{fmt(data.faturamento.recebimentos)}</p>
                    </div>
                    <Activity className="w-8 h-8 text-violet-200" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* KPIs % Faturamento */}
            <Card className="border-violet-200/50">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Target className="w-5 h-5 text-violet-500" />
                  Indicadores Chave (% do Faturamento)
                </CardTitle>
                <p className="text-xs text-muted-foreground">Análise dos principais gastos como percentual da receita</p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  {data.kpis.map(kpi => (
                    <div key={kpi.code} className={`p-3 rounded-lg border-2 ${
                      kpi.status === 'ok'
                        ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/40 dark:bg-emerald-950/10'
                        : 'border-amber-200 bg-amber-50/50 dark:border-amber-900/40 dark:bg-amber-950/10'
                    }`}>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{kpi.label}</p>
                        {kpi.status === 'ok'
                          ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          : <AlertTriangle className="w-4 h-4 text-amber-500" />}
                      </div>
                      <p className={`text-2xl font-bold ${
                        kpi.status === 'ok' ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'
                      }`}>
                        {fmtPct(kpi.percent)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">{fmt(kpi.value)} · ideal ≤ {kpi.ideal}%</p>
                      <Progress value={Math.min(100, (kpi.percent / kpi.ideal) * 100)} className="h-1.5 mt-2" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Gastos por Grupo */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <PieChartIcon className="w-5 h-5 text-blue-500" />
                  Gastos por Grupo do Plano de Contas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data.gastosPorGrupo.map(g => (
                    <div key={g.grupo} className="p-3 rounded-lg border bg-card">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: g.color }} />
                          <span className="font-semibold text-sm">{g.label}</span>
                          <Badge variant="outline" className="text-xs">Grupo {g.grupo}</Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          {g.variacao !== 0 && (
                            <Badge variant={g.variacao > 0 ? 'destructive' : 'default'} className={
                              g.variacao > 0
                                ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400 hover:bg-red-100'
                                : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 hover:bg-emerald-100'
                            }>
                              {g.variacao > 0 ? <ArrowUpRight className="w-3 h-3 mr-1" /> : <ArrowDownRight className="w-3 h-3 mr-1" />}
                              {fmtPct(Math.abs(g.variacao))}
                            </Badge>
                          )}
                          <span className="font-bold text-lg">{fmt(g.total)}</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <Progress value={g.percentReceita} className="flex-1 h-2" />
                        <span className="text-xs font-semibold text-muted-foreground min-w-[60px] text-right">
                          {fmtPct(g.percentReceita)} da receita
                        </span>
                      </div>
                    </div>
                  ))}
                  {data.gastosPorGrupo.every(g => g.total === 0) && (
                    <p className="text-sm text-muted-foreground text-center py-6">Sem gastos registrados no período</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Top Despesas */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <TrendingDown className="w-5 h-5 text-red-500" />
                    Maiores Despesas (Top 15)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-[480px] overflow-y-auto">
                    {data.topDespesas.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-6">Sem despesas no período</p>
                    ) : data.topDespesas.map((d, i) => (
                      <div key={d.accountPlanId} className="p-2.5 rounded-md hover:bg-accent/50 border">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span className="text-xs font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded min-w-[20px] text-center">{i + 1}</span>
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{d.name}</p>
                              <p className="text-xs text-muted-foreground font-mono">{d.code}</p>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-bold text-sm">{fmt(d.total)}</p>
                            <p className="text-xs text-muted-foreground">{fmtPct(d.percentReceita)} receita</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Despesas que mais cresceram */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <TrendingUp className="w-5 h-5 text-orange-500" />
                    Despesas que Mais Cresceram
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">Comparação com período anterior</p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-[480px] overflow-y-auto">
                    {data.crescimentoDespesas.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-6">Sem dados de crescimento</p>
                    ) : data.crescimentoDespesas.map(d => (
                      <div key={d.accountPlanId} className="p-2.5 rounded-md border bg-card">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{d.name}</p>
                            <p className="text-xs text-muted-foreground font-mono">{d.code}</p>
                          </div>
                          {(d.diff ?? 0) > 0 && (
                            <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400 hover:bg-orange-100">
                              <ArrowUpRight className="w-3 h-3 mr-1" />+{fmt(d.diff ?? 0)}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Anterior: {fmt(d.prev)}</span>
                          <span className="font-semibold">Atual: {fmt(d.total)}</span>
                        </div>
                        {d.prev > 0 && (
                          <p className="text-xs text-orange-600 dark:text-orange-400 mt-1 font-semibold">
                            {fmtPct(d.variacao)} vs período anterior
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
