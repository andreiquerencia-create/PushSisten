'use client';

import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, ReferenceLine, Line, ComposedChart } from 'recharts';

interface Props {
  data: { date: string; saldo: number; saldoComVendas?: number }[];
}

export default function CashFlowChart({ data }: Props) {
  if (!data || data.length === 0) return <p className="text-sm text-muted-foreground">Sem dados</p>;

  const hasDualLines = data.some(d => d.saldoComVendas !== undefined);
  const hasNegative = data.some(d => d.saldo < 0 || (d.saldoComVendas ?? 0) < 0);
  const formattedData = data.map(d => ({
    ...d,
    dateLabel: new Date(d.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
  }));

  const fmtVal = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={formattedData}>
          <defs>
            <linearGradient id="colorSaldo" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="dateLabel" tick={{ fontSize: 11 }} interval={Math.max(1, Math.floor(data.length / 8))} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
          <Tooltip
            contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: 12 }}
            formatter={(value: number, name: string) => [fmtVal(value), name === 'saldo' ? 'Saldo Base' : 'Com Vendas']}
            labelFormatter={(label) => `Data: ${label}`}
          />
          {hasNegative && <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="3 3" />}
          <Area type="monotone" dataKey="saldo" stroke="#3b82f6" fill="url(#colorSaldo)" strokeWidth={2} name="saldo" />
          {hasDualLines && <Line type="monotone" dataKey="saldoComVendas" stroke="#10b981" strokeWidth={2} strokeDasharray="5 5" dot={false} name="saldoComVendas" />}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
