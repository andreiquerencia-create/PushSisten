'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useOnboardingContext } from './provider';
import { Spotlight } from './spotlight';
import { OnboardingTooltip } from './tooltip';
import { ToastAchievement } from './toast-achievement';
import { OnboardingCelebration } from './celebration';
import { ACTIVATION_STEPS } from '@/lib/onboarding/steps';

/**
 * Orquestrador de guias do onboarding.
 * Renderiza Spotlight + Tooltip sobre as telas reais baseado no step atual.
 */
export function GuideOrchestrator() {
  const pathname = usePathname();
  const router = useRouter();
  const { state, isActive, currentStepConfig, advance, skip } = useOnboardingContext();
  const [toast, setToast] = useState<{ message: string; visible: boolean }>({ message: '', visible: false });
  const [subStep, setSubStep] = useState(0); // Para etapas com múltiplos highlights (ex: PDV)

  // Reset substep when main step changes
  useEffect(() => {
    setSubStep(0);
  }, [state?.currentStep]);

  if (!isActive || !state || !currentStepConfig) return null;

  // Show celebration
  if (currentStepConfig.key === 'celebration') {
    return <OnboardingCelebration />;
  }

  // Don't show guides on setup screen
  if (currentStepConfig.key === 'welcome') return null;

  const showToast = (message: string) => {
    setToast({ message, visible: true });
  };

  const handleAdvance = async () => {
    const stepTitle = currentStepConfig.title;
    await advance();
    showToast(`✓ ${stepTitle} concluída!`);
  };

  const handleSkip = async () => {
    await skip();
  };

  // ─── STEP GUIDES ───
  // Each step defines what to show based on the current pathname

  const stepKey = currentStepConfig.key;
  const isOnCorrectRoute = currentStepConfig.route && pathname.startsWith(currentStepConfig.route);

  // ─── ETAPA 1: Dados da Empresa ───
  if (stepKey === 'company' && pathname.startsWith('/configuracoes')) {
    return (
      <>
        <Spotlight target='input[id="company-name"], input[name="name"], #company-name-input, input[placeholder*="nome"]' active={true} />
        <OnboardingTooltip
          target='input[id="company-name"], input[name="name"], #company-name-input, input[placeholder*="nome"]'
          message="Esse nome aparece nos comprovantes dos seus clientes. Preencha e salve."
          position="right"
          actionLabel="Já salvei"
          onAction={handleAdvance}
          showSkip={true}
          onSkip={handleSkip}
          active={true}
        />
        <ToastAchievement message={toast.message} visible={toast.visible} onHide={() => setToast(p => ({ ...p, visible: false }))} />
      </>
    );
  }

  // ─── ETAPA 2: Categorias ───
  if (stepKey === 'categories' && pathname.startsWith('/categorias')) {
    return (
      <>
        <OnboardingTooltip
          target='button, [class*="card"]'
          message="Criamos categorias com base no que você vende. Pode editar, criar mais ou seguir em frente."
          position="bottom"
          actionLabel="Tá bom assim"
          onAction={handleAdvance}
          showSkip={true}
          onSkip={handleSkip}
          active={true}
        />
        <ToastAchievement message={toast.message} visible={toast.visible} onHide={() => setToast(p => ({ ...p, visible: false }))} />
      </>
    );
  }

  // ─── ETAPA 3: Primeiro Produto ───
  if (stepKey === 'product' && pathname.startsWith('/produtos')) {
    if (subStep === 0) {
      return (
        <>
          <Spotlight target='[data-onboarding="new-product"]' active={true} />
          <OnboardingTooltip
            target='[data-onboarding="new-product"]'
            message='Clique em "Novo Produto" para cadastrar seu primeiro produto. Só precisa de nome e preço.'
            position="left"
            showSkip={false}
            active={true}
          />
          <ToastAchievement message={toast.message} visible={toast.visible} onHide={() => setToast(p => ({ ...p, visible: false }))} />
        </>
      );
    }
    return (
      <ToastAchievement message={toast.message} visible={toast.visible} onHide={() => setToast(p => ({ ...p, visible: false }))} />
    );
  }

  // ─── ETAPA 4: Cliente ───
  if (stepKey === 'customer' && pathname.startsWith('/clientes')) {
    return (
      <>
        <OnboardingTooltip
          target='button, [data-onboarding="new-customer"]'
          message="Você pode cadastrar clientes agora ou durante as vendas. Se quiser, pode pular."
          position="bottom"
          actionLabel="Cadastrar cliente"
          onAction={() => setSubStep(1)}
          showSkip={true}
          onSkip={handleSkip}
          active={subStep === 0}
        />
        <ToastAchievement message={toast.message} visible={toast.visible} onHide={() => setToast(p => ({ ...p, visible: false }))} />
      </>
    );
  }

  // ─── ETAPA 5: Caixa ───
  if (stepKey === 'cash_register' && pathname.startsWith('/caixas')) {
    return (
      <>
        <OnboardingTooltip
          target='button, [data-onboarding="open-cash"]'
          message="O caixa precisa estar aberto para registrar vendas. É como abrir a gaveta de manhã."
          position="bottom"
          actionLabel="Já abri o caixa"
          onAction={handleAdvance}
          showSkip={true}
          onSkip={handleSkip}
          active={true}
        />
        <ToastAchievement message={toast.message} visible={toast.visible} onHide={() => setToast(p => ({ ...p, visible: false }))} />
      </>
    );
  }

  // ─── ETAPA 6: Primeira Venda (PDV) ───
  if (stepKey === 'first_sale' && pathname.startsWith('/pdv')) {
    const pdvMessages = [
      { target: 'input[placeholder*="Buscar produto"], input[placeholder*="produto"]', message: 'Busque o produto que você cadastrou.', position: 'bottom' as const },
      { target: '[class*="payment"], button:has(svg)', message: 'Clique em "Pagamento" para escolher como o cliente vai pagar.', position: 'left' as const },
      { target: 'button', message: 'Clique em "Finalizar Venda" para concluir!', position: 'top' as const },
    ];

    const currentPdvStep = Math.min(subStep, pdvMessages.length - 1);
    const msg = pdvMessages[currentPdvStep];

    return (
      <>
        <OnboardingTooltip
          target={msg.target}
          message={msg.message}
          position={msg.position}
          active={true}
        />
        <ToastAchievement message={toast.message} visible={toast.visible} onHide={() => setToast(p => ({ ...p, visible: false }))} />
      </>
    );
  }

  // Default: just show the toast (for steps where user is not on correct route)
  return (
    <ToastAchievement message={toast.message} visible={toast.visible} onHide={() => setToast(p => ({ ...p, visible: false }))} />
  );
}
