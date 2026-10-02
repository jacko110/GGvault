'use client';
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  Game,
  GameAccount,
  User,
  platforms,
  platformName,
} from '@/lib/contracts';
import { api, post } from '@/lib/client';
import { useResource } from '@/lib/use-resource';
import { useSession } from './shell';
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Icon,
  PageHeading,
} from './ui';
export function ProfileScreen() {
  const { user } = useSession(),
    games = useResource<Game[]>('/games'),
    accounts = useResource<GameAccount[]>('/users/me/game-accounts');
  const [busy, setBusy] = useState(false),
    [accountBusy, setAccountBusy] = useState(false),
    [error, setError] = useState(''),
    [accountError, setAccountError] = useState(''),
    [notice, setNotice] = useState(''),
    router = useRouter();
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api<User>('/users/me', {
        method: 'PATCH',
        body: JSON.stringify({
          displayName: data.get('displayName'),
          bio: data.get('bio'),
        }),
      });
      setNotice('Profile updated.');
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  }
  async function link(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (accountBusy) return;
    const form = event.currentTarget,
      data = new FormData(form);
    setAccountBusy(true);
    setAccountError('');
    try {
      await post('/users/me/game-accounts', {
        gameId: data.get('gameId'),
        platform: data.get('platform'),
        gamertag: String(data.get('gamertag')).trim(),
      });
      form.reset();
      await accounts.reload();
    } catch (error) {
      setAccountError(
        error instanceof Error ? error.message : 'Please try again.',
      );
    } finally {
      setAccountBusy(false);
    }
  }
  return (
    <>
      <PageHeading eyebrow="PLAYER PROFILE" title="Make your name.">
        Your identity across the arena.
      </PageHeading>
      <Card className="profile-banner">
        <Avatar name={user.username} large />
        <div>
          <h2>{user.displayName ?? user.username}</h2>
          <p className="muted">@{user.username}</p>
          <Badge tone="purple">GGVAULT PLAYER</Badge>
        </div>
      </Card>
      <div className="two-column">
        <Card>
          <h2>Personal details</h2>
          <form onSubmit={save} className="form-stack">
            <label>
              Display name
              <input
                name="displayName"
                defaultValue={user.displayName ?? user.username}
                maxLength={80}
                required
              />
            </label>
            <label>
              Email address
              <input value={user.email} readOnly type="email" />
              <small>Your sign-in email.</small>
            </label>
            <label>
              Bio
              <textarea
                name="bio"
                defaultValue={user.profile?.bio ?? ''}
                maxLength={500}
                rows={3}
                placeholder="Your game. Your style."
              />
            </label>
            {error && <ErrorState message={error} />}{' '}
            {notice && (
              <p role="status" className="positive">
                {notice}
              </p>
            )}
            <Button type="submit" busy={busy}>
              Save profile
            </Button>
          </form>
        </Card>
        <Card>
          <div className="section-heading">
            <h2>Game accounts</h2>
            <Icon name="game" />
          </div>
          <p className="muted small">
            Link your game and platform before creating or joining a challenge.
          </p>
          {accounts.error && (
            <ErrorState
              message={accounts.error}
              retry={() => void accounts.reload()}
            />
          )}
          <ul className="account-list">
            {accounts.data?.map((account) => (
              <li key={account.id}>
                <span>
                  <strong>{account.gamertag}</strong>
                  <small>
                    {games.data?.find((g) => g.id === account.gameId)?.name ??
                      'Game'}{' '}
                    · {platformName(account.platform)}
                  </small>
                </span>
                <Badge tone="success">Linked</Badge>
              </li>
            ))}
          </ul>
          {accounts.data?.length === 0 && (
            <EmptyState title="Your arena identity starts here." />
          )}
          <form
            className="form-stack"
            onSubmit={link}
            aria-label="Link game account"
          >
            <h3>Link a game account</h3>
            {games.error && (
              <ErrorState
                message={games.error}
                retry={() => void games.reload()}
              />
            )}
            <label>
              Game
              <select name="gameId" required defaultValue="">
                <option value="" disabled>
                  Select a game
                </option>
                {games.data?.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Platform
              <select name="platform" defaultValue="PS5">
                {platforms.map((p) => (
                  <option key={p} value={p}>
                    {platformName(p)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Gamertag
              <input
                name="gamertag"
                maxLength={64}
                required
                placeholder="Your in-game name"
              />
            </label>
            {accountError && <ErrorState message={accountError} />}
            <Button
              type="submit"
              busy={accountBusy}
              disabled={!games.data?.length}
              variant="secondary"
            >
              <Icon name="plus" size={16} />
              Link account
            </Button>
          </form>
        </Card>
      </div>
    </>
  );
}
