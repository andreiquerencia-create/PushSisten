export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const companyId = (session.user as any).companyId;

    const body = await req.json();
    const { description, amount, type, paymentMethod, observation } = body || {};
    if (!description) return NextResponse.json({ error: 'Descrição é obrigatória' }, { status: 400 });

    // Get account plans for context
    const plans = await prisma.accountPlan.findMany({
      where: { companyId, isActive: true },
      select: { id: true, name: true, code: true, type: true, dreGroup: true, showInDre: true },
      orderBy: { sortOrder: 'asc' },
    });

    // Get recent corrections for learning context
    const recentCorrections = await prisma.aiClassificationLog.findMany({
      where: { companyId, corrected: true },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { description: true, suggestedAccountName: true, acceptedAccountPlanId: true },
    });

    // Build correction context
    let correctionContext = '';
    if (recentCorrections.length > 0) {
      const corrNames = await Promise.all(
        recentCorrections.filter(c => c.acceptedAccountPlanId).map(async c => {
          const accepted = plans.find(p => p.id === c.acceptedAccountPlanId);
          return accepted ? `"${c.description}" → ${accepted.name} (corrigido de: ${c.suggestedAccountName || 'nenhum'})` : null;
        })
      );
      const validCorrs = corrNames.filter(Boolean);
      if (validCorrs.length > 0) {
        correctionContext = `\n\nCorreções anteriores do usuário (use como referência):\n${validCorrs.join('\n')}`;
      }
    }

    const planList = plans.map(p => `- ${p.code} | ${p.name} | Tipo: ${p.type} | DRE: ${p.dreGroup || 'n/a'} | Exibe DRE: ${p.showInDre ? 'sim' : 'não'}`).join('\n');

    const prompt = `Você é um assistente financeiro especializado em lojas de roupas, calçados, acessórios e varejo.
O usuário está lançando um registro financeiro e precisa de ajuda para classificar.

Plano de Contas disponível:
${planList}
${correctionContext}

Lançamento do usuário:
- Descrição: ${description}
- Valor: ${amount ? `R$ ${amount}` : 'não informado'}
- Tipo: ${type === 'entrada' ? 'Entrada (receita)' : type === 'saida' ? 'Saída (gasto)' : 'não informado'}
- Forma de pagamento: ${paymentMethod || 'não informado'}
- Observação: ${observation || 'nenhuma'}

Responda APENAS com JSON válido no formato:
{
  "accountPlanId": "id da conta sugerida",
  "accountPlanName": "nome da conta sugerida",
  "accountType": "receita|despesa|custo|investimento|financeiro",
  "dreGroup": "grupo DRE",
  "showInDre": true ou false,
  "confidence": 0.0 a 1.0,
  "explanation": "explicação simples em português de por que essa classificação",
  "tip": "dica prática para o usuário (opcional)"
}

Responda com JSON puro, sem markdown.`;

    const llmBaseUrl = process.env.LLM_API_BASE_URL || 'https://api.openai.com';
    const llmKey = process.env.LLM_API_KEY || '';
    const llmModel = process.env.LLM_MODEL || 'gpt-4o-mini';

    const response = await fetch(`${llmBaseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${llmKey}`,
      },
      body: JSON.stringify({
        model: llmModel,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 500,
        temperature: 0.2,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('LLM API error:', err);
      return NextResponse.json({ error: 'Erro na IA' }, { status: 500 });
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) return NextResponse.json({ error: 'IA não retornou resposta' }, { status: 500 });

    let suggestion;
    try {
      suggestion = JSON.parse(content);
    } catch {
      console.error('Failed to parse AI response:', content);
      return NextResponse.json({ error: 'Resposta da IA inválida' }, { status: 500 });
    }

    // Log the suggestion
    await prisma.aiClassificationLog.create({
      data: {
        description,
        amount: amount ? parseFloat(amount) : null,
        type: type || null,
        suggestedAccountPlanId: suggestion.accountPlanId || null,
        suggestedAccountName: suggestion.accountPlanName || null,
        confidence: suggestion.confidence || null,
        explanation: suggestion.explanation || null,
        accepted: false,
        corrected: false,
        companyId,
      },
    });

    return NextResponse.json(suggestion);
  } catch (error: any) {
    console.error('AI suggest error:', error);
    return NextResponse.json({ error: 'Erro na sugestão da IA' }, { status: 500 });
  }
}

// Log acceptance or correction
export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const companyId = (session.user as any).companyId;

    const body = await req.json();
    const { logId, acceptedAccountPlanId, corrected } = body || {};

    if (logId) {
      await prisma.aiClassificationLog.updateMany({
        where: { id: logId, companyId },
        data: {
          acceptedAccountPlanId: acceptedAccountPlanId || null,
          accepted: !corrected,
          corrected: !!corrected,
        },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('AI log update error:', error);
    return NextResponse.json({ error: 'Erro ao salvar correção' }, { status: 500 });
  }
}
