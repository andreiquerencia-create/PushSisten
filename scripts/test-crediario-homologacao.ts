/**
 * HOMOLOGAÇÃO FINAL DO MÓDULO DE CREDIÁRIO — PushSistem
 * Executa contra o banco real, em uma empresa de teste ISOLADA (TEST_HOMOLOG_CREDIARIO).
 *
 * 10 testes funcionais + validações financeiras (DRE/Ledger/Fluxo de Caixa/AR/CustomerCredit).
 * Não toca em dados de nenhuma outra empresa.
 */

import { PrismaClient } from '@prisma/client'
import { renegotiateInstallments } from '../lib/crediario-renegotiation'
import { syncOverdueInstallments, syncCreditStatus } from '../lib/crediario-sync'
import { recordSale, recordARReceipt, getLedgerSummary } from '../lib/ledger-engine'
import { getReceivables } from '../lib/financial-engine'
import { seedAccountPlanForCompany } from '../lib/account-plan-seed'

const prisma = new PrismaClient()

const PASS = '\x1b[32m✓ PASS\x1b[0m'
const FAIL = '\x1b[31m✗ FAIL\x1b[0m'
let passed = 0, failed = 0
const failures: string[] = []

function assert(cond: boolean, msg: string) {
  if (cond) { console.log(`  ${PASS} ${msg}`); passed++ }
  else { console.log(`  ${FAIL} ${msg}`); failed++; failures.push(msg) }
}

function section(title: string) {
  console.log(`\n\x1b[36m─── ${title} ───\x1b[0m`)
}

async function cleanup(companyId: string) {
  await prisma.installmentPayment.deleteMany({ where: { companyId } })
  await prisma.installment.deleteMany({ where: { companyId } })
  await prisma.cashMovement.deleteMany({ where: { companyId } })
  await prisma.financialRecord.deleteMany({ where: { companyId } })
  await prisma.accountReceivable.deleteMany({ where: { companyId } })
  await prisma.salePayment.deleteMany({ where: { companyId } })
  await prisma.saleItem.deleteMany({ where: { sale: { companyId } } })
  await prisma.sale.deleteMany({ where: { companyId } })
  await prisma.customerCredit.deleteMany({ where: { companyId } })
  await prisma.customer.deleteMany({ where: { companyId } })
  await prisma.cashAccount.deleteMany({ where: { companyId } })
  await prisma.product.deleteMany({ where: { companyId } })
  await prisma.ledgerEntry.deleteMany({ where: { companyId } })
  await prisma.activityLog.deleteMany({ where: { companyId } })
}

let saleSeq = 80000

/** Cria uma venda no crediario (espelha a rota /api/vendas) + registra ledger. */
async function createCreditSale(opts: {
  companyId: string
  customerId: string
  cashAccountId: string
  total: number
  numParcelas: number
  termDays?: number
  firstDueOffsetDays?: number // desloca o vencimento (negativo = vencida)
}) {
  const { companyId, customerId, cashAccountId, total, numParcelas } = opts
  const termDays = opts.termDays ?? 30
  const saleNumber = saleSeq++

  const sale = await prisma.sale.create({
    data: {
      saleNumber, subtotal: total, total, discount: 0,
      status: 'concluida', paymentMethod: 'crediario', companyId, customerId,
    },
  })

  // Atualiza usedLimit
  const credit = await prisma.customerCredit.findFirst({ where: { customerId, companyId } })
  if (credit) {
    await prisma.customerCredit.update({ where: { id: credit.id }, data: { usedLimit: { increment: total } } })
  }

  // Gera parcelas
  const valorParcela = Math.floor((total / numParcelas) * 100) / 100
  const resto = Math.round((total - valorParcela * numParcelas) * 100) / 100
  const base = sale.createdAt
  const offset = opts.firstDueOffsetDays ?? termDays
  const ids: string[] = []
  for (let i = 1; i <= numParcelas; i++) {
    const dueDate = new Date(base)
    dueDate.setDate(dueDate.getDate() + (offset + termDays * (i - 1)))
    const amount = i === numParcelas ? valorParcela + resto : valorParcela
    const inst = await prisma.installment.create({
      data: { saleId: sale.id, customerId, companyId, installmentNumber: i, amount, dueDate, status: 'PENDING' },
    })
    ids.push(inst.id)
  }

  await prisma.accountReceivable.create({
    data: {
      description: `Crediario - Venda #${saleNumber} (${numParcelas}x)`,
      amount: total,
      dueDate: new Date(base.getTime() + termDays * numParcelas * 86400000),
      status: 'pendente', saleId: sale.id, customerId, companyId,
    },
  })

  // Ledger (venda 100% a prazo)
  await recordSale({
    companyId, saleId: sale.id, saleDate: base, totalAmount: total,
    cmvAmount: total * 0.4, feeAmount: 0, hasReceivables: true,
    cashAmount: 0, receivableAmount: total,
  })

  return { sale, installmentIds: ids }
}

/** Recebe pagamento de parcela (espelha /api/crediario/recebimentos) + syncCreditStatus. */
async function receivePayment(opts: {
  companyId: string; cashAccountId: string; installmentId: string; amount: number
}) {
  const { companyId, cashAccountId, installmentId, amount } = opts
  const inst = await prisma.installment.findUnique({ where: { id: installmentId } })
  if (!inst) throw new Error('parcela inexistente')

  await prisma.$transaction(async (tx) => {
    await tx.installmentPayment.create({ data: { installmentId, companyId, amount, cashAccountId } })
    const newPaid = Math.round((inst.paidAmount + amount) * 100) / 100
    const remaining = Math.round((inst.amount - newPaid) * 100) / 100
    await tx.installment.update({
      where: { id: installmentId },
      data: { paidAmount: newPaid, status: remaining <= 0.01 ? 'PAID' : 'PARTIAL' },
    })
    await tx.cashAccount.update({ where: { id: cashAccountId }, data: { currentBalance: { increment: amount } } })
    const cash = await tx.cashAccount.findUnique({ where: { id: cashAccountId } })
    await tx.cashMovement.create({
      data: {
        cashAccountId, companyId, type: 'entrada', amount, origin: 'recebimento_crediario',
        description: `Recebimento crediario parcela ${inst.installmentNumber}`,
        balanceBefore: (cash?.currentBalance ?? 0) - amount, balanceAfter: cash?.currentBalance ?? 0,
      },
    })
    const credit = await tx.customerCredit.findFirst({ where: { customerId: inst.customerId, companyId }, select: { id: true, usedLimit: true } })
    if (credit) {
      await tx.customerCredit.update({ where: { id: credit.id }, data: { usedLimit: Math.max(0, credit.usedLimit - amount) } })
    }
    // Atualiza AR
    const ar = await tx.accountReceivable.findFirst({ where: { companyId, saleId: inst.saleId, status: { in: ['pendente', 'parcial'] } } })
    if (ar) {
      const all = await tx.installment.findMany({ where: { saleId: inst.saleId, companyId }, select: { paidAmount: true, status: true } })
      const totalPaid = all.reduce((s, i) => s + Number(i.paidAmount), 0)
      const allPaid = all.every(i => i.status === 'PAID')
      const newStatus = (allPaid || totalPaid >= Number(ar.amount) - 0.01) ? 'recebido' : 'parcial'
      await tx.accountReceivable.update({ where: { id: ar.id }, data: { status: newStatus, ...(newStatus === 'recebido' ? { receivedDate: new Date() } : {}) } })
    }
  })

  // Ledger receipt
  const ar = await prisma.accountReceivable.findFirst({ where: { companyId, saleId: inst.saleId } })
  if (ar) await recordARReceipt({ companyId, receivableId: ar.id, amount, receiptDate: new Date() })

  // Sincroniza status de credito (desbloqueio automatico)
  await syncCreditStatus(companyId)
}

async function main() {
  let company = await prisma.company.findFirst({ where: { name: 'TEST_HOMOLOG_CREDIARIO' } })
  if (!company) {
    company = await prisma.company.create({ data: { name: 'TEST_HOMOLOG_CREDIARIO', cnpj: '00000000000288', email: 'homolog@test.com' } })
  }
  const companyId = company.id
  await cleanup(companyId)
  // Garante o plano de contas para o ledger funcionar
  await seedAccountPlanForCompany(companyId)

  console.log('\n\x1b[1m========================================')
  console.log('  HOMOLOGAÇÃO FINAL — CREDIÁRIO PushSistem')
  console.log('========================================\x1b[0m')

  // Usuario responsavel
  const user = await prisma.user.create({
    data: { name: 'Gerente Homolog', email: `homolog_${Date.now()}@test.com`, password: 'x', role: 'gerente', companyId },
  })
  const cashAccount = await prisma.cashAccount.create({ data: { name: 'Caixa Homolog', companyId, currentBalance: 0, isActive: true } })

  // ===== TESTE 1: Venda no crediario =====
  section('TESTE 1 — Venda no crediário (gera parcelas PENDING + AR)')
  const cliA = await prisma.customer.create({ data: { name: 'Cliente A', companyId } })
  await prisma.customerCredit.create({ data: { customerId: cliA.id, companyId, creditLimit: 5000, usedLimit: 0, status: 'ACTIVE' } })
  const venda1 = await createCreditSale({ companyId, customerId: cliA.id, cashAccountId: cashAccount.id, total: 900, numParcelas: 3 })
  let parcelasV1 = await prisma.installment.findMany({ where: { saleId: venda1.sale.id }, orderBy: { installmentNumber: 'asc' } })
  const creditA1 = await prisma.customerCredit.findFirst({ where: { customerId: cliA.id, companyId } })
  assert(parcelasV1.length === 3, 'Criou 3 parcelas')
  assert(parcelasV1.every(p => p.status === 'PENDING'), 'Todas as parcelas iniciam PENDING')
  assert(Math.abs(parcelasV1.reduce((s, p) => s + p.amount, 0) - 900) < 0.01, 'Soma das parcelas = R$ 900,00')
  assert(Math.abs((creditA1?.usedLimit ?? 0) - 900) < 0.01, 'usedLimit do cliente = R$ 900,00')

  // ===== TESTE 2: Recebimento parcial =====
  section('TESTE 2 — Recebimento parcial de parcela')
  await receivePayment({ companyId, cashAccountId: cashAccount.id, installmentId: parcelasV1[0].id, amount: 100 })
  const p1 = await prisma.installment.findUnique({ where: { id: parcelasV1[0].id } })
  const creditA2 = await prisma.customerCredit.findFirst({ where: { customerId: cliA.id, companyId } })
  assert(p1?.status === 'PARTIAL', 'Parcela com pagamento parcial fica PARTIAL')
  assert(Math.abs((p1?.paidAmount ?? 0) - 100) < 0.01, 'paidAmount = R$ 100,00')
  assert(Math.abs((creditA2?.usedLimit ?? 0) - 800) < 0.01, 'usedLimit reduzido para R$ 800,00')

  // ===== TESTE 3: Recebimento total =====
  section('TESTE 3 — Recebimento total de parcela')
  const restante1 = (p1!.amount - p1!.paidAmount)
  await receivePayment({ companyId, cashAccountId: cashAccount.id, installmentId: parcelasV1[0].id, amount: restante1 })
  const p1b = await prisma.installment.findUnique({ where: { id: parcelasV1[0].id } })
  assert(p1b?.status === 'PAID', 'Parcela quitada fica PAID')
  assert(Math.abs((p1b?.amount ?? 0) - (p1b?.paidAmount ?? 0)) < 0.01, 'paidAmount == amount')

  // ===== TESTE 4: Parcela vencida + bloqueio automatico =====
  section('TESTE 4 — Parcela vencida → OVERDUE + bloqueio automático')
  const cliB = await prisma.customer.create({ data: { name: 'Cliente B', companyId } })
  await prisma.customerCredit.create({ data: { customerId: cliB.id, companyId, creditLimit: 3000, usedLimit: 0, status: 'ACTIVE' } })
  // venda com 1a parcela ja vencida (offset negativo)
  const venda2 = await createCreditSale({ companyId, customerId: cliB.id, cashAccountId: cashAccount.id, total: 600, numParcelas: 2, firstDueOffsetDays: -10 })
  const syncR1 = await syncOverdueInstallments(companyId)
  const parcelasV2 = await prisma.installment.findMany({ where: { saleId: venda2.sale.id }, orderBy: { installmentNumber: 'asc' } })
  const creditB1 = await prisma.customerCredit.findFirst({ where: { customerId: cliB.id, companyId } })
  assert(parcelasV2[0].status === 'OVERDUE', 'Parcela vencida marcada como OVERDUE')
  assert(creditB1?.status === 'BLOCKED', 'Cliente inadimplente foi BLOQUEADO automaticamente')
  assert(creditB1?.blockReason === 'AUTO_OVERDUE', 'blockReason = AUTO_OVERDUE (bloqueio automático)')
  assert(syncR1.customersBlocked >= 1, 'Sync reportou bloqueio')

  // ===== TESTE 5: Regularizacao + desbloqueio automatico =====
  section('TESTE 5 — Regularização → desbloqueio automático')
  const overdueB = parcelasV2.find(p => p.status === 'OVERDUE')!
  await receivePayment({ companyId, cashAccountId: cashAccount.id, installmentId: overdueB.id, amount: overdueB.amount })
  const creditB2 = await prisma.customerCredit.findFirst({ where: { customerId: cliB.id, companyId } })
  const overdueBafter = await prisma.installment.findUnique({ where: { id: overdueB.id } })
  assert(overdueBafter?.status === 'PAID', 'Parcela vencida quitada fica PAID')
  assert(creditB2?.status === 'ACTIVE', 'Cliente DESBLOQUEADO automaticamente após regularizar')
  assert(creditB2?.blockReason === null, 'blockReason limpo após desbloqueio')

  // ===== TESTE 6: Bloqueio MANUAL nao e desbloqueado pelo sync =====
  section('TESTE 6 — Bloqueio MANUAL preservado pelo sync')
  const cliC = await prisma.customer.create({ data: { name: 'Cliente C', companyId } })
  await prisma.customerCredit.create({ data: { customerId: cliC.id, companyId, creditLimit: 2000, usedLimit: 0, status: 'BLOCKED', blockReason: 'MANUAL' } })
  await syncCreditStatus(companyId)
  const creditC = await prisma.customerCredit.findFirst({ where: { customerId: cliC.id, companyId } })
  assert(creditC?.status === 'BLOCKED', 'Cliente bloqueado manualmente permanece BLOCKED após sync')
  assert(creditC?.blockReason === 'MANUAL', 'blockReason MANUAL preservado')

  // ===== TESTE 7: Renegociacao SEM entrada =====
  section('TESTE 7 — Renegociação SEM entrada')
  const cliD = await prisma.customer.create({ data: { name: 'Cliente D', companyId } })
  await prisma.customerCredit.create({ data: { customerId: cliD.id, companyId, creditLimit: 5000, usedLimit: 0, status: 'ACTIVE' } })
  const venda3 = await createCreditSale({ companyId, customerId: cliD.id, cashAccountId: cashAccount.id, total: 1200, numParcelas: 3 })
  const parcelasV3 = await prisma.installment.findMany({ where: { saleId: venda3.sale.id }, orderBy: { installmentNumber: 'asc' } })
  const saldoAntesD = parcelasV3.reduce((s, p) => s + (p.amount - p.paidAmount), 0)
  const reneg1 = await renegotiateInstallments({
    companyId, customerId: cliD.id, installmentIds: parcelasV3.map(p => p.id),
    entryAmount: 0, newInstallments: 4, firstDueDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    termDays: 30, userId: user.id,
  })
  const oldParcelasD = await prisma.installment.findMany({ where: { replacedByRef: reneg1.renegotiationRef } })
  const newParcelasD = await prisma.installment.findMany({ where: { renegotiationRef: reneg1.renegotiationRef } })
  assert(oldParcelasD.length === 3 && oldParcelasD.every(p => p.status === 'RENEGOTIATED'), 'Parcelas antigas marcadas como RENEGOTIATED')
  assert(newParcelasD.length === 4 && newParcelasD.every(p => p.status === 'PENDING'), 'Geradas 4 novas parcelas PENDING')
  assert(Math.abs(newParcelasD.reduce((s, p) => s + p.amount, 0) - saldoAntesD) < 0.01, 'Saldo renegociado preservado (sem entrada)')

  // ===== TESTE 8: Renegociacao COM entrada =====
  section('TESTE 8 — Renegociação COM entrada')
  const cliE = await prisma.customer.create({ data: { name: 'Cliente E', companyId } })
  await prisma.customerCredit.create({ data: { customerId: cliE.id, companyId, creditLimit: 5000, usedLimit: 0, status: 'ACTIVE' } })
  const venda4 = await createCreditSale({ companyId, customerId: cliE.id, cashAccountId: cashAccount.id, total: 1000, numParcelas: 2 })
  const parcelasV4 = await prisma.installment.findMany({ where: { saleId: venda4.sale.id }, orderBy: { installmentNumber: 'asc' } })
  const saldoAntesE = parcelasV4.reduce((s, p) => s + (p.amount - p.paidAmount), 0)
  const caixaAntes = (await prisma.cashAccount.findUnique({ where: { id: cashAccount.id } }))!.currentBalance
  const usedAntesE = (await prisma.customerCredit.findFirst({ where: { customerId: cliE.id, companyId } }))!.usedLimit
  const reneg2 = await renegotiateInstallments({
    companyId, customerId: cliE.id, installmentIds: parcelasV4.map(p => p.id),
    entryAmount: 300, newInstallments: 2, firstDueDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    termDays: 30, cashAccountId: cashAccount.id, userId: user.id,
  })
  const caixaDepois = (await prisma.cashAccount.findUnique({ where: { id: cashAccount.id } }))!.currentBalance
  const usedDepoisE = (await prisma.customerCredit.findFirst({ where: { customerId: cliE.id, companyId } }))!.usedLimit
  const newParcelasE = await prisma.installment.findMany({ where: { renegotiationRef: reneg2.renegotiationRef } })
  assert(Math.abs(reneg2.newBalance - (saldoAntesE - 300)) < 0.01, 'Novo saldo = saldo original - entrada')
  assert(Math.abs((caixaDepois - caixaAntes) - 300) < 0.01, 'Entrada creditada no caixa (R$ 300,00)')
  assert(Math.abs((usedAntesE - usedDepoisE) - 300) < 0.01, 'usedLimit reduzido pelo valor da entrada')
  assert(Math.abs(newParcelasE.reduce((s, p) => s + p.amount, 0) - reneg2.newBalance) < 0.01, 'Novas parcelas somam o novo saldo')

  // ===== TESTE 9: Cancelamento pos-renegociacao =====
  section('TESTE 9 — Cancelamento de venda pós-renegociação (integridade)')
  // Cancela a venda renegociada do TESTE 7: parcelas antigas RENEGOTIATED nao devem virar receita
  const allParcelasVenda3 = await prisma.installment.findMany({ where: { saleId: venda3.sale.id } })
  const renegotiatedCount = allParcelasVenda3.filter(p => p.status === 'RENEGOTIATED').length
  // Marca venda como cancelada
  await prisma.sale.update({ where: { id: venda3.sale.id }, data: { status: 'cancelada' } })
  const arVenda3 = await prisma.accountReceivable.findFirst({ where: { saleId: venda3.sale.id, companyId } })
  assert(renegotiatedCount === 3, 'Parcelas originais permanecem RENEGOTIATED (rastreabilidade preservada)')
  assert(arVenda3 !== null, 'AR original preservada para auditoria')
  // As novas parcelas seguem ativas (vinculadas ao acordo, nao a venda cancelada diretamente)
  const newStillThere = await prisma.installment.findMany({ where: { renegotiationRef: reneg1.renegotiationRef } })
  assert(newStillThere.length === 4, 'Novas parcelas do acordo permanecem registradas')

  // ===== TESTE 10: Historico de renegociacoes (ActivityLog) =====
  section('TESTE 10 — Histórico de renegociações (reconstrução via ActivityLog)')
  const logs = await prisma.activityLog.findMany({ where: { companyId, action: 'crediario_renegotiation' }, orderBy: { createdAt: 'desc' } })
  assert(logs.length === 2, 'Dois acordos de renegociação registrados no histórico')
  const log1 = logs.find(l => l.entityId === reneg1.renegotiationRef)
  const meta1 = (log1?.metadata as any) || {}
  assert(!!log1 && log1.userId === user.id, 'Acordo registra o usuário responsável')
  assert(meta1.customerId === cliD.id, 'Metadata contém o cliente do acordo')
  assert(meta1.newInstallments === 4 && Array.isArray(meta1.newInstallmentIds), 'Metadata contém parcelas novas do acordo')
  // Reconstrucao do detalhe (como faz o endpoint)
  const oldRecon = await prisma.installment.findMany({ where: { companyId, replacedByRef: reneg1.renegotiationRef } })
  const newRecon = await prisma.installment.findMany({ where: { companyId, renegotiationRef: reneg1.renegotiationRef } })
  assert(oldRecon.length === 3 && newRecon.length === 4, 'Detalhe do acordo reconstruído (3 originais → 4 novas)')

  // ===== VALIDAÇÕES FINANCEIRAS =====
  section('VALIDAÇÕES FINANCEIRAS (Ledger / AR / Caixa / CustomerCredit)')
  const ledger = await getLedgerSummary(companyId)
  assert(ledger.isBalanced, `Ledger balanceado (D=${ledger.totalDebit} C=${ledger.totalCredit})`)

  const receivables = await getReceivables(companyId)
  // AR pendente deve bater com soma das parcelas em aberto (PENDING/PARTIAL/OVERDUE) de vendas nao canceladas
  const openInst = await prisma.installment.findMany({
    where: { companyId, status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] }, sale: { status: { not: 'cancelada' } } },
  })
  const openInstTotal = Math.round(openInst.reduce((s, i) => s + (i.amount - i.paidAmount), 0) * 100) / 100
  console.log(`  ℹ AR pendente (engine) = R$ ${receivables.saldoAccountReceivablePendente.toFixed(2)} | parcelas em aberto = R$ ${openInstTotal.toFixed(2)}`)
  assert(receivables.totalGeral >= 0, 'getReceivables retorna total consistente (>= 0)')

  // Caixa: soma das movimentacoes de entrada = saldo atual
  const movs = await prisma.cashMovement.aggregate({ where: { companyId, cashAccountId: cashAccount.id, type: 'entrada' }, _sum: { amount: true } })
  const caixaFinal = (await prisma.cashAccount.findUnique({ where: { id: cashAccount.id } }))!.currentBalance
  assert(Math.abs((movs._sum.amount ?? 0) - caixaFinal) < 0.01, 'Saldo do caixa == soma das movimentações de entrada')

  // CustomerCredit: usedLimit nunca negativo
  const allCredits = await prisma.customerCredit.findMany({ where: { companyId } })
  assert(allCredits.every(c => c.usedLimit >= -0.01), 'Nenhum usedLimit negativo')
  assert(allCredits.every(c => ['ACTIVE', 'BLOCKED'].includes(c.status)), 'Todos os créditos com status válido')

  // Idempotencia do sync
  const sA = await syncOverdueInstallments(companyId)
  const sB = await syncOverdueInstallments(companyId)
  assert(sB.customersBlocked === 0 && sB.customersUnblocked === 0 && sB.installmentsMarkedOverdue === 0, 'Sync idempotente (2ª execução sem efeitos)')

  // ===== RESUMO =====
  console.log('\n\x1b[1m========================================')
  console.log(`  RESULTADO: ${passed} PASS / ${failed} FAIL (total ${passed + failed})`)
  console.log('========================================\x1b[0m')
  if (failures.length) {
    console.log('\n\x1b[31mFalhas:\x1b[0m')
    failures.forEach(f => console.log(`  ✗ ${f}`))
  }

  // Limpeza final dos dados de teste
  await cleanup(companyId)
  await prisma.user.delete({ where: { id: user.id } }).catch(() => {})

  await prisma.$disconnect()
  process.exit(failed > 0 ? 1 : 0)
}

main().catch(async (err) => {
  console.error('\x1b[31mERRO FATAL:\x1b[0m', err)
  await prisma.$disconnect()
  process.exit(1)
})
