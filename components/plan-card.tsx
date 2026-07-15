'use client';

/**
 * PlanCard — Cartão de plano comercial REUTILIZÁVEL (PRIORIDADE 8.3 / TAREFA 3)
 * ---------------------------------------------------------------------------
 * Usado em /planos, na tela de assinatura expirada, no card "Seu Plano" e em
 * qualquer fluxo de upgrade. Lê os dados do catálogo (plan-engine) — fonte
 * única de verdade dos nomes comerciais, preços e benefícios.
 *
 * Billing-neutral: o CTA recebe um href/onClick livre (nenhum gateway acoplado).
 */

import Link from 'next/link';
import { Clock, Zap, Crown, Sparkles, Rocket, TrendingUp, Building2, Check, ArrowRight, Award, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { PlanDefinition, isUnlimited, FOUNDER_BADGE } from '@/lib/plan-engine';

const ICONS: Record<PlanDefinition['icon'], LucideIcon> = {
  Clock,
  Zap,
  Crown,
  Sparkles,
  Rocket,
  TrendingUp,
  Building2,
};

export interface PlanCardProps {
  plan: PlanDefinition;
  /** Marca como plano ATUAL da empresa. */
  current?: boolean;
  /** Marca como plano RECOMENDADO pelo motor de upgrade. */
  recommended?: boolean;
  /** Texto do botão de ação. Padrão depende do contexto. */
  ctaLabel?: string;
  /** Destino do botão (billing-neutral). Se ausente e sem onSelect, oculta o CTA. */
  ctaHref?: string;
  /** Ação de clique alternativa ao href. */
  onSelect?: (plan: PlanDefinition) => void;
  /** Esconde completamente o botão de ação (uso informativo, ex.: card "Seu Plano"). */
  hideCta?: boolean;
  /** Tema escuro (sobre fundo escuro, ex.: tela de assinatura). */
  dark?: boolean;
  className?: string;
}

export function PlanCard({
  plan,
  current = false,
  recommended = false,
  ctaLabel,
  ctaHref,
  onSelect,
  hideCta = false,
  dark = false,
  className,
}: PlanCardProps) {
  const Icon = ICONS[plan.icon] ?? Sparkles;
  // Destaque: recomendado tem prioridade, depois highlight do catálogo.
  const isFeatured = recommended || plan.highlight;
  const ringClass = recommended
    ? 'ring-2 ring-violet-500'
    : current
      ? 'ring-2 ring-emerald-500'
      : plan.highlight
        ? 'ring-2 ring-violet-400/60'
        : '';

  // Selo do topo: "Plano atual" > "Recomendado" > badge do catálogo.
  const topBadge = current
    ? { text: 'Seu plano', cls: 'from-emerald-500 to-emerald-600' }
    : recommended
      ? { text: 'Recomendado para você', cls: 'from-violet-500 to-violet-600' }
      : plan.badge
        ? { text: plan.badge, cls: 'from-violet-500 to-violet-600' }
        : null;

  const resolvedCtaLabel = ctaLabel ?? (current ? 'Plano atual' : `Escolher ${plan.label}`);
  const showCta = !hideCta && !current && (ctaHref || onSelect);

  return (
    <div
      className={cn(
        'relative rounded-2xl p-6 flex flex-col shadow-xl transition-transform',
        dark ? 'bg-white/95 backdrop-blur-sm' : 'bg-card border border-border',
        isFeatured && 'md:scale-[1.03]',
        ringClass,
        className,
      )}
    >
      {topBadge && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap">
          <span className={cn('bg-gradient-to-r text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow-lg', topBadge.cls)}>
            {topBadge.text}
          </span>
        </div>
      )}

      {/* Cabeçalho */}
      <div className="flex items-center gap-3">
        <div className={cn('w-11 h-11 rounded-xl bg-gradient-to-br flex items-center justify-center shadow-lg flex-shrink-0', plan.accentGradient)}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0">
          <h3 className="font-display font-bold text-lg leading-tight">{plan.label}</h3>
          <p className="text-xs text-muted-foreground truncate">{plan.tagline}</p>
        </div>
      </div>

      {/* Preço */}
      <div className="mt-5 flex items-baseline gap-1">
        <span className="text-3xl font-bold font-mono">{plan.priceLabel}</span>
        {plan.priceMonthly > 0 && <span className="text-muted-foreground text-sm">/mês</span>}
      </div>
      {/* Selo de Fundadores (preço promocional dos primeiros clientes) */}
      {plan.priceMonthly > 0 && (
        <div className="mt-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 uppercase tracking-wide">
            <Award className="w-3 h-3" /> {FOUNDER_BADGE.label}
          </span>
        </div>
      )}
      <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>

      {/* Limites principais */}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-muted/60 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Usuários</p>
          <p className="text-sm font-semibold">{isUnlimited(plan.maxUsers) ? 'Ilimitados' : `Até ${plan.maxUsers}`}</p>
        </div>
        <div className="rounded-lg bg-muted/60 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Consultas de IA</p>
          <p className="text-sm font-semibold">{isUnlimited(plan.aiQuotaMonthly) ? 'Ilimitadas' : `${plan.aiQuotaMonthly}/mês`}</p>
        </div>
      </div>

      {/* Benefícios */}
      <ul className="mt-4 space-y-2 flex-1">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm">
            <Check className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
            <span className="text-foreground/90">{f}</span>
          </li>
        ))}
      </ul>

      {/* CTA */}
      {showCta && (
        <div className="mt-6">
          {ctaHref ? (
            <Link href={ctaHref} className="block">
              <Button
                className={cn('w-full', isFeatured && 'bg-gradient-to-r from-violet-500 to-violet-600 hover:from-violet-600 hover:to-violet-700 text-white')}
                variant={isFeatured ? 'default' : 'outline'}
              >
                {resolvedCtaLabel}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          ) : (
            <Button
              onClick={() => onSelect?.(plan)}
              className={cn('w-full', isFeatured && 'bg-gradient-to-r from-violet-500 to-violet-600 hover:from-violet-600 hover:to-violet-700 text-white')}
              variant={isFeatured ? 'default' : 'outline'}
            >
              {resolvedCtaLabel}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          )}
        </div>
      )}

      {current && !hideCta && (
        <div className="mt-6">
          <Button className="w-full" variant="outline" disabled>
            <Check className="w-4 h-4 mr-2" />Plano atual
          </Button>
        </div>
      )}
    </div>
  );
}

export default PlanCard;
