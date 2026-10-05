'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Challenge,
  Funding,
  Game,
  credits,
  funded,
  platformName,
} from '@/lib/contracts';
import { ApiError } from '@/lib/errors';
import { post } from '@/lib/client';
import { useResource } from '@/lib/use-resource';
import { useSession } from './shell';
import {
  Button,
  Card,
  ConfirmationDialog,
  ErrorState,
  Icon,
  LoadingState,
  PageHeading,
  PlayerCard,
  StatusBadge,
  VaultCard,
} from './ui';
export function ChallengeScreen({
  id,
  vault = false,
}: {
  id: string;
  vault?: boolean;
}) {
  const { user, refreshBalance } = useSession(),
    resource = useResource<Challenge>(`/challenges/${id}`),
    games = useResource<Game[]>('/games');
  const challenge = resource.data,
    me = challenge?.players.find((p) => p.userId === user.id),
    vaultResource = useResource<{ balance: number }>(
      me ? `/challenges/${id}/vault` : null,
    );
  const [busy, setBusy] = useState(false),
    [dialog, setDialog] = useState<'fund' | 'cancel' | null>(null),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const pending = useRef(false),
    operationKey = useRef<string>();
  const reloadChallenge = resource.reload,
    reloadVault = vaultResource.reload,
    canReadVault = !!me;
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible' && !pending.current) {
        void reloadChallenge();
        if (canReadVault) void reloadVault();
      }
    }, 8000);
    return () => clearInterval(timer);
  }, [reloadChallenge, reloadVault, canReadVault]);
  async function action(kind: 'join' | 'cancel' | 'fund') {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    const storageKey = `ggvault:fund:${user.id}:${id}`;
    try {
      if (kind === 'fund') {
        try {
          operationKey.current ??=
            sessionStorage.getItem(storageKey) ?? undefined;
        } catch {
          /* Memory fallback when storage is unavailable. */
        }
        operationKey.current ??= crypto.randomUUID();
        try {
          sessionStorage.setItem(storageKey, operationKey.current);
        } catch {
          /* The in-memory key still protects retries. */
        }
        const result = await post<Funding>(
          `/challenges/${id}/fund`,
          {},
          { 'Idempotency-Key': operationKey.current },
        );
        resource.setData(result.challenge);
        vaultResource.setData({ balance: result.vaultBalance });
        try {
          sessionStorage.removeItem(storageKey);
        } catch {}
        operationKey.current = undefined;
        setNotice('Your stake is secured.');
        await refreshBalance();
      } else {
        resource.setData(await post<Challenge>(`/challenges/${id}/${kind}`));
        setNotice(
          kind === 'join'
            ? "You're in. Open the vault to secure your stake."
            : 'Challenge cancelled.',
        );
      }
      setDialog(null);
    } catch (error) {
      setDialog(null);
      if (
        error instanceof ApiError &&
        error.status < 500 &&
        error.code !== 'TRANSACTION_RETRY'
      ) {
        operationKey.current = undefined;
        try {
          sessionStorage.removeItem(storageKey);
        } catch {}
      }
      // A lost response may follow a committed mutation. Refresh before enabling
      // manual retry, preserving the same funding key for uncertain outcomes.
      await Promise.allSettled([
        resource.reload(),
        ...(me ? [vaultResource.reload()] : []),
        refreshBalance(),
      ]);
      setError(error instanceof Error ? error.message : 'Please try again.');
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  if (!challenge)
    return resource.error ? (
      <ErrorState
        message={resource.error}
        retry={() => void resource.reload()}
      />
    ) : (
      <LoadingState />
    );
  const a = challenge.players.find((p) => p.userId === challenge.creatorId),
    b = challenge.players.find((p) => p.userId !== challenge.creatorId);
  const secured =
    challenge.status === 'FUNDED' &&
    challenge.players.length === 2 &&
    challenge.players.every(funded);
  const canFund =
    !!me &&
    !funded(me) &&
    challenge.status === 'JOINED' &&
    challenge.players.length === 2;
  const canCancel =
    challenge.creatorId === user.id &&
    ['OPEN', 'JOINED'].includes(challenge.status) &&
    !challenge.players.some(funded);
  const name =
    games.data?.find((g) => g.id === challenge.gameId)?.name ?? '1v1 challenge';
  return (
    <>
      <Link
        href={vault ? `/challenges/${id}` : '/challenges'}
        className="back-link"
      >
        ← {vault ? 'Challenge details' : 'Discover challenges'}
      </Link>
      <PageHeading
        eyebrow={vault ? 'LOCK IT IN' : 'THE CHALLENGE'}
        title={vault ? 'Your challenge. Secured.' : `${name}. Head to head.`}
      >
        {platformName(challenge.platform)} · 1v1 · Non-withdrawable TEST credits
      </PageHeading>
      <div className="challenge-status">
        <StatusBadge status={challenge.status} />
        <span className="muted small">
          Created{' '}
          {new Date(challenge.createdAt).toLocaleDateString('en', {
            month: 'short',
            day: 'numeric',
          })}
        </span>
      </div>
      {notice && (
        <div className="notice success" role="status">
          {notice}
        </div>
      )}
      {error && <ErrorState message={error} />}{' '}
      {resource.error && (
        <ErrorState
          message={resource.error}
          retry={() => void resource.reload()}
        />
      )}
      <div className="two-column challenge-detail">
        <div className="stack">
          <h2>The players</h2>
          <PlayerCard player={a} label="PLAYER A" you={a?.userId === user.id} />
          <div className="versus">VS</div>
          <PlayerCard player={b} label="PLAYER B" you={b?.userId === user.id} />
          <Card>
            <div className="detail-line">
              <span>Stake per player</span>
              <strong>{credits(challenge.stakeAmount)} TEST</strong>
            </div>
            <div className="detail-line">
              <span>Platform</span>
              <strong>{platformName(challenge.platform)}</strong>
            </div>
            <div className="detail-line">
              <span>Format</span>
              <strong>1v1</strong>
            </div>
          </Card>
          {!me &&
            challenge.status === 'OPEN' &&
            challenge.players.length < 2 && (
              <Button busy={busy} onClick={() => void action('join')}>
                Join challenge
                <Icon name="arrow" size={18} />
              </Button>
            )}
          {!me && (
            <p className="muted small">
              A matching game account is required.{' '}
              <Link href="/profile">Set up your profile</Link>
            </p>
          )}
          {canCancel && (
            <Button variant="ghost" onClick={() => setDialog('cancel')}>
              Cancel challenge
            </Button>
          )}
        </div>
        <div>
          {me ? (
            <VaultCard
              balance={
                vaultResource.error
                  ? null
                  : (vaultResource.data?.balance ?? null)
              }
              secured={secured}
              status={challenge.status}
            >
              {vaultResource.error && (
                <ErrorState
                  message={vaultResource.error}
                  retry={() => void vaultResource.reload()}
                />
              )}{' '}
              {!vault && (
                <Link
                  className="button primary full"
                  href={`/challenges/${id}/vault`}
                >
                  Open vault
                  <Icon name="lock" size={17} />
                </Link>
              )}
              {vault && canFund && (
                <Button
                  className="full"
                  busy={busy}
                  onClick={() => setDialog('fund')}
                >
                  Secure my stake
                  <Icon name="lock" size={17} />
                </Button>
              )}
              {vault &&
                me &&
                funded(me) &&
                !['SETTLED', 'REFUNDED'].includes(challenge.status) && (
                  <div className="funded-note">
                    <Icon name="check" size={18} /> Your stake is secured
                    {!secured && (
                      <small>Waiting for your opponent to fund.</small>
                    )}
                  </div>
                )}
              {challenge.status === 'OPEN' && (
                <p className="muted small">
                  Funding opens when an opponent joins.
                </p>
              )}
            </VaultCard>
          ) : (
            <Card className="help-card">
              <Icon name="shield" size={40} />
              <h2>
                One vault.
                <br />
                Two committed players.
              </h2>
              <p>
                Join the challenge to access your vault and secure your stake.
              </p>
            </Card>
          )}
          {secured && (
            <p className="phase-note">
              Both stakes are secured. Your opponent is locked in.
            </p>
          )}
          {me && challenge.matches[0] && (
            <Link
              className="button primary full"
              href={`/matches/${challenge.matches[0].id}`}
            >
              Open match room
            </Link>
          )}
        </div>
      </div>
      <ConfirmationDialog
        open={dialog !== null}
        title={
          dialog === 'fund' ? 'Secure your stake?' : 'Cancel this challenge?'
        }
        confirmLabel={
          dialog === 'fund'
            ? `Secure ${credits(challenge.stakeAmount)} TEST`
            : 'Confirm cancellation'
        }
        busy={busy}
        onClose={() => setDialog(null)}
        onConfirm={() => void action(dialog === 'fund' ? 'fund' : 'cancel')}
      >
        {dialog === 'fund' ? (
          <p>
            The server will move{' '}
            <strong>{credits(challenge.stakeAmount)} TEST</strong> from your
            available credits into this challenge vault. You cannot cancel after
            funding.
          </p>
        ) : (
          <p>
            This closes the challenge for both players. No secured credits will
            be moved.
          </p>
        )}
      </ConfirmationDialog>
    </>
  );
}
