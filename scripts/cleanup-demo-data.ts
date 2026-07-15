import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanupDemoData() {
  console.log('\n========================================');
  console.log('  LIMPEZA DE DADOS DE DEMONSTRAÇÃO');
  console.log('========================================\n');

  const results: Record<string, number> = {};

  try {
    // 1. IA & Automation data
    console.log('[1/14] Removendo logs de automação...');
    results.automationLogs = (await prisma.automationLog.deleteMany({})).count;
    results.automations = (await prisma.automation.deleteMany({})).count;

    console.log('[2/14] Removendo dados de IA...');
    results.iaAlerts = (await prisma.iAAlert.deleteMany({})).count;
    results.iaMemories = (await prisma.iAMemory.deleteMany({})).count;
    results.iaConversations = (await prisma.iAConversation.deleteMany({})).count;
    results.iaContexts = (await prisma.iAOperationalContext.deleteMany({})).count;

    // 2. WhatsApp data
    console.log('[3/14] Removendo dados de WhatsApp...');
    results.whatsappMessages = (await prisma.whatsAppMessage.deleteMany({})).count;
    results.whatsappConfigs = (await prisma.whatsAppConfig.deleteMany({})).count;

    // 3. Sale payments
    console.log('[4/14] Removendo pagamentos de vendas...');
    results.salePayments = (await prisma.salePayment.deleteMany({})).count;

    // 4. Sale items
    console.log('[5/14] Removendo itens de venda...');
    results.saleItems = (await prisma.saleItem.deleteMany({})).count;

    // 5. Sales
    console.log('[6/14] Removendo vendas...');
    results.sales = (await prisma.sale.deleteMany({})).count;

    // 6. Financial data
    console.log('[7/14] Removendo dados financeiros...');
    results.accountsPayable = (await prisma.accountPayable.deleteMany({})).count;
    results.accountsReceivable = (await prisma.accountReceivable.deleteMany({})).count;
    results.financialRecords = (await prisma.financialRecord.deleteMany({})).count;

    // 7. Inventory
    console.log('[8/14] Removendo movimentações de estoque...');
    results.inventoryMovements = (await prisma.inventoryMovement.deleteMany({})).count;

    // 8. Products
    console.log('[9/14] Removendo produtos e variações...');
    results.productVariations = (await prisma.productVariation.deleteMany({})).count;
    results.products = (await prisma.product.deleteMany({})).count;

    // 9. Categories
    console.log('[10/14] Removendo categorias...');
    results.categories = (await prisma.category.deleteMany({})).count;

    // 10. Customers
    console.log('[11/14] Removendo clientes...');
    results.customers = (await prisma.customer.deleteMany({})).count;

    // 11. Payment Methods (before Cash Accounts - FK)
    console.log('[12/14] Removendo formas de pagamento e caixas...');
    results.paymentMethods = (await prisma.paymentMethod.deleteMany({})).count;
    results.cashAccounts = (await prisma.cashAccount.deleteMany({})).count;

    // 12. Business entities
    console.log('[13/14] Removendo vendedores, fornecedores, transportadoras...');
    results.sellers = (await prisma.seller.deleteMany({})).count;
    results.suppliers = (await prisma.supplier.deleteMany({})).count;
    results.carriers = (await prisma.carrier.deleteMany({})).count;

    // NOT DELETED (preserved):
    // - Company (structure)
    // - Users (admin accounts)
    // - FinancialCategory (system-critical)
    // - MessageTemplate (user configurations)

    console.log('[14/14] Verificação final...\n');

    const totalDeleted = Object.values(results).reduce((a, b) => a + b, 0);

    console.log('========================================');
    console.log('  RESULTADO DA LIMPEZA');
    console.log('========================================');
    for (const [key, val] of Object.entries(results)) {
      if (val > 0) console.log(`  ${key}: ${val} removidos`);
    }
    console.log(`\n  TOTAL: ${totalDeleted} registros removidos`);
    console.log('\n  PRESERVADOS:');
    console.log('  ✓ Company (empresa)');
    console.log('  ✓ Users (usuários)');
    console.log('  ✓ FinancialCategories (categorias financeiras)');
    console.log('  ✓ MessageTemplates (mensagens configuradas)');
    console.log('========================================\n');
    console.log('✅ Sistema pronto para operação real!\n');

  } catch (error) {
    console.error('\n❌ ERRO durante limpeza:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

cleanupDemoData();
