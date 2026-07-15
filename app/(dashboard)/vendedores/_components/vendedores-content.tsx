'use client';

import { useState, useEffect, useCallback } from 'react';
import { AppHeader } from '@/components/app-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Plus, UserCheck, Trophy, DollarSign, TrendingUp, Phone, Edit3 } from 'lucide-react';
import { toast } from 'sonner';

interface Seller {
  id: string; name: string; phone?: string; commissionRate: number; canEditPrice: boolean;
  isActive: boolean; totalSold: number; salesCount: number; commission: number;
}

const fmt = (v: number | null | undefined) => (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function VendedoresContent() {
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Seller | null>(null);
  const [form, setForm] = useState({ name: '', phone: '', commissionRate: '5', canEditPrice: false });

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/vendedores');
      const data = await res.json();
      setSellers(data.sellers || []);
    } catch { toast.error('Erro ao carregar vendedores'); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalVendido = sellers.reduce((s, v) => s + v.totalSold, 0);
  const totalComissao = sellers.reduce((s, v) => s + v.commission, 0);

  const openNew = () => { setEditing(null); setForm({ name: '', phone: '', commissionRate: '5', canEditPrice: false }); setDialogOpen(true); };
  const openEdit = (s: Seller) => { setEditing(s); setForm({ name: s.name, phone: s.phone || '', commissionRate: s.commissionRate.toString(), canEditPrice: s.canEditPrice ?? false }); setDialogOpen(true); };

  const handleSave = async () => {
    if (!form.name) { toast.error('Nome é obrigatório'); return; }
    try {
      const url = editing ? `/api/vendedores/${editing.id}` : '/api/vendedores';
      const method = editing ? 'PUT' : 'POST';
      await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      toast.success(editing ? 'Vendedor atualizado!' : 'Vendedor criado!');
      setDialogOpen(false);
      fetchData();
    } catch { toast.error('Erro ao salvar'); }
  };

  return (
    <div className="flex flex-col min-h-screen">
      <AppHeader title="Vendedores" />
      <div className="flex-1 p-4 lg:p-6 space-y-4">
        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <UserCheck className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Vendedores</p>
                  <p className="text-xl font-bold num-highlight">{sellers.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Vendido</p>
                  <p className="text-xl font-bold num-highlight text-emerald-600">{fmt(totalVendido)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Comissão Total</p>
                  <p className="text-xl font-bold num-highlight text-amber-600">{fmt(totalComissao)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end">
          <Button onClick={openNew} size="sm" className="gap-1.5"><Plus className="w-4 h-4" /> Novo Vendedor</Button>
        </div>

        <Card>
          <CardContent className="p-0">
             <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead className="hidden md:table-cell">Telefone</TableHead>
                  <TableHead className="text-right">Comissão %</TableHead>
                  <TableHead className="text-center hidden sm:table-cell">Editar Preço</TableHead>
                  <TableHead className="text-right">Vendas</TableHead>
                  <TableHead className="text-right">Total Vendido</TableHead>
                  <TableHead className="text-right">Comissão</TableHead>
                  <TableHead className="w-20">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
                ) : sellers.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Nenhum vendedor cadastrado</TableCell></TableRow>
                ) : sellers.map((s, i) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      {i < 3 ? <Trophy className={`w-4 h-4 ${i === 0 ? 'text-yellow-500' : i === 1 ? 'text-gray-400' : 'text-amber-700'}`} /> : <span className="text-sm text-muted-foreground">{i + 1}</span>}
                    </TableCell>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm">{s.phone || '-'}</TableCell>
                    <TableCell className="text-right"><Badge variant="outline">{s.commissionRate}%</Badge></TableCell>
                    <TableCell className="text-center hidden sm:table-cell">
                      {s.canEditPrice ? (
                        <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-xs"><Edit3 className="w-3 h-3 mr-1" />Sim</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">Não</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-sm">{s.salesCount}</TableCell>
                    <TableCell className="text-right font-mono text-sm font-medium text-emerald-600">{fmt(s.totalSold)}</TableCell>
                    <TableCell className="text-right font-mono text-sm font-medium text-amber-600">{fmt(s.commission)}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(s)}><UserCheck className="w-3.5 h-3.5" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? 'Editar Vendedor' : 'Novo Vendedor'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Telefone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div><Label>Taxa de Comissão (%)</Label><Input type="number" min="0" max="100" step="0.5" value={form.commissionRate} onChange={(e) => setForm({ ...form, commissionRate: e.target.value })} /></div>
            <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/30">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Pode editar preço na venda</Label>
                <p className="text-xs text-muted-foreground">Permite alterar o preço dos produtos no PDV</p>
              </div>
              <Switch checked={form.canEditPrice} onCheckedChange={(v) => setForm({ ...form, canEditPrice: v })} />
            </div>
          </div>
          <DialogFooter><Button onClick={handleSave}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}