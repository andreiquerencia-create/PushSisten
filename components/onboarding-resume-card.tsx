'use client';

import { useRouter } from 'next/navigation';
import { useOnboardingContext } from '@/components/onboarding-provider';
import { Button } from '@/components/ui/button';

/**
 * Card discreto exibido no Dashboard quando o onboarding foi abandonado ou está incompleto.
 * Nunca bloqueia o acesso ao ERP. Apenas convida a continuar.
 */
export function OnboardingResumeCard() {
  const router = useRouter();
  const { progress, isLoading, resume } = useOnboardingContext();

  // Não exibir se: loading, nunca iniciou, já completou, ou está ativo (não abandonado)
  if (isLoading) return null;
  if (!progress) return null;
  if (progress.completed) return null;
  if (!progress.abandoned) return null; // Se está ativo (não abandonado), o fluxo já está rodando

  const handleResume = async () => {
    await resume();
    // Redirecionar para a etapa onde parou
    const step = progress.currentStep;
    switch (step) {
      case 'welcome':
      case 'profile':
        router.push('/onboarding');
        break;
      case 'product':
        router.push('/produtos?onboarding=true');
        break;
      case 'customer':
        router.push('/clientes?onboarding=true');
        break;
      case 'sale':
        router.push('/pdv?onboarding=true');
        break;
      case 'dashboard':
      case 'next_steps':
        router.push('/dashboard');
        break;
      default:
        router.push('/onboarding');
    }
  };

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-sm">Continue colocando sua loja para funcionar.</h3>
          <p className="text-xs text-muted-foreground mt-1">Retome de onde parou — leva poucos minutos.</p>
        </div>
        <Button size="sm" onClick={handleResume}>
          Continuar
        </Button>
      </div>
    </div>
  );
}
