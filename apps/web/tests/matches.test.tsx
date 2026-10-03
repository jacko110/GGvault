import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MatchScreen, MyMatchesScreen } from '../components/match-screen';
import {
  EvidenceUpload,
  MatchTimeline,
  Outcome,
} from '../components/match-parts';
import { matchFixture, resultFixture } from './match-fixtures';
const mockRefresh = jest.fn(),
  mockFetch = jest.fn();
let mockUser = 'ca';
jest.mock('../components/shell', () => ({
  useSession: () => ({
    user: { id: mockUser, username: mockUser === 'ca' ? 'Amir' : 'Samuel' },
    refreshBalance: mockRefresh,
  }),
}));
const response = (body: unknown, status = 200) =>
  Promise.resolve({
    ok: status < 400,
    status,
    json: async () => body,
  } as Response);
let match = matchFixture();
beforeEach(() => {
  jest.clearAllMocks();
  mockUser = 'ca';
  match = matchFixture();
  global.fetch = ((url: string, init?: RequestInit) =>
    url.endsWith('/policy')
      ? response({
          screenshot: 10485760,
          video: 52428800,
          types: ['image/png', 'image/jpeg', 'image/webp', 'video/mp4'],
        })
      : mockFetch(url, init)) as typeof fetch;
  mockFetch.mockImplementation((url: string, init?: RequestInit) => {
    if (url.endsWith('/policy'))
      return response({
        screenshot: 10485760,
        video: 52428800,
        types: ['image/png', 'image/jpeg', 'image/webp', 'video/mp4'],
      });
    if (
      url.endsWith('/timeline') ||
      url.endsWith('/evidence') ||
      url.endsWith('/refunds')
    )
      return response([]);
    if (init?.method === 'POST') return response({});
    return response(match);
  });
});
it('shows the match room and disables readiness after the first ready response', async () => {
  mockFetch.mockImplementation((url: string, init?: RequestInit) => {
    if (init?.method === 'POST') {
      match = {
        ...match,
        participants: match.participants.map((p) => ({
          ...p,
          readyAt: p.userId === 'ca' ? '2026-10-02T10:00:00Z' : null,
        })),
      };
      return response({ status: 'READY' });
    }
    if (url.endsWith('/timeline') || url.endsWith('/evidence'))
      return response([]);
    return response(match);
  });
  render(<MatchScreen id="cmatch" />);
  fireEvent.click(await screen.findByRole('button', { name: 'READY UP' }));
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Waiting for your opponent' }),
    ).toBeDisabled(),
  );
  expect(screen.getByText('READY ✓')).toBeVisible();
  expect(screen.getByText('NOT READY · WAITING')).toBeVisible();
  expect(screen.getByText('PRIZE SECURED 🔒')).toBeVisible();
});
it('shows progress and sends only score fields', async () => {
  match = matchFixture('IN_PROGRESS');
  match.participants.forEach((p) => (p.readyAt = '2026-10-02T10:00:00Z'));
  render(<MatchScreen id="cmatch" />);
  fireEvent.click(await screen.findByRole('button', { name: 'SUBMIT RESULT' }));
  fireEvent.change(screen.getByLabelText('Amir score'), {
    target: { value: '4' },
  });
  fireEvent.change(screen.getByLabelText('Samuel score'), {
    target: { value: '2' },
  });
  fireEvent.click(screen.getAllByRole('button', { name: 'SUBMIT RESULT' })[1]);
  await waitFor(() =>
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/backend/matches/cmatch/result',
      expect.objectContaining({
        body: JSON.stringify({ myScore: 4, opponentScore: 2 }),
      }),
    ),
  );
});
it('never offers the submitter a confirmation action', async () => {
  match = { ...matchFixture('RESULT_SUBMITTED'), results: [resultFixture] };
  render(<MatchScreen id="cmatch" />);
  expect(
    await screen.findByText('Waiting for Samuel to confirm…'),
  ).toBeVisible();
  expect(
    screen.queryByRole('button', { name: 'CONFIRM RESULT' }),
  ).not.toBeInTheDocument();
});
it('requires opponent confirmation and refreshes the settled balance', async () => {
  mockUser = 'cb';
  match = { ...matchFixture('RESULT_SUBMITTED'), results: [resultFixture] };
  mockFetch.mockImplementation((url: string, init?: RequestInit) => {
    if (init?.method === 'POST') {
      match = {
        ...match,
        status: 'SETTLED',
        vault: { balance: 0, status: 'SETTLED' },
        settlement: {
          status: 'SETTLED',
          winner: { id: 'ca', username: 'Amir' },
          vaultAmount: 20,
          platformFee: 1,
          winnerAmount: 19,
        },
      };
      return response({ status: 'SETTLED' });
    }
    if (url.endsWith('/timeline') || url.endsWith('/evidence'))
      return response([]);
    return response(match);
  });
  render(<MatchScreen id="cmatch" />);
  fireEvent.click(
    await screen.findByRole('button', { name: 'CONFIRM RESULT' }),
  );
  expect(screen.getByRole('dialog')).toHaveTextContent(
    'may trigger settlement',
  );
  fireEvent.click(screen.getByRole('button', { name: 'Confirm final result' }));
  expect(await screen.findByText('19 TEST')).toBeVisible();
  expect(screen.getByText('20 TEST')).toBeVisible();
  expect(screen.getByText('1 TEST')).toBeVisible();
  await waitFor(() => expect(mockRefresh).toHaveBeenCalled());
});
it('disputes with a reason and preserves the server vault value', async () => {
  mockUser = 'cb';
  match = { ...matchFixture('RESULT_SUBMITTED'), results: [resultFixture] };
  render(<MatchScreen id="cmatch" />);
  fireEvent.click(await screen.findByRole('button', { name: 'DISPUTE' }));
  fireEvent.change(screen.getByLabelText('Dispute reason'), {
    target: { value: 'The reported score is wrong.' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Open dispute' }));
  await waitFor(() =>
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/backend/matches/cmatch/result/dispute',
      expect.objectContaining({
        body: JSON.stringify({ reason: 'The reported score is wrong.' }),
      }),
    ),
  );
  expect(screen.getByText('20 TEST 🔒')).toBeVisible();
});
it('shows disputed locked vault and closes evidence uploads', async () => {
  match = { ...matchFixture('DISPUTED'), results: [resultFixture] };
  render(<MatchScreen id="cmatch" />);
  expect(await screen.findByText('DISPUTE OPEN · UNDER REVIEW')).toBeVisible();
  expect(screen.getByText('20 TEST 🔒')).toBeVisible();
  expect(screen.queryByLabelText('Evidence file')).not.toBeInTheDocument();
});
it('renders exact server refund amounts instead of dividing the prize', () => {
  match = {
    ...matchFixture('REFUNDED'),
    vault: { balance: 0, status: 'REFUNDED' },
    settlement: {
      status: 'REFUNDED',
      winner: null,
      vaultAmount: 20,
      winnerAmount: 0,
      platformFee: 0,
    },
  };
  render(
    <Outcome
      match={match}
      refunds={[
        { userId: 'ca', amount: 7 },
        { userId: 'cb', amount: 13 },
      ]}
    />,
  );
  expect(screen.getByText('+7 TEST')).toBeVisible();
  expect(screen.getByText('+13 TEST')).toBeVisible();
  expect(screen.getByText('0 TEST')).toBeVisible();
});
it('uploads multipart evidence and rejects an invalid selection', async () => {
  const onUploaded = jest.fn().mockResolvedValue(undefined);
  render(
    <EvidenceUpload
      id="cmatch"
      policy={{ screenshot: 1024, video: 2048, types: ['image/png'] }}
      onUploaded={onUploaded}
    />,
  );
  fireEvent.change(screen.getByLabelText('Evidence file'), {
    target: { files: [new File(['bad'], 'bad.html', { type: 'text/html' })] },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Upload evidence' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Choose a valid');
  expect(mockFetch).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Evidence file'), {
    target: { files: [new File(['png'], 'score.png', { type: 'image/png' })] },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Upload evidence' }));
  await waitFor(() => expect(onUploaded).toHaveBeenCalled());
  expect(mockFetch).toHaveBeenCalledWith(
    '/api/evidence/cmatch',
    expect.objectContaining({ method: 'POST', body: expect.any(FormData) }),
  );
});
it('preserves the timeline order supplied by the server', () => {
  render(
    <MatchTimeline
      match={match}
      events={[
        {
          id: 'one',
          sequence: 1,
          type: 'MATCH_CREATED',
          actorUserId: null,
          createdAt: '2026-10-02T09:00:00Z',
        },
        {
          id: 'two',
          sequence: 2,
          type: 'PLAYER_READY',
          actorUserId: 'ca',
          createdAt: '2026-10-02T10:00:00Z',
        },
      ]}
    />,
  );
  const items = screen.getAllByRole('listitem');
  expect(items[0]).toHaveTextContent('Match ready');
  expect(items[1]).toHaveTextContent('Amir READY');
});
it('lists my matches and an appropriate review action', async () => {
  mockFetch.mockImplementation(() =>
    response({
      items: [
        {
          id: 'cmatch',
          status: 'RESULT_SUBMITTED',
          game: 'FC 26',
          platform: 'PS5',
          stakeAmount: 10,
          players: ['Amir', 'Samuel'],
        },
      ],
      nextCursor: null,
    }),
  );
  render(<MyMatchesScreen />);
  expect(
    await screen.findByRole('link', { name: /Review result/ }),
  ).toHaveAttribute('href', '/matches/cmatch');
});
