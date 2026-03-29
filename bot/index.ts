/**
 * Grammy Bot Setup
 * Main bot instance with command and message handlers
 */

import { Bot, session } from 'grammy';
import { BotContext, BotSession } from './session';

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  throw new Error('TELEGRAM_BOT_TOKEN is required');
}

// Create bot instance
export const bot = new Bot<BotContext>(token);

// Add session middleware
bot.use(session({
  initial: (): BotSession => ({
    lastResults: [],
    lastQuery: '',
    lastLocation: '',
  }),
}));

// TODO: Add command handlers
// bot.command('start', startHandler);
// bot.command('help', helpHandler);
// ... etc

// TODO: Add message handler
// bot.on('message:text', messageHandler);

// Error handler
bot.catch((err) => {
  console.error('❌ Bot error:', err);
});

console.log('✅ Bot initialized');
