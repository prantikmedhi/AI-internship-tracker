/**
 * Telegram Bot Entry Point
 * Standalone Node.js process for running the Grammy bot
 */

import 'dotenv/config';
import { bot } from './bot/index';

async function main() {
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    throw new Error('TELEGRAM_BOT_TOKEN environment variable is required');
  }

  if (!process.env.NOTION_TOKEN) {
    throw new Error('NOTION_TOKEN environment variable is required');
  }

  console.log('🤖 Starting Telegram Bot...');
  console.log(`📱 Bot token configured`);
  console.log(`💾 Notion token configured`);

  try {
    console.log('Starting bot listener...');
    await bot.start();
  } catch (error) {
    console.error('❌ Failed to start bot:', error);
    process.exit(1);
  }
}

main();
