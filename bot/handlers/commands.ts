/**
 * Telegram Bot Commands
 * /start, /help, /search, /read, /add_page, /add_row, /append, /clear
 */

import { BotContext } from '../session';
import {
  getTelegramSession,
  isTelegramUserAuthenticated,
  storeTelegramSession,
  clearTelegramSession,
} from '../../lib/telegram-session';
import { createMCPClient } from '../../lib/mcp/client';
import {
  generateTelegramOAuthUrl,
  formatOAuthUrlForTelegram,
} from '../../lib/notion/telegram-oauth';
import type { RankedJob, JobListing } from '../../lib/types';
import { searchWorkspace, fetchPage } from '../../lib/mcp/tools';
import { getUserProfile } from '../../lib/notion/profile';
import { getWorkspaceOverview } from '../../lib/notion/workspace';
import { ensureInternshipTracker, ensureProfilePage, ensureWorkspaceStructure } from '../../lib/notion/workspace-setup';

// /start command - welcome and authentication
export async function startHandler(ctx: BotContext) {
  const userId = ctx.from?.id;
  if (!userId) {
    await ctx.reply('❌ Could not identify your user ID');
    return;
  }

  const isAuth = isTelegramUserAuthenticated(userId);

  if (isAuth) {
    const session = getTelegramSession(userId);

    // For users who authenticated before workspace-setup feature, trigger setup
    if (session?.notionToken && !session.rootPageId) {
      const client = createMCPClient(session.notionToken);
      const chatId = ctx.chat?.id;
      const setupMsg = await ctx.reply('⚙️ Setting up your workspace for the first time...');

      // Add a timeout to prevent being stuck forever (increased to 60s for multi-page creation)
      const timeoutPromise = new Promise<null>((_, reject) => 
        setTimeout(() => reject(new Error('Setup timeout (60s exceeded)')), 60000)
      );

      Promise.race([
        ensureWorkspaceStructure(client, {
          existingIds: {
            trackerDatabaseId: session.trackerDatabaseId,
            aboutMePageId: session.aboutMePageId,
            skillsPageId: session.skillsPageId,
            projectsPageId: session.projectsPageId,
            resumePageId: session.resumePageId,
            preferencesPageId: session.preferencesPageId,
          }
        }),
        timeoutPromise
      ]).then(ids => {
        if (ids) {
          Object.assign(session, ids);
          storeTelegramSession(userId, session);
          if (chatId) {
            ctx.api.editMessageText(chatId, setupMsg.message_id,
              '✅ Workspace ready! Fill your profile pages in Notion, then use /search <keyword>.'
            ).catch(() => {});
          }
        } else {
          if (chatId) {
            ctx.api.editMessageText(chatId, setupMsg.message_id,
              '⚠️ Automatic workspace setup failed.\n\n' +
              'The integration needs permission to access your Notion pages.\n\n' +
              '**📋 Quick Setup (3 steps):**\n' +
              '1️⃣ Open Notion in your browser\n' +
              '2️⃣ Go to any page → "…" (top-right) → "Add connections"\n' +
              '3️⃣ Search for your bot → Grant access\n\n' +
              'Then try `/start` again.\n\n' +
              '**Or use manual setup:**\n' +
              'After sharing a page, send: `/setup <page_url>`\n' +
              'Example: `/setup https://www.notion.so/My-Dashboard-abc123`',
              { parse_mode: 'Markdown' }
            ).catch(() => {});
          }
        }
      }).catch(err => {
        console.error('Workspace setup error:', err);
        if (chatId) {
          ctx.api.editMessageText(chatId, setupMsg.message_id,
            `❌ Error during workspace setup: ${err.message || 'Unknown error'}.\n\n` +
            'Try manual setup: `/setup <Notion_Page_URL>`',
            { parse_mode: 'Markdown' }
          ).catch(() => {});
        }
      });
      return;
    }

    await ctx.reply(
      '👋 Welcome back! You are authenticated with Notion.\n\n' +
      'Available commands:\n' +
      '/search <keyword> - Find internships\n' +
      '/read <query> - Search your Notion workspace\n' +
      '/profile - Show your profile\n' +
      '/workspace - Show workspace overview\n' +
      '/help - Show all commands\n' +
      '/logout - Disconnect from Notion'
    );
  } else {
    await ctx.reply(
      '👋 Welcome to Notion Internship Agent!\n\n' +
      '🔐 Click the link below to authenticate with Notion:\n'
    );

    try {
      const oauthUrl = await generateTelegramOAuthUrl(userId);
      const message = formatOAuthUrlForTelegram(oauthUrl);
      await ctx.reply(message);
    } catch (error) {
      console.error('Failed to generate OAuth URL:', error);
      await ctx.reply('❌ Failed to generate authentication link. Please try again.');
    }
  }
}

// /setup command - manual workspace setup with URL
export async function setupHandler(ctx: BotContext) {
  const userId = ctx.from?.id;
  if (!userId) return;
  if (!isTelegramUserAuthenticated(userId)) {
    await ctx.reply('🔐 Please authenticate first with /start');
    return;
  }

  const session = getTelegramSession(userId);
  if (!session?.notionToken) return;
  const client = createMCPClient(session.notionToken);

  const chatId = ctx.chat?.id;
  if (!chatId) return;

  const matchStr = Array.isArray(ctx.match) ? ctx.match.join(' ') : String(ctx.match || '');
  const url = matchStr.trim();
  
  if (!url || !url.includes('notion.so/')) {
    await ctx.reply(
      '❌ Invalid command format.\n\n' +
      '**Usage:** `/setup <page-url>`\n\n' +
      '**Steps:**\n' +
      '1. Share a page with the bot in Notion (click "…" → "Add connections")\n' +
      '2. Copy that page URL from your browser\n' +
      '3. Send: `/setup <pasted-url>`\n\n' +
      '**Example:**\n' +
      '`/setup https://www.notion.so/My-Dashboard-a1b2c3d4e5f6`',
      { parse_mode: 'Markdown' }
    );
    return;
  }

  // Extract UUID from URL
  const uuidMatch = url.match(/([a-f0-9]{32})/i) || url.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);
  if (!uuidMatch) {
    await ctx.reply('❌ Invalid Notion URL. Could not extract Page ID.');
    return;
  }
  let rawId = uuidMatch[1].replace(/-/g, '');
  const parentPageId = `${rawId.substr(0,8)}-${rawId.substr(8,4)}-${rawId.substr(12,4)}-${rawId.substr(16,4)}-${rawId.substr(20)}`;

  const setupMsg = await ctx.reply('⚙️ Setting up your workspace under the provided page...');

  try {
    const ids = await ensureWorkspaceStructure(client, {
      existingIds: {
        trackerDatabaseId: session.trackerDatabaseId,
        aboutMePageId: session.aboutMePageId,
        skillsPageId: session.skillsPageId,
        projectsPageId: session.projectsPageId,
        resumePageId: session.resumePageId,
        preferencesPageId: session.preferencesPageId,
      },
      parentPageId
    });

    if (ids) {
      Object.assign(session, ids);
      storeTelegramSession(userId, session);
      await ctx.api.editMessageText(chatId, setupMsg.message_id,
        '✅ Workspace ready! Your AI Internship Agent root page and sub-pages have been created under the page you provided.'
      );
    } else {
      await ctx.api.editMessageText(chatId, setupMsg.message_id,
        '❌ Setup failed. Please make sure the integration has access to the page you provided (click "Add connections" in Notion).'
      );
    }
  } catch (err) {
    console.error('Manual setup error:', err);
    await ctx.api.editMessageText(chatId, setupMsg.message_id,
      `❌ Error during setup: ${(err as Error).message}`
    );
  }
}

// /help command
export async function helpHandler(ctx: BotContext) {
  const commands = `
🤖 **Notion Internship Agent**

**Authentication:**
/start - Start the bot and authenticate
/logout - Disconnect from Notion

**Job Search:**
/search <keyword> [location] - Find and rank internships
Example: /search python india

**Notion Operations:**
/read <query> - Search your workspace
/profile - Show your profile summary
/workspace - Show workspace overview
/setup <url> - Manual workspace setup if auto-discovery fails

**Direct Message Support:**
Just write naturally:
- "find python internships in india"
- "show my python jobs"
- "what's in my workspace"
- "hi" or "hello"
  `.trim();

  await ctx.reply(commands, { parse_mode: 'Markdown' });
}

// /search command
export async function searchHandler(ctx: BotContext) {
  const userId = ctx.from?.id;
  if (!userId) {
    await ctx.reply('❌ Could not identify your user ID');
    return;
  }

  if (!isTelegramUserAuthenticated(userId)) {
    await ctx.reply('🔐 Please authenticate first with /start');
    return;
  }

  const query = typeof ctx.match === 'string' ? ctx.match.trim() : String(ctx.match ?? '').trim();
  if (!query) {
    await ctx.reply('Usage: /search <keyword> [location]\nExample: /search python india');
    return;
  }

  try {
    const session = getTelegramSession(userId);
    if (!session?.notionToken) {
      await ctx.reply('❌ Authentication lost. Please use /start to re-authenticate.');
      clearTelegramSession(userId);
      return;
    }

    const client = createMCPClient(session.notionToken);
    let statusMsg = await ctx.reply('🔍 Searching for internships...');

    const chatId = ctx.chat?.id;
    if (!chatId) {
      await ctx.reply('Error: Could not identify chat');
      return;
    }

    // Step 1: Read user profile from Notion pages
    await ctx.api.editMessageText(chatId, statusMsg.message_id, '1️⃣ Reading your profile from Notion...');
    const profile = await getUserProfile(client, session.workspace || '', {
      aboutMePageId: session.aboutMePageId,
      skillsPageId: session.skillsPageId,
      projectsPageId: session.projectsPageId,
      resumePageId: session.resumePageId,
      preferencesPageId: session.preferencesPageId,
    }).catch(() => undefined);

    // Step 2: Parse location from query, then optionally refine with LLM

    // Regex pre-parser: handles "... in <City>", "... at <City>" patterns reliably
    function parseQueryParts(raw: string): { keyword: string; location: string } {
      const inMatch = raw.match(/^(.*?)\s+in\s+([A-Za-z][A-Za-z\s,]+)$/i);
      if (inMatch) return { keyword: inMatch[1].trim(), location: inMatch[2].trim() };
      const atMatch = raw.match(/^(.*?)\s+at\s+([A-Za-z][A-Za-z\s,]+)$/i);
      if (atMatch) return { keyword: atMatch[1].trim(), location: atMatch[2].trim() };
      return { keyword: raw, location: '' };
    }

    const parsed = parseQueryParts(query);

    // Step 2a: Optionally refine keyword/location with LLM (fails silently — regex values used as fallback)
    // Step 2a: Extract location from query (LLM optional, regex already parsed above)
    let location = parsed.location || '';
    try {
      const { extractSearchKeywords } = await import('../../lib/llm/extraction');
      const kw = profile ? await extractSearchKeywords(profile, query).catch(() => null) : null;
      if (kw?.location && !parsed.location) location = kw.location;
    } catch {
      // LLM unavailable — use regex-parsed location
    }

    // Step 2b: Build the search keyword always from the user's actual skills + role.
    // Skill-based keywords ("Python Java developer") return FAR more relevant results
    // from scrapers than generic terms ("internship", "Full Stack Developer").
    const FILLER = new Set(['internship', 'internships', 'job', 'jobs', 'new', 'find', 'search', 'get', 'show', 'me', 'a', 'an', 'the', '']);
    const queryWords = parsed.keyword.toLowerCase().split(/\s+/).filter(w => !FILLER.has(w));
    const prefRoleFromProfile = (profile?.preferences as Record<string, string>)?.preferredRole?.trim() || '';

    let keyword: string;
    if (queryWords.length > 0) {
      // User gave a specific keyword (e.g. "python", "react") — keep it, append "developer" if needed
      keyword = queryWords.join(' ');
      if (!keyword.match(/developer|engineer|analyst|designer|scientist/i)) {
        keyword += ' developer';
      }
    } else if (profile && profile.skills.length > 0) {
      // Generic query — use top 2 skills as keyword so scraper fetches relevant jobs
      const topSkills = profile.skills.slice(0, 2);
      keyword = topSkills.join(' ') + ' developer';
    } else if (prefRoleFromProfile) {
      keyword = prefRoleFromProfile;
    } else {
      keyword = 'software developer';
    }

    // Fall back location from profile preferences if not extracted from query
    if (!location && profile) {
      const prefLoc = (profile.preferences as Record<string, string>)?.preferredLocation?.trim();
      if (prefLoc && prefLoc.toLowerCase() !== 'any') location = prefLoc;
    }
    if (!location) location = 'remote';

    console.log(`[search] keyword="${keyword}" location="${location}"`);

    // Step 3: Scrape jobs from all sources
    let jobs: JobListing[] = [];
    try {
      await ctx.api.editMessageText(
        chatId,
        statusMsg.message_id,
        `2️⃣ Searching for "${keyword}" in ${location}...`
      );
      const { scrapeAllSources } = await import('../../lib/jobs/scraper');
      jobs = await scrapeAllSources(keyword, location);
    } catch (err) {
      console.error('[search] Scraper failed:', err);
      await ctx.api.editMessageText(
        chatId,
        statusMsg.message_id,
        `❌ Job scraping failed.\n\nIf using Playwright make sure Chromium is installed:\n\`npx playwright install chromium\``
      );
      return;
    }

    if (jobs.length === 0) {
      await ctx.api.editMessageText(chatId, statusMsg.message_id, `❌ No jobs found for "${keyword}" in ${location}.`);
      return;
    }

    if (!profile || profile.skills.length === 0) {
      await ctx.api.editMessageText(
        chatId,
        statusMsg.message_id,
        `⚠️ Your profile has no skills listed.\n\n` +
        `Please fill in your *Skills* page on Notion with your skills (e.g. "Skills: Python, React, Node.js"), then search again.\n\n` +
        `Use /profile to check what was read from your pages.`,
        { parse_mode: 'Markdown' }
      );
      return;
    }

    // Step 4: Rank jobs against user profile
    let allRanked: RankedJob[] = [];
    try {
      await ctx.api.editMessageText(
        chatId,
        statusMsg.message_id,
        `3️⃣ Ranking ${jobs.length} jobs against your profile...`
      );
      const { rankJobs } = await import('../../lib/llm/ranking');
      allRanked = await rankJobs(profile, jobs);
    } catch (err) {
      console.error('[search] Ranking failed, using keyword fallback:', err);
      // Keyword-match fallback — search still works even if LLM module fails
      allRanked = jobs.map((j) => {
        const hay = (j.role + ' ' + j.description + ' ' + (j.tags ?? []).join(' ')).toLowerCase();
        const matched = profile.skills.filter(s => hay.includes(s.toLowerCase()));
        return {
          ...j,
          priorityScore: matched.length > 0 ? 40 + matched.length * 8 : 0,
          matchedSkills: matched,
          missingSkills: profile.skills.filter(s => !matched.includes(s)).slice(0, 4),
          whyFits: matched.length > 0 ? `Matched skills: ${matched.join(', ')}` : 'No skill overlap',
        };
      });
    }

    allRanked.sort((a, b) => b.priorityScore - a.priorityScore);

    // Filter: only jobs where at least 1 skill matched (score > 0 means role inference or keyword found a match)
    const withMatches = allRanked.filter(j => j.priorityScore > 0);
    // Fallback: if truly nothing matched, show top 5 raw results with a note rather than an error
    let rankedJobs = withMatches.length > 0 ? withMatches : allRanked.slice(0, 5);
    const usedFallback = withMatches.length === 0;

    // Soft location filter — never empties the list
    const prefLocation = (profile.preferences as Record<string, string>)?.preferredLocation;
    if (prefLocation && prefLocation.toLowerCase() !== 'any') {
      const locationFiltered = rankedJobs.filter(j =>
        j.location.toLowerCase().includes(prefLocation.toLowerCase()) ||
        j.location.toLowerCase().includes('remote')
      );
      if (locationFiltered.length > 0) rankedJobs = locationFiltered;
    }

    const topJobs = rankedJobs.slice(0, 10);

    // Step 5: Format and display results
    const prefRole = (profile.preferences as Record<string, string>)?.preferredRole;
    let response = usedFallback
      ? `⚠️ *No direct skill matches found.* Showing top results for "${keyword}" — update your Skills page in Notion for better matching.\n\n`
      : `✅ *${topJobs.length} internship${topJobs.length > 1 ? 's' : ''} found* matching your profile\n` +
        `🎯 Skills: ${profile.skills.slice(0, 4).join(', ')}\n` +
        `${prefLocation ? `📍 Location: ${prefLocation}\n` : ''}` +
        `${prefRole ? `💼 Role: ${prefRole}\n` : ''}` +
        `\n`;

    topJobs.slice(0, 5).forEach((job, i) => {
      response += `${i + 1}. *${job.role}* — ${job.company}\n`;
      response += `   📍 ${job.location} | Score: ${job.priorityScore}\n`;
      if (job.matchedSkills.length > 0) {
        response += `   ✓ ${job.matchedSkills.slice(0, 3).join(', ')}\n`;
      }
      response += `   [Apply](${job.url})\n\n`;
    });
    if (topJobs.length > 5) {
      response += `_...and ${topJobs.length - 5} more saved to your tracker_`;
    }

    await ctx.api.editMessageText(chatId, statusMsg.message_id, response, { parse_mode: 'Markdown' });

    // Step 6: Ensure workspace structure exists
    if (!session.rootPageId) {
      await ctx.api.editMessageText(chatId, statusMsg.message_id, `${response}\n\n⚙️ Setting up your workspace...`);
      const ids = await ensureWorkspaceStructure(client, {
        existingIds: {
          trackerDatabaseId: session.trackerDatabaseId,
          aboutMePageId: session.aboutMePageId,
          skillsPageId: session.skillsPageId,
          projectsPageId: session.projectsPageId,
          resumePageId: session.resumePageId,
          preferencesPageId: session.preferencesPageId,
        },
      });
      if (ids) {
        Object.assign(session, ids);
        storeTelegramSession(userId, session);
      }
    } else if (!session.trackerDatabaseId) {
      // Fallback for users with root page but no tracker DB
      const trackerId = await ensureInternshipTracker(client);
      if (trackerId) {
        session.trackerDatabaseId = trackerId;
        storeTelegramSession(userId, session);
      }
    }

    // Step 7: Auto-save to tracker if it exists (with extended columns)
    if (session.trackerDatabaseId) {
      const dbStatusMsg = await ctx.reply('💾 Auto-saving to your Internship Tracker...');
      let savedCount = 0;
      for (const job of topJobs) {
        try {
          const sourceLabel =
            job.source === 'linkedin'
              ? 'LinkedIn'
              : job.source === 'internshala'
                ? 'Internshala'
                : job.source === 'remoteok'
                  ? 'RemoteOK'
                  : 'Other';

          const props = {
            Role: { title: [{ text: { content: job.role.substring(0, 2000) } }] },
            Company: { rich_text: [{ text: { content: job.company.substring(0, 2000) } }] },
            Location: { rich_text: [{ text: { content: job.location.substring(0, 2000) } }] },
            'Apply URL': { url: job.url },
            Source: { select: { name: sourceLabel } },
            Status: { select: { name: 'Discovered' } },
            'Date Added': { date: { start: new Date().toISOString() } },
            Applied: { checkbox: false },
            'Priority Score': { number: job.priorityScore || 0 },
            'Matched Skills': { rich_text: [{ text: { content: (job.matchedSkills || []).join(', ').substring(0, 2000) } }] },
            'Missing Skills': { rich_text: [{ text: { content: (job.missingSkills || []).join(', ').substring(0, 2000) } }] },
            'Why This Fits': { rich_text: [{ text: { content: (job.whyFits || '').substring(0, 2000) } }] },
            'Blocker Reason': { rich_text: [{ text: { content: (job.blocker || '').substring(0, 2000) } }] },
          };

          await client.callTool('notion-create-pages', {
            parent: { database_id: session.trackerDatabaseId },
            properties: props,
          });
          savedCount++;
        } catch (err) {
          console.error(`Failed to save job ${job.role}:`, err);
        }
      }
      await ctx.api.editMessageText(
        chatId,
        dbStatusMsg.message_id,
        `✅ Saved ${savedCount} ranked jobs to your Internship Tracker!`
      );
    }

    ctx.session.lastResults = topJobs;
    ctx.session.lastQuery = keyword;
    ctx.session.lastLocation = location;
  } catch (error) {
    console.error('Search error:', error);
    await ctx.reply('❌ Search failed. Please try again.');
  }
}

// /setup_tracker command
export async function setupTrackerHandler(ctx: BotContext) {
  const userId = ctx.from?.id;
  if (!userId) return;
  if (!isTelegramUserAuthenticated(userId)) {
    await ctx.reply('🔐 Please authenticate first with /start');
    return;
  }

  const session = getTelegramSession(userId);
  if (!session?.notionToken) return;
  const client = createMCPClient(session.notionToken);

  const chatId = ctx.chat?.id;
  if (!chatId) return;

  // Handle potential Grammy match object vs simple string
  const matchStr = Array.isArray(ctx.match) ? ctx.match.join(' ') : String(ctx.match || '');
  const url = matchStr.trim();

  let pageId = '';

  if (url) {
    if (!url.includes('notion.so/')) {
      await ctx.reply(
        '❌ Invalid command format.\n\n' +
        '**Usage:** `/setup_tracker <page-url>`\n\n' +
        '**Steps:**\n' +
        '1. Share a page with the bot in Notion (click "…" → "Add connections")\n' +
        '2. Copy that page URL from your browser\n' +
        '3. Send: `/setup_tracker <pasted-url>`\n\n' +
        'This will create the full workspace structure under that page.\n\n' +
        '**Example:**\n' +
        '`/setup_tracker https://www.notion.so/My-Dashboard-a1b2c3d4e5f6`',
        { parse_mode: 'Markdown' }
      );
      return;
    }
    // Extract UUID from URL
    const match = url.match(/([a-f0-9]{32})/i) || url.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);
    if (!match) {
      await ctx.reply('❌ Invalid Notion URL. Could not extract Page ID.');
      return;
    }
    let rawId = match[1].replace(/-/g, '');
    pageId = `${rawId.substr(0,8)}-${rawId.substr(8,4)}-${rawId.substr(12,4)}-${rawId.substr(16,4)}-${rawId.substr(20)}`;
  }

  try {
    const statusMsg = await ctx.reply('⚙️ Setting up your full AI Internship Agent workspace (root page, profile pages, and tracker database)...');

    const ids = await ensureWorkspaceStructure(client, { 
      parentPageId: pageId || undefined,
      existingIds: {
        rootPageId: session.rootPageId,
        aboutMePageId: session.aboutMePageId,
        skillsPageId: session.skillsPageId,
        projectsPageId: session.projectsPageId,
        resumePageId: session.resumePageId,
        preferencesPageId: session.preferencesPageId,
        trackerDatabaseId: session.trackerDatabaseId,
      }
    });

    if (ids && ids.trackerDatabaseId) {
       // Update session with ALL new IDs
       Object.assign(session, ids);
       storeTelegramSession(userId, session);

       await ctx.api.editMessageText(
         chatId, 
         statusMsg.message_id, 
         `✅ Success! Your AI Internship Agent workspace has been established.\n\n` +
         `Your Notion now has:\n` +
         `• Root page: AI Internship Agent\n` +
         `• 5 Profile pages (fill these for better matching)\n` +
         `• Internship Tracker database\n\n` +
         `From now on, /search will automatically populate internships into your tracker!`
       );
    } else {
       await ctx.api.editMessageText(
         chatId,
         statusMsg.message_id,
         `❌ Failed to establish workspace.\n\n` +
         `**Possible reasons:**\n` +
         `• The page wasn't shared with the bot (check "Add connections" in Notion)\n` +
         `• The URL is invalid or not accessible\n\n` +
         `**Try again:**\n` +
         `1. Double-check that the page is shared with your bot\n` +
         `2. Copy the page URL again\n` +
         `3. Send: \`/setup_tracker <fresh-url>\``
       );
    }
  } catch (error) {
    console.error('Setup tracker error:', error);
    await ctx.reply(`❌ Setup failed: ${(error as Error).message}`);
  }
}
// /read command
export async function readHandler(ctx: BotContext) {
  const userId = ctx.from?.id;
  if (!userId) {
    await ctx.reply('❌ Could not identify your user ID');
    return;
  }

  if (!isTelegramUserAuthenticated(userId)) {
    await ctx.reply('🔐 Please authenticate first with /start');
    return;
  }

  const queryMatchStr = Array.isArray(ctx.match) ? ctx.match.join(' ') : String(ctx.match || '');
  const query = queryMatchStr.trim();
  if (!query) {
    await ctx.reply('Usage: /read <page_id_or_query>');
    return;
  }

  try {
    const session = getTelegramSession(userId);
    if (!session?.notionToken) {
      await ctx.reply('❌ Authentication lost. Please use /start to re-authenticate.');
      clearTelegramSession(userId);
      return;
    }

    const chatId = ctx.chat?.id;
    if (!chatId) {
      await ctx.reply('Error: Could not identify chat');
      return;
    }

    const client = createMCPClient(session.notionToken);
    let statusMsg = await ctx.reply('📖 Fetching page...');

    // Try to fetch the page
    const page = await fetchPage(client, query);

    let content = `📄 **Notion Page**\n\n`;
    if (typeof page === 'object' && page !== null && 'title' in page) {
      let title = 'Untitled';
      const pageTitle = (page as any).title;
      if (typeof pageTitle === 'string') {
        title = pageTitle;
      } else if (
        Array.isArray(pageTitle) &&
        pageTitle.length > 0 &&
        typeof pageTitle[0] === 'object' &&
        'text' in pageTitle[0]
      ) {
        title = (pageTitle[0] as any).text?.content || 'Untitled';
      }
      content = `📄 **${title}**\n\n`;

      // Fetch block children for actual page content
      try {
        const blockResult = await client.callTool<{ text?: string }>('notion-get-block-children', {
          block_id: query,
          page_size: 50
        });
        const bodyText = blockResult?.text || '(This page has no text content)';
        content += bodyText;
      } catch (err) {
        console.warn('Could not fetch page blocks:', err);
        content += '(Could not load page content)';
      }
    }

    // Truncate if too long
    if (content.length > 4000) {
      content = content.substring(0, 4000) + '\n\n... (truncated)';
    }

    await ctx.api.editMessageText(chatId, statusMsg.message_id, content, {
      parse_mode: 'Markdown',
    });
  } catch (error) {
    console.error('Read error:', error);
    await ctx.reply('❌ Failed to fetch page. Make sure the ID is correct.');
  }
}

// /profile command
export async function profileHandler(ctx: BotContext) {
  const userId = ctx.from?.id;
  if (!userId) {
    await ctx.reply('❌ Could not identify your user ID');
    return;
  }

  if (!isTelegramUserAuthenticated(userId)) {
    await ctx.reply('🔐 Please authenticate first with /start');
    return;
  }

  try {
    const session = getTelegramSession(userId);
    if (!session?.notionToken) {
      await ctx.reply('❌ Authentication lost. Please use /start to re-authenticate.');
      clearTelegramSession(userId);
      return;
    }

    const chatId = ctx.chat?.id;
    if (!chatId) {
      await ctx.reply('Error: Could not identify chat');
      return;
    }

    const client = createMCPClient(session.notionToken);
    let statusMsg = await ctx.reply('👤 Reading profile...');

    const profile = await getUserProfile(client, session.workspace || '', {
      aboutMePageId: session.aboutMePageId,
      skillsPageId: session.skillsPageId,
      projectsPageId: session.projectsPageId,
      resumePageId: session.resumePageId,
      preferencesPageId: session.preferencesPageId,
    });

    let content =
      `👤 **Your Profile**\n\n` +
      `**Name:** ${profile.name ?? '(Not set)'}\n` +
      `**Email:** ${profile.email ?? '(Not set)'}\n` +
      `**Location:** ${profile.location ?? '(Not set)'}\n` +
      `**Experience:** ${profile.experienceLevel ?? '(Not set)'}\n\n` +
      `**Skills:** ${profile.skills.join(', ') || '(Not set)'}\n` +
      `**Tools:** ${profile.tools?.join(', ') || '(Not set)'}`;

    await ctx.api.editMessageText(chatId, statusMsg.message_id, content, {
      parse_mode: 'Markdown',
    });
  } catch (error) {
    console.error('Profile error:', error);
    await ctx.reply('❌ Failed to read profile.');
  }
}

// /workspace command
export async function workspaceHandler(ctx: BotContext) {
  const userId = ctx.from?.id;
  if (!userId) {
    await ctx.reply('❌ Could not identify your user ID');
    return;
  }

  if (!isTelegramUserAuthenticated(userId)) {
    await ctx.reply('🔐 Please authenticate first with /start');
    return;
  }

  try {
    const session = getTelegramSession(userId);
    if (!session?.notionToken) {
      await ctx.reply('❌ Authentication lost. Please use /start to re-authenticate.');
      clearTelegramSession(userId);
      return;
    }

    const chatId = ctx.chat?.id;
    if (!chatId) {
      await ctx.reply('Error: Could not identify chat');
      return;
    }

    const client = createMCPClient(session.notionToken);
    let statusMsg = await ctx.reply('📊 Loading workspace overview...');

    const overview = await getWorkspaceOverview(client);

    let content = `📊 **Workspace Overview**\n\n`;
    content += `**Databases:** ${overview.databases.length}\n`;
    overview.databases.slice(0, 5).forEach((db) => {
      content += `  • ${db.name}\n`;
    });
    if (overview.databases.length > 5) {
      content += `  ... and ${overview.databases.length - 5} more\n`;
    }

    content += `\n**Recent Pages:** ${overview.recentPages.length}\n`;
    overview.recentPages.slice(0, 3).forEach((page) => {
      content += `  • ${page.title}\n`;
    });

    await ctx.api.editMessageText(chatId, statusMsg.message_id, content, {
      parse_mode: 'Markdown',
    });
  } catch (error) {
    console.error('Workspace error:', error);
    await ctx.reply('❌ Failed to load workspace overview.');
  }
}

// /logout command
export async function logoutHandler(ctx: BotContext) {
  const userId = ctx.from?.id;
  if (!userId) {
    await ctx.reply('❌ Could not identify your user ID');
    return;
  }

  clearTelegramSession(userId);
  await ctx.reply('👋 You have been logged out. Use /start to authenticate again.');
}
