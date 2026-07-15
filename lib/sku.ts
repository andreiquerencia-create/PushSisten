/**
 * SKU Generation System — Multi-tenant Sequential SKU
 * 
 * Formato padrão: SKU-000001 (prefixo + padding 6 dígitos)
 * Sequência isolada por empresa (companyId)
 * 
 * Arquitetura preparada para futuro:
 * - SKU por categoria (ex: CAM-000001)
 * - SKU por variação (cor/tamanho)
 * - Prefixos personalizados por empresa
 * - Geração de etiquetas
 * - Integração marketplace
 */

import { prisma } from '@/lib/db';

const DEFAULT_PREFIX = 'SKU';
const PADDING_LENGTH = 6;

/**
 * Extrai o número sequencial de um SKU no formato PREFIX-NNNNNN
 * Retorna 0 se não conseguir extrair
 */
export function extractSkuNumber(sku: string): number {
  if (!sku) return 0;
  // Match pattern: qualquer prefixo + hífen + dígitos
  const match = sku.match(/^[A-Z]+-?(\d+)$/i);
  if (match) {
    return parseInt(match[1], 10) || 0;
  }
  // Tentar extrair apenas dígitos do final
  const digitsMatch = sku.match(/(\d+)$/);
  if (digitsMatch) {
    return parseInt(digitsMatch[1], 10) || 0;
  }
  return 0;
}

/**
 * Formata um SKU com prefixo e padding
 * Ex: formatSku('SKU', 42) => 'SKU-000042'
 */
export function formatSku(prefix: string, number: number): string {
  return `${prefix}-${String(number).padStart(PADDING_LENGTH, '0')}`;
}

/**
 * Gera o próximo SKU sequencial para uma empresa
 * 
 * 1. Busca todos os SKUs da empresa que seguem o padrão PREFIX-NNNNNN
 * 2. Encontra o maior número
 * 3. Incrementa +1
 * 4. Retorna formatado
 * 
 * @param companyId - ID da empresa (tenant)
 * @param prefix - Prefixo do SKU (padrão: 'SKU')
 * @returns Próximo SKU formatado
 */
export async function generateNextSku(
  companyId: string,
  prefix: string = DEFAULT_PREFIX
): Promise<string> {
  // Buscar todos os produtos da empresa que têm SKU
  const products = await prisma.product.findMany({
    where: {
      companyId,
      sku: { not: null },
    },
    select: { sku: true },
  });

  let maxNumber = 0;

  for (const product of products) {
    if (product.sku) {
      const num = extractSkuNumber(product.sku);
      if (num > maxNumber) {
        maxNumber = num;
      }
    }
  }

  return formatSku(prefix, maxNumber + 1);
}

/**
 * Verifica se um SKU já existe na empresa
 * 
 * @param sku - SKU a verificar
 * @param companyId - ID da empresa
 * @param excludeProductId - ID do produto a excluir (para edição)
 * @returns true se já existe duplicado
 */
export async function isSkuDuplicate(
  sku: string,
  companyId: string,
  excludeProductId?: string
): Promise<boolean> {
  if (!sku) return false;

  const where: any = {
    companyId,
    sku: { equals: sku, mode: 'insensitive' as const },
    isActive: true,
  };

  if (excludeProductId) {
    where.id = { not: excludeProductId };
  }

  const existing = await prisma.product.findFirst({
    where,
    select: { id: true },
  });

  return !!existing;
}
