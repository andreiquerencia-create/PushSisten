'use client';

import { useState, useEffect, useCallback } from 'react';
import { AppHeader } from '@/components/app-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Zap, Play, Clock, Users, Package, DollarSign, ShoppingCart,
  AlertTriangle, Bell, MessageSquare, FileText, CheckCircle2, XCircle,
  RefreshCw, ListChecks, Sparkles, Settings, History, Inbox,
} from 'lucide-react';
import { toast } from 'sonner';

// ============================================================
// Metadados de apresentação — tipos REAIS do Automation Engine.
// ============================================================
const TYPE_META: Record<string, { label: string; icon: any; color: string }> = {
  ALERTA_INTERNO: { label: 'Alerta interno', icon: Bell, color: 'bg-rose-100 text-rose-700' },
  CLIENTE_INATIVO: { label: 'Cliente inativo', icon: Users, color: 'bg-violet-100 text-violet-700' },
  COBRANCA_CREDIARIO: { label: 'Cobrança crediário', icon: DollarSign, color: 'bg-amber-100 text-amber-700' },
  PRODUTO_PARADO: { label: 'Produto parado', icon: Package, color: 'bg-blue-100 text-blue-700' },
  ESTOQUE_BAIXO: { label: 'Estoque baixo', icon: AlertTriangle, color: 'bg-orange-100 text-orange-700' },
  RELATORIO_GERENCIAL: { label: 'Relatório gerencial', icon: FileText, color: 'bg-emerald-100 text-emerald-700' },
};

const SEVERITY_META: Record<string, { label: string; color: string }> = {
  ALTO: { label: 'Alta', color: 'bg-red-100 text-red-700 border-red-200' },
  MEDIO: { label: 'Média', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  BAIXO: { label: 'Baixa', color: 'bg-slate-100 text-slate-600 border-slate-200' },
};

const STATUS_META: Record<string, { label: string; color: string }> = {
  PENDENTE: { label: 'Pendente', color: 'bg-blue-100 text-blue-700' },
  EXECUTADO: { label: 'Executado', color: 'bg-emerald-100 text-emerald-700' },
  IGNORADO: { label: 'Ignorado', color: 'bg-slate-100 text-slate-600' },
  ERRO: { label: 'Erro', color: 'bg-red-100 text-red-700' },
};

const CHANNEL_META: Record<string, { label: string; icon: any }> = {
  INTERNO: { label: 'Painel interno', icon: Bell },
  WHATSAPP: { label: 'WhatsApp (sugestão)', icon: MessageSquare },
  EMAIL: { label: 'E-mail (sugestão)', icon: FileText },
};

interface AutomationAction {
  id: string;
  type: string;
  status: string;
  severity: string;
  reference: string;
  title: string;
  description: string;
  channel: string;
  payload: Record<string, any> | null;
  insightCode: string | null;
  pushScoreImpact: number;
  date: string;
  executedAt: string | null;
  error: string | null;
  createdAt: string;
}

interface Stats {
  totalActions: number;
  byStatus: Record<string, number>;
  totalRuns: number;
  lastRun: string | null;
  lastRunBy: string | null;
}

// Configuração legada (lojista liga/desliga — NÃO executa nada).
interface AutomationConfig {
  id: string;
  name: string;
  description: string | null;
  category: string;
  isActive: boolean;
}

const catLabels: Record<string, string> = { crm: 'CRM', stock: 'Estoque', financial: 'Financeiro', commercial: 'Comercial', general: 'Geral' };

function fmtDateTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function AutomacoesContent() {
  const [actions, setActions] = useState<AutomationAction[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('PENDENTE');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // Aba de configurações (legado).
  const [configs, setConfigs] = useState<AutomationConfig[]>([]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/automation/stats');
      if (res.ok) setStats(await res.json());
    } catch (e) { console.error(e); }
  }, []);

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('status', statusFilter);
      if (typeFilter !== 'all') params.set('type', typeFilter);
      params.set('limit', '200');
      const res = await fetch(`/api/automation/queue?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setActions(data.actions ?? []);
      }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [statusFilter, typeFilter]);

  const fetchConfigs = useCallback(async () => {
    try {
      const res = await fetch('/api/automacoes');
      if (res.ok) {
        const data = await res.json();
        setConfigs(data.automations ?? []);
      }
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => { fetchQueue(); }, [fetchQueue]);
  useEffect(() => { fetchStats(); fetchConfigs(); }, [fetchStats, fetchConfigs]);

  const runAutomations = useCallback(async () => {
    setRunning(true);
    try {
      const res = await fetch('/api/automation/run', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message ?? 'Automações processadas.');
        await Promise.all([fetchQueue(), fetchStats()]);
      } else {
        toast.error(data.error ?? 'Erro ao gerar automações.');
      }
    } catch (e) { console.error(e); toast.error('Erro ao gerar automações.'); }
    finally { setRunning(false); }
  }, [fetchQueue, fetchStats]);

  const updateStatus = useCallback(async (id: string, status: 'EXECUTADO' | 'IGNORADO') => {
    setUpdatingId(id);
    try {
      const res = await fetch(`/api/automation/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        toast.success(status === 'EXECUTADO' ? 'Ação marcada como executada.' : 'Ação ignorada.');
        await Promise.all([fetchQueue(), fetchStats()]);
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? 'Erro ao atualizar ação.');
      }
    } catch (e) { console.error(e); toast.error('Erro ao atualizar ação.'); }
    finally { setUpdatingId(null); }
  }, [fetchQueue, fetchStats]);

  const toggleConfig = useCallback(async (id: string, isActive: boolean) => {
    try {
      await fetch('/api/automacoes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, isActive: !isActive }),
      });
      toast.success(isActive ? 'Categoria pausada' : 'Categoria ativada');
      fetchConfigs();
    } catch (e) { console.error(e); }
  }, [fetchConfigs]);

  const byStatus = stats?.byStatus ?? {};

  return (
    <div className="min-h-screen">
      <AppHeader title="Automações Comerciais" />
      <div className="p-4 lg:p-6 space-y-6">

        {/* Cabeçalho + ação principal */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              <h2 className="font-display font-bold text-lg">Fila inteligente de ações</h2>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              Ações priorizadas pela IA Gerente a partir dos insights oficiais. Marcar como executado apenas registra a decisão — nenhuma mensagem é enviada automaticamente.
            </p>
          </div>
          <Button onClick={runAutomations} disabled={running} className="gap-2 shrink-0">
            {running ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Gerar automações do dia
          </Button>
        </div>

        {/* Resumo real */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><Inbox className="w-3.5 h-3.5" />Pendentes</div>
              <p className="num-highlight text-2xl font-bold text-blue-600">{byStatus.PENDENTE ?? 0}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><CheckCircle2 className="w-3.5 h-3.5" />Executadas</div>
              <p className="num-highlight text-2xl font-bold text-emerald-600">{byStatus.EXECUTADO ?? 0}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><XCircle className="w-3.5 h-3.5" />Ignoradas</div>
              <p className="num-highlight text-2xl font-bold text-slate-500">{byStatus.IGNORADO ?? 0}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><History className="w-3.5 h-3.5" />Última geração</div>
              <p className="text-sm font-semibold">{fmtDateTime(stats?.lastRun ?? null)}</p>
              <p className="text-[10px] text-muted-foreground">{stats?.totalRuns ?? 0} execução(ões) registradas</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="fila" className="w-full">
          <TabsList>
            <TabsTrigger value="fila" className="gap-1.5"><ListChecks className="w-4 h-4" />Fila de ações</TabsTrigger>
            <TabsTrigger value="config" className="gap-1.5"><Settings className="w-4 h-4" />Configurações</TabsTrigger>
          </TabsList>

          {/* ===================== FILA REAL ===================== */}
          <TabsContent value="fila" className="space-y-4 mt-4">
            {/* Filtros */}
            <div className="flex flex-wrap items-center gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px] h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PENDENTE">Pendentes</SelectItem>
                  <SelectItem value="EXECUTADO">Executadas</SelectItem>
                  <SelectItem value="IGNORADO">Ignoradas</SelectItem>
                  <SelectItem value="ERRO">Com erro</SelectItem>
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[200px] h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  {Object.entries(TYPE_META).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={() => { fetchQueue(); fetchStats(); }}>
                <RefreshCw className="w-3.5 h-3.5" />Atualizar
              </Button>
            </div>

            {loading ? (
              <Card className="border-0 shadow-sm"><CardContent className="p-10 text-center text-sm text-muted-foreground">Carregando fila…</CardContent></Card>
            ) : actions.length === 0 ? (
              <Card className="border-0 shadow-sm"><CardContent className="p-10 text-center">
                <Zap className="w-12 h-12 mx-auto mb-3 text-amber-500 opacity-50" />
                <h3 className="font-display font-bold text-lg mb-1">Nenhuma ação nesta visão</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {statusFilter === 'PENDENTE'
                    ? 'Clique em "Gerar automações do dia" para a IA priorizar as próximas ações.'
                    : 'Nenhuma ação encontrada para o filtro selecionado.'}
                </p>
                {statusFilter === 'PENDENTE' && (
                  <Button onClick={runAutomations} disabled={running} variant="outline" className="gap-2">
                    <Play className="w-4 h-4" />Gerar automações do dia
                  </Button>
                )}
              </CardContent></Card>
            ) : (
              <div className="space-y-3">
                {actions.map((a) => {
                  const meta = TYPE_META[a.type] ?? { label: a.type, icon: Zap, color: 'bg-slate-100 text-slate-700' };
                  const Icon = meta.icon;
                  const sev = SEVERITY_META[a.severity] ?? SEVERITY_META.BAIXO;
                  const st = STATUS_META[a.status] ?? STATUS_META.PENDENTE;
                  const ch = CHANNEL_META[a.channel] ?? CHANNEL_META.INTERNO;
                  const ChIcon = ch.icon;
                  const suggested = a.payload?.mensagemSugerida;
                  return (
                    <Card key={a.id} className="border-0 shadow-sm stagger-item">
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${meta.color}`}>
                            <Icon className="w-5 h-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <h4 className="font-semibold text-sm">{a.title}</h4>
                              <Badge variant="outline" className="text-[10px]">{meta.label}</Badge>
                              <Badge className={`text-[10px] border ${sev.color}`}>{sev.label}</Badge>
                              <Badge className={`text-[10px] ${st.color}`}>{st.label}</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mb-2">{a.description}</p>

                            {suggested && (
                              <div className="text-xs bg-muted/60 rounded-lg p-2.5 mb-2 border border-border/50">
                                <span className="font-medium flex items-center gap-1 mb-0.5"><MessageSquare className="w-3 h-3" />Mensagem sugerida</span>
                                <p className="text-muted-foreground whitespace-pre-line">{suggested}</p>
                              </div>
                            )}

                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
                              <span className="flex items-center gap-1"><ChIcon className="w-3 h-3" />{ch.label}</span>
                              {a.insightCode && <span className="bg-muted px-1.5 py-0.5 rounded font-code">{a.insightCode}</span>}
                              <span>Ref: {a.reference}</span>
                              {a.pushScoreImpact > 0 && <span className="text-emerald-600">Impacto Push Score: +{a.pushScoreImpact}</span>}
                              <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{fmtDateTime(a.createdAt)}</span>
                              {a.executedAt && <span>Concluída: {fmtDateTime(a.executedAt)}</span>}
                            </div>
                            {a.status === 'ERRO' && a.error && (
                              <p className="text-[11px] text-red-600 mt-1.5">Erro: {a.error}</p>
                            )}
                          </div>

                          {a.status === 'PENDENTE' && (
                            <div className="flex flex-col gap-1.5 shrink-0">
                              <Button size="sm" className="h-8 gap-1.5" disabled={updatingId === a.id} onClick={() => updateStatus(a.id, 'EXECUTADO')}>
                                <CheckCircle2 className="w-3.5 h-3.5" />Executar
                              </Button>
                              <Button size="sm" variant="outline" className="h-8 gap-1.5" disabled={updatingId === a.id} onClick={() => updateStatus(a.id, 'IGNORADO')}>
                                <XCircle className="w-3.5 h-3.5" />Ignorar
                              </Button>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* ===================== CONFIGURAÇÕES (LEGADO) ===================== */}
          <TabsContent value="config" className="space-y-4 mt-4">
            <Card className="border-0 shadow-sm bg-muted/30">
              <CardContent className="p-4 text-sm text-muted-foreground flex items-start gap-2">
                <Settings className="w-4 h-4 mt-0.5 shrink-0" />
                <span>
                  Preferências de categorias de automação da sua loja. Ative ou pause categorias para indicar o foco do negócio.
                  A priorização e geração das ações é feita automaticamente pela IA Gerente na aba <strong>Fila de ações</strong>.
                </span>
              </CardContent>
            </Card>

            {configs.length === 0 ? (
              <Card className="border-0 shadow-sm"><CardContent className="p-8 text-center text-sm text-muted-foreground">
                Nenhuma preferência de categoria configurada.
              </CardContent></Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {configs.map((c) => (
                  <Card key={c.id} className={`border-0 shadow-sm ${!c.isActive ? 'opacity-60' : ''}`}>
                    <CardContent className="p-4 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <h4 className="font-semibold text-sm truncate">{c.name}</h4>
                          <Badge variant="outline" className="text-[10px]">{catLabels[c.category] ?? c.category}</Badge>
                        </div>
                        {c.description && <p className="text-xs text-muted-foreground truncate">{c.description}</p>}
                      </div>
                      <Switch checked={c.isActive} onCheckedChange={() => toggleConfig(c.id, c.isActive)} />
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
