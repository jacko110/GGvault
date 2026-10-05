import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AuthScreen } from '@/components/auth-screen';
import {
  CreateScreen,
  DiscoverScreen,
  TransactionsScreen,
} from '@/components/screens';
import { ChallengeScreen } from '@/components/challenge-screen';
import { Button, ConfirmationDialog } from '@/components/ui';
import { friendlyError } from '@/lib/errors';
const mockPush = jest.fn(),
  mockReplace = jest.fn(),
  mockRefresh = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    refresh: mockRefresh,
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
}));
jest.mock('@/components/shell', () => ({
  Brand: () => <span>GGVault</span>,
  useSession: () => ({
    user: { id: 'ca', username: 'amir' },
    balance: 100,
    refreshBalance: mockRefresh,
  }),
}));
const game = { id: 'cg', name: 'FC 26', slug: 'fc-26' };
const a = {
    userId: 'ca',
    status: 'JOINED',
    user: { username: 'amir', displayName: null },
  },
  b = {
    userId: 'cb',
    status: 'JOINED',
    user: { username: 'samuel', displayName: null },
  };
const challenge = {
  id: 'cc',
  gameId: 'cg',
  creatorId: 'ca',
  stakeAmount: 10,
  currency: 'TEST',
  platform: 'PS5',
  mode: '1v1',
  status: 'JOINED',
  createdAt: '2026-10-02T00:00:00Z',
  players: [a, b],
  matches: [],
};
const response = (data: unknown, status = 200) =>
  Promise.resolve({
    ok: status < 400,
    status,
    json: async () => data,
  } as Response);
const mockFetch = jest.fn();
beforeEach(() => {
  jest.clearAllMocks();
  sessionStorage.clear();
  global.fetch = mockFetch;
  Object.defineProperty(global.crypto, 'randomUUID', {
    configurable: true,
    value: () => 'f48c5036-5b46-49b9-8cdc-69cb02c6ab24',
  });
  mockFetch.mockImplementation((url: string) => {
    if (url.endsWith('/games')) return response([game]);
    if (url.endsWith('/game-accounts'))
      return response([
        { id: 'account', gameId: 'cg', platform: 'PS5', gamertag: 'amir' },
      ]);
    if (url.includes('/transactions'))
      return response({ items: [], nextCursor: null });
    if (url.endsWith('/vault')) return response({ balance: 0 });
    if (url.endsWith('/challenges/cc')) return response(challenge);
    if (url.includes('/challenges?'))
      return response({ items: [challenge], nextCursor: null });
    return response({ success: true });
  });
});
it('submits login to the server session endpoint without browser token storage', async () => {
  render(<AuthScreen />);
  fireEvent.change(screen.getByLabelText('Email address'), {
    target: { value: 'amir@example.com' },
  });
  fireEvent.change(screen.getByLabelText('Password'), {
    target: { value: 'correct horse battery' },
  });
  fireEvent.submit(screen.getByRole('form', { name: 'Login' }));
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
  expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual({
    email: 'amir@example.com',
    password: 'correct horse battery',
  });
  expect(localStorage.length).toBe(0);
  expect(sessionStorage.length).toBe(0);
});
it('registration sends a player name and presents safe duplicate-account errors', async () => {
  mockFetch.mockImplementation(() =>
    response(
      { code: 'USER_USERNAME_EXISTS', message: 'private database error' },
      409,
    ),
  );
  render(<AuthScreen register />);
  fireEvent.change(screen.getByLabelText(/Player name/), {
    target: { value: 'amir' },
  });
  fireEvent.submit(screen.getByRole('form', { name: 'Registration' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'That player name is taken',
  );
  expect(screen.queryByText('private database error')).not.toBeInTheDocument();
  expect(JSON.parse(mockFetch.mock.calls[0][1].body).username).toBe('amir');
});
it('discovery reads real contract shapes and forwards filter selections', async () => {
  render(<DiscoverScreen />);
  expect(await screen.findByRole('heading', { name: 'FC 26' })).toBeVisible();
  fireEvent.change(screen.getByLabelText('Platform'), {
    target: { value: 'PC' },
  });
  await waitFor(() =>
    expect(
      mockFetch.mock.calls.some(([url]) => url.includes('platform=PC')),
    ).toBe(true),
  );
});
it('creates a challenge using the selected server game and integer TEST stake', async () => {
  const original = mockFetch.getMockImplementation()!;
  mockFetch.mockImplementation((url, options) =>
    options?.method === 'POST' ? response(challenge) : original(url, options),
  );
  render(<CreateScreen />);
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Create challenge' }),
    ).toBeEnabled(),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Create challenge' }));
  await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/challenges/cc'));
  const call = mockFetch.mock.calls.find(
    ([, options]) => options?.method === 'POST',
  );
  expect(JSON.parse(call![1].body)).toEqual({
    gameId: 'cg',
    platform: 'PS5',
    currency: 'TEST',
    mode: '1v1',
    stakeAmount: 10,
  });
});
it('funding suppresses repeated clicks and uses a fresh operation key', async () => {
  let finish!: (value: Response) => void;
  const original = mockFetch.getMockImplementation()!;
  mockFetch.mockImplementation((url, options) =>
    url.endsWith('/fund')
      ? new Promise((resolve) => {
          finish = resolve;
        })
      : original(url, options),
  );
  render(<ChallengeScreen id="cc" vault />);
  fireEvent.click(
    await screen.findByRole('button', { name: 'Secure my stake' }),
  );
  const button = screen.getByRole('button', { name: 'Secure 10 TEST' });
  fireEvent.click(button);
  fireEvent.click(button);
  expect(
    mockFetch.mock.calls.filter(([url]) => url.endsWith('/fund')),
  ).toHaveLength(1);
  expect(button).toBeDisabled();
  const call = mockFetch.mock.calls.find(([url]) => url.endsWith('/fund'))!;
  expect(call[1].headers['Idempotency-Key']).toMatch(/^[a-f0-9-]{36}$/);
  finish(
    await response({
      challenge: { ...challenge, players: [{ ...a, status: 'FUNDED' }, b] },
      vaultBalance: 10,
    }),
  );
  await waitFor(() =>
    expect(
      screen.queryByRole('button', { name: 'Secure my stake' }),
    ).not.toBeInTheDocument(),
  );
});
it('insufficient credits shows a friendly error and retains server state', async () => {
  const original = mockFetch.getMockImplementation()!;
  mockFetch.mockImplementation((url, options) =>
    url.endsWith('/fund')
      ? response(
          { code: 'LEDGER_INSUFFICIENT_FUNDS', message: 'SQL internals' },
          400,
        )
      : original(url, options),
  );
  render(<ChallengeScreen id="cc" vault />);
  fireEvent.click(
    await screen.findByRole('button', { name: 'Secure my stake' }),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Secure 10 TEST' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    "You don't have enough credits for this challenge.",
  );
  expect(screen.queryByText('SQL internals')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Secure my stake' })).toBeEnabled();
});
it.each([
  ['SERVICE_UNAVAILABLE', 503],
  ['TRANSACTION_RETRY', 409],
] as const)('%s funding retries reuse the same key', async (code, status) => {
  const original = mockFetch.getMockImplementation()!;
  mockFetch.mockImplementation((url, options) =>
    url.endsWith('/fund')
      ? response(
          { code, message: 'Prisma P2034 Serializable internals' },
          status,
        )
      : original(url, options),
  );
  render(<ChallengeScreen id="cc" vault />);
  for (let i = 0; i < 2; i++) {
    fireEvent.click(
      await screen.findByRole('button', { name: 'Secure my stake' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Secure 10 TEST' }));
    await screen.findByRole('alert');
    expect(
      screen.queryByText(/Prisma|P2034|Serializable/),
    ).not.toBeInTheDocument();
  }
  const calls = mockFetch.mock.calls.filter(([url]) => url.endsWith('/fund'));
  expect(calls).toHaveLength(2);
  expect(calls[0][1].headers['Idempotency-Key']).toBe(
    calls[1][1].headers['Idempotency-Key'],
  );
});
it('refreshes a committed stake after a lost response without another financial POST', async () => {
  const original = mockFetch.getMockImplementation()!;
  let committed = false;
  mockFetch.mockImplementation((url, options) => {
    if (url.endsWith('/fund')) {
      committed = true;
      return Promise.reject(new Error('Response lost'));
    }
    if (committed && url.endsWith('/challenges/cc'))
      return response({
        ...challenge,
        players: [{ ...a, status: 'FUNDED' }, b],
      });
    if (committed && url.endsWith('/vault')) return response({ balance: 10 });
    return original(url, options);
  });
  render(<ChallengeScreen id="cc" vault />);
  fireEvent.click(
    await screen.findByRole('button', { name: 'Secure my stake' }),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Secure 10 TEST' }));
  await screen.findByRole('alert');
  expect(
    screen.queryByRole('button', { name: 'Secure my stake' }),
  ).not.toBeInTheDocument();
  expect(
    mockFetch.mock.calls.filter(([url]) => url.endsWith('/fund')),
  ).toHaveLength(1);
  expect(mockRefresh).toHaveBeenCalled();
  expect(sessionStorage.getItem('ggvault:fund:ca:cc')).not.toBeNull();
});
it('uses the safe concurrency message', () => {
  expect(friendlyError('TRANSACTION_RETRY')).toBe(
    'GGVault was updated at the same time. Please try again.',
  );
});
it('transaction history shows signed safe entries', async () => {
  mockFetch.mockImplementation(() =>
    response({
      items: [
        {
          id: 't',
          timestamp: '2026-10-02T00:00:00Z',
          type: 'STAKE_REFUND',
          amount: 10,
          challengeId: null,
          matchId: null,
        },
      ],
      nextCursor: null,
    }),
  );
  render(<TransactionsScreen />);
  expect(await screen.findByText('Stake returned')).toBeVisible();
  expect(screen.getByText('+10')).toBeVisible();
});
it('busy buttons disable repeated actions and expose busy state', () => {
  render(<Button busy>Working</Button>);
  expect(screen.getByRole('button')).toBeDisabled();
  expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'true');
});
it('confirmation dialog has an accessible title and can be dismissed', () => {
  const close = jest.fn();
  render(
    <ConfirmationDialog
      open
      title="Secure your stake?"
      confirmLabel="Confirm"
      busy={false}
      onConfirm={jest.fn()}
      onClose={close}
    >
      10 TEST
    </ConfirmationDialog>,
  );
  expect(
    screen.getByRole('dialog', { name: 'Secure your stake?' }),
  ).toBeVisible();
  fireEvent.click(screen.getByLabelText('Close dialog'));
  expect(close).toHaveBeenCalled();
});
it('unknown backend errors never expose raw internals', () => {
  expect(friendlyError('SQL: password=secret', 500)).toBe(
    'Something went wrong. Please try again.',
  );
  expect(friendlyError('CHALLENGE_FULL')).toContain(
    'Another player already joined',
  );
});
