import { Suspense } from 'react';
import RecusadoContent from './_components/recusado-content';

export const dynamic = 'force-dynamic';

export default function BillingRecusadoPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-muted-foreground">Carregando...</div>}>
      <RecusadoContent />
    </Suspense>
  );
}
