'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { OnboardingState, OnboardingPhase, OnboardingStatus, OnboardingMetadata } from '@/lib/onboarding/types';
import { ACTIVATION_STEPS, getStepsForPhase } from '@/lib/onboarding/steps';

interface UseOnboardingReturn {
  state: OnboardingState | null;
  isLoading: boolean;
  isActive: boolean;
  currentStepConfig: (typeof ACTIVATION_STEPS)[number] | null;
  totalSteps: number;
  progressPercent: number;
  advance: () => Promise<void>;
  skip: () => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  complete: () => Promise<void>;
  startOnboarding: (metadata: OnboardingMetadata) => Promise<void>;
  updateState: (data: Partial<OnboardingState>) => Promise<void>;
}

export function useOnboarding(): UseOnboardingReturn {
  const { data: session, status: sessionStatus } = useSession();
  const [state, setState] = useState<OnboardingState | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (sessionStatus === 'loading') return;
    if (!session?.user) {
      setIsLoading(false);
      return;
    }

    fetch('/api/onboarding-state')
      .then(res => res.json())
      .then(data => setState(data.state || null))
      .catch(err => console.error('[onboarding] fetch error:', err))
      .finally(() => setIsLoading(false));
  }, [session?.user, sessionStatus]);

  const updateState = useCallback(async (data: Partial<OnboardingState>) => {
    const res = await fetch('/api/onboarding-state', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      const result = await res.json();
      setState(result.state);
    }
  }, []);

  const isActive = !!(state && state.status === 'active');
  const steps = state ? getStepsForPhase(state.phase) : ACTIVATION_STEPS;
  const currentStepConfig = isActive && state ? steps[state.currentStep] || null : null;
  const totalSteps = steps.length;
  const completedCount = state ? (state.completedSteps as string[]).length : 0;
  const progressPercent = totalSteps > 0 ? Math.round((completedCount / totalSteps) * 100) : 0;

  const advance = useCallback(async () => {
    if (!state) return;
    const steps = getStepsForPhase(state.phase);
    const currentKey = steps[state.currentStep]?.key;
    const newCompleted = [...(state.completedSteps as string[]), currentKey].filter(Boolean);
    const nextStep = state.currentStep + 1;

    if (nextStep >= steps.length) {
      await updateState({
        completedSteps: newCompleted,
        currentStep: nextStep,
        status: 'completed' as OnboardingStatus,
        completedAt: new Date().toISOString(),
      } as any);
    } else {
      await updateState({
        completedSteps: newCompleted,
        currentStep: nextStep,
      } as any);
    }
  }, [state, updateState]);

  const skip = useCallback(async () => {
    if (!state) return;
    const steps = getStepsForPhase(state.phase);
    const currentKey = steps[state.currentStep]?.key;
    const newSkipped = [...(state.skippedSteps as string[]), currentKey].filter(Boolean);
    const nextStep = state.currentStep + 1;

    if (nextStep >= steps.length) {
      await updateState({
        skippedSteps: newSkipped,
        currentStep: nextStep,
        status: 'completed' as OnboardingStatus,
        completedAt: new Date().toISOString(),
      } as any);
    } else {
      await updateState({
        skippedSteps: newSkipped,
        currentStep: nextStep,
      } as any);
    }
  }, [state, updateState]);

  const pause = useCallback(async () => {
    await updateState({ status: 'paused' as OnboardingStatus, pausedAt: new Date().toISOString() } as any);
  }, [updateState]);

  const resume = useCallback(async () => {
    await updateState({ status: 'active' as OnboardingStatus, pausedAt: null } as any);
  }, [updateState]);

  const complete = useCallback(async () => {
    await updateState({
      status: 'completed' as OnboardingStatus,
      completedAt: new Date().toISOString(),
    } as any);
  }, [updateState]);

  const startOnboarding = useCallback(async (metadata: OnboardingMetadata) => {
    await updateState({
      phase: 'activation' as OnboardingPhase,
      currentStep: 1,
      status: 'active' as OnboardingStatus,
      metadata,
      completedSteps: ['welcome'],
    } as any);
  }, [updateState]);

  return {
    state,
    isLoading,
    isActive,
    currentStepConfig,
    totalSteps,
    progressPercent,
    advance,
    skip,
    pause,
    resume,
    complete,
    startOnboarding,
    updateState,
  };
}
