'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { useOnboardingContext } from './provider';
import { CheckCircle2, Rocket, ArrowRight } from 'lucide-react';

export function OnboardingCelebration() {
  const { state, complete } = useOnboardingContext();
  const router = useRouter();
  const [timeSpent, setTimeSpent] = useState('');
  const [confetti, setConfetti] = useState(true);

  useEffect(() => {
    if (state?.startedAt) {
      const start = new Date(state.startedAt).getTime();
      const now = Date.now();
      const minutes = Math.round((now - start) / 60000);
      setTimeSpent(minutes <= 1 ? 'menos de 1 minuto' : `${minutes} minutos`);
    }

    // Remove confetti after 3s
    const timer = setTimeout(() => setConfetti(false), 3000);
    return () => clearTimeout(timer);
  }, [state]);

  const handleFinish = async () => {
    await complete();
    router.push('/hoje');
  };

  const completedSteps = (state?.completedSteps as string[]) || [];

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/80 backdrop-blur-sm animate-in fade-in duration-500">
      {/* Confetti particles */}
      {confetti && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {Array.from({ length: 40 }).map((_, i) => (
            <div
              key={i}
              className="absolute w-2 h-2 rounded-full animate-bounce"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'][i % 6],
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${1 + Math.random() * 2}s`,
                opacity: 0.8,
              }}
            />
          ))}
        </div>
      )}

      {/* Content */}
      <div className="relative max-w-md w-full mx-4 animate-in zoom-in-95 slide-in-from-bottom-4 duration-500">
        <div className="bg-card border border-border rounded-3xl p-8 shadow-2xl text-center">
          {/* Icon */}
          <div className="mb-6">
            <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
              <Rocket className="w-9 h-9 text-white" />
            </div>
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold text-foreground mb-2">
            Sua loja está funcionando!
          </h1>
          <p className="text-muted-foreground mb-6">
            Você configurou tudo em {timeSpent}.
            <br />
            A partir de agora, é só vender.
          </p>

          {/* Achievements */}
          <div className="bg-muted/50 rounded-xl p-4 mb-6 text-left space-y-2">
            {completedSteps.includes('company') && (
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                <span className="text-foreground">Empresa configurada</span>
              </div>
            )}
            {completedSteps.includes('categories') && (
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                <span className="text-foreground">Categorias criadas</span>
              </div>
            )}
            {completedSteps.includes('product') && (
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                <span className="text-foreground">Produtos cadastrados</span>
              </div>
            )}
            {completedSteps.includes('first_sale') && (
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                <span className="text-foreground">Primeira venda realizada</span>
              </div>
            )}
          </div>

          {/* CTA */}
          <Button
            size="lg"
            onClick={handleFinish}
            className="w-full text-base h-12 rounded-xl gap-2 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 shadow-lg"
          >
            Usar minha loja
            <ArrowRight className="w-4.5 h-4.5" />
          </Button>

          {/* Secondary info */}
          <p className="text-xs text-muted-foreground mt-4">
            Depois você pode aprender sobre o financeiro.
            <br />
            Quando quiser, é só acessar nas configurações.
          </p>
        </div>
      </div>
    </div>
  );
}
