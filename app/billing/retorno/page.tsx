import { Suspense } from 'react';
import RetornoContent from './_components/retorno-content';

export const dynamic = 'force-dynamic';

export default function BillingRetornoPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-muted-foreground">Carregando...</div>}>
      <RetornoContent />
    </Suspense>
  );
}
