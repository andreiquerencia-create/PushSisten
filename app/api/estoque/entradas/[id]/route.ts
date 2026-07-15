export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

// GET single entry
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const entry = await prisma.stockEntry.findUnique({
      where: { id: params.id },
      include: {
        supplier: { select: { id: true, name: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true } },
            variation: { select: { id: true, color: true, size: true, grade: true } },
          },
        },
        accountsPayable: true,
      },
    });

    if (!entry || entry.companyId !== session.user.companyId) {
      return NextResponse.json({ error: 'Entrada não encontrada' }, { status: 404 });
    }

    return NextResponse.json(entry);
  } catch (error: any) {
    console.error('Erro entrada GET:', error);
    return NextResponse.json({ error: 'Erro ao buscar entrada' }, { status: 500 });
  }
}

// PUT - Cancel entry (full reversal)
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const role = session.user.role;
    if (role === 'vendedor' || role === 'gerente') {
      return NextResponse.json({ error: 'Sem permissão para cancelar entrada' }, { status: 403 });
    }
    const companyId = session.user.companyId;
    const body = await request.json();
    const { action, cancelReason } = body ?? {};

    if (action !== 'cancel') {
      return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });
    }

    const entry = await prisma.stockEntry.findUnique({
      where: { id: params.id },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, stockQuantity: true, avgCost: true, costPrice: true } },
            variation: { select: { id: true, stockQuantity: true, avgCost: true, costPrice: true } },
          },
        },
        accountsPayable: true,
      },
    });

    if (!entry || entry.companyId !== companyId) {
      return NextResponse.json({ error: 'Entrada não encontrada' }, { status: 404 });
    }
    if (entry.status === 'cancelada') {
      return NextResponse.json({ error: 'Entrada já cancelada' }, { status: 400 });
    }
    if (!cancelReason?.trim()) {
      return NextResponse.json({ error: 'Motivo do cancelamento obrigatório' }, { status: 400 });
    }

    // 1. Reverse stock for each item
    for (const item of entry.items) {
      const qty = item.quantity;

      if (item.variationId && item.variation) {
        const currentStock = item.variation.stockQuantity;
        const newStock = Math.max(0, currentStock - qty);
        await prisma.productVariation.update({ where: { id: item.variationId }, data: { stockQuantity: newStock } });
        await prisma.product.update({ where: { id: item.productId }, data: { stockQuantity: { decrement: qty } } });

        // Create reversal movement
        await prisma.inventoryMovement.create({
          data: {
            productId: item.productId,
            variationId: item.variationId,
            companyId,
            type: 'cancelamento',
            quantity: qty,
            previousQty: currentStock,
            newQty: newStock,
            reason: `Cancelamento entrada #${entry.entryNumber}: ${cancelReason}`,
            reference: `stock_entry_cancel:${entry.id}`,
            stockEntryId: entry.id,
            userId: session.user.id,
            userName: session.user.name,
          },
        });
      } else {
        const product = item.product;
        const currentStock = product.stockQuantity;
        const newStock = Math.max(0, currentStock - qty);
        await prisma.product.update({ where: { id: item.productId }, data: { stockQuantity: newStock } });

        await prisma.inventoryMovement.create({
          data: {
            productId: item.productId,
            companyId,
            type: 'cancelamento',
            quantity: qty,
            previousQty: currentStock,
            newQty: newStock,
            reason: `Cancelamento entrada #${entry.entryNumber}: ${cancelReason}`,
            reference: `stock_entry_cancel:${entry.id}`,
            stockEntryId: entry.id,
            userId: session.user.id,
            userName: session.user.name,
          },
        });
      }
    }

    // 2. Cancel all pending accounts payable
    for (const ap of entry.accountsPayable) {
      if (ap.status === 'pendente') {
        await prisma.accountPayable.update({
          where: { id: ap.id },
          data: { status: 'cancelada', notes: `Cancelada - Estorno entrada #${entry.entryNumber}: ${cancelReason}` },
        });
      }
    }

    // 3. Create reversal financial record
    const accountPlan = await prisma.accountPlan.findFirst({
      where: { companyId, code: '2.1.1', isActive: true },
    });

    await prisma.financialRecord.create({
      data: {
        description: `[ESTORNO] Entrada mercadoria #${entry.entryNumber}`,
        amount: entry.totalCost,
        type: 'entrada',
        accountPlanId: accountPlan?.id || null,
        companyId,
        reference: `stock_entry_cancel:${entry.id}`,
        date: new Date(),
      },
    });

    // 4. Update entry status
    await prisma.stockEntry.update({
      where: { id: entry.id },
      data: {
        status: 'cancelada',
        cancelReason,
        cancelledAt: new Date(),
        cancelledById: session.user.id,
        cancelledByName: session.user.name,
      },
    });

    // 5. Activity log
    await prisma.activityLog.create({
      data: {
        action: 'stock_entry_cancel',
        description: `Cancelamento entrada #${entry.entryNumber} - R$ ${entry.totalCost.toFixed(2)} - Motivo: ${cancelReason}`,
        entityType: 'stock_entry',
        entityId: entry.id,
        companyId,
        userId: session.user.id,
        userName: session.user.name,
      },
    }).catch(() => {});

    return NextResponse.json({ success: true, message: 'Entrada cancelada com sucesso' });
  } catch (error: any) {
    console.error('Erro cancelar entrada:', error);
    return NextResponse.json({ error: 'Erro ao cancelar entrada' }, { status: 500 });
  }
}
