'use client';

import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  Tooltip, Cell, PieChart, Pie, ComposedChart, Line, CartesianGrid, Legend,
} from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899', '#14b8a6', '#a855f7'];

const fmtBRL = (v: number) => `R$ ${(v ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const fmtBRLk = (v: number) => `R$${((v ?? 0) / 1000).toFixed(0)}k`;

const tooltipStyle = {
  fontSize: 12,
  borderRadius: 10,
  border: 'none',
  boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
  background: 'hsl(var(--card))',
  color: 'hsl(var(--card-foreground))',
};

/* ===== Daily Sales AreaChart ===== */
export function DailySalesChart({ data }: { data: { date: string; total: number; count: number }[] }) {
  const formatted = (data ?? []).map(d => ({ ...d, date: (d.date ?? '').slice(5) }));
  if (formatted.length === 0) return <Empty text="Sem vendas no período" />;
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={formatted} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
          <defs>
            <linearGradient id="gradDaily" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
          <XAxis dataKey="date" tickLine={false} tick={{ fontSize: 11 }} axisLine={false} />
          <YAxis tickLine={false} tick={{ fontSize: 10 }} axisLine={false} tickFormatter={fmtBRLk} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [fmtBRL(v), 'Vendas']} />
          <Area type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={2.5} fill="url(#gradDaily)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ===== Category Horizontal Bar ===== */
export function CategoryChart({ data }: { data: { name: string; total: number }[] }) {
  if (!data?.length) return <Empty text="Sem dados de categorias" />;
  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data.slice(0, 8)} layout="vertical" margin={{ left: 10, right: 10 }}>
          <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={fmtBRLk} />
          <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={90} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [fmtBRL(v), 'Total']} />
          <Bar dataKey="total" radius={[0, 6, 6, 0]} barSize={18}>
            {data.slice(0, 8).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ===== Seller Ranking Bar ===== */
export function SellerChart({ data }: { data: { name: string; total: number; count: number }[] }) {
  if (!data?.length) return <Empty text="Sem dados de vendedores" />;
  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data.slice(0, 8)} layout="vertical" margin={{ left: 10, right: 10 }}>
          <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={fmtBRLk} />
          <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={90} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v: number, name: string) => [fmtBRL(v), name === 'total' ? 'Faturamento' : 'Vendas']} />
          <Bar dataKey="total" radius={[0, 6, 6, 0]} fill="#8b5cf6" barSize={18} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ===== Peak Hours Bar ===== */
export function PeakHoursChart({ data }: { data: { hour: number; count: number; total: number }[] }) {
  if (!data?.length) return <Empty text="Sem dados de horários" />;
  const formatted = data.map(d => ({ ...d, label: `${String(d.hour).padStart(2, '0')}h` }));
  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={formatted} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
          <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v: number, name: string) => [name === 'count' ? `${v} vendas` : fmtBRL(v), name === 'count' ? 'Qtd' : 'Valor']} />
          <Bar dataKey="count" fill="#06b6d4" radius={[4, 4, 0, 0]} barSize={20} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ===== Payment Methods Pie ===== */
export function PaymentMethodChart({ data }: { data: { name: string; total: number; count: number }[] }) {
  if (!data?.length) return <Empty text="Sem dados de pagamentos" />;
  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="total" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={40} paddingAngle={3} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} style={{ fontSize: 10 }}>
            {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [fmtBRL(v), 'Total']} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ===== Cash Flow AreaChart ===== */
export function CashFlowChart({ data }: { data: { date: string; entries: number; exits: number }[] }) {
  const formatted = (data ?? []).map(d => ({ ...d, date: (d.date ?? '').slice(5) }));
  if (formatted.length === 0) return <Empty text="Sem movimentações" />;
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={formatted} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
          <defs>
            <linearGradient id="gradEntry" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gradExit" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
          <XAxis dataKey="date" tickLine={false} tick={{ fontSize: 11 }} axisLine={false} />
          <YAxis tickLine={false} tick={{ fontSize: 10 }} axisLine={false} tickFormatter={fmtBRLk} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v: number, name: string) => [fmtBRL(v), name === 'entries' ? 'Entradas' : 'Saídas']} />
          <Legend formatter={(v: string) => v === 'entries' ? 'Entradas' : 'Saídas'} />
          <Area type="monotone" dataKey="entries" stroke="#10b981" strokeWidth={2} fill="url(#gradEntry)" />
          <Line type="monotone" dataKey="exits" stroke="#ef4444" strokeWidth={2} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ===== Stock Value Horizontal Bar ===== */
export function StockValueChart({ data }: { data: { name: string; value: number; quantity: number }[] }) {
  if (!data?.length) return <Empty text="Sem dados de estoque" />;
  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data.slice(0, 8)} layout="vertical" margin={{ left: 10, right: 10 }}>
          <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={fmtBRLk} />
          <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={90} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [fmtBRL(v), 'Valor']} />
          <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={16}>
            {data.slice(0, 8).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">{text}</div>;
}
