import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AdminLogin } from '../components/auth';
import { DisputeQueue, DisputeReview } from '../components/moderation';
import { disputeFixture } from '../../web/tests/match-fixtures';
const mockFetch = jest.fn();
const mockReplace = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace, refresh: jest.fn() }),
}));
const response = (body: unknown, status = 200) =>
  Promise.resolve({
    ok: status < 400,
    status,
    json: async () => body,
  } as Response);
let dispute = disputeFixture();
beforeEach(() => {
  jest.clearAllMocks();
  dispute = disputeFixture();
  global.fetch = mockFetch;
  mockFetch.mockImplementation((url: string) =>
    url.includes('/matches/') ? response(dispute.match) : response(dispute),
  );
});
it('rejects ordinary-player login with a safe message', async () => {
  mockFetch.mockImplementation(() =>
    response({ code: 'AUTH_FORBIDDEN', message: 'private internals' }, 403),
  );
  render(<AdminLogin />);
  fireEvent.submit(
    screen.getByRole('button', { name: 'Sign in' }).closest('form')!,
  );
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'moderator or administrator',
  );
  expect(mockReplace).not.toHaveBeenCalled();
});
it('shows the queue and maps UNDER REVIEW to the backend REVIEW filter', async () => {
  mockFetch.mockImplementation(() =>
    response({ items: [dispute], nextCursor: null }),
  );
  render(<DisputeQueue />);
  expect(
    await screen.findByRole('link', { name: /Review dispute/ }),
  ).toHaveTextContent('FC 26');
  expect(mockFetch).toHaveBeenCalledWith(
    '/api/backend/moderation/disputes?limit=12&status=REVIEW',
    expect.anything(),
  );
});
it('requires a nonblank resolution reason', async () => {
  render(<DisputeReview id="cd" />);
  fireEvent.click(await screen.findByLabelText('VOID MATCH'));
  expect(
    screen.getByRole('button', { name: 'Review decision' }),
  ).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Resolution reason'), {
    target: { value: '   ' },
  });
  expect(
    screen.getByRole('button', { name: 'Review decision' }),
  ).toBeDisabled();
});
it.each(['PLAYER_A_WINS', 'PLAYER_B_WINS', 'VOID_MATCH'])(
  'confirms and submits %s with the reason then displays server outcome',
  async (resolution) => {
    mockFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        dispute = {
          ...dispute,
          status: 'RESOLVED',
          resolution,
          resolutionReason: 'Evidence reviewed.',
          match: {
            ...dispute.match,
            status: resolution === 'VOID_MATCH' ? 'REFUNDED' : 'SETTLED',
            vault: { balance: 0, status: 'COMPLETED' },
            settlement: {
              status: resolution === 'VOID_MATCH' ? 'REFUNDED' : 'SETTLED',
              winner:
                resolution === 'VOID_MATCH'
                  ? null
                  : { id: 'cb', username: 'Samuel' },
              vaultAmount: 20,
              platformFee: 1,
              winnerAmount: 19,
            },
          },
        };
        return response({ status: 'RESOLVED' });
      }
      if (url.endsWith('/refunds'))
        return response([
          { userId: 'ca', amount: 10 },
          { userId: 'cb', amount: 10 },
        ]);
      return response(url.includes('/matches/') ? dispute.match : dispute);
    });
    render(<DisputeReview id="cd" />);
    await screen.findByText('Resolve dispute');
    fireEvent.click(
      screen.getByLabelText(
        resolution === 'VOID_MATCH'
          ? 'VOID MATCH'
          : resolution === 'PLAYER_A_WINS'
            ? 'Amir · PLAYER A WINS'
            : 'Samuel · PLAYER B WINS',
      ),
    );
    fireEvent.change(screen.getByLabelText('Resolution reason'), {
      target: { value: 'Evidence reviewed.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Review decision' }));
    expect(screen.getByRole('dialog')).toHaveTextContent(
      resolution === 'VOID_MATCH' ? 'original stake' : 'secured prize',
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'RESOLVE', exact: true }),
    );
    await waitFor(() =>
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/backend/moderation/disputes/cd/resolve',
        expect.objectContaining({
          body: JSON.stringify({ resolution, reason: 'Evidence reviewed.' }),
        }),
      ),
    );
    expect(
      await screen.findByRole('heading', { name: 'Dispute resolved' }),
    ).toBeVisible();
    if (resolution !== 'VOID_MATCH')
      expect(screen.getByText('19 TEST')).toBeVisible();
  },
);
it('handles a concurrent resolution with a friendly error and refreshed state', async () => {
  mockFetch.mockImplementation((url: string, init?: RequestInit) => {
    if (init?.method === 'POST') {
      dispute = { ...dispute, status: 'RESOLVED', resolution: 'VOID_MATCH' };
      return response({ code: 'DISPUTE_ALREADY_RESOLVED' }, 409);
    }
    return response(url.includes('/matches/') ? dispute.match : dispute);
  });
  render(<DisputeReview id="cd" />);
  fireEvent.click(await screen.findByLabelText('VOID MATCH'));
  fireEvent.change(screen.getByLabelText('Resolution reason'), {
    target: { value: 'Evidence reviewed.' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Review decision' }));
  fireEvent.click(screen.getByRole('button', { name: 'RESOLVE', exact: true }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'already been resolved',
  );
  expect(
    await screen.findByRole('heading', { name: 'Dispute resolved' }),
  ).toBeVisible();
  expect(
    screen.queryByRole('button', { name: 'Review decision' }),
  ).not.toBeInTheDocument();
});
