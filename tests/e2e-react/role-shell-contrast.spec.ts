import { expect, test, type Locator, type Page } from '@playwright/test';

type ColorScheme = 'dark' | 'light';
type Rgba = { red: number; green: number; blue: number; alpha: number };
type SmokeRole = 'admin' | 'ngo_partner' | 'parent' | 'student' | 'tutor';

const password = process.env.VITE_E2E_AUTH_PASSWORD ?? 'ProjectOdysseus!23';

const roles: Record<SmokeRole, { email: string; dashboard: string; heading: string | RegExp; section: string }> = {
  admin: {
    email: 'admin.e2e@projectodysseus.test',
    dashboard: '/dashboard/admin',
    heading: /Good (morning|afternoon|evening), Admin/,
    section: 'admin',
  },
  ngo_partner: {
    email: 'ngo.e2e@projectodysseus.test',
    dashboard: '/dashboard/ngo/reports',
    heading: 'Cohort impact',
    section: 'ngo',
  },
  parent: {
    email: 'parent.e2e@projectodysseus.test',
    dashboard: '/dashboard/parent/reports',
    heading: 'My child',
    section: 'parent',
  },
  student: {
    email: 'student.e2e@projectodysseus.test',
    dashboard: '/dashboard/student',
    heading: /Good (morning|afternoon|evening), Student/,
    section: 'student',
  },
  tutor: {
    email: 'tutor.e2e@projectodysseus.test',
    dashboard: '/dashboard/tutor',
    heading: /Good (morning|afternoon|evening), Tutor/,
    section: 'tutor',
  },
};

const layouts = [
  { name: 'mobile', viewport: { width: 390, height: 900 } },
  { name: 'desktop', viewport: { width: 1440, height: 1000 } },
] as const;

const colorSchemes: ColorScheme[] = ['light', 'dark'];

function parseColor(value: string): Rgba {
  if (value === 'transparent') {
    return { red: 0, green: 0, blue: 0, alpha: 0 };
  }

  const match = value.match(/^rgba?\((.+)\)$/);
  if (!match) {
    throw new Error(`Unsupported computed color: ${value}`);
  }

  const parts = match[1].split(/[,/\s]+/).filter(Boolean).map(Number);
  return {
    red: parts[0],
    green: parts[1],
    blue: parts[2],
    alpha: parts[3] ?? 1,
  };
}

function composite(foreground: Rgba, background: Rgba): Rgba {
  const alpha = foreground.alpha + background.alpha * (1 - foreground.alpha);
  if (alpha === 0) {
    return { red: 0, green: 0, blue: 0, alpha: 0 };
  }

  return {
    red: (foreground.red * foreground.alpha + background.red * background.alpha * (1 - foreground.alpha)) / alpha,
    green: (foreground.green * foreground.alpha + background.green * background.alpha * (1 - foreground.alpha)) / alpha,
    blue: (foreground.blue * foreground.alpha + background.blue * background.alpha * (1 - foreground.alpha)) / alpha,
    alpha,
  };
}

function luminance(color: Rgba) {
  const channel = (value: number) => {
    const normalized = value / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(color.red) + 0.7152 * channel(color.green) + 0.0722 * channel(color.blue);
}

function contrastRatio(first: Rgba, second: Rgba) {
  const lighter = Math.max(luminance(first), luminance(second));
  const darker = Math.min(luminance(first), luminance(second));
  return (lighter + 0.05) / (darker + 0.05);
}

function canvasFor(colorScheme: ColorScheme): Rgba {
  return colorScheme === 'dark'
    ? { red: 7, green: 11, blue: 20, alpha: 1 }
    : { red: 247, green: 248, blue: 251, alpha: 1 };
}

async function expectTextContrast(locator: Locator, colorScheme: ColorScheme, minimum = 4.5) {
  const sample = await locator.evaluate((element) => {
    const backgrounds: string[] = [];
    let current: Element | null = element;
    while (current) {
      backgrounds.unshift(getComputedStyle(current).backgroundColor);
      current = current.parentElement;
    }
    return {
      backgrounds,
      foreground: getComputedStyle(element).color,
    };
  });

  const background = sample.backgrounds
    .map(parseColor)
    .reduce((result, layer) => composite(layer, result), canvasFor(colorScheme));
  const foreground = composite(parseColor(sample.foreground), background);
  const ratio = contrastRatio(foreground, background);

  expect(ratio, `expected ${sample.foreground} text to meet ${minimum}:1 contrast`).toBeGreaterThanOrEqual(minimum);
}

async function expectVisibleSurface(locator: Locator, minimumAlpha: number) {
  await expect(locator).toBeVisible();
  const background = parseColor(await locator.evaluate((element) => getComputedStyle(element).backgroundColor));
  expect(background.alpha, 'expected the shared surface to have a generated background').toBeGreaterThanOrEqual(minimumAlpha);
}

async function loginAs(page: Page, role: SmokeRole) {
  await page.goto('/dashboard/login');
  await page.getByLabel('Email').fill(roles[role].email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(new RegExp(roles[role].dashboard.replace(/\//g, '\\/')));
}

for (const layout of layouts) {
  for (const colorScheme of colorSchemes) {
    test.describe(`${layout.name} ${colorScheme} shared surfaces`, () => {
      test.use({ colorScheme, viewport: layout.viewport });

      test('login card and labels remain opaque and readable', async ({ page }) => {
        await page.goto('/dashboard/login');

        const cardHeading = page.getByRole('heading', { name: 'Dashboard access' });
        const card = cardHeading.locator('xpath=ancestor::section[1]');
        await expectVisibleSurface(card, 0.75);
        await expectTextContrast(cardHeading, colorScheme);
        await expectTextContrast(page.getByText('Email', { exact: true }), colorScheme);
        await expectTextContrast(page.getByText('Password', { exact: true }), colorScheme);
      });

      for (const role of Object.keys(roles) as SmokeRole[]) {
        test(`${role} shell has a visible surface and readable heading`, async ({ page }) => {
          await loginAs(page, role);

          const heading = page.getByRole('heading', { name: roles[role].heading }).first();
          await expect(heading).toBeVisible();
          await expectTextContrast(heading, colorScheme);

          if (layout.name === 'mobile') {
            const nav = role === 'student'
              ? page.locator('.academy-bottom-nav')
              : page.getByRole('navigation', { name: `${roles[role].section} dashboard` });
            await expectVisibleSurface(nav, 0.7);
          } else {
            const aside = page.locator('aside:visible').first();
            await expect(aside).toBeVisible();
            const asideBackground = parseColor(await aside.evaluate((element) => getComputedStyle(element).backgroundColor));
            if (asideBackground.alpha >= 0.04) {
              expect(asideBackground.alpha).toBeGreaterThanOrEqual(0.04);
            } else {
              await expectVisibleSurface(aside.locator(':scope > div').first(), 0.04);
            }
          }
        });
      }
    });
  }
}
