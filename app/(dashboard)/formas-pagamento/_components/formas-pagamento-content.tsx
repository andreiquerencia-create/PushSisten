'use client';

import { useState, useEffect, useCallback } from 'react';
import { AppHeader } from '@/components/app-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { CreditCard, Plus, Pencil, Banknote, QrCode, FileText, ArrowLeftRight, CircleDot, Clock, Percent, AlertCircle, HandCoins } from 'lucide-react';
import { toast } from 'sonner';
import { CurrencyInput } from '@/components/ui/currency-input';
import Link from 'next/link';

const typeLabels: Record<string, string> = { dinheiro: 'Dinheiro', pix: 'PIX', cartao_credito: 'Cartão Crédito', cartao_debito: 'Cartão Débito', boleto: 'Boleto', transferencia: 'Transferência', crediario: 'Crediário', outro: 'Outro' };
const typeIcons: Record<string, any> = { dinheiro: Banknote, pix: QrCode, cartao_credito: CreditCard, cartao_debito: CreditCard, boleto: FileText, transferencia: ArrowLeftRight, crediario: HandCoins, outro: CircleDot };
const typeColors: Record<string, string> = {
  dinheiro: 'bg-emerald-100 text-emerald-700', pix: 'bg-teal-100 text-teal-700',
  cartao_credito: 'bg-violet-100 text-violet-700', cartao_debito: 'bg-indigo-100 text-indigo-700',
  boleto: 'bg-amber-100 text-amber-700', transferencia: 'bg-blue-100 text-blue-700', crediario: 'bg-orange-100 text-orange-700', outro: 'bg-gray-100 text-gray-700'
};

export function FormasPagamentoContent() {
  const [methods, setMethods] = useState<any[]>([]);
  const [cashAccounts, setCashAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>({
    name: '', type: 'dinheiro', cashAccountId: '', defaultDays: '0', feePercent: '0', feeFixed: '0', businessDays: false,
  });

  const fetchData = useCallback(async () => {
    try {
      const [mRes, cRes] = await Promise.all([
        fetch('/api/formas-pagamento'),
        fetch('/api/caixas'),
      ]);
      if (mRes.ok) { const d = await mRes.json(); setMethods(d.methods ?? []); }
      if (cRes.ok) { const d = await cRes.json(); setCashAccounts((d.accounts ?? []).filter((a: any) => a.isActive)); }
    } catch (e: any) { console.error(e); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openNew = () => {
    setEditing(null);
    setForm({ name: '', type: 'dinheiro', cashAccountId: cashAccounts[0]?.id ?? '', defaultDays: '0', feePercent: '0', feeFixed: '0', businessDays: false });
    setDialogOpen(true);
  };

  const openEdit = (m: any) => {
    setEditing(m);
    setForm({
      name: m.name ?? '', type: m.type ?? 'dinheiro', cashAccountId: m.cashAccountId ?? '',
      defaultDays: String(m.defaultDays ?? 0), feePercent: String(m.feePercent ?? 0), feeFixed: String(m.feeFixed ?? 0),
      businessDays: m.businessDays ?? false,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form?.name) { toast.error('Nome é obrigatório'); return; }
    const crediario = (form?.type ?? '') === 'crediario';
    // Para Crediário o destino é definido na baixa da parcela (forma de pagamento usada),
    // então não exigimos conta destino na criação — gravamos uma conta padrão apenas para satisfazer o vínculo.
    let payload = { ...form };
    if (crediario) {
      payload.cashAccountId = form?.cashAccountId || cashAccounts[0]?.id || '';
    } else if (!form?.cashAccountId) {
      toast.error('Selecione um caixa/conta'); return;
    }
    try {
      const url = editing ? `/api/formas-pagamento/${editing.id}` : '/api/formas-pagamento';
      const method = editing ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (res.ok) { toast.success(editing ? 'Forma atualizada!' : 'Forma criada!'); setDialogOpen(false); fetchData(); }
      else { const d = await res.json(); toast.error(d?.error ?? 'Erro'); }
    } catch { toast.error('Erro ao salvar'); }
  };

  const toggleStatus = async (m: any) => {
    try {
      const res = await fetch(`/api/formas-pagamento/${m.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isActive: !m.isActive }) });
      if (res.ok) { toast.success('Status atualizado'); fetchData(); }
    } catch { toast.error('Erro'); }
  };

  const isCard = (form?.type ?? '').startsWith('cartao');
  const isCrediario = (form?.type ?? '') === 'crediario';

  return (
    <div>
      <AppHeader title="Formas de Pagamento" />
      <div className="p-4 lg:p-6 space-y-6">
        <div className="flex justify-between items-center">
          <p className="text-sm text-muted-foreground">{methods.length} formas cadastradas</p>
          {cashAccounts.length === 0 ? (
            <Link href="/caixas">
              <Button variant="default" className="bg-amber-600 hover:bg-amber-700">
                <AlertCircle className="w-4 h-4 mr-2" />Crie um Caixa primeiro
              </Button>
            </Link>
          ) : (
            <Button onClick={openNew}>
              <Plus className="w-4 h-4 mr-2" />Nova Forma de Pagamento
            </Button>
          )}
        </div>

        {cashAccounts.length === 0 && !loading && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Nenhum caixa cadastrado</p>
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                Para cadastrar formas de pagamento, é necessário ter pelo menos um caixa/conta cadastrado.{' '}
                <Link href="/caixas" className="underline font-medium hover:text-amber-800">Ir para Caixas →</Link>
              </p>
            </div>
          </div>
        )}

        <Card className="border-0 shadow-sm">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Forma de Pagamento</TableHead>
                  <TableHead className="text-center">Tipo</TableHead>
                  <TableHead>Caixa Destino</TableHead>
                  <TableHead className="text-center">Prazo</TableHead>
                  <TableHead className="text-center">Taxa</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && <TableRow><TableCell colSpan={7} className="text-center py-8">Carregando...</TableCell></TableRow>}
                {!loading && methods.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhuma forma cadastrada</TableCell></TableRow>}
                {methods.map((m: any) => {
                  const Icon = typeIcons[m.type] ?? CreditCard;
                  return (
                    <TableRow key={m.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center"><Icon className="w-4 h-4 text-primary" /></div>
                          <span className="font-medium text-sm">{m.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center"><Badge className={`text-xs ${typeColors[m.type] ?? ''}`}>{typeLabels[m.type] ?? m.type}</Badge></TableCell>
                      <TableCell className="text-sm">{m.cashAccount?.name ?? '—'}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Clock className="w-3 h-3 text-muted-foreground" />
                          <span className="text-xs">{m.defaultDays === 0 ? 'Imediato' : `${m.defaultDays} ${m.businessDays ? 'dias úteis' : 'dias'}`}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {(m.feePercent > 0 || m.feeFixed > 0) ? (
                          <div className="flex items-center justify-center gap-1">
                            <Percent className="w-3 h-3 text-red-500" />
                            <span className="text-xs text-red-600">
                              {m.feePercent > 0 ? `${m.feePercent}%` : ''}
                              {m.feePercent > 0 && m.feeFixed > 0 ? ' + ' : ''}
                              {m.feeFixed > 0 ? `R$ ${m.feeFixed.toFixed(2)}` : ''}
                            </span>
                          </div>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-center"><Badge variant={m.isActive ? 'default' : 'secondary'} className="text-xs">{m.isActive ? 'Ativo' : 'Inativo'}</Badge></TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(m)}><Pencil className="w-3.5 h-3.5" /></Button>
                          <Switch checked={m.isActive ?? false} onCheckedChange={() => toggleStatus(m)} />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="font-display">{editing ? 'Editar Forma de Pagamento' : 'Nova Forma de Pagamento'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nome *</Label><Input value={form?.name ?? ''} onChange={(e: any) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Dinheiro, Pix Inter, Cartão Stone..." /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Tipo</Label>
                <select className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm" value={form?.type ?? 'dinheiro'} onChange={(e: any) => setForm({ ...form, type: e.target.value })}>
                  {Object.entries(typeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              {!isCrediario ? (
                <div><Label>Caixa/Conta Destino *</Label>
                  <select className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm" value={form?.cashAccountId ?? ''} onChange={(e: any) => setForm({ ...form, cashAccountId: e.target.value })}>
                    <option value="">Selecione...</option>
                    {cashAccounts.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
              ) : (
                <div><Label>Caixa/Conta Destino</Label>
                  <div className="h-10 px-3 flex items-center rounded-md border border-dashed border-input bg-muted/30 text-xs text-muted-foreground">
                    Definido na baixa da parcela
                  </div>
                </div>
              )}
            </div>
            {isCrediario && (
              <div className="flex items-start gap-2 p-3 rounded-lg border border-orange-200 dark:border-orange-900 bg-orange-50 dark:bg-orange-950/20">
                <HandCoins className="w-4 h-4 text-orange-600 mt-0.5 shrink-0" />
                <p className="text-xs text-orange-700 dark:text-orange-300">
                  No Crediário a venda fica a prazo e o dinheiro só entra no caixa quando você recebe a parcela. Por isso a conta destino não é definida aqui — ao dar baixa em Crediário &gt; Recebimentos, você escolhe a forma de pagamento usada (Dinheiro, PIX...) e o valor cai automaticamente no caixa vinculado a ela.
                </p>
              </div>
            )}

            {/* Card-specific config */}
            <div className={`space-y-3 p-3 rounded-lg border ${isCard ? 'bg-violet-50 dark:bg-violet-950/20 border-violet-200 dark:border-violet-800' : 'bg-muted/30 border-border'}`}>
              <p className="text-xs font-medium text-muted-foreground">{isCard ? '⚙️ Configuração do Cartão' : '⚙️ Configuração de Recebimento'}</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Prazo (dias)</Label>
                  <Input type="number" min="0" value={form?.defaultDays ?? '0'} onChange={(e: any) => setForm({ ...form, defaultDays: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Taxa (%)</Label>
                  <Input type="number" min="0" step="0.1" value={form?.feePercent ?? '0'} onChange={(e: any) => setForm({ ...form, feePercent: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Taxa Fixa (R$)</Label>
                  <CurrencyInput value={parseFloat(form?.feeFixed) || 0} onChange={(v: number) => setForm({ ...form, feeFixed: String(v) })} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form?.businessDays ?? false} onCheckedChange={(v: boolean) => setForm({ ...form, businessDays: v })} />
                <Label className="text-xs">Dias úteis (excluir fins de semana/feriados)</Label>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave}>{editing ? 'Salvar' : 'Criar Forma'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
