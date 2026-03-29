/**
 * Telegram Bot Message Handler
 * Routes free-text messages to appropriate intent handlers
 */

import { BotContext } from '../session';
import {
  isTelegramUserAuthenticated,
  getTelegramSession,
  clearTelegramSession,
} from '../../lib/telegram-session';
import { createMCPClient } from '../../lib/mcp/client';
import { generateTelegramOAuthUrl, formatOAuthUrlForTelegram } from '../../lib/notion/telegram-oauth';
import { isGreeting, randomGreetingResponse } from '../intents/greeting';
import { isInternshipQuery, handleInternshipQuery } from '../intents/internship';
import { isNotionQuery, handleNotionQuery } from '../intents/notion';

export async function messageHandler(ctx: BotContext) {
  const userId = ctx.from?.id;
  if (!userId) {
    await ctx.reply('❌ Could not identify your user ID');
    return;
  }

  const text = ctx.message?.text?.toLowerCase().trim() || '';
  if (!text) return;

  try {
    // Check greeting
    if (isGreeting(text)) {
      const response = randomGreetingResponse();
      await ctx.reply(response);
      return;
    }

    // Check if user is authenticated
    if (!isTelegramUserAuthenticated(userId)) {
      await ctx.reply(
        '🔐 Please authenticate first:\n\n' +
        'Use /start to get your authentication link, then click it to authorize with Notion.'
      );
      return;
    }

    // Get authenticated session
    const session = getTelegramSession(userId);
    if (!session?.notionToken) {
      await ctx.reply('❌ Authentication lost. Please use /start to re-authenticate.');
      clearTelegramSession(userId);
      return;
    }

    // Create MCP client for this user
    const client = createMCPClient(session.notionToken);

    // Route to appropriate intent handler
    if (isInternshipQuery(text)) {
      await handleInternshipQuery(ctx, client, text, session);
      return;
    }

    if (isNotionQuery(text)) {
      await handleNotionQuery(ctx, client, text, session);
      return;
    }

    // Default: ask for clarification
    await ctx.reply(
      '🤔 I can help with:\n' +
      '• Finding internships: "find python internships in india"\n' +
      '• Searching Notion: "search my python jobs"\n' +
      '• Profile info: "show my profile"\n' +
      '• Or use commands: /search, /read, /profile\n\n' +
      'What would you like to do?'
    );
  } catch (error) {
    console.error('Message handler error:', error);
    await ctx.reply('❌ Something went wrong. Please try again.');
  }
}
