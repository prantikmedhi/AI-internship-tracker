/**
 * Notion OAuth 2.0 PKCE flow helpers
 * Connects to https://mcp.notion.com/.well-known/oauth-authorization-server
 */

import { OAuthServerMetadata, TokenResponse } from '@/lib/types';

const MCP_WELL_KNOWN_URL = 'https://mcp.notion.com/.well-known/oauth-authorization-server';

let cachedMetadata: OAuthServerMetadata | undefined = undefined;

/**
 * Fetch OAuth server metadata from Notion's well-known endpoint
 */
export async function getOAuthServerMetadata(): Promise<OAuthServerMetadata> {
  if (cachedMetadata) {
    return cachedMetadata;
  }

  try {
    const response = await fetch(MCP_WELL_KNOWN_URL);
    if (!response.ok) {
      throw new Error(`Failed to fetch OAuth metadata: ${response.statusText}`);
    }

    const metadata = await response.json();
    cachedMetadata = metadata as OAuthServerMetadata;
    return metadata;
  } catch (error) {
    console.error('Failed to get OAuth server metadata:', error);
    throw error;
  }
}

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
  const metadata = await getOAuthServerMetadata();

  const authUrl = new URL(metadata.authorization_endpoint);
  authUrl.searchParams.append('client_id', clientId);
  authUrl.searchParams.append('redirect_uri', redirectUri);
  authUrl.searchParams.append('response_type', 'code');
  authUrl.searchParams.append('code_challenge', codeChallenge);
  authUrl.searchParams.append('code_challenge_method', 'S256');
  authUrl.searchParams.append('state', state);

  if (scope) {
    authUrl.searchParams.append('scope', scope);
  }

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
  const metadata = await getOAuthServerMetadata();

  try {
    const response = await fetch(metadata.token_endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
        code_verifier: codeVerifier,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Token exchange failed: ${error.error} - ${error.error_description}`);
    }

    return await response.json();
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
  const metadata = await getOAuthServerMetadata();

  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: clientId,
  });

  try {
    const response = await fetch(metadata.token_endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const error = await response.json();
      if (error.error === 'invalid_grant') {
        throw new Error('Refresh token expired or invalid. User must re-authenticate.');
      }
      throw new Error(`Token refresh failed: ${error.error} - ${error.error_description}`);
    }

    return await response.json();
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
