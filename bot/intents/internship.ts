/**
 * Internship Query Intent
 * Handles job search requests
 */

import { BotContext } from '../session';
import { MCPClient } from '../../lib/mcp/client';
import { TelegramSession, RankedJob } from '../../lib/types';
import { extractSearchKeywords } from '../../lib/llm/extraction';
import { scrapeAllSources } from '../../lib/jobs/scraper';
import { filterLiveListings, normalizeListings } from '../../lib/jobs/normalize';
import { rankJobs } from '../../lib/llm/ranking';
import { getUserProfile } from '../../lib/notion/profile';

const INTERNSHIP_KEYWORDS = [
  'find',
  'search',
  'internship',
  'job',
  'intern',
  'apply',
  'opportunity',
  'position',
  'role',
  'hiring',
  'looking',
];

export function isInternshipQuery(text: string): boolean {
  return INTERNSHIP_KEYWORDS.some((keyword) => text.includes(keyword));
}

export async function handleInternshipQuery(
  ctx: BotContext,
  client: MCPClient,
  text: string,
  session: TelegramSession
): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) {
    await ctx.reply('❌ Could not identify your user ID');
    return;
  }

  try {
    let statusMsg = await ctx.reply('⏳ Processing your request...');
    const chatId = ctx.chat?.id;
    const editMessage = async (step: string) => {
      try {
        if (chatId) {
          await ctx.api.editMessageText(chatId, statusMsg.message_id, step);
        }
      } catch (e) {
        // Ignore edit errors
      }
    };

    // Step 1: Get user profile for ranking
    await editMessage('1️⃣ Reading your profile...');
    let profile;
    try {
      profile = await getUserProfile(client, session.workspace || '');
    } catch (e) {
      // Continue without profile
      profile = undefined;
    }

    // Step 2: Extract keywords from user message
    await editMessage('2️⃣ Analyzing your request...');

    // Create a minimal profile for extraction if profile doesn't exist
    const profileForExtraction = profile || {
      name: '',
      skills: [],
      experience: '',
      education: [],
      projects: [],
      certifications: [],
      preferences: {},
      careerGoal: '',
      aboutMe: '',
    };

    const keywords = await extractSearchKeywords(profileForExtraction, text);
    const { keyword, location } = keywords;

    await editMessage(`3️⃣ Searching for: "${keyword}" in ${location || 'any location'}...`);

    // Step 4: Scrape jobs from all sources
    await editMessage('4️⃣ Scraping job listings...');
    let allJobs = await scrapeAllSources(keyword, location);

    // Step 5: Filter and normalize
    await editMessage('5️⃣ Filtering and normalizing results...');
    allJobs = await normalizeListings(allJobs);

    const totalFound = allJobs.length;
    if (totalFound === 0) {
      await editMessage('❌ No internships found. Try different keywords.');
      return;
    }

    // Step 6: Rank jobs against user profile
    await editMessage(`6️⃣ Ranking ${totalFound} jobs against your profile...`);
    let rankedJobs: RankedJob[];
    if (profile) {
      rankedJobs = await rankJobs(profile, allJobs);
    } else {
      // Fallback to raw jobs cast to RankedJob with default scores
      rankedJobs = allJobs.map((j) => ({
        ...j,
        priorityScore: 0,
        matchedSkills: [],
        missingSkills: [],
        whyFits: '',
      }));
    }

    // Step 6: Format results
    await editMessage('7️⃣ Formatting results...');
    let resultText =
      `✅ Found and ranked ${rankedJobs.length} internships\n\n` +
      `**Top 5 matches:**\n\n`;

    rankedJobs.slice(0, 5).forEach((job, i) => {
      const score = job.priorityScore ? ` (Score: ${job.priorityScore})` : '';
      resultText += `${i + 1}. **${job.company}** - ${job.role}${score}\n`;
      resultText += `   📍 ${job.location || 'Remote'}\n`;
      if (job.matchedSkills && job.matchedSkills.length > 0) {
        resultText += `   ✓ Skills: ${job.matchedSkills.slice(0, 3).join(', ')}\n`;
      }
      resultText += '\n';
    });

    if (rankedJobs.length > 5) {
      resultText += `\n... and ${rankedJobs.length - 5} more internships.`;
    }

    if (chatId) {
      await ctx.api.editMessageText(chatId, statusMsg.message_id, resultText, {
        parse_mode: 'Markdown',
      });
    }

    // Step 8: Save results to session
    await editMessage('8️⃣ Saving results to session...');
    ctx.session.lastResults = rankedJobs;
    ctx.session.lastQuery = keyword;
    ctx.session.lastLocation = location || '';

    // TODO: Save to Notion database
    // await createInternships(client, session.workspace, rankedJobs);

    await ctx.reply('✅ Results saved! Use /read to view details.');
  } catch (error) {
    console.error('Internship query error:', error);
    await ctx.reply('❌ Search failed. Please try again with different keywords.');
  }
}
