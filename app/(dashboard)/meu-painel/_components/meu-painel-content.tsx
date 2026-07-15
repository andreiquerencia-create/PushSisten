'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { AppHeader } from '@/components/app-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Target, DollarSign, ShoppingCart, Trophy, Users,
  TrendingUp, Phone, RefreshCw, Calendar, Award,
  ArrowUp, ArrowDown, Minus as MinusIcon, MessageCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatSaleNumber } from '@/lib/sale-number';

const fmt = (v: number | null | undefined) => (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (d: string) => {
  try { return new Date(d).toLocaleDateString('pt-BR'); } catch { return '-'; }
};
const fmtTime = (d: string) => {
  try { return new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); } catch { return ''; }
};

const formatWhatsAppNumber = (num: string | null | undefined): string | null => {
  if (!num) return null;
  const digits = num.replace(/\D/g, '');
  if (digits.length < 10) return null;
  if (digits.startsWith('55')) return digits;
  return `55${digits}`;
};

export default function MeuPainelContent() {
  const { data: session } = useSession() || {};
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('resumo');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/meu-painel');
      if (res.ok) setData(await res.json());
      else toast.error('Erro ao carregar painel');
    } catch { toast.error('Erro de conexão'); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen">
        <AppHeader title="Meu Painel" />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      </div>
    );
  }

  if (!data) return null;

  const rankColor = data.ranking === 1 ? 'text-yellow-500' : data.ranking === 2 ? 'text-gray-400' : data.ranking === 3 ? 'text-amber-700' : 'text-blue-600';

  return (
    <div className="flex flex-col min-h-screen">
      <AppHeader title="Meu Painel" />
      <div className="flex-1 p-4 lg:p-6 space-y-5">
        {/* Greeting */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Target className="w-5 h-5 text-blue-600" />
              Olá, {data.sellerName}!
            </h2>
            <p className="text-sm text-muted-foreground">Comissão: {data.commissionRate}%</p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchData} className="gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" /> Atualizar
          </Button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card className="border-0 shadow-sm">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <ShoppingCart className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Vendas Hoje</p>
                  <p className="text-xl font-bold">{data.vendaHoje}</p>
                  <p className="text-xs font-mono text-blue-600">{fmt(data.totalHoje)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Vendas Mês</p>
                  <p className="text-xl font-bold">{data.vendasMes}</p>
                  <p className="text-xs font-mono text-emerald-600">{fmt(data.totalMes)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Comissão Mês</p>
                  <p className="text-xl font-bold font-mono">{fmt(data.comissaoMes)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                  <Trophy className={`w-5 h-5 ${rankColor}`} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Ranking</p>
                  <p className="text-xl font-bold">{data.ranking > 0 ? `${data.ranking}º` : '-'}</p>
                  <p className="text-xs text-muted-foreground">de {data.totalVendedores}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Totals bar */}
        <Card className="border-0 shadow-sm bg-gradient-to-r from-slate-900 to-slate-800 text-white">
          <CardContent className="py-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
              <div><p className="text-xs text-slate-400">Total Geral Vendido</p><p className="text-lg font-bold font-mono">{fmt(data.totalGeral)}</p></div>
              <div><p className="text-xs text-slate-400">Comissão Total</p><p className="text-lg font-bold font-mono text-amber-400">{fmt(data.comissaoGeral)}</p></div>
              <div><p className="text-xs text-slate-400">Clientes na Carteira</p><p className="text-lg font-bold">{data.meusClientes?.length ?? 0}</p></div>
              <div><p className="text-xs text-slate-400">Clientes Atendidos</p><p className="text-lg font-bold">{data.clientesRecentes?.length ?? 0}</p></div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="resumo" className="text-xs sm:text-sm">Vendas do Dia</TabsTrigger>
            <TabsTrigger value="clientes" className="text-xs sm:text-sm">Meus Clientes</TabsTrigger>
            <TabsTrigger value="evolucao" className="text-xs sm:text-sm">Evolução</TabsTrigger>
          </TabsList>

          {/* Today's Sales */}
          <TabsContent value="resumo" className="mt-4 space-y-3">
            {(data.vendasHojeDetail?.length ?? 0) === 0 ? (
              <Card className="border-0 shadow-sm">
                <CardContent className="py-12 text-center text-muted-foreground">
                  <ShoppingCart className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p>Nenhuma venda registrada hoje</p>
                  <p className="text-xs mt-1">Acesse o PDV para começar a vender!</p>
                </CardContent>
              </Card>
            ) : (
              data.vendasHojeDetail.map((sale: any) => (
                <Card key={sale.id} className="border-0 shadow-sm">
                  <CardContent className="py-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs font-mono">#{formatSaleNumber(sale.companySaleNumber, sale.saleNumber)}</Badge>
                        <span className="text-sm font-medium">{sale.customer}</span>
                      </div>
                      <div className="text-right">
                        <p className="font-mono font-bold text-emerald-600">{fmt(sale.total)}</p>
                        <p className="text-[11px] text-muted-foreground">{fmtTime(sale.createdAt)}</p>
                      </div>
                    </div>
                    <div className="space-y-0.5">
                      {sale.items.map((item: any, idx: number) => (
                        <div key={idx} className="flex justify-between text-xs text-muted-foreground">
                          <span>{item.name}{item.variation ? ` — ${item.variation}` : ''} ×{item.quantity}</span>
                          <span className="font-mono">{fmt(item.total)}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* My Clients */}
          <TabsContent value="clientes" className="mt-4">
            <div className="grid gap-3">
              {(data.meusClientes?.length ?? 0) > 0 && (
                <Card className="border-0 shadow-sm">
                  <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-2"><Users className="w-4 h-4" /> Minha Carteira</CardTitle></CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Cliente</TableHead>
                          <TableHead className="hidden sm:table-cell">Contato</TableHead>
                          <TableHead className="text-right">Total Compras</TableHead>
                          <TableHead className="w-12"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.meusClientes.map((c: any) => {
                          const waNum = formatWhatsAppNumber(c.whatsapp || c.phone);
                          return (
                            <TableRow key={c.id}>
                              <TableCell>
                                <p className="font-medium text-sm">{c.name}</p>
                                <p className="text-xs text-muted-foreground">{c.lastPurchase ? `Últ. compra: ${fmtDate(c.lastPurchase)}` : 'Sem compras'}</p>
                              </TableCell>
                              <TableCell className="hidden sm:table-cell text-sm">{c.phone || '-'}</TableCell>
                              <TableCell className="text-right font-mono text-sm">{fmt(c.totalPurchased)}</TableCell>
                              <TableCell>
                                {waNum && (
                                  <a href={`https://wa.me/${waNum}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-100 hover:bg-emerald-200 transition-colors">
                                    <MessageCircle className="w-4 h-4 text-emerald-600" />
                                  </a>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}

              {(data.clientesRecentes?.length ?? 0) > 0 && (
                <Card className="border-0 shadow-sm">
                  <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-2"><Calendar className="w-4 h-4" /> Clientes Recentes</CardTitle></CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Cliente</TableHead>
                          <TableHead className="hidden sm:table-cell">Contato</TableHead>
                          <TableHead className="text-right">Total Compras</TableHead>
                          <TableHead className="w-12"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.clientesRecentes.map((c: any) => {
                          const waNum = formatWhatsAppNumber(c.whatsapp || c.phone);
                          return (
                            <TableRow key={c.id}>
                              <TableCell><p className="font-medium text-sm">{c.name}</p></TableCell>
                              <TableCell className="hidden sm:table-cell text-sm">{c.phone || '-'}</TableCell>
                              <TableCell className="text-right font-mono text-sm">{fmt(c.totalPurchased)}</TableCell>
                              <TableCell>
                                {waNum && (
                                  <a href={`https://wa.me/${waNum}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-100 hover:bg-emerald-200 transition-colors">
                                    <MessageCircle className="w-4 h-4 text-emerald-600" />
                                  </a>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}

              {(data.meusClientes?.length ?? 0) === 0 && (data.clientesRecentes?.length ?? 0) === 0 && (
                <Card className="border-0 shadow-sm">
                  <CardContent className="py-12 text-center text-muted-foreground">
                    <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p>Nenhum cliente vinculado</p>
                    <p className="text-xs mt-1">Seus clientes aparecerão aqui conforme fizer vendas</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* Evolution */}
          <TabsContent value="evolucao" className="mt-4 space-y-4">
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2"><TrendingUp className="w-4 h-4" /> Vendas Últimos 7 Dias</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {(data.dailyTrend ?? []).map((day: any, idx: number) => {
                    const maxVal = Math.max(...(data.dailyTrend ?? []).map((d: any) => d.total), 1);
                    const pct = (day.total / maxVal) * 100;
                    const isToday = idx === (data.dailyTrend?.length ?? 0) - 1;
                    return (
                      <div key={day.date} className="flex items-center gap-3">
                        <span className={`text-xs w-20 font-mono ${isToday ? 'font-bold text-blue-600' : 'text-muted-foreground'}`}>
                          {isToday ? 'Hoje' : new Date(day.date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit' })}
                        </span>
                        <div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-full h-5 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${isToday ? 'bg-blue-500' : 'bg-emerald-500'}`}
                            style={{ width: `${Math.max(pct, 2)}%` }}
                          />
                        </div>
                        <span className={`text-xs font-mono w-24 text-right ${isToday ? 'font-bold' : ''}`}>{fmt(day.total)}</span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Achievement card */}
            <Card className="border-0 shadow-sm bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30">
              <CardContent className="py-5">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
                    <Award className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <p className="font-bold text-lg">Resumo Geral</p>
                    <p className="text-sm text-muted-foreground">
                      {data.ranking === 1 ? '🏆 Você é o(a) líder de vendas!' :
                       data.ranking <= 3 ? '💪 No top 3! Continue assim!' :
                       data.ranking > 0 ? `Posição ${data.ranking}º de ${data.totalVendedores}` :
                       'Continue vendendo para subir no ranking!'}
                    </p>
                    <div className="flex gap-4 mt-2">
                      <div><span className="text-xs text-muted-foreground">Total vendido</span><p className="font-mono font-bold text-emerald-600">{fmt(data.totalGeral)}</p></div>
                      <div><span className="text-xs text-muted-foreground">Comissão acumulada</span><p className="font-mono font-bold text-amber-600">{fmt(data.comissaoGeral)}</p></div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
