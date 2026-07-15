'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { AppHeader } from '@/components/app-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { CurrencyInput } from '@/components/ui/currency-input';
import { formatBRL } from '@/lib/currency-input';
import AccountPlanSuggestion from '@/components/account-plan-suggestion';
import {
  Plus, Clock, CheckCircle, AlertTriangle, Pencil, Trash2, Search,
  CalendarDays, Layers, Wallet, Banknote, Info, Eye, RefreshCw,
  Repeat, CheckCheck, ListChecks
} from 'lucide-react';
import { toast } from 'sonner';

const fmt = (v: number | null | undefined) => {
  if (v == null || isNaN(v)) return 'R$ 0,00';
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};
const fmtDate = (d: string) => {
  try { return new Date(d).toLocaleDateString('pt-BR'); } catch { return '-'; }
};
const toInputDate = (d: string) => {
  try { return new Date(d).toISOString().split('T')[0]; } catch { return ''; }
};

const statusColors: Record<string, string> = {
  pendente: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  pago: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  recebido: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  vencido: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  parcial: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  cancelada: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
};
const statusLabel: Record<string, string> = {
  pendente: 'Pendente', pago: 'Pago', recebido: 'Recebido', vencido: 'Vencido', parcial: 'Parcial', cancelada: 'Cancelada',
};

interface CashAccount {
  id: string;
  name: string;
  currentBalance: number;
  isActive: boolean;
}
interface Supplier {
  id: string;
  name: string;
}
interface PaySource {
  cashAccountId: string;
  amount: number;
}

export default function ContasContent() {
  const [tab, setTab] = useState('pagar');
  const [payables, setPayables] = useState<any[]>([]);
  const [receivables, setReceivables] = useState<any[]>([]);
  const [paySummary, setPaySummary] = useState({ totalPendente: 0, totalPago: 0, totalVencido: 0 });
  const [recSummary, setRecSummary] = useState({ totalPendente: 0, totalRecebido: 0, totalVencido: 0 });
  const [statusFilter, setStatusFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  // Dialogs
  const [createOpen, setCreateOpen] = useState(false);
  const [createType, setCreateType] = useState<'pagar' | 'receber'>('pagar');
  const [editOpen, setEditOpen] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [payItem, setPayItem] = useState<any>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteItem, setDeleteItem] = useState<any>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<any>(null);
  const [bulkPayOpen, setBulkPayOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkCashAccountId, setBulkCashAccountId] = useState('');

  // Auxiliary data
  const [cashAccounts, setCashAccounts] = useState<CashAccount[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [accountPlans, setAccountPlans] = useState<any[]>([]);

  // Create form
  const [cForm, setCForm] = useState({
    description: '', amount: 0, dueDate: '', notes: '', supplierId: '', customerId: '',
    installments: 1, periodicity: 'mensal', customDays: 30,
    isRecurring: false, recurringPeriodicity: 'mensal', recurringEndDate: '',
    accountPlanId: '',
  });

  // Edit form
  const [eForm, setEForm] = useState({
    description: '', amount: 0, dueDate: '', notes: '', supplierId: '', customerId: '', status: '',
    accountPlanId: '',
  });

  // Pay form
  const [pForm, setPForm] = useState({
    payAmount: 0, isPartial: false, sources: [] as PaySource[],
  });

  // Fetch data
  const fetchPayables = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (searchTerm) params.set('search', searchTerm);
      const res = await fetch(`/api/contas-pagar?${params}`);
      const data = await res.json();
      setPayables(data.records || []);
      setPaySummary(data.summary || { totalPendente: 0, totalPago: 0, totalVencido: 0 });
    } catch { /* ignore */ }
  }, [statusFilter, searchTerm]);

  const fetchReceivables = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (searchTerm) params.set('search', searchTerm);
      const res = await fetch(`/api/contas-receber?${params}`);
      const data = await res.json();
      setReceivables(data.records || []);
      setRecSummary(data.summary || { totalPendente: 0, totalRecebido: 0, totalVencido: 0 });
    } catch { /* ignore */ }
  }, [statusFilter, searchTerm]);

  const fetchAux = useCallback(async () => {
    try {
      const [cRes, sRes, apRes] = await Promise.all([
        fetch('/api/caixas'),
        fetch('/api/fornecedores?limit=100'),
        fetch('/api/plano-contas'),
      ]);
      const cData = await cRes.json();
      const sData = await sRes.json();
      const apData = apRes.ok ? await apRes.json() : [];
      setCashAccounts((cData.accounts || []).filter((a: CashAccount) => a.isActive));
      setSuppliers(sData.records || sData.suppliers || []);
      setAccountPlans(Array.isArray(apData) ? apData : []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchAux();
  }, [fetchAux]);

  useEffect(() => {
    setLoading(true);
    setSelectedIds(new Set());
    Promise.all([fetchPayables(), fetchReceivables()]).finally(() => setLoading(false));
  }, [fetchPayables, fetchReceivables]);

  // Auto-generate recurring bills on mount
  useEffect(() => {
    fetch('/api/contas-pagar/recorrencias', { method: 'POST' }).catch(() => {});
  }, []);

  // Installment preview
  const installmentPreview = useMemo(() => {
    if (cForm.installments <= 1 || !cForm.dueDate || cForm.amount <= 0) return [];
    const items: { num: number; amount: string; date: string }[] = [];
    const base = new Date(cForm.dueDate + 'T12:00:00');
    const perInst = Math.floor((cForm.amount / cForm.installments) * 100) / 100;
    let remaining = cForm.amount;
    for (let i = 0; i < cForm.installments; i++) {
      const isLast = i === cForm.installments - 1;
      const amt = isLast ? remaining : perInst;
      remaining -= amt;
      const d = new Date(base);
      switch (cForm.periodicity) {
        case 'diaria': d.setDate(d.getDate() + i); break;
        case 'semanal': d.setDate(d.getDate() + (i * 7)); break;
        case 'quinzenal': d.setDate(d.getDate() + (i * 15)); break;
        case 'mensal': d.setMonth(d.getMonth() + i); break;
        case 'personalizada': d.setDate(d.getDate() + (i * cForm.customDays)); break;
      }
      items.push({ num: i + 1, amount: fmt(amt), date: d.toLocaleDateString('pt-BR') });
    }
    return items;
  }, [cForm.installments, cForm.amount, cForm.dueDate, cForm.periodicity, cForm.customDays]);

  // === Actions ===
  const openCreate = (type: 'pagar' | 'receber') => {
    setCreateType(type);
    setCForm({
      description: '', amount: 0, dueDate: '', notes: '', supplierId: '', customerId: '',
      installments: 1, periodicity: 'mensal', customDays: 30,
      isRecurring: false, recurringPeriodicity: 'mensal', recurringEndDate: '',
      accountPlanId: '',
    });
    setCreateOpen(true);
  };

  const handleCreate = async () => {
    if (!cForm.description || cForm.amount <= 0 || !cForm.dueDate) {
      toast.error('Preencha descrição, valor e vencimento'); return;
    }
    if (createType === 'pagar' && !cForm.accountPlanId && accountPlans.length > 0) {
      toast.error('Selecione um Plano de Contas para classificar esta despesa'); return;
    }
    setSaving(true);
    try {
      const url = createType === 'pagar' ? '/api/contas-pagar' : '/api/contas-receber';
      const payload: any = {
        description: cForm.description,
        amount: cForm.amount,
        dueDate: cForm.dueDate,
        notes: cForm.notes,
      };
      if (createType === 'pagar') {
        payload.supplierId = cForm.supplierId || undefined;
        payload.accountPlanId = cForm.accountPlanId || undefined;
        payload.installments = cForm.installments;
        payload.periodicity = cForm.periodicity;
        payload.customDays = cForm.customDays;
        payload.isRecurring = cForm.isRecurring;
        payload.recurringPeriodicity = cForm.recurringPeriodicity;
        payload.recurringEndDate = cForm.recurringEndDate || undefined;
      } else {
        payload.customerId = cForm.customerId || undefined;
        payload.accountPlanId = cForm.accountPlanId || undefined; // server defaults to 1.01 if null
      }
      const res = await fetch(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Erro'); }
      const data = await res.json();
      const n = data.count || 1;
      const recMsg = cForm.isRecurring ? ' (recorrente)' : '';
      toast.success(n > 1 ? `${n} parcelas criadas com sucesso!${recMsg}` : `Conta criada com sucesso!${recMsg}`);
      setCreateOpen(false);
      fetchPayables(); fetchReceivables();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao criar conta');
    } finally { setSaving(false); }
  };

  const openEdit = (item: any) => {
    setEditItem(item);
    setEForm({
      description: item.description || '',
      amount: item.amount || 0,
      dueDate: toInputDate(item.dueDate),
      notes: item.notes || '',
      supplierId: item.supplierId || '',
      customerId: item.customerId || '',
      status: item.status || 'pendente',
      accountPlanId: item.accountPlanId || '',
    });
    setEditOpen(true);
  };

  const handleEdit = async () => {
    if (!editItem) return;
    setSaving(true);
    try {
      const isAP = tab === 'pagar';
      const url = isAP ? `/api/contas-pagar/${editItem.id}` : `/api/contas-receber/${editItem.id}`;
      const payload: any = {
        description: eForm.description,
        amount: eForm.amount,
        dueDate: eForm.dueDate,
        notes: eForm.notes,
      };
      if (isAP) {
        payload.supplierId = eForm.supplierId || null;
        payload.accountPlanId = eForm.accountPlanId || null;
      } else {
        payload.customerId = eForm.customerId || null;
        payload.accountPlanId = eForm.accountPlanId || null;
      }
      const res = await fetch(url, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Erro'); }
      toast.success('Conta atualizada com sucesso!');
      setEditOpen(false);
      fetchPayables(); fetchReceivables();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao editar');
    } finally { setSaving(false); }
  };

  const openPay = (item: any) => {
    setPayItem(item);
    setPForm({
      payAmount: item.amount || 0,
      isPartial: false,
      sources: cashAccounts.length > 0 ? [{ cashAccountId: cashAccounts[0].id, amount: item.amount || 0 }] : [],
    });
    setPayOpen(true);
  };

  const handlePay = async () => {
    if (!payItem) return;
    if (pForm.payAmount <= 0) { toast.error('Informe o valor do pagamento'); return; }
    if (pForm.sources.length === 0) { toast.error('Selecione pelo menos um caixa'); return; }
    const totalSources = pForm.sources.reduce((s, p) => s + p.amount, 0);
    if (Math.abs(totalSources - pForm.payAmount) > 0.01) {
      toast.error(`Soma dos caixas (${fmt(totalSources)}) difere do valor do pagamento (${fmt(pForm.payAmount)})`); return;
    }
    setSaving(true);
    try {
      const isAP = tab === 'pagar';
      const url = isAP ? `/api/contas-pagar/${payItem.id}` : `/api/contas-receber/${payItem.id}`;
      const payload: any = {
        payAction: true,
        payAmount: pForm.payAmount,
        paymentSources: pForm.sources,
      };
      const arPayload = {
        status: 'recebido',
        cashAccountId: pForm.sources[0]?.cashAccountId || '',
      };
      const res = await fetch(url, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isAP ? payload : arPayload),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Erro'); }
      toast.success(isAP ? (pForm.isPartial ? 'Pagamento parcial registrado!' : 'Pagamento registrado!') : 'Recebimento registrado!');
      setPayOpen(false);
      fetchPayables(); fetchReceivables(); fetchAux();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao registrar pagamento');
    } finally { setSaving(false); }
  };

  const openDelete = (item: any) => { setDeleteItem(item); setDeleteOpen(true); };

  const handleDelete = async () => {
    if (!deleteItem) return;
    setSaving(true);
    try {
      const isAP = tab === 'pagar';
      const url = isAP ? `/api/contas-pagar/${deleteItem.id}` : `/api/contas-receber/${deleteItem.id}`;
      const res = await fetch(url, { method: 'DELETE' });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Erro'); }
      toast.success('Conta excluída!');
      setDeleteOpen(false);
      fetchPayables(); fetchReceivables();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao excluir');
    } finally { setSaving(false); }
  };

  // Pay form helpers
  const addSource = () => {
    setPForm(f => ({
      ...f,
      sources: [...f.sources, { cashAccountId: cashAccounts[0]?.id || '', amount: 0 }],
    }));
  };
  const removeSource = (idx: number) => {
    setPForm(f => ({ ...f, sources: f.sources.filter((_, i) => i !== idx) }));
  };
  const updateSource = (idx: number, field: 'cashAccountId' | 'amount', val: any) => {
    setPForm(f => {
      const sources = [...f.sources];
      sources[idx] = { ...sources[idx], [field]: val };
      return { ...f, sources };
    });
  };

  const openDetail = (item: any) => { setDetailItem(item); setDetailOpen(true); };

  // Bulk selection
  const pendingPayables = useMemo(() => payables.filter(p => p.status === 'pendente' || (p.status === 'pendente' && new Date(p.dueDate) < new Date())), [payables]);
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleSelectAll = () => {
    const pending = payables.filter(p => p.status !== 'pago' && p.status !== 'cancelada');
    if (selectedIds.size === pending.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pending.map(p => p.id)));
    }
  };

  const openBulkPay = () => {
    if (selectedIds.size === 0) { toast.error('Selecione pelo menos uma conta'); return; }
    setBulkCashAccountId(cashAccounts[0]?.id || '');
    setBulkPayOpen(true);
  };

  const handleBulkPay = async () => {
    if (!bulkCashAccountId) { toast.error('Selecione o caixa'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/contas-pagar/pagar-lote', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds), cashAccountId: bulkCashAccountId }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Erro'); }
      const data = await res.json();
      toast.success(`${data.count} conta(s) paga(s) em lote — Total: ${fmt(data.totalPaid)}`);
      setBulkPayOpen(false);
      setSelectedIds(new Set());
      fetchPayables(); fetchAux();
    } catch (err: any) {
      toast.error(err.message || 'Erro no pagamento em lote');
    } finally { setSaving(false); }
  };

  const bulkTotal = useMemo(() => {
    return payables.filter(p => selectedIds.has(p.id)).reduce((s, p) => s + (p.amount || 0), 0);
  }, [selectedIds, payables]);

  const handleMarkReceived = (item: any) => {
    // Redireciona para o dialog de pagamento para selecionar caixa
    openPay(item);
  };

  const handleGenerateRecurring = async () => {
    try {
      const res = await fetch('/api/contas-pagar/recorrencias', { method: 'POST' });
      const data = await res.json();
      if (data.count > 0) {
        toast.success(`${data.count} conta(s) recorrente(s) gerada(s)!`);
        fetchPayables();
      } else {
        toast.info('Nenhuma conta recorrente pendente de geração');
      }
    } catch { toast.error('Erro ao gerar recorrências'); }
  };

  // === Render Helpers ===
  const renderSummaryCards = (type: 'pagar' | 'receber') => {
    const isPagar = type === 'pagar';
    const summary = isPagar ? paySummary : recSummary;
    const paidKey = isPagar ? 'totalPago' : 'totalRecebido';
    const paidLabel = isPagar ? 'Pago' : 'Recebido';
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="glass-card hover-lift">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                <Clock className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Pendente</p>
                <p className="text-lg font-bold num-highlight">{fmt(summary.totalPendente)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card hover-lift">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{paidLabel}</p>
                <p className="text-lg font-bold num-highlight">{fmt((summary as any)[paidKey])}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card hover-lift">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Vencido</p>
                <p className="text-lg font-bold num-highlight">{fmt(summary.totalVencido)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderPayablesTable = () => {
    const pendingCount = payables.filter(p => p.status !== 'pago' && p.status !== 'cancelada').length;
    return (
      <Card className="card-premium">
        <CardContent className="p-0">
          {/* Bulk actions bar */}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-3 px-4 py-2.5 bg-blue-50 dark:bg-blue-900/20 border-b">
              <CheckCheck className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-700 dark:text-blue-400">
                {selectedIds.size} selecionada(s) — Total: {fmt(bulkTotal)}
              </span>
              <Button size="sm" className="ml-auto h-7 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700" onClick={openBulkPay}>
                <Wallet className="w-3 h-3" /> Pagar Selecionadas
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setSelectedIds(new Set())}>
                Limpar
              </Button>
            </div>
          )}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={pendingCount > 0 && selectedIds.size === pendingCount}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Parcela</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right w-36">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
                ) : payables.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhuma conta a pagar encontrada</TableCell></TableRow>
                ) : payables.map((r: any) => {
                  const isOverdue = r.status === 'pendente' && new Date(r.dueDate) < new Date();
                  const canSelect = r.status !== 'pago' && r.status !== 'cancelada';
                  return (
                    <TableRow key={r.id} className={`stagger-item ${isOverdue ? 'bg-red-50/50 dark:bg-red-900/10' : ''} ${selectedIds.has(r.id) ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}>
                      <TableCell>
                        {canSelect && (
                          <Checkbox
                            checked={selectedIds.has(r.id)}
                            onCheckedChange={() => toggleSelect(r.id)}
                          />
                        )}
                      </TableCell>
                      <TableCell className="font-medium max-w-[200px] truncate">
                        <div className="flex items-center gap-1.5">
                          {r.isRecurring && <span title="Recorrente"><Repeat className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" /></span>}
                          <span className="truncate">{r.description}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{r.supplier?.name || '-'}</TableCell>
                      <TableCell className="text-right font-mono text-sm font-semibold">{fmt(r.amount)}</TableCell>
                      <TableCell className="text-sm">
                        <span className={isOverdue ? 'text-red-600 font-medium' : ''}>{fmtDate(r.dueDate)}</span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {r.totalInstallments > 1 ? `${r.installmentNum}/${r.totalInstallments}` : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColors[isOverdue && r.status === 'pendente' ? 'vencido' : r.status] || ''}>
                          {isOverdue && r.status === 'pendente' ? 'Vencido' : statusLabel[r.status] || r.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          {canSelect && (
                            <Button size="sm" variant="default" className="h-7 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700" onClick={() => openPay(r)}>
                              <Wallet className="w-3 h-3" /> Pagar
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEdit(r)} title="Editar">
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openDetail(r)} title="Detalhes">
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                          {r.status !== 'pago' && (
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => openDelete(r)} title="Excluir">
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderReceivablesTable = () => (
    <Card className="card-premium">
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Descrição</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right w-28">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : receivables.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhuma conta a receber encontrada</TableCell></TableRow>
              ) : receivables.map((r: any) => {
                const isOverdue = r.status === 'pendente' && new Date(r.dueDate) < new Date();
                return (
                  <TableRow key={r.id} className={`stagger-item ${isOverdue ? 'bg-red-50/50 dark:bg-red-900/10' : ''}`}>
                    <TableCell className="font-medium max-w-[200px] truncate">{r.description}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{r.customer?.name || '-'}</TableCell>
                    <TableCell className="text-right font-mono text-sm font-semibold">{fmt(r.amount)}</TableCell>
                    <TableCell className="text-sm">
                      <span className={isOverdue ? 'text-red-600 font-medium' : ''}>{fmtDate(r.dueDate)}</span>
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColors[isOverdue && r.status === 'pendente' ? 'vencido' : r.status] || ''}>
                        {isOverdue && r.status === 'pendente' ? 'Vencido' : statusLabel[r.status] || r.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        {(r.status === 'pendente' || (r.status === 'pendente' && isOverdue)) && (
                          <Button size="sm" variant="default" className="h-7 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700" onClick={() => handleMarkReceived(r)}>
                            <CheckCircle className="w-3 h-3" /> Receber
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEdit(r)} title="Editar">
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        {r.status !== 'recebido' && (
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => openDelete(r)} title="Excluir">
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="flex flex-col min-h-screen">
      <AppHeader title="Recebimentos e Pagamentos" />
      <div className="flex-1 p-4 lg:p-6 space-y-4">
        <Tabs value={tab} onValueChange={(v) => { setTab(v); setSelectedIds(new Set()); }}>
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <TabsList>
              <TabsTrigger value="pagar" className="gap-1.5">
                <Banknote className="w-4 h-4" /> A Pagar
              </TabsTrigger>
              <TabsTrigger value="receber" className="gap-1.5">
                <Wallet className="w-4 h-4" /> A Receber
              </TabsTrigger>
            </TabsList>
            <div className="flex gap-2 items-center flex-wrap">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar..."
                  className="pl-8 h-9 w-40"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Select value={statusFilter || 'all'} onValueChange={(v) => setStatusFilter(v === 'all' ? '' : v)}>
                <SelectTrigger className="w-36 h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value={tab === 'pagar' ? 'pago' : 'recebido'}>{tab === 'pagar' ? 'Pago' : 'Recebido'}</SelectItem>
                  <SelectItem value="vencido">Vencido</SelectItem>
                </SelectContent>
              </Select>
              {tab === 'pagar' && (
                <Button size="sm" variant="outline" className="gap-1.5 h-9" onClick={handleGenerateRecurring} title="Gerar recorrências pendentes">
                  <RefreshCw className="w-4 h-4" /> Recorrências
                </Button>
              )}
              <Button size="sm" className="gap-1.5" onClick={() => openCreate(tab as any)}>
                <Plus className="w-4 h-4" /> Nova Conta
              </Button>
            </div>
          </div>

          <TabsContent value="pagar" className="space-y-4">
            {renderSummaryCards('pagar')}
            {renderPayablesTable()}
          </TabsContent>

          <TabsContent value="receber" className="space-y-4">
            {renderSummaryCards('receber')}
            {renderReceivablesTable()}
          </TabsContent>
        </Tabs>
      </div>

      {/* ===== CREATE DIALOG ===== */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Nova Conta a {createType === 'pagar' ? 'Pagar' : 'Receber'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Descrição *</Label>
              <Input value={cForm.description} onChange={(e) => setCForm({ ...cForm, description: e.target.value })} placeholder="Ex: Aluguel, Fornecedor X..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Valor Total *</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
                  <CurrencyInput value={cForm.amount} onChange={(v) => setCForm({ ...cForm, amount: v })} className="pl-9" />
                </div>
              </div>
              <div>
                <Label>Primeiro Vencimento *</Label>
                <Input type="date" value={cForm.dueDate} onChange={(e) => setCForm({ ...cForm, dueDate: e.target.value })} />
              </div>
            </div>

            {createType === 'pagar' && (
              <div>
                <Label>Fornecedor</Label>
                <Select value={cForm.supplierId || 'none'} onValueChange={(v) => setCForm({ ...cForm, supplierId: v === 'none' ? '' : v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione (opcional)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Account Plan selector - Contas a Pagar */}
            {createType === 'pagar' && accountPlans.length > 0 && (
              <div>
                <Label className="flex items-center gap-1.5"><Layers className="w-3.5 h-3.5" /> Plano de Contas <span className="text-red-500">*</span></Label>
                <Select value={cForm.accountPlanId || 'none'} onValueChange={(v) => setCForm({ ...cForm, accountPlanId: v === 'none' ? '' : v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione o tipo de despesa" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem classificação</SelectItem>
                    {accountPlans.filter((p: any) => p.type === 'despesa' || p.type === 'custo' || p.type === 'imposto').map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>{p.code ? `${p.code} — ` : ''}{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <AccountPlanSuggestion
                  description={cForm.description}
                  direction="saida"
                  currentAccountPlanId={cForm.accountPlanId}
                  onApply={(id) => setCForm({ ...cForm, accountPlanId: id })}
                />
                <p className="text-xs text-muted-foreground mt-1">Necessário para análises do DRE e relatórios financeiros.</p>
              </div>
            )}

            {/* Account Plan selector - Contas a Receber */}
            {createType === 'receber' && accountPlans.length > 0 && (
              <div>
                <Label className="flex items-center gap-1.5"><Layers className="w-3.5 h-3.5" /> Plano de Contas</Label>
                <Select value={cForm.accountPlanId || 'none'} onValueChange={(v) => setCForm({ ...cForm, accountPlanId: v === 'none' ? '' : v })}>
                  <SelectTrigger><SelectValue placeholder="Padrão: Receita Operacional (1.1)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Padrão (Receita de Vendas)</SelectItem>
                    {accountPlans.filter((p: any) => p.type === 'receita').map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>{p.code ? `${p.code} — ` : ''}{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <AccountPlanSuggestion
                  description={cForm.description}
                  direction="entrada"
                  currentAccountPlanId={cForm.accountPlanId}
                  onApply={(id) => setCForm({ ...cForm, accountPlanId: id })}
                />
              </div>
            )}

            {/* Installment config - only for Contas a Pagar */}
            {createType === 'pagar' && (
              <div className="space-y-3 p-3 rounded-lg border bg-muted/30">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Layers className="w-4 h-4" /> Parcelamento
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Parcelas</Label>
                    <Select value={String(cForm.installments)} onValueChange={(v) => setCForm({ ...cForm, installments: parseInt(v) })}>
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => (
                          <SelectItem key={n} value={String(n)}>{n === 1 ? 'À vista' : `${n}x`}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {cForm.installments > 1 && (
                    <div>
                      <Label className="text-xs">Periodicidade</Label>
                      <Select value={cForm.periodicity} onValueChange={(v) => setCForm({ ...cForm, periodicity: v })}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="mensal">Mensal</SelectItem>
                          <SelectItem value="quinzenal">Quinzenal</SelectItem>
                          <SelectItem value="semanal">Semanal</SelectItem>
                          <SelectItem value="diaria">Diária</SelectItem>
                          <SelectItem value="personalizada">Personalizada</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
                {cForm.installments > 1 && cForm.periodicity === 'personalizada' && (
                  <div>
                    <Label className="text-xs">Intervalo em dias</Label>
                    <Input type="number" min={1} value={cForm.customDays} onChange={(e) => setCForm({ ...cForm, customDays: parseInt(e.target.value) || 30 })} className="h-9" />
                  </div>
                )}
                {installmentPreview.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                      <CalendarDays className="w-3 h-3" /> Prévia das parcelas:
                    </p>
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {installmentPreview.map(p => (
                        <div key={p.num} className="flex items-center justify-between text-xs bg-background rounded px-2 py-1">
                          <span className="font-medium">{p.num}ª parcela</span>
                          <span className="font-mono">{p.amount}</span>
                          <span className="text-muted-foreground">{p.date}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Recurrence config - only for Contas a Pagar, only for single payments */}
            {createType === 'pagar' && cForm.installments <= 1 && (
              <div className="space-y-3 p-3 rounded-lg border bg-blue-50/50 dark:bg-blue-900/10 border-blue-200/50 dark:border-blue-800/30">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="recurring"
                    checked={cForm.isRecurring}
                    onCheckedChange={(v) => setCForm({ ...cForm, isRecurring: !!v })}
                  />
                  <label htmlFor="recurring" className="text-sm font-medium flex items-center gap-1.5 cursor-pointer">
                    <Repeat className="w-4 h-4 text-blue-600" /> Conta Recorrente
                  </label>
                </div>
                <p className="text-xs text-muted-foreground">
                  Marque para contas fixas como aluguel, salários, internet, etc.
                  O sistema gerará automaticamente as próximas cobranças.
                </p>
                {cForm.isRecurring && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Periodicidade</Label>
                      <Select value={cForm.recurringPeriodicity} onValueChange={(v) => setCForm({ ...cForm, recurringPeriodicity: v })}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="mensal">Mensal</SelectItem>
                          <SelectItem value="quinzenal">Quinzenal</SelectItem>
                          <SelectItem value="semanal">Semanal</SelectItem>
                          <SelectItem value="bimestral">Bimestral</SelectItem>
                          <SelectItem value="trimestral">Trimestral</SelectItem>
                          <SelectItem value="semestral">Semestral</SelectItem>
                          <SelectItem value="anual">Anual</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Data Final (opcional)</Label>
                      <Input type="date" value={cForm.recurringEndDate} onChange={(e) => setCForm({ ...cForm, recurringEndDate: e.target.value })} className="h-9" />
                    </div>
                  </div>
                )}
              </div>
            )}

            <div>
              <Label>Observações</Label>
              <Textarea value={cForm.notes} onChange={(e) => setCForm({ ...cForm, notes: e.target.value })} rows={2} placeholder="Observações opcionais..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? 'Salvando...' : cForm.installments > 1 ? `Criar ${cForm.installments} Parcelas` : cForm.isRecurring ? 'Criar Recorrente' : 'Criar Conta'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== EDIT DIALOG ===== */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-5 h-5" /> Editar Conta
            </DialogTitle>
            <DialogDescription>Alterações serão registradas no log de auditoria.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Descrição</Label>
              <Input value={eForm.description} onChange={(e) => setEForm({ ...eForm, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Valor</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
                  <CurrencyInput value={eForm.amount} onChange={(v) => setEForm({ ...eForm, amount: v })} className="pl-9" />
                </div>
              </div>
              <div>
                <Label>Vencimento</Label>
                <Input type="date" value={eForm.dueDate} onChange={(e) => setEForm({ ...eForm, dueDate: e.target.value })} />
              </div>
            </div>
            {tab === 'pagar' && (
              <div>
                <Label>Fornecedor</Label>
                <Select value={eForm.supplierId || 'none'} onValueChange={(v) => setEForm({ ...eForm, supplierId: v === 'none' ? '' : v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {tab === 'pagar' && accountPlans.length > 0 && (
              <div>
                <Label className="flex items-center gap-1.5"><Layers className="w-3.5 h-3.5" /> Plano de Contas</Label>
                <Select value={eForm.accountPlanId || 'none'} onValueChange={(v) => setEForm({ ...eForm, accountPlanId: v === 'none' ? '' : v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem classificação</SelectItem>
                    {accountPlans.filter((p: any) => p.type === 'despesa' || p.type === 'custo' || p.type === 'imposto').map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>{p.code ? `${p.code} — ` : ''}{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <AccountPlanSuggestion
                  description={eForm.description}
                  direction="saida"
                  currentAccountPlanId={eForm.accountPlanId}
                  onApply={(id) => setEForm({ ...eForm, accountPlanId: id })}
                />
              </div>
            )}
            {tab === 'receber' && accountPlans.length > 0 && (
              <div>
                <Label className="flex items-center gap-1.5"><Layers className="w-3.5 h-3.5" /> Plano de Contas</Label>
                <Select value={eForm.accountPlanId || 'none'} onValueChange={(v) => setEForm({ ...eForm, accountPlanId: v === 'none' ? '' : v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem classificação</SelectItem>
                    {accountPlans.filter((p: any) => p.type === 'receita').map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>{p.code ? `${p.code} — ` : ''}{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <AccountPlanSuggestion
                  description={eForm.description}
                  direction="entrada"
                  currentAccountPlanId={eForm.accountPlanId}
                  onApply={(id) => setEForm({ ...eForm, accountPlanId: id })}
                />
              </div>
            )}
            <div>
              <Label>Observações</Label>
              <Textarea value={eForm.notes} onChange={(e) => setEForm({ ...eForm, notes: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button onClick={handleEdit} disabled={saving}>{saving ? 'Salvando...' : 'Salvar Alterações'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== PAYMENT DIALOG ===== */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-emerald-600" /> {tab === 'pagar' ? 'Registrar Pagamento' : 'Registrar Recebimento'}
            </DialogTitle>
            {payItem && (
              <DialogDescription>
                {payItem.description} — Saldo: {fmt(payItem.amount)}
              </DialogDescription>
            )}
          </DialogHeader>
          {payItem && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" checked={!pForm.isPartial} onChange={() => setPForm(f => ({ ...f, isPartial: false, payAmount: payItem.amount }))} />
                  Pagamento total
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" checked={pForm.isPartial} onChange={() => setPForm(f => ({ ...f, isPartial: true, payAmount: 0 }))} />
                  Pagamento parcial
                </label>
              </div>

              {pForm.isPartial && (
                <div>
                  <Label>Valor do Pagamento</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
                    <CurrencyInput
                      value={pForm.payAmount}
                      onChange={(v) => {
                        const max = payItem.amount;
                        setPForm(f => ({ ...f, payAmount: Math.min(v, max) }));
                      }}
                      className="pl-9"
                      autoFocus
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Máximo: {fmt(payItem.amount)}</p>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Origem do Pagamento</Label>
                  {pForm.sources.length < cashAccounts.length && (
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={addSource}>
                      <Plus className="w-3 h-3" /> Caixa
                    </Button>
                  )}
                </div>
                {pForm.sources.map((src, idx) => (
                  <div key={idx} className="flex gap-2 items-end">
                    <div className="flex-1">
                      {idx === 0 && <Label className="text-xs">Caixa</Label>}
                      <Select value={src.cashAccountId} onValueChange={(v) => updateSource(idx, 'cashAccountId', v)}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {cashAccounts.map(ca => (
                            <SelectItem key={ca.id} value={ca.id}>
                              {ca.name} ({fmt(ca.currentBalance)})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="w-32">
                      {idx === 0 && <Label className="text-xs">Valor</Label>}
                      <CurrencyInput value={src.amount} onChange={(v) => updateSource(idx, 'amount', v)} />
                    </div>
                    {pForm.sources.length > 1 && (
                      <Button size="sm" variant="ghost" className="h-9 w-9 p-0 text-destructive" onClick={() => removeSource(idx)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
                {pForm.sources.length > 0 && (
                  <div className="flex justify-between text-xs pt-1 border-t">
                    <span className="text-muted-foreground">Total dos caixas:</span>
                    <span className={`font-mono font-medium ${
                      Math.abs(pForm.sources.reduce((s, p) => s + p.amount, 0) - pForm.payAmount) > 0.01 ? 'text-red-500' : 'text-emerald-600'
                    }`}>
                      {fmt(pForm.sources.reduce((s, p) => s + p.amount, 0))}
                    </span>
                  </div>
                )}
              </div>

              {cashAccounts.length === 0 && (
                <p className="text-sm text-amber-600 flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4" /> Nenhum caixa cadastrado. Cadastre um caixa primeiro.
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(false)}>Cancelar</Button>
            <Button onClick={handlePay} disabled={saving || cashAccounts.length === 0} className="bg-emerald-600 hover:bg-emerald-700">
              {saving ? 'Processando...' : tab === 'pagar' ? (pForm.isPartial ? 'Pagar Parcial' : 'Confirmar Pagamento') : 'Confirmar Recebimento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== BULK PAY DIALOG ===== */}
      <Dialog open={bulkPayOpen} onOpenChange={setBulkPayOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ListChecks className="w-5 h-5 text-emerald-600" /> Pagamento em Lote
            </DialogTitle>
            <DialogDescription>
              {selectedIds.size} conta(s) selecionada(s) — Total: {fmt(bulkTotal)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Caixa para Pagamento</Label>
              <Select value={bulkCashAccountId} onValueChange={setBulkCashAccountId}>
                <SelectTrigger><SelectValue placeholder="Selecione o caixa" /></SelectTrigger>
                <SelectContent>
                  {cashAccounts.map(ca => (
                    <SelectItem key={ca.id} value={ca.id}>
                      {ca.name} ({fmt(ca.currentBalance)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {bulkCashAccountId && (() => {
              const acct = cashAccounts.find(a => a.id === bulkCashAccountId);
              const saldo = acct?.currentBalance ?? 0;
              const insufficent = saldo < bulkTotal;
              return insufficent ? (
                <p className="text-sm text-amber-600 flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4" /> Saldo insuficiente ({fmt(saldo)}) para o total ({fmt(bulkTotal)})
                </p>
              ) : null;
            })()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkPayOpen(false)}>Cancelar</Button>
            <Button onClick={handleBulkPay} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
              {saving ? 'Processando...' : `Pagar ${selectedIds.size} Conta(s)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== DELETE DIALOG ===== */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="w-5 h-5" /> Excluir Conta
            </DialogTitle>
            <DialogDescription>Esta ação não pode ser desfeita.</DialogDescription>
          </DialogHeader>
          {deleteItem && (
            <div className="text-sm space-y-2">
              <p><strong>Descrição:</strong> {deleteItem.description}</p>
              <p><strong>Valor:</strong> {fmt(deleteItem.amount)}</p>
              <p><strong>Vencimento:</strong> {fmtDate(deleteItem.dueDate)}</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={saving}>{saving ? 'Excluindo...' : 'Confirmar Exclusão'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== DETAIL DIALOG ===== */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Info className="w-5 h-5" /> Detalhes da Conta
            </DialogTitle>
          </DialogHeader>
          {detailItem && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-muted-foreground">Descrição:</span><p className="font-medium">{detailItem.description}</p></div>
                <div><span className="text-muted-foreground">Status:</span><p><Badge className={statusColors[detailItem.status] || ''}>{statusLabel[detailItem.status] || detailItem.status}</Badge></p></div>
                <div><span className="text-muted-foreground">Valor:</span><p className="font-mono font-semibold">{fmt(detailItem.amount)}</p></div>
                <div><span className="text-muted-foreground">Vencimento:</span><p>{fmtDate(detailItem.dueDate)}</p></div>
                {detailItem.supplier && (
                  <div><span className="text-muted-foreground">Fornecedor:</span><p>{detailItem.supplier.name}</p></div>
                )}
                {detailItem.customer && (
                  <div><span className="text-muted-foreground">Cliente:</span><p>{detailItem.customer.name}</p></div>
                )}
                {detailItem.totalInstallments > 1 && (
                  <div><span className="text-muted-foreground">Parcela:</span><p>{detailItem.installmentNum}/{detailItem.totalInstallments}</p></div>
                )}
                {detailItem.paidDate && (
                  <div><span className="text-muted-foreground">Pago em:</span><p>{fmtDate(detailItem.paidDate)}</p></div>
                )}
                {detailItem.receivedDate && (
                  <div><span className="text-muted-foreground">Recebido em:</span><p>{fmtDate(detailItem.receivedDate)}</p></div>
                )}
                {detailItem.accountPlan && (
                  <div><span className="text-muted-foreground">Plano de Contas:</span><p className="flex items-center gap-1"><Layers className="w-3.5 h-3.5" />{detailItem.accountPlan.code ? `${detailItem.accountPlan.code} — ` : ''}{detailItem.accountPlan.name}</p></div>
                )}
                {detailItem.isRecurring && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Recorrência:</span>
                    <p className="flex items-center gap-1">
                      <Repeat className="w-3.5 h-3.5 text-blue-500" />
                      {detailItem.recurringPeriodicity || 'mensal'}
                      {detailItem.recurringEndDate ? ` até ${fmtDate(detailItem.recurringEndDate)}` : ' (sem data final)'}
                    </p>
                  </div>
                )}
              </div>
              {detailItem.notes && (
                <div className="pt-2 border-t">
                  <span className="text-muted-foreground">Observações:</span>
                  <p className="whitespace-pre-line mt-1">{detailItem.notes}</p>
                </div>
              )}
              {detailItem.stockEntry && (
                <div className="pt-2 border-t">
                  <span className="text-muted-foreground">Entrada de Estoque:</span>
                  <p>#{detailItem.stockEntry.entryNumber}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}