'use client';

import { AppSidebar } from '@/components/app-sidebar';
import { AcademyPanel } from '@/components/academy/academy-panel';
import { WelcomeModal } from '@/components/academy/welcome-modal';
import { AcademyHighlight } from '@/components/academy/academy-highlight';
import { useAcademy } from '@/components/academy/academy-context';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { state } = useAcademy();

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <main className={`flex-1 min-w-0 overflow-auto transition-all duration-300 ${state.isActive ? 'lg:pr-80' : ''}`}>
        {children}
      </main>
      <AcademyPanel />
      <WelcomeModal />
      <AcademyHighlight />
    </div>
  );
}
