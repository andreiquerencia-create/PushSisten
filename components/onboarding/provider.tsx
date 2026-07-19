'use client';

import { createContext, useContext, ReactNode } from 'react';
import { useOnboarding } from '@/hooks/use-onboarding';

type OnboardingContextType = ReturnType<typeof useOnboarding>;

const OnboardingContext = createContext<OnboardingContextType | null>(null);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const onboarding = useOnboarding();
  return (
    <OnboardingContext.Provider value={onboarding}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboardingContext(): OnboardingContextType {
  const ctx = useContext(OnboardingContext);
  if (!ctx) {
    throw new Error('useOnboardingContext must be used within OnboardingProvider');
  }
  return ctx;
}
