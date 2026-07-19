'use client';

import { useState, useEffect, useCallback } from 'react';
import { AppHeader } from '@/components/app-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CurrencyInput } from '@/components/ui/currency-input';
import AccountPlanSuggestion from '@/components/account-plan-suggestion';
import {
  Wallet, Plus, Landmark, CreditCard, QrCode, Banknote, Pencil, ArrowRightLeft,
  ArrowDownCircle, ArrowUpCircle, History, Clock, User, ChevronLeft, ChevronRight, Loader2, Eye,
  LockKeyhole, UnlockKeyhole, FileText, CheckCircle, AlertCircle, CalendarDays, Calculator,
  Trash2, MoreHorizontal, RotateCcw, Scale, Wrench, ShieldCheck,
} from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

const typeLabels: Record<string, string> = { dinheiro: 'Dinheiro', banco: 'Banco', pix: 'PIX', cartao: 'Cartão' };
const typeIcons: Record<string, any> = { dinheiro: Banknote, banco: Landmark, pix: QrCode, cartao: CreditCard };
const typeColors: Record<string, string> = {
  dinheiro: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  banco: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  pix: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  cartao: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
};

const originLabels: Record<string, string> = {
  venda_pdv: 'Venda PDV', ajuste_manual: 'Ajuste Manual', ajuste_caixa: 'Ajuste de Caixa', transferencia: 'Transferência',
  recebimento_cartao: 'Recebimento Cartão', pagamento_conta: 'Pagamento Conta',
  recebimento_conta: 'Recebimento AR',
  entrada_financeira: 'Entrada Financeira', saida_financeira: 'Saída Financeira',
  exclusao_financeiro: 'Exclusão de Lançamento',
  estorno_financeiro: 'Estorno Financeiro', estorno_transferencia: 'Estorno Transferência',
  sangria: 'Sangria', reforco: 'Reforço',
  abertura_caixa: 'Abertura Caixa', fechamento_caixa: 'Fechamento Caixa',
  estorno: 'Estorno', devolucao: 'Devolução', comissao: 'Comissão',
};
const movTypeColors: Record<string, string> = {
  entrada: 'text-emerald-600', saida: 'text-red-600',
  transferencia_entrada: 'text-blue-600', transferencia_saida: 'text-orange-600',
};
const movTypeLabels: Record<string, string> = {
  entrada: 'Entrada', saida: 'Saída',
  transferencia_entrada: 'Transf. Entrada', transferencia_saida: 'Transf. Saída',
};

const fmt = (v: number | null | undefined) => (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (d: string) => {
  const dt = new Date(d);
  return dt.toLocaleDateString('pt-BR') + ' ' + dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

export function CaixasContent() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [totalBalance, setTotalBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('visao');

  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>({ name: '', type: 'dinheiro', initialBalance: '0', notes: '' });

  // Transfer dialog
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferForm, setTransferForm] = useState({ fromAccountId: '', toAccountId: '', amount: '', notes: '' });
  const [transferring, setTransferring] = useState(false);

  // Movement dialog (manual entry/exit)
  const [movOpen, setMovOpen] = useState(false);
  const [movForm, setMovForm] = useState({ type: 'entrada', amount: '', description: '', notes: '', accountPlanId: '' });
  const [movSaving, setMovSaving] = useState(false);

  // Account plans (for classification)
  const [accountPlans, setAccountPlans] = useState<any[]>([]);

  // History view
  const [selectedAccount, setSelectedAccount] = useState<any>(null);
  const [movements, setMovements] = useState<any[]>([]);
  const [movPage, setMovPage] = useState(1);
  const [movTotalPages, setMovTotalPages] = useState(1);
  const [movLoading, setMovLoading] = useState(false);

  // Movement CRUD state
  const [editMovOpen, setEditMovOpen] = useState(false);
  const [editMovId, setEditMovId] = useState<string | null>(null);
  const [editMovForm, setEditMovForm] = useState({ description: '', notes: '' });
  const [editMovSaving, setEditMovSaving] = useState(false);
  const [deleteMovOpen, setDeleteMovOpen] = useState(false);
  const [deleteMovId, setDeleteMovId] = useState<string | null>(null);
  const [deleteMovDeleting, setDeleteMovDeleting] = useState(false);
  const [detailMovOpen, setDetailMovOpen] = useState(false);
  const [detailMov, setDetailMov] = useState<any>(null);

  // Transfer edit state
  const [editTransferOpen, setEditTransferOpen] = useState(false);
  const [editTransferMov, setEditTransferMov] = useState<any>(null);
  const [editTransferForm, setEditTransferForm] = useState({ amount: '', fromAccountId: '', toAccountId: '', notes: '' });
  const [editTransferSaving, setEditTransferSaving] = useState(false);

  // Transfer estorno state
  const [estornoTransferOpen, setEstornoTransferOpen] = useState(false);
  const [estornoTransferMov, setEstornoTransferMov] = useState<any>(null);
  const [estornoTransferSaving, setEstornoTransferSaving] = useState(false);

  // Ajuste de caixa state
  const [ajusteOpen, setAjusteOpen] = useState(false);
  const [ajusteForm, setAjusteForm] = useState({ cashAccountId: '', actualBalance: '', adjustmentType: 'diferenca', reason: '', accountPlanId: '' });
  const [ajusteSaving, setAjusteSaving] = useState(false);

  // Reconciliação state
  const [reconOpen, setReconOpen] = useState(false);
  const [reconResults, setReconResults] = useState<any>(null);
  const [reconLoading, setReconLoading] = useState(false);
  const [reconFixing, setReconFixing] = useState(false);

  // Fechamento (cash session) state
  const [cashSessions, setCashSessions] = useState<any[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [openSession, setOpenSession] = useState<any>(null);
  const [sessionDetail, setSessionDetail] = useState<any>(null);
  const [openCashDialog, setOpenCashDialog] = useState(false);
  const [closeCashDialog, setCloseCashDialog] = useState(false);
  const [detailDialog, setDetailDialog] = useState(false);
  const [openingForm, setOpeningForm] = useState({ cashAccountId: '', openingBalance: '0', notes: '' });
  const [closingForm, setClosingForm] = useState({ informedBalance: '', notes: '' });
  const [sessionSaving, setSessionSaving] = useState(false);

  const fetchSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      const res = await fetch('/api/caixas/sessoes?limit=30');
      if (res.ok) {
        const d = await res.json();
        setCashSessions(d.sessions ?? []);
        setOpenSession(d.openSession ?? null);
      }
    } catch (e: any) { console.error(e); } finally { setSessionsLoading(false); }
  }, []);

  const handleOpenSession = async () => {
    if (!openingForm.cashAccountId) { toast.error('Selecione o caixa'); return; }
    setSessionSaving(true);
    try {
      const res = await fetch('/api/caixas/sessoes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(openingForm),
      });
      if (res.ok) {
        toast.success('Caixa aberto com sucesso!');
        setOpenCashDialog(false);
        fetchSessions();
        fetchAccounts();
      } else { const d = await res.json(); toast.error(d?.error ?? 'Erro ao abrir caixa'); }
    } catch { toast.error('Erro ao abrir caixa'); }
    setSessionSaving(false);
  };

  const handleCloseSession = async () => {
    if (!openSession?.id) return;
    setSessionSaving(true);
    try {
      const res = await fetch(`/api/caixas/sessoes/${openSession.id}/fechar`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(closingForm),
      });
      if (res.ok) {
        const data = await res.json();
        toast.success('Caixa fechado com sucesso!');
        setCloseCashDialog(false);
        setSessionDetail(data.session);
        setDetailDialog(true);
        fetchSessions();
        fetchAccounts();
      } else { const d = await res.json(); toast.error(d?.error ?? 'Erro ao fechar caixa'); }
    } catch { toast.error('Erro ao fechar caixa'); }
    setSessionSaving(false);
  };

  useEffect(() => { if (tab === 'fechamento') fetchSessions(); }, [tab, fetchSessions]);

  const fetchAccounts = useCallback(async () => {
    try {
      const res = await fetch('/api/caixas');
      if (res.ok) {
        const data = await res.json();
        setAccounts(data.accounts ?? []);
        setTotalBalance(data.totalBalance ?? 0);
      }
    } catch (e: any) { console.error(e); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);

  // Fetch account plans for classification
  useEffect(() => {
    fetch('/api/plano-contas')
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setAccountPlans(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  const fetchMovements = useCallback(async (accountId: string, page = 1) => {
    setMovLoading(true);
    try {
      const res = await fetch(`/api/caixas/${accountId}/movimentacoes?page=${page}&limit=20`);
      if (res.ok) {
        const d = await res.json();
        setMovements(d.movements ?? []);
        setMovTotalPages(d.totalPages ?? 1);
      }
    } catch (e: any) { console.error(e); } finally { setMovLoading(false); }
  }, []);

  const openHistory = (acc: any) => {
    setSelectedAccount(acc);
    setMovPage(1);
    fetchMovements(acc.id, 1);
    setTab('historico');
  };

  useEffect(() => {
    if (selectedAccount) fetchMovements(selectedAccount.id, movPage);
  }, [movPage, selectedAccount, fetchMovements]);

  // CRUD
  const openNew = () => { setEditing(null); setForm({ name: '', type: 'dinheiro', initialBalance: '0', notes: '' }); setDialogOpen(true); };
  const openEdit = (acc: any) => { setEditing(acc); setForm({ name: acc.name ?? '', type: acc.type ?? 'dinheiro', initialBalance: String(acc.initialBalance ?? 0), notes: acc.notes ?? '' }); setDialogOpen(true); };
  const handleSave = async () => {
    if (!form?.name) { toast.error('Nome é obrigatório'); return; }
    try {
      const url = editing ? `/api/caixas/${editing.id}` : '/api/caixas';
      const method = editing ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      if (res.ok) { toast.success(editing ? 'Caixa atualizado!' : 'Caixa criado!'); setDialogOpen(false); fetchAccounts(); }
      else { const d = await res.json(); toast.error(d?.error ?? 'Erro'); }
    } catch { toast.error('Erro ao salvar'); }
  };
  const toggleStatus = async (acc: any) => {
    try {
      const res = await fetch(`/api/caixas/${acc.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isActive: !acc.isActive }) });
      if (res.ok) { toast.success('Status atualizado'); fetchAccounts(); }
    } catch { toast.error('Erro'); }
  };

  // Transfer
  const handleTransfer = async () => {
    if (!transferForm.fromAccountId || !transferForm.toAccountId || !transferForm.amount) {
      toast.error('Preencha origem, destino e valor'); return;
    }
    setTransferring(true);
    try {
      const res = await fetch('/api/caixas/transferencias', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(transferForm),
      });
      if (res.ok) {
        toast.success('Transferência realizada!');
        setTransferOpen(false);
        setTransferForm({ fromAccountId: '', toAccountId: '', amount: '', notes: '' });
        fetchAccounts();
        if (selectedAccount) fetchMovements(selectedAccount.id, movPage);
      } else { const d = await res.json(); toast.error(d?.error ?? 'Erro na transferência'); }
    } catch { toast.error('Erro na transferência'); }
    setTransferring(false);
  };

  // Manual movement
  const handleManualMov = async () => {
    if (!movForm.description || !movForm.amount) { toast.error('Preencha descrição e valor'); return; }
    if (!movForm.accountPlanId) { toast.error('Selecione um Plano de Contas para classificar esta movimentação'); return; }
    if (!selectedAccount) return;
    setMovSaving(true);
    try {
      const res = await fetch(`/api/caixas/${selectedAccount.id}/movimentacoes`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(movForm),
      });
      if (res.ok) {
        toast.success('Movimentação registrada!');
        setMovOpen(false);
        setMovForm({ type: 'entrada', amount: '', description: '', notes: '', accountPlanId: '' });
        fetchAccounts();
        fetchMovements(selectedAccount.id, 1);
        setMovPage(1);
      } else { const d = await res.json(); toast.error(d?.error ?? 'Erro'); }
    } catch { toast.error('Erro ao registrar'); }
    setMovSaving(false);
  };

  // Movement CRUD handlers
  const openEditMov = (m: any) => {
    setEditMovId(m.id);
    setEditMovForm({ description: m.description ?? '', notes: m.notes ?? '' });
    setEditMovOpen(true);
  };

  const handleEditMov = async () => {
    if (!editMovId) return;
    setEditMovSaving(true);
    try {
      const res = await fetch(`/api/caixas/movimentacoes/${editMovId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editMovForm),
      });
      if (res.ok) {
        toast.success('Movimentação atualizada!');
        setEditMovOpen(false);
        if (selectedAccount) fetchMovements(selectedAccount.id, movPage);
      } else {
        const d = await res.json();
        toast.error(d?.error ?? 'Erro ao editar');
      }
    } catch { toast.error('Erro ao editar'); }
    finally { setEditMovSaving(false); }
  };

  const handleDeleteMov = async () => {
    if (!deleteMovId) return;
    setDeleteMovDeleting(true);
    try {
      const res = await fetch(`/api/caixas/movimentacoes/${deleteMovId}`, { method: 'DELETE' });
      if (res.ok) {
        const d = await res.json();
        toast.success('Movimentação excluída! Saldo revertido.');
        setDeleteMovOpen(false);
        setDeleteMovId(null);
        // Update account balance locally
        if (selectedAccount && d.newBalance !== undefined) {
          setSelectedAccount((prev: any) => prev ? { ...prev, currentBalance: d.newBalance } : prev);
          setAccounts((prev: any[]) => prev.map(a => a.id === selectedAccount.id ? { ...a, currentBalance: d.newBalance } : a));
        }
        if (selectedAccount) fetchMovements(selectedAccount.id, movPage);
      } else {
        const dd = await res.json();
        toast.error(dd?.error ?? 'Erro ao excluir');
      }
    } catch { toast.error('Erro ao excluir'); }
    finally { setDeleteMovDeleting(false); }
  };

  // Transfer edit handlers
  const openEditTransfer = (m: any) => {
    // m is the movement (either transferencia_saida or transferencia_entrada)
    const isExit = m.type === 'transferencia_saida';
    setEditTransferMov(m);
    setEditTransferForm({
      amount: String(m.amount ?? ''),
      fromAccountId: isExit ? m.cashAccountId : '',
      toAccountId: !isExit ? m.cashAccountId : '',
      notes: m.notes ?? '',
    });
    setEditTransferOpen(true);
  };

  const handleEditTransfer = async () => {
    if (!editTransferMov?.id) return;
    setEditTransferSaving(true);
    try {
      const res = await fetch(`/api/caixas/transferencias/${editTransferMov.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editTransferForm),
      });
      if (res.ok) {
        toast.success('Transferência editada com sucesso!');
        setEditTransferOpen(false);
        fetchAccounts();
        if (selectedAccount) fetchMovements(selectedAccount.id, movPage);
      } else {
        const d = await res.json();
        toast.error(d?.error ?? 'Erro ao editar transferência');
      }
    } catch { toast.error('Erro ao editar transferência'); }
    finally { setEditTransferSaving(false); }
  };

  // Transfer estorno handler
  const handleEstornoTransfer = async () => {
    if (!estornoTransferMov?.id) return;
    setEstornoTransferSaving(true);
    try {
      const res = await fetch(`/api/caixas/transferencias?movementId=${estornoTransferMov.id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Transferência estornada com sucesso!');
        setEstornoTransferOpen(false);
        fetchAccounts();
        if (selectedAccount) fetchMovements(selectedAccount.id, movPage);
      } else {
        const d = await res.json();
        toast.error(d?.error ?? 'Erro ao estornar transferência');
      }
    } catch { toast.error('Erro ao estornar transferência'); }
    finally { setEstornoTransferSaving(false); }
  };

  // Ajuste de caixa handler
  const handleAjuste = async () => {
    const accId = ajusteForm.cashAccountId;
    if (!accId || !ajusteForm.actualBalance) { toast.error('Selecione o caixa e informe o saldo real'); return; }
    const acc = accounts.find((a: any) => a.id === accId);
    if (!acc) return;
    const actual = parseFloat(ajusteForm.actualBalance);
    const diff = actual - acc.currentBalance;
    if (diff === 0) { toast.info('Nenhuma diferença encontrada. Saldo confere.'); return; }
    setAjusteSaving(true);
    try {
      const res = await fetch(`/api/caixas/${accId}/movimentacoes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: diff > 0 ? 'entrada' : 'saida',
          amount: String(Math.abs(diff)),
          description: `Ajuste de caixa (${ajusteForm.adjustmentType === 'diferenca' ? 'Diferença encontrada' : ajusteForm.adjustmentType === 'sangria' ? 'Sangria' : ajusteForm.adjustmentType === 'reforco' ? 'Reforço' : 'Outro'}): esperado ${fmt(acc.currentBalance)}, real ${fmt(actual)}`,
          notes: ajusteForm.reason || null,
          origin: 'ajuste_caixa',
          ...(ajusteForm.accountPlanId ? { accountPlanId: ajusteForm.accountPlanId } : {}),
        }),
      });
      if (res.ok) {
        toast.success(`Ajuste registrado: ${diff > 0 ? '+' : ''}${fmt(diff)}`);
        setAjusteOpen(false);
        fetchAccounts();
        if (selectedAccount?.id === accId) fetchMovements(accId, 1);
      } else {
        const d = await res.json();
        toast.error(d?.error ?? 'Erro no ajuste');
      }
    } catch { toast.error('Erro no ajuste'); }
    finally { setAjusteSaving(false); }
  };

  // Reconciliação handlers
  const handleReconCheck = async () => {
    setReconLoading(true);
    try {
      const res = await fetch('/api/caixas/reconciliacao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fix: false }),
      });
      if (res.ok) {
        setReconResults(await res.json());
      } else {
        const d = await res.json();
        toast.error(d?.error ?? 'Erro na verificação');
      }
    } catch { toast.error('Erro na verificação'); }
    finally { setReconLoading(false); }
  };

  const handleReconFix = async () => {
    setReconFixing(true);
    try {
      const res = await fetch('/api/caixas/reconciliacao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fix: true }),
      });
      if (res.ok) {
        const data = await res.json();
        setReconResults(data);
        toast.success(`${data.fixedCount} caixa(s) corrigido(s)!`);
        fetchAccounts();
      } else {
        const d = await res.json();
        toast.error(d?.error ?? 'Erro ao corrigir');
      }
    } catch { toast.error('Erro ao corrigir'); }
    finally { setReconFixing(false); }
  };

  const activeAccounts = accounts.filter(a => a.isActive);

  // Auto-select first account when switching to history tab with no selection
  useEffect(() => {
    if (tab === 'historico' && !selectedAccount && activeAccounts.length > 0) {
      setSelectedAccount(activeAccounts[0]);
      setMovPage(1);
    }
  }, [tab, selectedAccount, activeAccounts]);

  return (
    <div>
      <AppHeader title="Caixas" />
      <div className="p-4 lg:p-6 space-y-5">
        <Tabs value={tab} onValueChange={setTab}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <TabsList>
              <TabsTrigger value="visao"><Wallet className="w-4 h-4 mr-1.5" />Visão Geral</TabsTrigger>
              <TabsTrigger value="historico"><History className="w-4 h-4 mr-1.5" />Histórico</TabsTrigger>
              <TabsTrigger value="fechamento"><LockKeyhole className="w-4 h-4 mr-1.5" />Fechamento</TabsTrigger>
            </TabsList>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => { setAjusteForm({ cashAccountId: activeAccounts[0]?.id ?? '', actualBalance: '', adjustmentType: 'diferenca', reason: '', accountPlanId: '' }); setAjusteOpen(true); }}>
                <Scale className="w-4 h-4 mr-1.5" />Ajuste de Caixa
              </Button>
              <Button variant="outline" size="sm" onClick={() => { setReconResults(null); setReconOpen(true); }}>
                <ShieldCheck className="w-4 h-4 mr-1.5" />Reconciliar
              </Button>
              <Button variant="outline" size="sm" onClick={() => { setTransferForm({ fromAccountId: activeAccounts[0]?.id ?? '', toAccountId: activeAccounts[1]?.id ?? '', amount: '', notes: '' }); setTransferOpen(true); }}>
                <ArrowRightLeft className="w-4 h-4 mr-1.5" />Transferir
              </Button>
              <Button size="sm" onClick={openNew}><Plus className="w-4 h-4 mr-1.5" />Novo Caixa</Button>
            </div>
          </div>

          {/* ============ VISÃO GERAL ============ */}
          <TabsContent value="visao" className="space-y-5 mt-4">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Card className="border-0 shadow-sm bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/30 dark:to-emerald-900/20 col-span-2 lg:col-span-1">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-emerald-600 flex items-center justify-center shadow-sm"><Wallet className="w-5 h-5 text-white" /></div>
                    <div>
                      <p className="text-xs text-muted-foreground">Saldo Total</p>
                      <p className="text-xl font-bold num-highlight text-emerald-700 dark:text-emerald-400">{fmt(totalBalance)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              {activeAccounts.slice(0, 3).map(acc => {
                const Icon = typeIcons[acc.type] ?? Wallet;
                return (
                  <Card key={acc.id} className="border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow" onClick={() => openHistory(acc)}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${typeColors[acc.type]?.split(' ')[0] ?? 'bg-gray-100'}`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs text-muted-foreground truncate">{acc.name}</p>
                          <p className="text-lg font-bold num-highlight">{fmt(acc.currentBalance ?? 0)}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Subcaixas Grid */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">Todos os Caixas ({accounts.length})</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {accounts.map(acc => {
                  const Icon = typeIcons[acc.type] ?? Wallet;
                  return (
                    <Card key={acc.id} className={`border-0 shadow-sm transition-all ${!acc.isActive ? 'opacity-50' : 'hover:shadow-md'}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${typeColors[acc.type]?.split(' ')[0] ?? 'bg-gray-100'}`}>
                              <Icon className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="font-semibold text-sm">{acc.name}</p>
                              <Badge className={`text-[10px] mt-0.5 ${typeColors[acc.type] ?? ''}`}>{typeLabels[acc.type] ?? acc.type}</Badge>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(acc)}><Pencil className="w-3 h-3" /></Button>
                            <Switch checked={acc.isActive ?? false} onCheckedChange={() => toggleStatus(acc)} />
                          </div>
                        </div>
                        <div className="mt-3 pt-3 border-t flex justify-between items-end">
                          <div>
                            <p className="text-xs text-muted-foreground">Saldo Atual</p>
                            <p className={`text-lg font-bold num-highlight ${(acc.currentBalance ?? 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmt(acc.currentBalance ?? 0)}</p>
                          </div>
                          <Button variant="ghost" size="sm" className="text-xs" onClick={() => openHistory(acc)}>
                            <Eye className="w-3.5 h-3.5 mr-1" />Histórico
                          </Button>
                        </div>
                        {acc.notes && <p className="text-xs text-muted-foreground mt-2 truncate">{acc.notes}</p>}
                        {(acc.paymentMethods?.length ?? 0) > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {acc.paymentMethods.map((pm: any) => <Badge key={pm.id} variant="outline" className="text-[10px]">{pm.name}</Badge>)}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          </TabsContent>

          {/* ============ HISTÓRICO ============ */}
          <TabsContent value="historico" className="space-y-4 mt-4">
            {/* Account Selector */}
            <div className="flex flex-wrap gap-2">
              {activeAccounts.map(acc => {
                const Icon = typeIcons[acc.type] ?? Wallet;
                const isSelected = selectedAccount?.id === acc.id;
                return (
                  <Button key={acc.id} variant={isSelected ? 'default' : 'outline'} size="sm" onClick={() => { setSelectedAccount(acc); setMovPage(1); }}>
                    <Icon className="w-4 h-4 mr-1.5" />{acc.name}
                    <span className="ml-1.5 num-highlight text-xs">{fmt(acc.currentBalance ?? 0)}</span>
                  </Button>
                );
              })}
            </div>

            {!selectedAccount ? (
              <Card className="border-0 shadow-sm">
                <CardContent className="py-16 text-center text-muted-foreground">
                  <History className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p>Selecione um caixa para ver o histórico</p>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Selected Account Header */}
                <Card className="border-0 shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {(() => { const Icon = typeIcons[selectedAccount.type] ?? Wallet; return <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${typeColors[selectedAccount.type]?.split(' ')[0] ?? 'bg-gray-100'}`}><Icon className="w-5 h-5" /></div>; })()}
                        <div>
                          <h3 className="font-semibold">{selectedAccount.name}</h3>
                          <p className={`text-lg font-bold num-highlight ${(selectedAccount.currentBalance ?? 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmt(selectedAccount.currentBalance ?? 0)}</p>
                        </div>
                      </div>
                      <Button size="sm" onClick={() => { setMovForm({ type: 'entrada', amount: '', description: '', notes: '', accountPlanId: '' }); setMovOpen(true); }}>
                        <Plus className="w-4 h-4 mr-1.5" />Lançamento
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Movements Table */}
                <Card className="border-0 shadow-sm">
                  <CardContent className="p-0">
                    {movLoading ? (
                      <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
                    ) : movements.length === 0 ? (
                      <div className="py-12 text-center text-muted-foreground">
                        <History className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">Nenhuma movimentação registrada</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[140px]">Data / Hora</TableHead>
                              <TableHead>Tipo</TableHead>
                              <TableHead>Origem</TableHead>
                              <TableHead>Descrição</TableHead>
                              <TableHead className="text-center">Responsável</TableHead>
                              <TableHead className="text-right">Valor</TableHead>
                              <TableHead className="text-right">Saldo Antes</TableHead>
                              <TableHead className="text-right">Saldo Depois</TableHead>
                              <TableHead className="text-right w-[50px]">Ações</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {movements.map((m: any) => (
                              <TableRow key={m.id}>
                                <TableCell className="text-xs whitespace-nowrap">
                                  <div className="flex items-center gap-1.5"><Clock className="w-3 h-3 text-muted-foreground" />{fmtDate(m.createdAt)}</div>
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className={`text-[10px] ${movTypeColors[m.type] ?? ''}`}>
                                    {m.type?.includes('entrada') ? <ArrowDownCircle className="w-3 h-3 mr-1" /> : <ArrowUpCircle className="w-3 h-3 mr-1" />}
                                    {movTypeLabels[m.type] ?? m.type}
                                  </Badge>
                                </TableCell>
                                <TableCell><span className="text-xs text-muted-foreground">{originLabels[m.origin] ?? m.origin}</span></TableCell>
                                <TableCell>
                                  <p className="text-sm font-medium">{m.description}</p>
                                  {m.reference && <p className="text-xs text-muted-foreground">{m.reference}</p>}
                                  {m.notes && <p className="text-xs text-muted-foreground italic">{m.notes}</p>}
                                </TableCell>
                                <TableCell className="text-center">
                                  <div className="flex items-center justify-center gap-1 text-xs"><User className="w-3 h-3" />{m.userName ?? '-'}</div>
                                </TableCell>
                                <TableCell className={`text-right font-bold num-highlight ${m.type?.includes('entrada') ? 'text-emerald-600' : 'text-red-600'}`}>
                                  {m.type?.includes('entrada') ? '+' : '-'}{fmt(m.amount)}
                                </TableCell>
                                <TableCell className="text-right num-highlight text-xs">{fmt(m.balanceBefore)}</TableCell>
                                <TableCell className="text-right num-highlight text-xs font-semibold">{fmt(m.balanceAfter)}</TableCell>
                                <TableCell className="text-right">
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0"><MoreHorizontal className="w-4 h-4" /></Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem onClick={() => { setDetailMov(m); setDetailMovOpen(true); }}><Eye className="w-3.5 h-3.5 mr-2" />Detalhes</DropdownMenuItem>
                                      {(m.origin === 'ajuste_manual' || m.origin === 'ajuste_caixa') && (
                                        <>
                                          <DropdownMenuItem onClick={() => openEditMov(m)}><Pencil className="w-3.5 h-3.5 mr-2" />Editar</DropdownMenuItem>
                                          <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={() => { setDeleteMovId(m.id); setDeleteMovOpen(true); }}><Trash2 className="w-3.5 h-3.5 mr-2" />Excluir</DropdownMenuItem>
                                        </>
                                      )}
                                      {m.origin === 'transferencia' && (
                                        <>
                                          <DropdownMenuItem onClick={() => openEditTransfer(m)}><Pencil className="w-3.5 h-3.5 mr-2" />Editar Transferência</DropdownMenuItem>
                                          <DropdownMenuItem className="text-orange-600 focus:text-orange-600" onClick={() => { setEstornoTransferMov(m); setEstornoTransferOpen(true); }}><RotateCcw className="w-3.5 h-3.5 mr-2" />Estornar Transferência</DropdownMenuItem>
                                        </>
                                      )}
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Pagination */}
                {movTotalPages > 1 && (
                  <div className="flex items-center justify-center gap-2">
                    <Button variant="outline" size="sm" disabled={movPage <= 1} onClick={() => setMovPage(p => p - 1)}><ChevronLeft className="w-4 h-4" /></Button>
                    <span className="text-sm text-muted-foreground">Página {movPage} de {movTotalPages}</span>
                    <Button variant="outline" size="sm" disabled={movPage >= movTotalPages} onClick={() => setMovPage(p => p + 1)}><ChevronRight className="w-4 h-4" /></Button>
                  </div>
                )}
              </>
            )}
          </TabsContent>

          {/* ============ FECHAMENTO DE CAIXA ============ */}
          <TabsContent value="fechamento" className="space-y-4 mt-4">
            {/* Open Session Indicator */}
            {openSession ? (
              <Card className="border-0 shadow-sm bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/30 dark:to-emerald-900/20">
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl bg-emerald-600 flex items-center justify-center shadow-sm animate-pulse">
                        <UnlockKeyhole className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="font-semibold text-emerald-800 dark:text-emerald-300">Caixa Aberto</p>
                        <p className="text-xs text-muted-foreground">
                          {openSession.cashAccount?.name ?? 'Caixa'} • Aberto por {openSession.openedByName ?? '-'} em {fmtDate(openSession.openedAt)}
                        </p>
                        <p className="text-sm font-bold num-highlight text-emerald-700 dark:text-emerald-400 mt-0.5">
                          Saldo Abertura: {fmt(openSession.openingBalance)}
                        </p>
                      </div>
                    </div>
                    <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white" onClick={() => { setClosingForm({ informedBalance: '', notes: '' }); setCloseCashDialog(true); }}>
                      <LockKeyhole className="w-4 h-4 mr-1.5" />Fechar Caixa
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl bg-gray-200 dark:bg-gray-800 flex items-center justify-center">
                        <LockKeyhole className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-semibold">Nenhum caixa aberto</p>
                        <p className="text-xs text-muted-foreground">Abra um caixa para iniciar as operações do dia</p>
                      </div>
                    </div>
                    <Button size="sm" data-onboarding="open-cash" onClick={() => { setOpeningForm({ cashAccountId: activeAccounts[0]?.id ?? '', openingBalance: '0', notes: '' }); setOpenCashDialog(true); }}>
                      <UnlockKeyhole className="w-4 h-4 mr-1.5" />Abrir Caixa
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Sessions List */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <FileText className="w-4 h-4" />Histórico de Sessões
                  <Badge variant="outline" className="ml-auto">{cashSessions.length} sessões</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {sessionsLoading ? (
                  <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
                ) : cashSessions.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground">
                    <CalendarDays className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">Nenhuma sessão registrada ainda</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Status</TableHead>
                          <TableHead>Caixa</TableHead>
                          <TableHead>Operador</TableHead>
                          <TableHead>Abertura</TableHead>
                          <TableHead>Fechamento</TableHead>
                          <TableHead className="text-right">Saldo Abertura</TableHead>
                          <TableHead className="text-right">Saldo Fechamento</TableHead>
                          <TableHead className="text-center">Diferença</TableHead>
                          <TableHead className="text-center">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {cashSessions.map((s: any) => {
                          const diff = s.difference ?? 0;
                          return (
                            <TableRow key={s.id} className={s.status === 'aberto' ? 'bg-emerald-50/50 dark:bg-emerald-950/10' : ''}>
                              <TableCell>
                                <Badge className={`text-xs ${s.status === 'aberto' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'}`}>
                                  {s.status === 'aberto' ? <UnlockKeyhole className="w-3 h-3 mr-1" /> : <LockKeyhole className="w-3 h-3 mr-1" />}
                                  {s.status === 'aberto' ? 'Aberto' : 'Fechado'}
                                </Badge>
                              </TableCell>
                              <TableCell className="font-medium text-sm">{s.cashAccount?.name ?? '-'}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1 text-xs"><User className="w-3 h-3" />{s.openedByName ?? '-'}</div>
                              </TableCell>
                              <TableCell className="text-xs whitespace-nowrap">{fmtDate(s.openedAt)}</TableCell>
                              <TableCell className="text-xs whitespace-nowrap">{s.closedAt ? fmtDate(s.closedAt) : '-'}</TableCell>
                              <TableCell className="text-right num-highlight text-sm">{fmt(s.openingBalance)}</TableCell>
                              <TableCell className="text-right num-highlight text-sm">{s.closingBalance != null ? fmt(s.closingBalance) : '-'}</TableCell>
                              <TableCell className="text-center">
                                {s.status === 'fechado' ? (
                                  <Badge className={`text-xs ${diff === 0 ? 'bg-emerald-100 text-emerald-700' : diff > 0 ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>
                                    {diff === 0 ? <CheckCircle className="w-3 h-3 mr-1" /> : <AlertCircle className="w-3 h-3 mr-1" />}
                                    {diff === 0 ? 'Confere' : fmt(diff)}
                                  </Badge>
                                ) : <span className="text-xs text-muted-foreground">-</span>}
                              </TableCell>
                              <TableCell className="text-center">
                                {s.status === 'fechado' && (
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setSessionDetail(s); setDetailDialog(true); }}>
                                    <Eye className="w-4 h-4" />
                                  </Button>
                                )}
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

      {/* Open Cash Session Dialog */}
      <Dialog open={openCashDialog} onOpenChange={setOpenCashDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2"><UnlockKeyhole className="w-5 h-5 text-emerald-600" />Abrir Caixa</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Caixa / Conta *</Label>
              <select className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm" value={openingForm.cashAccountId} onChange={(e: any) => setOpeningForm({ ...openingForm, cashAccountId: e.target.value })}>
                <option value="">Selecione...</option>
                {activeAccounts.map(a => <option key={a.id} value={a.id}>{a.name} ({fmt(a.currentBalance)})</option>)}
              </select>
            </div>
            <div>
              <Label>Saldo de Abertura (R$)</Label>
              <CurrencyInput value={parseFloat(openingForm.openingBalance) || 0} onChange={(v: number) => setOpeningForm({ ...openingForm, openingBalance: String(v) })} />
              <p className="text-xs text-muted-foreground mt-1">Informe o valor que está fisicamente no caixa</p>
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea value={openingForm.notes} onChange={(e: any) => setOpeningForm({ ...openingForm, notes: e.target.value })} rows={2} placeholder="Observações opcionais..." />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpenCashDialog(false)}>Cancelar</Button>
              <Button onClick={handleOpenSession} disabled={sessionSaving}>
                {sessionSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UnlockKeyhole className="w-4 h-4 mr-2" />}Abrir Caixa
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Close Cash Session Dialog */}
      <Dialog open={closeCashDialog} onOpenChange={setCloseCashDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2"><LockKeyhole className="w-5 h-5 text-red-600" />Fechar Caixa</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Card className="border-0 bg-amber-50 dark:bg-amber-950/20">
              <CardContent className="p-3 text-sm">
                <p className="font-semibold text-amber-800 dark:text-amber-300">⚠️ Atenção</p>
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                  O sistema vai calcular automaticamente o saldo esperado com base em todas as vendas e movimentações da sessão.
                  Informe o valor que está fisicamente no caixa para conferência.
                </p>
              </CardContent>
            </Card>
            <div>
              <Label>Valor Informado em Caixa (R$) *</Label>
              <CurrencyInput value={parseFloat(closingForm.informedBalance) || 0} onChange={(v: number) => setClosingForm({ ...closingForm, informedBalance: String(v) })} />
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea value={closingForm.notes} onChange={(e: any) => setClosingForm({ ...closingForm, notes: e.target.value })} rows={2} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCloseCashDialog(false)}>Cancelar</Button>
              <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={handleCloseSession} disabled={sessionSaving}>
                {sessionSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <LockKeyhole className="w-4 h-4 mr-2" />}Fechar Caixa
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Session Detail Dialog */}
      <Dialog open={detailDialog} onOpenChange={setDetailDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2"><Calculator className="w-5 h-5" />Detalhes da Sessão</DialogTitle>
          </DialogHeader>
          {sessionDetail && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted/50 p-3 rounded-lg">
                  <p className="text-xs text-muted-foreground">Caixa</p>
                  <p className="font-semibold text-sm">{sessionDetail.cashAccount?.name ?? '-'}</p>
                </div>
                <div className="bg-muted/50 p-3 rounded-lg">
                  <p className="text-xs text-muted-foreground">Operador</p>
                  <p className="font-semibold text-sm">{sessionDetail.openedByName ?? '-'}</p>
                </div>
                <div className="bg-muted/50 p-3 rounded-lg">
                  <p className="text-xs text-muted-foreground">Abertura</p>
                  <p className="font-semibold text-sm">{fmtDate(sessionDetail.openedAt)}</p>
                </div>
                <div className="bg-muted/50 p-3 rounded-lg">
                  <p className="text-xs text-muted-foreground">Fechamento</p>
                  <p className="font-semibold text-sm">{sessionDetail.closedAt ? fmtDate(sessionDetail.closedAt) : '-'}</p>
                </div>
              </div>

              <div className="border-t pt-3">
                <p className="text-xs font-semibold text-muted-foreground mb-2">RESUMO FINANCEIRO</p>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Saldo Abertura</span><span className="num-highlight font-semibold">{fmt(sessionDetail.openingBalance)}</span></div>
                  <div className="flex justify-between text-emerald-600"><span>+ Total Vendas</span><span className="num-highlight font-semibold">{fmt(sessionDetail.totalSales)}</span></div>
                  <div className="flex justify-between text-emerald-600"><span>+ Entradas</span><span className="num-highlight font-semibold">{fmt(sessionDetail.totalEntries)}</span></div>
                  <div className="flex justify-between text-emerald-600"><span>+ Reforços</span><span className="num-highlight font-semibold">{fmt(sessionDetail.totalReforcos)}</span></div>
                  <div className="flex justify-between text-red-600"><span>− Saídas</span><span className="num-highlight font-semibold">{fmt(sessionDetail.totalExits)}</span></div>
                  <div className="flex justify-between text-red-600"><span>− Sangrias</span><span className="num-highlight font-semibold">{fmt(sessionDetail.totalSangrias)}</span></div>
                </div>
              </div>

              <div className="border-t pt-3">
                <p className="text-xs font-semibold text-muted-foreground mb-2">VENDAS POR FORMA DE PAGAMENTO</p>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-emerald-50 dark:bg-emerald-950/20 p-2 rounded-lg text-center">
                    <Banknote className="w-4 h-4 mx-auto text-emerald-600 mb-0.5" />
                    <p className="text-[10px] text-muted-foreground">Dinheiro</p>
                    <p className="num-highlight font-bold text-sm">{fmt(sessionDetail.totalCash)}</p>
                  </div>
                  <div className="bg-teal-50 dark:bg-teal-950/20 p-2 rounded-lg text-center">
                    <QrCode className="w-4 h-4 mx-auto text-teal-600 mb-0.5" />
                    <p className="text-[10px] text-muted-foreground">PIX</p>
                    <p className="num-highlight font-bold text-sm">{fmt(sessionDetail.totalPix)}</p>
                  </div>
                  <div className="bg-violet-50 dark:bg-violet-950/20 p-2 rounded-lg text-center">
                    <CreditCard className="w-4 h-4 mx-auto text-violet-600 mb-0.5" />
                    <p className="text-[10px] text-muted-foreground">Cartão</p>
                    <p className="num-highlight font-bold text-sm">{fmt(sessionDetail.totalCard)}</p>
                  </div>
                </div>
              </div>

              <div className="border-t pt-3">
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-blue-50 dark:bg-blue-950/20 p-3 rounded-lg text-center">
                    <p className="text-[10px] text-muted-foreground">Esperado</p>
                    <p className="num-highlight font-bold text-lg text-blue-700 dark:text-blue-400">{fmt(sessionDetail.expectedBalance)}</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg text-center">
                    <p className="text-[10px] text-muted-foreground">Informado</p>
                    <p className="num-highlight font-bold text-lg">{fmt(sessionDetail.informedBalance)}</p>
                  </div>
                  <div className={`p-3 rounded-lg text-center ${(sessionDetail.difference ?? 0) === 0 ? 'bg-emerald-50 dark:bg-emerald-950/20' : 'bg-red-50 dark:bg-red-950/20'}`}>
                    <p className="text-[10px] text-muted-foreground">Diferença</p>
                    <p className={`num-highlight font-bold text-lg ${(sessionDetail.difference ?? 0) === 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
                      {(sessionDetail.difference ?? 0) === 0 ? '✓ OK' : fmt(sessionDetail.difference)}
                    </p>
                  </div>
                </div>
              </div>

              {sessionDetail.notes && (
                <div className="border-t pt-3">
                  <p className="text-xs text-muted-foreground">Observações: {sessionDetail.notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">{editing ? 'Editar Caixa' : 'Novo Caixa / Conta'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nome *</Label><Input value={form?.name ?? ''} onChange={(e: any) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Caixa Dinheiro, Banco Inter..." /></div>
            <div><Label>Tipo</Label>
              <select className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm" value={form?.type ?? 'dinheiro'} onChange={(e: any) => setForm({ ...form, type: e.target.value })}>
                {Object.entries(typeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            {!editing && <div><Label>Saldo Inicial (R$)</Label><CurrencyInput value={parseFloat(form?.initialBalance) || 0} onChange={(v: number) => setForm({ ...form, initialBalance: String(v) })} /></div>}
            <div><Label>Observações</Label><Textarea value={form?.notes ?? ''} onChange={(e: any) => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave}>{editing ? 'Salvar' : 'Criar Caixa'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Transfer Dialog */}
      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display flex items-center gap-2"><ArrowRightLeft className="w-5 h-5" />Transferência entre Caixas</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Caixa Origem *</Label>
              <select className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm" value={transferForm.fromAccountId} onChange={(e: any) => setTransferForm({ ...transferForm, fromAccountId: e.target.value })}>
                <option value="">Selecione...</option>
                {activeAccounts.map(a => <option key={a.id} value={a.id}>{a.name} ({fmt(a.currentBalance)})</option>)}
              </select>
            </div>
            <div className="flex justify-center"><ArrowRightLeft className="w-5 h-5 text-muted-foreground rotate-90" /></div>
            <div>
              <Label>Caixa Destino *</Label>
              <select className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm" value={transferForm.toAccountId} onChange={(e: any) => setTransferForm({ ...transferForm, toAccountId: e.target.value })}>
                <option value="">Selecione...</option>
                {activeAccounts.filter(a => a.id !== transferForm.fromAccountId).map(a => <option key={a.id} value={a.id}>{a.name} ({fmt(a.currentBalance)})</option>)}
              </select>
            </div>
            <div><Label>Valor (R$) *</Label><CurrencyInput value={parseFloat(transferForm.amount) || 0} onChange={(v) => setTransferForm({ ...transferForm, amount: String(v) })} /></div>
            <div><Label>Observações</Label><Textarea value={transferForm.notes} onChange={(e: any) => setTransferForm({ ...transferForm, notes: e.target.value })} rows={2} placeholder="Ex: Depósito bancário" /></div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setTransferOpen(false)}>Cancelar</Button>
              <Button onClick={handleTransfer} disabled={transferring}>
                {transferring ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Transferindo...</> : <><ArrowRightLeft className="w-4 h-4 mr-2" />Transferir</>}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Manual Movement Dialog */}
      <Dialog open={movOpen} onOpenChange={setMovOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">Lançamento em {selectedAccount?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Tipo *</Label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <Button variant={movForm.type === 'entrada' ? 'default' : 'outline'} className={movForm.type === 'entrada' ? 'bg-emerald-600 hover:bg-emerald-700' : ''} onClick={() => setMovForm({ ...movForm, type: 'entrada', accountPlanId: '' })}>
                  <ArrowDownCircle className="w-4 h-4 mr-1.5" />Entrada
                </Button>
                <Button variant={movForm.type === 'saida' ? 'default' : 'outline'} className={movForm.type === 'saida' ? 'bg-red-600 hover:bg-red-700' : ''} onClick={() => setMovForm({ ...movForm, type: 'saida', accountPlanId: '' })}>
                  <ArrowUpCircle className="w-4 h-4 mr-1.5" />Saída
                </Button>
              </div>
            </div>
            <div><Label>Valor (R$) *</Label><CurrencyInput value={parseFloat(movForm.amount) || 0} onChange={(v) => setMovForm({ ...movForm, amount: String(v) })} /></div>
            <div><Label>Descrição *</Label><Input value={movForm.description} onChange={(e: any) => setMovForm({ ...movForm, description: e.target.value })} placeholder="Ex: Sangria caixa, Troco inicial..." /></div>
            <div>
              <Label>Plano de Contas *</Label>
              <Select value={movForm.accountPlanId} onValueChange={(v) => setMovForm({ ...movForm, accountPlanId: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione a classificação..." /></SelectTrigger>
                <SelectContent>
                  {accountPlans
                    .filter((ap: any) => {
                      if (movForm.type === 'entrada') return ap.type === 'receita';
                      return ap.type === 'despesa' || ap.type === 'custo' || ap.type === 'financeiro' || ap.type === 'imposto';
                    })
                    .sort((a: any, b: any) => a.code.localeCompare(b.code))
                    .map((ap: any) => (
                      <SelectItem key={ap.id} value={ap.id}>{ap.code} - {ap.name}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <AccountPlanSuggestion
                description={movForm.description}
                direction={movForm.type === 'entrada' ? 'entrada' : 'saida'}
                currentAccountPlanId={movForm.accountPlanId}
                onApply={(id) => setMovForm({ ...movForm, accountPlanId: id })}
              />
              <p className="text-xs text-muted-foreground mt-1">Classificação contábil obrigatória para fluxo de caixa e DRE.</p>
            </div>
            <div><Label>Observações</Label><Textarea value={movForm.notes} onChange={(e: any) => setMovForm({ ...movForm, notes: e.target.value })} rows={2} /></div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setMovOpen(false)}>Cancelar</Button>
              <Button onClick={handleManualMov} disabled={movSaving}>
                {movSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}Registrar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ===== EDIT MOVEMENT DIALOG ===== */}
      <Dialog open={editMovOpen} onOpenChange={setEditMovOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Pencil className="w-5 h-5" /> Editar Movimentação</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Descrição</Label><Input value={editMovForm.description} onChange={(e: any) => setEditMovForm({ ...editMovForm, description: e.target.value })} /></div>
            <div><Label>Observações</Label><Textarea value={editMovForm.notes} onChange={(e: any) => setEditMovForm({ ...editMovForm, notes: e.target.value })} rows={2} /></div>
            <p className="text-xs text-muted-foreground">O valor e tipo não podem ser alterados. Para correção de valor, exclua e registre novamente.</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditMovOpen(false)}>Cancelar</Button>
              <Button onClick={handleEditMov} disabled={editMovSaving}>{editMovSaving ? 'Salvando...' : 'Salvar'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ===== DELETE MOVEMENT DIALOG ===== */}
      <AlertDialog open={deleteMovOpen} onOpenChange={setDeleteMovOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Movimentação</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza? O saldo do caixa será revertido automaticamente. Esta ação será registrada no log de auditoria.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteMov} disabled={deleteMovDeleting} className="bg-red-600 hover:bg-red-700">{deleteMovDeleting ? 'Excluindo...' : 'Excluir e Reverter Saldo'}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ===== MOVEMENT DETAIL DIALOG ===== */}
      <Dialog open={detailMovOpen} onOpenChange={setDetailMovOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Eye className="w-5 h-5" /> Detalhes da Movimentação</DialogTitle>
          </DialogHeader>
          {detailMov && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-[10px] text-muted-foreground">Descrição</p>
                  <p className="text-sm font-medium">{detailMov.description}</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-[10px] text-muted-foreground">Valor</p>
                  <p className={`text-sm font-bold font-mono ${detailMov.type?.includes('entrada') ? 'text-emerald-600' : 'text-red-600'}`}>
                    {detailMov.type?.includes('entrada') ? '+' : '-'}{fmt(detailMov.amount)}
                  </p>
                </div>
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-[10px] text-muted-foreground">Tipo</p>
                  <Badge variant="outline" className="text-xs mt-0.5">{movTypeLabels[detailMov.type] ?? detailMov.type}</Badge>
                </div>
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-[10px] text-muted-foreground">Origem</p>
                  <p className="text-sm">{originLabels[detailMov.origin] ?? detailMov.origin}</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-[10px] text-muted-foreground">Saldo Antes</p>
                  <p className="text-sm font-mono">{fmt(detailMov.balanceBefore)}</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-[10px] text-muted-foreground">Saldo Depois</p>
                  <p className="text-sm font-mono font-semibold">{fmt(detailMov.balanceAfter)}</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-[10px] text-muted-foreground">Responsável</p>
                  <p className="text-sm">{detailMov.userName ?? '-'}</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-[10px] text-muted-foreground">Data</p>
                  <p className="text-sm">{fmtDate(detailMov.createdAt)}</p>
                </div>
              </div>
              {detailMov.notes && (
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-[10px] text-muted-foreground">Observações</p>
                  <p className="text-sm italic">{detailMov.notes}</p>
                </div>
              )}
              {detailMov.reference && (
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-[10px] text-muted-foreground">Referência</p>
                  <p className="text-xs font-mono">{detailMov.reference}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ===== EDIT TRANSFER DIALOG ===== */}
      <Dialog open={editTransferOpen} onOpenChange={setEditTransferOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Pencil className="w-5 h-5" />Editar Transferência</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Valor (R$) *</Label>
              <CurrencyInput value={parseFloat(editTransferForm.amount) || 0} onChange={(v: number) => setEditTransferForm({ ...editTransferForm, amount: String(v) })} />
            </div>
            <div>
              <Label>Caixa Origem</Label>
              <select className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm" value={editTransferForm.fromAccountId} onChange={(e: any) => setEditTransferForm({ ...editTransferForm, fromAccountId: e.target.value })}>
                <option value="">Manter original</option>
                {activeAccounts.map(a => <option key={a.id} value={a.id}>{a.name} ({fmt(a.currentBalance)})</option>)}
              </select>
            </div>
            <div className="flex justify-center"><ArrowRightLeft className="w-5 h-5 text-muted-foreground rotate-90" /></div>
            <div>
              <Label>Caixa Destino</Label>
              <select className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm" value={editTransferForm.toAccountId} onChange={(e: any) => setEditTransferForm({ ...editTransferForm, toAccountId: e.target.value })}>
                <option value="">Manter original</option>
                {activeAccounts.filter(a => a.id !== editTransferForm.fromAccountId).map(a => <option key={a.id} value={a.id}>{a.name} ({fmt(a.currentBalance)})</option>)}
              </select>
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea value={editTransferForm.notes} onChange={(e: any) => setEditTransferForm({ ...editTransferForm, notes: e.target.value })} rows={2} />
            </div>
            <Card className="border-0 bg-amber-50 dark:bg-amber-950/20">
              <CardContent className="p-3 text-xs">
                <p className="font-semibold text-amber-800 dark:text-amber-300">⚠️ Operação Atômica</p>
                <p className="text-amber-700 dark:text-amber-400 mt-1">Os saldos dos caixas envolvidos serão recalculados automaticamente (reverter transferência original + aplicar nova). Tudo registrado no log de auditoria.</p>
              </CardContent>
            </Card>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditTransferOpen(false)}>Cancelar</Button>
              <Button onClick={handleEditTransfer} disabled={editTransferSaving}>
                {editTransferSaving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando...</> : 'Salvar Alterações'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ===== ESTORNO TRANSFER DIALOG ===== */}
      <AlertDialog open={estornoTransferOpen} onOpenChange={setEstornoTransferOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2"><RotateCcw className="w-5 h-5 text-orange-600" />Estornar Transferência</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação reverterá a transferência, devolvendo o valor ao caixa de origem e debitando do caixa de destino. Movimentações de estorno serão criadas para rastreabilidade.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleEstornoTransfer} disabled={estornoTransferSaving} className="bg-orange-600 hover:bg-orange-700">
              {estornoTransferSaving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Estornando...</> : <><RotateCcw className="w-4 h-4 mr-2" />Confirmar Estorno</>}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ===== AJUSTE DE CAIXA DIALOG ===== */}
      <Dialog open={ajusteOpen} onOpenChange={setAjusteOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Scale className="w-5 h-5 text-blue-600" />Ajuste de Caixa</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Card className="border-0 bg-blue-50 dark:bg-blue-950/20">
              <CardContent className="p-3 text-xs">
                <p className="font-semibold text-blue-800 dark:text-blue-300">Reconciliação Rápida</p>
                <p className="text-blue-700 dark:text-blue-400 mt-1">Compare o saldo do sistema com a contagem física. A diferença será lançada automaticamente como ajuste.</p>
              </CardContent>
            </Card>
            <div>
              <Label>Caixa / Conta *</Label>
              <select className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm" value={ajusteForm.cashAccountId} onChange={(e: any) => setAjusteForm({ ...ajusteForm, cashAccountId: e.target.value })}>
                <option value="">Selecione...</option>
                {activeAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            {ajusteForm.cashAccountId && (() => {
              const acc = accounts.find((a: any) => a.id === ajusteForm.cashAccountId);
              const expectedBalance = acc?.currentBalance ?? 0;
              const actualVal = parseFloat(ajusteForm.actualBalance) || 0;
              const diff = ajusteForm.actualBalance ? actualVal - expectedBalance : 0;
              return (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-muted/50 p-3 rounded-lg text-center">
                      <p className="text-[10px] text-muted-foreground">Saldo Sistema</p>
                      <p className="text-sm font-bold num-highlight">{fmt(expectedBalance)}</p>
                    </div>
                    <div className="bg-muted/50 p-3 rounded-lg text-center">
                      <p className="text-[10px] text-muted-foreground">Saldo Real</p>
                      <p className="text-sm font-bold num-highlight">{ajusteForm.actualBalance ? fmt(actualVal) : '-'}</p>
                    </div>
                    <div className={`p-3 rounded-lg text-center ${diff === 0 ? 'bg-emerald-50 dark:bg-emerald-950/20' : diff > 0 ? 'bg-blue-50 dark:bg-blue-950/20' : 'bg-red-50 dark:bg-red-950/20'}`}>
                      <p className="text-[10px] text-muted-foreground">Diferença</p>
                      <p className={`text-sm font-bold num-highlight ${diff === 0 ? 'text-emerald-600' : diff > 0 ? 'text-blue-600' : 'text-red-600'}`}>
                        {ajusteForm.actualBalance ? (diff === 0 ? '✓ OK' : `${diff > 0 ? '+' : ''}${fmt(diff)}`) : '-'}
                      </p>
                    </div>
                  </div>
                  <div>
                    <Label>Saldo Real Contado (R$) *</Label>
                    <CurrencyInput value={actualVal} onChange={(v: number) => setAjusteForm({ ...ajusteForm, actualBalance: String(v) })} />
                  </div>
                </>
              );
            })()}
            <div>
              <Label>Tipo de Ajuste</Label>
              <select className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm" value={ajusteForm.adjustmentType} onChange={(e: any) => setAjusteForm({ ...ajusteForm, adjustmentType: e.target.value })}>
                <option value="diferenca">Diferença Encontrada</option>
                <option value="sangria">Sangria</option>
                <option value="reforco">Reforço</option>
                <option value="outro">Outro</option>
              </select>
            </div>
            <div>
              <Label>Classificação Contábil</Label>
              <Select value={ajusteForm.accountPlanId || '__default__'} onValueChange={(v) => setAjusteForm({ ...ajusteForm, accountPlanId: v === '__default__' ? '' : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__default__">5.99 — Ajuste de Caixa (padrão)</SelectItem>
                  {accountPlans
                    .filter((ap: any) => ap.code !== '5.99' && (ap.type === 'financeiro' || ap.type === 'despesa' || ap.type === 'receita'))
                    .sort((a: any, b: any) => a.code.localeCompare(b.code))
                    .map((ap: any) => <SelectItem key={ap.id} value={ap.id}>{ap.code} — {ap.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">Padrão: 5.99 — Ajuste de Caixa. Altere se necessário.</p>
            </div>
            <div>
              <Label>Motivo / Observações</Label>
              <Textarea value={ajusteForm.reason} onChange={(e: any) => setAjusteForm({ ...ajusteForm, reason: e.target.value })} rows={2} placeholder="Ex: Contagem de caixa no fechamento..." />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAjusteOpen(false)}>Cancelar</Button>
              <Button onClick={handleAjuste} disabled={ajusteSaving}>
                {ajusteSaving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Registrando...</> : <><Scale className="w-4 h-4 mr-2" />Registrar Ajuste</>}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ===== RECONCILIAÇÃO DIALOG ===== */}
      <Dialog open={reconOpen} onOpenChange={setReconOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-emerald-600" />Reconciliação de Saldos</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Card className="border-0 bg-emerald-50 dark:bg-emerald-950/20">
              <CardContent className="p-3 text-xs">
                <p className="font-semibold text-emerald-800 dark:text-emerald-300">Verificação de Integridade</p>
                <p className="text-emerald-700 dark:text-emerald-400 mt-1">Recalcula os saldos de todos os caixas a partir do saldo inicial + soma de todas as movimentações. Identifica e corrige divergências.</p>
              </CardContent>
            </Card>

            {!reconResults ? (
              <div className="text-center py-6">
                <ShieldCheck className="w-12 h-12 mx-auto text-muted-foreground opacity-30 mb-3" />
                <p className="text-sm text-muted-foreground mb-4">Clique abaixo para verificar a integridade dos saldos</p>
                <Button onClick={handleReconCheck} disabled={reconLoading}>
                  {reconLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Verificando...</> : <><ShieldCheck className="w-4 h-4 mr-2" />Verificar Saldos</>}
                </Button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-muted/50 p-3 rounded-lg text-center">
                    <p className="text-[10px] text-muted-foreground">Total de Caixas</p>
                    <p className="text-lg font-bold">{reconResults.totalAccounts}</p>
                  </div>
                  <div className={`p-3 rounded-lg text-center ${reconResults.hasDiscrepancies ? 'bg-red-50 dark:bg-red-950/20' : 'bg-emerald-50 dark:bg-emerald-950/20'}`}>
                    <p className="text-[10px] text-muted-foreground">Status</p>
                    <p className={`text-sm font-bold ${reconResults.hasDiscrepancies ? 'text-red-600' : 'text-emerald-600'}`}>
                      {reconResults.hasDiscrepancies ? <><AlertCircle className="w-4 h-4 inline mr-1" />Divergências</> : <><CheckCircle className="w-4 h-4 inline mr-1" />Confere</>}
                    </p>
                  </div>
                  <div className="bg-muted/50 p-3 rounded-lg text-center">
                    <p className="text-[10px] text-muted-foreground">Corrigidos</p>
                    <p className="text-lg font-bold">{reconResults.fixedCount}</p>
                  </div>
                </div>

                <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Caixa</TableHead>
                        <TableHead className="text-right">Saldo Atual</TableHead>
                        <TableHead className="text-right">Saldo Calculado</TableHead>
                        <TableHead className="text-right">Diferença</TableHead>
                        <TableHead className="text-center">Movs</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reconResults.results?.map((r: any) => (
                        <TableRow key={r.accountId}>
                          <TableCell className="font-medium text-sm">{r.accountName}</TableCell>
                          <TableCell className="text-right num-highlight text-sm">{fmt(r.currentBalance)}</TableCell>
                          <TableCell className="text-right num-highlight text-sm">{fmt(r.calculatedBalance)}</TableCell>
                          <TableCell className={`text-right num-highlight text-sm font-bold ${r.difference === 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {r.difference === 0 ? '✓' : fmt(r.difference)}
                          </TableCell>
                          <TableCell className="text-center text-xs text-muted-foreground">{r.movementCount}</TableCell>
                          <TableCell className="text-center">
                            {r.fixed ? (
                              <Badge className="bg-blue-100 text-blue-700 text-xs">Corrigido</Badge>
                            ) : r.difference === 0 ? (
                              <Badge className="bg-emerald-100 text-emerald-700 text-xs"><CheckCircle className="w-3 h-3 mr-1" />OK</Badge>
                            ) : (
                              <Badge className="bg-red-100 text-red-700 text-xs"><AlertCircle className="w-3 h-3 mr-1" />Divergente</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={handleReconCheck} disabled={reconLoading}>
                    {reconLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ShieldCheck className="w-4 h-4 mr-2" />}Reverificar
                  </Button>
                  {reconResults.hasDiscrepancies && reconResults.fixedCount === 0 && (
                    <Button onClick={handleReconFix} disabled={reconFixing} className="bg-orange-600 hover:bg-orange-700">
                      {reconFixing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Corrigindo...</> : <><Wrench className="w-4 h-4 mr-2" />Corrigir Saldos</>}
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}