'use client';

import { useSearchParams } from 'next/navigation';
import { useOnboardingContext } from '@/components/onboarding-provider';

/**
 * Hook que detecta se está em modo onboarding via query param.
 * Retorna métodos para marcar conquistas após criar produto/cliente/venda.
 */
export function useOnboardingMode() {
  const searchParams = useSearchParams();
  const isOnboardingMode = searchParams.get('onboarding') === 'true';
  const {
    markProductCreated,
    markCustomerCreated,
    markSaleCompleted,
    markDashboardViewed,
    progress,
  } = useOnboardingContext();

  return {
    isOnboardingMode,
    onProductCreated: markProductCreated,
    onCustomerCreated: markCustomerCreated,
    onSaleCompleted: markSaleCompleted,
    onDashboardViewed: markDashboardViewed,
    currentOnboardingStep: progress?.currentStep,
  };
}
