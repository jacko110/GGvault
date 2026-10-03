'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useResource } from '@/lib/use-resource';
import { post } from '@/lib/client';
import {
  Match,
  Evidence,
  Refund,
  TimelineEvent,
  MatchSummary,
  matchLabels,
} from '@/lib/match-contracts';
import { Page, credits, platformName } from '@/lib/contracts';
import { useSession } from './shell';
import {
  Badge,
  Button,
  Card,
  ConfirmationDialog,
  EmptyState,
  ErrorState,
  LoadingState,
  Modal,
  PageHeading,
  Avatar,
} from './ui';
import {
  EvidenceCards,
  EvidenceUpload,
  MatchTimeline,
  Outcome,
  Scoreboard,
  UploadPolicy,
  playerName,
} from './match-parts';
export function MatchScreen({ id }: { id: string }) {
  const { user, refreshBalance } = useSession(),
    room = useResource<Match>(`/matches/${id}`),
    timeline = useResource<TimelineEvent[]>(`/matches/${id}/timeline`),
    evidence = useResource<Evidence[]>(`/matches/${id}/evidence`),
    refunds = useResource<Refund[]>(
      room.data?.status === 'REFUNDED' ? `/matches/${id}/refunds` : null,
    );
  const [dialog, setDialog] = useState<'result' | 'confirm' | 'dispute' | null>(
      null,
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [policy, setPolicy] = useState<UploadPolicy | null>(null),
    [policyError, setPolicyError] = useState(false);
  const pending = useRef(false),
    reloadRoom = room.reload,
    reloadTimeline = timeline.reload,
    reloadEvidence = evidence.reload;
  useEffect(() => {
    let active = true;
    fetch('/api/evidence/policy')
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((p) => {
        if (active) setPolicy(p);
      })
      .catch(() => {
        if (active) setPolicyError(true);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible' && !pending.current) {
        void reloadRoom();
        void reloadTimeline();
        void reloadEvidence();
      }
    }, 5000);
    return () => clearInterval(timer);
  }, [reloadRoom, reloadTimeline, reloadEvidence]);
  const roomStatus = room.data?.status;
  useEffect(() => {
    if (roomStatus && ['SETTLED', 'REFUNDED'].includes(roomStatus)) {
      void refreshBalance();
      window.dispatchEvent(new Event('ggvault:wallet-changed'));
    }
  }, [roomStatus, refreshBalance]);
  async function refresh() {
    await Promise.all([reloadRoom(), reloadTimeline(), reloadEvidence()]);
  }
  async function act(action: string, body: object = {}) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await post(`/matches/${id}/${action}`, body);
      setDialog(null);
      setNotice('Match updated.');
      await refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Please try again.');
      setDialog(null);
      await refresh();
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  function submitResult(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void act('result', {
      myScore: Number(form.get('myScore')),
      opponentScore: Number(form.get('opponentScore')),
    });
  }
  function dispute(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void act('result/dispute', {
      reason: String(new FormData(event.currentTarget).get('reason')).trim(),
    });
  }
  const match = room.data;
  if (!match)
    return room.error ? (
      <ErrorState message={room.error} retry={() => void reloadRoom()} />
    ) : (
      <LoadingState />
    );
  const me = match.participants.find((p) => p.userId === user.id),
    opponent = match.participants.find((p) => p.userId !== user.id),
    result = match.results[0],
    isSubmitter = result?.submittedByUserId === user.id;
  const canUpload =
      !!me &&
      ['IN_PROGRESS', 'RESULT_SUBMITTED'].includes(match.status) &&
      !isSubmitter,
    terminal = ['SETTLED', 'REFUNDED'].includes(match.status);
  return (
    <>
      <Link href="/matches" className="back-link">
        ← My matches
      </Link>
      <PageHeading
        eyebrow="MATCH ROOM"
        title={`${match.challenge.game.name}. Head to head.`}
      >
        {platformName(match.challenge.platform)} ·{' '}
        {credits(match.challenge.stakeAmount)} TEST per player
      </PageHeading>
      <div role="status" className="match-status-banner">
        <Badge tone={terminal ? 'success' : 'purple'}>
          {matchLabels[match.status] ?? match.status}
        </Badge>
        <strong>
          {match.status === 'READY'
            ? 'PRIZE SECURED 🔒'
            : match.status === 'IN_PROGRESS'
              ? 'MATCH IN PROGRESS'
              : match.status === 'DISPUTED'
                ? 'DISPUTE OPEN · UNDER REVIEW'
                : matchLabels[match.status]?.toUpperCase()}
        </strong>
      </div>
      {notice && (
        <p role="status" className="positive">
          {notice}
        </p>
      )}
      {error && <ErrorState message={error} />}{' '}
      {room.error && (
        <ErrorState message={room.error} retry={() => void reloadRoom()} />
      )}
      <div className="two-column match-room">
        <div className="stack">
          <div className="match-players">
            {match.participants.map((p) => (
              <Card key={p.userId}>
                <Avatar name={p.user.username} />
                <h3>
                  {p.user.username}
                  {p.userId === user.id ? ' · You' : ''}
                </h3>
                <Badge tone={p.readyAt ? 'success' : 'neutral'}>
                  {p.readyAt ? 'READY ✓' : 'NOT READY · WAITING'}
                </Badge>
              </Card>
            ))}
          </div>
          {!terminal && (
            <Card className="match-vault">
              <span className="eyebrow">
                {match.status === 'DISPUTED'
                  ? 'PRIZE REMAINS LOCKED'
                  : 'SECURED VAULT'}
              </span>
              <strong>{credits(match.vault.balance)} TEST 🔒</strong>
              <p className="muted small">
                Verified by the server. Non-withdrawable TEST credits.
              </p>
            </Card>
          )}
          {match.status === 'READY' && me && (
            <Card>
              <h2>Ready to compete?</h2>
              <p>
                Play the actual game externally. GGVault records readiness,
                results and verification.
              </p>
              <Button
                className="full"
                busy={busy}
                disabled={!!me.readyAt}
                onClick={() => void act('ready')}
              >
                {me.readyAt ? 'Waiting for your opponent' : 'READY UP'}
              </Button>
            </Card>
          )}
          {match.status === 'IN_PROGRESS' && (
            <Card>
              <h2>MATCH IN PROGRESS</h2>
              {match.startedAt && (
                <p>
                  Started{' '}
                  <time dateTime={match.startedAt}>
                    {new Date(match.startedAt).toLocaleString()}
                  </time>
                </p>
              )}
              <p>
                Finish your game, add evidence, then report the final score.
              </p>
              <Button
                onClick={() => setDialog('result')}
                disabled={!me || busy}
              >
                SUBMIT RESULT
              </Button>
            </Card>
          )}
          {match.status === 'RESULT_SUBMITTED' && result && (
            <Card>
              <h2>
                {isSubmitter
                  ? 'RESULT SUBMITTED'
                  : `${playerName(match, result.submittedByUserId).toUpperCase()} REPORTED`}
              </h2>
              <Scoreboard match={match} />
              {isSubmitter ? (
                <p role="status">
                  Waiting for {opponent?.user.username} to confirm…
                </p>
              ) : (
                me && (
                  <>
                    <p>
                      Review the score and upload any evidence before deciding.
                    </p>
                    <div className="action-row">
                      <Button onClick={() => setDialog('confirm')}>
                        CONFIRM RESULT
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => setDialog('dispute')}
                      >
                        DISPUTE
                      </Button>
                    </div>
                  </>
                )
              )}
            </Card>
          )}
          {match.status === 'DISPUTED' && (
            <Card>
              <h2>UNDER REVIEW</h2>
              <Scoreboard match={match} />
              <p>The prize remains locked while the result is reviewed.</p>
              <p className="resolution-note">{result?.disputes[0]?.reason}</p>
              <p className="muted small">
                Evidence is now locked. A moderator will review the recorded
                score and evidence.
              </p>
            </Card>
          )}
          {terminal && (
            <>
              <Outcome match={match} refunds={refunds.data} />
              {refunds.error && (
                <ErrorState
                  message={refunds.error}
                  retry={() => void refunds.reload()}
                />
              )}
              <Link href="/transactions" className="button secondary">
                View updated transaction history
              </Link>
            </>
          )}
        </div>
        <div className="stack">
          <Card>
            <div className="section-heading">
              <h2>Evidence</h2>
              <Badge>PRIVATE</Badge>
            </div>
            <p className="muted small">
              Available only to players and authorized reviewers.
            </p>
            {evidence.error ? (
              <ErrorState
                message={evidence.error}
                retry={() => void reloadEvidence()}
              />
            ) : evidence.data?.length ? (
              <EvidenceCards items={evidence.data} match={match} />
            ) : (
              <p className="muted">No evidence uploaded yet.</p>
            )}
          </Card>
          {canUpload &&
            (policy ? (
              <EvidenceUpload id={id} policy={policy} onUploaded={refresh} />
            ) : policyError ? (
              <ErrorState message="Upload settings could not be loaded. Refresh this page to try again." />
            ) : (
              <LoadingState label="Loading upload limits…" />
            ))}
          {timeline.error ? (
            <ErrorState
              message={timeline.error}
              retry={() => void reloadTimeline()}
            />
          ) : (
            <MatchTimeline events={timeline.data ?? []} match={match} />
          )}
        </div>
      </div>
      <Modal
        open={dialog === 'result'}
        title="FINAL SCORE"
        onClose={() => {
          if (!busy) setDialog(null);
        }}
      >
        <form onSubmit={submitResult} className="form-stack">
          <label>
            {user.username} score
            <input
              name="myScore"
              type="number"
              min="0"
              max="100000"
              step="1"
              required
            />
          </label>
          <label>
            {opponent?.user.username} score
            <input
              name="opponentScore"
              type="number"
              min="0"
              max="100000"
              step="1"
              required
            />
          </label>
          <p>
            Your opponent must confirm. Upload your evidence before submitting;
            your evidence will then be locked.
          </p>
          <Button type="submit" busy={busy}>
            SUBMIT RESULT
          </Button>
        </form>
      </Modal>
      <ConfirmationDialog
        open={dialog === 'confirm'}
        title="Confirm final result?"
        confirmLabel="Confirm final result"
        busy={busy}
        onClose={() => setDialog(null)}
        onConfirm={() => void act('result/confirm')}
      >
        <Scoreboard match={match} />
        <p>This action finalizes the match and may trigger settlement.</p>
      </ConfirmationDialog>
      <Modal
        open={dialog === 'dispute'}
        title="DISPUTE RESULT"
        onClose={() => {
          if (!busy) setDialog(null);
        }}
      >
        <form className="form-stack" onSubmit={dispute}>
          <p>
            The prize remains locked while the result is reviewed. Upload any
            evidence before opening the dispute.
          </p>
          <label>
            Dispute reason
            <textarea
              name="reason"
              minLength={5}
              maxLength={2000}
              required
              rows={4}
            />
          </label>
          <Button busy={busy} type="submit">
            Open dispute
          </Button>
        </form>
      </Modal>
    </>
  );
}
export function MyMatchesScreen() {
  const [status, setStatus] = useState(''),
    [cursors, setCursors] = useState<string[]>([]);
  const resource = useResource<Page<MatchSummary>>(
    `/matches?limit=12${status ? `&status=${status}` : ''}${cursors.length ? `&cursor=${cursors[cursors.length - 1]}` : ''}`,
  );
  return (
    <>
      <PageHeading eyebrow="YOUR COMPETITION" title="My matches">
        Ready up, review a result or revisit your wins.
      </PageHeading>
      <div className="toolbar">
        <label>
          Match status
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setCursors([]);
            }}
          >
            <option value="">All matches</option>
            {[
              'READY',
              'IN_PROGRESS',
              'RESULT_SUBMITTED',
              'DISPUTED',
              'SETTLED',
              'REFUNDED',
            ].map((s) => (
              <option value={s} key={s}>
                {matchLabels[s]}
              </option>
            ))}
          </select>
        </label>
        <Button variant="secondary" onClick={() => void resource.reload()}>
          Refresh matches
        </Button>
      </div>
      {resource.error ? (
        <ErrorState
          message={resource.error}
          retry={() => void resource.reload()}
        />
      ) : resource.loading ? (
        <LoadingState />
      ) : resource.data?.items.length ? (
        <div className="challenge-grid">
          {resource.data.items.map((match) => (
            <Link
              className="card challenge-card"
              key={match.id}
              href={`/matches/${match.id}`}
            >
              <Badge>{matchLabels[match.status]}</Badge>
              <h2>{match.game}</h2>
              <p>{match.players.join(' vs ')}</p>
              <p className="muted">
                {platformName(match.platform)} · {credits(match.stakeAmount)}{' '}
                TEST stake
              </p>
              <strong>
                {match.status === 'READY'
                  ? 'Ready up'
                  : match.status === 'RESULT_SUBMITTED'
                    ? 'Review result'
                    : match.status === 'IN_PROGRESS'
                      ? 'Open match'
                      : match.status === 'DISPUTED'
                        ? 'View review status'
                        : 'View outcome'}{' '}
                →
              </strong>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState title="Your next match starts with a challenge.">
          <Link href="/challenges" className="button primary">
            Find a challenge
          </Link>
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
  );
}
