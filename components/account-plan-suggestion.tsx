'use client';

import { useEffect, useState, useRef } from 'react';
import { Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Suggestion {
  accountPlanId: string;
  code: string;
  name: string;
  type: string;
  label: string;
  matchedKeyword: string;
}

interface Props {
  description: string;
  direction?: 'entrada' | 'saida';
  onApply: (accountPlanId: string) => void;
  currentAccountPlanId?: string;
  /** Optional - if true, debounce timer */
  debounceMs?: number;
  /** If false, render nothing visually if no match */
  silent?: boolean;
}

export default function AccountPlanSuggestion({
  description,
  direction = 'saida',
  onApply,
  currentAccountPlanId,
  debounceMs = 500,
  silent = false,
}: Props) {
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const lastDescriptionRef = useRef<string>('');

  useEffect(() => {
    if (!description || description.trim().length < 3) {
      setSuggestion(null);
      return;
    }
    
    if (description === lastDescriptionRef.current) return;
    
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      try {
        setLoading(true);
        const r = await fetch('/api/plano-contas/sugestao', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ description, direction }),
        });
        if (r.ok) {
          const d = await r.json();
          if (d.suggestion) {
            lastDescriptionRef.current = description;
            setSuggestion(d.suggestion);
            setDismissed(false);
          } else {
            setSuggestion(null);
          }
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }, debounceMs);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [description, direction, debounceMs]);

  // Hide if already applied
  if (!suggestion || dismissed) return null;
  if (currentAccountPlanId === suggestion.accountPlanId) return null;
  if (silent) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-2 mt-1 rounded-lg bg-gradient-to-r from-violet-50 to-blue-50 dark:from-violet-950/30 dark:to-blue-950/30 border border-violet-200 dark:border-violet-800 text-sm">
      <Sparkles className="w-4 h-4 text-violet-600 dark:text-violet-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="text-violet-700 dark:text-violet-300 font-medium">Sugestão:</span>{' '}
        <span className="text-foreground font-medium">{suggestion.code} • {suggestion.name}</span>
      </div>
      <Button
        type="button"
        size="sm"
        variant="default"
        className="h-7 px-2 text-xs bg-violet-600 hover:bg-violet-700"
        onClick={() => {
          onApply(suggestion.accountPlanId);
          setDismissed(true);
        }}
      >
        Aplicar
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="h-7 w-7 p-0"
        onClick={() => setDismissed(true)}
      >
        <X className="w-3 h-3" />
      </Button>
    </div>
  );
}
