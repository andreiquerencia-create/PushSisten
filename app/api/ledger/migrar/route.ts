export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import {
  recordSale,
  recordSaleCancellation,
  recordARReceipt,
  recordAPPayment,
  recordManualEntry,
  hasLedgerEntries,
} from '@/lib/ledger-engine';

/**
 * POST /api/ledger/migrar
 * Migração retroativa: gera lançamentos de ledger a partir dos dados históricos.
 * Idempotente: pula registros que já possuem entries no ledger.
 * Body: { dryRun?: boolean }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const role = (session.user as any).role || '';
    if (!['admin', 'socio', 'master'].includes(role)) {
      return NextResponse.json({ error: 'Apenas administradores podem executar a migração' }, { status: 403 });
    }

    const companyId = session.user.companyId;
    const body = await request.json().catch(() => ({}));
    const dryRun = body?.dryRun === true;

    const stats = {
      sales: { total: 0, migrated: 0, skipped: 0, errors: 0 },
      cancellations: { total: 0, migrated: 0, skipped: 0, errors: 0 },
      arReceipts: { total: 0, migrated: 0, skipped: 0, errors: 0 },
      apPayments: { total: 0, migrated: 0, skipped: 0, errors: 0 },
      manualEntries: { total: 0, migrated: 0, skipped: 0, errors: 0 },
    };

    // === 1. Vendas concluídas ===
    const sales = await prisma.sale.findMany({
      where: { companyId, status: 'concluida' },
      include: {
        items: { include: { product: { select: { avgCost: true, costPrice: true } } } },
        payments: true,
      },
      orderBy: { createdAt: 'asc' },
    });
    stats.sales.total = sales.length;

    for (const sale of sales) {
      try {
        const exists = await hasLedgerEntries({ companyId, sourceType: 'sale', sourceId: sale.id });
        if (exists) { stats.sales.skipped++; continue; }

        if (!dryRun) {
          let cmv = 0;
          for (const item of sale.items) {
            const unitCost = item.product?.avgCost || item.product?.costPrice || 0;
            cmv += unitCost * item.quantity;
          }
          const hasReceivables = (sale.payments || []).some(p => !p.received);
          const totalFees = (sale.payments || []).reduce((s, p) => s + (p.feeAmount || 0), 0);

          await recordSale({
            companyId,
            saleId: sale.id,
            saleDate: sale.createdAt,
            totalAmount: sale.total,
            cmvAmount: cmv,
            feeAmount: totalFees,
            hasReceivables,
          });
        }
        stats.sales.migrated++;
      } catch (err) {
        console.error(`[MIGRAR] Erro venda ${sale.id}:`, err);
        stats.sales.errors++;
      }
    }

    // === 2. Vendas canceladas ===
    const cancelledSales = await prisma.sale.findMany({
      where: { companyId, status: 'cancelada' },
      orderBy: { updatedAt: 'asc' },
    });
    stats.cancellations.total = cancelledSales.length;

    for (const sale of cancelledSales) {
      try {
        // Só estorna se a venda original tem entries no ledger
        const hasSaleEntries = await hasLedgerEntries({ companyId, sourceType: 'sale', sourceId: sale.id });
        const hasCancEntries = await hasLedgerEntries({ companyId, sourceType: 'cancellation', sourceId: sale.id });

        if (!hasSaleEntries || hasCancEntries) { stats.cancellations.skipped++; continue; }

        if (!dryRun) {
          await recordSaleCancellation({
            companyId,
            saleId: sale.id,
            cancellationDate: sale.updatedAt,
          });
        }
        stats.cancellations.migrated++;
      } catch (err) {
        console.error(`[MIGRAR] Erro cancelamento ${sale.id}:`, err);
        stats.cancellations.errors++;
      }
    }

    // === 3. Contas a Receber já recebidas ===
    const receivedARs = await prisma.accountReceivable.findMany({
      where: { companyId, status: 'recebido' },
      orderBy: { receivedDate: 'asc' },
    });
    stats.arReceipts.total = receivedARs.length;

    for (const ar of receivedARs) {
      try {
        const exists = await hasLedgerEntries({ companyId, sourceType: 'ar_receipt', sourceId: ar.id });
        if (exists) { stats.arReceipts.skipped++; continue; }

        if (!dryRun) {
          await recordARReceipt({
            companyId,
            receivableId: ar.id,
            amount: ar.amount,
            receiptDate: ar.receivedDate || ar.updatedAt,
          });
        }
        stats.arReceipts.migrated++;
      } catch (err) {
        console.error(`[MIGRAR] Erro AR ${ar.id}:`, err);
        stats.arReceipts.errors++;
      }
    }

    // === 4. Contas a Pagar já pagas ===
    const paidAPs = await prisma.accountPayable.findMany({
      where: { companyId, status: 'pago' },
      orderBy: { paidDate: 'asc' },
    });
    stats.apPayments.total = paidAPs.length;

    for (const ap of paidAPs) {
      try {
        const exists = await hasLedgerEntries({ companyId, sourceType: 'ap_payment', sourceId: ap.id });
        if (exists) { stats.apPayments.skipped++; continue; }

        if (!dryRun) {
          await recordAPPayment({
            companyId,
            payableId: ap.id,
            amount: ap.amount,
            paymentDate: ap.paidDate || ap.updatedAt,
            expenseAccountPlanId: ap.accountPlanId || undefined,
          });
        }
        stats.apPayments.migrated++;
      } catch (err) {
        console.error(`[MIGRAR] Erro AP ${ap.id}:`, err);
        stats.apPayments.errors++;
      }
    }

    // === 5. Lançamentos financeiros manuais (com caixa vinculado) ===
    const manualFRs = await prisma.financialRecord.findMany({
      where: {
        companyId,
        cashAccountId: { not: null },
        accountPlanId: { not: null },
      },
      orderBy: { createdAt: 'asc' },
    });
    stats.manualEntries.total = manualFRs.length;

    for (const fr of manualFRs) {
      try {
        const exists = await hasLedgerEntries({ companyId, sourceType: 'manual_entry', sourceId: fr.id });
        if (exists) { stats.manualEntries.skipped++; continue; }

        if (!dryRun) {
          await recordManualEntry({
            companyId,
            financialRecordId: fr.id,
            amount: fr.amount,
            entryDate: fr.date || fr.createdAt,
            type: fr.type as 'entrada' | 'saida',
            accountPlanId: fr.accountPlanId!,
            description: fr.description,
          });
        }
        stats.manualEntries.migrated++;
      } catch (err) {
        console.error(`[MIGRAR] Erro FR ${fr.id}:`, err);
        stats.manualEntries.errors++;
      }
    }

    const totalMigrated =
      stats.sales.migrated +
      stats.cancellations.migrated +
      stats.arReceipts.migrated +
      stats.apPayments.migrated +
      stats.manualEntries.migrated;

    return NextResponse.json({
      success: true,
      dryRun,
      totalMigrated,
      stats,
    });
  } catch (error: any) {
    console.error('POST /api/ledger/migrar error:', error);
    return NextResponse.json({ error: 'Erro na migração' }, { status: 500 });
  }
}
