export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    if (!session.user.isMaster) {
      return NextResponse.json({ error: 'Apenas master pode executar esta ação' }, { status: 403 });
    }

    const body = await request.json();
    if (body?.confirm !== 'RESETAR_DADOS_DEMONSTRACAO') {
      return NextResponse.json({ error: 'Confirmação inválida. Envie { confirm: "RESETAR_DADOS_DEMONSTRACAO" }' }, { status: 400 });
    }

    const results: Record<string, number> = {};

    // ==============================================
    // DELETION ORDER — respects FK constraints
    // Deletes from leaf tables first, then parent tables
    // ==============================================

    // 1. IA & Automation data
    const automationLogs = await prisma.automationLog.deleteMany({});
    results.automationLogs = automationLogs.count;

    const automations = await prisma.automation.deleteMany({});
    results.automations = automations.count;

    const iaAlerts = await prisma.iAAlert.deleteMany({});
    results.iaAlerts = iaAlerts.count;

    const iaMemories = await prisma.iAMemory.deleteMany({});
    results.iaMemories = iaMemories.count;

    const iaConversations = await prisma.iAConversation.deleteMany({});
    results.iaConversations = iaConversations.count;

    const iaContexts = await prisma.iAOperationalContext.deleteMany({});
    results.iaContexts = iaContexts.count;

    // 2. WhatsApp data
    const whatsappMsgs = await prisma.whatsAppMessage.deleteMany({});
    results.whatsappMessages = whatsappMsgs.count;

    const whatsappConfigs = await prisma.whatsAppConfig.deleteMany({});
    results.whatsappConfigs = whatsappConfigs.count;

    // 3. Sale-related data (leaf → parent)
    const salePayments = await prisma.salePayment.deleteMany({});
    results.salePayments = salePayments.count;

    const saleItems = await prisma.saleItem.deleteMany({});
    results.saleItems = saleItems.count;

    const sales = await prisma.sale.deleteMany({});
    results.sales = sales.count;

    // 4. Financial data
    const accountsPayable = await prisma.accountPayable.deleteMany({});
    results.accountsPayable = accountsPayable.count;

    const accountsReceivable = await prisma.accountReceivable.deleteMany({});
    results.accountsReceivable = accountsReceivable.count;

    const financialRecords = await prisma.financialRecord.deleteMany({});
    results.financialRecords = financialRecords.count;

    // 5. Inventory
    const inventoryMovements = await prisma.inventoryMovement.deleteMany({});
    results.inventoryMovements = inventoryMovements.count;

    // 6. Products (variations first, then products, then categories)
    const productVariations = await prisma.productVariation.deleteMany({});
    results.productVariations = productVariations.count;

    const products = await prisma.product.deleteMany({});
    results.products = products.count;

    const categories = await prisma.category.deleteMany({});
    results.categories = categories.count;

    // 7. Business entities
    const customers = await prisma.customer.deleteMany({});
    results.customers = customers.count;

    // 8. PaymentMethods before CashAccounts (FK dependency)
    const paymentMethods = await prisma.paymentMethod.deleteMany({});
    results.paymentMethods = paymentMethods.count;

    const cashAccounts = await prisma.cashAccount.deleteMany({});
    results.cashAccounts = cashAccounts.count;

    // 9. Sellers, Suppliers, Carriers
    const sellers = await prisma.seller.deleteMany({});
    results.sellers = sellers.count;

    const suppliers = await prisma.supplier.deleteMany({});
    results.suppliers = suppliers.count;

    const carriers = await prisma.carrier.deleteMany({});
    results.carriers = carriers.count;

    // 10. Message templates (keep — these are user configurations)
    // NOT deleted — they are config, not demo data

    // 11. Financial categories — KEEP (system-critical for sales flow)
    // NOT deleted — "Taxas de Cartão" is referenced by sales API

    // 12. Users — KEEP ALL
    // NOT deleted — admin, gerente, vendedor, master accounts preserved

    // 13. Company — KEEP
    // NOT deleted — company structure preserved

    const totalDeleted = Object.values(results).reduce((a, b) => a + b, 0);

    console.log(`[RESET DATA] Master ${session.user.email} executou reset. Total: ${totalDeleted} registros removidos.`);

    return NextResponse.json({
      success: true,
      message: `Dados de demonstração removidos com sucesso. ${totalDeleted} registros excluídos.`,
      details: results,
      preserved: ['users', 'company', 'financial_categories', 'message_templates'],
    });
  } catch (error: any) {
    console.error('[RESET DATA] Error:', error);
    return NextResponse.json({ error: 'Erro ao resetar dados: ' + (error.message || 'Erro desconhecido') }, { status: 500 });
  }
}
