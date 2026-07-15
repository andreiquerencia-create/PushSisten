'use client';

/**
 * SeuPlanoCard — Card "Seu Plano" da ÁREA DO CLIENTE (PRIORIDADE 8.3 / TAREFA 7+5)
 * ---------------------------------------------------------------------------
 * Mostra, de forma autoexplicativa (sem suporte):
 *  - qual plano a empresa possui (nome comercial);
 *  - quanto está usando (consumo de IA e de usuários, com barras);
 *  - dias restantes do trial (quando aplicável);
 *  - quando evoluir e qual plano contratar (recomendação automática 80/90/100%).
 *
 * Billing-neutral: o botão leva a /planos (estrutura upgradeUrl), sem gateway.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Crown, Users, Sparkles as SparklesIcon, Clock, ArrowRight, TrendingUp, CheckCircle2, AlertTriangle,
  CreditCard, Receipt, XCircle, Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type AlertLevel = 'warning' | 'critical' | 'limit' | null;

interface ResourceUsage {
  used: number;
  limit: number;
  unlimited: boolean;
  percent: number;
  alertLevel: AlertLevel;
}

interface PlanoApi {
  isMaster?: boolean;
  companyName?: string;
  planUsage?: { plan: string; planLabel: string; users: ResourceUsage; ai: ResourceUsage };
  upgrade?: {
    recommendedPlan: string | null;
    recommendedPlanLabel: string | null;
    shouldUpgrade: boolean;
    reason: string | null;
    alertMessage: string | null;
    highestAlertLevel: AlertLevel;
    upgradeUrl: string;
  };
  subscription?: {
    status: string;
    label: string;
    daysRemaining: number | null;
    trialEndsAt: string | null;
  };
  billing?: {
    status: string;
    gracePeriodEndsAt: string | null;
    subscription: {
      plan: string;
      priceAmount: number;
      status: string;
      nextBillingDate: string | null;
      lastPaymentDate: string | null;
      lastPaymentStatus: string | null;
      paymentMethodBrand: string | null;
      paymentMethodLast4: string | null;
    } | null;
    payments: { id: string; amount: number; status: string; method: string | null; paidAt: string | null; createdAt: string }[];
  } | null;
}

const BILLING_LABEL: Record<string, { label: string; cls: string }> = {
  ACTIVE:    { label: 'Em dia',       cls: 'bg-emerald-100 text-emerald-700' },
  PAST_DUE:  { label: 'Pagamento pendente', cls: 'bg-amber-100 text-amber-700' },
  SUSPENDED: { label: 'Suspensa',     cls: 'bg-red-100 text-red-700' },
  CANCELED:  { label: 'Cancelada',    cls: 'bg-rose-100 text-rose-700' },
};
const PAYMENT_LABEL: Record<string, { label: string; cls: string }> = {
  approved: { label: 'Aprovado', cls: 'text-emerald-600' },
  rejected: { label: 'Recusado', cls: 'text-red-600' },
  refunded: { label: 'Estornado', cls: 'text-amber-600' },
  pending:  { label: 'Pendente', cls: 'text-muted-foreground' },
};
function fmtMoney(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}
function fmtDate(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function barColor(level: AlertLevel): string {
  if (level === 'limit') return 'bg-red-500';
  if (level === 'critical') return 'bg-orange-500';
  if (level === 'warning') return 'bg-amber-500';
  return 'bg-emerald-500';
}

function UsageBar({ icon: Icon, label, r }: { icon: any; label: string; r: ResourceUsage }) {
  const pct = r.unlimited ? 100 : Math.min(100, r.percent);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Icon className="w-4 h-4" /> {label}
        </span>
        <span className="font-medium">
          {r.unlimited ? 'Ilimitado' : `${r.used} / ${r.limit}`}
        </span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', r.unlimited ? 'bg-emerald-400' : barColor(r.alertLevel))}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function SeuPlanoCard({ className }: { className?: string }) {
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

  if (loading) {
    return (
      <div className={cn('rounded-2xl border border-border bg-card p-6 animate-pulse h-64', className)} />
    );
  }

  if (!data || data.isMaster || !data.planUsage) return null;

  const { planUsage, upgrade, subscription, billing } = data;
  const hasBilling = billing && billing.status && billing.status !== 'NONE';
  const isTrial = planUsage.plan === 'trial';
  const shouldUpgrade = upgrade?.shouldUpgrade && upgrade?.recommendedPlan;
  const alertMessage = upgrade?.alertMessage ?? null;
  const level = upgrade?.highestAlertLevel ?? null;

  return (
    <div className={cn('rounded-2xl border border-border bg-card shadow-sm overflow-hidden', className)}>
      {/* Cabeçalho */}
      <div className="flex items-center justify-between p-6 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center shadow-lg">
            <Crown className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Seu plano</p>
            <h3 className="font-display font-bold text-xl leading-tight">{planUsage.planLabel}</h3>
          </div>
        </div>
        {isTrial && subscription?.daysRemaining != null && (
          <div className="text-right">
            <p className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
              <Clock className="w-3.5 h-3.5" /> Trial
            </p>
            <p className={cn('font-bold text-lg', subscription.daysRemaining <= 3 ? 'text-red-500' : subscription.daysRemaining <= 7 ? 'text-amber-500' : 'text-foreground')}>
              {subscription.daysRemaining} {subscription.daysRemaining === 1 ? 'dia' : 'dias'}
            </p>
          </div>
        )}
      </div>

      {/* Consumo */}
      <div className="px-6 space-y-4">
        <UsageBar icon={Users} label="Usuários" r={planUsage.users} />
        <UsageBar icon={SparklesIcon} label="Consultas de IA (mês)" r={planUsage.ai} />
      </div>

      {/* Cobrança / Assinatura (P8.4) */}
      {hasBilling && (
        <BillingSection billing={billing!} />
      )}

      {/* Alerta de proximidade do limite */}
      {alertMessage && (
        <div className={cn(
          'mx-6 mt-4 rounded-xl px-4 py-3 text-sm flex items-start gap-2',
          level === 'limit' ? 'bg-red-500/10 text-red-700 dark:text-red-300'
            : level === 'critical' ? 'bg-orange-500/10 text-orange-700 dark:text-orange-300'
              : 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
        )}>
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{alertMessage}</span>
        </div>
      )}

      {/* Recomendação de upgrade */}
      {shouldUpgrade ? (
        <div className="m-6 mt-4 rounded-xl bg-gradient-to-br from-violet-500/10 to-violet-600/5 border border-violet-400/30 p-4 space-y-3">
          <div className="flex items-start gap-2">
            <TrendingUp className="w-4 h-4 text-violet-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-violet-700 dark:text-violet-300">
                Recomendamos o plano {upgrade?.recommendedPlanLabel}
              </p>
              {upgrade?.reason && <p className="text-xs text-muted-foreground mt-0.5">{upgrade.reason}</p>}
            </div>
          </div>
          <Link href={upgrade?.upgradeUrl ?? '/planos'} className="block">
            <Button className="w-full bg-gradient-to-r from-violet-500 to-violet-600 hover:from-violet-600 hover:to-violet-700 text-white">
              Conhecer o plano {upgrade?.recommendedPlanLabel}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      ) : (
        <div className="m-6 mt-4 space-y-3">
          {!isTrial && (
            <div className="flex items-center gap-2 text-sm text-emerald-600">
              <CheckCircle2 className="w-4 h-4" /> Seu plano atende bem o uso atual.
            </div>
          )}
          <Link href="/planos" className="block">
            <Button variant="outline" className="w-full">
              Ver todos os planos
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}

/** Seção de cobrança/assinatura exibida no card "Seu Plano". */
function BillingSection({ billing }: { billing: NonNullable<PlanoApi['billing']> }) {
  const [canceling, setCanceling] = useState(false);
  const sub = billing.subscription;
  const statusCfg = BILLING_LABEL[billing.status] || null;

  async function handleCancel() {
    if (canceling) return;
    if (!confirm('Tem certeza que deseja cancelar sua assinatura? O acesso permanece até o fim do período pago.')) return;
    setCanceling(true);
    try {
      const resp = await fetch('/api/billing/cancel', { method: 'POST' });
      const json = await resp.json().catch(() => ({}));
      if (resp.ok && json?.ok) {
        toast.success('Assinatura cancelada.');
        setTimeout(() => window.location.reload(), 800);
      } else {
        toast.error(json?.error || 'Não foi possível cancelar.');
        setCanceling(false);
      }
    } catch {
      toast.error('Erro de conexão.');
      setCanceling(false);
    }
  }

  const isActiveLike = ['ACTIVE', 'PAST_DUE'].includes(billing.status);

  return (
    <div className="mx-6 mt-5 rounded-xl border border-border/70 bg-muted/20 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/60">
        <CreditCard className="w-4 h-4 text-emerald-500" />
        <span className="text-sm font-semibold">Assinatura</span>
        {statusCfg && (
          <span className={cn('ml-auto inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold', statusCfg.cls)}>
            {statusCfg.label}
          </span>
        )}
      </div>

      <div className="px-4 py-3 grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Próxima cobrança</p>
          <p className="font-medium">{fmtDate(sub?.nextBillingDate)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Valor mensal</p>
          <p className="font-medium">{typeof sub?.priceAmount === 'number' ? fmtMoney(sub.priceAmount) : '—'}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Último pagamento</p>
          <p className="font-medium">{fmtDate(sub?.lastPaymentDate)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Forma de pagamento</p>
          <p className="font-medium">{sub?.paymentMethodBrand ? `${sub.paymentMethodBrand}${sub.paymentMethodLast4 ? ' ••••' + sub.paymentMethodLast4 : ''}` : '—'}</p>
        </div>
      </div>

      {billing.status === 'PAST_DUE' && billing.gracePeriodEndsAt && (
        <div className="mx-4 mb-3 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-300 px-3 py-2 text-xs flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>Seu último pagamento não foi confirmado. Regularize até {fmtDate(billing.gracePeriodEndsAt)} para manter o acesso.</span>
        </div>
      )}

      {/* Histórico de pagamentos */}
      {billing.payments.length > 0 && (
        <div className="px-4 pb-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Receipt className="w-3.5 h-3.5 text-muted-foreground" />
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Histórico de pagamentos</p>
          </div>
          <div className="space-y-1">
            {billing.payments.slice(0, 5).map((p) => {
              const cfg = PAYMENT_LABEL[p.status] || { label: p.status, cls: 'text-muted-foreground' };
              return (
                <div key={p.id} className="flex items-center justify-between text-xs py-1 border-b border-border/40 last:border-0">
                  <span className="text-muted-foreground">{fmtDate(p.paidAt || p.createdAt)}</span>
                  <span className="font-mono">{fmtMoney(p.amount)}</span>
                  <span className={cn('font-semibold', cfg.cls)}>{cfg.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Ações */}
      <div className="px-4 py-3 border-t border-border/60 flex flex-col sm:flex-row gap-2">
        <Link href="/planos" className="flex-1">
          <Button variant="outline" size="sm" className="w-full">Alterar plano</Button>
        </Link>
        {isActiveLike && (
          <Button variant="ghost" size="sm" className="flex-1 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30" onClick={handleCancel} disabled={canceling}>
            {canceling ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5 mr-1.5" />}
            Cancelar assinatura
          </Button>
        )}
      </div>
    </div>
  );
}

export default SeuPlanoCard;
