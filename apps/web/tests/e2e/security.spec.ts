import { test, expect } from '@playwright/test';
import http from 'node:http';
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'node:fs';
import path from 'node:path';
const id = 'c123456789012345678901234';
test('both BFFs enforce security headers and reject malicious/missing origins', async ({
  request,
  page,
}) => {
  for (const origin of ['http://127.0.0.1:3100', 'http://127.0.0.1:3102']) {
    const response = await request.get(origin + '/login');
    expect(response.status()).toBe(200);
    const headers = response.headers();
    expect(headers['content-security-policy']).toContain(
      "frame-ancestors 'none'",
    );
    expect(headers['content-security-policy']).toMatch(
      /script-src[^;]+'nonce-/,
    );
    expect(headers['content-security-policy']).not.toContain('unsafe-eval');
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['permissions-policy']).toContain('camera=()');
    expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    const routes = origin.endsWith('3100')
      ? [
          '/api/session/login',
          '/api/session/register',
          '/api/session/refresh',
          '/api/session/logout',
          '/api/backend/challenges',
          `/api/backend/challenges/${id}/join`,
          `/api/backend/challenges/${id}/fund`,
          `/api/backend/challenges/${id}/cancel`,
          `/api/backend/matches/${id}/ready`,
          `/api/backend/matches/${id}/result`,
          `/api/backend/matches/${id}/result/confirm`,
          `/api/backend/matches/${id}/result/dispute`,
        ]
      : [
          '/api/session/login',
          '/api/session/refresh',
          '/api/session/logout',
          `/api/backend/moderation/disputes/${id}/resolve`,
        ];
    for (const path of routes)
      for (const malicious of [
        undefined,
        'null',
        'https://attacker.example',
        origin + '.attacker.example',
      ]) {
        const response = await request.post(origin + path, {
          headers: {
            'Content-Type': 'application/json',
            ...(malicious ? { Origin: malicious } : {}),
          },
          data: {},
        });
        expect(response.status(), path + ' origin ' + malicious).toBe(403);
      }
  }
  for (const origin of [undefined, 'https://attacker.example']) {
    const profile = await request.patch(
      'http://127.0.0.1:3100/api/backend/users/me',
      {
        headers: {
          'Content-Type': 'application/json',
          ...(origin ? { Origin: origin } : {}),
        },
        data: { displayName: 'Rejected' },
      },
    );
    expect(profile.status()).toBe(403);
    const upload = await request.post(
      `http://127.0.0.1:3100/api/evidence/${id}`,
      {
        headers: origin ? { Origin: origin } : {},
        multipart: { type: 'SCREENSHOT' },
      },
    );
    expect(upload.status()).toBe(403);
  }
  await page.goto('/login');
  const nonce = await page
    .locator('script[nonce]')
    .first()
    .evaluate((element: HTMLScriptElement) => element.nonce);
  expect(nonce.length).toBeGreaterThan(10);
  await expect(
    page.getByRole('button', { name: 'Sign in', exact: true }),
  ).toBeVisible();
});

test('chunked oversized JSON is rejected before session processing', async () => {
  const status = await new Promise<number>((resolve, reject) => {
    const req = http.request(
      'http://127.0.0.1:3100/api/session/login',
      {
        method: 'POST',
        headers: {
          Origin: 'http://127.0.0.1:3100',
          'Content-Type': 'application/json',
          'Transfer-Encoding': 'chunked',
        },
      },
      (response) => {
        response.resume();
        resolve(response.statusCode!);
      },
    );
    req.on('error', reject);
    req.write('{"padding":"');
    req.write('x'.repeat(9000));
    req.end('"}');
  });
  expect(status).toBe(413);
});

test('administrator operations page shows safe counts and rejects role demotion', async ({
  page,
  request,
}) => {
  const username = `ops_${Date.now().toString(36)}`,
    password = 'Beta_operations_test_password!';
  const registration = await request.post(
    'http://127.0.0.1:3101/auth/register',
    { data: { username, email: `${username}@example.com`, password } },
  );
  expect(registration.status()).toBe(201);
  const userId = (await registration.json()).user.id;
  const env = readFileSync(path.resolve(__dirname, '../../../../.env'), 'utf8');
  const databaseUrl =
    process.env.DATABASE_URL ??
    env
      .match(/^DATABASE_URL=(.+)$/m)?.[1]
      .trim()
      .replace(/^"|"$/g, '');
  const db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  try {
    await db.user.update({ where: { id: userId }, data: { role: 'ADMIN' } });
    await page.goto('http://127.0.0.1:3102/login');
    await page.getByLabel('Email address').fill(`${username}@example.com`);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page).toHaveURL('http://127.0.0.1:3102/');
    const cookie = (await page.context().cookies()).find(
      (c) => c.name === 'ggvault-admin-session',
    );
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie!.expires - Date.now() / 1000).toBeGreaterThan(7 * 3600);
    expect(cookie!.expires - Date.now() / 1000).toBeLessThanOrEqual(8 * 3600);
    await page.getByRole('link', { name: 'Beta operations' }).click();
    await expect(
      page.getByRole('heading', { name: 'Beta operations' }),
    ).toBeVisible();
    await expect(
      page.getByText('Registered users', { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'System health' }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await db.user.update({
      where: { id: userId },
      data: { role: 'MODERATOR' },
    });
    await page.reload();
    await expect(
      page.getByText(/Operations are available to administrators only/),
    ).toBeVisible();
    await expect(
      page.getByText('Registered users', { exact: true }),
    ).not.toBeVisible();
  } finally {
    await db.$disconnect();
  }
});
