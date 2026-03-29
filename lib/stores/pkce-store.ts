/**
 * PKCE State Store
 * Server-side in-memory Map for storing PKCE verifiers keyed by state parameter.
 * Shared across Next.js routes and bot handlers in the same process.
 */

interface PKCEEntry {
  verifier: string;
  expiresAt: number; // unix ms
}

// Shared singleton — both OAuth routes and bot handlers import this
export const pkceStore = new Map<string, PKCEEntry>();

const TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Store a PKCE verifier keyed by state string
 */
export function storePKCEByState(state: string, verifier: string): void {
  pkceStore.set(state, {
    verifier,
    expiresAt: Date.now() + TTL_MS,
  });
}

/**
 * Retrieve and consume a PKCE verifier by state
 * Returns null if state not found or expired
 * Deletes the entry on successful retrieval (consume-once pattern)
 */
export function consumePKCEByState(state: string): string | null {
  const entry = pkceStore.get(state);
  if (!entry) return null;

  pkceStore.delete(state); // consume immediately

  if (Date.now() > entry.expiresAt) {
    return null; // expired
  }

  return entry.verifier;
}

/**
 * Passive TTL cleanup
 * Removes all expired entries from the store
 * Call periodically from instrumentation.ts
 */
export function sweepExpiredPKCE(): void {
  const now = Date.now();
  for (const [key, entry] of pkceStore) {
    if (now > entry.expiresAt) {
      pkceStore.delete(key);
    }
  }
}
