'use client';

import { useState, useEffect, useCallback } from 'react';
import { AppHeader } from '@/components/app-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Tags, Edit, Trash2, Package } from 'lucide-react';
import { toast } from 'sonner';

export function CategoriasContent() {
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: '', description: '' });

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/categorias');
      if (res.ok) setCategories(await res.json());
    } catch (e: any) { console.error(e); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  const openNew = () => { setEditing(null); setForm({ name: '', description: '' }); setDialogOpen(true); };
  const openEdit = (c: any) => { setEditing(c); setForm({ name: c?.name ?? '', description: c?.description ?? '' }); setDialogOpen(true); };

  const handleSave = async () => {
    if (!form?.name) { toast.error('Nome obrigatório'); return; }
    try {
      const url = editing ? `/api/categorias/${editing.id}` : '/api/categorias';
      const method = editing ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      if (res.ok) {
        toast.success(editing ? 'Categoria atualizada!' : 'Categoria criada!');
        setDialogOpen(false);
        fetchCategories();
      } else { const d = await res.json(); toast.error(d?.error ?? 'Erro'); }
    } catch (e: any) { toast.error('Erro'); console.error(e); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Desativar esta categoria?')) return;
    try {
      const res = await fetch(`/api/categorias/${id}`, { method: 'DELETE' });
      if (res.ok) { toast.success('Categoria desativada'); fetchCategories(); }
    } catch (e: any) { toast.error('Erro'); console.error(e); }
  };

  return (
    <div>
      <AppHeader title="Categorias" />
      <div className="p-4 lg:p-6 space-y-4">
        <div className="flex justify-between items-center">
          <p className="text-sm text-muted-foreground">{(categories ?? []).length} categorias cadastradas</p>
          <Button onClick={openNew}><Plus className="w-4 h-4 mr-2" />Nova Categoria</Button>
        </div>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="hidden sm:table-cell">Descrição</TableHead>
                  <TableHead className="text-center">Produtos</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>}
                {!loading && (categories?.length ?? 0) === 0 && <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Nenhuma categoria</TableCell></TableRow>}
                {(categories ?? []).filter((c: any) => c?.isActive !== false).map((c: any) => (
                  <TableRow key={c?.id ?? ''}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center">
                          <Tags className="w-4 h-4 text-violet-600" />
                        </div>
                        <span className="font-medium text-sm">{c?.name ?? ''}</span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">{c?.description ?? '-'}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Package className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-sm font-mono">{c?._count?.products ?? 0}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)}><Edit className="w-3.5 h-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => handleDelete(c?.id ?? '')}><Trash2 className="w-3.5 h-3.5" /></Button>
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
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">{editing ? 'Editar Categoria' : 'Nova Categoria'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nome *</Label><Input value={form?.name ?? ''} onChange={(e: any) => setForm({ ...(form ?? {}), name: e?.target?.value ?? '' })} /></div>
            <div><Label>Descrição</Label><Input value={form?.description ?? ''} onChange={(e: any) => setForm({ ...(form ?? {}), description: e?.target?.value ?? '' })} /></div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave}>{editing ? 'Salvar' : 'Criar'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
