import 'server-only';
import { randomBytes, createHash } from 'node:crypto';
import { createClient } from 'redis';
import { cookies } from 'next/headers';
import { ApiError } from './errors';
import type { User } from './contracts';

const application = process.env.GGVAULT_APP === 'admin' ? 'admin' : 'web';
const cookieBase =
  application === 'admin' ? 'ggvault-admin-session' : 'ggvault-session';
export const cookieName =
  process.env.NODE_ENV === 'production' &&
  process.env.WEB_COOKIE_SECURE !== 'false'
    ? `__Host-${cookieBase}`
    : cookieBase;
export const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: cookieName.startsWith('__Host-'),
  path: '/',
  maxAge: 30 * 86400,
};
type Tokens = { accessToken: string; refreshToken: string };
type Session = Tokens & { expiresAt: number };
const root = globalThis as typeof globalThis & {
  webRedis?: ReturnType<typeof createClient>;
  webRedisConnecting?: Promise<unknown>;
};
async function redis() {
  if (!root.webRedis) {
    root.webRedis = createClient({
      url:
        process.env.WEB_REDIS_URL ??
        process.env.REDIS_URL ??
        'redis://127.0.0.1:6379',
      socket: { connectTimeout: 3000, reconnectStrategy: false },
    });
    root.webRedis.on('error', () => {}); // Never log session values or connection credentials.
  }
  if (!root.webRedis.isOpen) {
    root.webRedisConnecting ??= root.webRedis.connect().finally(() => {
      root.webRedisConnecting = undefined;
    });
    await root.webRedisConnecting;
  }
  return root.webRedis;
}
const key = (sid: string) =>
  `ggvault:${application}:session:${createHash('sha256').update(sid).digest('hex')}`;
export const sessionId = () => {
  const sid = cookies().get(cookieName)?.value;
  return sid && /^[a-f0-9]{64}$/.test(sid) ? sid : undefined;
};
export async function upstream(path: string, init: RequestInit = {}) {
  return fetch(
    `${process.env.API_BASE_URL ?? 'http://127.0.0.1:3001'}${path}`,
    {
      ...init,
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(10000),
      headers: { 'Content-Type': 'application/json', ...init.headers },
    },
  );
}
export async function upstreamJson<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new ApiError(
      typeof body.code === 'string' ? body.code : 'UNKNOWN',
      response.status,
    );
  return body as T;
}
async function load(sid: string): Promise<Session> {
  const raw = await (await redis()).get(key(sid));
  if (!raw) throw new ApiError('AUTH_REQUIRED', 401);
  const value = JSON.parse(raw) as Session;
  if (value.expiresAt <= Date.now()) throw new ApiError('AUTH_REQUIRED', 401);
  return value;
}
async function lock<T>(sid: string, work: () => Promise<T>): Promise<T> {
  const db = await redis(),
    lockKey = `${key(sid)}:lock`,
    owner = randomBytes(16).toString('hex');
  for (let i = 0; i < 80; i++) {
    if (await db.set(lockKey, owner, { NX: true, PX: 20000 })) {
      try {
        return await work();
      } finally {
        await db.eval(
          "if redis.call('get',KEYS[1]) == ARGV[1] then return redis.call('del',KEYS[1]) else return 0 end",
          { keys: [lockKey], arguments: [owner] },
        );
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new ApiError('SERVICE_UNAVAILABLE', 503);
}
async function refreshLocked(sid: string, current: Session) {
  const response = await upstream('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken: current.refreshToken }),
  });
  if ([401, 403].includes(response.status)) {
    await (await redis()).del(key(sid));
    throw new ApiError('AUTH_REQUIRED', 401);
  }
  const tokens = await upstreamJson<Tokens>(response);
  const value = {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: current.expiresAt,
  };
  const saved = await (
    await redis()
  ).set(key(sid), JSON.stringify(value), {
    XX: true,
    PX: Math.max(1, value.expiresAt - Date.now()),
  });
  if (!saved) throw new ApiError('AUTH_REQUIRED', 401);
  return value;
}
export async function authenticated(path: string, init: RequestInit = {}) {
  const sid = sessionId();
  if (!sid) throw new ApiError('AUTH_REQUIRED', 401);
  const current = await load(sid);
  const send = (accessToken: string) =>
    upstream(path, {
      ...init,
      headers: { ...init.headers, Authorization: `Bearer ${accessToken}` },
    });
  let response = await send(current.accessToken);
  if (response.status === 401) {
    const next = await lock(sid, async () => {
      const latest = await load(sid);
      return latest.accessToken !== current.accessToken
        ? latest
        : refreshLocked(sid, latest);
    });
    response = await send(next.accessToken);
  }
  return response;
}
export async function beginSession(
  action: 'login' | 'register',
  body: unknown,
) {
  const tokens = await upstreamJson<Tokens>(
    await upstream(`/auth/${action}`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  );
  if (application === 'admin') {
    const access = await upstream('/auth/moderation-access', {
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
    });
    if (!access.ok) {
      await upstream('/auth/logout', {
        method: 'POST',
        body: '{}',
        headers: { Authorization: `Bearer ${tokens.accessToken}` },
      }).catch(() => undefined);
      throw new ApiError('AUTH_FORBIDDEN', 403);
    }
  }
  const sid = randomBytes(32).toString('hex');
  await (
    await redis()
  ).set(
    key(sid),
    JSON.stringify({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: Date.now() + 30 * 86400000,
    }),
    { EX: 30 * 86400 },
  );
  return sid;
}
export async function refreshSession() {
  const sid = sessionId();
  if (!sid) throw new ApiError('AUTH_REQUIRED', 401);
  await lock(sid, async () => {
    await refreshLocked(sid, await load(sid));
  });
}
export async function endSession() {
  const sid = sessionId();
  if (!sid) return;
  await lock(sid, async () => {
    try {
      let value = await load(sid);
      let response = await upstream('/auth/logout', {
        method: 'POST',
        body: '{}',
        headers: { Authorization: `Bearer ${value.accessToken}` },
      });
      if (response.status === 401) {
        value = await refreshLocked(sid, value);
        response = await upstream('/auth/logout', {
          method: 'POST',
          body: '{}',
          headers: { Authorization: `Bearer ${value.accessToken}` },
        });
      }
      if (!response.ok && response.status !== 401)
        throw new ApiError('SERVICE_UNAVAILABLE', 503);
    } finally {
      await (await redis()).del(key(sid));
    }
  });
}
export async function currentUser(): Promise<User | null> {
  try {
    return await upstreamJson<User>(await authenticated('/auth/me'));
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw new Error('The account service is temporarily unavailable.');
  }
}
