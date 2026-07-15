/**
 * Numeração de vendas para EXIBIÇÃO ao usuário.
 *
 * Cada empresa possui sua própria sequência (companySaleNumber), iniciando em 1.
 * Para telas/comprovantes usamos sempre este número formatado com zeros à esquerda
 * (mínimo de 5 dígitos): 1 -> "00001", 42 -> "00042", 123456 -> "123456".
 *
 * O saleNumber global (autoincrement) permanece como referência técnica interna e
 * é usado como fallback caso companySaleNumber ainda não exista (registros antigos).
 */
export function formatSaleNumber(
  companySaleNumber: number | null | undefined,
  fallbackSaleNumber?: number | null | undefined,
): string {
  const value =
    companySaleNumber != null
      ? companySaleNumber
      : fallbackSaleNumber != null
        ? fallbackSaleNumber
        : 0;
  return String(value).padStart(5, '0');
}
