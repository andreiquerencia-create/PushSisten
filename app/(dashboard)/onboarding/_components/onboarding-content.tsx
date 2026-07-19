'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useOnboardingContext } from '@/components/onboarding-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const STORE_TYPES = [
  { value: 'moda_feminina', label: 'Moda Feminina' },
  { value: 'moda_masculina', label: 'Moda Masculina' },
  { value: 'moda_infantil', label: 'Moda Infantil' },
  { value: 'fitness', label: 'Moda Fitness' },
  { value: 'plus_size', label: 'Moda Plus Size' },
  { value: 'boutique', label: 'Boutique' },
  { value: 'multimarcas', label: 'Multimarcas' },
  { value: 'outro', label: 'Outro' },
];

const CONTROL_OPTIONS = [
  { value: 'caderno', label: 'Caderno' },
  { value: 'excel', label: 'Excel' },
  { value: 'outro_sistema', label: 'Outro sistema' },
  { value: 'nao_controlo', label: 'Não controlo' },
];

export function OnboardingContent() {
  const router = useRouter();
  const { progress, isOnboarding, currentStep, start, updateProfile, abandon } = useOnboardingContext();

  const [phase, setPhase] = useState<'welcome' | 'profile' | 'transition'>(
    progress?.profileCompleted ? 'transition' : progress?.currentStep === 'profile' ? 'profile' : 'welcome'
  );

  // Profile form state
  const [storeName, setStoreName] = useState(progress?.storeName || '');
  const [storeType, setStoreType] = useState(progress?.storeType || '');
  const [currentControl, setCurrentControl] = useState(progress?.currentControl || '');
  const [saving, setSaving] = useState(false);

  const handleStart = async () => {
    await start();
    setPhase('profile');
  };

  const handleSkip = async () => {
    await abandon();
    router.push('/dashboard');
  };

  const handleProfileSubmit = async () => {
    if (!storeName.trim()) return;
    setSaving(true);
    try {
      await updateProfile({ storeName: storeName.trim(), storeType, currentControl });
      setPhase('transition');
      // Aguarda animação e redireciona para cadastro de produto
      setTimeout(() => {
        router.push('/produtos?onboarding=true');
      }, 2000);
    } finally {
      setSaving(false);
    }
  };

  // Se onboarding já foi completado ou o step é posterior ao profile, redirecionar
  if (progress?.completed || progress?.currentStep === 'completed') {
    router.push('/hoje');
    return null;
  }

  if (progress?.currentStep === 'product') {
    router.push('/produtos?onboarding=true');
    return null;
  }
  if (progress?.currentStep === 'customer') {
    router.push('/clientes?onboarding=true');
    return null;
  }
  if (progress?.currentStep === 'sale') {
    router.push('/pdv?onboarding=true');
    return null;
  }
  if (progress?.currentStep === 'dashboard' || progress?.currentStep === 'next_steps') {
    router.push('/hoje');
    return null;
  }

  // ───── WELCOME ─────
  if (phase === 'welcome') {
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <div className="max-w-lg text-center space-y-8 px-6">
          <div className="space-y-4">
            <h1 className="text-3xl font-bold tracking-tight">
              Bem-vindo ao PushSisten.
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Agora vamos colocar sua loja para funcionar.
            </p>
            <p className="text-muted-foreground">
              Leva cerca de 3 minutos.
              <br />
              No final você fará sua primeira venda.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <Button size="lg" onClick={handleStart} className="text-base">
              Vamos começar
            </Button>
            <Button variant="ghost" size="sm" onClick={handleSkip} className="text-muted-foreground">
              Pular por enquanto
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ───── PROFILE (ETAPA 1) ─────
  if (phase === 'profile') {
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <div className="max-w-md w-full space-y-8 px-6">
          <div className="space-y-2">
            <h2 className="text-2xl font-bold">Vamos configurar sua loja</h2>
            <p className="text-muted-foreground">Três perguntas rápidas.</p>
          </div>

          <div className="space-y-6">
            {/* Nome da Loja */}
            <div className="space-y-2">
              <Label htmlFor="store-name">Como podemos chamar sua loja?</Label>
              <Input
                id="store-name"
                placeholder="Ex: Boutique Maria, Loja do Paulo..."
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                autoFocus
              />
            </div>

            {/* Tipo de Loja */}
            <div className="space-y-2">
              <Label>Qual tipo de loja você possui?</Label>
              <div className="grid grid-cols-2 gap-2">
                {STORE_TYPES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setStoreType(t.value)}
                    className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                      storeType === t.value
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border hover:border-primary/50 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Controle Atual */}
            <div className="space-y-2">
              <Label>Como você controla sua loja hoje?</Label>
              <div className="grid grid-cols-2 gap-2">
                {CONTROL_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setCurrentControl(opt.value)}
                    className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                      currentControl === opt.value
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border hover:border-primary/50 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <Button
              onClick={handleProfileSubmit}
              disabled={!storeName.trim() || saving}
              className="w-full"
              size="lg"
            >
              {saving ? 'Salvando...' : 'Continuar'}
            </Button>

            <Button variant="ghost" size="sm" onClick={handleSkip} className="w-full text-muted-foreground">
              Pular por enquanto
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ───── TRANSITION MESSAGE ─────
  return (
    <div className="flex items-center justify-center min-h-[80vh]">
      <div className="text-center space-y-4 px-6">
        <div className="text-4xl">✨</div>
        <h2 className="text-2xl font-bold">Perfeito.</h2>
        <p className="text-muted-foreground text-lg">Seu ambiente foi preparado.</p>
      </div>
    </div>
  );
}
