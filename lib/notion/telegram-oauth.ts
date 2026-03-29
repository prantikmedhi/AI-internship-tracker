/**
 * Telegram-specific OAuth helpers
 * Generates OAuth URLs with Telegram user ID encoded in the state parameter
 * Uses shared in-process PKCE store instead of cookies
 */

import { generatePKCE, generateState } from '@/lib/auth';
import { buildAuthorizationURL } from './oauth';
import { storePKCEByState } from '@/lib/stores/pkce-store';

/**
 * Generate OAuth URL for Telegram user
 * Embeds Telegram user ID in the state parameter as "${randomState}:${telegramUserId}"
 * Returns a URL the user can click to authenticate
 */
export async function generateTelegramOAuthUrl(telegramUserId: number): Promise<string> {
  try {
    const clientId = process.env.NOTION_CLIENT_ID;
    const redirectUri = process.env.TELEGRAM_BOT_OAUTH_CALLBACK;

    if (!clientId || !redirectUri) {
      throw new Error('NOTION_CLIENT_ID or TELEGRAM_BOT_OAUTH_CALLBACK not configured');
    }

    // Generate PKCE verifier and challenge
    const { codeVerifier, codeChallenge } = await generatePKCE();

    // Create state string with Telegram user ID embedded
    const randomPart = generateState();
    const stateWithUserId = `${randomPart}:${telegramUserId}`;

    // Store PKCE verifier in shared in-process Map (not cookies)
    storePKCEByState(stateWithUserId, codeVerifier);

    // Build authorization URL
    const authUrl = await buildAuthorizationURL(
      clientId,
      redirectUri,
      codeChallenge,
      stateWithUserId
    );

    return authUrl.toString();
  } catch (error) {
    console.error('Failed to generate Telegram OAuth URL:', error);
    throw error;
  }
}

/**
 * Format OAuth URL as Telegram-friendly message
 */
export function formatOAuthUrlForTelegram(oauthUrl: string): string {
  return (
    '🔐 Click here to connect your Notion workspace:\n\n' +
    oauthUrl +
    '\n\nAfter authorizing, return here to start searching!'
  );
}
