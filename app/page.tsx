export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';

export default async function Home() {
  const session = await getServerSession(authOptions);
  if (session) {
    if ((session.user as any)?.isMaster) {
      redirect('/master');
    }
    if ((session.user as any)?.role === 'vendedor') {
      redirect('/meu-painel');
    }
    redirect('/hoje');
  }
  redirect('/login');
}
