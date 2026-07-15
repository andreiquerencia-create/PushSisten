'use client';

import { useState, useEffect, useCallback } from 'react';
import { AppHeader } from '@/components/app-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ClipboardList, ShoppingCart, Package, Users, Trophy, TrendingUp, AlertTriangle, CalendarDays, Tag } from 'lucide-react';
import { toast } from 'sonner';
import { formatSaleNumber } from '@/lib/sale-number';

const fmt = (v: number | null | undefined) => {
  if (v == null || isNaN(v)) return 'R$ 0,00';
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};
const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('pt-BR') : '-';

type ReportType = 'vendas-periodo' | 'vendas-vendedor' | 'vendas-produto' | 'estoque-atual' | 'produtos-parados' | 'clientes-inativos' | 'ranking-produtos' | 'ranking-clientes' | 'tabelas-preco';
type PeriodPreset = 'hoje' | '7' | '30' | '60' | '90' | 'personalizado';

export default function RelatoriosContent() {
  const [reportType, setReportType] = useState<ReportType>('vendas-periodo');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState<PeriodPreset>('30');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [popoverOpen, setPopoverOpen] = useState(false);

  const getDateRange = useCallback(() => {
    const now = new Date();
    if (period === 'personalizado' && startDate && endDate) {
      return { start: new Date(startDate).toISOString(), end: new Date(endDate + 'T23:59:59').toISOString() };
    }
    const daysMap: Record<string, number> = { 'hoje': 0, '7': 7, '30': 30, '60': 60, '90': 90 };
    const d = daysMap[period] ?? 30;
    const s = d === 0 ? new Date(now.getFullYear(), now.getMonth(), now.getDate()) : new Date(now.getTime() - d * 86400000);
    if (d !== 0) s.setHours(0, 0, 0, 0);
    return { start: s.toISOString(), end: now.toISOString() };
  }, [period, startDate, endDate]);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ type: reportType });
      const { start, end } = getDateRange();
      if (start) params.set('startDate', start);
      if (end) params.set('endDate', end);
      const res = await fetch(`/api/relatorios?${params}`);
      const json = await res.json();
      setData(json);
    } catch { toast.error('Erro ao carregar relatório'); }
    setLoading(false);
  }, [reportType, getDateRange]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  const handlePeriod = (p: PeriodPreset) => {
    if (p === 'personalizado') { setPopoverOpen(true); return; }
    setPeriod(p);
  };

  const applyCustom = () => {
    if (!customStart || !customEnd) return;
    setStartDate(customStart);
    setEndDate(customEnd);
    setPeriod('personalizado');
    setPopoverOpen(false);
  };

  const [ptReportData, setPtReportData] = useState<any>(null);
  const [ptReportLoading, setPtReportLoading] = useState(false);

  const fetchPtReport = useCallback(async () => {
    setPtReportLoading(true);
    try {
      const { start, end } = getDateRange();
      const params = new URLSearchParams();
      if (start) params.set('startDate', start);
      if (end) params.set('endDate', end);
      const res = await fetch(`/api/relatorios/tabelas-preco?${params}`);
      if (res.ok) setPtReportData(await res.json());
    } catch { toast.error('Erro ao carregar relatório de tabelas'); }
    setPtReportLoading(false);
  }, [getDateRange]);

  useEffect(() => {
    if (reportType === 'tabelas-preco') fetchPtReport();
  }, [reportType, fetchPtReport]);

  const reportTabs: { value: ReportType; label: string; icon: any }[] = [
    { value: 'vendas-periodo', label: 'Vendas/Período', icon: ShoppingCart },
    { value: 'vendas-vendedor', label: 'Por Vendedor', icon: Users },
    { value: 'vendas-produto', label: 'Por Produto', icon: Package },
    { value: 'tabelas-preco', label: 'Tabelas Preço', icon: Tag },
    { value: 'estoque-atual', label: 'Estoque', icon: Package },
    { value: 'produtos-parados', label: 'Parados', icon: AlertTriangle },
    { value: 'clientes-inativos', label: 'Inativos', icon: Users },
    { value: 'ranking-produtos', label: 'Top Produtos', icon: Trophy },
    { value: 'ranking-clientes', label: 'Top Clientes', icon: Trophy },
  ];

  const renderReport = () => {
    if (loading) return <div className="py-12 text-center text-muted-foreground">Carregando...</div>;
    if (!data?.data && !data?.summary) return <div className="py-12 text-center text-muted-foreground">Sem dados</div>;

    switch (reportType) {
      case 'vendas-periodo':
        return (
          <div className="space-y-4">
            {data.summary && (
              <div className="grid grid-cols-3 gap-4">
                <Card><CardContent className="pt-4 pb-4 text-center"><p className="text-xs text-muted-foreground">Total Vendas</p><p className="text-lg font-bold num-highlight">{data.summary.total}</p></CardContent></Card>
                <Card><CardContent className="pt-4 pb-4 text-center"><p className="text-xs text-muted-foreground">Faturamento</p><p className="text-lg font-bold num-highlight text-emerald-600">{fmt(data.summary.revenue)}</p></CardContent></Card>
                <Card><CardContent className="pt-4 pb-4 text-center"><p className="text-xs text-muted-foreground">Ticket Médio</p><p className="text-lg font-bold num-highlight">{fmt(data.summary.avgTicket)}</p></CardContent></Card>
              </div>
            )}
            <Table>
              <TableHeader><TableRow><TableHead>#</TableHead><TableHead>Cliente</TableHead><TableHead>Vendedor</TableHead><TableHead>Data</TableHead><TableHead className="text-right">Total</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>{data.data?.map((s: any) => (
                <TableRow key={s.id}><TableCell className="text-sm">#{formatSaleNumber(s.companySaleNumber, s.saleNumber)}</TableCell><TableCell className="text-sm">{s.customer?.name || 'Consumidor'}</TableCell><TableCell className="text-sm">{s.seller?.name || '-'}</TableCell><TableCell className="text-sm">{fmtDate(s.createdAt)}</TableCell><TableCell className="text-right font-mono text-sm">{fmt(s.total)}</TableCell><TableCell><Badge variant="outline" className="text-xs">{s.status}</Badge></TableCell></TableRow>
              ))}</TableBody>
            </Table>
          </div>
        );
      case 'vendas-vendedor':
        return (
          <Table>
            <TableHeader><TableRow><TableHead>Vendedor</TableHead><TableHead className="text-right">Vendas</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
            <TableBody>{data.data?.map((s: any, i: number) => (
              <TableRow key={i}><TableCell className="font-medium">{s.sellerName}</TableCell><TableCell className="text-right text-sm">{s.salesCount}</TableCell><TableCell className="text-right font-mono text-sm text-emerald-600">{fmt(s.totalSold)}</TableCell></TableRow>
            ))}</TableBody>
          </Table>
        );
      case 'vendas-produto':
        return (
          <Table>
            <TableHeader><TableRow><TableHead>Produto</TableHead><TableHead>SKU</TableHead><TableHead className="text-right">Qtd</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
            <TableBody>{data.data?.map((p: any, i: number) => (
              <TableRow key={i}><TableCell className="font-medium">{p.productName}</TableCell><TableCell className="text-sm text-muted-foreground">{p.sku || '-'}</TableCell><TableCell className="text-right text-sm">{p.qtdSold}</TableCell><TableCell className="text-right font-mono text-sm text-emerald-600">{fmt(p.totalSold)}</TableCell></TableRow>
            ))}</TableBody>
          </Table>
        );
      case 'estoque-atual':
        return (
          <div className="space-y-4">
            {data.summary && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Card><CardContent className="pt-4 pb-4 text-center"><p className="text-xs text-muted-foreground">Produtos</p><p className="text-lg font-bold num-highlight">{data.summary.totalProducts}</p></CardContent></Card>
                <Card><CardContent className="pt-4 pb-4 text-center"><p className="text-xs text-muted-foreground">Itens em Estoque</p><p className="text-lg font-bold num-highlight">{data.summary.totalItems}</p></CardContent></Card>
                <Card><CardContent className="pt-4 pb-4 text-center"><p className="text-xs text-muted-foreground">Dinheiro Parado</p><p className="text-lg font-bold num-highlight text-amber-600">{fmt(data.summary.capitalParado)}</p></CardContent></Card>
                <Card><CardContent className="pt-4 pb-4 text-center"><p className="text-xs text-muted-foreground">Estoque Baixo</p><p className="text-lg font-bold num-highlight text-red-600">{data.summary.lowStock}</p></CardContent></Card>
              </div>
            )}
            <Table>
              <TableHeader><TableRow><TableHead>Produto</TableHead><TableHead>SKU</TableHead><TableHead>Categoria</TableHead><TableHead className="text-right">Estoque</TableHead><TableHead className="text-right">Mínimo</TableHead><TableHead className="text-right">Custo Unit.</TableHead></TableRow></TableHeader>
              <TableBody>{data.data?.map((p: any) => (
                <TableRow key={p.id}><TableCell className="font-medium">{p.name}</TableCell><TableCell className="text-sm text-muted-foreground">{p.sku || '-'}</TableCell><TableCell className="text-sm">{p.category?.name || '-'}</TableCell><TableCell className={`text-right font-mono text-sm ${p.stockQuantity <= p.minStock ? 'text-red-600 font-medium' : ''}`}>{p.stockQuantity}</TableCell><TableCell className="text-right text-sm">{p.minStock}</TableCell><TableCell className="text-right font-mono text-sm">{fmt(p.costPrice)}</TableCell></TableRow>
              ))}</TableBody>
            </Table>
          </div>
        );
      case 'produtos-parados':
        return (
          <div className="space-y-4">
            {data.summary && (
              <div className="grid grid-cols-2 gap-4">
                <Card><CardContent className="pt-4 pb-4 text-center"><p className="text-xs text-muted-foreground">Produtos Parados</p><p className="text-lg font-bold num-highlight text-amber-600">{data.summary.total}</p></CardContent></Card>
                <Card><CardContent className="pt-4 pb-4 text-center"><p className="text-xs text-muted-foreground">Dinheiro Parado</p><p className="text-lg font-bold num-highlight text-red-600">{fmt(data.summary.capitalParado)}</p></CardContent></Card>
              </div>
            )}
            <Table>
              <TableHeader><TableRow><TableHead>Produto</TableHead><TableHead>SKU</TableHead><TableHead className="text-right">Estoque</TableHead><TableHead className="text-right">Custo Unit.</TableHead><TableHead className="text-right">Capital</TableHead></TableRow></TableHeader>
              <TableBody>{data.data?.map((p: any) => (
                <TableRow key={p.id}><TableCell className="font-medium">{p.name}</TableCell><TableCell className="text-sm text-muted-foreground">{p.sku || '-'}</TableCell><TableCell className="text-right text-sm">{p.stockQuantity}</TableCell><TableCell className="text-right font-mono text-sm">{fmt(p.costPrice)}</TableCell><TableCell className="text-right font-mono text-sm text-red-600">{fmt(p.costPrice * p.stockQuantity)}</TableCell></TableRow>
              ))}</TableBody>
            </Table>
          </div>
        );
      case 'clientes-inativos':
        return (
          <div className="space-y-4">
            {data.summary && (
              <div className="grid grid-cols-2 gap-4">
                <Card><CardContent className="pt-4 pb-4 text-center"><p className="text-xs text-muted-foreground">Clientes Inativos</p><p className="text-lg font-bold num-highlight text-amber-600">{data.summary.total}</p></CardContent></Card>
                <Card><CardContent className="pt-4 pb-4 text-center"><p className="text-xs text-muted-foreground">Total Comprado</p><p className="text-lg font-bold num-highlight">{fmt(data.summary.totalPurchased)}</p></CardContent></Card>
              </div>
            )}
            <Table>
              <TableHeader><TableRow><TableHead>Cliente</TableHead><TableHead>Tipo</TableHead><TableHead>Telefone</TableHead><TableHead className="text-right">Total Comprado</TableHead><TableHead>Última Compra</TableHead></TableRow></TableHeader>
              <TableBody>{data.data?.map((c: any) => (
                <TableRow key={c.id}><TableCell className="font-medium">{c.name}</TableCell><TableCell><Badge variant="outline" className="text-xs">{c.type}</Badge></TableCell><TableCell className="text-sm">{c.phone || c.whatsapp || '-'}</TableCell><TableCell className="text-right font-mono text-sm">{fmt(c.totalPurchased)}</TableCell><TableCell className="text-sm">{c.lastPurchase ? fmtDate(c.lastPurchase) : 'Nunca'}</TableCell></TableRow>
              ))}</TableBody>
            </Table>
          </div>
        );
      case 'ranking-produtos':
        return (
          <Table>
            <TableHeader><TableRow><TableHead className="w-12">#</TableHead><TableHead>Produto</TableHead><TableHead>SKU</TableHead><TableHead>Categoria</TableHead><TableHead className="text-right">Qtd Vendida</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
            <TableBody>{data.data?.map((p: any) => (
              <TableRow key={p.rank}><TableCell><span className={`text-sm font-bold ${p.rank <= 3 ? 'text-amber-500' : 'text-muted-foreground'}`}>{p.rank}º</span></TableCell><TableCell className="font-medium">{p.productName}</TableCell><TableCell className="text-sm text-muted-foreground">{p.sku || '-'}</TableCell><TableCell className="text-sm">{p.category || '-'}</TableCell><TableCell className="text-right text-sm">{p.qtdSold}</TableCell><TableCell className="text-right font-mono text-sm text-emerald-600">{fmt(p.totalSold)}</TableCell></TableRow>
            ))}</TableBody>
          </Table>
        );
      case 'ranking-clientes':
        return (
          <Table>
            <TableHeader><TableRow><TableHead className="w-12">#</TableHead><TableHead>Cliente</TableHead><TableHead>Tipo</TableHead><TableHead className="text-right">Compras</TableHead><TableHead className="text-right">Ticket Médio</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
            <TableBody>{data.data?.map((c: any, i: number) => (
              <TableRow key={c.id}><TableCell><span className={`text-sm font-bold ${i < 3 ? 'text-amber-500' : 'text-muted-foreground'}`}>{i + 1}º</span></TableCell><TableCell className="font-medium">{c.name}</TableCell><TableCell><Badge variant="outline" className="text-xs">{c.type}</Badge></TableCell><TableCell className="text-right text-sm">{c.purchaseCount}</TableCell><TableCell className="text-right font-mono text-sm">{fmt(c.avgTicket)}</TableCell><TableCell className="text-right font-mono text-sm text-emerald-600">{fmt(c.totalPurchased)}</TableCell></TableRow>
            ))}</TableBody>
          </Table>
        );
      case 'tabelas-preco':
        if (ptReportLoading) return <div className="py-12 text-center text-muted-foreground">Carregando...</div>;
        if (!ptReportData) return <div className="py-12 text-center text-muted-foreground">Sem dados</div>;
        const ptSummary = ptReportData.summary;
        return (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card><CardContent className="pt-4 pb-4 text-center"><p className="text-[10px] text-muted-foreground uppercase">Itens com Tabela</p><p className="text-lg font-bold">{ptSummary?.totalItemsWithTable ?? 0}</p></CardContent></Card>
              <Card><CardContent className="pt-4 pb-4 text-center"><p className="text-[10px] text-muted-foreground uppercase">Faturamento</p><p className="text-lg font-bold text-emerald-600">{fmt(ptSummary?.totalRevenueWithTable ?? 0)}</p></CardContent></Card>
              <Card><CardContent className="pt-4 pb-4 text-center"><p className="text-[10px] text-muted-foreground uppercase">Desconto Total</p><p className="text-lg font-bold text-red-600">{fmt(ptSummary?.totalDiscountGiven ?? 0)}</p></CardContent></Card>
              <Card><CardContent className="pt-4 pb-4 text-center"><p className="text-[10px] text-muted-foreground uppercase">% Uso Tabelas</p><p className="text-lg font-bold text-blue-600">{(ptSummary?.usagePercent ?? 0).toFixed(1)}%</p></CardContent></Card>
            </div>

            {/* By Table */}
            {(ptReportData.byTable?.length ?? 0) > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-2"><Tag className="w-4 h-4 text-amber-600" /> Vendas por Tabela de Preço</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tabela</TableHead>
                      <TableHead className="text-center">Usos</TableHead>
                      <TableHead className="text-center">Peças</TableHead>
                      <TableHead className="text-right">Faturamento</TableHead>
                      <TableHead className="text-right">Desconto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(ptReportData.byTable ?? []).map((t: any, idx: number) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium text-sm">{t.tableName}</TableCell>
                        <TableCell className="text-center text-sm font-mono">{t.count}</TableCell>
                        <TableCell className="text-center text-sm font-mono">{t.totalQuantity}</TableCell>
                        <TableCell className="text-right text-sm font-mono text-emerald-600">{fmt(t.totalRevenue)}</TableCell>
                        <TableCell className="text-right text-sm font-mono text-red-600">{fmt(t.totalDiscount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Top Products */}
            {(ptReportData.topProducts?.length ?? 0) > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-2"><Package className="w-4 h-4 text-blue-600" /> Top Produtos com Tabela</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead className="text-center">Peças</TableHead>
                      <TableHead className="text-right">Faturamento</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(ptReportData.topProducts ?? []).map((p: any, idx: number) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium text-sm">{p.name}</TableCell>
                        <TableCell className="text-center text-sm font-mono">{p.count}</TableCell>
                        <TableCell className="text-right text-sm font-mono text-emerald-600">{fmt(p.revenue)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {(ptReportData.byTable?.length ?? 0) === 0 && (
              <div className="py-8 text-center text-muted-foreground">
                <Tag className="w-10 h-10 mx-auto mb-2 opacity-20" />
                <p className="text-sm">Nenhuma venda com tabela de preço neste período</p>
              </div>
            )}
          </div>
        );
      default: return null;
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      <AppHeader title="Relatórios" />
      <div className="flex-1 p-4 lg:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="flex items-center gap-2"><ClipboardList className="w-5 h-5 text-blue-600" /><span className="text-sm text-muted-foreground">Relatórios da operação</span></div>
          <div className="flex flex-wrap gap-1.5 items-center">
            {([['hoje', 'Hoje'], ['7', '7 dias'], ['30', '30 dias'], ['60', '60 dias'], ['90', '90 dias']] as [PeriodPreset, string][]).map(([v, label]) => (
              <Button key={v} variant={period === v ? 'default' : 'outline'} size="sm" className="h-7 text-xs px-2.5" onClick={() => handlePeriod(v)}>{label}</Button>
            ))}
            <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant={period === 'personalizado' ? 'default' : 'outline'} size="sm" className="h-7 text-xs px-2.5 gap-1">
                  <CalendarDays className="w-3 h-3" />{period === 'personalizado' ? 'Personalizado' : 'Período'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-3" align="end">
                <div className="space-y-3">
                  <p className="text-sm font-medium">Período personalizado</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div><Label className="text-xs">De</Label><Input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="h-8 text-xs" /></div>
                    <div><Label className="text-xs">Até</Label><Input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="h-8 text-xs" /></div>
                  </div>
                  <Button size="sm" className="w-full h-8" onClick={applyCustom} disabled={!customStart || !customEnd}>Aplicar</Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <Tabs value={reportType} onValueChange={(v) => setReportType(v as ReportType)}>
          <TabsList className="flex flex-wrap h-auto gap-1">
            {reportTabs.map(t => (
              <TabsTrigger key={t.value} value={t.value} className="text-xs gap-1">
                <t.icon className="w-3.5 h-3.5" /> {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
          <div className="mt-4">
            <Card><CardContent className="p-4">{renderReport()}</CardContent></Card>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
