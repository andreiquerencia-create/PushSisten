'use client';

/**
 * Modo Apresentação — roteiro comercial guiado em 8 etapas.
 * Narrações FIXAS (texto de vendas) combinadas com DADOS REAIS da loja
 * de demonstração (via /api/apresentacao/metrics). Somente leitura.
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Loader2, ArrowLeft, ArrowRight, RotateCw, X, LayoutDashboard,
  Activity, Gauge, Bot, Zap, Wallet, CreditCard, Trophy,
} from 'lucide-react';

const brl = (v: number) => (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const int = (v: number) => (v ?? 0).toLocaleString('pt-BR');

interface Metrics {
  company: { name: string };
  executive: { faturamentoTotal: number; vendasTotal: number; faturamento30: number; vendas30: number; ticketMedio30: number; produtos: number; clientes: number };
  pushScore: { score: number; classification: string; status: string; subscores: any } | null;
  fluxoCaixa: { aReceber: number; aReceberQtd: number; aPagar: number; aPagarQtd: number; saldoCaixa: number };
  crediario: { emAberto: number; parcelasAbertas: number; emAtraso: number; parcelasAtraso: number };
}

export function ApresentacaoContent() {
  const router = useRouter();
  const [m, setM] = useState<Metrics | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [step, setStep] = useState(0);

  useEffect(() => {
    fetch('/api/apresentacao/metrics', { cache: 'no-store' })
      .then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d?.error || 'Falha'); return d; })
      .then(setM).catch((e) => setErr(e.message));
  }, []);

  if (err) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-md"><CardContent className="py-8 text-center space-y-3">
          <p className="text-muted-foreground">{err}</p>
          <Button onClick={() => router.push('/hoje')}>Voltar ao sistema</Button>
        </CardContent></Card>
      </div>
    );
  }
  if (!m) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }

  const ps = m.pushScore;
  const steps = [
    {
      icon: LayoutDashboard, title: '1 · Visão Executiva', color: 'text-blue-600',
      narration: 'Em poucos segundos o dono já entende como a loja está.',
      metrics: [
        { label: 'Faturamento (30 dias)', value: brl(m.executive.faturamento30) },
        { label: 'Vendas (30 dias)', value: int(m.executive.vendas30) },
        { label: 'Ticket médio', value: brl(m.executive.ticketMedio30) },
        { label: 'Faturamento total', value: brl(m.executive.faturamentoTotal) },
        { label: 'Produtos cadastrados', value: int(m.executive.produtos) },
        { label: 'Clientes ativos', value: int(m.executive.clientes) },
      ],
    },
    {
      icon: Activity, title: '2 · Saúde da Loja', color: 'text-emerald-600',
      narration: 'Aqui o sistema transforma dezenas de números em uma leitura simples.',
      metrics: ps ? [
        { label: 'Classificação', value: ps.classification },
        { label: 'Rentabilidade', value: String(ps.subscores?.rentabilityScore ?? '—') },
        { label: 'Liquidez', value: String(ps.subscores?.liquidityScore ?? '—') },
        { label: 'Estoque', value: String(ps.subscores?.inventoryScore ?? '—') },
        { label: 'Inadimplência', value: String(ps.subscores?.defaultScore ?? '—') },
        { label: 'Clientes', value: String(ps.subscores?.customerBaseScore ?? '—') },
      ] : [{ label: 'Saúde', value: 'Em formação' }],
    },
    {
      icon: Gauge, title: '3 · Push Score', color: 'text-violet-600',
      narration: 'É o termômetro geral da operação.',
      big: ps ? String(ps.score) : '—',
      bigLabel: ps ? ps.classification : 'Em formação',
      metrics: [],
    },
    {
      icon: Bot, title: '4 · IA Gerente', color: 'text-indigo-600',
      narration: 'O sistema diz exatamente o que precisa ser feito.',
      metrics: [
        { label: 'Contas a pagar em aberto', value: `${brl(m.fluxoCaixa.aPagar)} (${m.fluxoCaixa.aPagarQtd})` },
        { label: 'Crédito em atraso', value: `${brl(m.crediario.emAtraso)} (${m.crediario.parcelasAtraso})` },
        { label: 'A receber', value: `${brl(m.fluxoCaixa.aReceber)} (${m.fluxoCaixa.aReceberQtd})` },
      ],
    },
    {
      icon: Zap, title: '5 · Ações Automáticas', color: 'text-amber-600',
      narration: 'O sistema não apenas mostra problemas. Ele sugere ações.',
      metrics: [
        { label: 'Parcelas a cobrar (atraso)', value: int(m.crediario.parcelasAtraso) },
        { label: 'Contas a quitar', value: int(m.fluxoCaixa.aPagarQtd) },
        { label: 'Recebimentos a confirmar', value: int(m.fluxoCaixa.aReceberQtd) },
      ],
    },
    {
      icon: Wallet, title: '6 · Fluxo de Caixa', color: 'text-teal-600',
      narration: 'Permite antecipar problemas financeiros.',
      metrics: [
        { label: 'A receber', value: brl(m.fluxoCaixa.aReceber) },
        { label: 'A pagar', value: brl(m.fluxoCaixa.aPagar) },
        { label: 'Saldo proj. (receber - pagar)', value: brl(m.fluxoCaixa.aReceber - m.fluxoCaixa.aPagar) },
      ],
    },
    {
      icon: CreditCard, title: '7 · Crediário', color: 'text-rose-600',
      narration: 'Ajuda a proteger receita e reduzir inadimplência.',
      metrics: [
        { label: 'Crédito em aberto', value: brl(m.crediario.emAberto) },
        { label: 'Parcelas em aberto', value: int(m.crediario.parcelasAbertas) },
        { label: 'Em atraso', value: brl(m.crediario.emAtraso) },
        { label: 'Parcelas em atraso', value: int(m.crediario.parcelasAtraso) },
      ],
    },
    {
      icon: Trophy, title: '8 · Encerramento', color: 'text-fuchsia-600',
      narration: 'PushSisten não é apenas um ERP. É um gerente virtual que mostra diariamente o que a loja precisa fazer para vender mais e lucrar mais.',
      metrics: [],
      closing: true,
    },
  ];

  const cur = steps[step];
  const Icon = cur.icon;
  const isFirst = step === 0;
  const isLast = step === steps.length - 1;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <div className="max-w-3xl mx-auto p-4 sm:p-8">
        {/* Topo */}
        <div className="flex items-center justify-between mb-4">
          <Badge variant="secondary">Modo Apresentação · {m.company.name}</Badge>
          <Button variant="ghost" size="sm" onClick={() => router.push('/hoje')}>
            <X className="w-4 h-4 mr-1" /> Sair
          </Button>
        </div>

        {/* Progresso */}
        <div className="flex gap-1.5 mb-6">
          {steps.map((_, i) => (
            <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= step ? 'bg-primary' : 'bg-muted'}`} />
          ))}
        </div>

        {/* Card principal */}
        <Card className="shadow-lg">
          <CardContent className="py-8 px-6 space-y-6">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-xl bg-muted ${cur.color}`}><Icon className="w-7 h-7" /></div>
              <h1 className="text-2xl font-bold">{cur.title}</h1>
            </div>

            <p className="text-lg leading-relaxed text-muted-foreground italic">“{cur.narration}”</p>

            {'big' in cur && cur.big && (
              <div className="text-center py-6">
                <div className="text-7xl font-extrabold tracking-tight">{cur.big}</div>
                <div className="mt-2 text-lg font-medium text-muted-foreground">{(cur as any).bigLabel}</div>
              </div>
            )}

            {cur.metrics.length > 0 && (
              <div className="grid gap-3 sm:grid-cols-2">
                {cur.metrics.map((mt, i) => (
                  <div key={i} className="rounded-lg border bg-card p-4">
                    <div className="text-xs text-muted-foreground">{mt.label}</div>
                    <div className="text-xl font-semibold mt-0.5">{mt.value}</div>
                  </div>
                ))}
              </div>
            )}

            {(cur as any).closing && (
              <div className="rounded-lg bg-primary/5 border border-primary/20 p-4 text-center">
                <p className="font-medium">Obrigado! Esta é a Loja Modelo PushSisten.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Navegação */}
        <div className="flex items-center justify-between mt-6">
          <Button variant="outline" disabled={isFirst} onClick={() => setStep((s) => Math.max(0, s - 1))}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setStep(0)}>
            <RotateCw className="w-4 h-4 mr-1" /> Reiniciar
          </Button>
          {isLast ? (
            <Button onClick={() => router.push('/hoje')}>Concluir</Button>
          ) : (
            <Button onClick={() => setStep((s) => Math.min(steps.length - 1, s + 1))}>
              Avançar <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
