'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { AppHeader } from '@/components/app-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DollarSign, TrendingUp, Package, Users, UserCheck, BarChart3, ShoppingCart, AlertTriangle, ArrowUp, ArrowDown } from 'lucide-react';
import { toast } from 'sonner';

const CategoryChart = dynamic(() => import('./category-chart'), { ssr: false });

const fmt = (v: number | null | undefined) => (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function EstatisticasContent() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/estatisticas')
      .then(r => r.json())
      .then(setData)
      .catch(() => toast.error('Erro ao carregar estatísticas'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex flex-col min-h-screen"><AppHeader title="Estatísticas da Operação" /><div className="flex-1 flex items-center justify-center text-muted-foreground">Carregando...</div></div>;
  if (!data) return <div className="flex flex-col min-h-screen"><AppHeader title="Estatísticas da Operação" /><div className="flex-1 flex items-center justify-center text-muted-foreground">Sem dados</div></div>;

  const { financeiro, estoque, crm, comercial, vendedores } = data;

  const KPI = ({ icon: Icon, iconColor, label, value, subtitle }: { icon: any; iconColor: string; label: string; value: string; subtitle?: string }) => (
    <Card>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconColor}`}>
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-lg font-bold num-highlight">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="flex flex-col min-h-screen">
      <AppHeader title="Estatísticas da Operação" />
      <div className="flex-1 p-4 lg:p-6 space-y-6">
        {/* FINANCEIRO */}
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2"><DollarSign className="w-4 h-4" /> Financeiro</h3>
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            <KPI icon={DollarSign} iconColor="bg-blue-100 text-blue-600 dark:bg-blue-900/30" label="Faturamento Mês" value={fmt(financeiro.faturamentoMes)} />
            <KPI icon={TrendingUp} iconColor="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30" label="Lucro Estimado" value={fmt(financeiro.lucroEstimado)} />
            <KPI icon={BarChart3} iconColor="bg-purple-100 text-purple-600 dark:bg-purple-900/30" label="Margem Média" value={`${financeiro.margemMedia}%`} />
            <KPI icon={DollarSign} iconColor="bg-cyan-100 text-cyan-600 dark:bg-cyan-900/30" label="Saldo Caixa" value={fmt(financeiro.saldoCaixa)} />
            <KPI icon={DollarSign} iconColor="bg-amber-100 text-amber-600 dark:bg-amber-900/30" label="Recebimentos" value={fmt(financeiro.contasReceber)} />
            <KPI icon={financeiro.crescimento >= 0 ? ArrowUp : ArrowDown} iconColor={financeiro.crescimento >= 0 ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30' : 'bg-red-100 text-red-600 dark:bg-red-900/30'} label="Crescimento" value={`${financeiro.crescimento > 0 ? '+' : ''}${financeiro.crescimento}%`} />
          </div>
        </div>

        {/* ESTOQUE */}
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2"><Package className="w-4 h-4" /> Estoque</h3>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <KPI icon={Package} iconColor="bg-blue-100 text-blue-600 dark:bg-blue-900/30" label="Total Produtos" value={String(estoque.totalProdutos)} subtitle={`${estoque.totalItems} itens`} />
            <KPI icon={AlertTriangle} iconColor="bg-red-100 text-red-600 dark:bg-red-900/30" label="Estoque Baixo" value={String(estoque.estoqueBaixo)} />
            <KPI icon={AlertTriangle} iconColor="bg-amber-100 text-amber-600 dark:bg-amber-900/30" label="Produtos Parados" value={String(estoque.produtosParados)} />
            <KPI icon={DollarSign} iconColor="bg-orange-100 text-orange-600 dark:bg-orange-900/30" label="Dinheiro Parado no Estoque" value={fmt(estoque.capitalParado)} subtitle={`${estoque.produtosParados} produtos sem giro`} />
            <Card>
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-muted-foreground mb-2">Campeões de Venda</p>
                <div className="space-y-1">
                  {estoque.topProdutos?.slice(0, 3).map((p: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className="truncate mr-2">{i + 1}. {p.name}</span>
                      <span className="font-mono text-emerald-600">{p.qty}un</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* CRM */}
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2"><Users className="w-4 h-4" /> CRM</h3>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <KPI icon={Users} iconColor="bg-blue-100 text-blue-600 dark:bg-blue-900/30" label="Total Clientes" value={String(crm.totalClientes)} />
            <KPI icon={Users} iconColor="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30" label="Ativos" value={String(crm.clientesAtivos)} />
            <KPI icon={Users} iconColor="bg-red-100 text-red-600 dark:bg-red-900/30" label="Inativos" value={String(crm.clientesInativos)} />
            <KPI icon={TrendingUp} iconColor="bg-purple-100 text-purple-600 dark:bg-purple-900/30" label="Retenção" value={`${crm.retencao}%`} />
            <KPI icon={ShoppingCart} iconColor="bg-cyan-100 text-cyan-600 dark:bg-cyan-900/30" label="Freq. Média" value={`${crm.frequenciaMedia} compras`} />
          </div>
        </div>

        {/* COMERCIAL */}
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2"><ShoppingCart className="w-4 h-4" /> Comercial</h3>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="grid grid-cols-1 gap-3">
              <KPI icon={ShoppingCart} iconColor="bg-blue-100 text-blue-600 dark:bg-blue-900/30" label="Ticket Médio" value={fmt(comercial.ticketMedio)} />
              <KPI icon={ShoppingCart} iconColor="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30" label="Vendas no Mês" value={String(comercial.totalVendasMes)} />
              <KPI icon={comercial.crescimento >= 0 ? ArrowUp : ArrowDown} iconColor={comercial.crescimento >= 0 ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30' : 'bg-red-100 text-red-600 dark:bg-red-900/30'} label="Crescimento" value={`${comercial.crescimento > 0 ? '+' : ''}${comercial.crescimento}%`} />
            </div>
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Vendas por Categoria</CardTitle></CardHeader>
              <CardContent>
                {comercial.vendasPorCategoria?.length > 0 ? <CategoryChart data={comercial.vendasPorCategoria} /> : <p className="text-sm text-muted-foreground">Sem dados</p>}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* VENDEDORES */}
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2"><UserCheck className="w-4 h-4" /> Vendedores</h3>
          <Card>
            <CardContent className="p-4">
              {vendedores?.length > 0 ? (
                <div className="space-y-2">
                  {vendedores.map((v: any) => (
                    <div key={v.rank} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                      <span className={`text-sm font-bold w-6 text-center ${v.rank <= 3 ? 'text-amber-500' : 'text-muted-foreground'}`}>{v.rank}º</span>
                      <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{v.name}</p><p className="text-xs text-muted-foreground">{v.salesCount} vendas</p></div>
                      <span className="font-mono text-sm font-medium text-emerald-600">{fmt(v.totalSold)}</span>
                    </div>
                  ))}
                </div>
              ) : <p className="text-sm text-muted-foreground">Sem dados de vendedores</p>}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
