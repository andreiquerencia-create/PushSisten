'use client';

import { cn } from '@/lib/utils';

/** Single shimmer bar */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('skeleton h-4 w-full', className)} {...props} />;
}

/** KPI card skeleton */
export function KpiSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card-premium rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Skeleton className="w-9 h-9 rounded-xl" />
          </div>
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-5 w-24" />
        </div>
      ))}
    </div>
  );
}

/** Table skeleton */
export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2">
      <div className="flex gap-4 px-4 py-3">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3" style={{ width: `${100 / cols}%` }} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 px-4 py-3 border-b border-border/20">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className="h-4" style={{ width: `${100 / cols}%` }} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Chart skeleton */
export function ChartSkeleton({ height = 'h-64' }: { height?: string }) {
  return (
    <div className={cn('relative rounded-xl overflow-hidden', height)}>
      <Skeleton className="absolute inset-0 rounded-xl" />
      <div className="absolute bottom-4 left-4 right-4 flex items-end gap-1">
        {[40, 65, 50, 80, 45, 70, 55, 90, 60, 75].map((h, i) => (
          <div key={i} className="flex-1">
            <Skeleton className="rounded-t" style={{ height: `${h}%` }} />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Page loading skeleton with header */
export function PageSkeleton({ title }: { title?: string }) {
  return (
    <div className="animate-pulse space-y-6 p-4 lg:p-6">
      {title && <Skeleton className="h-7 w-48" />}
      <KpiSkeleton count={4} />
      <ChartSkeleton />
      <TableSkeleton />
    </div>
  );
}
