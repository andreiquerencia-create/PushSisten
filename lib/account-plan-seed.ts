/**
 * Plano de Contas Padrão PUSHY ERP — Varejo de Moda / Vestuário
 *
 * Estrutura hierárquica profissional (gerencial, não contábil):
 *   Grupo (1, 2, 3, 4, 5, 6)
 *     → Subgrupo (1.1, 1.2, 3.1, 3.2...)
 *       → Conta (1.1.1, 1.1.2, 3.1.1...)
 *
 * 6 Grupos:
 *   1 — RECEITAS
 *   2 — CUSTOS / CMV
 *   3 — DESPESAS OPERACIONAIS
 *   4 — IMPOSTOS
 *   5 — RESULTADO FINANCEIRO
 *   6 — INVESTIMENTOS / CAPEX
 *   7 — PATRIMÔNIO (contas de balanço para Ledger dupla-entrada)
 *
 * Códigos referenciados pelo código da aplicação (NÃO ALTERAR):
 *   1.1      Receita Operacional   (vendas, contas-receber default)
 *   2.1.1    Compra de Mercadorias (estoque/entradas)
 *   2.1.2    Frete na Compra       (estoque/entradas)
 *   3.4.1    Comissão Vendedores   (vendas)
 *   3.4.3    Taxas de Cartão       (vendas)
 *   3.4.6    Descontos Concedidos  (vendas)
 *   4.1      DAS                   (impostos)
 *   5.5      Empréstimos Bancários
 *   5.99     Ajuste de Caixa       (caixas/movimentações)
 *   7.1      Caixa / Bancos        (ledger: ativo circulante)
 *   7.2      Estoque               (ledger: ativo circulante)
 *   7.3      Contas a Receber      (ledger: ativo circulante)
 *   7.4      Contas a Pagar        (ledger: passivo circulante)
 */

import { prisma as defaultPrisma } from '@/lib/db';
import type { PrismaClient } from '@prisma/client';

type PrismaLike = PrismaClient | typeof defaultPrisma;

export interface AccountPlanSeedNode {
  code: string;
  name: string;
  type: 'receita' | 'custo' | 'despesa' | 'imposto' | 'financeiro' | 'investimento' | 'balanco';
  dreGroup: string | null;
  showInDre: boolean;
  sortOrder: number;
  isSystem: boolean;
  parentCode: string | null;
}

/**
 * Plano de contas gerencial completo para varejo de moda.
 * Cada entrada referencia o pai por `parentCode` (resolvido na inserção).
 */
export const DEFAULT_ACCOUNT_PLAN_MODA: AccountPlanSeedNode[] = [
  // ════════════════════════════════════════════════════════════
  // 1. RECEITAS
  // ════════════════════════════════════════════════════════════
  { code: '1',     name: 'RECEITAS',                        type: 'receita', dreGroup: null,                    showInDre: false, sortOrder: 100,  isSystem: true,  parentCode: null },

  // 1.1 Receita Operacional
  { code: '1.1',   name: 'Receita Operacional',              type: 'receita', dreGroup: 'Receita Bruta',         showInDre: true,  sortOrder: 110,  isSystem: true,  parentCode: '1' },
  { code: '1.1.1', name: 'Venda Loja Física',               type: 'receita', dreGroup: 'Receita Bruta',         showInDre: true,  sortOrder: 111,  isSystem: false, parentCode: '1.1' },
  { code: '1.1.2', name: 'Venda Online',                     type: 'receita', dreGroup: 'Receita Bruta',         showInDre: true,  sortOrder: 112,  isSystem: false, parentCode: '1.1' },
  { code: '1.1.3', name: 'Venda WhatsApp',                   type: 'receita', dreGroup: 'Receita Bruta',         showInDre: true,  sortOrder: 113,  isSystem: false, parentCode: '1.1' },
  { code: '1.1.4', name: 'Venda Marketplace',                type: 'receita', dreGroup: 'Receita Bruta',         showInDre: true,  sortOrder: 114,  isSystem: false, parentCode: '1.1' },

  // 1.2 Outras Receitas Operacionais
  { code: '1.2',   name: 'Outras Receitas Operacionais',     type: 'receita', dreGroup: 'Outras Receitas',       showInDre: true,  sortOrder: 120,  isSystem: false, parentCode: '1' },
  { code: '1.2.1', name: 'Frete Cobrado do Cliente',         type: 'receita', dreGroup: 'Outras Receitas',       showInDre: true,  sortOrder: 121,  isSystem: false, parentCode: '1.2' },
  { code: '1.2.2', name: 'Acréscimos',                      type: 'receita', dreGroup: 'Outras Receitas',       showInDre: true,  sortOrder: 122,  isSystem: false, parentCode: '1.2' },
  { code: '1.2.3', name: 'Multas Recebidas',                 type: 'receita', dreGroup: 'Outras Receitas',       showInDre: true,  sortOrder: 123,  isSystem: false, parentCode: '1.2' },
  { code: '1.2.4', name: 'Bonificações Recebidas',          type: 'receita', dreGroup: 'Outras Receitas',       showInDre: true,  sortOrder: 124,  isSystem: false, parentCode: '1.2' },

  // 1.3 Receita Financeira
  { code: '1.3',   name: 'Receita Financeira',               type: 'receita', dreGroup: 'Receita Financeira',    showInDre: true,  sortOrder: 130,  isSystem: false, parentCode: '1' },
  { code: '1.3.1', name: 'Juros Recebidos',                  type: 'receita', dreGroup: 'Receita Financeira',    showInDre: true,  sortOrder: 131,  isSystem: false, parentCode: '1.3' },
  { code: '1.3.2', name: 'Rendimentos de Aplicações',        type: 'receita', dreGroup: 'Receita Financeira',    showInDre: true,  sortOrder: 132,  isSystem: false, parentCode: '1.3' },
  { code: '1.3.3', name: 'Outras Receitas Financeiras',      type: 'receita', dreGroup: 'Receita Financeira',    showInDre: true,  sortOrder: 133,  isSystem: false, parentCode: '1.3' },

  // 1.4 Receita Não Operacional
  { code: '1.4',   name: 'Receita Não Operacional',         type: 'receita', dreGroup: 'Outras Receitas',       showInDre: true,  sortOrder: 140,  isSystem: false, parentCode: '1' },
  { code: '1.4.1', name: 'Venda de Ativos Imobilizados',     type: 'receita', dreGroup: 'Outras Receitas',       showInDre: true,  sortOrder: 141,  isSystem: false, parentCode: '1.4' },

  // ════════════════════════════════════════════════════════════
  // 2. CUSTOS / CMV
  // ════════════════════════════════════════════════════════════
  { code: '2',     name: 'CUSTOS / CMV',                     type: 'custo',   dreGroup: null,                    showInDre: false, sortOrder: 200,  isSystem: true,  parentCode: null },

  // 2.1 Mercadorias
  { code: '2.1',   name: 'Mercadorias',                      type: 'custo',   dreGroup: 'CMV',                   showInDre: true,  sortOrder: 210,  isSystem: true,  parentCode: '2' },
  { code: '2.1.1', name: 'Compra de Mercadorias',            type: 'custo',   dreGroup: 'CMV',                   showInDre: true,  sortOrder: 211,  isSystem: true,  parentCode: '2.1' },
  { code: '2.1.2', name: 'Frete na Compra de Mercadorias',   type: 'custo',   dreGroup: 'CMV',                   showInDre: true,  sortOrder: 212,  isSystem: false, parentCode: '2.1' },
  { code: '2.1.3', name: 'Embalagens',                       type: 'custo',   dreGroup: 'CMV',                   showInDre: true,  sortOrder: 213,  isSystem: false, parentCode: '2.1' },
  { code: '2.1.4', name: 'Etiquetas',                        type: 'custo',   dreGroup: 'CMV',                   showInDre: true,  sortOrder: 214,  isSystem: false, parentCode: '2.1' },
  { code: '2.1.5', name: 'Sacolas',                          type: 'custo',   dreGroup: 'CMV',                   showInDre: true,  sortOrder: 215,  isSystem: false, parentCode: '2.1' },

  // 2.2 Ajustes de Estoque
  { code: '2.2',   name: 'Ajustes de Estoque',               type: 'custo',   dreGroup: 'CMV',                   showInDre: true,  sortOrder: 220,  isSystem: false, parentCode: '2' },
  { code: '2.2.1', name: 'Perdas de Estoque',                type: 'custo',   dreGroup: 'CMV',                   showInDre: true,  sortOrder: 221,  isSystem: false, parentCode: '2.2' },
  { code: '2.2.2', name: 'Produtos Avariados',               type: 'custo',   dreGroup: 'CMV',                   showInDre: true,  sortOrder: 222,  isSystem: false, parentCode: '2.2' },
  { code: '2.2.3', name: 'Quebra de Inventário',            type: 'custo',   dreGroup: 'CMV',                   showInDre: true,  sortOrder: 223,  isSystem: false, parentCode: '2.2' },
  { code: '2.2.4', name: 'Devoluções de Venda',             type: 'custo',   dreGroup: 'CMV',                   showInDre: true,  sortOrder: 224,  isSystem: false, parentCode: '2.2' },

  // ════════════════════════════════════════════════════════════
  // 3. DESPESAS OPERACIONAIS
  // ════════════════════════════════════════════════════════════
  { code: '3',     name: 'DESPESAS OPERACIONAIS',            type: 'despesa', dreGroup: null,                    showInDre: false, sortOrder: 300,  isSystem: true,  parentCode: null },

  // 3.1 Despesas Administrativas
  { code: '3.1',   name: 'Despesas Administrativas',         type: 'despesa', dreGroup: 'Despesas Administrativas', showInDre: true, sortOrder: 310, isSystem: false, parentCode: '3' },
  { code: '3.1.1', name: 'Pró-labore',                      type: 'despesa', dreGroup: 'Despesas Administrativas', showInDre: true, sortOrder: 311, isSystem: false, parentCode: '3.1' },
  { code: '3.1.2', name: 'Salários',                        type: 'despesa', dreGroup: 'Despesas Administrativas', showInDre: true, sortOrder: 312, isSystem: false, parentCode: '3.1' },
  { code: '3.1.3', name: 'INSS',                             type: 'despesa', dreGroup: 'Despesas Administrativas', showInDre: true, sortOrder: 313, isSystem: false, parentCode: '3.1' },
  { code: '3.1.4', name: 'FGTS',                             type: 'despesa', dreGroup: 'Despesas Administrativas', showInDre: true, sortOrder: 314, isSystem: false, parentCode: '3.1' },
  { code: '3.1.5', name: 'Vale Transporte',                  type: 'despesa', dreGroup: 'Despesas Administrativas', showInDre: true, sortOrder: 315, isSystem: false, parentCode: '3.1' },
  { code: '3.1.6', name: 'Vale Alimentação',                type: 'despesa', dreGroup: 'Despesas Administrativas', showInDre: true, sortOrder: 316, isSystem: false, parentCode: '3.1' },
  { code: '3.1.7', name: 'Contabilidade',                    type: 'despesa', dreGroup: 'Despesas Administrativas', showInDre: true, sortOrder: 317, isSystem: false, parentCode: '3.1' },
  { code: '3.1.8', name: 'Serviços de Terceiros',           type: 'despesa', dreGroup: 'Despesas Administrativas', showInDre: true, sortOrder: 318, isSystem: false, parentCode: '3.1' },
  { code: '3.1.9', name: 'Sistemas e Softwares',             type: 'despesa', dreGroup: 'Despesas Administrativas', showInDre: true, sortOrder: 319, isSystem: false, parentCode: '3.1' },
  { code: '3.1.10',name: 'Material de Escritório',           type: 'despesa', dreGroup: 'Despesas Administrativas', showInDre: true, sortOrder: 320, isSystem: false, parentCode: '3.1' },

  // 3.2 Estrutura da Loja
  { code: '3.2',   name: 'Estrutura da Loja',                type: 'despesa', dreGroup: 'Despesas Operacionais', showInDre: true,  sortOrder: 330,  isSystem: false, parentCode: '3' },
  { code: '3.2.1', name: 'Aluguel',                          type: 'despesa', dreGroup: 'Despesas Operacionais', showInDre: true,  sortOrder: 331,  isSystem: false, parentCode: '3.2' },
  { code: '3.2.2', name: 'Energia',                          type: 'despesa', dreGroup: 'Despesas Operacionais', showInDre: true,  sortOrder: 332,  isSystem: false, parentCode: '3.2' },
  { code: '3.2.3', name: 'Água',                            type: 'despesa', dreGroup: 'Despesas Operacionais', showInDre: true,  sortOrder: 333,  isSystem: false, parentCode: '3.2' },
  { code: '3.2.4', name: 'Internet',                         type: 'despesa', dreGroup: 'Despesas Operacionais', showInDre: true,  sortOrder: 334,  isSystem: false, parentCode: '3.2' },
  { code: '3.2.5', name: 'Telefone',                         type: 'despesa', dreGroup: 'Despesas Operacionais', showInDre: true,  sortOrder: 335,  isSystem: false, parentCode: '3.2' },
  { code: '3.2.6', name: 'Manutenção',                      type: 'despesa', dreGroup: 'Despesas Operacionais', showInDre: true,  sortOrder: 336,  isSystem: false, parentCode: '3.2' },
  { code: '3.2.7', name: 'Limpeza',                          type: 'despesa', dreGroup: 'Despesas Operacionais', showInDre: true,  sortOrder: 337,  isSystem: false, parentCode: '3.2' },
  { code: '3.2.8', name: 'Segurança',                       type: 'despesa', dreGroup: 'Despesas Operacionais', showInDre: true,  sortOrder: 338,  isSystem: false, parentCode: '3.2' },
  { code: '3.2.9', name: 'Seguros',                          type: 'despesa', dreGroup: 'Despesas Operacionais', showInDre: true,  sortOrder: 339,  isSystem: false, parentCode: '3.2' },

  // 3.3 Marketing
  { code: '3.3',   name: 'Marketing',                        type: 'despesa', dreGroup: 'Despesas Comerciais',   showInDre: true,  sortOrder: 350,  isSystem: false, parentCode: '3' },
  { code: '3.3.1', name: 'Meta Ads',                         type: 'despesa', dreGroup: 'Despesas Comerciais',   showInDre: true,  sortOrder: 351,  isSystem: false, parentCode: '3.3' },
  { code: '3.3.2', name: 'Google Ads',                       type: 'despesa', dreGroup: 'Despesas Comerciais',   showInDre: true,  sortOrder: 352,  isSystem: false, parentCode: '3.3' },
  { code: '3.3.3', name: 'TikTok Ads',                       type: 'despesa', dreGroup: 'Despesas Comerciais',   showInDre: true,  sortOrder: 353,  isSystem: false, parentCode: '3.3' },
  { code: '3.3.4', name: 'Influenciadores',                  type: 'despesa', dreGroup: 'Despesas Comerciais',   showInDre: true,  sortOrder: 354,  isSystem: false, parentCode: '3.3' },
  { code: '3.3.5', name: 'Designer',                         type: 'despesa', dreGroup: 'Despesas Comerciais',   showInDre: true,  sortOrder: 355,  isSystem: false, parentCode: '3.3' },
  { code: '3.3.6', name: 'Fotografia',                       type: 'despesa', dreGroup: 'Despesas Comerciais',   showInDre: true,  sortOrder: 356,  isSystem: false, parentCode: '3.3' },
  { code: '3.3.7', name: 'Produção de Conteúdo',             type: 'despesa', dreGroup: 'Despesas Comerciais',   showInDre: true,  sortOrder: 357,  isSystem: false, parentCode: '3.3' },

  // 3.4 Despesas Comerciais
  { code: '3.4',   name: 'Despesas Comerciais',              type: 'despesa', dreGroup: 'Despesas Comerciais',   showInDre: true,  sortOrder: 370,  isSystem: false, parentCode: '3' },
  { code: '3.4.1', name: 'Comissão de Vendedores',          type: 'despesa', dreGroup: 'Despesas Comerciais',   showInDre: true,  sortOrder: 371,  isSystem: true,  parentCode: '3.4' },
  { code: '3.4.2', name: 'Comissão Marketplace',            type: 'despesa', dreGroup: 'Despesas Comerciais',   showInDre: true,  sortOrder: 372,  isSystem: false, parentCode: '3.4' },
  { code: '3.4.3', name: 'Taxas de Cartão',                 type: 'despesa', dreGroup: 'Despesas Comerciais',   showInDre: true,  sortOrder: 373,  isSystem: true,  parentCode: '3.4' },
  { code: '3.4.4', name: 'Taxa PIX',                         type: 'despesa', dreGroup: 'Despesas Comerciais',   showInDre: true,  sortOrder: 374,  isSystem: false, parentCode: '3.4' },
  { code: '3.4.5', name: 'Taxa de Antecipação',             type: 'despesa', dreGroup: 'Despesas Comerciais',   showInDre: true,  sortOrder: 375,  isSystem: false, parentCode: '3.4' },
  { code: '3.4.6', name: 'Descontos Concedidos',             type: 'despesa', dreGroup: 'Despesas Comerciais',   showInDre: true,  sortOrder: 376,  isSystem: true,  parentCode: '3.4' },

  // 3.5 Logística
  { code: '3.5',   name: 'Logística',                       type: 'despesa', dreGroup: 'Despesas Comerciais',   showInDre: true,  sortOrder: 390,  isSystem: false, parentCode: '3' },
  { code: '3.5.1', name: 'Correios',                         type: 'despesa', dreGroup: 'Despesas Comerciais',   showInDre: true,  sortOrder: 391,  isSystem: false, parentCode: '3.5' },
  { code: '3.5.2', name: 'Transportadoras',                  type: 'despesa', dreGroup: 'Despesas Comerciais',   showInDre: true,  sortOrder: 392,  isSystem: false, parentCode: '3.5' },
  { code: '3.5.3', name: 'Motoboy',                          type: 'despesa', dreGroup: 'Despesas Comerciais',   showInDre: true,  sortOrder: 393,  isSystem: false, parentCode: '3.5' },
  { code: '3.5.4', name: 'Frete Entrega Cliente',            type: 'despesa', dreGroup: 'Despesas Comerciais',   showInDre: true,  sortOrder: 394,  isSystem: false, parentCode: '3.5' },

  // ════════════════════════════════════════════════════════════
  // 4. IMPOSTOS
  // ════════════════════════════════════════════════════════════
  { code: '4',     name: 'IMPOSTOS',                         type: 'imposto', dreGroup: null,                    showInDre: false, sortOrder: 400,  isSystem: true,  parentCode: null },
  { code: '4.1',   name: 'DAS',                              type: 'imposto', dreGroup: 'Impostos',              showInDre: true,  sortOrder: 410,  isSystem: true,  parentCode: '4' },
  { code: '4.2',   name: 'ICMS',                             type: 'imposto', dreGroup: 'Impostos',              showInDre: true,  sortOrder: 420,  isSystem: false, parentCode: '4' },
  { code: '4.3',   name: 'ISS',                              type: 'imposto', dreGroup: 'Impostos',              showInDre: true,  sortOrder: 430,  isSystem: false, parentCode: '4' },
  { code: '4.4',   name: 'PIS',                              type: 'imposto', dreGroup: 'Impostos',              showInDre: true,  sortOrder: 440,  isSystem: false, parentCode: '4' },
  { code: '4.5',   name: 'COFINS',                           type: 'imposto', dreGroup: 'Impostos',              showInDre: true,  sortOrder: 450,  isSystem: false, parentCode: '4' },
  { code: '4.6',   name: 'IRPJ',                             type: 'imposto', dreGroup: 'Impostos',              showInDre: true,  sortOrder: 460,  isSystem: false, parentCode: '4' },
  { code: '4.7',   name: 'CSLL',                             type: 'imposto', dreGroup: 'Impostos',              showInDre: true,  sortOrder: 470,  isSystem: false, parentCode: '4' },
  { code: '4.8',   name: 'Outros Impostos',                  type: 'imposto', dreGroup: 'Impostos',              showInDre: true,  sortOrder: 480,  isSystem: false, parentCode: '4' },

  // ════════════════════════════════════════════════════════════
  // 5. RESULTADO FINANCEIRO
  // ════════════════════════════════════════════════════════════
  { code: '5',     name: 'RESULTADO FINANCEIRO',             type: 'financeiro', dreGroup: null,                 showInDre: false, sortOrder: 500,  isSystem: true,  parentCode: null },
  { code: '5.1',   name: 'Tarifas Bancárias',               type: 'financeiro', dreGroup: 'Despesas Financeiras', showInDre: true, sortOrder: 510, isSystem: false, parentCode: '5' },
  { code: '5.2',   name: 'IOF',                              type: 'financeiro', dreGroup: 'Despesas Financeiras', showInDre: true, sortOrder: 520, isSystem: false, parentCode: '5' },
  { code: '5.3',   name: 'Juros Pagos',                      type: 'financeiro', dreGroup: 'Despesas Financeiras', showInDre: true, sortOrder: 530, isSystem: false, parentCode: '5' },
  { code: '5.4',   name: 'Multas Pagas',                     type: 'financeiro', dreGroup: 'Despesas Financeiras', showInDre: true, sortOrder: 540, isSystem: false, parentCode: '5' },
  { code: '5.5',   name: 'Empréstimos Bancários',           type: 'financeiro', dreGroup: 'Financeiro',          showInDre: false, sortOrder: 550, isSystem: true,  parentCode: '5' },
  { code: '5.6',   name: 'Outras Despesas Financeiras',      type: 'financeiro', dreGroup: 'Despesas Financeiras', showInDre: true, sortOrder: 560, isSystem: false, parentCode: '5' },
  { code: '5.99',  name: 'Ajuste de Caixa',                  type: 'financeiro', dreGroup: 'Financeiro',          showInDre: false, sortOrder: 599, isSystem: true,  parentCode: '5' },

  // ════════════════════════════════════════════════════════════
  // 6. INVESTIMENTOS / CAPEX
  // ════════════════════════════════════════════════════════════
  { code: '6',     name: 'INVESTIMENTOS / CAPEX',            type: 'investimento', dreGroup: null,               showInDre: false, sortOrder: 600, isSystem: true,  parentCode: null },
  { code: '6.1',   name: 'Equipamentos',                     type: 'investimento', dreGroup: 'Investimentos',    showInDre: false, sortOrder: 610, isSystem: false, parentCode: '6' },
  { code: '6.2',   name: 'Computadores',                     type: 'investimento', dreGroup: 'Investimentos',    showInDre: false, sortOrder: 620, isSystem: false, parentCode: '6' },
  { code: '6.3',   name: 'Impressoras',                      type: 'investimento', dreGroup: 'Investimentos',    showInDre: false, sortOrder: 630, isSystem: false, parentCode: '6' },
  { code: '6.4',   name: 'Móveis',                          type: 'investimento', dreGroup: 'Investimentos',    showInDre: false, sortOrder: 640, isSystem: false, parentCode: '6' },
  { code: '6.5',   name: 'Reforma',                          type: 'investimento', dreGroup: 'Investimentos',    showInDre: false, sortOrder: 650, isSystem: false, parentCode: '6' },
  { code: '6.6',   name: 'Máquinas',                        type: 'investimento', dreGroup: 'Investimentos',    showInDre: false, sortOrder: 660, isSystem: false, parentCode: '6' },
  { code: '6.7',   name: 'Sistemas Implantados',             type: 'investimento', dreGroup: 'Investimentos',    showInDre: false, sortOrder: 670, isSystem: false, parentCode: '6' },

  // ════════════════════════════════════════════════════════════
  // 7 — PATRIMÔNIO (contas de balanço para Ledger dupla-entrada)
  // ════════════════════════════════════════════════════════════
  { code: '7',     name: 'PATRIMÔNIO',                       type: 'balanco',     dreGroup: null,               showInDre: false, sortOrder: 700, isSystem: true,  parentCode: null },

  // 7.1 Ativo Circulante — Caixa / Bancos
  { code: '7.1',   name: 'Caixa / Bancos',                   type: 'balanco',     dreGroup: null,               showInDre: false, sortOrder: 710, isSystem: true,  parentCode: '7' },

  // 7.2 Ativo Circulante — Estoque
  { code: '7.2',   name: 'Estoque de Mercadorias',            type: 'balanco',     dreGroup: null,               showInDre: false, sortOrder: 720, isSystem: true,  parentCode: '7' },

  // 7.3 Ativo Circulante — Contas a Receber
  { code: '7.3',   name: 'Contas a Receber',                  type: 'balanco',     dreGroup: null,               showInDre: false, sortOrder: 730, isSystem: true,  parentCode: '7' },

  // 7.4 Passivo Circulante — Contas a Pagar
  { code: '7.4',   name: 'Contas a Pagar',                    type: 'balanco',     dreGroup: null,               showInDre: false, sortOrder: 740, isSystem: true,  parentCode: '7' },
];

/**
 * Cria/atualiza o plano de contas padrão para a empresa de forma idempotente.
 *
 * Comportamento:
 *   - Se o código já existir para a empresa, atualiza apenas parentId, sortOrder, dreGroup e showInDre
 *     (mas NÃO renomeia para não sobrescrever customizações do usuário).
 *   - Se não existir, cria do zero.
 *
 * Retorna estatísticas: { created, updated, total }.
 */
export async function seedAccountPlanForCompany(
  companyId: string,
  prismaClient?: PrismaLike,
): Promise<{ created: number; updated: number; total: number }> {
  const prisma = prismaClient || defaultPrisma;

  // 1) Carregar tudo já existente da empresa em um map por code
  const existing = await prisma.accountPlan.findMany({
    where: { companyId },
    select: { id: true, code: true, isSystem: true },
  });
  const byCode = new Map<string, { id: string; isSystem: boolean }>();
  for (const e of existing) {
    if (e.code) byCode.set(e.code, { id: e.id, isSystem: e.isSystem });
  }

  // 2) Garantir ordem: criar/atualizar PAIS antes dos FILHOS (sort by code length asc)
  const sorted = [...DEFAULT_ACCOUNT_PLAN_MODA].sort(
    (a, b) => a.code.length - b.code.length || a.code.localeCompare(b.code),
  );

  let created = 0;
  let updated = 0;

  for (const node of sorted) {
    let parentId: string | null = null;
    if (node.parentCode) {
      const parent = byCode.get(node.parentCode);
      if (parent) parentId = parent.id;
    }

    const ex = byCode.get(node.code);
    if (ex) {
      // Atualiza estrutura sem sobrescrever o nome (o usuário pode ter renomeado)
      await prisma.accountPlan.update({
        where: { id: ex.id },
        data: {
          parentId: parentId ?? undefined,
          sortOrder: node.sortOrder,
          dreGroup: node.dreGroup,
          showInDre: node.showInDre,
          type: node.type,
          // Marca como sistema se a definição padrão assim indica
          isSystem: node.isSystem || ex.isSystem,
        },
      });
      updated++;
    } else {
      const newOne = await prisma.accountPlan.create({
        data: {
          name: node.name,
          code: node.code,
          type: node.type,
          dreGroup: node.dreGroup,
          showInDre: node.showInDre,
          sortOrder: node.sortOrder,
          isSystem: node.isSystem,
          parentId,
          companyId,
        },
      });
      byCode.set(node.code, { id: newOne.id, isSystem: node.isSystem });
      created++;
    }
  }

  return { created, updated, total: sorted.length };
}

/**
 * Determina se o plano de contas da empresa precisa de seed inicial.
 * Considera "vazio" se possuir menos de 5 contas ativas.
 */
export async function isAccountPlanEmpty(
  companyId: string,
  prismaClient?: PrismaLike,
): Promise<boolean> {
  const prisma = prismaClient || defaultPrisma;
  const count = await prisma.accountPlan.count({ where: { companyId, isActive: true } });
  return count < 5;
}
