import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'PUSHY ERP — Brand Identity',
  description: 'Premium SaaS Brand Identity & Design System Exploration',
};

export default function BrandLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
