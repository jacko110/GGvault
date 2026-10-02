import { test, expect, type Page } from '@playwright/test';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { mkdirSync } from 'node:fs';
import { createClient } from 'redis';

const origin = 'http://127.0.0.1:3100';
const password = 'Browser_test_6a_password!';
const headers = { Origin: origin, 'Content-Type': 'application/json' };
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}
async function register(page: Page, name: string) {
  await page.goto('/register');
  await page.getByLabel(/Player name/).fill(name);
  await page.getByLabel('Email address').fill(`${name}@example.com`);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page
    .getByRole('button', { name: 'Create account', exact: true })
    .click();
  await expect(page).toHaveURL(origin + '/');
  await expect(
    page.getByRole('link', { name: 'Available balance: 100 TEST credits' }),
  ).toBeVisible();
}
async function linkAccount(page: Page, gameId: string, name: string) {
  await page.goto('/profile');
  await page
    .getByRole('combobox', { name: 'Game', exact: true })
    .selectOption(gameId);
  await page.getByLabel('Gamertag').fill(name);
  await page.getByRole('button', { name: 'Link account', exact: true }).click();
  await expect(page.getByText(name, { exact: true })).toBeVisible();
  await noOverflow(page);
}
async function createChallenge(page: Page, gameId: string, stake: number) {
  await page.goto('/challenges/new');
  await page
    .getByRole('combobox', { name: 'Game', exact: true })
    .selectOption(gameId);
  await page.getByLabel(/Stake per player/).fill(String(stake));
  await page
    .getByRole('button', { name: 'Create challenge', exact: true })
    .click();
  await expect(page).toHaveURL(/\/challenges\/c[a-z0-9]+$/);
  await noOverflow(page);
  return new URL(page.url()).pathname;
}

test('protected routes and mutation origin checks', async ({
  page,
  request,
}) => {
  for (const route of [
    '/',
    '/challenges',
    '/challenges/new',
    '/profile',
    '/transactions',
    '/challenges/cmissing/vault',
  ]) {
    await page.goto(route);
    await expect(page).toHaveURL(/\/login$/);
  }
  expect((await request.get('/api/backend/games')).status()).toBe(401);
  expect(
    (
      await request.post('/api/session/login', {
        headers: { ...headers, Origin: 'https://foreign.example' },
        data: {},
      })
    ).status(),
  ).toBe(403);
  expect((await request.get('/api/backend/moderation/disputes')).status()).toBe(
    404,
  );
  await page.keyboard.press('Tab');
  expect(await page.locator(':focus').count()).toBe(1);
  await noOverflow(page);
});

test('real two-player challenge, funding, sessions and responsive wallet', async ({
  page,
  browser,
}) => {
  test.setTimeout(240000);
  const stamp = Date.now().toString(36),
    nameA = `web_a_${stamp}`,
    nameB = `web_b_${stamp}`;
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const otherContext = await browser.newContext({
    baseURL: origin,
    viewport: { width: 390, height: 844 },
  });
  const other = await otherContext.newPage();
  try {
    await register(page, nameA);
    const session = (await page.context().cookies()).find(
      (cookie) => cookie.name === 'ggvault-session',
    )!;
    expect(session.httpOnly).toBe(true);
    expect(session.sameSite).toBe('Lax');
    expect(await page.evaluate(() => document.cookie)).not.toContain(
      'ggvault-session',
    );
    const foreignLogout = await page.request.post('/api/session/logout', {
      headers: { ...headers, Origin: 'https://foreign.example' },
      data: {},
    });
    expect(foreignLogout.status()).toBe(403);
    expect((await page.request.get('/api/backend/auth/me')).status()).toBe(200);
    const catalogResponse = await page.request.get('/api/backend/games');
    expect(catalogResponse.ok()).toBe(true);
    const games = await catalogResponse.json();
    const gameId = games.find(
      (game: { slug: string }) => game.slug === 'fc-26',
    ).id;
    expect(Object.keys(games[0]).sort()).toEqual(['id', 'name', 'slug']);
    const screenshots = path.resolve(__dirname, '../../../..', '.cache');
    mkdirSync(screenshots, { recursive: true });
    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await noOverflow(page);
      await page.screenshot({
        path: path.join(screenshots, `phase6a-home-${width}.png`),
        fullPage: true,
      });
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await linkAccount(page, gameId, `TagA_${stamp}`);
    const challenge = await createChallenge(page, gameId, 10);
    await expect(
      page.getByText('Funding opens when an opponent joins.'),
    ).toBeVisible();
    await register(other, nameB);
    await linkAccount(other, gameId, `TagB_${stamp}`);
    await other.goto('/challenges');
    await other
      .getByRole('combobox', { name: 'Game', exact: true })
      .selectOption(gameId);
    await expect(other.locator(`a[href="${challenge}"]`)).toBeVisible();
    await noOverflow(other);
    await other.locator(`a[href="${challenge}"]`).click();
    await other
      .getByRole('button', { name: 'Join challenge', exact: true })
      .click();
    await expect(other.getByRole('link', { name: 'Open vault' })).toBeVisible();
    await other.getByRole('link', { name: 'Open vault' }).click();
    await page.goto(`${challenge}/vault`);
    await page.getByRole('button', { name: 'Secure my stake' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Secure my stake' }),
    ).toBeFocused();
    await page.getByRole('button', { name: 'Secure my stake' }).click();
    const fundingResponse = page.waitForResponse(
      (response) =>
        response.url().endsWith(`${challenge}/fund`) &&
        response.request().method() === 'POST',
    );
    await page
      .getByRole('button', { name: 'Secure 10 TEST', exact: true })
      .click();
    const funded = await fundingResponse;
    expect(funded.ok()).toBe(true);
    expect(funded.request().headers()['idempotency-key']).toMatch(
      /^[a-f0-9-]{36}$/,
    );
    await expect(
      page.getByRole('link', { name: 'Available balance: 90 TEST credits' }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByText('Waiting for your opponent to fund.'),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Secure my stake' }),
    ).toHaveCount(0);
    await other.getByRole('button', { name: 'Secure my stake' }).click();
    await other
      .getByRole('button', { name: 'Secure 10 TEST', exact: true })
      .click();
    await expect(
      other.getByRole('heading', { name: 'PRIZE SECURED 🔒' }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole('heading', { name: 'PRIZE SECURED 🔒' }),
    ).toBeVisible();
    await noOverflow(page);
    await page.screenshot({
      path: path.join(screenshots, 'phase6a-vault-390.png'),
      fullPage: true,
    });
    const vault = await (
      await page.request.get(`/api/backend${challenge}/vault`)
    ).json();
    expect(vault.balance).toBe(20);
    expect(vault).not.toHaveProperty('vaultAccountId');
    await page.goto('/transactions');
    await expect(page.getByText(/STAKE_LOCK/)).toBeVisible();
    await expect(page.getByText(/INITIAL_CREDIT/)).toBeVisible();
    await expect(
      page.locator('.transaction-row').filter({ hasText: 'STAKE_LOCK' }),
    ).toContainText('-10');
    await noOverflow(page);
    const expensive = await createChallenge(page, gameId, 1000);
    await other.goto(expensive);
    await other
      .getByRole('button', { name: 'Join challenge', exact: true })
      .click();
    await expect(other.getByRole('link', { name: 'Open vault' })).toBeVisible();
    await page.goto(`${expensive}/vault`);
    await page.getByRole('button', { name: 'Secure my stake' }).click();
    await page
      .getByRole('button', { name: 'Secure 1,000 TEST', exact: true })
      .click();
    await expect(page.getByRole('main').getByRole('alert')).toContainText(
      "You don't have enough credits for this challenge.",
    );
    await expect(
      page.getByRole('link', { name: 'Available balance: 90 TEST credits' }),
    ).toBeVisible();
    await page
      .getByRole('button', { name: 'Cancel challenge', exact: true })
      .click();
    await page.getByRole('button', { name: 'Confirm cancellation' }).click();
    await expect(page.locator('.challenge-status')).toContainText('Cancelled');

    // Exercise actual rotating refresh tokens: invalidate only the access token in
    // this test session, then race real API reads through the shared refresh lock.
    const envPath = path.resolve(__dirname, '../../../..', '.env');
    process.loadEnvFile(envPath);
    const redis = createClient({
      url: process.env.WEB_REDIS_URL ?? process.env.REDIS_URL,
    });
    await redis.connect();
    try {
      const key = `ggvault:web:session:${createHash('sha256').update(session.value).digest('hex')}`;
      const stored = JSON.parse((await redis.get(key))!);
      stored.accessToken = 'expired-test-access-token';
      await redis.set(key, JSON.stringify(stored), { XX: true, KEEPTTL: true });
      const responses = await Promise.all([
        page.request.get('/api/backend/auth/me'),
        page.request.get('/api/backend/users/me/transactions'),
      ]);
      expect(responses.map((response) => response.status())).toEqual([
        200, 200,
      ]);
      expect(
        JSON.parse((await redis.get(key))!).refreshToken !==
          stored.refreshToken,
      ).toBe(true);
    } finally {
      await redis.quit();
    }
    const refreshed = await page.request.post('/api/session/refresh', {
      headers,
      data: {},
    });
    expect(refreshed.status()).toBe(200);
    expect(await refreshed.json()).toEqual({ success: true });
    expect(
      await page.evaluate(() => ({ ...localStorage, ...sessionStorage })),
    ).toEqual({});
    await page
      .getByRole('button', { name: 'Sign out', exact: true })
      .filter({ visible: true })
      .click();
    await expect(page).toHaveURL(/\/login$/);
    expect(
      (await page.context().cookies()).some(
        (cookie) => cookie.name === 'ggvault-session',
      ),
    ).toBe(false);
    await page.goto('/profile');
    await expect(page).toHaveURL(/\/login$/);
    await page.getByLabel('Email address').fill(`${nameA}@example.com`);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page).toHaveURL(origin + '/');
    await expect(
      page.getByRole('link', { name: 'Available balance: 90 TEST credits' }),
    ).toBeVisible();
    expect(errors).toEqual([]);
    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      for (const route of [
        '/challenges',
        '/challenges/new',
        challenge,
        `${challenge}/vault`,
        '/profile',
        '/transactions',
        '/login',
        '/register',
      ]) {
        await page.goto(route);
        await expect(page.locator('main')).toBeVisible();
        await noOverflow(page);
      }
    }
  } finally {
    await otherContext.close().catch(() => {});
  }
});
