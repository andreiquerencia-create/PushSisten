'use client';

import { useAcademy } from './academy-context';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ChevronRight, ChevronLeft, X, GraduationCap, CheckCircle2, Sparkles } from 'lucide-react';

/**
 * Painel lateral fixo do Push Academy.
 * Mostra cabeçalho destacado + texto completo da instrução.
 * Um "Próximo" = uma tela/tarefa inteira.
 */
export function AcademyPanel() {
  const { state, nextStep, prevStep, exitAcademy } = useAcademy();
  const router = useRouter();

  if (!state.isActive || !state.module) return null;

  const currentStepData = state.module.steps[state.currentStep];
  if (!currentStepData) return null;

  const progressPercent = state.totalSteps > 0 ? Math.round(((state.currentStep + 1) / state.totalSteps) * 100) : 0;
  const isLastStep = state.currentStep >= state.totalSteps - 1;
  const isFirstStep = state.currentStep === 0;
  const isCelebration = currentStepData.celebration;

  const handleNext = () => {
    if (isLastStep) {
      nextStep(); // marca como concluído
      router.push('/push-academy');
      return;
    }

    // Avançar e navegar para próxima rota
    const nextStepData = state.module!.steps[state.currentStep + 1];
    nextStep();

    if (nextStepData?.route) {
      router.push(nextStepData.route);
    }
  };

  const handlePrev = () => {
    if (isFirstStep) return;
    const prevStepData = state.module!.steps[state.currentStep - 1];
    prevStep();

    if (prevStepData?.route) {
      router.push(prevStepData.route);
    }
  };

  const handleExit = () => {
    exitAcademy();
    router.push('/push-academy');
  };

  // Formatar texto com quebras de linha
  const formatBody = (text: string) => {
    return text.split('\n').map((line, i) => (
      <span key={i} className="block mb-1">
        {line}
      </span>
    ));
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

      {/* Module + progress */}
      <div className="px-4 pt-3 pb-2">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg">{state.module.icon}</span>
          <span className="text-xs text-muted-foreground font-medium">{state.module.title}</span>
        </div>
        <div className="flex items-center justify-between mb-1">
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

      {/* Step content: título destacado + corpo */}
      <div className="flex-1 px-4 py-3 overflow-y-auto">
        {/* Título destacado */}
        <div className={`rounded-lg px-3 py-2 mb-3 ${
          isCelebration
            ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800'
            : 'bg-primary/5 border border-primary/20'
        }`}>
          <div className="flex items-center gap-2">
            {isCelebration ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            ) : (
              <Sparkles className="w-4 h-4 text-primary flex-shrink-0" />
            )}
            <h4 className={`text-sm font-semibold ${
              isCelebration ? 'text-emerald-700 dark:text-emerald-400' : 'text-primary'
            }`}>
              {currentStepData.title}
            </h4>
          </div>
        </div>

        {/* Corpo do texto */}
        <div className="text-sm text-foreground/80 leading-relaxed space-y-1">
          {formatBody(currentStepData.body)}
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
            {isLastStep ? 'Concluir 🎉' : 'Próximo'}
            <ChevronRight className="w-3.5 h-3.5 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}
