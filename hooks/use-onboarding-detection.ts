'use client';

import { useEffect, useCallback } from 'react';
import { useOnboardingContext } from '@/components/onboarding/provider';

/**
 * Hook de detecção automática de conclusão de etapas.
 * Chamado em pontos estratégicos do sistema para avançar o onboarding
 * quando o usuário executa a ação esperada.
 */
export function useOnboardingDetection() {
  const { state, isActive, currentStepConfig, advance } = useOnboardingContext();

  /**
   * Chama após criar um produto.
   * Se o step atual é 'product', avança automaticamente.
   */
  const detectProductCreated = useCallback(async () => {
    if (!isActive || !state) return;
    if (currentStepConfig?.key === 'product') {
      await advance();
    }
  }, [isActive, state, currentStepConfig, advance]);

  /**
   * Chama após criar um cliente.
   */
  const detectCustomerCreated = useCallback(async () => {
    if (!isActive || !state) return;
    if (currentStepConfig?.key === 'customer') {
      await advance();
    }
  }, [isActive, state, currentStepConfig, advance]);

  /**
   * Chama após criar/abrir caixa.
   */
  const detectCashOpened = useCallback(async () => {
    if (!isActive || !state) return;
    if (currentStepConfig?.key === 'cash_register') {
      await advance();
    }
  }, [isActive, state, currentStepConfig, advance]);

  /**
   * Chama após finalizar uma venda.
   */
  const detectSaleCompleted = useCallback(async () => {
    if (!isActive || !state) return;
    if (currentStepConfig?.key === 'first_sale') {
      await advance();
    }
  }, [isActive, state, currentStepConfig, advance]);

  /**
   * Chama após salvar configurações da empresa.
   */
  const detectCompanySaved = useCallback(async () => {
    if (!isActive || !state) return;
    if (currentStepConfig?.key === 'company') {
      await advance();
    }
  }, [isActive, state, currentStepConfig, advance]);

  /**
   * Chama após criar categoria.
   */
  const detectCategoryCreated = useCallback(async () => {
    if (!isActive || !state) return;
    if (currentStepConfig?.key === 'categories') {
      await advance();
    }
  }, [isActive, state, currentStepConfig, advance]);

  return {
    detectProductCreated,
    detectCustomerCreated,
    detectCashOpened,
    detectSaleCompleted,
    detectCompanySaved,
    detectCategoryCreated,
  };
}
