import { redirect } from 'next/navigation';
import Link from 'next/link';
import { currentUser } from '../../../web/lib/session';
import { moderatorAccess } from '../../lib/access';
import { AdminLogout } from '../../components/auth';
export const dynamic = 'force-dynamic';
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser();
  if (!user) redirect('/login');
  try {
    await moderatorAccess();
  } catch {
    redirect('/login?denied=1');
  }
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="admin-header">
        <Link href="/" className="brand">
          GGVAULT <small>MODERATION</small>
        </Link>
        <span>{user.username}</span>
        <AdminLogout />
      </header>
      <main className="admin-main" id="main-content">
        {children}
      </main>
    </>
  );
}
