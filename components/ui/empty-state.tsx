'use client';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { LucideIcon, Package, ShoppingCart, Users, DollarSign, BarChart3, FileText, Inbox } from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
  variant?: 'default' | 'compact';
}

const defaultIcons: Record<string, LucideIcon> = {
  vendas: ShoppingCart,
  produtos: Package,
  clientes: Users,
  financeiro: DollarSign,
  relatorios: BarChart3,
  documentos: FileText,
};

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  actionLabel,
  onAction,
  className,
  variant = 'default',
}: EmptyStateProps) {
  const isCompact = variant === 'compact';

  return (
    <div className={cn(
      'flex flex-col items-center justify-center text-center animate-scale-in',
      isCompact ? 'py-6 px-4' : 'py-12 px-6',
      className
    )}>
      <div className={cn(
        'rounded-2xl flex items-center justify-center mb-4 animate-float',
        isCompact ? 'w-12 h-12 bg-muted/60' : 'w-16 h-16 bg-muted/60'
      )}>
        <Icon className={cn(
          'text-muted-foreground/40',
          isCompact ? 'w-6 h-6' : 'w-8 h-8'
        )} />
      </div>
      <h3 className={cn(
        'font-semibold text-foreground/80 mb-1',
        isCompact ? 'text-sm' : 'text-base'
      )}>
        {title}
      </h3>
      {description && (
        <p className={cn(
          'text-muted-foreground max-w-xs',
          isCompact ? 'text-xs' : 'text-sm'
        )}>
          {description}
        </p>
      )}
      {actionLabel && onAction && (
        <Button
          onClick={onAction}
          size={isCompact ? 'sm' : 'default'}
          className="mt-4 press-scale"
          variant="outline"
        >
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

export { defaultIcons as emptyStateIcons };
