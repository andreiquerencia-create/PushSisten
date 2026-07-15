/**
 * FASE 7 — Registro canônico de models para Backup & Recovery por empresa.
 *
 * Define, em ORDEM TOPOLÓGICA por dependência de chave estrangeira
 * (pais antes de filhos), todos os models que compõem UMA empresa.
 * A MESMA ordem é válida para:
 *   - EXPORT (a ordem não importa para o export, pois o isolamento é por `where`);
 *   - RESTORE (a ordem importa: as FKs dos filhos só existem após os pais).
 *
 * NÃO altera nenhuma regra de negócio. Apenas descreve COMO ler/escrever
 * cada model de forma estritamente isolada por empresa (multi-tenant).
 *
 * Isolamento na LEITURA (export):
 *  - scope: 'company'  -> filtro direto { companyId }
 *  - scope: 'relation' -> model SEM companyId; filtra pelo pai via relação
 *                         (ex.: SaleItem -> { sale: { companyId } })
 *  - scope: 'root'     -> a própria Company (1 registro)
 *
 * Remapeamento na ESCRITA (restore para NOVA empresa):
 *  - `fkFields`: campos escalares que apontam para o id de OUTRO registro do
 *                backup (inclui companyId). Todos são remapeados via o mapa
 *                global old->new id. Se o valor antigo não existir no mapa,
 *                o campo é zerado (null) e contabilizado como aviso.
 *  - `selfRefField`: campo de auto-relação (AccountPlan.parentId). Tratado em
 *                duas fases (insere com null e depois atualiza) para nunca
 *                violar a FK durante o insert.
 *  - `softIdFields`: ids polimórficos/sem FK formal (ex.: LedgerEntry.sourceId).
 *                Remapeados via mapa global SE encontrados; caso contrário
 *                mantidos como estão (não há constraint que os force).
 */

export type BackupScope = 'root' | 'company' | 'relation';

export interface BackupModelDef {
  /** Nome lógico usado como chave em datasets do JSON */
  key: string;
  /** Nome do delegate no Prisma Client (camelCase exato) */
  delegate: string;
  scope: BackupScope;
  /** Para scope 'relation': filtro Prisma que resolve a empresa via pai */
  relationWhere?: (companyId: string) => any;
  /** Campos FK (incluindo companyId) a remapear via mapa global old->new */
  fkFields?: string[];
  /** Campo de auto-relação tratado em 2 fases (insere null, depois UPDATE) */
  selfRefField?: string;
  /** Ids sem FK formal (polimórficos): remapeia se achar, senão mantém */
  softIdFields?: string[];
}

/**
 * ORDEM TOPOLÓGICA (pais -> filhos) válida para restore.
 */
export const BACKUP_MODELS: BackupModelDef[] = [
  // 1. Raiz do tenant
  { key: 'company', delegate: 'company', scope: 'root' },

  // 2. Usuários
  { key: 'users', delegate: 'user', scope: 'company', fkFields: ['companyId'] },

  // 3. Tabelas-base / configuração
  { key: 'categories', delegate: 'category', scope: 'company', fkFields: ['companyId'] },
  { key: 'suppliers', delegate: 'supplier', scope: 'company', fkFields: ['companyId'] },
  { key: 'carriers', delegate: 'carrier', scope: 'company', fkFields: ['companyId'] },
  { key: 'financialCategories', delegate: 'financialCategory', scope: 'company', fkFields: ['companyId'] },
  { key: 'accountPlans', delegate: 'accountPlan', scope: 'company', fkFields: ['companyId'], selfRefField: 'parentId' },
  { key: 'cashAccounts', delegate: 'cashAccount', scope: 'company', fkFields: ['companyId'] },
  { key: 'paymentMethods', delegate: 'paymentMethod', scope: 'company', fkFields: ['companyId', 'cashAccountId'] },

  // 4. Catálogo de produtos
  { key: 'products', delegate: 'product', scope: 'company', fkFields: ['companyId', 'categoryId', 'supplierId'] },
  { key: 'productVariations', delegate: 'productVariation', scope: 'relation', relationWhere: (c) => ({ product: { companyId: c } }), fkFields: ['productId'] },
  { key: 'priceTables', delegate: 'priceTable', scope: 'company', fkFields: ['companyId', 'productId'] },

  // 5. Pessoas operacionais (sellers ANTES de customers: Customer.sellerId -> Seller)
  { key: 'sellers', delegate: 'seller', scope: 'company', fkFields: ['companyId', 'userId'] },
  { key: 'customers', delegate: 'customer', scope: 'company', fkFields: ['companyId', 'sellerId'] },

  // 6. Vendas e dependentes (Sale.sellerId -> User)
  { key: 'sales', delegate: 'sale', scope: 'company', fkFields: ['companyId', 'customerId', 'sellerId'] },
  { key: 'saleItems', delegate: 'saleItem', scope: 'relation', relationWhere: (c) => ({ sale: { companyId: c } }), fkFields: ['saleId', 'productId', 'variationId', 'priceTableId'] },
  { key: 'salePayments', delegate: 'salePayment', scope: 'company', fkFields: ['companyId', 'saleId', 'paymentMethodId'] },

  // 7. Entradas de estoque
  { key: 'stockEntries', delegate: 'stockEntry', scope: 'company', fkFields: ['companyId', 'supplierId'] },
  { key: 'stockEntryItems', delegate: 'stockEntryItem', scope: 'relation', relationWhere: (c) => ({ stockEntry: { companyId: c } }), fkFields: ['stockEntryId', 'productId', 'variationId'] },

  // 8. Movimentos de estoque e custo
  { key: 'inventoryMovements', delegate: 'inventoryMovement', scope: 'company', fkFields: ['companyId', 'productId', 'variationId', 'stockEntryId'] },
  { key: 'costHistory', delegate: 'costHistory', scope: 'company', fkFields: ['productId'] },

  // 9. Financeiro
  { key: 'financialRecords', delegate: 'financialRecord', scope: 'company', fkFields: ['companyId', 'categoryId', 'accountPlanId'] },
  { key: 'accountsPayable', delegate: 'accountPayable', scope: 'company', fkFields: ['companyId', 'supplierId', 'stockEntryId', 'accountPlanId'] },
  { key: 'accountsReceivable', delegate: 'accountReceivable', scope: 'company', fkFields: ['companyId', 'customerId', 'accountPlanId'] },

  // 10. Caixa
  { key: 'cashSessions', delegate: 'cashSession', scope: 'company', fkFields: ['companyId', 'cashAccountId'] },
  { key: 'cashMovements', delegate: 'cashMovement', scope: 'company', fkFields: ['companyId', 'cashAccountId', 'cashSessionId'] },

  // 11. Contabilidade (Ledger). sourceId é polimórfico (sale/ar/ap/...): remap soft.
  { key: 'ledgerEntries', delegate: 'ledgerEntry', scope: 'company', fkFields: ['companyId', 'accountPlanId'], softIdFields: ['sourceId'] },

  // 12. Classificação / IA / automações / logs
  { key: 'aiClassificationLogs', delegate: 'aiClassificationLog', scope: 'company', fkFields: ['companyId'] },
  { key: 'iaMemories', delegate: 'iAMemory', scope: 'company', fkFields: ['companyId'] },
  { key: 'iaConversations', delegate: 'iAConversation', scope: 'company', fkFields: ['companyId'] },
  { key: 'iaContexts', delegate: 'iAOperationalContext', scope: 'company', fkFields: ['companyId'] },
  { key: 'iaAlerts', delegate: 'iAAlert', scope: 'company', fkFields: ['companyId'] },
  { key: 'automations', delegate: 'automation', scope: 'company', fkFields: ['companyId'] },
  { key: 'automationLogs', delegate: 'automationLog', scope: 'relation', relationWhere: (c) => ({ automation: { companyId: c } }), fkFields: ['automationId'] },
  { key: 'whatsappConfigs', delegate: 'whatsAppConfig', scope: 'company', fkFields: ['companyId'] },
  { key: 'whatsappMessages', delegate: 'whatsAppMessage', scope: 'relation', relationWhere: (c) => ({ config: { companyId: c } }), fkFields: ['configId'] },
  { key: 'messageTemplates', delegate: 'messageTemplate', scope: 'company', fkFields: ['companyId'] },
  { key: 'importLogs', delegate: 'importLog', scope: 'company', fkFields: ['companyId'] },
  // ActivityLog.userId NÃO é FK formal (sem @relation com User) -> soft remap.
  { key: 'activityLogs', delegate: 'activityLog', scope: 'company', fkFields: ['companyId'], softIdFields: ['userId', 'entityId'] },
];

export const BACKUP_VERSION = '1.0';

/** Constrói o filtro `where` para um model dado o companyId. */
export function buildWhere(def: BackupModelDef, companyId: string): any {
  if (def.scope === 'root') return { id: companyId };
  if (def.scope === 'company') return { companyId };
  if (def.scope === 'relation' && def.relationWhere) return def.relationWhere(companyId);
  return {};
}
