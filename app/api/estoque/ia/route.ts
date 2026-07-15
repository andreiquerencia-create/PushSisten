export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { INSIGHT_THRESHOLDS } from '@/lib/insights-engine';
import { consumeAiCredit } from '@/lib/ai-usage';

const LLM_BASE = process.env.LLM_API_BASE_URL || 'https://api.openai.com';
const LLM_KEY = process.env.LLM_API_KEY || '';
const LLM_MODEL = process.env.LLM_MODEL || 'gpt-4o-mini';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const companyId = session.user.companyId;

    // Plan governance: validate and consume AI quota (conversational AI)
    const quota = await consumeAiCredit(companyId);
    if (!quota.allowed) {
      return NextResponse.json(
        { error: quota.message, reason: quota.reason, quotaExceeded: true },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { message, history } = body;

    if (!message) return NextResponse.json({ error: 'Mensagem vazia' }, { status: 400 });

    // Build comprehensive stock context
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
    const stalledDays = INSIGHT_THRESHOLDS.ESTOQUE_PARADO_DIAS;

    const products = await prisma.product.findMany({
      where: { companyId, isActive: true },
      select: {
        id: true, name: true, sku: true, costPrice: true, salePrice: true,
        stockQuantity: true, minStock: true,
        avgCost: true, lastCost: true, replacementCost: true, supplierId: true,
        category: { select: { name: true } },
        supplier: { select: { name: true } },
        variations: { where: { isActive: true }, select: { color: true, size: true, grade: true, stockQuantity: true, costPrice: true, salePrice: true } },
        saleItems: {
          where: { sale: { status: 'concluida' } },
          select: { quantity: true, total: true, unitPrice: true, sale: { select: { createdAt: true } }, variation: { select: { color: true, size: true } } },
        },
      },
    });

    // Build summary data
    const productSummaries: string[] = [];
    let totalStock = 0, totalValue = 0, totalCost = 0;
    const catSummary = new Map<string, { stock: number; sold30: number; revenue30: number }>;
    const colorSummary = new Map<string, { sold30: number; revenue30: number }>;
    const sizeSummary = new Map<string, { sold30: number; revenue30: number }>;
    const stalledProducts: string[] = [];
    const ruptureRisk: string[] = [];

    for (const p of products) {
      const stock = p.stockQuantity;
      totalStock += stock;
      totalValue += stock * p.salePrice;
      const effectiveCost = p.avgCost || p.costPrice || 0;
      totalCost += stock * effectiveCost;

      const completedItems = p.saleItems;
      const last30 = completedItems.filter(i => new Date(i.sale.createdAt) >= thirtyDaysAgo);
      const qtySold30 = last30.reduce((s, i) => s + i.quantity, 0);
      const rev30 = last30.reduce((s, i) => s + i.total, 0);
      const dailyRate = qtySold30 / 30;
      const coverage = dailyRate > 0 ? Math.round(stock / dailyRate) : stock > 0 ? 999 : 0;
      const grossMargin = p.salePrice > 0 ? ((p.salePrice - effectiveCost) / p.salePrice * 100).toFixed(1) : '0';
      const margin = grossMargin;

      // Last sale
      const saleDates = completedItems.map(i => new Date(i.sale.createdAt).getTime());
      const lastSale = saleDates.length > 0 ? Math.max(...saleDates) : 0;
      const daysSinceSale = lastSale ? Math.floor((now.getTime() - lastSale) / 86400000) : 999;

      // Category
      const cat = p.category?.name ?? 'Sem Categoria';
      if (!catSummary.has(cat)) catSummary.set(cat, { stock: 0, sold30: 0, revenue30: 0 });
      const cs = catSummary.get(cat)!;
      cs.stock += stock; cs.sold30 += qtySold30; cs.revenue30 += rev30;

      // Colors/sizes from recent sales
      for (const si of last30) {
        const c = si.variation?.color ?? 'N/A';
        const sz = si.variation?.size ?? 'N/A';
        if (!colorSummary.has(c)) colorSummary.set(c, { sold30: 0, revenue30: 0 });
        if (!sizeSummary.has(sz)) sizeSummary.set(sz, { sold30: 0, revenue30: 0 });
        const cr = colorSummary.get(c)!; cr.sold30 += si.quantity; cr.revenue30 += si.total;
        const sr = sizeSummary.get(sz)!; sr.sold30 += si.quantity; sr.revenue30 += si.total;
      }

      if (daysSinceSale >= stalledDays && stock > 0) stalledProducts.push(`${p.name}: ${stock}un parado há ${daysSinceSale >= 999 ? 'nunca vendido' : daysSinceSale + ' dias'}, custo parado R$${(stock * effectiveCost).toFixed(2)}`);
      if (stock <= p.minStock && stock > 0 && dailyRate > 0) ruptureRisk.push(`${p.name}: ${stock}un, vende ${dailyRate.toFixed(1)}/dia, dura ${coverage} dias`);

      // Profit from 30d sales
      const profit30 = rev30 - (qtySold30 * effectiveCost);
      const supplierName = p.supplier?.name ?? 'N/A';

      // Per-product summary for top items
      if (stock > 0 || qtySold30 > 0) {
        const varInfo = p.variations.length > 0
          ? ` | Variações: ${p.variations.map(v => `${v.color ?? ''}/${v.size ?? ''}: ${v.stockQuantity}un`).join(', ')}`
          : '';
        productSummaries.push(`${p.name} (${cat}) | Fornecedor: ${supplierName} | Estoque: ${stock}un | Custo Médio: R$${effectiveCost.toFixed(2)} | Último Custo: R$${(p.lastCost || 0).toFixed(2)} | Custo Reposição: R$${(p.replacementCost || 0).toFixed(2)} | Venda: R$${p.salePrice} | Margem Bruta: ${margin}% | Lucro 30d: R$${profit30.toFixed(2)} | Vendido 30d: ${qtySold30}un (R$${rev30.toFixed(2)}) | Giro: ${(dailyRate * 30 / Math.max(stock, 1)).toFixed(2)}x | Cobertura: ${coverage > 365 ? '365+' : coverage} dias | Última venda: ${daysSinceSale >= 999 ? 'nunca' : daysSinceSale + ' dias'}${varInfo}`);
      }
    }

    const catLines = Array.from(catSummary.entries()).map(([k, v]) => `${k}: ${v.stock}un, vendeu ${v.sold30}un (R$${v.revenue30.toFixed(2)}) nos últimos 30d`).join('\n');
    const colorLines = Array.from(colorSummary.entries()).sort((a, b) => b[1].sold30 - a[1].sold30).slice(0, 15).map(([k, v]) => `${k}: ${v.sold30}un (R$${v.revenue30.toFixed(2)})`).join(', ');
    const sizeLines = Array.from(sizeSummary.entries()).sort((a, b) => b[1].sold30 - a[1].sold30).slice(0, 15).map(([k, v]) => `${k}: ${v.sold30}un (R$${v.revenue30.toFixed(2)})`).join(', ');

    const systemPrompt = `Você é o Gerente de Estoque e Rentabilidade IA do PushSisten — um sistema de gestão de loja de roupas e atacado.

Você é um especialista em estoque de moda, custos, margens e rentabilidade, com acesso completo aos dados reais da loja.

Capacidades:
- Análise de custos (custo médio ponderado, custo de reposição, último custo)
- Cálculo de margem bruta e líquida
- Rentabilidade por produto, categoria, fornecedor, vendedor
- Identificação de produtos com margem perigosa
- Impacto de descontos e taxas na lucratividade
- Análise de fornecedores e seus impactos na margem
- Recomendações de precificação baseadas em dados reais

Regras:
- Responda SEMPRE em português brasileiro
- Use dados reais nas respostas — NUNCA invente números
- Justifique recomendações com dados
- Seja direto, prático e acionável
- Discorde quando a decisão parecer ruim
- Priorize problemas urgentes
- Formate valores em R$ e use emojis moderadamente
- Quando falar de margem, diferencie margem bruta (venda - custo) de margem líquida (inclui taxas, comissões, etc)

--- DADOS REAIS DO ESTOQUE ---

Resumo Geral:
- Total produtos: ${products.length}
- Total peças em estoque: ${totalStock}
- Valor total (venda): R$${totalValue.toFixed(2)}
- Custo total investido: R$${totalCost.toFixed(2)}

Por Categoria:
${catLines}

Cores mais vendidas (30d): ${colorLines}
Tamanhos mais vendidos (30d): ${sizeLines}

Produtos Parados (${stalledDays}+ dias sem venda):
${stalledProducts.length > 0 ? stalledProducts.slice(0, 20).join('\n') : 'Nenhum produto parado.'}

Risco de Ruptura:
${ruptureRisk.length > 0 ? ruptureRisk.slice(0, 15).join('\n') : 'Nenhum produto em risco.'}

Detalhe por Produto (top ${Math.min(productSummaries.length, 50)}):
${productSummaries.slice(0, 50).join('\n')}
`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...(history ?? []).slice(-10),
      { role: 'user', content: message },
    ];

    const llmRes = await fetch(`${LLM_BASE}/api/v0/chat/completions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${LLM_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: LLM_MODEL, messages, temperature: 0.4, max_tokens: 2000 }),
    });

    if (!llmRes.ok) {
      console.error('LLM error:', await llmRes.text());
      return NextResponse.json({ error: 'Erro na IA' }, { status: 500 });
    }

    const llmData = await llmRes.json();
    const reply = llmData?.choices?.[0]?.message?.content ?? 'Não consegui gerar uma análise.';

    return NextResponse.json({ response: reply });
  } catch (error: any) {
    console.error('POST /api/estoque/ia error:', error);
    return NextResponse.json({ error: 'Erro na análise IA' }, { status: 500 });
  }
}
