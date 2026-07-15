import { redirect } from 'next/navigation';

// Home legada aposentada: a tela inicial oficial passou a ser /hoje.
// Mantemos a rota redirecionando para preservar links/bookmarks antigos sem erro 404.
export default function DashboardPage() {
  redirect('/hoje');
}
