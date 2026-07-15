export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { seedAccountPlanForCompany } from '@/lib/account-plan-seed';
import { checkRateLimit, getClientIp } from '@/lib/rate-limiter';
import { getPlanDefinition, isUnlimited } from '@/lib/plan-engine';

// Default account plans are now seeded via seedAccountPlanForCompany()
// from lib/account-plan-seed.ts (hierarchical fashion-retail chart of accounts).

export async function POST(request: NextRequest) {
  try {
    // === RATE LIMIT: 5 cadastros por minuto por IP ===
    const ip = getClientIp(request);
    const rl = checkRateLimit(`signup:${ip}`, 5, 60_000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Muitas tentativas. Aguarde um momento.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } }
      );
    }

    const body = await request.json();
    const { email, password, name, companyName, whatsapp } = body ?? {};

    if (!email || !password || !name || !whatsapp) {
      return NextResponse.json(
        { error: 'Nome, email, senha e WhatsApp são obrigatórios' },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: 'Email já cadastrado' },
        { status: 409 }
      );
    }

    const hashed = await bcrypt.hash(password, 12);

    // Create new company for this user — limites derivados do catálogo de planos
    const trialDef = getPlanDefinition('trial');
    const DEFAULT_TRIAL_DAYS = trialDef.trialDays ?? 14;
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + DEFAULT_TRIAL_DAYS);

    // Normalize whatsapp: keep only digits
    const cleanWhatsapp = (whatsapp || '').replace(/\D/g, '');

    const company = await prisma.company.create({
      data: {
        name: companyName || `Empresa de ${name}`,
        email,
        phone: cleanWhatsapp,
        whatsapp: cleanWhatsapp,
        plan: 'trial',
        subscriptionStatus: 'active',
        trialEndsAt: trialEnd,
        trialDays: DEFAULT_TRIAL_DAYS,
        maxUsers: isUnlimited(trialDef.maxUsers) ? 0 : trialDef.maxUsers,
        aiQuotaMonthly: isUnlimited(trialDef.aiQuotaMonthly) ? 0 : trialDef.aiQuotaMonthly,
        aiCallsThisMonth: 0,
      },
    });

    // Create the owner user as administrador
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashed,
        role: 'administrador',
        companyId: company.id,
      },
    });

    // Seed default account plans (hierarchical, fashion retail) - fire and forget
    try {
      await seedAccountPlanForCompany(company.id);
    } catch (seedErr: any) {
      console.error('Account plan seed error (non-critical):', seedErr?.message);
    }

    // Seed default financial categories
    try {
      const defaultCats = [
        { name: 'Vendas', type: 'receita' },
        { name: 'Outros', type: 'receita' },
        { name: 'Fornecedores', type: 'despesa' },
        { name: 'Operacional', type: 'despesa' },
        { name: 'Pessoal', type: 'despesa' },
        { name: 'Impostos', type: 'despesa' },
      ];
      await prisma.financialCategory.createMany({
        data: defaultCats.map(c => ({ ...c, companyId: company.id })),
      });
    } catch (catErr: any) {
      console.error('Financial category seed error (non-critical):', catErr?.message);
    }

    // Seed default cash account + payment methods (fire and forget)
    try {
      const defaultCashAccount = await prisma.cashAccount.create({
        data: {
          name: 'Caixa Principal',
          type: 'fisico',
          currentBalance: 0,
          isActive: true,
          companyId: company.id,
        },
      });

      // Create payment methods linked to the default cash account
      const defaultPaymentMethods = [
        { name: 'Dinheiro', type: 'dinheiro', isActive: true, defaultDays: 0, feePercent: 0, feeFixed: 0 },
        { name: 'PIX', type: 'pix', isActive: true, defaultDays: 0, feePercent: 0, feeFixed: 0 },
        { name: 'Cartão de Crédito', type: 'cartao_credito', isActive: true, defaultDays: 30, feePercent: 0, feeFixed: 0 },
        { name: 'Cartão de Débito', type: 'cartao_debito', isActive: true, defaultDays: 1, feePercent: 0, feeFixed: 0 },
        { name: 'Boleto', type: 'boleto', isActive: true, defaultDays: 3, feePercent: 0, feeFixed: 0 },
      ];
      await prisma.paymentMethod.createMany({
        data: defaultPaymentMethods.map(pm => ({
          ...pm,
          companyId: company.id,
          cashAccountId: defaultCashAccount.id,
        })),
      });
    } catch (seedErr: any) {
      console.error('Cash/Payment seed error (non-critical):', seedErr?.message);
    }

    // Log activity (fire and forget)
    try {
      await prisma.activityLog.create({
        data: {
          action: 'signup',
          description: `Nova empresa cadastrada: ${company.name}`,
          entityType: 'company',
          entityId: company.id,
          companyId: company.id,
          userId: user.id,
          userName: user.name,
          metadata: { plan: 'trial', whatsapp: cleanWhatsapp, trialDays: DEFAULT_TRIAL_DAYS },
        },
      });
    } catch { /* non-critical */ }

    return NextResponse.json(
      { id: user.id, name: user.name, email: user.email, companyId: company.id },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { error: 'Erro ao criar conta' },
      { status: 500 }
    );
  }
}