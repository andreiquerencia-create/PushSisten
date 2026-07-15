/**
 * SEED DA EMPRESA DEMONSTRAÇÃO OFICIAL — "Loja Modelo PushSisten"
 * ------------------------------------------------------------------
 * Cria uma loja de roupas REALISTA com ~7 meses de operação, contendo
 * pontos fortes E problemas reais, para demonstrações comerciais e para
 * alimentar IA Gerente, Saúde da Loja (Push Score), Insights e Ações.
 *
 * Características:
 *   • Empresa marcada como PROTEGIDA (isProtected = true)
 *   • Idempotente: re-executar LIMPA apenas os dados DESTA empresa
 *     (escopo companyId) e reconstrói — NUNCA toca outras empresas.
 *   • Calibrado para Push Score 75–85 (faixa ESTÁVEL alta).
 *
 * Login demo: demo@pushsisten.com / PushDemo2025
 *
 * Uso: tsx --require dotenv/config scripts/seed-demo-pushsisten.ts
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { seedAccountPlanForCompany } from '../lib/account-plan-seed';
import { generatePushScoreSnapshot } from '../lib/push-score-engine';

export const DEMO_COMPANY_NAME = 'Loja Modelo PushSisten';
export const DEMO_ADMIN_EMAIL = 'demo@pushsisten.com';
export const DEMO_ADMIN_PASSWORD = 'PushDemo2025';
export const DEMO_CNPJ = '00.000.000/0001-00';

const prisma = new PrismaClient();

// ════════════════════════════════════════════════════════════════
// KNOBS DE CALIBRAÇÃO (ajustáveis na Fase 3)
// ════════════════════════════════════════════════════════════════
const FOUNDED_DAYS_AGO = 215; // ~7 meses de operação
// Faturamento líquido alvo por mês (índice 0 = mês corrente parcial)
const MONTHLY_REVENUE_TARGET: Record<number, number> = {
  0: 42000, // mês corrente (até hoje) — mês forte → crescimento +
  1: 39000, // mês -1
  2: 38000,
  3: 37000,
  4: 35000,
  5: 33000,
  6: 28000,
  7: 12000, // mês de fundação (parcial)
};
const AVG_MARKUP = 2.4;        // preço de venda ≈ custo × markup → margem bruta ~58%
const TOTAL_CASH_TARGET = 26000; // saldo total em caixas → liquidez ~2 meses
const N_PRODUCTS = 220;
const N_CUSTOMERS = 180;
const N_SUPPLIERS = 26;

// ════════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════════
const NOW = new Date();
let _seq = 0;
function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${(_seq++).toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
function daysAgo(d: number): Date { return new Date(NOW.getTime() - d * 86400000); }
function daysFromNow(d: number): Date { return new Date(NOW.getTime() + d * 86400000); }
function rand(min: number, max: number): number { return Math.random() * (max - min) + min; }
function randInt(min: number, max: number): number { return Math.floor(rand(min, max + 1)); }
function pick<T>(arr: T[]): T { return arr[randInt(0, arr.length - 1)]; }
function round2(n: number): number { return Math.round(n * 100) / 100; }
function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// Mês corrente: dia entre 1 e hoje. Mês passado: 1..últimoDia.
function dateInMonth(monthsAgo: number): Date {
  const ref = new Date(Date.UTC(NOW.getUTCFullYear(), NOW.getUTCMonth() - monthsAgo, 1, 12, 0, 0));
  const year = ref.getUTCFullYear();
  const month = ref.getUTCMonth();
  const lastDay = monthsAgo === 0 ? NOW.getUTCDate() : new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  let day = randInt(1, lastDay);
  // peso leve para fins de semana (sex/sáb) — apenas estético
  const d = new Date(Date.UTC(year, month, day, randInt(10, 19), randInt(0, 59), 0));
  return d.getTime() > NOW.getTime() ? NOW : d;
}
function monthDay(monthsAgo: number, day: number): Date {
  const ref = new Date(Date.UTC(NOW.getUTCFullYear(), NOW.getUTCMonth() - monthsAgo, day, 10, 0, 0));
  return ref.getTime() > NOW.getTime() ? NOW : ref;
}

// ════════════════════════════════════════════════════════════════
// LIMPEZA ESCOPADA (somente a empresa DEMO)
// ════════════════════════════════════════════════════════════════
async function wipeCompanyData(companyId: string) {
  console.log('  Limpando dados antigos da empresa DEMO (escopo isolado)...');
  await prisma.pushScoreSnapshot.deleteMany({ where: { companyId } });
  await prisma.pushScoreConfig.deleteMany({ where: { companyId } });
  await prisma.insight.deleteMany({ where: { companyId } });
  await prisma.iAAlert.deleteMany({ where: { companyId } });
  await prisma.iAMemory.deleteMany({ where: { companyId } });
  await prisma.iAConversation.deleteMany({ where: { companyId } });
  await prisma.iAOperationalContext.deleteMany({ where: { companyId } });
  await prisma.automationLog.deleteMany({ where: { automation: { companyId } } }).catch(() => {});
  await prisma.automationAction.deleteMany({ where: { companyId } }).catch(() => {});
  await prisma.automation.deleteMany({ where: { companyId } });
  await prisma.ledgerEntry.deleteMany({ where: { companyId } }).catch(() => {});
  await prisma.installmentPayment.deleteMany({ where: { companyId } });
  await prisma.installment.deleteMany({ where: { companyId } });
  await prisma.salePayment.deleteMany({ where: { companyId } });
  await prisma.saleItem.deleteMany({ where: { sale: { companyId } } });
  await prisma.sale.deleteMany({ where: { companyId } });
  await prisma.accountReceivable.deleteMany({ where: { companyId } });
  await prisma.accountPayable.deleteMany({ where: { companyId } });
  await prisma.financialRecord.deleteMany({ where: { companyId } });
  await prisma.cashMovement.deleteMany({ where: { companyId } });
  await prisma.cashSession.deleteMany({ where: { companyId } });
  await prisma.inventoryMovement.deleteMany({ where: { companyId } });
  await prisma.stockEntryItem.deleteMany({ where: { stockEntry: { companyId } } }).catch(() => {});
  await prisma.stockEntry.deleteMany({ where: { companyId } }).catch(() => {});
  await prisma.costHistory.deleteMany({ where: { product: { companyId } } }).catch(() => {});
  await prisma.customerCredit.deleteMany({ where: { companyId } });
  await prisma.priceTable.deleteMany({ where: { companyId } }).catch(() => {});
  await prisma.customer.deleteMany({ where: { companyId } });
  await prisma.productVariation.deleteMany({ where: { product: { companyId } } });
  await prisma.product.deleteMany({ where: { companyId } });
  await prisma.category.deleteMany({ where: { companyId } });
  await prisma.paymentMethod.deleteMany({ where: { companyId } });
  await prisma.cashAccount.deleteMany({ where: { companyId } });
  await prisma.seller.deleteMany({ where: { companyId } });
  await prisma.supplier.deleteMany({ where: { companyId } });
  await prisma.carrier.deleteMany({ where: { companyId } });
  await prisma.financialCategory.deleteMany({ where: { companyId } });
  // AccountPlan mantido/atualizado via seedAccountPlanForCompany; limpar para recriar limpo:
  await prisma.accountPlan.deleteMany({ where: { companyId } });
}

// ════════════════════════════════════════════════════════════════
// POOLS DE DADOS REALISTAS
// ════════════════════════════════════════════════════════════════
type CatDef = { name: string; bases: string[]; min: number; max: number };
const CATEGORIES: CatDef[] = [
  { name: 'Masculino', bases: ['Camiseta', 'Camisa Social', 'Bermuda', 'Calça Jeans', 'Polo', 'Moletom', 'Jaqueta', 'Regata'], min: 45, max: 190 },
  { name: 'Feminino', bases: ['Vestido', 'Blusa', 'Saia', 'Legging', 'Cropped', 'Macacão', 'Short', 'Conjunto'], min: 40, max: 200 },
  { name: 'Plus Size', bases: ['Vestido Plus', 'Blusa Plus', 'Calça Plus', 'Túnica Plus', 'Saia Plus'], min: 60, max: 220 },
  { name: 'Infantil', bases: ['Conjunto Infantil', 'Vestido Infantil', 'Camiseta Kids', 'Bermuda Kids', 'Macacão Bebê'], min: 30, max: 120 },
  { name: 'Calçados', bases: ['Tênis', 'Sandália', 'Sapatilha', 'Chinelo', 'Bota', 'Mocassim'], min: 60, max: 260 },
  { name: 'Acessórios', bases: ['Bolsa', 'Cinto', 'Boné', 'Carteira', 'Óculos', 'Bijuteria', 'Mochila'], min: 20, max: 110 },
];
const COLORS = ['Preto', 'Branco', 'Azul', 'Vermelho', 'Verde', 'Bege', 'Rosa', 'Cinza', 'Marinho', 'Vinho', 'Caramelo', 'Off-White'];
const MATERIALS = ['Algodão', 'Viscose', 'Jeans', 'Linho', 'Malha', 'Couro Eco', 'Tricot', 'Moletinho'];
const FIRST_NAMES = ['Ana', 'Bruna', 'Carla', 'Daniela', 'Eduarda', 'Fernanda', 'Gabriela', 'Helena', 'Isabela', 'Júlia', 'Letícia', 'Mariana', 'Natália', 'Patrícia', 'Renata', 'Sandra', 'Thaís', 'Vanessa', 'Carlos', 'Diego', 'Eduardo', 'Felipe', 'Gustavo', 'Henrique', 'Igor', 'João', 'Lucas', 'Marcelo', 'Nicolas', 'Paulo', 'Rafael', 'Thiago', 'Vitor', 'André'];
const LAST_NAMES = ['Silva', 'Santos', 'Oliveira', 'Souza', 'Lima', 'Pereira', 'Costa', 'Almeida', 'Ferreira', 'Rodrigues', 'Gomes', 'Martins', 'Araújo', 'Ribeiro', 'Carvalho', 'Barbosa', 'Rocha', 'Dias', 'Nascimento', 'Moreira'];
const CITIES: [string, string][] = [['Porto Alegre', 'RS'], ['Caxias do Sul', 'RS'], ['Canoas', 'RS'], ['Pelotas', 'RS'], ['Santa Maria', 'RS'], ['Gravataí', 'RS'], ['Novo Hamburgo', 'RS'], ['São Leopoldo', 'RS'], ['Passo Fundo', 'RS'], ['Florianópolis', 'SC']];
const SUPPLIER_NAMES = ['Malharia Sul Confecções', 'Tecidos & Cia', 'Moda Brasil Atacado', 'Jeanswear Distribuição', 'Fashion Import', 'Calçados Pampa', 'Acessórios Trend', 'Infantil Feliz Confecções', 'Plus Moda Distribuidora', 'Tex Norte Indústria', 'Couro Nobre', 'Estamparia Criativa', 'Atacadão da Moda', 'Vestir Bem Confecções', 'Bella Moda Atacado', 'Urban Style Import', 'Sul Textil', 'Trama Fina Malhas', 'Premium Jeans', 'Casual Wear Distrib.', 'Modas Gauchas', 'Brasil Fashion Hub', 'Linha & Agulha', 'Tendência Atacado', 'Veste Fácil', 'Mega Moda Distribuição'];
const CARRIER_NAMES = ['Expresso Sul Logística', 'Correios', 'Loggi Entregas', 'Jadlog'];

// ════════════════════════════════════════════════════════════════
main().catch((e) => { console.error('ERRO FATAL:', e); process.exit(1); }).finally(() => prisma.$disconnect());

async function main() {
  console.log('\n========================================');
  console.log('  SEED — Loja Modelo PushSisten (DEMO)');
  console.log('========================================\n');

  // ─── 1) EMPRESA ───
  let company = await prisma.company.findFirst({ where: { name: DEMO_COMPANY_NAME } });
  const foundedAt = daysAgo(FOUNDED_DAYS_AGO);
  if (!company) {
    company = await prisma.company.create({
      data: {
        name: DEMO_COMPANY_NAME, cnpj: DEMO_CNPJ, email: DEMO_ADMIN_EMAIL,
        phone: '(51) 3333-1000', whatsapp: '(51) 99100-2000', instagram: '@lojamodelopush',
        address: 'Av. das Confecções, 1000 - Centro', city: 'Porto Alegre', state: 'RS',
        isProtected: true, isActive: true, plan: 'pro', subscriptionStatus: 'active',
        maxUsers: 10, createdAt: foundedAt, lastAccessAt: NOW,
      },
    });
  } else {
    company = await prisma.company.update({
      where: { id: company.id },
      data: { isProtected: true, createdAt: foundedAt, plan: 'pro', subscriptionStatus: 'active', maxUsers: 10, lastSaleNumber: 0 },
    });
  }
  const companyId = company.id;
  console.log(`✓ Empresa: ${company.name} (${companyId}) — protegida, fundada em ${foundedAt.toISOString().slice(0, 10)}`);

  // ─── 2) LIMPEZA ESCOPADA ───
  await wipeCompanyData(companyId);

  // ─── 3) USUÁRIOS + VENDEDORES ───
  const adminPass = await bcrypt.hash(DEMO_ADMIN_PASSWORD, 12);
  const stdPass = await bcrypt.hash('PushDemo2025', 12);
  const userDefs = [
    { name: 'Mariana Costa (Proprietária)', email: DEMO_ADMIN_EMAIL, role: 'administrador', pass: adminPass, seller: false },
    { name: 'Roberto Lima (Sócio)', email: 'socio@pushsisten.com', role: 'socio', pass: stdPass, seller: false },
    { name: 'Patrícia Gerente', email: 'gerente@pushsisten.com', role: 'gerente', pass: stdPass, seller: true },
    { name: 'Ana Vendedora', email: 'vendedor@pushsisten.com', role: 'vendedor', pass: stdPass, seller: true },
    { name: 'Carla Vendedora', email: 'carla@pushsisten.com', role: 'vendedor', pass: stdPass, seller: true },
    { name: 'Diego Vendedor', email: 'diego@pushsisten.com', role: 'vendedor', pass: stdPass, seller: true },
  ];
  const users: any[] = [];
  const sellerUsers: any[] = [];
  const sellerRecords: any[] = [];
  for (const u of userDefs) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, role: u.role, password: u.pass, companyId, isActive: true },
      create: { name: u.name, email: u.email, password: u.pass, role: u.role, companyId, isActive: true },
    });
    users.push(user);
    if (u.seller) {
      sellerUsers.push(user);
      const existingSeller = await prisma.seller.findUnique({ where: { userId: user.id } });
      const seller = existingSeller
        ? await prisma.seller.update({ where: { id: existingSeller.id }, data: { companyId, name: u.name, isActive: true } })
        : await prisma.seller.create({ data: { name: u.name, companyId, userId: user.id, commissionRate: 4, isActive: true } });
      sellerRecords.push(seller);
    }
  }
  console.log(`✓ ${users.length} usuários (1 admin, 1 sócio, 1 gerente, 3 vendedores) + ${sellerRecords.length} cadastros de vendedor`);

  // ─── 4) PLANO DE CONTAS ───
  const apStats = await seedAccountPlanForCompany(companyId, prisma);
  const apRows = await prisma.accountPlan.findMany({ where: { companyId }, select: { id: true, code: true } });
  const ap: Record<string, string> = {};
  for (const r of apRows) if (r.code) ap[r.code] = r.id;
  console.log(`✓ Plano de contas: ${apStats.created} criadas / ${apStats.total} total`);

  // ─── 5) CATEGORIAS FINANCEIRAS ───
  const finCatDefs = [
    { name: 'Vendas', type: 'entrada' }, { name: 'Despesas Fixas', type: 'saida' },
    { name: 'Despesas Variáveis', type: 'saida' }, { name: 'Impostos', type: 'saida' },
    { name: 'Marketing', type: 'saida' }, { name: 'Compras de Mercadoria', type: 'saida' },
  ];
  for (const fc of finCatDefs) await prisma.financialCategory.create({ data: { ...fc, companyId } });

  // ─── 6) CAIXAS + FORMAS DE PAGAMENTO ───
  const caixaDinheiro = await prisma.cashAccount.create({ data: { name: 'Caixa Loja (Dinheiro)', type: 'dinheiro', companyId, initialBalance: 800, currentBalance: 0, isActive: true } });
  const contaPix = await prisma.cashAccount.create({ data: { name: 'Conta Bancária / PIX', type: 'pix', companyId, initialBalance: 5000, currentBalance: 0, isActive: true } });
  const contaCartao = await prisma.cashAccount.create({ data: { name: 'Conta Cartões (Adquirente)', type: 'cartao', companyId, initialBalance: 0, currentBalance: 0, isActive: true } });
  const pmDinheiro = await prisma.paymentMethod.create({ data: { name: 'Dinheiro', type: 'dinheiro', cashAccountId: caixaDinheiro.id, companyId, feePercent: 0, defaultDays: 0 } });
  const pmPix = await prisma.paymentMethod.create({ data: { name: 'PIX', type: 'pix', cashAccountId: contaPix.id, companyId, feePercent: 0.99, defaultDays: 0 } });
  const pmDebito = await prisma.paymentMethod.create({ data: { name: 'Cartão de Débito', type: 'cartao_debito', cashAccountId: contaCartao.id, companyId, feePercent: 1.79, defaultDays: 1 } });
  const pmCredito = await prisma.paymentMethod.create({ data: { name: 'Cartão de Crédito', type: 'cartao_credito', cashAccountId: contaCartao.id, companyId, feePercent: 3.49, defaultDays: 30 } });
  const pmCrediario = await prisma.paymentMethod.create({ data: { name: 'Crediário da Loja', type: 'crediario', cashAccountId: caixaDinheiro.id, companyId, feePercent: 0, defaultDays: 30 } });
  console.log('✓ 3 caixas + 5 formas de pagamento');

  // ─── 7) FORNECEDORES + TRANSPORTADORAS ───
  const suppliers: any[] = [];
  for (let i = 0; i < N_SUPPLIERS; i++) {
    const [city, state] = pick(CITIES);
    suppliers.push(await prisma.supplier.create({
      data: {
        name: SUPPLIER_NAMES[i % SUPPLIER_NAMES.length], companyId, isActive: true,
        phone: `(51) 3${randInt(100, 999)}-${randInt(1000, 9999)}`,
        whatsapp: `(51) 9${randInt(1000, 9999)}-${randInt(1000, 9999)}`,
        email: `contato${i}@fornecedor.com.br`, city, state,
        cnpj: `${randInt(10, 99)}.${randInt(100, 999)}.${randInt(100, 999)}/0001-${randInt(10, 99)}`,
      },
    }));
  }
  for (const cn of CARRIER_NAMES) {
    const [city, state] = pick(CITIES);
    await prisma.carrier.create({ data: { name: cn, companyId, isActive: true, phone: `(51) 3${randInt(100, 999)}-${randInt(1000, 9999)}`, city, state } });
  }
  console.log(`✓ ${suppliers.length} fornecedores + ${CARRIER_NAMES.length} transportadoras`);

  // ─── 8) CATEGORIAS DE PRODUTO ───
  const categoryMap: Record<string, string> = {};
  for (const c of CATEGORIES) {
    const cat = await prisma.category.create({ data: { name: c.name, companyId, isActive: true, description: `Peças da linha ${c.name}` } });
    categoryMap[c.name] = cat.id;
  }
  console.log(`✓ ${CATEGORIES.length} categorias de produto`);

  // ─── 9) PRODUTOS ───
  type Prod = { id: string; name: string; cost: number; price: number; categoryName: string; cohort: string };
  const products: Prod[] = [];
  const productRows: any[] = [];
  let skuSeq = 1000;
  for (let i = 0; i < N_PRODUCTS; i++) {
    const cat = CATEGORIES[i % CATEGORIES.length];
    const base = pick(cat.bases);
    const descriptor = Math.random() < 0.6 ? pick(COLORS) : pick(MATERIALS);
    const name = `${base} ${descriptor}`;
    const price = round2(rand(cat.min, cat.max));
    const markup = rand(AVG_MARKUP - 0.5, AVG_MARKUP + 0.5);
    const cost = round2(price / markup);
    const id = uid('prod');
    products.push({ id, name, cost, price, categoryName: cat.name, cohort: 'active' });
    productRows.push({
      id, name, sku: `SKU${skuSeq++}`, barcode: `789${randInt(100000000, 999999999)}`,
      costPrice: cost, avgCost: cost, lastCost: cost, replacementCost: round2(cost * 1.05),
      salePrice: price, margin: round2(((price - cost) / price) * 100),
      stockQuantity: 0, minStock: randInt(3, 8), categoryId: categoryMap[cat.name],
      supplierId: pick(suppliers).id, companyId, isActive: true,
      createdAt: daysAgo(randInt(FOUNDED_DAYS_AGO - 30, FOUNDED_DAYS_AGO)),
    });
  }
  // Designar cohorts de estoque
  const idxAll = products.map((_, i) => i);
  const stagnantIdx = new Set(idxAll.slice(0, 30));            // nunca vendidos (parados)
  const zeroIdx = new Set(idxAll.slice(30, 40));               // estoque zerado
  const lowIdx = new Set(idxAll.slice(40, 60));                // abaixo do mínimo
  const excessIdx = new Set(idxAll.slice(60, 65));             // excesso
  products.forEach((p, i) => {
    if (stagnantIdx.has(i)) p.cohort = 'stagnant';
    else if (zeroIdx.has(i)) p.cohort = 'zero';
    else if (lowIdx.has(i)) p.cohort = 'low';
    else if (excessIdx.has(i)) p.cohort = 'excess';
  });
  for (const c of chunk(productRows, 200)) await prisma.product.createMany({ data: c, skipDuplicates: true });
  console.log(`✓ ${products.length} produtos (30 parados, 10 zerados, 20 abaixo do mínimo, 5 excesso)`);
  const sellable = products.filter((p) => p.cohort !== 'stagnant' && p.cohort !== 'zero');

  // ─── 10) CLIENTES ───
  type Cust = { id: string; cohort: string; count: number; total: number; last: Date | null };
  const customers: Cust[] = [];
  const customerRows: any[] = [];
  for (let i = 0; i < N_CUSTOMERS; i++) {
    const [city, state] = pick(CITIES);
    const id = uid('cust');
    let cohort = 'activeRecurring';
    if (i >= 70 && i < 112) cohort = 'activeSingle';
    else if (i >= 112 && i < 162) cohort = 'inactive';
    else if (i >= 162) cohort = 'noPurchase';
    const isWholesale = Math.random() < 0.15;
    customers.push({ id, cohort, count: 0, total: 0, last: null });
    customerRows.push({
      id, name: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`, companyId, isActive: true,
      email: Math.random() < 0.6 ? `cliente${i}@email.com` : null,
      phone: `(51) 9${randInt(1000, 9999)}-${randInt(1000, 9999)}`,
      whatsapp: `(51) 9${randInt(1000, 9999)}-${randInt(1000, 9999)}`,
      cpfCnpj: `${randInt(100, 999)}.${randInt(100, 999)}.${randInt(100, 999)}-${randInt(10, 99)}`,
      city, state, type: isWholesale ? 'atacado' : 'varejo',
      tags: isWholesale ? ['atacado'] : (cohort === 'activeRecurring' ? ['fiel'] : []),
      sellerId: pick(sellerRecords).id, createdAt: daysAgo(randInt(20, FOUNDED_DAYS_AGO)),
    });
  }
  for (const c of chunk(customerRows, 200)) await prisma.customer.createMany({ data: c, skipDuplicates: true });
  console.log(`✓ ${customers.length} clientes (70 fiéis, 42 ativos, 50 inativos, 18 sem compra)`);
  const activeCusts = customers.filter((c) => c.cohort === 'activeRecurring' || c.cohort === 'activeSingle');
  const inactiveCusts = customers.filter((c) => c.cohort === 'inactive');

  // ─── 11) VENDAS (7 meses) ───
  const salesData: any[] = [];
  const saleItemsData: any[] = [];
  const salePaymentsData: any[] = [];
  const productLastSold = new Map<string, Date>();
  let companySaleNumber = 0;
  const PM = [
    { pm: pmPix, type: 'pix', fee: 0.99, acc: contaPix.id, received: true, w: 0.32 },
    { pm: pmCredito, type: 'cartao_credito', fee: 3.49, acc: contaCartao.id, received: true, w: 0.26 },
    { pm: pmDebito, type: 'cartao_debito', fee: 1.79, acc: contaCartao.id, received: true, w: 0.20 },
    { pm: pmDinheiro, type: 'dinheiro', fee: 0, acc: caixaDinheiro.id, received: true, w: 0.22 },
  ];
  function pickPayment() {
    const r = Math.random();
    let acc = 0;
    for (const p of PM) { acc += p.w; if (r <= acc) return p; }
    return PM[0];
  }
  function buildSale(monthsAgo: number, date: Date, cust: Cust | null) {
    const nItems = Math.random() < 0.5 ? 1 : Math.random() < 0.8 ? 2 : 3;
    const chosen: Prod[] = [];
    for (let k = 0; k < nItems; k++) chosen.push(pick(sellable));
    let subtotal = 0;
    const items: any[] = [];
    const saleId = uid('sale');
    for (const p of chosen) {
      const qty = Math.random() < 0.75 ? 1 : 2;
      const unitPrice = p.price;
      const lineTotal = round2(unitPrice * qty);
      subtotal += lineTotal;
      items.push({ id: uid('si'), saleId, productId: p.id, quantity: qty, unitPrice, discount: 0, total: lineTotal });
      const prev = productLastSold.get(p.id);
      if (!prev || date > prev) productLastSold.set(p.id, date);
    }
    const discount = Math.random() < 0.25 ? round2(subtotal * rand(0.03, 0.1)) : 0;
    const total = round2(subtotal - discount);
    companySaleNumber++;
    const seller = pick(sellerUsers);
    salesData.push({
      id: saleId, companySaleNumber, companyId, customerId: cust?.id ?? null, sellerId: seller.id,
      subtotal: round2(subtotal), discount, total, status: 'concluida',
      paymentMethod: 'misto', createdAt: date, updatedAt: date,
      createdById: seller.id, createdByName: seller.name,
    });
    for (const it of items) saleItemsData.push(it);
    const pmSel = pickPayment();
    const feeAmount = round2(total * (pmSel.fee / 100));
    salePaymentsData.push({
      id: uid('sp'), saleId, paymentMethodId: pmSel.pm.id, amount: total,
      feePercent: pmSel.fee, feeAmount, netAmount: round2(total - feeAmount),
      expectedDate: date, received: true, receivedDate: date, cashAccountId: pmSel.acc, companyId, createdAt: date,
    });
    if (cust) { cust.count++; cust.total += total; if (!cust.last || date > cust.last) cust.last = date; }
    return total;
  }

  for (let m = 7; m >= 0; m--) {
    const target = MONTHLY_REVENUE_TARGET[m] ?? 30000;
    let acc = 0;
    let guard = 0;
    while (acc < target && guard < 5000) {
      guard++;
      const date = dateInMonth(m);
      // seleção de cliente por recência do mês
      let cust: Cust | null = null;
      const r = Math.random();
      if (r < 0.3) cust = null; // venda avulsa (balcão)
      else if (m <= 2) cust = pick(activeCusts);
      else cust = Math.random() < 0.5 ? pick(inactiveCusts) : pick(activeCusts);
      acc += buildSale(m, date, cust);
    }
  }
  console.log(`✓ ${salesData.length} vendas geradas (faturamento alvo ~7 meses)`);

  // Cobertura: garantir que produtos NÃO parados tenham venda nos últimos 55 dias
  for (const p of sellable) {
    const last = productLastSold.get(p.id);
    if (!last || (NOW.getTime() - last.getTime()) / 86400000 > 55) {
      const date = daysAgo(randInt(5, 45));
      const saleId = uid('sale');
      companySaleNumber++;
      const seller = pick(sellerUsers);
      const qty = 1; const total = p.price;
      salesData.push({ id: saleId, companySaleNumber, companyId, customerId: pick(activeCusts).id, sellerId: seller.id, subtotal: total, discount: 0, total, status: 'concluida', paymentMethod: 'misto', createdAt: date, updatedAt: date, createdById: seller.id, createdByName: seller.name });
      saleItemsData.push({ id: uid('si'), saleId, productId: p.id, quantity: qty, unitPrice: p.price, discount: 0, total });
      salePaymentsData.push({ id: uid('sp'), saleId, paymentMethodId: pmDinheiro.id, amount: total, feePercent: 0, feeAmount: 0, netAmount: total, expectedDate: date, received: true, receivedDate: date, cashAccountId: caixaDinheiro.id, companyId, createdAt: date });
      productLastSold.set(p.id, date);
    }
  }

  // Persistir vendas em lote
  for (const c of chunk(salesData, 500)) await prisma.sale.createMany({ data: c, skipDuplicates: true });
  for (const c of chunk(saleItemsData, 500)) await prisma.saleItem.createMany({ data: c, skipDuplicates: true });
  for (const c of chunk(salePaymentsData, 500)) await prisma.salePayment.createMany({ data: c, skipDuplicates: true });
  console.log(`✓ Persistidas ${salesData.length} vendas / ${saleItemsData.length} itens / ${salePaymentsData.length} pagamentos`);

  // ─── 12) CREDIÁRIO (Installments + alguns AR) ───
  await buildCrediario(companyId, customers, salesData, ap);

  // ─── 13) FINANCEIRO (despesas/impostos por mês) ───
  await buildFinancials(companyId, ap, contaPix.id, salesData);

  // ─── 14) ENTRADAS DE ESTOQUE + CONTAS A PAGAR ───
  await buildStockEntriesAndPayables(companyId, suppliers, ap);

  // ─── 15) MOVIMENTAÇÕES DE ESTOQUE (recentes) ───
  await buildRecentInventoryMovements(companyId, salesData, saleItemsData);

  // ─── 16) CAIXAS: sessões recentes + saldos calibrados ───
  await buildCashSessionsAndBalances(companyId, caixaDinheiro, contaPix, contaCartao, users[0]);

  // ─── 17) ESTOQUE FINAL CALIBRADO (giro ~4, parado ~13%) ───
  await calibrateStock(companyId, products, saleItemsData, salesData);

  // ─── 18) AGREGADOS DE CLIENTES (garante % ativos/recorência) ───
  await finalizeCustomers(companyId, customers);

  // ─── 19) lastSaleNumber ───
  await prisma.company.update({ where: { id: companyId }, data: { lastSaleNumber: companySaleNumber } });

  // ─── 20) PUSH SCORE ───
  console.log('\n─── Calculando Push Score (Saúde da Loja) ───');
  const snap = await generatePushScoreSnapshot(companyId, NOW);
  console.log(JSON.stringify({ status: snap.status, score: snap.score, classification: snap.classification, subscores: snap.subscores }, null, 2));
  console.log('\nRAW METRICS:');
  console.log(JSON.stringify(snap.rawMetrics, null, 2));
  console.log('\n✅ SEED DEMO CONCLUÍDO.');
}

// ════════════════════════════════════════════════════════════════
// FUNÇÕES AUXILIARES (Fase 2 — detalhamento)
// ════════════════════════════════════════════════════════════════

function monthBounds(monthsAgo: number): { start: Date; end: Date } {
  const start = new Date(Date.UTC(NOW.getUTCFullYear(), NOW.getUTCMonth() - monthsAgo, 1, 0, 0, 0));
  const end = new Date(Date.UTC(NOW.getUTCFullYear(), NOW.getUTCMonth() - monthsAgo + 1, 1, 0, 0, 0));
  return { start, end };
}

// ─── 12) CREDIÁRIO ───
async function buildCrediario(companyId: string, customers: any[], salesData: any[], ap: Record<string, string>) {
  const cashAcc = await prisma.cashAccount.findFirst({ where: { companyId, type: 'dinheiro' } });
  const cashAccId = cashAcc?.id ?? (await prisma.cashAccount.findFirst({ where: { companyId } }))!.id;

  // Pool de vendas recentes COM cliente (para vincular parcelas — FK obrigatória)
  const candidatePool = salesData
    .filter((s) => s.customerId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 400);
  if (candidatePool.length === 0) { console.log('  ⚠ Sem vendas com cliente para crediário'); return; }
  let poolIdx = 0;
  function nextSale() { const s = candidatePool[poolIdx % candidatePool.length]; poolIdx++; return s; }

  const installmentRows: any[] = [];
  const installmentPaymentRows: any[] = [];
  const openByCustomer = new Map<string, number>();
  const creditCustomers = new Set<string>();

  function addInstallment(opts: { amount: number; paidAmount: number; status: string; dueDate: Date; createdAt: Date; renegotiatedAt?: Date; renegotiationRef?: string }) {
    const sale = nextSale();
    const id = uid('inst');
    creditCustomers.add(sale.customerId);
    installmentRows.push({
      id, saleId: sale.id, customerId: sale.customerId, companyId,
      installmentNumber: randInt(1, 3), amount: round2(opts.amount), paidAmount: round2(opts.paidAmount),
      dueDate: opts.dueDate, status: opts.status, createdAt: opts.createdAt, updatedAt: opts.createdAt,
      renegotiatedAt: opts.renegotiatedAt ?? null, renegotiationRef: opts.renegotiationRef ?? null,
    });
    const open = opts.amount - opts.paidAmount;
    if (['PENDING', 'PARTIAL', 'OVERDUE'].includes(opts.status)) {
      openByCustomer.set(sale.customerId, (openByCustomer.get(sale.customerId) ?? 0) + open);
    }
    return id;
  }

  // VENCIDAS (inadimplência) — 7 parcelas ~150 → ~1050 vencido em aberto
  for (let i = 0; i < 7; i++) {
    const d = daysAgo(randInt(8, 45));
    addInstallment({ amount: rand(120, 180), paidAmount: 0, status: 'OVERDUE', dueDate: d, createdAt: daysAgo(randInt(50, 90)) });
  }
  // VENCENDO EM BREVE (próximos 7 dias) — 16 × ~200 = ~3200
  for (let i = 0; i < 16; i++) {
    addInstallment({ amount: rand(160, 240), paidAmount: 0, status: 'PENDING', dueDate: daysFromNow(randInt(1, 7)), createdAt: daysAgo(randInt(15, 50)) });
  }
  // PENDENTES FUTURAS — 28 × ~255 = ~7140
  for (let i = 0; i < 28; i++) {
    addInstallment({ amount: rand(200, 310), paidAmount: 0, status: 'PENDING', dueDate: daysFromNow(randInt(8, 75)), createdAt: daysAgo(randInt(5, 60)) });
  }
  // PARCIAIS — 5 × (400 pago 200) → 1000 em aberto
  for (let i = 0; i < 5; i++) {
    addInstallment({ amount: 400, paidAmount: 200, status: 'PARTIAL', dueDate: daysFromNow(randInt(-5, 20)), createdAt: daysAgo(randInt(20, 60)) });
  }
  // QUITADAS (histórico) — 32 com pagamento registrado
  for (let i = 0; i < 32; i++) {
    const created = daysAgo(randInt(40, 180));
    const due = new Date(created.getTime() + 30 * 86400000);
    const amount = round2(rand(150, 350));
    const id = addInstallment({ amount, paidAmount: amount, status: 'PAID', dueDate: due, createdAt: created });
    const payDate = new Date(due.getTime() - randInt(0, 5) * 86400000);
    installmentPaymentRows.push({ id: uid('ipay'), installmentId: id, companyId, amount, paymentDate: payDate, cashAccountId: cashAccId, createdAt: payDate });
  }
  // RENEGOCIADAS — 3 (excluídas da carteira; status RENEGOTIATED)
  for (let i = 0; i < 3; i++) {
    const created = daysAgo(randInt(60, 120));
    addInstallment({ amount: round2(rand(200, 400)), paidAmount: 0, status: 'RENEGOTIATED', dueDate: daysAgo(randInt(10, 40)), createdAt: created, renegotiatedAt: daysAgo(randInt(5, 30)), renegotiationRef: uid('reneg') });
  }

  for (const c of chunk(installmentRows, 300)) await prisma.installment.createMany({ data: c, skipDuplicates: true });
  for (const c of chunk(installmentPaymentRows, 300)) await prisma.installmentPayment.createMany({ data: c, skipDuplicates: true });

  // CustomerCredit para clientes com crediário
  const creditRows: any[] = [];
  for (const custId of Array.from(creditCustomers)) {
    const used = round2(openByCustomer.get(custId) ?? 0);
    creditRows.push({
      id: uid('cc'), customerId: custId, companyId,
      creditLimit: Math.max(1000, round2(used * 1.6)), usedLimit: used,
      defaultTermDays: 30, status: 'ACTIVE', createdAt: daysAgo(randInt(60, 180)), updatedAt: NOW,
    });
  }
  for (const c of chunk(creditRows, 300)) await prisma.customerCredit.createMany({ data: c, skipDuplicates: true });

  // CONTAS A RECEBER (não-crediário) — popula tela AR
  const arRows: any[] = [];
  const arCusts = customers.filter((c) => c.cohort === 'activeRecurring').slice(0, 8);
  // 4 pendentes futuras (~2300)
  for (let i = 0; i < 4; i++) {
    arRows.push({ id: uid('ar'), description: `Venda atacado a prazo #${randInt(100, 999)}`, amount: round2(rand(450, 750)), dueDate: daysFromNow(randInt(5, 40)), status: 'pendente', customerId: pick(arCusts)?.id ?? null, accountPlanId: ap['1.1'] ?? null, companyId, createdAt: daysAgo(randInt(5, 25)), updatedAt: NOW });
  }
  // 1 vencida (~200)
  arRows.push({ id: uid('ar'), description: 'Venda atacado a prazo (vencida)', amount: 200, dueDate: daysAgo(randInt(5, 20)), status: 'pendente', customerId: pick(arCusts)?.id ?? null, accountPlanId: ap['1.1'] ?? null, companyId, createdAt: daysAgo(40), updatedAt: NOW });
  // 1 recebida (histórico)
  arRows.push({ id: uid('ar'), description: 'Venda atacado a prazo (recebida)', amount: round2(rand(400, 600)), dueDate: daysAgo(30), receivedDate: daysAgo(28), status: 'recebido', customerId: pick(arCusts)?.id ?? null, accountPlanId: ap['1.1'] ?? null, companyId, createdAt: daysAgo(45), updatedAt: NOW });
  await prisma.accountReceivable.createMany({ data: arRows, skipDuplicates: true });

  const openTotal = Array.from(openByCustomer.values()).reduce((s, v) => s + v, 0);
  console.log(`✓ Crediário: ${installmentRows.length} parcelas (carteira aberta ~R$${Math.round(openTotal)}), ${creditRows.length} clientes c/ crediário, ${arRows.length} contas a receber`);
}

// ─── 13) FINANCEIRO (despesas / impostos por mês) ───
async function buildFinancials(companyId: string, ap: Record<string, string>, contaPixId: string, salesData: any[]) {
  const records: any[] = [];
  const fixed: { code: string; desc: string; amount: number }[] = [
    { code: '3.1.1', desc: 'Pró-labore', amount: 3000 },
    { code: '3.1.2', desc: 'Salários equipe', amount: 3500 },
    { code: '3.2.1', desc: 'Aluguel da loja', amount: 2200 },
    { code: '3.2.2', desc: 'Energia elétrica', amount: 380 },
    { code: '3.2.3', desc: 'Água', amount: 120 },
    { code: '3.2.4', desc: 'Internet', amount: 160 },
    { code: '3.2.5', desc: 'Telefone', amount: 90 },
    { code: '3.1.7', desc: 'Contabilidade', amount: 500 },
    { code: '3.1.9', desc: 'Sistema de gestão (PUSHY)', amount: 250 },
  ];
  for (let m = 7; m >= 0; m--) {
    const { start, end } = monthBounds(m);
    const monthRevenue = salesData
      .filter((s) => s.createdAt >= start && s.createdAt < end)
      .reduce((sum, s) => sum + s.total, 0);
    const day = randInt(5, 8);
    const date = monthDay(m, day);
    for (const f of fixed) {
      records.push({ id: uid('fr'), description: f.desc, amount: f.amount, type: 'saida', accountPlanId: ap[f.code] ?? null, cashAccountId: contaPixId, companyId, reference: `despesa_fixa:${f.code}`, date, createdAt: date });
    }
    // Variáveis proporcionais ao faturamento
    const marketing = round2(monthRevenue * 0.05);
    const logistica = round2(monthRevenue * 0.01);
    const das = round2(monthRevenue * 0.06);
    if (marketing > 0) records.push({ id: uid('fr'), description: 'Tráfego pago (Meta Ads)', amount: marketing, type: 'saida', accountPlanId: ap['3.3.1'] ?? null, cashAccountId: contaPixId, companyId, reference: 'despesa_variavel:marketing', date, createdAt: date });
    if (logistica > 0) records.push({ id: uid('fr'), description: 'Fretes / transportadora', amount: logistica, type: 'saida', accountPlanId: ap['3.5.2'] ?? null, cashAccountId: contaPixId, companyId, reference: 'despesa_variavel:logistica', date, createdAt: date });
    if (das > 0) records.push({ id: uid('fr'), description: 'Imposto Simples Nacional (DAS)', amount: das, type: 'saida', accountPlanId: ap['4.1'] ?? null, cashAccountId: contaPixId, companyId, reference: 'imposto:das', date, createdAt: date });
    // Tarifa bancária (financeiro)
    records.push({ id: uid('fr'), description: 'Tarifas bancárias', amount: 120, type: 'saida', accountPlanId: ap['5.1'] ?? null, cashAccountId: contaPixId, companyId, reference: 'financeiro:tarifa', date, createdAt: date });
  }
  for (const c of chunk(records, 400)) await prisma.financialRecord.createMany({ data: c, skipDuplicates: true });
  console.log(`✓ Financeiro: ${records.length} lançamentos de despesa/imposto (7 meses)`);
}

// ─── 14) ENTRADAS DE ESTOQUE + CONTAS A PAGAR ───
async function buildStockEntriesAndPayables(companyId: string, suppliers: any[], ap: Record<string, string>) {
  let payableCount = 0;
  for (let i = 0; i < 16; i++) {
    const created = daysAgo(randInt(10, FOUNDED_DAYS_AGO - 10));
    const supplier = pick(suppliers);
    const totalCost = round2(rand(1800, 6500));
    const entry = await prisma.stockEntry.create({
      data: {
        companyId, supplierId: supplier.id, status: 'confirmada',
        subtotal: totalCost, freight: round2(totalCost * 0.02), otherExpenses: 0,
        totalCost: round2(totalCost * 1.02), paymentMethod: i % 3 === 0 ? 'parcelado' : 'a_vista',
        installments: 1, notes: `Compra de mercadoria — ${supplier.name}`, createdAt: created, updatedAt: created,
        createdByName: 'Mariana Costa (Proprietária)',
      },
    });
    // Contas a pagar: as mais antigas pagas; ~5 recentes pendentes (fluxo de caixa futuro)
    const isPending = i >= 11; // últimas 5 pendentes
    if (isPending) {
      await prisma.accountPayable.create({
        data: {
          description: `Compra de mercadoria — ${supplier.name}`, amount: entry.totalCost,
          dueDate: daysFromNow(randInt(3, 25)), status: 'pendente', supplierId: supplier.id,
          stockEntryId: entry.id, accountPlanId: ap['2.1.1'] ?? null, companyId, createdAt: created, updatedAt: created,
        },
      });
    } else {
      const due = new Date(created.getTime() + 20 * 86400000);
      await prisma.accountPayable.create({
        data: {
          description: `Compra de mercadoria — ${supplier.name}`, amount: entry.totalCost,
          dueDate: due, paidDate: due, status: 'pago', supplierId: supplier.id,
          stockEntryId: entry.id, accountPlanId: ap['2.1.1'] ?? null, companyId, createdAt: created, updatedAt: created,
        },
      });
    }
    payableCount++;
  }
  console.log(`✓ Estoque: 16 entradas de compra + ${payableCount} contas a pagar (5 pendentes p/ projeção)`);
}

// ─── 15) MOVIMENTAÇÕES DE ESTOQUE (recentes) ───
async function buildRecentInventoryMovements(companyId: string, salesData: any[], saleItemsData: any[]) {
  const saleDate = new Map<string, Date>();
  for (const s of salesData) saleDate.set(s.id, s.createdAt);
  const cutoff = daysAgo(30);
  const rows: any[] = [];
  for (const it of saleItemsData) {
    const d = saleDate.get(it.saleId);
    if (!d || d < cutoff) continue;
    rows.push({
      id: uid('im'), productId: it.productId, companyId, type: 'venda', quantity: -it.quantity,
      previousQty: it.quantity + randInt(2, 20), newQty: randInt(0, 18), reason: 'Venda no PDV',
      reference: `Venda`, userName: 'PDV', createdAt: d,
    });
    if (rows.length >= 160) break;
  }
  for (const c of chunk(rows, 400)) await prisma.inventoryMovement.createMany({ data: c, skipDuplicates: true });
  console.log(`✓ ${rows.length} movimentações de estoque recentes (vendas últimos 30 dias)`);
}

// ─── 16) CAIXAS: sessões recentes + saldos calibrados ───
async function buildCashSessionsAndBalances(companyId: string, caixaDinheiro: any, contaPix: any, contaCartao: any, adminUser: any) {
  // Saldos finais calibrados → total = TOTAL_CASH_TARGET
  await prisma.cashAccount.update({ where: { id: caixaDinheiro.id }, data: { currentBalance: 5000 } });
  await prisma.cashAccount.update({ where: { id: contaPix.id }, data: { currentBalance: 16000 } });
  await prisma.cashAccount.update({ where: { id: contaCartao.id }, data: { currentBalance: 5000 } });

  // Sessões de caixa recentes (5 fechadas + 1 aberta hoje)
  for (let d = 6; d >= 1; d--) {
    const openedAt = monthDay(0, NOW.getUTCDate() - d >= 1 ? NOW.getUTCDate() - d : 1);
    const opened = new Date(daysAgo(d).setUTCHours(9, 0, 0, 0));
    const closed = new Date(daysAgo(d).setUTCHours(19, 30, 0, 0));
    const totalSales = round2(rand(900, 2200));
    const session = await prisma.cashSession.create({
      data: {
        cashAccountId: caixaDinheiro.id, companyId, status: 'fechado',
        openingBalance: 200, closingBalance: round2(200 + totalSales * 0.3),
        expectedBalance: round2(200 + totalSales * 0.3), informedBalance: round2(200 + totalSales * 0.3),
        difference: 0, openedById: adminUser.id, openedByName: adminUser.name,
        closedById: adminUser.id, closedByName: adminUser.name, openedAt: opened, closedAt: closed,
        totalSales, totalCash: round2(totalSales * 0.3), totalPix: round2(totalSales * 0.4),
        totalCard: round2(totalSales * 0.3), totalEntries: 0, totalExits: 0, totalSangrias: 0, totalReforcos: 0,
      },
    });
    await prisma.cashMovement.create({ data: { cashAccountId: caixaDinheiro.id, companyId, type: 'entrada', amount: round2(totalSales * 0.3), balanceBefore: 200, balanceAfter: round2(200 + totalSales * 0.3), origin: 'venda_pdv', description: 'Vendas em dinheiro do dia', userName: adminUser.name, cashSessionId: session.id, createdAt: closed } });
  }
  // Sessão aberta hoje
  const openedToday = new Date(NOW); openedToday.setUTCHours(9, 0, 0, 0);
  await prisma.cashSession.create({
    data: {
      cashAccountId: caixaDinheiro.id, companyId, status: 'aberto', openingBalance: 200,
      openedById: adminUser.id, openedByName: adminUser.name, openedAt: openedToday,
    },
  });
  console.log('✓ Caixas calibrados (R$26.000) + 6 sessões (5 fechadas, 1 aberta)');
}

// ─── 17) ESTOQUE FINAL CALIBRADO (giro ~4, parado ~13%) ───
async function calibrateStock(companyId: string, products: any[], saleItemsData: any[], salesData: any[]) {
  const GIRO_TARGET = 4;
  const PARADO_PCT = 0.13;
  const costById = new Map<string, number>();
  for (const p of products) costById.set(p.id, p.cost);
  const saleDate = new Map<string, Date>();
  for (const s of salesData) saleDate.set(s.id, s.createdAt);
  const cutoff = daysAgo(30);
  // CMV dos últimos 30 dias
  let cmv30 = 0;
  for (const it of saleItemsData) {
    const d = saleDate.get(it.saleId);
    if (!d || d < cutoff) continue;
    cmv30 += (costById.get(it.productId) ?? 0) * it.quantity;
  }
  const targetCapital = (cmv30 * 12) / GIRO_TARGET;
  const paradoCapital = targetCapital * PARADO_PCT;
  const activeCapital = targetCapital - paradoCapital;

  const stock = new Map<string, number>();
  const stagnant = products.filter((p) => p.cohort === 'stagnant');
  const zeros = products.filter((p) => p.cohort === 'zero');
  const lows = products.filter((p) => p.cohort === 'low');
  const excess = products.filter((p) => p.cohort === 'excess');
  const normal = products.filter((p) => !['stagnant', 'zero', 'low', 'excess'].includes(p.cohort));

  // Parados: distribuir paradoCapital
  const paradoPer = stagnant.length ? paradoCapital / stagnant.length : 0;
  for (const p of stagnant) stock.set(p.id, Math.max(1, Math.round(paradoPer / p.cost)));
  // Zerados
  for (const p of zeros) stock.set(p.id, 0);
  // Abaixo do mínimo
  for (const p of lows) stock.set(p.id, randInt(1, 2));
  // Excesso
  for (const p of excess) stock.set(p.id, randInt(45, 75));

  let usedCapital = 0;
  for (const p of [...lows, ...excess]) usedCapital += (stock.get(p.id) ?? 0) * p.cost;
  const remaining = Math.max(0, activeCapital - usedCapital);
  const perNormal = normal.length ? remaining / normal.length : 0;
  for (const p of normal) stock.set(p.id, Math.max(p.minStock ?? 3, Math.round(perNormal / p.cost)));

  // Aplicar no banco
  for (const c of chunk(products, 50)) {
    await Promise.all(c.map((p) => prisma.product.update({ where: { id: p.id }, data: { stockQuantity: stock.get(p.id) ?? 0 } })));
  }

  // Capital investido real (aproximado)
  let capInvest = 0, capParado = 0;
  for (const p of products) {
    if (p.cohort === 'zero') continue;
    const q = stock.get(p.id) ?? 0;
    capInvest += q * p.cost;
    if (p.cohort === 'stagnant') capParado += q * p.cost;
  }
  console.log(`✓ Estoque calibrado: CMV30=R$${Math.round(cmv30)}, capital=R$${Math.round(capInvest)}, parado=R$${Math.round(capParado)} (giro alvo ${GIRO_TARGET}, parado ${Math.round((capParado / capInvest) * 100)}%)`);
}

// ─── 18) AGREGADOS DE CLIENTES ───
async function finalizeCustomers(companyId: string, customers: any[]) {
  let activeCount = 0, recurringCount = 0, inactiveRecurring = 0;
  for (const c of customers) {
    let count = 0; let last: Date | null = null;
    if (c.cohort === 'activeRecurring') {
      count = randInt(2, 6); last = daysAgo(randInt(5, 60)); activeCount++; recurringCount++;
    } else if (c.cohort === 'activeSingle') {
      count = 1; last = daysAgo(randInt(10, 80)); activeCount++;
    } else if (c.cohort === 'inactive') {
      const isRec = inactiveRecurring < 15;
      count = isRec ? randInt(2, 3) : 1; if (isRec) { recurringCount++; inactiveRecurring++; }
      last = daysAgo(randInt(120, 300));
    } else { // noPurchase
      count = 0; last = null;
    }
    const ticket = count > 0 ? round2(rand(120, 260)) : 0;
    const total = round2(count * ticket);
    await prisma.customer.update({
      where: { id: c.id },
      data: { purchaseCount: count, lastPurchase: last, totalPurchased: total, avgTicket: ticket },
    });
  }
  console.log(`✓ Clientes finalizados: ${activeCount}/${customers.length} ativos (90d), ${recurringCount} recorrentes`);
}
