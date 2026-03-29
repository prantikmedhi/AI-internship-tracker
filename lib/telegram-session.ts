/**
 * Telegram User Session Store
 * Stores Notion OAuth tokens for Telegram users
 *
 * For MVP: Local JSON file store (preserves session across restarts and processes)
 * For production: Use Redis or database
 */

import fs from 'fs';
import path from 'path';
import { TelegramSession } from './types';

const STORE_PATH = path.join(process.cwd(), '.telegram-sessions.json');

/**
 * Helper to read the store from file
 */
function getStore(): Record<string, TelegramSession> {
  try {
    if (fs.existsSync(STORE_PATH)) {
      const data = fs.readFileSync(STORE_PATH, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Failed to read Telegram session store', err);
  }
  return {};
}

/**
 * Helper to write the store to file
 */
function saveStore(store: Record<string, TelegramSession>): void {
  try {
    fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to write Telegram session store', err);
  }
}

/**
 * Store session for a Telegram user
 */
export function storeTelegramSession(userId: number, session: TelegramSession): void {
  const store = getStore();
  store[userId.toString()] = session;
  saveStore(store);
  console.log(`✅ Session stored in file for Telegram user ${userId}`);
}

/**
 * Get session for a Telegram user
 */
export function getTelegramSession(userId: number): TelegramSession | null {
  const store = getStore();
  return store[userId.toString()] || null;
}

/**
 * Clear session for a Telegram user
 */
export function clearTelegramSession(userId: number): void {
  const store = getStore();
  if (store[userId.toString()]) {
    delete store[userId.toString()];
    saveStore(store);
    console.log(`🗑️ Session cleared from file for Telegram user ${userId}`);
  }
}

/**
 * Check if user is authenticated
 */
export function isTelegramUserAuthenticated(userId: number): boolean {
  const session = getTelegramSession(userId);
  if (!session) return false;

  // Check if token is still valid (not expired)
  if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
    clearTelegramSession(userId);
    return false;
  }

  return true;
}
