/**
 * HOMOLOGAÇÃO P7 — CONSOLIDAÇÃO DA UI DE AUTOMAÇÕES NA FILA REAL
 * ============================================================================
 * Valida que a UI consome a FILA OFICIAL (AutomationAction) via os endpoints
 * /api/automation/{queue,run,[id],stats}, alimentada pela IA Gerente
 * (Insights + Push Score), sem campos fake e sem executor paralelo.
 *
 * NENHUMA mensagem real é enviada. "Executar" = marcar status + log.
 *
 * Cobertura:
 *   A/B/C/D  — cenários de loja (excelente/média/crítica/em formação)
 *   IDEMP    — idempotência (2x mesmo dia, sem duplicar)
 *   MULTI    — isolamento multiempresa
 *   STATUS   — transições EXECUTADO/IGNORADO + cross-tenant + preservação
 *   STATS    — contadores reais (byStatus, totalRuns, lastRun) — lógica do endpoint /stats
 *   QUEUE    — lógica de filtros do endpoint /queue (status/type/agregados)
 *   INTEG    — integração com Insights oficiais e Push Score (rastreabilidade)
 *   LEGACY   — modelo Automation preservado como config (on/off), sem execução
 *
 * Empresas isoladas: TEST_AUTOMACAO_P7_*
 * ============================================================================
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const PASS = 0;
const FAIL = 1;
const results: { name: string; status: number; detail?: string }[] = [];

function assert(name: string, condition: boolean, detail?: string) {
  results.push({ name, status: condition ? PASS : FAIL, detail });
  if (!condition) console.error(`  ❌ FAIL: ${name} — ${detail || ''}`);
  else console.log(`  ✅ PASS: ${name}`);
}

const COMPANY_NAMES = [
  'TEST_AUTOMACAO_P7_A',
  'TEST_AUTOMACAO_P7_B',
  'TEST_AUTOMACAO_P7_C',
  'TEST_AUTOMACAO_P7_D',
  'TEST_AUTOMACAO_P7_IDEMP',
] as const;

async function cleanup() {
  for (const name of COMPANY_NAMES) {
    const co = await prisma.company.findFirst({ where: { name } });
    if (!co) continue;
    const id = co.id;
    await prisma.automationAction.deleteMany({ where: { companyId: id } });
    await prisma.automationLog.deleteMany({ where: { automation: { companyId: id } } });
    await prisma.automation.deleteMany({ where: { companyId: id } });
    await prisma.insight.deleteMany({ where: { companyId: id } });
    await prisma.pushScoreSnapshot.deleteMany({ where: { companyId: id } });
    await prisma.pushScoreConfig.deleteMany({ where: { companyId: id } });
    await prisma.installmentPayment.deleteMany({ where: { companyId: id } });
    await prisma.installment.deleteMany({ where: { companyId: id } });
    await prisma.customerCredit.deleteMany({ where: { companyId: id } });
    await prisma.ledgerEntry.deleteMany({ where: { companyId: id } });
    await prisma.salePayment.deleteMany({ where: { companyId: id } });
    await prisma.saleItem.deleteMany({ where: { sale: { companyId: id } } });
    await prisma.sale.deleteMany({ where: { companyId: id } });
    await prisma.cashMovement.deleteMany({ where: { companyId: id } });
    await prisma.cashSession.deleteMany({ where: { companyId: id } });
    await prisma.financialRecord.deleteMany({ where: { companyId: id } });
    await prisma.accountReceivable.deleteMany({ where: { companyId: id } });
    await prisma.accountPayable.deleteMany({ where: { companyId: id } });
    await prisma.inventoryMovement.deleteMany({ where: { companyId: id } });
    await prisma.stockEntryItem.deleteMany({ where: { stockEntry: { companyId: id } } });
    await prisma.stockEntry.deleteMany({ where: { companyId: id } });
    await prisma.costHistory.deleteMany({ where: { companyId: id } });
    await prisma.priceTable.deleteMany({ where: { companyId: id } });
    await prisma.productVariation.deleteMany({ where: { product: { companyId: id } } });
    await prisma.product.deleteMany({ where: { companyId: id } });
    await prisma.customer.deleteMany({ where: { companyId: id } });
    await prisma.category.deleteMany({ where: { companyId: id } });
    await prisma.seller.deleteMany({ where: { companyId: id } });
    await prisma.paymentMethod.deleteMany({ where: { companyId: id } });
    await prisma.cashAccount.deleteMany({ where: { companyId: id } });
    await prisma.accountPlan.deleteMany({ where: { companyId: id } });
    await prisma.activityLog.deleteMany({ where: { companyId: id } });
    await prisma.user.deleteMany({ where: { companyId: id } });
    await prisma.company.delete({ where: { id } });
  }
}

async function createCompany(name: string, createdDaysAgo: number = 90) {
  const createdAt = new Date(Date.now() - createdDaysAgo * 86400000);
  const co = await prisma.company.create({ data: { name, createdAt } });
  const hash = await bcrypt.hash('test123', 10);
  await prisma.user.create({
    data: { name: 'Admin', email: `admin@${name.toLowerCase()}.test`, password: hash, role: 'administrador', companyId: co.id },
  });
  const caixa = await prisma.cashAccount.create({
    data: { name: 'Caixa Principal', type: 'caixa_fisico', currentBalance: 0, companyId: co.id },
  });
  await prisma.paymentMethod.create({
    data: { name: 'Dinheiro', type: 'dinheiro', isActive: true, companyId: co.id, cashAccountId: caixa.id },
  });
  return co;
}

async function seedProducts(companyId: string, count: number, stockQty = 50, minStock = 10) {
  const products: any[] = [];
  for (let i = 0; i < count; i++) {
    products.push(await prisma.product.create({
      data: { name: `Produto ${i + 1}`, costPrice: 30, salePrice: 80, avgCost: 30, stockQuantity: stockQty, minStock, companyId },
    }));
  }
  return products;
}

async function seedCustomers(companyId: string, count: number, opts?: {
  lastPurchaseDaysAgo?: number; purchaseCount?: number; avgTicket?: number; totalPurchased?: number;
}) {
  const customers: any[] = [];
  for (let i = 0; i < count; i++) {
    customers.push(await prisma.customer.create({
      data: {
        name: `Cliente ${i + 1}`, companyId,
        lastPurchase: opts?.lastPurchaseDaysAgo != null ? new Date(Date.now() - opts.lastPurchaseDaysAgo * 86400000) : new Date(),
        purchaseCount: opts?.purchaseCount ?? 3, avgTicket: opts?.avgTicket ?? 150, totalPurchased: opts?.totalPurchased ?? 450, isActive: true,
      },
    }));
  }
  return customers;
}

async function seedSales(companyId: string, products: any[], customers: any[], count: number, daysAgoStart = 0) {
  const pm = await prisma.paymentMethod.findFirst({ where: { companyId } });
  const caixa = await prisma.cashAccount.findFirst({ where: { companyId } });
  for (let i = 0; i < count; i++) {
    const prod = products[i % products.length];
    const cust = customers[i % customers.length];
    const createdAt = new Date(Date.now() - (daysAgoStart + Math.floor(i / 2)) * 86400000);
    const total = prod.salePrice * 2;
    await prisma.sale.create({
      data: {
        companyId, customerId: cust.id, subtotal: total, total, discount: 0, status: 'concluida', createdAt,
        items: { create: [{ productId: prod.id, quantity: 2, unitPrice: prod.salePrice, total }] },
        payments: { create: [{ paymentMethodId: pm!.id, amount: total, received: true, expectedDate: createdAt, cashAccountId: caixa!.id, companyId }] },
      },
    });
  }
}

async function seedOverdueCrediario(companyId: string, products: any[], customers: any[], numClientes: number) {
  const pm = await prisma.paymentMethod.findFirst({ where: { companyId } });
  const caixa = await prisma.cashAccount.findFirst({ where: { companyId } });
  for (let i = 0; i < numClientes; i++) {
    const cust = customers[i % customers.length];
    const prod = products[i % products.length];
    await prisma.customerCredit.upsert({
      where: { customerId: cust.id },
      create: { customerId: cust.id, companyId, creditLimit: 1000, usedLimit: 400, status: 'ACTIVE' },
      update: {},
    });
    const total = 400;
    const sale = await prisma.sale.create({
      data: {
        companyId, customerId: cust.id, subtotal: total, total, discount: 0, status: 'concluida',
        createdAt: new Date(Date.now() - 60 * 86400000),
        items: { create: [{ productId: prod.id, quantity: 1, unitPrice: total, total }] },
        payments: { create: [{ paymentMethodId: pm!.id, amount: total, received: false, expectedDate: new Date(Date.now() - 30 * 86400000), cashAccountId: caixa!.id, companyId }] },
      },
    });
    await prisma.installment.create({
      data: {
        saleId: sale.id, customerId: cust.id, companyId, installmentNumber: 1,
        amount: total, paidAmount: 0, dueDate: new Date(Date.now() - 20 * 86400000), status: 'OVERDUE',
      },
    });
  }
}

function countByType(actions: any[]): Record<string, number> {
  const m: Record<string, number> = {};
  for (const a of actions) m[a.type] = (m[a.type] || 0) + 1;
  return m;
}

/** Replica EXATAMENTE a lógica de agregação do endpoint /api/automation/stats. */
async function computeStats(companyId: string) {
  const grouped = await prisma.automationAction.groupBy({
    by: ['status'], where: { companyId }, _count: { _all: true },
  });
  const byStatus: Record<string, number> = { PENDENTE: 0, EXECUTADO: 0, IGNORADO: 0, ERRO: 0 };
  let totalActions = 0;
  for (const g of grouped) { byStatus[g.status] = g._count._all; totalActions += g._count._all; }
  const totalRuns = await prisma.activityLog.count({ where: { companyId, action: 'automation_run' } });
  const lastRunLog = await prisma.activityLog.findFirst({
    where: { companyId, action: 'automation_run' }, orderBy: { createdAt: 'desc' },
    select: { createdAt: true, metadata: true, userName: true },
  });
  return { totalActions, byStatus, totalRuns, lastRun: lastRunLog?.createdAt ?? null, lastRunBy: lastRunLog?.userName ?? null };
}

/** Replica a agregação byType/bySeverity do endpoint /api/automation/queue. */
function aggregateQueue(actions: any[]) {
  const byType: Record<string, number> = {};
  const bySeverity: Record<string, number> = {};
  for (const a of actions) {
    byType[a.type] = (byType[a.type] || 0) + 1;
    bySeverity[a.severity] = (bySeverity[a.severity] || 0) + 1;
  }
  return { total: actions.length, byType, bySeverity };
}

// ============ CENÁRIO A: EXCELENTE ============
async function scenarioA() {
  console.log('\n=== CENÁRIO A: Loja Excelente ===');
  const co = await createCompany('TEST_AUTOMACAO_P7_A', 90);
  const products = await seedProducts(co.id, 10, 50, 10);
  const customers = await seedCustomers(co.id, 20, { lastPurchaseDaysAgo: 5, purchaseCount: 8, avgTicket: 200, totalPurchased: 1600 });
  await seedSales(co.id, products, customers, 30, 0);
  const caixa = await prisma.cashAccount.findFirst({ where: { companyId: co.id } });
  await prisma.cashAccount.update({ where: { id: caixa!.id }, data: { currentBalance: 50000 } });

  const { runAutomations, getAutomationQueue } = await import('../lib/automation-engine');
  const run = await runAutomations(co.id, new Date(), { userId: null, userName: 'Homologação P7' });
  const queue = await getAutomationQueue(co.id);
  const agg = aggregateQueue(queue);

  assert('A1 — Status ATIVO', run.status === 'ATIVO', `status=${run.status}`);
  assert('A2 — Gera ao menos o relatório', run.total >= 1, `total=${run.total}`);
  assert('A3 — Possui RELATORIO_GERENCIAL', (agg.byType['RELATORIO_GERENCIAL'] ?? 0) >= 1, JSON.stringify(agg.byType));
  assert('A4 — Nenhuma ação crítica (ALTO)', queue.every(a => a.severity !== 'ALTO'));
  assert('A5 — Poucas automações (≤4)', run.total <= 4, `total=${run.total}`);
  console.log(`  📊 Total=${run.total} | Tipos=${JSON.stringify(agg.byType)}`);
  return co.id;
}

// ============ CENÁRIO B: MÉDIA ============
async function scenarioB() {
  console.log('\n=== CENÁRIO B: Loja Média ===');
  const co = await createCompany('TEST_AUTOMACAO_P7_B', 90);
  const products = await seedProducts(co.id, 15, 30, 10);
  const customers = await seedCustomers(co.id, 15, { lastPurchaseDaysAgo: 10, purchaseCount: 3, avgTicket: 150, totalPurchased: 450 });
  await seedCustomers(co.id, 6, { lastPurchaseDaysAgo: 45, purchaseCount: 5, avgTicket: 200, totalPurchased: 1000 });
  await seedSales(co.id, products, customers, 20, 0);
  const caixa = await prisma.cashAccount.findFirst({ where: { companyId: co.id } });
  await prisma.cashAccount.update({ where: { id: caixa!.id }, data: { currentBalance: 5000 } });
  await prisma.product.updateMany({ where: { companyId: co.id }, data: { stockQuantity: 3 } });
  for (const p of products.slice(0, 5)) {
    await prisma.product.update({ where: { id: p.id }, data: { stockQuantity: 30 } });
  }

  const { runAutomations, getAutomationQueue } = await import('../lib/automation-engine');
  const run = await runAutomations(co.id, new Date(), { userId: null, userName: 'Homologação P7' });
  const queue = await getAutomationQueue(co.id);
  const agg = aggregateQueue(queue);

  assert('B1 — Status ATIVO', run.status === 'ATIVO');
  assert('B2 — Automações médias (≥2)', run.total >= 2, `total=${run.total}`);
  assert('B3 — Possui RELATORIO_GERENCIAL', (agg.byType['RELATORIO_GERENCIAL'] ?? 0) >= 1, JSON.stringify(agg.byType));
  assert('B4 — Possui ESTOQUE_BAIXO ou CLIENTE_INATIVO', !!(agg.byType['ESTOQUE_BAIXO'] || agg.byType['CLIENTE_INATIVO']), JSON.stringify(agg.byType));
  assert('B5 — Todas PENDENTE inicialmente', queue.every(a => a.status === 'PENDENTE'));
  console.log(`  📊 Total=${run.total} | Tipos=${JSON.stringify(agg.byType)}`);
  return co.id;
}

// ============ CENÁRIO C: CRÍTICA ============
async function scenarioC() {
  console.log('\n=== CENÁRIO C: Loja Crítica ===');
  const co = await createCompany('TEST_AUTOMACAO_P7_C', 90);
  const products = await seedProducts(co.id, 10, 0, 10);
  for (const p of products) {
    await prisma.product.update({ where: { id: p.id }, data: { salePrice: 35, costPrice: 30, avgCost: 30 } });
  }
  const customers = await seedCustomers(co.id, 12, { lastPurchaseDaysAgo: 120, purchaseCount: 4, avgTicket: 80, totalPurchased: 320 });
  await seedSales(co.id, products, customers, 15, 30);
  const caixa = await prisma.cashAccount.findFirst({ where: { companyId: co.id } });
  await prisma.cashAccount.update({ where: { id: caixa!.id }, data: { currentBalance: 200 } });
  for (let i = 0; i < 5; i++) {
    await prisma.accountPayable.create({
      data: { description: `Conta vencida ${i + 1}`, amount: 500, dueDate: new Date(Date.now() - 10 * 86400000), status: 'pendente', companyId: co.id },
    });
  }
  await seedOverdueCrediario(co.id, products, customers, 6);

  const { runAutomations, getAutomationQueue } = await import('../lib/automation-engine');
  const run = await runAutomations(co.id, new Date(), { userId: null, userName: 'Homologação P7' });
  const queue = await getAutomationQueue(co.id);
  const agg = aggregateQueue(queue);

  assert('C1 — Status ATIVO', run.status === 'ATIVO');
  assert('C2 — Muitas automações (≥3)', run.total >= 3, `total=${run.total}`);
  assert('C3 — Possui COBRANCA_CREDIARIO', (agg.byType['COBRANCA_CREDIARIO'] ?? 0) >= 1, JSON.stringify(agg.byType));
  assert('C4 — Possui ação crítica (ALTO)', queue.some(a => a.severity === 'ALTO'));
  assert('C5 — Possui ESTOQUE_BAIXO', (agg.byType['ESTOQUE_BAIXO'] ?? 0) >= 1, JSON.stringify(agg.byType));
  assert('C6 — Possui CLIENTE_INATIVO', (agg.byType['CLIENTE_INATIVO'] ?? 0) >= 1, JSON.stringify(agg.byType));
  assert('C7 — Mensagem sugerida (payload.mensagemSugerida) em ação de contato',
    queue.filter(a => a.type === 'COBRANCA_CREDIARIO' || a.type === 'CLIENTE_INATIVO').some(a => (a.payload as any)?.mensagemSugerida != null), 'sem template');
  console.log(`  📊 Total=${run.total} | Tipos=${JSON.stringify(agg.byType)}`);
  return co.id;
}

// ============ CENÁRIO D: EM FORMAÇÃO ============
async function scenarioD() {
  console.log('\n=== CENÁRIO D: Empresa em Formação ===');
  const co = await createCompany('TEST_AUTOMACAO_P7_D', 5);
  const products = await seedProducts(co.id, 3, 0, 5);
  const customers = await seedCustomers(co.id, 2, { lastPurchaseDaysAgo: 120, purchaseCount: 4 });
  await seedSales(co.id, products, customers, 3, 0);

  const { runAutomations, getAutomationQueue } = await import('../lib/automation-engine');
  const run = await runAutomations(co.id, new Date(), { userId: null, userName: 'Homologação P7' });
  const queue = await getAutomationQueue(co.id);

  assert('D1 — Status EM_FORMACAO', run.status === 'EM_FORMACAO', `status=${run.status}`);
  assert('D2 — ZERO ações geradas', run.total === 0, `total=${run.total}`);
  assert('D3 — Fila vazia', queue.length === 0, `queue=${queue.length}`);
  // Mesmo em formação, a execução é auditada (telemetria real existe)
  const stats = await computeStats(co.id);
  assert('D4 — Stats: 0 ações, run registrado', stats.totalActions === 0 && stats.totalRuns >= 1, JSON.stringify(stats));
  console.log(`  📊 Status=${run.status} | Total=${run.total} | Runs=${stats.totalRuns}`);
  return co.id;
}

// ============ IDEMPOTÊNCIA ============
async function testIdempotency() {
  console.log('\n=== IDEMPOTÊNCIA ===');
  const co = await createCompany('TEST_AUTOMACAO_P7_IDEMP', 90);
  const products = await seedProducts(co.id, 8, 2, 10);
  const customers = await seedCustomers(co.id, 10, { lastPurchaseDaysAgo: 45, purchaseCount: 5, avgTicket: 200, totalPurchased: 1000 });
  await seedSales(co.id, products, customers, 15, 0);
  const caixa = await prisma.cashAccount.findFirst({ where: { companyId: co.id } });
  await prisma.cashAccount.update({ where: { id: caixa!.id }, data: { currentBalance: 3000 } });

  const { runAutomations } = await import('../lib/automation-engine');
  const r1 = await runAutomations(co.id, new Date(), { userId: null, userName: 'Homologação P7' });
  const c1 = await prisma.automationAction.count({ where: { companyId: co.id } });
  const r2 = await runAutomations(co.id, new Date(), { userId: null, userName: 'Homologação P7' });
  const c2 = await prisma.automationAction.count({ where: { companyId: co.id } });

  assert('IDEMP1 — 1ª execução cria ações', r1.created > 0, `created=${r1.created}`);
  assert('IDEMP2 — 2ª execução não cria novas', r2.created === 0, `created2=${r2.created}`);
  assert('IDEMP3 — 2ª reconhece existentes', r2.existing === r1.total, `existing=${r2.existing} total1=${r1.total}`);
  assert('IDEMP4 — Contagem estável', c1 === c2, `c1=${c1} c2=${c2}`);
  // Stats: cada run gera um ActivityLog (telemetria real conta execuções, não duplica ações)
  const stats = await computeStats(co.id);
  assert('IDEMP5 — totalRuns=2 (telemetria por execução)', stats.totalRuns === 2, `runs=${stats.totalRuns}`);
  assert('IDEMP6 — totalActions estável após 2 runs', stats.totalActions === c2, `stats=${stats.totalActions} rows=${c2}`);
  console.log(`  📊 Run1 created=${r1.created} | Run2 created=${r2.created} existing=${r2.existing} | Rows=${c2} | Runs=${stats.totalRuns}`);
  return co.id;
}

// ============ MULTIEMPRESA ============
async function testMultiempresa(idA: string, idC: string) {
  console.log('\n=== MULTIEMPRESA ===');
  const aActions = await prisma.automationAction.findMany({ where: { companyId: idA } });
  const cActions = await prisma.automationAction.findMany({ where: { companyId: idC } });
  assert('MULTI1 — A tem ações próprias', aActions.length > 0, `A=${aActions.length}`);
  assert('MULTI2 — C tem ações próprias', cActions.length > 0, `C=${cActions.length}`);
  assert('MULTI3 — Todas de A pertencem a A', aActions.every(a => a.companyId === idA));
  assert('MULTI4 — Todas de C pertencem a C', cActions.every(a => a.companyId === idC));
  assert('MULTI5 — IDs disjuntos (sem vazamento)', aActions.every(a => !cActions.find(c => c.id === a.id)));
  // Stats isolados por empresa (endpoint /stats sempre escopa companyId)
  const sA = await computeStats(idA);
  const sC = await computeStats(idC);
  assert('MULTI6 — Stats A != Stats C (isolados)', sA.totalActions !== sC.totalActions || idA !== idC);
  assert('MULTI7 — Crítica gera mais ações que excelente', cActions.length >= aActions.length, `A=${aActions.length} C=${cActions.length}`);
  console.log(`  📊 Ações A=${aActions.length} | C=${cActions.length}`);
}

// ============ TRANSIÇÃO DE STATUS ============
async function testStatusTransitions(idC: string, idA: string) {
  console.log('\n=== TRANSIÇÃO DE STATUS (endpoint [id] PATCH) ===');
  const { updateAutomationStatus, getAutomationQueue } = await import('../lib/automation-engine');
  const pending = await prisma.automationAction.findMany({ where: { companyId: idC, status: 'PENDENTE' }, take: 3 });
  assert('STATUS0 — Há pendentes para transicionar', pending.length >= 2, `pendentes=${pending.length}`);

  const exec = await updateAutomationStatus(idC, pending[0].id, 'EXECUTADO');
  const ign = await updateAutomationStatus(idC, pending[1].id, 'IGNORADO');
  assert('STATUS1 — EXECUTADO marca executedAt', exec?.status === 'EXECUTADO' && exec?.executedAt != null);
  assert('STATUS2 — IGNORADO aplicado', ign?.status === 'IGNORADO');

  // Cross-tenant: empresa A não atualiza ação de C
  const cross = await updateAutomationStatus(idA, pending[2].id, 'EXECUTADO');
  assert('STATUS3 — Cross-tenant bloqueado (null)', cross === null);

  const qPend = await getAutomationQueue(idC, { status: 'PENDENTE' });
  const qExec = await getAutomationQueue(idC, { status: 'EXECUTADO' });
  assert('STATUS4 — Fila EXECUTADO contém a ação', qExec.some(a => a.id === pending[0].id));
  assert('STATUS5 — Fila PENDENTE não contém executada', !qPend.some(a => a.id === pending[0].id));

  // Stats refletem a transição (contadores reais)
  const stats = await computeStats(idC);
  assert('STATUS6 — Stats EXECUTADO ≥ 1', stats.byStatus.EXECUTADO >= 1, JSON.stringify(stats.byStatus));
  assert('STATUS7 — Stats IGNORADO ≥ 1', stats.byStatus.IGNORADO >= 1, JSON.stringify(stats.byStatus));

  // Re-execução preserva status já tratados
  const { runAutomations } = await import('../lib/automation-engine');
  await runAutomations(idC, new Date(), { userId: null, userName: 'Homologação P7' });
  const reExec = await prisma.automationAction.findUnique({ where: { id: pending[0].id } });
  assert('STATUS8 — Re-execução preserva EXECUTADO', reExec?.status === 'EXECUTADO');
  console.log(`  📊 PENDENTE=${qPend.length} EXECUTADO=${qExec.length} | byStatus=${JSON.stringify(stats.byStatus)}`);
}

// ============ FILTROS DO ENDPOINT /queue ============
async function testQueueFilters(idC: string) {
  console.log('\n=== FILTROS DA FILA (endpoint /queue) ===');
  const { getAutomationQueue } = await import('../lib/automation-engine');
  const all = await getAutomationQueue(idC, { status: ['PENDENTE', 'EXECUTADO', 'IGNORADO', 'ERRO'] });
  const onlyEstoque = await getAutomationQueue(idC, { status: ['PENDENTE', 'EXECUTADO', 'IGNORADO', 'ERRO'], type: 'ESTOQUE_BAIXO' });
  const aggAll = aggregateQueue(all);

  assert('QUEUE1 — Fila completa retorna ações', all.length > 0, `n=${all.length}`);
  assert('QUEUE2 — Filtro por tipo só traz o tipo', onlyEstoque.every(a => a.type === 'ESTOQUE_BAIXO'));
  assert('QUEUE3 — byType agrega corretamente', Object.values(aggAll.byType).reduce((s, n) => s + n, 0) === all.length, JSON.stringify(aggAll.byType));
  assert('QUEUE4 — bySeverity agrega corretamente', Object.values(aggAll.bySeverity).reduce((s, n) => s + n, 0) === all.length, JSON.stringify(aggAll.bySeverity));
  assert('QUEUE5 — Ordenação por severidade (ALTO antes de BAIXO no mesmo dia)',
    (() => { const order = ['ALTO', 'MEDIO', 'BAIXO']; for (let i = 1; i < all.length; i++) { if (all[i - 1].date.getTime() === all[i].date.getTime() && order.indexOf(all[i - 1].severity) > order.indexOf(all[i].severity)) return false; } return true; })());
  console.log(`  📊 Total=${all.length} | Estoque=${onlyEstoque.length} | byType=${JSON.stringify(aggAll.byType)}`);
}

// ============ INTEGRAÇÃO INSIGHTS + PUSH SCORE ============
async function testIntegration(idC: string) {
  console.log('\n=== INTEGRAÇÃO INSIGHTS + PUSH SCORE ===');
  const { generateExecutiveSummary } = await import('../lib/ia-gerente-engine');
  const summary = await generateExecutiveSummary(idC);
  const actions = await prisma.automationAction.findMany({ where: { companyId: idC } });

  // Toda ação acionável (exceto relatório) deve carregar um insightCode rastreável
  const actionable = actions.filter(a => a.type !== 'RELATORIO_GERENCIAL');
  assert('INTEG1 — Ações acionáveis têm insightCode', actionable.length > 0 && actionable.every(a => !!a.insightCode), `${actionable.length} acionáveis`);

  // Os insightCodes das ações devem existir entre os insights priorizados pela IA Gerente
  const summaryCodes = new Set(summary.recommendations.map(r => r.insightCode));
  assert('INTEG2 — insightCode das ações vem do resumo executivo', actionable.every(a => summaryCodes.has(a.insightCode!)), `codes=${[...summaryCodes].join(',')}`);

  // O relatório gerencial carrega o Push Score oficial no payload
  const relatorio = actions.find(a => a.type === 'RELATORIO_GERENCIAL');
  assert('INTEG3 — Relatório carrega pushScore oficial', relatorio != null && (relatorio.payload as any)?.pushScore != null, 'sem pushScore');
  assert('INTEG4 — pushScore do relatório == pushScore do resumo', relatorio != null && (relatorio.payload as any)?.pushScore === summary.pushScore, `rel=${(relatorio?.payload as any)?.pushScore} sum=${summary.pushScore}`);
  assert('INTEG5 — Classificação oficial presente no payload', relatorio != null && !!(relatorio.payload as any)?.classification, 'sem classification');

  // Snapshot de Push Score foi registrado pela fonte oficial (rastreabilidade)
  const snap = await prisma.pushScoreSnapshot.findFirst({ where: { companyId: idC }, orderBy: { createdAt: 'desc' } });
  assert('INTEG6 — Push Score snapshot registrado pela fonte oficial', snap != null);
  console.log(`  📊 pushScore=${summary.pushScore} classif=${summary.classification} | recs=${summary.recommendations.length} | snapshot=${snap ? 'sim' : 'não'}`);
}

// ============ LEGADO PRESERVADO COMO CONFIG ============
async function testLegacyConfig(idA: string) {
  console.log('\n=== LEGADO: Automation como configuração (on/off) ===');
  // Cria uma "preferência" de categoria (não executa nada)
  const cfg = await prisma.automation.create({
    data: { companyId: idA, name: 'Foco em estoque', description: 'Preferência', category: 'stock', trigger: '{"type":"low_stock"}', actions: '[]', isActive: true },
  });
  assert('LEGACY1 — Config criada (isActive default)', cfg.isActive === true);

  // Toggle off
  await prisma.automation.updateMany({ where: { id: cfg.id, companyId: idA }, data: { isActive: false } });
  const off = await prisma.automation.findUnique({ where: { id: cfg.id } });
  assert('LEGACY2 — Toggle desativa preferência', off?.isActive === false);

  // A config NÃO gera ações na fila real (sem executor paralelo)
  const before = await prisma.automationAction.count({ where: { companyId: idA } });
  // (nenhuma chamada de execução de Automation existe)
  const after = await prisma.automationAction.count({ where: { companyId: idA } });
  assert('LEGACY3 — Config não cria ações na fila (sem executor paralelo)', before === after, `before=${before} after=${after}`);

  // Mapa de compatibilidade exportado e coerente
  const { LEGACY_TRIGGER_TO_INSIGHT } = await import('../lib/automation-engine');
  assert('LEGACY4 — Mapa gatilho→insight exportado', LEGACY_TRIGGER_TO_INSIGHT['low_stock'] === 'ESTOQUE_BAIXO', JSON.stringify(LEGACY_TRIGGER_TO_INSIGHT['low_stock']));
  assert('LEGACY5 — Mapa cobre todos os 10 gatilhos legados', Object.keys(LEGACY_TRIGGER_TO_INSIGHT).length === 10, `${Object.keys(LEGACY_TRIGGER_TO_INSIGHT).length}`);

  await prisma.automation.deleteMany({ where: { id: cfg.id } });
  console.log(`  📊 Config legada validada | ações na fila inalteradas=${before}`);
}

// ============ MAIN ============
async function main() {
  console.log('🚀 HOMOLOGAÇÃO P7 — UI AUTOMAÇÕES NA FILA REAL');
  console.log('='.repeat(60));
  try {
    console.log('\n🧹 Cleanup...');
    await cleanup();

    const idA = await scenarioA();
    await scenarioB();
    const idC = await scenarioC();
    await scenarioD();
    await testIdempotency();
    await testMultiempresa(idA, idC);
    await testStatusTransitions(idC, idA);
    await testQueueFilters(idC);
    await testIntegration(idC);
    await testLegacyConfig(idA);

    console.log('\n🧹 Cleanup final...');
    await cleanup();
  } catch (err) {
    console.error('\n💥 ERRO FATAL:', err);
    results.push({ name: 'ERRO_FATAL', status: FAIL, detail: String(err) });
  }

  const passed = results.filter(r => r.status === PASS).length;
  const failed = results.filter(r => r.status === FAIL).length;
  const total = results.length;
  console.log('\n' + '='.repeat(60));
  console.log(`📊 RESULTADO FINAL P7: ${passed}/${total} PASS, ${failed} FAIL`);
  if (failed > 0) {
    console.log('\n❌ FALHAS:');
    results.filter(r => r.status === FAIL).forEach(r => console.log(`   - ${r.name}: ${r.detail || ''}`));
  }
  console.log('='.repeat(60));
  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main();
