'use client';
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { User, credits } from '@/lib/contracts';
import { api } from '@/lib/client';
import { Avatar, Badge, Button, ErrorState, Icon } from './ui';

const SessionContext = createContext<{
  user: User;
  balance: number | null;
  refreshBalance: () => Promise<void>;
} | null>(null);
export const useSession = () => {
  const value = useContext(SessionContext);
  if (!value) throw new Error('Session provider required');
  return value;
};
const links = [
  { href: '/', label: 'Home', icon: 'home' },
  { href: '/challenges', label: 'Discover', icon: 'compass' },
  { href: '/challenges/new', label: 'Create', icon: 'plus' },
  { href: '/matches', label: 'My matches', icon: 'game' },
  { href: '/transactions', label: 'Wallet', icon: 'wallet' },
  { href: '/profile', label: 'Profile', icon: 'user' },
];
export function Brand() {
  return (
    <Link href="/" className="brand" aria-label="GGVault home">
      <span className="brand-mark">
        <Icon name="shield" size={24} />
      </span>
      <span>
        GG<span>VAULT</span>
        <small>PLAY. PROVE. PREVAIL.</small>
      </span>
    </Link>
  );
}
export function Navigation({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname();
  return (
    <nav aria-label={mobile ? 'Mobile navigation' : 'Main navigation'}>
      {links.map((link) => {
        const active =
          link.href === '/'
            ? pathname === '/'
            : link.href === '/challenges'
              ? pathname.startsWith('/challenges') &&
                pathname !== '/challenges/new'
              : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={active ? 'active' : ''}
            aria-current={active ? 'page' : undefined}
          >
            <Icon name={link.icon} />
            <span>{link.label}</span>
            {active && !mobile && <span className="nav-indicator" />}
          </Link>
        );
      })}
    </nav>
  );
}
export function DesktopSidebar({
  logout,
  busy,
}: {
  logout: () => void;
  busy: boolean;
}) {
  const { user } = useSession();
  return (
    <aside className="desktop-sidebar">
      <Brand />
      <span className="eyebrow nav-label">YOUR ARENA</span>
      <Navigation />
      <div className="sidebar-bottom">
        <div className="test-note">
          <Icon name="shield" />
          <strong>Play with confidence</strong>
          <p>
            Test credits only.
            <br />
            No real money. All competition.
          </p>
        </div>
        <div className="sidebar-user">
          <Avatar name={user.username} />
          <span>
            <strong>{user.username}</strong>
            <small>Player account</small>
          </span>
          <Button
            variant="ghost"
            aria-label="Sign out"
            onClick={logout}
            busy={busy}
          >
            <Icon name="logout" />
          </Button>
        </div>
      </div>
    </aside>
  );
}
export function MobileBottomNavigation() {
  return (
    <div className="mobile-bottom">
      <Navigation mobile />
    </div>
  );
}
export function AppShell({
  user,
  children,
}: {
  user: User;
  children: ReactNode;
}) {
  const [balance, setBalance] = useState<number | null>(null),
    [busy, setBusy] = useState(false),
    [logoutError, setLogoutError] = useState('');
  const router = useRouter();
  const refreshBalance = useCallback(async () => {
    try {
      const data = await api<{ balance: number }>(`/users/${user.id}/balance`);
      setBalance(data.balance);
    } catch {
      setBalance(null);
    }
  }, [user.id]);
  useEffect(() => {
    void refreshBalance();
    const update = () => {
      if (document.visibilityState === 'visible') void refreshBalance();
    };
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, [refreshBalance]);
  async function logout() {
    if (busy) return;
    setBusy(true);
    setLogoutError('');
    try {
      const response = await fetch('/api/session/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      if (!response.ok) throw new Error();
      router.replace('/login');
      router.refresh();
    } catch {
      setLogoutError(
        'Sign out could not be confirmed. Please check your connection and try again.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <SessionContext.Provider value={{ user, balance, refreshBalance }}>
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <DesktopSidebar logout={() => void logout()} busy={busy} />
      <div className="app-frame">
        <header className="topbar">
          <div className="mobile-brand">
            <Brand />
          </div>
          <span className="desktop-greeting">
            <span className="online-dot" /> YOUR COMPETITIVE EDGE
          </span>
          <div className="topbar-actions">
            <Link
              href="/transactions"
              className="balance-pill"
              aria-label={`Available balance: ${balance === null ? 'unavailable' : credits(balance)} TEST credits`}
            >
              <Icon name="wallet" size={17} />
              <strong>{balance === null ? '—' : credits(balance)}</strong>
              <span>TEST</span>
            </Link>
            <Link href="/profile" aria-label="Your profile">
              <Avatar name={user.username} />
            </Link>
            <Button
              variant="ghost"
              className="mobile-logout"
              aria-label="Sign out"
              onClick={() => void logout()}
              busy={busy}
            >
              <Icon name="logout" size={18} />
            </Button>
          </div>
        </header>
        <main id="main-content" className="main-content">
          {logoutError && <ErrorState message={logoutError} />} {children}
        </main>
        <footer className="app-footer">
          <span>GGVAULT © {new Date().getFullYear()}</span>
          <Badge>NON-WITHDRAWABLE TEST CREDITS</Badge>
        </footer>
      </div>
      <MobileBottomNavigation />
    </SessionContext.Provider>
  );
}
