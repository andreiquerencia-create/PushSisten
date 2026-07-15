'use client';

import { useEffect, useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Clock, LogOut, MessageCircle, AlertTriangle, Ban, PauseCircle,
} from 'lucide-react';
import { PlanCard } from '@/components/plan-card';
import { PAID_PLANS_ORDERED, getPlanLabel, PlanDefinition } from '@/lib/plan-engine';

// Canal de suporte comercial (somente ajuda — o checkout é a ação principal).
const SUPPORT_WHATSAPP = '553991665889';

interface SubStatus {
  status: 'ACTIVE' | 'TRIAL' | 'SUSPENDED' | 'CANCELED' | 'EXPIRED';
  blocked: boolean;
  reason: string | null;
  plan: string;
  trialEndsAt: string | null;
  daysRemaining: number | null;
  label: string;
  companyName: string | null;
}

const STATUS_VIEW: Record<string, { title: string; message: string; icon: any; gradient: string }> = {
  EXPIRED: {
    title: 'Seu período de teste terminou',
    message: 'Seu trial expirou. Escolha um plano para continuar usando o PushSisten.',
    icon: Clock,
    gradient: 'from-amber-400 to-orange-500',
  },
  SUSPENDED: {
    title: 'Sua assinatura está suspensa',
    message: 'O acesso ao sistema foi temporariamente suspenso. Entre em contato para regularizar e voltar a usar o PushSisten.',
    icon: PauseCircle,
    gradient: 'from-orange-400 to-red-500',
  },
  CANCELED: {
    title: 'Sua assinatura foi cancelada',
    message: 'Sua assinatura está cancelada. Fale com a gente para reativar sua conta e continuar usando o PushSisten.',
    icon: Ban,
    gradient: 'from-rose-500 to-red-600',
  },
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  } catch {
    return '—';
  }
}

export default function AssinaturaExpiradaPage() {
  const { data: session } = useSession() || {};
  const [sub, setSub] = useState<SubStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [processingPlan, setProcessingPlan] = useState<string | null>(null);

  // Ação PRINCIPAL: iniciar o checkout do plano escolhido (gateway de pagamento).
  async function handleSelectPlan(plan: PlanDefinition) {
    if (processingPlan) return;
    setProcessingPlan(plan.id);
    try {
      const resp = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: plan.id }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        toast.error(json?.error || 'Não foi possível iniciar o checkout.');
        setProcessingPlan(null);
        return;
      }
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

  useEffect(() => {
    let active = true;
    fetch('/api/subscription/status')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!active || !data || data.error) return;
        // Empresa com acesso liberado não deve ficar nesta tela
        if (data.blocked === false) {
          window.location.replace('/hoje');
          return;
        }
        setSub(data);
      })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const statusKey = sub?.status && STATUS_VIEW[sub.status] ? sub.status : 'EXPIRED';
  const view = STATUS_VIEW[statusKey];
  const Icon = view.icon;
  const companyName = sub?.companyName || session?.user?.companyName || '';
  const planLabel = getPlanLabel(sub?.plan ?? 'trial');
  const waText = encodeURIComponent(
    `Olá! Preciso regularizar a assinatura do PushSisten. Empresa: ${companyName} — Status: ${sub?.label || ''}`
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-[hsl(222,47%,11%)] via-[hsl(222,40%,16%)] to-[hsl(217,50%,20%)] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-4xl space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-3 mb-2">
            <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${view.gradient} flex items-center justify-center shadow-lg`}>
              <Icon className="w-7 h-7 text-white" />
            </div>
          </div>
          <h1 className="text-3xl md:text-4xl font-display font-bold text-white">
            {view.title}
          </h1>
          <p className="text-blue-200/70 text-lg max-w-lg mx-auto">
            {companyName ? (
              <><strong className="text-white">{companyName}</strong> — {view.message}</>
            ) : (
              <>{view.message}</>
            )}
          </p>
        </div>

        {/* Status card */}
        {!loading && sub && (
          <Card className="border-0 bg-white/10 backdrop-blur-sm">
            <CardContent className="p-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center sm:text-left">
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-blue-200/50">Plano atual</p>
                  <p className="text-white font-semibold text-lg">{planLabel}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-blue-200/50">Status</p>
                  <p className="text-white font-semibold text-lg flex items-center gap-1.5 justify-center sm:justify-start">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />{sub.label}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-blue-200/50">
                    {sub.status === 'EXPIRED' ? 'Trial expirou em' : 'Expiração do trial'}
                  </p>
                  <p className="text-white font-semibold text-lg">{formatDate(sub.trialEndsAt)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Plans */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-3">
          {PAID_PLANS_ORDERED.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              current={sub?.plan === plan.id}
              dark
              ctaLabel={processingPlan === plan.id ? 'Processando...' : 'Assinar Agora'}
              onSelect={processingPlan ? undefined : handleSelectPlan}
            />
          ))}
        </div>

        {/* Footer actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <a href={`https://wa.me/${SUPPORT_WHATSAPP}?text=${waText}`} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm" className="bg-white/5 border-white/20 text-white hover:bg-white/10">
              <MessageCircle className="w-4 h-4 mr-1" />Falar com suporte
            </Button>
          </a>
          <Button variant="ghost" size="sm" className="text-blue-300/60 hover:text-white" onClick={() => signOut({ callbackUrl: '/login' })}>
            <LogOut className="w-4 h-4 mr-1" />Sair da conta
          </Button>
        </div>
      </div>
    </div>
  );
}
