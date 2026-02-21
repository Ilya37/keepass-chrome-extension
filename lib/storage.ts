import { STORAGE_KEY_DB, STORAGE_KEY_META } from './constants';
import type { DatabaseMeta } from './types';
import * as persistentStorage from './persistent-storage';
import type { StorageHealthReport, EncryptedUnlockToken, OperationId } from './storage-types';

/**
 * Storage helpers for saving/loading the encrypted .kdbx blob
 * and associated metadata.
 *
 * - chrome.storage.local: persistent across browser restarts (encrypted kdbx blob + meta)
 * - chrome.storage.session: persists across service worker restarts but cleared on browser quit
 *   (used to keep the master password so the DB can auto-unlock after SW restart)
 */

const SESSION_KEY_PASSWORD = 'session_password';

// ── Base64 helpers (efficient ArrayBuffer <-> string) ──────────

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// ── Persistent storage (chrome.storage.local) ──────────────────

/** Save the encrypted database blob */
export async function saveDatabaseBlob(data: ArrayBuffer): Promise<void> {
  const base64 = arrayBufferToBase64(data);
  await browser.storage.local.set({ [STORAGE_KEY_DB]: base64 });

  // Verify the write succeeded
  const check = await browser.storage.local.get(STORAGE_KEY_DB);
  if (!check[STORAGE_KEY_DB]) {
    throw new Error('Failed to persist database to storage');
  }
  console.log(`Database saved: ${base64.length} chars (base64)`);
}

/** Load the encrypted database blob */
export async function loadDatabaseBlob(): Promise<ArrayBuffer | null> {
  const result = await browser.storage.local.get(STORAGE_KEY_DB);
  const base64 = result[STORAGE_KEY_DB] as string | undefined;
  if (!base64 || typeof base64 !== 'string') return null;
  return base64ToArrayBuffer(base64);
}

/** Check if a database exists in storage */
export async function hasDatabaseInStorage(): Promise<boolean> {
  const result = await browser.storage.local.get(STORAGE_KEY_DB);
  return !!result[STORAGE_KEY_DB];
}

/** Save database metadata */
export async function saveDatabaseMeta(meta: DatabaseMeta): Promise<void> {
  await browser.storage.local.set({ [STORAGE_KEY_META]: meta });
}

/** Load database metadata */
export async function loadDatabaseMeta(): Promise<DatabaseMeta | null> {
  const result = await browser.storage.local.get(STORAGE_KEY_META);
  return (result[STORAGE_KEY_META] as DatabaseMeta) ?? null;
}

/** Remove database from storage completely */
export async function removeDatabaseFromStorage(): Promise<void> {
  await browser.storage.local.remove([STORAGE_KEY_DB, STORAGE_KEY_META]);
  await clearSessionPassword();
}

// ── Session storage (survives SW restarts, cleared on browser quit) ──

/** Save master password to session storage for auto-unlock after SW restart */
export async function saveSessionPassword(password: string): Promise<void> {
  try {
    await browser.storage.session.set({ [SESSION_KEY_PASSWORD]: password });
  } catch (err) {
    // session storage might not be available in all contexts
    console.warn('Could not save session password:', err);
  }
}

/** Load master password from session storage */
export async function loadSessionPassword(): Promise<string | null> {
  try {
    const result = await browser.storage.session.get(SESSION_KEY_PASSWORD);
    return (result[SESSION_KEY_PASSWORD] as string) ?? null;
  } catch {
    return null;
  }
}

/** Clear master password from session storage */
export async function clearSessionPassword(): Promise<void> {
  try {
    await browser.storage.session.remove(SESSION_KEY_PASSWORD);
  } catch {
    // ignore
  }
}

// ── New Storage System (Dual Storage + Recovery) ──────────────────

const SESSION_KEY_UNLOCK_TOKEN = 'encrypted_unlock_token';

/** Initialize all storage systems (local, session, IndexedDB) */
export async function initializeAllStorageSystems(): Promise<void> {
  const result = await persistentStorage.initializeAllStorage();
  if (!result.success) {
    console.warn('[storage] Storage initialization had warnings:', result.warnings);
  } else {
    console.log('[storage] All storage systems initialized successfully');
  }
}

/**
 * Save encrypted unlock token for auto-unlock after SW restart.
 * This is preferable to storing the plaintext master password.
 * Token is stored in session storage (cleared on browser quit).
 */
export async function saveEncryptedUnlockToken(
  token: string,
  ttlSeconds: number = 3600,
): Promise<void> {
  const expiresAt = Date.now() + ttlSeconds * 1000;
  const tokenData: EncryptedUnlockToken = {
    token,
    expiresAt,
    createdAt: Date.now(),
  };

  try {
    await browser.storage.session.set({
      [SESSION_KEY_UNLOCK_TOKEN]: JSON.stringify(tokenData),
    });
    console.log(`[storage] Encrypted unlock token saved (expires in ${ttlSeconds}s)`);
  } catch (err) {
    console.warn('[storage] Could not save encrypted unlock token:', err);
  }
}

/**
 * Load encrypted unlock token from session storage.
 * Returns null if token is missing or expired.
 */
export async function loadEncryptedUnlockToken(): Promise<EncryptedUnlockToken | null> {
  try {
    const result = await browser.storage.session.get(SESSION_KEY_UNLOCK_TOKEN);
    const tokenStr = result[SESSION_KEY_UNLOCK_TOKEN] as string | undefined;

    if (!tokenStr) return null;

    const tokenData = JSON.parse(tokenStr) as EncryptedUnlockToken;

    // Check if expired
    if (Date.now() > tokenData.expiresAt) {
      await clearEncryptedUnlockToken();
      return null;
    }

    return tokenData;
  } catch (err) {
    console.warn('[storage] Could not load encrypted unlock token:', err);
    return null;
  }
}

/**
 * Clear encrypted unlock token from session storage.
 */
export async function clearEncryptedUnlockToken(): Promise<void> {
  try {
    await browser.storage.session.remove(SESSION_KEY_UNLOCK_TOKEN);
  } catch {
    // ignore
  }
}

/**
 * Get health report for all storage systems.
 * Useful for debugging storage issues.
 */
export async function getStorageHealthReport(): Promise<StorageHealthReport> {
  return persistentStorage.getStorageHealthReport();
}

/**
 * Calculate checksum for a database blob.
 * Useful for integrity verification.
 */
export async function calculateDatabaseChecksum(blob: ArrayBuffer): Promise<string> {
  return persistentStorage.calculateChecksum(blob);
}

/**
 * Execute a storage operation atomically with operation tracking.
 * Wraps an operation so it can be logged and recovered on crash.
 */
export async function executeAtomicallyWithJournal<T>(
  operation: () => Promise<T>,
  operationType: string,
): Promise<T> {
  // Note: Full atomic operation support requires state-journal module
  // For now, this is a placeholder for future integration
  try {
    return await operation();
  } catch (err) {
    console.error(`[storage] Atomic operation '${operationType}' failed:`, err);
    throw err;
  }
}
