'use client';

import { useState, useEffect, useCallback } from 'react';
import { AppHeader } from '@/components/app-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import dynamic from 'next/dynamic';
import {
  DollarSign, TrendingUp, TrendingDown, Wallet, Package, Users,
  ShoppingCart, ArrowUpRight, ArrowDownRight, Minus, RefreshCw,
  Target, BarChart3, Clock, CreditCard, Boxes, UserCheck, UserMinus,
  AlertTriangle, CheckCircle, Info, XCircle, Activity, Gauge,
  PieChart as PieIcon, Zap, Star, Repeat, ShoppingBag,
} from 'lucide-react';

/* Charts — dynamic import to avoid SSR issues with recharts */
const DailySalesChart = dynamic(() => import('./exec-chart').then(m => ({ default: m.DailySalesChart })), { ssr: false, loading: () => <ChartSkeleton /> });
const CategoryChart = dynamic(() => import('./exec-chart').then(m => ({ default: m.CategoryChart })), { ssr: false, loading: () => <ChartSkeleton /> });
const SellerChart = dynamic(() => import('./exec-chart').then(m => ({ default: m.SellerChart })), { ssr: false, loading: () => <ChartSkeleton /> });
const PeakHoursChart = dynamic(() => import('./exec-chart').then(m => ({ default: m.PeakHoursChart })), { ssr: false, loading: () => <ChartSkeleton /> });
const PaymentMethodChart = dynamic(() => import('./exec-chart').then(m => ({ default: m.PaymentMethodChart })), { ssr: false, loading: () => <ChartSkeleton /> });
const CashFlowChart = dynamic(() => import('./exec-chart').then(m => ({ default: m.CashFlowChart })), { ssr: false, loading: () => <ChartSkeleton /> });
const StockValueChart = dynamic(() => import('./exec-chart').then(m => ({ default: m.StockValueChart })), { ssr: false, loading: () => <ChartSkeleton /> });

function ChartSkeleton() {
  return <div className="h-56 animate-pulse bg-muted/40 rounded-xl" />;
}

/* ===== Formatters ===== */
const fmtBRL = (v: number) => (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtPct = (v: number) => `${v > 0 ? '+' : ''}${(v ?? 0).toFixed(1)}%`;
const fmtNum = (v: number) => (v ?? 0).toLocaleString('pt-BR');

/* ===== Types ===== */
interface KPI { value: number; prev?: number; change?: number }
interface CockpitData {
  kpis: {
    faturamentoHoje: KPI; faturamentoMes: KPI; lucroLiquido: KPI;
    margemLiquida: KPI; caixaDisponivel: KPI; recebiveis: KPI;
    ticketMedio: KPI; totalVendas: KPI;
  };
  health: { score: number; status: string; factors: { label: string; score: number; status: string; detail: string }[]; summary: string };
  commercial: {
    dailySales: { date: string; total: number; count: number }[];
    byCategory: { name: string; total: number; count: number }[];
    topProducts: { name: string; total: number; quantity: number }[];
    sellerRanking: { name: string; total: number; count: number; ticket: number }[];
    peakHours: { hour: number; count: number; total: number }[];
    byPaymentMethod: { name: string; total: number; count: number; fee: number }[];
  };
  financial: {
    cashAccounts: { name: string; type: string; balance: number }[];
    totalCash: number; receivablesNext30: number; payablesNext30: number;
    overdueReceivables: number; overduePayables: number; totalFees: number;
    projectedCash: number;
    recentFlow: { date: string; entries: number; exits: number }[];
  };
  stock: {
    totalValue: number; totalCost: number; totalPieces: number;
    deadStockValue: number; deadStockCount: number; lowStockCount: number;
    zeroStockCount: number;
    topByValue: { name: string; value: number; quantity: number }[];
    topDead: { name: string; value: number; quantity: number }[];
  };
  crm: {
    totalActive: number; totalInactive: number; newThisPeriod: number;
    recompraRate: number;
    topClients: { name: string; total: number; count: number; lastPurchase: string | null; type: string; ticket: number }[];
  };
  insights: { type: string; title: string; description: string; metric?: string }[];
  isAdmin: boolean;
}

const PERIODS = [
  { key: 'today', label: 'Hoje' },
  { key: 'week', label: 'Semana' },
  { key: 'month', label: 'Mês' },
  { key: 'quarter', label: 'Trimestre' },
  { key: 'year', label: 'Ano' },
];

/* ===== Main Component ===== */
export function ExecutivoContent() {
  const [data, setData] = useState<CockpitData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('month');

  const fetchData = useCallback(async (p: string) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/executivo-cockpit?period=${p}`);
      if (res.ok) setData(await res.json());
    } catch (e: any) { console.error(e); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(period); }, [period, fetchData]);

  const handlePeriod = (p: string) => setPeriod(p);

  /* ===== Skeleton ===== */
  if (loading || !data) {
    return (
      <div>
        <AppHeader title="Visão Executiva" />
        <div className="p-4 lg:p-6 space-y-6">
          {/* Period filter skeleton */}
          <div className="flex gap-2">
            {[...Array(5)].map((_, i) => <div key={i} className="h-9 w-20 bg-muted/50 rounded-lg animate-pulse" />)}
          </div>
          {/* KPI skeleton */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => <div key={i} className="h-28 bg-muted/50 rounded-2xl animate-pulse" />)}
          </div>
          {/* Health skeleton */}
          <div className="h-32 bg-muted/50 rounded-2xl animate-pulse" />
          {/* Tabs skeleton */}
          <div className="h-96 bg-muted/50 rounded-2xl animate-pulse" />
        </div>
      </div>
    );
  }

  const { kpis, health, commercial, financial, stock, crm, insights, isAdmin } = data;

  const kpiCards = [
    { key: 'faturamentoHoje', label: 'Faturamento Hoje', icon: DollarSign, format: 'currency', color: 'text-blue-600', bg: 'bg-blue-500/10' },
    { key: 'faturamentoMes', label: 'Faturamento Mês', icon: TrendingUp, format: 'currency', color: 'text-emerald-600', bg: 'bg-emerald-500/10' },
    { key: 'lucroLiquido', label: 'Lucro Líquido', icon: Target, format: 'currency', color: 'text-violet-600', bg: 'bg-violet-500/10' },
    { key: 'margemLiquida', label: 'Margem Líquida', icon: PieIcon, format: 'pct', color: 'text-amber-600', bg: 'bg-amber-500/10' },
    { key: 'caixaDisponivel', label: 'Caixa Disponível', icon: Wallet, format: 'currency', color: 'text-cyan-600', bg: 'bg-cyan-500/10' },
    { key: 'recebiveis', label: 'A Receber', icon: CreditCard, format: 'currency', color: 'text-pink-600', bg: 'bg-pink-500/10' },
    { key: 'ticketMedio', label: 'Ticket Médio', icon: ShoppingBag, format: 'currency', color: 'text-indigo-600', bg: 'bg-indigo-500/10' },
    { key: 'totalVendas', label: 'Total Vendas', icon: ShoppingCart, format: 'number', color: 'text-teal-600', bg: 'bg-teal-500/10' },
  ];

  return (
    <div>
      <AppHeader title="Visão Executiva" />
      <div className="p-4 lg:p-6 space-y-6">

        {/* ===== Period Filter + Refresh ===== */}
        <div className="flex items-center gap-2 flex-wrap">
          {PERIODS.map(p => (
            <Button
              key={p.key}
              variant={period === p.key ? 'default' : 'outline'}
              size="sm"
              className={`rounded-lg text-xs font-medium transition-all ${
                period === p.key ? 'shadow-md' : 'hover:bg-muted'
              }`}
              onClick={() => handlePeriod(p.key)}
            >
              {p.label}
            </Button>
          ))}
          <Button variant="ghost" size="sm" className="ml-auto" onClick={() => fetchData(period)}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>

        {/* ===== 8 KPI Cards ===== */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {kpiCards.map(kc => {
            const kpi = kpis[kc.key as keyof typeof kpis];
            const value = kc.format === 'currency' ? fmtBRL(kpi.value)
              : kc.format === 'pct' ? `${(kpi.value ?? 0).toFixed(1)}%`
              : fmtNum(kpi.value);
            const change = kpi.change;
            const hasChange = change !== undefined && change !== null;
            return (
              <Card key={kc.key} className="border-0 shadow-sm hover:shadow-md transition-all group">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className={`w-9 h-9 rounded-xl ${kc.bg} flex items-center justify-center`}>
                      <kc.icon className={`w-4.5 h-4.5 ${kc.color}`} />
                    </div>
                    {hasChange && (
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-semibold px-1.5 py-0.5 border-0 ${
                          change! > 0 ? 'bg-emerald-50 text-emerald-700' :
                          change! < 0 ? 'bg-red-50 text-red-600' :
                          'bg-muted text-muted-foreground'
                        }`}
                      >
                        {change! > 0 ? <ArrowUpRight className="w-3 h-3 mr-0.5" /> :
                         change! < 0 ? <ArrowDownRight className="w-3 h-3 mr-0.5" /> :
                         <Minus className="w-3 h-3 mr-0.5" />}
                        {fmtPct(change!)}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mb-1">{kc.label}</p>
                  <p className="text-lg font-bold font-mono tracking-tight">{value}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* ===== Health Thermometer ===== */}
        <Card className="border-0 shadow-sm overflow-hidden">
          <CardContent className="p-5">
            <div className="flex flex-col md:flex-row md:items-center gap-5">
              {/* Score Circle */}
              <div className="flex items-center gap-4 shrink-0">
                <div className="relative w-20 h-20">
                  <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                    <circle cx="40" cy="40" r="34" fill="none" stroke="hsl(var(--border))" strokeWidth="7" />
                    <circle
                      cx="40" cy="40" r="34" fill="none"
                      strokeWidth="7" strokeLinecap="round"
                      stroke={health.status === 'saudavel' ? '#10b981' : health.status === 'atencao' ? '#f59e0b' : '#ef4444'}
                      strokeDasharray={`${(health.score / 100) * 213.6} 213.6`}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xl font-bold font-mono">{health.score}</span>
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Activity className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-semibold">Saúde da Empresa</span>
                  </div>
                  <Badge className={`text-xs ${
                    health.status === 'saudavel' ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100' :
                    health.status === 'atencao' ? 'bg-amber-100 text-amber-800 hover:bg-amber-100' :
                    'bg-red-100 text-red-800 hover:bg-red-100'
                  }`}>
                    {health.status === 'saudavel' ? 'Saudável' : health.status === 'atencao' ? 'Atenção' : 'Crítico'}
                  </Badge>
                </div>
              </div>

              {/* Factors */}
              <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-3">
                {health.factors.map(f => (
                  <div key={f.label} className="bg-muted/40 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-muted-foreground">{f.label}</span>
                      <span className={`w-2 h-2 rounded-full ${
                        f.status === 'ok' ? 'bg-emerald-500' : f.status === 'atencao' ? 'bg-amber-500' : 'bg-red-500'
                      }`} />
                    </div>
                    <p className="text-sm font-semibold font-mono">{f.score}/25</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{f.detail}</p>
                  </div>
                ))}
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-3 leading-relaxed">{health.summary}</p>
          </CardContent>
        </Card>

        {/* ===== Tabs ===== */}
        <Tabs defaultValue="comercial" className="w-full">
          <TabsList className="w-full flex bg-muted/50 rounded-xl p-1 gap-1 h-auto flex-wrap">
            <TabsTrigger value="comercial" className="flex-1 min-w-[100px] rounded-lg data-[state=active]:shadow-sm text-xs font-medium py-2.5">
              <BarChart3 className="w-3.5 h-3.5 mr-1.5" /> Comercial
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="financeiro" className="flex-1 min-w-[100px] rounded-lg data-[state=active]:shadow-sm text-xs font-medium py-2.5">
                <Wallet className="w-3.5 h-3.5 mr-1.5" /> Financeiro
              </TabsTrigger>
            )}
            {isAdmin && (
              <TabsTrigger value="estoque" className="flex-1 min-w-[100px] rounded-lg data-[state=active]:shadow-sm text-xs font-medium py-2.5">
                <Package className="w-3.5 h-3.5 mr-1.5" /> Estoque
              </TabsTrigger>
            )}
            <TabsTrigger value="crm" className="flex-1 min-w-[100px] rounded-lg data-[state=active]:shadow-sm text-xs font-medium py-2.5">
              <Users className="w-3.5 h-3.5 mr-1.5" /> CRM
            </TabsTrigger>
          </TabsList>

          {/* ===== TAB: Comercial ===== */}
          <TabsContent value="comercial" className="mt-4 space-y-4">
            {/* Daily Sales */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-blue-500" /> Vendas Diárias
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-4">
                <DailySalesChart data={commercial.dailySales} />
              </CardContent>
            </Card>

            <div className="grid md:grid-cols-2 gap-4">
              {/* Categories */}
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Boxes className="w-4 h-4 text-emerald-500" /> Por Categoria
                  </CardTitle>
                </CardHeader>
                <CardContent><CategoryChart data={commercial.byCategory} /></CardContent>
              </Card>

              {/* Sellers */}
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Star className="w-4 h-4 text-violet-500" /> Ranking Vendedores
                  </CardTitle>
                </CardHeader>
                <CardContent><SellerChart data={commercial.sellerRanking} /></CardContent>
              </Card>

              {/* Peak Hours */}
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Clock className="w-4 h-4 text-cyan-500" /> Horários de Pico
                  </CardTitle>
                </CardHeader>
                <CardContent><PeakHoursChart data={commercial.peakHours} /></CardContent>
              </Card>

              {/* Payment Methods */}
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-pink-500" /> Formas de Pagamento
                  </CardTitle>
                </CardHeader>
                <CardContent><PaymentMethodChart data={commercial.byPaymentMethod} /></CardContent>
              </Card>
            </div>

            {/* Top Products Table */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-amber-500" /> Top Produtos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/50">
                        <th className="text-left py-2 px-2 text-xs text-muted-foreground font-medium">#</th>
                        <th className="text-left py-2 px-2 text-xs text-muted-foreground font-medium">Produto</th>
                        <th className="text-right py-2 px-2 text-xs text-muted-foreground font-medium">Qtd</th>
                        <th className="text-right py-2 px-2 text-xs text-muted-foreground font-medium">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(commercial.topProducts ?? []).slice(0, 10).map((p, i) => (
                        <tr key={i} className="border-b border-border/30 last:border-0 hover:bg-muted/30 transition-colors">
                          <td className="py-2 px-2 text-muted-foreground font-mono text-xs">{i + 1}</td>
                          <td className="py-2 px-2 font-medium text-xs truncate max-w-[200px]">{p.name}</td>
                          <td className="py-2 px-2 text-right font-mono text-xs">{fmtNum(p.quantity)}</td>
                          <td className="py-2 px-2 text-right font-mono text-xs font-semibold">{fmtBRL(p.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {(!commercial.topProducts || commercial.topProducts.length === 0) && (
                    <p className="text-center text-muted-foreground text-xs py-6">Nenhum produto vendido no período</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ===== TAB: Financeiro ===== */}
          {isAdmin && (
            <TabsContent value="financeiro" className="mt-4 space-y-4">
              {/* Financial KPI row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <MiniCard icon={Wallet} label="Caixa Total" value={fmtBRL(financial.totalCash)} color="text-emerald-600" bg="bg-emerald-500/10" />
                <MiniCard icon={ArrowUpRight} label="A Receber (30d)" value={fmtBRL(financial.receivablesNext30)} color="text-blue-600" bg="bg-blue-500/10" />
                <MiniCard icon={ArrowDownRight} label="A Pagar (30d)" value={fmtBRL(financial.payablesNext30)} color="text-red-600" bg="bg-red-500/10" />
                <MiniCard icon={Gauge} label="Caixa Projetado" value={fmtBRL(financial.projectedCash)} color="text-violet-600" bg="bg-violet-500/10" />
              </div>

              {/* Overdue alerts */}
              {(financial.overduePayables > 0 || financial.overdueReceivables > 0) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {financial.overduePayables > 0 && (
                    <div className="flex items-center gap-3 bg-red-50 rounded-xl p-3">
                      <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
                      <div>
                        <p className="text-xs font-semibold text-red-700">Contas vencidas a pagar</p>
                        <p className="text-sm font-bold font-mono text-red-800">{fmtBRL(financial.overduePayables)}</p>
                      </div>
                    </div>
                  )}
                  {financial.overdueReceivables > 0 && (
                    <div className="flex items-center gap-3 bg-amber-50 rounded-xl p-3">
                      <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                      <div>
                        <p className="text-xs font-semibold text-amber-700">Recebíveis vencidos</p>
                        <p className="text-sm font-bold font-mono text-amber-800">{fmtBRL(financial.overdueReceivables)}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="grid md:grid-cols-2 gap-4">
                {/* Cash Accounts */}
                <Card className="border-0 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Wallet className="w-4 h-4 text-emerald-500" /> Contas de Caixa
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {(financial.cashAccounts ?? []).map((a, i) => (
                        <div key={i} className="flex items-center justify-between py-2 px-3 bg-muted/30 rounded-lg">
                          <div>
                            <p className="text-xs font-medium">{a.name}</p>
                            <p className="text-[10px] text-muted-foreground">{a.type}</p>
                          </div>
                          <span className={`text-sm font-bold font-mono ${a.balance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {fmtBRL(a.balance)}
                          </span>
                        </div>
                      ))}
                      {(!financial.cashAccounts || financial.cashAccounts.length === 0) && (
                        <p className="text-center text-muted-foreground text-xs py-4">Nenhuma conta cadastrada</p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Fees card */}
                <Card className="border-0 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-pink-500" /> Taxas Financeiras
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-6">
                      <p className="text-3xl font-bold font-mono text-pink-600">{fmtBRL(financial.totalFees)}</p>
                      <p className="text-xs text-muted-foreground mt-1">Total em taxas no mês</p>
                    </div>
                    {/* Payment method fees breakdown */}
                    <div className="space-y-1.5 mt-2">
                      {(commercial.byPaymentMethod ?? []).filter(m => m.fee > 0).map((m, i) => (
                        <div key={i} className="flex items-center justify-between text-xs py-1.5 px-2 bg-muted/30 rounded-lg">
                          <span>{m.name}</span>
                          <span className="font-mono font-medium text-pink-600">{fmtBRL(m.fee)}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Cash Flow Chart */}
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Activity className="w-4 h-4 text-indigo-500" /> Fluxo de Caixa (30 dias)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CashFlowChart data={financial.recentFlow} />
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* ===== TAB: Estoque ===== */}
          {isAdmin && (
            <TabsContent value="estoque" className="mt-4 space-y-4">
              {/* Stock KPIs */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <MiniCard icon={Package} label="Valor em Estoque" value={fmtBRL(stock.totalValue)} color="text-blue-600" bg="bg-blue-500/10" />
                <MiniCard icon={Boxes} label="Peças" value={fmtNum(stock.totalPieces)} color="text-emerald-600" bg="bg-emerald-500/10" />
                <MiniCard icon={AlertTriangle} label="Estoque Baixo" value={String(stock.lowStockCount)} color="text-amber-600" bg="bg-amber-500/10" />
                <MiniCard icon={XCircle} label="Estoque Zerado" value={String(stock.zeroStockCount)} color="text-red-600" bg="bg-red-500/10" />
              </div>

              {/* Dead Stock alert */}
              {stock.deadStockValue > 0 && (
                <div className="flex items-center gap-3 bg-amber-50 rounded-xl p-4">
                  <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-amber-700">
                      {stock.deadStockCount} produtos parados (60+ dias sem venda)
                    </p>
                    <p className="text-lg font-bold font-mono text-amber-800">{fmtBRL(stock.deadStockValue)}</p>
                    <p className="text-[10px] text-amber-600 mt-0.5">Capital parado que poderia estar gerando receita</p>
                  </div>
                </div>
              )}

              <div className="grid md:grid-cols-2 gap-4">
                {/* Top by value */}
                <Card className="border-0 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-blue-500" /> Maiores Valores em Estoque
                    </CardTitle>
                  </CardHeader>
                  <CardContent><StockValueChart data={stock.topByValue} /></CardContent>
                </Card>

                {/* Dead stock list */}
                <Card className="border-0 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-500" /> Produtos Parados
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1.5">
                      {(stock.topDead ?? []).slice(0, 8).map((p, i) => (
                        <div key={i} className="flex items-center justify-between py-1.5 px-2 bg-muted/30 rounded-lg">
                          <span className="text-xs truncate max-w-[150px]">{p.name}</span>
                          <div className="text-right">
                            <span className="text-xs font-mono font-semibold">{fmtBRL(p.value)}</span>
                            <span className="text-[10px] text-muted-foreground ml-1">({p.quantity} pç)</span>
                          </div>
                        </div>
                      ))}
                      {(!stock.topDead || stock.topDead.length === 0) && (
                        <p className="text-center text-muted-foreground text-xs py-4">Nenhum produto parado — ótimo!</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          )}

          {/* ===== TAB: CRM ===== */}
          <TabsContent value="crm" className="mt-4 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <MiniCard icon={UserCheck} label="Ativos (30d)" value={String(crm.totalActive)} color="text-emerald-600" bg="bg-emerald-500/10" />
              <MiniCard icon={UserMinus} label="Inativos" value={String(crm.totalInactive)} color="text-red-600" bg="bg-red-500/10" />
              <MiniCard icon={Users} label="Novos no Período" value={String(crm.newThisPeriod)} color="text-blue-600" bg="bg-blue-500/10" />
              <MiniCard icon={Repeat} label="Taxa Recompra" value={`${crm.recompraRate}%`} color="text-violet-600" bg="bg-violet-500/10" />
            </div>

            {/* Top Clients */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Star className="w-4 h-4 text-amber-500" /> Top Clientes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/50">
                        <th className="text-left py-2 px-2 text-xs text-muted-foreground font-medium">#</th>
                        <th className="text-left py-2 px-2 text-xs text-muted-foreground font-medium">Cliente</th>
                        <th className="text-left py-2 px-2 text-xs text-muted-foreground font-medium">Tipo</th>
                        <th className="text-right py-2 px-2 text-xs text-muted-foreground font-medium">Compras</th>
                        <th className="text-right py-2 px-2 text-xs text-muted-foreground font-medium">Total</th>
                        <th className="text-right py-2 px-2 text-xs text-muted-foreground font-medium">Ticket</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(crm.topClients ?? []).slice(0, 10).map((c, i) => (
                        <tr key={i} className="border-b border-border/30 last:border-0 hover:bg-muted/30 transition-colors">
                          <td className="py-2 px-2 text-muted-foreground font-mono text-xs">{i + 1}</td>
                          <td className="py-2 px-2 font-medium text-xs truncate max-w-[160px]">{c.name}</td>
                          <td className="py-2 px-2">
                            <Badge variant="outline" className="text-[10px]">
                              {c.type === 'atacado' ? 'Atacado' : 'Varejo'}
                            </Badge>
                          </td>
                          <td className="py-2 px-2 text-right font-mono text-xs">{c.count}</td>
                          <td className="py-2 px-2 text-right font-mono text-xs font-semibold">{fmtBRL(c.total)}</td>
                          <td className="py-2 px-2 text-right font-mono text-xs">{fmtBRL(c.ticket)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {(!crm.topClients || crm.topClients.length === 0) && (
                    <p className="text-center text-muted-foreground text-xs py-6">Nenhum cliente encontrado</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* ===== AI Insights ===== */}
        {insights && insights.length > 0 && (
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-500" /> Inteligência Operacional
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-2">
                {insights.map((ins, i) => (
                  <div
                    key={i}
                    className={`flex gap-3 p-3 rounded-xl border ${
                      ins.type === 'danger' ? 'border-red-200 bg-red-50/50' :
                      ins.type === 'warning' ? 'border-amber-200 bg-amber-50/50' :
                      ins.type === 'success' ? 'border-emerald-200 bg-emerald-50/50' :
                      'border-blue-200 bg-blue-50/50'
                    }`}
                  >
                    <div className="shrink-0 mt-0.5">
                      {ins.type === 'danger' ? <XCircle className="w-4 h-4 text-red-500" /> :
                       ins.type === 'warning' ? <AlertTriangle className="w-4 h-4 text-amber-500" /> :
                       ins.type === 'success' ? <CheckCircle className="w-4 h-4 text-emerald-500" /> :
                       <Info className="w-4 h-4 text-blue-500" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold">{ins.title}</p>
                        {ins.metric && (
                          <Badge variant="outline" className="text-[10px] shrink-0 font-mono">{ins.metric}</Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{ins.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

      </div>
    </div>
  );
}

/* ===== Mini Card Helper ===== */
function MiniCard({ icon: Icon, label, value, color, bg }: {
  icon: any; label: string; value: string; color: string; bg: string;
}) {
  return (
    <div className="bg-card rounded-xl p-3 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-7 h-7 rounded-lg ${bg} flex items-center justify-center`}>
          <Icon className={`w-3.5 h-3.5 ${color}`} />
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="text-sm font-bold font-mono tracking-tight">{value}</p>
    </div>
  );
}
