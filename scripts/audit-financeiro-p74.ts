/**
 * PRIORIDADE 7.4 — AUDITORIA FINANCEIRA
 * Script de prova matemática para identificar inconsistências na DRE.
 * NÃO corrige nada — apenas evidencia.
 */

import { PrismaClient } from '@prisma/client';
import { calculateSalesMetrics, calculateDRE, getCashBalance } from '../lib/financial-engine';

const prisma = new PrismaClient();
const PREFIX = 'AUDIT_FIN_P74_';

// ============================================================
// HELPERS
// ============================================================

async function cleanup() {
  const companies = await prisma.company.findMany({ where: { name: { startsWith: PREFIX } }, select: { id: true } });
  for (const c of companies) {
    await prisma.salePayment.deleteMany({ where: { companyId: c.id } });
    await prisma.saleItem.deleteMany({ where: { sale: { companyId: c.id } } });
    await prisma.sale.deleteMany({ where: { companyId: c.id } });
    await prisma.cashMovement.deleteMany({ where: { companyId: c.id } });
    await prisma.financialRecord.deleteMany({ where: { companyId: c.id } });
    await prisma.accountReceivable.deleteMany({ where: { companyId: c.id } });
    await prisma.accountPayable.deleteMany({ where: { companyId: c.id } });
    await prisma.ledgerEntry.deleteMany({ where: { companyId: c.id } });
    await prisma.installmentPayment.deleteMany({ where: { companyId: c.id } });
    await prisma.installment.deleteMany({ where: { companyId: c.id } });
    await prisma.customerCredit.deleteMany({ where: { companyId: c.id } });
    await prisma.paymentMethod.deleteMany({ where: { companyId: c.id } });
    await prisma.cashAccount.deleteMany({ where: { companyId: c.id } });
    await prisma.product.deleteMany({ where: { companyId: c.id } });
    await prisma.seller.deleteMany({ where: { companyId: c.id } });
    await prisma.customer.deleteMany({ where: { companyId: c.id } });
    await prisma.user.deleteMany({ where: { companyId: c.id } });
    await prisma.pushScoreSnapshot.deleteMany({ where: { companyId: c.id } });
    await prisma.insight.deleteMany({ where: { companyId: c.id } });
    await prisma.automationAction.deleteMany({ where: { companyId: c.id } });
    await prisma.company.delete({ where: { id: c.id } });
  }
}

async function seedCompany(suffix: string) {
  const company = await prisma.company.create({
    data: { name: `${PREFIX}${suffix}`, cnpj: `AUDIT_${suffix}_${Date.now()}` },
  });
  const user = await prisma.user.create({
    data: { name: 'Auditor', email: `audit_${suffix.toLowerCase()}_${Date.now()}@test.com`, password: 'x', role: 'administrador', companyId: company.id },
  });
  const seller = await prisma.seller.create({
    data: { name: 'Vendedor Teste', companyId: company.id, userId: user.id },
  });
  const product = await prisma.product.create({
    data: { name: 'Produto Teste', sku: `SKU_${suffix}`, costPrice: 40, avgCost: 40, salePrice: 100, stockQuantity: 1000, minStock: 5, companyId: company.id },
  });
  const cashAccount = await prisma.cashAccount.create({
    data: { name: 'Caixa Principal', type: 'caixa_fisico', currentBalance: 0, companyId: company.id },
  });
  const payMethod = await prisma.paymentMethod.create({
    data: { name: 'Dinheiro', type: 'dinheiro', isActive: true, feePercent: 0, companyId: company.id, cashAccountId: cashAccount.id },
  });
  return { company, user, seller, product, cashAccount, payMethod };
}

async function createSale(params: {
  companyId: string;
  userId: string;
  productId: string;
  cashAccountId: string;
  paymentMethodId: string;
  qty: number;
  unitPrice: number;
  discount?: number;
  status?: string;
}) {
  const subtotal = params.qty * params.unitPrice;
  const discount = params.discount ?? 0;
  const total = subtotal - discount;
  const costPerUnit = 40; // avgCost
  const cmv = costPerUnit * params.qty;

  const sale = await prisma.sale.create({
    data: {
      companyId: params.companyId,
      sellerId: params.userId,
      subtotal,
      discount,
      total,
      status: params.status ?? 'concluida',
      items: {
        create: {
          productId: params.productId,
          quantity: params.qty,
          unitPrice: params.unitPrice,
          total: subtotal,
        },
      },
      payments: {
        create: {
          paymentMethodId: params.paymentMethodId,
          amount: total,
          received: true,
          feeAmount: 0,
          netAmount: total,
          expectedDate: new Date(),
          cashAccountId: params.cashAccountId,
          companyId: params.companyId,
        },
      },
    },
  });

  // Simular entrada no caixa
  if ((params.status ?? 'concluida') === 'concluida') {
    await prisma.cashAccount.update({
      where: { id: params.cashAccountId },
      data: { currentBalance: { increment: total } },
    });
    await prisma.cashMovement.create({
      data: {
        cashAccountId: params.cashAccountId,
        companyId: params.companyId,
        type: 'entrada',
        amount: total,
        description: `Venda #${sale.id}`,
        balanceBefore: 0,
        balanceAfter: total,
        origin: 'venda',
        reference: `sale:${sale.id}`,
      },
    });
  }

  return sale;
}

// ============================================================
// RESULTADOS
// ============================================================

interface TestResult {
  scenario: string;
  expected: Record<string, number>;
  actual: Record<string, number>;
  pass: boolean;
  issues: string[];
}

const results: TestResult[] = [];
let totalPass = 0;
let totalFail = 0;

function check(
  scenario: string,
  expected: Record<string, number>,
  actual: Record<string, number>
) {
  const issues: string[] = [];
  for (const [key, exp] of Object.entries(expected)) {
    const act = actual[key] ?? 0;
    if (Math.abs(act - exp) > 0.01) {
      issues.push(`${key}: esperado=${exp}, obtido=${act}, Δ=${(act - exp).toFixed(2)}`);
    }
  }
  const pass = issues.length === 0;
  if (pass) totalPass++; else totalFail++;
  results.push({ scenario, expected, actual, pass, issues });
  console.log(`  ${pass ? '✅' : '❌'} ${scenario}${issues.length ? ' → ' + issues.join('; ') : ''}`);
}

// ============================================================
// CENÁRIOS
// ============================================================

async function main() {
  console.log('\n=== PRIORIDADE 7.4 — AUDITORIA FINANCEIRA ===\n');
  console.log('Limpando dados de auditoria anterior...');
  await cleanup();

  // ============================================================
  // CENÁRIO A: Venda simples R$100, sem desconto, sem cancelamento
  // ============================================================
  console.log('\n--- CENÁRIO A: Venda simples R$100 ---');
  const a = await seedCompany('A');
  await createSale({
    companyId: a.company.id, userId: a.user.id, productId: a.product.id,
    cashAccountId: a.cashAccount.id, paymentMethodId: a.payMethod.id,
    qty: 1, unitPrice: 100,
  });
  const dreA = await calculateDRE(a.company.id);
  const metricsA = await calculateSalesMetrics(a.company.id);
  check('A.1 Receita Líquida = 100', { receitaLiquida: 100 }, { receitaLiquida: dreA.receitaLiquida });
  check('A.2 Faturamento Bruto = 100', { faturamentoBruto: 100 }, { faturamentoBruto: dreA.faturamentoBruto });
  check('A.3 Descontos = 0', { descontos: 0 }, { descontos: dreA.descontos });
  check('A.4 Devoluções = 0', { devolucoes: 0 }, { devolucoes: dreA.devolucoes });
  check('A.5 CMV = 40', { cmv: 40 }, { cmv: dreA.cmv });
  check('A.6 Lucro Bruto = 60', { lucroBruto: 60 }, { lucroBruto: dreA.margemBruta });
  check('A.7 Margem Bruta = 60%', { margemBrutaPct: 60 }, { margemBrutaPct: dreA.margemBrutaPct });

  // ============================================================
  // CENÁRIO B: Venda R$100 com desconto R$10
  // ============================================================
  console.log('\n--- CENÁRIO B: Venda R$100 com desconto R$10 ---');
  const b = await seedCompany('B');
  await createSale({
    companyId: b.company.id, userId: b.user.id, productId: b.product.id,
    cashAccountId: b.cashAccount.id, paymentMethodId: b.payMethod.id,
    qty: 1, unitPrice: 100, discount: 10,
  });
  const dreB = await calculateDRE(b.company.id);
  check('B.1 Faturamento Bruto = 100', { faturamentoBruto: 100 }, { faturamentoBruto: dreB.faturamentoBruto });
  check('B.2 Descontos = 10', { descontos: 10 }, { descontos: dreB.descontos });
  check('B.3 Receita Líquida = 90', { receitaLiquida: 90 }, { receitaLiquida: dreB.receitaLiquida });
  check('B.4 CMV = 40', { cmv: 40 }, { cmv: dreB.cmv });
  check('B.5 Lucro Bruto = 50', { lucroBruto: 50 }, { lucroBruto: dreB.margemBruta });

  // ============================================================
  // CENÁRIO C: Venda R$100, depois cancelada
  // Este é o cenário CRÍTICO para detectar dupla dedução
  // ============================================================
  console.log('\n--- CENÁRIO C: Venda R$100 CANCELADA ---');
  const c = await seedCompany('C');
  // Criar venda como concluida primeiro
  const saleC = await createSale({
    companyId: c.company.id, userId: c.user.id, productId: c.product.id,
    cashAccountId: c.cashAccount.id, paymentMethodId: c.payMethod.id,
    qty: 1, unitPrice: 100,
  });
  // Agora cancelar (simula o fluxo de cancelamento)
  await prisma.sale.update({ where: { id: saleC.id }, data: { status: 'cancelada' } });
  // Reverter caixa
  await prisma.cashAccount.update({
    where: { id: c.cashAccount.id },
    data: { currentBalance: { decrement: 100 } },
  });

  const dreC = await calculateDRE(c.company.id);
  const metricsC = await calculateSalesMetrics(c.company.id);

  console.log(`  [DADOS BRUTOS] faturamentoBruto=${dreC.faturamentoBruto}, devolucoes=${dreC.devolucoes}, receitaLiquida=${dreC.receitaLiquida}`);
  console.log(`  [DADOS BRUTOS] cmv=${dreC.cmv}, lucroBruto(margemBruta)=${dreC.margemBruta}`);

  check('C.1 Faturamento Bruto deve ser 0 (venda cancelada não conta como concluída)', { faturamentoBruto: 0 }, { faturamentoBruto: dreC.faturamentoBruto });
  check('C.2 Devoluções = 100 (venda cancelada aparece aqui)', { devolucoes: 100 }, { devolucoes: dreC.devolucoes });
  check('C.3 *** TESTE CRÍTICO: Receita Líquida DEVERIA ser 0 ***', { receitaLiquida: 0 }, { receitaLiquida: dreC.receitaLiquida });
  check('C.4 CMV deve ser 0 (venda cancelada, itens não contam)', { cmv: 0 }, { cmv: dreC.cmv });
  check('C.5 Lucro Bruto deve ser 0', { lucroBruto: 0 }, { lucroBruto: dreC.margemBruta });

  // ============================================================
  // CENÁRIO D: Duas vendas R$100, uma cancelada
  // Evidencia o impacto acumulativo
  // ============================================================
  console.log('\n--- CENÁRIO D: 2 vendas R$100, 1 cancelada ---');
  const d = await seedCompany('D');
  const saleD1 = await createSale({
    companyId: d.company.id, userId: d.user.id, productId: d.product.id,
    cashAccountId: d.cashAccount.id, paymentMethodId: d.payMethod.id,
    qty: 1, unitPrice: 100,
  });
  const saleD2 = await createSale({
    companyId: d.company.id, userId: d.user.id, productId: d.product.id,
    cashAccountId: d.cashAccount.id, paymentMethodId: d.payMethod.id,
    qty: 1, unitPrice: 100,
  });
  // Cancelar a segunda
  await prisma.sale.update({ where: { id: saleD2.id }, data: { status: 'cancelada' } });
  await prisma.cashAccount.update({
    where: { id: d.cashAccount.id },
    data: { currentBalance: { decrement: 100 } },
  });

  const dreD = await calculateDRE(d.company.id);
  console.log(`  [DADOS BRUTOS] faturamentoBruto=${dreD.faturamentoBruto}, devolucoes=${dreD.devolucoes}, receitaLiquida=${dreD.receitaLiquida}`);
  console.log(`  [DADOS BRUTOS] cmv=${dreD.cmv}, lucroBruto(margemBruta)=${dreD.margemBruta}`);

  check('D.1 Faturamento Bruto = 100 (apenas 1 concluída)', { faturamentoBruto: 100 }, { faturamentoBruto: dreD.faturamentoBruto });
  check('D.2 Devoluções = 100 (1 cancelada)', { devolucoes: 100 }, { devolucoes: dreD.devolucoes });
  check('D.3 *** Receita Líquida DEVERIA ser 100 (1 venda válida) ***', { receitaLiquida: 100 }, { receitaLiquida: dreD.receitaLiquida });
  check('D.4 CMV = 40 (apenas 1 venda concluída)', { cmv: 40 }, { cmv: dreD.cmv });
  check('D.5 Lucro Bruto DEVERIA ser 60', { lucroBruto: 60 }, { lucroBruto: dreD.margemBruta });

  // ============================================================
  // CENÁRIO E: Venda com taxas de cartão
  // ============================================================
  console.log('\n--- CENÁRIO E: Venda R$100 com taxa cartão R$3 ---');
  const e = await seedCompany('E');
  const payMethodCartao = await prisma.paymentMethod.create({
    data: { name: 'Cartão Crédito', type: 'credito', isActive: true, feePercent: 3, companyId: e.company.id, cashAccountId: e.cashAccount.id },
  });
  // Criar venda com taxa
  const saleE = await prisma.sale.create({
    data: {
      companyId: e.company.id, sellerId: e.user.id, subtotal: 100, discount: 0, total: 100, status: 'concluida',
      items: { create: { productId: e.product.id, quantity: 1, unitPrice: 100, total: 100 } },
      payments: { create: { paymentMethodId: payMethodCartao.id, amount: 100, received: true, feeAmount: 3, netAmount: 97, feePercent: 3, expectedDate: new Date(), cashAccountId: e.cashAccount.id, companyId: e.company.id } },
    },
  });
  await prisma.cashAccount.update({ where: { id: e.cashAccount.id }, data: { currentBalance: { increment: 97 } } });

  const dreE = await calculateDRE(e.company.id);
  check('E.1 Receita Líquida = 100', { receitaLiquida: 100 }, { receitaLiquida: dreE.receitaLiquida });
  check('E.2 CMV = 40', { cmv: 40 }, { cmv: dreE.cmv });
  check('E.3 Taxas Cartão = 3', { taxasCartao: 3 }, { taxasCartao: dreE.taxasCartao });
  check('E.4 Lucro Líquido = 57 (100 - 40 - 3)', { lucroLiquido: 57 }, { lucroLiquido: dreE.lucroLiquido });

  // ============================================================
  // RESUMO
  // ============================================================
  console.log('\n=== RESUMO DA AUDITORIA ===');
  console.log(`Total: ${totalPass + totalFail} testes`);
  console.log(`✅ Passou: ${totalPass}`);
  console.log(`❌ Falhou: ${totalFail}`);

  if (totalFail > 0) {
    console.log('\n=== PROBLEMAS ENCONTRADOS ===');
    for (const r of results.filter(r => !r.pass)) {
      console.log(`\n❌ ${r.scenario}:`);
      for (const issue of r.issues) {
        console.log(`   → ${issue}`);
      }
    }

    console.log('\n=== ANÁLISE DA CAUSA RAIZ ===');
    console.log('PROBLEMA: Dupla dedução de cancelamentos/devoluções na DRE.');
    console.log('');
    console.log('FÓRMULA ATUAL (INCORRETA):');
    console.log('  faturamentoBruto  = SUM(subtotal) WHERE status=concluida');
    console.log('  faturamentoLiquido = SUM(total) WHERE status=concluida');
    console.log('  devoluções         = SUM(total) WHERE status=cancelada');
    console.log('  receitaLiquida     = faturamentoLiquido - devoluções  ← ERRO AQUI');
    console.log('');
    console.log('EXPLICAÇÃO:');
    console.log('  Vendas canceladas NÃO entram em faturamentoBruto/faturamentoLiquido');
    console.log('  (filtro status=concluida exclui). Portanto, subtrair o valor delas');
    console.log('  como "devolução" é DUPLA DEDUÇÃO: o valor já foi excluído do faturamento.');
    console.log('');
    console.log('  Exemplo: Venda R$100 cancelada →');
    console.log('    faturamentoBruto = 0 (cancelada, não conta)');
    console.log('    devoluções = 100 (cancelada, conta aqui)');
    console.log('    receitaLiquida = 0 - 100 = -100  ← ERRADO (deveria ser 0)');
    console.log('');
    console.log('FÓRMULA CORRETA:');
    console.log('  Opção A: receitaLiquida = faturamentoLiquido (sem devoluções separadas)');
    console.log('           Devoluções = 0 (já excluídas do faturamento pelo filtro)');
    console.log('');
    console.log('  Opção B: Incluir canceladas no faturamentoBruto, depois deduzir:');
    console.log('           faturamentoBruto = SUM(subtotal) WHERE status IN (concluida, cancelada)');
    console.log('           devoluções = SUM(total) WHERE status=cancelada');
    console.log('           receitaLiquida = faturamentoBruto - descontos - devoluções');
    console.log('');
    console.log('RECOMENDAÇÃO: Opção A (mais simples, sem risco de regressão).');
    console.log('  Devoluções é um número INFORMATIVO (quantas vendas foram canceladas),');
    console.log('  mas NÃO deve ser deduzido da receita porque já está excluído.');
  }

  // Cleanup
  console.log('\nLimpando dados de auditoria...');
  await cleanup();
  console.log('Limpeza concluída.\n');

  await prisma.$disconnect();
  process.exit(totalFail > 0 ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
