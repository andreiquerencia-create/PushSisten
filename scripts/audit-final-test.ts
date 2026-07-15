/**
 * TESTE CONTROLADO DE AUDITORIA FINANCEIRA — EMPRESA TESTE AUDITORIA FINAL
 *
 * Cria uma empresa limpa com dados determinísticos, calcula os valores ESPERADOS
 * manualmente e compara com os valores ENCONTRADOS pelo financial-engine e audit-engine.
 *
 * Rodar:  yarn tsx scripts/audit-final-test.ts
 */
import { prisma } from '@/lib/db';
import {
  calculateSalesMetrics,
  getCashBalance,
  calculateStockMetrics,
  calculateDRE,
  getReceivables,
} from '@/lib/financial-engine';
import { runAudit } from '@/lib/audit-engine';
import { seedAccountPlanForCompany } from '@/lib/account-plan-seed';
import bcrypt from 'bcryptjs';

const COMPANY_NAME = 'EMPRESA TESTE AUDITORIA FINAL';
const ADMIN_EMAIL = 'auditoria.final@pushsisten.com';
const ADMIN_PASS = 'auditoria123';

// ---------- util de asserção ----------
let pass = 0;
let fail = 0;
const lines: string[] = [];
function log(s = '') { console.log(s); lines.push(s); }
function money(v: number) { return 'R$ ' + (v ?? 0).toFixed(2); }
function check(label: string, esperado: number, encontrado: number, tol = 0.01) {
  const ok = Math.abs((esperado ?? 0) - (encontrado ?? 0)) <= tol;
  ok ? pass++ : fail++;
  log(`  ${ok ? '✅ PASSOU' : '❌ FALHOU'} | ${label}`);
  log(`       esperado = ${money(esperado)}   encontrado = ${money(encontrado)}` + (ok ? '' : '   <<< DIVERGÊNCIA'));
}
function checkInt(label: string, esperado: number, encontrado: number) {
  const ok = esperado === encontrado;
  ok ? pass++ : fail++;
  log(`  ${ok ? '✅ PASSOU' : '❌ FALHOU'} | ${label}`);
  log(`       esperado = ${esperado}   encontrado = ${encontrado}` + (ok ? '' : '   <<< DIVERGÊNCIA'));
}

async function cleanup(companyId: string) {
  // Remove em ordem segura (relações primeiro)
  await prisma.salePayment.deleteMany({ where: { companyId } });
  await prisma.saleItem.deleteMany({ where: { sale: { companyId } } });
  await prisma.sale.deleteMany({ where: { companyId } });
  await prisma.accountReceivable.deleteMany({ where: { companyId } });
  await prisma.accountPayable.deleteMany({ where: { companyId } });
  await prisma.financialRecord.deleteMany({ where: { companyId } });
  await prisma.cashMovement.deleteMany({ where: { companyId } });
  await prisma.paymentMethod.deleteMany({ where: { companyId } });
  await prisma.cashAccount.deleteMany({ where: { companyId } });
  await prisma.customer.deleteMany({ where: { companyId } });
  await prisma.product.deleteMany({ where: { companyId } });
  await prisma.accountPlan.deleteMany({ where: { companyId } });
  await prisma.activityLog.deleteMany({ where: { companyId } });
  await prisma.user.deleteMany({ where: { companyId } });
  await prisma.company.delete({ where: { id: companyId } }).catch(() => {});
}

async function main() {
  log('================================================================');
  log('   TESTE CONTROLADO DE AUDITORIA — ' + COMPANY_NAME);
  log('   ' + new Date().toISOString());
  log('================================================================');

  // 0) limpar empresa anterior de mesmo nome
  const existing = await prisma.company.findFirst({ where: { name: COMPANY_NAME } });
  if (existing) { log('\n[setup] Removendo empresa de teste anterior...'); await cleanup(existing.id); }

  // 1) empresa + usuário admin
  const now = new Date();
  const company = await prisma.company.create({
    data: { name: COMPANY_NAME, plan: 'pro', subscriptionStatus: 'active', isActive: true, maxUsers: 10 },
  });
  const companyId = company.id;
  await prisma.user.create({
    data: { name: 'Admin Auditoria', email: ADMIN_EMAIL, password: await bcrypt.hash(ADMIN_PASS, 10), role: 'administrador', companyId },
  });
  await seedAccountPlanForCompany(companyId, prisma as any);
  log(`\n[setup] Empresa criada: ${companyId}`);

  // 2) caixa + formas de pagamento
  const caixa = await prisma.cashAccount.create({ data: { name: 'Caixa Geral', type: 'dinheiro', initialBalance: 0, currentBalance: 0, companyId } });
  const pmCash = await prisma.paymentMethod.create({ data: { name: 'Dinheiro', type: 'dinheiro', feePercent: 0, cashAccountId: caixa.id, companyId } });
  const pmCard = await prisma.paymentMethod.create({ data: { name: 'Cartão Crédito', type: 'cartao_credito', feePercent: 3, cashAccountId: caixa.id, companyId } });
  const pmPrazo = await prisma.paymentMethod.create({ data: { name: 'A Prazo / Boleto', type: 'boleto', feePercent: 0, cashAccountId: caixa.id, companyId } });

  // 3) produtos (P3 com custo ZERO de propósito; P4 com estoque NEGATIVO de propósito)
  const P1 = await prisma.product.create({ data: { name: 'Camiseta', sku: 'CAM-01', salePrice: 100, costPrice: 40, avgCost: 40, stockQuantity: 95, minStock: 5, companyId } });
  const P2 = await prisma.product.create({ data: { name: 'Calça', sku: 'CAL-01', salePrice: 200, costPrice: 80, avgCost: 80, stockQuantity: 49, minStock: 5, companyId } });
  const P3 = await prisma.product.create({ data: { name: 'Boné (SEM custo)', sku: 'BON-01', salePrice: 50, costPrice: 0, avgCost: 0, stockQuantity: 18, minStock: 5, companyId } });
  const P4 = await prisma.product.create({ data: { name: 'Meia (estoque NEG)', sku: 'MEI-01', salePrice: 20, costPrice: 10, avgCost: 10, stockQuantity: -3, minStock: 5, companyId } });

  // 4) clientes
  const cliA = await prisma.customer.create({ data: { name: 'Cliente A', companyId, totalPurchased: 9999, purchaseCount: 1 } }); // total ERRADO de propósito
  const cliB = await prisma.customer.create({ data: { name: 'Cliente B', companyId, totalPurchased: 200, purchaseCount: 1 } });
  const cliC = await prisma.customer.create({ data: { name: 'Cliente C', companyId, totalPurchased: 300, purchaseCount: 1 } });

  // 5) VENDAS CONCLUÍDAS (todas hoje → mês atual)
  // Venda A: 2x P1 @100 = 200 | dinheiro recebido | CMV=80
  const sA = await prisma.sale.create({ data: { companyId, customerId: cliA.id, subtotal: 200, discount: 0, total: 200, status: 'concluida', paymentMethod: 'dinheiro', createdAt: now,
    items: { create: [{ productId: P1.id, quantity: 2, unitPrice: 100, discount: 0, total: 200 }] } } });
  await prisma.salePayment.create({ data: { saleId: sA.id, paymentMethodId: pmCash.id, amount: 200, feePercent: 0, feeAmount: 0, netAmount: 200, expectedDate: now, received: true, receivedDate: now, cashAccountId: caixa.id, companyId } });

  // Venda B: 1x P2 @200 = 200 | cartão 3% recebido | CMV=80 | taxa=6
  const sB = await prisma.sale.create({ data: { companyId, customerId: cliB.id, subtotal: 200, discount: 0, total: 200, status: 'concluida', paymentMethod: 'cartao_credito', createdAt: now,
    items: { create: [{ productId: P2.id, quantity: 1, unitPrice: 200, discount: 0, total: 200 }] } } });
  await prisma.salePayment.create({ data: { saleId: sB.id, paymentMethodId: pmCard.id, amount: 200, feePercent: 3, feeAmount: 6, netAmount: 194, expectedDate: now, received: true, receivedDate: now, cashAccountId: caixa.id, companyId } });

  // Venda C: 3x P1 @100 = 300 | A PRAZO (não recebido) | CMV=120 | taxa=0
  const sC = await prisma.sale.create({ data: { companyId, customerId: cliC.id, subtotal: 300, discount: 0, total: 300, status: 'concluida', paymentMethod: 'boleto', createdAt: now,
    items: { create: [{ productId: P1.id, quantity: 3, unitPrice: 100, discount: 0, total: 300 }] } } });
  await prisma.salePayment.create({ data: { saleId: sC.id, paymentMethodId: pmPrazo.id, amount: 300, feePercent: 0, feeAmount: 0, netAmount: 300, expectedDate: now, received: false, cashAccountId: caixa.id, companyId } });

  // Venda E: 2x P3 @50 = 100 | dinheiro recebido | CMV=0 (produto sem custo → INCONSISTÊNCIA)
  const sE = await prisma.sale.create({ data: { companyId, subtotal: 100, discount: 0, total: 100, status: 'concluida', paymentMethod: 'dinheiro', createdAt: now,
    items: { create: [{ productId: P3.id, quantity: 2, unitPrice: 50, discount: 0, total: 100 }] } } });
  await prisma.salePayment.create({ data: { saleId: sE.id, paymentMethodId: pmCash.id, amount: 100, feePercent: 0, feeAmount: 0, netAmount: 100, expectedDate: now, received: true, receivedDate: now, cashAccountId: caixa.id, companyId } });

  // 6) VENDA CANCELADA com pagamento AINDA recebido (INCONSISTÊNCIA → audit check 1)
  const sD = await prisma.sale.create({ data: { companyId, subtotal: 100, discount: 0, total: 100, status: 'cancelada', paymentMethod: 'dinheiro', createdAt: now,
    items: { create: [{ productId: P1.id, quantity: 1, unitPrice: 100, discount: 0, total: 100 }] } } });
  await prisma.salePayment.create({ data: { saleId: sD.id, paymentMethodId: pmCash.id, amount: 100, feePercent: 0, feeAmount: 0, netAmount: 100, expectedDate: now, received: true, receivedDate: now, cashAccountId: caixa.id, companyId } });

  // 7) CONTAS A RECEBER
  const dueIn15 = new Date(now.getTime() + 15 * 86400000);
  await prisma.accountReceivable.create({ data: { companyId, description: 'AR manual pendente', amount: 150, dueDate: dueIn15, status: 'pendente', customerId: cliC.id } });
  // AR pendente vinculada a venda CANCELADA (INCONSISTÊNCIA → audit check 2)
  await prisma.accountReceivable.create({ data: { companyId, description: 'AR de venda cancelada', amount: 100, dueDate: dueIn15, status: 'pendente', saleId: sD.id } });

  // 8) REGISTRO FINANCEIRO ÓRFÃO (reference inexistente → audit check 11)
  await prisma.financialRecord.create({ data: { companyId, description: 'FR órfão de teste', amount: 77, type: 'entrada', reference: 'id-inexistente-xyz', date: now } });

  // 9) saldo de caixa REAL (recebidos não estornados): A200 + B194 + E100 + D100(cancelada não estornada) = 594
  await prisma.cashAccount.update({ where: { id: caixa.id }, data: { currentBalance: 594 } });

  // ============================================================
  //  VALORES ESPERADOS (calculados manualmente)
  // ============================================================
  const EXP = {
    faturamentoBruto: 800,      // 200+200+300+100 (concluídas)
    faturamentoLiquido: 800,
    cmv: 280,                   // 80+80+120+0
    taxasCartao: 6,             // só venda B
    devolucoes: 100,            // venda D cancelada
    receitaLiquida: 700,        // 800 - 100
    lucroBruto: 420,            // 700 - 280
    lucroLiquido: 414,          // 420 - 6
    totalVendas: 4,
    ticketMedio: 200,           // 800 / 4
    saldoCaixa: 594,
    arPendente: 250,            // 150 + 100
    spNaoRecebido: 300,         // venda C
    receberTotal: 550,          // 250 + 300
    capitalInvestido: 7690,     // 95*40 + 49*80 + 18*0 + (-3*10) = 3800+3920+0-30
    totalPecas: 159,            // 95+49+18-3
  };

  const monthFilter = { gte: new Date(now.getFullYear(), now.getMonth(), 1) };
  const sm = await calculateSalesMetrics(companyId, monthFilter);
  const cb = await getCashBalance(companyId);
  const stk = await calculateStockMetrics(companyId);
  const rec = await getReceivables(companyId);
  const dre = await calculateDRE(companyId, monthFilter);

  log('\n================================================================');
  log('  TESTE 1 — FATURAMENTO (engine vs cálculo manual)');
  log('================================================================');
  check('Faturamento bruto', EXP.faturamentoBruto, sm.faturamentoBruto);
  check('Faturamento líquido', EXP.faturamentoLiquido, sm.faturamentoLiquido);
  checkInt('Total de vendas concluídas', EXP.totalVendas, sm.totalVendas);
  check('Ticket médio', EXP.ticketMedio, sm.ticketMedio);

  log('\n================================================================');
  log('  TESTE 2 — CMV (engine vs cálculo manual)');
  log('================================================================');
  check('CMV (avgCost × qty)', EXP.cmv, sm.cmv);

  log('\n================================================================');
  log('  TESTE 3 — LUCRO BRUTO / LÍQUIDO');
  log('================================================================');
  check('Receita líquida (fat. líq − devoluções)', EXP.receitaLiquida, sm.receitaLiquida);
  check('Lucro bruto (rec.líq − CMV)', EXP.lucroBruto, sm.lucroBruto);
  check('Taxas de cartão', EXP.taxasCartao, sm.taxasCartao);
  check('Lucro líquido vendas (bruto − taxas)', EXP.lucroLiquido, sm.lucroLiquido);

  log('\n================================================================');
  log('  TESTE 4 — SALDO DE CAIXA (= Σ CashAccount.currentBalance)');
  log('================================================================');
  check('Saldo de caixa', EXP.saldoCaixa, cb.saldo);

  log('\n================================================================');
  log('  TESTE 5 — CONTAS A RECEBER (unificado)');
  log('================================================================');
  check('AR pendente', EXP.arPendente, rec.saldoAccountReceivablePendente);
  check('SalePayment não recebido', EXP.spNaoRecebido, rec.saldoSalePaymentNaoRecebido);
  check('Total a receber (AR + SP)', EXP.receberTotal, rec.totalGeral);

  log('\n================================================================');
  log('  TESTE 6 — DEVOLUÇÕES & ESTOQUE');
  log('================================================================');
  check('Devoluções (vendas canceladas)', EXP.devolucoes, sm.devolucoes);
  check('Capital investido em estoque', EXP.capitalInvestido, stk.capitalInvestido);
  checkInt('Total de peças em estoque', EXP.totalPecas, stk.totalPecas);

  // ============================================================
  //  AUDITORIA
  // ============================================================
  const audit = await runAudit(companyId);
  const byId = Object.fromEntries(audit.checks.map(c => [c.id, c]));

  log('\n================================================================');
  log('  TESTE 7 — AUDITORIA detecta cancelamentos inconsistentes');
  log('================================================================');
  checkInt('Vendas canceladas com pagamento recebido (esperado 1)', 1, byId['cancelled_with_received_payments'].count);
  checkInt('Contas a receber órfãs de venda cancelada (esperado 1)', 1, byId['cancelled_with_pending_receivables'].count);

  log('\n================================================================');
  log('  TESTE 8 — AUDITORIA detecta CMV zerado, FR órfão e estoque negativo');
  log('================================================================');
  checkInt('Produtos vendidos com CMV zerado (esperado 1 = Boné)', 1, byId['products_zero_cost_with_sales'].count);
  checkInt('Registros financeiros órfãos (esperado 1)', 1, byId['orphan_financial_records'].count);
  checkInt('Produtos com estoque negativo (esperado 1 = Meia)', 1, byId['negative_stock'].count);
  checkInt('Clientes com total divergente (esperado 1 = Cliente A)', 1, byId['customer_totals_mismatch'].count);

  log('\n  Resumo da auditoria: ' + JSON.stringify(audit.summary));
  for (const c of audit.checks) log(`   [${c.status}] ${c.id} → ${c.count} | ${c.title}`);

  // ============================================================
  //  TESTE 9 — CONSISTÊNCIA CROSS-MÓDULO (nível engine)
  //  Cada módulo deriva destes mesmos números.
  // ============================================================
  log('\n================================================================');
  log('  TESTE 9 — CONSISTÊNCIA CROSS-MÓDULO (mesma fonte = financial-engine)');
  log('================================================================');
  // DRE deve usar o MESMO faturamento/CMV das vendas
  check('DRE.receitaLiquida == vendas.receitaLiquida', sm.receitaLiquida, dre.receitaLiquida);
  check('DRE.cmv == vendas.cmv', sm.cmv, dre.cmv);
  check('DRE.taxasCartao == vendas.taxasCartao', sm.taxasCartao, dre.taxasCartao);
  check('DRE.faturamentoBruto == vendas.faturamentoBruto', sm.faturamentoBruto, dre.faturamentoBruto);

  log('\n----------------------------------------------------------------');
  log('  NÚMEROS CANÔNICOS (devem aparecer idênticos em TODOS os módulos)');
  log('----------------------------------------------------------------');
  log('  Faturamento (mês) ....... ' + money(sm.faturamentoLiquido));
  log('  CMV ..................... ' + money(sm.cmv));
  log('  Lucro líquido (vendas) .. ' + money(sm.lucroLiquido));
  log('  Lucro líquido (DRE) ..... ' + money(dre.lucroLiquido));
  log('  Saldo de caixa .......... ' + money(cb.saldo));
  log('  Contas a receber ........ ' + money(rec.totalGeral));

  log('\n================================================================');
  log(`  RESULTADO FINAL: ${pass} PASSARAM, ${fail} FALHARAM`);
  log('================================================================');
  log(`  Empresa: ${COMPANY_NAME}  (id=${companyId})`);
  log(`  Login p/ teste HTTP: ${ADMIN_EMAIL} / ${ADMIN_PASS}`);

  // Salva o companyId p/ o teste HTTP
  const fs = await import('fs');
  fs.writeFileSync('/tmp/audit_test_company.json', JSON.stringify({ companyId, email: ADMIN_EMAIL, password: ADMIN_PASS, expected: EXP }, null, 2));

  await prisma.$disconnect();
  if (fail > 0) process.exit(1);
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
