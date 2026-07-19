'use client';

import { useState } from 'react';
import { useOnboardingContext } from './provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sparkles, Store, CheckCircle2, Loader2 } from 'lucide-react';

const SEGMENTS = [
  { value: 'roupas', label: 'Roupas', emoji: '👗' },
  { value: 'calcados', label: 'Calçados', emoji: '👟' },
  { value: 'acessorios', label: 'Acessórios', emoji: '💍' },
  { value: 'cosmeticos', label: 'Cosméticos', emoji: '💄' },
  { value: 'feminino', label: 'Feminino', emoji: '👩' },
  { value: 'masculino', label: 'Masculino', emoji: '👨' },
  { value: 'infantil', label: 'Infantil', emoji: '👶' },
  { value: 'bazar', label: 'Bazar', emoji: '🏪' },
  { value: 'variedades', label: 'Variedades', emoji: '📦' },
  { value: 'outro', label: 'Outro', emoji: '✨' },
];

const CONTROL_METHODS = [
  { value: 'caderno', label: 'Caderno', emoji: '📓' },
  { value: 'planilha', label: 'Planilha', emoji: '📊' },
  { value: 'sistema', label: 'Sistema', emoji: '💻' },
  { value: 'nao_controlo', label: 'Não controlo', emoji: '🤷' },
  { value: 'outro', label: 'Outro', emoji: '📋' },
];

interface SetupScreenProps {
  onComplete: () => void;
}

export function SetupScreen({ onComplete }: SetupScreenProps) {
  const { startOnboarding } = useOnboardingContext();

  const [storeName, setStoreName] = useState('');
  const [segments, setSegments] = useState<string[]>([]);
  const [control, setControl] = useState('');
  const [phase, setPhase] = useState<'form' | 'loading'>('form');
  const [loadingItems, setLoadingItems] = useState<string[]>([]);

  const toggleSegment = (value: string) => {
    setSegments(prev =>
      prev.includes(value) ? prev.filter(s => s !== value) : [...prev, value]
    );
  };

  const canSubmit = storeName.trim().length > 0 && segments.length > 0 && control.length > 0;

  const handleSubmit = async () => {
    if (!canSubmit) return;

    setPhase('loading');

    // Simulate progress animation
    const items = [
      'Nome atualizado',
      'Categorias criadas',
      'Caixa configurado',
      'Formas de pagamento prontas',
      'Ambiente personalizado',
    ];

    for (let i = 0; i < items.length; i++) {
      await new Promise(r => setTimeout(r, 400));
      setLoadingItems(prev => [...prev, items[i]]);
    }

    // Call setup API to create categories and start onboarding
    await fetch('/api/onboarding-state/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storeName: storeName.trim(),
        segments,
        controlMethod: control,
      }),
    });

    await new Promise(r => setTimeout(r, 800));
    onComplete();
  };

  // ─── LOADING PHASE ───
  if (phase === 'loading') {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background">
        <div className="max-w-sm w-full mx-4 text-center">
          <div className="mb-8">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <Sparkles className="w-7 h-7 text-primary animate-pulse" />
            </div>
            <h2 className="text-xl font-bold text-foreground">Preparando sua loja...</h2>
          </div>

          <div className="space-y-3 text-left">
            {loadingItems.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center gap-3 animate-in slide-in-from-left-2 fade-in duration-300"
                style={{ animationDelay: `${idx * 100}ms` }}
              >
                <CheckCircle2 className="w-4.5 h-4.5 text-emerald-500 flex-shrink-0" />
                <span className="text-sm text-foreground">{item}</span>
              </div>
            ))}
            {loadingItems.length < 5 && (
              <div className="flex items-center gap-3">
                <Loader2 className="w-4.5 h-4.5 text-primary animate-spin flex-shrink-0" />
                <span className="text-sm text-muted-foreground">Configurando...</span>
              </div>
            )}
          </div>

          {/* Progress bar */}
          <div className="mt-8">
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all duration-500"
                style={{ width: `${(loadingItems.length / 5) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── FORM PHASE ───
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background overflow-y-auto">
      <div className="max-w-lg w-full mx-4 py-12">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
            <Store className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">
            Em menos de 10 minutos sua loja estará funcionando.
          </h1>
          <p className="text-muted-foreground mt-2">
            Responda 3 perguntas e vamos personalizar tudo pra você.
          </p>
        </div>

        <div className="space-y-8">
          {/* 1. Store Name */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Como se chama sua loja?
            </label>
            <Input
              placeholder="Ex: Moda Fashion, Atacado Maria..."
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              className="h-12 text-base rounded-xl"
              autoFocus
            />
          </div>

          {/* 2. Segments */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              O que você vende?
              <span className="text-muted-foreground font-normal ml-1">(pode marcar mais de uma)</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {SEGMENTS.map((seg) => (
                <button
                  key={seg.value}
                  type="button"
                  onClick={() => toggleSegment(seg.value)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all duration-200 ${
                    segments.includes(seg.value)
                      ? 'border-primary bg-primary/10 text-primary scale-[1.02] shadow-sm'
                      : 'border-border hover:border-primary/40 text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
                >
                  <span className="text-base">{seg.emoji}</span>
                  {seg.label}
                </button>
              ))}
            </div>
          </div>

          {/* 3. Control Method */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Como controla seu negócio hoje?
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {CONTROL_METHODS.map((method) => (
                <button
                  key={method.value}
                  type="button"
                  onClick={() => setControl(method.value)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all duration-200 ${
                    control === method.value
                      ? 'border-primary bg-primary/10 text-primary scale-[1.02] shadow-sm'
                      : 'border-border hover:border-primary/40 text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
                >
                  <span className="text-base">{method.emoji}</span>
                  {method.label}
                </button>
              ))}
            </div>
          </div>

          {/* Submit */}
          <div className="pt-4">
            <Button
              size="lg"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="w-full h-12 text-base rounded-xl gap-2 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Preparar minha loja
              <Sparkles className="w-4 h-4" />
            </Button>
          </div>

          {/* Progress indicator */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-2">
              <div className="h-1.5 w-24 bg-muted rounded-full overflow-hidden">
                <div className="h-full w-[12%] bg-primary rounded-full" />
              </div>
              <span className="text-xs text-muted-foreground">Passo 1 de 8</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
