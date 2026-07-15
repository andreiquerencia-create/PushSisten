import { prisma } from '@/lib/db';

/**
 * Calculates weighted average cost:
 * newAvg = (currentStock * currentAvgCost + newQty * newUnitCost) / (currentStock + newQty)
 */
export function calculateWeightedAvgCost(
  currentStock: number,
  currentAvgCost: number,
  newQty: number,
  newUnitCost: number
): number {
  const totalStock = currentStock + newQty;
  if (totalStock <= 0) return newUnitCost;
  const totalValue = (currentStock * currentAvgCost) + (newQty * newUnitCost);
  return Math.round((totalValue / totalStock) * 100) / 100;
}

/**
 * Updates product/variation cost fields and records history
 */
export async function updateProductCosts(params: {
  productId: string;
  variationId?: string | null;
  companyId: string;
  newQty: number;
  unitCost: number;
  reason: string;
  reference?: string;
  userId?: string;
  userName?: string;
}) {
  const { productId, variationId, companyId, newQty, unitCost, reason, reference, userId, userName } = params;
  const costHistoryEntries: any[] = [];

  if (variationId) {
    const variation = await prisma.productVariation.findUnique({ where: { id: variationId } });
    if (variation) {
      const previousAvg = variation.avgCost || variation.costPrice || 0;
      const newAvg = calculateWeightedAvgCost(variation.stockQuantity, previousAvg, newQty, unitCost);

      await prisma.productVariation.update({
        where: { id: variationId },
        data: {
          avgCost: newAvg,
          lastCost: unitCost,
          replacementCost: unitCost,
          costPrice: newAvg,
        },
      });

      costHistoryEntries.push(
        { productId, variationId, companyId, previousCost: previousAvg, newCost: newAvg, costType: 'avg_cost', reason, reference, userId, userName },
        { productId, variationId, companyId, previousCost: variation.lastCost || 0, newCost: unitCost, costType: 'last_cost', reason, reference, userId, userName }
      );

      return { previousAvgCost: previousAvg, newAvgCost: newAvg };
    }
  }

  // Update product-level costs
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (product) {
    const previousAvg = product.avgCost || product.costPrice || 0;
    const newAvg = calculateWeightedAvgCost(product.stockQuantity, previousAvg, newQty, unitCost);

    await prisma.product.update({
      where: { id: productId },
      data: {
        avgCost: newAvg,
        lastCost: unitCost,
        replacementCost: unitCost,
        costPrice: newAvg,
      },
    });

    costHistoryEntries.push(
      { productId, companyId, previousCost: previousAvg, newCost: newAvg, costType: 'avg_cost', reason, reference, userId, userName },
      { productId, companyId, previousCost: product.lastCost || 0, newCost: unitCost, costType: 'last_cost', reason, reference, userId, userName }
    );

    // Record cost history
    if (costHistoryEntries.length > 0) {
      await prisma.costHistory.createMany({ data: costHistoryEntries }).catch(e => console.error('Cost history error:', e));
    }

    return { previousAvgCost: previousAvg, newAvgCost: newAvg };
  }

  return { previousAvgCost: 0, newAvgCost: unitCost };
}

/**
 * Calculate gross margin for a sale
 */
export function calcGrossMargin(salePrice: number, costPrice: number): { marginPercent: number; marginValue: number } {
  if (salePrice <= 0) return { marginPercent: 0, marginValue: 0 };
  const marginValue = salePrice - costPrice;
  const marginPercent = (marginValue / salePrice) * 100;
  return {
    marginPercent: Math.round(marginPercent * 100) / 100,
    marginValue: Math.round(marginValue * 100) / 100,
  };
}

/**
 * Calculate net margin considering fees, commissions, freight
 */
export function calcNetMargin(params: {
  salePrice: number;
  costPrice: number;
  feeAmount?: number;
  commissionAmount?: number;
  freightCost?: number;
  discountAmount?: number;
}): { netMarginPercent: number; netMarginValue: number } {
  const { salePrice, costPrice, feeAmount = 0, commissionAmount = 0, freightCost = 0, discountAmount = 0 } = params;
  const effectiveSale = salePrice - discountAmount;
  if (effectiveSale <= 0) return { netMarginPercent: 0, netMarginValue: 0 };
  const totalCosts = costPrice + feeAmount + commissionAmount + freightCost;
  const netValue = effectiveSale - totalCosts;
  const netPercent = (netValue / effectiveSale) * 100;
  return {
    netMarginPercent: Math.round(netPercent * 100) / 100,
    netMarginValue: Math.round(netValue * 100) / 100,
  };
}
