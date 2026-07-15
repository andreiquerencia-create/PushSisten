'use client';

import { useRef, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface CurrencyInputProps {
  value: number;
  onChange: (value: number) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  autoFocus?: boolean;
}

/**
 * Banking-style currency input.
 * Digits enter from the right, always shows 2 decimals.
 * 1 → 0,01 | 10 → 0,10 | 100 → 1,00 | 1000 → 10,00 | 100000 → 1.000,00
 */
export function CurrencyInput({ value, onChange, className, placeholder = '0,00', disabled, id, autoFocus }: CurrencyInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const display = value > 0
    ? value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '';

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '');
    if (!raw) { onChange(0); return; }
    const cents = parseInt(raw, 10);
    if (isNaN(cents)) { onChange(0); return; }
    onChange(cents / 100);
  }, [onChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    // Allow: backspace, delete, tab, escape, enter, arrows
    if (['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    // Allow: Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
    if ((e.ctrlKey || e.metaKey) && ['a', 'c', 'v', 'x'].includes(e.key.toLowerCase())) return;
    // Block non-digits
    if (!/^[0-9]$/.test(e.key)) {
      e.preventDefault();
    }
  }, []);

  return (
    <Input
      ref={inputRef}
      id={id}
      type="text"
      inputMode="numeric"
      value={display}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      disabled={disabled}
      autoFocus={autoFocus}
      className={cn('font-mono text-right', className)}
    />
  );
}
