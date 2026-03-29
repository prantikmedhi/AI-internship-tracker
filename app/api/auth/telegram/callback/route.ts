/**
 * Telegram OAuth Callback Route
 * GET /api/auth/telegram/callback?code=...&state=...
 * Handles OAuth callback for Telegram bot users
 *
 * State parameter format: "${randomPart}:${telegramUserId}"
 * (Telegram user ID is parsed from the state string, not sent as a separate query param)
 */

import { NextRequest, NextResponse } from 'next/server';
import { consumePKCEByState } from '@/lib/stores/pkce-store';
import { exchangeCodeForToken, getNotionUserInfo } from '@/lib/notion/oauth';
import { storeTelegramSession, getTelegramSession } from '@/lib/telegram-session';
import { createMCPClient } from '@/lib/mcp/client';
import { searchWorkspace } from '@/lib/mcp/tools';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');

    // Validate code and state parameters
    if (!code || !state) {
      return NextResponse.json(
        { error: 'Missing code or state parameter' },
        { status: 400 }
      );
    }

    // Extract Telegram user ID from state string
    // Format: "${randomPart}:${telegramUserId}"
    // Use lastIndexOf to handle any colons in the random part
    const lastColonIdx = state.lastIndexOf(':');
    if (lastColonIdx === -1) {
      return NextResponse.json(
        { error: 'Malformed state parameter — missing user_id separator' },
        { status: 400 }
      );
    }

    const userIdStr = state.slice(lastColonIdx + 1);
    const telegramUserId = parseInt(userIdStr, 10);
    if (isNaN(telegramUserId)) {
      return NextResponse.json(
        { error: 'Invalid user_id in state parameter' },
        { status: 400 }
      );
    }

    // Retrieve PKCE verifier from shared store
    // Returns null if state not found or expired
    const codeVerifier = consumePKCEByState(state);
    if (!codeVerifier) {
      return NextResponse.json(
        {
          error: 'State not found or expired — please restart OAuth from the bot',
        },
        { status: 400 }
      );
    }

    // Get OAuth credentials from environment
    const clientId = process.env.NOTION_CLIENT_ID;
    const clientSecret = process.env.NOTION_CLIENT_SECRET;
    const redirectUri = process.env.TELEGRAM_BOT_OAUTH_CALLBACK;

    if (!clientId || !clientSecret || !redirectUri) {
      console.error('OAuth credentials not configured in environment');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    // Exchange authorization code for access token
    const tokenResponse = await exchangeCodeForToken(
      code,
      codeVerifier,
      redirectUri,
      clientId,
      clientSecret
    );

    // Get Notion user information
    const userInfo = await getNotionUserInfo(tokenResponse.access_token);

    // Store session in shared in-process Map
    // Now both the bot process and API routes can access this
    storeTelegramSession(telegramUserId, {
      notionToken: tokenResponse.access_token,
      email: userInfo.email,
      workspace: userInfo.name,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour TTL
      lastResults: [],
      lastQuery: '',
      lastLocation: '',
    });
    
    // Asynchronous Auto-Tracker Setup
    // Send immediate response to browser, handle setup in background
    Promise.resolve().then(async () => {
      try {
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        const sendTgMsg = async (text: string) => {
          if (!botToken) return;
          await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: telegramUserId, text })
          }).catch(console.error);
        };

        await sendTgMsg('⚙️ Login successful! Auto-discovering Notion Workspace to build your Internship Tracker...');
        
        const client = createMCPClient(tokenResponse.access_token);
        const results = await searchWorkspace(client, '', 'last_edited_time');
        
        const candidate = results.find(r => r.id);
        if (!candidate || !candidate.id) {
          await sendTgMsg('❌ Could not auto-discover any Pages. Please make sure you shared a Page with your Integration, then use /setup_tracker <URL>.');
          return;
        }

        const pageId = candidate.id;
        await sendTgMsg(`🎯 Found parent page: "${candidate.title || 'Untitled'}". Generating database...`);

        const schema = {
          "Role": { "title": {} },
          "Company": { "rich_text": {} },
          "Location": { "rich_text": {} },
          "URL": { "url": {} },
          "Source": {
            "select": {
              "options": [
                { "name": "LinkedIn", "color": "blue" },
                { "name": "Internshala", "color": "purple" },
                { "name": "RemoteOK", "color": "gray" },
                { "name": "Other", "color": "default" }
              ]
            }
          },
          "Status": {
            "select": {
              "options": [
                { "name": "Discovered", "color": "yellow" },
                { "name": "Applied", "color": "blue" },
                { "name": "Interviewing", "color": "orange" },
                { "name": "Rejected", "color": "red" },
                { "name": "Offer", "color": "green" }
              ]
            }
          },
          "Date Added": { "date": {} },
          "Applied": { "checkbox": {} }
        };

        const result = await client.callTool<{ id: string }>('notion-create-database', {
          parent: { page_id: pageId },
          title: [{ type: 'text', text: { content: "Internship Tracker" } }],
          properties: schema,
        });

        if (result && result.id) {
          const updatedSession = getTelegramSession(telegramUserId);
          if (updatedSession) {
            updatedSession.trackerDatabaseId = result.id;
            storeTelegramSession(telegramUserId, updatedSession);
          }
          await sendTgMsg('✅ Database created! You can now send /search <keyword> to automatically fill it!');
        }
      } catch (err) {
        console.error('Auto-setup error:', err);
      }
    });

    // Return HTML page the user sees in their browser
    return new NextResponse(
      `<!DOCTYPE html>
<html>
<head>
  <title>Connected!</title>
  <style>
    body { font-family: sans-serif; text-align: center; padding: 40px; }
    h2 { color: #2ecc71; }
  </style>
</head>
<body>
  <h2>✅ Connected to Notion!</h2>
  <p>Return to Telegram and send:</p>
  <p><strong>/search python</strong> to find internships</p>
  <p><strong>/profile</strong> to see your profile</p>
  <p><strong>/logout</strong> to disconnect</p>
</body>
</html>`,
      { status: 200, headers: { 'Content-Type': 'text/html' } }
    );
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
