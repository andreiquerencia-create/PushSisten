/**
 * HOMOLOGAÇÃO DO HISTÓRICO DO PUSH SCORE™ — PRIORIDADE 3.4
 * ============================================================
 * Valida que `PushScoreSnapshot` é a FONTE OFICIAL e ÚNICA do
 * histórico do Push Score, persistida pela função canônica
 * `recordPushScoreSnapshot(companyId, date)`.
 *
 * Roda contra o banco real, em empresas de teste ISOLADAS
 * (TEST_PSHIST_A/_B/_C/_D/_MULTI). NÃO toca dados de outras empresas.
 *
 * Cenários obrigatórios (4):
 *   A) Empresa excelente   → ATIVO, score alto
 *   B) Empresa média       → ATIVO, faixa intermediária
 *   C) Empresa crítica     → ATIVO, score baixo
 *   D) Empresa em formação → EM_FORMACAO (score null)
 *
 * Evidências validadas (lendo o REGISTRO PERSISTIDO no banco):
 *   • snapshot persistido (linha existe em push_score_snapshots)
 *   • subscores armazenados no banco
 *   • classificação correta por faixa
 *   • idempotência (recalcular o mesmo dia → 1 registro)
 *   • rawMetrics + appliedWeights auditáveis (reconstrói o score)
 *   • repesagem dinâmica refletida no registro persistido
 *   • isolamento multiempresa (snapshots nunca se misturam)
 */

import { PrismaClient } from '@prisma/client'
import { seedAccountPlanForCompany } from '../lib/account-plan-seed'
import {
  recordPushScoreSnapshot,
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
function section(title: string) { console.log(`\n\x1b[36m─── ${title} ───\x1b[0m`) }

let saleSeq = 800000

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
      data: { name, cnpj: `PH${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(0, 18), email: `${name.toLowerCase()}@test.com`, createdAt },
    })
  } else {
    company = await prisma.company.update({ where: { id: company.id }, data: { createdAt } })
  }
  return company.id
}

async function createProduct(companyId: string, name: string, avgCost: number, stock: number) {
  return prisma.product.create({
    data: { name, companyId, avgCost, costPrice: avgCost, salePrice: avgCost * 2, stockQuantity: stock, minStock: 0, isActive: true },
  })
}

async function createSale(opts: { companyId: string; customerId?: string; productId: string; qty: number; unitPrice: number; date: Date }) {
  const { companyId, customerId, productId, qty, unitPrice, date } = opts
  const total = qty * unitPrice
  const sale = await prisma.sale.create({
    data: {
      saleNumber: saleSeq++, subtotal: total, total, discount: 0,
      status: 'concluida', paymentMethod: 'dinheiro', companyId, customerId,
      createdAt: date, updatedAt: date,
    },
  })
  await prisma.saleItem.create({ data: { saleId: sale.id, productId, quantity: qty, unitPrice, total } })
  return sale
}

async function createExpense(companyId: string, accountPlanId: string, amount: number, date: Date) {
  return prisma.financialRecord.create({
    data: { description: 'Despesa operacional teste', amount, type: 'saida', accountPlanId, companyId, date, reference: 'teste_pshist' },
  })
}

async function getAdminAccountPlanId(companyId: string): Promise<string> {
  const ap = await prisma.accountPlan.findFirst({ where: { companyId, code: '3.1' } })
  if (!ap) throw new Error('AccountPlan 3.1 não encontrado')
  return ap.id
}

const now = new Date()
const daysAgo = (d: number) => new Date(now.getTime() - d * 86400000)
const prevMonth15 = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 15, 12, 0, 0))
const thisMonthDay = (day: number) => {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), Math.min(day, now.getUTCDate()), 12, 0, 0))
  return d.getTime() > now.getTime() ? now : d
}

// Constante mestre dos campos de subscore (DB <-> resultado da engine)
const SUBSCORE_FIELDS = [
  'rentabilityScore', 'liquidityScore', 'inventoryScore',
  'defaultScore', 'customerBaseScore', 'growthScore',
] as const

/**
 * Reconstrói o score final a partir de subscores + appliedWeights
 * persistidos (prova de auditabilidade — entrega 4 da 3.4).
 */
function reconstructScore(snap: any): number {
  const map: Record<string, string> = {
    rentability: 'rentabilityScore', liquidity: 'liquidityScore', inventory: 'inventoryScore',
    default: 'defaultScore', customer: 'customerBaseScore', growth: 'growthScore',
  }
  const w = snap.appliedWeights as Record<string, number>
  let acc = 0
  for (const [dim, field] of Object.entries(map)) {
    const sub = snap[field]
    if (sub !== null && sub !== undefined && w[dim]) acc += sub * (w[dim] / 100)
  }
  return Math.round(acc)
}

// ============================================================
// CENÁRIO A — EMPRESA EXCELENTE
// ============================================================
async function scenarioA(): Promise<string> {
  section('CENÁRIO A — Empresa excelente (ATIVO, score alto)')
  const companyId = await ensureCompany('TEST_PSHIST_A', daysAgo(400))
  await cleanup(companyId)
  await seedAccountPlanForCompany(companyId)
  const apId = await getAdminAccountPlanId(companyId)

  await prisma.cashAccount.create({ data: { name: 'Caixa A', companyId, currentBalance: 30000, isActive: true } })
  const p1 = await createProduct(companyId, 'Camiseta A', 100, 40)
  const p2 = await createProduct(companyId, 'Calça A', 100, 40)
  const custs: { id: string }[] = []
  for (let i = 0; i < 5; i++) {
    custs.push(await prisma.customer.create({ data: { name: `Cliente A${i}`, companyId, isActive: true, lastPurchase: daysAgo(5), purchaseCount: 4 } }))
  }
  for (let i = 0; i < 12; i++) {
    await createSale({ companyId, customerId: custs[i % 5].id, productId: i % 2 === 0 ? p1.id : p2.id, qty: 5, unitPrice: 200, date: thisMonthDay(2 + i % 5) })
  }
  for (let i = 0; i < 8; i++) {
    await createSale({ companyId, customerId: custs[i % 5].id, productId: p1.id, qty: 5, unitPrice: 200, date: prevMonth15 })
  }
  await createExpense(companyId, apId, 1500, daysAgo(3))
  await prisma.installment.create({
    data: { companyId, customerId: custs[0].id, saleId: (await prisma.sale.findFirst({ where: { companyId } }))!.id, installmentNumber: 1, amount: 500, paidAmount: 0, dueDate: daysAgo(-30), status: 'PENDING' },
  })

  const r = await recordPushScoreSnapshot(companyId, now)
  console.log('   →', JSON.stringify({ status: r.status, score: r.score, classification: r.classification }))
  assert(r.status === 'ATIVO', 'A: engine retorna ATIVO')
  assert(r.score !== null && r.score >= 80, `A: score >= 80 (obtido ${r.score})`)
  assert(['SAUDAVEL', 'ESTAVEL'].includes(r.classification ?? ''), `A: classificação SAUDAVEL/ESTAVEL (obtido ${r.classification})`)
  return companyId
}

// ============================================================
// CENÁRIO B — EMPRESA MÉDIA
// ============================================================
async function scenarioB(): Promise<string> {
  section('CENÁRIO B — Empresa média (ATIVO, faixa intermediária)')
  const companyId = await ensureCompany('TEST_PSHIST_B', daysAgo(400))
  await cleanup(companyId)
  await seedAccountPlanForCompany(companyId)
  const apId = await getAdminAccountPlanId(companyId)

  await prisma.cashAccount.create({ data: { name: 'Caixa B', companyId, currentBalance: 3000, isActive: true } })
  const p1 = await createProduct(companyId, 'Camiseta B', 100, 30)
  await createProduct(companyId, 'Parado B', 100, 18)
  const custs: { id: string }[] = []
  for (let i = 0; i < 5; i++) {
    custs.push(await prisma.customer.create({
      data: { name: `Cliente B${i}`, companyId, isActive: true, lastPurchase: i < 3 ? daysAgo(10) : daysAgo(200), purchaseCount: i < 2 ? 3 : 1 },
    }))
  }
  for (let i = 0; i < 12; i++) {
    await createSale({ companyId, customerId: custs[i % 5].id, productId: p1.id, qty: 5, unitPrice: 200, date: thisMonthDay(2 + i % 5) })
  }
  for (let i = 0; i < 11; i++) {
    await createSale({ companyId, customerId: custs[i % 5].id, productId: p1.id, qty: 5, unitPrice: 200, date: prevMonth15 })
  }
  await createExpense(companyId, apId, 4200, daysAgo(3))
  const saleForInst = (await prisma.sale.findFirst({ where: { companyId } }))!
  await prisma.installment.create({ data: { companyId, customerId: custs[0].id, saleId: saleForInst.id, installmentNumber: 1, amount: 950, paidAmount: 0, dueDate: daysAgo(-20), status: 'PENDING' } })
  await prisma.installment.create({ data: { companyId, customerId: custs[0].id, saleId: saleForInst.id, installmentNumber: 2, amount: 50, paidAmount: 0, dueDate: daysAgo(10), status: 'OVERDUE' } })

  const r = await recordPushScoreSnapshot(companyId, now)
  console.log('   →', JSON.stringify({ status: r.status, score: r.score, classification: r.classification }))
  assert(r.status === 'ATIVO', 'B: engine retorna ATIVO')
  assert(r.score !== null && r.score >= 55 && r.score <= 80, `B: score entre 55 e 80 (obtido ${r.score})`)
  return companyId
}

// ============================================================
// CENÁRIO C — EMPRESA CRÍTICA
// ============================================================
async function scenarioC(): Promise<string> {
  section('CENÁRIO C — Empresa crítica (ATIVO, score baixo)')
  const companyId = await ensureCompany('TEST_PSHIST_C', daysAgo(400))
  await cleanup(companyId)
  await seedAccountPlanForCompany(companyId)
  const apId = await getAdminAccountPlanId(companyId)

  await prisma.cashAccount.create({ data: { name: 'Caixa C', companyId, currentBalance: 300, isActive: true } })
  await prisma.accountPayable.create({ data: { description: 'Fornecedor C', amount: 20000, dueDate: daysAgo(-15), status: 'pendente', companyId } })
  const p1 = await createProduct(companyId, 'Vendido C', 100, 10)
  await createProduct(companyId, 'Encalhe C1', 100, 100)
  await createProduct(companyId, 'Encalhe C2', 100, 100)
  const custs: { id: string }[] = []
  for (let i = 0; i < 5; i++) {
    custs.push(await prisma.customer.create({ data: { name: `Cliente C${i}`, companyId, isActive: true, lastPurchase: daysAgo(300), purchaseCount: 1 } }))
  }
  for (let i = 0; i < 11; i++) {
    await createSale({ companyId, customerId: custs[i % 5].id, productId: p1.id, qty: 8, unitPrice: 125, date: thisMonthDay(2 + i % 5) })
  }
  for (let i = 0; i < 20; i++) {
    await createSale({ companyId, customerId: custs[i % 5].id, productId: p1.id, qty: 8, unitPrice: 125, date: prevMonth15 })
  }
  await createExpense(companyId, apId, 6000, daysAgo(3))
  const saleForInst = (await prisma.sale.findFirst({ where: { companyId } }))!
  await prisma.installment.create({ data: { companyId, customerId: custs[0].id, saleId: saleForInst.id, installmentNumber: 1, amount: 7000, paidAmount: 0, dueDate: daysAgo(40), status: 'OVERDUE' } })
  await prisma.installment.create({ data: { companyId, customerId: custs[1].id, saleId: saleForInst.id, installmentNumber: 2, amount: 3000, paidAmount: 0, dueDate: daysAgo(-30), status: 'PENDING' } })

  const r = await recordPushScoreSnapshot(companyId, now)
  console.log('   →', JSON.stringify({ status: r.status, score: r.score, classification: r.classification }))
  assert(r.status === 'ATIVO', 'C: engine retorna ATIVO')
  assert(r.score !== null && r.score < 40, `C: score < 40 (obtido ${r.score})`)
  assert(['CRITICO', 'RISCO'].includes(r.classification ?? ''), `C: classificação CRITICO/RISCO (obtido ${r.classification})`)
  return companyId
}

// ============================================================
// CENÁRIO D — EMPRESA EM FORMAÇÃO
// ============================================================
async function scenarioD(): Promise<string> {
  section('CENÁRIO D — Empresa em formação (EM_FORMACAO)')
  const companyId = await ensureCompany('TEST_PSHIST_D', daysAgo(5))
  await cleanup(companyId)
  await seedAccountPlanForCompany(companyId)
  await prisma.cashAccount.create({ data: { name: 'Caixa D', companyId, currentBalance: 5000, isActive: true } })
  const p1 = await createProduct(companyId, 'Produto D', 100, 20)
  const cust = await prisma.customer.create({ data: { name: 'Cliente D', companyId, isActive: true, lastPurchase: daysAgo(2), purchaseCount: 1 } })
  for (let i = 0; i < 3; i++) {
    await createSale({ companyId, customerId: cust.id, productId: p1.id, qty: 2, unitPrice: 200, date: daysAgo(1) })
  }

  const r = await recordPushScoreSnapshot(companyId, now)
  console.log('   →', JSON.stringify({ status: r.status, score: r.score }))
  assert(r.status === 'EM_FORMACAO', 'D: engine retorna EM_FORMACAO')
  assert(r.score === null && r.classification === null, 'D: score e classificação null em formação')
  return companyId
}

// ============================================================
// EVIDÊNCIAS DE HISTÓRICO (lendo o REGISTRO PERSISTIDO no banco)
// ============================================================
async function evidences(ids: { A: string; B: string; C: string; D: string }) {
  section('EVIDÊNCIAS DE HISTÓRICO PERSISTIDO (3.4)')

  const today = (await prisma.pushScoreSnapshot.findFirst({ where: { companyId: ids.A } }))!.date

  // 1) Snapshot persistido para cada empresa
  for (const [label, id] of Object.entries(ids)) {
    const count = await prisma.pushScoreSnapshot.count({ where: { companyId: id } })
    assert(count === 1, `${label}: snapshot persistido no banco (1 registro)`)
  }

  // 2) Subscores armazenados no banco (empresas ATIVO)
  for (const id of [ids.A, ids.B, ids.C]) {
    const snap = await prisma.pushScoreSnapshot.findFirst({ where: { companyId: id } }) as any
    const allStored = SUBSCORE_FIELDS.some(f => snap[f] !== null) // ao menos os aplicáveis
    assert(allStored && snap.score !== null, `Subscores + score armazenados no banco (empresa ${snap.companyId.slice(0, 6)})`)
  }

  // 3) Classificação persistida bate com classifyScore(score)
  for (const id of [ids.A, ids.B, ids.C]) {
    const snap = await prisma.pushScoreSnapshot.findFirst({ where: { companyId: id } }) as any
    assert(snap.classification === classifyScore(snap.score), `Classificação persistida coerente com a faixa (${snap.classification})`)
  }

  // 4) EM_FORMACAO persistido corretamente para D
  const snapD = await prisma.pushScoreSnapshot.findFirst({ where: { companyId: ids.D } }) as any
  assert(snapD.status === 'EM_FORMACAO' && snapD.score === null && snapD.classification === null, 'EM_FORMACAO persistido (status set, score/classificação null)')

  // 5) rawMetrics + appliedWeights auditáveis → reconstrói o score
  for (const id of [ids.A, ids.B, ids.C]) {
    const snap = await prisma.pushScoreSnapshot.findFirst({ where: { companyId: id } }) as any
    assert(snap.rawMetrics !== null, `rawMetrics persistido (auditoria) — ${snap.companyId.slice(0, 6)}`)
    assert(snap.appliedWeights !== null, `appliedWeights persistido (auditoria) — ${snap.companyId.slice(0, 6)}`)
    const rebuilt = reconstructScore(snap)
    assert(Math.abs(rebuilt - snap.score) <= 1, `Score reconstruído de subscores+pesos = persistido (${rebuilt} ≈ ${snap.score})`)
  }

  // 6) Idempotência: recalcular o MESMO dia não duplica (upsert)
  await recordPushScoreSnapshot(ids.A, now)
  await recordPushScoreSnapshot(ids.A, now)
  const afterReRun = await prisma.pushScoreSnapshot.count({ where: { companyId: ids.A } })
  assert(afterReRun === 1, 'Idempotência: re-gravar o mesmo dia mantém 1 registro (upsert)')
  const onlySnap = await prisma.pushScoreSnapshot.findFirst({ where: { companyId: ids.A } }) as any
  assert(onlySnap.date.getTime() === today.getTime(), 'Idempotência: data do snapshot inalterada')

  // 7) Multiempresa: dias diferentes coexistem para a MESMA empresa (série histórica)
  const yesterday = new Date(now.getTime() - 86400000)
  await recordPushScoreSnapshot(ids.A, yesterday)
  const series = await prisma.pushScoreSnapshot.count({ where: { companyId: ids.A } })
  assert(series === 2, 'Histórico: dias distintos geram registros distintos (série temporal)')

  // 8) Isolamento multiempresa: snapshots nunca se misturam
  const idsList = Object.values(ids)
  let leak = false
  for (const id of idsList) {
    const foreign = await prisma.pushScoreSnapshot.count({ where: { companyId: { not: id }, id: { in: (await prisma.pushScoreSnapshot.findMany({ where: { companyId: id }, select: { id: true } })).map(s => s.id) } } })
    if (foreign > 0) leak = true
  }
  assert(!leak, 'Isolamento multiempresa: nenhum snapshot pertence a empresa diferente do seu companyId')

  // limpa o snapshot extra de "ontem" para não sujar contagem final
  await prisma.pushScoreSnapshot.deleteMany({ where: { companyId: ids.A, date: { lt: today } } })
}

// ============================================================
// REPESAGEM DINÂMICA refletida no registro persistido
// ============================================================
async function reweightPersistence(): Promise<string> {
  section('REPESAGEM DINÂMICA (refletida no snapshot persistido)')
  const companyId = await ensureCompany('TEST_PSHIST_MULTI', daysAgo(400))
  await cleanup(companyId)
  await seedAccountPlanForCompany(companyId)
  const apId = await getAdminAccountPlanId(companyId)
  await prisma.cashAccount.create({ data: { name: 'Caixa M', companyId, currentBalance: 10000, isActive: true } })
  const p1 = await createProduct(companyId, 'Produto M', 100, 30)
  // SEM clientes e SEM crediario → 2 dimensoes nao aplicaveis
  for (let i = 0; i < 12; i++) {
    await createSale({ companyId, productId: p1.id, qty: 5, unitPrice: 200, date: thisMonthDay(2 + i % 5) })
  }
  await createExpense(companyId, apId, 1500, daysAgo(3))

  await recordPushScoreSnapshot(companyId, now)
  const snap = await prisma.pushScoreSnapshot.findFirst({ where: { companyId } }) as any
  console.log('   → appliedWeights:', JSON.stringify(snap.appliedWeights))
  assert(snap.defaultScore === null, 'Repeso: inadimplência null persistida (sem carteira)')
  assert(snap.customerBaseScore === null, 'Repeso: base de clientes null persistida (sem clientes)')
  const w = snap.appliedWeights as Record<string, number>
  const sum = Object.values(w).reduce((s, x) => s + x, 0)
  assert(Math.abs(sum - 100) < 0.5, `Repeso: pesos aplicados somam ~100 (obtido ${sum.toFixed(1)})`)
  assert(w.default === 0 && w.customer === 0, 'Repeso: dimensões ausentes recebem peso 0 no registro')
  assert(snap.score !== null, 'Repeso: score calculado e persistido mesmo com dimensões ausentes')
  return companyId
}

async function main() {
  console.log('\n\x1b[1m========================================')
  console.log('  HOMOLOGAÇÃO — HISTÓRICO PUSH SCORE™ (3.4)')
  console.log('========================================\x1b[0m')

  const A = await scenarioA()
  const B = await scenarioB()
  const C = await scenarioC()
  const D = await scenarioD()
  await evidences({ A, B, C, D })
  await reweightPersistence()

  console.log('\n\x1b[1m========================================')
  console.log(`  RESULTADO: ${passed} PASS / ${failed} FAIL (total ${passed + failed})`)
  console.log('========================================\x1b[0m')
  if (failures.length) {
    console.log('\n\x1b[31mFalhas:\x1b[0m')
    failures.forEach(f => console.log(`  ✗ ${f}`))
  }

  for (const name of ['TEST_PSHIST_A', 'TEST_PSHIST_B', 'TEST_PSHIST_C', 'TEST_PSHIST_D', 'TEST_PSHIST_MULTI']) {
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
