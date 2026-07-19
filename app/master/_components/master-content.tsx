'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import dynamicImport from 'next/dynamic';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Building2, Users, LogOut, Shield, Trash2, AlertTriangle, Loader2,
  Crown, Zap, TrendingUp, ShoppingBag, Bot, Clock, Pencil, Search,
  Package, UserCheck, Activity, Sparkles, ChevronRight,
  BarChart3, ClipboardCheck, ScrollText, CheckCircle2, Circle,
  MessageCircle, DatabaseBackup, ShieldCheck, Lock, Filter, X, Eraser,
  ListChecks, CreditCard, Clapperboard
} from 'lucide-react';
import { toast } from 'sonner';
import { BackupPanel } from './backup-panel';
import { DemoPanel } from './demo-panel';

/* ─── Charts (lazy, SSR-safe) ─── */
const GrowthChart = dynamicImport(() => import('./master-charts').then(m => m.GrowthChart), { ssr: false });
const RevenueChart = dynamicImport(() => import('./master-charts').then(m => m.RevenueChart), { ssr: false });

/* ─── Plan config ─── */
const PLAN_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  trial:      { label: 'Trial',       color: 'text-amber-700 dark:text-amber-400',    bg: 'bg-amber-100 dark:bg-amber-900/40 border-amber-200 dark:border-amber-700/40',       icon: Clock },
  starter:    { label: 'Organização', color: 'text-blue-700 dark:text-blue-400',      bg: 'bg-blue-100 dark:bg-blue-900/40 border-blue-200 dark:border-blue-700/40',         icon: Zap },
  pro:        { label: 'Evolução',    color: 'text-violet-700 dark:text-violet-400',  bg: 'bg-violet-100 dark:bg-violet-900/40 border-violet-200 dark:border-violet-700/40', icon: Crown },
  enterprise: { label: 'Expansão',    color: 'text-emerald-700 dark:text-emerald-400',bg: 'bg-emerald-100 dark:bg-emerald-900/40 border-emerald-200 dark:border-emerald-700/40', icon: Sparkles },
};

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  active:    { label: 'Ativo',     variant: 'default' },
  suspended: { label: 'Suspenso',  variant: 'secondary' },
  canceled:  { label: 'Cancelado', variant: 'destructive' },
};

/* ─── Status efetivo (motor único de assinaturas — PRIORIDADE 8.1B) ─── */
const EFFECTIVE_STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  ACTIVE:    { label: 'Ativa',     cls: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-400 dark:border-emerald-700/40' },
  TRIAL:     { label: 'Trial',     cls: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-400 dark:border-amber-700/40' },
  EXPIRED:   { label: 'Expirada',  cls: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/40 dark:text-red-400 dark:border-red-700/40' },
  SUSPENDED: { label: 'Suspensa',  cls: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/40 dark:text-orange-400 dark:border-orange-700/40' },
  CANCELED:  { label: 'Cancelada', cls: 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/40 dark:text-rose-400 dark:border-rose-700/40' },
};

/** Status efetivo da empresa (usa o calculado pelo servidor; fallback defensivo). */
function effStatus(c: any): string {
  return c?.subscription?.status || 'ACTIVE';
}

function EffectiveStatusBadge({ c }: { c: any }) {
  const st = effStatus(c);
  const cfg = EFFECTIVE_STATUS_CONFIG[st] || EFFECTIVE_STATUS_CONFIG.ACTIVE;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] font-semibold ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

/** Selo de COBRANÇA (P8.4) — reflete billingStatus da empresa. NONE = sem assinatura de gateway. */
const BILLING_STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  NONE:      { label: 'Sem cobrança', cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-400' },
  ACTIVE:    { label: 'Em dia',       cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' },
  PAST_DUE:  { label: 'Inadimplente', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' },
  SUSPENDED: { label: 'Suspensa',     cls: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' },
  CANCELED:  { label: 'Cancelada',    cls: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400' },
};
function BillingBadge({ status }: { status?: string | null }) {
  const st = (status || 'NONE').toUpperCase();
  if (st === 'NONE') return null; // sem assinatura de gateway: não polui a tabela
  const cfg = BILLING_STATUS_CONFIG[st] || BILLING_STATUS_CONFIG.NONE;
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${cfg.cls}`} title="Status de cobrança">
      {cfg.label}
    </span>
  );
}

/** Coluna Trial: usa o alerta calculado pelo servidor (7/3/1 dias / expirado). */
function SubscriptionAlertCell({ c, trialDays }: { c: any; trialDays: number | null }) {
  const sub = c?.subscription;
  const st = effStatus(c);
  // Trial expirado -> empresa bloqueada
  if (st === 'EXPIRED') {
    return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400">Expirado</span>;
  }
  // Em trial ativo: mostrar dias restantes + alerta de proximidade
  if (st === 'TRIAL') {
    const days = typeof sub?.daysRemaining === 'number' ? sub.daysRemaining : trialDays;
    if (days === null || days === undefined) return <span className="text-xs text-muted-foreground">—</span>;
    const level = sub?.alertLevel;
    const cls = level === '1d' ? 'text-red-500 font-bold' : level === '3d' ? 'text-orange-500 font-semibold' : level === '7d' ? 'text-amber-500' : 'text-muted-foreground';
    const txt = days <= 0 ? 'Expira hoje' : days === 1 ? 'Expira amanhã' : `${days}d`;
    return <span className={`text-xs font-mono ${cls}`}>{txt}</span>;
  }
  return <span className="text-xs text-muted-foreground">—</span>;
}

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  signup:       { label: 'Cadastro',    color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' },
  company_edit: { label: 'Edição',      color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400' },
  plan_change:  { label: 'Plano',       color: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400' },
  login:        { label: 'Login',       color: 'bg-slate-100 text-slate-700 dark:bg-slate-900/40 dark:text-slate-400' },
  reset_data:   { label: 'Reset',       color: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' },
  company_delete:      { label: 'Empresa excluída', color: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' },
  company_bulk_delete: { label: 'Exclusão em massa', color: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400' },
  backup_create:         { label: 'Backup criado',    color: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-400' },
  backup_download:       { label: 'Backup baixado',   color: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-400' },
  backup_restore:        { label: 'Restauração',      color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400' },
  backup_restore_failed: { label: 'Restauração falhou', color: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' },
  backup_failed:         { label: 'Backup falhou',     color: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' },
  backup_auto_run:       { label: 'Ciclo automático',  color: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-400' },
  backup_purge:          { label: 'Expurgo',           color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400' },
};

function formatCurrency(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}
function formatDate(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}
function formatDateTime(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}
function daysUntil(d: string | null | undefined) {
  if (!d) return null;
  return Math.ceil((new Date(d).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}
function formatWhatsApp(num: string | null | undefined) {
  if (!num) return null;
  const d = num.replace(/\D/g, '');
  return d.startsWith('55') ? d : '55' + d;
}
function daysSince(d: string | null | undefined) {
  if (!d) return Infinity;
  return Math.floor((Date.now() - new Date(d).getTime()) / (1000 * 60 * 60 * 24));
}
/** Heurística client-side de proteção (espelha o servidor: campo isProtected). O backend é a autoridade final. */
function isProtectedCompany(c: any): boolean {
  return !!c?.isProtected;
}

/* ─── Filtros operacionais ─── */
const COMPANY_FILTERS: { key: string; label: string }[] = [
  { key: 'all',       label: 'Todas' },
  { key: 'trial',     label: 'Trial' },
  { key: 'active',    label: 'Ativas' },
  { key: 'suspended', label: 'Suspensas' },
  { key: 'canceled',  label: 'Canceladas' },
  { key: 'expired',   label: 'Expiradas' },
  { key: 'no_users',  label: 'Sem usuários' },
  { key: 'no_sales',  label: 'Sem vendas' },
  { key: 'homolog',   label: 'Homologação' },
  { key: 'recent',    label: 'Últimos X dias' },
];

/* ─── Plan Badge ─── */
function PlanBadge({ plan }: { plan: string }) {
  const cfg = PLAN_CONFIG[plan] || PLAN_CONFIG.trial;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-xs font-semibold ${cfg.bg} ${cfg.color}`}>
      <Icon className="w-3 h-3" />{cfg.label}
    </span>
  );
}

/* ─── Célula de Uso x Limite (motor de planos — TAREFA 7/8) ─── */
function UsageCell({ usage, fallbackUsed, fallbackLimit }: { usage?: any; fallbackUsed?: number; fallbackLimit?: number }) {
  // usage = ResourceUsage do planUsage (used, limit, unlimited, percent, alertLevel, exceeded)
  const used = usage?.used ?? fallbackUsed ?? 0;
  const unlimited = usage?.unlimited ?? false;
  const limit = usage?.limit ?? fallbackLimit;
  const percent = usage?.percent ?? 0;
  const level = usage?.alertLevel ?? null; // 'warning' | 'critical' | 'limit' | null

  const textColor =
    level === 'limit' ? 'text-red-600 dark:text-red-400'
      : level === 'critical' ? 'text-orange-600 dark:text-orange-400'
        : level === 'warning' ? 'text-amber-600 dark:text-amber-400'
          : 'text-foreground';
  const barColor =
    level === 'limit' ? 'bg-red-500'
      : level === 'critical' ? 'bg-orange-500'
        : level === 'warning' ? 'bg-amber-500'
          : 'bg-emerald-500';

  return (
    <div className="flex flex-col items-center gap-1 min-w-[64px]">
      <span className={`font-mono text-sm font-semibold ${textColor}`}>
        {used}<span className="text-muted-foreground font-normal">/{unlimited ? '∞' : (limit ?? '∞')}</span>
      </span>
      {!unlimited && typeof limit === 'number' && limit > 0 && (
        <div className="w-14 h-1.5 rounded-full bg-muted overflow-hidden">
          <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${Math.min(100, percent)}%` }} />
        </div>
      )}
    </div>
  );
}

/* ─── KPI Card ─── */
function KpiCard({ icon: Icon, label, value, accent, sub }: { icon: any; label: string; value: string | number; accent: string; sub?: string }) {
  return (
    <Card className="card-premium group hover:scale-[1.02] transition-transform duration-200">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">{label}</p>
            <p className="text-2xl font-bold font-mono tracking-tight">{value}</p>
            {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
          </div>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ring-4 ring-${accent}-500/10 bg-${accent}-500/10`}>
            <Icon className={`w-5 h-5 text-${accent}-500`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── Main ─── */
export function MasterContent() {
  const { data: session, status } = useSession() || {};
  const router = useRouter();
  const [stats, setStats] = useState<any>({});
  const [companies, setCompanies] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [activeTab, setActiveTab] = useState('empresas');

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editCompany, setEditCompany] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [confirmSaveOpen, setConfirmSaveOpen] = useState(false);

  // Delete dialog
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteCompany, setDeleteCompany] = useState<any>(null);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);

  // Reset dialog
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [resetting, setResetting] = useState(false);
  const [resetResult, setResetResult] = useState<any>(null);

  // Filters + multi-selection
  const [companyFilter, setCompanyFilter] = useState('all');
  const [recentDays, setRecentDays] = useState(7);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Bulk delete dialog
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkConfirm, setBulkConfirm] = useState('');
  const [bulkPreview, setBulkPreview] = useState<any>(null);
  const [bulkLoadingPreview, setBulkLoadingPreview] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkResult, setBulkResult] = useState<any>(null);

  // Quick cleanup (test companies) dialog
  const [cleanupOpen, setCleanupOpen] = useState(false);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [cleanupData, setCleanupData] = useState<any>(null);
  const [cleanupConfirm, setCleanupConfirm] = useState('');
  const [cleanupDeleting, setCleanupDeleting] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<any>(null);

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
    if (status === 'authenticated' && !session?.user?.isMaster) router.replace('/login');
  }, [status, session, router]);

  const fetchData = useCallback(async () => {
    try {
      const [sRes, cRes, uRes] = await Promise.all([
        fetch('/api/master/stats'),
        fetch('/api/master/empresas'),
        fetch('/api/master/usuarios'),
      ]);
      if (sRes.ok) setStats(await sRes.json());
      if (cRes.ok) setCompanies(await cRes.json());
      if (uRes.ok) setUsers(await uRes.json());
    } catch (e: any) { console.error(e); } finally { setLoading(false); }
  }, []);

  const fetchAnalytics = useCallback(async () => {
    try {
      const res = await fetch('/api/master/analytics');
      if (res.ok) setAnalytics(await res.json());
    } catch (e: any) { console.error(e); }
  }, []);

  useEffect(() => {
    if (session?.user?.isMaster) {
      fetchData();
      fetchAnalytics();
    }
  }, [session, fetchData, fetchAnalytics]);

  /* ─── Filtered lists ─── */
  const filteredCompanies = useMemo(() => {
    let list = companies;
    // Operational filter
    if (companyFilter !== 'all') {
      list = list.filter((c: any) => {
        switch (companyFilter) {
          case 'trial':     return effStatus(c) === 'TRIAL';
          case 'active':    return effStatus(c) === 'ACTIVE';
          case 'suspended': return effStatus(c) === 'SUSPENDED';
          case 'canceled':  return effStatus(c) === 'CANCELED';
          case 'expired':   return effStatus(c) === 'EXPIRED';
          case 'no_users':  return (c._count?.users ?? 0) === 0;
          case 'no_sales':  return (c._count?.sales ?? 0) === 0;
          case 'homolog':   return /test|teste|homolog|sandbox|demo|auditoria/i.test(c.name || '');
          case 'recent':    return daysSince(c.createdAt) <= recentDays;
          default:          return true;
        }
      });
    }
    // Text search
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((c: any) =>
        (c?.name ?? '').toLowerCase().includes(q) ||
        (c?.cnpj ?? '').toLowerCase().includes(q) ||
        (c?.plan ?? '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [companies, search, companyFilter, recentDays]);

  /* ─── Selection helpers ─── */
  // empresas selecionáveis (não protegidas) dentro do filtro atual
  const selectableFiltered = useMemo(
    () => filteredCompanies.filter((c: any) => !isProtectedCompany(c)),
    [filteredCompanies]
  );
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const allFilteredSelected = selectableFiltered.length > 0 && selectableFiltered.every((c: any) => selectedSet.has(c.id));

  // Empresas próximas ou no limite de algum recurso (motor de planos — TAREFA 8)
  const companiesAtLimit = useMemo(
    () => (companies ?? []).filter((c: any) => {
      const lv = [c.planUsage?.users?.alertLevel, c.planUsage?.ai?.alertLevel];
      return lv.some((l) => l === 'warning' || l === 'critical' || l === 'limit');
    }).length,
    [companies]
  );

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };
  const toggleAllFiltered = () => {
    if (allFilteredSelected) {
      const filteredSet = new Set(selectableFiltered.map((c: any) => c.id));
      setSelectedIds((prev) => prev.filter((id) => !filteredSet.has(id)));
    } else {
      const ids = new Set(selectedIds);
      selectableFiltered.forEach((c: any) => ids.add(c.id));
      setSelectedIds(Array.from(ids));
    }
  };
  const clearSelection = () => setSelectedIds([]);

  const filteredUsers = useMemo(() => {
    if (!userSearch.trim()) return users;
    const q = userSearch.toLowerCase();
    return users.filter((u: any) =>
      (u?.name ?? '').toLowerCase().includes(q) ||
      (u?.email ?? '').toLowerCase().includes(q) ||
      (u?.company?.name ?? '').toLowerCase().includes(q)
    );
  }, [users, userSearch]);

  /* ─── Edit company ─── */
  const openEdit = (c: any) => {
    setEditCompany({
      id: c.id, name: c.name,
      plan: c.plan || 'trial',
      maxUsers: c.maxUsers ?? 3,
      aiQuotaMonthly: c.aiQuotaMonthly ?? 50,
      subscriptionStatus: c.subscriptionStatus || 'active',
      isActive: c.isActive ?? true,
      trialDays: c.trialDays ?? 14,
      trialEndsAt: c.trialEndsAt,
      createdAt: c.createdAt,
      upgrade: c.upgrade ?? null,
      planUsage: c.planUsage ?? null,
      billing: c.billing ?? null,
    });
    setEditOpen(true);
  };

  const openDelete = (c: any) => {
    setDeleteCompany(c);
    setDeleteConfirm('');
    setDeleteOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteCompany || deleteConfirm !== 'EXCLUIR') return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/master/empresas?id=${deleteCompany.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || 'Empresa excluída');
        setDeleteOpen(false);
        fetchData();
        fetchAnalytics();
      } else {
        toast.error(data.error || 'Erro ao excluir');
      }
    } catch { toast.error('Erro de conexão'); }
    setDeleting(false);
  };

  /* ─── Bulk delete ─── */
  const openBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    setBulkOpen(true);
    setBulkConfirm('');
    setBulkResult(null);
    setBulkPreview(null);
    setBulkLoadingPreview(true);
    try {
      const res = await fetch('/api/master/empresas/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'preview', ids: selectedIds }),
      });
      const data = await res.json();
      if (res.ok) setBulkPreview(data);
      else toast.error(data.error || 'Erro ao calcular prévia');
    } catch { toast.error('Erro de conexão'); }
    setBulkLoadingPreview(false);
  };

  const handleBulkDelete = async () => {
    if (bulkConfirm !== 'EXCLUIR') return;
    setBulkDeleting(true);
    try {
      const res = await fetch('/api/master/empresas/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', ids: selectedIds, confirmText: 'EXCLUIR' }),
      });
      const data = await res.json();
      if (res.ok) {
        setBulkResult(data);
        toast.success(data.message || 'Exclusão concluída');
        clearSelection();
        fetchData();
        fetchAnalytics();
      } else {
        toast.error(data.error || 'Erro ao excluir');
      }
    } catch { toast.error('Erro de conexão'); }
    setBulkDeleting(false);
  };

  /* ─── Quick cleanup (empresas de teste) ─── */
  const openCleanup = async () => {
    setCleanupOpen(true);
    setCleanupConfirm('');
    setCleanupResult(null);
    setCleanupData(null);
    setCleanupLoading(true);
    try {
      const res = await fetch('/api/master/empresas/test-companies');
      const data = await res.json();
      if (res.ok) setCleanupData(data);
      else toast.error(data.error || 'Erro ao detectar empresas de teste');
    } catch { toast.error('Erro de conexão'); }
    setCleanupLoading(false);
  };

  const handleCleanupDelete = async () => {
    if (cleanupConfirm !== 'EXCLUIR' || !cleanupData?.companies?.length) return;
    setCleanupDeleting(true);
    try {
      const ids = cleanupData.companies.map((c: any) => c.id);
      const res = await fetch('/api/master/empresas/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', ids, confirmText: 'EXCLUIR' }),
      });
      const data = await res.json();
      if (res.ok) {
        setCleanupResult(data);
        toast.success(data.message || 'Limpeza concluída');
        fetchData();
        fetchAnalytics();
      } else {
        toast.error(data.error || 'Erro na limpeza');
      }
    } catch { toast.error('Erro de conexão'); }
    setCleanupDeleting(false);
  };

  const saveEdit = async () => {
    if (!editCompany) return;
    setSaving(true);
    try {
      const res = await fetch('/api/master/empresas', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editCompany),
      });
      if (res.ok) {
        toast.success('Empresa atualizada');
        setConfirmSaveOpen(false);
        setEditOpen(false);
        fetchData();
        fetchAnalytics();
      } else {
        const err = await res.json();
        toast.error(err?.error || 'Erro ao salvar');
      }
    } catch { toast.error('Erro de conexão'); }
    setSaving(false);
  };

  /* ─── Reset ─── */
  const handleResetData = async () => {
    if (resetConfirmText !== 'RESETAR') return;
    setResetting(true);
    try {
      const res = await fetch('/api/master/reset-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: 'RESETAR_DADOS_DEMONSTRACAO' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro');
      setResetResult(data);
      toast.success(data.message);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao resetar dados');
    }
    setResetting(false);
  };

  /* ─── Loading / guard ─── */
  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Carregando painel master...</p>
        </div>
      </div>
    );
  }
  if (!session?.user?.isMaster) return null;

  /* ─── Plan bar ─── */
  const total = stats?.totalCompanies || 1;
  const planSegments = ['trial', 'starter', 'pro', 'enterprise'].map(p => ({
    plan: p,
    count: stats?.planCounts?.[p] ?? 0,
    pct: ((stats?.planCounts?.[p] ?? 0) / total) * 100,
  })).filter(s => s.count > 0);
  const barColors: Record<string, string> = {
    trial: 'bg-amber-400', starter: 'bg-blue-500', pro: 'bg-violet-500', enterprise: 'bg-emerald-500',
  };

  return (
    <div className="min-h-screen bg-background">
      {/* ─── Header ─── */}
      <div className="sticky top-0 z-30 border-b bg-background lg:bg-background/80 lg:backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-display font-bold">Painel Master</h1>
              <p className="text-[11px] text-muted-foreground">PUSHY · Administração SaaS</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground hidden sm:block">{session.user.email}</span>
            <Button variant="ghost" size="sm" onClick={() => signOut({ callbackUrl: '/login' })}>
              <LogOut className="w-4 h-4 mr-1" />Sair
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* ─── KPI Grid ─── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard icon={Building2} label="Total Empresas" value={stats?.totalCompanies ?? 0} accent="blue" />
          <KpiCard icon={Activity} label="Ativas" value={stats?.activeCompanies ?? 0} accent="emerald" sub={`${stats?.totalCompanies ? Math.round((stats.activeCompanies / stats.totalCompanies) * 100) : 0}% do total`} />
          <KpiCard icon={Clock} label="Em Trial" value={stats?.trialCompanies ?? 0} accent="amber" sub={stats?.expiringCompanies ? `${stats.expiringCompanies} expirando` : undefined} />
          <KpiCard icon={AlertTriangle} label="Bloqueadas" value={stats?.blockedCompanies ?? 0} accent="red" sub="sem acesso" />
          <KpiCard icon={TrendingUp} label="Novos (30d)" value={stats?.newCompaniesThisMonth ?? 0} accent="violet" />
          <KpiCard icon={Users} label="Usuários" value={stats?.totalUsers ?? 0} accent="blue" />
          <KpiCard icon={ShoppingBag} label="Vendas" value={(stats?.totalSales ?? 0).toLocaleString('pt-BR')} accent="emerald" />
          <KpiCard icon={Bot} label="Chamadas IA" value={(stats?.totalAiCalls ?? 0).toLocaleString('pt-BR')} accent="violet" />
          <KpiCard icon={AlertTriangle} label="No Limite" value={companiesAtLimit} accent={companiesAtLimit > 0 ? 'red' : 'emerald'} sub="uso ≥ 80% de algum recurso" />
        </div>

        {/* ─── Plan distribution bar ─── */}
        {planSegments.length > 0 && (
          <Card className="card-premium">
            <CardContent className="p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 mb-3">Distribuição de Planos</p>
              <div className="flex rounded-full overflow-hidden h-3 bg-muted/30">
                {planSegments.map(s => (
                  <div key={s.plan} className={`${barColors[s.plan]} transition-all`} style={{ width: `${Math.max(s.pct, 2)}%` }} title={`${PLAN_CONFIG[s.plan]?.label}: ${s.count}`} />
                ))}
              </div>
              <div className="flex flex-wrap gap-4 mt-2">
                {planSegments.map(s => (
                  <div key={s.plan} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <div className={`w-2.5 h-2.5 rounded-full ${barColors[s.plan]}`} />
                    {PLAN_CONFIG[s.plan]?.label}: <span className="font-mono font-semibold text-foreground">{s.count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ─── Tabs ─── */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="flex-wrap">
            <TabsTrigger value="empresas"><Building2 className="w-3.5 h-3.5 mr-1.5" />Empresas</TabsTrigger>
            <TabsTrigger value="usuarios"><Users className="w-3.5 h-3.5 mr-1.5" />Usuários</TabsTrigger>
            <TabsTrigger value="analytics"><BarChart3 className="w-3.5 h-3.5 mr-1.5" />Analytics</TabsTrigger>
            <TabsTrigger value="checklist"><ClipboardCheck className="w-3.5 h-3.5 mr-1.5" />Integração</TabsTrigger>
            <TabsTrigger value="logs"><ScrollText className="w-3.5 h-3.5 mr-1.5" />Atividade</TabsTrigger>
            <TabsTrigger value="backup"><DatabaseBackup className="w-3.5 h-3.5 mr-1.5" />Backup</TabsTrigger>
            <TabsTrigger value="demo"><Clapperboard className="w-3.5 h-3.5 mr-1.5" />DEMO</TabsTrigger>
          </TabsList>

          {/* ═══════ TAB: EMPRESAS ═══════ */}
          <TabsContent value="empresas" className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Buscar empresa..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <Button
                variant="outline" size="sm"
                className="border-orange-300 dark:border-orange-800 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950/30"
                onClick={openCleanup}
              >
                <Eraser className="w-3.5 h-3.5 mr-1.5" />Remover empresas de teste
              </Button>
              <span className="text-xs text-muted-foreground sm:ml-auto">{filteredCompanies.length} empresa{filteredCompanies.length !== 1 ? 's' : ''}</span>
            </div>

            {/* Filtros operacionais */}
            <div className="flex flex-wrap items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-muted-foreground" />
              {COMPANY_FILTERS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setCompanyFilter(f.key)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${companyFilter === f.key ? 'bg-blue-500 border-blue-500 text-white' : 'bg-background border-border text-muted-foreground hover:bg-muted/50'}`}
                >
                  {f.label}
                </button>
              ))}
              {companyFilter === 'recent' && (
                <div className="flex items-center gap-1.5 ml-1">
                  <Input
                    type="number" min={1} max={365}
                    value={recentDays}
                    onChange={e => setRecentDays(parseInt(e.target.value) || 7)}
                    className="w-16 h-7 text-xs"
                  />
                  <span className="text-[11px] text-muted-foreground">dias</span>
                </div>
              )}
            </div>

            {/* Barra de ação em massa */}
            {selectedIds.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 p-2.5 rounded-xl border border-red-200 dark:border-red-800/50 bg-red-50/70 dark:bg-red-950/20">
                <ListChecks className="w-4 h-4 text-red-500" />
                <span className="text-sm font-medium text-red-700 dark:text-red-400">
                  {selectedIds.length} empresa{selectedIds.length !== 1 ? 's' : ''} selecionada{selectedIds.length !== 1 ? 's' : ''}
                </span>
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={clearSelection}>
                  <X className="w-3.5 h-3.5 mr-1" />Limpar
                </Button>
                <div className="flex-1" />
                <Button variant="destructive" size="sm" onClick={openBulkDelete}>
                  <Trash2 className="w-3.5 h-3.5 mr-1.5" />Excluir Selecionadas
                </Button>
              </div>
            )}

            <Card className="card-premium overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40px]">
                        <Checkbox
                          checked={allFilteredSelected}
                          onCheckedChange={() => toggleAllFiltered()}
                          aria-label="Selecionar todas as empresas filtradas"
                          disabled={selectableFiltered.length === 0}
                        />
                      </TableHead>
                      <TableHead>Empresa</TableHead>
                      <TableHead className="text-center">Plano</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="text-center hidden lg:table-cell">Trial</TableHead>
                      <TableHead className="text-center"><Users className="w-3.5 h-3.5 inline" /></TableHead>
                      <TableHead className="text-center hidden md:table-cell"><Package className="w-3.5 h-3.5 inline" /></TableHead>
                      <TableHead className="text-center hidden md:table-cell"><UserCheck className="w-3.5 h-3.5 inline" /></TableHead>
                      <TableHead className="text-right hidden lg:table-cell">Faturamento</TableHead>
                      <TableHead className="text-center hidden lg:table-cell"><Bot className="w-3.5 h-3.5 inline" /></TableHead>
                      <TableHead className="text-center w-[50px]"><MessageCircle className="w-3.5 h-3.5 inline text-emerald-500" /></TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCompanies.length === 0 ? (
                      <TableRow><TableCell colSpan={12} className="text-center py-12 text-muted-foreground">Nenhuma empresa encontrada</TableCell></TableRow>
                    ) : filteredCompanies.map((c: any) => {
                      const trialDays = c.plan === 'trial' ? daysUntil(c.trialEndsAt) : null;
                      const waNum = formatWhatsApp(c.whatsapp || c.phone);
                      const prot = isProtectedCompany(c);
                      return (
                        <TableRow key={c.id} className={`group cursor-pointer ${selectedSet.has(c.id) ? 'bg-blue-50/60 dark:bg-blue-950/30' : ''}`} onClick={() => openEdit(c)}>
                          <TableCell onClick={e => e.stopPropagation()}>
                            {prot ? (
                              <span title="Empresa protegida — não pode ser excluída" className="inline-flex items-center justify-center w-4 h-4">
                                <Lock className="w-3.5 h-3.5 text-amber-500" />
                              </span>
                            ) : (
                              <Checkbox
                                checked={selectedSet.has(c.id)}
                                onCheckedChange={() => toggleOne(c.id)}
                                aria-label={`Selecionar ${c.name}`}
                              />
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2.5">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white ${c.isActive ? 'bg-gradient-to-br from-blue-500 to-violet-600' : 'bg-muted-foreground/30'}`}>
                                {(c.name || '?')[0]?.toUpperCase()}
                              </div>
                              <div>
                                <p className="font-medium text-sm leading-tight flex items-center gap-1.5">
                                  {c.name}
                                  {prot && <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />}
                                </p>
                                {c.cnpj && <p className="text-[10px] text-muted-foreground font-mono">{c.cnpj}</p>}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-center"><PlanBadge plan={c.plan || 'trial'} /></TableCell>
                          <TableCell className="text-center">
                            <div className="flex flex-col items-center gap-1">
                              <EffectiveStatusBadge c={c} />
                              {c.billing?.status && c.billing.status !== 'NONE' && (
                                <BillingBadge status={c.billing.status} />
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-center hidden lg:table-cell">
                            <SubscriptionAlertCell c={c} trialDays={trialDays} />
                          </TableCell>
                          <TableCell className="text-center"><UsageCell usage={c.planUsage?.users} fallbackUsed={c._count?.users ?? 0} fallbackLimit={c.maxUsers} /></TableCell>
                          <TableCell className="text-center font-mono text-sm hidden md:table-cell">{c._count?.products ?? 0}</TableCell>
                          <TableCell className="text-center font-mono text-sm hidden md:table-cell">{c._count?.customers ?? 0}</TableCell>
                          <TableCell className="text-right font-mono text-sm hidden lg:table-cell">{formatCurrency(c.totalRevenue ?? 0)}</TableCell>
                          <TableCell className="text-center hidden lg:table-cell"><UsageCell usage={c.planUsage?.ai} fallbackUsed={c.aiCallsThisMonth ?? 0} fallbackLimit={c.aiQuotaMonthly} /></TableCell>
                          <TableCell className="text-center" onClick={e => e.stopPropagation()}>
                            {waNum ? (
                              <a
                                href={`https://wa.me/${waNum}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors"
                                title={`WhatsApp: ${waNum}`}
                              >
                                <MessageCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                              </a>
                            ) : (
                              <span className="text-muted-foreground/40">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => { e.stopPropagation(); openEdit(c); }}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>

          {/* ═══════ TAB: USUÁRIOS ═══════ */}
          <TabsContent value="usuarios" className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Buscar usuário..." className="pl-9" value={userSearch} onChange={e => setUserSearch(e.target.value)} />
              </div>
              <span className="text-xs text-muted-foreground">{filteredUsers.length} usuário{filteredUsers.length !== 1 ? 's' : ''}</span>
            </div>

            <Card className="card-premium overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead className="hidden md:table-cell">Empresa</TableHead>
                      <TableHead className="text-center">Perfil</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="text-center hidden lg:table-cell">Desde</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">Nenhum usuário encontrado</TableCell></TableRow>
                    ) : filteredUsers.map((u: any) => (
                      <TableRow key={u.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${u.isMaster ? 'bg-gradient-to-br from-amber-400 to-orange-500' : 'bg-gradient-to-br from-blue-500 to-violet-500'}`}>
                              {(u.name || '?')[0]?.toUpperCase()}
                            </div>
                            <span className="font-medium text-sm">{u.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                        <TableCell className="text-sm text-muted-foreground hidden md:table-cell">{u.company?.name || '—'}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="text-[10px] capitalize">
                            {u.isMaster ? '⭐ Master' : u.role || '—'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={u.isActive ? 'default' : 'secondary'} className="text-[10px]">
                            {u.isActive ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center text-xs text-muted-foreground hidden lg:table-cell">{formatDate(u.createdAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>

          {/* ═══════ TAB: ANALYTICS ═══════ */}
          <TabsContent value="analytics" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="card-premium">
                <CardContent className="p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 mb-4">Novas Empresas (12 meses)</p>
                  <GrowthChart data={analytics.growth || []} />
                </CardContent>
              </Card>
              <Card className="card-premium">
                <CardContent className="p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 mb-4">Faturamento Plataforma (6 meses)</p>
                  <RevenueChart data={analytics.revenue || []} />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ═══════ TAB: INTEGRAÇÃO CHECKLIST ═══════ */}
          <TabsContent value="checklist" className="space-y-3">
            <p className="text-sm text-muted-foreground">Verificação de configuração de cada empresa — acompanhe a ativação dos seus lojistas.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {(analytics.checklists || []).map((cl: any) => (
                <Card key={cl.id} className="card-premium">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-[10px] font-bold text-white">
                          {(cl.name || '?')[0]?.toUpperCase()}
                        </div>
                        <p className="font-medium text-sm">{cl.name}</p>
                      </div>
                      <Badge variant={cl.pct === 100 ? 'default' : 'outline'} className="text-[10px] font-mono">
                        {cl.completed}/{cl.total} ({cl.pct}%)
                      </Badge>
                    </div>
                    {/* Progress bar */}
                    <div className="h-1.5 rounded-full bg-muted/30 mb-3">
                      <div
                        className={`h-full rounded-full transition-all ${cl.pct === 100 ? 'bg-emerald-500' : cl.pct >= 50 ? 'bg-blue-500' : 'bg-amber-400'}`}
                        style={{ width: `${cl.pct}%` }}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                      {(cl.items || []).map((item: any) => (
                        <div key={item.key} className="flex items-center gap-1.5 text-xs">
                          {item.done
                            ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                            : <Circle className="w-3.5 h-3.5 text-muted-foreground/30 flex-shrink-0" />
                          }
                          <span className={item.done ? 'text-foreground' : 'text-muted-foreground/60'}>{item.label}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
              {(analytics.checklists || []).length === 0 && (
                <p className="text-sm text-muted-foreground col-span-2 text-center py-12">Nenhuma empresa cadastrada ainda</p>
              )}
            </div>
          </TabsContent>

          {/* ═══════ TAB: ACTIVITY LOGS ═══════ */}
          <TabsContent value="logs" className="space-y-3">
            <p className="text-sm text-muted-foreground">Últimas atividades na plataforma</p>
            <Card className="card-premium overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ação</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="hidden md:table-cell">Empresa</TableHead>
                      <TableHead className="hidden md:table-cell">Usuário</TableHead>
                      <TableHead className="text-right">Quando</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(analytics.logs || []).length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground">Nenhuma atividade registrada</TableCell></TableRow>
                    ) : (analytics.logs || []).map((log: any) => {
                      const actionCfg = ACTION_LABELS[log.action] || { label: log.action, color: 'bg-slate-100 text-slate-600 dark:bg-slate-900/40 dark:text-slate-400' };
                      return (
                        <TableRow key={log.id}>
                          <TableCell>
                            <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold ${actionCfg.color}`}>
                              {actionCfg.label}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm max-w-[300px] truncate">{log.description}</TableCell>
                          <TableCell className="text-sm text-muted-foreground hidden md:table-cell">{log.company?.name || '—'}</TableCell>
                          <TableCell className="text-sm text-muted-foreground hidden md:table-cell">{log.userName || '—'}</TableCell>
                          <TableCell className="text-right text-xs text-muted-foreground whitespace-nowrap">{formatDateTime(log.createdAt)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="backup" className="space-y-3">
            <BackupPanel companies={companies} />
          </TabsContent>

          <TabsContent value="demo" className="space-y-3">
            <DemoPanel />
          </TabsContent>
        </Tabs>

        {/* ─── Reset Section ─── */}
        <Card className="border-red-200 dark:border-red-900/40 bg-red-50/50 dark:bg-red-950/20">
          <CardContent className="p-5">
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5 text-red-500" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-display font-bold text-sm">Resetar Dados de Demonstração</h3>
                <p className="text-muted-foreground text-xs mt-0.5">
                  Remove dados fictícios mantendo estrutura, usuários e configurações.
                </p>
                <p className="text-red-500 text-[10px] mt-1 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Ação irreversível.
                </p>
              </div>
              <Button
                variant="outline" size="sm"
                className="border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 flex-shrink-0"
                onClick={() => { setResetDialogOpen(true); setResetConfirmText(''); setResetResult(null); }}
              >
                <Trash2 className="w-3.5 h-3.5 mr-1.5" />Resetar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ─── Edit Company Dialog ─── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center">
                <Building2 className="w-4 h-4 text-white" />
              </div>
              {editCompany?.name || 'Empresa'}
            </DialogTitle>
          </DialogHeader>
          {editCompany && (
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Plano</Label>
                  <Select value={editCompany.plan} onValueChange={v => setEditCompany({ ...editCompany, plan: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="trial">🕐 Trial</SelectItem>
                      <SelectItem value="starter">⚡ Organização — R$ 39,90</SelectItem>
                      <SelectItem value="pro">👑 Evolução — R$ 57,00</SelectItem>
                      <SelectItem value="enterprise">✨ Expansão — R$ 97,00</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Status Assinatura</Label>
                  <Select value={editCompany.subscriptionStatus} onValueChange={v => setEditCompany({ ...editCompany, subscriptionStatus: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">✅ Ativo</SelectItem>
                      <SelectItem value="suspended">⏸ Suspenso</SelectItem>
                      <SelectItem value="canceled">❌ Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Trial Days — only visible when plan is trial */}
              {editCompany.plan === 'trial' && (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 space-y-2">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-500" />
                    <Label className="text-xs font-semibold text-amber-700 dark:text-amber-400">Período de Teste</Label>
                  </div>
                  <div className="flex items-center gap-3">
                    <Input
                      type="number"
                      min={1}
                      max={365}
                      value={editCompany.trialDays}
                      onChange={e => setEditCompany({ ...editCompany, trialDays: parseInt(e.target.value) || 14 })}
                      className="w-24"
                    />
                    <span className="text-xs text-muted-foreground">dias</span>
                    {editCompany.trialEndsAt && (
                      <span className="text-[10px] text-muted-foreground ml-auto">
                        Expira em: {formatDate(editCompany.trialEndsAt)}
                        {(() => {
                          const d = daysUntil(editCompany.trialEndsAt);
                          if (d === null) return '';
                          if (d <= 0) return ' (Expirado)';
                          return ` (${d}d restantes)`;
                        })()}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-amber-600 dark:text-amber-500">
                    Alterar os dias recalcula a data de expiração a partir da data de cadastro
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Máx. Usuários</Label>
                  <Input type="number" min={1} value={editCompany.maxUsers} onChange={e => setEditCompany({ ...editCompany, maxUsers: parseInt(e.target.value) || 1 })} />
                  {editCompany.plan === 'trial' && (
                    <p className="text-[10px] text-muted-foreground">Ilimitado durante trial (limite aplicado após escolher plano)</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Cota IA / mês</Label>
                  <Input type="number" min={0} value={editCompany.aiQuotaMonthly} onChange={e => setEditCompany({ ...editCompany, aiQuotaMonthly: parseInt(e.target.value) || 0 })} />
                </div>
              </div>
              {/* Recomendação de upgrade (PRIORIDADE 8.3 / TAREFA 6) */}
              <div className="p-3 rounded-xl bg-muted/30 border border-border/60 space-y-2">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-violet-500" />
                  <Label className="text-xs font-semibold">Recomendação comercial</Label>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Plano atual</p>
                    <p className="font-semibold">{PLAN_CONFIG[editCompany.plan]?.label || editCompany.plan}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Plano recomendado</p>
                    <p className="font-semibold">
                      {editCompany.upgrade?.shouldUpgrade && editCompany.upgrade?.recommendedPlanLabel
                        ? editCompany.upgrade.recommendedPlanLabel
                        : '— (adequado)'}
                    </p>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  <span className="font-medium text-foreground/80">Motivo: </span>
                  {editCompany.upgrade?.reason
                    || editCompany.upgrade?.alertMessage
                    || 'O consumo atual está dentro dos limites do plano. Nenhum upgrade necessário.'}
                </p>
              </div>

              {/* Cobrança / Assinatura (P8.4) — somente leitura. Fonte: billing-engine. */}
              {editCompany.billing && editCompany.billing.status !== 'NONE' && (
                <div className="p-3 rounded-xl bg-muted/30 border border-border/60 space-y-2">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-emerald-500" />
                    <Label className="text-xs font-semibold">Cobrança &amp; Assinatura</Label>
                    <span className="ml-auto"><BillingBadge status={editCompany.billing.status} /></span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Próxima cobrança</p>
                      <p className="font-medium">{formatDate(editCompany.billing.subscription?.nextBillingDate)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Último pagamento</p>
                      <p className="font-medium">{formatDate(editCompany.billing.subscription?.lastPaymentDate)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Valor mensal</p>
                      <p className="font-medium">{typeof editCompany.billing.subscription?.priceAmount === 'number' ? formatCurrency(editCompany.billing.subscription.priceAmount) : '—'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Forma de pagamento</p>
                      <p className="font-medium">{editCompany.billing.subscription?.paymentMethodBrand ? `${editCompany.billing.subscription.paymentMethodBrand}${editCompany.billing.subscription.paymentMethodLast4 ? ' ••••' + editCompany.billing.subscription.paymentMethodLast4 : ''}` : '—'}</p>
                    </div>
                  </div>
                  {editCompany.billing.status === 'PAST_DUE' && typeof editCompany.billing.graceDaysRemaining === 'number' && (
                    <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                      Em período de tolerância — {editCompany.billing.graceDaysRemaining} dia(s) restante(s) antes da suspensão.
                    </p>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30">
                <div>
                  <p className="text-sm font-medium">Empresa Ativa</p>
                  <p className="text-[10px] text-muted-foreground">Desativar bloqueia acesso de todos os usuários</p>
                </div>
                <Switch checked={editCompany.isActive} onCheckedChange={v => setEditCompany({ ...editCompany, isActive: v })} />
              </div>
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-red-500 border-red-200 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950/30"
                  onClick={() => { setEditOpen(false); openDelete(editCompany); }}
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" />Excluir
                </Button>
                <div className="flex-1" />
                <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
                <Button className="bg-gradient-to-r from-blue-500 to-violet-600 hover:from-blue-600 hover:to-violet-700 text-white" onClick={() => setConfirmSaveOpen(true)} disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ChevronRight className="w-4 h-4 mr-1" />}
                  {saving ? 'Salvando...' : 'Salvar'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Confirm Save Dialog (P8.5A — confirmação obrigatória) ─── */}
      <Dialog open={confirmSaveOpen} onOpenChange={(o) => { if (!saving) setConfirmSaveOpen(o); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-blue-600" />
              Confirmar alteração
            </DialogTitle>
          </DialogHeader>
          {editCompany && (
            <div className="space-y-4 pt-1">
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 dark:border-amber-700/40 bg-amber-50 dark:bg-amber-900/20 px-3 py-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-800 dark:text-amber-300">
                  Você está prestes a salvar alterações administrativas nesta empresa. Revise os dados abaixo antes de confirmar.
                </p>
              </div>

              <div className="rounded-lg border border-border divide-y divide-border">
                <div className="flex items-center justify-between px-3 py-2.5">
                  <span className="text-xs text-muted-foreground">Empresa</span>
                  <span className="text-sm font-semibold text-right">{editCompany.name || '—'}</span>
                </div>
                <div className="flex items-center justify-between px-3 py-2.5">
                  <span className="text-xs text-muted-foreground">Plano</span>
                  <span className="text-sm font-semibold text-right">{PLAN_CONFIG[editCompany.plan]?.label || editCompany.plan}</span>
                </div>
                <div className="flex items-center justify-between px-3 py-2.5">
                  <span className="text-xs text-muted-foreground">Status da assinatura</span>
                  <span className="text-sm font-semibold text-right">{STATUS_CONFIG[editCompany.subscriptionStatus]?.label || editCompany.subscriptionStatus}</span>
                </div>
              </div>

              <p className="text-sm font-medium text-center">Confirma a alteração?</p>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setConfirmSaveOpen(false)} disabled={saving}>Cancelar</Button>
                <Button className="flex-1 bg-gradient-to-r from-blue-500 to-violet-600 hover:from-blue-600 hover:to-violet-700 text-white" onClick={saveEdit} disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1.5" />}
                  {saving ? 'Salvando...' : 'Confirmar'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Delete Company Dialog ─── */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="w-5 h-5" />Excluir Empresa
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl p-4 text-sm space-y-2">
              <p className="font-semibold text-red-800 dark:text-red-300">
                Você está prestes a excluir permanentemente:
              </p>
              <p className="text-red-700 dark:text-red-400 font-bold text-lg">
                {deleteCompany?.name}
              </p>
              <p className="text-red-600 dark:text-red-400 text-xs">
                Todos os dados serão removidos: usuários, vendas, produtos, financeiro, clientes, estoque, etc.
              </p>
              <p className="text-red-500 text-[10px] flex items-center gap-1 mt-2">
                <AlertTriangle className="w-3 h-3" /> Esta ação é irreversível!
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                Digite <strong className="text-red-600">EXCLUIR</strong> para confirmar:
              </p>
              <Input
                value={deleteConfirm}
                onChange={e => setDeleteConfirm(e.target.value)}
                placeholder="Digite EXCLUIR"
                className="font-mono"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setDeleteOpen(false)}>Cancelar</Button>
              <Button
                variant="destructive"
                className="flex-1"
                disabled={deleteConfirm !== 'EXCLUIR' || deleting}
                onClick={handleDelete}
              >
                {deleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                {deleting ? 'Excluindo...' : 'Excluir Permanentemente'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Reset Dialog ─── */}
      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />Confirmar Reset de Dados
            </DialogTitle>
          </DialogHeader>
          {!resetResult ? (
            <div className="space-y-4">
              <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl p-4 text-sm space-y-2">
                <p className="font-semibold text-red-800 dark:text-red-300">Serão removidos:</p>
                <ul className="text-red-700 dark:text-red-400 space-y-0.5 text-xs">
                  <li>• Produtos, categorias e variações</li>
                  <li>• Clientes, fornecedores e transportadoras</li>
                  <li>• Vendas, financeiro, contas</li>
                  <li>• Caixas, vendedores, estoque, IA</li>
                </ul>
                <p className="font-semibold text-emerald-800 dark:text-emerald-300 mt-3">Serão mantidos:</p>
                <ul className="text-emerald-700 dark:text-emerald-400 space-y-0.5 text-xs">
                  <li>✓ Empresa, usuários, estrutura</li>
                </ul>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-2">Digite <strong className="text-red-600">RESETAR</strong> para confirmar:</p>
                <Input value={resetConfirmText} onChange={e => setResetConfirmText(e.target.value)} placeholder="Digite RESETAR" className="font-mono" />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setResetDialogOpen(false)}>Cancelar</Button>
                <Button variant="destructive" className="flex-1" disabled={resetConfirmText !== 'RESETAR' || resetting} onClick={handleResetData}>
                  {resetting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                  {resetting ? 'Removendo...' : 'Confirmar Reset'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4">
                <p className="font-semibold text-emerald-800 dark:text-emerald-300 mb-2">✅ Limpeza concluída!</p>
                <p className="text-sm text-emerald-700 dark:text-emerald-400">{resetResult.message}</p>
              </div>
              <div className="bg-muted/30 rounded-xl p-4 text-xs space-y-1">
                <p className="font-semibold text-sm mb-2">Detalhes:</p>
                {Object.entries(resetResult.details || {}).map(([key, val]) => (
                  <div key={key} className="flex justify-between text-muted-foreground">
                    <span>{key}</span>
                    <span className="font-mono">{String(val)} removidos</span>
                  </div>
                ))}
              </div>
              <Button className="w-full" onClick={() => setResetDialogOpen(false)}>Fechar</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Bulk Delete Dialog ─── */}
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="w-5 h-5" />Excluir Empresas Selecionadas
            </DialogTitle>
          </DialogHeader>
          {!bulkResult ? (
            <div className="space-y-4">
              {bulkLoadingPreview ? (
                <div className="flex items-center justify-center py-10 text-muted-foreground">
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Calculando impacto...
                </div>
              ) : bulkPreview ? (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl p-3 text-center">
                      <p className="text-2xl font-bold text-red-600">{bulkPreview.companies ?? 0}</p>
                      <p className="text-[10px] text-red-500 uppercase tracking-wide">Empresas</p>
                    </div>
                    <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl p-3 text-center">
                      <p className="text-2xl font-bold text-red-600">{bulkPreview.users ?? 0}</p>
                      <p className="text-[10px] text-red-500 uppercase tracking-wide">Usuários</p>
                    </div>
                    <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl p-3 text-center">
                      <p className="text-2xl font-bold text-red-600">{bulkPreview.totalRecords ?? 0}</p>
                      <p className="text-[10px] text-red-500 uppercase tracking-wide">Registros</p>
                    </div>
                  </div>
                  {bulkPreview.deletable?.length > 0 && (
                    <div className="max-h-40 overflow-y-auto rounded-xl border border-border/60 divide-y divide-border/40">
                      {bulkPreview.deletable.map((c: any) => (
                        <div key={c.id} className="flex items-center justify-between px-3 py-1.5 text-xs">
                          <span className="font-medium truncate">{c.name}</span>
                          <span className="text-muted-foreground font-mono shrink-0 ml-2">{c.users ?? 0}u · {c.totalRecords ?? 0}r</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {bulkPreview.protected?.length > 0 && (
                    <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-3 text-xs">
                      <p className="font-semibold text-amber-700 dark:text-amber-300 flex items-center gap-1 mb-1">
                        <ShieldCheck className="w-3.5 h-3.5" /> {bulkPreview.protected.length} empresa(s) protegida(s) serão ignoradas
                      </p>
                      <p className="text-amber-600 dark:text-amber-400">{bulkPreview.protected.map((c: any) => c.name).join(', ')}</p>
                    </div>
                  )}
                  <p className="text-red-500 text-[11px] flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Ação irreversível. Todos os dados das empresas listadas serão removidos.
                  </p>
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Digite <strong className="text-red-600">EXCLUIR</strong> para confirmar:</p>
                    <Input value={bulkConfirm} onChange={e => setBulkConfirm(e.target.value)} placeholder="Digite EXCLUIR" className="font-mono" />
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={() => setBulkOpen(false)}>Cancelar</Button>
                    <Button variant="destructive" className="flex-1" disabled={bulkConfirm !== 'EXCLUIR' || bulkDeleting || (bulkPreview.deletable?.length ?? 0) === 0} onClick={handleBulkDelete}>
                      {bulkDeleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                      {bulkDeleting ? 'Excluindo...' : `Excluir ${bulkPreview.deletable?.length ?? 0}`}
                    </Button>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground py-6 text-center">Nenhuma prévia disponível.</p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4">
                <p className="font-semibold text-emerald-800 dark:text-emerald-300 mb-1">✅ {bulkResult.message}</p>
                <div className="text-xs text-emerald-700 dark:text-emerald-400 space-y-0.5 mt-2">
                  <p>Excluídas: <strong>{bulkResult.deletedCount ?? 0}</strong></p>
                  {(bulkResult.skippedProtectedCount ?? 0) > 0 && <p>Ignoradas (protegidas): <strong>{bulkResult.skippedProtectedCount}</strong></p>}
                  {(bulkResult.failedCount ?? 0) > 0 && <p className="text-red-600">Falhas: <strong>{bulkResult.failedCount}</strong></p>}
                </div>
              </div>
              {bulkResult.failed?.length > 0 && (
                <div className="max-h-32 overflow-y-auto rounded-xl border border-red-200 dark:border-red-800 divide-y divide-red-100 dark:divide-red-900">
                  {bulkResult.failed.map((f: any) => (
                    <div key={f.id} className="px-3 py-1.5 text-xs">
                      <span className="font-medium">{f.name || f.id}</span>
                      <span className="text-red-500 ml-2">{f.error}</span>
                    </div>
                  ))}
                </div>
              )}
              <Button className="w-full" onClick={() => setBulkOpen(false)}>Fechar</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Quick Cleanup (empresas de teste) Dialog ─── */}
      <Dialog open={cleanupOpen} onOpenChange={setCleanupOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-orange-600">
              <Eraser className="w-5 h-5" />Remover Empresas de Teste
            </DialogTitle>
          </DialogHeader>
          {!cleanupResult ? (
            <div className="space-y-4">
              {cleanupLoading ? (
                <div className="flex items-center justify-center py-10 text-muted-foreground">
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Detectando empresas de teste...
                </div>
              ) : cleanupData ? (
                <>
                  <div className="bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded-xl p-3 text-xs space-y-1">
                    <p className="font-semibold text-orange-700 dark:text-orange-300">
                      Critérios: nome contém {(cleanupData.patterns || []).join(', ')} ou sem faturamento e sem vendas.
                    </p>
                    <p className="text-orange-600 dark:text-orange-400">Empresas protegidas nunca são incluídas. Revise antes de confirmar.</p>
                  </div>
                  {cleanupData.count > 0 ? (
                    <>
                      <p className="text-sm font-medium">{cleanupData.count} empresa(s) candidata(s):</p>
                      <div className="max-h-52 overflow-y-auto rounded-xl border border-border/60 divide-y divide-border/40">
                        {cleanupData.companies.map((c: any) => (
                          <div key={c.id} className="flex items-center justify-between px-3 py-1.5 text-xs gap-2">
                            <div className="min-w-0">
                              <p className="font-medium truncate">{c.name}</p>
                              <p className="text-[10px] text-muted-foreground">{c.reason}</p>
                            </div>
                            <span className="text-muted-foreground font-mono shrink-0">{c.users ?? 0}u · {c.sales ?? 0}v</span>
                          </div>
                        ))}
                      </div>
                      <p className="text-red-500 text-[11px] flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> Ação irreversível. Todos os dados destas empresas serão removidos.
                      </p>
                      <div>
                        <p className="text-sm text-muted-foreground mb-2">Digite <strong className="text-red-600">EXCLUIR</strong> para confirmar:</p>
                        <Input value={cleanupConfirm} onChange={e => setCleanupConfirm(e.target.value)} placeholder="Digite EXCLUIR" className="font-mono" />
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" className="flex-1" onClick={() => setCleanupOpen(false)}>Cancelar</Button>
                        <Button variant="destructive" className="flex-1" disabled={cleanupConfirm !== 'EXCLUIR' || cleanupDeleting} onClick={handleCleanupDelete}>
                          {cleanupDeleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                          {cleanupDeleting ? 'Removendo...' : `Remover ${cleanupData.count}`}
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-6">
                      <p className="text-sm text-muted-foreground">Nenhuma empresa de teste detectada. 🎉</p>
                      <Button className="mt-4" variant="outline" onClick={() => setCleanupOpen(false)}>Fechar</Button>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground py-6 text-center">Nenhum dado disponível.</p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4">
                <p className="font-semibold text-emerald-800 dark:text-emerald-300 mb-1">✅ {cleanupResult.message}</p>
                <div className="text-xs text-emerald-700 dark:text-emerald-400 space-y-0.5 mt-2">
                  <p>Removidas: <strong>{cleanupResult.deletedCount ?? 0}</strong></p>
                  {(cleanupResult.failedCount ?? 0) > 0 && <p className="text-red-600">Falhas: <strong>{cleanupResult.failedCount}</strong></p>}
                </div>
              </div>
              <Button className="w-full" onClick={() => setCleanupOpen(false)}>Fechar</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}