'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { AppHeader } from '@/components/app-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Search, Warehouse, AlertTriangle, Package, Plus, Minus, RefreshCw,
  ArrowDownCircle, ArrowUpCircle, History, TrendingUp, TrendingDown,
  BarChart3, ShoppingCart, Clock, DollarSign, Target, Zap, Loader2,
  ChevronRight, PauseCircle, ShieldAlert, Lightbulb, PieChart, Bot, Send, Sparkles, MessageSquare,
  Truck, FileText, XCircle, ChevronDown, ChevronUp, Eye, Trash2
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const fmt = (v: number | null | undefined) => (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtN = (v: number) => (v ?? 0).toLocaleString('pt-BR');
const fmtDate = (d: string) => {
  if (!d) return '-';
  const dt = new Date(d);
  return dt.toLocaleDateString('pt-BR') + ' ' + dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

const MOVE_TYPES: Record<string, { label: string; color: string }> = {
  entrada: { label: 'Entrada', color: 'bg-emerald-100 text-emerald-700' },
  saida: { label: 'Saída', color: 'bg-red-100 text-red-700' },
  ajuste_manual: { label: 'Ajuste Manual', color: 'bg-blue-100 text-blue-700' },
  inventario: { label: 'Inventário', color: 'bg-violet-100 text-violet-700' },
  venda: { label: 'Venda', color: 'bg-amber-100 text-amber-700' },
  cancelamento: { label: 'Cancelamento', color: 'bg-red-100 text-red-700' },
  reserva: { label: 'Reserva', color: 'bg-orange-100 text-orange-700' },
  devolucao: { label: 'Devolução', color: 'bg-teal-100 text-teal-700' },
  entrada_mercadoria: { label: 'Entrada Mercadoria', color: 'bg-emerald-100 text-emerald-700' },
};

export function EstoqueContent() {
  const { data: session } = useSession() || {};
  const userRole = (session?.user as any)?.role ?? '';
  const isAdmin = userRole === 'administrador' || userRole === 'socio';
  const isManager = userRole === 'gerente';

  // Core state
  const [products, setProducts] = useState<any[]>([]);
  const [allProducts, setAllProducts] = useState<any[]>([]); // for selects
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const [tab, setTab] = useState('executivo');

  // Dashboard
  const [dashboard, setDashboard] = useState<any>(null);
  const [dashLoading, setDashLoading] = useState(true);
  const [abcTab, setAbcTab] = useState<'A' | 'B' | 'C'>('A');

  // Movements tab
  const [movements, setMovements] = useState<any[]>([]);
  const [movTotal, setMovTotal] = useState(0);
  const [movPage, setMovPage] = useState(1);
  const [movSearch, setMovSearch] = useState('');
  const [movType, setMovType] = useState('');
  const [movStartDate, setMovStartDate] = useState('');
  const [movEndDate, setMovEndDate] = useState('');
  const [movLoading, setMovLoading] = useState(false);

  // Adjustment dialog
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustForm, setAdjustForm] = useState({ productId: '', variationId: '', type: 'entrada', quantity: '', reason: '' });
  const [adjustVariations, setAdjustVariations] = useState<any[]>([]);
  const [adjustSaving, setAdjustSaving] = useState(false);

  // Stock Entry (Entrada de Mercadoria)
  const [entries, setEntries] = useState<any[]>([]);
  const [entryLoading, setEntryLoading] = useState(false);
  const [entryDialogOpen, setEntryDialogOpen] = useState(false);
  const [entryDetailOpen, setEntryDetailOpen] = useState(false);
  const [entryDetail, setEntryDetail] = useState<any>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<any>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelSaving, setCancelSaving] = useState(false);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [entrySaving, setEntrySaving] = useState(false);
  const [accountPlans, setAccountPlans] = useState<any[]>([]);
  const [entryForm, setEntryForm] = useState({
    supplierId: '', freight: '', otherExpenses: '', otherExpensesAccountPlanId: '', paymentMethod: 'a_vista',
    installments: '1', notes: '', updateAvgCost: true, items: [{ productId: '', variationId: '', quantity: '', unitCost: '', productName: '' }] as any[],
    dueDates: [] as string[],
  });

  // Rentabilidade
  const [rentData, setRentData] = useState<any>(null);
  const [rentLoading, setRentLoading] = useState(false);
  const [rentGroupBy, setRentGroupBy] = useState('category');
  const [rentPeriod, setRentPeriod] = useState('30');

  // IA
  const [iaMessages, setIaMessages] = useState<{ role: string; content: string }[]>([]);
  const [iaInput, setIaInput] = useState('');
  const [iaLoading, setIaLoading] = useState(false);

  // Fetchers
  const fetchProducts = useCallback(async () => {
    try {
      const params = new URLSearchParams({ search, filter });
      const res = await fetch(`/api/estoque?${params}`);
      if (res.ok) setProducts(await res.json());
    } catch (e: any) { console.error(e); } finally { setLoading(false); }
  }, [search, filter]);

  const fetchAllProducts = useCallback(async () => {
    try {
      const res = await fetch('/api/produtos?limit=500');
      if (res.ok) { const d = await res.json(); setAllProducts(d?.products ?? d ?? []); }
    } catch (e: any) { console.error(e); }
  }, []);

  const fetchDashboard = useCallback(async () => {
    setDashLoading(true);
    try {
      const res = await fetch('/api/estoque/dashboard');
      if (res.ok) setDashboard(await res.json());
    } catch (e: any) { console.error(e); } finally { setDashLoading(false); }
  }, []);

  const fetchMovements = useCallback(async () => {
    setMovLoading(true);
    try {
      const params = new URLSearchParams({ page: String(movPage), limit: '30' });
      if (movSearch) params.set('search', movSearch);
      if (movType) params.set('type', movType);
      if (movStartDate) params.set('startDate', movStartDate);
      if (movEndDate) params.set('endDate', movEndDate);
      const res = await fetch(`/api/estoque/movimentacoes?${params}`);
      if (res.ok) { const d = await res.json(); setMovements(d?.movements ?? []); setMovTotal(d?.total ?? 0); }
    } catch (e: any) { console.error(e); } finally { setMovLoading(false); }
  }, [movPage, movSearch, movType, movStartDate, movEndDate]);

  const fetchEntries = useCallback(async () => {
    setEntryLoading(true);
    try {
      const res = await fetch('/api/estoque/entradas?limit=50');
      if (res.ok) { const d = await res.json(); setEntries(d?.entries ?? []); }
    } catch (e: any) { console.error(e); } finally { setEntryLoading(false); }
  }, []);

  const fetchSuppliers = useCallback(async () => {
    try {
      const res = await fetch('/api/fornecedores?limit=200');
      if (res.ok) {
        const data = await res.json();
        setSuppliers(data?.suppliers ?? []);
      }
    } catch (e: any) { console.error(e); }
  }, []);

  const fetchAccountPlans = useCallback(async () => {
    try {
      const res = await fetch('/api/plano-contas');
      if (res.ok) {
        const data = await res.json();
        setAccountPlans((data?.plans ?? []).filter((p: any) => p.isActive));
      }
    } catch (e: any) { console.error(e); }
  }, []);

  const fetchRentabilidade = useCallback(async () => {
    setRentLoading(true);
    try {
      const res = await fetch(`/api/estoque/rentabilidade?groupBy=${rentGroupBy}&days=${rentPeriod}`);
      if (res.ok) setRentData(await res.json());
    } catch (e: any) { console.error(e); } finally { setRentLoading(false); }
  }, [rentGroupBy, rentPeriod]);

  const sendIaMessage = async (msg?: string) => {
    const text = msg || iaInput.trim();
    if (!text) return;
    setIaInput('');
    setIaMessages(prev => [...prev, { role: 'user', content: text }]);
    setIaLoading(true);
    try {
      const res = await fetch('/api/estoque/ia', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history: iaMessages.slice(-10) }),
      });
      if (res.ok) { const d = await res.json(); setIaMessages(prev => [...prev, { role: 'assistant', content: d.response }]); }
      else { const err = await res.json().catch(() => ({})); setIaMessages(prev => [...prev, { role: 'assistant', content: err?.error || 'Erro ao processar. Tente novamente.' }]); }
    } catch { setIaMessages(prev => [...prev, { role: 'assistant', content: 'Erro de conexão.' }]); }
    setIaLoading(false);
  };

  // Effects
  useEffect(() => { fetchProducts(); }, [fetchProducts]);
  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);
  useEffect(() => { fetchAllProducts(); fetchSuppliers(); fetchAccountPlans(); }, [fetchAllProducts, fetchSuppliers, fetchAccountPlans]);
  useEffect(() => { if (tab === 'movimentacoes') fetchMovements(); }, [tab, fetchMovements]);
  useEffect(() => { if (tab === 'entradas') fetchEntries(); }, [tab, fetchEntries]);
  useEffect(() => { if (tab === 'rentabilidade') fetchRentabilidade(); }, [tab, fetchRentabilidade]);

  // Adjustment handlers
  const openAdjust = async (productId?: string, type?: string) => {
    const pid = productId ?? '';
    setAdjustForm({ productId: pid, variationId: '', type: type ?? 'entrada', quantity: '', reason: '' });
    if (pid) {
      try {
        const res = await fetch(`/api/produtos/${pid}`);
        if (res.ok) { const p = await res.json(); setAdjustVariations(p?.variations ?? []); }
        else setAdjustVariations([]);
      } catch { setAdjustVariations([]); }
    } else { setAdjustVariations([]); }
    setAdjustOpen(true);
  };

  const handleProductSelect = async (pid: string) => {
    setAdjustForm(f => ({ ...f, productId: pid, variationId: '' }));
    if (pid) {
      try {
        const res = await fetch(`/api/produtos/${pid}`);
        if (res.ok) { const p = await res.json(); setAdjustVariations(p?.variations ?? []); }
        else setAdjustVariations([]);
      } catch { setAdjustVariations([]); }
    } else { setAdjustVariations([]); }
  };

  const handleAdjust = async () => {
    if (!adjustForm.productId || !adjustForm.quantity) { toast.error('Preencha produto e quantidade'); return; }
    setAdjustSaving(true);
    try {
      const res = await fetch('/api/estoque/movimentacoes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(adjustForm),
      });
      if (res.ok) {
        toast.success('Movimentação registrada!');
        setAdjustOpen(false);
        fetchProducts(); fetchDashboard();
        if (tab === 'movimentacoes') fetchMovements();
      } else { const d = await res.json(); toast.error(d?.error ?? 'Erro'); }
    } catch { toast.error('Erro ao registrar'); }
    setAdjustSaving(false);
  };

  // Stock Entry handlers
  const resetEntryForm = () => {
    setEntryForm({
      supplierId: '', freight: '', otherExpenses: '', otherExpensesAccountPlanId: '', paymentMethod: 'a_vista',
      installments: '1', notes: '', updateAvgCost: true,
      items: [{ productId: '', variationId: '', quantity: '', unitCost: '', productName: '' }],
      dueDates: [],
    });
  };

  const addEntryItem = () => {
    setEntryForm(f => ({ ...f, items: [...f.items, { productId: '', variationId: '', quantity: '', unitCost: '', productName: '' }] }));
  };

  const removeEntryItem = (idx: number) => {
    if (entryForm.items.length <= 1) return;
    setEntryForm(f => ({ ...f, items: f.items.filter((_: any, i: number) => i !== idx) }));
  };

  const updateEntryItem = (idx: number, field: string, value: any) => {
    setEntryForm(f => {
      const items = [...f.items];
      items[idx] = { ...items[idx], [field]: value };
      return { ...f, items };
    });
  };

  const entrySubtotal = entryForm.items.reduce((s, it) => s + ((parseFloat(it.quantity) || 0) * (parseFloat(it.unitCost) || 0)), 0);
  const entryTotal = entrySubtotal + (parseFloat(entryForm.freight) || 0) + (parseFloat(entryForm.otherExpenses) || 0);

  const handleEntrySubmit = async () => {
    const validItems = entryForm.items.filter(it => it.productId && it.quantity && it.unitCost);
    if (validItems.length === 0) { toast.error('Adicione pelo menos um item'); return; }
    setEntrySaving(true);
    try {
      const res = await fetch('/api/estoque/entradas', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...entryForm,
          items: validItems,
          freight: parseFloat(entryForm.freight) || 0,
          otherExpenses: parseFloat(entryForm.otherExpenses) || 0,
          otherExpensesAccountPlanId: entryForm.otherExpensesAccountPlanId || undefined,
          installments: parseInt(entryForm.installments) || 1,
          dueDates: entryForm.dueDates.filter(d => d),
        }),
      });
      if (res.ok) {
        toast.success('Entrada de mercadoria registrada!');
        setEntryDialogOpen(false);
        resetEntryForm();
        fetchEntries(); fetchProducts(); fetchDashboard();
      } else { const d = await res.json(); toast.error(d?.error ?? 'Erro ao registrar'); }
    } catch { toast.error('Erro ao registrar entrada'); }
    setEntrySaving(false);
  };

  const handleCancelEntry = async () => {
    if (!cancelTarget || !cancelReason.trim()) { toast.error('Informe o motivo do cancelamento'); return; }
    setCancelSaving(true);
    try {
      const res = await fetch(`/api/estoque/entradas/${cancelTarget.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel', cancelReason }),
      });
      if (res.ok) {
        toast.success('Entrada cancelada com sucesso');
        setCancelDialogOpen(false); setCancelReason(''); setCancelTarget(null);
        fetchEntries(); fetchProducts(); fetchDashboard();
      } else { const d = await res.json(); toast.error(d?.error ?? 'Erro'); }
    } catch { toast.error('Erro ao cancelar'); }
    setCancelSaving(false);
  };

  const kpis = dashboard?.kpis ?? {};

  return (
    <div>
      <AppHeader title="Estoque" />
      <div className="p-4 lg:p-6 space-y-4">
        <Tabs value={tab} onValueChange={setTab}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <TabsList className="flex-wrap h-auto">
              <TabsTrigger value="executivo"><BarChart3 className="w-4 h-4 mr-1.5" />Executivo</TabsTrigger>
              <TabsTrigger value="operacao"><Package className="w-4 h-4 mr-1.5" />Operação</TabsTrigger>
              <TabsTrigger value="movimentacoes"><History className="w-4 h-4 mr-1.5" />Movimentações</TabsTrigger>
              <TabsTrigger value="entradas"><Truck className="w-4 h-4 mr-1.5" />Entradas</TabsTrigger>
              <TabsTrigger value="inteligencia"><Lightbulb className="w-4 h-4 mr-1.5" />Inteligência</TabsTrigger>
              <TabsTrigger value="rentabilidade"><PieChart className="w-4 h-4 mr-1.5" />Rentabilidade</TabsTrigger>
              <TabsTrigger value="ia"><Bot className="w-4 h-4 mr-1.5" />IA Gerente</TabsTrigger>
            </TabsList>
            {isAdmin && (
              <div className="flex gap-2">
                <Button size="sm" onClick={() => openAdjust()}><RefreshCw className="w-4 h-4 mr-1.5" />Ajustar Estoque</Button>
                <Button size="sm" variant="outline" onClick={() => { resetEntryForm(); setEntryDialogOpen(true); }}><Truck className="w-4 h-4 mr-1.5" />Nova Entrada</Button>
              </div>
            )}
          </div>

          {/* ============ EXECUTIVO ============ */}
          <TabsContent value="executivo" className="space-y-5 mt-4">
            {dashLoading ? <div className="flex items-center justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div> : (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <Card className="border-0 shadow-sm bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/30 dark:to-blue-900/20">
                    <CardContent className="p-4">
                      <DollarSign className="w-5 h-5 text-blue-600 mb-1" />
                      <p className="text-xs text-muted-foreground">Valor Total Estoque</p>
                      <p className="text-xl font-bold num-highlight text-blue-700 dark:text-blue-400">{fmt(kpis.totalValue)}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{fmtN(kpis.totalPieces)} peças</p>
                    </CardContent>
                  </Card>
                  <Card className="border-0 shadow-sm bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-950/30 dark:to-amber-900/20">
                    <CardContent className="p-4">
                      <PauseCircle className="w-5 h-5 text-amber-600 mb-1" />
                      <p className="text-xs text-muted-foreground">Dinheiro Parado no Estoque</p>
                      <p className="text-xl font-bold num-highlight text-amber-700 dark:text-amber-400">{fmt(kpis.stalledCapital)}</p>
                    </CardContent>
                  </Card>
                  <Card className="border-0 shadow-sm bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/30 dark:to-emerald-900/20">
                    <CardContent className="p-4">
                      <TrendingUp className="w-5 h-5 text-emerald-600 mb-1" />
                      <p className="text-xs text-muted-foreground">Giro Médio</p>
                      <p className="text-xl font-bold num-highlight text-emerald-700 dark:text-emerald-400">{kpis.avgTurnover}x</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Cobertura: {kpis.avgCoverage > 365 ? '365+' : kpis.avgCoverage} dias</p>
                    </CardContent>
                  </Card>
                  <Card className="border-0 shadow-sm bg-gradient-to-br from-red-50 to-red-100/50 dark:from-red-950/30 dark:to-red-900/20">
                    <CardContent className="p-4">
                      <ShieldAlert className="w-5 h-5 text-red-600 mb-1" />
                      <p className="text-xs text-muted-foreground">Alertas</p>
                      <div className="flex gap-3 mt-1">
                        <div><p className="text-lg font-bold num-highlight text-red-600">{kpis.outOfStockCount}</p><p className="text-[10px] text-muted-foreground">Zerados</p></div>
                        <div><p className="text-lg font-bold num-highlight text-amber-600">{kpis.lowStockCount}</p><p className="text-[10px] text-muted-foreground">Baixo</p></div>
                        <div><p className="text-lg font-bold num-highlight text-orange-600">{kpis.ruptureRiskCount}</p><p className="text-[10px] text-muted-foreground">Ruptura</p></div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Rentabilidade KPIs in Executive */}
                {rentData?.summary && (
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <Card className="border-0 shadow-sm"><CardContent className="p-4">
                      <p className="text-xs text-muted-foreground">Margem Bruta Média</p>
                      <p className="text-xl font-bold num-highlight">{(rentData.summary.avgGrossMargin ?? 0).toFixed(1)}%</p>
                    </CardContent></Card>
                    <Card className="border-0 shadow-sm"><CardContent className="p-4">
                      <p className="text-xs text-muted-foreground">Margem Líquida Média</p>
                      <p className="text-xl font-bold num-highlight">{(rentData.summary.avgNetMargin ?? 0).toFixed(1)}%</p>
                    </CardContent></Card>
                    <Card className="border-0 shadow-sm"><CardContent className="p-4">
                      <p className="text-xs text-muted-foreground">Lucro Operacional (30d)</p>
                      <p className="text-xl font-bold num-highlight text-emerald-600">{fmt(rentData.summary.totalProfit ?? 0)}</p>
                    </CardContent></Card>
                    <Card className="border-0 shadow-sm"><CardContent className="p-4">
                      <p className="text-xs text-muted-foreground">Taxas + Comissões</p>
                      <p className="text-xl font-bold num-highlight text-red-600">{fmt((rentData.summary.totalFees ?? 0) + (rentData.summary.totalCommissions ?? 0))}</p>
                    </CardContent></Card>
                  </div>
                )}

                {(dashboard?.topProfitable?.length ?? 0) > 0 && (
                  <Card className="border-0 shadow-sm">
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-2"><TrendingUp className="w-4 h-4 text-emerald-600" />Top 10 Mais Rentáveis (30 dias)</CardTitle></CardHeader>
                    <CardContent className="p-0"><div className="overflow-x-auto"><Table><TableHeader><TableRow>
                      <TableHead>#</TableHead><TableHead>Produto</TableHead><TableHead className="text-right">Faturamento</TableHead>
                      <TableHead className="text-right">Lucro</TableHead><TableHead className="text-center">Margem</TableHead>
                      <TableHead className="text-center">Qtd</TableHead><TableHead className="text-center">Giro</TableHead>
                    </TableRow></TableHeader><TableBody>
                      {dashboard.topProfitable.map((p: any, i: number) => (
                        <TableRow key={p.id}>
                          <TableCell className="font-bold text-muted-foreground">{i + 1}</TableCell>
                          <TableCell><p className="font-medium text-sm">{p.name}</p><p className="text-xs text-muted-foreground">{p.category}</p></TableCell>
                          <TableCell className="text-right num-highlight text-sm">{fmt(p.revenue30)}</TableCell>
                          <TableCell className="text-right num-highlight text-sm font-semibold text-emerald-600">{fmt(p.profit30)}</TableCell>
                          <TableCell className="text-center"><Badge className={`text-xs ${p.margin >= 30 ? 'bg-emerald-100 text-emerald-700' : p.margin >= 15 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{p.margin}%</Badge></TableCell>
                          <TableCell className="text-center num-highlight">{p.qtySold30}</TableCell>
                          <TableCell className="text-center num-highlight">{p.turnover}x</TableCell>
                        </TableRow>
                      ))}
                    </TableBody></Table></div></CardContent>
                  </Card>
                )}

                {/* ABC Curve */}
                <Card className="border-0 shadow-sm">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2"><BarChart3 className="w-4 h-4" />Curva ABC</CardTitle>
                      <div className="flex gap-1">
                        {(['A', 'B', 'C'] as const).map(c => (
                          <Button key={c} size="sm" variant={abcTab === c ? 'default' : 'outline'}
                            className={abcTab === c ? (c === 'A' ? 'bg-emerald-600' : c === 'B' ? 'bg-amber-600' : 'bg-red-600') : ''}
                            onClick={() => setAbcTab(c)}>Classe {c} ({dashboard?.abc?.[c.toLowerCase()]?.length ?? 0})</Button>
                        ))}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0"><div className="overflow-x-auto"><Table><TableHeader><TableRow>
                    <TableHead>Produto</TableHead><TableHead className="text-right">Faturamento</TableHead>
                    <TableHead className="text-center">Qtd 30d</TableHead><TableHead className="text-center">Estoque</TableHead>
                    <TableHead className="text-center">Giro</TableHead><TableHead className="text-center">Cobertura</TableHead>
                  </TableRow></TableHeader><TableBody>
                    {(dashboard?.abc?.[abcTab.toLowerCase()] ?? []).slice(0, 20).map((p: any) => (
                      <TableRow key={p.id}>
                        <TableCell><p className="font-medium text-sm">{p.name}</p><p className="text-xs text-muted-foreground">{p.category}</p></TableCell>
                        <TableCell className="text-right num-highlight text-sm">{fmt(p.revenueTotal)}</TableCell>
                        <TableCell className="text-center num-highlight">{p.qtySold30}</TableCell>
                        <TableCell className="text-center num-highlight">{p.stockQuantity}</TableCell>
                        <TableCell className="text-center num-highlight">{p.turnover}x</TableCell>
                        <TableCell className="text-center"><Badge variant="outline" className={`text-xs ${p.coverageDays <= 7 ? 'border-red-300 text-red-600' : p.coverageDays <= 30 ? 'border-amber-300 text-amber-600' : ''}`}>{p.coverageDays > 365 ? '365+' : p.coverageDays} dias</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody></Table></div></CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* ============ OPERAÇÃO ============ */}
          <TabsContent value="operacao" className="space-y-4 mt-4">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Buscar produto..." value={search} onChange={(e: any) => setSearch(e?.target?.value ?? '')} className="pl-9" />
              </div>
              <select className="h-10 px-3 rounded-md border border-input bg-background text-sm" value={filter} onChange={(e: any) => setFilter(e?.target?.value ?? '')}>
                <option value="">Todos</option>
                <option value="baixo">Estoque Baixo</option>
                <option value="parado">Produtos Parados</option>
              </select>
            </div>
            <Card className="border-0 shadow-sm"><CardContent className="p-0"><Table>
              <TableHeader><TableRow>
                <TableHead>Produto</TableHead><TableHead className="hidden sm:table-cell">Categoria</TableHead>
                <TableHead className="text-center">Estoque</TableHead><TableHead className="text-center">Mínimo</TableHead>
                <TableHead className="text-center">Custo Médio</TableHead><TableHead className="text-center">Status</TableHead>
                {isAdmin && <TableHead className="text-right">Ações</TableHead>}
              </TableRow></TableHeader>
              <TableBody>
                {loading && <TableRow><TableCell colSpan={7} className="text-center py-8">Carregando...</TableCell></TableRow>}
                {!loading && (products?.length ?? 0) === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8">Nenhum produto</TableCell></TableRow>}
                {(products ?? []).map((p: any) => {
                  const isLow = (p?.stockQuantity ?? 0) <= (p?.minStock ?? 0) && (p?.minStock ?? 0) > 0;
                  const isZero = (p?.stockQuantity ?? 0) <= 0;
                  return (
                    <TableRow key={p?.id} className={isZero ? 'bg-red-50/50 dark:bg-red-950/10' : isLow ? 'bg-amber-50/30 dark:bg-amber-950/10' : ''}>
                      <TableCell><span className="font-medium text-sm">{p?.name}</span>{p?.sku && <span className="text-xs text-muted-foreground ml-2">({p.sku})</span>}</TableCell>
                      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">{p?.category?.name ?? '-'}</TableCell>
                      <TableCell className="text-center num-highlight font-semibold">{p?.stockQuantity ?? 0}</TableCell>
                      <TableCell className="text-center num-highlight text-muted-foreground">{p?.minStock ?? 0}</TableCell>
                      <TableCell className="text-center num-highlight text-sm">{fmt(p?.avgCost || p?.costPrice || 0)}</TableCell>
                      <TableCell className="text-center">
                        {isZero ? <Badge variant="destructive" className="text-xs">Zerado</Badge>
                          : isLow ? <Badge className="text-xs bg-amber-100 text-amber-700">Baixo</Badge>
                            : <Badge variant="secondary" className="text-xs">OK</Badge>}
                      </TableCell>
                      {isAdmin && (
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-600" onClick={() => openAdjust(p?.id, 'entrada')} title="Entrada"><ArrowDownCircle className="w-4 h-4" /></Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" onClick={() => openAdjust(p?.id, 'saida')} title="Saída"><ArrowUpCircle className="w-4 h-4" /></Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600" onClick={() => openAdjust(p?.id, 'ajuste_manual')} title="Ajuste"><RefreshCw className="w-4 h-4" /></Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table></CardContent></Card>
          </TabsContent>

          {/* ============ MOVIMENTAÇÕES ============ */}
          <TabsContent value="movimentacoes" className="space-y-4 mt-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Buscar..." value={movSearch} onChange={(e: any) => setMovSearch(e?.target?.value ?? '')} className="pl-9" />
              </div>
              <select className="h-10 px-3 rounded-md border border-input bg-background text-sm" value={movType} onChange={(e: any) => setMovType(e?.target?.value ?? '')}>
                <option value="">Todos os tipos</option>
                {Object.entries(MOVE_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
              <Input type="date" className="w-40" value={movStartDate} onChange={(e: any) => setMovStartDate(e?.target?.value ?? '')} placeholder="Data início" />
              <Input type="date" className="w-40" value={movEndDate} onChange={(e: any) => setMovEndDate(e?.target?.value ?? '')} placeholder="Data fim" />
              <Button size="sm" variant="outline" onClick={() => { setMovSearch(''); setMovType(''); setMovStartDate(''); setMovEndDate(''); setMovPage(1); }}>Limpar</Button>
            </div>

            <Card className="border-0 shadow-sm"><CardContent className="p-0"><div className="overflow-x-auto"><Table>
              <TableHeader><TableRow>
                <TableHead>Data</TableHead><TableHead>Produto</TableHead><TableHead>Variação</TableHead>
                <TableHead className="text-center">Tipo</TableHead><TableHead className="text-center">Qtd</TableHead>
                <TableHead className="text-center">Anterior</TableHead><TableHead className="text-center">Novo</TableHead>
                <TableHead>Responsável</TableHead><TableHead>Motivo</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {movLoading && <TableRow><TableCell colSpan={9} className="text-center py-8"><Loader2 className="w-5 h-5 animate-spin inline mr-2" />Carregando...</TableCell></TableRow>}
                {!movLoading && movements.length === 0 && <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Nenhuma movimentação</TableCell></TableRow>}
                {movements.map((m: any) => {
                  const mt = MOVE_TYPES[m.type] || { label: m.type, color: 'bg-gray-100 text-gray-700' };
                  return (
                    <TableRow key={m.id}>
                      <TableCell className="text-xs whitespace-nowrap">{fmtDate(m.createdAt)}</TableCell>
                      <TableCell className="text-sm font-medium">{m.product?.name ?? '-'}<span className="text-xs text-muted-foreground ml-1">{m.product?.sku ? `(${m.product.sku})` : ''}</span></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{m.variation ? `${m.variation.color || ''} ${m.variation.size || ''} ${m.variation.grade || ''}`.trim() || '-' : '-'}</TableCell>
                      <TableCell className="text-center"><Badge className={`text-xs ${mt.color}`}>{mt.label}</Badge></TableCell>
                      <TableCell className="text-center num-highlight font-semibold">{m.quantity}</TableCell>
                      <TableCell className="text-center num-highlight text-muted-foreground">{m.previousQty ?? '-'}</TableCell>
                      <TableCell className="text-center num-highlight">{m.newQty ?? '-'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{m.userName || '-'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{m.reason || '-'}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table></div></CardContent></Card>

            {movTotal > 30 && (
              <div className="flex justify-center gap-2">
                <Button size="sm" variant="outline" disabled={movPage <= 1} onClick={() => setMovPage(p => p - 1)}>Anterior</Button>
                <span className="text-sm text-muted-foreground self-center">Página {movPage} de {Math.ceil(movTotal / 30)}</span>
                <Button size="sm" variant="outline" disabled={movPage >= Math.ceil(movTotal / 30)} onClick={() => setMovPage(p => p + 1)}>Próxima</Button>
              </div>
            )}
          </TabsContent>

          {/* ============ ENTRADAS DE MERCADORIA ============ */}
          <TabsContent value="entradas" className="space-y-4 mt-4">
            {isAdmin && (
              <div className="flex justify-end">
                <Button size="sm" onClick={() => { resetEntryForm(); setEntryDialogOpen(true); }}><Truck className="w-4 h-4 mr-1.5" />Nova Entrada de Mercadoria</Button>
              </div>
            )}

            {entryLoading ? <div className="flex items-center justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div> : (
              <Card className="border-0 shadow-sm"><CardContent className="p-0"><div className="overflow-x-auto"><Table>
                <TableHeader><TableRow>
                  <TableHead>#</TableHead><TableHead>Data</TableHead><TableHead>Fornecedor</TableHead>
                  <TableHead className="text-center">Itens</TableHead><TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-center">Pagamento</TableHead><TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {entries.length === 0 && <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhuma entrada registrada</TableCell></TableRow>}
                  {entries.map((e: any) => (
                    <TableRow key={e.id} className={e.status === 'cancelada' ? 'opacity-50' : ''}>
                      <TableCell className="font-mono text-sm">#{e.entryNumber}</TableCell>
                      <TableCell className="text-xs">{fmtDate(e.createdAt)}</TableCell>
                      <TableCell className="text-sm">{e.supplier?.name || '-'}</TableCell>
                      <TableCell className="text-center num-highlight">{e._count?.items ?? e.items?.length ?? 0}</TableCell>
                      <TableCell className="text-right num-highlight font-semibold">{fmt(e.totalCost)}</TableCell>
                      <TableCell className="text-center text-xs">{e.paymentMethod === 'a_vista' ? 'À Vista' : `${e.installments}x`}</TableCell>
                      <TableCell className="text-center">
                        {e.status === 'cancelada'
                          ? <Badge variant="destructive" className="text-xs">Cancelada</Badge>
                          : <Badge className="text-xs bg-emerald-100 text-emerald-700">Confirmada</Badge>}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEntryDetail(e); setEntryDetailOpen(true); }}><Eye className="w-4 h-4" /></Button>
                          {isAdmin && e.status !== 'cancelada' && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" onClick={() => { setCancelTarget(e); setCancelReason(''); setCancelDialogOpen(true); }}><XCircle className="w-4 h-4" /></Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table></div></CardContent></Card>
            )}
          </TabsContent>

          {/* ============ INTELIGÊNCIA ============ */}
          <TabsContent value="inteligencia" className="space-y-5 mt-4">
            {dashLoading ? <div className="flex items-center justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div> : (
              <>
                {(dashboard?.stalled?.length ?? 0) > 0 && (
                  <Card className="border-0 shadow-sm">
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-2"><PauseCircle className="w-4 h-4 text-amber-600" />Produtos Parados<Badge variant="outline" className="ml-auto">{dashboard.stalled.length}</Badge></CardTitle></CardHeader>
                    <CardContent className="p-0"><div className="overflow-x-auto"><Table><TableHeader><TableRow>
                      <TableHead>Produto</TableHead><TableHead className="text-center">Dias Parado</TableHead>
                      <TableHead className="text-center">Estoque</TableHead><TableHead className="text-right">Valor Parado</TableHead><TableHead>Sugestão</TableHead>
                    </TableRow></TableHeader><TableBody>
                      {(dashboard.stalled ?? []).slice(0, 15).map((p: any) => (
                        <TableRow key={p.id} className="bg-amber-50/50 dark:bg-amber-950/10">
                          <TableCell><p className="font-medium text-sm">{p.name}</p></TableCell>
                          <TableCell className="text-center"><Badge variant="outline" className={`text-xs ${p.daysSinceLastSale >= 90 ? 'border-red-300 text-red-600' : 'border-amber-300 text-amber-600'}`}>{p.daysSinceLastSale >= 999 ? 'Nunca' : `${p.daysSinceLastSale}d`}</Badge></TableCell>
                          <TableCell className="text-center num-highlight">{p.stockQuantity}</TableCell>
                          <TableCell className="text-right num-highlight text-amber-600 font-semibold">{fmt(p.stockCost)}</TableCell>
                          <TableCell><span className="text-xs text-muted-foreground">{p.daysSinceLastSale >= 120 ? '🚨 Liquidar' : p.daysSinceLastSale >= 90 ? '⚠️ Promoção' : '💡 Campanha'}</span></TableCell>
                        </TableRow>
                      ))}
                    </TableBody></Table></div></CardContent>
                  </Card>
                )}
                {(dashboard?.ruptureRisk?.length ?? 0) > 0 && (
                  <Card className="border-0 shadow-sm">
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-2"><ShieldAlert className="w-4 h-4 text-red-600" />Risco de Ruptura<Badge variant="destructive" className="ml-auto">{dashboard.ruptureRisk.length}</Badge></CardTitle></CardHeader>
                    <CardContent className="p-0"><div className="overflow-x-auto"><Table><TableHeader><TableRow>
                      <TableHead>Produto</TableHead><TableHead className="text-center">Estoque</TableHead>
                      <TableHead className="text-center">Mínimo</TableHead><TableHead className="text-center">Venda/dia</TableHead><TableHead className="text-center">Duração</TableHead>
                    </TableRow></TableHeader><TableBody>
                      {dashboard.ruptureRisk.slice(0, 15).map((p: any) => (
                        <TableRow key={p.id} className="bg-red-50/50 dark:bg-red-950/10">
                          <TableCell className="font-medium text-sm">{p.name}</TableCell>
                          <TableCell className="text-center num-highlight font-semibold text-red-600">{p.stockQuantity}</TableCell>
                          <TableCell className="text-center num-highlight">{p.minStock}</TableCell>
                          <TableCell className="text-center num-highlight">{p.dailyRate30}</TableCell>
                          <TableCell className="text-center"><Badge variant="destructive" className="text-xs">{p.coverageDays} dias</Badge></TableCell>
                        </TableRow>
                      ))}
                    </TableBody></Table></div></CardContent>
                  </Card>
                )}
                {(dashboard?.purchaseSuggestion?.length ?? 0) > 0 && (
                  <Card className="border-0 shadow-sm">
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-2"><ShoppingCart className="w-4 h-4 text-blue-600" />Previsão de Compra</CardTitle></CardHeader>
                    <CardContent className="p-0"><div className="overflow-x-auto"><Table><TableHeader><TableRow>
                      <TableHead>Produto</TableHead><TableHead className="text-center">Estoque</TableHead>
                      <TableHead className="text-center">Ruptura em</TableHead><TableHead className="text-center">Sugerido</TableHead><TableHead className="text-right">Custo Est.</TableHead>
                    </TableRow></TableHeader><TableBody>
                      {dashboard.purchaseSuggestion.slice(0, 15).map((p: any) => (
                        <TableRow key={p.id}>
                          <TableCell><p className="font-medium text-sm">{p.name}</p></TableCell>
                          <TableCell className="text-center num-highlight">{p.stockQuantity}</TableCell>
                          <TableCell className="text-center"><Badge variant={p.daysToRupture <= 3 ? 'destructive' : 'outline'} className="text-xs">{p.daysToRupture}d</Badge></TableCell>
                          <TableCell className="text-center num-highlight font-bold text-blue-600">{p.suggestedQty} un</TableCell>
                          <TableCell className="text-right num-highlight">{fmt(p.suggestedQty * p.costPrice)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody></Table></div></CardContent>
                  </Card>
                )}
              </>
            )}
          </TabsContent>

          {/* ============ RENTABILIDADE ============ */}
          <TabsContent value="rentabilidade" className="space-y-4 mt-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2"><label className="text-sm font-medium text-muted-foreground">Agrupar:</label>
                <select className="h-9 px-3 rounded-md border border-input bg-background text-sm" value={rentGroupBy} onChange={(e: any) => setRentGroupBy(e.target.value)}>
                  <option value="category">Categoria</option><option value="product">Produto</option>
                  <option value="supplier">Fornecedor</option><option value="seller">Vendedor</option>
                  <option value="color">Cor</option><option value="size">Tamanho</option><option value="grade">Grade</option>
                </select>
              </div>
              <div className="flex items-center gap-2"><label className="text-sm font-medium text-muted-foreground">Período:</label>
                <select className="h-9 px-3 rounded-md border border-input bg-background text-sm" value={rentPeriod} onChange={(e: any) => setRentPeriod(e.target.value)}>
                  <option value="7">7d</option><option value="15">15d</option><option value="30">30d</option>
                  <option value="60">60d</option><option value="90">90d</option>
                </select>
              </div>
            </div>
            {rentLoading ? <div className="flex items-center justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div> : rentData ? (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                  <Card className="border-0 shadow-sm"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Faturamento</p><p className="text-xl font-bold num-highlight text-emerald-600">{fmt(rentData.summary?.totalRevenue ?? 0)}</p></CardContent></Card>
                  <Card className="border-0 shadow-sm"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Lucro Líquido</p><p className="text-xl font-bold num-highlight text-blue-600">{fmt(rentData.summary?.totalProfit ?? 0)}</p></CardContent></Card>
                  <Card className="border-0 shadow-sm"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Margem Bruta</p><p className="text-xl font-bold num-highlight">{(rentData.summary?.avgGrossMargin ?? 0).toFixed(1)}%</p></CardContent></Card>
                  <Card className="border-0 shadow-sm"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Margem Líquida</p><p className="text-xl font-bold num-highlight">{(rentData.summary?.avgNetMargin ?? 0).toFixed(1)}%</p></CardContent></Card>
                  <Card className="border-0 shadow-sm"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Taxas+Comissões</p><p className="text-xl font-bold num-highlight text-red-600">{fmt((rentData.summary?.totalFees ?? 0) + (rentData.summary?.totalCommissions ?? 0))}</p></CardContent></Card>
                </div>
                <Card className="border-0 shadow-sm"><CardContent className="p-0"><div className="overflow-x-auto"><Table>
                  <TableHeader><TableRow>
                    <TableHead>{{ category: 'Categoria', product: 'Produto', supplier: 'Fornecedor', seller: 'Vendedor', color: 'Cor', size: 'Tamanho', grade: 'Grade' }[rentGroupBy] ?? 'Item'}</TableHead>
                    <TableHead className="text-center">Qtd</TableHead><TableHead className="text-right">Faturamento</TableHead>
                    <TableHead className="text-right">Custo</TableHead><TableHead className="text-right">Lucro</TableHead>
                    <TableHead className="text-center">M. Bruta</TableHead><TableHead className="text-center">M. Líquida</TableHead>
                    <TableHead className="text-right">Taxas</TableHead><TableHead className="text-right">Comissões</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {(rentData.data ?? []).length === 0 && <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Sem dados</TableCell></TableRow>}
                    {(rentData.data ?? []).map((r: any, i: number) => (
                      <TableRow key={r.key ?? i}>
                        <TableCell className="font-medium text-sm">{r.label}</TableCell>
                        <TableCell className="text-center num-highlight">{fmtN(r.qtySold)}</TableCell>
                        <TableCell className="text-right num-highlight">{fmt(r.revenue)}</TableCell>
                        <TableCell className="text-right num-highlight text-muted-foreground">{fmt(r.costTotal)}</TableCell>
                        <TableCell className="text-right num-highlight font-semibold text-emerald-600">{fmt(r.profit)}</TableCell>
                        <TableCell className="text-center"><Badge className={`text-xs ${r.grossMargin >= 30 ? 'bg-emerald-100 text-emerald-700' : r.grossMargin >= 15 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{(r.grossMargin ?? 0).toFixed(1)}%</Badge></TableCell>
                        <TableCell className="text-center"><Badge className={`text-xs ${r.netMargin >= 20 ? 'bg-emerald-100 text-emerald-700' : r.netMargin >= 10 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{(r.netMargin ?? 0).toFixed(1)}%</Badge></TableCell>
                        <TableCell className="text-right num-highlight text-xs text-muted-foreground">{fmt(r.feeTotal)}</TableCell>
                        <TableCell className="text-right num-highlight text-xs text-muted-foreground">{fmt(r.commissionTotal)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table></div></CardContent></Card>
              </>
            ) : null}
          </TabsContent>

          {/* ============ IA GERENTE ============ */}
          <TabsContent value="ia" className="mt-4">
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2"><Bot className="w-4 h-4 text-violet-600" />IA Gerente — Consultoria de Estoque e Rentabilidade</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">Pergunte sobre margens, custos, fornecedores, giro, cobertura, lucratividade. Dados reais do sistema.</p>
              </CardHeader>
              <CardContent className="p-0">
                {iaMessages.length === 0 && (
                  <div className="px-4 pb-4"><p className="text-xs text-muted-foreground mb-2">Sugestões rápidas:</p>
                    <div className="flex flex-wrap gap-2">
                      {[
                        'Qual produto dá mais lucro real?',
                        'Qual categoria é mais rentável?',
                        'Qual fornecedor reduz minha margem?',
                        'Estou vendendo muito e lucrando pouco?',
                        'Qual produto tem margem perigosa?',
                        'Qual desconto está destruindo meu lucro?',
                        'Qual vendedor vende com menor margem?',
                        'Quanto preciso vender para manter margem saudável?',
                      ].map(q => (
                        <Button key={q} variant="outline" size="sm" className="text-xs h-auto py-1.5 px-3" onClick={() => sendIaMessage(q)}>
                          <Sparkles className="w-3 h-3 mr-1.5 text-violet-500" />{q}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="max-h-[400px] overflow-y-auto px-4 space-y-3">
                  {iaMessages.map((m, i) => (
                    <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] rounded-xl px-4 py-2.5 text-sm ${m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted/70'}`}>
                        {m.role === 'assistant' && <Bot className="w-3.5 h-3.5 inline-block mr-1.5 opacity-60" />}
                        <span className="whitespace-pre-wrap">{m.content}</span>
                      </div>
                    </div>
                  ))}
                  {iaLoading && <div className="flex justify-start"><div className="bg-muted/70 rounded-xl px-4 py-2.5 text-sm flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Analisando...</div></div>}
                </div>
                <div className="p-4 border-t mt-3"><div className="flex gap-2">
                  <Textarea value={iaInput} onChange={(e: any) => setIaInput(e.target.value)} placeholder="Pergunte sobre estoque, custos, rentabilidade..." rows={1} className="resize-none min-h-[40px]" onKeyDown={(e: any) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendIaMessage(); } }} />
                  <Button size="icon" onClick={() => sendIaMessage()} disabled={iaLoading || !iaInput.trim()}><Send className="w-4 h-4" /></Button>
                </div></div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* ===== ADJUSTMENT DIALOG ===== */}
      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Ajuste de Estoque</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Produto *</Label>
              <select className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm" value={adjustForm.productId} onChange={(e: any) => handleProductSelect(e.target.value)}>
                <option value="">Selecione...</option>
                {(allProducts.length > 0 ? allProducts : products).map((p: any) => <option key={p.id} value={p.id}>{p.name} (Est: {p.stockQuantity ?? 0})</option>)}
              </select>
            </div>
            {adjustVariations.length > 0 && (
              <div><Label>Variação (opcional)</Label>
                <select className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm" value={adjustForm.variationId} onChange={(e: any) => setAdjustForm(f => ({ ...f, variationId: e.target.value }))}>
                  <option value="">Produto geral (sem variação)</option>
                  {adjustVariations.map((v: any) => <option key={v.id} value={v.id}>{[v.color, v.size, v.grade].filter(Boolean).join(' / ')} (Est: {v.stockQuantity})</option>)}
                </select>
              </div>
            )}
            <div><Label>Tipo de Movimentação</Label>
              <select className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm" value={adjustForm.type} onChange={(e: any) => setAdjustForm(f => ({ ...f, type: e.target.value }))}>
                <option value="entrada">Entrada (adicionar)</option>
                <option value="saida">Saída (remover)</option>
                <option value="ajuste_manual">Ajuste Manual (definir quantidade)</option>
                <option value="inventario">Ajuste de Inventário (definir quantidade)</option>
              </select>
            </div>
            <div><Label>{adjustForm.type === 'ajuste_manual' || adjustForm.type === 'inventario' ? 'Nova Quantidade *' : 'Quantidade *'}</Label>
              <Input type="number" min="0" value={adjustForm.quantity} onChange={(e: any) => setAdjustForm(f => ({ ...f, quantity: e.target.value }))} />
            </div>
            <div><Label>Motivo / Observação</Label>
              <Textarea value={adjustForm.reason} onChange={(e: any) => setAdjustForm(f => ({ ...f, reason: e.target.value }))} placeholder="Ex: Reposição fornecedor, Ajuste de inventário..." rows={2} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAdjustOpen(false)}>Cancelar</Button>
              <Button onClick={handleAdjust} disabled={adjustSaving}>{adjustSaving && <Loader2 className="w-4 h-4 animate-spin mr-1.5" />}Registrar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ===== STOCK ENTRY DIALOG ===== */}
      <Dialog open={entryDialogOpen} onOpenChange={setEntryDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nova Entrada de Mercadoria</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><Label>Fornecedor</Label>
                <select className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm" value={entryForm.supplierId} onChange={(e: any) => setEntryForm(f => ({ ...f, supplierId: e.target.value }))}>
                  <option value="">Selecione (opcional)</option>
                  {suppliers.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div><Label>Pagamento</Label>
                <select className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm" value={entryForm.paymentMethod} onChange={(e: any) => setEntryForm(f => ({ ...f, paymentMethod: e.target.value }))}>
                  <option value="a_vista">À Vista</option>
                  <option value="parcelado">Parcelado</option>
                </select>
              </div>
            </div>

            {entryForm.paymentMethod === 'parcelado' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><Label>Número de Parcelas</Label>
                  <Input type="number" min="2" max="24" value={entryForm.installments} onChange={(e: any) => {
                    const n = parseInt(e.target.value) || 1;
                    setEntryForm(f => ({ ...f, installments: String(n), dueDates: Array(n).fill('') }));
                  }} />
                </div>
                {Array.from({ length: parseInt(entryForm.installments) || 1 }).map((_, i) => (
                  <div key={i}><Label>Vencimento Parcela {i + 1}</Label>
                    <Input type="date" value={entryForm.dueDates[i] || ''} onChange={(e: any) => {
                      const dates = [...entryForm.dueDates];
                      dates[i] = e.target.value;
                      setEntryForm(f => ({ ...f, dueDates: dates }));
                    }} />
                  </div>
                ))}
              </div>
            )}

            <div className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Itens da Entrada</Label>
                <Button size="sm" variant="outline" onClick={addEntryItem}><Plus className="w-3 h-3 mr-1" />Adicionar Item</Button>
              </div>
              {entryForm.items.map((item: any, idx: number) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-end border-b pb-3">
                  <div className="col-span-5">
                    {idx === 0 && <Label className="text-xs">Produto</Label>}
                    <select className="w-full h-9 px-2 rounded-md border border-input bg-background text-sm" value={item.productId} onChange={(e: any) => updateEntryItem(idx, 'productId', e.target.value)}>
                      <option value="">Selecione...</option>
                      {(allProducts.length > 0 ? allProducts : products).map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div className="col-span-3">
                    {idx === 0 && <Label className="text-xs">Quantidade</Label>}
                    <Input type="number" min="1" className="h-9" value={item.quantity} onChange={(e: any) => updateEntryItem(idx, 'quantity', e.target.value)} placeholder="Qtd" />
                  </div>
                  <div className="col-span-3">
                    {idx === 0 && <Label className="text-xs">Custo Unit.</Label>}
                    <CurrencyInput value={parseFloat(item.unitCost) || 0} onChange={(v: number) => updateEntryItem(idx, 'unitCost', String(v))} className="h-9" />
                  </div>
                  <div className="col-span-1 flex justify-center">
                    {entryForm.items.length > 1 && <Button variant="ghost" size="icon" className="h-9 w-9 text-red-500" onClick={() => removeEntryItem(idx)}><Trash2 className="w-4 h-4" /></Button>}
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div><Label>Frete (R$)</Label><CurrencyInput value={parseFloat(entryForm.freight) || 0} onChange={(v: number) => setEntryForm(f => ({ ...f, freight: String(v) }))} /></div>
              <div>
                <Label>Outras Despesas (R$)</Label>
                <CurrencyInput value={parseFloat(entryForm.otherExpenses) || 0} onChange={(v: number) => setEntryForm(f => ({ ...f, otherExpenses: String(v) }))} />
                {parseFloat(entryForm.otherExpenses) > 0 && (
                  <div className="mt-2">
                    <Label className="text-xs">Classificação Contábil</Label>
                    <Select value={entryForm.otherExpensesAccountPlanId} onValueChange={(v) => setEntryForm(f => ({ ...f, otherExpensesAccountPlanId: v }))}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione (opcional)" /></SelectTrigger>
                      <SelectContent>
                        {accountPlans
                          .filter((ap: any) => ap.type === 'custo' || ap.type === 'despesa')
                          .sort((a: any, b: any) => a.code.localeCompare(b.code))
                          .map((ap: any) => <SelectItem key={ap.id} value={ap.id}>{ap.code} — {ap.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Padrão: 2.01 (Compra Mercadorias)</p>
                  </div>
                )}
              </div>
              <div className="flex items-end">
                <div className="bg-muted/50 rounded-lg p-3 w-full text-center">
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="text-lg font-bold num-highlight">{fmt(entryTotal)}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input type="checkbox" id="updateCost" checked={entryForm.updateAvgCost} onChange={(e: any) => setEntryForm(f => ({ ...f, updateAvgCost: e.target.checked }))} />
              <label htmlFor="updateCost" className="text-sm">Atualizar custo médio ponderado dos produtos</label>
            </div>

            <div><Label>Observações</Label><Textarea value={entryForm.notes} onChange={(e: any) => setEntryForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Notas sobre a entrada..." /></div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEntryDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleEntrySubmit} disabled={entrySaving}>{entrySaving && <Loader2 className="w-4 h-4 animate-spin mr-1.5" />}Confirmar Entrada</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ===== ENTRY DETAIL DIALOG ===== */}
      <Dialog open={entryDetailOpen} onOpenChange={setEntryDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Entrada #{entryDetail?.entryNumber}</DialogTitle></DialogHeader>
          {entryDetail && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">Status:</span> {entryDetail.status === 'cancelada' ? <Badge variant="destructive">Cancelada</Badge> : <Badge className="bg-emerald-100 text-emerald-700">Confirmada</Badge>}</div>
                <div><span className="text-muted-foreground">Data:</span> {fmtDate(entryDetail.createdAt)}</div>
                <div><span className="text-muted-foreground">Fornecedor:</span> {entryDetail.supplier?.name || '-'}</div>
                <div><span className="text-muted-foreground">Pagamento:</span> {entryDetail.paymentMethod === 'a_vista' ? 'À Vista' : `${entryDetail.installments}x Parcelado`}</div>
                <div><span className="text-muted-foreground">Criado por:</span> {entryDetail.createdByName || '-'}</div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Card className="border"><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">Subtotal</p><p className="font-bold num-highlight">{fmt(entryDetail.subtotal)}</p></CardContent></Card>
                <Card className="border"><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">Frete + Despesas</p><p className="font-bold num-highlight">{fmt(entryDetail.freight + entryDetail.otherExpenses)}</p></CardContent></Card>
                <Card className="border"><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">Total</p><p className="font-bold num-highlight text-lg">{fmt(entryDetail.totalCost)}</p></CardContent></Card>
              </div>
              <Table><TableHeader><TableRow><TableHead>Produto</TableHead><TableHead>Variação</TableHead><TableHead className="text-center">Qtd</TableHead><TableHead className="text-right">Custo Unit.</TableHead><TableHead className="text-right">Total</TableHead><TableHead className="text-right">Custo Médio Ant.</TableHead><TableHead className="text-right">Novo Custo Médio</TableHead></TableRow></TableHeader>
                <TableBody>{(entryDetail.items ?? []).map((it: any) => (
                  <TableRow key={it.id}>
                    <TableCell className="text-sm font-medium">{it.product?.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{it.variation ? [it.variation.color, it.variation.size, it.variation.grade].filter(Boolean).join(' / ') : '-'}</TableCell>
                    <TableCell className="text-center num-highlight">{it.quantity}</TableCell>
                    <TableCell className="text-right num-highlight">{fmt(it.unitCost)}</TableCell>
                    <TableCell className="text-right num-highlight">{fmt(it.totalCost)}</TableCell>
                    <TableCell className="text-right num-highlight text-muted-foreground">{fmt(it.previousAvgCost)}</TableCell>
                    <TableCell className="text-right num-highlight font-semibold">{fmt(it.newAvgCost)}</TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table>
              {(entryDetail.accountsPayable?.length ?? 0) > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2">Contas a Pagar</h4>
                  <Table><TableHeader><TableRow><TableHead>Parcela</TableHead><TableHead className="text-right">Valor</TableHead><TableHead>Vencimento</TableHead><TableHead className="text-center">Status</TableHead></TableRow></TableHeader>
                    <TableBody>{entryDetail.accountsPayable.map((ap: any) => (
                      <TableRow key={ap.id}>
                        <TableCell>{ap.installmentNum}/{ap.totalInstallments}</TableCell>
                        <TableCell className="text-right num-highlight">{fmt(ap.amount)}</TableCell>
                        <TableCell>{new Date(ap.dueDate).toLocaleDateString('pt-BR')}</TableCell>
                        <TableCell className="text-center"><Badge className={`text-xs ${ap.status === 'pago' ? 'bg-emerald-100 text-emerald-700' : ap.status === 'cancelada' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{ap.status}</Badge></TableCell>
                      </TableRow>
                    ))}</TableBody>
                  </Table>
                </div>
              )}
              {entryDetail.cancelReason && (
                <div className="bg-red-50 dark:bg-red-950/20 p-3 rounded-lg">
                  <p className="text-sm font-semibold text-red-600">Motivo Cancelamento:</p>
                  <p className="text-sm">{entryDetail.cancelReason}</p>
                  <p className="text-xs text-muted-foreground mt-1">Cancelado por {entryDetail.cancelledByName} em {fmtDate(entryDetail.cancelledAt)}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ===== CANCEL ENTRY DIALOG ===== */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Cancelar Entrada #{cancelTarget?.entryNumber}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="bg-red-50 dark:bg-red-950/20 p-3 rounded-lg text-sm">
              <p className="font-semibold text-red-600 mb-2">⚠️ Esta ação irá:</p>
              <ul className="text-xs space-y-1 text-red-700 dark:text-red-400">
                <li>• Estornar estoque de todos os itens</li>
                <li>• Cancelar contas a pagar pendentes</li>
                <li>• Gerar registro financeiro de estorno</li>
                <li>• Registrar movimentação de cancelamento</li>
              </ul>
            </div>
            <div><Label>Motivo do Cancelamento *</Label>
              <Textarea value={cancelReason} onChange={(e: any) => setCancelReason(e.target.value)} placeholder="Informe o motivo..." rows={3} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>Voltar</Button>
              <Button variant="destructive" onClick={handleCancelEntry} disabled={cancelSaving || !cancelReason.trim()}>
                {cancelSaving && <Loader2 className="w-4 h-4 animate-spin mr-1.5" />}Confirmar Cancelamento
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
