'use client';
import { useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Brand } from './shell';
import { Button, ErrorState, Icon } from './ui';
import { friendlyError } from '@/lib/errors';
export function AuthScreen({ register = false }: { register?: boolean }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const pending = useRef(false),
    router = useRouter();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    const data = new FormData(event.currentTarget),
      body = {
        email: data.get('email'),
        password: data.get('password'),
        ...(register ? { username: data.get('username') } : {}),
      };
    try {
      const response = await fetch(
        `/api/session/${register ? 'register' : 'login'}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      );
      if (!response.ok) {
        const json = await response.json().catch(() => ({}));
        setError(friendlyError(json.code, response.status));
        return;
      }
      router.replace('/');
      router.refresh();
    } catch {
      setError(friendlyError('SERVICE_UNAVAILABLE'));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <main className="auth-layout">
      <section className="auth-art">
        <Brand />
        <div className="auth-manifesto">
          <span className="eyebrow">YOUR SKILL. YOUR ARENA.</span>
          <h1>
            BRING YOUR
            <br />
            GAME.
            <br />
            <em>
              WE’LL KEEP
              <br />
              IT SECURED.
            </em>
          </h1>
          <p>
            Challenge a rival. Lock your test credits.
            <br />
            Make every game mean more.
          </p>
          <div className="auth-trust">
            <Icon name="shield" /> Built for fair competition
          </div>
        </div>
        <span className="auth-grid" aria-hidden="true" />
      </section>
      <section className="auth-form-area">
        <div className="auth-mobile-brand">
          <Brand />
        </div>
        <div className="auth-form-wrap">
          <span className="eyebrow">
            {register ? 'ENTER THE ARENA' : 'WELCOME BACK, PLAYER'}
          </span>
          <h2>
            {register
              ? 'Your next chapter starts here.'
              : 'Ready for your next W?'}
          </h2>
          <p className="muted">
            {register
              ? 'Create your GGVault player account.'
              : 'Sign in to your GGVault account.'}
          </p>
          <form
            onSubmit={submit}
            className="form-stack"
            aria-label={register ? 'Registration' : 'Login'}
          >
            {register && (
              <label>
                Player name
                <input
                  name="username"
                  autoComplete="username"
                  placeholder="Your gamer identity"
                  minLength={3}
                  maxLength={32}
                  pattern="[a-zA-Z0-9_]{3,32}"
                  aria-describedby="username-help"
                  required
                />
                <small id="username-help">
                  3–32 letters, numbers or underscores.
                </small>
              </label>
            )}
            <label>
              Email address
              <input
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                maxLength={254}
                required
              />
            </label>
            <label>
              Password
              <input
                name="password"
                type="password"
                autoComplete={register ? 'new-password' : 'current-password'}
                placeholder="At least 10 characters"
                minLength={10}
                maxLength={128}
                required
              />
            </label>
            {error && <ErrorState message={error} />}
            <Button type="submit" busy={busy}>
              {register ? 'Create account' : 'Sign in'}
              <Icon name="arrow" size={18} />
            </Button>
          </form>
          <p className="auth-switch">
            {register ? 'Already have an account?' : 'New to the arena?'}{' '}
            <Link href={register ? '/login' : '/register'}>
              {register ? 'Sign in' : 'Create an account'}
            </Link>
          </p>
          <div className="auth-disclaimer">
            <Icon name="lock" size={16} />
            <span>
              Competition powered by non-withdrawable TEST credits. No real
              money.
            </span>
          </div>
        </div>
      </section>
    </main>
  );
}
