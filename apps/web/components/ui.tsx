'use client';
import {
  useEffect,
  useRef,
  useId,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react';
import Link from 'next/link';
import {
  Challenge,
  Game,
  Player,
  Transaction,
  credits,
  funded,
  platformName,
} from '@/lib/contracts';

export function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const paths: Record<string, string> = {
    home: 'M3 10 12 3l9 7v11h-6v-7H9v7H3Z',
    compass: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20M16 8l-3 5-5 3 3-5Z',
    plus: 'M12 5v14M5 12h14',
    wallet: 'M3 6h17v15H3V6l14-4v4M15 11h6v5h-6Z',
    user: 'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0M4 21v-3a8 8 0 0 1 16 0v3',
    lock: 'M6 10h12v11H6ZM8 10V6a4 4 0 0 1 8 0v4',
    arrow: 'M4 12h16M14 6l6 6-6 6',
    check: 'm5 12 4 4L19 6',
    logout: 'M9 3H3v18h6M10 12h11m-5-5 5 5-5 5',
    bolt: 'm13 2-9 12h7l-1 8 10-13h-7Z',
    game: 'M8 7h8c5 0 7 13 3 13l-4-4H9l-4 4C1 20 3 7 8 7ZM6 11h4m-2-2v4m7-2h.1m3 2h.1',
    shield: 'm12 2 9 4v6c0 5-9 10-9 10S3 17 3 12V6Z',
    close: 'm6 6 12 12M6 18 18 6',
    history: 'M3 11a9 9 0 1 1 2 7M3 4v7h7m2-5v6l4 2',
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name] ?? paths.game} />
    </svg>
  );
}
export function Button({
  variant = 'primary',
  busy,
  children,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  busy?: boolean;
}) {
  return (
    <button
      {...props}
      className={`button ${variant} ${className}`}
      disabled={props.disabled || busy}
      aria-busy={busy || undefined}
    >
      {busy && <span className="spinner" aria-hidden="true" />}
      {children}
    </button>
  );
}
export function Card({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`card ${className}`}>{children}</div>;
}
export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
export function StatusBadge({ status }: { status: string }) {
  const label: Record<string, string> = {
    OPEN: 'Open challenge',
    JOINED: 'Ready to fund',
    FUNDED: 'Prize secured',
    CANCELLED: 'Cancelled',
    SETTLED: 'Settled',
    REFUNDED: 'Refunded',
    IN_PROGRESS: 'In progress',
  };
  return (
    <Badge
      tone={
        ['FUNDED', 'SETTLED', 'LOCKED'].includes(status)
          ? 'success'
          : status === 'OPEN'
            ? 'purple'
            : 'neutral'
      }
    >
      {label[status] ?? status.replaceAll('_', ' ').toLowerCase()}
    </Badge>
  );
}
export function Avatar({ name, large }: { name: string; large?: boolean }) {
  return (
    <span className={`avatar ${large ? 'large' : ''}`} aria-hidden="true">
      {name.slice(0, 2).toUpperCase()}
    </span>
  );
}
export function PlayerCard({
  player,
  label,
  you,
}: {
  player?: Player;
  label: string;
  you?: boolean;
}) {
  return (
    <Card className="player-card">
      <div className="row">
        <Avatar name={player?.user.username ?? '?'} />
        <div>
          <span className="eyebrow">
            {label}
            {you ? ' · YOU' : ''}
          </span>
          <strong>
            {player?.user.displayName ??
              player?.user.username ??
              'Waiting for opponent'}
          </strong>
        </div>
      </div>
      {player ? (
        <Badge tone={funded(player) ? 'success' : 'neutral'}>
          {funded(player) ? 'Stake secured' : 'Not funded'}
        </Badge>
      ) : (
        <span className="muted">One open spot</span>
      )}
    </Card>
  );
}
export function GameCard({ game }: { game: Game }) {
  return (
    <Link href={`/challenges?gameId=${game.id}`} className="game-card">
      <div className="pitch" aria-hidden="true">
        <span />
        <i />
      </div>
      <div className="game-card-copy">
        <Badge tone="success">1v1 arena</Badge>
        <h3>{game.name}</h3>
        <span>
          Find your next opponent <Icon name="arrow" size={16} />
        </span>
      </div>
    </Link>
  );
}
export function ChallengeCard({
  challenge,
  gameName,
}: {
  challenge: Challenge;
  gameName: string;
}) {
  const creator = challenge.players.find(
    (p) => p.userId === challenge.creatorId,
  );
  return (
    <Link href={`/challenges/${challenge.id}`} className="card challenge-card">
      <div className="row spread">
        <span className="game-symbol">
          <Icon name="game" />
        </span>
        <StatusBadge status={challenge.status} />
      </div>
      <h3>{gameName}</h3>
      <p className="muted small">
        {platformName(challenge.platform)} <span className="dot">·</span> 1v1
        challenge
      </p>
      <div className="row creator">
        <Avatar name={creator?.user.username ?? 'GG'} />
        <span>
          {creator?.user.username ?? 'Player'}
          <small>{challenge.players.length}/2 players joined</small>
        </span>
      </div>
      <div className="challenge-footer">
        <span>
          <strong>{credits(challenge.stakeAmount)}</strong>{' '}
          <span className="muted small">TEST stake</span>
        </span>
        <span className="circle-arrow">
          <Icon name="arrow" size={17} />
        </span>
      </div>
    </Link>
  );
}
export function VaultCard({
  balance,
  secured,
  status,
  children,
}: {
  balance: number | null;
  secured: boolean;
  status: string;
  children?: ReactNode;
}) {
  return (
    <Card className={`vault-card ${secured ? 'secured' : ''}`}>
      <div className="vault-emblem">
        <Icon name="lock" size={32} />
      </div>
      <span className="eyebrow">CHALLENGE VAULT</span>
      <h2>
        {secured
          ? 'PRIZE SECURED 🔒'
          : status === 'SETTLED' || status === 'REFUNDED'
            ? 'Vault completed'
            : 'Secure your stake'}
      </h2>
      <div className="vault-amount">
        {balance === null ? '—' : credits(balance)} <span>TEST</span>
      </div>
      <p className="muted">
        {secured
          ? 'Both players are funded. Your challenge is ready.'
          : 'Credits secured in this challenge, verified by the server.'}
      </p>
      {children}
      <div className="vault-assurance">
        <Icon name="shield" size={16} /> Non-withdrawable test credits
      </div>
    </Card>
  );
}
export function TransactionRow({
  transaction: t,
}: {
  transaction: Transaction;
}) {
  const labels: Record<string, string> = {
    INITIAL_CREDIT: 'Welcome credits',
    STAKE_LOCK: 'Stake secured',
    MATCH_WIN: 'Match prize',
    STAKE_REFUND: 'Stake returned',
  };
  return (
    <li className="transaction-row">
      <span className={`transaction-icon ${t.amount > 0 ? 'positive' : ''}`}>
        <Icon name={t.type === 'STAKE_LOCK' ? 'lock' : 'wallet'} />
      </span>
      <div className="transaction-description">
        <strong>{labels[t.type] ?? 'Credit activity'}</strong>
        <span>
          {t.type} ·{' '}
          <time dateTime={t.timestamp}>
            {new Date(t.timestamp).toLocaleDateString('en', {
              month: 'short',
              day: 'numeric',
            })}
          </time>
        </span>
        {t.challengeId && (
          <Link href={`/challenges/${t.challengeId}`}>View challenge</Link>
        )}
      </div>
      <strong className={t.amount > 0 ? 'positive' : ''}>
        {t.amount > 0 ? '+' : ''}
        {credits(t.amount)}
        <small>TEST</small>
      </strong>
    </li>
  );
}
export function LoadingState({
  label = 'Loading your arena…',
}: {
  label?: string;
}) {
  return (
    <div className="state" role="status">
      <span className="spinner" />
      {label}
    </div>
  );
}
export function EmptyState({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="state empty">
      <Icon name="compass" size={32} />
      <h3>{title}</h3>
      {children}
    </div>
  );
}
export function ErrorState({
  message,
  retry,
}: {
  message: string;
  retry?: () => void;
}) {
  return (
    <div className="error-state" role="alert">
      <p>{message}</p>
      {retry && (
        <Button variant="secondary" onClick={retry}>
          Try again
        </Button>
      )}
    </div>
  );
}
export function Modal({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    id = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby={id}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="row spread">
        <h2 id={id}>{title}</h2>
        <Button variant="ghost" aria-label="Close dialog" onClick={onClose}>
          <Icon name="close" />
        </Button>
      </div>
      {children}
    </dialog>
  );
}
export function ConfirmationDialog({
  open,
  title,
  children,
  confirmLabel,
  busy,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  busy: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <div className="dialog-copy">{children}</div>
      <div className="dialog-actions">
        <Button variant="secondary" onClick={onClose} disabled={busy}>
          Go back
        </Button>
        <Button busy={busy} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
export function PageHeading({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <header className="page-heading">
      <span className="eyebrow">{eyebrow}</span>
      <h1>{title}</h1>
      {children && <p className="muted">{children}</p>}
    </header>
  );
}
