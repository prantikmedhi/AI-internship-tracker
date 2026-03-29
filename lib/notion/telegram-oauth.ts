/**
 * Telegram-specific OAuth helpers
 * Generates OAuth URLs with Telegram user ID encoded
 */

import { generatePKCE, generateState, storePKCEVerifier, storeOAuthState } from '@/lib/auth';
import { buildAuthorizationURL } from './oauth';

/**
 * Generate OAuth URL for Telegram user
 * Returns a URL the user can click to authenticate
 */
export async function generateTelegramOAuthUrl(
  telegramUserId: number
): Promise<string> {
  try {
    const clientId = process.env.NOTION_CLIENT_ID;
    const redirectUri = process.env.TELEGRAM_BOT_OAUTH_CALLBACK;

    if (!clientId || !redirectUri) {
      throw new Error('OAuth credentials not configured');
    }

    // Generate PKCE
    const { codeVerifier, codeChallenge } = await generatePKCE();

    // Generate state with user_id embedded
    const state = generateState();
    const stateWithUserId = `${state}:${telegramUserId}`;

    // Store PKCE verifier and state
    await storePKCEVerifier(codeVerifier);
    await storeOAuthState(stateWithUserId); // Note: storing with user_id

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
  return `🔐 Click here to authenticate with Notion:\n\n${oauthUrl}\n\nAfter you authenticate, you'll be able to search for internships!`;
}
