'use client';

import { useState, useEffect, useCallback } from 'react';
import { AppHeader } from '@/components/app-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Search, ShoppingCart, Eye, ChevronLeft, ChevronRight, XCircle, Download, Loader2, ClipboardList, Trash2, CheckCircle, Send, Edit } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { CurrencyInput } from '@/components/ui/currency-input';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatSaleNumber } from '@/lib/sale-number';

const statusColors: Record<string, string> = { concluida: 'bg-emerald-100 text-emerald-700', pendente: 'bg-amber-100 text-amber-700', cancelada: 'bg-red-100 text-red-700', orcamento: 'bg-blue-100 text-blue-700' };
const statusLabels: Record<string, string> = { concluida: 'Concluída', pendente: 'Pendente', cancelada: 'Cancelada', orcamento: 'Orçamento' };
const paymentLabels: Record<string, string> = { dinheiro: 'Dinheiro', pix: 'PIX', cartao_credito: 'Cartão Crédito', cartao_debito: 'Cartão Débito', boleto: 'Boleto' };

function formatCurrency(v: number) { return (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function formatDate(d: string) { return d ? new Date(d).toLocaleDateString('pt-BR') : '-'; }

export function VendasContent() {
  const router = useRouter();
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [detailSale, setDetailSale] = useState<any>(null);
  const [newSaleOpen, setNewSaleOpen] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [saleForm, setSaleForm] = useState<any>({ customerId: '', paymentMethod: 'pix', discount: '0', notes: '', items: [{ productId: '', quantity: 1, unitPrice: 0, discount: 0 }] });
  const [saving, setSaving] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [sharePdfLoading, setSharePdfLoading] = useState(false);

  const fmt = (v: number | null | undefined) => (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const formatWhatsAppNumber = (num: string | null | undefined): string | null => {
    if (!num) return null;
    const digits = num.replace(/\D/g, '');
    if (digits.length < 10) return null;
    if (digits.startsWith('55')) return digits;
    return `55${digits}`;
  };

  const handleDownloadPDF = async (saleId: string, displayNumber: string) => {
    setPdfLoading(true);
    try {
      const res = await fetch(`/api/vendas/${saleId}/comprovante`);
      if (!res.ok) throw new Error('Erro ao gerar PDF');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `comprovante-${displayNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('PDF gerado com sucesso!');
    } catch { toast.error('Erro ao gerar o comprovante PDF'); }
    setPdfLoading(false);
  };

  // Share comprovante using navigator.share (native share sheet) with fallback
  const handleShareComprovante = async (sale: any) => {
    if (!sale) return;
    setSharePdfLoading(true);
    try {
      const res = await fetch(`/api/vendas/${sale.id}/comprovante`);
      if (!res.ok) throw new Error('Erro ao gerar PDF');
      const blob = await res.blob();
      const isOrcamento = sale.status === 'orcamento';
      const docType = isOrcamento ? 'orcamento' : 'comprovante';
      const displayNum = formatSaleNumber(sale.companySaleNumber, sale.saleNumber);
      const fileName = `${docType}-${displayNum}.pdf`;
      const shareText = `Olá${sale.customer?.name ? ', ' + sale.customer.name : ''}! 😊\n\nSegue o ${isOrcamento ? 'orçamento' : 'comprovante'} #${displayNum}.\n\nTotal: ${fmt(sale.total)}\n\nObrigado pela preferência ❤️`;

      // Try native share with file (mobile)
      if (typeof navigator !== 'undefined' && navigator.share) {
        const file = new File([blob], fileName, { type: 'application/pdf' });
        const canShareFiles = navigator.canShare && navigator.canShare({ files: [file] });

        if (canShareFiles) {
          await navigator.share({
            title: `${isOrcamento ? 'Orçamento' : 'Comprovante'} #${displayNum}`,
            text: shareText,
            files: [file],
          });
          toast.success('Comprovante compartilhado!');
        } else {
          // Share text only + download PDF
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url; a.download = fileName;
          document.body.appendChild(a); a.click();
          document.body.removeChild(a); URL.revokeObjectURL(url);

          await navigator.share({
            title: `${isOrcamento ? 'Orçamento' : 'Comprovante'} #${displayNum}`,
            text: shareText,
          });
          toast.success('PDF baixado e mensagem compartilhada!');
        }
      } else {
        // Fallback for desktop: download PDF + open WhatsApp if phone exists
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = fileName;
        document.body.appendChild(a); a.click();
        document.body.removeChild(a); URL.revokeObjectURL(url);

        const phone = formatWhatsAppNumber(sale?.customer?.whatsapp || sale?.customer?.phone);
        if (phone) {
          const msg = encodeURIComponent(shareText);
          setTimeout(() => { window.open(`https://wa.me/${phone}?text=${msg}`, '_blank'); }, 500);
          toast.success('PDF baixado! Anexe na conversa do WhatsApp.', { duration: 5000 });
        } else {
          toast.success('PDF baixado com sucesso!');
        }
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') { /* user cancelled */ }
      else { toast.error('Erro ao compartilhar comprovante'); console.error(err); }
    }
    setSharePdfLoading(false);
  };

  const fetchSales = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: String(page), search, status: statusFilter });
      const res = await fetch(`/api/vendas?${params}`);
      if (res.ok) { const d = await res.json(); setSales(d?.sales ?? []); setTotalPages(d?.pages ?? 1); }
    } catch (e: any) { console.error(e); } finally { setLoading(false); }
  }, [page, search, statusFilter]);

  useEffect(() => { fetchSales(); }, [fetchSales]);

  const fetchFormData = useCallback(async () => {
    try {
      const [cRes, pRes] = await Promise.all([fetch('/api/clientes?limit=100'), fetch('/api/produtos?limit=100')]);
      if (cRes.ok) { const d = await cRes.json(); setCustomers(d?.customers ?? []); }
      if (pRes.ok) { const d = await pRes.json(); setProducts(d?.products ?? []); }
    } catch (e: any) { console.error(e); }
  }, []);

  const openNewSale = () => {
    fetchFormData();
    setSaleForm({ customerId: '', paymentMethod: 'pix', discount: '0', notes: '', items: [{ productId: '', quantity: 1, unitPrice: 0, discount: 0 }] });
    setNewSaleOpen(true);
  };

  const addItem = () => {
    setSaleForm((prev: any) => ({ ...(prev ?? {}), items: [...(prev?.items ?? []), { productId: '', quantity: 1, unitPrice: 0, discount: 0 }] }));
  };

  const removeItem = (idx: number) => {
    setSaleForm((prev: any) => ({ ...(prev ?? {}), items: (prev?.items ?? []).filter((_: any, i: number) => i !== idx) }));
  };

  const updateItem = (idx: number, field: string, value: any) => {
    setSaleForm((prev: any) => {
      const items = [...(prev?.items ?? [])];
      items[idx] = { ...(items[idx] ?? {}), [field]: value };
      if (field === 'productId') {
        const product = (products ?? []).find((p: any) => p?.id === value);
        if (product) items[idx].unitPrice = product?.salePrice ?? 0;
      }
      return { ...(prev ?? {}), items };
    });
  };

  const calcSubtotal = () => {
    return (saleForm?.items ?? []).reduce((acc: number, item: any) => acc + ((item?.unitPrice ?? 0) * (item?.quantity ?? 1) - (item?.discount ?? 0)), 0);
  };

  const handleCreateSale = async () => {
    const items = (saleForm?.items ?? []).filter((i: any) => i?.productId);
    if (items.length === 0) { toast.error('Adicione pelo menos um item'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/vendas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...saleForm, items }),
      });
      if (res.ok) {
        toast.success('Venda realizada com sucesso!');
        setNewSaleOpen(false);
        fetchSales();
      } else {
        const d = await res.json();
        toast.error(d?.error ?? 'Erro ao criar venda');
      }
    } catch (e: any) { toast.error('Erro'); console.error(e); } finally { setSaving(false); }
  };

  // Cancel dialog state
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<{ id: string; isOrcamento: boolean; displayNumber?: string } | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  const openCancelDialog = (id: string, isOrcamento: boolean, displayNumber?: string) => {
    setCancelTarget({ id, isOrcamento, displayNumber });
    setCancelReason('');
    setCancelDialogOpen(true);
  };

  const executeCancellation = async () => {
    if (!cancelTarget) return;
    const { id, isOrcamento } = cancelTarget;

    // Require reason for finalized sales
    if (!isOrcamento && !cancelReason.trim()) {
      toast.error('Informe o motivo do cancelamento');
      return;
    }

    setCancelling(true);
    try {
      const res = await fetch(`/api/vendas/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelada', cancelReason: cancelReason.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(isOrcamento ? 'Orçamento cancelado' : 'Venda cancelada com estorno financeiro completo');
        setCancelDialogOpen(false);
        setCancelTarget(null);
        setDetailSale(null);
        fetchSales();
      } else {
        toast.error(data?.error ?? 'Erro ao cancelar');
      }
    } catch (e: any) { toast.error('Erro ao cancelar'); console.error(e); }
    setCancelling(false);
  };

  const handleDeleteOrcamento = async (id: string) => {
    if (!confirm('Excluir este orçamento? O estoque será restaurado e o registro será removido.')) return;
    try {
      const res = await fetch(`/api/vendas/${id}`, { method: 'DELETE' });
      if (res.ok) { toast.success('Orçamento excluído e estoque restaurado'); fetchSales(); if (detailSale?.id === id) setDetailSale(null); }
      else { const d = await res.json(); toast.error(d?.error ?? 'Erro'); }
    } catch (e: any) { toast.error('Erro'); console.error(e); }
  };

  const handleConvertToSale = (id: string) => {
    toast.info('Abrindo orçamento no PDV para fechamento com pagamento...');
    if (detailSale) setDetailSale(null);
    router.push(`/pdv?edit=${id}`);
  };

  // Legacy direct conversion — kept for reference, replaced by redirect above
  const _handleConvertToSaleLegacy = async (id: string) => {
    if (!confirm('Converter este orçamento em venda concluída?')) return;
    try {
      const res = await fetch(`/api/vendas/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'concluida' }),
      });
      if (res.ok) { toast.success('Orçamento convertido em venda!'); fetchSales(); if (detailSale) setDetailSale({ ...detailSale, status: 'concluida' }); }
      else { const d = await res.json(); toast.error(d?.error ?? 'Erro'); }
    } catch (e: any) { toast.error('Erro'); console.error(e); }
  };

  return (
    <div>
      <AppHeader title="Vendas" />
      <div className="p-4 lg:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Buscar vendas..." value={search} onChange={(e: any) => { setSearch(e?.target?.value ?? ''); setPage(1); }} className="pl-9" />
            </div>
            <select className="h-10 px-3 rounded-md border border-input bg-background text-sm" value={statusFilter} onChange={(e: any) => { setStatusFilter(e?.target?.value ?? ''); setPage(1); }}>
              <option value="">Todos os status</option>
              <option value="concluida">Concluídas</option>
              <option value="orcamento">Orçamentos</option>
              <option value="pendente">Pendentes</option>
              <option value="cancelada">Canceladas</option>
            </select>
          </div>
          <Button onClick={openNewSale}><Plus className="w-4 h-4 mr-2" />Nova Venda</Button>
        </div>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="hidden md:table-cell">Vendedor</TableHead>
                  <TableHead className="hidden sm:table-cell">Pagamento</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="hidden md:table-cell">Data</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={`sk-${i}`}>
                    {Array.from({ length: 8 }).map((_, c) => (
                      <TableCell key={c}><div className="skeleton h-4 w-full rounded" /></TableCell>
                    ))}
                  </TableRow>
                ))}
                {!loading && (sales?.length ?? 0) === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="py-12">
                      <div className="flex flex-col items-center gap-2 text-center">
                        <div className="w-12 h-12 rounded-2xl bg-muted/60 flex items-center justify-center animate-float"><ShoppingCart className="w-6 h-6 text-muted-foreground/40" /></div>
                        <p className="text-sm font-medium text-foreground/80">Nenhuma venda encontrada</p>
                        <p className="text-xs text-muted-foreground">Altere os filtros ou inicie uma nova venda no PDV.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                {(sales ?? []).map((s: any) => (
                  <TableRow key={s?.id ?? ''}>
                    <TableCell className="font-mono text-sm">#{formatSaleNumber(s?.companySaleNumber, s?.saleNumber)}</TableCell>
                    <TableCell className="text-sm">{s?.customer?.name ?? 'Sem cliente'}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{s?.seller?.name ?? '-'}</TableCell>
                    <TableCell className="hidden sm:table-cell text-sm">{paymentLabels[s?.paymentMethod ?? ''] ?? s?.paymentMethod ?? ''}</TableCell>
                    <TableCell className="text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${statusColors[s?.status ?? ''] ?? ''}`}>
                        {statusLabels[s?.status ?? ''] ?? s?.status ?? ''}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono font-medium text-sm">{formatCurrency(s?.total ?? 0)}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{formatDate(s?.createdAt ?? '')}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDetailSale(s)}><Eye className="w-3.5 h-3.5" /></Button>
                        {s?.status === 'orcamento' && (
                          <>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600" title="Editar orçamento" onClick={() => router.push(`/pdv?edit=${s?.id ?? ''}`)}><Edit className="w-3.5 h-3.5" /></Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-600" title="Converter em venda" onClick={() => handleConvertToSale(s?.id ?? '')}><CheckCircle className="w-3.5 h-3.5" /></Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" title="Excluir orçamento" onClick={() => handleDeleteOrcamento(s?.id ?? '')}><Trash2 className="w-3.5 h-3.5" /></Button>
                          </>
                        )}
                        {s?.status === 'concluida' && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" title="Cancelar venda" onClick={() => openCancelDialog(s?.id ?? '', false, formatSaleNumber(s?.companySaleNumber, s?.saleNumber))}><XCircle className="w-3.5 h-3.5" /></Button>
                        )}
                      </div>
                    </TableCell>
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
      </div>

      {/* Sale Detail Dialog */}
      <Dialog open={!!detailSale} onOpenChange={() => setDetailSale(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              {detailSale?.status === 'orcamento' && <ClipboardList className="w-5 h-5 text-blue-600" />}
              {detailSale?.status === 'orcamento' ? 'Orçamento' : 'Venda'} #{formatSaleNumber(detailSale?.companySaleNumber, detailSale?.saleNumber)}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-muted-foreground">Cliente:</span> <span className="font-medium">{detailSale?.customer?.name ?? 'Sem cliente'}</span></div>
              <div><span className="text-muted-foreground">Vendedor:</span> <span className="font-medium">{detailSale?.seller?.name ?? '-'}</span></div>
              <div><span className="text-muted-foreground">Pagamento:</span> <span className="font-medium">{detailSale?.status === 'orcamento' ? 'Pendente' : (paymentLabels[detailSale?.paymentMethod ?? ''] ?? detailSale?.paymentMethod ?? '')}</span></div>
              <div><span className="text-muted-foreground">Status:</span> <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${statusColors[detailSale?.status ?? ''] ?? ''}`}>{statusLabels[detailSale?.status ?? ''] ?? ''}</span></div>
            </div>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader><TableRow><TableHead>Produto</TableHead><TableHead className="text-center">Qtd</TableHead><TableHead className="text-right">Unit.</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
                <TableBody>
                  {(detailSale?.items ?? []).map((item: any) => (
                    <TableRow key={item?.id ?? ''}>
                      <TableCell className="text-sm">
                        <div>
                          <span>{item?.product?.name ?? ''}</span>
                          {item?.variation && <span className="text-[10px] text-muted-foreground ml-1">({[item.variation.color, item.variation.size].filter(Boolean).join(' • ')})</span>}
                          {item?.priceTableName && (
                            <div className="text-[10px] text-amber-600 mt-0.5">📦 {item.priceTableName}{item.priceDiscount > 0 ? ` (-${formatCurrency(item.priceDiscount)}/un)` : ''}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center text-sm font-mono">{item?.quantity ?? 0}</TableCell>
                      <TableCell className="text-right text-sm font-mono">{formatCurrency(item?.unitPrice ?? 0)}</TableCell>
                      <TableCell className="text-right text-sm font-mono font-medium">{formatCurrency(item?.total ?? 0)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex justify-between text-sm pt-2 border-t">
              <span>Desconto: {formatCurrency(detailSale?.discount ?? 0)}</span>
              <span className="font-bold text-lg num-highlight">{formatCurrency(detailSale?.total ?? 0)}</span>
            </div>
            {/* Audit trail info */}
            {(detailSale?.createdByName || detailSale?.updatedByName) && (
              <div className="text-[11px] text-muted-foreground space-y-0.5 bg-muted/50 rounded-md px-3 py-2">
                {detailSale?.createdByName && (
                  <p>Criado por <span className="font-medium text-foreground">{detailSale.createdByName}</span> em {formatDate(detailSale.createdAt)}</p>
                )}
                {detailSale?.updatedByName && (
                  <p>Editado por <span className="font-medium text-foreground">{detailSale.updatedByName}</span> em {detailSale.updatedAt ? formatDate(detailSale.updatedAt) : '-'}</p>
                )}
                {detailSale?.editHistory && (() => {
                  try {
                    const history = JSON.parse(detailSale.editHistory);
                    if (Array.isArray(history) && history.length > 0) {
                      return (
                        <details className="mt-1">
                          <summary className="cursor-pointer text-blue-600 hover:underline">Histórico de edições ({history.length})</summary>
                          <ul className="mt-1 space-y-0.5 pl-3">
                            {history.map((h: any, i: number) => (
                              <li key={i}>• {h.userName || 'Sistema'} — {h.editedAt ? new Date(h.editedAt).toLocaleString('pt-BR') : '-'}</li>
                            ))}
                          </ul>
                        </details>
                      );
                    }
                  } catch { /* ignore parse error */ }
                  return null;
                })()}
              </div>
            )}
            {detailSale?.status === 'orcamento' && (
              <div className="rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 p-3 text-xs text-blue-700 dark:text-blue-300 flex items-center gap-2">
                <ClipboardList className="w-4 h-4 flex-shrink-0" />
                <span>Itens reservados no estoque. Converta em venda para gerar registros financeiros.</span>
              </div>
            )}
            <div className="pt-3 border-t space-y-2">
                <Button
                size="sm"
                onClick={() => handleShareComprovante(detailSale)}
                disabled={sharePdfLoading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              >
                {sharePdfLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                {sharePdfLoading ? 'Preparando...' : detailSale?.status === 'orcamento' ? 'Compartilhar Orçamento' : 'Compartilhar Comprovante'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleDownloadPDF(detailSale?.id, formatSaleNumber(detailSale?.companySaleNumber, detailSale?.saleNumber))}
                disabled={pdfLoading}
                className="w-full"
              >
                {pdfLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                {pdfLoading ? 'Gerando...' : detailSale?.status === 'orcamento' ? 'Baixar Orçamento PDF' : 'Baixar Comprovante PDF'}
              </Button>
              {detailSale?.status === 'orcamento' && (
                <div className="space-y-2">
                  <Button size="sm" className="w-full bg-blue-600 hover:bg-blue-700 text-white" onClick={() => { setDetailSale(null); router.push(`/pdv?edit=${detailSale?.id ?? ''}`); }}>
                    <Edit className="w-4 h-4 mr-2" />Editar Orçamento
                  </Button>
                  <div className="grid grid-cols-2 gap-2">
                    <Button size="sm" variant="default" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => handleConvertToSale(detailSale?.id ?? '')}>
                      <CheckCircle className="w-4 h-4 mr-2" />Converter em Venda
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => handleDeleteOrcamento(detailSale?.id ?? '')}>
                      <Trash2 className="w-4 h-4 mr-2" />Excluir Orçamento
                    </Button>
                  </div>
                </div>
              )}
              {detailSale?.status === 'concluida' && (
                <Button size="sm" variant="destructive" className="w-full" onClick={() => openCancelDialog(detailSale?.id ?? '', false, formatSaleNumber(detailSale?.companySaleNumber, detailSale?.saleNumber))}>
                  <XCircle className="w-4 h-4 mr-2" />Cancelar Venda
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* New Sale Dialog */}
      <Dialog open={newSaleOpen} onOpenChange={setNewSaleOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-display">Nova Venda</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Cliente</Label>
                <select className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm" value={saleForm?.customerId ?? ''} onChange={(e: any) => setSaleForm({ ...(saleForm ?? {}), customerId: e?.target?.value ?? '' })}>
                  <option value="">Sem cliente</option>
                  {(customers ?? []).map((c: any) => <option key={c?.id ?? ''} value={c?.id ?? ''}>{c?.name ?? ''}</option>)}
                </select>
              </div>
              <div><Label>Pagamento</Label>
                <select className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm" value={saleForm?.paymentMethod ?? 'pix'} onChange={(e: any) => setSaleForm({ ...(saleForm ?? {}), paymentMethod: e?.target?.value ?? 'pix' })}>
                  {Object.entries(paymentLabels).map(([k, v]: [string, string]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <Label>Itens</Label>
                <Button variant="outline" size="sm" onClick={addItem}><Plus className="w-3 h-3 mr-1" />Adicionar</Button>
              </div>
              <div className="space-y-2">
                {(saleForm?.items ?? []).map((item: any, idx: number) => (
                  <div key={idx} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
                    <select className="flex-1 h-9 px-2 rounded-md border border-input bg-background text-sm" value={item?.productId ?? ''} onChange={(e: any) => updateItem(idx, 'productId', e?.target?.value ?? '')}>
                      <option value="">Selecione...</option>
                      {(products ?? []).map((p: any) => <option key={p?.id ?? ''} value={p?.id ?? ''}>{p?.name ?? ''} (Est: {p?.stockQuantity ?? 0})</option>)}
                    </select>
                    <Input type="number" min="1" className="w-16 h-9" value={item?.quantity ?? 1} onChange={(e: any) => updateItem(idx, 'quantity', parseInt(e?.target?.value) || 1)} />
                    <CurrencyInput value={item?.unitPrice ?? 0} onChange={(v: number) => updateItem(idx, 'unitPrice', v)} className="w-24 h-9" />
                    <span className="text-sm font-mono w-24 text-right">{formatCurrency((item?.unitPrice ?? 0) * (item?.quantity ?? 1))}</span>
                    {(saleForm?.items?.length ?? 0) > 1 && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => removeItem(idx)}><XCircle className="w-4 h-4" /></Button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div><Label>Desconto (R$)</Label><CurrencyInput value={parseFloat(saleForm?.discount) || 0} onChange={(v: number) => setSaleForm({ ...(saleForm ?? {}), discount: String(v) })} /></div>
              <div><Label>Observações</Label><Input value={saleForm?.notes ?? ''} onChange={(e: any) => setSaleForm({ ...(saleForm ?? {}), notes: e?.target?.value ?? '' })} /></div>
            </div>

            <div className="flex justify-between items-center pt-2 border-t">
              <div>
                <p className="text-sm text-muted-foreground">Subtotal: {formatCurrency(calcSubtotal())}</p>
                <p className="text-lg font-bold">Total: <span className="num-highlight">{formatCurrency(calcSubtotal() - (parseFloat(saleForm?.discount) || 0))}</span></p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setNewSaleOpen(false)}>Cancelar</Button>
                <Button onClick={handleCreateSale} disabled={saving}>
                  {saving ? 'Salvando...' : 'Finalizar Venda'}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cancel Confirmation Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={(open) => { if (!cancelling) setCancelDialogOpen(open); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600">
              {cancelTarget?.isOrcamento ? 'Cancelar Orçamento' : 'Cancelar Venda'}
              {cancelTarget?.displayNumber ? ` #${cancelTarget.displayNumber}` : ''}
            </DialogTitle>
          </DialogHeader>

          {cancelTarget?.isOrcamento ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                O orçamento será cancelado e o estoque reservado será restaurado.
              </p>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setCancelDialogOpen(false)} disabled={cancelling}>Voltar</Button>
                <Button variant="destructive" onClick={executeCancellation} disabled={cancelling}>
                  {cancelling ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  {cancelling ? 'Cancelando...' : 'Confirmar Cancelamento'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-300 space-y-1">
                <p className="font-semibold">⚠️ Atenção: esta ação irá estornar:</p>
                <ul className="list-disc list-inside text-xs space-y-0.5">
                  <li>Saldo dos caixas afetados</li>
                  <li>Registros financeiros (entrada → saída)</li>
                  <li>Contas a receber vinculadas</li>
                  <li>Recebíveis futuros de cartão</li>
                  <li>Taxas de cartão previstas</li>
                  <li>Estoque dos itens vendidos</li>
                  <li>Estatísticas do cliente</li>
                </ul>
              </div>
              <div>
                <Label className="text-sm font-medium">Motivo do cancelamento <span className="text-red-500">*</span></Label>
                <Textarea
                  placeholder="Informe o motivo do cancelamento..."
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="mt-1"
                  rows={3}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setCancelDialogOpen(false)} disabled={cancelling}>Voltar</Button>
                <Button
                  variant="destructive"
                  onClick={executeCancellation}
                  disabled={cancelling || !cancelReason.trim()}
                >
                  {cancelling ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  {cancelling ? 'Estornando...' : 'Confirmar Cancelamento e Estorno'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}