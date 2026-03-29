/**
 * Telegram Bot Standalone Entry Point
 * Optional: Run the bot in a separate process for debugging or production
 * (In development, the bot runs inside Next.js via instrumentation.ts)
 */

import 'dotenv/config';
import { bot } from './bot/index';

async function main() {
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    throw new Error('TELEGRAM_BOT_TOKEN environment variable is required');
  }

  console.log('[bot:standalone] 🤖 Starting Telegram Bot (standalone)...');
  console.log('[bot:standalone] Note: For development, use "npm run dev" instead');

  try {
    await bot.start({
      onStart: (botInfo) => {
        console.log(`[bot:standalone] ✅ Running as @${botInfo.username}`);
        console.log('[bot:standalone] Listening for messages...');
      },
    });
  } catch (error) {
    console.error('[bot:standalone] ❌ Fatal error:', error);
    process.exit(1);
  }
}

main();
