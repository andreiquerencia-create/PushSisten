'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { SetupScreen } from '@/components/onboarding/setup-screen';
import { useOnboardingContext } from '@/components/onboarding/provider';

export default function SetupPage() {
  const router = useRouter();
  const { state, isLoading } = useOnboardingContext();

  // Se já completou o onboarding ou já passou do step 0, redirecionar
  useEffect(() => {
    if (isLoading) return;
    if (state && state.status === 'completed') {
      router.replace('/hoje');
    }
    if (state && state.currentStep > 0 && state.status === 'active') {
      router.replace('/hoje');
    }
  }, [isLoading, state, router]);

  const handleSetupComplete = () => {
    // Navegar para o sistema — o step card vai guiar a partir daqui
    router.replace('/hoje');
  };

  // Enquanto carrega, não mostra nada
  if (isLoading) return null;

  // Se já tem estado e não é step 0, não mostra (o useEffect vai redirecionar)
  if (state && state.currentStep > 0) return null;

  return <SetupScreen onComplete={handleSetupComplete} />;
}
