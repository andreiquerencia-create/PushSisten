'use client';

import { useState, useEffect, useCallback } from 'react';
import { AppHeader } from '@/components/app-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Pencil, Trash2, Truck, Phone, Mail, MapPin } from 'lucide-react';
import { toast } from 'sonner';

interface Supplier {
  id: string; name: string; phone?: string; whatsapp?: string; email?: string;
  city?: string; state?: string; cnpj?: string; notes?: string;
}

export default function FornecedoresContent() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState({ name: '', phone: '', whatsapp: '', email: '', city: '', state: '', cnpj: '', notes: '' });

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/fornecedores?search=${search}`);
      const data = await res.json();
      setSuppliers(data.suppliers || []);
    } catch { toast.error('Erro ao carregar fornecedores'); }
    setLoading(false);
  }, [search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openNew = () => { setEditing(null); setForm({ name: '', phone: '', whatsapp: '', email: '', city: '', state: '', cnpj: '', notes: '' }); setDialogOpen(true); };
  const openEdit = (s: Supplier) => { setEditing(s); setForm({ name: s.name, phone: s.phone || '', whatsapp: s.whatsapp || '', email: s.email || '', city: s.city || '', state: s.state || '', cnpj: s.cnpj || '', notes: s.notes || '' }); setDialogOpen(true); };

  const handleSave = async () => {
    if (!form.name) { toast.error('Nome é obrigatório'); return; }
    try {
      const url = editing ? `/api/fornecedores/${editing.id}` : '/api/fornecedores';
      const method = editing ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      if (!res.ok) throw new Error();
      toast.success(editing ? 'Fornecedor atualizado!' : 'Fornecedor criado!');
      setDialogOpen(false);
      fetchData();
    } catch { toast.error('Erro ao salvar fornecedor'); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja desativar este fornecedor?')) return;
    try {
      await fetch(`/api/fornecedores/${id}`, { method: 'DELETE' });
      toast.success('Fornecedor desativado');
      fetchData();
    } catch { toast.error('Erro ao desativar'); }
  };

  return (
    <div className="flex flex-col min-h-screen">
      <AppHeader title="Fornecedores" />
      <div className="flex-1 p-4 lg:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-blue-600" />
            <span className="text-sm text-muted-foreground">{suppliers.length} fornecedores</span>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
            </div>
            <Button onClick={openNew} size="sm" className="gap-1.5"><Plus className="w-4 h-4" /> Novo</Button>
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead className="hidden md:table-cell">CNPJ</TableHead>
                  <TableHead className="hidden md:table-cell">Telefone</TableHead>
                  <TableHead className="hidden lg:table-cell">Cidade/UF</TableHead>
                  <TableHead className="hidden lg:table-cell">Email</TableHead>
                  <TableHead className="w-24">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
                ) : suppliers.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum fornecedor encontrado</TableCell></TableRow>
                ) : suppliers.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{s.cnpj || '-'}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm">{s.phone || '-'}</TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{s.city && s.state ? `${s.city}/${s.state}` : s.city || s.state || '-'}</TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{s.email || '-'}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(s)}><Pencil className="w-3.5 h-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600" onClick={() => handleDelete(s.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? 'Editar Fornecedor' : 'Novo Fornecedor'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2"><Label>Nome *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>CNPJ</Label><Input value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} /></div>
            <div><Label>Telefone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div><Label>WhatsApp</Label><Input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} /></div>
            <div><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><Label>Cidade</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
            <div><Label>Estado</Label><Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} /></div>
            <div className="sm:col-span-2"><Label>Observações</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} /></div>
          </div>
          <DialogFooter><Button onClick={handleSave}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
