/**
 * Notion Profile Module
 * Read user profile from Notion workspace pages
 */

import { MCPClient } from '@/lib/mcp/client';
import { UserProfile } from '@/lib/types';

/**
 * Text-based skill/preference extraction — no LLM dependency.
 * Parses structured "Key: value" lines and comma-separated lists.
 */
function parseProfileFromText(rawText: string): Partial<UserProfile> {
  const result: Partial<UserProfile> = {
    skills: [],
    tools: [],
    projects: [],
    education: [],
    preferences: {},
  };

  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);

  for (const line of lines) {
    const lower = line.toLowerCase();

    // Name
    if (!result.name && lower.startsWith('name:')) {
      result.name = line.replace(/^name:\s*/i, '').trim();
    }

    // Email
    const emailMatch = line.match(/[\w.+-]+@[\w-]+\.\w+/);
    if (emailMatch && !result.email) result.email = emailMatch[0];

    // Location
    if (lower.startsWith('location:')) {
      result.location = line.replace(/^location:\s*/i, '').trim();
    }

    // Skills: "Skills: Python, React, Node.js"
    if (lower.match(/^skills?[:\s]/)) {
      const inline = line.replace(/^skills?[:\s]*/i, '').trim();
      if (inline) {
        result.skills!.push(
          ...inline.split(/[,;|\/]+/).map(s => s.trim()).filter(s => s.length > 1 && s.length < 40)
        );
      }
    }

    // Tools / Tech Stack
    if (lower.match(/^(tools?|technologies?|tech stack|frameworks?|languages?)[:\s]/)) {
      const inline = line.replace(/^(tools?|technologies?|tech stack|frameworks?|languages?)[:\s]*/i, '').trim();
      if (inline) {
        result.tools!.push(
          ...inline.split(/[,;|\/]+/).map(s => s.trim()).filter(s => s.length > 1 && s.length < 40)
        );
      }
    }

    // Career goal / objective
    if (lower.match(/^(career goal|goal|objective|looking for|target role)[:\s]/)) {
      result.careerGoal = line.replace(/^(career goal|goal|objective|looking for|target role)[:\s]*/i, '').trim();
    }

    // Experience level
    if (lower.match(/^experience level[:\s]/)) {
      const level = line.replace(/^experience level[:\s]*/i, '').trim().toLowerCase();
      if (level.includes('senior')) result.experienceLevel = 'senior';
      else if (level.includes('mid') || level.includes('intermediate')) result.experienceLevel = 'intermediate';
      else result.experienceLevel = 'beginner';
    }

    // Experience summary
    if (lower.match(/^experience[:\s]/) && !lower.includes('level')) {
      result.experience = line.replace(/^experience[:\s]*/i, '').trim();
    }

    // About Me
    if (lower.match(/^(about me|bio|summary)[:\s]/)) {
      result.aboutMe = line.replace(/^(about me|bio|summary)[:\s]*/i, '').trim();
    }

    // Preferences — Preferred Location
    if (lower.match(/^preferred location[:\s]/)) {
      (result.preferences as Record<string, string>).preferredLocation =
        line.replace(/^preferred location[:\s]*/i, '').trim();
    }

    // Preferences — Preferred Role
    if (lower.match(/^preferred role[:\s]/)) {
      (result.preferences as Record<string, string>).preferredRole =
        line.replace(/^preferred role[:\s]*/i, '').trim();
    }

    // Preferences — Desired Salary
    if (lower.match(/^(desired salary|salary)[:\s]/)) {
      (result.preferences as Record<string, string>).desiredSalary =
        line.replace(/^(desired salary|salary)[:\s]*/i, '').trim();
    }
  }

  // Fallback: if still no skills, look for comma-separated lists (3+ short items per line)
  if (result.skills!.length === 0) {
    for (const line of lines) {
      if (line.includes('.') || line.length > 200) continue;
      const items = line.split(',').map(s => s.trim()).filter(s => s.length > 1 && s.length < 35);
      if (items.length >= 3) {
        result.skills = items;
        break;
      }
    }
  }

  return result;
}

/**
 * Read user profile from Notion page contents (About Me, Skills, Projects, Resume, Preferences)
 * First tries LLM extraction; falls back to text-based parsing so profile always returns real data.
 */
export async function getUserProfile(
  client: MCPClient,
  workspaceId: string,
  pageIds?: {
    aboutMePageId?: string;
    skillsPageId?: string;
    projectsPageId?: string;
    resumePageId?: string;
    preferencesPageId?: string;
  }
): Promise<UserProfile> {
  const DEFAULT_PROFILE: UserProfile = {
    name: 'User',
    email: '',
    location: '',
    experienceLevel: 'beginner',
    skills: [],
    tools: [],
    experience: '',
    education: [],
    projects: [],
    certifications: [],
    careerGoal: '',
    preferences: {},
    aboutMe: '',
  };

  // If no page IDs provided, return default
  if (!pageIds || !Object.values(pageIds).some(Boolean)) {
    return DEFAULT_PROFILE;
  }

  // Fetch content from each page using block children (actual text content)
  const texts: string[] = [];
  for (const id of Object.values(pageIds)) {
    if (!id) continue;
    try {
      const result = await client.callTool<{ text?: string }>('notion-get-block-children', {
        block_id: id,
        page_size: 100,
      });
      if (result?.text) texts.push(result.text);
    } catch (err) {
      console.warn(`Failed to fetch page blocks ${id}:`, err);
    }
  }

  if (texts.length === 0) {
    return DEFAULT_PROFILE;
  }

  const rawText = texts.join('\n\n');

  // 1. Try LLM extraction first
  try {
    const { extractProfile } = await import('../llm/extraction');
    const extracted = await extractProfile(rawText);
    if (extracted && (extracted.skills?.length ?? 0) > 0) {
      return { ...DEFAULT_PROFILE, ...extracted };
    }
  } catch (err) {
    console.warn('LLM profile extraction failed, using text parser:', err);
  }

  // 2. Fallback: text-based parser (always works, no LLM needed)
  const textParsed = parseProfileFromText(rawText);
  return { ...DEFAULT_PROFILE, ...textParsed };
}

export async function writeProfilePages(
  client: MCPClient,
  workspaceId: string,
  profile: UserProfile
): Promise<void> {
  // TODO: Implement profile writing to Notion
}
