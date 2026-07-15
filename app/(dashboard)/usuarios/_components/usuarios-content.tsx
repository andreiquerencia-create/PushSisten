'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { AppHeader } from '@/components/app-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, UserCog, Edit, Shield, ShieldCheck, ShieldAlert, Trash2, UserX, KeyRound, Phone, Percent, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';

const roleLabels: Record<string, string> = { administrador: 'Administrador', socio: 'Sócio', gerente: 'Gerente', vendedor: 'Vendedor' };
const roleColors: Record<string, string> = { administrador: 'bg-violet-100 text-violet-700', socio: 'bg-indigo-100 text-indigo-700', gerente: 'bg-blue-100 text-blue-700', vendedor: 'bg-emerald-100 text-emerald-700' };
const roleIcons: Record<string, any> = { administrador: ShieldAlert, socio: Users, gerente: ShieldCheck, vendedor: Shield };

export function UsuariosContent() {
  const { data: session } = useSession() || {};
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [form, setForm] = useState<any>({ name: '', email: '', password: '', role: 'vendedor', commissionRate: '5', phone: '' });
  const [deleteConfirm, setDeleteConfirm] = useState<any>(null);

  const currentUserId = (session?.user as any)?.id;

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/usuarios');
      if (res.ok) setUsers(await res.json());
    } catch (e: any) { console.error(e); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleSave = async () => {
    if (!form?.name || !form?.email) { toast.error('Preencha nome e email'); return; }
    if (!editMode && !form?.password) { toast.error('Preencha a senha'); return; }
    try {
      const url = editMode ? `/api/usuarios/${editingId}` : '/api/usuarios';
      const method = editMode ? 'PUT' : 'POST';
      const payload: any = { ...form };
      // Don't send empty password on edit
      if (editMode && !payload.password) delete payload.password;
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        toast.success(editMode ? 'Usuário atualizado!' : 'Usuário criado!');
        setDialogOpen(false);
        fetchUsers();
      } else {
        const d = await res.json();
        toast.error(d?.error ?? 'Erro');
      }
    } catch (e: any) { toast.error('Erro'); console.error(e); }
  };

  const openEdit = (u: any) => {
    setEditMode(true);
    setEditingId(u.id);
    setForm({
      name: u.name || '',
      email: u.email || '',
      password: '',
      role: u.role || 'vendedor',
      phone: u.phone || u.seller?.phone || '',
      commissionRate: String(u.seller?.commissionRate ?? '5'),
    });
    setDialogOpen(true);
  };

  const openCreate = () => {
    setEditMode(false);
    setEditingId('');
    setForm({ name: '', email: '', password: '', role: 'vendedor', commissionRate: '5', phone: '' });
    setDialogOpen(true);
  };

  const toggleStatus = async (user: any) => {
    try {
      const res = await fetch(`/api/usuarios/${user?.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !(user?.isActive ?? true) }),
      });
      if (res.ok) { toast.success('Status atualizado'); fetchUsers(); }
    } catch (e: any) { toast.error('Erro'); console.error(e); }
  };

  const handleDelete = async (user: any) => {
    try {
      const res = await fetch(`/api/usuarios/${user.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        if (data.deactivated) {
          toast.success(data.message);
        } else {
          toast.success(data.message || 'Usuário excluído');
        }
        fetchUsers();
      } else {
        toast.error(data?.error ?? 'Erro ao excluir');
      }
    } catch (e: any) { toast.error('Erro'); console.error(e); }
    setDeleteConfirm(null);
  };

  return (
    <div>
      <AppHeader title="Usuários" />
      <div className="p-4 lg:p-6 space-y-4">
        <div className="flex justify-between items-center">
          <p className="text-sm text-muted-foreground">{(users ?? []).length} usuários cadastrados</p>
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4 mr-2" />Novo Usuário
          </Button>
        </div>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="hidden md:table-cell">Telefone</TableHead>
                  <TableHead className="text-center">Perfil</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && <TableRow><TableCell colSpan={6} className="text-center py-8">Carregando...</TableCell></TableRow>}
                {(users ?? []).map((u: any) => {
                  const RoleIcon = roleIcons[u?.role ?? 'vendedor'] ?? Shield;
                  const isSelf = u?.id === currentUserId;
                  return (
                    <TableRow key={u?.id ?? ''} className={!u?.isActive ? 'opacity-50' : ''}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                            <span className="text-sm font-bold text-primary">{(u?.name ?? 'U')?.[0]?.toUpperCase?.() ?? 'U'}</span>
                          </div>
                          <div>
                            <span className="font-medium text-sm">{u?.name ?? ''}</span>
                            {isSelf && <Badge variant="outline" className="ml-2 text-[10px]">Você</Badge>}
                            {u?.seller?.commissionRate != null && u?.role === 'vendedor' && (
                              <p className="text-[10px] text-muted-foreground">Comissão: {u.seller.commissionRate}%</p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{u?.email ?? ''}</TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{u?.phone || u?.seller?.phone || '-'}</TableCell>
                      <TableCell className="text-center">
                        <Badge className={`text-xs ${roleColors[u?.role ?? 'vendedor'] ?? ''}`}>
                          <RoleIcon className="w-3 h-3 mr-1" />{roleLabels[u?.role ?? 'vendedor'] ?? u?.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch checked={u?.isActive ?? false} onCheckedChange={() => toggleStatus(u)} disabled={isSelf} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Editar" onClick={() => openEdit(u)}>
                            <Edit className="w-3.5 h-3.5" />
                          </Button>
                          {!isSelf && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" title="Excluir" onClick={() => setDeleteConfirm(u)}>
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
          </CardContent>
        </Card>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="font-display">{editMode ? 'Editar Usuário' : 'Novo Usuário'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nome *</Label><Input value={form?.name ?? ''} onChange={(e: any) => setForm({ ...(form ?? {}), name: e?.target?.value ?? '' })} /></div>
            <div><Label>Email *</Label><Input type="email" value={form?.email ?? ''} onChange={(e: any) => setForm({ ...(form ?? {}), email: e?.target?.value ?? '' })} /></div>
            <div>
              <Label>{editMode ? 'Nova Senha (deixe vazio para manter)' : 'Senha *'}</Label>
              <Input type="password" value={form?.password ?? ''} onChange={(e: any) => setForm({ ...(form ?? {}), password: e?.target?.value ?? '' })} placeholder={editMode ? '••••••••' : ''} />
              {editMode && <p className="text-[10px] text-muted-foreground mt-1">Mínimo 6 caracteres para alterar</p>}
            </div>
            <div>
              <Label>Telefone</Label>
              <Input type="tel" placeholder="(66) 99999-9999" value={form?.phone ?? ''} onChange={(e: any) => setForm({ ...(form ?? {}), phone: e?.target?.value ?? '' })} />
            </div>
            <div><Label>Perfil</Label>
              <select className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm" value={form?.role ?? 'vendedor'} onChange={(e: any) => setForm({ ...(form ?? {}), role: e?.target?.value ?? 'vendedor' })}>
                {Object.entries(roleLabels).map(([k, v]: [string, string]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            {(form?.role === 'vendedor' || form?.role === 'gerente') && (
              <div className="space-y-3 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
                <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5"><Percent className="w-3.5 h-3.5" /> Dados de Comissão</p>
                <div>
                  <Label>Comissão (%)</Label>
                  <Input type="number" min="0" max="100" step="0.5" placeholder="5" value={form?.commissionRate ?? '5'} onChange={(e: any) => setForm({ ...(form ?? {}), commissionRate: e?.target?.value ?? '5' })} />
                </div>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave}>{editMode ? 'Salvar Alterações' : 'Criar Usuário'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="text-red-600 flex items-center gap-2"><UserX className="w-5 h-5" /> Excluir Usuário</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm">Tem certeza que deseja excluir <strong>{deleteConfirm?.name}</strong>?</p>
            <p className="text-xs text-muted-foreground">
              Se o usuário possui vendas no histórico, ele será <strong>desativado</strong> em vez de excluído, para preservar os dados.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancelar</Button>
              <Button variant="destructive" onClick={() => handleDelete(deleteConfirm)}>Excluir / Desativar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
