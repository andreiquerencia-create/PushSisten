export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { updateProductCosts } from '@/lib/cost-engine';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const companyId = session.user.companyId;
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') ?? '1');
    const limit = parseInt(url.searchParams.get('limit') ?? '20');
    const status = url.searchParams.get('status') ?? '';
    const supplierId = url.searchParams.get('supplierId') ?? '';
    const search = url.searchParams.get('search') ?? '';

    const where: any = { companyId };
    if (status) where.status = status;
    if (supplierId) where.supplierId = supplierId;
    if (search) {
      where.OR = [
        { supplier: { name: { contains: search, mode: 'insensitive' } } },
        { notes: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [entries, total] = await Promise.all([
      prisma.stockEntry.findMany({
        where,
        include: {
          supplier: { select: { id: true, name: true } },
          items: {
            include: {
              product: { select: { id: true, name: true, sku: true } },
              variation: { select: { id: true, color: true, size: true, grade: true } },
            },
          },
          accountsPayable: { select: { id: true, amount: true, dueDate: true, status: true, installmentNum: true, totalInstallments: true } },
          _count: { select: { items: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.stockEntry.count({ where }),
    ]);

    return NextResponse.json({ entries: entries ?? [], total, pages: Math.ceil(total / limit) });
  } catch (error: any) {
    console.error('Erro entradas GET:', error);
    return NextResponse.json({ error: 'Erro ao buscar entradas' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const role = session.user.role;
    if (role === 'vendedor' || role === 'gerente') {
      return NextResponse.json({ error: 'Sem permissão para registrar entrada de mercadoria' }, { status: 403 });
    }
    const companyId = session.user.companyId;
    const body = await request.json();
    const {
      supplierId, items, freight = 0, otherExpenses = 0,
      paymentMethod = 'a_vista', installments = 1,
      notes, updateAvgCost = true, dueDates,
      otherExpensesAccountPlanId,
    } = body ?? {};

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Nenhum item informado' }, { status: 400 });
    }

    // Calculate subtotal
    let subtotal = 0;
    for (const item of items) {
      const qty = parseInt(item.quantity) || 0;
      const cost = parseFloat(item.unitCost) || 0;
      if (qty <= 0 || cost < 0) return NextResponse.json({ error: `Quantidade/custo inválido para ${item.productName || 'item'}` }, { status: 400 });
      subtotal += qty * cost;
    }

    const freightVal = parseFloat(String(freight)) || 0;
    const otherVal = parseFloat(String(otherExpenses)) || 0;
    const totalCost = subtotal + freightVal + otherVal;

    // Create stock entry
    const entry = await prisma.stockEntry.create({
      data: {
        companyId,
        supplierId: supplierId || null,
        subtotal,
        freight: freightVal,
        otherExpenses: otherVal,
        totalCost,
        paymentMethod,
        installments: parseInt(String(installments)) || 1,
        notes: notes || null,
        updateAvgCost: updateAvgCost !== false,
        createdById: session.user.id,
        createdByName: session.user.name,
      },
    });

    // Process items: update stock, costs, create movements
    const entryItems: any[] = [];
    for (const item of items) {
      const qty = parseInt(item.quantity);
      const unitCost = parseFloat(item.unitCost);
      const totalItemCost = qty * unitCost;
      const isVariation = !!item.variationId;

      // Calculate freight/expenses share proportionally
      const share = subtotal > 0 ? totalItemCost / subtotal : 1 / items.length;
      const itemFreight = freightVal * share;
      const itemOther = otherVal * share;
      const effectiveUnitCost = (totalItemCost + itemFreight + itemOther) / qty;

      let previousQty = 0;
      let costResult = { previousAvgCost: 0, newAvgCost: 0 };

      if (isVariation) {
        const variation = await prisma.productVariation.findUnique({ where: { id: item.variationId } });
        previousQty = variation?.stockQuantity ?? 0;
        // Update variation stock
        await prisma.productVariation.update({ where: { id: item.variationId }, data: { stockQuantity: { increment: qty } } });
        // Update product aggregate stock
        await prisma.product.update({ where: { id: item.productId }, data: { stockQuantity: { increment: qty } } });
      } else {
        const product = await prisma.product.findUnique({ where: { id: item.productId } });
        previousQty = product?.stockQuantity ?? 0;
        await prisma.product.update({ where: { id: item.productId }, data: { stockQuantity: { increment: qty } } });
      }

      // Update costs if enabled
      if (updateAvgCost !== false) {
        costResult = await updateProductCosts({
          productId: item.productId,
          variationId: item.variationId || null,
          companyId,
          newQty: qty,
          unitCost: effectiveUnitCost,
          reason: 'entrada_mercadoria',
          reference: `Entrada #${entry.entryNumber}`,
          userId: session.user.id,
          userName: session.user.name,
        });
      }

      // Create entry item
      const entryItem = await prisma.stockEntryItem.create({
        data: {
          stockEntryId: entry.id,
          productId: item.productId,
          variationId: item.variationId || null,
          quantity: qty,
          unitCost,
          totalCost: totalItemCost,
          previousAvgCost: costResult.previousAvgCost,
          newAvgCost: costResult.newAvgCost,
        },
      });
      entryItems.push(entryItem);

      // Create inventory movement
      await prisma.inventoryMovement.create({
        data: {
          productId: item.productId,
          variationId: item.variationId || null,
          companyId,
          type: 'entrada_mercadoria',
          quantity: qty,
          previousQty,
          newQty: previousQty + qty,
          reason: `Entrada de mercadoria #${entry.entryNumber}${supplierId ? '' : ''}`,
          reference: `stock_entry:${entry.id}`,
          stockEntryId: entry.id,
          userId: session.user.id,
          userName: session.user.name,
        },
      });
    }

    // Lookup classification plans for AP/FR creation
    const [compraPlan, fretePlan] = await Promise.all([
      prisma.accountPlan.findFirst({ where: { companyId, code: '2.1.1', isActive: true } }),
      prisma.accountPlan.findFirst({ where: { companyId, code: '2.1.2', isActive: true } }),
    ]);

    // Create accounts payable for COMPRA (subtotal), split into installments
    const numInstallments = parseInt(String(installments)) || 1;
    const installmentAmount = Math.round((subtotal / numInstallments) * 100) / 100;

    for (let i = 0; i < numInstallments; i++) {
      let dueDate: Date;
      if (dueDates && dueDates[i]) {
        dueDate = new Date(dueDates[i]);
      } else if (paymentMethod === 'a_vista') {
        dueDate = new Date();
      } else {
        dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 30 * (i + 1));
      }

      // Adjust last installment for rounding
      const amount = i === numInstallments - 1
        ? subtotal - installmentAmount * (numInstallments - 1)
        : installmentAmount;

      await prisma.accountPayable.create({
        data: {
          description: numInstallments > 1
            ? `Compra mercadoria #${entry.entryNumber} - Parcela ${i + 1}/${numInstallments}`
            : `Compra mercadoria #${entry.entryNumber}`,
          amount,
          dueDate,
          status: paymentMethod === 'a_vista' && i === 0 ? 'pago' : 'pendente',
          paidDate: paymentMethod === 'a_vista' && i === 0 ? new Date() : null,
          supplierId: supplierId || null,
          stockEntryId: entry.id,
          accountPlanId: compraPlan?.id || null,
          companyId,
          installmentNum: i + 1,
          totalInstallments: numInstallments,
          notes: `Gerado automaticamente pela entrada de mercadoria #${entry.entryNumber} - Compra`,
        },
      });
    }

    // Create separate AP for FRETE (if any) - classified as 2.06.01
    if (freightVal > 0) {
      let freteDate: Date;
      if (dueDates && dueDates[0]) freteDate = new Date(dueDates[0]);
      else if (paymentMethod === 'a_vista') freteDate = new Date();
      else { freteDate = new Date(); freteDate.setDate(freteDate.getDate() + 30); }

      await prisma.accountPayable.create({
        data: {
          description: `Frete entrada #${entry.entryNumber}`,
          amount: freightVal,
          dueDate: freteDate,
          status: paymentMethod === 'a_vista' ? 'pago' : 'pendente',
          paidDate: paymentMethod === 'a_vista' ? new Date() : null,
          supplierId: supplierId || null,
          stockEntryId: entry.id,
          accountPlanId: fretePlan?.id || compraPlan?.id || null,
          companyId,
          installmentNum: 1,
          totalInstallments: 1,
          notes: `Gerado automaticamente pela entrada de mercadoria #${entry.entryNumber} - Frete`,
        },
      });
    }

    // Create separate AP for OUTRAS DESPESAS (if any) - user-selectable, default 2.01
    if (otherVal > 0) {
      let outrasDate: Date;
      if (dueDates && dueDates[0]) outrasDate = new Date(dueDates[0]);
      else if (paymentMethod === 'a_vista') outrasDate = new Date();
      else { outrasDate = new Date(); outrasDate.setDate(outrasDate.getDate() + 30); }

      let outrasPlanId: string | null = otherExpensesAccountPlanId || null;
      if (!outrasPlanId) outrasPlanId = compraPlan?.id || null;

      await prisma.accountPayable.create({
        data: {
          description: `Outras despesas entrada #${entry.entryNumber}`,
          amount: otherVal,
          dueDate: outrasDate,
          status: paymentMethod === 'a_vista' ? 'pago' : 'pendente',
          paidDate: paymentMethod === 'a_vista' ? new Date() : null,
          supplierId: supplierId || null,
          stockEntryId: entry.id,
          accountPlanId: outrasPlanId,
          companyId,
          installmentNum: 1,
          totalInstallments: 1,
          notes: `Gerado automaticamente pela entrada de mercadoria #${entry.entryNumber} - Outras despesas`,
        },
      });
    }

    // Create informational financial record (excluded from DRE expenses via reference filter,
    // but useful for general financial movement listing). The actual DRE classification
    // comes through the payment FRs that inherit accountPlanId from the AP.
    await prisma.financialRecord.create({
      data: {
        description: `Compra mercadoria - Entrada #${entry.entryNumber}`,
        amount: totalCost,
        type: 'saida',
        paymentMethod: paymentMethod === 'a_vista' ? 'dinheiro' : 'parcelado',
        accountPlanId: compraPlan?.id || null,
        companyId,
        reference: `stock_entry:${entry.id}`,
        date: new Date(),
      },
    });

    // Activity log
    await prisma.activityLog.create({
      data: {
        action: 'stock_entry',
        description: `Entrada de mercadoria #${entry.entryNumber} - ${items.length} itens - Total: R$ ${totalCost.toFixed(2)}`,
        entityType: 'stock_entry',
        entityId: entry.id,
        companyId,
        userId: session.user.id,
        userName: session.user.name,
      },
    }).catch(() => {});

    // Fetch full entry
    const fullEntry = await prisma.stockEntry.findUnique({
      where: { id: entry.id },
      include: {
        supplier: { select: { name: true } },
        items: {
          include: {
            product: { select: { name: true, sku: true } },
            variation: { select: { color: true, size: true } },
          },
        },
        accountsPayable: true,
      },
    });

    return NextResponse.json(fullEntry, { status: 201 });
  } catch (error: any) {
    console.error('Erro entrada POST:', error);
    return NextResponse.json({ error: 'Erro ao registrar entrada' }, { status: 500 });
  }
}
