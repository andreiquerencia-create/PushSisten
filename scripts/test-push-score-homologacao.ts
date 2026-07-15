/**
 * HOMOLOGAÇÃO DA ENGINE DO PUSH SCORE™ — PushSistem
 * Executa contra o banco real, em empresas de teste ISOLADAS
 * (TEST_PUSHSCORE_A / _B / _C / _D). Não toca dados de outras empresas.
 *
 * Cenários obrigatórios:
 *   A) Loja excelente  → score >= 80  (SAUDAVEL/ESTAVEL)
 *   B) Loja média      → score 55-80
 *   C) Loja crítica    → score < 40   (CRITICO/RISCO)
 *   D) Empresa nova    → status EM_FORMACAO (score = null)
 *
 * Valida ainda: subscores normalizados, classificação por faixa,
 * persistência do snapshot (upsert), repesagem dinâmica (empresa sem
 * crediário) e regra EM_FORMACAO.
 */

import { PrismaClient } from '@prisma/client'
import { seedAccountPlanForCompany } from '../lib/account-plan-seed'
import {
  generatePushScoreSnapshot,
  computePushScore,
  classifyScore,
  MIN_OPERATION_DAYS,
  MIN_SALES,
} from '../lib/push-score-engine'

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

let saleSeq = 700000

async function cleanup(companyId: string) {
  await prisma.pushScoreSnapshot.deleteMany({ where: { companyId } })
  await prisma.pushScoreConfig.deleteMany({ where: { companyId } })
  await prisma.installmentPayment.deleteMany({ where: { companyId } })
  await prisma.installment.deleteMany({ where: { companyId } })
  await prisma.cashMovement.deleteMany({ where: { companyId } })
  await prisma.financialRecord.deleteMany({ where: { companyId } })
  await prisma.accountReceivable.deleteMany({ where: { companyId } })
  await prisma.accountPayable.deleteMany({ where: { companyId } })
  await prisma.salePayment.deleteMany({ where: { companyId } })
  await prisma.saleItem.deleteMany({ where: { sale: { companyId } } })
  await prisma.sale.deleteMany({ where: { companyId } })
  await prisma.customerCredit.deleteMany({ where: { companyId } })
  await prisma.customer.deleteMany({ where: { companyId } })
  await prisma.cashAccount.deleteMany({ where: { companyId } })
  await prisma.product.deleteMany({ where: { companyId } })
  await prisma.accountPlan.deleteMany({ where: { companyId } })
}

async function ensureCompany(name: string, createdAt: Date): Promise<string> {
  let company = await prisma.company.findFirst({ where: { name } })
  if (!company) {
    company = await prisma.company.create({
      data: { name, cnpj: `PS${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(0, 18), email: `${name.toLowerCase()}@test.com`, createdAt },
    })
  } else {
    company = await prisma.company.update({ where: { id: company.id }, data: { createdAt } })
  }
  return company.id
}

/** Cria produto com custo médio e estoque. */
async function createProduct(companyId: string, name: string, avgCost: number, stock: number, minStock = 0) {
  return prisma.product.create({
    data: { name, companyId, avgCost, costPrice: avgCost, salePrice: avgCost * 2, stockQuantity: stock, minStock, isActive: true },
  })
}

/** Cria uma venda concluída com 1 item (controla faturamento e CMV). */
async function createSale(opts: {
  companyId: string; customerId?: string; productId: string;
  qty: number; unitPrice: number; date: Date;
}) {
  const { companyId, customerId, productId, qty, unitPrice, date } = opts
  const total = qty * unitPrice
  const sale = await prisma.sale.create({
    data: {
      saleNumber: saleSeq++, subtotal: total, total, discount: 0,
      status: 'concluida', paymentMethod: 'dinheiro', companyId, customerId,
      createdAt: date, updatedAt: date,
    },
  })
  await prisma.saleItem.create({
    data: { saleId: sale.id, productId, quantity: qty, unitPrice, total },
  })
  return sale
}

/** Cria registro de despesa operacional (entra na DRE e no burn de liquidez). */
async function createExpense(companyId: string, accountPlanId: string, amount: number, date: Date) {
  return prisma.financialRecord.create({
    data: {
      description: 'Despesa operacional teste', amount, type: 'saida',
      accountPlanId, companyId, date, reference: 'teste_pushscore',
    },
  })
}

async function getAdminAccountPlanId(companyId: string): Promise<string> {
  const ap = await prisma.accountPlan.findFirst({ where: { companyId, code: '3.1' } })
  if (!ap) throw new Error('AccountPlan 3.1 (Despesas Administrativas) não encontrado')
  return ap.id
}

// datas
const now = new Date()
const daysAgo = (d: number) => new Date(now.getTime() - d * 86400000)
const prevMonth15 = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 15, 12, 0, 0))
const thisMonthDay = (day: number) => {
  // garante data dentro do mês corrente e <= now
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), Math.min(day, now.getUTCDate()), 12, 0, 0))
  return d.getTime() > now.getTime() ? now : d
}

// ============================================================
// CENÁRIO A — LOJA EXCELENTE (score >= 80)
// ============================================================
async function scenarioA() {
  section('CENÁRIO A — Loja excelente (esperado: score >= 80)')
  const companyId = await ensureCompany('TEST_PUSHSCORE_A', daysAgo(400))
  await cleanup(companyId)
  await seedAccountPlanForCompany(companyId)
  const apId = await getAdminAccountPlanId(companyId)

  // Caixa robusto → cobertura alta
  await prisma.cashAccount.create({ data: { name: 'Caixa A', companyId, currentBalance: 30000, isActive: true } })

  // Produtos (todos vendidos recentemente → sem capital parado), giro alto
  const p1 = await createProduct(companyId, 'Camiseta A', 100, 40)
  const p2 = await createProduct(companyId, 'Calça A', 100, 40)
  // capitalInvestido = 100*40 + 100*40 = 8000

  // Clientes: todos ativos e recorrentes
  const custs: { id: string }[] = []
  for (let i = 0; i < 5; i++) {
    custs.push(await prisma.customer.create({
      data: { name: `Cliente A${i}`, companyId, isActive: true, lastPurchase: daysAgo(5), purchaseCount: 4 },
    }))
  }

  // Vendas mês corrente: 12 vendas, CMV baixo, margem alta
  // cada venda: qty=5 do p1 (avgCost100→CMV500), unitPrice=200 → total 1000
  for (let i = 0; i < 12; i++) {
    await createSale({ companyId, customerId: custs[i % 5].id, productId: i % 2 === 0 ? p1.id : p2.id, qty: 5, unitPrice: 200, date: thisMonthDay(2 + i % 5) })
  }
  // receita corrente ~12000, CMV ~6000

  // Vendas mês anterior (para crescimento +): 8 vendas total 8000 (< corrente)
  for (let i = 0; i < 8; i++) {
    await createSale({ companyId, customerId: custs[i % 5].id, productId: p1.id, qty: 5, unitPrice: 200, date: prevMonth15 })
  }

  // Despesas operacionais baixas (margem alta + burn baixo)
  await createExpense(companyId, apId, 1500, daysAgo(3))

  // Crediário saudável (sem vencidos) → inadimplência 0
  await prisma.installment.create({
    data: { companyId, customerId: custs[0].id, saleId: (await prisma.sale.findFirst({ where: { companyId } }))!.id, installmentNumber: 1, amount: 500, paidAmount: 0, dueDate: daysAgo(-30), status: 'PENDING' },
  })

  const r = await generatePushScoreSnapshot(companyId, now)
  console.log('   →', JSON.stringify({ status: r.status, score: r.score, classification: r.classification, subscores: r.subscores }, null, 0))
  assert(r.status === 'ATIVO', 'A: status ATIVO (não EM_FORMACAO)')
  assert(r.score !== null && r.score >= 80, `A: score >= 80 (obtido ${r.score})`)
  assert(['SAUDAVEL', 'ESTAVEL'].includes(r.classification ?? ''), `A: classificação SAUDAVEL/ESTAVEL (obtido ${r.classification})`)
  assert((r.subscores.rentabilityScore ?? 0) >= 70, 'A: rentabilidade alta')
  assert((r.subscores.customerBaseScore ?? 0) >= 70, 'A: base de clientes alta')
  return companyId
}

// ============================================================
// CENÁRIO B — LOJA MÉDIA (score 55-80)
// ============================================================
async function scenarioB() {
  section('CENÁRIO B — Loja média (esperado: 55-80)')
  const companyId = await ensureCompany('TEST_PUSHSCORE_B', daysAgo(400))
  await cleanup(companyId)
  await seedAccountPlanForCompany(companyId)
  const apId = await getAdminAccountPlanId(companyId)

  // Caixa: cobertura ~1,5 mes (burn 2000 → cash 3000)
  await prisma.cashAccount.create({ data: { name: 'Caixa B', companyId, currentBalance: 3000, isActive: true } })

  // Estoque: giro medio + capital parado moderado
  const p1 = await createProduct(companyId, 'Camiseta B', 100, 30) // vendido (giro)
  const pStag = await createProduct(companyId, 'Parado B', 100, 18) // nunca vendido → parado ~37%
  // capitalInvestido = 3000 + 1800 = 4800; parado = 1800 → ~37%

  // Clientes: ~60% ativos, ~30% recorrentes
  const custs: { id: string }[] = []
  for (let i = 0; i < 5; i++) {
    custs.push(await prisma.customer.create({
      data: {
        name: `Cliente B${i}`, companyId, isActive: true,
        lastPurchase: i < 3 ? daysAgo(10) : daysAgo(200),
        purchaseCount: i < 2 ? 3 : 1,
      },
    }))
  }

  // Vendas mês corrente: 12 vendas, margem ~15%
  // total 1000 cada (qty5 * 200), CMV 500 (avgCost100*5). expenses ajustam margem.
  for (let i = 0; i < 12; i++) {
    await createSale({ companyId, customerId: custs[i % 5].id, productId: p1.id, qty: 5, unitPrice: 200, date: thisMonthDay(2 + i % 5) })
  }
  // receita 12000, CMV 6000

  // Mês anterior: faturamento próximo (crescimento ~modesto). 11 vendas ~11000
  for (let i = 0; i < 11; i++) {
    await createSale({ companyId, customerId: custs[i % 5].id, productId: p1.id, qty: 5, unitPrice: 200, date: prevMonth15 })
  }

  // Despesas para margem ~12-15%: lucro = 12000-6000-expenses; p/ margem 15% → lucro 1800 → expenses 4200
  await createExpense(companyId, apId, 4200, daysAgo(3))
  // burn last30 ~4200 → cashMonths = 3000/4200 ~0.71

  // Crediário com inadimplência moderada (~5%)
  const saleForInst = (await prisma.sale.findFirst({ where: { companyId } }))!
  await prisma.installment.create({ data: { companyId, customerId: custs[0].id, saleId: saleForInst.id, installmentNumber: 1, amount: 950, paidAmount: 0, dueDate: daysAgo(-20), status: 'PENDING' } })
  await prisma.installment.create({ data: { companyId, customerId: custs[0].id, saleId: saleForInst.id, installmentNumber: 2, amount: 50, paidAmount: 0, dueDate: daysAgo(10), status: 'OVERDUE' } })

  const r = await generatePushScoreSnapshot(companyId, now)
  console.log('   →', JSON.stringify({ status: r.status, score: r.score, classification: r.classification, subscores: r.subscores }, null, 0))
  assert(r.status === 'ATIVO', 'B: status ATIVO')
  assert(r.score !== null && r.score >= 55 && r.score <= 80, `B: score entre 55 e 80 (obtido ${r.score})`)
  return companyId
}

// ============================================================
// CENÁRIO C — LOJA CRÍTICA (score < 40)
// ============================================================
async function scenarioC() {
  section('CENÁRIO C — Loja crítica (esperado: score < 40)')
  const companyId = await ensureCompany('TEST_PUSHSCORE_C', daysAgo(400))
  await cleanup(companyId)
  await seedAccountPlanForCompany(companyId)
  const apId = await getAdminAccountPlanId(companyId)

  // Caixa quase zerado
  await prisma.cashAccount.create({ data: { name: 'Caixa C', companyId, currentBalance: 300, isActive: true } })

  // Pagáveis altos → projeção negativa
  await prisma.accountPayable.create({ data: { description: 'Fornecedor C', amount: 20000, dueDate: daysAgo(-15), status: 'pendente', companyId } })

  // Estoque: giro baixíssimo + muito capital parado
  const p1 = await createProduct(companyId, 'Vendido C', 100, 10) // pouco vendido
  await createProduct(companyId, 'Encalhe C1', 100, 100) // parado
  await createProduct(companyId, 'Encalhe C2', 100, 100) // parado
  // capitalInvestido = 1000 + 10000 + 10000 = 21000; parado = 20000 → ~95%

  // Clientes: maioria inativa, sem recorrência
  const custs: { id: string }[] = []
  for (let i = 0; i < 5; i++) {
    custs.push(await prisma.customer.create({
      data: { name: `Cliente C${i}`, companyId, isActive: true, lastPurchase: daysAgo(300), purchaseCount: 1 },
    }))
  }

  // Vendas mês corrente: 11 vendas margem NEGATIVA
  // total 1000 cada, CMV 800 (avgCost100, qty8). expenses altas.
  for (let i = 0; i < 11; i++) {
    await createSale({ companyId, customerId: custs[i % 5].id, productId: p1.id, qty: 8, unitPrice: 125, date: thisMonthDay(2 + i % 5) })
  }
  // receita 11000, CMV 8800

  // Mês anterior MUITO maior → queda forte (crescimento negativo)
  for (let i = 0; i < 20; i++) {
    await createSale({ companyId, customerId: custs[i % 5].id, productId: p1.id, qty: 8, unitPrice: 125, date: prevMonth15 })
  }
  // anterior 20000 vs atual 11000 → queda ~-45%

  // Despesas altíssimas → prejuízo
  await createExpense(companyId, apId, 6000, daysAgo(3))

  // Crediário com alta inadimplência (~70% vencido)
  const saleForInst = (await prisma.sale.findFirst({ where: { companyId } }))!
  await prisma.installment.create({ data: { companyId, customerId: custs[0].id, saleId: saleForInst.id, installmentNumber: 1, amount: 7000, paidAmount: 0, dueDate: daysAgo(40), status: 'OVERDUE' } })
  await prisma.installment.create({ data: { companyId, customerId: custs[1].id, saleId: saleForInst.id, installmentNumber: 2, amount: 3000, paidAmount: 0, dueDate: daysAgo(-30), status: 'PENDING' } })

  const r = await generatePushScoreSnapshot(companyId, now)
  console.log('   →', JSON.stringify({ status: r.status, score: r.score, classification: r.classification, subscores: r.subscores }, null, 0))
  assert(r.status === 'ATIVO', 'C: status ATIVO')
  assert(r.score !== null && r.score < 40, `C: score < 40 (obtido ${r.score})`)
  assert(['CRITICO', 'RISCO'].includes(r.classification ?? ''), `C: classificação CRITICO/RISCO (obtido ${r.classification})`)
  return companyId
}

// ============================================================
// CENÁRIO D — EMPRESA NOVA (EM_FORMACAO)
// ============================================================
async function scenarioD() {
  section('CENÁRIO D — Empresa nova (esperado: EM_FORMACAO)')
  const companyId = await ensureCompany('TEST_PUSHSCORE_D', daysAgo(5))
  await cleanup(companyId)
  await seedAccountPlanForCompany(companyId)

  await prisma.cashAccount.create({ data: { name: 'Caixa D', companyId, currentBalance: 5000, isActive: true } })
  const p1 = await createProduct(companyId, 'Produto D', 100, 20)
  const cust = await prisma.customer.create({ data: { name: 'Cliente D', companyId, isActive: true, lastPurchase: daysAgo(2), purchaseCount: 1 } })
  // Poucas vendas (< MIN_SALES) e empresa recente (< MIN_OPERATION_DAYS)
  for (let i = 0; i < 3; i++) {
    await createSale({ companyId, customerId: cust.id, productId: p1.id, qty: 2, unitPrice: 200, date: daysAgo(1) })
  }

  const r = await generatePushScoreSnapshot(companyId, now)
  console.log('   →', JSON.stringify({ status: r.status, score: r.score, raw: r.rawMetrics }, null, 0))
  assert(r.status === 'EM_FORMACAO', 'D: status EM_FORMACAO')
  assert(r.score === null, 'D: score = null em formação')
  assert(r.classification === null, 'D: classificação = null em formação')
  assert((r.rawMetrics as any).totalSales < MIN_SALES || (r.rawMetrics as any).daysOperation < MIN_OPERATION_DAYS, 'D: motivo EM_FORMACAO registrado (poucas vendas / pouco tempo)')
  return companyId
}

// ============================================================
// VALIDAÇÕES TRANSVERSAIS
// ============================================================
async function crossValidations(companyIdA: string) {
  section('VALIDAÇÕES TRANSVERSAIS (persistência, repesagem, classificação)')

  // Persistência do snapshot (upsert)
  const snapshots = await prisma.pushScoreSnapshot.findMany({ where: { companyId: companyIdA } })
  assert(snapshots.length === 1, 'Snapshot persistido (1 registro por empresa+dia)')
  assert(snapshots[0].rawMetrics !== null && snapshots[0].appliedWeights !== null, 'Snapshot guarda rawMetrics e appliedWeights')

  // Idempotência do upsert (recalcular não duplica)
  await generatePushScoreSnapshot(companyIdA, now)
  const snapshots2 = await prisma.pushScoreSnapshot.findMany({ where: { companyId: companyIdA } })
  assert(snapshots2.length === 1, 'Recalcular o mesmo dia faz UPSERT (não duplica)')

  // Repesagem dinâmica: empresa sem crediário/sem clientes deve redistribuir peso
  const companyId = await ensureCompany('TEST_PUSHSCORE_REPESO', daysAgo(400))
  await cleanup(companyId)
  await seedAccountPlanForCompany(companyId)
  const apId = await getAdminAccountPlanId(companyId)
  await prisma.cashAccount.create({ data: { name: 'Caixa R', companyId, currentBalance: 10000, isActive: true } })
  const p1 = await createProduct(companyId, 'Produto R', 100, 30)
  // SEM clientes cadastrados e SEM crediário → 2 dimensões não aplicáveis
  for (let i = 0; i < 12; i++) {
    await createSale({ companyId, productId: p1.id, qty: 5, unitPrice: 200, date: thisMonthDay(2 + i % 5) })
  }
  await createExpense(companyId, apId, 1500, daysAgo(3))
  const rr = await computePushScore(companyId, now)
  console.log('   → repeso subscores:', JSON.stringify(rr.subscores))
  console.log('   → repeso appliedWeights:', JSON.stringify(rr.appliedWeights))
  assert(rr.subscores.defaultScore === null, 'Repeso: inadimplência não aplicável (sem carteira)')
  assert(rr.subscores.customerBaseScore === null, 'Repeso: base de clientes não aplicável (sem clientes)')
  const sumWeights = Object.values(rr.appliedWeights ?? {}).reduce((s, w) => s + (w as number), 0)
  assert(Math.abs(sumWeights - 100) < 0.5, `Repeso: pesos aplicáveis somam ~100 (obtido ${sumWeights.toFixed(1)})`)
  assert((rr.appliedWeights as any).default === 0 && (rr.appliedWeights as any).customer === 0, 'Repeso: dimensões não aplicáveis recebem peso 0')
  assert(rr.score !== null, 'Repeso: score calculado mesmo com dimensões ausentes')

  // Função de classificação por faixa
  assert(classifyScore(90) === 'SAUDAVEL' && classifyScore(75) === 'ESTAVEL' && classifyScore(60) === 'ATENCAO' && classifyScore(45) === 'RISCO' && classifyScore(20) === 'CRITICO', 'classifyScore mapeia as 5 faixas corretamente')

  await cleanup(companyId)
}

async function main() {
  console.log('\n\x1b[1m========================================')
  console.log('  HOMOLOGAÇÃO — ENGINE PUSH SCORE™')
  console.log('========================================\x1b[0m')

  const cA = await scenarioA()
  await scenarioB()
  await scenarioC()
  await scenarioD()
  await crossValidations(cA)

  console.log('\n\x1b[1m========================================')
  console.log(`  RESULTADO: ${passed} PASS / ${failed} FAIL (total ${passed + failed})`)
  console.log('========================================\x1b[0m')
  if (failures.length) {
    console.log('\n\x1b[31mFalhas:\x1b[0m')
    failures.forEach(f => console.log(`  ✗ ${f}`))
  }

  // Limpeza final de TODAS as empresas de teste
  for (const name of ['TEST_PUSHSCORE_A', 'TEST_PUSHSCORE_B', 'TEST_PUSHSCORE_C', 'TEST_PUSHSCORE_D', 'TEST_PUSHSCORE_REPESO']) {
    const c = await prisma.company.findFirst({ where: { name } })
    if (c) await cleanup(c.id)
  }

  await prisma.$disconnect()
  process.exit(failed > 0 ? 1 : 0)
}

main().catch(async (err) => {
  console.error('\x1b[31mERRO FATAL:\x1b[0m', err)
  await prisma.$disconnect()
  process.exit(1)
})
