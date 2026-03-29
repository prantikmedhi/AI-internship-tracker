/**
 * Job scraping utilities for Internshala, LinkedIn, RemoteOK
 */

import { JobListing } from '@/lib/types';
import { chromium, Page } from 'playwright';

const MAX_RESULTS = parseInt(process.env.MAX_RESULTS_PER_SOURCE || '5');

/**
 * Scrape internships from Internshala using Playwright
 */
export async function scrapeInternshala(
  keyword: string,
  location: string
): Promise<JobListing[]> {
  const jobs: JobListing[] = [];
  try {
    const formattedKeyword = encodeURIComponent(keyword.toLowerCase().replace(/\s+/g, '-'));
    
    let url = `https://internshala.com/internships/work-from-home-${formattedKeyword}-internships/`;
    if (location && location.toLowerCase() !== 'remote') {
      const formattedLoc = encodeURIComponent(location.toLowerCase().replace(/\s+/g, '-'));
      url = `https://internshala.com/internships/${formattedKeyword}-internships-in-${formattedLoc}/`;
    }

    console.log(`[Scraper] Launching Chromium for Internshala: ${url}`);
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    // Set user agent to avoid basic blocks
    await page.setExtraHTTPHeaders({
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    // Wait for internship containers
    await page.waitForSelector('.individual_internship', { timeout: 10000 }).catch(() => {
      console.log('No internships found on Internshala or timeout.');
    });

    const listings = await page.$$('.individual_internship');
    
    for (const listing of listings.slice(0, MAX_RESULTS)) {
      try {
        const titleEl = await listing.$('.job-internship-name');
        const companyEl = await listing.$('.company-name');
        const locationEl = await listing.$('.locations');
        const linkEl = await listing.$('a.job-title-href');
        
        const title = (await titleEl?.innerText()) || '';
        const company = (await companyEl?.innerText()) || '';
        const loctext = (await locationEl?.innerText()) || 'Remote';
        const href = (await linkEl?.getAttribute('href')) || '';
        
        if (title && company) {
          jobs.push({
            role: title.trim(),
            company: company.trim(),
            location: loctext.trim(),
            description: '', // Internshala requires clicking for description, skipped for MVP
            url: href.startsWith('http') ? href : `https://internshala.com${href}`,
            source: 'internshala',
            tags: []
          });
        }
      } catch (e) {
        console.error('Error parsing individual Internshala listing:', e);
      }
    }
    
    await browser.close();
    return jobs;
  } catch (error) {
    console.error('Internshala scrape error:', error);
    return jobs;
  }
}

/**
 * Scrape internships from LinkedIn
 */
export async function scrapeLinkedIn(
  keyword: string,
  location: string
): Promise<JobListing[]> {
  try {
    // For MVP, return empty array as LinkedIn requires complex proxy/auth bypasses
    return [];
  } catch (error) {
    console.error('LinkedIn scrape error:', error);
    return [];
  }
}

/**
 * Scrape from RemoteOK API (no authentication needed)
 */
export async function scrapeRemoteOK(keyword: string): Promise<JobListing[]> {
  try {
    const response = await fetch(`https://remoteok.io/api?tag=${encodeURIComponent(keyword)}`);

    if (!response.ok) {
      throw new Error(`RemoteOK API error: ${response.statusText}`);
    }

    const data = (await response.json()) as unknown[];
    if (!Array.isArray(data)) return [];

    const jobs: JobListing[] = [];
    for (const item of data) {
      if (typeof item !== 'object' || item === null) continue;

      const job = item as Record<string, unknown>;
      if (!job.title || !job.company) continue;

      jobs.push({
        company: String(job.company),
        role: String(job.title),
        location: job.location ? String(job.location) : 'Remote',
        description: job.description ? String(job.description).slice(0, 500) : '',
        url: job.url ? String(job.url) : '',
        source: 'remoteok',
        tags: job.tag ? [String(job.tag)] : [],
      });
    }

    return jobs.slice(0, MAX_RESULTS);
  } catch (error) {
    console.error('RemoteOK scrape error:', error);
    return [];
  }
}

/**
 * Scrape from multiple sources in parallel
 */
export async function scrapeAllSources(
  keyword: string,
  location: string
): Promise<JobListing[]> {
  const [internshala, remoteok] = await Promise.all([
    scrapeInternshala(keyword, location),
    scrapeRemoteOK(keyword),
  ]);

  return [...internshala, ...remoteok];
}
