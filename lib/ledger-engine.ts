/**
 * Ledger Engine — Motor de Dupla-Entrada Contábil
 *
 * Toda movimentação financeira gera pelo menos 2 lançamentos (débito + crédito)
 * agrupados por batchId. A soma dos débitos SEMPRE é igual à soma dos créditos
 * dentro de um batch.
 *
 * Contas Patrimoniais (grupo 7):
 *   7.1  Caixa / Bancos
 *   7.2  Estoque de Mercadorias
 *   7.3  Contas a Receber
 *   7.4  Contas a Pagar
 *
 * Contas de Resultado (grupos 1-6 existentes):
 *   1.1  Receita Operacional
 *   2.1  Mercadorias (CMV)
 *   3.4.3 Taxas de Cartão
 *   etc.
 */

import { prisma } from '@/lib/db';
import { randomUUID } from 'crypto';

// ─── Types ──────────────────────────────────────────────────────────

export type LedgerSourceType =
  | 'sale'
  | 'cancellation'
  | 'ar_receipt'
  | 'ap_payment'
  | 'manual_entry'
  | 'stock_entry'
  | 'adjustment';

interface LedgerLine {
  accountPlanId: string;
  debit: number;
  credit: number;
  description: string;
}

interface CreateBatchParams {
  companyId: string;
  date: Date;
  sourceType: LedgerSourceType;
  sourceId?: string;
  lines: LedgerLine[];
}

interface AccountBalanceResult {
  accountPlanId: string;
  accountCode: string | null;
  accountName: string;
  totalDebit: number;
  totalCredit: number;
  balance: number; // debit - credit (ativo: positivo = saldo; passivo/receita: negativo = saldo)
}

interface LedgerReportParams {
  companyId: string;
  startDate?: Date;
  endDate?: Date;
  accountPlanId?: string;
  sourceType?: LedgerSourceType;
  sourceId?: string;
  limit?: number;
  offset?: number;
}

// ─── Account Plan Cache ─────────────────────────────────────────────

const ACCOUNT_CODES = {
  CAIXA: '7.1',
  ESTOQUE: '7.2',
  CONTAS_RECEBER: '7.3',
  CONTAS_PAGAR: '7.4',
  RECEITA: '1.1',
  CMV: '2.1',
  TAXAS_CARTAO: '3.4.3',
  AJUSTE: '5.99',
} as const;

/**
 * Resolve o ID de um AccountPlan pelo código, com cache em memória.
 * Se a conta não existir, tenta seedar as contas do grupo 7.
 */
async function resolveAccountId(
  companyId: string,
  code: string,
): Promise<string> {
  const plan = await prisma.accountPlan.findFirst({
    where: { companyId, code, isActive: true },
    select: { id: true },
  });

  if (plan) return plan.id;

  // Auto-seed balance sheet accounts if missing
  if (code.startsWith('7')) {
    const { seedAccountPlanForCompany } = await import('@/lib/account-plan-seed');
    await seedAccountPlanForCompany(companyId);
    const retry = await prisma.accountPlan.findFirst({
      where: { companyId, code, isActive: true },
      select: { id: true },
    });
    if (retry) return retry.id;
  }

  throw new Error(`AccountPlan ${code} não encontrado para empresa ${companyId}`);
}

// ─── Core: Create Batch ─────────────────────────────────────────────

/**
 * Cria um batch de lançamentos no ledger.
 * Valida que a soma dos débitos === soma dos créditos.
 * Retorna o batchId gerado.
 */
export async function createLedgerBatch(
  params: CreateBatchParams,
): Promise<string> {
  const { companyId, date, sourceType, sourceId, lines } = params;

  if (!lines.length) throw new Error('Ledger batch vazio');

  const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
  const totalCredit = lines.reduce((s, l) => s + l.credit, 0);

  // Tolerance for floating-point
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new Error(
      `Ledger desbalanceado: débito=${totalDebit.toFixed(2)} crédito=${totalCredit.toFixed(2)}`,
    );
  }

  const batchId = randomUUID();

  await prisma.ledgerEntry.createMany({
    data: lines.map((l) => ({
      companyId,
      date,
      accountPlanId: l.accountPlanId,
      debit: Math.round(l.debit * 100) / 100,
      credit: Math.round(l.credit * 100) / 100,
      description: l.description,
      sourceType,
      sourceId: sourceId || null,
      batchId,
    })),
  });

  return batchId;
}

// ─── Sale Recording ─────────────────────────────────────────────────

/**
 * Registra lançamentos de uma venda:
 *  1) D: Caixa/AR  C: Receita  (valor recebido ou a receber)
 *  2) D: CMV       C: Estoque  (custo das mercadorias)
 *  3) D: Taxas     C: Caixa    (taxas de cartão, se houver)
 *
 * Para vendas mistas (parte à vista + parte a prazo), use cashAmount e
 * receivableAmount para split proporcional. O campo hasReceivables é
 * mantido para retrocompatibilidade — quando cashAmount/receivableAmount
 * não são informados, o comportamento tudo-ou-nada original prevalece.
 */
export async function recordSale(params: {
  companyId: string;
  saleId: string;
  saleDate: Date;
  totalAmount: number;
  cmvAmount: number;
  feeAmount: number;
  hasReceivables: boolean;
  cashAmount?: number;       // valor recebido imediatamente (à vista)
  receivableAmount?: number; // valor a prazo (gera AR)
}): Promise<string> {
  const { companyId, saleId, saleDate, totalAmount, cmvAmount, feeAmount, hasReceivables } = params;

  // Split proporcional: se informado, usa valores explícitos;
  // caso contrário, mantém comportamento original (tudo-ou-nada).
  const hasSplit = params.cashAmount !== undefined || params.receivableAmount !== undefined;
  const cashPortion = hasSplit
    ? Math.round((params.cashAmount ?? 0) * 100) / 100
    : (hasReceivables ? 0 : totalAmount);
  const arPortion = hasSplit
    ? Math.round((params.receivableAmount ?? 0) * 100) / 100
    : (hasReceivables ? totalAmount : 0);

  const [caixaId, arId, receitaId, cmvId, estoqueId, taxaId] = await Promise.all([
    resolveAccountId(companyId, ACCOUNT_CODES.CAIXA),
    resolveAccountId(companyId, ACCOUNT_CODES.CONTAS_RECEBER),
    resolveAccountId(companyId, ACCOUNT_CODES.RECEITA),
    resolveAccountId(companyId, ACCOUNT_CODES.CMV),
    resolveAccountId(companyId, ACCOUNT_CODES.ESTOQUE),
    resolveAccountId(companyId, ACCOUNT_CODES.TAXAS_CARTAO),
  ]);

  const lines: LedgerLine[] = [];

  // 1) Receita — split entre Caixa e Contas a Receber
  if (totalAmount > 0) {
    if (cashPortion > 0) {
      lines.push(
        { accountPlanId: caixaId, debit: cashPortion, credit: 0, description: `Venda #${saleId.slice(-6)} — Caixa` },
      );
    }
    if (arPortion > 0) {
      lines.push(
        { accountPlanId: arId, debit: arPortion, credit: 0, description: `Venda #${saleId.slice(-6)} — Contas a Receber` },
      );
    }
    lines.push(
      { accountPlanId: receitaId, debit: 0, credit: totalAmount, description: `Venda #${saleId.slice(-6)} — Receita` },
    );
  }

  // 2) CMV
  if (cmvAmount > 0) {
    lines.push(
      { accountPlanId: cmvId, debit: cmvAmount, credit: 0, description: `Venda #${saleId.slice(-6)} — CMV` },
      { accountPlanId: estoqueId, debit: 0, credit: cmvAmount, description: `Venda #${saleId.slice(-6)} — Saída Estoque` },
    );
  }

  // 3) Taxas de cartão
  if (feeAmount > 0) {
    lines.push(
      { accountPlanId: taxaId, debit: feeAmount, credit: 0, description: `Venda #${saleId.slice(-6)} — Taxa Cartão` },
      { accountPlanId: caixaId, debit: 0, credit: feeAmount, description: `Venda #${saleId.slice(-6)} — Taxa descontada do Caixa` },
    );
  }

  if (!lines.length) return '';

  return createLedgerBatch({
    companyId,
    date: saleDate,
    sourceType: 'sale',
    sourceId: saleId,
    lines,
  });
}

// ─── Sale Cancellation ──────────────────────────────────────────────

/**
 * Estorna todos os lançamentos de uma venda (lançamentos inversos).
 */
export async function recordSaleCancellation(params: {
  companyId: string;
  saleId: string;
  cancellationDate: Date;
}): Promise<string> {
  const { companyId, saleId, cancellationDate } = params;

  const originalEntries = await prisma.ledgerEntry.findMany({
    where: { companyId, sourceType: 'sale', sourceId: saleId },
  });

  if (!originalEntries.length) return ''; // no entries to reverse

  const lines: LedgerLine[] = originalEntries.map((e) => ({
    accountPlanId: e.accountPlanId,
    debit: e.credit,   // inverte
    credit: e.debit,   // inverte
    description: `Cancelamento — ${e.description}`,
  }));

  return createLedgerBatch({
    companyId,
    date: cancellationDate,
    sourceType: 'cancellation',
    sourceId: saleId,
    lines,
  });
}

// ─── AR Receipt ─────────────────────────────────────────────────────

/**
 * Recebimento de conta a receber:
 *   D: Caixa    C: Contas a Receber
 */
export async function recordARReceipt(params: {
  companyId: string;
  receivableId: string;
  amount: number;
  receiptDate: Date;
}): Promise<string> {
  const { companyId, receivableId, amount, receiptDate } = params;
  if (amount <= 0) return '';

  const [caixaId, arId] = await Promise.all([
    resolveAccountId(companyId, ACCOUNT_CODES.CAIXA),
    resolveAccountId(companyId, ACCOUNT_CODES.CONTAS_RECEBER),
  ]);

  return createLedgerBatch({
    companyId,
    date: receiptDate,
    sourceType: 'ar_receipt',
    sourceId: receivableId,
    lines: [
      { accountPlanId: caixaId, debit: amount, credit: 0, description: `Recebimento CR #${receivableId.slice(-6)}` },
      { accountPlanId: arId, debit: 0, credit: amount, description: `Baixa CR #${receivableId.slice(-6)}` },
    ],
  });
}

// ─── AP Payment ─────────────────────────────────────────────────────

/**
 * Pagamento de conta a pagar:
 *   D: Contas a Pagar   C: Caixa
 * Se a AP tem accountPlanId (ex: despesa), também:
 *   D: Despesa           C: Contas a Pagar
 */
export async function recordAPPayment(params: {
  companyId: string;
  payableId: string;
  amount: number;
  paymentDate: Date;
  expenseAccountPlanId?: string; // accountPlanId da AP (classificação contábil)
}): Promise<string> {
  const { companyId, payableId, amount, paymentDate, expenseAccountPlanId } = params;
  if (amount <= 0) return '';

  const [caixaId, apId] = await Promise.all([
    resolveAccountId(companyId, ACCOUNT_CODES.CAIXA),
    resolveAccountId(companyId, ACCOUNT_CODES.CONTAS_PAGAR),
  ]);

  const lines: LedgerLine[] = [
    { accountPlanId: apId, debit: amount, credit: 0, description: `Pagamento CP #${payableId.slice(-6)}` },
    { accountPlanId: caixaId, debit: 0, credit: amount, description: `Saída Caixa — CP #${payableId.slice(-6)}` },
  ];

  return createLedgerBatch({
    companyId,
    date: paymentDate,
    sourceType: 'ap_payment',
    sourceId: payableId,
    lines,
  });
}

// ─── Manual Financial Entry ─────────────────────────────────────────

/**
 * Lançamento financeiro manual (entrada ou saída):
 *   Entrada: D: Caixa  C: Conta(accountPlanId)
 *   Saída:   D: Conta(accountPlanId)  C: Caixa
 */
export async function recordManualEntry(params: {
  companyId: string;
  financialRecordId: string;
  amount: number;
  entryDate: Date;
  type: 'entrada' | 'saida';
  accountPlanId: string; // classificação contábil do FR
  description: string;
}): Promise<string> {
  const { companyId, financialRecordId, amount, entryDate, type, accountPlanId, description } = params;
  if (amount <= 0) return '';

  const caixaId = await resolveAccountId(companyId, ACCOUNT_CODES.CAIXA);

  const lines: LedgerLine[] = type === 'entrada'
    ? [
        { accountPlanId: caixaId, debit: amount, credit: 0, description: `Entrada — ${description}` },
        { accountPlanId, debit: 0, credit: amount, description: `Entrada — ${description}` },
      ]
    : [
        { accountPlanId, debit: amount, credit: 0, description: `Saída — ${description}` },
        { accountPlanId: caixaId, debit: 0, credit: amount, description: `Saída — ${description}` },
      ];

  return createLedgerBatch({
    companyId,
    date: entryDate,
    sourceType: 'manual_entry',
    sourceId: financialRecordId,
    lines,
  });
}

// ─── Stock Entry ────────────────────────────────────────────────────

/**
 * Entrada de estoque (compra):
 *   D: Estoque         C: Contas a Pagar (ou Caixa se à vista)
 */
export async function recordStockEntry(params: {
  companyId: string;
  stockEntryId: string;
  totalAmount: number;
  entryDate: Date;
  paidInCash: boolean;
}): Promise<string> {
  const { companyId, stockEntryId, totalAmount, entryDate, paidInCash } = params;
  if (totalAmount <= 0) return '';

  const [estoqueId, creditAccountId] = await Promise.all([
    resolveAccountId(companyId, ACCOUNT_CODES.ESTOQUE),
    paidInCash
      ? resolveAccountId(companyId, ACCOUNT_CODES.CAIXA)
      : resolveAccountId(companyId, ACCOUNT_CODES.CONTAS_PAGAR),
  ]);

  const creditLabel = paidInCash ? 'Caixa' : 'Contas a Pagar';

  return createLedgerBatch({
    companyId,
    date: entryDate,
    sourceType: 'stock_entry',
    sourceId: stockEntryId,
    lines: [
      { accountPlanId: estoqueId, debit: totalAmount, credit: 0, description: `Entrada Estoque #${stockEntryId.slice(-6)}` },
      { accountPlanId: creditAccountId, debit: 0, credit: totalAmount, description: `Entrada Estoque #${stockEntryId.slice(-6)} — ${creditLabel}` },
    ],
  });
}

// ─── Queries ────────────────────────────────────────────────────────

/**
 * Retorna o saldo de cada conta do plano para a empresa.
 * Saldo = soma(debit) - soma(credit)
 *   Ativo (7.1, 7.2, 7.3): saldo positivo = recurso
 *   Passivo (7.4): saldo negativo = obrigação
 *   Receita (1.x): saldo negativo = crédito acumulado
 *   Despesa (2.x, 3.x): saldo positivo = gasto acumulado
 */
export async function getAccountBalances(params: {
  companyId: string;
  startDate?: Date;
  endDate?: Date;
}): Promise<AccountBalanceResult[]> {
  const { companyId, startDate, endDate } = params;

  const dateFilter: Record<string, Date> = {};
  if (startDate) dateFilter.gte = startDate;
  if (endDate) dateFilter.lte = endDate;

  const entries = await prisma.ledgerEntry.groupBy({
    by: ['accountPlanId'],
    where: {
      companyId,
      ...(Object.keys(dateFilter).length ? { date: dateFilter } : {}),
    },
    _sum: { debit: true, credit: true },
  });

  if (!entries.length) return [];

  // Fetch account info
  const accountIds = entries.map((e) => e.accountPlanId);
  const accounts = await prisma.accountPlan.findMany({
    where: { id: { in: accountIds } },
    select: { id: true, code: true, name: true },
  });
  const accountMap = new Map(accounts.map((a) => [a.id, a]));

  return entries.map((e) => {
    const acc = accountMap.get(e.accountPlanId);
    const totalDebit = e._sum.debit || 0;
    const totalCredit = e._sum.credit || 0;
    return {
      accountPlanId: e.accountPlanId,
      accountCode: acc?.code || null,
      accountName: acc?.name || 'Desconhecida',
      totalDebit: Math.round(totalDebit * 100) / 100,
      totalCredit: Math.round(totalCredit * 100) / 100,
      balance: Math.round((totalDebit - totalCredit) * 100) / 100,
    };
  }).sort((a, b) => (a.accountCode || '').localeCompare(b.accountCode || ''));
}

/**
 * Retorna lançamentos do ledger com filtros.
 */
export async function getLedgerEntries(params: LedgerReportParams) {
  const { companyId, startDate, endDate, accountPlanId, sourceType, sourceId, limit = 100, offset = 0 } = params;

  const where: Record<string, unknown> = { companyId };
  if (startDate || endDate) {
    const dateFilter: Record<string, Date> = {};
    if (startDate) dateFilter.gte = startDate;
    if (endDate) dateFilter.lte = endDate;
    where.date = dateFilter;
  }
  if (accountPlanId) where.accountPlanId = accountPlanId;
  if (sourceType) where.sourceType = sourceType;
  if (sourceId) where.sourceId = sourceId;

  const [entries, total] = await Promise.all([
    prisma.ledgerEntry.findMany({
      where,
      include: { accountPlan: { select: { id: true, code: true, name: true } } },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      take: limit,
      skip: offset,
    }),
    prisma.ledgerEntry.count({ where }),
  ]);

  return { entries, total };
}

/**
 * Verifica se já existem lançamentos para uma determinada fonte.
 * Usado para idempotência na migração retroativa.
 */
export async function hasLedgerEntries(params: {
  companyId: string;
  sourceType: LedgerSourceType;
  sourceId: string;
}): Promise<boolean> {
  const count = await prisma.ledgerEntry.count({
    where: {
      companyId: params.companyId,
      sourceType: params.sourceType,
      sourceId: params.sourceId,
    },
  });
  return count > 0;
}

/**
 * Resumo rápido para conciliação.
 */
export async function getLedgerSummary(companyId: string) {
  const [totalEntries, totalBatches, balances] = await Promise.all([
    prisma.ledgerEntry.count({ where: { companyId } }),
    prisma.ledgerEntry.groupBy({
      by: ['batchId'],
      where: { companyId },
    }).then((r) => r.length),
    getAccountBalances({ companyId }),
  ]);

  const totalDebit = balances.reduce((s, b) => s + b.totalDebit, 0);
  const totalCredit = balances.reduce((s, b) => s + b.totalCredit, 0);

  return {
    totalEntries,
    totalBatches,
    totalDebit: Math.round(totalDebit * 100) / 100,
    totalCredit: Math.round(totalCredit * 100) / 100,
    isBalanced: Math.abs(totalDebit - totalCredit) < 0.01,
    accountBalances: balances,
  };
}
