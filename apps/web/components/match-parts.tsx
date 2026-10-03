'use client';
import { useState, type FormEvent } from 'react';
import Image from 'next/image';
import { Button, Card, Badge, ErrorState, Modal } from './ui';
import { Evidence, Match, Refund, TimelineEvent } from '../lib/match-contracts';
import { credits } from '../lib/contracts';
import { ApiError } from '../lib/errors';
export const playerName = (match: Match, id: string | null) =>
  match.participants.find((p) => p.userId === id)?.user.username ?? 'Moderator';
export function Scoreboard({ match }: { match: Match }) {
  const result = match.results[0];
  if (!result) return null;
  const a = match.participants.find(
      (p) => p.userId === match.challenge.createdByUserId,
    )!,
    b = match.participants.find((p) => p.userId !== a.userId)!;
  return (
    <div className="scoreboard" aria-label="Reported final score">
      <span>
        {a.user.username}
        <strong>
          {result.submittedByUserId === a.userId
            ? result.myScore
            : result.opponentScore}
        </strong>
      </span>
      <b aria-hidden="true">—</b>
      <span>
        {b.user.username}
        <strong>
          {result.submittedByUserId === b.userId
            ? result.myScore
            : result.opponentScore}
        </strong>
      </span>
    </div>
  );
}
export function Outcome({
  match,
  refunds,
}: {
  match: Match;
  refunds: Refund[] | null;
}) {
  const settlement = match.settlement;
  if (!settlement) return null;
  const amount = (n: number | null) =>
    n === null ? 'Unavailable' : `${credits(n)} TEST`;
  return (
    <Card className="outcome-card">
      <span className="eyebrow">
        {match.status === 'REFUNDED'
          ? 'ORIGINAL STAKES RETURNED'
          : 'RESULT VERIFIED'}
      </span>
      <h2>{match.status === 'REFUNDED' ? 'MATCH VOID' : '🏆 WINNER'}</h2>
      {settlement.winner && <h3>{settlement.winner.username}</h3>}
      <Scoreboard match={match} />
      {match.status === 'REFUNDED' ? (
        <>
          <p>The match was voided. No winner was awarded.</p>
          {refunds === null ? (
            <p role="status">Loading verified refunds…</p>
          ) : (
            refunds.map((refund) => (
              <div className="detail-line" key={refund.userId}>
                <span>{playerName(match, refund.userId)} refund</span>
                <strong>+{credits(refund.amount)} TEST</strong>
              </div>
            ))
          )}
          <div className="detail-line">
            <span>Vault</span>
            <strong>{credits(match.vault.balance)} TEST</strong>
          </div>
        </>
      ) : (
        <>
          <div className="detail-line">
            <span>Prize pool</span>
            <strong>{amount(settlement.vaultAmount)}</strong>
          </div>
          <div className="detail-line">
            <span>Platform fee</span>
            <strong>{amount(settlement.platformFee)}</strong>
          </div>
          <div className="detail-line">
            <span>Winner received</span>
            <strong>{amount(settlement.winnerAmount)}</strong>
          </div>
          <p className="positive">✓ Result verified · ✓ Prize released</p>
        </>
      )}
      {match.results[0]?.disputes[0]?.resolutionReason && (
        <p className="resolution-note">
          Moderator decision: {match.results[0].disputes[0].resolutionReason}
        </p>
      )}
    </Card>
  );
}
const eventNames: Record<string, string> = {
  CHALLENGE_FUNDED: 'Challenge funded',
  MATCH_CREATED: 'Match ready',
  PLAYER_READY: 'ready',
  MATCH_STARTED: 'Match started',
  RESULT_SUBMITTED: 'Result submitted',
  EVIDENCE_UPLOADED: 'Evidence uploaded',
  RESULT_CONFIRMED: 'Result confirmed',
  RESULT_DISPUTED: 'Result disputed',
  DISPUTE_OPENED: 'Dispute opened',
  DISPUTE_REVIEWED: 'Moderator review',
  DISPUTE_RESOLVED: 'Dispute resolved',
  MATCH_SETTLED: 'Match settled',
  MATCH_REFUNDED: 'Match refunded',
};
export function MatchTimeline({
  events,
  match,
}: {
  events: TimelineEvent[];
  match: Match;
}) {
  return (
    <Card>
      <h2>Match timeline</h2>
      <ol className="match-timeline">
        {events.map((event) => (
          <li key={event.id}>
            <span className="timeline-marker" />
            <div>
              <strong>
                {event.type === 'PLAYER_READY'
                  ? `${playerName(match, event.actorUserId)} READY ✓`
                  : (eventNames[event.type] ?? event.type.replaceAll('_', ' '))}
              </strong>
              <time dateTime={event.createdAt}>
                {new Date(event.createdAt).toLocaleString()}
              </time>
            </div>
          </li>
        ))}
      </ol>
      {events.length === 0 && <p className="muted">No events yet.</p>}
    </Card>
  );
}
export function EvidenceCards({
  items,
  match,
}: {
  items: Evidence[];
  match: Match;
}) {
  const [selected, setSelected] = useState<Evidence | null>(null);
  const src = selected ? `/api/evidence/${match.id}/${selected.id}` : '';
  return (
    <>
      <div className="evidence-grid">
        {items.map((item) => (
          <Card key={item.id}>
            <Badge>{item.type === 'VIDEO' ? 'Video' : 'Screenshot'}</Badge>
            <h3 className="file-name">{item.originalFilename}</h3>
            <p className="muted small">
              Uploaded by {playerName(match, item.uploadedByUserId)}
              <br />
              <time dateTime={item.createdAt}>
                {new Date(item.createdAt).toLocaleString()}
              </time>
            </p>
            <Button variant="secondary" onClick={() => setSelected(item)}>
              View evidence
            </Button>
          </Card>
        ))}
      </div>
      <Modal
        open={!!selected}
        title="Evidence preview"
        onClose={() => setSelected(null)}
      >
        {selected?.type === 'VIDEO' ? (
          <video
            src={src}
            controls
            preload="metadata"
            className="evidence-preview"
            aria-label={`Evidence video: ${selected.originalFilename}`}
          />
        ) : (
          selected && (
            <Image
              unoptimized
              src={src}
              alt={`Evidence uploaded by ${playerName(match, selected.uploadedByUserId)}`}
              width={800}
              height={600}
              className="evidence-preview"
            />
          )
        )}
        {selected && (
          <a
            className="button secondary"
            href={src}
            download={selected.originalFilename}
          >
            Download evidence
          </a>
        )}
        <p className="muted small">
          Evidence is immutable. Access is checked on every request.
        </p>
      </Modal>
    </>
  );
}
export interface UploadPolicy {
  screenshot: number;
  video: number;
  types: string[];
}
export function EvidenceUpload({
  id,
  policy,
  onUploaded,
}: {
  id: string;
  policy: UploadPolicy;
  onUploaded: () => Promise<void>;
}) {
  const [file, setFile] = useState<File | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError('');
    if (!file) {
      setError('Choose an evidence file.');
      return;
    }
    const video = file.type === 'video/mp4';
    if (
      !policy.types.includes(file.type) ||
      !/\.(png|jpe?g|webp|mp4)$/i.test(file.name)
    ) {
      setError('Choose a valid PNG, JPEG, WEBP or MP4 file.');
      return;
    }
    if (
      file.size === 0 ||
      file.size > (video ? policy.video : policy.screenshot)
    ) {
      setError('This file exceeds the allowed size or is empty.');
      return;
    }
    setBusy(true);
    const form = event.currentTarget;
    try {
      const body = new FormData();
      body.set('type', video ? 'VIDEO' : 'SCREENSHOT');
      body.set('file', file);
      const response = await fetch(`/api/evidence/${id}`, {
        method: 'POST',
        body,
      });
      if (!response.ok) {
        const json = await response.json().catch(() => ({}));
        throw new ApiError(json.code ?? 'UNKNOWN', response.status);
      }
      form.reset();
      setFile(null);
      await onUploaded();
    } catch (error) {
      setError(
        error instanceof ApiError
          ? error.message
          : 'Upload could not be confirmed. Refresh the evidence list before trying again.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card>
      <h3>Add evidence</h3>
      <p id="evidence-limits" className="muted small">
        PNG, JPEG or WEBP up to {policy.screenshot / 1048576} MiB; MP4 up to{' '}
        {policy.video / 1048576} MiB. Upload before submitting your result or
        disputing it. Uploads cannot be edited or deleted.
      </p>
      <form onSubmit={submit} className="form-stack">
        <label>
          Evidence file
          <input
            type="file"
            accept={policy.types.join(',')}
            aria-describedby="evidence-limits"
            disabled={busy}
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              setError('');
            }}
          />
        </label>
        {file && (
          <p className="file-name">
            {file.name} · {file.type || 'Unknown type'} ·{' '}
            {(file.size / 1024).toFixed(1)} KiB
          </p>
        )}
        {error && <ErrorState message={error} />}
        <Button type="submit" busy={busy} disabled={!file}>
          Upload evidence
        </Button>
        {busy && <p role="status">Uploading and verifying your evidence…</p>}
      </form>
    </Card>
  );
}
