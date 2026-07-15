/**
 * DATA GUARDS — Validações de integridade de dados ANTES de gravar no banco.
 * 
 * Regras:
 * - Nunca modifica dados existentes
 * - Retorna { valid, errors[] } para que a API retorne 400 com mensagem clara
 * - Usado como camada de proteção ADICIONAL (não substitui validações que já existem)
 */

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

function fail(msgs: string[]): ValidationResult {
  return { valid: false, errors: msgs.filter(Boolean) };
}
function ok(): ValidationResult {
  return { valid: true, errors: [] };
}

// ==========================================
// VENDAS
// ==========================================
export function validateSaleData(data: {
  items?: any[];
  discount?: number;
  payments?: any[];
  total?: number;
  subtotal?: number;
}): ValidationResult {
  const errors: string[] = [];
  const items = data.items ?? [];

  // Items
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (!it?.productId) errors.push(`Item ${i + 1}: productId ausente.`);
    if ((it?.quantity ?? 0) <= 0) errors.push(`Item ${i + 1}: quantidade deve ser > 0.`);
    if ((it?.unitPrice ?? 0) < 0) errors.push(`Item ${i + 1}: preço unitário não pode ser negativo.`);
    if ((it?.discount ?? 0) < 0) errors.push(`Item ${i + 1}: desconto não pode ser negativo.`);
    const itemTotal = ((it?.unitPrice ?? 0) * (it?.quantity ?? 1)) - (it?.discount ?? 0);
    if (itemTotal < 0) errors.push(`Item ${i + 1}: total do item ficou negativo (R$ ${itemTotal.toFixed(2)}). Desconto maior que o valor.`);
  }

  // Discount
  const discount = parseFloat(String(data.discount ?? 0)) || 0;
  if (discount < 0) errors.push('Desconto geral não pode ser negativo.');

  // Payments
  if (data.payments && Array.isArray(data.payments)) {
    for (let i = 0; i < data.payments.length; i++) {
      const p = data.payments[i];
      if ((p?.amount ?? 0) <= 0) errors.push(`Pagamento ${i + 1}: valor deve ser > 0.`);
      if (!p?.paymentMethodId) errors.push(`Pagamento ${i + 1}: forma de pagamento ausente.`);
      if (!p?.cashAccountId) errors.push(`Pagamento ${i + 1}: caixa destino ausente.`);
      if ((p?.feePercent ?? 0) < 0) errors.push(`Pagamento ${i + 1}: taxa não pode ser negativa.`);
    }
  }

  return errors.length > 0 ? fail(errors) : ok();
}

// ==========================================
// FINANCEIRO (lançamento manual)
// ==========================================
export function validateFinancialEntry(data: {
  amount?: number;
  type?: string;
  description?: string;
  cashAccountId?: string;
  accountPlanId?: string;
}): ValidationResult {
  const errors: string[] = [];
  if (!data.description?.trim()) errors.push('Descrição é obrigatória.');
  const amount = parseFloat(String(data.amount ?? 0));
  if (isNaN(amount) || amount <= 0) errors.push('Valor deve ser maior que zero.');
  if (!['entrada', 'saida'].includes(data.type ?? '')) errors.push('Tipo deve ser "entrada" ou "saida".');
  if (!data.cashAccountId) errors.push('Selecione um caixa.');
  if (!data.accountPlanId) errors.push('Selecione um plano de contas.');
  return errors.length > 0 ? fail(errors) : ok();
}

// ==========================================
// PRODUTO
// ==========================================
export function validateProductData(data: {
  name?: string;
  salePrice?: number;
  costPrice?: number;
  stockQuantity?: number;
}): ValidationResult {
  const errors: string[] = [];
  if (!data.name?.trim()) errors.push('Nome do produto é obrigatório.');
  if ((data.salePrice ?? 0) < 0) errors.push('Preço de venda não pode ser negativo.');
  if ((data.costPrice ?? 0) < 0) errors.push('Preço de custo não pode ser negativo.');
  return errors.length > 0 ? fail(errors) : ok();
}

// ==========================================
// CONTAS (AP / AR)
// ==========================================
export function validateAccountEntry(data: {
  amount?: number;
  description?: string;
  dueDate?: string;
}): ValidationResult {
  const errors: string[] = [];
  if (!data.description?.trim()) errors.push('Descrição é obrigatória.');
  const amount = parseFloat(String(data.amount ?? 0));
  if (isNaN(amount) || amount <= 0) errors.push('Valor deve ser maior que zero.');
  if (!data.dueDate) errors.push('Data de vencimento é obrigatória.');
  return errors.length > 0 ? fail(errors) : ok();
}

// ==========================================
// MOVIMENTAÇÃO DE CAIXA
// ==========================================
export function validateCashMovement(data: {
  amount?: number;
  type?: string;
  description?: string;
}): ValidationResult {
  const errors: string[] = [];
  if (!data.description?.trim()) errors.push('Descrição é obrigatória.');
  const amount = parseFloat(String(data.amount ?? 0));
  if (isNaN(amount) || amount <= 0) errors.push('Valor deve ser maior que zero.');
  if (!['entrada', 'saida'].includes(data.type ?? '')) errors.push('Tipo inválido.');
  return errors.length > 0 ? fail(errors) : ok();
}

// ==========================================
// TRANSFERÊNCIA ENTRE CAIXAS
// ==========================================
export function validateTransfer(data: {
  amount?: number;
  originId?: string;
  destinationId?: string;
}): ValidationResult {
  const errors: string[] = [];
  const amount = parseFloat(String(data.amount ?? 0));
  if (isNaN(amount) || amount <= 0) errors.push('Valor da transferência deve ser > 0.');
  if (!data.originId) errors.push('Caixa de origem é obrigatório.');
  if (!data.destinationId) errors.push('Caixa de destino é obrigatório.');
  if (data.originId && data.originId === data.destinationId) errors.push('Origem e destino não podem ser o mesmo caixa.');
  return errors.length > 0 ? fail(errors) : ok();
}
