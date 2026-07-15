import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth-options';
import { ApresentacaoContent } from './_components/apresentacao-content';

export const dynamic = 'force-dynamic';

export default async function ApresentacaoPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');
  return <ApresentacaoContent />;
}
