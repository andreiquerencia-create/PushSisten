/**
 * Centraliza toda a lógica de exclusão de empresas do Painel Master.
 *
 * Objetivos:
 *  - Exclusão TRANSACIONAL e COMPLETA (sem registros órfãos / sem quebra referencial).
 *  - Reaproveitada tanto pela exclusão individual quanto pela exclusão em massa.
 *  - Proteção (modo seguro) contra exclusão de empresas críticas.
 *
 * IMPORTANTE: este módulo NÃO altera nenhuma regra de negócio dos motores
 * (Financeiro, Ledger, DRE, Push Score, Insights, IA, Crediário). Ele apenas
 * REMOVE os registros pertencentes à empresa, respeitando a ordem das FKs.
 */
import { prisma } from '@/lib/db';

/** IDs de empresas protegidas via variável de ambiente (separadas por vírgula). */
function envProtectedIds(): string[] {
  return (process.env.PROTECTED_COMPANY_IDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export interface CompanyProtectionInfo {
  protected: boolean;
  reasons: string[];
}

/**
 * Verifica, no banco, se um conjunto de empresas pode ou não ser excluído.
 * Retorna um mapa id -> { protected, reasons }.
 *
 * Uma empresa é protegida quando:
 *  - isProtected === true (marcada manualmente / produção)
 *  - hospeda algum usuário master (Conta Master)
 *  - está na lista PROTECTED_COMPANY_IDS do ambiente
 */
export async function getProtectionMap(companyIds: string[]): Promise<Record<string, CompanyProtectionInfo>> {
  const ids = Array.from(new Set(companyIds.filter(Boolean)));
  const result: Record<string, CompanyProtectionInfo> = {};
  if (ids.length === 0) return result;

  const envIds = new Set(envProtectedIds());

  const companies = await prisma.company.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      isProtected: true,
      users: { where: { isMaster: true }, select: { id: true }, take: 1 },
    },
  });

  for (const c of companies) {
    const reasons: string[] = [];
    if (c.isProtected) reasons.push('Empresa marcada como protegida');
    if ((c.users?.length ?? 0) > 0) reasons.push('Hospeda conta Master');
    if (envIds.has(c.id)) reasons.push('Empresa principal de produção');
    result[c.id] = { protected: reasons.length > 0, reasons };
  }

  // Empresas não encontradas — tratadas como não protegidas (serão ignoradas na exclusão)
  for (const id of ids) {
    if (!result[id]) result[id] = { protected: false, reasons: [] };
  }

  return result;
}

export interface CompanyRecordCounts {
  users: number;
  sales: number;
  products: number;
  customers: number;
  financialRecords: number;
  installments: number;
  ledgerEntries: number;
  insights: number;
  pushScoreSnapshots: number;
  automationActions: number;
  activityLogs: number;
  /** soma total de todos os registros vinculados (exceto a própria empresa) */
  total: number;
}

/**
 * Conta os principais registros vinculados a uma empresa, para exibir
 * no modal de confirmação. O campo `total` agrega tudo que será removido.
 */
export async function getCompanyRecordCounts(companyId: string): Promise<CompanyRecordCounts> {
  const [
    users, sales, products, customers, financialRecords, cashMovements, cashSessions,
    accountsPayable, accountsReceivable, installmentPayments, installments, customerCredits,
    salePayments, saleItems, stockEntries, stockEntryItems, inventoryMovements, costHistory,
    priceTables, productVariations, categories, suppliers, carriers, sellers, paymentMethods,
    cashAccounts, accountPlans, financialCategories, iaAlerts, iaConversations, iaMemories,
    iaContexts, automationLogs, automations, automationActions, whatsappMessages, messageTemplates,
    whatsappConfigs, importLogs, aiClassificationLogs, activityLogs, ledgerEntries, insights,
    pushScoreSnapshots, pushScoreConfigs,
  ] = await prisma.$transaction([
    prisma.user.count({ where: { companyId } }),
    prisma.sale.count({ where: { companyId } }),
    prisma.product.count({ where: { companyId } }),
    prisma.customer.count({ where: { companyId } }),
    prisma.financialRecord.count({ where: { companyId } }),
    prisma.cashMovement.count({ where: { cashAccount: { companyId } } }),
    prisma.cashSession.count({ where: { cashAccount: { companyId } } }),
    prisma.accountPayable.count({ where: { companyId } }),
    prisma.accountReceivable.count({ where: { companyId } }),
    prisma.installmentPayment.count({ where: { companyId } }),
    prisma.installment.count({ where: { companyId } }),
    prisma.customerCredit.count({ where: { companyId } }),
    prisma.salePayment.count({ where: { companyId } }),
    prisma.saleItem.count({ where: { sale: { companyId } } }),
    prisma.stockEntry.count({ where: { companyId } }),
    prisma.stockEntryItem.count({ where: { stockEntry: { companyId } } }),
    prisma.inventoryMovement.count({ where: { companyId } }),
    prisma.costHistory.count({ where: { companyId } }),
    prisma.priceTable.count({ where: { product: { companyId } } }),
    prisma.productVariation.count({ where: { product: { companyId } } }),
    prisma.category.count({ where: { companyId } }),
    prisma.supplier.count({ where: { companyId } }),
    prisma.carrier.count({ where: { companyId } }),
    prisma.seller.count({ where: { companyId } }),
    prisma.paymentMethod.count({ where: { companyId } }),
    prisma.cashAccount.count({ where: { companyId } }),
    prisma.accountPlan.count({ where: { companyId } }),
    prisma.financialCategory.count({ where: { companyId } }),
    prisma.iAAlert.count({ where: { companyId } }),
    prisma.iAConversation.count({ where: { companyId } }),
    prisma.iAMemory.count({ where: { companyId } }),
    prisma.iAOperationalContext.count({ where: { companyId } }),
    prisma.automationLog.count({ where: { automation: { companyId } } }),
    prisma.automation.count({ where: { companyId } }),
    prisma.automationAction.count({ where: { companyId } }),
    prisma.whatsAppMessage.count({ where: { config: { companyId } } }),
    prisma.messageTemplate.count({ where: { companyId } }),
    prisma.whatsAppConfig.count({ where: { companyId } }),
    prisma.importLog.count({ where: { companyId } }),
    prisma.aiClassificationLog.count({ where: { companyId } }),
    prisma.activityLog.count({ where: { companyId } }),
    prisma.ledgerEntry.count({ where: { companyId } }),
    prisma.insight.count({ where: { companyId } }),
    prisma.pushScoreSnapshot.count({ where: { companyId } }),
    prisma.pushScoreConfig.count({ where: { companyId } }),
  ]);

  const total =
    users + sales + products + customers + financialRecords + cashMovements + cashSessions +
    accountsPayable + accountsReceivable + installmentPayments + installments + customerCredits +
    salePayments + saleItems + stockEntries + stockEntryItems + inventoryMovements + costHistory +
    priceTables + productVariations + categories + suppliers + carriers + sellers + paymentMethods +
    cashAccounts + accountPlans + financialCategories + iaAlerts + iaConversations + iaMemories +
    iaContexts + automationLogs + automations + automationActions + whatsappMessages + messageTemplates +
    whatsappConfigs + importLogs + aiClassificationLogs + activityLogs + ledgerEntries + insights +
    pushScoreSnapshots + pushScoreConfigs;

  return {
    users, sales, products, customers, financialRecords,
    installments, ledgerEntries, insights, pushScoreSnapshots, automationActions, activityLogs,
    total,
  };
}

/**
 * Soma agregada de usuários/registros para um conjunto de empresas.
 * Usado no modal de exclusão em massa.
 */
export async function aggregateCounts(companyIds: string[]): Promise<{ companies: number; users: number; totalRecords: number; }> {
  const ids = Array.from(new Set(companyIds.filter(Boolean)));
  let users = 0;
  let totalRecords = 0;
  for (const id of ids) {
    const c = await getCompanyRecordCounts(id);
    users += c.users;
    totalRecords += c.total;
  }
  return { companies: ids.length, users, totalRecords };
}

/**
 * Executa a exclusão COMPLETA e TRANSACIONAL de UMA empresa.
 * Deve ser chamada dentro de um prisma.$transaction (recebe o client `tx`).
 * Remove todos os registros vinculados respeitando a ordem das FKs e,
 * por fim, a própria empresa.
 */
export async function deleteCompanyCascade(tx: any, companyId: string): Promise<void> {
  // 1) Financeiro / caixa
  await tx.financialRecord.deleteMany({ where: { companyId } });
  await tx.cashMovement.deleteMany({ where: { cashAccount: { companyId } } });
  await tx.cashSession.deleteMany({ where: { cashAccount: { companyId } } });
  await tx.accountPayable.deleteMany({ where: { companyId } });
  await tx.accountReceivable.deleteMany({ where: { companyId } });

  // 2) Crediário
  await tx.installmentPayment.deleteMany({ where: { companyId } });
  await tx.installment.deleteMany({ where: { companyId } });
  await tx.customerCredit.deleteMany({ where: { companyId } });

  // 3) Vendas
  await tx.salePayment.deleteMany({ where: { companyId } });
  await tx.saleItem.deleteMany({ where: { sale: { companyId } } });
  await tx.sale.deleteMany({ where: { companyId } });

  // 4) Estoque
  await tx.stockEntryItem.deleteMany({ where: { stockEntry: { companyId } } });
  await tx.stockEntry.deleteMany({ where: { companyId } });
  await tx.inventoryMovement.deleteMany({ where: { companyId } });
  await tx.costHistory.deleteMany({ where: { companyId } });

  // 5) Produtos / catálogo
  await tx.priceTable.deleteMany({ where: { product: { companyId } } });
  await tx.productVariation.deleteMany({ where: { product: { companyId } } });
  await tx.product.deleteMany({ where: { companyId } });
  await tx.category.deleteMany({ where: { companyId } });

  // 6) Pessoas
  await tx.customer.deleteMany({ where: { companyId } });
  await tx.supplier.deleteMany({ where: { companyId } });
  await tx.carrier.deleteMany({ where: { companyId } });
  await tx.seller.deleteMany({ where: { companyId } });

  // 7) Contabilidade / Ledger — ANTES de accountPlan (FK obrigatória ledgerEntry -> accountPlan)
  await tx.ledgerEntry.deleteMany({ where: { companyId } });

  // 8) Push Score / Insights
  await tx.pushScoreSnapshot.deleteMany({ where: { companyId } });
  await tx.pushScoreConfig.deleteMany({ where: { companyId } });
  await tx.insight.deleteMany({ where: { companyId } });

  // 9) Configurações financeiras / caixa (accountPlan por último, após ledger/financial)
  await tx.paymentMethod.deleteMany({ where: { companyId } });
  await tx.cashAccount.deleteMany({ where: { companyId } });
  await tx.accountPlan.deleteMany({ where: { companyId } });
  await tx.financialCategory.deleteMany({ where: { companyId } });

  // 10) IA / automações
  await tx.iAAlert.deleteMany({ where: { companyId } });
  await tx.iAConversation.deleteMany({ where: { companyId } });
  await tx.iAMemory.deleteMany({ where: { companyId } });
  await tx.iAOperationalContext.deleteMany({ where: { companyId } });
  await tx.automationLog.deleteMany({ where: { automation: { companyId } } });
  await tx.automationAction.deleteMany({ where: { companyId } });
  await tx.automation.deleteMany({ where: { companyId } });

  // 11) WhatsApp
  await tx.whatsAppMessage.deleteMany({ where: { config: { companyId } } });
  await tx.messageTemplate.deleteMany({ where: { companyId } });
  await tx.whatsAppConfig.deleteMany({ where: { companyId } });

  // 12) Logs de importação / classificação
  await tx.importLog.deleteMany({ where: { companyId } });
  await tx.aiClassificationLog.deleteMany({ where: { companyId } });

  // 13) Logs de atividade
  await tx.activityLog.deleteMany({ where: { companyId } });

  // 14) Usuários
  await tx.user.deleteMany({ where: { companyId } });

  // 15) Finalmente, a empresa
  await tx.company.delete({ where: { id: companyId } });
}
