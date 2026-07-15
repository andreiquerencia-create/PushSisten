/**
 * PushSisten — Infraestrutura da DEMO Oficial (Loja Modelo PushSisten).
 *
 * Registro canônico e AUTOSSUFICIENTE dos models que compõem a empresa DEMO,
 * usado exclusivamente pelas operações de:
 *   - Snapshot DEMO_V1 (captura integral do estado calibrado)
 *   - Restauração DEMO_V1 (destrutiva IN-PLACE, apenas na empresa DEMO)
 *   - Atualização de Datas DEMO (deslocamento temporal preservando relações)
 *
 * IMPORTANTe:
 *   - Este arquivo NÃO altera o motor de backup/restore existente
 *     (lib/backup-*.ts, lib/restore-engine.ts). É um registro independente,
 *     mais completo, específico da DEMO (inclui crediário, push score,
 *     insights e ações automáticas, que não fazem parte do backup genérico).
 *   - EXCLUI deliberadamente qualquer dado de cobrança/assinatura
 *     (Billing*, WebhookEvent) e de infraestrutura de backup
 *     (BackupRecord, BackupSchedule). Assinaturas/Mercado Pago NUNCA são tocadas.
 *
 * A ordem da lista é TOPOLÓGICA (pais → filhos), válida para inserção.
 * A remoção destrutiva percorre a lista em ordem INVERSA (filhos → pais).
 */

/** Nome oficial e imutável da empresa DEMO. Fonte única de verdade. */
export const DEMO_COMPANY_NAME = 'Loja Modelo PushSisten';
export const DEMO_ADMIN_EMAIL = 'demo@pushsisten.com';
/** Rótulo do snapshot oficial. Único — nunca duplicado. */
export const DEMO_SNAPSHOT_LABEL = 'DEMO_V1';
export const DEMO_SNAPSHOT_VERSION = '1.0';

export type DemoScope = 'root' | 'company' | 'relation';

export interface DemoModelDef {
  /** Chave lógica usada nos datasets do snapshot JSON. */
  key: string;
  /** Nome do delegate no Prisma Client (camelCase exato). */
  delegate: string;
  scope: DemoScope;
  /** Nome real da tabela no banco (@@map) — usado no SQL de deslocamento de datas. */
  table: string;
  /** Para scope 'relation': filtro Prisma que resolve a empresa via pai. */
  relationWhere?: (companyId: string) => any;
  /** Para scope 'relation' com datas: como ligar ao companyId no SQL (subquery). */
  shiftJoin?: { fkColumn: string; parentTable: string };
  /** Campo de auto-relação (AccountPlan.parentId): inserido em 2 fases. */
  selfRefField?: string;
  /** TODOS os campos DateTime do model (usados para reviver ISO→Date na restauração). */
  dateFields: string[];
  /** Campos presentes em dateFields que NÃO devem ser deslocados na Atualização de Datas
   *  (ex.: datas de trial/assinatura da empresa — nunca alteradas). */
  shiftExclude?: string[];
}

/**
 * ORDEM TOPOLÓGICA (pais → filhos).
 * A restauração insere nesta ordem; a limpeza remove na ordem inversa.
 */
export const DEMO_MODELS: DemoModelDef[] = [
  { key: 'company', delegate: 'company', scope: 'root', table: 'companies',
    dateFields: ['createdAt', 'updatedAt', 'trialEndsAt', 'aiCallsResetAt', 'lastAccessAt', 'gracePeriodEndsAt'],
    shiftExclude: ['trialEndsAt', 'aiCallsResetAt', 'lastAccessAt', 'gracePeriodEndsAt'] },

  { key: 'users', delegate: 'user', scope: 'company', table: 'users', dateFields: ['createdAt', 'updatedAt'] },
  { key: 'categories', delegate: 'category', scope: 'company', table: 'categories', dateFields: ['createdAt', 'updatedAt'] },
  { key: 'suppliers', delegate: 'supplier', scope: 'company', table: 'suppliers', dateFields: ['createdAt', 'updatedAt'] },
  { key: 'carriers', delegate: 'carrier', scope: 'company', table: 'carriers', dateFields: ['createdAt', 'updatedAt'] },
  { key: 'financialCategories', delegate: 'financialCategory', scope: 'company', table: 'financial_categories', dateFields: ['createdAt'] },
  { key: 'accountPlans', delegate: 'accountPlan', scope: 'company', table: 'account_plans', selfRefField: 'parentId', dateFields: ['createdAt'] },
  { key: 'cashAccounts', delegate: 'cashAccount', scope: 'company', table: 'cash_accounts', dateFields: ['createdAt', 'updatedAt'] },
  { key: 'paymentMethods', delegate: 'paymentMethod', scope: 'company', table: 'payment_methods', dateFields: ['createdAt', 'updatedAt'] },

  { key: 'products', delegate: 'product', scope: 'company', table: 'products', dateFields: ['createdAt', 'updatedAt'] },
  { key: 'productVariations', delegate: 'productVariation', scope: 'relation', table: 'product_variations', relationWhere: (c) => ({ product: { companyId: c } }), shiftJoin: { fkColumn: 'productId', parentTable: 'products' }, dateFields: ['createdAt', 'updatedAt'] },
  { key: 'priceTables', delegate: 'priceTable', scope: 'company', table: 'price_tables', dateFields: ['createdAt', 'updatedAt'] },

  { key: 'sellers', delegate: 'seller', scope: 'company', table: 'sellers', dateFields: ['createdAt', 'updatedAt'] },
  { key: 'customers', delegate: 'customer', scope: 'company', table: 'customers', dateFields: ['lastPurchase', 'createdAt', 'updatedAt'] },
  { key: 'customerCredits', delegate: 'customerCredit', scope: 'company', table: 'customer_credits', dateFields: ['createdAt', 'updatedAt'] },

  { key: 'sales', delegate: 'sale', scope: 'company', table: 'sales', dateFields: ['createdAt', 'updatedAt'] },
  { key: 'saleItems', delegate: 'saleItem', scope: 'relation', table: 'sale_items', relationWhere: (c) => ({ sale: { companyId: c } }), dateFields: [] },
  { key: 'salePayments', delegate: 'salePayment', scope: 'company', table: 'sale_payments', dateFields: ['expectedDate', 'receivedDate', 'createdAt'] },
  { key: 'installments', delegate: 'installment', scope: 'company', table: 'installments', dateFields: ['dueDate', 'renegotiatedAt', 'createdAt', 'updatedAt'] },
  { key: 'installmentPayments', delegate: 'installmentPayment', scope: 'company', table: 'installment_payments', dateFields: ['paymentDate', 'createdAt'] },

  { key: 'stockEntries', delegate: 'stockEntry', scope: 'company', table: 'stock_entries', dateFields: ['cancelledAt', 'createdAt', 'updatedAt'] },
  { key: 'stockEntryItems', delegate: 'stockEntryItem', scope: 'relation', table: 'stock_entry_items', relationWhere: (c) => ({ stockEntry: { companyId: c } }), shiftJoin: { fkColumn: 'stockEntryId', parentTable: 'stock_entries' }, dateFields: ['createdAt'] },
  { key: 'inventoryMovements', delegate: 'inventoryMovement', scope: 'company', table: 'inventory_movements', dateFields: ['createdAt'] },
  { key: 'costHistory', delegate: 'costHistory', scope: 'company', table: 'cost_history', dateFields: ['createdAt'] },

  { key: 'financialRecords', delegate: 'financialRecord', scope: 'company', table: 'financial_records', dateFields: ['date', 'createdAt'] },
  { key: 'accountsPayable', delegate: 'accountPayable', scope: 'company', table: 'accounts_payable', dateFields: ['dueDate', 'paidDate', 'recurringEndDate', 'createdAt', 'updatedAt'] },
  { key: 'accountsReceivable', delegate: 'accountReceivable', scope: 'company', table: 'accounts_receivable', dateFields: ['dueDate', 'receivedDate', 'createdAt', 'updatedAt'] },

  { key: 'cashSessions', delegate: 'cashSession', scope: 'company', table: 'cash_sessions', dateFields: ['openedAt', 'closedAt'] },
  { key: 'cashMovements', delegate: 'cashMovement', scope: 'company', table: 'cash_movements', dateFields: ['createdAt'] },

  { key: 'ledgerEntries', delegate: 'ledgerEntry', scope: 'company', table: 'ledger_entries', dateFields: ['date', 'createdAt'] },

  { key: 'aiClassificationLogs', delegate: 'aiClassificationLog', scope: 'company', table: 'ai_classification_logs', dateFields: ['createdAt'] },
  { key: 'iaMemories', delegate: 'iAMemory', scope: 'company', table: 'ia_memories', dateFields: ['expiresAt', 'createdAt', 'updatedAt'] },
  { key: 'iaConversations', delegate: 'iAConversation', scope: 'company', table: 'ia_conversations', dateFields: ['createdAt', 'updatedAt'] },
  { key: 'iaContexts', delegate: 'iAOperationalContext', scope: 'company', table: 'ia_operational_contexts', dateFields: ['createdAt'] },
  { key: 'iaAlerts', delegate: 'iAAlert', scope: 'company', table: 'ia_alerts', dateFields: ['resolvedAt', 'createdAt'] },

  { key: 'automations', delegate: 'automation', scope: 'company', table: 'automations', dateFields: ['lastRun', 'createdAt', 'updatedAt'] },
  { key: 'automationLogs', delegate: 'automationLog', scope: 'relation', table: 'automation_logs', relationWhere: (c) => ({ automation: { companyId: c } }), shiftJoin: { fkColumn: 'automationId', parentTable: 'automations' }, dateFields: ['executedAt'] },
  { key: 'automationActions', delegate: 'automationAction', scope: 'company', table: 'automation_actions', dateFields: ['date', 'executedAt', 'createdAt', 'updatedAt'] },

  { key: 'whatsappConfigs', delegate: 'whatsAppConfig', scope: 'company', table: 'whatsapp_configs', dateFields: ['createdAt', 'updatedAt'] },
  { key: 'whatsappMessages', delegate: 'whatsAppMessage', scope: 'relation', table: 'whatsapp_messages', relationWhere: (c) => ({ config: { companyId: c } }), shiftJoin: { fkColumn: 'configId', parentTable: 'whatsapp_configs' }, dateFields: ['createdAt'] },
  { key: 'messageTemplates', delegate: 'messageTemplate', scope: 'company', table: 'message_templates', dateFields: ['createdAt', 'updatedAt'] },
  { key: 'importLogs', delegate: 'importLog', scope: 'company', table: 'import_logs', dateFields: ['createdAt'] },

  { key: 'pushScoreConfigs', delegate: 'pushScoreConfig', scope: 'company', table: 'push_score_configs', dateFields: ['createdAt', 'updatedAt'] },
  { key: 'pushScoreSnapshots', delegate: 'pushScoreSnapshot', scope: 'company', table: 'push_score_snapshots', dateFields: ['date', 'createdAt', 'updatedAt'] },
  { key: 'insights', delegate: 'insight', scope: 'company', table: 'insights', dateFields: ['date', 'createdAt', 'updatedAt'] },

  { key: 'activityLogs', delegate: 'activityLog', scope: 'company', table: 'activity_logs', dateFields: ['createdAt'] },
];

/** Constrói o filtro `where` isolado por empresa para um model. */
export function buildDemoWhere(def: DemoModelDef, companyId: string): any {
  if (def.scope === 'root') return { id: companyId };
  if (def.scope === 'company') return { companyId };
  if (def.scope === 'relation' && def.relationWhere) return def.relationWhere(companyId);
  return {};
}
