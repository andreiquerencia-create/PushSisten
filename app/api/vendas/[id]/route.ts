export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { recordSaleCancellation } from '@/lib/ledger-engine';

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const companyId = session.user.companyId;
    const sale = await prisma.sale.findFirst({
      where: { id: params?.id, companyId },
      include: {
        customer: true,
        seller: { select: { id: true, name: true } },
        items: {
          include: {
            product: {
              select: {
                id: true, name: true, sku: true, salePrice: true, stockQuantity: true,
                category: { select: { name: true } },
                variations: true,
                priceTables: true,
              },
            },
            variation: true,
          },
        },
      },
    });
    if (!sale) return NextResponse.json({ error: 'Venda não encontrada' }, { status: 404 });
    return NextResponse.json(sale);
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: 'Erro' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const body = await request.json();
    const companyId = session.user.companyId;

    // Helper: resolve sellerId to a valid User.id (Sale.sellerId refs User, not Seller)
    const sessionUserId = session!.user.id;
    async function resolveValidSellerId(rawId: string | null | undefined): Promise<string> {
      if (!rawId) return sessionUserId;
      const userExists = await prisma.user.findUnique({ where: { id: rawId }, select: { id: true } });
      if (userExists) return userExists.id;
      // Might be a Seller.id — resolve to userId
      const seller = await prisma.seller.findUnique({ where: { id: rawId }, select: { userId: true } });
      if (seller?.userId) return seller.userId;
      return sessionUserId;
    }

    // ====== FULL EDIT MODE (for orçamentos) ======
    if (body?.editMode === true) {
      const sale = await prisma.sale.findFirst({ where: { id: params?.id, companyId }, include: { items: true } });
      if (!sale) return NextResponse.json({ error: 'Orçamento não encontrado' }, { status: 404 });
      if (sale.status !== 'orcamento') return NextResponse.json({ error: 'Apenas orçamentos podem ser editados' }, { status: 400 });

      // Vendedor can only edit their own orçamentos
      const editUserRole = (session.user as any).role;
      if (editUserRole === 'vendedor' && sale.sellerId !== sessionUserId) {
        return NextResponse.json({ error: 'Vendedor só pode editar seus próprios orçamentos' }, { status: 403 });
      }

      const { customerId, sellerId, items, discount, notes } = body;

      // 1. Restore stock from OLD items
      for (const item of sale.items) {
        if (item.variationId) {
          await prisma.productVariation.update({ where: { id: item.variationId }, data: { stockQuantity: { increment: item.quantity } } });
          const totStock = await prisma.productVariation.aggregate({ where: { productId: item.productId, isActive: true }, _sum: { stockQuantity: true } });
          await prisma.product.update({ where: { id: item.productId }, data: { stockQuantity: totStock._sum?.stockQuantity ?? 0 } });
        } else {
          await prisma.product.update({ where: { id: item.productId }, data: { stockQuantity: { increment: item.quantity } } });
        }
        await prisma.inventoryMovement.create({
          data: { productId: item.productId, variationId: item.variationId ?? null, companyId, type: 'entrada', quantity: item.quantity, reason: 'Edição de orçamento (estorno)', reference: sale.id },
        });
      }

      // 2. Delete OLD items
      await prisma.saleItem.deleteMany({ where: { saleId: sale.id } });

      // 3. Process NEW items
      let subtotal = 0;
      const processedItems: any[] = [];
      for (const item of items ?? []) {
        const product = await prisma.product.findUnique({ where: { id: item?.productId } });
        if (!product) continue;
        if (item?.variationId) {
          const variation = await prisma.productVariation.findUnique({ where: { id: item.variationId } });
          if (!variation || (variation.stockQuantity ?? 0) < (item.quantity ?? 0)) {
            return NextResponse.json({ error: `Estoque insuficiente para ${product.name}` }, { status: 400 });
          }
        } else {
          if ((product.stockQuantity ?? 0) < (item.quantity ?? 0)) {
            return NextResponse.json({ error: `Estoque insuficiente para ${product.name}` }, { status: 400 });
          }
        }
        const unitPrice = item.unitPrice ?? product.salePrice ?? 0;
        const itemDiscount = item.discount ?? 0;
        const itemTotal = (unitPrice * (item.quantity ?? 1)) - itemDiscount;
        subtotal += itemTotal;
        processedItems.push({
          saleId: sale.id, productId: item.productId, variationId: item.variationId ?? null,
          quantity: item.quantity ?? 1, unitPrice, discount: itemDiscount, total: itemTotal,
          priceTableId: item.priceTableId ?? null, priceTableName: item.priceTableName ?? null,
          originalPrice: item.originalPrice ?? null, appliedPrice: item.appliedPrice ?? null, priceDiscount: item.priceDiscount ?? null,
        });
      }

      // 4. Insert NEW items
      if (processedItems.length > 0) {
        await prisma.saleItem.createMany({ data: processedItems });
      }

      // 5. Deduct stock for NEW items
      for (const item of processedItems) {
        if (item.variationId) {
          await prisma.productVariation.update({ where: { id: item.variationId }, data: { stockQuantity: { decrement: item.quantity } } });
          const totStock = await prisma.productVariation.aggregate({ where: { productId: item.productId, isActive: true }, _sum: { stockQuantity: true } });
          await prisma.product.update({ where: { id: item.productId }, data: { stockQuantity: totStock._sum?.stockQuantity ?? 0 } });
        } else {
          await prisma.product.update({ where: { id: item.productId }, data: { stockQuantity: { decrement: item.quantity } } });
        }
        await prisma.inventoryMovement.create({
          data: { productId: item.productId, variationId: item.variationId ?? null, companyId, type: 'saida', quantity: item.quantity, reason: 'Orçamento editado (reserva)', reference: sale.id },
        });
      }

      // 6. Build edit history
      const prevHistory = sale.editHistory ? JSON.parse(sale.editHistory) : [];
      prevHistory.push({
        date: new Date().toISOString(),
        userId: session.user.id,
        userName: session.user.name || 'Sistema',
        action: 'Orçamento editado',
        oldTotal: sale.total,
        newTotal: subtotal - (parseFloat(discount) || 0),
      });

      // 7. Update sale record
      const totalDiscount = parseFloat(discount) || 0;
      const resolvedSellerId = await resolveValidSellerId(sellerId);
      const updated = await prisma.sale.update({
        where: { id: sale.id },
        data: {
          customerId: customerId || null,
          sellerId: resolvedSellerId,
          subtotal,
          discount: totalDiscount,
          total: subtotal - totalDiscount,
          notes: notes ?? sale.notes,
          updatedById: session.user.id,
          updatedByName: session.user.name || 'Sistema',
          editHistory: JSON.stringify(prevHistory),
        },
        include: {
          customer: { select: { name: true } },
          seller: { select: { name: true } },
          items: { include: { product: { select: { name: true } } } },
        },
      });

      return NextResponse.json(updated);
    }

    // ====== CONVERT TO SALE MODE (orçamento → venda com pagamento completo) ======
    if (body?.convertToSale === true) {
      const sale = await prisma.sale.findFirst({ where: { id: params?.id, companyId }, include: { items: true } });
      if (!sale) return NextResponse.json({ error: 'Orçamento não encontrado' }, { status: 404 });
      if (sale.status !== 'orcamento') return NextResponse.json({ error: 'Apenas orçamentos podem ser convertidos' }, { status: 400 });

      const { customerId, sellerId, items, discount, paymentMethod, payments } = body;

      // 1. Restore stock from OLD items (orçamento had reserved stock)
      for (const item of sale.items) {
        if (item.variationId) {
          await prisma.productVariation.update({ where: { id: item.variationId }, data: { stockQuantity: { increment: item.quantity } } });
          const totStock = await prisma.productVariation.aggregate({ where: { productId: item.productId, isActive: true }, _sum: { stockQuantity: true } });
          await prisma.product.update({ where: { id: item.productId }, data: { stockQuantity: totStock._sum?.stockQuantity ?? 0 } });
        } else {
          await prisma.product.update({ where: { id: item.productId }, data: { stockQuantity: { increment: item.quantity } } });
        }
        await prisma.inventoryMovement.create({
          data: { productId: item.productId, variationId: item.variationId ?? null, companyId, type: 'entrada', quantity: item.quantity, reason: 'Conversão orçamento → venda (estorno reserva)', reference: sale.id },
        });
      }

      // 2. Delete OLD items
      await prisma.saleItem.deleteMany({ where: { saleId: sale.id } });

      // 3. Process NEW items
      let subtotal = 0;
      const processedItems: any[] = [];
      for (const item of items ?? []) {
        const product = await prisma.product.findUnique({ where: { id: item?.productId } });
        if (!product) continue;
        if (item?.variationId) {
          const variation = await prisma.productVariation.findUnique({ where: { id: item.variationId } });
          if (!variation || (variation.stockQuantity ?? 0) < (item.quantity ?? 0)) {
            return NextResponse.json({ error: `Estoque insuficiente para ${product.name}` }, { status: 400 });
          }
        } else {
          if ((product.stockQuantity ?? 0) < (item.quantity ?? 0)) {
            return NextResponse.json({ error: `Estoque insuficiente para ${product.name}` }, { status: 400 });
          }
        }
        const unitPrice = item.unitPrice ?? product.salePrice ?? 0;
        const itemDiscount = item.discount ?? 0;
        const itemTotal = (unitPrice * (item.quantity ?? 1)) - itemDiscount;
        subtotal += itemTotal;
        processedItems.push({
          saleId: sale.id, productId: item.productId, variationId: item.variationId ?? null,
          quantity: item.quantity ?? 1, unitPrice, discount: itemDiscount, total: itemTotal,
          priceTableId: item.priceTableId ?? null, priceTableName: item.priceTableName ?? null,
          originalPrice: item.originalPrice ?? null, appliedPrice: item.appliedPrice ?? null, priceDiscount: item.priceDiscount ?? null,
        });
      }

      // 4. Insert NEW items
      if (processedItems.length > 0) {
        await prisma.saleItem.createMany({ data: processedItems });
      }

      // 5. Deduct stock definitively (como venda real)
      for (const item of processedItems) {
        if (item.variationId) {
          await prisma.productVariation.update({ where: { id: item.variationId }, data: { stockQuantity: { decrement: item.quantity } } });
          const totStock = await prisma.productVariation.aggregate({ where: { productId: item.productId, isActive: true }, _sum: { stockQuantity: true } });
          await prisma.product.update({ where: { id: item.productId }, data: { stockQuantity: totStock._sum?.stockQuantity ?? 0 } });
        } else {
          await prisma.product.update({ where: { id: item.productId }, data: { stockQuantity: { decrement: item.quantity } } });
        }
        await prisma.inventoryMovement.create({
          data: { productId: item.productId, variationId: item.variationId ?? null, companyId, type: 'saida', quantity: item.quantity, reason: 'Venda (convertido de orçamento)', reference: sale.id },
        });
      }

      // 6. Build edit history
      const prevHistory = sale.editHistory ? JSON.parse(sale.editHistory) : [];
      prevHistory.push({
        date: new Date().toISOString(),
        userId: session.user.id,
        userName: session.user.name || 'Sistema',
        action: 'Orçamento convertido em venda',
        oldTotal: sale.total,
        newTotal: subtotal - (parseFloat(discount) || 0),
      });

      // 7. Update sale record → status concluida
      const totalDiscount = parseFloat(discount) || 0;
      const totalFinal = subtotal - totalDiscount;
      const resolvedSellerIdConvert = await resolveValidSellerId(sellerId);
      const updatedSale = await prisma.sale.update({
        where: { id: sale.id },
        data: {
          customerId: customerId || null,
          sellerId: resolvedSellerIdConvert,
          subtotal,
          discount: totalDiscount,
          total: totalFinal,
          status: 'concluida',
          paymentMethod: paymentMethod || 'dinheiro',
          updatedById: session.user.id,
          updatedByName: session.user.name || 'Sistema',
          editHistory: JSON.stringify(prevHistory),
        },
        include: {
          customer: { select: { name: true } },
          seller: { select: { name: true } },
          items: { include: { product: { select: { name: true } } } },
        },
      });

      // 8. Process payments + financial records (same logic as POST in vendas/route.ts)
      const vendaCat = await prisma.financialCategory.findFirst({
        where: { companyId, name: 'Vendas' },
      });
      const vendaAccountPlan = await prisma.accountPlan.findFirst({
        where: { companyId, code: '1.1', isActive: true },
      });
      const vendaAccountPlanId = vendaAccountPlan?.id || null;

      if (payments && Array.isArray(payments) && payments.length > 0) {
        for (const p of payments) {
          await prisma.salePayment.create({
            data: {
              saleId: sale.id,
              paymentMethodId: p.paymentMethodId,
              amount: p.amount,
              feePercent: p.feePercent ?? 0,
              feeAmount: p.feeAmount ?? 0,
              netAmount: p.netAmount ?? p.amount,
              expectedDate: new Date(p.expectedDate),
              cashAccountId: p.cashAccountId,
              companyId,
              received: (p.feePercent ?? 0) === 0 && !p.expectedDate ? true : false,
            },
          });

          const method = await prisma.paymentMethod.findUnique({ where: { id: p.paymentMethodId } });
          const isImmediate = (method?.defaultDays ?? 0) === 0;

          if (isImmediate) {
            await prisma.cashAccount.update({
              where: { id: p.cashAccountId },
              data: { currentBalance: { increment: p.netAmount ?? p.amount } },
            });
            await prisma.financialRecord.create({
              data: {
                description: `Venda #${sale.saleNumber} - ${method?.name ?? 'Pagamento'}`,
                amount: p.netAmount ?? p.amount,
                type: 'entrada',
                paymentMethod: method?.name ?? paymentMethod ?? 'dinheiro',
                categoryId: vendaCat?.id ?? null,
                companyId,
                reference: sale.id,
              },
            });
            await prisma.salePayment.updateMany({
              where: { saleId: sale.id, paymentMethodId: p.paymentMethodId },
              data: { received: true, receivedDate: new Date() },
            });
          } else {
            await prisma.accountReceivable.create({
              data: {
                description: `Venda #${sale.saleNumber} - ${method?.name ?? 'Cartão'}`,
                amount: p.netAmount ?? p.amount,
                dueDate: new Date(p.expectedDate),
                status: 'pendente',
                saleId: sale.id,
                accountPlanId: vendaAccountPlanId,
                companyId,
                notes: `Taxa: ${p.feePercent ?? 0}% | Bruto: R$ ${(p.amount ?? 0).toFixed(2)} | Líquido: R$ ${(p.netAmount ?? p.amount).toFixed(2)}`,
              },
            });
            await prisma.financialRecord.create({
              data: {
                description: `Venda #${sale.saleNumber} - ${method?.name ?? 'Cartão'} (a receber)`,
                amount: p.amount,
                type: 'entrada',
                paymentMethod: method?.name ?? paymentMethod ?? 'cartão',
                categoryId: vendaCat?.id ?? null,
                companyId,
                reference: sale.id,
              },
            });
            if ((p.feeAmount ?? 0) > 0) {
              const taxaCat = await prisma.financialCategory.findFirst({
                where: { companyId, name: { contains: 'Taxa', mode: 'insensitive' } },
              });
              await prisma.financialRecord.create({
                data: {
                  description: `Taxa ${method?.name ?? 'Cartão'} - Venda #${sale.saleNumber}`,
                  amount: p.feeAmount,
                  type: 'saida',
                  paymentMethod: method?.name ?? 'taxa',
                  categoryId: taxaCat?.id ?? null,
                  companyId,
                  reference: sale.id,
                },
              });
            }
          }
        }
      } else {
        // Fallback: sem pagamentos estruturados
        await prisma.financialRecord.create({
          data: {
            description: `Venda #${sale.saleNumber}`,
            amount: totalFinal,
            type: 'entrada',
            paymentMethod: paymentMethod ?? 'dinheiro',
            categoryId: vendaCat?.id ?? null,
            companyId,
            reference: sale.id,
          },
        });
      }

      // 9. Update customer stats
      if (customerId) {
        const customerSales = await prisma.sale.aggregate({
          where: { customerId, status: 'concluida' },
          _sum: { total: true },
          _count: true,
        });
        await prisma.customer.update({
          where: { id: customerId },
          data: {
            totalPurchased: customerSales._sum?.total ?? 0,
            purchaseCount: customerSales._count ?? 0,
            avgTicket: (customerSales._sum?.total ?? 0) / Math.max(customerSales._count ?? 1, 1),
            lastPurchase: new Date(),
          },
        });
      }

      return NextResponse.json(updatedSale);
    }

    // ====== STATUS CHANGE MODE (cancel/convert) ======
    const userRole = (session.user as any).role;

    if (body?.status === 'cancelada') {
      const sale = await prisma.sale.findFirst({
        where: { id: params?.id, companyId },
        include: { items: true, payments: true, customer: true },
      });
      if (!sale) return NextResponse.json({ error: 'Venda não encontrada' }, { status: 404 });
      if (sale.status === 'cancelada') return NextResponse.json({ error: 'Venda já está cancelada' }, { status: 400 });

      const isVendaFinalizada = sale.status === 'concluida';

      // Permission check: vendedor can only cancel own orçamentos
      if (userRole === 'vendedor') {
        if (isVendaFinalizada) {
          return NextResponse.json({ error: 'Vendedor não tem permissão para cancelar vendas' }, { status: 403 });
        }
        if (sale.sellerId !== sessionUserId) {
          return NextResponse.json({ error: 'Vendedor só pode cancelar seus próprios orçamentos' }, { status: 403 });
        }
      }

      // Require cancellation reason for finalized sales
      const cancelReason = body?.cancelReason || body?.reason || '';
      if (isVendaFinalizada && !cancelReason) {
        return NextResponse.json({ error: 'Motivo do cancelamento é obrigatório' }, { status: 400 });
      }

      // ========================================================
      // ATOMIC CANCELLATION via prisma.$transaction
      // Rolls back ALL effects if any step fails.
      // ========================================================
      const updated = await prisma.$transaction(async (tx) => {
        // ====== 1. RESTORE STOCK ======
        for (const item of sale.items ?? []) {
          if (item.variationId) {
            await tx.productVariation.update({ where: { id: item.variationId }, data: { stockQuantity: { increment: item.quantity } } });
            const totStock = await tx.productVariation.aggregate({ where: { productId: item.productId, isActive: true }, _sum: { stockQuantity: true } });
            await tx.product.update({ where: { id: item.productId }, data: { stockQuantity: totStock._sum?.stockQuantity ?? 0 } });
          } else {
            await tx.product.update({ where: { id: item.productId }, data: { stockQuantity: { increment: item.quantity } } });
          }
          await tx.inventoryMovement.create({
            data: {
              productId: item.productId, variationId: item.variationId ?? null, companyId: sale.companyId,
              type: 'entrada', quantity: item.quantity,
              reason: sale.status === 'orcamento' ? 'Orçamento cancelado' : `Estorno de venda cancelada #${sale.saleNumber}`,
              reference: sale.id,
            },
          });
        }

        // ====== For finalized sales: reverse ALL financial impacts ======
        if (isVendaFinalizada) {
          // ====== 2. REVERSE CASH ACCOUNT BALANCES (from SalePayments) ======
          for (const payment of sale.payments ?? []) {
            if (payment.received && payment.cashAccountId) {
              await tx.cashAccount.update({
                where: { id: payment.cashAccountId },
                data: { currentBalance: { decrement: payment.netAmount || payment.amount } },
              });
            }
          }

          // ====== 2b. FIX C1: REVERSE CASH FROM RECEIVED ACCOUNTS RECEIVABLE ======
          // When an AR was received (via contas-receber or crediário), the CashAccount
          // was incremented. We must reverse that cash here.
          const receivedARs = await tx.accountReceivable.findMany({
            where: {
              companyId: sale.companyId,
              saleId: sale.id,
              status: { in: ['recebido', 'recebida'] },
            },
          });

          for (const ar of receivedARs) {
            // Find CashMovements created when this AR was received
            const arRef = `AR#${ar.id.slice(-6)}`;
            const receiptCMs = await tx.cashMovement.findMany({
              where: {
                companyId: sale.companyId,
                type: 'entrada',
                reference: arRef,
              },
            });

            for (const cm of receiptCMs) {
              // Idempotency: skip if already reversed
              const alreadyReversed = await tx.cashMovement.findFirst({
                where: {
                  companyId: sale.companyId,
                  origin: 'estorno_cancelamento',
                  reference: `ESTORNO:${arRef}`,
                },
              });
              if (alreadyReversed) continue;

              const account = await tx.cashAccount.findUnique({ where: { id: cm.cashAccountId } });
              if (!account) continue;

              const balanceBefore = account.currentBalance;
              const balanceAfter = balanceBefore - cm.amount;

              await tx.cashMovement.create({
                data: {
                  cashAccountId: cm.cashAccountId,
                  companyId: sale.companyId,
                  type: 'saida',
                  amount: cm.amount,
                  balanceBefore,
                  balanceAfter,
                  origin: 'estorno_cancelamento',
                  description: `[ESTORNO] ${cm.description} — Cancelamento venda #${sale.saleNumber}`,
                  reference: `ESTORNO:${arRef}`,
                  userId: sessionUserId,
                  userName: session.user.name || 'Sistema',
                },
              });

              await tx.cashAccount.update({
                where: { id: cm.cashAccountId },
                data: { currentBalance: balanceAfter },
              });
            }
          }

          // ====== 2c. FIX C2: CANCEL INSTALLMENTS & RELEASE CUSTOMER CREDIT ======
          const saleInstallments = await tx.installment.findMany({
            where: { saleId: sale.id, companyId: sale.companyId },
          });

          if (saleInstallments.length > 0) {
            let totalCrediarioToReverse = 0;
            let totalUnpaidToRelease = 0;

            for (const inst of saleInstallments) {
              const paidAmount = Number(inst.paidAmount) || 0;

              if (inst.status === 'CANCELLED') {
                // Already cancelled — idempotency, skip
                continue;
              } else if (inst.status === 'RENEGOTIATED') {
                // Already renegotiated — saldo foi transferido para novas parcelas.
                // Apenas marca como cancelado para consistência, sem impacto financeiro.
                await tx.installment.update({
                  where: { id: inst.id },
                  data: {
                    status: 'CANCELLED',
                    notes: `${inst.notes ? inst.notes + ' | ' : ''}Cancelado: venda #${sale.saleNumber} cancelada (parcela já renegociada). Motivo: ${cancelReason}`,
                  },
                });
                continue;
              } else if (inst.status === 'PENDING' || inst.status === 'OVERDUE') {
                totalUnpaidToRelease += inst.amount;
                await tx.installment.update({
                  where: { id: inst.id },
                  data: {
                    status: 'CANCELLED',
                    notes: `${inst.notes ? inst.notes + ' | ' : ''}Cancelado: venda #${sale.saleNumber} cancelada. Motivo: ${cancelReason}`,
                  },
                });
              } else if (inst.status === 'PARTIAL') {
                totalCrediarioToReverse += paidAmount;
                totalUnpaidToRelease += (inst.amount - paidAmount);
                await tx.installment.update({
                  where: { id: inst.id },
                  data: {
                    status: 'CANCELLED',
                    notes: `${inst.notes ? inst.notes + ' | ' : ''}Cancelado: venda #${sale.saleNumber} cancelada. Pago R$ ${paidAmount.toFixed(2)} estornado. Motivo: ${cancelReason}`,
                  },
                });
              } else if (inst.status === 'PAID') {
                totalCrediarioToReverse += paidAmount;
                await tx.installment.update({
                  where: { id: inst.id },
                  data: {
                    status: 'CANCELLED',
                    notes: `${inst.notes ? inst.notes + ' | ' : ''}Cancelado: venda #${sale.saleNumber} cancelada. Pago R$ ${paidAmount.toFixed(2)} estornado. Motivo: ${cancelReason}`,
                  },
                });
              }
            }

            // Reverse cash from crediário payments
            if (totalCrediarioToReverse > 0) {
              const instIds = saleInstallments.map(i => i.id);
              const instPayments = await tx.installmentPayment.findMany({
                where: { installmentId: { in: instIds }, companyId: sale.companyId },
                orderBy: { createdAt: 'asc' },
              });

              // Group payments by cashAccountId for efficient reversal
              const cashReverseMap = new Map<string, number>();
              for (const ip of instPayments) {
                const prev = cashReverseMap.get(ip.cashAccountId) ?? 0;
                cashReverseMap.set(ip.cashAccountId, prev + ip.amount);
              }

              for (const [cashAccountId, reverseAmount] of cashReverseMap.entries()) {
                // Idempotency check
                const alreadyReversed = await tx.cashMovement.findFirst({
                  where: {
                    companyId: sale.companyId,
                    origin: 'estorno_crediario_cancelamento',
                    reference: `ESTORNO_CRED:${sale.id.slice(-8)}:${cashAccountId.slice(-6)}`,
                  },
                });
                if (alreadyReversed) continue;

                const account = await tx.cashAccount.findUnique({ where: { id: cashAccountId } });
                if (!account) continue;

                const balanceBefore = account.currentBalance;
                const balanceAfter = balanceBefore - reverseAmount;

                await tx.cashMovement.create({
                  data: {
                    cashAccountId,
                    companyId: sale.companyId,
                    type: 'saida',
                    amount: reverseAmount,
                    balanceBefore,
                    balanceAfter,
                    origin: 'estorno_crediario_cancelamento',
                    description: `[ESTORNO] Crediário cancelado — Venda #${sale.saleNumber} (${instPayments.length} pgto(s))`,
                    reference: `ESTORNO_CRED:${sale.id.slice(-8)}:${cashAccountId.slice(-6)}`,
                    userId: sessionUserId,
                    userName: session.user.name || 'Sistema',
                  },
                });

                await tx.cashAccount.update({
                  where: { id: cashAccountId },
                  data: { currentBalance: balanceAfter },
                });

                // Create estorno FR for the crediário cash reversal
                await tx.financialRecord.create({
                  data: {
                    description: `[ESTORNO] Recebimento crediário — Cancelamento venda #${sale.saleNumber}`,
                    amount: reverseAmount,
                    type: 'saida',
                    paymentMethod: 'estorno_crediario',
                    companyId: sale.companyId,
                    reference: sale.id,
                  },
                });
              }
            }

            // Restore CustomerCredit.usedLimit
            // The crediário receipt flow already decremented usedLimit for paid amounts.
            // Here we release only the UNPAID portion (pending/partial remaining).
            // Paid portions were already freed at receipt time.
            if (sale.customerId && totalUnpaidToRelease > 0) {
              const credit = await tx.customerCredit.findFirst({
                where: { customerId: sale.customerId, companyId: sale.companyId },
              });

              if (credit) {
                const newUsedLimit = Math.max(0, credit.usedLimit - totalUnpaidToRelease);
                await tx.customerCredit.update({
                  where: { id: credit.id },
                  data: { usedLimit: newUsedLimit },
                });
              }
            }
          }

          // ====== 3. CREATE ESTORNO FINANCIAL RECORDS ======
          const linkedFinRecords = await tx.financialRecord.findMany({
            where: { companyId: sale.companyId, reference: sale.id },
          });
          for (const fr of linkedFinRecords) {
            // Skip estorno of estornos (idempotency)
            if ((fr.description || '').startsWith('[ESTORNO]')) continue;
            await tx.financialRecord.create({
              data: {
                description: `[ESTORNO] ${fr.description} — Cancelamento venda #${sale.saleNumber}`,
                amount: fr.amount,
                type: fr.type === 'entrada' ? 'saida' : 'entrada',
                paymentMethod: fr.paymentMethod,
                categoryId: fr.categoryId,
                accountPlanId: fr.accountPlanId,
                companyId: sale.companyId,
                reference: sale.id,
              },
            });
          }

          // ====== 4. CANCEL ACCOUNTS RECEIVABLE ======
          await tx.accountReceivable.updateMany({
            where: { companyId: sale.companyId, saleId: sale.id, status: 'pendente' },
            data: { status: 'cancelada' },
          });
          await tx.accountReceivable.updateMany({
            where: { companyId: sale.companyId, saleId: sale.id, status: { in: ['recebido', 'recebida'] } },
            data: { status: 'cancelada' },
          });
          await tx.accountReceivable.updateMany({
            where: { companyId: sale.companyId, saleId: sale.id, status: 'parcial' },
            data: { status: 'cancelada' },
          });
          // Append note (separate query since updateMany doesn't support per-record string concat)
          const allRecs = await tx.accountReceivable.findMany({
            where: { companyId: sale.companyId, saleId: sale.id },
          });
          for (const ar of allRecs) {
            await tx.accountReceivable.update({
              where: { id: ar.id },
              data: {
                notes: `${ar.notes ? ar.notes + ' | ' : ''}Cancelado: venda #${sale.saleNumber} estornada. Motivo: ${cancelReason}`,
              },
            });
          }

          // ====== 5. MARK SALE PAYMENTS AS NOT RECEIVED ======
          await tx.salePayment.updateMany({
            where: { saleId: sale.id },
            data: { received: false, receivedDate: null },
          });

          // ====== 6. UPDATE CUSTOMER STATS ======
          if (sale.customerId) {
            const customerSales = await tx.sale.aggregate({
              where: { customerId: sale.customerId, status: 'concluida', id: { not: sale.id } },
              _sum: { total: true },
              _count: true,
            });
            await tx.customer.update({
              where: { id: sale.customerId },
              data: {
                totalPurchased: customerSales._sum?.total ?? 0,
                purchaseCount: customerSales._count ?? 0,
                avgTicket: (customerSales._sum?.total ?? 0) / Math.max(customerSales._count ?? 1, 1),
              },
            });
          }

          // ====== 7. AUDIT LOG ======
          try {
            await tx.activityLog.create({
              data: {
                action: 'sale_cancel',
                description: `Venda #${sale.saleNumber} cancelada. Total: R$ ${sale.total.toFixed(2)}. Motivo: ${cancelReason}`,
                entityType: 'sale',
                entityId: sale.id,
                companyId: sale.companyId,
                userId: sessionUserId,
                userName: session.user.name || 'Sistema',
                metadata: {
                  saleNumber: sale.saleNumber,
                  total: sale.total,
                  reason: cancelReason,
                  paymentsReversed: (sale.payments ?? []).length,
                  itemsRestored: (sale.items ?? []).length,
                  arReceivedReversed: receivedARs.length,
                  installmentsCancelled: saleInstallments.filter(i => i.status !== 'CANCELLED').length,
                  cancelledBy: session.user.name || session.user.email,
                  cancelledAt: new Date().toISOString(),
                },
              },
            });
          } catch (logErr) {
            console.error('Audit log error (non-critical):', logErr);
          }
        }

        // ====== 8. UPDATE SALE STATUS ======
        return await tx.sale.update({
          where: { id: params?.id },
          data: {
            status: 'cancelada',
            notes: isVendaFinalizada
              ? `${sale.notes ? sale.notes + ' | ' : ''}CANCELADA por ${session.user.name || 'Sistema'} em ${new Date().toLocaleDateString('pt-BR')}. Motivo: ${cancelReason}`
              : sale.notes,
            updatedById: sessionUserId,
            updatedByName: session.user.name || 'Sistema',
          },
        });
      }, { timeout: 30000 });

      // ═══ LEDGER: estornar lançamentos da venda cancelada ═══
      if (isVendaFinalizada) {
        try {
          await recordSaleCancellation({
            companyId: sale.companyId,
            saleId: sale.id,
            cancellationDate: new Date(),
          });
        } catch (ledgerErr) {
          console.error('[LEDGER] Erro ao estornar venda no ledger:', ledgerErr);
        }
      }

      return NextResponse.json(updated);
    }

    // ====== OTHER STATUS CHANGES (e.g. convert orcamento to sale) ======
    const updated = await prisma.sale.update({
      where: { id: params?.id },
      data: { status: body?.status },
    });
    return NextResponse.json(updated);
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: 'Erro ao atualizar' }, { status: 500 });
  }
}

// DELETE - Remove orçamento and restore stock
export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const companyId = session.user.companyId;
    const sale = await prisma.sale.findFirst({
      where: { id: params?.id, companyId },
      include: { items: true },
    });

    if (!sale) return NextResponse.json({ error: 'Registro não encontrado' }, { status: 404 });
    if (sale.status !== 'orcamento') {
      return NextResponse.json({ error: 'Apenas orçamentos podem ser excluídos' }, { status: 400 });
    }

    // Vendedor can only delete their own orçamentos
    const deleteUserRole = (session.user as any).role;
    if (deleteUserRole === 'vendedor' && sale.sellerId !== session.user.id) {
      return NextResponse.json({ error: 'Vendedor só pode excluir seus próprios orçamentos' }, { status: 403 });
    }

    // Restore stock for each item
    for (const item of sale?.items ?? []) {
      if (item?.variationId) {
        await prisma.productVariation.update({
          where: { id: item.variationId },
          data: { stockQuantity: { increment: item?.quantity ?? 0 } },
        });
        const totalStock = await prisma.productVariation.aggregate({
          where: { productId: item.productId, isActive: true },
          _sum: { stockQuantity: true },
        });
        await prisma.product.update({
          where: { id: item.productId },
          data: { stockQuantity: totalStock._sum?.stockQuantity ?? 0 },
        });
      } else {
        await prisma.product.update({
          where: { id: item?.productId },
          data: { stockQuantity: { increment: item?.quantity ?? 0 } },
        });
      }
      await prisma.inventoryMovement.create({
        data: {
          productId: item?.productId,
          variationId: item?.variationId ?? null,
          companyId: sale?.companyId,
          type: 'entrada',
          quantity: item?.quantity ?? 0,
          reason: 'Orçamento excluído',
          reference: sale?.id ?? '',
        },
      });
    }

    // Delete the sale (cascade deletes items)
    await prisma.sale.delete({ where: { id: params?.id } });

    return NextResponse.json({ success: true, message: 'Orçamento excluído e estoque restaurado' });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: 'Erro ao excluir orçamento' }, { status: 500 });
  }
}
