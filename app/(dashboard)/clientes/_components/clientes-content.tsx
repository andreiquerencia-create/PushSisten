'use client';

import { useState, useEffect, useCallback } from 'react';
import { AppHeader } from '@/components/app-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Plus, Search, Users, Edit, Trash2, ChevronLeft, ChevronRight, Phone, MapPin, TrendingUp, BarChart3, Clock, AlertTriangle, Crown, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';

const typeLabels: Record<string, string> = { varejo: 'Varejo', atacado: 'Atacado', lojista: 'Lojista', revendedor: 'Revendedor' };
const tagColors: Record<string, string> = { VIP: 'bg-amber-100 text-amber-700', recorrente: 'bg-emerald-100 text-emerald-700', inadimplente: 'bg-red-100 text-red-700', inativo: 'bg-slate-100 text-slate-700' };
const allTags = ['VIP', 'recorrente', 'inadimplente', 'inativo'];
const abcColors: Record<string, string> = { A: 'bg-emerald-100 text-emerald-700 border-emerald-300', B: 'bg-blue-100 text-blue-700 border-blue-300', C: 'bg-slate-100 text-slate-600 border-slate-300' };

const fmt = (v: number | null | undefined) => (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const formatWhatsAppNumber = (num: string | null | undefined): string | null => {
  if (!num) return null;
  const digits = num.replace(/\D/g, '');
  if (digits.length < 10) return null;
  if (digits.startsWith('55')) return digits;
  return `55${digits}`;
};

export function ClientesContent() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>({ name: '', email: '', phone: '', whatsapp: '', city: '', state: '', type: 'varejo', tags: [] });
  const [tab, setTab] = useState('lista');
  const [analytics, setAnalytics] = useState<any>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  const fetchCustomers = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: String(page), search, type: typeFilter, tag: tagFilter });
      const res = await fetch(`/api/clientes?${params}`);
      if (res.ok) { const d = await res.json(); setCustomers(d?.customers ?? []); setTotalPages(d?.pages ?? 1); }
    } catch (e: any) { console.error(e); } finally { setLoading(false); }
  }, [page, search, typeFilter, tagFilter]);

  const fetchAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    try {
      const res = await fetch('/api/clientes/analytics');
      if (res.ok) setAnalytics(await res.json());
    } catch (e: any) { console.error(e); } finally { setAnalyticsLoading(false); }
  }, []);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);
  useEffect(() => { if (tab === 'abc' || tab === 'frequencia') fetchAnalytics(); }, [tab, fetchAnalytics]);

  const openNew = () => { setEditing(null); setForm({ name: '', email: '', phone: '', whatsapp: '', city: '', state: '', type: 'varejo', tags: [] }); setDialogOpen(true); };
  const openEdit = (c: any) => { setEditing(c); setForm({ name: c?.name??'', email: c?.email??'', phone: c?.phone??'', whatsapp: c?.whatsapp??'', city: c?.city??'', state: c?.state??'', type: c?.type??'varejo', tags: c?.tags??[] }); setDialogOpen(true); };

  const handleSave = async () => {
    if (!form?.name) { toast.error('Nome obrigatório'); return; }
    try {
      const url = editing ? `/api/clientes/${editing.id}` : '/api/clientes';
      const method = editing ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      if (res.ok) { toast.success(editing ? 'Cliente atualizado!' : 'Cliente criado!'); setDialogOpen(false); fetchCustomers(); }
      else { const d = await res.json(); toast.error(d?.error ?? 'Erro'); }
    } catch { toast.error('Erro'); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Desativar este cliente?')) return;
    try { const res = await fetch(`/api/clientes/${id}`, { method: 'DELETE' }); if (res.ok) { toast.success('Cliente desativado'); fetchCustomers(); } } catch { toast.error('Erro'); }
  };

  const toggleTag = (tag: string) => { const tags = form?.tags ?? []; setForm({ ...(form ?? {}), tags: tags.includes(tag) ? tags.filter((t: string) => t !== tag) : [...tags, tag] }); };

  return (
    <div>
      <AppHeader title="Clientes" />
      <div className="p-4 lg:p-6 space-y-4">
        <Tabs value={tab} onValueChange={setTab}>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <TabsList>
              <TabsTrigger value="lista"><Users className="w-4 h-4 mr-1.5" />Clientes</TabsTrigger>
              <TabsTrigger value="abc"><Crown className="w-4 h-4 mr-1.5" />Curva ABC</TabsTrigger>
              <TabsTrigger value="frequencia"><Clock className="w-4 h-4 mr-1.5" />Frequência</TabsTrigger>
            </TabsList>
            {tab === 'lista' && <Button onClick={openNew}><Plus className="w-4 h-4 mr-2" />Novo Cliente</Button>}
          </div>

          {/* LIST TAB */}
          <TabsContent value="lista" className="space-y-4 mt-4">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Buscar clientes..." value={search} onChange={(e: any) => { setSearch(e?.target?.value ?? ''); setPage(1); }} className="pl-9" />
              </div>
              <select className="h-10 px-3 rounded-md border border-input bg-background text-sm" value={typeFilter} onChange={(e: any) => { setTypeFilter(e?.target?.value ?? ''); setPage(1); }}>
                <option value="">Todos os tipos</option>
                {Object.entries(typeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <select className="h-10 px-3 rounded-md border border-input bg-background text-sm" value={tagFilter} onChange={(e: any) => { setTagFilter(e?.target?.value ?? ''); setPage(1); }}>
                <option value="">Todas etiquetas</option>
                {allTags.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <Card className="border-0 shadow-sm">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead className="hidden md:table-cell">Tipo</TableHead>
                      <TableHead className="hidden md:table-cell">Etiquetas</TableHead>
                      <TableHead className="hidden sm:table-cell">Contato</TableHead>
                      <TableHead className="text-right">Total Compras</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading && Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={`sk-${i}`}>
                        {Array.from({ length: 6 }).map((_, c) => (
                          <TableCell key={c}><div className="skeleton h-4 w-full rounded" /></TableCell>
                        ))}
                      </TableRow>
                    ))}
                    {!loading && (customers?.length ?? 0) === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="py-12">
                          <div className="flex flex-col items-center gap-2 text-center">
                            <div className="w-12 h-12 rounded-2xl bg-muted/60 flex items-center justify-center animate-float"><Users className="w-6 h-6 text-muted-foreground/40" /></div>
                            <p className="text-sm font-medium text-foreground/80">Nenhum cliente encontrado</p>
                            <p className="text-xs text-muted-foreground">Cadastre clientes para acompanhar suas compras.</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                    {(customers ?? []).map((c: any) => (
                      <TableRow key={c?.id ?? ''}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center">
                              <span className="text-sm font-bold text-blue-600">{(c?.name ?? 'C')?.[0]?.toUpperCase?.() ?? 'C'}</span>
                            </div>
                            <div><p className="font-medium text-sm">{c?.name ?? ''}</p>{c?.city && <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="w-3 h-3" />{c.city}{c?.state ? `, ${c.state}` : ''}</p>}</div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell"><Badge variant="outline" className="text-xs">{typeLabels[c?.type ?? ''] ?? c?.type ?? ''}</Badge></TableCell>
                        <TableCell className="hidden md:table-cell"><div className="flex gap-1 flex-wrap">{(c?.tags ?? []).map((t: string) => (<span key={t} className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${tagColors[t] ?? 'bg-gray-100 text-gray-700'}`}>{t}</span>))}</div></TableCell>
                        <TableCell className="hidden sm:table-cell">{c?.phone && <p className="text-xs flex items-center gap-1"><Phone className="w-3 h-3" />{c.phone}</p>}</TableCell>
                        <TableCell className="text-right"><p className="text-sm font-mono font-medium">{fmt(c?.totalPurchased ?? 0)}</p><p className="text-[11px] text-muted-foreground">{c?.purchaseCount ?? 0} compras</p></TableCell>
                        <TableCell className="text-right"><div className="flex items-center justify-end gap-1">{(() => { const waNum = formatWhatsAppNumber(c?.whatsapp || c?.phone); return waNum ? (<a href={`https://wa.me/${waNum}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:hover:bg-emerald-900/50 transition-colors" title="WhatsApp"><MessageCircle className="w-3.5 h-3.5 text-emerald-600" /></a>) : null; })()}<Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)}><Edit className="w-3.5 h-3.5" /></Button><Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => handleDelete(c?.id ?? '')}><Trash2 className="w-3.5 h-3.5" /></Button></div></TableCell>
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

          {/* ABC CURVE TAB */}
          <TabsContent value="abc" className="space-y-4 mt-4">
            {analyticsLoading ? <p className="text-center py-8 text-muted-foreground">Carregando análise...</p> : analytics ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card><CardContent className="pt-4 pb-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center"><Crown className="w-5 h-5 text-emerald-600" /></div><div><p className="text-xs text-muted-foreground">Classe A</p><p className="text-lg font-bold">{analytics.abc?.A ?? 0} <span className="text-xs font-normal text-muted-foreground">clientes (80% receita)</span></p></div></div></CardContent></Card>
                  <Card><CardContent className="pt-4 pb-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center"><BarChart3 className="w-5 h-5 text-blue-600" /></div><div><p className="text-xs text-muted-foreground">Classe B</p><p className="text-lg font-bold">{analytics.abc?.B ?? 0} <span className="text-xs font-normal text-muted-foreground">clientes (80-95%)</span></p></div></div></CardContent></Card>
                  <Card><CardContent className="pt-4 pb-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center"><Users className="w-5 h-5 text-slate-600" /></div><div><p className="text-xs text-muted-foreground">Classe C</p><p className="text-lg font-bold">{analytics.abc?.C ?? 0} <span className="text-xs font-normal text-muted-foreground">clientes (95-100%)</span></p></div></div></CardContent></Card>
                  <Card><CardContent className="pt-4 pb-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center"><TrendingUp className="w-5 h-5 text-amber-600" /></div><div><p className="text-xs text-muted-foreground">Receita Total</p><p className="text-lg font-bold num-highlight">{fmt(analytics.totalRevenue ?? 0)}</p></div></div></CardContent></Card>
                </div>
                <Card className="border-0 shadow-sm">
                  <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Ranking de Clientes (Curva ABC)</CardTitle></CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader><TableRow><TableHead className="w-10">#</TableHead><TableHead>Cliente</TableHead><TableHead>Classe</TableHead><TableHead className="text-right">Total Comprado</TableHead><TableHead className="text-right hidden sm:table-cell">% Acumulado</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {(analytics.abcData ?? []).map((c: any, i: number) => (
                          <TableRow key={c.id}>
                            <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                            <TableCell><span className="text-sm font-medium">{c.name}</span></TableCell>
                            <TableCell><span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${abcColors[c.abcClass] ?? ''}`}>{c.abcClass}</span></TableCell>
                            <TableCell className="text-right font-mono text-sm">{fmt(c.totalPurchased ?? 0)}</TableCell>
                            <TableCell className="text-right hidden sm:table-cell text-xs text-muted-foreground">{c.cumulativePct}%</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </>
            ) : <p className="text-center py-8 text-muted-foreground">Nenhum dado disponível</p>}
          </TabsContent>

          {/* FREQUENCY TAB */}
          <TabsContent value="frequencia" className="space-y-4 mt-4">
            {analyticsLoading ? <p className="text-center py-8 text-muted-foreground">Carregando análise...</p> : analytics ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Card><CardContent className="pt-4 pb-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center"><AlertTriangle className="w-5 h-5 text-red-600" /></div><div><p className="text-xs text-muted-foreground">Em Risco</p><p className="text-lg font-bold text-red-600">{analytics.atRiskCount ?? 0} <span className="text-xs font-normal text-muted-foreground">clientes atrasados</span></p></div></div></CardContent></Card>
                  <Card><CardContent className="pt-4 pb-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center"><TrendingUp className="w-5 h-5 text-blue-600" /></div><div><p className="text-xs text-muted-foreground">Ticket Médio Geral</p><p className="text-lg font-bold num-highlight">{fmt(analytics.avgTicketAll ?? 0)}</p></div></div></CardContent></Card>
                  <Card><CardContent className="pt-4 pb-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center"><Users className="w-5 h-5 text-emerald-600" /></div><div><p className="text-xs text-muted-foreground">Total Clientes</p><p className="text-lg font-bold">{analytics.total ?? 0}</p></div></div></CardContent></Card>
                </div>
                <Card className="border-0 shadow-sm">
                  <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Previsão de Recompra e Frequência</CardTitle></CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader><TableRow><TableHead>Cliente</TableHead><TableHead>Freq. Média</TableHead><TableHead>Dias s/ Compra</TableHead><TableHead>Previsão</TableHead><TableHead className="text-right">Compras</TableHead><TableHead className="text-right hidden sm:table-cell">Total</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {(analytics.frequencyData ?? []).map((c: any) => (
                          <TableRow key={c.id} className={c.atRisk ? 'bg-red-50/50' : ''}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {c.atRisk && <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />}
                                <span className="text-sm font-medium">{c.name}</span>
                              </div>
                            </TableCell>
                            <TableCell><span className="text-xs font-mono">{c.avgFrequency > 0 ? `a cada ${c.avgFrequency} dias` : '-'}</span></TableCell>
                            <TableCell><span className={`text-xs font-mono ${c.atRisk ? 'text-red-600 font-bold' : ''}`}>{c.daysSinceLast} dias</span></TableCell>
                            <TableCell>{c.predictedNextDays !== null ? (<Badge variant={c.predictedNextDays <= 0 ? 'destructive' : c.predictedNextDays <= 7 ? 'default' : 'secondary'} className="text-[10px]">{c.predictedNextDays <= 0 ? 'Atrasado' : `em ${c.predictedNextDays} dias`}</Badge>) : <span className="text-xs text-muted-foreground">-</span>}</TableCell>
                            <TableCell className="text-right font-mono text-xs">{c.purchaseCount}</TableCell>
                            <TableCell className="text-right hidden sm:table-cell font-mono text-xs">{fmt(c.totalPurchased)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </>
            ) : <p className="text-center py-8 text-muted-foreground">Nenhum dado disponível</p>}
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-display">{editing ? 'Editar Cliente' : 'Novo Cliente'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2"><Label>Nome *</Label><Input value={form?.name??''} onChange={(e: any) => setForm({...(form??{}), name: e?.target?.value??''})} /></div>
              <div><Label>Email</Label><Input type="email" value={form?.email??''} onChange={(e: any) => setForm({...(form??{}), email: e?.target?.value??''})} /></div>
              <div><Label>Telefone</Label><Input value={form?.phone??''} onChange={(e: any) => setForm({...(form??{}), phone: e?.target?.value??''})} /></div>
              <div><Label>WhatsApp</Label><Input value={form?.whatsapp??''} onChange={(e: any) => setForm({...(form??{}), whatsapp: e?.target?.value??''})} /></div>
              <div><Label>Tipo</Label><select className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm" value={form?.type??'varejo'} onChange={(e: any) => setForm({...(form??{}), type: e?.target?.value??'varejo'})}>{Object.entries(typeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
              <div><Label>Cidade</Label><Input value={form?.city??''} onChange={(e: any) => setForm({...(form??{}), city: e?.target?.value??''})} /></div>
              <div><Label>Estado</Label><Input value={form?.state??''} onChange={(e: any) => setForm({...(form??{}), state: e?.target?.value??''})} /></div>
            </div>
            <div><Label>Etiquetas</Label><div className="flex gap-2 mt-1 flex-wrap">{allTags.map(tag => (<button key={tag} onClick={() => toggleTag(tag)} className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${(form?.tags??[]).includes(tag) ? tagColors[tag]??'bg-blue-100 text-blue-700' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>{tag}</button>))}</div></div>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button><Button onClick={handleSave}>{editing ? 'Salvar' : 'Criar'}</Button></div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
