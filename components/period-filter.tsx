'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarDays } from 'lucide-react';

export type PeriodValue = 'hoje' | '7' | '30' | '60' | '90' | 'personalizado';

export interface PeriodRange {
  startDate: string; // ISO date string
  endDate: string; // ISO date string
}

interface PeriodFilterProps {
  value: PeriodValue;
  onChange: (period: PeriodValue, range: PeriodRange) => void;
  className?: string;
  showToday?: boolean; // default true
}

function getRange(period: PeriodValue): PeriodRange {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  let start: Date;
  switch (period) {
    case 'hoje':
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case '7':
      start = new Date(now.getTime() - 7 * 86400000);
      start.setHours(0, 0, 0, 0);
      break;
    case '30':
      start = new Date(now.getTime() - 30 * 86400000);
      start.setHours(0, 0, 0, 0);
      break;
    case '60':
      start = new Date(now.getTime() - 60 * 86400000);
      start.setHours(0, 0, 0, 0);
      break;
    case '90':
      start = new Date(now.getTime() - 90 * 86400000);
      start.setHours(0, 0, 0, 0);
      break;
    default:
      start = new Date(now.getTime() - 30 * 86400000);
      start.setHours(0, 0, 0, 0);
  }
  return { startDate: start.toISOString(), endDate: end.toISOString() };
}

const presets: { value: PeriodValue; label: string }[] = [
  { value: 'hoje', label: 'Hoje' },
  { value: '7', label: '7 dias' },
  { value: '30', label: '30 dias' },
  { value: '60', label: '60 dias' },
  { value: '90', label: '90 dias' },
  { value: 'personalizado', label: 'Personalizado' },
];

export function PeriodFilter({ value, onChange, className = '', showToday = true }: PeriodFilterProps) {
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [popoverOpen, setPopoverOpen] = useState(false);

  const visiblePresets = showToday ? presets : presets.filter(p => p.value !== 'hoje');

  const handlePreset = (p: PeriodValue) => {
    if (p === 'personalizado') {
      setPopoverOpen(true);
      return;
    }
    onChange(p, getRange(p));
  };

  const applyCustom = () => {
    if (!customStart || !customEnd) return;
    const startDate = new Date(customStart + 'T00:00:00').toISOString();
    const endDate = new Date(customEnd + 'T23:59:59').toISOString();
    onChange('personalizado', { startDate, endDate });
    setPopoverOpen(false);
  };

  return (
    <div className={`flex flex-wrap gap-1.5 items-center ${className}`}>
      {visiblePresets.filter(p => p.value !== 'personalizado').map(p => (
        <Button
          key={p.value}
          variant={value === p.value ? 'default' : 'outline'}
          size="sm"
          className="h-7 text-xs px-2.5"
          onClick={() => handlePreset(p.value)}
        >
          {p.label}
        </Button>
      ))}
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <Button
            variant={value === 'personalizado' ? 'default' : 'outline'}
            size="sm"
            className="h-7 text-xs px-2.5 gap-1"
          >
            <CalendarDays className="w-3 h-3" />
            {value === 'personalizado' ? 'Personalizado' : 'Período'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-3" align="end">
          <div className="space-y-3">
            <p className="text-sm font-medium">Período personalizado</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">De</Label>
                <Input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="h-8 text-xs" />
              </div>
              <div>
                <Label className="text-xs">Até</Label>
                <Input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="h-8 text-xs" />
              </div>
            </div>
            <Button size="sm" className="w-full h-8" onClick={applyCustom} disabled={!customStart || !customEnd}>Aplicar</Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export { getRange };
