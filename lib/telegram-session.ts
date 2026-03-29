/**
 * Telegram User Session Store
 * Stores Notion OAuth tokens for Telegram users
 *
 * For MVP: In-memory store (cleared on restart)
 * For production: Use Redis or database
 */

import { TelegramSession } from './types';

// In-memory session store (user_id → session)
const telegramSessions = new Map<number, TelegramSession>();

/**
 * Store session for a Telegram user
 */
export function storeTelegramSession(userId: number, session: TelegramSession): void {
  telegramSessions.set(userId, session);
  console.log(`✅ Session stored for Telegram user ${userId}`);
}

/**
 * Get session for a Telegram user
 */
export function getTelegramSession(userId: number): TelegramSession | null {
  return telegramSessions.get(userId) || null;
}

/**
 * Clear session for a Telegram user
 */
export function clearTelegramSession(userId: number): void {
  telegramSessions.delete(userId);
  console.log(`🗑️ Session cleared for Telegram user ${userId}`);
}

/**
 * Check if user is authenticated
 */
export function isTelegramUserAuthenticated(userId: number): boolean {
  const session = telegramSessions.get(userId);
  if (!session) return false;

  // Check if token is still valid (not expired)
  if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
    clearTelegramSession(userId);
    return false;
  }

  return true;
}
