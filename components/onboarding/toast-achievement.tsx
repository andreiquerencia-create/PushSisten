'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Sparkles } from 'lucide-react';

interface ToastAchievementProps {
  message: string;
  visible: boolean;
  onHide?: () => void;
  duration?: number;
}

export function ToastAchievement({ message, visible, onHide, duration = 3000 }: ToastAchievementProps) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (visible) {
      setShow(true);
      const timer = setTimeout(() => {
        setShow(false);
        onHide?.();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [visible, duration, onHide]);

  if (!show) return null;

  return (
    <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[9999] animate-in slide-in-from-top-2 fade-in duration-300">
      <div className="flex items-center gap-2.5 px-5 py-3 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-xl shadow-emerald-500/20">
        <div className="relative">
          <CheckCircle2 className="w-4.5 h-4.5" />
          <Sparkles className="w-2.5 h-2.5 absolute -top-1 -right-1 text-yellow-200 animate-ping" />
        </div>
        <span className="text-sm font-medium">{message}</span>
      </div>
    </div>
  );
}
