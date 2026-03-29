/**
 * OAuth callback route
 * GET /api/auth/callback?code=...&state=...
 * Exchanges code for access token, creates session, redirects to dashboard
 */

import { NextRequest, NextResponse } from 'next/server';
import { createSession, getPKCEVerifier, getOAuthState } from '@/lib/auth';
import { exchangeCodeForToken, getNotionUserInfo } from '@/lib/notion/oauth';

export async function GET(request: NextRequest) {
  try {
    // Extract code and state from URL
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');

    // Validate inputs
    if (!code) {
      return NextResponse.json(
        { error: 'Missing authorization code' },
        { status: 400 }
      );
    }

    // Verify state for CSRF protection
    const storedState = await getOAuthState();
    if (!state || state !== storedState) {
      return NextResponse.json(
        { error: 'State mismatch - CSRF token invalid' },
        { status: 400 }
      );
    }

    // Get PKCE verifier
    const codeVerifier = await getPKCEVerifier();
    if (!codeVerifier) {
      return NextResponse.json(
        { error: 'Missing PKCE verifier - session expired' },
        { status: 400 }
      );
    }

    // Get OAuth credentials from env
    const clientId = process.env.NOTION_CLIENT_ID;
    const clientSecret = process.env.NOTION_CLIENT_SECRET;
    const redirectUri = process.env.NOTION_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error('OAuth credentials not configured');
    }

    // Exchange code for access token
    const tokenResponse = await exchangeCodeForToken(
      code,
      codeVerifier,
      redirectUri,
      clientId,
      clientSecret
    );

    const { access_token } = tokenResponse;

    // Get user information
    const userInfo = await getNotionUserInfo(access_token);

    // Create session with access token
    await createSession({
      userId: userInfo.id,
      notionToken: access_token,
      email: userInfo.email || userInfo.id,
      workspace: userInfo.name || 'My Workspace',
    });

    // TODO: Consider storing refresh_token in a secure database for token rotation
    // For now, we rely on the 1-hour access token expiry

    // Redirect to dashboard
    return NextResponse.redirect(new URL('/dashboard', request.url));
  } catch (error) {
    console.error('OAuth callback error:', error);
    const message = error instanceof Error ? encodeURIComponent(error.message) : 'unknown_error';
    return NextResponse.redirect(new URL(`/?error=oauth_callback_failed&message=${message}`, request.url));
  }
}
