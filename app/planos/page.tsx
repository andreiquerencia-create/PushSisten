export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import PlanosContent from './_components/planos-content';

export default function PlanosPage() {
  return (
    <Suspense fallback={null}>
      <PlanosContent />
    </Suspense>
  );
}
