'use client';
import { useState, useRef, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Challenge,
  Game,
  GameAccount,
  Page,
  Transaction,
  credits,
  platforms,
  platformName,
} from '@/lib/contracts';
import { useResource } from '@/lib/use-resource';
import { post } from '@/lib/client';
import { useSession } from './shell';
import {
  Button,
  Card,
  ChallengeCard,
  EmptyState,
  ErrorState,
  GameCard,
  Icon,
  LoadingState,
  PageHeading,
  TransactionRow,
} from './ui';

export function HomeScreen() {
  const { user, balance } = useSession(),
    games = useResource<Game[]>('/games'),
    challenges = useResource<Page<Challenge>>(
      '/challenges?status=OPEN&limit=3',
    );
  return (
    <>
      <div className="welcome-line">
        <span>
          Welcome back, <strong>{user.displayName ?? user.username}</strong>{' '}
          <span aria-hidden="true">✦</span>
        </span>
        <span className="muted small">YOUR ARENA IS WAITING</span>
      </div>
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">
            <span className="online-dot" /> THE COMPETITION STARTS WITH YOU
          </span>
          <h1>
            YOUR NEXT <em>W</em>
            <br />
            STARTS HERE.
          </h1>
          <p>
            Find your rival. Secure your stake.
            <br />
            Let your game do the talking.
          </p>
          <div className="hero-actions">
            <Link className="button primary" href="/challenges">
              Find a challenge <Icon name="arrow" size={18} />
            </Link>
            <Link className="button secondary" href="/challenges/new">
              <Icon name="plus" size={18} /> Create challenge
            </Link>
          </div>
        </div>
        <div className="hero-vault" aria-hidden="true">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="hero-lock">
            <Icon name="shield" size={104} />
            <Icon name="lock" size={34} />
          </div>
          <span className="hero-caption">SKILL MEETS SECURITY</span>
        </div>
      </section>
      <div className="home-info">
        <Card>
          <span className="stat-icon">
            <Icon name="wallet" />
          </span>
          <div>
            <span className="muted small">Available credits</span>
            <strong className="stat-value">
              {balance === null ? '—' : credits(balance)} <small>TEST</small>
            </strong>
          </div>
          <Link href="/transactions" aria-label="View wallet">
            <Icon name="arrow" />
          </Link>
        </Card>
        <Card>
          <span className="stat-icon blue">
            <Icon name="shield" />
          </span>
          <div>
            <strong>Secured from the start</strong>
            <p className="muted small">
              Stakes are held in your challenge vault.
            </p>
          </div>
        </Card>
        <Card>
          <span className="stat-icon green">
            <Icon name="game" />
          </span>
          <div>
            <strong>One game. One opponent.</strong>
            <p className="muted small">Pure 1v1 competition. Your move.</p>
          </div>
        </Card>
      </div>
      <div className="section-heading">
        <h2>Choose your arena</h2>
        <span className="muted small">YOUR GAME. YOUR RULES.</span>
      </div>
      {games.loading && !games.data ? (
        <LoadingState />
      ) : games.error ? (
        <ErrorState message={games.error} retry={() => void games.reload()} />
      ) : (
        <div className="game-grid">
          {games.data?.map((game) => (
            <GameCard key={game.id} game={game} />
          ))}
          {!games.data?.length && (
            <EmptyState title="New arenas are on the way." />
          )}
          <Card className="how-card">
            <span className="eyebrow">HOW IT WORKS</span>
            <h3>
              Less setup.
              <br />
              More game.
            </h3>
            <ol>
              <li>
                <span>01</span>Pick or create a challenge
              </li>
              <li>
                <span>02</span>Join your opponent
              </li>
              <li>
                <span>03</span>Secure both stakes in the vault
              </li>
            </ol>
          </Card>
        </div>
      )}
      <div className="section-heading">
        <h2>Open challenges</h2>
        <Link href="/challenges">
          View all <Icon name="arrow" size={16} />
        </Link>
      </div>
      {challenges.error ? (
        <ErrorState
          message={challenges.error}
          retry={() => void challenges.reload()}
        />
      ) : challenges.loading && !challenges.data ? (
        <LoadingState />
      ) : (
        <div className="challenge-grid">
          {challenges.data?.items.map((challenge) => (
            <ChallengeCard
              key={challenge.id}
              challenge={challenge}
              gameName={
                games.data?.find((g) => g.id === challenge.gameId)?.name ??
                '1v1 arena'
              }
            />
          ))}
          {!challenges.data?.items.length && (
            <EmptyState title="Be the first to throw down.">
              <p>Create a challenge and let a rival come to you.</p>
              <Link href="/challenges/new" className="button secondary">
                Create a challenge
              </Link>
            </EmptyState>
          )}
        </div>
      )}
    </>
  );
}

export function DiscoverScreen() {
  const search = useSearchParams(),
    [game, setGame] = useState(search.get('gameId') ?? ''),
    [platform, setPlatform] = useState(''),
    [status, setStatus] = useState('OPEN'),
    [cursors, setCursors] = useState<string[]>([]);
  const query = new URLSearchParams({
    limit: '12',
    ...(game ? { gameId: game } : {}),
    ...(platform ? { platform } : {}),
    ...(status ? { status } : {}),
    ...(cursors.length ? { cursor: cursors[cursors.length - 1] } : {}),
  });
  const resource = useResource<Page<Challenge>>(`/challenges?${query}`),
    games = useResource<Game[]>('/games');
  return (
    <>
      <PageHeading eyebrow="FIND YOUR COMPETITION" title="The arena is open.">
        Pick your game. Find your opponent. Make it a challenge.
      </PageHeading>
      <div className="toolbar">
        <div className="filters">
          <label>
            Game
            <select
              value={game}
              onChange={(e) => {
                setGame(e.target.value);
                setCursors([]);
              }}
            >
              <option value="">All games</option>
              {games.data?.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Platform
            <select
              value={platform}
              onChange={(e) => {
                setPlatform(e.target.value);
                setCursors([]);
              }}
            >
              <option value="">All platforms</option>
              {platforms.map((p) => (
                <option key={p} value={p}>
                  {platformName(p)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setCursors([]);
              }}
            >
              <option value="OPEN">Open challenges</option>
              <option value="JOINED">Ready to fund</option>
              <option value="FUNDED">Prize secured</option>
              <option value="">All statuses</option>
            </select>
          </label>
        </div>
        <Link className="button primary" href="/challenges/new">
          <Icon name="plus" size={18} />
          Create challenge
        </Link>
      </div>
      {resource.loading ? (
        <LoadingState label="Finding your next challenge…" />
      ) : resource.error ? (
        <ErrorState
          message={resource.error}
          retry={() => void resource.reload()}
        />
      ) : (
        <>
          <div className="result-count">
            {resource.data?.items.length ?? 0} challenges on this page
          </div>
          <div className="challenge-grid">
            {resource.data?.items.map((c) => (
              <ChallengeCard
                key={c.id}
                challenge={c}
                gameName={
                  games.data?.find((g) => g.id === c.gameId)?.name ??
                  '1v1 arena'
                }
              />
            ))}
          </div>
          {!resource.data?.items.length && (
            <EmptyState title="No challenges here yet.">
              <p>Try another filter or set the pace with your own challenge.</p>
            </EmptyState>
          )}
          <div className="pagination">
            <Button
              variant="secondary"
              disabled={!cursors.length}
              onClick={() => setCursors((old) => old.slice(0, -1))}
            >
              Previous
            </Button>
            <span className="muted">Page {cursors.length + 1}</span>
            <Button
              variant="secondary"
              disabled={!resource.data?.nextCursor}
              onClick={() =>
                setCursors((old) => [...old, resource.data!.nextCursor!])
              }
            >
              Next
            </Button>
          </div>
        </>
      )}
    </>
  );
}

export function CreateScreen() {
  const games = useResource<Game[]>('/games'),
    accounts = useResource<GameAccount[]>('/users/me/game-accounts');
  const [game, setGame] = useState(''),
    [platform, setPlatform] = useState('PS5'),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    pending = useRef(false),
    router = useRouter();
  const selected = game || games.data?.[0]?.id || '',
    compatible = accounts.data?.some(
      (a) => a.gameId === selected && a.platform === platform,
    );
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    const data = new FormData(event.currentTarget);
    try {
      const result = await post<Challenge>('/challenges', {
        gameId: selected,
        platform,
        currency: 'TEST',
        mode: '1v1',
        stakeAmount: Number(data.get('stake')),
      });
      router.push(`/challenges/${result.id}`);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setBusy(false);
      pending.current = false;
    }
  }
  return (
    <>
      <PageHeading eyebrow="SET THE CHALLENGE" title="Your game. Your call.">
        Create a 1v1 challenge and leave the next move to your rival.
      </PageHeading>
      <div className="two-column">
        <Card>
          <form className="form-stack" onSubmit={submit}>
            <h2>Challenge details</h2>
            {games.error && (
              <ErrorState
                message={games.error}
                retry={() => void games.reload()}
              />
            )}
            <label>
              Game
              <select
                value={selected}
                onChange={(e) => setGame(e.target.value)}
                required
              >
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
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
              >
                {platforms.map((p) => (
                  <option key={p} value={p}>
                    {platformName(p)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Stake per player <span className="input-addon">TEST credits</span>
              <input
                name="stake"
                type="number"
                min="1"
                max="1000000000"
                step="1"
                defaultValue="10"
                required
                aria-describedby="stake-help"
              />
              <small id="stake-help">
                Choose a whole number. No credits move until you fund the vault.
              </small>
            </label>
            <div className="form-note">
              <Icon name="game" />
              1v1 · Non-withdrawable TEST credits
            </div>
            {accounts.error && (
              <ErrorState
                message={accounts.error}
                retry={() => void accounts.reload()}
              />
            )}{' '}
            {!compatible && !accounts.loading && (
              <div className="notice">
                Link an account for this game and platform before creating your
                challenge.{' '}
                <Link href="/profile">
                  Set up game account <Icon name="arrow" size={14} />
                </Link>
              </div>
            )}
            {error && <ErrorState message={error} />}
            <Button
              type="submit"
              busy={busy}
              disabled={!selected || !compatible}
            >
              Create challenge
              <Icon name="arrow" size={18} />
            </Button>
          </form>
        </Card>
        <Card className="help-card">
          <div className="stat-icon">
            <Icon name="shield" size={28} />
          </div>
          <h2>A vault for every rivalry.</h2>
          <p>
            Creating is free. Once an opponent joins, each player chooses when
            to secure their stake.
          </p>
          <ul>
            <li>Both players must join before funding.</li>
            <li>Credits are held in a dedicated challenge vault.</li>
            <li>Only unfunded challenges can be cancelled.</li>
          </ul>
          <Link href="/transactions">
            Check available credits <Icon name="arrow" size={16} />
          </Link>
        </Card>
      </div>
    </>
  );
}

export function TransactionsScreen() {
  const { balance, refreshBalance } = useSession(),
    [cursors, setCursors] = useState<string[]>([]);
  const resource = useResource<Page<Transaction>>(
    `/users/me/transactions?limit=15${cursors.length ? `&cursor=${cursors[cursors.length - 1]}` : ''}`,
  );
  return (
    <>
      <PageHeading eyebrow="YOUR WALLET" title="Every credit. Accounted for.">
        Your available balance and the story behind every movement.
      </PageHeading>
      <Card className="wallet-summary">
        <div>
          <span className="eyebrow">AVAILABLE BALANCE</span>
          <div className="wallet-amount">
            {balance === null ? '—' : credits(balance)} <span>TEST</span>
          </div>
          <p className="muted">
            Non-withdrawable credits for competitive play.
          </p>
        </div>
        <Icon name="wallet" size={60} />
      </Card>
      <div className="section-heading">
        <h2>Transaction history</h2>
        <Button
          variant="ghost"
          onClick={() => {
            void resource.reload();
            void refreshBalance();
          }}
        >
          Refresh
        </Button>
      </div>
      <Card className="history-card">
        {resource.loading ? (
          <LoadingState />
        ) : resource.error ? (
          <ErrorState
            message={resource.error}
            retry={() => void resource.reload()}
          />
        ) : resource.data?.items.length ? (
          <ul className="transactions">
            {resource.data.items.map((t) => (
              <TransactionRow key={t.id} transaction={t} />
            ))}
          </ul>
        ) : (
          <EmptyState title="A clean slate.">
            <p>Your test-credit activity will appear here.</p>
          </EmptyState>
        )}
      </Card>
      <div className="pagination">
        <Button
          variant="secondary"
          disabled={!cursors.length || resource.loading}
          onClick={() => setCursors((old) => old.slice(0, -1))}
        >
          Previous
        </Button>
        <span className="muted">Page {cursors.length + 1}</span>
        <Button
          variant="secondary"
          disabled={!resource.data?.nextCursor || resource.loading}
          onClick={() =>
            setCursors((old) => [...old, resource.data!.nextCursor!])
          }
        >
          Next
        </Button>
      </div>
    </>
  );
}
