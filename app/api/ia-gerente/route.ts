export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { calculateDRE, calculateSalesMetrics, calculateStockMetrics, getCashBalance, getCashFlowProjection, getReceivables } from '@/lib/financial-engine';
import { consumeAiCredit } from '@/lib/ai-usage';

const LLM_BASE_URL = process.env.LLM_API_BASE_URL || 'https://api.openai.com';
const LLM_API_KEY = process.env.LLM_API_KEY || '';
const LLM_MODEL = process.env.LLM_MODEL || 'gpt-4o-mini';

// Define available tools for the AI
const AI_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'query_sales',
      description: 'Consulta dados de vendas. Pode filtrar por período e agrupar. Para buscar um PRODUTO específico pelo nome use o parâmetro produto; para um CLIENTE específico pelo nome use o parâmetro cliente.',
      parameters: {
        type: 'object',
        properties: {
          period: { type: 'string', enum: ['hoje', 'semana', 'mes', 'trimestre', 'ano', 'tudo'], description: 'Período de análise' },
          groupBy: { type: 'string', enum: ['dia', 'produto', 'vendedor', 'cliente', 'pagamento'], description: 'Agrupar resultados por' },
          produto: { type: 'string', description: 'Nome (ou parte do nome) de um produto específico para filtrar as vendas desse produto.' },
          cliente: { type: 'string', description: 'Nome (ou parte do nome) de um cliente específico para filtrar as compras desse cliente.' },
          limit: { type: 'number', description: 'Limite de resultados' },
        },
        required: ['period'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_stock',
      description: 'Consulta dados de estoque. Pode listar produtos com estoque baixo, zerado, parados, ou buscar um produto específico pelo nome usando o parâmetro produto.',
      parameters: {
        type: 'object',
        properties: {
          filter: { type: 'string', enum: ['baixo', 'zerado', 'todos', 'mais_vendidos', 'parados'], description: 'Tipo de filtro' },
          produto: { type: 'string', description: 'Nome (ou parte do nome) de um produto específico para consultar o estoque dele.' },
          limit: { type: 'number', description: 'Limite de resultados' },
        },
        required: ['filter'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_customers',
      description: 'Consulta dados de clientes. Pode buscar inativos, top compradores, curva ABC.',
      parameters: {
        type: 'object',
        properties: {
          filter: { type: 'string', enum: ['inativos', 'top_compradores', 'abc_curve', 'recentes', 'todos'], description: 'Tipo de consulta' },
          limit: { type: 'number', description: 'Limite de resultados' },
        },
        required: ['filter'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_financial',
      description: 'Consulta dados financeiros: saldo, entradas, saídas, contas a pagar/receber, fluxo de caixa, saldo por caixa/conta, taxas de cartão, formas de pagamento mais usadas, previsão de recebimentos futuros.',
      parameters: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['resumo', 'entradas', 'saidas', 'contas_pagar', 'contas_receber', 'fluxo_caixa', 'caixas', 'taxas_cartao', 'recebimentos_futuros', 'formas_pagamento_uso'], description: 'Tipo de consulta' },
          period: { type: 'string', enum: ['mes', 'trimestre', 'ano', 'tudo'], description: 'Período' },
        },
        required: ['type'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_sellers',
      description: 'Consulta ranking e desempenho de vendedores.',
      parameters: {
        type: 'object',
        properties: {
          period: { type: 'string', enum: ['mes', 'trimestre', 'ano', 'tudo'], description: 'Período de análise' },
        },
        required: ['period'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_price_tables',
      description: 'Consulta tabelas de preço por quantidade: quais existem, vendas que usaram tabelas, desconto médio, impacto na margem.',
      parameters: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['listar', 'uso_vendas', 'impacto_margem'], description: 'Tipo de consulta' },
          period: { type: 'string', enum: ['mes', 'trimestre', 'ano', 'tudo'], description: 'Período de análise (para uso em vendas)' },
        },
        required: ['type'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_account_plan',
      description: 'Consulta gastos/receitas por Plano de Contas: por grupo (1-Receitas, 2-Custos, 3-Despesas, 4-Impostos, 5-Financeiro, 6-Investimentos), por código específico (ex 3.3 Marketing, 3.4.3 Taxas Cartão, 3.1.1 Aluguel, 2.1 Mercadorias) ou top despesas. Sempre fornece também % do faturamento.',
      parameters: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['por_grupo', 'por_codigo', 'top_despesas', 'crescimento'], description: 'Tipo de consulta. por_grupo=soma por grupo 1-6; por_codigo=filtra por prefixo de código; top_despesas=maiores despesas; crescimento=despesas que mais cresceram vs período anterior' },
          codePrefix: { type: 'string', description: 'Prefixo do código do plano de contas (ex: 3.3 para Marketing, 3.4.3 para Taxas Cartão, 3.1.1 para Aluguel, 2.1 para Mercadorias). Use apenas quando type=por_codigo.' },
          period: { type: 'string', enum: ['mes', 'trimestre', 'ano', 'tudo'], description: 'Período de análise' },
        },
        required: ['type'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_dre',
      description: 'Retorna o DRE (Demonstração de Resultado) oficial da empresa — MESMA fonte de verdade do relatório DRE e do Razão Contábil. Use SEMPRE que o usuário perguntar sobre CMV, custo das mercadorias vendidas, lucro bruto, lucro líquido, margem bruta, margem líquida, resultado, receita líquida ou faturamento bruto. NUNCA calcule esses números por outra ferramenta.',
      parameters: {
        type: 'object',
        properties: {
          period: { type: 'string', enum: ['hoje', 'semana', 'mes', 'trimestre', 'ano', 'tudo'], description: 'Período de análise' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_percentual_faturamento',
      description: 'Calcula os principais KPIs como % do faturamento: CMV, Marketing, Aluguel, Taxas Cartão, Pessoal, Impostos, Comissões e Descontos. Inclui valor ideal (benchmark do mercado) e status (ok ou alerta).',
      parameters: {
        type: 'object',
        properties: {
          period: { type: 'string', enum: ['mes', 'trimestre', 'ano'], description: 'Período de análise' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_sem_classificacao',
      description: 'Verifica quantos lançamentos estão sem classificação de plano de contas (a pagar, a receber, financeiro). Importante para alertar o gestor sobre a saúde dos relatórios.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'save_memory',
      description: 'Salva uma memória operacional importante (meta, decisão, preferência, padrão identificado, informação estratégica).',
      parameters: {
        type: 'object',
        properties: {
          content: { type: 'string', description: 'Conteúdo da memória' },
          category: { type: 'string', enum: ['sales', 'stock', 'financial', 'crm', 'commercial', 'general'], description: 'Categoria' },
          type: { type: 'string', enum: ['decision', 'preference', 'pattern', 'goal', 'long'], description: 'Tipo de memória' },
          importance: { type: 'number', description: 'Importância de 1-10' },
        },
        required: ['content', 'category'],
      },
    },
  },
];

function getDateRange(period: string) {
  const now = new Date();
  let start: Date;
  switch (period) {
    case 'hoje': start = new Date(now.getFullYear(), now.getMonth(), now.getDate()); break;
    case 'semana': start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); break;
    case 'mes': start = new Date(now.getFullYear(), now.getMonth(), 1); break;
    case 'trimestre': start = new Date(now.getFullYear(), now.getMonth() - 3, 1); break;
    case 'ano': start = new Date(now.getFullYear(), 0, 1); break;
    default: start = new Date(2020, 0, 1);
  }
  return { start, end: now };
}

const fmtBRL = (v: number) => `R$ ${(v ?? 0).toFixed(2).replace('.', ',')}`;

async function executeTool(name: string, args: any, companyId: string): Promise<string> {
  try {
    if (name === 'save_memory') {
      await prisma.iAMemory.create({
        data: {
          companyId,
          content: args.content,
          category: args.category ?? 'general',
          type: args.type ?? 'long',
          importance: args.importance ?? 5,
        },
      });
      return 'Memória salva com sucesso.';
    }

    if (name === 'query_dre') {
      const { start, end } = getDateRange(args.period ?? 'mes');
      const dre = await calculateDRE(companyId, { gte: start, lte: end });
      const labelPeriodo = args.period ?? 'mes';
      return [
        `DRE oficial (${labelPeriodo}) — mesma fonte do relatório DRE e do Razão Contábil:`,
        ``,
        `- Faturamento bruto: ${fmtBRL(dre.faturamentoBruto)}`,
        `- (-) Descontos: ${fmtBRL(dre.descontos)}`,
        `- (-) Devoluções: ${fmtBRL(dre.devolucoes)}`,
        `- (=) Receita líquida: ${fmtBRL(dre.receitaLiquida)}`,
        `- (-) CMV (custo das mercadorias vendidas): ${fmtBRL(dre.cmv)}`,
        `- (=) Lucro bruto: ${fmtBRL(dre.margemBruta)} (margem bruta ${dre.margemBrutaPct.toFixed(1)}%)`,
        `- (-) Despesas operacionais: ${fmtBRL(dre.despesasOperacionais)}`,
        `- (-) Despesas financeiras: ${fmtBRL(dre.despesasFinanceiras)}`,
        `- (-) Taxas de cartão: ${fmtBRL(dre.taxasCartao)}`,
        `- (-) Impostos: ${fmtBRL(dre.impostos)}`,
        `- (=) Lucro líquido: ${fmtBRL(dre.lucroLiquido)} (margem líquida ${dre.margemLiquidaPct.toFixed(1)}%)`,
        ``,
        `Vendas no período: ${dre.totalVendas}.`,
        `IMPORTANTE: o CMV é o custo dos produtos efetivamente vendidos (avgCost × quantidade). Não confunda com compras de mercadorias classificadas no Plano de Contas.`,
      ].join('\n');
    }

    if (name === 'query_sales') {
      const { start } = getDateRange(args.period);
      const limit = args.limit || 10;
      const where: any = { companyId, status: 'concluida', createdAt: { gte: start } };

      // Filtro por PRODUTO específico (nome)
      if (args.produto && String(args.produto).trim()) {
        const term = String(args.produto).trim();
        const items = await prisma.saleItem.findMany({
          where: { sale: where, product: { name: { contains: term, mode: 'insensitive' } } },
          select: { quantity: true, total: true, product: { select: { name: true } } },
        });
        if (items.length === 0) return `Nenhuma venda encontrada para o produto "${term}" no período (${args.period}). Verifique se o produto existe no catálogo.`;
        const totalQty = items.reduce((s, i) => s + (i.quantity ?? 0), 0);
        const totalRev = items.reduce((s, i) => s + (i.total ?? 0), 0);
        const nomes = Array.from(new Set(items.map(i => i.product?.name).filter(Boolean)));
        return `Vendas do produto "${term}" (${args.period}):\n- Produto(s): ${nomes.join(', ')}\n- Unidades vendidas: ${totalQty}\n- Faturamento: ${fmtBRL(totalRev)}\n- Itens de venda: ${items.length}`;
      }

      // Filtro por CLIENTE específico (nome)
      if (args.cliente && String(args.cliente).trim()) {
        const term = String(args.cliente).trim();
        const sales = await prisma.sale.findMany({
          where: { ...where, customer: { name: { contains: term, mode: 'insensitive' } } },
          select: { total: true, saleNumber: true, createdAt: true, customer: { select: { name: true } } },
          orderBy: { createdAt: 'desc' }, take: 50,
        });
        if (sales.length === 0) return `Nenhuma compra encontrada para o cliente "${term}" no período (${args.period}). Verifique se o cliente existe no cadastro.`;
        const totalRev = sales.reduce((s, v) => s + (v.total ?? 0), 0);
        const nomes = Array.from(new Set(sales.map(s => s.customer?.name).filter(Boolean)));
        const lines = sales.slice(0, 10).map(s => `- Venda #${s.saleNumber}: ${fmtBRL(s.total)} em ${new Date(s.createdAt).toLocaleDateString('pt-BR')}`);
        return `Compras do cliente "${term}" (${args.period}):\n- Cliente(s): ${nomes.join(', ')}\n- Total de compras: ${sales.length}\n- Valor total: ${fmtBRL(totalRev)}\n\n${lines.join('\n')}`;
      }

      if (args.groupBy === 'produto') {
        const grouped = await prisma.saleItem.groupBy({
          by: ['productId'],
          where: { sale: where },
          _sum: { quantity: true, total: true },
          orderBy: { _sum: { total: 'desc' } },
          take: limit,
        });
        const ids = grouped.map(g => g.productId);
        const products = ids.length > 0 ? await prisma.product.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }) : [];
        const lines = grouped.map((g, i) => {
          const pName = products.find(p => p.id === g.productId)?.name ?? 'Desconhecido';
          return `${i+1}. ${pName}: ${g._sum?.quantity ?? 0} un vendidas, faturamento ${fmtBRL(g._sum?.total ?? 0)}`;
        });
        return `Top ${limit} produtos vendidos (${args.period}):\n${lines.join('\n')}`;
      }
      if (args.groupBy === 'vendedor') {
        const grouped = await prisma.sale.groupBy({
          by: ['sellerId'], where, _sum: { total: true }, _count: true,
          orderBy: { _sum: { total: 'desc' } }, take: limit,
        });
        const ids = grouped.map(g => g.sellerId).filter(Boolean) as string[];
        const users = ids.length > 0 ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }) : [];
        const lines = grouped.map((g, i) => {
          const uName = users.find(u => u.id === g.sellerId)?.name ?? 'Desconhecido';
          return `${i+1}. ${uName}: ${g._count} vendas, total ${fmtBRL(g._sum?.total ?? 0)}`;
        });
        return `Ranking vendedores (${args.period}):\n${lines.join('\n')}`;
      }
      if (args.groupBy === 'cliente') {
        const grouped = await prisma.sale.groupBy({
          by: ['customerId'], where: { ...where, customerId: { not: null } },
          _sum: { total: true }, _count: true, orderBy: { _sum: { total: 'desc' } }, take: limit,
        });
        const ids = grouped.map(g => g.customerId).filter(Boolean) as string[];
        const custs = ids.length > 0 ? await prisma.customer.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }) : [];
        const lines = grouped.map((g, i) => {
          const cName = custs.find(c => c.id === g.customerId)?.name ?? 'Consumidor Final';
          return `${i+1}. ${cName}: ${g._count} compras, total ${fmtBRL(g._sum?.total ?? 0)}`;
        });
        return `Top clientes compradores (${args.period}):\n${lines.join('\n')}`;
      }
      if (args.groupBy === 'pagamento') {
        const grouped = await prisma.sale.groupBy({ by: ['paymentMethod'], where, _sum: { total: true }, _count: true, orderBy: { _sum: { total: 'desc' } } });
        const labels: Record<string, string> = { dinheiro: 'Dinheiro', pix: 'PIX', cartao_credito: 'Cartão Crédito', cartao_debito: 'Cartão Débito', boleto: 'Boleto' };
        const lines = grouped.map(g => `- ${labels[g.paymentMethod] ?? g.paymentMethod}: ${g._count} vendas (${fmtBRL(g._sum?.total ?? 0)})`);
        return `Vendas por forma de pagamento (${args.period}):\n${lines.join('\n')}`;
      }
      const agg = await prisma.sale.aggregate({ where, _sum: { total: true }, _count: true, _avg: { total: true } });
      const lastSales = await prisma.sale.findMany({ where, orderBy: { createdAt: 'desc' }, take: 5, include: { customer: { select: { name: true } }, seller: { select: { name: true } } } });
      const lines = lastSales.map(s => `- Venda #${s.saleNumber}: ${fmtBRL(s.total)} (${s.customer?.name ?? 'Consumidor'}) em ${new Date(s.createdAt).toLocaleDateString('pt-BR')}`);
      return `Resumo de vendas (${args.period}):\n- Total: ${agg._count} vendas\n- Faturamento: ${fmtBRL(agg._sum?.total ?? 0)}\n- Ticket médio: ${fmtBRL(agg._avg?.total ?? 0)}\n\nÚltimas vendas:\n${lines.join('\n')}`;
    }

    if (name === 'query_stock') {
      const limit = args.limit || 15;

      // Busca por PRODUTO específico (nome)
      if (args.produto && String(args.produto).trim()) {
        const term = String(args.produto).trim();
        const products = await prisma.product.findMany({
          where: { companyId, name: { contains: term, mode: 'insensitive' } },
          select: { name: true, sku: true, stockQuantity: true, minStock: true, salePrice: true, isActive: true },
          take: 10,
        });
        if (products.length === 0) return `Nenhum produto encontrado com o nome "${term}" no catálogo.`;
        const lines = products.map(p => `- ${p.name} (${p.sku ?? '-'}): ${p.stockQuantity} un em estoque (mín: ${p.minStock})${p.isActive ? '' : ' [INATIVO]'}`);
        return `Estoque do produto "${term}":\n${lines.join('\n')}`;
      }

      if (args.filter === 'baixo') {
        const products = await prisma.$queryRaw`SELECT name, sku, "stockQuantity", "minStock" FROM products WHERE "companyId" = ${companyId} AND "isActive" = true AND "stockQuantity" <= "minStock" AND "stockQuantity" > 0 ORDER BY "stockQuantity" ASC LIMIT ${limit}` as any[];
        const lines = products.map(p => `- ${p.name} (${p.sku ?? '-'}): ${p.stockQuantity} un (mín: ${p.minStock})`);
        return `Produtos com estoque baixo (${products.length}):\n${lines.join('\n') || 'Nenhum produto com estoque baixo.'}`;
      }
      if (args.filter === 'zerado') {
        const products = await prisma.product.findMany({ where: { companyId, isActive: true, stockQuantity: { lte: 0 } }, select: { name: true, sku: true }, take: limit });
        const lines = products.map(p => `- ${p.name} (${p.sku ?? '-'}): ZERADO`);
        return `Produtos com estoque zerado (${products.length}):\n${lines.join('\n') || 'Nenhum produto com estoque zerado.'}`;
      }
      if (args.filter === 'parados') {
        // FONTE OFICIAL: 60 dias, custo = avgCost || costPrice (calculateStockMetrics)
        const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
        const soldRecently = await prisma.saleItem.groupBy({ by: ['productId'], where: { sale: { companyId, createdAt: { gte: sixtyDaysAgo } } } });
        const soldIds = soldRecently.map(s => s.productId);
        const stagnant = await prisma.product.findMany({ where: { companyId, isActive: true, stockQuantity: { gt: 0 }, id: { notIn: soldIds } }, select: { name: true, sku: true, stockQuantity: true, avgCost: true, costPrice: true }, take: limit, orderBy: { stockQuantity: 'desc' } });
        const totalValue = stagnant.reduce((s, p) => s + p.stockQuantity * (p.avgCost || p.costPrice || 0), 0);
        const lines = stagnant.map(p => `- ${p.name}: ${p.stockQuantity} un (${fmtBRL(p.stockQuantity * (p.avgCost || p.costPrice || 0))} em custo parado)`);
        return `Produtos parados (sem venda em 60+ dias): ${stagnant.length} produtos\nCapital parado: ${fmtBRL(totalValue)}\n${lines.join('\n')}`;
      }
      const stats = await prisma.product.aggregate({ where: { companyId, isActive: true }, _sum: { stockQuantity: true }, _count: true });
      const totalValue = await prisma.$queryRaw`SELECT SUM("stockQuantity" * "salePrice") as total FROM products WHERE "companyId" = ${companyId} AND "isActive" = true` as any[];
      return `Resumo de estoque:\n- Total de produtos ativos: ${stats._count}\n- Total de peças em estoque: ${stats._sum?.stockQuantity ?? 0}\n- Valor total do estoque: ${fmtBRL(Number(totalValue?.[0]?.total ?? 0))}`;
    }

    if (name === 'query_customers') {
      const limit = args.limit || 15;
      if (args.filter === 'inativos') {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const inactive = await prisma.customer.findMany({
          where: { companyId, isActive: true, OR: [{ lastPurchase: { lt: thirtyDaysAgo } }, { lastPurchase: null }] },
          select: { name: true, lastPurchase: true, totalPurchased: true, avgTicket: true },
          orderBy: { totalPurchased: 'desc' }, take: limit,
        });
        const lines = inactive.map(c => {
          const days = c.lastPurchase ? Math.floor((Date.now() - new Date(c.lastPurchase).getTime()) / (1000*60*60*24)) : null;
          return `- ${c.name}: ${days !== null ? `${days} dias sem comprar` : 'nunca comprou'}, total ${fmtBRL(c.totalPurchased)}, ticket médio ${fmtBRL(c.avgTicket)}`;
        });
        return `Clientes inativos (${inactive.length}):\n${lines.join('\n')}`;
      }
      if (args.filter === 'top_compradores') {
        const top = await prisma.customer.findMany({ where: { companyId, isActive: true }, orderBy: { totalPurchased: 'desc' }, take: limit, select: { name: true, totalPurchased: true, purchaseCount: true, avgTicket: true, lastPurchase: true } });
        const lines = top.map((c, i) => `${i+1}. ${c.name}: ${fmtBRL(c.totalPurchased)} total, ${c.purchaseCount} compras, ticket ${fmtBRL(c.avgTicket)}`);
        return `Top ${limit} clientes:\n${lines.join('\n')}`;
      }
      if (args.filter === 'abc_curve') {
        const all = await prisma.customer.findMany({ where: { companyId, isActive: true, totalPurchased: { gt: 0 } }, orderBy: { totalPurchased: 'desc' }, select: { name: true, totalPurchased: true } });
        const totalRev = all.reduce((s, c) => s + c.totalPurchased, 0);
        let cum = 0;
        let countA = 0, countB = 0, countC = 0;
        for (const c of all) { cum += c.totalPurchased; const pct = totalRev > 0 ? (cum / totalRev) * 100 : 0; if (pct <= 80) countA++; else if (pct <= 95) countB++; else countC++; }
        return `Curva ABC de clientes:\n- Classe A (80% da receita): ${countA} clientes\n- Classe B (80-95%): ${countB} clientes\n- Classe C (95-100%): ${countC} clientes\n- Receita total: ${fmtBRL(totalRev)}\n\nTop 5 clientes (Classe A):\n${all.slice(0, 5).map((c, i) => `${i+1}. ${c.name}: ${fmtBRL(c.totalPurchased)}`).join('\n')}`;
      }
      const count = await prisma.customer.count({ where: { companyId, isActive: true } });
      const recent = await prisma.customer.findMany({ where: { companyId, isActive: true }, orderBy: { lastPurchase: 'desc' }, take: limit, select: { name: true, lastPurchase: true, totalPurchased: true, purchaseCount: true, type: true } });
      const lines = recent.map(c => `- ${c.name} (${c.type}): ${c.purchaseCount} compras, ${fmtBRL(c.totalPurchased)}, última ${c.lastPurchase ? new Date(c.lastPurchase).toLocaleDateString('pt-BR') : 'nunca'}`);
      return `Total de clientes ativos: ${count}\n\nÚltimos clientes ativos:\n${lines.join('\n')}`;
    }

    if (name === 'query_financial') {
      const { start } = getDateRange(args.period ?? 'mes');
      if (args.type === 'resumo') {
        const entradas = await prisma.financialRecord.aggregate({ where: { companyId, type: 'entrada', date: { gte: start } }, _sum: { amount: true } });
        const saidas = await prisma.financialRecord.aggregate({ where: { companyId, type: 'saida', date: { gte: start } }, _sum: { amount: true } });
        // FONTE OFICIAL: saldo de caixa = soma de CashAccount.currentBalance (financial-engine)
        const cashBalance = await getCashBalance(companyId);
        const saldo = cashBalance.saldo;
        return `Resumo financeiro (${args.period ?? 'mes'}):\n- Entradas no período: ${fmtBRL(entradas._sum?.amount ?? 0)}\n- Saídas no período: ${fmtBRL(saidas._sum?.amount ?? 0)}\n- Resultado período: ${fmtBRL((entradas._sum?.amount ?? 0) - (saidas._sum?.amount ?? 0))}\n- Saldo total em caixa: ${fmtBRL(saldo)}`;
      }
      if (args.type === 'contas_pagar') {
        const contas = await prisma.accountPayable.findMany({ where: { companyId, status: 'pendente' }, orderBy: { dueDate: 'asc' }, take: 15, include: { supplier: { select: { name: true } } } });
        const total = contas.reduce((s, c) => s + c.amount, 0);
        const vencidas = contas.filter(c => new Date(c.dueDate) < new Date());
        const lines = contas.map(c => `- ${c.description}: ${fmtBRL(c.amount)} vence ${new Date(c.dueDate).toLocaleDateString('pt-BR')}${c.supplier ? ` (${c.supplier.name})` : ''}${new Date(c.dueDate) < new Date() ? ' ⚠️ VENCIDA' : ''}`);
        return `Contas a pagar pendentes: ${contas.length}\nTotal: ${fmtBRL(total)}\nVencidas: ${vencidas.length}\n\n${lines.join('\n')}`;
      }
      if (args.type === 'contas_receber') {
        // FONTE OFICIAL: getReceivables() = AccountReceivable pendente + SalePayment não recebido
        const receivables = await getReceivables(companyId);
        const contas = await prisma.accountReceivable.findMany({ where: { companyId, status: 'pendente' }, orderBy: { dueDate: 'asc' }, take: 15 });
        const vencidas = contas.filter(c => new Date(c.dueDate) < new Date());
        const lines = contas.map(c => `- ${c.description}: ${fmtBRL(c.amount)} vence ${new Date(c.dueDate).toLocaleDateString('pt-BR')}${new Date(c.dueDate) < new Date() ? ' ⚠️ VENCIDA' : ''}`);
        return `Contas a receber (total oficial): ${fmtBRL(receivables.totalGeral)}\n- AccountReceivable pendente: ${fmtBRL(receivables.saldoAccountReceivablePendente)}\n- Pagamentos não recebidos: ${fmtBRL(receivables.saldoSalePaymentNaoRecebido)}\n- Vencidas: ${fmtBRL(receivables.vencidasAccountReceivable)}\n- Vencendo em 30 dias: ${fmtBRL(receivables.vencendoEm30Dias)}\n\nDetalhes AR pendentes (top ${contas.length}):\n${lines.join('\n')}`;
      }
      if (args.type === 'fluxo_caixa') {
        // FONTE OFICIAL: saldo de caixa e projeção via financial-engine (mesma fórmula do módulo Fluxo de Caixa)
        const cashBalance = await getCashBalance(companyId);
        const saldo = cashBalance.saldo;
        const projection = await getCashFlowProjection(companyId, 30);
        const cashLines = cashBalance.accounts.map(a => `  - ${a.name}: ${fmtBRL(a.balance)}`).join('\n');
        return `Fluxo de caixa:\n- Saldo total em caixa: ${fmtBRL(saldo)}\n${cashLines}\n- A receber (próx. 30 dias): ${fmtBRL(projection.totalRecebiveis)}\n- A pagar (próx. 30 dias): ${fmtBRL(projection.totalPagaveis)}\n- Saldo projetado (30 dias): ${fmtBRL(projection.saldoProjetado)}`;
      }
      if (args.type === 'caixas') {
        const cashAccounts = await prisma.cashAccount.findMany({ where: { companyId }, orderBy: { name: 'asc' } });
        const totalBalance = cashAccounts.reduce((s, a) => s + (a.isActive ? a.currentBalance : 0), 0);
        const lines = cashAccounts.map(a => `- ${a.name} (${a.type}): ${fmtBRL(a.currentBalance)} ${a.isActive ? '' : '[INATIVO]'}`);
        return `Caixas e contas:\nTotal ativo: ${fmtBRL(totalBalance)}\n\n${lines.join('\n')}`;
      }
      if (args.type === 'taxas_cartao') {
        const taxaRecords = await prisma.financialRecord.findMany({ where: { companyId, type: 'saida', description: { contains: 'Taxa', mode: 'insensitive' }, date: { gte: start } }, orderBy: { date: 'desc' }, take: 20 });
        const totalTaxas = taxaRecords.reduce((s, r) => s + r.amount, 0);
        const lines = taxaRecords.map(r => `- ${r.description}: ${fmtBRL(r.amount)} em ${new Date(r.date).toLocaleDateString('pt-BR')}`);
        return `Taxas de cartão (${args.period ?? 'mes'}): ${taxaRecords.length} cobranças\nTotal: ${fmtBRL(totalTaxas)}\n\n${lines.join('\n') || 'Nenhuma taxa registrada.'}`;
      }
      if (args.type === 'recebimentos_futuros') {
        const now = new Date();
        const future7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        const future30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        const pending = await prisma.salePayment.findMany({ where: { companyId, received: false, expectedDate: { gte: now } }, include: { paymentMethod: { select: { name: true } } }, orderBy: { expectedDate: 'asc' }, take: 20 });
        const next7 = pending.filter(p => new Date(p.expectedDate) <= future7);
        const next30 = pending.filter(p => new Date(p.expectedDate) <= future30);
        const total7 = next7.reduce((s, p) => s + p.netAmount, 0);
        const total30 = next30.reduce((s, p) => s + p.netAmount, 0);
        const lines = pending.slice(0, 15).map(p => `- ${p.paymentMethod?.name ?? 'Pagamento'}: Líq ${fmtBRL(p.netAmount)} em ${new Date(p.expectedDate).toLocaleDateString('pt-BR')}`);
        return `Recebimentos futuros:\n- Próx 7 dias: ${fmtBRL(total7)} (${next7.length} parcelas)\n- Próx 30 dias: ${fmtBRL(total30)} (${next30.length} parcelas)\n\n${lines.join('\n') || 'Nenhum recebimento pendente.'}`;
      }
      if (args.type === 'formas_pagamento_uso') {
        const payments = await prisma.salePayment.groupBy({ by: ['paymentMethodId'], where: { companyId, createdAt: { gte: start } }, _sum: { amount: true }, _count: true, orderBy: { _sum: { amount: 'desc' } } });
        const methods = await prisma.paymentMethod.findMany({ where: { companyId } });
        const lines = payments.map((p, i) => {
          const m = methods.find(mm => mm.id === p.paymentMethodId);
          return `${i+1}. ${m?.name ?? 'Desconhecido'}: ${p._count} vendas, ${fmtBRL(p._sum?.amount ?? 0)}`;
        });
        return `Formas de pagamento mais usadas (${args.period ?? 'mes'}):\n${lines.join('\n') || 'Nenhum dado disponível.'}`;
      }
      const records = await prisma.financialRecord.findMany({ where: { companyId, type: args.type === 'saidas' ? 'saida' : 'entrada', date: { gte: start } }, orderBy: { date: 'desc' }, take: 15, include: { category: { select: { name: true } } } });
      const total = records.reduce((s, r) => s + r.amount, 0);
      const lines = records.map(r => `- ${r.description}: ${fmtBRL(r.amount)} em ${new Date(r.date).toLocaleDateString('pt-BR')}${r.category ? ` [${r.category.name}]` : ''}`);
      return `${args.type === 'saidas' ? 'Saídas' : 'Entradas'} (${args.period ?? 'mes'}): ${records.length} registros, total ${fmtBRL(total)}\n${lines.join('\n')}`;
    }

    if (name === 'query_sellers') {
      const { start } = getDateRange(args.period);
      const salesByUser = await prisma.sale.groupBy({
        by: ['sellerId'],
        where: { companyId, status: 'concluida', createdAt: { gte: start } },
        _sum: { total: true }, _count: true, orderBy: { _sum: { total: 'desc' } },
      });
      const ids = salesByUser.map(s => s.sellerId).filter(Boolean) as string[];
      const users = ids.length > 0 ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }) : [];
      const sellers = await prisma.seller.findMany({ where: { companyId, isActive: true }, select: { name: true, userId: true, commissionRate: true } });
      const lines = salesByUser.map((s, i) => {
        const user = users.find(u => u.id === s.sellerId);
        const seller = sellers.find(sl => sl.userId === s.sellerId);
        const commission = seller ? ((s._sum?.total ?? 0) * seller.commissionRate / 100) : 0;
        return `${i+1}. ${user?.name ?? 'Desconhecido'}: ${s._count} vendas, ${fmtBRL(s._sum?.total ?? 0)}, comissão ${fmtBRL(commission)} (${seller?.commissionRate ?? 0}%)`;
      });
      return `Ranking de vendedores (${args.period}):\n${lines.join('\n') || 'Nenhuma venda no período.'}`;
    }

    if (name === 'query_price_tables') {
      if (args.type === 'listar') {
        const tables = await prisma.priceTable.findMany({
          where: { companyId, isActive: true },
          include: { product: { select: { name: true, salePrice: true } } },
          orderBy: [{ product: { name: 'asc' } }, { minQuantity: 'asc' }],
          take: 50,
        });
        if (tables.length === 0) return 'Nenhuma tabela de preço cadastrada.';
        const lines = tables.map(t => {
          const desc = ((1 - t.unitPrice / (t.product.salePrice || 1)) * 100).toFixed(1);
          return `• ${t.product.name} → "${t.name}": ≥${t.minQuantity} pç por ${fmtBRL(t.unitPrice)} (${desc}% desconto do preço base ${fmtBRL(t.product.salePrice)})`;
        });
        return `Tabelas de preço cadastradas (${tables.length}):\n${lines.join('\n')}`;
      }
      if (args.type === 'uso_vendas') {
        const { start } = getDateRange(args.period || 'mes');
        const itemsWithTable = await prisma.saleItem.findMany({
          where: { priceTableId: { not: null }, sale: { companyId, status: 'concluida', createdAt: { gte: start } } },
          select: { quantity: true, total: true, priceTableName: true, priceDiscount: true, product: { select: { name: true } } },
        });
        if (itemsWithTable.length === 0) return `Nenhuma venda usou tabela de preço no período (${args.period || 'mes'}).`;
        const totalItems = itemsWithTable.length;
        const totalRevenue = itemsWithTable.reduce((s, i) => s + i.total, 0);
        const totalDiscount = itemsWithTable.reduce((s, i) => s + ((i.priceDiscount ?? 0) * i.quantity), 0);
        const tableMap = new Map<string, number>();
        itemsWithTable.forEach(i => { const n = i.priceTableName || 'Desconhecida'; tableMap.set(n, (tableMap.get(n) || 0) + 1); });
        const tableUsage = Array.from(tableMap.entries()).sort((a, b) => b[1] - a[1]).map(([n, c]) => `  ${n}: ${c} usos`).join('\n');
        return `Uso de tabelas de preço (${args.period || 'mes'}):\n• ${totalItems} itens vendidos com tabela\n• Faturamento: ${fmtBRL(totalRevenue)}\n• Desconto total concedido: ${fmtBRL(totalDiscount)}\n\nPor tabela:\n${tableUsage}`;
      }
      if (args.type === 'impacto_margem') {
        const { start } = getDateRange(args.period || 'mes');
        const itemsWithTable = await prisma.saleItem.findMany({
          where: { priceTableId: { not: null }, sale: { companyId, status: 'concluida', createdAt: { gte: start } } },
          select: { quantity: true, unitPrice: true, total: true, originalPrice: true, appliedPrice: true, priceDiscount: true, product: { select: { name: true, costPrice: true, salePrice: true } } },
        });
        if (itemsWithTable.length === 0) return 'Nenhuma venda com tabela no período para calcular impacto.';
        let totalOriginal = 0, totalActual = 0, totalCost = 0;
        itemsWithTable.forEach(i => {
          const orig = (i.originalPrice ?? i.product.salePrice) * i.quantity;
          totalOriginal += orig;
          totalActual += i.total;
          totalCost += i.product.costPrice * i.quantity;
        });
        const marginWithTable = totalActual > 0 ? ((totalActual - totalCost) / totalActual * 100) : 0;
        const marginWithout = totalOriginal > 0 ? ((totalOriginal - totalCost) / totalOriginal * 100) : 0;
        return `Impacto de tabelas na margem (${args.period || 'mes'}):\n• Faturamento com tabela: ${fmtBRL(totalActual)}\n• Faturamento sem tabela: ${fmtBRL(totalOriginal)}\n• Diferença: ${fmtBRL(totalOriginal - totalActual)}\n• Margem com tabela: ${marginWithTable.toFixed(1)}%\n• Margem sem tabela: ${marginWithout.toFixed(1)}%\n• Impacto na margem: ${(marginWithTable - marginWithout).toFixed(1)} pontos percentuais`;
      }
    }

    if (name === 'query_account_plan' || name === 'query_percentual_faturamento' || name === 'query_sem_classificacao') {
      const period = args.period ?? 'mes';
      const now = new Date();
      let currentStart: Date, currentEnd: Date, prevStart: Date, prevEnd: Date;
      if (period === 'trimestre') {
        currentStart = new Date(now.getFullYear(), now.getMonth() - 2, 1);
        currentEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        prevStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);
        prevEnd = new Date(now.getFullYear(), now.getMonth() - 2, 0, 23, 59, 59, 999);
      } else if (period === 'ano') {
        currentStart = new Date(now.getFullYear(), 0, 1);
        currentEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
        prevStart = new Date(now.getFullYear() - 1, 0, 1);
        prevEnd = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
      } else if (period === 'tudo') {
        currentStart = new Date(2020, 0, 1);
        currentEnd = now;
        prevStart = new Date(2019, 0, 1);
        prevEnd = new Date(2019, 11, 31);
      } else {
        currentStart = new Date(now.getFullYear(), now.getMonth(), 1);
        currentEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        prevEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      }

      const allPlans = await prisma.accountPlan.findMany({
        where: { companyId, isActive: true },
        select: { id: true, code: true, name: true, type: true },
      });
      const planById = new Map(allPlans.map(p => [p.id, p]));

      async function fetchMov(start: Date, end: Date) {
        const [paid, recv, fr, sales] = await Promise.all([
          prisma.accountPayable.findMany({ where: { companyId, status: 'pago', paidDate: { gte: start, lte: end } }, select: { amount: true, accountPlanId: true } }),
          prisma.accountReceivable.findMany({ where: { companyId, status: 'recebido', receivedDate: { gte: start, lte: end } }, select: { amount: true, accountPlanId: true } }),
          prisma.financialRecord.findMany({ where: { companyId, date: { gte: start, lte: end } }, select: { amount: true, accountPlanId: true, type: true } }),
          prisma.sale.findMany({ where: { companyId, status: 'concluida', createdAt: { gte: start, lte: end } }, select: { total: true } }),
        ]);
        return { paid, recv, fr, sales };
      }

      const cur = await fetchMov(currentStart, currentEnd);
      const prev = name === 'query_account_plan' || name === 'query_percentual_faturamento' ? await fetchMov(prevStart, prevEnd) : null;

      const salesRev = cur.sales.reduce((s, v) => s + (v.total || 0), 0);

      // Sum por plano (apenas saidas grupos 2-6)
      const planSum = new Map<string, number>();
      const planSumPrev = new Map<string, number>();
      const addPlanMap = (map: Map<string, number>, planId: string | null | undefined, amt: number, includeRev = false) => {
        if (!planId) return;
        const p = planById.get(planId);
        const g = p?.code?.[0] || null;
        if (!g) return;
        if (!includeRev && g === '1') return;
        map.set(planId, (map.get(planId) || 0) + amt);
      };
      cur.paid.forEach(p => addPlanMap(planSum, p.accountPlanId, p.amount));
      cur.fr.forEach(f => { if (f.type === 'saída' || f.type === 'saida') addPlanMap(planSum, f.accountPlanId, f.amount); });
      if (prev) {
        prev.paid.forEach(p => addPlanMap(planSumPrev, p.accountPlanId, p.amount));
        prev.fr.forEach(f => { if (f.type === 'saída' || f.type === 'saida') addPlanMap(planSumPrev, f.accountPlanId, f.amount); });
      }

      const pct = (v: number) => salesRev > 0 ? ((v / salesRev) * 100).toFixed(1) + '%' : 'N/A';

      if (name === 'query_sem_classificacao') {
        const [ap, ar, fr] = await Promise.all([
          prisma.accountPayable.count({ where: { companyId, accountPlanId: null } }),
          prisma.accountReceivable.count({ where: { companyId, accountPlanId: null } }),
          prisma.financialRecord.count({ where: { companyId, accountPlanId: null } }),
        ]);
        const total = ap + ar + fr;
        if (total === 0) return 'Todos os lançamentos estão classificados! Excelente, isso garante relatórios precisos.';
        return `Lançamentos sem classificação:\n- Contas a pagar: ${ap}\n- Contas a receber: ${ar}\n- Lançamentos financeiros: ${fr}\n- Total: ${total}\n\nRecomendação: acesse "Sem Classificação" no menu para classificar em lote e melhorar a precisão dos relatórios.`;
      }

      if (name === 'query_percentual_faturamento') {
        function sumPrefix(prefix: string, includeRev = false): number {
          let total = 0;
          planSum.forEach((amount, planId) => {
            const p = planById.get(planId);
            if (p?.code?.startsWith(prefix)) total += amount;
          });
          if (includeRev && prefix.startsWith('1')) {
            cur.recv.forEach(r => { const p = r.accountPlanId ? planById.get(r.accountPlanId) : null; if (p?.code?.startsWith(prefix)) total += r.amount; });
            cur.fr.forEach(f => { if (f.type !== 'entrada') return; const p = f.accountPlanId ? planById.get(f.accountPlanId) : null; if (p?.code?.startsWith(prefix)) total += f.amount; });
          }
          return total;
        }
        // CMV: usar a MESMA fonte do DRE/Razão (custo dos produtos vendidos), não a soma de compras classificadas.
        const cmvMetrics = await calculateSalesMetrics(companyId, { gte: currentStart, lte: currentEnd });
        const cmv = cmvMetrics.cmv;
        const mkt = sumPrefix('3.3');
        const tax = sumPrefix('3.4.3');
        const alu = sumPrefix('3.1.1');
        const pes = sumPrefix('3.2');
        const imp = sumPrefix('4');
        const com = sumPrefix('3.4.1');
        const desc = sumPrefix('3.4.6');
        const lines = [
          `Faturamento (${period}): ${fmtBRL(salesRev)}`,
          ``,
          `📌 CMV (Mercadorias): ${fmtBRL(cmv)} = ${pct(cmv)} (ideal ≤50%)`,
          `📌 Pessoal: ${fmtBRL(pes)} = ${pct(pes)} (ideal ≤15%)`,
          `📌 Marketing: ${fmtBRL(mkt)} = ${pct(mkt)} (ideal ≤8%)`,
          `📌 Aluguel: ${fmtBRL(alu)} = ${pct(alu)} (ideal ≤7%)`,
          `📌 Taxas Cartão: ${fmtBRL(tax)} = ${pct(tax)} (ideal ≤3%)`,
          `📌 Comissões: ${fmtBRL(com)} = ${pct(com)} (ideal ≤5%)`,
          `📌 Descontos Concedidos: ${fmtBRL(desc)} = ${pct(desc)} (ideal ≤3%)`,
          `📌 Impostos: ${fmtBRL(imp)} = ${pct(imp)} (ideal ≤8%)`,
        ];
        return lines.join('\n');
      }

      // query_account_plan
      if (args.type === 'por_grupo') {
        const groupSum: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, '6': 0 };
        const groupLabels: Record<string, string> = { '1': 'Receitas', '2': 'Custos', '3': 'Despesas', '4': 'Impostos', '5': 'Financeiro', '6': 'Investimentos' };
        cur.paid.forEach(p => { const plan = p.accountPlanId ? planById.get(p.accountPlanId) : null; const g = plan?.code?.[0]; if (g && groupSum[g] !== undefined) groupSum[g] += p.amount; });
        cur.fr.forEach(f => { if (f.type !== 'saída' && f.type !== 'saida') return; const plan = f.accountPlanId ? planById.get(f.accountPlanId) : null; const g = plan?.code?.[0]; if (g && groupSum[g] !== undefined) groupSum[g] += f.amount; });
        const lines = Object.entries(groupSum).filter(([k]) => k !== '1').map(([k, v]) => `• Grupo ${k} - ${groupLabels[k]}: ${fmtBRL(v)} (${pct(v)} da receita)`);
        return `Gastos por grupo (${period}):\nFaturamento total: ${fmtBRL(salesRev)}\n\n${lines.join('\n')}`;
      }
      if (args.type === 'por_codigo') {
        const prefix = (args.codePrefix || '').trim();
        if (!prefix) return 'Forneça o codePrefix (ex: 3.3 para Marketing).';
        let total = 0;
        const itemBreakdown: { name: string; total: number; code: string }[] = [];
        const tmp = new Map<string, { name: string; total: number; code: string }>();
        planSum.forEach((amount, planId) => {
          const p = planById.get(planId);
          if (!p?.code?.startsWith(prefix)) return;
          total += amount;
          tmp.set(planId, { name: p.name, total: amount, code: p.code || '' });
        });
        tmp.forEach(v => itemBreakdown.push(v));
        itemBreakdown.sort((a, b) => b.total - a.total);
        const sample = planById.get([...planById.values()].find(p => p.code === prefix)?.id ?? '');
        const groupName = sample?.name || (prefix === '3.3' ? 'Marketing' : prefix === '3.4.3' ? 'Taxas Cartão' : prefix === '3.1.1' ? 'Aluguel' : prefix === '2.1' ? 'Mercadorias' : `Prefixo ${prefix}`);
        if (itemBreakdown.length === 0) return `Nenhum gasto encontrado em "${groupName}" (${prefix}) no período ${period}.`;
        const lines = itemBreakdown.slice(0, 10).map(i => `  - ${i.code} ${i.name}: ${fmtBRL(i.total)}`);
        return `Gastos em "${groupName}" (${prefix}) no período ${period}:\nTotal: ${fmtBRL(total)} (${pct(total)} do faturamento)\n\nDetalhamento:\n${lines.join('\n')}`;
      }
      if (args.type === 'top_despesas') {
        const arr = Array.from(planSum.entries()).map(([id, total]) => {
          const p = planById.get(id);
          return { name: p?.name || 'Sem nome', code: p?.code || '', total };
        }).sort((a, b) => b.total - a.total).slice(0, 10);
        if (arr.length === 0) return `Sem despesas registradas no período ${period}.`;
        const lines = arr.map((d, i) => `${i+1}. ${d.code} ${d.name}: ${fmtBRL(d.total)} (${pct(d.total)} da receita)`);
        return `Maiores despesas no período ${period}:\n${lines.join('\n')}`;
      }
      if (args.type === 'crescimento') {
        const arr = Array.from(planSum.entries()).map(([id, total]) => {
          const p = planById.get(id);
          const prevVal = planSumPrev.get(id) || 0;
          const diff = total - prevVal;
          const varPct = prevVal > 0 ? ((total - prevVal) / prevVal) * 100 : (total > 0 ? 100 : 0);
          return { name: p?.name || 'Sem nome', code: p?.code || '', total, prev: prevVal, diff, varPct };
        }).filter(d => d.diff > 0).sort((a, b) => b.diff - a.diff).slice(0, 8);
        if (arr.length === 0) return `Nenhuma despesa cresceu em comparação com período anterior.`;
        const lines = arr.map((d, i) => `${i+1}. ${d.code} ${d.name}: ${fmtBRL(d.prev)} → ${fmtBRL(d.total)} (+${fmtBRL(d.diff)}, ${d.varPct.toFixed(1)}%)`);
        return `Despesas que mais cresceram (período ${period}):\n${lines.join('\n')}`;
      }
      return 'Tipo não reconhecido para query_account_plan.';
    }

    return 'Função não encontrada.';
  } catch (error: any) {
    console.error(`Tool execution error [${name}]:`, error);
    return `Erro ao executar consulta: ${error?.message ?? 'erro desconhecido'}`;
  }
}

// Fetch relevant memories for context
async function getMemoryContext(companyId: string): Promise<string> {
  try {
    const memories = await prisma.iAMemory.findMany({
      where: {
        companyId,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: [{ importance: 'desc' }, { createdAt: 'desc' }],
      take: 15,
      select: { content: true, category: true, type: true, createdAt: true },
    });

    if (memories.length === 0) return '';

    const memoryLines = memories.map(m => {
      const dateStr = new Date(m.createdAt).toLocaleDateString('pt-BR');
      const typeLabel = { decision: 'Decisão', preference: 'Preferência', pattern: 'Padrão', goal: 'Meta', long: 'Informação' }[m.type] ?? 'Memória';
      return `[${typeLabel} - ${m.category} - ${dateStr}]: ${m.content}`;
    });

    return `\n\nMEMÓRIAS OPERACIONAIS (contexto salvo):\n${memoryLines.join('\n')}`;
  } catch {
    return '';
  }
}

// Get recent conversation summaries
async function getRecentConversationContext(companyId: string): Promise<string> {
  try {
    const recent = await prisma.iAConversation.findMany({
      where: { companyId },
      orderBy: { updatedAt: 'desc' },
      take: 3,
      select: { summary: true, updatedAt: true },
    });

    const summaries = recent.filter(r => r.summary).map(r => {
      const dateStr = new Date(r.updatedAt).toLocaleDateString('pt-BR');
      return `[${dateStr}]: ${r.summary}`;
    });

    if (summaries.length === 0) return '';
    return `\n\nCONVERSAS RECENTES (resumo):\n${summaries.join('\n')}`;
  } catch {
    return '';
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return new Response(JSON.stringify({ error: 'Não autorizado' }), { status: 401 });
    const companyId = session.user.companyId;
    if (!companyId) return new Response(JSON.stringify({ error: 'Empresa não encontrada' }), { status: 400 });

    // TAREFA 5 — quota de IA: verifica e consome 1 crédito antes de chamar o modelo.
    const quota = await consumeAiCredit(companyId);
    if (!quota.allowed) {
      return new Response(JSON.stringify({ error: quota.message, reason: quota.reason, quotaExceeded: true }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await request.json();
    const userMessage = body?.message ?? '';
    const history = body?.history ?? [];
    const conversationId = body?.conversationId ?? null;

    // Fetch memory context
    const [memoryContext, conversationContext] = await Promise.all([
      getMemoryContext(companyId),
      getRecentConversationContext(companyId),
    ]);

    const systemPrompt = `Você é a IA Gerente do PushSisten, uma assistente inteligente estratégica especializada em gestão de atacado e lojas de roupas.

Você tem acesso a ferramentas para consultar dados REAIS do banco de dados da empresa. USE-AS sempre que o usuário perguntar sobre vendas, estoque, clientes, financeiro, vendedores ou tabelas de preço. Não invente dados - sempre consulte.

O sistema possui Tabelas de Preço por Quantidade — tabelas que oferecem preços diferenciados baseados na quantidade comprada (ex: "Atacado 6 peças" = R$80/un). Use a ferramenta query_price_tables para consultar tabelas cadastradas, uso em vendas e impacto na margem.

O sistema usa Plano de Contas hierárquico com 6 grupos: 1-Receitas, 2-Custos (Mercadorias), 3-Despesas Operacionais (3.1 Estrutura, 3.2 Pessoal, 3.3 Marketing, 3.4 Vendas/Comissões, 3.5 Administrativas), 4-Impostos, 5-Financeiro, 6-Investimentos. Use a ferramenta query_account_plan para analisar gastos por grupo ou código específico (ex: 3.3 para Marketing, 3.4.3 para Taxas Cartão, 3.1.1 para Aluguel, 2.1 para Mercadorias). Para CMV, custo das mercadorias vendidas, lucro bruto, lucro líquido, margem bruta, margem líquida, resultado, receita líquida ou DRE, use SEMPRE a ferramenta query_dre — é a fonte oficial e bate exatamente com o relatório DRE e o Razão Contábil. NUNCA calcule CMV ou lucro por outra ferramenta. Use query_percentual_faturamento apenas para ver os indicadores como % do faturamento (Marketing, Aluguel, Pessoal etc. com benchmarks). Use query_sem_classificacao quando perguntar sobre lançamentos pendentes de classificação ou qualidade dos relatórios.

Benchmarks ideais como % do faturamento: CMV ≤50%, Pessoal ≤15%, Marketing ≤8%, Aluguel ≤7%, Comissões ≤5%, Taxas Cartão ≤3%, Descontos ≤3%, Impostos ≤8%. Alerte quando ultrapassarem esses limites e dê recomendações.

Você também tem MEMÓRIA OPERACIONAL. Quando identificar informações estratégicas importantes (metas, decisões, preferências do dono, padrões operacionais), use a ferramenta save_memory para salvá-las. Isso permite que você lembre de contextos anteriores.

Regras:
- Sempre responda em português brasileiro
- Seja objetivo, direto e estratégico
- Use os dados reais das consultas nas respostas
- Dê sugestões práticas e acionáveis
- Formate valores monetários como R$ X.XXX,XX
- Use emojis com moderação
- Se precisar de mais detalhes, faça múltiplas consultas
- Ao analisar dados, sempre dê insights estratégicos e recomendações
- Quando o usuário mencionar metas, decisões ou preferências, salve na memória
- Use o contexto das memórias para respostas mais personalizadas
- Faça referências a informações anteriores quando relevante${memoryContext}${conversationContext}`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...(history ?? []).slice(-10),
      { role: 'user', content: userMessage },
    ];

    // Multi-turn tool loop: resolve TODAS as chamadas de ferramenta antes de transmitir a resposta.
    // Cada iterção inclui `tools`, então o modelo nunca precisa "vazar" sintaxe de tool-call como texto.
    // A resposta final é transmitida SEM tools (o modelo já tem todos os dados), evitando qualquer leak.
    const workMessages: any[] = [...messages];
    const MAX_TOOL_ITERATIONS = 5;

    for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
      const toolResponse = await fetch(`${LLM_BASE_URL}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${LLM_API_KEY}` },
        body: JSON.stringify({ model: LLM_MODEL, messages: workMessages, tools: AI_TOOLS, tool_choice: 'auto', max_tokens: 2000 }),
      });

      if (!toolResponse.ok) {
        console.error('LLM tool-loop call error:', await toolResponse.text().catch(() => ''));
        return new Response(JSON.stringify({ error: 'Erro na API de IA' }), { status: 500 });
      }

      const toolData = await toolResponse.json();
      const choice = toolData?.choices?.[0];
      const msg = choice?.message;
      const toolCalls = msg?.tool_calls;

      if (toolCalls && toolCalls.length > 0) {
        // Anexa a mensagem do assistente (com as tool_calls) e executa cada ferramenta.
        workMessages.push(msg);
        for (const tc of toolCalls) {
          const fnName = tc.function?.name;
          let fnArgs = {};
          try { fnArgs = JSON.parse(tc.function?.arguments ?? '{}'); } catch { fnArgs = {}; }
          const result = await executeTool(fnName, fnArgs, companyId);
          workMessages.push({ tool_call_id: tc.id, role: 'tool', content: result });
        }
        continue; // volta ao loop para o modelo decidir o próximo passo
      }

      // Sem mais tool_calls: o modelo está pronto para a resposta final. Sai do loop.
      break;
    }

    // Resposta final transmitida SEM tools — todos os dados já estão em workMessages.
    const streamResponse = await fetch(`${LLM_BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${LLM_API_KEY}` },
      body: JSON.stringify({ model: LLM_MODEL, messages: workMessages, stream: true, max_tokens: 3000 }),
    });

    if (!streamResponse.ok) {
      console.error('LLM stream error:', await streamResponse.text().catch(() => ''));
      return new Response(JSON.stringify({ error: 'Erro na API de IA' }), { status: 500 });
    }

    // Save conversation asynchronously (don't block response)
    saveConversationAsync(companyId, session.user.id, conversationId, userMessage, history);

    return new Response(streamResponse.body, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' },
    });
  } catch (error: any) {
    console.error('IA Gerente error:', error);
    return new Response(JSON.stringify({ error: 'Erro interno' }), { status: 500 });
  }
}

// Fire-and-forget conversation saving
function saveConversationAsync(companyId: string, userId: string, conversationId: string | null, lastMessage: string, history: any[]) {
  (async () => {
    try {
      const allMessages = [...(history ?? []), { role: 'user', content: lastMessage }];
      const title = lastMessage.length > 60 ? lastMessage.substring(0, 57) + '...' : lastMessage;

      if (conversationId) {
        await prisma.iAConversation.update({
          where: { id: conversationId },
          data: { messages: JSON.stringify(allMessages) },
        }).catch(() => {});
      } else if (allMessages.length >= 2) {
        // Only save after 2+ messages to avoid polluting with single messages
        await prisma.iAConversation.create({
          data: {
            companyId,
            userId,
            title,
            messages: JSON.stringify(allMessages),
          },
        }).catch(() => {});
      }
    } catch {}
  })();
}
