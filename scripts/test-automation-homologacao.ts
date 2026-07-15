/**
 * HOMOLOGAÇÃO DAS AUTOMAÇÕES COMERCIAIS — PRIORIDADE 6
 * ============================================================================
 * Valida o Automation Engine que consome a IA Gerente (Insights + Push Score)
 * e gera AÇÕES AUTOMÁTICAS persistidas, idempotentes, auditáveis e multi-tenant.
 *
 * NENHUMA mensagem real é enviada. "Executar" = gerar ação + registrar log.
 *
 * Cenários:
 *   A) Loja excelente   → poucas automações, nenhuma crítica, principalmente RELATORIO_GERENCIAL
 *   B) Loja média       → automações médias, ALERTA_INTERNO, CLIENTE_INATIVO/ESTOQUE_BAIXO
 *   C) Loja crítica     → ações críticas, COBRANCA_CREDIARIO, PRODUTO_PARADO, ESTOQUE_BAIXO, ALERTA_INTERNO
 *   D) Empresa em formação → ZERO ações automáticas (EM_FORMACAO respeitado)
 *
 * Validações transversais:
 *   - Idempotência (2x mesmo dia → sem duplicação)
 *   - Multiempresa (sem contaminação cruzada)
 *   - Logs (cada ação tem timestamp, type, companyId, status, reference)
 *   - Endpoints (queue + run via funções do engine)
 *
 * Empresas isoladas: TEST_AUTOMACAO_*
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
  'TEST_AUTOMACAO_A',
  'TEST_AUTOMACAO_B',
  'TEST_AUTOMACAO_C',
  'TEST_AUTOMACAO_D',
  'TEST_AUTOMACAO_IDEMP',
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

async function seedProducts(companyId: string, count: number, stockQty: number = 50, minStock: number = 10) {
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

async function seedSales(companyId: string, products: any[], customers: any[], count: number, daysAgoStart: number = 0) {
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

/** Cria crediário com parcelas VENCIDAS (OVERDUE) para gerar COBRANCA_CREDIARIO. */
async function seedOverdueCrediario(companyId: string, products: any[], customers: any[], numClientes: number) {
  const pm = await prisma.paymentMethod.findFirst({ where: { companyId } });
  const caixa = await prisma.cashAccount.findFirst({ where: { companyId } });
  for (let i = 0; i < numClientes; i++) {
    const cust = customers[i % customers.length];
    const prod = products[i % products.length];
    // Crédito do cliente
    await prisma.customerCredit.upsert({
      where: { customerId: cust.id },
      create: { customerId: cust.id, companyId, creditLimit: 1000, usedLimit: 400, status: 'ACTIVE' },
      update: {},
    });
    // Venda a crediário
    const total = 400;
    const sale = await prisma.sale.create({
      data: {
        companyId, customerId: cust.id, subtotal: total, total, discount: 0, status: 'concluida',
        createdAt: new Date(Date.now() - 60 * 86400000),
        items: { create: [{ productId: prod.id, quantity: 1, unitPrice: total, total }] },
        payments: { create: [{ paymentMethodId: pm!.id, amount: total, received: false, expectedDate: new Date(Date.now() - 30 * 86400000), cashAccountId: caixa!.id, companyId }] },
      },
    });
    // Parcela vencida
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

// ========================================
// CENÁRIO A: LOJA EXCELENTE
// ========================================
async function scenarioA() {
  console.log('\n=== CENÁRIO A: Loja Excelente ===');
  const co = await createCompany('TEST_AUTOMACAO_A', 90);
  const products = await seedProducts(co.id, 10, 50, 10);
  const customers = await seedCustomers(co.id, 20, { lastPurchaseDaysAgo: 5, purchaseCount: 8, avgTicket: 200, totalPurchased: 1600 });
  await seedSales(co.id, products, customers, 30, 0);
  const caixa = await prisma.cashAccount.findFirst({ where: { companyId: co.id } });
  await prisma.cashAccount.update({ where: { id: caixa!.id }, data: { currentBalance: 50000 } });

  const { runAutomations, getAutomationQueue } = await import('../lib/automation-engine');
  const run = await runAutomations(co.id);
  const queue = await getAutomationQueue(co.id);
  const byType = countByType(queue);

  assert('A1 — Status ATIVO', run.status === 'ATIVO', `status=${run.status}`);
  assert('A2 — Gera ao menos 1 ação (relatório)', run.total >= 1, `total=${run.total}`);
  assert('A3 — Possui RELATORIO_GERENCIAL', byType['RELATORIO_GERENCIAL'] >= 1, JSON.stringify(byType));
  assert('A4 — Nenhuma ação crítica (ALTO)', queue.every(a => a.severity !== 'ALTO'), `altos=${queue.filter(a => a.severity === 'ALTO').length}`);
  assert('A5 — Sem COBRANCA_CREDIARIO', !byType['COBRANCA_CREDIARIO'], JSON.stringify(byType));
  assert('A6 — Poucas automações (≤4)', run.total <= 4, `total=${run.total}`);

  console.log(`  📊 Total=${run.total} | Tipos=${JSON.stringify(byType)}`);
  return co.id;
}

// ========================================
// CENÁRIO B: LOJA MÉDIA
// ========================================
async function scenarioB() {
  console.log('\n=== CENÁRIO B: Loja Média ===');
  const co = await createCompany('TEST_AUTOMACAO_B', 90);
  const products = await seedProducts(co.id, 15, 30, 10);
  const customers = await seedCustomers(co.id, 15, { lastPurchaseDaysAgo: 10, purchaseCount: 3, avgTicket: 150, totalPurchased: 450 });
  // Clientes sumidos (recorrentes, >30 dias) → CLIENTE_INATIVO
  await seedCustomers(co.id, 6, { lastPurchaseDaysAgo: 45, purchaseCount: 5, avgTicket: 200, totalPurchased: 1000 });
  await seedSales(co.id, products, customers, 20, 0);
  const caixa = await prisma.cashAccount.findFirst({ where: { companyId: co.id } });
  await prisma.cashAccount.update({ where: { id: caixa!.id }, data: { currentBalance: 5000 } });
  // Estoque baixo em vários produtos → ESTOQUE_BAIXO
  await prisma.product.updateMany({ where: { companyId: co.id }, data: { stockQuantity: 3 } });
  for (const p of products.slice(0, 5)) {
    await prisma.product.update({ where: { id: p.id }, data: { stockQuantity: 30 } });
  }

  const { runAutomations, getAutomationQueue } = await import('../lib/automation-engine');
  const run = await runAutomations(co.id);
  const queue = await getAutomationQueue(co.id);
  const byType = countByType(queue);

  assert('B1 — Status ATIVO', run.status === 'ATIVO');
  assert('B2 — Automações médias (≥2)', run.total >= 2, `total=${run.total}`);
  assert('B3 — Possui RELATORIO_GERENCIAL', byType['RELATORIO_GERENCIAL'] >= 1, JSON.stringify(byType));
  assert('B4 — Possui ESTOQUE_BAIXO ou CLIENTE_INATIVO', !!(byType['ESTOQUE_BAIXO'] || byType['CLIENTE_INATIVO']), JSON.stringify(byType));
  assert('B5 — Todas com PENDENTE inicialmente', queue.every(a => a.status === 'PENDENTE'));
  assert('B6 — Todas com title e description', queue.every(a => a.title.length > 0 && a.description.length > 0));

  console.log(`  📊 Total=${run.total} | Tipos=${JSON.stringify(byType)}`);
  return co.id;
}

// ========================================
// CENÁRIO C: LOJA CRÍTICA
// ========================================
async function scenarioC() {
  console.log('\n=== CENÁRIO C: Loja Crítica ===');
  const co = await createCompany('TEST_AUTOMACAO_C', 90);
  const products = await seedProducts(co.id, 10, 0, 10); // estoque zerado
  for (const p of products) {
    await prisma.product.update({ where: { id: p.id }, data: { salePrice: 35, costPrice: 30, avgCost: 30 } });
  }
  // Clientes sumidos recorrentes → CLIENTE_INATIVO
  const customers = await seedCustomers(co.id, 12, { lastPurchaseDaysAgo: 120, purchaseCount: 4, avgTicket: 80, totalPurchased: 320 });
  await seedSales(co.id, products, customers, 15, 30);
  const caixa = await prisma.cashAccount.findFirst({ where: { companyId: co.id } });
  await prisma.cashAccount.update({ where: { id: caixa!.id }, data: { currentBalance: 200 } });
  // Contas a pagar vencidas → risco financeiro
  for (let i = 0; i < 5; i++) {
    await prisma.accountPayable.create({
      data: { description: `Conta vencida ${i + 1}`, amount: 500, dueDate: new Date(Date.now() - 10 * 86400000), status: 'pendente', companyId: co.id },
    });
  }
  // Crediário vencido → COBRANCA_CREDIARIO
  await seedOverdueCrediario(co.id, products, customers, 6);
  // Produtos parados (sem venda há muito tempo) também já cobertos por estoque zerado/excessivo

  const { runAutomations, getAutomationQueue } = await import('../lib/automation-engine');
  const run = await runAutomations(co.id);
  const queue = await getAutomationQueue(co.id);
  const byType = countByType(queue);

  assert('C1 — Status ATIVO', run.status === 'ATIVO');
  assert('C2 — Muitas automações (≥3)', run.total >= 3, `total=${run.total}`);
  assert('C3 — Possui COBRANCA_CREDIARIO', byType['COBRANCA_CREDIARIO'] >= 1, JSON.stringify(byType));
  assert('C4 — Possui ação crítica (ALTO)', queue.some(a => a.severity === 'ALTO'), `altos=${queue.filter(a => a.severity === 'ALTO').length}`);
  assert('C5 — Possui ESTOQUE_BAIXO', byType['ESTOQUE_BAIXO'] >= 1, JSON.stringify(byType));
  assert('C6 — Possui CLIENTE_INATIVO', byType['CLIENTE_INATIVO'] >= 1, JSON.stringify(byType));
  assert('C7 — Mensagem sugerida em ação de contato', queue.filter(a => a.type === 'COBRANCA_CREDIARIO' || a.type === 'CLIENTE_INATIVO').some(a => (a.payload as any)?.mensagemSugerida != null), 'sem template');

  console.log(`  📊 Total=${run.total} | Tipos=${JSON.stringify(byType)}`);
  return co.id;
}

// ========================================
// CENÁRIO D: EMPRESA EM FORMAÇÃO
// ========================================
async function scenarioD() {
  console.log('\n=== CENÁRIO D: Empresa em Formação ===');
  const co = await createCompany('TEST_AUTOMACAO_D', 5); // 5 dias
  const products = await seedProducts(co.id, 3, 0, 5);
  const customers = await seedCustomers(co.id, 2, { lastPurchaseDaysAgo: 120, purchaseCount: 4 });
  await seedSales(co.id, products, customers, 3, 0); // < MIN_SALES

  const { runAutomations, getAutomationQueue } = await import('../lib/automation-engine');
  const run = await runAutomations(co.id);
  const queue = await getAutomationQueue(co.id);

  assert('D1 — Status EM_FORMACAO', run.status === 'EM_FORMACAO', `status=${run.status}`);
  assert('D2 — ZERO ações geradas', run.total === 0, `total=${run.total}`);
  assert('D3 — Fila vazia', queue.length === 0, `queue=${queue.length}`);
  assert('D4 — created=0 e existing=0', run.created === 0 && run.existing === 0);

  console.log(`  📊 Status=${run.status} | Total=${run.total}`);
  return co.id;
}

// ========================================
// IDEMPOTÊNCIA
// ========================================
async function testIdempotency() {
  console.log('\n=== IDEMPOTÊNCIA ===');
  const co = await createCompany('TEST_AUTOMACAO_IDEMP', 90);
  const products = await seedProducts(co.id, 8, 2, 10); // estoque baixo
  const customers = await seedCustomers(co.id, 10, { lastPurchaseDaysAgo: 45, purchaseCount: 5, avgTicket: 200, totalPurchased: 1000 });
  await seedSales(co.id, products, customers, 15, 0);
  const caixa = await prisma.cashAccount.findFirst({ where: { companyId: co.id } });
  await prisma.cashAccount.update({ where: { id: caixa!.id }, data: { currentBalance: 3000 } });

  const { runAutomations } = await import('../lib/automation-engine');
  const r1 = await runAutomations(co.id);
  const countAfter1 = await prisma.automationAction.count({ where: { companyId: co.id } });
  const r2 = await runAutomations(co.id);
  const countAfter2 = await prisma.automationAction.count({ where: { companyId: co.id } });

  assert('IDEMP1 — 1ª execução cria ações', r1.created > 0, `created=${r1.created}`);
  assert('IDEMP2 — 2ª execução não cria novas', r2.created === 0, `created2=${r2.created}`);
  assert('IDEMP3 — 2ª execução reconhece existentes', r2.existing === r1.total, `existing=${r2.existing} total1=${r1.total}`);
  assert('IDEMP4 — Contagem estável (sem duplicação)', countAfter1 === countAfter2, `c1=${countAfter1} c2=${countAfter2}`);
  assert('IDEMP5 — Total idêntico nas 2 execuções', r1.total === r2.total, `t1=${r1.total} t2=${r2.total}`);

  console.log(`  📊 Execução 1: created=${r1.created} | Execução 2: created=${r2.created} existing=${r2.existing} | Rows=${countAfter2}`);
  return co.id;
}

// ========================================
// MULTIEMPRESA
// ========================================
async function testMultiempresa(idA: string, idC: string) {
  console.log('\n=== MULTIEMPRESA ===');
  const actionsA = await prisma.automationAction.findMany({ where: { companyId: idA } });
  const actionsC = await prisma.automationAction.findMany({ where: { companyId: idC } });

  assert('MULTI1 — Empresa A tem ações próprias', actionsA.length > 0, `A=${actionsA.length}`);
  assert('MULTI2 — Empresa C tem ações próprias', actionsC.length > 0, `C=${actionsC.length}`);
  assert('MULTI3 — Todas de A pertencem a A', actionsA.every(a => a.companyId === idA));
  assert('MULTI4 — Todas de C pertencem a C', actionsC.every(a => a.companyId === idC));
  assert('MULTI5 — Nenhum vazamento (IDs disjuntos)', actionsA.every(a => !actionsC.find(c => c.id === a.id)));
  // A (excelente) deve ter menos/igual ações que C (crítica)
  assert('MULTI6 — Crítica gera mais ações que excelente', actionsC.length >= actionsA.length, `A=${actionsA.length} C=${actionsC.length}`);

  console.log(`  📊 Ações A=${actionsA.length} | Ações C=${actionsC.length}`);
}

// ========================================
// LOGS / RASTREABILIDADE
// ========================================
async function testLogs(idC: string) {
  console.log('\n=== LOGS / RASTREABILIDADE ===');
  const actions = await prisma.automationAction.findMany({ where: { companyId: idC } });

  assert('LOG1 — Cada ação tem timestamp (createdAt)', actions.every(a => a.createdAt instanceof Date));
  assert('LOG2 — Cada ação tem type válido', actions.every(a => !!a.type && a.type.length > 0));
  assert('LOG3 — Cada ação tem companyId', actions.every(a => a.companyId === idC));
  assert('LOG4 — Cada ação tem status válido', actions.every(a => ['PENDENTE', 'EXECUTADO', 'IGNORADO', 'ERRO'].includes(a.status)));
  assert('LOG5 — Cada ação tem reference', actions.every(a => !!a.reference && a.reference.length > 0));

  // ActivityLog de auditoria da execução
  const auditLogs = await prisma.activityLog.findMany({ where: { companyId: idC, action: 'automation_run' } });
  assert('LOG6 — ActivityLog de automation_run registrado', auditLogs.length >= 1, `logs=${auditLogs.length}`);
  assert('LOG7 — Audit log tem metadata', auditLogs.every(l => l.metadata != null));

  // Tipos e status distintos cobertos
  const tipos = new Set(actions.map(a => a.type));
  const statuses = new Set(actions.map(a => a.status));
  assert('LOG8 — Ao menos 4 tipos distintos no conjunto crítico', tipos.size >= 4, `tipos=${[...tipos].join(',')}`);
  assert('LOG9 — Status PENDENTE presente', statuses.has('PENDENTE'));

  console.log(`  📊 Tipos=${[...tipos].join(', ')} | AuditLogs=${auditLogs.length}`);
}

// ========================================
// TRANSIÇÃO DE STATUS (EXECUTADO/IGNORADO/ERRO)
// ========================================
async function testStatusTransitions(idC: string) {
  console.log('\n=== TRANSIÇÃO DE STATUS ===');
  const { updateAutomationStatus, getAutomationQueue } = await import('../lib/automation-engine');
  const pending = await prisma.automationAction.findMany({ where: { companyId: idC, status: 'PENDENTE' }, take: 3 });
  assert('STATUS0 — Há ações pendentes para transicionar', pending.length >= 2, `pendentes=${pending.length}`);

  const exec = await updateAutomationStatus(idC, pending[0].id, 'EXECUTADO');
  const ign = await updateAutomationStatus(idC, pending[1].id, 'IGNORADO');
  assert('STATUS1 — EXECUTADO marca executedAt', exec?.status === 'EXECUTADO' && exec?.executedAt != null);
  assert('STATUS2 — IGNORADO aplicado', ign?.status === 'IGNORADO');

  // Cross-tenant: tentar atualizar ação de outra empresa retorna null
  const otherCo = await prisma.company.findFirst({ where: { name: 'TEST_AUTOMACAO_A' } });
  const crossAttempt = await updateAutomationStatus(otherCo!.id, pending[2].id, 'EXECUTADO');
  assert('STATUS3 — Cross-tenant bloqueado (null)', crossAttempt === null);

  // Fila PENDENTE diminui após executar/ignorar
  const queuePend = await getAutomationQueue(idC, { status: 'PENDENTE' });
  const queueExec = await getAutomationQueue(idC, { status: 'EXECUTADO' });
  assert('STATUS4 — Fila EXECUTADO contém a ação', queueExec.some(a => a.id === pending[0].id));
  assert('STATUS5 — Fila PENDENTE não contém executada', !queuePend.some(a => a.id === pending[0].id));

  // Re-executar geração NÃO reabre status já tratados (preserva EXECUTADO/IGNORADO)
  const { runAutomations } = await import('../lib/automation-engine');
  await runAutomations(idC);
  const reExec = await prisma.automationAction.findUnique({ where: { id: pending[0].id } });
  assert('STATUS6 — Re-execução preserva EXECUTADO', reExec?.status === 'EXECUTADO');

  console.log(`  📊 PENDENTE restantes=${queuePend.length} | EXECUTADO=${queueExec.length}`);
}

// ========================================
// MAIN
// ========================================
async function main() {
  console.log('🚀 HOMOLOGAÇÃO AUTOMAÇÕES COMERCIAIS — PRIORIDADE 6');
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
    await testLogs(idC);
    await testStatusTransitions(idC);

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
  console.log(`📊 RESULTADO FINAL: ${passed}/${total} PASS, ${failed} FAIL`);
  if (failed > 0) {
    console.log('\n❌ FALHAS:');
    results.filter(r => r.status === FAIL).forEach(r => console.log(`   - ${r.name}: ${r.detail || ''}`));
  }
  console.log('='.repeat(60));

  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main();
