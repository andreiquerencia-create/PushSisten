import { AppSidebar } from '@/components/app-sidebar';
import { OnboardingProvider } from '@/components/onboarding-provider';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <OnboardingProvider>
      <div className="flex min-h-screen bg-background">
        <AppSidebar />
        <main className="flex-1 min-w-0 overflow-auto">
          {children}
        </main>
      </div>
    </OnboardingProvider>
  );
}
