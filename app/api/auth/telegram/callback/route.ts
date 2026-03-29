/**
 * Telegram OAuth Callback Route
 * GET /api/auth/telegram/callback?code=...&state=...&user_id=...
 * Handles OAuth callback for Telegram bot users
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPKCEVerifier, getOAuthState } from '@/lib/auth';
import { exchangeCodeForToken, getNotionUserInfo } from '@/lib/notion/oauth';
import { storeTelegramSession } from '@/lib/telegram-session';

export async function GET(request: NextRequest) {
  try {
    // Extract parameters from URL
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const userId = searchParams.get('user_id');

    // Validate inputs
    if (!code) {
      return NextResponse.json(
        { error: 'Missing authorization code' },
        { status: 400 }
      );
    }

    if (!userId || isNaN(parseInt(userId))) {
      return NextResponse.json(
        { error: 'Missing or invalid user_id' },
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
    const redirectUri = process.env.TELEGRAM_BOT_OAUTH_CALLBACK;

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

    // Get user information from Notion
    const userInfo = await getNotionUserInfo(access_token);

    // Store session for Telegram user
    const telegramUserId = parseInt(userId);
    storeTelegramSession(telegramUserId, {
      notionToken: access_token,
      email: userInfo.email,
      workspace: userInfo.name,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      lastResults: [],
      lastQuery: '',
      lastLocation: '',
    });

    // Return success page with instructions
    return NextResponse.json({
      success: true,
      message: '✅ Authentication successful! You can now use the bot.',
      instructions:
        'Go back to Telegram and use /search to find internships',
      userId: telegramUserId,
      workspace: userInfo.name,
    });
  } catch (error) {
    console.error('Telegram OAuth callback error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        success: false,
        error: 'Authentication failed',
        details: message,
      },
      { status: 500 }
    );
  }
}
