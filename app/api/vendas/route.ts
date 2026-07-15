export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { validateSaleData } from '@/lib/data-guards';
import { recordSale } from '@/lib/ledger-engine';
import { syncOverdueInstallments } from '@/lib/crediario-sync';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const companyId = session.user.companyId;
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') ?? '1');
    const limit = parseInt(url.searchParams.get('limit') ?? '20');
    const status = url.searchParams.get('status') ?? '';
    const search = url.searchParams.get('search') ?? '';

    const where: any = { companyId };
    // Vendedor can only see their own sales
    if (session.user.role === 'vendedor') {
      where.sellerId = session.user.id;
    }
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { customer: { name: { contains: search, mode: 'insensitive' } } },
        { seller: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [sales, total] = await Promise.all([
      prisma.sale.findMany({
        where,
        include: {
          customer: { select: { id: true, name: true } },
          seller: { select: { id: true, name: true } },
          items: { include: { product: { select: { id: true, name: true } }, variation: { select: { id: true, color: true, size: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.sale.count({ where }),
    ]);

    return NextResponse.json({ sales: sales ?? [], total, pages: Math.ceil(total / limit) });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: 'Erro ao buscar vendas' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const companyId = session.user.companyId;
    const body = await request.json();
    const { customerId, sellerId: bodySellerId, items, paymentMethod, discount, notes } = body ?? {};

    // === DATA GUARD: validação de integridade antes de gravar ===
    const guard = validateSaleData({ items, discount, payments: body?.payments });
    if (!guard.valid) return NextResponse.json({ error: guard.errors.join(' | ') }, { status: 400 });

    if (!items || (items?.length ?? 0) === 0) {
      return NextResponse.json({ error: 'Adicione pelo menos um item' }, { status: 400 });
    }

    // Validate sellerId: must be a valid User.id (Sale.sellerId references User, not Seller)
    let validSellerId = session.user.id;
    if (bodySellerId) {
      const sellerUser = await prisma.user.findUnique({ where: { id: bodySellerId }, select: { id: true } });
      if (sellerUser) {
        validSellerId = sellerUser.id;
      } else {
        // bodySellerId might be a Seller.id — resolve to userId
        const seller = await prisma.seller.findUnique({ where: { id: bodySellerId }, select: { userId: true } });
        if (seller?.userId) {
          validSellerId = seller.userId;
        }
        // Otherwise fall back to session.user.id (already set)
      }
    }

    // Calculate totals
    let subtotal = 0;
    const processedItems: any[] = [];
    for (const item of items ?? []) {
      const product = await prisma.product.findUnique({ where: { id: item?.productId } });
      if (!product) {
        return NextResponse.json({ error: `Produto não encontrado: ${item?.productId}` }, { status: 400 });
      }
      // Check stock on variation if provided, else product level
      if (item?.variationId) {
        const variation = await prisma.productVariation.findUnique({ where: { id: item.variationId } });
        if (!variation) return NextResponse.json({ error: `Variação não encontrada` }, { status: 400 });
        if ((variation.stockQuantity ?? 0) < (item?.quantity ?? 0)) {
          return NextResponse.json({ error: `Estoque insuficiente para ${product?.name} (${variation.color ?? ''} ${variation.size ?? ''})` }, { status: 400 });
        }
      } else {
        if ((product?.stockQuantity ?? 0) < (item?.quantity ?? 0)) {
          return NextResponse.json({ error: `Estoque insuficiente para ${product?.name}` }, { status: 400 });
        }
      }
      const unitPrice = item?.unitPrice ?? product.salePrice ?? 0;
      const itemDiscount = item?.discount ?? 0;
      const itemTotal = (unitPrice * (item?.quantity ?? 1)) - itemDiscount;
      subtotal += itemTotal;
      processedItems.push({
        productId: item?.productId,
        variationId: item?.variationId ?? null,
        quantity: item?.quantity ?? 1,
        unitPrice,
        discount: itemDiscount,
        total: itemTotal,
        // Price table tracking fields
        priceTableId: item?.priceTableId ?? null,
        priceTableName: item?.priceTableName ?? null,
        originalPrice: item?.originalPrice ?? null,
        appliedPrice: item?.appliedPrice ?? null,
        priceDiscount: item?.priceDiscount ?? null,
      });
    }

    const totalDiscount = parseFloat(discount) || 0;
    const total = subtotal - totalDiscount;
    const requestedStatus = body?.status === 'orcamento' ? 'orcamento' : 'concluida';

    // ═══ Pré-carregar lookups (somente leitura) fora da transação ═══
    const isConcluida = requestedStatus !== 'orcamento';
    const paymentsData = body?.payments;
    const vendaCat = isConcluida ? await prisma.financialCategory.findFirst({ where: { companyId, name: 'Vendas' } }) : null;
    const vendaAccountPlan = isConcluida ? await prisma.accountPlan.findFirst({ where: { companyId, code: '1.1', isActive: true } }) : null;
    const taxaAccountPlan = isConcluida ? await prisma.accountPlan.findFirst({ where: { companyId, code: '3.4.3', isActive: true } }) : null;
    const taxaCat = isConcluida ? await prisma.financialCategory.findFirst({ where: { companyId, name: { contains: 'Taxa', mode: 'insensitive' } } }) : null;
    const vendaAccountPlanId = vendaAccountPlan?.id || null;
    const taxaAccountPlanId = taxaAccountPlan?.id || null;
    // Pré-buscar métodos de pagamento (evita findUnique dentro da transação)
    const methodIds = Array.isArray(paymentsData) ? Array.from(new Set(paymentsData.map((p: any) => p?.paymentMethodId).filter(Boolean))) : [];
    const methodsList = methodIds.length ? await prisma.paymentMethod.findMany({ where: { id: { in: methodIds as string[] } } }) : [];
    const methodsById = new Map(methodsList.map((m: any) => [m.id, m]));

    // Sincronizar parcelas vencidas antes de validar crediário
    const crediarioData = body?.crediario;
    if (crediarioData && customerId && requestedStatus === 'concluida') {
      await syncOverdueInstallments(companyId);
    }

    // ═══ FIX C3: transação atômica — venda + baixa de estoque + pagamentos ═══
    // Toda a gravação ocorre numa única transação (sem escrita parcial). A baixa
    // de estoque usa updateMany condicional (stockQuantity >= qtd), atômico no
    // banco: impede venda além do disponível (sem estoque negativo) mesmo sob
    // concorrência. Se o estoque for insuficiente no momento da baixa, lança erro
    // e TODA a venda é revertida.
    const sale = await prisma.$transaction(async (tx) => {
      // Numeração sequencial POR EMPRESA: incremento atômico no registro da empresa.
      // O update gera um lock de linha que serializa vendas concorrentes da mesma
      // empresa, garantindo números únicos e sem buracos. saleNumber global permanece
      // como referência técnica interna (autoincrement).
      const companyCounter = await tx.company.update({
        where: { id: companyId },
        data: { lastSaleNumber: { increment: 1 } },
        select: { lastSaleNumber: true },
      });

      const createdSale = await tx.sale.create({
        data: {
          companySaleNumber: companyCounter.lastSaleNumber,
          customerId: customerId || null,
          sellerId: validSellerId,
          companyId,
          subtotal,
          discount: totalDiscount,
          total,
          paymentMethod: paymentMethod ?? (requestedStatus === 'orcamento' ? 'orcamento' : 'dinheiro'),
          status: requestedStatus,
          notes: notes ?? null,
          createdById: session.user.id,
          createdByName: session.user.name || 'Sistema',
          items: {
            create: processedItems,
          },
        },
        include: {
          customer: { select: { name: true } },
          seller: { select: { name: true } },
          items: { include: { product: { select: { name: true } } } },
        },
      });

      // Baixa de estoque ATÔMICA + criação de movimentos
      for (const item of processedItems ?? []) {
        const qty = item?.quantity ?? 0;
        if (item?.variationId) {
          const res = await tx.productVariation.updateMany({
            where: { id: item.variationId, stockQuantity: { gte: qty } },
            data: { stockQuantity: { decrement: qty } },
          });
          if (res.count === 0) throw new Error('ESTOQUE_INSUFICIENTE');
          // Recalcular estoque total do produto
          const totalStock = await tx.productVariation.aggregate({
            where: { productId: item.productId, isActive: true },
            _sum: { stockQuantity: true },
          });
          await tx.product.update({
            where: { id: item.productId },
            data: { stockQuantity: totalStock._sum?.stockQuantity ?? 0 },
          });
        } else {
          const res = await tx.product.updateMany({
            where: { id: item?.productId, stockQuantity: { gte: qty } },
            data: { stockQuantity: { decrement: qty } },
          });
          if (res.count === 0) throw new Error('ESTOQUE_INSUFICIENTE');
        }
        await tx.inventoryMovement.create({
          data: {
            productId: item?.productId,
            variationId: item?.variationId ?? null,
            companyId,
            type: 'saida',
            quantity: qty,
            reason: 'Venda',
            reference: createdSale?.id ?? '',
          },
        });
      }

      // Orçamento: sem processamento financeiro (preserva regra de negócio)
      if (!isConcluida) {
        return createdSale;
      }

      // Processar pagamentos (suporte a pagamento dividido)
      if (paymentsData && Array.isArray(paymentsData) && paymentsData.length > 0) {
        for (const p of paymentsData) {
          const method = methodsById.get(p.paymentMethodId);
          const isCrediarioPayment = method?.type === 'crediario';

          // Pagamentos crediário NÃO entram no fluxo financeiro regular
          // (são processados via installments abaixo)
          if (isCrediarioPayment) {
            await tx.salePayment.create({
              data: {
                saleId: createdSale.id,
                paymentMethodId: p.paymentMethodId,
                amount: p.amount,
                feePercent: 0,
                feeAmount: 0,
                netAmount: p.amount,
                expectedDate: new Date(),
                cashAccountId: p.cashAccountId,
                companyId,
                received: false,
              },
            });
            continue; // Skip financial processing for crediário
          }

          await tx.salePayment.create({
            data: {
              saleId: createdSale.id,
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

          const isImmediate = (method?.defaultDays ?? 0) === 0;

          if (isImmediate) {
            // Imediato: credita caixa (atômico) e cria registro financeiro
            await tx.cashAccount.update({
              where: { id: p.cashAccountId },
              data: { currentBalance: { increment: p.netAmount ?? p.amount } },
            });
            await tx.financialRecord.create({
              data: {
                description: `Venda #${createdSale?.saleNumber ?? ''} - ${method?.name ?? 'Pagamento'}`,
                amount: p.netAmount ?? p.amount,
                type: 'entrada',
                paymentMethod: method?.name ?? paymentMethod ?? 'dinheiro',
                categoryId: vendaCat?.id ?? null,
                accountPlanId: vendaAccountPlanId,
                companyId,
                reference: createdSale?.id ?? '',
              },
            });
            await tx.salePayment.updateMany({
              where: { saleId: createdSale.id, paymentMethodId: p.paymentMethodId },
              data: { received: true, receivedDate: new Date() },
            });
          } else {
            // Futuro: cria conta a receber
            await tx.accountReceivable.create({
              data: {
                description: `Venda #${createdSale?.saleNumber ?? ''} - ${method?.name ?? 'Cartão'}`,
                amount: p.netAmount ?? p.amount,
                dueDate: new Date(p.expectedDate),
                status: 'pendente',
                saleId: createdSale.id,
                accountPlanId: vendaAccountPlanId,
                companyId,
                notes: `Taxa: ${p.feePercent ?? 0}% | Bruto: R$ ${(p.amount ?? 0).toFixed(2)} | Líquido: R$ ${(p.netAmount ?? p.amount).toFixed(2)}`,
              },
            });
            // Regime de competência: receita reconhecida pela Sale (DRE lê Sale.subtotal).
            // FR de entrada só é criado quando o AR for recebido (com CM + caixa).
            if ((p.feeAmount ?? 0) > 0) {
              await tx.financialRecord.create({
                data: {
                  description: `Taxa ${method?.name ?? 'Cartão'} - Venda #${createdSale?.saleNumber ?? ''}`,
                  amount: p.feeAmount,
                  type: 'saida',
                  paymentMethod: method?.name ?? 'taxa',
                  categoryId: taxaCat?.id ?? null,
                  accountPlanId: taxaAccountPlanId,
                  companyId,
                  reference: createdSale?.id ?? '',
                },
              });
            }
          }
        }
      } else {
        // Fallback: sem pagamentos estruturados, comportamento legado
        await tx.financialRecord.create({
          data: {
            description: `Venda #${createdSale?.saleNumber ?? ''}`,
            amount: total,
            type: 'entrada',
            paymentMethod: paymentMethod ?? 'dinheiro',
            categoryId: vendaCat?.id ?? null,
            accountPlanId: vendaAccountPlanId,
            companyId,
            reference: createdSale?.id ?? '',
          },
        });
      }

      // ═══ CREDIÁRIO: gerar parcelas se configurado ═══
      const crediario = body?.crediario; // { parcelas: number, entrada?: number, termDays?: number }
      if (crediario && customerId && isConcluida) {
        const numParcelas = Number(crediario.parcelas) || 1;
        const entrada = Number(crediario.entrada) || 0;
        const saldoCrediario = total - entrada;
        const termDays = Number(crediario.termDays) || 30;

        if (saldoCrediario > 0 && numParcelas > 0) {
          // Verificar crédito do cliente
          const credit = await tx.customerCredit.findFirst({
            where: { customerId, companyId },
          });
          if (credit) {
            if (credit.status !== 'ACTIVE') {
              throw new Error('CREDIARIO_BLOQUEADO');
            }
            const available = credit.creditLimit - credit.usedLimit;
            if (saldoCrediario > available + 0.01) {
              throw new Error('CREDIARIO_LIMITE_INSUFICIENTE');
            }
            // Atualizar limite utilizado
            await tx.customerCredit.update({
              where: { id: credit.id },
              data: { usedLimit: { increment: saldoCrediario } },
            });
          }

          // Gerar parcelas
          const valorParcela = Math.floor((saldoCrediario / numParcelas) * 100) / 100;
          const resto = Math.round((saldoCrediario - valorParcela * numParcelas) * 100) / 100;

          for (let i = 1; i <= numParcelas; i++) {
            const dueDate = new Date(createdSale.createdAt);
            dueDate.setDate(dueDate.getDate() + termDays * i);
            const amount = i === numParcelas ? valorParcela + resto : valorParcela;

            await tx.installment.create({
              data: {
                saleId: createdSale.id,
                customerId,
                companyId,
                installmentNumber: i,
                amount,
                dueDate,
                status: 'PENDING',
              },
            });
          }

          // Criar AccountReceivable para o total do crediário
          await tx.accountReceivable.create({
            data: {
              description: `Crediário - Venda #${createdSale?.saleNumber ?? ''} (${numParcelas}x)`,
              amount: saldoCrediario,
              dueDate: new Date(new Date(createdSale.createdAt).getTime() + termDays * numParcelas * 86400000),
              status: 'pendente',
              saleId: createdSale.id,
              customerId,
              accountPlanId: vendaAccountPlanId,
              companyId,
              notes: `Crediário: ${numParcelas}x de R$ ${valorParcela.toFixed(2)} | Prazo: ${termDays} dias`,
            },
          });
        }
      }

      return createdSale;
    }, { timeout: 20000, maxWait: 20000 });

    // Orçamento: retorna sem processamento financeiro/ledger/stats
    if (!isConcluida) {
      return NextResponse.json(sale, { status: 201 });
    }

    // ═══ LEDGER: registrar lançamentos de dupla-entrada ═══
    try {
      // Calcular CMV (custo das mercadorias vendidas)
      let cmvTotal = 0;
      for (const item of processedItems) {
        const prod = await prisma.product.findUnique({
          where: { id: item.productId },
          select: { avgCost: true, costPrice: true },
        });
        const unitCost = prod?.avgCost || prod?.costPrice || 0;
        cmvTotal += unitCost * (item.quantity ?? 1);
      }
      // Calcular split à vista / a prazo para ledger proporcional
      let cashAmount = 0;
      let receivableAmount = 0;
      if (paymentsData && Array.isArray(paymentsData) && paymentsData.length > 0) {
        for (const p of paymentsData) {
          const method = methodsById.get(p.paymentMethodId);
          const isCrediarioLedger = method?.type === 'crediario';
          const isImmediate = !isCrediarioLedger && (method?.defaultDays ?? 0) === 0;
          const net = p.netAmount ?? p.amount ?? 0;
          if (isImmediate) {
            cashAmount += net;
          } else {
            receivableAmount += net;
          }
        }
      } else {
        // Fallback legado (sem pagamentos estruturados) — tudo à vista
        cashAmount = total;
      }
      const hasReceivables = receivableAmount > 0;
      // Somar taxas
      const totalFees = paymentsData?.reduce((s: number, p: any) => s + (p.feeAmount ?? 0), 0) ?? 0;

      await recordSale({
        companyId,
        saleId: sale.id,
        saleDate: sale.createdAt,
        totalAmount: total,
        cmvAmount: cmvTotal,
        feeAmount: totalFees,
        hasReceivables,
        cashAmount,
        receivableAmount,
      });
    } catch (ledgerErr) {
      console.error('[LEDGER] Erro ao registrar venda no ledger:', ledgerErr);
      // Ledger failure não impede a venda — apenas loga
    }

    // Update customer stats
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

    return NextResponse.json(sale, { status: 201 });
  } catch (error: any) {
    console.error(error);
    // Trava de estoque (FIX C3): baixa atômica falhou por estoque insuficiente
    if (error?.message === 'ESTOQUE_INSUFICIENTE') {
      return NextResponse.json({ error: 'Estoque insuficiente para concluir a venda' }, { status: 409 });
    }
    if (error?.message === 'CREDIARIO_BLOQUEADO') {
      return NextResponse.json({ error: 'Cliente bloqueado por inadimplência no crediário' }, { status: 403 });
    }
    if (error?.message === 'CREDIARIO_LIMITE_INSUFICIENTE') {
      return NextResponse.json({ error: 'Limite de crediário insuficiente para esta venda' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Erro ao criar venda' }, { status: 500 });
  }
}