export type OnboardingPhase = 'activation' | 'financial' | 'completed';

export type OnboardingStatus = 'active' | 'paused' | 'completed' | 'skipped';

export type StepKey =
  | 'welcome'
  | 'company'
  | 'categories'
  | 'product'
  | 'customer'
  | 'cash_register'
  | 'first_sale'
  | 'celebration';

export type FinancialStepKey =
  | 'caixas'
  | 'recebimentos'
  | 'fornecedores'
  | 'plano_contas'
  | 'fluxo_caixa'
  | 'dre'
  | 'ia_gerente';

export interface StepDefinition {
  id: number;
  key: StepKey | FinancialStepKey;
  title: string;
  description: string;
  route: string | null;
  duration: string;
  skippable: boolean;
  essential: boolean;
  detection: DetectionRule | null;
}

export interface DetectionRule {
  type: 'entity_exists' | 'field_filled' | 'session_active' | 'manual';
  entity?: string;
  min?: number;
  fields?: string[];
  status?: string;
}

export interface OnboardingState {
  id: string;
  userId: string;
  phase: OnboardingPhase;
  currentStep: number;
  status: OnboardingStatus;
  completedSteps: string[];
  skippedSteps: string[];
  metadata: OnboardingMetadata;
  startedAt: string;
  completedAt: string | null;
  pausedAt: string | null;
  lastStepAt: string;
}

export interface OnboardingMetadata {
  storeName?: string;
  segments?: string[];
  controlMethod?: string;
}
