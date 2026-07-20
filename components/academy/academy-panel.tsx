'use client';

import { useAcademy } from './academy-context';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ChevronRight, ChevronLeft, X, GraduationCap, CheckCircle2 } from 'lucide-react';

/**
 * Painel lateral fixo do Push Academy.
 * Renderizado no layout principal — aparece em qualquer rota quando o Academy está ativo.
 */
export function AcademyPanel() {
  const { state, nextStep, prevStep, exitAcademy, getCurrentInstruction } = useAcademy();
  const router = useRouter();

  if (!state.isActive || !state.module) return null;

  const currentInstruction = getCurrentInstruction();
  if (!currentInstruction) return null;

  const progressPercent = state.totalSteps > 0 ? Math.round(((state.currentStep + 1) / state.totalSteps) * 100) : 0;
  const isLastStep = state.currentStep >= state.totalSteps - 1;
  const isFirstStep = state.currentStep === 0;
  const isCelebration = currentInstruction.instruction.startsWith('✅') || currentInstruction.instruction.startsWith('🎉');

  const handleNext = () => {
    // Se o próximo step tem rota, navegar primeiro
    const allSteps = state.module!.submodules.flatMap(sub => sub.steps.map(step => ({ ...step, submoduleTitle: sub.title })));
    const nextStepData = allSteps[state.currentStep + 1];

    nextStep();

    if (isLastStep) {
      router.push('/push-academy');
    } else if (nextStepData?.route) {
      router.push(nextStepData.route);
    }
  };

  const handlePrev = () => {
    const allSteps = state.module!.submodules.flatMap(sub => sub.steps.map(step => ({ ...step, submoduleTitle: sub.title })));
    const prevStepData = allSteps[state.currentStep - 1];

    prevStep();

    if (prevStepData?.route) {
      router.push(prevStepData.route);
    }
  };

  const handleExit = () => {
    exitAcademy();
    router.push('/push-academy');
  };

  return (
    <div className="fixed top-0 right-0 bottom-0 w-80 z-[100] flex flex-col bg-card border-l border-border shadow-2xl animate-in slide-in-from-right-4 duration-300">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-gradient-to-r from-primary/5 to-accent/5">
        <div className="flex items-center gap-2">
          <GraduationCap className="w-4 h-4 text-primary" />
          <span className="text-xs font-semibold text-primary">Push Academy</span>
        </div>
        <button
          onClick={handleExit}
          className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          title="Sair do treinamento"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Module info */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg">{state.module.icon}</span>
          <h3 className="text-sm font-semibold text-foreground">{state.module.title}</h3>
        </div>
        <p className="text-[11px] text-muted-foreground">{currentInstruction.submoduleTitle}</p>
      </div>

      {/* Progress bar */}
      <div className="px-4 pb-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] text-muted-foreground">
            Passo {state.currentStep + 1} de {state.totalSteps}
          </span>
          <span className="text-[10px] font-medium text-primary">{progressPercent}%</span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Instruction */}
      <div className="flex-1 px-4 py-4 overflow-y-auto">
        <div className={`rounded-xl p-4 ${
          isCelebration
            ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800'
            : 'bg-muted/50 border border-border'
        }`}>
          {isCelebration && (
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span className="text-xs font-semibold text-emerald-600">Concluído!</span>
            </div>
          )}
          <p className="text-sm text-foreground leading-relaxed">
            {currentInstruction.instruction}
          </p>
        </div>
      </div>

      {/* Navigation buttons */}
      <div className="p-4 border-t border-border bg-card">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrev}
            disabled={isFirstStep}
            className="flex-1 text-xs h-9"
          >
            <ChevronLeft className="w-3.5 h-3.5 mr-1" />
            Voltar
          </Button>
          <Button
            size="sm"
            onClick={handleNext}
            className={`flex-1 text-xs h-9 ${
              isLastStep ? 'bg-emerald-600 hover:bg-emerald-700' : ''
            }`}
          >
            {isLastStep ? 'Concluir' : 'Próximo'}
            <ChevronRight className="w-3.5 h-3.5 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}
