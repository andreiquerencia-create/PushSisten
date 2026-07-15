export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const companyId = session.user.companyId;
    if (!companyId) return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 400 });

    const config = await prisma.whatsAppConfig.findUnique({
      where: { companyId },
    });

    return NextResponse.json({ config: config ?? null });
  } catch (error: any) {
    console.error('WhatsApp config GET error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const companyId = session.user.companyId;
    if (!companyId) return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 400 });

    const body = await request.json();
    const { provider, apiUrl, apiKey, instanceId, phone, isActive } = body;

    const config = await prisma.whatsAppConfig.upsert({
      where: { companyId },
      create: {
        companyId,
        provider: provider ?? 'evolution',
        apiUrl: apiUrl ?? null,
        apiKey: apiKey ?? null,
        instanceId: instanceId ?? null,
        phone: phone ?? null,
        isActive: isActive ?? false,
      },
      update: {
        provider: provider ?? undefined,
        apiUrl: apiUrl ?? undefined,
        apiKey: apiKey ?? undefined,
        instanceId: instanceId ?? undefined,
        phone: phone ?? undefined,
        isActive: isActive ?? undefined,
      },
    });

    return NextResponse.json({ config });
  } catch (error: any) {
    console.error('WhatsApp config POST error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const companyId = session.user.companyId;
    if (!companyId) return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 400 });

    const body = await request.json();
    const { status } = body;

    // Test connection (mock for now)
    if (body.action === 'test') {
      const config = await prisma.whatsAppConfig.findUnique({ where: { companyId } });
      if (!config?.apiUrl || !config?.apiKey) {
        return NextResponse.json({ connected: false, message: 'Configure a URL e chave da API primeiro.' });
      }
      // In a real implementation, this would test the Evolution API or Z-API connection
      return NextResponse.json({ connected: false, message: 'Integração preparada. Configure sua instância Evolution API ou Z-API para conectar.' });
    }

    if (status) {
      await prisma.whatsAppConfig.update({
        where: { companyId },
        data: { status },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('WhatsApp config PUT error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
