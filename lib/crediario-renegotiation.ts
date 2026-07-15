/**
 * crediario-renegotiation.ts
 *
 * Função central de renegociação do crediário.
 *
 * REGRA CENTRAL:
 * - Renegociação NÃO é nova venda
 * - Renegociação NÃO gera nova receita
 * - Renegociação NÃO aumenta faturamento
 * - Renegociação apenas reorganiza recebíveis existentes
 *
 * Fluxo:
 * 1. Parcelas abertas são marcadas como RENEGOTIATED
 * 2. Novas parcelas PENDING são criadas com o saldo restante
 * 3. Se houver entrada, ela é processada como recebimento real
 * 4. AR é atualizada para refletir o novo saldo
 * 5. Caixa muda APENAS se houver entrada
 * 6. DRE não reconhece nova receita
 */

import { prisma } from '@/lib/db'
import { recordARReceipt } from '@/lib/ledger-engine'
import { randomUUID } from 'crypto'

// ─── Types ──────────────────────────────────────────────────────────

export interface RenegotiationParams {
  companyId: string
  customerId: string
  installmentIds: string[]
  entryAmount: number        // Valor da entrada (0 = sem entrada)
  newInstallments: number    // Quantidade de novas parcelas
  firstDueDate: string       // Data do primeiro vencimento (ISO)
  termDays: number           // Intervalo em dias entre parcelas
  cashAccountId?: string     // Obrigatório se entryAmount > 0
  userId: string
  notes?: string
}

export interface RenegotiationResult {
  success: true
  renegotiationRef: string
  originalTotal: number
  entryAmount: number
  newBalance: number
  oldInstallmentIds: string[]
  newInstallmentIds: string[]
  newInstallmentDetails: Array<{
    id: string
    installmentNumber: number
    amount: number
    dueDate: string
  }>
}

export class RenegotiationError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
    this.name = 'RenegotiationError'
  }
}

// ─── Validações ─────────────────────────────────────────────────────

const ALLOWED_STATUSES = ['PENDING', 'PARTIAL', 'OVERDUE']
const BLOCKED_STATUSES = ['PAID', 'CANCELLED', 'RENEGOTIATED']

// ─── Função Central ─────────────────────────────────────────────────

export async function renegotiateInstallments(
  params: RenegotiationParams
): Promise<RenegotiationResult> {
  const {
    companyId,
    customerId,
    installmentIds,
    entryAmount,
    newInstallments,
    firstDueDate,
    termDays,
    cashAccountId,
    userId,
    notes,
  } = params

  // ─── Validações básicas ───────────────────────────────────────

  if (!installmentIds?.length) {
    throw new RenegotiationError('MISSING_INSTALLMENTS', 'Nenhuma parcela selecionada para renegociação')
  }
  if (newInstallments < 1) {
    throw new RenegotiationError('INVALID_NEW_COUNT', 'Número de novas parcelas deve ser >= 1')
  }
  if (entryAmount < 0) {
    throw new RenegotiationError('INVALID_ENTRY', 'Valor da entrada não pode ser negativo')
  }
  if (entryAmount > 0 && !cashAccountId) {
    throw new RenegotiationError('MISSING_CASH_ACCOUNT', 'Conta caixa obrigatória quando há entrada')
  }

  const renegotiationRef = `RENEG-${Date.now()}-${randomUUID().slice(0, 8)}`
  const now = new Date()

  // ─── Buscar parcelas ──────────────────────────────────────────

  const installments = await prisma.installment.findMany({
    where: { id: { in: installmentIds }, companyId },
    orderBy: { installmentNumber: 'asc' },
  })

  if (installments.length !== installmentIds.length) {
    throw new RenegotiationError('INSTALLMENT_NOT_FOUND', 'Uma ou mais parcelas não encontradas nesta empresa')
  }

  // ─── Validar pertencimento ────────────────────────────────────

  const uniqueCustomers = new Set(installments.map(i => i.customerId))
  if (uniqueCustomers.size > 1 || !uniqueCustomers.has(customerId)) {
    throw new RenegotiationError('CUSTOMER_MISMATCH', 'Todas as parcelas devem pertencer ao mesmo cliente')
  }

  const uniqueSales = new Set(installments.map(i => i.saleId))
  if (uniqueSales.size > 1) {
    throw new RenegotiationError('SALE_MISMATCH', 'Todas as parcelas devem pertencer à mesma venda')
  }
  const saleId = installments[0].saleId

  // ─── Validar status ───────────────────────────────────────────

  for (const inst of installments) {
    if (BLOCKED_STATUSES.includes(inst.status)) {
      throw new RenegotiationError(
        'INVALID_STATUS',
        `Parcela ${inst.installmentNumber} tem status ${inst.status} e não pode ser renegociada`
      )
    }
    if (!ALLOWED_STATUSES.includes(inst.status)) {
      throw new RenegotiationError(
        'INVALID_STATUS',
        `Parcela ${inst.installmentNumber} tem status inválido: ${inst.status}`
      )
    }
    if (inst.replacedByRef) {
      throw new RenegotiationError(
        'ALREADY_RENEGOTIATED',
        `Parcela ${inst.installmentNumber} já foi renegociada anteriormente`
      )
    }
  }

  // ─── Calcular saldos ──────────────────────────────────────────

  const openBalances = installments.map(i => ({
    id: i.id,
    balance: Math.round((i.amount - i.paidAmount) * 100) / 100,
  }))
  const totalOpen = openBalances.reduce((sum, b) => sum + b.balance, 0)
  const totalOpenRounded = Math.round(totalOpen * 100) / 100

  if (entryAmount > totalOpenRounded + 0.01) {
    throw new RenegotiationError(
      'ENTRY_EXCEEDS_BALANCE',
      `Entrada R$ ${entryAmount.toFixed(2)} excede o saldo aberto R$ ${totalOpenRounded.toFixed(2)}`
    )
  }

  const newBalance = Math.round((totalOpenRounded - entryAmount) * 100) / 100

  // ─── Calcular valores das novas parcelas ──────────────────────

  const baseAmount = Math.floor((newBalance / newInstallments) * 100) / 100
  const remainder = Math.round((newBalance - baseAmount * newInstallments) * 100) / 100
  // Última parcela absorve a diferença de arredondamento
  const newAmounts = Array.from({ length: newInstallments }, (_, i) =>
    i === newInstallments - 1 ? baseAmount + remainder : baseAmount
  )

  // ─── Calcular datas de vencimento ─────────────────────────────

  const firstDate = new Date(firstDueDate + 'T12:00:00Z')
  const dueDates = Array.from({ length: newInstallments }, (_, i) => {
    const d = new Date(firstDate)
    d.setDate(d.getDate() + i * termDays)
    return d
  })

  // ─── Executar transação ───────────────────────────────────────

  const result = await prisma.$transaction(async (tx) => {
    // 1. Se houver entrada, processar como recebimento real
    if (entryAmount > 0) {
      // Verificar caixa
      const cashAccount = await tx.cashAccount.findFirst({
        where: { id: cashAccountId!, companyId, isActive: true },
      })
      if (!cashAccount) {
        throw new RenegotiationError('CASH_ACCOUNT_NOT_FOUND', 'Conta caixa não encontrada')
      }

      // Atualizar saldo do caixa (atômico)
      const updatedCash = await tx.cashAccount.update({
        where: { id: cashAccountId! },
        data: { currentBalance: { increment: entryAmount } },
      })

      // Criar movimentação de caixa
      await tx.cashMovement.create({
        data: {
          cashAccountId: cashAccountId!,
          companyId,
          type: 'entrada',
          amount: entryAmount,
          origin: 'recebimento_crediario',
          description: `Entrada de renegociação ${renegotiationRef} — R$ ${entryAmount.toFixed(2)}`,
          balanceBefore: updatedCash.currentBalance - entryAmount,
          balanceAfter: updatedCash.currentBalance,
        },
      })

      // Criar FinancialRecord para a entrada
      await tx.financialRecord.create({
        data: {
          type: 'entrada',
          amount: entryAmount,
          description: `Entrada renegociação crediário ${renegotiationRef}`,
          date: now,
          companyId,
          cashAccountId: cashAccountId!,
        },
      })

      // Reduzir usedLimit pelo valor da entrada
      const credit = await tx.customerCredit.findFirst({
        where: { customerId, companyId },
        select: { id: true, usedLimit: true },
      })
      if (credit) {
        await tx.customerCredit.update({
          where: { id: credit.id },
          data: { usedLimit: Math.max(0, credit.usedLimit - entryAmount) },
        })
      }
    }

    // 2. Marcar parcelas antigas como RENEGOTIATED
    const renegNotes = notes
      ? `Renegociado: ${notes} | Ref: ${renegotiationRef}`
      : `Renegociado em ${now.toLocaleDateString('pt-BR')} | Ref: ${renegotiationRef}`

    for (const inst of installments) {
      await tx.installment.update({
        where: { id: inst.id },
        data: {
          status: 'RENEGOTIATED',
          replacedByRef: renegotiationRef,
          renegotiatedAt: now,
          notes: inst.notes
            ? `${inst.notes} | ${renegNotes}`
            : renegNotes,
        },
      })
    }

    // 3. Criar novas parcelas (vinculadas à mesma venda)
    const existingMax = await tx.installment.aggregate({
      where: { saleId, companyId },
      _max: { installmentNumber: true },
    })
    const startNumber = (existingMax._max.installmentNumber ?? 0) + 1

    const createdInstallments: Array<{
      id: string
      installmentNumber: number
      amount: number
      dueDate: Date
    }> = []

    for (let i = 0; i < newInstallments; i++) {
      const created = await tx.installment.create({
        data: {
          saleId,
          customerId,
          companyId,
          installmentNumber: startNumber + i,
          amount: newAmounts[i],
          paidAmount: 0,
          dueDate: dueDates[i],
          status: 'PENDING',
          renegotiationRef,
          renegotiatedAt: now,
          notes: `Renegociação ${renegotiationRef} — Parcela ${i + 1}/${newInstallments}`,
        },
      })
      createdInstallments.push({
        id: created.id,
        installmentNumber: created.installmentNumber,
        amount: created.amount,
        dueDate: created.dueDate,
      })
    }

    // 4. Atualizar AccountReceivable
    const ar = await tx.accountReceivable.findFirst({
      where: { companyId, saleId, status: { in: ['pendente', 'parcial'] } },
    })
    if (ar) {
      const lastDueDate = dueDates[dueDates.length - 1]
      await tx.accountReceivable.update({
        where: { id: ar.id },
        data: {
          amount: newBalance,
          dueDate: lastDueDate,
          status: newBalance > 0 ? 'pendente' : 'recebido',
          ...(newBalance <= 0 ? { receivedDate: now } : {}),
        },
      })
    }

    // 5. Registrar ActivityLog
    await tx.activityLog.create({
      data: {
        action: 'crediario_renegotiation',
        description: `Renegociação crediário: ${installmentIds.length} parcela(s) → ${newInstallments} nova(s). Saldo original R$ ${totalOpenRounded.toFixed(2)}, entrada R$ ${entryAmount.toFixed(2)}, novo saldo R$ ${newBalance.toFixed(2)}`,
        entityType: 'installment',
        entityId: renegotiationRef,
        userId,
        companyId,
        metadata: {
          renegotiationRef,
          oldInstallmentIds: installmentIds,
          newInstallmentIds: createdInstallments.map(i => i.id),
          originalTotal: totalOpenRounded,
          entryAmount,
          newBalance,
          newInstallments,
          firstDueDate,
          termDays,
          saleId,
          customerId,
        },
      },
    })

    return { createdInstallments }
  }, { timeout: 20000, maxWait: 10000 })

  // 6. Ledger — registrar entrada (fora da transação, não-bloqueante)
  if (entryAmount > 0) {
    try {
      const ar = await prisma.accountReceivable.findFirst({
        where: { companyId, saleId },
      })
      if (ar) {
        await recordARReceipt({
          companyId,
          receivableId: ar.id,
          amount: entryAmount,
          receiptDate: now,
        })
      }
    } catch (err) {
      console.error('[LEDGER] Erro ao registrar entrada de renegociação:', err)
    }
  }

  return {
    success: true,
    renegotiationRef,
    originalTotal: totalOpenRounded,
    entryAmount,
    newBalance,
    oldInstallmentIds: installmentIds,
    newInstallmentIds: result.createdInstallments.map(i => i.id),
    newInstallmentDetails: result.createdInstallments.map(i => ({
      id: i.id,
      installmentNumber: i.installmentNumber,
      amount: i.amount,
      dueDate: i.dueDate.toISOString(),
    })),
  }
}
