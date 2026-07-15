'use client';

import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine,
} from 'recharts';

const tooltipStyle = {
  fontSize: 12,
  borderRadius: 10,
  border: 'none',
  boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
  background: 'hsl(var(--card))',
  color: 'hsl(var(--card-foreground))',
};

/**
 * Histórico do Push Score (últimos 30 dias) — área simples.
 * Apenas LEITURA dos snapshots persistidos. Sem cálculos.
 */
export function PushScoreHistoryChart({ data }: { data: { date: string; score: number }[] }) {
  const formatted = (data ?? []).map(d => ({
    score: d.score,
    label: new Date(d.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
  }));

  if (formatted.length < 2) {
    return (
      <div className="h-56 flex items-center justify-center text-sm text-muted-foreground">
        Ainda não há histórico suficiente para exibir a evolução.
      </div>
    );
  }

  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={formatted} margin={{ top: 8, right: 8, left: -16, bottom: 4 }}>
          <defs>
            <linearGradient id="gradPushScore" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.30} />
              <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
          <XAxis dataKey="label" tickLine={false} tick={{ fontSize: 10 }} axisLine={false} interval="preserveStartEnd" minTickGap={24} />
          <YAxis domain={[0, 100]} tickLine={false} tick={{ fontSize: 10 }} axisLine={false} width={32} />
          <ReferenceLine y={85} stroke="#10b981" strokeDasharray="4 4" opacity={0.5} />
          <ReferenceLine y={55} stroke="#f59e0b" strokeDasharray="4 4" opacity={0.5} />
          <ReferenceLine y={40} stroke="#ef4444" strokeDasharray="4 4" opacity={0.5} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v} pts`, 'Push Score']} labelFormatter={(l) => `Dia ${l}`} />
          <Area type="monotone" dataKey="score" stroke="#6366f1" strokeWidth={2.5} fill="url(#gradPushScore)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
