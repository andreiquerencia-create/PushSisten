export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

const DEFAULT_AGRADECIMENTO = `Obrigado pela sua compra, {cliente} ❤️\n\nSeu pedido #{pedido} foi finalizado com sucesso.\n\nVendedor responsável: {vendedor}\nTotal: {total}\n\n{empresa}`;
const DEFAULT_WHATSAPP = `Olá, {cliente} 😊\n\nSegue o comprovante da sua compra #{pedido}.\n\nTotal: {total}\n\nObrigado pela preferência ❤️`;

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const templates = await prisma.messageTemplate.findMany({
      where: { companyId: session.user.companyId },
      orderBy: { type: 'asc' },
    });
    // If no templates exist, return defaults
    const result = [
      templates.find(t => t.type === 'agradecimento') || {
        id: null, type: 'agradecimento', name: 'Mensagem de Agradecimento (PDF)',
        content: DEFAULT_AGRADECIMENTO, isActive: true,
      },
      templates.find(t => t.type === 'whatsapp') || {
        id: null, type: 'whatsapp', name: 'Mensagem WhatsApp',
        content: DEFAULT_WHATSAPP, isActive: true,
      },
    ];
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('GET /api/configuracoes/mensagens error:', error);
    return NextResponse.json({ error: 'Erro ao buscar mensagens' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    if (session.user.role !== 'administrador' && session.user.role !== 'socio') {
      return NextResponse.json({ error: 'Apenas administradores' }, { status: 403 });
    }
    const body = await request.json();
    const { type, name, content } = body;
    if (!type || !content) {
      return NextResponse.json({ error: 'Tipo e conteúdo são obrigatórios' }, { status: 400 });
    }
    // Upsert by company + type
    const existing = await prisma.messageTemplate.findFirst({
      where: { companyId: session.user.companyId, type },
    });
    let template;
    if (existing) {
      template = await prisma.messageTemplate.update({
        where: { id: existing.id },
        data: { name: name || existing.name, content },
      });
    } else {
      template = await prisma.messageTemplate.create({
        data: {
          companyId: session.user.companyId,
          type,
          name: name || (type === 'agradecimento' ? 'Mensagem de Agradecimento (PDF)' : 'Mensagem WhatsApp'),
          content,
        },
      });
    }
    return NextResponse.json(template);
  } catch (error: any) {
    console.error('POST /api/configuracoes/mensagens error:', error);
    return NextResponse.json({ error: 'Erro ao salvar mensagem' }, { status: 500 });
  }
}
