'use client';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area
} from 'recharts';

const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function formatCurrency(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

export function GrowthChart({ data }: { data: { month: string; count: number }[] }) {
  const chartData = data.map(g => {
    const parts = (g.month || '').split('-');
    return { label: MONTH_NAMES[parseInt(parts[1]) - 1] || g.month, count: g.count };
  });

  if (chartData.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-12">Sem dados ainda</p>;
  }

  return (
    <div className="h-[250px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
          <Tooltip
            contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))', fontSize: 12 }}
            formatter={(v: any) => [v, 'Empresas']}
          />
          <Bar dataKey="count" fill="#3B82F6" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function RevenueChart({ data }: { data: { month: string; total: number }[] }) {
  const chartData = data.map(r => {
    const parts = (r.month || '').split('-');
    return { label: MONTH_NAMES[parseInt(parts[1]) - 1] || r.month, total: r.total };
  });

  if (chartData.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-12">Sem dados ainda</p>;
  }

  return (
    <div className="h-[250px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id="revGradMaster" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
          <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
          <Tooltip
            contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))', fontSize: 12 }}
            formatter={(v: any) => [formatCurrency(Number(v)), 'Faturamento']}
          />
          <Area type="monotone" dataKey="total" stroke="#10B981" fill="url(#revGradMaster)" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
