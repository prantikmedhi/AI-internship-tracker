/**
 * Job scraping utilities for Internshala, LinkedIn, RemoteOK
 */

import { JobListing } from '@/lib/types';

const MAX_RESULTS = parseInt(process.env.MAX_RESULTS_PER_SOURCE || '20');

/**
 * Scrape internships from Internshala
 */
export async function scrapeInternshala(
  keyword: string,
  location: string
): Promise<JobListing[]> {
  try {
    // For MVP, return empty array
    // Full implementation would use Playwright to scrape dynamically loaded content
    console.log(`Would scrape Internshala for: ${keyword} in ${location}`);
    return [];
  } catch (error) {
    console.error('Internshala scrape error:', error);
    return [];
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
    // For MVP, return empty array
    // Full implementation would use Playwright with authentication
    console.log(`Would scrape LinkedIn for: ${keyword} in ${location}`);
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

    if (!Array.isArray(data)) {
      return [];
    }

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
  const [internshala, linkedin, remoteok] = await Promise.all([
    scrapeInternshala(keyword, location),
    scrapeLinkedIn(keyword, location),
    scrapeRemoteOK(keyword),
  ]);

  return [...internshala, ...linkedin, ...remoteok];
}
