/**
 * LLM-based extraction helpers
 */

import { callLLMAndParseJSON } from './client';
import {
  KEYWORD_EXTRACTION_PROMPT,
  COVER_LETTER_PROMPT,
  PROFILE_EXTRACTION_PROMPT,
} from './prompts';
import { JobListing, SearchKeywords, UserProfile } from '@/lib/types';

/**
 * Extract job search keywords from user message
 */
export async function extractSearchKeywords(
  profile: UserProfile,
  userMessage: string
): Promise<SearchKeywords> {
  try {
    const prompt = KEYWORD_EXTRACTION_PROMPT.replace('{userMessage}', userMessage)
      .replace('{skills}', profile.skills.join(', '))
      .replace('{careerGoal}', profile.careerGoal);

    const result = await callLLMAndParseJSON(prompt);

    if (result && 'keyword' in result && typeof result.keyword === 'string') {
      return {
        keyword: result.keyword || 'internship',
        location: (result.location as string) || '',
        reason: (result.reason as string) || 'User search',
      };
    }

    // Fallback: basic extraction from message
    const lowerMessage = userMessage.toLowerCase();
    let keyword = 'internship';
    let location = '';

    if (lowerMessage.includes('python')) keyword = 'Python Developer';
    if (lowerMessage.includes('data')) keyword = 'Data Science';
    if (lowerMessage.includes('frontend')) keyword = 'Frontend Developer';
    if (lowerMessage.includes('backend')) keyword = 'Backend Developer';

    if (lowerMessage.includes('india')) location = 'India';
    if (lowerMessage.includes('delhi')) location = 'Delhi';
    if (lowerMessage.includes('bangalore')) location = 'Bangalore';
    if (lowerMessage.includes('remote')) location = 'Remote';

    return {
      keyword,
      location,
      reason: 'Pattern-based extraction',
    };
  } catch (error) {
    console.error('Error extracting keywords:', error);
    return {
      keyword: 'internship',
      location: '',
      reason: 'Fallback',
    };
  }
}

/**
 * Generate a personalized cover letter for a job
 */
export async function generateCoverLetter(
  profile: UserProfile,
  job: JobListing
): Promise<string> {
  try {
    const prompt = COVER_LETTER_PROMPT.replace('{name}', profile.name)
      .replace('{skills}', profile.skills.join(', '))
      .replace('{experience}', profile.experience)
      .replace('{careerGoal}', profile.careerGoal)
      .replace('{company}', job.company)
      .replace('{role}', job.role)
      .replace('{location}', job.location);

    const { callLLM } = await import('./client');
    const result = await callLLM(prompt);
    return result || '';
  } catch (error) {
    console.error('Error generating cover letter:', error);
    return '';
  }
}

/**
 * Extract structured profile data from raw text (resume)
 */
export async function extractProfile(rawText: string): Promise<Partial<UserProfile> | null> {
  try {
    const prompt = PROFILE_EXTRACTION_PROMPT.replace('{rawText}', rawText);

    const result = await callLLMAndParseJSON(prompt);

    if (!result) {
      return null;
    }

    return {
      name: (result.name as string) || 'Unknown',
      aboutMe: (result.aboutMe as string) || '',
      skills: Array.isArray(result.skills) ? (result.skills as string[]) : [],
      education: Array.isArray(result.education) ? (result.education as string[]) : [],
      experience: (result.experience as string) || '',
      projects: Array.isArray(result.projects) ? (result.projects as string[]) : [],
      certifications: Array.isArray(result.certifications)
        ? (result.certifications as string[])
        : [],
      careerGoal: (result.careerGoal as string) || '',
      preferences: (result.preferences as Record<string, unknown>) || {},
    };
  } catch (error) {
    console.error('Error extracting profile:', error);
    return null;
  }
}
