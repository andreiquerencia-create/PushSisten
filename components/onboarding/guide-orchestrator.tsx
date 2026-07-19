'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useOnboardingContext } from './provider';
import { Spotlight } from './spotlight';
import { OnboardingTooltip } from './tooltip';
import { ToastAchievement } from './toast-achievement';
import { OnboardingCelebration } from './celebration';

/**
 * Orquestrador de guias do onboarding.
 * Renderiza Spotlight + Tooltip sobre as telas reais baseado no step atual.
 */
export function GuideOrchestrator() {
  const pathname = usePathname();
  const { state, isActive, currentStepConfig, advance, skip } = useOnboardingContext();
  const [toast, setToast] = useState<{ message: string; visible: boolean }>({ message: '', visible: false });
  const [pdvStep, setPdvStep] = useState(0); // 0=produto, 1=cliente, 2=pagamento

  // Reset PDV step when main step changes
  useEffect(() => {
    setPdvStep(0);
  }, [state?.currentStep]);

  // Detectar mudanças no carrinho do PDV
  useEffect(() => {
    if (!isActive || currentStepConfig?.key !== 'first_sale' || !pathname.startsWith('/pdv')) return;

    const checkCart = () => {
      const text = document.body.innerText;
      const hasItem = text.includes('1 item') || text.includes('2 ite') || text.includes('3 ite') || (text.includes('itens') && !text.includes('0 itens'));
      if (hasItem && pdvStep === 0) {
        setPdvStep(1); // Avançar para selecionar cliente
      }
    };

    const interval = setInterval(checkCart, 1500);
    return () => clearInterval(interval);
  }, [isActive, currentStepConfig?.key, pathname, pdvStep]);

  if (!isActive || !state || !currentStepConfig) return null;

  // Celebração
  if (currentStepConfig.key === 'celebration') {
    return <OnboardingCelebration />;
  }

  // Setup screen — sem guias
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

  const stepKey = currentStepConfig.key;

  // ─── ETAPA 1: Dados da Empresa ───
  if (stepKey === 'company' && pathname.startsWith('/configuracoes')) {
    return (
      <>
        <OnboardingTooltip
          target='input[id="company-name"], input[name="name"], input[placeholder*="nome"]'
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
      <ToastAchievement message={toast.message} visible={toast.visible} onHide={() => setToast(p => ({ ...p, visible: false }))} />
    );
  }

  // ─── ETAPA 3: Primeiro Produto ───
  if (stepKey === 'product' && pathname.startsWith('/produtos')) {
    const formOpen = typeof document !== 'undefined' && !!document.querySelector('[role="dialog"], [class*="DialogContent"]');

    if (!formOpen) {
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

    return <ToastAchievement message={toast.message} visible={toast.visible} onHide={() => setToast(p => ({ ...p, visible: false }))} />;
  }

  // ─── ETAPA 4: Cliente ───
  if (stepKey === 'customer' && pathname.startsWith('/clientes')) {
    const formOpen = typeof document !== 'undefined' && !!document.querySelector('[role="dialog"], [class*="DialogContent"]');

    if (!formOpen) {
      return (
        <>
          <Spotlight target='[data-onboarding="new-customer"]' active={true} />
          <OnboardingTooltip
            target='[data-onboarding="new-customer"]'
            message="Cadastre um cliente ou pule para o próximo passo."
            position="left"
            actionLabel="Cadastrar"
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

    return <ToastAchievement message={toast.message} visible={toast.visible} onHide={() => setToast(p => ({ ...p, visible: false }))} />;
  }

  // ─── ETAPA 5: Caixa ───
  if (stepKey === 'cash_register' && pathname.startsWith('/caixas')) {
    return (
      <>
        <Spotlight target='[data-onboarding="open-cash"]' active={true} />
        <OnboardingTooltip
          target='[data-onboarding="open-cash"]'
          message="Abra o caixa para começar a vender."
          position="left"
          actionLabel="Já abri"
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
    const hasPaymentModal = typeof document !== 'undefined' && !!document.querySelector('[role="dialog"], [class*="DialogContent"]');

    // Modal aberto → não interferir
    if (hasPaymentModal) {
      return <ToastAchievement message={toast.message} visible={toast.visible} onHide={() => setToast(p => ({ ...p, visible: false }))} />;
    }

    // Passo 0: Buscar produto
    if (pdvStep === 0) {
      return (
        <>
          <OnboardingTooltip
            target='input[placeholder*="Buscar produto"], input[placeholder*="produto"]'
            message="Busque e selecione o produto que você cadastrou."
            position="bottom"
            active={true}
          />
          <ToastAchievement message={toast.message} visible={toast.visible} onHide={() => setToast(p => ({ ...p, visible: false }))} />
        </>
      );
    }

    // Passo 1: Selecionar cliente
    if (pdvStep === 1) {
      return (
        <>
          <OnboardingTooltip
            target='input[placeholder*="cliente"], input[placeholder*="Buscar clie"]'
            message="Selecione um cliente ou pule direto para o pagamento."
            position="left"
            actionLabel="Pular → Pagamento"
            onAction={() => setPdvStep(2)}
            active={true}
          />
          <ToastAchievement message={toast.message} visible={toast.visible} onHide={() => setToast(p => ({ ...p, visible: false }))} />
        </>
      );
    }

    // Passo 2: Clicar pagamento
    if (pdvStep === 2) {
      return (
        <>
          <OnboardingTooltip
            target='button'
            message="Clique em Pagamento para finalizar a venda."
            position="top"
            active={true}
          />
          <ToastAchievement message={toast.message} visible={toast.visible} onHide={() => setToast(p => ({ ...p, visible: false }))} />
        </>
      );
    }

    return <ToastAchievement message={toast.message} visible={toast.visible} onHide={() => setToast(p => ({ ...p, visible: false }))} />;
  }

  // Default
  return <ToastAchievement message={toast.message} visible={toast.visible} onHide={() => setToast(p => ({ ...p, visible: false }))} />;
}
