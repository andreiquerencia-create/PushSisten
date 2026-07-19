import { AppSidebar } from '@/components/app-sidebar';
import { OnboardingProgressBar } from '@/components/onboarding/progress-bar';
import { OnboardingStepCard } from '@/components/onboarding/step-card';
import { OnboardingReminder } from '@/components/onboarding/reminder';
import { GuideOrchestrator } from '@/components/onboarding/guide-orchestrator';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <main className="flex-1 min-w-0 overflow-auto">
        <OnboardingProgressBar />
        {children}
        <OnboardingStepCard />
        <OnboardingReminder />
        <GuideOrchestrator />
      </main>
    </div>
  );
}
