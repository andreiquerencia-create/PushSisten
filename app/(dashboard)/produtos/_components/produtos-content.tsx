'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter as useNavRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useOnboardingContext } from '@/components/onboarding-provider';
import { OnboardingCelebration } from '@/components/onboarding-celebration';
import { AppHeader } from '@/components/app-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Search, Package, Edit, Trash2, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Layers, Barcode, Tag, DollarSign } from 'lucide-react';
import { toast } from 'sonner';
import { CurrencyInput } from '@/components/ui/currency-input';

const fmt = (v: number | null | undefined) => (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const SIZES = ['PP', 'P', 'M', 'G', 'GG', 'XG', 'EG', 'EGG'];
const DEFAULT_COLORS = ['Preto', 'Branco', 'Azul', 'Vermelho', 'Rosa', 'Verde', 'Amarelo', 'Cinza', 'Marrom', 'Bege'];

export function ProdutosContent() {
  const searchParams = useSearchParams();
  const navRouter = useNavRouter();
  const onboardingMode = searchParams.get('onboarding') === 'true';
  const { markProductCreated } = useOnboardingContext();
  const [showCelebration, setShowCelebration] = useState(false);

  const { data: session } = useSession() || {};
  const userRole = (session?.user as any)?.role;
  const isAdmin = userRole === 'administrador' || userRole === 'socio' || userRole === 'master';

  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(onboardingMode);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>({ name: '', sku: '', barcode: '', description: '', costPrice: '', salePrice: '', stockQuantity: '', minStock: '5', categoryId: '', imageUrl: '' });
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [varDialog, setVarDialog] = useState(false);
  const [varProduct, setVarProduct] = useState<any>(null);
  const [varForm, setVarForm] = useState<any>({ color: '', size: '', grade: '', sku: '', barcode: '', costPrice: '', salePrice: '', stockQuantity: '0', minStock: '5' });
  const [editingVar, setEditingVar] = useState<any>(null);
  const [bulkDialog, setBulkDialog] = useState(false);
  const [bulkProduct, setBulkProduct] = useState<any>(null);
  const [bulkColors, setBulkColors] = useState<string[]>([]);
  const [bulkSizes, setBulkSizes] = useState<string[]>([]);
  const [bulkStock, setBulkStock] = useState('10');

  // Price Table state
  const [ptDialog, setPtDialog] = useState(false);
  const [ptProduct, setPtProduct] = useState<any>(null);
  const [ptList, setPtList] = useState<any[]>([]);
  const [ptEditing, setPtEditing] = useState<any>(null);
  const [ptForm, setPtForm] = useState({ name: '', minQuantity: '', unitPrice: '', notes: '' });
  const [ptLoading, setPtLoading] = useState(false);

  const fetchProducts = useCallback(async () => {
    try {
      const res = await fetch(`/api/produtos?page=${page}&search=${encodeURIComponent(search)}`);
      if (res.ok) { const data = await res.json(); setProducts(data?.products ?? []); setTotalPages(data?.pages ?? 1); }
    } catch (e: any) { console.error(e); } finally { setLoading(false); }
  }, [page, search]);

  const fetchCategories = useCallback(async () => {
    try { const res = await fetch('/api/categorias'); if (res.ok) setCategories(await res.json()); } catch (e: any) { console.error(e); }
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);
  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  const openNew = () => { setEditing(null); setForm({ name: '', sku: '', barcode: '', description: '', costPrice: '', salePrice: '', stockQuantity: '', minStock: '5', categoryId: '', imageUrl: '' }); setDialogOpen(true); };
  const openEdit = (p: any) => { setEditing(p); setForm({ name: p?.name??'', sku: p?.sku??'', barcode: p?.barcode??'', description: p?.description??'', costPrice: String(p?.costPrice??''), salePrice: String(p?.salePrice??''), stockQuantity: String(p?.stockQuantity??''), minStock: String(p?.minStock??'5'), categoryId: p?.categoryId??'', imageUrl: p?.imageUrl??'' }); setDialogOpen(true); };

  const handleSave = async () => {
    if (!form?.name) { toast.error('Nome obrigatório'); return; }
    try {
      const url = editing ? `/api/produtos/${editing.id}` : '/api/produtos';
      const method = editing ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      if (res.ok) {
        const created = await res.json();
        if (onboardingMode && !editing) {
          setDialogOpen(false);
          await markProductCreated();
          setShowCelebration(true);
        } else {
          const skuMsg = !editing && !form?.sku?.trim() && created?.sku ? ` (SKU: ${created.sku})` : '';
          toast.success(`${editing ? 'Produto atualizado' : 'Produto criado'}!${skuMsg}`);
          setDialogOpen(false);
          fetchProducts();
        }
      } else {
        const d = await res.json();
        toast.error(d?.error ?? 'Erro ao salvar');
      }
    } catch { toast.error('Erro ao salvar'); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Desativar este produto?')) return;
    try { const res = await fetch(`/api/produtos/${id}`, { method: 'DELETE' }); if (res.ok) { toast.success('Produto desativado'); fetchProducts(); } } catch { toast.error('Erro'); }
  };

  const margin = (() => { const c = parseFloat(form?.costPrice) || 0; const s = parseFloat(form?.salePrice) || 0; return s > 0 ? (((s - c) / s) * 100).toFixed(1) : '0.0'; })();

  // Variation management
  const openNewVar = (product: any) => { setVarProduct(product); setEditingVar(null); setVarForm({ color: '', size: '', grade: '', sku: '', barcode: '', costPrice: String(product?.costPrice??''), salePrice: String(product?.salePrice??''), stockQuantity: '0', minStock: '5' }); setVarDialog(true); };
  const openEditVar = (product: any, v: any) => { setVarProduct(product); setEditingVar(v); setVarForm({ color: v?.color??'', size: v?.size??'', grade: v?.grade??'', sku: v?.sku??'', barcode: v?.barcode??'', costPrice: String(v?.costPrice??''), salePrice: String(v?.salePrice??''), stockQuantity: String(v?.stockQuantity??''), minStock: String(v?.minStock??'5') }); setVarDialog(true); };

  const handleSaveVar = async () => {
    if (!varForm?.color && !varForm?.size) { toast.error('Informe cor ou tamanho'); return; }
    try {
      const url = `/api/produtos/${varProduct?.id}/variacoes`;
      const method = editingVar ? 'PUT' : 'POST';
      const body = editingVar ? { ...varForm, variationId: editingVar.id } : varForm;
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (res.ok) { toast.success(editingVar ? 'Variação atualizada!' : 'Variação criada!'); setVarDialog(false); fetchProducts(); }
      else { const d = await res.json(); toast.error(d?.error ?? 'Erro'); }
    } catch { toast.error('Erro ao salvar variação'); }
  };

  const handleDeleteVar = async (productId: string, variationId: string) => {
    if (!confirm('Remover esta variação?')) return;
    try { const res = await fetch(`/api/produtos/${productId}/variacoes?variationId=${variationId}`, { method: 'DELETE' }); if (res.ok) { toast.success('Variação removida'); fetchProducts(); } } catch { toast.error('Erro'); }
  };

  // Bulk variation creation
  const openBulk = (product: any) => { setBulkProduct(product); setBulkColors([]); setBulkSizes([]); setBulkStock('10'); setBulkDialog(true); };
  const toggleBulkColor = (c: string) => setBulkColors(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
  const toggleBulkSize = (s: string) => setBulkSizes(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);

  const handleBulkCreate = async () => {
    if (bulkColors.length === 0 || bulkSizes.length === 0) { toast.error('Selecione pelo menos 1 cor e 1 tamanho'); return; }
    const variations = bulkColors.flatMap(color => bulkSizes.map(size => ({
      color, size, costPrice: String(bulkProduct?.costPrice ?? 0), salePrice: String(bulkProduct?.salePrice ?? 0), stockQuantity: bulkStock, minStock: '5',
    })));
    try {
      const res = await fetch(`/api/produtos/${bulkProduct?.id}/variacoes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(variations) });
      if (res.ok) { toast.success(`${variations.length} variações criadas!`); setBulkDialog(false); fetchProducts(); }
      else { const d = await res.json(); toast.error(d?.error ?? 'Erro'); }
    } catch { toast.error('Erro ao criar variações'); }
  };

  // Price Table management functions
  const openPriceTableDialog = async (product: any) => {
    setPtProduct(product);
    setPtEditing(null);
    setPtForm({ name: '', minQuantity: '', unitPrice: '', notes: '' });
    setPtDialog(true);
    setPtLoading(true);
    try {
      const res = await fetch(`/api/produtos/${product.id}/tabelas-preco`);
      if (res.ok) setPtList(await res.json());
    } catch { toast.error('Erro ao carregar tabelas'); }
    setPtLoading(false);
  };

  const startEditPt = (pt: any) => {
    setPtEditing(pt);
    setPtForm({ name: pt.name, minQuantity: String(pt.minQuantity), unitPrice: String(pt.unitPrice), notes: pt.notes || '' });
  };

  const resetPtForm = () => {
    setPtEditing(null);
    setPtForm({ name: '', minQuantity: '', unitPrice: '', notes: '' });
  };

  const handleSavePt = async () => {
    if (!ptForm.name || !ptForm.unitPrice) { toast.error('Nome e preço são obrigatórios'); return; }
    setPtLoading(true);
    try {
      const url = `/api/produtos/${ptProduct?.id}/tabelas-preco`;
      if (ptEditing) {
        const res = await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tableId: ptEditing.id, ...ptForm }) });
        if (res.ok) { toast.success('Tabela atualizada!'); resetPtForm(); }
        else { const d = await res.json(); toast.error(d?.error ?? 'Erro'); }
      } else {
        const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ptForm) });
        if (res.ok) { toast.success('Tabela criada!'); resetPtForm(); }
        else { const d = await res.json(); toast.error(d?.error ?? 'Erro'); }
      }
      // Refresh list
      const listRes = await fetch(`/api/produtos/${ptProduct?.id}/tabelas-preco`);
      if (listRes.ok) setPtList(await listRes.json());
      fetchProducts();
    } catch { toast.error('Erro ao salvar tabela'); }
    setPtLoading(false);
  };

  const handleDeletePt = async (tableId: string) => {
    if (!confirm('Desativar esta tabela de preço?')) return;
    setPtLoading(true);
    try {
      const res = await fetch(`/api/produtos/${ptProduct?.id}/tabelas-preco?tableId=${tableId}`, { method: 'DELETE' });
      if (res.ok) { toast.success('Tabela desativada'); }
      const listRes = await fetch(`/api/produtos/${ptProduct?.id}/tabelas-preco`);
      if (listRes.ok) setPtList(await listRes.json());
      fetchProducts();
    } catch { toast.error('Erro'); }
    setPtLoading(false);
  };

  const getVariationGrid = (variations: any[]) => {
    const colors = [...new Set((variations ?? []).map((v: any) => v?.color).filter(Boolean))];
    const sizes = [...new Set((variations ?? []).map((v: any) => v?.size).filter(Boolean))];
    const sortedSizes = sizes.sort((a, b) => { const ia = SIZES.indexOf(a); const ib = SIZES.indexOf(b); return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib); });
    return { colors, sizes: sortedSizes };
  };

  return (
    <div>
      <AppHeader title="Produtos" />
      <div className="p-4 lg:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar produtos..." value={search} onChange={(e: any) => { setSearch(e?.target?.value ?? ''); setPage(1); }} className="pl-9" />
          </div>
          <Button onClick={openNew}><Plus className="w-4 h-4 mr-2" />Novo Produto</Button>
        </div>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead className="hidden md:table-cell">SKU</TableHead>
                  <TableHead className="hidden md:table-cell">Categoria</TableHead>
                  <TableHead className="text-right">Custo</TableHead>
                  <TableHead className="text-right">Preço</TableHead>
                  <TableHead className="text-right hidden sm:table-cell">Margem</TableHead>
                  <TableHead className="text-right">Estoque</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={`sk-${i}`}>
                    {Array.from({ length: 9 }).map((_, c) => (
                      <TableCell key={c}><div className="skeleton h-4 w-full rounded" /></TableCell>
                    ))}
                  </TableRow>
                ))}
                {!loading && (products?.length ?? 0) === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="py-12">
                      <div className="flex flex-col items-center gap-2 text-center">
                        <div className="w-12 h-12 rounded-2xl bg-muted/60 flex items-center justify-center animate-float"><Package className="w-6 h-6 text-muted-foreground/40" /></div>
                        <p className="text-sm font-medium text-foreground/80">Nenhum produto encontrado</p>
                        <p className="text-xs text-muted-foreground">Cadastre seu primeiro produto para começar.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                {(products ?? []).map((p: any) => {
                  const hasVars = (p?.variations?.length ?? 0) > 0;
                  const isExpanded = expandedProduct === p?.id;
                  return (
                    <>
                      <TableRow key={p?.id ?? ''} className="hover:bg-muted/30">
                        <TableCell className="w-8 pr-0">
                          {hasVars ? (
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setExpandedProduct(isExpanded ? null : p?.id)}>
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </Button>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                              {hasVars ? <Layers className="w-4 h-4 text-blue-600" /> : <Package className="w-4 h-4 text-blue-600" />}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-medium text-sm">{p?.name ?? ''}</span>
                                {(p?.priceTables?.length ?? 0) > 0 && <Badge variant="outline" className="text-[10px] h-4 px-1 border-amber-400 text-amber-600"><Tag className="w-2.5 h-2.5 mr-0.5" />{p.priceTables.length}</Badge>}
                              </div>
                              {hasVars && <p className="text-[11px] text-muted-foreground">{p.variations.length} variações</p>}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-sm text-muted-foreground font-mono">{p?.sku ?? '-'}</TableCell>
                        <TableCell className="hidden md:table-cell">{p?.category?.name ? <Badge variant="secondary" className="text-xs">{p.category.name}</Badge> : '-'}</TableCell>
                        <TableCell className="text-right text-sm font-mono">{fmt(p?.costPrice ?? 0)}</TableCell>
                        <TableCell className="text-right text-sm font-mono font-medium">{fmt(p?.salePrice ?? 0)}</TableCell>
                        <TableCell className="text-right hidden sm:table-cell"><Badge variant={(p?.margin ?? 0) >= 30 ? 'default' : 'destructive'} className="text-xs font-mono">{(p?.margin ?? 0).toFixed(1)}%</Badge></TableCell>
                        <TableCell className="text-right"><span className={`text-sm font-mono font-medium ${(p?.stockQuantity ?? 0) <= (p?.minStock ?? 0) ? 'text-red-600' : ''}`}>{p?.stockQuantity ?? 0}</span></TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-0.5 flex-wrap">
                            {isAdmin && (
                              <Button variant="ghost" size="sm" className="h-7 px-2 text-amber-600 hover:bg-amber-50 hover:text-amber-700 gap-1" title="Tabelas de Preço" onClick={() => openPriceTableDialog(p)}>
                                <Tag className="w-3.5 h-3.5" />
                                <span className="text-[11px] hidden lg:inline">Preços</span>
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-purple-600" title="Grade rápida" onClick={() => openBulk(p)}><Layers className="w-3.5 h-3.5" /></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-600" title="Nova variação" onClick={() => openNewVar(p)}><Plus className="w-3.5 h-3.5" /></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(p)}><Edit className="w-3.5 h-3.5" /></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => handleDelete(p?.id ?? '')}><Trash2 className="w-3.5 h-3.5" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      {isExpanded && hasVars && (() => {
                        const { colors, sizes } = getVariationGrid(p.variations);
                        return (
                          <TableRow key={`${p.id}-vars`}>
                            <TableCell colSpan={9} className="bg-muted/20 px-4 py-3">
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Grade de Variações</p>
                                  <div className="flex gap-1">
                                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => openBulk(p)}><Layers className="w-3 h-3 mr-1" />Grade Rápida</Button>
                                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => openNewVar(p)}><Plus className="w-3 h-3 mr-1" />Unitária</Button>
                                  </div>
                                </div>
                                {colors.length > 0 && sizes.length > 0 ? (
                                  <div className="overflow-x-auto">
                                    <table className="text-xs w-full">
                                      <thead>
                                        <tr>
                                          <th className="text-left py-1 px-2 font-medium text-muted-foreground">Cor / Tam</th>
                                          {sizes.map(s => <th key={s} className="text-center py-1 px-2 font-medium min-w-[60px]">{s}</th>)}
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {colors.map(color => (
                                          <tr key={color} className="border-t border-border/30">
                                            <td className="py-1.5 px-2 font-medium">{color}</td>
                                            {sizes.map(size => {
                                              const v = (p.variations ?? []).find((x: any) => x?.color === color && x?.size === size);
                                              return (
                                                <td key={size} className="text-center py-1.5 px-2">
                                                  {v ? (
                                                    <button onClick={() => openEditVar(p, v)} className={`inline-flex items-center justify-center w-10 h-7 rounded text-xs font-mono font-bold transition-colors ${
                                                      v.stockQuantity <= 0 ? 'bg-red-100 text-red-700 hover:bg-red-200' :
                                                      v.stockQuantity <= v.minStock ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' :
                                                      'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                                                    }`}>{v.stockQuantity}</button>
                                                  ) : <span className="text-muted-foreground/30">—</span>}
                                                </td>
                                              );
                                            })}
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                ) : (
                                  <div className="space-y-1">
                                    {(p.variations ?? []).map((v: any) => (
                                      <div key={v.id} className="flex items-center gap-3 py-1.5 px-2 rounded-lg bg-background border border-border/30">
                                        <span className="text-xs font-medium w-28">{[v.color, v.size, v.grade].filter(Boolean).join(' / ') || 'Sem nome'}</span>
                                        {v.sku && <span className="text-[10px] font-mono text-muted-foreground">SKU: {v.sku}</span>}
                                        {v.barcode && <span className="text-[10px] font-mono text-muted-foreground flex items-center gap-0.5"><Barcode className="w-3 h-3" />{v.barcode}</span>}
                                        <span className="text-xs font-mono ml-auto">{fmt(v.salePrice)}</span>
                                        <span className={`text-xs font-mono font-bold w-10 text-center ${v.stockQuantity <= v.minStock ? 'text-red-600' : 'text-emerald-600'}`}>{v.stockQuantity}</span>
                                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEditVar(p, v)}><Edit className="w-3 h-3" /></Button>
                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500" onClick={() => handleDeleteVar(p.id, v.id)}><Trash2 className="w-3 h-3" /></Button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })()}
                    </>
                  );
                })}
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
      </div>

      {/* Product Dialog */}
      {showCelebration && (
        <OnboardingCelebration
          emoji="📦"
          title="Excelente."
          subtitle="Seu primeiro produto foi cadastrado."
          autoClose={2000}
          onAction={() => navRouter.push('/clientes?onboarding=true')}
        />
      )}

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!onboardingMode || open) setDialogOpen(open); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-display">{onboardingMode ? 'Cadastre seu primeiro produto' : editing ? 'Editar Produto' : 'Novo Produto'}</DialogTitle></DialogHeader>
          {onboardingMode && <p className="text-sm text-muted-foreground mb-2">Apenas o essencial. Você pode completar depois.</p>}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2"><Label>Nome *</Label><Input value={form?.name??''} onChange={(e: any) => setForm({...(form??{}), name: e?.target?.value??''})} autoFocus /></div>
              {!onboardingMode && <div><Label>SKU</Label><Input value={form?.sku??''} onChange={(e: any) => setForm({...(form??{}), sku: e?.target?.value??''})} placeholder={editing ? '' : 'Gerado automaticamente'} disabled={!isAdmin} className={!isAdmin ? 'bg-muted' : ''} /></div>}
              {!onboardingMode && <div><Label>Código de Barras</Label><Input value={form?.barcode??''} onChange={(e: any) => setForm({...(form??{}), barcode: e?.target?.value??''})} /></div>}
              {!onboardingMode && <div><Label>Preço de Custo</Label><CurrencyInput value={parseFloat(form?.costPrice) || 0} onChange={(v: number) => setForm({...(form??{}), costPrice: String(v)})} /></div>}
              <div><Label>Preço de Venda</Label><CurrencyInput value={parseFloat(form?.salePrice) || 0} onChange={(v: number) => setForm({...(form??{}), salePrice: String(v)})} /></div>
              {!onboardingMode && <div><Label>Margem</Label><Input value={`${margin}%`} disabled className="bg-muted" /></div>}
              <div><Label>Categoria</Label>
                <select className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm" value={form?.categoryId??''} onChange={(e: any) => setForm({...(form??{}), categoryId: e?.target?.value??''})}>
                  <option value="">Sem categoria</option>
                  {(categories??[]).map((c: any) => <option key={c?.id??''} value={c?.id??''}>{c?.name??''}</option>)}
                </select>
              </div>
              {!editing && <div><Label>Estoque Inicial</Label><Input type="number" value={form?.stockQuantity??''} onChange={(e: any) => setForm({...(form??{}), stockQuantity: e?.target?.value??''})} /></div>}
              {!onboardingMode && <div><Label>Estoque Mínimo</Label><Input type="number" value={form?.minStock??''} onChange={(e: any) => setForm({...(form??{}), minStock: e?.target?.value??''})} /></div>}
              {!onboardingMode && <div className="col-span-2"><Label>Descrição</Label><Input value={form?.description??''} onChange={(e: any) => setForm({...(form??{}), description: e?.target?.value??''})} /></div>}
            </div>
            {/* Price Tables section - only when editing and admin */}
            {editing && isAdmin && (
              <div className="border-t pt-4 mt-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Tag className="w-4 h-4 text-amber-600" />
                    <span className="text-sm font-semibold">Tabelas de Preço por Quantidade</span>
                    {(editing?.priceTables?.length ?? 0) > 0 && (
                      <Badge variant="secondary" className="text-[10px] h-5 px-1.5 bg-amber-100 text-amber-700 border-amber-300">{editing.priceTables.length} {editing.priceTables.length === 1 ? 'tabela' : 'tabelas'}</Badge>
                    )}
                  </div>
                  <Button variant="outline" size="sm" className="h-8 text-amber-600 border-amber-300 hover:bg-amber-50" onClick={() => { setDialogOpen(false); openPriceTableDialog(editing); }}>
                    <Tag className="w-3.5 h-3.5 mr-1.5" />
                    Gerenciar Tabelas
                  </Button>
                </div>
                {(editing?.priceTables?.length ?? 0) > 0 ? (
                  <div className="mt-2 space-y-1.5">
                    {(editing.priceTables ?? []).filter((pt: any) => pt?.isActive !== false).slice(0, 3).map((pt: any) => (
                      <div key={pt.id} className="flex items-center justify-between bg-amber-50/50 border border-amber-200/50 rounded-lg px-3 py-1.5 text-xs">
                        <span className="font-medium text-amber-800">{pt.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Mín: {pt.minQuantity} un.</span>
                          <span className="font-mono font-bold text-amber-700">{fmt(pt.unitPrice)}</span>
                          {editing.salePrice > 0 && <Badge variant="outline" className="text-[10px] h-4 px-1 border-emerald-400 text-emerald-600">-{(((editing.salePrice - pt.unitPrice) / editing.salePrice) * 100).toFixed(0)}%</Badge>}
                        </div>
                      </div>
                    ))}
                    {(editing.priceTables ?? []).filter((pt: any) => pt?.isActive !== false).length > 3 && (
                      <p className="text-[10px] text-muted-foreground text-center">+{editing.priceTables.filter((pt: any) => pt?.isActive !== false).length - 3} tabela(s) a mais...</p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground mt-1.5">Nenhuma tabela de preço configurada. Clique em &quot;Gerenciar Tabelas&quot; para criar.</p>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2">
              {!onboardingMode && <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>}
              <Button onClick={handleSave}>{onboardingMode ? 'Cadastrar' : editing ? 'Salvar' : 'Criar'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Single Variation Dialog */}
      <Dialog open={varDialog} onOpenChange={setVarDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="font-display">{editingVar ? 'Editar Variação' : 'Nova Variação'}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground -mt-2">Produto: <strong>{varProduct?.name}</strong></p>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Cor</Label><Input value={varForm?.color??''} onChange={(e: any) => setVarForm({...(varForm??{}), color: e?.target?.value??''})} placeholder="Ex: Preto" /></div>
            <div><Label>Tamanho</Label>
              <select className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm" value={varForm?.size??''} onChange={(e: any) => setVarForm({...(varForm??{}), size: e?.target?.value??''})}>
                <option value="">Selecione</option>
                {SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                <option value="UN">UN</option>
              </select>
            </div>
            <div><Label>Grade</Label><Input value={varForm?.grade??''} onChange={(e: any) => setVarForm({...(varForm??{}), grade: e?.target?.value??''})} placeholder="Opcional" /></div>
            <div><Label>SKU</Label><Input value={varForm?.sku??''} onChange={(e: any) => setVarForm({...(varForm??{}), sku: e?.target?.value??''})} /></div>
            <div><Label>Código de Barras</Label><Input value={varForm?.barcode??''} onChange={(e: any) => setVarForm({...(varForm??{}), barcode: e?.target?.value??''})} /></div>
            <div><Label>Preço Custo</Label><CurrencyInput value={parseFloat(varForm?.costPrice) || 0} onChange={(v: number) => setVarForm({...(varForm??{}), costPrice: String(v)})} /></div>
            <div><Label>Preço Venda</Label><CurrencyInput value={parseFloat(varForm?.salePrice) || 0} onChange={(v: number) => setVarForm({...(varForm??{}), salePrice: String(v)})} /></div>
            <div><Label>Estoque</Label><Input type="number" value={varForm?.stockQuantity??''} onChange={(e: any) => setVarForm({...(varForm??{}), stockQuantity: e?.target?.value??''})} /></div>
            <div><Label>Estoque Mín.</Label><Input type="number" value={varForm?.minStock??''} onChange={(e: any) => setVarForm({...(varForm??{}), minStock: e?.target?.value??''})} /></div>
          </div>
          <DialogFooter className="gap-2">
            {editingVar && <Button variant="destructive" size="sm" onClick={() => { handleDeleteVar(varProduct?.id, editingVar.id); setVarDialog(false); }}>Excluir</Button>}
            <Button variant="outline" onClick={() => setVarDialog(false)}>Cancelar</Button>
            <Button onClick={handleSaveVar}>{editingVar ? 'Salvar' : 'Criar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Variation Dialog (Grade Rápida) */}
      <Dialog open={bulkDialog} onOpenChange={setBulkDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="font-display">Grade Rápida de Variações</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground -mt-2">Produto: <strong>{bulkProduct?.name}</strong> — Selecione cores e tamanhos para gerar a grade</p>
          <div className="space-y-4">
            <div>
              <Label className="mb-2 block">Cores</Label>
              <div className="flex flex-wrap gap-2">
                {DEFAULT_COLORS.map(c => (
                  <button key={c} onClick={() => toggleBulkColor(c)} className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${bulkColors.includes(c) ? 'bg-blue-600 text-white border-blue-600' : 'bg-background border-border hover:border-blue-300'}`}>{c}</button>
                ))}
              </div>
            </div>
            <div>
              <Label className="mb-2 block">Tamanhos</Label>
              <div className="flex flex-wrap gap-2">
                {SIZES.map(s => (
                  <button key={s} onClick={() => toggleBulkSize(s)} className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${bulkSizes.includes(s) ? 'bg-blue-600 text-white border-blue-600' : 'bg-background border-border hover:border-blue-300'}`}>{s}</button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div><Label>Estoque por variação</Label><Input type="number" className="w-24" value={bulkStock} onChange={(e) => setBulkStock(e.target.value)} /></div>
              <div className="flex-1 text-right">
                {bulkColors.length > 0 && bulkSizes.length > 0 && (
                  <Badge variant="secondary" className="text-sm">{bulkColors.length} cores × {bulkSizes.length} tamanhos = <strong>{bulkColors.length * bulkSizes.length}</strong> variações</Badge>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDialog(false)}>Cancelar</Button>
            <Button onClick={handleBulkCreate} disabled={bulkColors.length === 0 || bulkSizes.length === 0}>Criar Grade</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Price Table Dialog */}
      <Dialog open={ptDialog} onOpenChange={setPtDialog}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <Tag className="w-5 h-5 text-amber-600" />
              Tabelas de Preço por Quantidade
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground -mt-2">
            Produto: <strong>{ptProduct?.name}</strong> — Preço base: <strong>{fmt(ptProduct?.salePrice ?? 0)}</strong>
          </p>

          {/* Current tables */}
          {ptLoading && <p className="text-sm text-muted-foreground py-4 text-center">Carregando...</p>}
          {!ptLoading && ptList.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tabelas Ativas</p>
              {ptList.filter(t => t.isActive).map((pt: any) => {
                const discount = ptProduct?.salePrice ? ((1 - pt.unitPrice / ptProduct.salePrice) * 100) : 0;
                return (
                  <div key={pt.id} className="flex items-center gap-3 p-3 rounded-lg bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-800/30">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{pt.name}</span>
                        <Badge variant="outline" className="text-[10px] h-4 px-1.5">≥ {pt.minQuantity} pç</Badge>
                        {discount > 0 && <Badge className="text-[10px] h-4 px-1.5 bg-green-100 text-green-700 border-green-300">-{discount.toFixed(1)}%</Badge>}
                      </div>
                      {pt.notes && <p className="text-[11px] text-muted-foreground mt-0.5">{pt.notes}</p>}
                    </div>
                    <span className="font-mono font-bold text-sm text-amber-700">{fmt(pt.unitPrice)}</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEditPt(pt)}><Edit className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => handleDeletePt(pt.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                );
              })}
              {ptList.filter(t => !t.isActive).length > 0 && (
                <>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mt-3">Inativas</p>
                  {ptList.filter(t => !t.isActive).map((pt: any) => (
                    <div key={pt.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border/30 opacity-60">
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-sm line-through">{pt.name}</span>
                        <span className="ml-2 text-xs text-muted-foreground">≥ {pt.minQuantity} pç — {fmt(pt.unitPrice)}</span>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
          {!ptLoading && ptList.length === 0 && (
            <div className="text-center py-6 text-muted-foreground">
              <DollarSign className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nenhuma tabela de preço cadastrada</p>
              <p className="text-xs">Crie tabelas para oferecer preços especiais por quantidade</p>
            </div>
          )}

          {/* Add/Edit form */}
          <div className="border-t pt-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {ptEditing ? 'Editar Tabela' : 'Nova Tabela de Preço'}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Nome da Tabela *</Label>
                <Input placeholder="Ex: Atacado 6 peças" value={ptForm.name} onChange={(e: any) => setPtForm({ ...ptForm, name: e.target.value })} />
              </div>
              <div>
                <Label>Qtd. Mínima</Label>
                <Input type="number" placeholder="6" min="1" value={ptForm.minQuantity} onChange={(e: any) => setPtForm({ ...ptForm, minQuantity: e.target.value })} />
              </div>
              <div>
                <Label>Preço Unitário (R$) *</Label>
                <CurrencyInput value={parseFloat(ptForm.unitPrice) || 0} onChange={(v: number) => setPtForm({ ...ptForm, unitPrice: String(v) })} />
              </div>
              <div className="col-span-2">
                <Label>Observações</Label>
                <Input placeholder="Opcional" value={ptForm.notes} onChange={(e: any) => setPtForm({ ...ptForm, notes: e.target.value })} />
              </div>
              {ptForm.unitPrice && ptProduct?.salePrice > 0 && (
                <div className="col-span-2 text-xs text-muted-foreground">
                  Desconto: <strong className="text-green-600">{((1 - parseFloat(ptForm.unitPrice) / ptProduct.salePrice) * 100).toFixed(1)}%</strong> sobre o preço base
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2">
              {ptEditing && <Button variant="outline" size="sm" onClick={resetPtForm}>Cancelar Edição</Button>}
              <Button size="sm" onClick={handleSavePt} disabled={ptLoading}>
                {ptEditing ? 'Salvar Alterações' : 'Adicionar Tabela'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
