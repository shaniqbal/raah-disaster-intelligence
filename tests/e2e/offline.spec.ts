import { expect, test } from '@playwright/test';

test.describe('offline and degraded operation', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 1024, 'run once on desktop');

  test('live providers failing are labelled UNAVAILABLE and nothing is substituted', async ({ page }) => {
    await page.route(/earthquake\.usgs\.gov|api\.open-meteo\.com/, (r) => r.fulfill({ status: 503, body: 'down' }));
    await page.goto('/live');
    await expect(page.getByText('USGS is unavailable')).toBeVisible();
    await expect(page.getByText('Open-Meteo is unavailable')).toBeVisible();
  });

  test('live data renders when providers respond', async ({ page }) => {
    await page.route(/earthquake\.usgs\.gov/, (r) =>
      r.fulfill({ contentType: 'application/json', body: JSON.stringify({ features: [{ id: 'us1', properties: { mag: 5.2, place: 'Test place, Pakistan', time: Date.now(), url: 'https://earthquake.usgs.gov' }, geometry: { coordinates: [70, 35, 30] } }] }) }),
    );
    await page.route(/api\.open-meteo\.com/, (r) => r.abort());
    await page.goto('/live');
    await expect(page.getByRole('link', { name: 'Test place, Pakistan' })).toBeVisible();
    await expect(page.getByText('LIVE DATA').first()).toBeVisible();
  });

  test('app shell, scenarios and copilot keep working offline after first load', async ({ page, context }) => {
    await page.route(/earthquake\.usgs\.gov|api\.open-meteo\.com/, (r) => r.abort());
    await page.goto('/mission-control');
    await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.ready;
      return !!reg.active;
    });
    // wait for precache to finish
    await expect.poll(async () => page.evaluate(async () => (await caches.keys()).length), { timeout: 30_000 }).toBeGreaterThan(1);
    await expect.poll(async () => page.evaluate(async () => (await (await caches.open('raah-v1-pages')).keys()).length), { timeout: 30_000 }).toBeGreaterThanOrEqual(13);
    await context.setOffline(true);
    await page.goto('/simulator?s=south-punjab-flood&rise=4');
    await expect(page.getByRole('heading', { name: 'Disaster Simulator' })).toBeVisible();
    await expect(page.getByLabel('River level rise')).toHaveValue('4');
    await page.goto('/copilot');
    await page.getByLabel('Ask the copilot').fill('What are the major assumptions in this model?');
    await page.getByRole('button', { name: 'Send question' }).click();
    await expect(page.getByText(/Major assumptions/)).toBeVisible();
    await expect(page.getByText(/Answered locally/)).toBeVisible();
    await page.goto('/demo?step=7');
    await expect(page.getByRole('heading', { name: 'What if we respond earlier?' })).toBeVisible();
    await context.setOffline(false);
  });
});
