/**
 * Job scraping utilities — Playwright-first with fetch fallback
 * Priority order: LinkedIn → RemoteOK → Internshala
 *
 * Playwright is loaded via dynamic import() inside each function, NOT at module top-level.
 * This prevents the module from crashing if Chromium binaries aren't installed —
 * only the individual source fails, the rest continue.
 */

import { JobListing } from '@/lib/types';

const MAX_RESULTS = parseInt(process.env.MAX_RESULTS_PER_SOURCE || '5', 10);

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// ─── LinkedIn ────────────────────────────────────────────────────────────────

export async function scrapeLinkedIn(keyword: string, location: string): Promise<JobListing[]> {
  const jobs: JobListing[] = [];
  try {
    const { chromium } = await import('playwright');
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent: UA,
      locale: 'en-US',
    });
    const page = await context.newPage();

    const url =
      `https://www.linkedin.com/jobs/search/?` +
      `keywords=${encodeURIComponent(keyword + ' internship')}&` +
      `location=${encodeURIComponent(location || 'India')}&` +
      `f_JT=I&sortBy=R`;

    console.log(`[LinkedIn] Fetching: ${url}`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Wait for job cards — LinkedIn may render as .base-card or .jobs-search__results-list items
    await page
      .waitForSelector('.base-card', { timeout: 10000 })
      .catch(() => console.log('[LinkedIn] Timeout waiting for .base-card'));

    const cards = await page.$$('.base-card');
    console.log(`[LinkedIn] Found ${cards.length} cards`);

    for (const card of cards.slice(0, MAX_RESULTS)) {
      try {
        const role =
          (await card.$eval('.base-search-card__title', el => el.textContent?.trim()).catch(() => '')) || '';
        const company =
          (await card.$eval('.base-search-card__subtitle', el => el.textContent?.trim()).catch(() => '')) || '';
        const loc =
          (await card.$eval('.job-search-card__location', el => el.textContent?.trim()).catch(() => '')) || location;
        const href =
          (await card.$eval('a.base-card__full-link', el => (el as HTMLAnchorElement).href).catch(() => '')) || '';

        if (role && company) {
          jobs.push({
            role: role.trim(),
            company: company.trim(),
            location: loc.trim(),
            description: '',
            url: href || url,
            source: 'linkedin',
            tags: [],
          });
        }
      } catch {
        // skip bad card
      }
    }

    await browser.close();
    console.log(`[LinkedIn] Scraped ${jobs.length} jobs`);
    return jobs;
  } catch (err) {
    console.error('[LinkedIn] Playwright error:', err instanceof Error ? err.message : err);
    return jobs;
  }
}

// ─── RemoteOK ────────────────────────────────────────────────────────────────

export async function scrapeRemoteOK(keyword: string): Promise<JobListing[]> {
  try {
    const url = `https://remoteok.io/api?tag=${encodeURIComponent(keyword)}`;
    console.log(`[RemoteOK] Fetching: ${url}`);

    const res = await fetch(url, {
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = (await res.json()) as unknown[];
    if (!Array.isArray(data)) return [];

    const jobs: JobListing[] = [];
    for (const item of data) {
      if (typeof item !== 'object' || item === null) continue;
      const job = item as Record<string, unknown>;
      if (!job.company) continue;
      const role = String(job.position || job.title || '');
      if (!role) continue;

      jobs.push({
        company: String(job.company),
        role,
        location: job.location ? String(job.location) : 'Remote',
        description: job.description
          ? String(job.description).replace(/<[^>]+>/g, '').slice(0, 500)
          : '',
        url: job.url ? String(job.url) : 'https://remoteok.io',
        source: 'remoteok',
        tags: Array.isArray(job.tags) ? (job.tags as string[]).slice(0, 5) : [],
      });

      if (jobs.length >= MAX_RESULTS) break;
    }

    console.log(`[RemoteOK] Scraped ${jobs.length} jobs`);
    return jobs;
  } catch (err) {
    console.error('[RemoteOK] Error:', err instanceof Error ? err.message : err);
    return [];
  }
}

// ─── Internshala ─────────────────────────────────────────────────────────────

export async function scrapeInternshala(keyword: string, location: string): Promise<JobListing[]> {
  const jobs: JobListing[] = [];
  try {
    const { chromium } = await import('playwright');
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.setExtraHTTPHeaders({ 'User-Agent': UA });

    const slug = keyword.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const locSlug = location.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    const url =
      location && location.toLowerCase() !== 'remote'
        ? `https://internshala.com/internships/${slug}-internships-in-${locSlug}/`
        : `https://internshala.com/internships/work-from-home-${slug}-internships/`;

    console.log(`[Internshala] Fetching: ${url}`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

    await page
      .waitForSelector('.individual_internship', { timeout: 10000 })
      .catch(() => console.log('[Internshala] Timeout waiting for listings'));

    const listings = await page.$$('.individual_internship');
    console.log(`[Internshala] Found ${listings.length} listings`);

    for (const listing of listings.slice(0, MAX_RESULTS)) {
      try {
        const role =
          (await listing.$eval('.job-internship-name', el => el.textContent?.trim()).catch(() => '')) ||
          (await listing.$eval('.profile a', el => el.textContent?.trim()).catch(() => '')) ||
          '';
        const company =
          (await listing.$eval('.company-name', el => el.textContent?.trim()).catch(() => '')) || '';
        const loc =
          (await listing.$eval('.locations', el => el.textContent?.trim()).catch(() => '')) || location;
        const href =
          (await listing.$eval('a.view_detail_button', el => (el as HTMLAnchorElement).href).catch(() => '')) ||
          (await listing.$eval('a.job-title-href', el => (el as HTMLAnchorElement).href).catch(() => '')) ||
          '';

        if (role && company) {
          jobs.push({
            role: role.trim(),
            company: company.trim(),
            location: loc.trim(),
            description: '',
            url: href.startsWith('http') ? href : `https://internshala.com${href}`,
            source: 'internshala',
            tags: [],
          });
        }
      } catch {
        // skip bad listing
      }
    }

    await browser.close();
    console.log(`[Internshala] Scraped ${jobs.length} jobs`);
    return jobs;
  } catch (err) {
    console.error('[Internshala] Playwright error:', err instanceof Error ? err.message : err);
    return jobs;
  }
}

// ─── Aggregate ───────────────────────────────────────────────────────────────

/**
 * Scrape all sources in parallel. Priority: LinkedIn → RemoteOK → Internshala.
 * Each source failure is isolated.
 */
export async function scrapeAllSources(keyword: string, location: string): Promise<JobListing[]> {
  const [linkedin, remoteok, internshala] = await Promise.all([
    scrapeLinkedIn(keyword, location).catch(() => [] as JobListing[]),
    scrapeRemoteOK(keyword).catch(() => [] as JobListing[]),
    scrapeInternshala(keyword, location).catch(() => [] as JobListing[]),
  ]);

  console.log(
    `[Scraper] Results — LinkedIn: ${linkedin.length}, RemoteOK: ${remoteok.length}, Internshala: ${internshala.length}`
  );

  return [...linkedin, ...remoteok, ...internshala];
}
