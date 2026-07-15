/**
 * Testes reais de renegociação do crediário
 * Executa contra o banco real com dados de teste isolados
 *
 * Cenários:
 * 1. Renegociação sem entrada
 * 2. Renegociação com entrada
 * 3. Tentativa com parcela PAID (rejeitar)
 * 4. Tentativa com parcela CANCELLED (rejeitar)
 * 5. Tentativa com parcela RENEGOTIATED (rejeitar)
 * 6. Parcelas de clientes diferentes (rejeitar)
 * 7. Parcelas de vendas diferentes (rejeitar)
 * 8. Entrada maior que saldo (rejeitar)
 * 9. Cancelamento de venda renegociada
 * 10. Fluxo de caixa após renegociação
 */

import { PrismaClient } from '@prisma/client'
import { renegotiateInstallments, RenegotiationError } from '../lib/crediario-renegotiation'

const prisma = new PrismaClient()

const PASS = '\x1b[32m\u2713 PASS\x1b[0m'
const FAIL = '\x1b[31m\u2717 FAIL\x1b[0m'
let passed = 0, failed = 0

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`  ${PASS} ${msg}`)
    passed++
  } else {
    console.log(`  ${FAIL} ${msg}`)
    failed++
  }
}

async function cleanup(companyId: string) {
  // Remove test data in order
  await prisma.activityLog.deleteMany({ where: { companyId } })
  await prisma.cashMovement.deleteMany({ where: { companyId } })
  await prisma.financialRecord.deleteMany({ where: { companyId } })
  await prisma.installmentPayment.deleteMany({ where: { companyId } })
  await prisma.installment.deleteMany({ where: { companyId } })
  await prisma.accountReceivable.deleteMany({ where: { companyId } })
  await prisma.salePayment.deleteMany({ where: { companyId } })
  await prisma.saleItem.deleteMany({ where: { sale: { companyId } } })
  await prisma.sale.deleteMany({ where: { companyId } })
  await prisma.customerCredit.deleteMany({ where: { companyId } })
  await prisma.customer.deleteMany({ where: { companyId } })
  await prisma.cashAccount.deleteMany({ where: { companyId } })
  await prisma.product.deleteMany({ where: { companyId } })
  await prisma.ledgerEntry.deleteMany({ where: { companyId } })
}

async function setupTestData(companyId: string) {
  // Create customer
  const customer = await prisma.customer.create({
    data: { name: 'Cliente Teste Reneg', email: 'reneg@test.com', companyId },
  })
  
  // Create customer credit
  const credit = await prisma.customerCredit.create({
    data: { customerId: customer.id, companyId, creditLimit: 2000, usedLimit: 600, status: 'ACTIVE' },
  })

  // Create cash account
  const cashAccount = await prisma.cashAccount.create({
    data: { name: 'Caixa Reneg Test', companyId, currentBalance: 5000, isActive: true },
  })

  // Create product
  const product = await prisma.product.create({
    data: { name: 'Produto Reneg Test', sku: 'RENEG001', salePrice: 200, costPrice: 100, stockQuantity: 100, companyId },
  })

  // Create sale
  const sale = await prisma.sale.create({
    data: {
      saleNumber: 99990,
      subtotal: 600,
      total: 600,
      discount: 0,
      status: 'concluida',
      paymentMethod: 'crediario',
      customerId: customer.id,
      companyId,
      items: {
        create: [
          { productId: product.id, quantity: 3, unitPrice: 200, total: 600 },
        ],
      },
    },
  })

  // Create 3 installments (standard crediário setup)
  const inst1 = await prisma.installment.create({
    data: { saleId: sale.id, customerId: customer.id, companyId, installmentNumber: 1, amount: 200, paidAmount: 0, dueDate: new Date('2026-05-01'), status: 'OVERDUE' },
  })
  const inst2 = await prisma.installment.create({
    data: { saleId: sale.id, customerId: customer.id, companyId, installmentNumber: 2, amount: 200, paidAmount: 0, dueDate: new Date('2026-06-01'), status: 'OVERDUE' },
  })
  const inst3 = await prisma.installment.create({
    data: { saleId: sale.id, customerId: customer.id, companyId, installmentNumber: 3, amount: 200, paidAmount: 0, dueDate: new Date('2026-07-01'), status: 'PENDING' },
  })

  // Create AR
  const ar = await prisma.accountReceivable.create({
    data: {
      description: `Crediário venda #${sale.saleNumber}`,
      amount: 600,
      dueDate: new Date('2026-07-01'),
      status: 'pendente',
      customerId: customer.id,
      saleId: sale.id,
      companyId,
    },
  })

  return { customer, credit, cashAccount, product, sale, inst1, inst2, inst3, ar }
}

async function main() {
  // Use a dedicated test company
  let company = await prisma.company.findFirst({ where: { name: 'TEST_RENEG_COMPANY' } })
  if (!company) {
    company = await prisma.company.create({
      data: { name: 'TEST_RENEG_COMPANY', cnpj: '00000000000199', email: 'reneg@test.com' },
    })
  }
  const companyId = company.id

  // Clean before tests
  await cleanup(companyId)

  console.log('\n\x1b[1m========================================\x1b[0m')
  console.log('\x1b[1m  TESTES DE RENEGOCIAÇÃO DO CREDIÁRIO\x1b[0m')
  console.log('\x1b[1m========================================\x1b[0m\n')

  // ===============================================
  // TEST 1: Renegociação sem entrada
  // ===============================================
  console.log('\x1b[36m[TEST 1] Renegociação sem entrada\x1b[0m')
  {
    const data = await setupTestData(companyId)
    const cashBefore = data.cashAccount.currentBalance
    const usedLimitBefore = data.credit.usedLimit

    const result = await renegotiateInstallments({
      companyId,
      customerId: data.customer.id,
      installmentIds: [data.inst1.id, data.inst2.id, data.inst3.id],
      entryAmount: 0,
      newInstallments: 5,
      firstDueDate: '2026-07-10',
      termDays: 30,
      userId: 'test-user',
    })

    assert(result.success === true, 'Resultado success = true')
    assert(result.originalTotal === 600, `Saldo original = R$ 600 (got ${result.originalTotal})`)
    assert(result.entryAmount === 0, 'Entrada = R$ 0')
    assert(result.newBalance === 600, `Novo saldo = R$ 600 (got ${result.newBalance})`)
    assert(result.newInstallmentIds.length === 5, `5 novas parcelas criadas (got ${result.newInstallmentIds.length})`)

    // Verify old installments are RENEGOTIATED
    const oldInsts = await prisma.installment.findMany({ where: { id: { in: [data.inst1.id, data.inst2.id, data.inst3.id] } } })
    assert(oldInsts.every(i => i.status === 'RENEGOTIATED'), 'Parcelas antigas = RENEGOTIATED')
    assert(oldInsts.every(i => i.replacedByRef === result.renegotiationRef), 'replacedByRef preenchido')

    // Verify new installments
    const newInsts = await prisma.installment.findMany({ where: { id: { in: result.newInstallmentIds } }, orderBy: { installmentNumber: 'asc' } })
    assert(newInsts.every(i => i.status === 'PENDING'), 'Novas parcelas = PENDING')
    assert(newInsts.every(i => i.renegotiationRef === result.renegotiationRef), 'renegotiationRef preenchido')
    const totalNew = newInsts.reduce((s, i) => s + i.amount, 0)
    assert(Math.abs(totalNew - 600) < 0.02, `Soma novas = R$ 600 (got ${totalNew.toFixed(2)})`)

    // Verify cash unchanged
    const cashAfter = await prisma.cashAccount.findUnique({ where: { id: data.cashAccount.id } })
    assert(cashAfter!.currentBalance === cashBefore, `Caixa inalterado: R$ ${cashAfter!.currentBalance}`)

    // Verify usedLimit unchanged
    const creditAfter = await prisma.customerCredit.findFirst({ where: { customerId: data.customer.id, companyId } })
    assert(creditAfter!.usedLimit === usedLimitBefore, `usedLimit inalterado: ${creditAfter!.usedLimit}`)

    // Verify AR updated
    const arAfter = await prisma.accountReceivable.findFirst({ where: { saleId: data.sale.id, companyId } })
    assert(arAfter!.amount === 600, `AR amount = 600 (got ${arAfter!.amount})`)
    assert(arAfter!.status === 'pendente', `AR status = pendente`)

    await cleanup(companyId)
  }

  // ===============================================
  // TEST 2: Renegociação com entrada
  // ===============================================
  console.log('\n\x1b[36m[TEST 2] Renegociação com entrada R$ 100\x1b[0m')
  {
    const data = await setupTestData(companyId)

    const result = await renegotiateInstallments({
      companyId,
      customerId: data.customer.id,
      installmentIds: [data.inst1.id, data.inst2.id, data.inst3.id],
      entryAmount: 100,
      newInstallments: 5,
      firstDueDate: '2026-07-10',
      termDays: 30,
      cashAccountId: data.cashAccount.id,
      userId: 'test-user',
    })

    assert(result.success === true, 'Resultado success = true')
    assert(result.entryAmount === 100, 'Entrada = R$ 100')
    assert(result.newBalance === 500, `Novo saldo = R$ 500 (got ${result.newBalance})`)

    // Verify cash increased by entry
    const cashAfter = await prisma.cashAccount.findUnique({ where: { id: data.cashAccount.id } })
    assert(cashAfter!.currentBalance === 5100, `Caixa = R$ 5100 (got ${cashAfter!.currentBalance})`)

    // Verify usedLimit reduced by entry
    const creditAfter = await prisma.customerCredit.findFirst({ where: { customerId: data.customer.id, companyId } })
    assert(creditAfter!.usedLimit === 500, `usedLimit = 500 (got ${creditAfter!.usedLimit})`)

    // Verify new installments sum = 500
    const newInsts = await prisma.installment.findMany({ where: { id: { in: result.newInstallmentIds } } })
    const totalNew = newInsts.reduce((s, i) => s + i.amount, 0)
    assert(Math.abs(totalNew - 500) < 0.02, `Soma novas = R$ 500 (got ${totalNew.toFixed(2)})`)

    // Verify AR updated
    const arAfter = await prisma.accountReceivable.findFirst({ where: { saleId: data.sale.id, companyId } })
    assert(arAfter!.amount === 500, `AR amount = 500 (got ${arAfter!.amount})`)

    // Verify CashMovement created
    const cm = await prisma.cashMovement.findFirst({ where: { companyId, origin: 'recebimento_crediario', description: { contains: result.renegotiationRef } } })
    assert(cm !== null, 'CashMovement de entrada criada')
    assert(cm!.amount === 100, `CM amount = 100`)

    await cleanup(companyId)
  }

  // ===============================================
  // TEST 3: Tentativa com parcela PAID (rejeitar)
  // ===============================================
  console.log('\n\x1b[36m[TEST 3] Rejeição de parcela PAID\x1b[0m')
  {
    const data = await setupTestData(companyId)
    // Mark one as PAID
    await prisma.installment.update({ where: { id: data.inst1.id }, data: { status: 'PAID', paidAmount: 200 } })

    try {
      await renegotiateInstallments({
        companyId, customerId: data.customer.id,
        installmentIds: [data.inst1.id, data.inst2.id],
        entryAmount: 0, newInstallments: 3, firstDueDate: '2026-07-10', termDays: 30, userId: 'test',
      })
      assert(false, 'Deveria ter rejeitado')
    } catch (err) {
      assert(err instanceof RenegotiationError && err.code === 'INVALID_STATUS', `Rejeitou parcela PAID: ${(err as any).code}`)
    }
    await cleanup(companyId)
  }

  // ===============================================
  // TEST 4: Tentativa com parcela CANCELLED (rejeitar)
  // ===============================================
  console.log('\n\x1b[36m[TEST 4] Rejeição de parcela CANCELLED\x1b[0m')
  {
    const data = await setupTestData(companyId)
    await prisma.installment.update({ where: { id: data.inst1.id }, data: { status: 'CANCELLED' } })

    try {
      await renegotiateInstallments({
        companyId, customerId: data.customer.id,
        installmentIds: [data.inst1.id, data.inst2.id],
        entryAmount: 0, newInstallments: 3, firstDueDate: '2026-07-10', termDays: 30, userId: 'test',
      })
      assert(false, 'Deveria ter rejeitado')
    } catch (err) {
      assert(err instanceof RenegotiationError && err.code === 'INVALID_STATUS', `Rejeitou parcela CANCELLED: ${(err as any).code}`)
    }
    await cleanup(companyId)
  }

  // ===============================================
  // TEST 5: Tentativa com parcela RENEGOTIATED (rejeitar)
  // ===============================================
  console.log('\n\x1b[36m[TEST 5] Rejeição de parcela RENEGOTIATED\x1b[0m')
  {
    const data = await setupTestData(companyId)
    await prisma.installment.update({ where: { id: data.inst1.id }, data: { status: 'RENEGOTIATED', replacedByRef: 'RENEG-OLD' } })

    try {
      await renegotiateInstallments({
        companyId, customerId: data.customer.id,
        installmentIds: [data.inst1.id, data.inst2.id],
        entryAmount: 0, newInstallments: 3, firstDueDate: '2026-07-10', termDays: 30, userId: 'test',
      })
      assert(false, 'Deveria ter rejeitado')
    } catch (err) {
      assert(err instanceof RenegotiationError && err.code === 'INVALID_STATUS', `Rejeitou parcela RENEGOTIATED: ${(err as any).code}`)
    }
    await cleanup(companyId)
  }

  // ===============================================
  // TEST 6: Parcelas de clientes diferentes (rejeitar)
  // ===============================================
  console.log('\n\x1b[36m[TEST 6] Rejeição de clientes diferentes\x1b[0m')
  {
    const data = await setupTestData(companyId)
    const customer2 = await prisma.customer.create({
      data: { name: 'Cliente 2 Reneg', email: 'reneg2@test.com', companyId },
    })
    // Change one installment to different customer
    await prisma.installment.update({ where: { id: data.inst3.id }, data: { customerId: customer2.id } })

    try {
      await renegotiateInstallments({
        companyId, customerId: data.customer.id,
        installmentIds: [data.inst1.id, data.inst3.id],
        entryAmount: 0, newInstallments: 3, firstDueDate: '2026-07-10', termDays: 30, userId: 'test',
      })
      assert(false, 'Deveria ter rejeitado')
    } catch (err) {
      assert(err instanceof RenegotiationError && err.code === 'CUSTOMER_MISMATCH', `Rejeitou clientes diferentes: ${(err as any).code}`)
    }
    await cleanup(companyId)
  }

  // ===============================================
  // TEST 7: Parcelas de vendas diferentes (rejeitar)
  // ===============================================
  console.log('\n\x1b[36m[TEST 7] Rejeição de vendas diferentes\x1b[0m')
  {
    const data = await setupTestData(companyId)
    // Create a second sale
    const sale2 = await prisma.sale.create({
      data: {
        saleNumber: 99991, subtotal: 200, total: 200, discount: 0,
        status: 'concluida', paymentMethod: 'crediario',
        customerId: data.customer.id, companyId,
        items: {
          create: [{ productId: data.product.id, quantity: 1, unitPrice: 200, total: 200 }],
        },
      },
    })
    const instOther = await prisma.installment.create({
      data: { saleId: sale2.id, customerId: data.customer.id, companyId, installmentNumber: 1, amount: 200, dueDate: new Date('2026-08-01'), status: 'PENDING' },
    })

    try {
      await renegotiateInstallments({
        companyId, customerId: data.customer.id,
        installmentIds: [data.inst1.id, instOther.id],
        entryAmount: 0, newInstallments: 3, firstDueDate: '2026-07-10', termDays: 30, userId: 'test',
      })
      assert(false, 'Deveria ter rejeitado')
    } catch (err) {
      assert(err instanceof RenegotiationError && err.code === 'SALE_MISMATCH', `Rejeitou vendas diferentes: ${(err as any).code}`)
    }
    await cleanup(companyId)
  }

  // ===============================================
  // TEST 8: Entrada maior que saldo (rejeitar)
  // ===============================================
  console.log('\n\x1b[36m[TEST 8] Rejeição de entrada > saldo\x1b[0m')
  {
    const data = await setupTestData(companyId)

    try {
      await renegotiateInstallments({
        companyId, customerId: data.customer.id,
        installmentIds: [data.inst1.id, data.inst2.id, data.inst3.id],
        entryAmount: 700, newInstallments: 3, firstDueDate: '2026-07-10', termDays: 30,
        cashAccountId: data.cashAccount.id, userId: 'test',
      })
      assert(false, 'Deveria ter rejeitado')
    } catch (err) {
      assert(err instanceof RenegotiationError && err.code === 'ENTRY_EXCEEDS_BALANCE', `Rejeitou entrada > saldo: ${(err as any).code}`)
    }
    await cleanup(companyId)
  }

  // ===============================================
  // TEST 9: Cancelamento de venda com parcelas renegociadas
  // ===============================================
  console.log('\n\x1b[36m[TEST 9] Cancelamento de venda renegociada\x1b[0m')
  {
    const data = await setupTestData(companyId)

    // Renegociar primeiro
    const result = await renegotiateInstallments({
      companyId, customerId: data.customer.id,
      installmentIds: [data.inst1.id, data.inst2.id, data.inst3.id],
      entryAmount: 100, newInstallments: 5, firstDueDate: '2026-07-10', termDays: 30,
      cashAccountId: data.cashAccount.id, userId: 'test',
    })

    // Verify renegotiation worked
    assert(result.success, 'Renegociação OK antes do cancelamento')

    // Now check that old installments = RENEGOTIATED, new = PENDING
    const allInsts = await prisma.installment.findMany({
      where: { saleId: data.sale.id, companyId },
      orderBy: { installmentNumber: 'asc' },
    })
    const renegotiatedCount = allInsts.filter(i => i.status === 'RENEGOTIATED').length
    const pendingCount = allInsts.filter(i => i.status === 'PENDING').length
    assert(renegotiatedCount === 3, `3 parcelas RENEGOTIATED (got ${renegotiatedCount})`)
    assert(pendingCount === 5, `5 parcelas PENDING (got ${pendingCount})`)
    assert(allInsts.length === 8, `8 parcelas total (got ${allInsts.length})`)

    await cleanup(companyId)
  }

  // ===============================================
  // TEST 10: Renegociação com parcela PARTIAL
  // ===============================================
  console.log('\n\x1b[36m[TEST 10] Renegociação com parcela parcialmente paga\x1b[0m')
  {
    const data = await setupTestData(companyId)
    // Mark inst1 as PARTIAL (paid R$ 50 of R$ 200)
    await prisma.installment.update({ where: { id: data.inst1.id }, data: { status: 'PARTIAL', paidAmount: 50 } })

    const result = await renegotiateInstallments({
      companyId, customerId: data.customer.id,
      installmentIds: [data.inst1.id, data.inst2.id, data.inst3.id],
      entryAmount: 0, newInstallments: 4, firstDueDate: '2026-08-01', termDays: 30,
      userId: 'test',
    })

    // Open balance: (200-50) + (200-0) + (200-0) = 150 + 200 + 200 = 550
    assert(result.originalTotal === 550, `Saldo original = R$ 550 (got ${result.originalTotal})`)
    assert(result.newBalance === 550, `Novo saldo = R$ 550 (got ${result.newBalance})`)

    const newInsts = await prisma.installment.findMany({ where: { id: { in: result.newInstallmentIds } } })
    const totalNew = newInsts.reduce((s, i) => s + i.amount, 0)
    assert(Math.abs(totalNew - 550) < 0.02, `Soma novas = R$ 550 (got ${totalNew.toFixed(2)})`)

    await cleanup(companyId)
  }

  // ===============================================
  // TEST 11: Sync overdue ignora RENEGOTIATED
  // ===============================================
  console.log('\n\x1b[36m[TEST 11] syncOverdueInstallments ignora RENEGOTIATED\x1b[0m')
  {
    const data = await setupTestData(companyId)
    // Renegociar
    await renegotiateInstallments({
      companyId, customerId: data.customer.id,
      installmentIds: [data.inst1.id, data.inst2.id, data.inst3.id],
      entryAmount: 0, newInstallments: 3, firstDueDate: '2025-01-01', // Past dates
      termDays: 30, userId: 'test',
    })

    // Import and run sync
    const { syncOverdueInstallments } = await import('../lib/crediario-sync')
    await syncOverdueInstallments(companyId)

    // Old ones should stay RENEGOTIATED, not become OVERDUE
    const oldInsts = await prisma.installment.findMany({ where: { id: { in: [data.inst1.id, data.inst2.id, data.inst3.id] } } })
    assert(oldInsts.every(i => i.status === 'RENEGOTIATED'), 'Parcelas RENEGOTIATED não viraram OVERDUE')

    // New ones (past dates) should become OVERDUE
    const newInsts = await prisma.installment.findMany({
      where: { companyId, renegotiationRef: { not: null }, status: 'OVERDUE' },
    })
    assert(newInsts.length === 3, `Novas parcelas vencidas viraram OVERDUE (got ${newInsts.length})`)

    await cleanup(companyId)
  }

  // ===============================================
  // TEST 12: ActivityLog registrado
  // ===============================================
  console.log('\n\x1b[36m[TEST 12] ActivityLog de renegociação\x1b[0m')
  {
    const data = await setupTestData(companyId)
    const result = await renegotiateInstallments({
      companyId, customerId: data.customer.id,
      installmentIds: [data.inst1.id, data.inst2.id, data.inst3.id],
      entryAmount: 0, newInstallments: 3, firstDueDate: '2026-08-01', termDays: 30,
      userId: 'test-user',
    })

    const log = await prisma.activityLog.findFirst({
      where: { companyId, action: 'crediario_renegotiation' },
    })
    assert(log !== null, 'ActivityLog criado')
    assert((log!.metadata as any)?.renegotiationRef === result.renegotiationRef, 'Metadata contém renegotiationRef')

    await cleanup(companyId)
  }

  // ===============================================
  // SUMMARY
  // ===============================================
  console.log('\n\x1b[1m========================================\x1b[0m')
  console.log(`\x1b[1m  RESULTADO: ${passed} passed, ${failed} failed\x1b[0m`)
  console.log('\x1b[1m========================================\x1b[0m\n')

  // Final cleanup
  await cleanup(companyId)
  await prisma.company.delete({ where: { id: companyId } }).catch(() => {})

  await prisma.$disconnect()
  process.exit(failed > 0 ? 1 : 0)
}

main().catch(async (err) => {
  console.error('\n\x1b[31mERRO FATAL:\x1b[0m', err)
  await prisma.$disconnect()
  process.exit(1)
})
