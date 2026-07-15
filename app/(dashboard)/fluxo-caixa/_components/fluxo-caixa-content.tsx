'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { AppHeader } from '@/components/app-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DollarSign, TrendingUp, ArrowUpRight, ArrowDownRight,
  AlertTriangle, BarChart3, RefreshCw, Calendar, CalendarDays,
  Wallet, ShieldAlert, CheckCircle2, Info, Banknote, CreditCard, Building2,
} from 'lucide-react';
import { toast } from 'sonner';

const CashFlowChart = dynamic(() => import('./cashflow-chart'), { ssr: false });

const fmt = (v: number | null | undefined) => (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-BR');

type PeriodPreset = 'hoje' | '7' | '30' | '60' | '90' | 'personalizado';

const accountTypeIcon = (type: string) => {
  switch (type) {
    case 'dinheiro': return <Banknote className="w-3.5 h-3.5 text-emerald-600" />;
    case 'banco': return <Building2 className="w-3.5 h-3.5 text-blue-600" />;
    case 'cartao': return <CreditCard className="w-3.5 h-3.5 text-purple-600" />;
    default: return <Wallet className="w-3.5 h-3.5 text-gray-600" />;
  }
};

export default function FluxoCaixaContent() {
  const [data, setData] = useState<any>(null);
  const [days, setDays] = useState('30');
  const [period, setPeriod] = useState<PeriodPreset>('30');
  const [loading, setLoading] = useState(true);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [popoverOpen, setPopoverOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/fluxo-caixa?days=${days}`);
      const json = await res.json();
      setData(json);
    } catch { toast.error('Erro ao carregar fluxo de caixa'); }
    setLoading(false);
  }, [days]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handlePeriod = (p: PeriodPreset) => {
    setPeriod(p);
    if (p === 'personalizado') { setPopoverOpen(true); return; }
    setDays(p === 'hoje' ? '1' : p);
  };

  const applyCustom = () => {
    if (!customStart || !customEnd) return;
    const start = new Date(customStart);
    const end = new Date(customEnd);
    const diff = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000));
    setDays(String(diff));
    setPeriod('personalizado');
    setPopoverOpen(false);
  };

  const saldoNegativo = data && data.saldoProjetado < 0;
  const disponivelNegativo = data && data.saldoDisponivel < 0;
  const hasOverdue = data && ((data.overduePayables?.count ?? 0) > 0 || (data.overdueReceivables?.count ?? 0) > 0);
  const periodLabel = period === 'hoje' ? '1' : period === 'personalizado' ? days : period;

  return (
    <TooltipProvider>
    <div className="flex flex-col min-h-screen">
      <AppHeader title="Previsão de Caixa" />
      <div className="flex-1 p-4 lg:p-6 space-y-5">
        {/* Period Selector + Alerts */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            {saldoNegativo && <Badge variant="destructive" className="gap-1"><AlertTriangle className="w-3 h-3" /> Saldo projetado negativo</Badge>}
            {hasOverdue && <Badge variant="destructive" className="gap-1"><AlertTriangle className="w-3 h-3" /> Contas vencidas</Badge>}
          </div>
          <div className="flex flex-wrap gap-1.5 items-center">
            {([['hoje', 'Hoje'], ['7', '7 dias'], ['30', '30 dias'], ['60', '60 dias'], ['90', '90 dias']] as [PeriodPreset, string][]).map(([v, label]) => (
              <Button key={v} variant={period === v ? 'default' : 'outline'} size="sm" className="h-7 text-xs px-2.5" onClick={() => handlePeriod(v)}>{label}</Button>
            ))}
            <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant={period === 'personalizado' ? 'default' : 'outline'} size="sm" className="h-7 text-xs px-2.5 gap-1">
                  <CalendarDays className="w-3 h-3" />{period === 'personalizado' ? `${days}d` : 'Período'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-3" align="end">
                <div className="space-y-3">
                  <p className="text-sm font-medium">Período personalizado</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div><Label className="text-xs">De</Label><Input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="h-8 text-xs" /></div>
                    <div><Label className="text-xs">Até</Label><Input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="h-8 text-xs" /></div>
                  </div>
                  <Button size="sm" className="w-full h-8" onClick={applyCustom} disabled={!customStart || !customEnd}>Aplicar</Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* ══════════════════════════════════════════════
            HERO: Saldo Bruto - fonte da verdade
           ══════════════════════════════════════════════ */}
        <div className="card-premium rounded-xl p-5">
          <div className="flex flex-col lg:flex-row lg:items-start gap-4">
            {/* Left: Big number */}
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                  <Wallet className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium text-muted-foreground">Saldo Bruto em Caixa</p>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="w-3.5 h-3.5 text-muted-foreground/60 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs text-xs">
                        Soma real de todas as contas e caixas ativos. Este é o dinheiro que você tem AGORA.
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <p className="text-3xl lg:text-4xl font-bold num-highlight text-blue-700 dark:text-blue-400 tracking-tight">
                    {data ? fmt(data.saldoBruto) : '—'}
                  </p>
                </div>
              </div>
            </div>

            {/* Right: Cash account breakdown */}
            {data?.cashAccounts?.length > 0 && (
              <div className="lg:min-w-[260px]">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 font-medium">Composição</p>
                <div className="space-y-1.5">
                  {data.cashAccounts.map((acc: any) => (
                    <div key={acc.id} className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-muted/50 hover:bg-muted/80 transition-colors">
                      <div className="flex items-center gap-2">
                        {accountTypeIcon(acc.type)}
                        <span className="text-xs font-medium">{acc.name}</span>
                      </div>
                      <span className="font-mono text-xs font-semibold num-highlight">{fmt(acc.currentBalance)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ══════════════════════════════════════════════
            3 CONCEITOS DERIVADOS
           ══════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Obrigações Futuras */}
          <div className={`card-premium rounded-xl p-4 border-l-4 ${(data?.obrigacoesFuturas ?? 0) > 0 ? 'border-l-red-500' : 'border-l-gray-300'}`}>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/40 flex items-center justify-center">
                <ShieldAlert className="w-4 h-4 text-red-600 dark:text-red-400" />
              </div>
              <div className="flex items-center gap-1">
                <p className="text-[11px] font-medium text-muted-foreground">Obrigações Futuras</p>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-3 h-3 text-muted-foreground/60 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-xs">
                    Total de contas a pagar pendentes (independente do vencimento). Esse valor precisa sair do caixa.
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
            <p className="text-xl font-bold text-red-600 dark:text-red-400 num-highlight">
              {data ? fmt(data.obrigacoesFuturas) : '—'}
            </p>
            {data?.obrigacoesFuturasCount > 0 && (
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {data.obrigacoesFuturasCount} conta(s) pendente(s)
              </p>
            )}
          </div>

          {/* Saldo Disponível */}
          <div className={`card-premium rounded-xl p-4 border-l-4 ${disponivelNegativo ? 'border-l-red-500 bg-red-50/50 dark:bg-red-950/20' : 'border-l-emerald-500'}`}>
            <div className="flex items-center gap-2 mb-1">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${disponivelNegativo ? 'bg-red-100 dark:bg-red-900/40' : 'bg-emerald-100 dark:bg-emerald-900/40'}`}>
                <CheckCircle2 className={`w-4 h-4 ${disponivelNegativo ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`} />
              </div>
              <div className="flex items-center gap-1">
                <p className="text-[11px] font-medium text-muted-foreground">Saldo Disponível</p>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-3 h-3 text-muted-foreground/60 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-xs">
                    Saldo Bruto − Obrigações Futuras. Se pagar tudo que deve, quanto sobra (ou falta).
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
            <p className={`text-xl font-bold num-highlight ${disponivelNegativo ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
              {data ? fmt(data.saldoDisponivel) : '—'}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {data ? `${fmt(data.saldoBruto)} − ${fmt(data.obrigacoesFuturas)}` : ''}
            </p>
          </div>

          {/* Saldo Projetado */}
          <div className={`card-premium rounded-xl p-4 border-l-4 ${saldoNegativo ? 'border-l-red-500 bg-red-50/50 dark:bg-red-950/20' : 'border-l-purple-500'}`}>
            <div className="flex items-center gap-2 mb-1">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${saldoNegativo ? 'bg-red-100 dark:bg-red-900/40' : 'bg-purple-100 dark:bg-purple-900/40'}`}>
                <TrendingUp className={`w-4 h-4 ${saldoNegativo ? 'text-red-600 dark:text-red-400' : 'text-purple-600 dark:text-purple-400'}`} />
              </div>
              <div className="flex items-center gap-1">
                <p className="text-[11px] font-medium text-muted-foreground">Saldo Projetado ({days}d)</p>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-3 h-3 text-muted-foreground/60 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-xs">
                    Projeção futura: Saldo Bruto + Recebíveis − Pagáveis + Vendas estimadas no período.
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
            <p className={`text-xl font-bold num-highlight ${saldoNegativo ? 'text-red-600 dark:text-red-400' : 'text-purple-600 dark:text-purple-400'}`}>
              {data ? fmt(data.saldoProjetado) : '—'}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Estimativa para {periodLabel} {period === 'hoje' ? 'dia' : 'dias'}
            </p>
          </div>
        </div>

        {/* ══════════════════════════════════════════════
            INDICADORES SECUNDÁRIOS
           ══════════════════════════════════════════════ */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card>
            <CardContent className="pt-3 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center"><ArrowUpRight className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /></div>
                <div><p className="text-[10px] text-muted-foreground">A Receber ({days}d)</p><p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 num-highlight">{data ? fmt(data.totalRecebiveis) : '—'}</p></div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-3 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/40 flex items-center justify-center"><ArrowDownRight className="w-4 h-4 text-red-600 dark:text-red-400" /></div>
                <div><p className="text-[10px] text-muted-foreground">A Pagar ({days}d)</p><p className="text-sm font-bold text-red-600 dark:text-red-400 num-highlight">{data ? fmt(data.totalPagaveis) : '—'}</p></div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-3 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center"><BarChart3 className="w-4 h-4 text-amber-600 dark:text-amber-400" /></div>
                <div><p className="text-[10px] text-muted-foreground">Média Vendas/Dia</p><p className="text-sm font-bold num-highlight">{data ? fmt(data.avgDailySales) : '—'}</p></div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-3 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-cyan-100 dark:bg-cyan-900/40 flex items-center justify-center"><RefreshCw className="w-4 h-4 text-cyan-600 dark:text-cyan-400" /></div>
                <div><p className="text-[10px] text-muted-foreground">Recorrente/Mês</p><p className="text-sm font-bold num-highlight">{data ? fmt(data.estimatedMonthlyRecurring) : '—'}</p></div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Overdue alerts */}
        {hasOverdue && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(data?.overduePayables?.count ?? 0) > 0 && (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
                <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
                <div><p className="text-sm font-medium text-red-800 dark:text-red-300">{data.overduePayables.count} conta(s) a pagar vencida(s)</p><p className="text-xs text-red-600 dark:text-red-400">Total: <span className="font-mono font-semibold">{fmt(data.overduePayables.total)}</span></p></div>
              </div>
            )}
            {(data?.overdueReceivables?.count ?? 0) > 0 && (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                <div><p className="text-sm font-medium text-amber-800 dark:text-amber-300">{data.overdueReceivables.count} conta(s) a receber vencida(s)</p><p className="text-xs text-amber-600 dark:text-amber-400">Total: <span className="font-mono font-semibold">{fmt(data.overdueReceivables.total)}</span></p></div>
              </div>
            )}
          </div>
        )}

        {/* Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="w-4 h-4" /> Projeção de Saldo — {periodLabel} {period === 'hoje' ? 'dia' : 'dias'}
              <span className="text-xs font-normal text-muted-foreground ml-2">(linha tracejada = com projeção de vendas)</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <div className="h-64 flex items-center justify-center text-muted-foreground">Carregando...</div>
            : data?.projection ? <CashFlowChart data={data.projection} /> : <div className="h-64 flex items-center justify-center text-muted-foreground">Sem dados</div>}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Receivables */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-2"><ArrowUpRight className="w-4 h-4" /> Próximos Recebimentos</CardTitle></CardHeader>
            <CardContent>
              {data?.receivables?.length > 0 ? (<div className="space-y-1.5">{data.receivables.map((r: any) => (<div key={r.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50"><div><p className="text-xs font-medium">{r.description}</p><p className="text-[10px] text-muted-foreground">{fmtDate(r.dueDate)}</p></div><p className="font-mono text-xs font-medium text-emerald-600 dark:text-emerald-400">{fmt(r.amount)}</p></div>))}</div>) : <p className="text-xs text-muted-foreground">Nenhum recebimento no período</p>}
            </CardContent>
          </Card>

          {/* Payables */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-red-600 dark:text-red-400 flex items-center gap-2"><ArrowDownRight className="w-4 h-4" /> Próximos Pagamentos</CardTitle></CardHeader>
            <CardContent>
              {data?.payables?.length > 0 ? (<div className="space-y-1.5">{data.payables.map((p: any) => (<div key={p.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50"><div><p className="text-xs font-medium">{p.description}</p><p className="text-[10px] text-muted-foreground">{fmtDate(p.dueDate)}{p.supplier?.name ? ` • ${p.supplier.name}` : ''}</p></div><p className="font-mono text-xs font-medium text-red-600 dark:text-red-400">{fmt(p.amount)}</p></div>))}</div>) : <p className="text-xs text-muted-foreground">Nenhum pagamento no período</p>}
            </CardContent>
          </Card>

          {/* Recurring Expenses */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-cyan-600 dark:text-cyan-400 flex items-center gap-2"><RefreshCw className="w-4 h-4" /> Despesas Recorrentes</CardTitle></CardHeader>
            <CardContent>
              {data?.recurringExpenses?.length > 0 ? (<div className="space-y-1.5">{data.recurringExpenses.map((e: any, i: number) => (<div key={i} className="flex items-center justify-between p-2 rounded-lg bg-muted/50"><div><p className="text-xs font-medium capitalize">{e.description}</p><p className="text-[10px] text-muted-foreground">{e.count}x nos últimos 90 dias</p></div><p className="font-mono text-xs font-medium">{fmt(e.avgAmount)}/mês</p></div>))}</div>) : <p className="text-xs text-muted-foreground">Nenhuma despesa recorrente detectada</p>}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
    </TooltipProvider>
  );
}