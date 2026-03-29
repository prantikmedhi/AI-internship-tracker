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
import { searchWorkspace, fetchPage } from '../../lib/mcp/tools';
import { getUserProfile } from '../../lib/notion/profile';
import { getWorkspaceOverview } from '../../lib/notion/workspace';

// /start command - welcome and authentication
export async function startHandler(ctx: BotContext) {
  const userId = ctx.from?.id;
  if (!userId) {
    await ctx.reply('❌ Could not identify your user ID');
    return;
  }

  const isAuth = isTelegramUserAuthenticated(userId);

  if (isAuth) {
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

    // Step 1: Scrape external sources
    await ctx.api.editMessageText(chatId, statusMsg.message_id, '1️⃣ Scraping external sources...');
    
    // Extract keyword and optional location
    const parts = query.split(' ');
    const keyword = parts[0];
    const location = parts.length > 1 ? parts.slice(1).join(' ') : 'remote';
    
    // Import scrapeAllSources
    const { scrapeAllSources } = await import('../../lib/jobs/scraper');
    const jobs = await scrapeAllSources(keyword, location);
    
    if (jobs.length === 0) {
      await ctx.api.editMessageText(chatId, statusMsg.message_id, `❌ No jobs found for "${query}".`);
      return;
    }
    
    await ctx.api.editMessageText(chatId, statusMsg.message_id, `2️⃣ Found ${jobs.length} jobs. Formatting results...`);
    
    let response = `✅ Discovered ${jobs.length} internships:\n\n`;
    jobs.slice(0, 5).forEach((job, i) => {
      response += `${i + 1}. **${job.role}** at _${job.company}_\n📍 ${job.location}\n🌐 [Apply Link](${job.url})\n\n`;
    });
    if (jobs.length > 5) {
      response += `\n... and ${jobs.length - 5} more`;
    }
    
    await ctx.api.editMessageText(chatId, statusMsg.message_id, response, { parse_mode: 'Markdown' });
    
    // Background auto-save to Notion
    if (session.trackerDatabaseId) {
      const dbStatusMsg = await ctx.reply('⏳ Auto-saving to your Notion Internship Tracker...');
      let savedCount = 0;
      for (const job of jobs.slice(0, 10)) { // Limit to top 10
        try {
          const props = {
            "Role": { title: [{ text: { content: job.role.substring(0, 2000) } }] },
            "Company": { rich_text: [{ text: { content: job.company.substring(0, 2000) } }] },
            "Location": { rich_text: [{ text: { content: job.location.substring(0, 2000) } }] },
            "URL": { url: job.url },
            "Source": { select: { name: ["linkedin", "internshala", "remoteok"].includes(job.source) ? (job.source.toLowerCase() === 'linkedin' ? 'LinkedIn' : job.source.toLowerCase() === 'internshala' ? 'Internshala' : 'RemoteOK') : 'Other' } },
            "Status": { select: { name: "Discovered" } },
            "Date Added": { date: { start: new Date().toISOString() } }
          };
          
          await client.callTool('notion-create-pages', {
            parent: { database_id: session.trackerDatabaseId },
            properties: props
          });
          savedCount++;
        } catch (err) {
          console.error(`Failed to save job ${job.role}:`, err);
        }
      }
      await ctx.api.editMessageText(chatId, dbStatusMsg.message_id, `✅ Successfully saved ${savedCount} jobs to your tracker database!`);
    } else {
      await ctx.reply('💡 Tip: Send /setup_tracker <Notion_Page_URL> to auto-save these jobs to your workspace next time!');
    }
    
    ctx.session.lastResults = jobs as any;
    ctx.session.lastQuery = query;
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
      await ctx.reply('Usage: /setup_tracker <Notion_Page_URL>\nExample: /setup_tracker https://notion.so/My-Dashboard-a1b2...');
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
  } else {
    // Auto-discover the first page available in the workspace
    await ctx.reply('🔍 Auto-discovering Notion Workspace...');
    const { searchWorkspace } = await import('../../lib/mcp/tools');
    const results = await searchWorkspace(client, '', 'last_edited_time');
    
    // Natively, `notion-search` returns results. They might have an `id` or `url` containing the ID.
    // We try to find any item that has an id
    const candidate = results.find(r => r.id);
    if (candidate && candidate.id) {
       pageId = candidate.id;
       await ctx.reply(`🎯 Found candidate page (${candidate.title || 'Untitled'}). Generating Database inside it...`);
    } else {
       await ctx.reply('❌ Could not auto-discover any Pages. Make sure you shared a Page with your Integration. Try providing a direct URL: /setup_tracker <URL>.');
       return;
    }
  }
  
  try {
    const statusMsg = await ctx.reply('⚙️ Creating Internship Tracker database...');
    
    const schema = {
      "Role": { "title": {} },
      "Company": { "rich_text": {} },
      "Location": { "rich_text": {} },
      "URL": { "url": {} },
      "Source": {
        "select": {
          "options": [
            { "name": "LinkedIn", "color": "blue" },
            { "name": "Internshala", "color": "purple" },
            { "name": "RemoteOK", "color": "gray" },
            { "name": "Other", "color": "default" }
          ]
        }
      },
      "Status": {
        "select": {
          "options": [
            { "name": "Discovered", "color": "yellow" },
            { "name": "Applied", "color": "blue" },
            { "name": "Interviewing", "color": "orange" },
            { "name": "Rejected", "color": "red" },
            { "name": "Offer", "color": "green" }
          ]
        }
      },
      "Date Added": { "date": {} },
      "Applied": { "checkbox": {} }
    };
    
    const result = await client.callTool<{ id: string }>('notion-create-database', {
      parent: { page_id: pageId },
      title: [{ type: 'text', text: { content: "Internship Tracker" } }],
      properties: schema,
    });
    
    if (result && result.id) {
       session.trackerDatabaseId = result.id;
       storeTelegramSession(userId, session);
       await ctx.api.editMessageText(chatId, statusMsg.message_id, `✅ Success! Your Internship Tracker has been created.\n\nFrom now on, /search will automatically populate internships directly into this database!`);
    } else {
       await ctx.api.editMessageText(chatId, statusMsg.message_id, `❌ Failed to create database. Make sure you have shared the Notion page with the integration!`);
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
      content = `📄 **${(page.title as string) || 'Untitled'}**\n\n`;
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

    const profile = await getUserProfile(client, session.workspace || '');

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
