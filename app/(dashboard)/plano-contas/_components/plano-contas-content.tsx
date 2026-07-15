'use client';

import { useState, useEffect, useCallback } from 'react';
import { AppHeader } from '@/components/app-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Plus, Layers, Edit2, Trash2, ToggleLeft, ToggleRight,
  DollarSign, TrendingDown, Package, Landmark, Wallet, FileText,
  Search, FileBarChart, CheckCircle, XCircle, Sparkles, ChevronRight, ChevronDown,
  ShieldCheck, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

interface AccountPlan {
  id: string;
  name: string;
  code: string | null;
  type: string;
  dreGroup: string | null;
  showInDre: boolean;
  parentId: string | null;
  isActive: boolean;
  isSystem: boolean;
  sortOrder: number;
  _count?: { financialRecords: number };
  children?: AccountPlan[];
}

const TYPE_MAP: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  receita: { label: 'Receita', color: 'text-emerald-700', bg: 'bg-emerald-50', icon: DollarSign },
  custo: { label: 'Custo/CMV', color: 'text-amber-700', bg: 'bg-amber-50', icon: Package },
  despesa: { label: 'Despesa', color: 'text-red-700', bg: 'bg-red-50', icon: TrendingDown },
  imposto: { label: 'Imposto', color: 'text-orange-700', bg: 'bg-orange-50', icon: FileText },
  financeiro: { label: 'Financeiro', color: 'text-violet-700', bg: 'bg-violet-50', icon: Wallet },
  investimento: { label: 'Investimento', color: 'text-blue-700', bg: 'bg-blue-50', icon: Landmark },
};

const TYPE_KEYS = ['receita', 'custo', 'despesa', 'imposto', 'financeiro', 'investimento'];

const DRE_GROUPS = [
  'Receita Bruta', 'Outras Receitas', 'Receita Financeira', 'CMV',
  'Despesas Operacionais', 'Despesas Comerciais', 'Despesas Administrativas',
  'Despesas Financeiras', 'Impostos', 'Investimentos', 'Financeiro',
];

export function PlanoContasContent() {
  const [plans, setPlans] = useState<AccountPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editPlan, setEditPlan] = useState<AccountPlan | null>(null);
  const [form, setForm] = useState({ name: '', type: 'despesa', dreGroup: '', showInDre: true, code: '' });
  const [seeding, setSeeding] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/plano-contas?active=false');
      if (res.ok) {
        const data: AccountPlan[] = await res.json();
        setPlans(data);
        // Auto-expand root nodes on first load
        setExpandedIds(prev => {
          if (prev.size > 0) return prev;
          const next = new Set<string>();
          data.forEach(p => { if (!p.parentId) next.add(p.id); });
          return next;
        });
      }
    } catch (e: any) { console.error(e); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalActiveAccounts = plans.filter(p => p.isActive).length;

  const handleSeedDefaults = async () => {
    const hasAccounts = totalActiveAccounts > 0;
    const msg = hasAccounts
      ? 'Aplicar plano de contas padrão de moda?\n\nIsso vai ADICIONAR as contas que faltam e organizar a hierarquia.\nSuas contas existentes serão mantidas (nomes preservados).'
      : 'Gerar plano de contas padrão para moda/vestuário?\n\nIsso vai criar uma estrutura completa de Receitas, Custos, Despesas e mais.';
    if (!confirm(msg)) return;
    try {
      setSeeding(true);
      const res = await fetch('/api/plano-contas/seed', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Plano padrão aplicado! ${data.stats?.created || 0} criadas, ${data.stats?.updated || 0} organizadas.`);
        fetchData();
      } else {
        toast.error(data?.error || 'Erro ao gerar plano padrão');
      }
    } catch (e) {
      toast.error('Erro ao gerar plano padrão');
      console.error(e);
    } finally {
      setSeeding(false);
    }
  };

  const openNew = () => {
    setEditPlan(null);
    setForm({ name: '', type: 'despesa', dreGroup: '', showInDre: true, code: '' });
    setDialogOpen(true);
  };

  const openEdit = (p: AccountPlan) => {
    setEditPlan(p);
    setForm({ name: p.name, type: p.type, dreGroup: p.dreGroup || '', showInDre: p.showInDre, code: p.code || '' });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Nome é obrigatório'); return; }
    try {
      const url = editPlan ? `/api/plano-contas/${editPlan.id}` : '/api/plano-contas';
      const res = await fetch(url, {
        method: editPlan ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        toast.success(editPlan ? 'Conta atualizada!' : 'Conta criada!');
        setDialogOpen(false);
        fetchData();
      } else {
        const d = await res.json();
        toast.error(d?.error || 'Erro');
      }
    } catch (e: any) { toast.error('Erro ao salvar'); console.error(e); }
  };

  const handleDelete = async (plan: AccountPlan) => {
    if (plan.isSystem) {
      toast.error('Conta do sistema não pode ser excluída. Use o botão de ativar/desativar.');
      return;
    }
    if (!confirm(`Deseja ${(plan._count?.financialRecords ?? 0) > 0 ? 'desativar' : 'excluir'} "${plan.name}"?`)) return;
    try {
      const res = await fetch(`/api/plano-contas/${plan.id}`, { method: 'DELETE' });
      if (res.ok) { toast.success('Conta removida'); fetchData(); }
      else { const d = await res.json(); toast.error(d?.error || 'Erro'); }
    } catch { toast.error('Erro'); }
  };

  const handleToggle = async (plan: AccountPlan) => {
    try {
      const res = await fetch(`/api/plano-contas/${plan.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !plan.isActive }),
      });
      if (res.ok) { toast.success(plan.isActive ? 'Conta desativada' : 'Conta reativada'); fetchData(); }
    } catch { toast.error('Erro'); }
  };

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const matchesSearch = (p: AccountPlan): boolean => {
    if (!search) return true;
    const s = search.toLowerCase();
    if (p.name.toLowerCase().includes(s)) return true;
    if ((p.code || '').toLowerCase().includes(s)) return true;
    return (p.children || []).some(matchesSearch);
  };

  const getFilteredPlans = (type: string): AccountPlan[] => {
    return plans
      .filter(p => p.type === type && !p.parentId)
      .filter(matchesSearch);
  };

  const totalByType = (type: string) => plans.filter(p => p.type === type && p.isActive && !p.parentId).length;

  const renderAccountRow = (plan: AccountPlan, depth: number = 0): React.ReactNode => {
    const hasChildren = (plan.children?.length ?? 0) > 0;
    const isExpanded = expandedIds.has(plan.id);
    const visibleChildren = hasChildren && isExpanded ? plan.children!.filter(matchesSearch) : [];

    return (
      <div key={plan.id}>
        <div
          className={`flex items-center gap-2 px-4 py-2.5 hover:bg-muted/30 transition-colors border-b border-border/30 ${!plan.isActive ? 'opacity-50' : ''} ${depth === 0 ? 'bg-muted/15' : ''}`}
          style={{ paddingLeft: `${16 + depth * 18}px` }}
        >
          {/* Expand toggle */}
          {hasChildren ? (
            <button
              type="button"
              onClick={() => toggleExpand(plan.id)}
              className="w-5 h-5 flex items-center justify-center text-muted-foreground hover:text-foreground shrink-0"
              title={isExpanded ? 'Recolher' : 'Expandir'}
            >
              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          ) : (
            <span className="w-5 h-5 shrink-0" />
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs font-mono ${depth === 0 ? 'text-foreground font-semibold' : 'text-muted-foreground'} min-w-[44px]`}>
                {plan.code}
              </span>
              <span className={`text-sm truncate ${depth === 0 ? 'font-semibold' : 'font-medium'}`}>{plan.name}</span>
              {plan.isSystem && (
                <Badge variant="outline" className="text-[9px] px-1.5 py-0 gap-1 border-violet-200 text-violet-700 bg-violet-50">
                  <ShieldCheck className="w-2.5 h-2.5" /> Sistema
                </Badge>
              )}
              {!plan.isActive && <Badge variant="destructive" className="text-[9px] px-1">Inativa</Badge>}
            </div>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              {plan.dreGroup && (
                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <FileBarChart className="w-3 h-3" /> {plan.dreGroup}
                </span>
              )}
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                {plan.showInDre ? <CheckCircle className="w-3 h-3 text-emerald-500" /> : <XCircle className="w-3 h-3 text-red-400" />}
                DRE: {plan.showInDre ? 'Sim' : 'Não'}
              </span>
              {(plan._count?.financialRecords ?? 0) > 0 && (
                <span className="text-[10px] text-muted-foreground">
                  {plan._count?.financialRecords} lançamento{(plan._count?.financialRecords ?? 0) !== 1 ? 's' : ''}
                </span>
              )}
              {hasChildren && (
                <span className="text-[10px] text-muted-foreground">
                  {plan.children!.length} subconta{plan.children!.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openEdit(plan)} title="Editar">
              <Edit2 className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleToggle(plan)} title={plan.isActive ? 'Desativar' : 'Ativar'}>
              {plan.isActive ? <ToggleRight className="w-4 h-4 text-emerald-500" /> : <ToggleLeft className="w-4 h-4 text-muted-foreground" />}
            </Button>
            {!plan.isSystem && (
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-500 hover:text-red-700" onClick={() => handleDelete(plan)} title="Excluir">
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </div>
        {visibleChildren.map(child => renderAccountRow(child, depth + 1))}
      </div>
    );
  };

  return (
    <div>
      <AppHeader title="Plano de Contas" />
      <div className="p-4 lg:p-6 space-y-5">

        {/* Header cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {TYPE_KEYS.map(t => {
            const cfg = TYPE_MAP[t];
            const Icon = cfg.icon;
            return (
              <Card key={t} className="border-0 shadow-sm">
                <CardContent className="p-3 flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-lg ${cfg.bg} flex items-center justify-center`}>
                    <Icon className={`w-4 h-4 ${cfg.color}`} />
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">{cfg.label}</p>
                    <p className="text-lg font-bold font-mono">{totalByType(t)}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Search + Actions */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar conta..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <Button
            variant="outline"
            onClick={handleSeedDefaults}
            disabled={seeding}
            className="gap-1.5 border-violet-200 text-violet-700 hover:bg-violet-50"
            title="Aplica o plano de contas padrão de moda/vestuário sem apagar contas existentes"
          >
            {seeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {seeding ? 'Aplicando...' : 'Gerar Plano Padrão'}
          </Button>
          <Button onClick={openNew} className="gap-1.5">
            <Plus className="w-4 h-4" /> Nova Conta
          </Button>
        </div>

        {/* Empty state when no accounts */}
        {!loading && plans.length === 0 && (
          <Card className="border-2 border-dashed border-violet-200 bg-violet-50/30">
            <CardContent className="py-10 flex flex-col items-center text-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-violet-100 flex items-center justify-center">
                <Sparkles className="w-7 h-7 text-violet-600" />
              </div>
              <div>
                <h3 className="font-display text-lg font-semibold">Comece com o plano padrão</h3>
                <p className="text-sm text-muted-foreground max-w-md mt-1">
                  Crie automaticamente um plano de contas completo para varejo de moda
                  com Receitas, CMV, Despesas Comerciais, Folha, Impostos e mais.
                </p>
              </div>
              <Button onClick={handleSeedDefaults} disabled={seeding} className="gap-2">
                {seeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {seeding ? 'Gerando...' : 'Gerar Plano Padrão de Moda'}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Tabs by type */}
        {(loading || plans.length > 0) && (
        <Tabs defaultValue="despesa" className="w-full">
          <TabsList className="w-full flex bg-muted/50 rounded-xl p-1 gap-1 h-auto flex-wrap">
            {TYPE_KEYS.map(t => {
              const cfg = TYPE_MAP[t];
              return (
                <TabsTrigger key={t} value={t} className="flex-1 min-w-[80px] rounded-lg data-[state=active]:shadow-sm text-xs font-medium py-2.5 gap-1.5">
                  <cfg.icon className="w-3.5 h-3.5" /> {cfg.label}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {TYPE_KEYS.map(type => (
            <TabsContent key={type} value={type} className="mt-4">
              <Card className="border-0 shadow-sm">
                <CardContent className="p-0">
                  <div>
                    {loading && (
                      <div className="py-12 text-center text-sm text-muted-foreground">Carregando...</div>
                    )}
                    {!loading && getFilteredPlans(type).length === 0 && (
                      <div className="py-12 text-center text-sm text-muted-foreground">Nenhuma conta encontrada</div>
                    )}
                    {getFilteredPlans(type).map(plan => renderAccountRow(plan, 0))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <Layers className="w-5 h-5" /> {editPlan ? 'Editar Conta' : 'Nova Conta'}
            </DialogTitle>
          </DialogHeader>
          {editPlan?.isSystem && (
            <div className="flex items-start gap-2 p-3 rounded-md bg-violet-50 border border-violet-200 text-xs text-violet-900">
              <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <strong>Conta do sistema:</strong> você pode renomear, mas não pode alterar código, tipo, grupo DRE ou hierarquia.
                Essa proteção garante que integrações internas (vendas, financeiro, DRE) continuem funcionando.
              </div>
            </div>
          )}
          <div className="space-y-4">
            <div>
              <Label>Nome *</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex: Aluguel" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo *</Label>
                <select
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm disabled:opacity-60"
                  value={form.type}
                  onChange={e => setForm({ ...form, type: e.target.value })}
                  disabled={editPlan?.isSystem}
                >
                  {TYPE_KEYS.map(t => <option key={t} value={t}>{TYPE_MAP[t].label}</option>)}
                </select>
              </div>
              <div>
                <Label>Código</Label>
                <Input
                  value={form.code}
                  onChange={e => setForm({ ...form, code: e.target.value })}
                  placeholder="Auto"
                  disabled={editPlan?.isSystem}
                />
              </div>
            </div>
            <div>
              <Label>Grupo DRE</Label>
              <select
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm disabled:opacity-60"
                value={form.dreGroup}
                onChange={e => setForm({ ...form, dreGroup: e.target.value })}
                disabled={editPlan?.isSystem}
              >
                <option value="">Nenhum</option>
                {DRE_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.showInDre}
                  onChange={e => setForm({ ...form, showInDre: e.target.checked })}
                  className="rounded border-input"
                  disabled={editPlan?.isSystem}
                />
                <span className="text-sm">Exibir na DRE</span>
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave}>{editPlan ? 'Salvar' : 'Criar Conta'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
