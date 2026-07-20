'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getModuleById, getTotalStepsForModule } from '@/lib/academy/modules';
import { AcademyPanel } from '@/components/academy/academy-panel';

export default function AcademyModulePage() {
  const params = useParams();
  const router = useRouter();
  const moduleId = params.moduleId as string;
  const mod = getModuleById(moduleId);

  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(true);

  const totalSteps = mod ? getTotalStepsForModule(moduleId) : 0;

  // Carregar progresso salvo
  useEffect(() => {
    fetch('/api/academy-progress')
      .then(res => res.json())
      .then(data => {
        const p = (data.progress || []).find((item: any) => item.moduleId === moduleId);
        if (p && p.status === 'in_progress') {
          setCurrentStep(p.currentStep);
        }
      })
      .catch(err => console.error('Erro ao carregar progresso:', err))
      .finally(() => setLoading(false));
  }, [moduleId]);

  // Salvar progresso
  const saveProgress = async (step: number, status: string) => {
    await fetch('/api/academy-progress', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        moduleId,
        currentStep: step,
        totalSteps,
        status,
      }),
    });
  };

  // Obter step atual (flatten submodules)
  const getAllSteps = () => {
    if (!mod) return [];
    const steps: { instruction: string; route?: string; submoduleTitle: string }[] = [];
    mod.submodules.forEach(sub => {
      sub.steps.forEach(step => {
        steps.push({ ...step, submoduleTitle: sub.title });
      });
    });
    return steps;
  };

  const allSteps = getAllSteps();
  const currentStepData = allSteps[currentStep];

  // Navegação
  const handleNext = async () => {
    const nextStep = currentStep + 1;
    if (nextStep >= allSteps.length) {
      // Módulo concluído
      await saveProgress(nextStep, 'completed');
      router.push('/push-academy');
      return;
    }
    setCurrentStep(nextStep);
    await saveProgress(nextStep, 'in_progress');

    // Se o próximo step tem rota, navegar
    const nextStepData = allSteps[nextStep];
    if (nextStepData?.route) {
      router.push(nextStepData.route);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      const prevStep = currentStep - 1;
      setCurrentStep(prevStep);
      saveProgress(prevStep, 'in_progress');

      const prevStepData = allSteps[prevStep];
      if (prevStepData?.route) {
        router.push(prevStepData.route);
      }
    }
  };

  const handleExit = () => {
    saveProgress(currentStep, currentStep === 0 ? 'not_started' : 'in_progress');
    router.push('/push-academy');
  };

  // Iniciar módulo
  useEffect(() => {
    if (!loading && mod) {
      saveProgress(currentStep, 'in_progress');
      // Navegar para a rota do step atual
      if (currentStepData?.route) {
        router.push(currentStepData.route);
      }
    }
  }, [loading]);

  if (!mod) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground">Módulo não encontrado.</p>
      </div>
    );
  }

  if (loading) return null;

  return (
    <AcademyPanel
      moduleTitle={mod.title}
      moduleIcon={mod.icon}
      submoduleTitle={currentStepData?.submoduleTitle || ''}
      instruction={currentStepData?.instruction || ''}
      currentStep={currentStep}
      totalSteps={allSteps.length}
      onNext={handleNext}
      onPrev={handlePrev}
      onExit={handleExit}
    />
  );
}
