import { expect, test, type Page } from '@playwright/test';

/** Live APIs are blocked by default so tests are deterministic and exercise the UNAVAILABLE path. */
async function blockLive(page: Page) {
  await page.route(/earthquake\.usgs\.gov|api\.open-meteo\.com/, (r) => r.abort());
}

const consoleErrors = (page: Page) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource|ERR_FAILED|ERR_TUNNEL|ERR_NAME/.test(m.text())) errors.push(m.text());
  });
  return errors;
};

const isMobile = (page: Page) => (page.viewportSize()?.width ?? 1440) < 1024;

async function nav(page: Page, name: RegExp) {
  if (isMobile(page)) await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name }).last().click();
}

test.beforeEach(async ({ page }) => blockLive(page));

test('1–2. homepage → Mission Control', async ({ page }) => {
  const errors = consoleErrors(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Disaster intelligence');
  await expect(page.getByText(/not an emergency service/i).first()).toBeVisible();
  await page.getByRole('link', { name: /Explore Mission Control/ }).click();
  await expect(page).toHaveURL(/mission-control/);
  await expect(page.getByRole('heading', { name: 'Mission Control' })).toBeVisible();
  // Live sources are blocked: must show UNAVAILABLE, never invented numbers.
  await expect(page.locator('main').getByText('UNAVAILABLE').first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  expect(errors).toEqual([]);
});

test('3. select a Pakistan region and see its explanation', async ({ page }) => {
  await page.goto('/risk?region=rajanpur&hazard=flood');
  await expect(page.getByText(/Why this score/)).toBeVisible();
  await expect(page.getByText(/risk = 100/).first()).toBeVisible();
  await expect(page.getByRole('region', { name: 'Why this score?' })).toContainText('Rajanpur');
  await page.getByRole('tab', { name: 'Earthquake' }).click();
  await expect(page).toHaveURL(/hazard=earthquake/);
});

test('4–5. toggle map layers and open historical data', async ({ page }) => {
  await page.goto('/map');
  const roads = page.getByRole('switch', { name: 'Road graph' });
  await expect(roads).toHaveAttribute('aria-checked', 'true');
  await roads.click();
  await expect(roads).toHaveAttribute('aria-checked', 'false');
  await page.getByRole('switch', { name: 'Historical events' }).click();
  await page.goto('/history');
  await expect(page.getByRole('heading', { name: '2022 Pakistan floods' })).toBeVisible();
  await expect(page.getByText(/33 million/)).toBeVisible();
});

test('6–8, 10. launch a scenario, adjust severity, review changes, compare', async ({ page }) => {
  const errors = consoleErrors(page);
  await page.goto('/simulator');
  await expect(page.getByRole('heading', { name: 'Disaster Simulator' })).toBeVisible();
  const exposed = page.getByText('Exposed at peak').locator('..');
  const before = await exposed.innerText();
  const slider = page.getByLabel('River level rise');
  await slider.fill('5');
  await expect(page).toHaveURL(/rise=5/);
  await expect.poll(async () => exposed.innerText()).not.toBe(before);
  await page.getByRole('tab', { name: 'A/B compare' }).click();
  await page.getByRole('radio', { name: /Double boats/ }).click();
  await expect(page.getByText('Operational proxy')).toBeVisible();
  await expect(page.getByText(/does not estimate casualties/)).toBeVisible();
  expect(errors).toEqual([]);
});

test('shareable link restores the same scenario', async ({ page }) => {
  await page.goto('/simulator?s=kohistan-landslide&sev=0.9&teams=20');
  await expect(page.getByRole('tab', { name: 'KKH landslide', selected: true })).toBeVisible();
  await expect(page.getByLabel('Landslide severity')).toHaveValue('0.9');
});

test('9. assign a rescue resource and see the audit log', async ({ page }) => {
  await page.goto('/resources');
  await expect(page.getByRole('heading', { name: /Rescue Resource Coordination/ })).toBeVisible();
  const select = page.locator('select[id^="as-"]').first();
  await select.selectOption({ index: 0 }); // stand down
  await expect(page.getByText(/stood down to standby/).first()).toBeVisible();
  await expect(page.getByText(/1 manual change/)).toBeVisible();
  await page.getByRole('button', { name: /Reset to planner/ }).click();
  await expect(page.getByText(/0 manual change/)).toBeVisible();
});

test('evacuation planner returns road routes with alternatives', async ({ page }) => {
  await page.goto('/evacuation');
  await expect(page.getByText(/Not for real-world navigation/)).toBeVisible();
  await expect(page.getByRole('button', { name: /Fastest/ })).toBeVisible();
});

test('11–12. submit a simulated SOS, advance it, then reset', async ({ page }) => {
  await page.goto('/sos');
  await expect(page.getByText(/does NOT contact Rescue 1122/)).toBeVisible();
  await page.getByLabel(/Location \(town/).fill('Alipur, Muzaffargarh');
  await page.getByRole('button', { name: 'Save demo report' }).click();
  await expect(page.getByText(/saved on this device/).first()).toBeVisible();
  await expect(page.getByText('DEMO', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Simulate next step' }).first().click();
  await expect(page.getByText(/Simulated triage/)).toBeVisible();
  await page.reload();
  await expect(page.getByText('Alipur, Muzaffargarh', { exact: false }).first()).toBeVisible();
  await page.getByRole('button', { name: /Delete all demo reports/ }).click();
  await expect(page.getByText('My demo reports (0)')).toBeVisible();
});

test('SOS validates input and supports Urdu', async ({ page }) => {
  await page.goto('/sos');
  await page.getByRole('button', { name: 'Save demo report' }).click();
  await expect(page.getByText('Add a location')).toBeVisible();
  await page.getByRole('button', { name: 'اردو' }).click();
  await expect(page.getByText('شہری ہنگامی پورٹل')).toBeVisible();
  await expect(page.locator('[dir="rtl"]').first()).toBeVisible();
});

test('13. AI Copilot answers with grounded, typed facts (no key)', async ({ page }) => {
  await page.goto('/copilot');
  await page.getByLabel('Ask the copilot').fill('Which shelter has available capacity in this simulation?');
  await page.getByRole('button', { name: 'Send question' }).click();
  await expect(page.getByText('Shelter capacity in this simulation')).toBeVisible();
  await expect(page.getByText(/Model-derived estimate/).first()).toBeVisible();
  await expect(page.getByText(/deterministic/i).first()).toBeVisible();
});

test('14. complete the judge presentation', async ({ page }) => {
  const errors = consoleErrors(page);
  await page.goto('/demo');
  await page.getByRole('button', { name: /Restart/ }).click();
  await expect(page.getByRole('heading', { name: 'Establish context' })).toBeVisible();
  const titles = ['Risk rises', 'Assess exposure', 'Trigger preparedness', 'Plan evacuation', 'Allocate rescue resources', 'What if we respond earlier?', 'Explain with AI', 'Impact'];
  for (const t of titles) {
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('heading', { name: t })).toBeVisible();
    if (t === 'Trigger preparedness') await expect(page.getByText('NOT SENT · DEMO')).toBeVisible();
    if (t === 'Explain with AI') await expect(page.getByText('Why this response plan was recommended')).toBeVisible();
  }
  await expect(page.getByText('coordinated action.', { exact: true })).toBeVisible();
  // Resume after refresh at the same step
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Impact' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('every primary navigation item works', async ({ page }) => {
  await page.goto('/mission-control');
  for (const [label, heading] of [
    [/Live Data/, 'Live Data'],
    [/Risk Intelligence/, 'Risk Intelligence'],
    [/Disaster Simulator/, 'Disaster Simulator'],
    [/Maps & Layers/, 'Maps & Layers'],
    [/Evacuation Planner/, 'Smart Evacuation Planner'],
    [/Rescue Coordination/, 'Rescue Resource Coordination'],
    [/Citizen SOS/, 'Citizen Emergency Portal'],
    [/Historical Events/, 'Historical Events'],
    [/AI Copilot/, 'AI Disaster Copilot'],
    [/Methodology/, 'How RAAH works'],
  ] as const) {
    await nav(page, label);
    await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible();
  }
});

test('no horizontal overflow on key pages', async ({ page }) => {
  for (const p of ['/', '/mission-control', '/simulator', '/sos', '/demo', '/resources']) {
    await page.goto(p);
    await page.waitForTimeout(400);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), p).toBeLessThanOrEqual(0);
  }
});

test('keyboard: skip link and command search', async ({ page }) => {
  test.skip(isMobile(page), 'desktop keyboard flow');
  await page.goto('/mission-control');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  await page.keyboard.press('/');
  await page.getByLabel('Search query').fill('Muzaff');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/region=muzaffargarh/);
});
