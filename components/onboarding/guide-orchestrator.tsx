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
 * Usa um ticker para detectar mudanças no DOM (ex: carrinho do PDV).
 */
export function GuideOrchestrator() {
  const pathname = usePathname();
  const router = useRouter();
  const { state, isActive, currentStepConfig, advance, skip } = useOnboardingContext();
  const [toast, setToast] = useState<{ message: string; visible: boolean }>({ message: '', visible: false });
  const [subStep, setSubStep] = useState(0); // Para etapas com múltiplos highlights (ex: PDV)
  const [tick, setTick] = useState(0); // Força re-render para detectar mudanças no DOM

  // Reset substep when main step changes
  useEffect(() => {
    setSubStep(0);
  }, [state?.currentStep]);

  // Ticker: re-render a cada 1.5s para detectar mudanças no DOM (ex: carrinho PDV)
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1500);
    return () => clearInterval(interval);
  }, []);

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
    // Não usar spotlight aqui — apenas mostrar o step card com "Tá bom assim"
    return (
      <ToastAchievement message={toast.message} visible={toast.visible} onHide={() => setToast(p => ({ ...p, visible: false }))} />
    );
  }

  // ─── ETAPA 3: Primeiro Produto ───
  if (stepKey === 'product' && pathname.startsWith('/produtos')) {
    // Detectar se o formulário de produto está aberto
    const formOpen = typeof document !== 'undefined' && !!document.querySelector('[role="dialog"], [class*="DialogContent"], form');

    if (!formOpen && subStep === 0) {
      // Form fechado: mostrar spotlight no botão "Novo Produto"
      return (
        <>
          <Spotlight target='[data-onboarding="new-product"]' active={true} />
          <OnboardingTooltip
            target='[data-onboarding="new-product"]'
            message='Clique em "Novo Produto" para cadastrar seu primeiro produto.'
            position="left"
            showSkip={false}
            active={true}
          />
          <ToastAchievement message={toast.message} visible={toast.visible} onHide={() => setToast(p => ({ ...p, visible: false }))} />
        </>
      );
    }

    // Form aberto: não mostrar nada (deixar o usuário preencher sem interferência)
    return (
      <ToastAchievement message={toast.message} visible={toast.visible} onHide={() => setToast(p => ({ ...p, visible: false }))} />
    );
  }

  // ─── ETAPA 4: Cliente ───
  if (stepKey === 'customer' && pathname.startsWith('/clientes')) {
    const clientFormOpen = typeof document !== 'undefined' && !!document.querySelector('[role="dialog"], [class*="DialogContent"]');

    if (clientFormOpen) {
      return <ToastAchievement message={toast.message} visible={toast.visible} onHide={() => setToast(p => ({ ...p, visible: false }))} />;
    }

    return (
      <>
        <Spotlight target='[data-onboarding="new-customer"]' active={true} />
        <OnboardingTooltip
          target='[data-onboarding="new-customer"]'
          message="Você pode cadastrar clientes agora ou durante as vendas. Se quiser, pode pular."
          position="left"
          actionLabel="Cadastrar cliente"
          onAction={() => {
            const btn = document.querySelector('[data-onboarding="new-customer"]') as HTMLElement;
            if (btn) btn.click();
          }}
          showSkip={true}
          onSkip={handleSkip}
          active={true}
        />
        <ToastAchievement message={toast.message} visible={toast.visible} onHide={() => setToast(p => ({ ...p, visible: false }))} />
      </>
    );
  }

  // ─── ETAPA 5: Caixa ───
  if (stepKey === 'cash_register' && pathname.startsWith('/caixas')) {
    return (
      <>
        <Spotlight target='[data-onboarding="open-cash"]' active={true} />
        <OnboardingTooltip
          target='[data-onboarding="open-cash"]'
          message="O caixa precisa estar aberto para registrar vendas. É como abrir a gaveta de manhã."
          position="left"
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
    // Detectar estado real do PDV
    const hasItemInCart = typeof document !== 'undefined' && (document.body.innerText.includes('item') || document.body.innerText.includes('itens')) && !document.body.innerText.includes('0 itens');
    const hasPaymentModal = typeof document !== 'undefined' && !!document.querySelector('[role="dialog"]');

    // Estado 1: Carrinho vazio → buscar produto
    if (!hasItemInCart && !hasPaymentModal) {
      return (
        <>
          <OnboardingTooltip
            target='input[placeholder*="Buscar produto"], input[placeholder*="produto"]'
            message="Busque o produto que você cadastrou."
            position="bottom"
            active={true}
          />
          <ToastAchievement message={toast.message} visible={toast.visible} onHide={() => setToast(p => ({ ...p, visible: false }))} />
        </>
      );
    }

    // Estado 2: Tem item no carrinho → indicar pagamento
    if (hasItemInCart && !hasPaymentModal) {
      return (
        <>
          <OnboardingTooltip
            target='button:has(svg)'
            message="Produto adicionado! Agora clique em Pagamento para escolher como o cliente vai pagar."
            position="top"
            active={false}
          />
          <ToastAchievement message={toast.message} visible={toast.visible} onHide={() => setToast(p => ({ ...p, visible: false }))} />
        </>
      );
    }

    // Estado 3: Modal de pagamento aberto → não interferir
    return (
      <ToastAchievement message={toast.message} visible={toast.visible} onHide={() => setToast(p => ({ ...p, visible: false }))} />
    );
  }

  // Default: just show the toast (for steps where user is not on correct route)
  return (
    <ToastAchievement message={toast.message} visible={toast.visible} onHide={() => setToast(p => ({ ...p, visible: false }))} />
  );
}
