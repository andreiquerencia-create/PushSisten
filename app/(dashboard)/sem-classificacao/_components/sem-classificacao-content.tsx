'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { AppHeader } from '@/components/app-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  AlertTriangle, ListChecks, Sparkles, RefreshCw, Wand2, Loader2,
  TrendingDown, TrendingUp, FileText, CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';

const fmt = (v: number | null | undefined) => {
  if (v == null || isNaN(v)) return 'R$ 0,00';
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};
const fmtDate = (d: string) => {
  try { return new Date(d).toLocaleDateString('pt-BR'); } catch { return '-'; }
};

interface Item {
  id: string;
  source: 'pagar' | 'receber' | 'financeiro';
  description: string;
  amount: number;
  date: string;
  direction: 'entrada' | 'saida';
  status: string;
  supplierName?: string | null;
  customerName?: string | null;
}

interface SuggestedClassification {
  accountPlanId: string;
  code: string;
  name: string;
  label: string;
}

export default function SemClassificacaoContent() {
  const [loading, setLoading] = useState(true);
  const [pagar, setPagar] = useState<Item[]>([]);
  const [receber, setReceber] = useState<Item[]>([]);
  const [financeiro, setFinanceiro] = useState<Item[]>([]);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [accountPlans, setAccountPlans] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<Record<string, SuggestedClassification | null>>({});
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<'all' | 'pagar' | 'receber' | 'financeiro'>('all');
  const [batchPlanId, setBatchPlanId] = useState<string>('');
  const [batchOpen, setBatchOpen] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [resData, resPlans] = await Promise.all([
        fetch('/api/sem-classificacao'),
        fetch('/api/plano-contas'),
      ]);
      if (resData.ok) {
        const d = await resData.json();
        setPagar(d.pagar || []);
        setReceber(d.receber || []);
        setFinanceiro(d.financeiro || []);
      }
      if (resPlans.ok) {
        const d = await resPlans.json();
        const flatten = (nodes: any[], result: any[] = []): any[] => {
          for (const n of nodes) {
            result.push(n);
            if (n.children) flatten(n.children, result);
          }
          return result;
        };
        const arr = Array.isArray(d) ? d : d.tree ?? d.accountPlans ?? [];
        setAccountPlans(flatten(arr));
      }
    } catch (e) {
      toast.error('Erro ao carregar dados');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const allItems = useMemo(() => {
    return [...pagar, ...receber, ...financeiro].sort((a, b) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [pagar, receber, financeiro]);

  const displayed = useMemo(() => {
    if (tab === 'all') return allItems;
    if (tab === 'pagar') return pagar;
    if (tab === 'receber') return receber;
    return financeiro;
  }, [tab, allItems, pagar, receber, financeiro]);

  const totalAmount = displayed.reduce((s, i) => s + (i.amount || 0), 0);

  const fetchSuggestion = useCallback(async (item: Item) => {
    const key = `${item.source}:${item.id}`;
    if (key in suggestions) return;
    try {
      const r = await fetch('/api/plano-contas/sugestao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: item.description, direction: item.direction }),
      });
      if (r.ok) {
        const d = await r.json();
        setSuggestions(prev => ({ ...prev, [key]: d.suggestion || null }));
      }
    } catch { /* ignore */ }
  }, [suggestions]);

  useEffect(() => {
    if (loading) return;
    let cancelled = false;
    (async () => {
      for (const item of displayed.slice(0, 50)) {
        if (cancelled) break;
        await fetchSuggestion(item);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayed.length, loading]);

  const setItemPlan = (item: Item, planId: string) => {
    const key = `${item.source}:${item.id}`;
    setSelected(prev => ({ ...prev, [key]: planId }));
  };

  const removeItemPlan = (item: Item) => {
    const key = `${item.source}:${item.id}`;
    setSelected(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const applyAllSuggestions = () => {
    let applied = 0;
    const next = { ...selected };
    for (const item of displayed) {
      const key = `${item.source}:${item.id}`;
      const sug = suggestions[key];
      if (sug?.accountPlanId && !next[key]) {
        next[key] = sug.accountPlanId;
        applied++;
      }
    }
    setSelected(next);
    if (applied > 0) toast.success(`${applied} sugestões aplicadas — confirme abaixo`);
    else toast.info('Nenhuma sugestão nova para aplicar');
  };

  const applyBatchPlan = () => {
    if (!batchPlanId) return;
    const next = { ...selected };
    let applied = 0;
    for (const item of displayed) {
      const key = `${item.source}:${item.id}`;
      next[key] = batchPlanId;
      applied++;
    }
    setSelected(next);
    setBatchOpen(false);
    toast.success(`${applied} classificações definidas em lote`);
  };

  const handleSave = async () => {
    const items = Object.entries(selected)
      .filter(([_, v]) => !!v)
      .map(([key, v]) => {
        const [source, id] = key.split(':');
        return { source, id, accountPlanId: v };
      });
    if (items.length === 0) {
      toast.info('Nenhum item para salvar');
      return;
    }
    setSaving(true);
    try {
      const r = await fetch('/api/sem-classificacao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      if (r.ok) {
        const d = await r.json();
        toast.success(`${d.updated} lançamentos classificados!`);
        setSelected({});
        setSuggestions({});
        await fetchAll();
      } else {
        const d = await r.json();
        toast.error(d.error || 'Erro ao salvar');
      }
    } catch (e) {
      toast.error('Erro ao salvar');
    }
    setSaving(false);
  };

  const totalPending = pagar.length + receber.length + financeiro.length;
  const totalSelected = Object.values(selected).filter(Boolean).length;

  const filteredPlansFor = (direction: 'entrada' | 'saida') => {
    if (direction === 'entrada') return accountPlans.filter(p => p.type === 'receita');
    return accountPlans.filter(p => p.type === 'despesa' || p.type === 'custo' || p.type === 'financeiro' || p.type === 'imposto');
  };

  return (
    <div className="min-h-screen">
      <AppHeader title="Lançamentos sem Classificação" />

      <div className="px-4 md:px-6 py-6 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Card className="glass-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <AlertTriangle className="w-3.5 h-3.5" /> Total sem classificação
              </div>
              <div className="text-2xl font-bold num-highlight">{totalPending}</div>
              <div className="text-xs text-muted-foreground mt-1">{fmt(totalAmount)} em valor</div>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <TrendingDown className="w-3.5 h-3.5" /> Contas a Pagar
              </div>
              <div className="text-2xl font-bold text-red-600 num-highlight">{pagar.length}</div>
              <div className="text-xs text-muted-foreground mt-1">{fmt(pagar.reduce((s, i) => s + i.amount, 0))}</div>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <TrendingUp className="w-3.5 h-3.5" /> Contas a Receber
              </div>
              <div className="text-2xl font-bold text-emerald-600 num-highlight">{receber.length}</div>
              <div className="text-xs text-muted-foreground mt-1">{fmt(receber.reduce((s, i) => s + i.amount, 0))}</div>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <FileText className="w-3.5 h-3.5" /> Financeiro
              </div>
              <div className="text-2xl font-bold text-blue-600 num-highlight">{financeiro.length}</div>
              <div className="text-xs text-muted-foreground mt-1">{fmt(financeiro.reduce((s, i) => s + i.amount, 0))}</div>
            </CardContent>
          </Card>
        </div>

        {/* Toolbar */}
        <Card className="glass-card">
          <CardContent className="p-4 flex flex-col md:flex-row gap-3 md:items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <ListChecks className="w-4 h-4 text-muted-foreground" />
              <span>{totalSelected} de {displayed.length} selecionado(s)</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={applyAllSuggestions} disabled={loading}>
                <Sparkles className="w-4 h-4 mr-1.5 text-violet-500" /> Aplicar Sugestões
              </Button>
              <Button variant="outline" onClick={() => setBatchOpen(true)} disabled={loading || displayed.length === 0}>
                <Wand2 className="w-4 h-4 mr-1.5" /> Classificar em Lote
              </Button>
              <Button onClick={handleSave} disabled={saving || totalSelected === 0} className="bg-emerald-600 hover:bg-emerald-700">
                {saving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1.5" />}
                Salvar {totalSelected > 0 ? `(${totalSelected})` : ''}
              </Button>
              <Button variant="ghost" onClick={fetchAll} disabled={loading}>
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Tabs + Table */}
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList>
            <TabsTrigger value="all">Todos ({totalPending})</TabsTrigger>
            <TabsTrigger value="pagar">Contas a Pagar ({pagar.length})</TabsTrigger>
            <TabsTrigger value="receber">Contas a Receber ({receber.length})</TabsTrigger>
            <TabsTrigger value="financeiro">Financeiro ({financeiro.length})</TabsTrigger>
          </TabsList>

          <TabsContent value={tab} className="mt-4">
            <Card className="glass-card">
              <CardContent className="p-0">
                {loading ? (
                  <div className="p-12 text-center text-muted-foreground">Carregando...</div>
                ) : displayed.length === 0 ? (
                  <div className="p-12 text-center">
                    <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-2" />
                    <p className="text-lg font-semibold">Tudo classificado!</p>
                    <p className="text-sm text-muted-foreground mt-1">Nenhum lançamento sem Plano de Contas nesta categoria.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[120px]">Origem</TableHead>
                          <TableHead>Descrição</TableHead>
                          <TableHead className="w-[110px]">Data</TableHead>
                          <TableHead className="text-right w-[110px]">Valor</TableHead>
                          <TableHead className="w-[280px]">Classificar como</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {displayed.map(item => {
                          const key = `${item.source}:${item.id}`;
                          const sug = suggestions[key];
                          const currentValue = selected[key] || '';
                          const sourceLabel = item.source === 'pagar' ? 'A Pagar' : item.source === 'receber' ? 'A Receber' : 'Financeiro';
                          const sourceColor = item.direction === 'saida'
                            ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                            : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
                          return (
                            <TableRow key={key}>
                              <TableCell>
                                <Badge className={sourceColor}>{sourceLabel}</Badge>
                              </TableCell>
                              <TableCell>
                                <div className="font-medium text-sm">{item.description}</div>
                                {(item.supplierName || item.customerName) && (
                                  <div className="text-xs text-muted-foreground">{item.supplierName || item.customerName}</div>
                                )}
                              </TableCell>
                              <TableCell className="text-xs">{fmtDate(item.date)}</TableCell>
                              <TableCell className="text-right font-medium">
                                <span className={item.direction === 'entrada' ? 'text-emerald-600' : 'text-red-600'}>
                                  {item.direction === 'entrada' ? '+' : '-'}{fmt(item.amount)}
                                </span>
                              </TableCell>
                              <TableCell>
                                <div className="space-y-1">
                                  <Select value={currentValue || ''} onValueChange={(v) => v ? setItemPlan(item, v) : removeItemPlan(item)}>
                                    <SelectTrigger className="h-8 text-xs">
                                      <SelectValue placeholder="Selecione..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {filteredPlansFor(item.direction).map((p: any) => (
                                        <SelectItem key={p.id} value={p.id}>{p.code} — {p.name}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  {sug && !currentValue && (
                                    <button
                                      type="button"
                                      className="flex items-center gap-1 px-2 py-1 text-[11px] rounded bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300 hover:bg-violet-100 transition"
                                      onClick={() => setItemPlan(item, sug.accountPlanId)}
                                    >
                                      <Sparkles className="w-3 h-3" />
                                      Sugestão: {sug.code} — {sug.name}
                                    </button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Batch Dialog */}
      <Dialog open={batchOpen} onOpenChange={setBatchOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Wand2 className="w-5 h-5" /> Classificar em Lote</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Aplica a mesma classificação a todos os {displayed.length} lançamentos visíveis nesta aba.
            </p>
            <div>
              <label className="text-sm font-medium">Plano de Contas</label>
              <Select value={batchPlanId} onValueChange={setBatchPlanId}>
                <SelectTrigger><SelectValue placeholder="Escolha um plano..." /></SelectTrigger>
                <SelectContent>
                  {accountPlans.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.code} — {p.name} ({p.type})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchOpen(false)}>Cancelar</Button>
            <Button onClick={applyBatchPlan} disabled={!batchPlanId}>Aplicar a Todos</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}