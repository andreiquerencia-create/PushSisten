import { Suspense } from 'react';
import { HojeContent } from './_components/hoje-content';

export default function HojePage() {
  return (
    <Suspense fallback={null}>
      <HojeContent />
    </Suspense>
  );
}
