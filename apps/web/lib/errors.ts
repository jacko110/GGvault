const messages: Record<string, string> = {
  TRANSACTION_RETRY:
    'Another request is being processed. Refresh and try again.',
  RATE_LIMITED: 'Too many requests. Please wait a minute and try again.',
  BETA_STAKE_LIMIT: 'This stake exceeds the TEST-credit beta limit.',
  BETA_OPEN_CHALLENGE_LIMIT: 'Close an open challenge before creating another.',
  BETA_DAILY_CHALLENGE_LIMIT: 'You have reached the daily challenge limit.',
  DRAW_UNSUPPORTED: 'Draws are not supported. Please check the final score.',
  RESULT_SELF_DECISION: 'Your opponent must review your result.',
  RESULT_FINALIZED:
    'This result has already been decided. The latest state has been loaded.',
  RESULT_NOT_SUBMITTED: 'A result has not been submitted yet.',
  MATCH_NOT_READY: 'Both players must be ready first.',
  MATCH_NOT_FOUND: 'This match could not be found.',
  MATCH_NOT_PARTICIPANT: 'This match is private to its players.',
  MATCH_NOT_IN_PROGRESS: 'This match is not accepting results right now.',
  RESULT_ALREADY_SUBMITTED: 'A result has already been submitted.',
  RESULT_SELF_CONFIRM: 'Your opponent must review your result.',
  RESULT_NOT_PENDING:
    'This result has already changed. The latest state has been loaded.',
  DISPUTE_ALREADY_RESOLVED: 'This dispute has already been resolved.',
  MODERATOR_CONFLICT: 'You cannot resolve a match you participated in.',
  EVIDENCE_LOCKED: 'Evidence uploads are closed for this player or match.',
  EVIDENCE_TOO_LARGE: 'This file exceeds the allowed size.',
  EVIDENCE_INVALID_TYPE: 'Choose a valid PNG, JPEG, WEBP or MP4 file.',
  EVIDENCE_FILE_REQUIRED: 'Choose a nonempty evidence file first.',
  EVIDENCE_UNAVAILABLE: 'This evidence could not be loaded.',
  LEDGER_INSUFFICIENT_FUNDS:
    "You don't have enough credits for this challenge.",
  CHALLENGE_FULL: 'Another player already joined this challenge.',
  CHALLENGE_ALREADY_FUNDED:
    'Your stake is already secured. Your vault has been refreshed.',
  CHALLENGE_ALREADY_JOINED: "You're already in this challenge.",
  CHALLENGE_SELF_JOIN:
    'You created this challenge. Invite another player to join.',
  CHALLENGE_HAS_LOCKED_FUNDS:
    'This challenge cannot be cancelled because credits are already secured.',
  CHALLENGE_NOT_OPEN:
    'This challenge is no longer open. Discover another opponent.',
  CHALLENGE_INVALID_STATE:
    'This action is no longer available. Refresh to see the latest status.',
  CHALLENGE_NOT_PARTICIPANT: 'Join this challenge before opening its vault.',
  CHALLENGE_NOT_CREATOR: 'Only the creator can cancel this challenge.',
  CHALLENGE_NOT_FOUND: 'This challenge could not be found.',
  GAME_ACCOUNT_REQUIRED:
    'Add a matching game and platform account in your profile first.',
  GAME_UNAVAILABLE: 'This game is currently unavailable.',
  USER_EMAIL_EXISTS: 'This email is already registered. Try signing in.',
  USER_USERNAME_EXISTS: 'That player name is taken. Try another.',
  AUTH_INVALID_CREDENTIALS: 'Your email or password is incorrect.',
  USER_INACTIVE: 'Your account is not currently active.',
  AUTH_REQUIRED: 'Your session has ended. Please sign in again.',
  AUTH_FORBIDDEN: 'You do not have permission to do that.',
  RESOURCE_EXISTS:
    'This information is already in use. Please check your details.',
  HTTP_400: 'Please check your details and try again.',
  HTTP_429: 'Too many attempts. Please wait a minute and try again.',
  SERVICE_UNAVAILABLE: "We couldn't connect right now. Please try again.",
};
export function friendlyError(code: string, status = 500) {
  return (
    messages[code] ??
    (status === 401
      ? messages.AUTH_REQUIRED
      : status === 429
        ? messages.HTTP_429
        : status === 400
          ? messages.HTTP_400
          : status === 404
            ? 'This page or item could not be found.'
            : 'Something went wrong. Please try again.')
  );
}
export class ApiError extends Error {
  constructor(
    public code: string,
    public status: number,
    public requestId?: string,
  ) {
    super(friendlyError(code, status));
  }
}
