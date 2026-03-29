/**
 * Session management and OAuth PKCE helpers
 */

import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';
import { NotionSession } from './types';

const secret = new TextEncoder().encode(
  process.env.SESSION_SECRET || 'default-secret-min-32-characters-long'
);

/**
 * Create a session JWT and store in HTTP-only cookie
 */
export async function createSession(data: Omit<NotionSession, 'expiresAt'>): Promise<string> {
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const token = await new SignJWT({ ...data, expiresAt: expiresAt.toISOString() })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(Date.now() + 24 * 60 * 60 * 1000)
    .sign(secret);

  const cookieStore = await cookies();
  cookieStore.set('session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60,
    path: '/',
  });

  return token;
}

/**
 * Get session from JWT cookie
 */
export async function getSession(request?: NextRequest): Promise<NotionSession | null> {
  try {
    const cookieStore = await cookies();
    const token = request
      ? request.cookies.get('session')?.value
      : cookieStore.get('session')?.value;

    if (!token) return null;

    const verified = await jwtVerify(token, secret);
    const session = verified.payload as unknown as NotionSession;

    if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
      return null;
    }

    return session;
  } catch (error) {
    console.error('Session verification failed:', error);
    return null;
  }
}

/**
 * Clear session cookie
 */
export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete('session');
}

/**
 * Generate PKCE code verifier and challenge
 */
export async function generatePKCE(): Promise<{ codeVerifier: string; codeChallenge: string }> {
  // Generate random 96-character base64url string
  const array = new Uint8Array(72);
  crypto.getRandomValues(array);
  const codeVerifier = btoa(String.fromCharCode.apply(null, array as any))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  // Generate code challenge using SHA256
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const digest = await crypto.subtle.digest('SHA-256', data);

  const codeChallenge = btoa(String.fromCharCode.apply(null, new Uint8Array(digest) as any))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  return { codeVerifier, codeChallenge };
}

/**
 * Generate a random state nonce for CSRF protection
 */
export function generateState(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Store PKCE verifier in a secure cookie (10-minute expiry)
 */
export async function storePKCEVerifier(codeVerifier: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set('pkce_verifier', codeVerifier, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 10 * 60, // 10 minutes
    path: '/',
  });
}

/**
 * Retrieve PKCE verifier from cookie
 */
export async function getPKCEVerifier(): Promise<string | null> {
  const cookieStore = await cookies();
  const verifier = cookieStore.get('pkce_verifier')?.value;
  if (verifier) {
    cookieStore.delete('pkce_verifier');
  }
  return verifier || null;
}

/**
 * Store OAuth state in cookie for CSRF verification
 */
export async function storeOAuthState(state: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set('oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 10 * 60, // 10 minutes
    path: '/',
  });
}

/**
 * Retrieve and verify OAuth state from cookie
 */
export async function getOAuthState(): Promise<string | null> {
  const cookieStore = await cookies();
  const state = cookieStore.get('oauth_state')?.value;
  if (state) {
    cookieStore.delete('oauth_state');
  }
  return state || null;
}
