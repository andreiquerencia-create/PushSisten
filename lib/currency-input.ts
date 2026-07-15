/**
 * PUSHY ERP — Banking-style currency input
 * Formats as user types: 1000 → 10,00 → 100,00 → 1.000,00
 * Digits only, right-to-left fill, always 2 decimal places.
 */

/** Parse a BRL formatted string → float (cents-based) */
export function parseBRL(value: string): number {
  if (!value) return 0;
  // Strip everything that isn't a digit
  const digits = value.replace(/\D/g, '');
  if (!digits) return 0;
  return parseInt(digits, 10) / 100;
}

/** Format a float → BRL display string (no R$) */
export function formatBRL(value: number): string {
  if (isNaN(value) || value === 0) return '0,00';
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Format raw digit string from input → display string */
export function formatCentsInput(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits || digits === '0') return '';
  // Remove leading zeros but keep at least 1
  const trimmed = digits.replace(/^0+/, '') || '0';
  const cents = parseInt(trimmed, 10);
  if (isNaN(cents) || cents === 0) return '';
  return (cents / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** 
 * Handle onChange for a currency input.
 * Returns { display: string for the input, value: number for state }
 */
export function handleCurrencyChange(inputValue: string): { display: string; value: number } {
  const digits = inputValue.replace(/\D/g, '');
  if (!digits) return { display: '', value: 0 };
  const cents = parseInt(digits, 10);
  if (isNaN(cents) || cents === 0) return { display: '', value: 0 };
  const numericValue = cents / 100;
  const display = numericValue.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return { display, value: numericValue };
}
