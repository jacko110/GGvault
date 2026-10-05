'use client';
import { useState, useRef, type FormEvent } from 'react';
import Link from 'next/link';
import { useResource } from '../../web/lib/use-resource';
import { post } from '../../web/lib/client';
import {
  Dispute,
  Match,
  Refund,
  matchLabels,
} from '../../web/lib/match-contracts';
import { Page } from '../../web/lib/contracts';
import {
  Badge,
  Button,
  Card,
  ConfirmationDialog,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeading,
} from '../../web/components/ui';
import {
  EvidenceCards,
  MatchTimeline,
  Outcome,
  Scoreboard,
  playerName,
} from '../../web/components/match-parts';
export function DisputeQueue() {
  const [status, setStatus] = useState('REVIEW'),
    [cursors, setCursors] = useState<string[]>([]),
    resource = useResource<Page<Dispute>>(
      `/moderation/disputes?limit=12&status=${status}${cursors.length ? `&cursor=${cursors[cursors.length - 1]}` : ''}`,
    );
  return (
    <>
      <PageHeading eyebrow="TRUST & FAIR PLAY" title="Dispute dashboard">
        Review the record. Make a reasoned decision.
      </PageHeading>
      <div className="toolbar">
        <label>
          Dispute status
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setCursors([]);
            }}
          >
            <option value="OPEN">OPEN</option>
            <option value="REVIEW">UNDER REVIEW</option>
            <option value="RESOLVED">RESOLVED</option>
          </select>
        </label>
        <Button variant="secondary" onClick={() => void resource.reload()}>
          Refresh queue
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
          {resource.data.items.map((d) => (
            <Link
              className="card dispute-card"
              href={`/disputes/${d.id}`}
              key={d.id}
            >
              <Badge>{matchLabels[d.status] ?? d.status}</Badge>
              <h2>{d.game.name}</h2>
              <p>{d.players.map((p) => p.username).join(' vs ')}</p>
              {d.proposedResult && (
                <p>
                  Reported score:{' '}
                  {
                    d.players.find(
                      (p) => p.id === d.proposedResult!.submittedByUserId,
                    )?.username
                  }{' '}
                  {d.proposedResult.myScore} — {d.proposedResult.opponentScore}
                </p>
              )}
              <p className="resolution-note">{d.reason}</p>
              <small className="muted file-name">
                Dispute {d.id}
                <br />
                {new Date(d.createdAt).toLocaleString()}
              </small>
              <strong>Review dispute →</strong>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState title="No disputes in this queue." />
      )}
      <div className="pagination">
        <Button
          disabled={!cursors.length}
          variant="secondary"
          onClick={() => setCursors((old) => old.slice(0, -1))}
        >
          Previous
        </Button>
        <Button
          disabled={!resource.data?.nextCursor}
          variant="secondary"
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
export function DisputeReview({ id }: { id: string }) {
  const resource = useResource<Dispute>(`/moderation/disputes/${id}`),
    d = resource.data,
    room = useResource<Match>(d ? `/matches/${d.matchId}` : null),
    refunds = useResource<Refund[]>(
      room.data?.status === 'REFUNDED'
        ? `/matches/${d!.matchId}/refunds`
        : null,
    );
  const [resolution, setResolution] = useState(''),
    [reason, setReason] = useState(''),
    [confirm, setConfirm] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const pending = useRef(false);
  async function resolve() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      await post(`/moderation/disputes/${id}/resolve`, {
        resolution,
        reason: reason.trim(),
      });
    } catch (error) {
      await Promise.allSettled([resource.reload(), room.reload()]);
      setError(
        error instanceof Error
          ? error.message
          : 'Resolution could not be confirmed. Refresh before retrying.',
      );
    } finally {
      setConfirm(false);
      await Promise.all([resource.reload(), room.reload()]);
      pending.current = false;
      setBusy(false);
    }
  }
  function review(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (reason.trim().length < 3) {
      setError('Enter a resolution reason of at least 3 characters.');
      return;
    }
    setError('');
    setConfirm(true);
  }
  if (!d)
    return resource.error ? (
      <ErrorState
        message={resource.error}
        retry={() => void resource.reload()}
      />
    ) : (
      <LoadingState />
    );
  const match = room.data ?? d.match,
    a = d.players.find((p) => p.slot === 'PLAYER_A')!,
    b = d.players.find((p) => p.slot === 'PLAYER_B')!;
  const decision =
    resolution === 'VOID_MATCH'
      ? 'VOID MATCH'
      : `${resolution === 'PLAYER_A_WINS' ? a.username : b.username} WINS`;
  return (
    <>
      <Link href="/" className="back-link">
        ← Dispute dashboard
      </Link>
      <PageHeading eyebrow="MODERATOR REVIEW" title={d.game.name}>
        {a.username} vs {b.username}
      </PageHeading>
      <div className="match-status-banner">
        <Badge>{matchLabels[d.status] ?? d.status}</Badge>
        <span className="file-name">Dispute {d.id}</span>
        <Button
          variant="secondary"
          onClick={() => {
            void resource.reload();
            void room.reload();
          }}
        >
          Refresh review
        </Button>
      </div>
      {error && <ErrorState message={error} />}{' '}
      {resource.error && <ErrorState message={resource.error} />}{' '}
      {room.error && (
        <ErrorState message={room.error} retry={() => void room.reload()} />
      )}
      <div className="two-column">
        <div className="stack">
          <Card>
            <h2>Reported result</h2>
            <Scoreboard match={match} />
            <p>
              Proposed winner:{' '}
              <strong>
                {playerName(
                  match,
                  d.proposedResult?.proposedWinnerUserId ?? null,
                )}
              </strong>
            </p>
            <h3>Dispute reason</h3>
            <p className="resolution-note">{d.reason}</p>
            <p className="small muted file-name">
              Match: {d.matchId}
              <br />
              Challenge: {d.challengeId}
            </p>
          </Card>
          <h2>Private evidence</h2>
          {d.evidence.length ? (
            <EvidenceCards items={d.evidence} match={match} />
          ) : (
            <EmptyState title="No evidence was submitted." />
          )}
          <MatchTimeline events={d.timeline} match={match} />
        </div>
        <div className="stack">
          {d.status === 'RESOLVED' ? (
            <>
              <Card>
                <h2>Dispute resolved</h2>
                <p>{d.resolution?.replaceAll('_', ' ')}</p>
                <p className="resolution-note">{d.resolutionReason}</p>
              </Card>
              {room.data && (
                <Outcome match={room.data} refunds={refunds.data} />
              )}{' '}
              {refunds.error && (
                <ErrorState
                  message={refunds.error}
                  retry={() => void refunds.reload()}
                />
              )}
            </>
          ) : (
            <Card>
              <h2>Resolve dispute</h2>
              <p>Review all evidence before committing a final decision.</p>
              <form className="form-stack" onSubmit={review}>
                <fieldset className="decision-options">
                  <legend>Decision</legend>
                  {[
                    ['PLAYER_A_WINS', `${a.username} · PLAYER A WINS`],
                    ['PLAYER_B_WINS', `${b.username} · PLAYER B WINS`],
                    ['VOID_MATCH', 'VOID MATCH'],
                  ].map(([value, label]) => (
                    <label key={value}>
                      <input
                        type="radio"
                        name="resolution"
                        value={value}
                        checked={resolution === value}
                        onChange={() => setResolution(value)}
                        required
                      />
                      {label}
                    </label>
                  ))}
                </fieldset>
                <label>
                  Resolution reason
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    minLength={3}
                    maxLength={2000}
                    required
                    rows={5}
                  />
                </label>
                <Button
                  type="submit"
                  disabled={!resolution || reason.trim().length < 3}
                  busy={busy}
                >
                  Review decision
                </Button>
              </form>
            </Card>
          )}
        </div>
      </div>
      <ConfirmationDialog
        open={confirm}
        title={`Resolve dispute as: ${decision}`}
        confirmLabel="RESOLVE"
        busy={busy}
        onClose={() => setConfirm(false)}
        onConfirm={() => void resolve()}
      >
        <p>
          {resolution === 'VOID_MATCH'
            ? "This will return each player's original stake."
            : 'This will release the secured prize to the selected winner.'}
        </p>
        <p>
          This decision is final. A conflicting or completed resolution cannot
          be replaced.
        </p>
        <p className="resolution-note">{reason}</p>
      </ConfirmationDialog>
    </>
  );
}
