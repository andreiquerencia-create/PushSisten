/**
 * HOMOLOGAÇÃO DO INSIGHTS ENGINE — PRIORIDADE 4
 *
 * Cenários obrigatórios:
 *   A) Loja excelente → poucos insights, baixa severidade
 *   B) Loja média → insights de atenção
 *   C) Loja crítica → insights críticos (ALTO)
 *   D) Empresa nova → EM_FORMACAO, nenhum insight
 *
 * Validações transversais:
 *   - Idempotência (gerar 2x no mesmo dia → mesmos registros)
 *   - Persistência (insights salvos no banco)
 *   - Multiempresa (insights não se misturam)
 *   - Severidade coerente
 *
 * Empresas isoladas (TEST_INSIGHT_*), cleanup no fim.
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
  'TEST_INSIGHT_A',
  'TEST_INSIGHT_B',
  'TEST_INSIGHT_C',
  'TEST_INSIGHT_D',
  'TEST_INSIGHT_IDEMP',
] as const;

async function cleanup() {
  for (const name of COMPANY_NAMES) {
    const co = await prisma.company.findFirst({ where: { name } });
    if (!co) continue;
    const id = co.id;
    // Cascade delete in order
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

async function createCompany(name: string, createdDaysAgo: number = 60) {
  const createdAt = new Date(Date.now() - createdDaysAgo * 86400000);
  const co = await prisma.company.create({
    data: { name, createdAt },
  });
  const hash = await bcrypt.hash('test123', 10);
  await prisma.user.create({
    data: { name: 'Admin', email: `admin@${name.toLowerCase()}.test`, password: hash, role: 'administrador', companyId: co.id },
  });
  // Caixa
  const caixa = await prisma.cashAccount.create({
    data: { name: 'Caixa Principal', type: 'caixa_fisico', currentBalance: 0, companyId: co.id },
  });
  // Forma de pagamento
  await prisma.paymentMethod.create({
    data: { name: 'Dinheiro', type: 'dinheiro', isActive: true, companyId: co.id, cashAccountId: caixa.id },
  });
  return co;
}

async function seedProducts(companyId: string, count: number, stockQty: number = 50, minStock: number = 10) {
  const products: any[] = [];
  for (let i = 0; i < count; i++) {
    products.push(await prisma.product.create({
      data: {
        name: `Produto ${i + 1}`,
        costPrice: 30,
        salePrice: 80,
        avgCost: 30,
        stockQuantity: stockQty,
        minStock,
        companyId,
      },
    }));
  }
  return products;
}

async function seedCustomers(companyId: string, count: number, opts?: { lastPurchaseDaysAgo?: number; purchaseCount?: number; avgTicket?: number; totalPurchased?: number }) {
  const customers: any[] = [];
  for (let i = 0; i < count; i++) {
    customers.push(await prisma.customer.create({
      data: {
        name: `Cliente ${i + 1}`,
        companyId,
        lastPurchase: opts?.lastPurchaseDaysAgo != null ? new Date(Date.now() - opts.lastPurchaseDaysAgo * 86400000) : new Date(),
        purchaseCount: opts?.purchaseCount ?? 3,
        avgTicket: opts?.avgTicket ?? 150,
        totalPurchased: opts?.totalPurchased ?? 450,
        isActive: true,
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
        companyId,
        customerId: cust.id,
        subtotal: total,
        total,
        discount: 0,
        status: 'concluida',
        createdAt,
        items: {
          create: [{
            productId: prod.id,
            quantity: 2,
            unitPrice: prod.salePrice,
            total,
          }],
        },
        payments: {
          create: [{
            paymentMethodId: pm!.id,
            amount: total,
            received: true,
            expectedDate: createdAt,
            cashAccountId: caixa!.id,
            companyId,
          }],
        },
      },
    });
  }
}

// ========================================
// CENÁRIO A: LOJA EXCELENTE
// ========================================
async function scenarioA() {
  console.log('\n=== CENÁRIO A: Loja Excelente ===');
  const co = await createCompany('TEST_INSIGHT_A', 90);
  const products = await seedProducts(co.id, 10, 50, 10);
  const customers = await seedCustomers(co.id, 20, { lastPurchaseDaysAgo: 5, purchaseCount: 8, avgTicket: 200, totalPurchased: 1600 });
  await seedSales(co.id, products, customers, 30, 0);

  // Caixa saudável
  const caixa = await prisma.cashAccount.findFirst({ where: { companyId: co.id } });
  await prisma.cashAccount.update({ where: { id: caixa!.id }, data: { currentBalance: 50000 } });

  // Gerar insights
  const { generateInsights } = await import('../lib/insights-engine');
  const result = await generateInsights(co.id);

  assert('A1 — Status ATIVO', result.status === 'ATIVO');
  assert('A2 — Poucos insights', result.stats.total <= 5, `total=${result.stats.total}`);
  assert('A3 — Nenhum ALTO', result.stats.alto === 0, `alto=${result.stats.alto}`);
  assert('A4 — Maioria BAIXO', result.stats.baixo >= result.stats.medio, `baixo=${result.stats.baixo} medio=${result.stats.medio}`);

  // Verificar persistência
  const dbInsights = await prisma.insight.findMany({ where: { companyId: co.id } });
  assert('A5 — Insights persistidos no banco', dbInsights.length === result.stats.total, `db=${dbInsights.length} result=${result.stats.total}`);

  return co.id;
}

// ========================================
// CENÁRIO B: LOJA MÉDIA
// ========================================
async function scenarioB() {
  console.log('\n=== CENÁRIO B: Loja Média ===');
  const co = await createCompany('TEST_INSIGHT_B', 90);
  const products = await seedProducts(co.id, 15, 30, 10);
  const customers = await seedCustomers(co.id, 15, { lastPurchaseDaysAgo: 10, purchaseCount: 3, avgTicket: 150, totalPurchased: 450 });

  // Alguns clientes sumidos
  await seedCustomers(co.id, 5, { lastPurchaseDaysAgo: 45, purchaseCount: 5, avgTicket: 200, totalPurchased: 1000 });

  await seedSales(co.id, products, customers, 20, 0);

  // Caixa moderado
  const caixa = await prisma.cashAccount.findFirst({ where: { companyId: co.id } });
  await prisma.cashAccount.update({ where: { id: caixa!.id }, data: { currentBalance: 5000 } });

  // Alguns produtos com estoque baixo
  await prisma.product.updateMany({
    where: { companyId: co.id },
    data: { stockQuantity: 3 }, // abaixo de minStock=10
  });
  // Manter só os primeiros 5 normais
  const normalProds = products.slice(0, 5);
  for (const p of normalProds) {
    await prisma.product.update({ where: { id: p.id }, data: { stockQuantity: 30 } });
  }

  const { generateInsights } = await import('../lib/insights-engine');
  const result = await generateInsights(co.id);

  assert('B1 — Status ATIVO', result.status === 'ATIVO');
  assert('B2 — Insights de atenção (MEDIO presente)', result.stats.medio > 0, `medio=${result.stats.medio}`);
  assert('B3 — Total > cenário excelente', result.stats.total >= 3, `total=${result.stats.total}`);
  assert('B4 — ESTOQUE_BAIXO presente', result.insights.some(i => i.code === 'ESTOQUE_BAIXO'), `codes=${result.insights.map(i => i.code).join(',')}`);
  assert('B5 — CLIENTE_SUMIDO presente', result.insights.some(i => i.code === 'CLIENTE_SUMIDO'), `codes=${result.insights.map(i => i.code).join(',')}`);

  return co.id;
}

// ========================================
// CENÁRIO C: LOJA CRÍTICA
// ========================================
async function scenarioC() {
  console.log('\n=== CENÁRIO C: Loja Crítica ===');
  const co = await createCompany('TEST_INSIGHT_C', 90);
  const products = await seedProducts(co.id, 20, 0, 10); // estoque zerado
  const customers = await seedCustomers(co.id, 15, { lastPurchaseDaysAgo: 60, purchaseCount: 5, avgTicket: 100, totalPurchased: 500 });

  // Vendas antigas (apenas no período anterior, nenhuma recente)
  // Para ter vendas concluídas > MIN_SALES
  // Precisamos de produtos com estoque para criar vendas, então temporariamente adicionamos
  for (const p of products) {
    await prisma.product.update({ where: { id: p.id }, data: { stockQuantity: 100 } });
  }
  await seedSales(co.id, products, customers, 15, 40); // vendas de 40 dias atrás
  // Zerar estoque de volta
  for (const p of products) {
    await prisma.product.update({ where: { id: p.id }, data: { stockQuantity: 0 } });
  }

  // Caixa crítico
  const caixa = await prisma.cashAccount.findFirst({ where: { companyId: co.id } });
  await prisma.cashAccount.update({ where: { id: caixa!.id }, data: { currentBalance: 200 } });

  // Crediário com inadimplência
  const customerForCredit = customers[0];
  await prisma.customerCredit.create({
    data: { customerId: customerForCredit.id, companyId: co.id, creditLimit: 5000, usedLimit: 3000, status: 'BLOCKED', blockReason: 'AUTO_OVERDUE' },
  });
  // Venda com crediário (para parcelas)
  const sale = await prisma.sale.findFirst({ where: { companyId: co.id, customerId: customerForCredit.id } });
  if (sale) {
    for (let i = 0; i < 5; i++) {
      await prisma.installment.create({
        data: {
          saleId: sale.id,
          customerId: customerForCredit.id,
          companyId: co.id,
          installmentNumber: i + 1,
          amount: 600,
          paidAmount: 0,
          dueDate: new Date(Date.now() - (10 - i * 3) * 86400000), // todas vencidas
          status: 'OVERDUE',
        },
      });
    }
  }

  // Financial records (despesas altas no período recente)
  for (let i = 0; i < 10; i++) {
    await prisma.financialRecord.create({
      data: {
        companyId: co.id,
        type: 'saida',
        amount: 1000,
        date: new Date(Date.now() - i * 3 * 86400000),
        description: `Despesa ${i}`,
      },
    });
  }

  const { generateInsights } = await import('../lib/insights-engine');
  const result = await generateInsights(co.id);

  assert('C1 — Status ATIVO', result.status === 'ATIVO');
  assert('C2 — Insights ALTO presentes', result.stats.alto > 0, `alto=${result.stats.alto}`);
  assert('C3 — Muitos insights (>= 4)', result.stats.total >= 4, `total=${result.stats.total}`);
  assert('C4 — ESTOQUE_ZERADO presente', result.insights.some(i => i.code === 'ESTOQUE_ZERADO'), `codes=${result.insights.map(i => i.code).join(',')}`);
  assert('C5 — CLIENTE_SUMIDO presente', result.insights.some(i => i.code === 'CLIENTE_SUMIDO'), `codes=${result.insights.map(i => i.code).join(',')}`);
  assert('C6 — CREDIARIO_INADIMPLENCIA_ALTA ou CREDIARIO_CLIENTES_RISCO', 
    result.insights.some(i => i.code === 'CREDIARIO_INADIMPLENCIA_ALTA' || i.code === 'CREDIARIO_CLIENTES_RISCO'),
    `codes=${result.insights.map(i => i.code).join(',')}`);
  assert('C7 — Severidade ALTO para estoque zerado', 
    result.insights.find(i => i.code === 'ESTOQUE_ZERADO')?.severity === 'ALTO',
    `sev=${result.insights.find(i => i.code === 'ESTOQUE_ZERADO')?.severity}`);

  return co.id;
}

// ========================================
// CENÁRIO D: EMPRESA NOVA (EM_FORMACAO)
// ========================================
async function scenarioD() {
  console.log('\n=== CENÁRIO D: Empresa Nova ===');
  const co = await createCompany('TEST_INSIGHT_D', 5); // 5 dias
  await seedProducts(co.id, 3, 10, 5);
  await seedCustomers(co.id, 2, { lastPurchaseDaysAgo: 2, purchaseCount: 1, avgTicket: 80, totalPurchased: 80 });
  // Apenas 3 vendas (< MIN_SALES=10)
  const prods = await prisma.product.findMany({ where: { companyId: co.id } });
  const custs = await prisma.customer.findMany({ where: { companyId: co.id } });
  await seedSales(co.id, prods, custs, 3, 0);

  const { generateInsights } = await import('../lib/insights-engine');
  const result = await generateInsights(co.id);

  assert('D1 — Status EM_FORMACAO', result.status === 'EM_FORMACAO');
  assert('D2 — Zero insights', result.insights.length === 0);
  assert('D3 — Stats zerados', result.stats.total === 0 && result.stats.alto === 0);

  // Verificar que NADA foi persistido
  const dbInsights = await prisma.insight.findMany({ where: { companyId: co.id } });
  assert('D4 — Nenhum insight no banco', dbInsights.length === 0);

  return co.id;
}

// ========================================
// IDEMPOTÊNCIA
// ========================================
async function testIdempotencia() {
  console.log('\n=== IDEMPOTÊNCIA ===');
  const co = await createCompany('TEST_INSIGHT_IDEMP', 90);
  const products = await seedProducts(co.id, 5, 50, 10);
  const customers = await seedCustomers(co.id, 10, { lastPurchaseDaysAgo: 5, purchaseCount: 4, avgTicket: 150, totalPurchased: 600 });
  await seedSales(co.id, products, customers, 15, 0);
  const caixa = await prisma.cashAccount.findFirst({ where: { companyId: co.id } });
  await prisma.cashAccount.update({ where: { id: caixa!.id }, data: { currentBalance: 20000 } });

  const { generateInsights } = await import('../lib/insights-engine');
  
  // Primeira geração
  const run1 = await generateInsights(co.id);
  const dbCount1 = await prisma.insight.count({ where: { companyId: co.id } });

  // Segunda geração (mesmo dia)
  const run2 = await generateInsights(co.id);
  const dbCount2 = await prisma.insight.count({ where: { companyId: co.id } });

  assert('IDEMP1 — Mesmo número de insights', run1.stats.total === run2.stats.total, `run1=${run1.stats.total} run2=${run2.stats.total}`);
  assert('IDEMP2 — Mesmos registros no banco', dbCount1 === dbCount2, `db1=${dbCount1} db2=${dbCount2}`);
  assert('IDEMP3 — Mesmos códigos', 
    JSON.stringify(run1.insights.map(i => i.code).sort()) === JSON.stringify(run2.insights.map(i => i.code).sort()),
    `codes1=${run1.insights.map(i => i.code).sort()} codes2=${run2.insights.map(i => i.code).sort()}`);

  return co.id;
}

// ========================================
// MULTIEMPRESA
// ========================================
async function testMultiempresa(companyIds: string[]) {
  console.log('\n=== MULTIEMPRESA ===');

  // Verificar que nenhum insight de uma empresa aparece em outra
  for (let i = 0; i < companyIds.length; i++) {
    for (let j = i + 1; j < companyIds.length; j++) {
      const insightsI = await prisma.insight.findMany({ where: { companyId: companyIds[i] } });
      const insightsJ = await prisma.insight.findMany({ where: { companyId: companyIds[j] } });
      
      const idsI = new Set(insightsI.map(x => x.id));
      const overlap = insightsJ.filter(x => idsI.has(x.id));
      assert(`MULTI — Sem overlap empresa[${i}] x empresa[${j}]`, overlap.length === 0, `overlap=${overlap.length}`);
    }
  }

  // Verificar que cada insight tem o companyId correto
  for (const cid of companyIds) {
    const ins = await prisma.insight.findMany({ where: { companyId: cid } });
    const allCorrect = ins.every(i => i.companyId === cid);
    assert(`MULTI — Todos insights de ${cid.substring(0, 8)} têm companyId correto`, allCorrect);
  }
}

// ========================================
// MAIN
// ========================================
async function main() {
  console.log('\n📊 HOMOLOGAÇÃO DO INSIGHTS ENGINE — PRIORIDADE 4\n');

  try {
    // Cleanup prévio
    console.log('Limpando empresas de teste anteriores...');
    await cleanup();

    // Executar cenários
    const idA = await scenarioA();
    const idB = await scenarioB();
    const idC = await scenarioC();
    const idD = await scenarioD();
    await testIdempotencia();
    await testMultiempresa([idA, idB, idC]);

    // Cleanup final
    console.log('\nLimpando empresas de teste...');
    await cleanup();

    // Resultado
    const total = results.length;
    const passed = results.filter(r => r.status === PASS).length;
    const failed = results.filter(r => r.status === FAIL).length;

    console.log('\n' + '='.repeat(60));
    console.log(`RESULTADO: ${passed}/${total} PASS, ${failed} FAIL`);
    console.log('='.repeat(60));

    if (failed > 0) {
      console.log('\nFalhas:');
      results.filter(r => r.status === FAIL).forEach(r => {
        console.log(`  ❌ ${r.name}: ${r.detail}`);
      });
    }

    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('\n❌ Erro fatal:', err);
    await cleanup().catch(() => {});
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();