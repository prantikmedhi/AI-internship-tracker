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

    // Step 1: Get user profile
    try {
      await ctx.api.editMessageText(chatId, statusMsg.message_id, '1️⃣ Reading your profile...');
      const profile = await getUserProfile(client, session.workspace || '');
    } catch (e) {
      // Profile read optional for search
    }

    // Step 2: Search workspace
    await ctx.api.editMessageText(chatId, statusMsg.message_id, '2️⃣ Searching workspace...');
    const results = await searchWorkspace(client, query);

    // Step 3: Format results
    const resultCount = results.length;
    let response = `✅ Found ${resultCount} results:\n\n`;
    results.slice(0, 5).forEach((result, i) => {
      response += `${i + 1}. ${result.title || 'Untitled'}\n`;
    });
    if (resultCount > 5) {
      response += `\n... and ${resultCount - 5} more`;
    }

    await ctx.api.editMessageText(chatId, statusMsg.message_id, response);

    // Store in session for future reference
    ctx.session.lastResults = results;
    ctx.session.lastQuery = query;
  } catch (error) {
    console.error('Search error:', error);
    await ctx.reply('❌ Search failed. Please try again.');
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

  const query = ctx.match?.trim();
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
