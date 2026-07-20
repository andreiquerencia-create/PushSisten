'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { getModuleById, getTotalStepsForModule, AcademyModule } from '@/lib/academy/modules';

interface AcademyState {
  isActive: boolean;
  moduleId: string | null;
  currentStep: number;
  totalSteps: number;
  module: AcademyModule | null;
}

interface AcademyContextType {
  state: AcademyState;
  startModule: (moduleId: string, fromStep?: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  exitAcademy: () => void;
}

const AcademyContext = createContext<AcademyContextType | null>(null);

export function AcademyProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AcademyState>({
    isActive: false,
    moduleId: null,
    currentStep: 0,
    totalSteps: 0,
    module: null,
  });

  const startModule = useCallback((moduleId: string, fromStep = 0) => {
    const mod = getModuleById(moduleId);
    if (!mod) return;
    const totalSteps = getTotalStepsForModule(moduleId);
    setState({
      isActive: true,
      moduleId,
      currentStep: fromStep,
      totalSteps,
      module: mod,
    });

    fetch('/api/academy-progress', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ moduleId, currentStep: fromStep, totalSteps, status: 'in_progress' }),
    }).catch(console.error);
  }, []);

  const nextStep = useCallback(() => {
    setState(prev => {
      if (!prev.module) return prev;
      const next = prev.currentStep + 1;

      if (next >= prev.module.steps.length) {
        fetch('/api/academy-progress', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ moduleId: prev.moduleId, currentStep: next, totalSteps: prev.totalSteps, status: 'completed' }),
        }).catch(console.error);
        return { ...prev, isActive: false, moduleId: null, currentStep: 0, totalSteps: 0, module: null };
      }

      fetch('/api/academy-progress', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moduleId: prev.moduleId, currentStep: next, totalSteps: prev.totalSteps, status: 'in_progress' }),
      }).catch(console.error);

      return { ...prev, currentStep: next };
    });
  }, []);

  const prevStep = useCallback(() => {
    setState(prev => {
      if (prev.currentStep <= 0) return prev;
      const next = prev.currentStep - 1;

      fetch('/api/academy-progress', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moduleId: prev.moduleId, currentStep: next, totalSteps: prev.totalSteps, status: 'in_progress' }),
      }).catch(console.error);

      return { ...prev, currentStep: next };
    });
  }, []);

  const exitAcademy = useCallback(() => {
    setState(prev => {
      if (prev.moduleId && prev.currentStep > 0) {
        fetch('/api/academy-progress', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ moduleId: prev.moduleId, currentStep: prev.currentStep, totalSteps: prev.totalSteps, status: 'in_progress' }),
        }).catch(console.error);
      }
      return { isActive: false, moduleId: null, currentStep: 0, totalSteps: 0, module: null };
    });
  }, []);

  return (
    <AcademyContext.Provider value={{ state, startModule, nextStep, prevStep, exitAcademy }}>
      {children}
    </AcademyContext.Provider>
  );
}

export function useAcademy() {
  const ctx = useContext(AcademyContext);
  if (!ctx) throw new Error('useAcademy must be used within AcademyProvider');
  return ctx;
}
