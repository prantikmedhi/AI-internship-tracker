/**
 * Job ranking logic using LLM
 */

import { callLLMAndParseJSON } from './client';
import { RANKING_PROMPT } from './prompts';
import { JobListing, RankedJob, UserProfile, RankingResult } from '@/lib/types';

/**
 * Rank a single job against user profile
 */
export async function rankJob(
  profile: UserProfile,
  job: JobListing
): Promise<RankedJob | null> {
  try {
    const prompt = RANKING_PROMPT.replace('{skills}', profile.skills.join(', '))
      .replace('{experience}', profile.experience)
      .replace('{careerGoal}', profile.careerGoal)
      .replace('{education}', profile.education.join(', '))
      .replace('{company}', job.company)
      .replace('{role}', job.role)
      .replace('{location}', job.location)
      .replace('{description}', job.description.slice(0, 500));

    const result = await callLLMAndParseJSON(prompt);

    if (!result) {
      console.warn('Failed to parse ranking result for job:', job.company, job.role);
      return null;
    }

    const ranking = result as RankingResult;

    return {
      ...job,
      priorityScore: ranking.priorityScore || 50,
      matchedSkills: ranking.matchedSkills || [],
      missingSkills: ranking.missingSkills || [],
      whyFits: ranking.whyFits || 'No explanation available',
      blocker: ranking.blocker ? (ranking.blocker as string) : undefined,
    };
  } catch (error) {
    console.error('Error ranking job:', error);
    return null;
  }
}

/**
 * Rank multiple jobs, sorted by priority score descending
 */
export async function rankJobs(
  profile: UserProfile,
  jobs: JobListing[]
): Promise<RankedJob[]> {
  // Rank jobs sequentially to avoid overwhelming the LLM
  const ranked: RankedJob[] = [];

  for (const job of jobs) {
    const rankedJob = await rankJob(profile, job);
    if (rankedJob) {
      ranked.push(rankedJob);
    }
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Sort by priority score descending
  return ranked.sort((a, b) => b.priorityScore - a.priorityScore);
}
