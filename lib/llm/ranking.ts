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

    const ranking = result as unknown as RankingResult;

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

// ─── Role-category → skill inference ────────────────────────────────────────
// Used when job descriptions are empty (LinkedIn/Internshala).
// Maps role title patterns to skill categories so "Frontend Developer" matches
// React/Next.js even without an explicit keyword in the job text.

const FRONTEND_ROLE = /frontend|front-end|front end|\bui\b|react\b|angular|vue|web dev/i;
const BACKEND_ROLE  = /backend|back-end|back end|\bapi\b|\bserver\b|database|devops|cloud|infra|sre\b|platform/i;
const FULLSTACK_ROLE = /full.?stack|software engineer|software developer|\bsde\b|\bswe\b|programmer|full stack dev/i;
const DATA_ROLE     = /data (science|engineer|analyst)|machine learning|ml engineer|ai engineer|nlp|deep learning/i;
const MOBILE_ROLE   = /mobile|android|ios|flutter|react native/i;

const FRONTEND_SKILLS = new Set(['react', 'next.js', 'nextjs', 'vue', 'angular', 'svelte', 'javascript', 'typescript', 'html', 'css', 'tailwind', 'redux', 'graphql', 'jquery']);
const BACKEND_SKILLS  = new Set(['python', 'ruby', 'java', 'go', 'golang', 'node', 'nodejs', 'django', 'rails', 'flask', 'fastapi', 'express', 'spring', 'php', 'rust', 'c#', '.net', 'sql', 'postgresql', 'mysql', 'mongodb', 'redis', 'kafka', 'docker', 'kubernetes']);
const DATA_SKILLS     = new Set(['python', 'r', 'sql', 'tensorflow', 'pytorch', 'pandas', 'numpy', 'scikit-learn', 'spark', 'tableau', 'powerbi', 'machine learning', 'deep learning', 'nlp']);
const MOBILE_SKILLS   = new Set(['react native', 'flutter', 'swift', 'kotlin', 'android', 'ios', 'dart']);

function inferMatchFromRole(role: string, skills: string[]): string[] {
  const inferred: string[] = [];
  const isFront    = FRONTEND_ROLE.test(role);
  const isBack     = BACKEND_ROLE.test(role);
  const isFull     = FULLSTACK_ROLE.test(role);
  const isData     = DATA_ROLE.test(role);
  const isMobile   = MOBILE_ROLE.test(role);

  for (const skill of skills) {
    const sl = skill.toLowerCase();
    if ((isFront || isFull) && FRONTEND_SKILLS.has(sl)) inferred.push(skill);
    if ((isBack  || isFull) && BACKEND_SKILLS.has(sl))  inferred.push(skill);
    if (isData                && DATA_SKILLS.has(sl))    inferred.push(skill);
    if (isMobile              && MOBILE_SKILLS.has(sl))  inferred.push(skill);
  }
  return [...new Set(inferred)];
}

/**
 * Keyword-based fallback ranking when LLM is unavailable.
 * 1. Checks direct skill mentions in role/description/tags.
 * 2. Falls back to role-category inference (Frontend → React/TS, Backend → Python/Ruby, etc.)
 *    so jobs with empty descriptions still match correctly.
 */
function keywordRank(profile: UserProfile, job: JobListing): RankedJob {
  const haystack = [job.role, job.description, ...(job.tags ?? [])].join(' ').toLowerCase();

  // Direct matches (skill literally appears in text)
  let matchedSkills = profile.skills.filter(s => haystack.includes(s.toLowerCase()));

  // Role-category inference when description is empty / no direct match
  if (matchedSkills.length === 0) {
    matchedSkills = inferMatchFromRole(job.role, profile.skills);
  }

  const prefRole = (profile.preferences as Record<string, string>)?.preferredRole || '';
  const roleMatch = prefRole
    ? prefRole.toLowerCase().split(/\s+/).some(w => w.length > 2 && job.role.toLowerCase().includes(w))
    : true;

  const score =
    matchedSkills.length === 0
      ? 0
      : Math.min(40 + matchedSkills.length * 7 + (roleMatch ? 10 : 0), 95);

  return {
    ...job,
    priorityScore: score,
    matchedSkills,
    missingSkills: profile.skills.filter(s => !matchedSkills.includes(s)).slice(0, 4),
    whyFits:
      matchedSkills.length > 0
        ? `Matched skills: ${matchedSkills.join(', ')}`
        : 'No skill overlap found',
  };
}

/**
 * Rank multiple jobs, sorted by priority score descending.
 * When LLM fails for a job, falls back to keyword-based matching — never drops a job silently.
 */
export async function rankJobs(
  profile: UserProfile,
  jobs: JobListing[]
): Promise<RankedJob[]> {
  const ranked: RankedJob[] = [];

  for (const job of jobs) {
    const rankedJob = await rankJob(profile, job);
    // Use LLM result if valid, otherwise fall back to keyword matching
    ranked.push(rankedJob ?? keywordRank(profile, job));
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return ranked.sort((a, b) => b.priorityScore - a.priorityScore);
}
