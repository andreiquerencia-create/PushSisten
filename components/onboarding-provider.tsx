'use client';

import { createContext, useContext, ReactNode } from 'react';
import { useOnboarding, OnboardingProgress, OnboardingStep } from '@/hooks/use-onboarding';

interface OnboardingContextType {
  progress: OnboardingProgress | null;
  isLoading: boolean;
  isOnboarding: boolean;
  currentStep: OnboardingStep | null;
  start: () => Promise<void>;
  updateProfile: (data: { storeName: string; storeType: string; currentControl: string }) => Promise<void>;
  markProductCreated: () => Promise<void>;
  markCustomerCreated: () => Promise<void>;
  markSaleCompleted: () => Promise<void>;
  markDashboardViewed: () => Promise<void>;
  complete: () => Promise<void>;
  abandon: () => Promise<void>;
  resume: () => Promise<void>;
}

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
    // Fallback silencioso: retorna no-op sem quebrar a renderização.
    // Isso protege contra cenários onde o componente é renderizado
    // fora da árvore do Provider (SSR, edge cases, etc).
    return {
      progress: null,
      isLoading: false,
      isOnboarding: false,
      currentStep: null,
      start: async () => {},
      updateProfile: async () => {},
      markProductCreated: async () => {},
      markCustomerCreated: async () => {},
      markSaleCompleted: async () => {},
      markDashboardViewed: async () => {},
      complete: async () => {},
      abandon: async () => {},
      resume: async () => {},
    };
  }
  return ctx;
}
