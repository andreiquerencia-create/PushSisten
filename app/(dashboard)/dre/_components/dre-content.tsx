'use client';

import { useState, useEffect, useCallback } from 'react';
import { AppHeader } from '@/components/app-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { FileBarChart, TrendingUp, TrendingDown, ArrowRight, CalendarDays } from 'lucide-react';
import { toast } from 'sonner';

const fmt = (v: number | null | undefined) => (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

type PeriodPreset = 'hoje' | '7' | '30' | '60' | '90' | 'personalizado';

export default function DreContent() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<PeriodPreset>('30');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [popoverOpen, setPopoverOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const now = new Date();
      let start = '';
      let end = now.toISOString();

      if (period === 'personalizado' && startDate && endDate) {
        start = new Date(startDate).toISOString();
        end = new Date(endDate + 'T23:59:59').toISOString();
      } else {
        const daysMap: Record<string, number> = { 'hoje': 0, '7': 7, '30': 30, '60': 60, '90': 90 };
        const d = daysMap[period] ?? 30;
        if (d === 0) {
          start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
        } else {
          const s = new Date(now.getTime() - d * 86400000);
          s.setHours(0, 0, 0, 0);
          start = s.toISOString();
        }
      }

      const params = new URLSearchParams();
      if (start) params.set('startDate', start);
      if (end) params.set('endDate', end);

      const res = await fetch(`/api/dre?${params}`);
      const json = await res.json();
      setData(json);
    } catch { toast.error('Erro ao carregar DRE'); }
    setLoading(false);
  }, [period, startDate, endDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

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

  const DRELine = ({ label, value, bold, indent, positive, negative }: { label: string; value?: number; bold?: boolean; indent?: boolean; positive?: boolean; negative?: boolean }) => (
    <div className={`flex items-center justify-between py-2.5 px-4 ${bold ? 'bg-muted/50 font-semibold' : ''} ${indent ? 'pl-8' : ''}`}>
      <span className={`text-sm ${bold ? 'font-semibold' : 'text-muted-foreground'}`}>{label}</span>
      <span className={`font-mono text-sm font-medium ${
        positive && (value ?? 0) > 0 ? 'text-emerald-600' :
        negative && (value ?? 0) < 0 ? 'text-red-600' :
        (value ?? 0) < 0 ? 'text-red-600' : ''
      }`}>
        {value !== undefined ? fmt(value) : '-'}
      </span>
    </div>
  );

  return (
    <div className="flex flex-col min-h-screen">
      <AppHeader title="Resultado do Período" />
      <div className="flex-1 p-4 lg:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="flex items-center gap-2">
            <FileBarChart className="w-5 h-5 text-blue-600" />
            <span className="text-sm text-muted-foreground">Demonstrativo de Resultado do Exercício</span>
          </div>
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

        {/* Summary badges */}
        {data && (
          <div className="flex flex-wrap gap-3">
            <Badge variant="outline" className="gap-1 py-1 px-3">
              <TrendingUp className="w-3 h-3" /> Margem Bruta: {data.margemBrutaPct}%
            </Badge>
            <Badge variant="outline" className="gap-1 py-1 px-3">
              {data.lucroLiquido >= 0 ? <TrendingUp className="w-3 h-3 text-emerald-600" /> : <TrendingDown className="w-3 h-3 text-red-600" />}
              Margem Líquida: {data.margemLiquidaPct}%
            </Badge>
            <Badge variant="outline" className="gap-1 py-1 px-3">{data.totalVendas} vendas no período</Badge>
          </div>
        )}

        <Card>
          <CardHeader className="pb-0"><CardTitle className="text-base">Demonstrativo de Resultado</CardTitle></CardHeader>
          <CardContent className="p-0 mt-4">
            {loading ? (
              <div className="py-12 text-center text-muted-foreground">Carregando...</div>
            ) : data ? (
              <div className="divide-y divide-border">
                <DRELine label="(+) Faturamento Bruto" value={data.faturamentoBruto} bold />
                <DRELine label="(-) Descontos Concedidos" value={-data.descontos} indent />
                <DRELine label="(=) Receita Líquida" value={data.receitaLiquida} bold positive />
                {data.devolucoes > 0 && (
                  <DRELine label="    Vendas Canceladas (já excluídas do faturamento)" value={data.devolucoes} indent />
                )}
                <div className="h-px bg-border/50" />
                <DRELine label="(-) CMV (Custo da Mercadoria Vendida)" value={-data.cmv} indent />
                <DRELine label="(=) Lucro Bruto" value={data.margemBruta} bold positive />
                <div className="h-px bg-border/50" />
                {(data.despesasAdministrativas > 0 || data.despesasComerciais > 0) && (
                  <>
                    <DRELine label="(-) Despesas Administrativas" value={-(data.despesasAdministrativas ?? 0)} indent />
                    <DRELine label="(-) Despesas Comerciais" value={-(data.despesasComerciais ?? 0)} indent />
                  </>
                )}
                <DRELine label="(-) Total Despesas Operacionais" value={-data.despesasOperacionais} indent />
                <DRELine label="(=) Lucro Operacional (EBIT)" value={data.lucroOperacional} bold positive />
                <div className="h-px bg-border/50" />
                {(data.despesasFinanceiras > 0) && (
                  <>
                    <DRELine label="(-) Despesas Financeiras" value={-(data.despesasFinanceiras ?? 0)} indent />
                    {(data.taxasCartao > 0) && (
                      <DRELine label="      Taxas de Cartão" value={-(data.taxasCartao ?? 0)} indent />
                    )}
                  </>
                )}
                {(data.impostos > 0) && (
                  <DRELine label="(-) Impostos" value={-(data.impostos ?? 0)} indent />
                )}
                <DRELine label="(=) Lucro Líquido" value={data.lucroLiquido} bold positive />
              </div>
            ) : (
              <div className="py-12 text-center text-muted-foreground">Sem dados</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}