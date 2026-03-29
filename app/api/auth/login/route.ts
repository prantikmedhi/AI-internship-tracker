/**
 * OAuth login initiation route
 * GET /api/auth/login
 * Generates PKCE, stores in secure cookies, redirects to Notion OAuth
 */

import { redirect } from 'next/navigation';
import { generatePKCE, generateState, storePKCEVerifier, storeOAuthState } from '@/lib/auth';
import { buildAuthorizationURL } from '@/lib/notion/oauth';

export async function GET() {
  try {
    // Get client ID and secret from env
    const clientId = process.env.NOTION_CLIENT_ID;
    const redirectUri = process.env.NOTION_REDIRECT_URI;

    if (!clientId || !redirectUri) {
      throw new Error('NOTION_CLIENT_ID or NOTION_REDIRECT_URI not configured');
    }

    // Generate PKCE
    const { codeVerifier, codeChallenge } = await generatePKCE();

    // Generate state for CSRF protection
    const state = generateState();

    // Store PKCE verifier and state in secure cookies
    await storePKCEVerifier(codeVerifier);
    await storeOAuthState(state);

    // Build authorization URL
    const authUrl = await buildAuthorizationURL(
      clientId,
      redirectUri,
      codeChallenge,
      state,
      // Optional: add specific scopes if needed
      undefined
    );

    // Redirect to Notion OAuth
    redirect(authUrl.toString());
  } catch (error) {
    console.error('OAuth login error:', error);
    redirect('/?error=oauth_failed');
  }
}
