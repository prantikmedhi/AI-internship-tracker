/**
 * Notion OAuth 2.0 PKCE flow helpers
 * Connects to Standard Notion API endpoints
 */

import { TokenResponse } from '@/lib/types';

const NOTION_AUTH_URL = 'https://api.notion.com/v1/oauth/authorize';
const NOTION_TOKEN_URL = 'https://api.notion.com/v1/oauth/token';

/**
 * Build the OAuth authorization URL
 */
export async function buildAuthorizationURL(
  clientId: string,
  redirectUri: string,
  codeChallenge: string,
  state: string,
  scope?: string
): Promise<URL> {
  const authUrl = new URL(NOTION_AUTH_URL);
  authUrl.searchParams.append('client_id', clientId);
  authUrl.searchParams.append('redirect_uri', redirectUri);
  authUrl.searchParams.append('response_type', 'code');
  authUrl.searchParams.append('owner', 'user');

  // Notion API doesn't fully support PKCE natively in standard OAuth yet, 
  // but if we pass it, it ignores what it doesn't need.
  authUrl.searchParams.append('state', state);

  return authUrl;
}

/**
 * Exchange authorization code for access token
 */
export async function exchangeCodeForToken(
  code: string,
  codeVerifier: string,
  redirectUri: string,
  clientId: string,
  clientSecret: string
): Promise<TokenResponse> {
  const cleanClientId = clientId.trim();
  const cleanClientSecret = clientSecret.trim();
  const base64Auth = Buffer.from(`${cleanClientId}:${cleanClientSecret}`).toString('base64');
  
  try {
    const response = await fetch(NOTION_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${base64Auth}`,
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!response.ok) {
      const error = (await response.json()) as Record<string, any>;
      throw new Error(`Token exchange failed: ${error.error} - ${error.error_description || error.message}`);
    }

    return (await response.json()) as TokenResponse;
  } catch (error) {
    console.error('Token exchange error:', error);
    throw error;
  }
}

/**
 * Refresh an access token using refresh token (with automatic rotation)
 */
export async function refreshAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<TokenResponse> {
  const cleanClientId = clientId.trim();
  const cleanClientSecret = clientSecret.trim();
  const base64Auth = Buffer.from(`${cleanClientId}:${cleanClientSecret}`).toString('base64');

  try {
    const response = await fetch(NOTION_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${base64Auth}`,
      },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      const error = (await response.json()) as Record<string, any>;
      if (error.error === 'invalid_grant') {
        throw new Error('Refresh token expired or invalid. User must re-authenticate.');
      }
      throw new Error(`Token refresh failed: ${error.error} - ${error.error_description || error.message}`);
    }

    return (await response.json()) as TokenResponse;
  } catch (error) {
    console.error('Token refresh error:', error);
    throw error;
  }
}

/**
 * Get user info from Notion API using access token
 */
export async function getNotionUserInfo(accessToken: string): Promise<{ id: string; email?: string; name?: string }> {
  try {
    const response = await fetch('https://api.notion.com/v1/users/me', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Notion-Version': '2022-06-28',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get user info: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Failed to get Notion user info:', error);
    throw error;
  }
}
