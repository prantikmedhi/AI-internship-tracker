/**
 * PKCE State Store
 * Server-side local JSON file for storing PKCE verifiers keyed by state parameter.
 * Shared across Next.js routes and bot handlers running in different processes.
 */

import fs from 'fs';
import path from 'path';

interface PKCEEntry {
  verifier: string;
  expiresAt: number; // unix ms
}

const STORE_PATH = path.join(process.cwd(), '.pkce-store.json');
const TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Helper to read the store from file
 */
function getStore(): Record<string, PKCEEntry> {
  try {
    if (fs.existsSync(STORE_PATH)) {
      const data = fs.readFileSync(STORE_PATH, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Failed to read PKCE store', err);
  }
  return {};
}

/**
 * Helper to write the store to file
 */
function saveStore(store: Record<string, PKCEEntry>): void {
  try {
    fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to write PKCE store', err);
  }
}

/**
 * Store a PKCE verifier keyed by state string
 */
export function storePKCEByState(state: string, verifier: string): void {
  const store = getStore();
  store[state] = {
    verifier,
    expiresAt: Date.now() + TTL_MS,
  };
  saveStore(store);
}

/**
 * Retrieve and consume a PKCE verifier by state
 * Returns null if state not found or expired
 * Deletes the entry on successful retrieval (consume-once pattern)
 */
export function consumePKCEByState(state: string): string | null {
  const store = getStore();
  const entry = store[state];
  
  if (!entry) return null;

  delete store[state];
  saveStore(store); // consume immediately

  if (Date.now() > entry.expiresAt) {
    return null; // expired
  }

  return entry.verifier;
}

/**
 * Passive TTL cleanup
 * Removes all expired entries from the store
 */
export function sweepExpiredPKCE(): void {
  const store = getStore();
  const now = Date.now();
  let changed = false;

  for (const key of Object.keys(store)) {
    if (now > store[key].expiresAt) {
      delete store[key];
      changed = true;
    }
  }

  if (changed) {
    saveStore(store);
  }
}
