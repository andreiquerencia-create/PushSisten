'use client';

import { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';

// Home legada aposentada: a tela inicial oficial passou a ser /hoje.
// Mantemos a rota redirecionando para preservar links/bookmarks antigos sem erro 404.
// Client-side redirect para preservar query params (ex: ?onboarding=true).
function DashboardRedirect() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const params = searchParams.toString();
    router.replace(params ? `/hoje?${params}` : '/hoje');
  }, [searchParams, router]);

  return null;
}

export default function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <DashboardRedirect />
    </Suspense>
  );
}
