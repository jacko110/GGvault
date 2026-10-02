import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/session';
import { AppShell } from '@/components/shell';
export const dynamic = 'force-dynamic';
export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser();
  if (!user) redirect('/login');
  return <AppShell user={user}>{children}</AppShell>;
}
