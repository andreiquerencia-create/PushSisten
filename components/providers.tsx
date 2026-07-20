'use client';

import { SessionProvider } from 'next-auth/react';
import { AcademyProvider } from '@/components/academy/academy-context';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <AcademyProvider>
        {children}
      </AcademyProvider>
    </SessionProvider>
  );
}
