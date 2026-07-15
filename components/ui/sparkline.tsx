'use client';

import { useMemo } from 'react';

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  fillOpacity?: number;
  strokeWidth?: number;
  className?: string;
}

export function Sparkline({
  data,
  width = 80,
  height = 28,
  color = '#3b82f6',
  fillOpacity = 0.1,
  strokeWidth = 1.5,
  className,
}: SparklineProps) {
  const path = useMemo(() => {
    if (!data || data.length < 2) return '';
    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1;
    const padding = 2;
    const w = width - padding * 2;
    const h = height - padding * 2;

    const points = data.map((v, i) => [
      padding + (i / (data.length - 1)) * w,
      padding + h - ((v - min) / range) * h,
    ]);

    const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ');
    const fill = `${line} L${points[points.length - 1][0]},${height} L${points[0][0]},${height} Z`;

    return { line, fill };
  }, [data, width, height]);

  if (!path) return null;

  return (
    <svg width={width} height={height} className={className} viewBox={`0 0 ${width} ${height}`}>
      <defs>
        <linearGradient id={`sparkGrad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={fillOpacity} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={path.fill} fill={`url(#sparkGrad-${color.replace('#', '')})`} />
      <path d={path.line} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
