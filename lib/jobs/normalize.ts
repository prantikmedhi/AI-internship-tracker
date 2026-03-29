/**
 * Job listing normalization and deduplication
 */

import { JobListing } from '@/lib/types';

/**
 * Deduplicate jobs by URL
 */
export function dedupByUrl(jobs: JobListing[]): JobListing[] {
  const seen = new Set<string>();
  const deduped: JobListing[] = [];

  for (const job of jobs) {
    if (!job.url || !seen.has(job.url)) {
      if (job.url) seen.add(job.url);
      deduped.push(job);
    }
  }

  return deduped;
}

/**
 * Filter out likely closed/inactive listings
 */
export async function filterLiveListings(jobs: JobListing[]): Promise<JobListing[]> {
  const alive: JobListing[] = [];

  for (const job of jobs) {
    // Skip if URL is missing
    if (!job.url) continue;

    // Skip if description contains closed/inactive keywords
    const description = job.description.toLowerCase();
    if (
      description.includes('closed') ||
      description.includes('no longer accepting') ||
      description.includes('expired')
    ) {
      continue;
    }

    // For MVP, just include it
    // Full impl would do HEAD request + parse date
    alive.push(job);
  }

  return alive;
}

/**
 * Normalize and clean job listings
 */
export async function normalizeListings(jobs: JobListing[]): Promise<JobListing[]> {
  // Deduplicate
  let cleaned = dedupByUrl(jobs);

  // Filter to live listings
  cleaned = await filterLiveListings(cleaned);

  // Clean up fields
  cleaned = cleaned.map(job => ({
    ...job,
    company: job.company.trim(),
    role: job.role.trim(),
    location: job.location.trim() || 'Not specified',
    description: job.description.trim().slice(0, 1000), // Max 1000 chars
  }));

  return cleaned;
}
