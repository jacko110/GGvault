import { test, expect, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
const web = 'http://127.0.0.1:3100',
  admin = 'http://127.0.0.1:3102',
  password = 'Phase6b_browser_password!';
const root = path.resolve(__dirname, '../../../..');
async function register(page: Page, username: string) {
  await page.goto(`${web}/register`);
  await page.getByLabel(/Player name/).fill(username);
  await page.getByLabel('Email address').fill(`${username}@example.com`);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page
    .getByRole('button', { name: 'Create account', exact: true })
    .click();
  await expect(page).toHaveURL(web + '/');
}
async function link(page: Page, gameId: string, name: string) {
  await page.goto(`${web}/profile`);
  await page
    .getByRole('combobox', { name: 'Game', exact: true })
    .selectOption(gameId);
  await page.getByLabel('Gamertag').fill(name);
  await page.getByRole('button', { name: 'Link account', exact: true }).click();
  await expect(page.getByText(name, { exact: true })).toBeVisible();
}
async function startMatch(a: Page, b: Page, gameId: string) {
  await a.goto(`${web}/challenges/new`);
  await a
    .getByRole('combobox', { name: 'Game', exact: true })
    .selectOption(gameId);
  await a
    .getByRole('button', { name: 'Create challenge', exact: true })
    .click();
  await expect(a).toHaveURL(/\/challenges\/c[a-z0-9]+$/);
  const challenge = new URL(a.url()).pathname;
  await b.goto(web + challenge);
  await b.getByRole('button', { name: 'Join challenge', exact: true }).click();
  await expect(b.getByRole('link', { name: 'Open vault' })).toBeVisible();
  for (const page of [a, b]) {
    await page.goto(`${web}${challenge}/vault`);
    await page.getByRole('button', { name: 'Secure my stake' }).click();
    await page
      .getByRole('button', { name: 'Secure 10 TEST', exact: true })
      .click();
    await expect(
      page.getByRole('button', { name: 'Secure my stake' }),
    ).toHaveCount(0);
  }
  await b.getByRole('link', { name: 'Open match room' }).click();
  await expect(b).toHaveURL(/\/matches\/c[a-z0-9]+$/);
  const url = b.url();
  await a.goto(url);
  await expect(a.getByText('PRIZE SECURED 🔒')).toBeVisible();
  await a.getByRole('button', { name: 'READY UP' }).click();
  await expect(
    a.getByRole('button', { name: 'Waiting for your opponent' }),
  ).toBeDisabled();
  await b.reload();
  await b.getByRole('button', { name: 'READY UP' }).click();
  await expect(
    b.getByRole('heading', { name: 'MATCH IN PROGRESS' }),
  ).toBeVisible();
  await a.reload();
  await expect(
    a.getByRole('heading', { name: 'MATCH IN PROGRESS' }),
  ).toBeVisible();
  return new URL(url).pathname;
}
async function submit(a: Page, amir: string, samuel: string) {
  await a.getByRole('button', { name: 'SUBMIT RESULT', exact: true }).click();
  await a.getByLabel(`${amir} score`, { exact: true }).fill('4');
  await a.getByLabel(`${samuel} score`, { exact: true }).fill('2');
  const request = a.waitForRequest(
    (r) => r.url().endsWith('/result') && r.method() === 'POST',
  );
  await a
    .getByRole('dialog')
    .getByRole('button', { name: 'SUBMIT RESULT' })
    .click();
  expect((await request).postDataJSON()).toEqual({
    myScore: 4,
    opponentScore: 2,
  });
  await expect(
    a.getByRole('heading', { name: 'RESULT SUBMITTED' }),
  ).toBeVisible();
  await expect(a.getByRole('button', { name: 'CONFIRM RESULT' })).toHaveCount(
    0,
  );
}
async function screenshot(page: Page, name: string, width = 390) {
  await page.setViewportSize({ width, height: 844 });
  await page.evaluate(() => window.scrollTo(0, 0));
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: path.join(root, '.cache', `phase6b-${name}-${width}.png`),
    fullPage: true,
  });
}

test('real match confirmation, evidence, moderator void and exact financial outcomes', async ({
  page,
  browser,
}) => {
  test.setTimeout(240000);
  process.loadEnvFile(path.join(root, '.env'));
  mkdirSync(path.join(root, '.cache'), { recursive: true });
  const stamp = Date.now().toString(36),
    amir = `amir_${stamp}`,
    samuel = `samuel_${stamp}`,
    moderator = `moderator_${stamp}`;
  const bContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
    }),
    mContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
    }),
    b = await bContext.newPage(),
    m = await mContext.newPage();
  const failures: string[] = [];
  for (const p of [page, b, m])
    p.on('pageerror', (e) => failures.push(e.message));
  const db = new PrismaClient();
  try {
    await register(page, amir);
    await register(b, samuel);
    await register(m, moderator);
    // Test-fixture provisioning only. No role mutation is exposed by either app.
    await db.user.update({
      where: { username: moderator },
      data: { role: 'MODERATOR' },
    });
    const catalog = await (
        await page.request.get(`${web}/api/backend/games`)
      ).json(),
      gameId = catalog.find((g: { slug: string }) => g.slug === 'fc-26').id;
    await link(page, gameId, `AmirTag_${stamp}`);
    await link(b, gameId, `SamuelTag_${stamp}`);
    // A normal player cannot enter the separate moderator application.
    await b.goto(admin + '/');
    await expect(b).toHaveURL(admin + '/login');
    await b.getByLabel('Email address').fill(`${samuel}@example.com`);
    await b.getByLabel('Password', { exact: true }).fill(password);
    await b.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(b.getByRole('main').getByRole('alert')).toContainText(
      'moderator or administrator',
    );
    expect(
      (
        await b.request.get(admin + '/api/backend/moderation/disputes')
      ).status(),
    ).toBe(401);
    expect(
      (
        await page.request.get(web + '/api/backend/moderation/disputes')
      ).status(),
    ).toBe(404);
    const first = await startMatch(page, b, gameId);
    await screenshot(page, 'match-progress');
    await submit(page, amir, samuel);
    await b.goto(web + first);
    await b
      .getByRole('button', { name: 'CONFIRM RESULT', exact: true })
      .click();
    await expect(b.getByRole('dialog')).toContainText('may trigger settlement');
    await b
      .getByRole('button', { name: 'Confirm final result', exact: true })
      .click();
    await expect(b.getByRole('heading', { name: '🏆 WINNER' })).toBeVisible();
    await page.reload();
    const outcome = page.locator('.outcome-card');
    await expect(outcome).toContainText(amir);
    await expect(outcome).toContainText('20 TEST');
    await expect(outcome).toContainText('1 TEST');
    await expect(outcome).toContainText('19 TEST');
    await expect(
      page.getByRole('link', { name: 'Available balance: 109 TEST credits' }),
    ).toBeVisible();
    await expect(
      b.getByRole('link', { name: 'Available balance: 90 TEST credits' }),
    ).toBeVisible();
    await expect(page.locator('.match-timeline')).toContainText(
      'Match settled',
    );
    for (const width of [390, 768, 1440])
      await screenshot(page, 'winner', width);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(web + '/transactions');
    await expect(
      page.locator('.transaction-row').filter({ hasText: 'MATCH_WIN' }),
    ).toContainText('+19');
    const second = await startMatch(page, b, gameId);
    await submit(page, amir, samuel);
    await b.goto(web + second);
    await b.getByLabel('Evidence file').setInputFiles({
      name: 'invalid.html',
      mimeType: 'text/html',
      buffer: Buffer.from('<script>bad</script>'),
    });
    await b.getByRole('button', { name: 'Upload evidence' }).click();
    await expect(b.getByRole('main').getByRole('alert')).toContainText(
      'Choose a valid',
    );
    const jpeg = Buffer.from(
      readFileSync(
        path.join(root, 'apps/api/test/fixtures/pixel-jpeg.base64'),
        'utf8',
      ),
      'base64',
    );
    await b.getByLabel('Evidence file').setInputFiles({
      name: 'final-score.jpg',
      mimeType: 'image/jpeg',
      buffer: jpeg,
    });
    await b.getByRole('button', { name: 'Upload evidence' }).click();
    await expect(
      b.getByRole('button', { name: 'View evidence' }),
    ).toBeVisible();
    await expect(b.locator('.match-timeline')).toContainText(
      'Evidence uploaded',
    );
    // Existing backend evidence rules require upload before the dispute freezes it.
    await b.getByRole('button', { name: 'DISPUTE', exact: true }).click();
    await b
      .getByLabel('Dispute reason')
      .fill('The final score needs review; evidence attached.');
    await b.getByRole('button', { name: 'Open dispute', exact: true }).click();
    await expect(b.getByText('DISPUTE OPEN · UNDER REVIEW')).toBeVisible();
    await expect(b.getByText('20 TEST 🔒')).toBeVisible();
    await expect(b.getByLabel('Evidence file')).toHaveCount(0);
    await screenshot(b, 'dispute');
    const matchId = second.split('/').pop()!,
      state = await (await b.request.get(`${web}/api/backend${second}`)).json(),
      disputeId = state.results[0].disputes[0].id;
    await m.goto(admin + '/login');
    await m.getByLabel('Email address').fill(`${moderator}@example.com`);
    await m.getByLabel('Password', { exact: true }).fill(password);
    await m.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(m).toHaveURL(admin + '/');
    const cookie = (await mContext.cookies()).find(
      (c) => c.name === 'ggvault-admin-session',
    );
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe('Lax');
    await expect(m.locator(`a[href="/disputes/${disputeId}"]`)).toBeVisible();
    await screenshot(m, 'admin-queue');
    await m.locator(`a[href="/disputes/${disputeId}"]`).click();
    await expect(
      m.getByRole('heading', { name: 'Reported result' }),
    ).toBeVisible();
    await m.getByRole('button', { name: 'View evidence' }).click();
    const image = m.getByRole('img', { name: /Evidence uploaded/ });
    await expect(image).toBeVisible();
    await expect
      .poll(() => image.evaluate((el: HTMLImageElement) => el.naturalWidth))
      .toBeGreaterThan(0);
    const src = await image.getAttribute('src');
    expect(src).toMatch(new RegExp(`/api/evidence/${matchId}/c[a-z0-9]+`));
    await m.keyboard.press('Escape');
    await expect(m.getByRole('dialog')).not.toBeVisible();
    const anonymous = await browser.newContext();
    try {
      expect((await anonymous.request.get(admin + src)).status()).toBe(401);
    } finally {
      await anonymous.close();
    }
    for (const width of [390, 768, 1440])
      await screenshot(m, 'admin-review', width);
    await m.setViewportSize({ width: 390, height: 844 });
    await m.getByLabel('VOID MATCH', { exact: true }).check();
    await expect(
      m.getByRole('button', { name: 'Review decision' }),
    ).toBeDisabled();
    await m
      .getByLabel('Resolution reason')
      .fill(
        'Evidence reviewed. The match is void and both original stakes are returned.',
      );
    await m.getByRole('button', { name: 'Review decision' }).click();
    await expect(m.getByRole('dialog')).toContainText(
      "each player's original stake",
    );
    await m.getByRole('button', { name: 'RESOLVE', exact: true }).click();
    await expect(m.getByRole('heading', { name: 'MATCH VOID' })).toBeVisible();
    await expect(
      m.locator('.outcome-card').getByText('+10 TEST', { exact: true }),
    ).toHaveCount(2);
    await expect(m.locator('.outcome-card')).toContainText('0 TEST');
    const conflict = await m.request.post(
      `${admin}/api/backend/moderation/disputes/${disputeId}/resolve`,
      {
        headers: { Origin: admin },
        data: {
          resolution: 'PLAYER_A_WINS',
          reason: 'Conflicting duplicate decision.',
        },
      },
    );
    expect(conflict.status()).toBe(409);
    expect((await conflict.json()).code).toBe('DISPUTE_ALREADY_RESOLVED');
    for (const p of [page, b]) {
      await p.goto(web + second);
      await expect(
        p.getByRole('heading', { name: 'MATCH VOID' }),
      ).toBeVisible();
      await expect(
        p.locator('.outcome-card').getByText('+10 TEST', { exact: true }),
      ).toHaveCount(2);
      await expect(p.locator('.outcome-card')).toContainText('0 TEST');
    }
    await expect(
      page.getByRole('link', { name: 'Available balance: 109 TEST credits' }),
    ).toBeVisible();
    await expect(
      b.getByRole('link', { name: 'Available balance: 90 TEST credits' }),
    ).toBeVisible();
    await screenshot(page, 'refund');
    await page.goto(web + '/transactions');
    await expect(
      page.locator('.transaction-row').filter({ hasText: 'STAKE_REFUND' }),
    ).toContainText('+10');
    await page.goto(web + '/matches');
    await expect(page.locator(`a[href="${second}"]`)).toContainText('Refunded');
    await expect(page.locator(`a[href="${first}"]`)).toContainText('Settled');
    await m.getByRole('button', { name: 'Sign out', exact: true }).click();
    await expect(m).toHaveURL(admin + '/login');
    await m.goto(admin + '/');
    await expect(m).toHaveURL(admin + '/login');
    for (const p of [page, b, m])
      expect(
        await p.evaluate(() => ({ ...localStorage, ...sessionStorage })),
      ).toEqual({});
    expect(failures).toEqual([]);
  } finally {
    await db.$disconnect();
    await bContext.close().catch(() => {});
    await mContext.close().catch(() => {});
  }
});
