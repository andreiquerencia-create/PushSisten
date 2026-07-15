'use client';

/**
 * /planos — PÁGINA COMERCIAL DE PLANOS (PRIORIDADE 8.3 / TAREFA 2)
 * ---------------------------------------------------------------------------
 * Exibe o catálogo comercial completo (Trial / Essencial / Crescimento / Escala),
 * marca o plano ATUAL e o RECOMENDADO, e mostra uma tabela de comparacão.
 * Billing-neutral: CTA leva ao contato (WhatsApp) sem gateway de pagamento.
 */

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Check, Minus, MessageCircle, Sparkles, Award } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { PlanCard } from '@/components/plan-card';
import {
  PLAN_CATALOG_ORDERED,
  PlanDefinition,
  PlanId,
  isUnlimited,
  getPlanLabel,
  FOUNDER_BADGE,
} from '@/lib/plan-engine';

interface PlanoApi {
  isMaster?: boolean;
  planUsage?: { plan: PlanId };
  upgrade?: { recommendedPlan: PlanId | null; reason: string | null };
}

const WHATSAPP = '553991665889';

function waLink(planLabel: string, companyName?: string) {
  const txt = encodeURIComponent(
    `Olá! Quero contratar o plano ${planLabel} do PushSisten.${companyName ? ` Empresa: ${companyName}` : ''}`,
  );
  return `https://wa.me/${WHATSAPP}?text=${txt}`;
}

export default function PlanosContent() {
  const params = useSearchParams();
  const toParam = (params?.get('to') as PlanId | null) ?? null;
  const [data, setData] = useState<PlanoApi | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch('/api/plano')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (active && d && !d.error) setData(d); })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const currentPlan = data?.planUsage?.plan ?? null;
  // O destino recomendado vem da URL (?to=) ou do motor de upgrade.
  const recommendedPlan = toParam ?? data?.upgrade?.recommendedPlan ?? null;
  const reason = data?.upgrade?.reason ?? null;
  const isMaster = data?.isMaster === true;
  const [processingPlan, setProcessingPlan] = useState<PlanId | null>(null);

  // Assinar/Trocar de plano: empresa SEM plano pago -> checkout; COM plano pago -> troca.
  async function handleSelectPlan(plan: PlanDefinition) {
    if (processingPlan) return;
    setProcessingPlan(plan.id);
    try {
      // Se já possui um plano PAGO ativo, trata como troca de plano.
      const hasPaidPlan = currentPlan && currentPlan !== 'trial';
      const endpoint = hasPaidPlan ? '/api/billing/change-plan' : '/api/billing/checkout';
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: plan.id }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        toast.error(json?.error || 'Não foi possível processar a solicitação.');
        setProcessingPlan(null);
        return;
      }
      if (hasPaidPlan) {
        toast.success('Plano atualizado com sucesso!');
        setProcessingPlan(null);
        // Recarrega para refletir o novo plano.
        setTimeout(() => { window.location.reload(); }, 800);
        return;
      }
      // Checkout: redireciona ao processador de pagamento.
      if (json?.initPoint) {
        window.location.href = json.initPoint;
        return;
      }
      toast.error('Não foi possível iniciar o checkout.');
      setProcessingPlan(null);
    } catch {
      toast.error('Erro de conexão. Tente novamente.');
      setProcessingPlan(null);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[hsl(222,47%,11%)] via-[hsl(222,40%,16%)] to-[hsl(217,50%,20%)] py-10 px-4">
      <div className="w-full max-w-6xl mx-auto space-y-10">
        {/* Cabeçalho */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-blue-100 text-xs font-medium">
            <Sparkles className="w-3.5 h-3.5" /> Planos PushSisten
          </div>
          <h1 className="text-3xl md:text-4xl font-display font-bold text-white">
            Escolha o plano ideal para a sua loja
          </h1>
          <p className="text-blue-200/70 text-lg max-w-2xl mx-auto">
            Todos os planos têm acesso COMPLETO a todos os recursos do sistema. O que muda é
            a capacidade: número de usuários e consultas de IA por mês.
          </p>
          {/* Selo de Fundadores PushSisten */}
          <div className="flex justify-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-amber-400/15 border border-amber-300/30 px-4 py-1.5 text-amber-200">
              <Award className="w-4 h-4" />
              <span className="text-sm font-semibold">{FOUNDER_BADGE.label}</span>
              <span className="hidden sm:inline text-xs text-amber-200/70">— {FOUNDER_BADGE.info}</span>
            </div>
          </div>
          {!loading && currentPlan && (
            <p className="text-sm text-emerald-300">
              Seu plano atual: <strong>{getPlanLabel(currentPlan)}</strong>
            </p>
          )}
          {!loading && reason && recommendedPlan && (
            <div className="max-w-xl mx-auto rounded-xl bg-violet-500/15 border border-violet-400/30 px-4 py-3 text-sm text-violet-100">
              {reason}
            </div>
          )}
        </div>

        {/* Cartões de plano */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {PLAN_CATALOG_ORDERED.map((plan) => {
            const isCurrent = currentPlan === plan.id;
            const isRecommended = !isCurrent && recommendedPlan === plan.id;
            const isTrial = plan.id === 'trial';
            const isProcessing = processingPlan === plan.id;
            const hasPaidPlan = currentPlan && currentPlan !== 'trial';
            const ctaLabel = isProcessing
              ? 'Processando...'
              : hasPaidPlan
                ? `Mudar para ${plan.label}`
                : 'Assinar Agora';
            return (
              <PlanCard
                key={plan.id}
                plan={plan}
                current={isCurrent}
                recommended={isRecommended}
                dark
                hideCta={isTrial || isMaster}
                ctaLabel={ctaLabel}
                onSelect={isProcessing ? undefined : handleSelectPlan}
              />
            );
          })}
        </div>

        {/* Tabela de comparação */}
        <ComparisonTable currentPlan={currentPlan} />

        {/* Ações de rodapé */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Link href="/hoje">
            <Button variant="outline" size="sm" className="bg-white/5 border-white/20 text-white hover:bg-white/10">
              <ArrowLeft className="w-4 h-4 mr-1" /> Voltar ao sistema
            </Button>
          </Link>
          <a href={waLink('PushSisten')} target="_blank" rel="noopener noreferrer">
            <Button variant="ghost" size="sm" className="text-blue-300/70 hover:text-white">
              <MessageCircle className="w-4 h-4 mr-1" /> Falar com um especialista
            </Button>
          </a>
        </div>
      </div>
    </div>
  );
}

function ComparisonTable({ currentPlan }: { currentPlan: PlanId | null }) {
  const plans = PLAN_CATALOG_ORDERED;
  const rows: { label: string; render: (planId: PlanId) => React.ReactNode }[] = [
    {
      label: 'Preço mensal',
      render: (id) => {
        const p = plans.find((x) => x.id === id)!;
        return <span className="font-mono font-semibold">{p.priceLabel}</span>;
      },
    },
    {
      label: 'Usuários',
      render: (id) => {
        const p = plans.find((x) => x.id === id)!;
        return isUnlimited(p.maxUsers) ? 'Ilimitados' : `Até ${p.maxUsers}`;
      },
    },
    {
      label: 'Consultas de IA / mês',
      render: (id) => {
        const p = plans.find((x) => x.id === id)!;
        return isUnlimited(p.aiQuotaMonthly) ? 'Ilimitadas' : `${p.aiQuotaMonthly}`;
      },
    },
  ];

  // Linhas de módulos — TODOS inclusos em TODOS os planos (regra de negócio).
  const modules = [
    'PDV e Vendas',
    'Controle de Estoque',
    'Financeiro completo',
    'Crediário',
    'Push Score',
    'Insights e Relatórios',
    'IA Gerente',
    'Central do Dia',
    'Automações',
  ];

  return (
    <div className="rounded-2xl bg-white/95 backdrop-blur-sm shadow-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-border">
        <h2 className="font-display font-bold text-lg">Comparação detalhada</h2>
        <p className="text-sm text-muted-foreground">Todos os módulos estão inclusos em todos os planos.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left font-medium text-muted-foreground px-6 py-3 w-[34%]">Recurso</th>
              {plans.map((p) => (
                <th key={p.id} className="text-center font-semibold px-3 py-3">
                  <span className={currentPlan === p.id ? 'text-emerald-600' : ''}>{p.label}</span>
                  {currentPlan === p.id && <span className="block text-[10px] font-normal text-emerald-600">Seu plano</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-b border-border/60">
                <td className="px-6 py-3 text-muted-foreground">{row.label}</td>
                {plans.map((p) => (
                  <td key={p.id} className="text-center px-3 py-3">{row.render(p.id)}</td>
                ))}
              </tr>
            ))}
            {modules.map((m) => (
              <tr key={m} className="border-b border-border/60">
                <td className="px-6 py-3 text-muted-foreground">{m}</td>
                {plans.map((p) => (
                  <td key={p.id} className="text-center px-3 py-3">
                    <Check className="w-4 h-4 text-emerald-500 inline-block" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-6 py-3 text-xs text-muted-foreground flex items-center gap-1.5">
        <Minus className="w-3 h-3" /> Nenhum módulo é bloqueado por plano — a diferença é apenas de capacidade.
      </div>
    </div>
  );
}
