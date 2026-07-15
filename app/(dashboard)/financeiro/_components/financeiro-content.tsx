'use client';

import { useState, useEffect, useCallback } from 'react';
import { AppHeader } from '@/components/app-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Plus, DollarSign, TrendingUp, TrendingDown, Wallet, ChevronLeft, ChevronRight,
  Sparkles, Brain, Target, BarChart3, Calculator, Loader2, CheckCircle,
  AlertTriangle, Layers, Info, Gauge, Pencil, Trash2, Eye, MoreHorizontal, RotateCcw,
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import AccountPlanSuggestion from '@/components/account-plan-suggestion';
import { toast } from 'sonner';

function fmt(v: number) { return (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
const paymentLabels: Record<string, string> = { dinheiro: 'Dinheiro', pix: 'PIX', cartao_credito: 'Cartão Crédito', cartao_debito: 'Cartão Débito', boleto: 'Boleto' };

interface AISuggestion {
  accountPlanId?: string;
  accountPlanName?: string;
  accountType?: string;
  dreGroup?: string;
  showInDre?: boolean;
  confidence?: number;
  explanation?: string;
  tip?: string;
}

interface MetasData {
  periodo: { diasNoMes: number; diaAtual: number; diasRestantes: number; semanasRestantes: number };
  realizado: { faturamento: number; vendas: number; custoMercadoria: number; lucroAtual: number; margemMedia: number; despesasMes: number; varExpenses: number };
  metas: { pontoEquilibrio: number; faltaVender: number; metaDiaria: number; metaSemanal: number; lucroProjetado: number; projecaoMes: number; ritmoAtual: number };
  simulations: { crescimento: number; metaMensal: number; metaDiaria: number; metaSemanal: number; lucroEstimado: number }[];
}

interface SimResult {
  empatar: number; lucrar: number; crescer: number; metaFinal: number;
  metaDiaria: number; metaSemanal: number; risco: string; sugestao: string;
}

export function FinanceiroContent() {
  const [records, setRecords] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [accountPlans, setAccountPlans] = useState<any[]>([]);
  const [cashAccounts, setCashAccounts] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({ entradas: 0, saidas: 0, saldo: 0 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [typeFilter, setTypeFilter] = useState('');
  const [classificationFilter, setClassificationFilter] = useState<'all' | 'unclassified'>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<any>({ description: '', amount: '', type: 'entrada', paymentMethod: 'pix', categoryId: '', accountPlanId: '', cashAccountId: '', date: '', observation: '' });

  // AI suggestion state
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<AISuggestion | null>(null);

  // Metas state
  const [metas, setMetas] = useState<MetasData | null>(null);
  const [metasLoading, setMetasLoading] = useState(false);

  // Simulator state
  const [simForm, setSimForm] = useState({ despesasMensais: '', margemMedia: '', crescimentoDesejado: '', lucroDesejado: '', faturamentoAtual: '' });
  const [simResult, setSimResult] = useState<SimResult | null>(null);
  const [simLoading, setSimLoading] = useState(false);

  // Estorno state
  const [estornoOpen, setEstornoOpen] = useState(false);
  const [estornoRecord, setEstornoRecord] = useState<any>(null);
  const [estornoReason, setEstornoReason] = useState('');
  const [estornoSaving, setEstornoSaving] = useState(false);

  // CRUD state
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [editOpen, setEditOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailRecord, setDetailRecord] = useState<any>(null);

  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: String(page), type: typeFilter });
      if (classificationFilter === 'unclassified') params.set('unclassified', 'true');
      const res = await fetch(`/api/financeiro?${params}`);
      if (res.ok) {
        const d = await res.json();
        setRecords(d?.records ?? []);
        setTotalPages(d?.pages ?? 1);
        setSummary(d?.summary ?? { entradas: 0, saidas: 0, saldo: 0 });
        setCategories(d?.categories ?? []);
      }
    } catch (e: any) { console.error(e); } finally { setLoading(false); }
  }, [page, typeFilter, classificationFilter]);

  const fetchAccountPlans = useCallback(async () => {
    try {
      const res = await fetch('/api/plano-contas');
      if (res.ok) setAccountPlans(await res.json());
    } catch (e: any) { console.error(e); }
  }, []);

  const fetchCashAccounts = useCallback(async () => {
    try {
      const res = await fetch('/api/caixas');
      if (res.ok) {
        const d = await res.json();
        setCashAccounts((d?.accounts ?? []).filter((a: any) => a.isActive));
      }
    } catch (e: any) { console.error(e); }
  }, []);

  const fetchMetas = useCallback(async () => {
    try {
      setMetasLoading(true);
      const res = await fetch('/api/financeiro/metas');
      if (res.ok) setMetas(await res.json());
    } catch (e: any) { console.error(e); } finally { setMetasLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { fetchAccountPlans(); }, [fetchAccountPlans]);
  useEffect(() => { fetchCashAccounts(); }, [fetchCashAccounts]);

  const openNew = (type: string) => {
    setForm({ description: '', amount: '', type, paymentMethod: 'pix', categoryId: '', accountPlanId: '', cashAccountId: '', date: '', observation: '' });
    setAiSuggestion(null);
    setDialogOpen(true);
  };

  const handleAiSuggest = async () => {
    if (!form?.description) { toast.error('Informe a descrição primeiro'); return; }
    setAiLoading(true);
    setAiSuggestion(null);
    try {
      const res = await fetch('/api/financeiro/ai-suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: form.description,
          amount: form.amount,
          type: form.type,
          paymentMethod: form.paymentMethod,
          observation: form.observation,
        }),
      });
      if (res.ok) {
        const suggestion = await res.json();
        setAiSuggestion(suggestion);
        // Auto-fill the account plan if suggestion has an ID
        if (suggestion.accountPlanId) {
          setForm((prev: any) => ({ ...prev, accountPlanId: suggestion.accountPlanId }));
        }
        toast.success('Sugestão da IA pronta!');
      } else {
        toast.error('Erro na sugestão da IA');
      }
    } catch (e: any) { toast.error('Erro na IA'); console.error(e); }
    finally { setAiLoading(false); }
  };

  const handleSave = async () => {
    if (!form?.description || !form?.amount) { toast.error('Preencha descrição e valor'); return; }
    if (!form?.cashAccountId) { toast.error('Selecione um caixa para este lançamento'); return; }
    if (!form?.accountPlanId) { toast.error('Selecione um Plano de Contas para classificar este lançamento'); return; }
    try {
      const res = await fetch('/api/financeiro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) { toast.success('Registro criado!'); setDialogOpen(false); fetchData(); }
      else { const d = await res.json(); toast.error(d?.error ?? 'Erro'); }
    } catch (e: any) { toast.error('Erro'); console.error(e); }
  };

  const openEdit = (r: any) => {
    setEditId(r.id);
    setEditForm({
      description: r.description ?? '',
      amount: String(r.amount ?? ''),
      type: r.type ?? 'entrada',
      paymentMethod: r.paymentMethod ?? 'pix',
      categoryId: r.categoryId ?? '',
      accountPlanId: r.accountPlan?.id ?? r.accountPlanId ?? '',
      date: r.date ? new Date(r.date).toISOString().split('T')[0] : '',
      hasCashLink: !!(r.cashMovementId),
    });
    setEditOpen(true);
  };

  const handleUpdate = async () => {
    if (!editId) return;
    setEditSaving(true);
    try {
      const res = await fetch(`/api/financeiro/${editId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      if (res.ok) { toast.success('Registro atualizado!'); setEditOpen(false); setEditId(null); fetchData(); }
      else { const d = await res.json(); toast.error(d?.error ?? 'Erro ao atualizar'); }
    } catch (e: any) { toast.error('Erro'); console.error(e); }
    finally { setEditSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/financeiro/${deleteId}`, { method: 'DELETE' });
      if (res.ok) { toast.success('Registro excluído!'); setDeleteOpen(false); setDeleteId(null); fetchData(); }
      else { const d = await res.json(); toast.error(d?.error ?? 'Erro ao excluir'); }
    } catch (e: any) { toast.error('Erro'); console.error(e); }
    finally { setDeleting(false); }
  };

  const openDetail = (r: any) => { setDetailRecord(r); setDetailOpen(true); };

  const openEstorno = (r: any) => { setEstornoRecord(r); setEstornoReason(''); setEstornoOpen(true); };
  const handleEstorno = async () => {
    if (!estornoRecord?.id) return;
    setEstornoSaving(true);
    try {
      const res = await fetch(`/api/financeiro/${estornoRecord.id}/estorno`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: estornoReason }),
      });
      if (res.ok) {
        toast.success('Estorno realizado com sucesso! Movimento inverso criado.');
        setEstornoOpen(false);
        setEstornoRecord(null);
        fetchData();
      } else {
        const d = await res.json();
        toast.error(d?.error ?? 'Erro ao estornar');
      }
    } catch { toast.error('Erro ao estornar'); }
    finally { setEstornoSaving(false); }
  };

  const handleSimulate = async () => {
    setSimLoading(true);
    try {
      const res = await fetch('/api/financeiro/metas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          despesasMensais: parseFloat(simForm.despesasMensais) || 0,
          margemMedia: parseFloat(simForm.margemMedia) || 30,
          crescimentoDesejado: parseFloat(simForm.crescimentoDesejado) || 0,
          lucroDesejado: parseFloat(simForm.lucroDesejado) || 0,
          faturamentoAtual: parseFloat(simForm.faturamentoAtual) || 0,
        }),
      });
      if (res.ok) setSimResult(await res.json());
    } catch (e: any) { console.error(e); } finally { setSimLoading(false); }
  };

  return (
    <div>
      <AppHeader title="Financeiro" />
      <div className="p-4 lg:p-6 space-y-4">

        <Tabs defaultValue="lancamentos" className="w-full" onValueChange={(v) => { if (v === 'metas' && !metas) fetchMetas(); }}>
          <TabsList className="w-full flex bg-muted/50 rounded-xl p-1 gap-1 h-auto flex-wrap">
            <TabsTrigger value="lancamentos" className="flex-1 min-w-[100px] rounded-lg data-[state=active]:shadow-sm text-xs font-medium py-2.5">
              <DollarSign className="w-3.5 h-3.5 mr-1.5" /> Lançamentos
            </TabsTrigger>
            <TabsTrigger value="metas" className="flex-1 min-w-[100px] rounded-lg data-[state=active]:shadow-sm text-xs font-medium py-2.5">
              <Target className="w-3.5 h-3.5 mr-1.5" /> Metas & Equilíbrio
            </TabsTrigger>
            <TabsTrigger value="simulador" className="flex-1 min-w-[100px] rounded-lg data-[state=active]:shadow-sm text-xs font-medium py-2.5">
              <Calculator className="w-3.5 h-3.5 mr-1.5" /> Simulador
            </TabsTrigger>
          </TabsList>

          {/* ===== TAB: Lançamentos ===== */}
          <TabsContent value="lancamentos" className="mt-4 space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Total Entradas</p>
                      <p className="text-xl font-bold font-mono text-emerald-600">{fmt(summary?.entradas ?? 0)}</p>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center"><TrendingUp className="w-5 h-5 text-emerald-600" /></div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Total Saídas</p>
                      <p className="text-xl font-bold font-mono text-red-600">{fmt(summary?.saidas ?? 0)}</p>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center"><TrendingDown className="w-5 h-5 text-red-600" /></div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Saldo em Caixa</p>
                      <p className={`text-xl font-bold font-mono ${(summary?.saldo ?? 0) >= 0 ? 'text-blue-600' : 'text-red-600'}`}>{fmt(summary?.saldo ?? 0)}</p>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center"><Wallet className="w-5 h-5 text-blue-600" /></div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <select className="h-10 px-3 rounded-md border border-input bg-background text-sm" value={typeFilter} onChange={(e: any) => { setTypeFilter(e?.target?.value ?? ''); setPage(1); }}>
                  <option value="">Todos</option>
                  <option value="entrada">Entradas</option>
                  <option value="saida">Saídas</option>
                </select>
                <Button
                  variant={classificationFilter === 'unclassified' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => { setClassificationFilter(classificationFilter === 'unclassified' ? 'all' : 'unclassified'); setPage(1); }}
                  className={classificationFilter === 'unclassified' ? 'bg-amber-600 hover:bg-amber-700' : 'text-amber-700 border-amber-200 hover:bg-amber-50'}
                >
                  <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
                  {classificationFilter === 'unclassified' ? 'Mostrar Todos' : 'Sem Classificação'}
                </Button>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => openNew('entrada')} className="text-emerald-600 border-emerald-200 hover:bg-emerald-50">
                  <TrendingUp className="w-4 h-4 mr-2" />Nova Entrada
                </Button>
                <Button variant="outline" onClick={() => openNew('saida')} className="text-red-600 border-red-200 hover:bg-red-50">
                  <TrendingDown className="w-4 h-4 mr-2" />Nova Saída
                </Button>
              </div>
            </div>

            <Card className="border-0 shadow-sm">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="hidden md:table-cell">Plano de Contas</TableHead>
                      <TableHead className="hidden sm:table-cell">Pagamento</TableHead>
                      <TableHead className="text-center">Tipo</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="text-right w-[60px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading && Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={`sk-${i}`}>
                        {Array.from({ length: 7 }).map((_, c) => (
                          <TableCell key={c}><div className="skeleton h-4 w-full rounded" /></TableCell>
                        ))}
                      </TableRow>
                    ))}
                    {!loading && (records?.length ?? 0) === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="py-12">
                          <div className="flex flex-col items-center gap-2 text-center">
                            <div className="w-12 h-12 rounded-2xl bg-muted/60 flex items-center justify-center animate-float"><DollarSign className="w-6 h-6 text-muted-foreground/40" /></div>
                            <p className="text-sm font-medium text-foreground/80">Nenhum registro financeiro</p>
                            <p className="text-xs text-muted-foreground">Lançamentos aparecerão aqui conforme você registrar operações.</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                    {(records ?? []).map((r: any) => (
                      <TableRow key={r?.id ?? ''}>
                        <TableCell className="text-sm text-muted-foreground">{r?.date ? new Date(r.date).toLocaleDateString('pt-BR') : '-'}</TableCell>
                        <TableCell className="text-sm font-medium">
                          {r?.reference?.startsWith('ESTORNO#') && <Badge className="bg-orange-100 text-orange-700 text-[10px] mr-1.5"><RotateCcw className="w-2.5 h-2.5 mr-0.5" />Estorno</Badge>}
                          {r?.description ?? ''}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-sm">
                          {r?.accountPlan?.name ? (
                            <span className="text-xs">{r.accountPlan.code ? `${r.accountPlan.code} — ` : ''}{r.accountPlan.name}</span>
                          ) : (
                            <Badge variant="outline" className="text-amber-700 border-amber-300 text-[10px]"><AlertTriangle className="w-2.5 h-2.5 mr-0.5" />Sem classificação</Badge>
                          )}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-sm">{paymentLabels[r?.paymentMethod ?? ''] ?? r?.paymentMethod ?? '-'}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant={r?.type === 'entrada' ? 'default' : 'destructive'} className="text-xs capitalize">{r?.type === 'entrada' ? 'Entrada' : 'Saída'}</Badge>
                        </TableCell>
                        <TableCell className={`text-right font-mono font-medium ${r?.type === 'entrada' ? 'text-emerald-600' : 'text-red-600'}`}>
                          {r?.type === 'entrada' ? '+' : '-'}{fmt(r?.amount ?? 0)}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0"><MoreHorizontal className="w-4 h-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openDetail(r)}><Eye className="w-3.5 h-3.5 mr-2" />Detalhes</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openEdit(r)}><Pencil className="w-3.5 h-3.5 mr-2" />Editar</DropdownMenuItem>
                              {!r.reference?.startsWith('ESTORNO#') && (
                                <DropdownMenuItem onClick={() => openEstorno(r)} className="text-orange-600 focus:text-orange-600"><RotateCcw className="w-3.5 h-3.5 mr-2" />Estornar</DropdownMenuItem>
                              )}
                              <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={() => { setDeleteId(r.id); setDeleteOpen(true); }}><Trash2 className="w-3.5 h-3.5 mr-2" />Excluir</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft className="w-4 h-4" /></Button>
                <span className="text-sm text-muted-foreground">Pág {page} de {totalPages}</span>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}><ChevronRight className="w-4 h-4" /></Button>
              </div>
            )}
          </TabsContent>

          {/* ===== TAB: Metas & Equilíbrio ===== */}
          <TabsContent value="metas" className="mt-4 space-y-4">
            {metasLoading ? (
              <div className="py-20 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" /><p className="text-sm text-muted-foreground mt-2">Calculando...</p></div>
            ) : metas ? (
              <>
                {/* Meta KPI Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <MetaCard icon={Target} label="Ponto de Equilíbrio" value={fmt(metas.metas.pontoEquilibrio)} color="text-blue-600" bg="bg-blue-500/10" />
                  <MetaCard icon={BarChart3} label="Meta Diária" value={fmt(metas.metas.metaDiaria)} color="text-violet-600" bg="bg-violet-500/10" />
                  <MetaCard icon={TrendingUp} label="Meta Semanal" value={fmt(metas.metas.metaSemanal)} color="text-emerald-600" bg="bg-emerald-500/10" />
                  <MetaCard icon={Gauge} label="Lucro Projetado" value={fmt(metas.metas.lucroProjetado)} color={metas.metas.lucroProjetado >= 0 ? 'text-emerald-600' : 'text-red-600'} bg={metas.metas.lucroProjetado >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10'} />
                </div>

                {/* Progress cards */}
                <div className="grid md:grid-cols-2 gap-4">
                  <Card className="border-0 shadow-sm">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <Target className="w-4 h-4 text-blue-500" /> Quanto Preciso Vender?
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="bg-muted/40 rounded-xl p-4">
                        <div className="flex justify-between text-xs text-muted-foreground mb-2">
                          <span>Faturado</span>
                          <span>Ponto de equilíbrio</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-3">
                          <div
                            className={`h-3 rounded-full transition-all ${metas.realizado.faturamento >= metas.metas.pontoEquilibrio ? 'bg-emerald-500' : 'bg-blue-500'}`}
                            style={{ width: `${Math.min(100, metas.metas.pontoEquilibrio > 0 ? (metas.realizado.faturamento / metas.metas.pontoEquilibrio) * 100 : 0)}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-xs mt-1">
                          <span className="font-mono font-semibold">{fmt(metas.realizado.faturamento)}</span>
                          <span className="font-mono text-muted-foreground">{fmt(metas.metas.pontoEquilibrio)}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-muted/30 rounded-lg p-3">
                          <p className="text-[10px] text-muted-foreground">Falta Vender</p>
                          <p className="text-sm font-bold font-mono text-amber-600">{fmt(metas.metas.faltaVender)}</p>
                        </div>
                        <div className="bg-muted/30 rounded-lg p-3">
                          <p className="text-[10px] text-muted-foreground">Dias Restantes</p>
                          <p className="text-sm font-bold font-mono">{metas.periodo.diasRestantes} dias</p>
                        </div>
                        <div className="bg-muted/30 rounded-lg p-3">
                          <p className="text-[10px] text-muted-foreground">Margem Média</p>
                          <p className="text-sm font-bold font-mono">{metas.realizado.margemMedia.toFixed(1)}%</p>
                        </div>
                        <div className="bg-muted/30 rounded-lg p-3">
                          <p className="text-[10px] text-muted-foreground">Despesas do Mês</p>
                          <p className="text-sm font-bold font-mono text-red-600">{fmt(metas.realizado.despesasMes)}</p>
                        </div>
                      </div>

                      {metas.realizado.faturamento >= metas.metas.pontoEquilibrio ? (
                        <div className="flex items-center gap-2 bg-emerald-50 rounded-lg p-3">
                          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                          <p className="text-xs text-emerald-700">Você já ultrapassou o ponto de equilíbrio! O faturamento cobre as despesas.</p>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 bg-amber-50 rounded-lg p-3">
                          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                          <p className="text-xs text-amber-700">Faltam {fmt(metas.metas.faltaVender)} para cobrir as despesas. Meta diária: {fmt(metas.metas.metaDiaria)}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Growth simulations */}
                  <Card className="border-0 shadow-sm">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-emerald-500" /> Simulações de Crescimento
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <div className="bg-muted/30 rounded-lg p-3">
                          <p className="text-[10px] text-muted-foreground">Ritmo Atual / dia</p>
                          <p className="text-sm font-bold font-mono">{fmt(metas.metas.ritmoAtual)}</p>
                        </div>
                        <div className="bg-muted/30 rounded-lg p-3">
                          <p className="text-[10px] text-muted-foreground">Projeção Mês</p>
                          <p className="text-sm font-bold font-mono">{fmt(metas.metas.projecaoMes)}</p>
                        </div>
                      </div>
                      {metas.simulations.map(sim => (
                        <div key={sim.crescimento} className="flex items-center justify-between bg-muted/30 rounded-lg p-3">
                          <div>
                            <p className="text-xs font-semibold">Crescer {sim.crescimento}%</p>
                            <p className="text-[10px] text-muted-foreground">Meta: {fmt(sim.metaMensal)} | Diária: {fmt(sim.metaDiaria)}</p>
                          </div>
                          <div className="text-right">
                            <p className={`text-xs font-mono font-semibold ${sim.lucroEstimado >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                              {fmt(sim.lucroEstimado)}
                            </p>
                            <p className="text-[10px] text-muted-foreground">lucro est.</p>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </div>
              </>
            ) : (
              <div className="py-20 text-center">
                <Target className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">Clique na aba para carregar as metas</p>
              </div>
            )}
          </TabsContent>

          {/* ===== TAB: Simulador ===== */}
          <TabsContent value="simulador" className="mt-4 space-y-4">
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Calculator className="w-4 h-4 text-violet-500" /> Simulador de Crescimento
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-xs text-muted-foreground">Preencha os campos para calcular quanto precisa vender para atingir seus objetivos.</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">Despesas mensais (R$)</Label>
                    <CurrencyInput value={parseFloat(simForm.despesasMensais) || 0} onChange={(v: number) => setSimForm({ ...simForm, despesasMensais: String(v) })} />
                  </div>
                  <div>
                    <Label className="text-xs">Margem média (%)</Label>
                    <Input type="number" step="0.1" placeholder="30" value={simForm.margemMedia} onChange={e => setSimForm({ ...simForm, margemMedia: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">Faturamento atual (R$)</Label>
                    <CurrencyInput value={parseFloat(simForm.faturamentoAtual) || 0} onChange={(v: number) => setSimForm({ ...simForm, faturamentoAtual: String(v) })} />
                  </div>
                  <div>
                    <Label className="text-xs">Crescimento desejado (%)</Label>
                    <Input type="number" step="1" placeholder="20" value={simForm.crescimentoDesejado} onChange={e => setSimForm({ ...simForm, crescimentoDesejado: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">Lucro desejado (R$)</Label>
                    <CurrencyInput value={parseFloat(simForm.lucroDesejado) || 0} onChange={(v: number) => setSimForm({ ...simForm, lucroDesejado: String(v) })} />
                  </div>
                </div>
                <Button onClick={handleSimulate} disabled={simLoading} className="gap-1.5">
                  {simLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calculator className="w-4 h-4" />}
                  Calcular
                </Button>

                {simResult && (
                  <div className="space-y-3 mt-4">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      <div className="bg-blue-50 rounded-xl p-3">
                        <p className="text-[10px] text-blue-600">Para Empatar</p>
                        <p className="text-sm font-bold font-mono text-blue-700">{fmt(simResult.empatar)}</p>
                      </div>
                      <div className="bg-emerald-50 rounded-xl p-3">
                        <p className="text-[10px] text-emerald-600">Para Lucrar</p>
                        <p className="text-sm font-bold font-mono text-emerald-700">{fmt(simResult.lucrar)}</p>
                      </div>
                      <div className="bg-violet-50 rounded-xl p-3">
                        <p className="text-[10px] text-violet-600">Para Crescer</p>
                        <p className="text-sm font-bold font-mono text-violet-700">{fmt(simResult.crescer)}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-muted/30 rounded-lg p-3">
                        <p className="text-[10px] text-muted-foreground">Meta Diária</p>
                        <p className="text-sm font-bold font-mono">{fmt(simResult.metaDiaria)}</p>
                      </div>
                      <div className="bg-muted/30 rounded-lg p-3">
                        <p className="text-[10px] text-muted-foreground">Meta Semanal</p>
                        <p className="text-sm font-bold font-mono">{fmt(simResult.metaSemanal)}</p>
                      </div>
                    </div>
                    <div className={`flex items-start gap-2 rounded-lg p-3 ${simResult.risco.includes('prejuízo') ? 'bg-red-50' : simResult.risco.includes('abaixo') ? 'bg-amber-50' : 'bg-emerald-50'}`}>
                      {simResult.risco.includes('prejuízo') ? <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" /> : simResult.risco.includes('abaixo') ? <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" /> : <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />}
                      <div>
                        <p className="text-xs font-semibold">{simResult.risco}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{simResult.sugestao}</p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* ===== New Entry Dialog with AI ===== */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">{form?.type === 'entrada' ? 'Nova Entrada' : 'Nova Saída'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Descrição *</Label>
              <Input value={form?.description ?? ''} onChange={(e: any) => setForm({ ...(form ?? {}), description: e?.target?.value ?? '' })} placeholder="Ex: Compra de mercadoria fornecedor" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Valor *</Label><CurrencyInput value={parseFloat(form?.amount) || 0} onChange={(v) => setForm({ ...(form ?? {}), amount: String(v) })} /></div>
              <div><Label>Data</Label><Input type="date" value={form?.date ?? ''} onChange={(e: any) => setForm({ ...(form ?? {}), date: e?.target?.value ?? '' })} /></div>
            </div>
            {/* Caixa vinculado (OBRIGATÓRIO) */}
            <div>
              <Label className="flex items-center gap-1.5"><Wallet className="w-3.5 h-3.5" /> Caixa *</Label>
              <select
                className={`w-full h-10 px-3 rounded-md border text-sm ${form?.cashAccountId ? 'border-input bg-background' : 'border-amber-300 bg-amber-50/50'}`}
                value={form?.cashAccountId ?? ''}
                onChange={(e: any) => setForm({ ...(form ?? {}), cashAccountId: e?.target?.value ?? '' })}
              >
                <option value="">Selecione o caixa...</option>
                {cashAccounts.map((a: any) => (
                  <option key={a.id} value={a.id}>{a.name} ({fmt(a.currentBalance)})</option>
                ))}
              </select>
              {!form?.cashAccountId && <p className="text-[10px] text-amber-600 mt-1">Todo lançamento precisa afetar um caixa</p>}
            </div>
            <div><Label>Forma de Pagamento</Label>
              <select className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm" value={form?.paymentMethod ?? ''} onChange={(e: any) => setForm({ ...(form ?? {}), paymentMethod: e?.target?.value ?? '' })}>
                {Object.entries(paymentLabels).map(([k, v]: [string, string]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>

            {/* AI Suggest Button */}
            <Button
              type="button" variant="outline" className="w-full gap-2 border-violet-200 text-violet-700 hover:bg-violet-50"
              onClick={handleAiSuggest} disabled={aiLoading || !form?.description}
            >
              {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {aiLoading ? 'Analisando...' : 'Sugerir com IA'}
            </Button>

            {/* AI Suggestion Card */}
            {aiSuggestion && (
              <div className="bg-violet-50/50 border border-violet-200 rounded-xl p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Brain className="w-4 h-4 text-violet-600" />
                  <span className="text-xs font-semibold text-violet-700">Sugestão da IA</span>
                  {aiSuggestion.confidence && (
                    <Badge variant="outline" className="text-[9px] ml-auto">
                      {Math.round(aiSuggestion.confidence * 100)}% confiança
                    </Badge>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-muted-foreground">Conta:</span> <span className="font-medium">{aiSuggestion.accountPlanName}</span></div>
                  <div><span className="text-muted-foreground">Tipo:</span> <span className="font-medium capitalize">{aiSuggestion.accountType}</span></div>
                  <div><span className="text-muted-foreground">DRE:</span> <span className="font-medium">{aiSuggestion.dreGroup || '-'}</span></div>
                  <div><span className="text-muted-foreground">Exibe DRE:</span> <span className="font-medium">{aiSuggestion.showInDre ? 'Sim' : 'Não'}</span></div>
                </div>
                {aiSuggestion.explanation && (
                  <p className="text-[11px] text-muted-foreground leading-relaxed">{aiSuggestion.explanation}</p>
                )}
                {aiSuggestion.tip && (
                  <div className="flex items-start gap-1.5">
                    <Info className="w-3 h-3 text-violet-500 mt-0.5 shrink-0" />
                    <p className="text-[11px] text-violet-600">{aiSuggestion.tip}</p>
                  </div>
                )}
              </div>
            )}

            {/* Account Plan selector - REQUIRED, filtered by type */}
            <div>
              <Label className="flex items-center gap-1.5"><Layers className="w-3.5 h-3.5" /> Plano de Contas <span className="text-red-500">*</span></Label>
              <select
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                value={form?.accountPlanId ?? ''}
                onChange={(e: any) => setForm({ ...(form ?? {}), accountPlanId: e?.target?.value ?? '' })}
              >
                <option value="">Selecione classificação</option>
                {accountPlans
                  .filter((p: any) => form?.type === 'entrada' ? p.type === 'receita' : (p.type === 'despesa' || p.type === 'custo' || p.type === 'financeiro' || p.type === 'imposto'))
                  .map((p: any) => (
                    <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
                  ))}
              </select>
              <AccountPlanSuggestion
                description={form?.description ?? ''}
                direction={form?.type === 'entrada' ? 'entrada' : 'saida'}
                currentAccountPlanId={form?.accountPlanId}
                onApply={(id) => setForm({ ...(form ?? {}), accountPlanId: id })}
              />
              <p className="text-[11px] text-muted-foreground mt-1">Necessário para DRE e análises financeiras.</p>
            </div>

            {/* FinancialCategory deprecated — use AccountPlan exclusively */}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave}>Registrar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {/* ===== EDIT DIALOG ===== */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Pencil className="w-5 h-5" /> Editar Lançamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Aviso se vinculado ao caixa */}
            {editForm?.hasCashLink && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-2.5 flex items-start gap-2">
                <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                <p className="text-xs text-blue-700">Este lançamento está vinculado ao caixa. Valor e tipo não podem ser alterados. Use <strong>estorno</strong> para corrigir.</p>
              </div>
            )}
            <div><Label>Descrição *</Label><Input value={editForm?.description ?? ''} onChange={(e: any) => setEditForm({ ...(editForm ?? {}), description: e?.target?.value ?? '' })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Valor *</Label><CurrencyInput value={parseFloat(editForm?.amount) || 0} onChange={(v) => setEditForm({ ...(editForm ?? {}), amount: String(v) })} disabled={!!editForm?.hasCashLink} /></div>
              <div><Label>Data</Label><Input type="date" value={editForm?.date ?? ''} onChange={(e: any) => setEditForm({ ...(editForm ?? {}), date: e?.target?.value ?? '' })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Tipo</Label>
                <select className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm disabled:opacity-50 disabled:cursor-not-allowed" value={editForm?.type ?? ''} onChange={(e: any) => setEditForm({ ...(editForm ?? {}), type: e?.target?.value ?? '' })} disabled={!!editForm?.hasCashLink}>
                  <option value="entrada">Entrada</option><option value="saida">Saída</option>
                </select>
              </div>
              <div><Label>Pagamento</Label>
                <select className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm" value={editForm?.paymentMethod ?? ''} onChange={(e: any) => setEditForm({ ...(editForm ?? {}), paymentMethod: e?.target?.value ?? '' })}>
                  {Object.entries(paymentLabels).map(([k, v]: [string, string]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            </div>
            <div><Label className="flex items-center gap-1.5"><Layers className="w-3.5 h-3.5" /> Plano de Contas</Label>
              <select className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm" value={editForm?.accountPlanId ?? ''} onChange={(e: any) => setEditForm({ ...(editForm ?? {}), accountPlanId: e?.target?.value ?? '' })}>
                <option value="">Sem classificação</option>
                {accountPlans
                  .filter((p: any) => editForm?.type === 'entrada' ? p.type === 'receita' : (p.type === 'despesa' || p.type === 'custo' || p.type === 'financeiro' || p.type === 'imposto'))
                  .map((p: any) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
              </select>
              <AccountPlanSuggestion
                description={editForm?.description ?? ''}
                direction={editForm?.type === 'entrada' ? 'entrada' : 'saida'}
                currentAccountPlanId={editForm?.accountPlanId}
                onApply={(id) => setEditForm({ ...(editForm ?? {}), accountPlanId: id })}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
              <Button onClick={handleUpdate} disabled={editSaving}>{editSaving ? 'Salvando...' : 'Salvar'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ===== DELETE DIALOG ===== */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Registro</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja excluir este lançamento financeiro? Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-red-600 hover:bg-red-700">{deleting ? 'Excluindo...' : 'Excluir'}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ===== DETAIL DIALOG ===== */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Eye className="w-5 h-5" /> Detalhes do Lançamento</DialogTitle>
          </DialogHeader>
          {detailRecord && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-[10px] text-muted-foreground">Descrição</p>
                  <p className="text-sm font-medium">{detailRecord.description}</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-[10px] text-muted-foreground">Valor</p>
                  <p className={`text-sm font-bold font-mono ${detailRecord.type === 'entrada' ? 'text-emerald-600' : 'text-red-600'}`}>{detailRecord.type === 'entrada' ? '+' : '-'}{fmt(detailRecord.amount ?? 0)}</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-[10px] text-muted-foreground">Tipo</p>
                  <Badge variant={detailRecord.type === 'entrada' ? 'default' : 'destructive'} className="text-xs capitalize mt-0.5">{detailRecord.type === 'entrada' ? 'Entrada' : 'Saída'}</Badge>
                </div>
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-[10px] text-muted-foreground">Forma Pagamento</p>
                  <p className="text-sm">{paymentLabels[detailRecord.paymentMethod] ?? detailRecord.paymentMethod ?? '-'}</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-[10px] text-muted-foreground">Data</p>
                  <p className="text-sm">{detailRecord.date ? new Date(detailRecord.date).toLocaleDateString('pt-BR') : '-'}</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-[10px] text-muted-foreground">Plano de Contas</p>
                  <p className="text-sm">{detailRecord.accountPlan ? `${detailRecord.accountPlan.code} — ${detailRecord.accountPlan.name}` : '-'}</p>
                </div>
              </div>
              {detailRecord.cashAccountId && (
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-[10px] text-muted-foreground">Caixa Vinculado</p>
                  <p className="text-sm font-medium flex items-center gap-1.5"><Wallet className="w-3 h-3" />{cashAccounts.find((a: any) => a.id === detailRecord.cashAccountId)?.name ?? 'Caixa'}</p>
                </div>
              )}
              <div className="bg-muted/30 rounded-lg p-3">
                <p className="text-[10px] text-muted-foreground">Sincronia</p>
                <Badge variant={detailRecord.cashMovementId ? 'default' : 'outline'} className="text-[10px]">
                  {detailRecord.cashMovementId ? 'Vinculado ao Caixa' : 'Sem vínculo (legado)'}
                </Badge>
              </div>
              <div className="bg-muted/30 rounded-lg p-3">
                <p className="text-[10px] text-muted-foreground">ID</p>
                <p className="text-xs font-mono text-muted-foreground">{detailRecord.id}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ===== ESTORNO DIALOG ===== */}
      <AlertDialog open={estornoOpen} onOpenChange={setEstornoOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2"><RotateCcw className="w-5 h-5 text-orange-600" />Estornar Lançamento</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>Será criado um lançamento inverso para anular o efeito deste registro. O registro original será mantido para auditoria.</p>
                {estornoRecord && (
                  <div className="bg-muted/50 p-3 rounded-lg space-y-1">
                    <p className="text-sm font-medium">{estornoRecord.description}</p>
                    <p className="text-sm">
                      <Badge variant={estornoRecord.type === 'entrada' ? 'default' : 'destructive'} className="text-xs mr-2">
                        {estornoRecord.type === 'entrada' ? 'Entrada' : 'Saída'}
                      </Badge>
                      <span className="font-mono font-bold">{fmt(estornoRecord.amount ?? 0)}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">Será criado: <strong>{estornoRecord.type === 'entrada' ? 'Saída' : 'Entrada'}</strong> de {fmt(estornoRecord.amount ?? 0)}</p>
                    {estornoRecord.cashAccountId && (
                      <p className="text-xs text-blue-600 flex items-center gap-1 mt-1"><Wallet className="w-3 h-3" /> Caixa vinculado será atualizado automaticamente</p>
                    )}
                    {!estornoRecord.cashAccountId && !estornoRecord.cashMovementId && (
                      <p className="text-[10px] text-amber-600 mt-1">Registro legado — sem impacto no caixa</p>
                    )}
                  </div>
                )}
                <div>
                  <Label className="text-xs">Motivo do estorno (opcional)</Label>
                  <Textarea value={estornoReason} onChange={(e: any) => setEstornoReason(e.target.value)} rows={2} placeholder="Ex: Valor digitado incorretamente..." className="mt-1" />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleEstorno} disabled={estornoSaving} className="bg-orange-600 hover:bg-orange-700">
              {estornoSaving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Estornando...</> : <><RotateCcw className="w-4 h-4 mr-2" />Confirmar Estorno</>}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function MetaCard({ icon: Icon, label, value, color, bg }: { icon: any; label: string; value: string; color: string; bg: string }) {
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