'use client';
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, ErrorState } from '../../web/components/ui';
import { friendlyError } from '../../web/lib/errors';
export function AdminLogin() {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    router = useRouter();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    const data = new FormData(event.currentTarget);
    try {
      const response = await fetch('/api/session/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: data.get('email'),
          password: data.get('password'),
        }),
      });
      if (!response.ok) {
        const json = await response.json().catch(() => ({}));
        setError(
          response.status === 403
            ? 'A moderator or administrator account is required.'
            : friendlyError(json.code, response.status),
        );
        return;
      }
      router.replace('/');
      router.refresh();
    } catch {
      setError('Unable to sign in. Please try again.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="admin-login">
      <Card>
        <span className="eyebrow">GGVAULT · TRUST & FAIR PLAY</span>
        <h1>Moderator sign in</h1>
        <p>Authorized reviewers only.</p>
        <form className="form-stack" onSubmit={submit}>
          <label>
            Email address
            <input name="email" type="email" autoComplete="username" required />
          </label>
          <label>
            Password
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </label>
          {error && <ErrorState message={error} />}
          <Button type="submit" busy={busy}>
            Sign in
          </Button>
        </form>
      </Card>
    </main>
  );
}
export function AdminLogout() {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    router = useRouter();
  async function logout() {
    setBusy(true);
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
      setError('Sign out could not be confirmed. Please retry.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <Button variant="secondary" busy={busy} onClick={() => void logout()}>
        Sign out
      </Button>
      {error && <ErrorState message={error} />}
    </div>
  );
}
