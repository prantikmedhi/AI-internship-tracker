/**
 * Next.js Server Instrumentation
 * Runs once when Next.js server starts to initialize the Grammy bot
 * The bot runs inside the same Node.js process as the HTTP server,
 * so all in-memory Maps are shared between bot handlers and API routes
 */

export async function register() {
  // Only run in Node.js runtime (not Edge runtime)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    if (!process.env.TELEGRAM_BOT_TOKEN) {
      console.warn(
        '[instrumentation] TELEGRAM_BOT_TOKEN not configured — bot will not start'
      );
      return;
    }

    try {
      // Lazy import to avoid bundling issues and allow hot reload
      const { bot } = await import('./bot/index');
      const { sweepExpiredPKCE } = await import('./lib/stores/pkce-store');

      // Start PKCE cleanup interval (runs every 5 minutes)
      setInterval(() => {
        sweepExpiredPKCE();
      }, 5 * 60 * 1000);

      // Start the Grammy bot in long-polling mode
      // bot.start() returns a promise that never resolves (runs forever)
      // We do NOT await it — it runs in the background and does not block Next.js startup
      bot
        .start({
          onStart: (botInfo) => {
            console.log(`[bot] ✅ Started as @${botInfo.username}`);
            console.log('[bot] Listening for Telegram messages...');
          },
        })
        .catch((err) => {
          console.error('[bot] Fatal error — bot stopped:', err);
          // Bot crashed but Next.js continues serving HTTP routes
        });

      console.log('[instrumentation] Grammy bot initialized in same process as Next.js');
    } catch (error) {
      console.error('[instrumentation] Failed to start bot:', error);
      // Non-fatal — Next.js will continue even if bot startup fails
    }
  }
}
