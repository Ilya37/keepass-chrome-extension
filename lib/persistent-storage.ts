/**
 * Dual-storage system for persistent database management.
 * Provides abstraction over IndexedDB + chrome.storage.local with:
 * - Fallback chain (primary → backup)
 * - Version history (last 5 versions)
 * - Integrity checksums (SHA-256)
 * - Automatic sync and recovery
 */

import { STORAGE_KEY_DB, STORAGE_KEY_META } from './constants';
import type { DatabaseMeta } from './types';
import type {
  StorageSyncResult,
  IntegrityCheckResult,
  StorageHealthReport,
  DatabaseLoadResult,
  StorageInitResult,
  IDBDatabase,
  IDBDatabaseVersion,
  IDBSyncStatus,
  ChecksumAlgorithm,
} from './storage-types';

// ── IndexedDB Constants ──────────────────────────────────────────

const DB_NAME = 'keepass-extension-v1';
const STORE_DATABASES = 'databases';
const STORE_VERSIONS = 'database_versions';
const STORE_BACKUPS = 'backup_snapshots';
const STORE_RECOVERY = 'recovery_codes';
const STORE_JOURNAL = 'state_journal';
const STORE_INCOMPLETE = 'incomplete_operations';
const STORE_SYNC_STATUS = 'sync_status';

// ── Global State ─────────────────────────────────────────────────

let idbInstance: IDBDatabase | null = null;
let initPromise: Promise<StorageInitResult> | null = null;

// ── IndexedDB Initialization ─────────────────────────────────────

export async function initializeAllStorage(): Promise<StorageInitResult> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const result: StorageInitResult = {
      success: false,
      warnings: [],
      localAvailable: false,
      indexedDbAvailable: false,
      timestamp: Date.now(),
    };

    try {
      // Check chrome.storage.local availability
      try {
        await browser.storage.local.get(STORAGE_KEY_DB);
        result.localAvailable = true;
      } catch (err) {
        result.warnings.push('chrome.storage.local not available: ' + String(err));
      }

      // Initialize IndexedDB
      try {
        await initializeIndexedDB();
        result.indexedDbAvailable = true;
      } catch (err) {
        result.warnings.push('IndexedDB initialization failed: ' + String(err));
      }

      // Sync existing data from local to IndexedDB if needed
      if (result.localAvailable && result.indexedDbAvailable) {
        await syncFromLocalToIndexedDB();
      }

      result.success = result.localAvailable || result.indexedDbAvailable;
      console.log('[persistent-storage] Initialized:', result);
      return result;
    } catch (err) {
      result.warnings.push('Storage initialization error: ' + String(err));
      return result;
    }
  })();

  return initPromise;
}

async function initializeIndexedDB(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      idbInstance = request.result;
      resolve();
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Store: databases (current and versions)
      if (!db.objectStoreNames.contains(STORE_DATABASES)) {
        const store = db.createObjectStore(STORE_DATABASES, { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('version', 'version', { unique: false });
      }

      // Store: database_versions (history)
      if (!db.objectStoreNames.contains(STORE_VERSIONS)) {
        const store = db.createObjectStore(STORE_VERSIONS, { keyPath: 'version' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('reason', 'reason', { unique: false });
      }

      // Store: backup_snapshots
      if (!db.objectStoreNames.contains(STORE_BACKUPS)) {
        const store = db.createObjectStore(STORE_BACKUPS, { keyPath: 'timestamp' });
        store.createIndex('reason', 'reason', { unique: false });
        store.createIndex('version', 'version', { unique: false });
      }

      // Store: recovery_codes
      if (!db.objectStoreNames.contains(STORE_RECOVERY)) {
        db.createObjectStore(STORE_RECOVERY, { keyPath: 'id' });
      }

      // Store: state_journal (operation log)
      if (!db.objectStoreNames.contains(STORE_JOURNAL)) {
        const store = db.createObjectStore(STORE_JOURNAL, { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('operation', 'operation', { unique: false });
      }

      // Store: incomplete_operations
      if (!db.objectStoreNames.contains(STORE_INCOMPLETE)) {
        db.createObjectStore(STORE_INCOMPLETE, { keyPath: 'operationId' });
      }

      // Store: sync_status (metadata)
      if (!db.objectStoreNames.contains(STORE_SYNC_STATUS)) {
        db.createObjectStore(STORE_SYNC_STATUS, { keyPath: 'key' });
      }
    };
  });
}

// ── Database Persistence ────────────────────────────────────────

export async function persistDatabase(
  blob: ArrayBuffer,
  metadata: DatabaseMeta,
  reason: 'edit' | 'import' | 'recovery',
): Promise<StorageSyncResult> {
  const result: StorageSyncResult = {
    success: false,
    primaryStored: false,
    backupStored: false,
    checksumMatch: false,
    warnings: [],
    syncTime: Date.now(),
  };

  try {
    const checksum = await calculateChecksum(blob);
    const timestamp = Date.now();

    // Get current version from IndexedDB
    const current = await getFromIndexedDB<IDBDatabase>(STORE_DATABASES, 'db:current');
    const newVersion = (current?.version ?? 0) + 1;

    // 1. Save to IndexedDB (backup)
    if (idbInstance) {
      try {
        await putToIndexedDB<IDBDatabase>(STORE_DATABASES, {
          id: 'db:current',
          blob,
          checksum,
          timestamp,
          version: newVersion,
          metadata: { ...metadata, lastModified: new Date().toISOString() },
          source: reason,
        });

        await putToIndexedDB<IDBDatabaseVersion>(STORE_VERSIONS, {
          version: newVersion,
          blob,
          checksum,
          timestamp,
          metadata,
          reason: 'current',
        });

        result.backupStored = true;
      } catch (err) {
        result.warnings.push('IndexedDB save failed: ' + String(err));
      }
    }

    // 2. Save to chrome.storage.local (primary)
    try {
      const base64 = arrayBufferToBase64(blob);
      await browser.storage.local.set({
        [STORAGE_KEY_DB]: base64,
        [STORAGE_KEY_META]: metadata,
      });

      // Verify write
      const verify = await browser.storage.local.get(STORAGE_KEY_DB);
      if (verify[STORAGE_KEY_DB]) {
        result.primaryStored = true;
        const verifyChecksum = await calculateChecksum(
          base64ToArrayBuffer(verify[STORAGE_KEY_DB])
        );
        result.checksumMatch = verifyChecksum === checksum;
      }

      if (!result.checksumMatch) {
        result.warnings.push('Checksum mismatch after chrome.storage.local write');
      }
    } catch (err) {
      result.warnings.push('chrome.storage.local save failed: ' + String(err));
    }

    // 3. Update sync status
    if (idbInstance) {
      try {
        await putToIndexedDB<IDBSyncStatus>(STORE_SYNC_STATUS, {
          key: 'sync:status',
          lastSyncTime: timestamp,
          lastChecksum: checksum,
          primaryStorage: 'local',
          backupStorage: 'indexed-db',
          integrityStatus: result.checksumMatch ? 'healthy' : 'degraded',
        });
      } catch (err) {
        result.warnings.push('Sync status update failed: ' + String(err));
      }
    }

    // 4. Cleanup old versions
    try {
      await pruneOldVersions(5);
    } catch (err) {
      result.warnings.push('Version pruning failed: ' + String(err));
    }

    result.success = result.primaryStored && result.backupStored;
  } catch (error) {
    result.error = String(error);
    result.warnings.push('Persist database error: ' + error);
  }

  return result;
}

// ── Database Loading ─────────────────────────────────────────────

export async function loadDatabase(): Promise<DatabaseLoadResult | null> {
  // Try local storage first
  try {
    const result = await browser.storage.local.get(STORAGE_KEY_DB);
    const base64 = result[STORAGE_KEY_DB] as string | undefined;
    const meta = result[STORAGE_KEY_META] as DatabaseMeta | undefined;

    if (base64 && meta) {
      const blob = base64ToArrayBuffer(base64);
      const checksum = await calculateChecksum(blob);
      const current = await getFromIndexedDB<IDBDatabase>(STORE_DATABASES, 'db:current');

      return {
        blob,
        metadata: meta,
        source: 'local',
        version: current?.version ?? 1,
        checksum,
      };
    }
  } catch (err) {
    console.warn('[persistent-storage] chrome.storage.local load failed:', err);
  }

  // Fallback to IndexedDB
  try {
    if (idbInstance) {
      const current = await getFromIndexedDB<IDBDatabase>(STORE_DATABASES, 'db:current');
      if (current) {
        return {
          blob: current.blob,
          metadata: current.metadata,
          source: 'indexed-db',
          version: current.version,
          checksum: current.checksum,
        };
      }
    }
  } catch (err) {
    console.warn('[persistent-storage] IndexedDB load failed:', err);
  }

  return null;
}

// ── Version Recovery ────────────────────────────────────────────

export async function recoverDatabaseVersion(versionId: number): Promise<ArrayBuffer> {
  // First try IndexedDB
  if (idbInstance) {
    const version = await getFromIndexedDB<IDBDatabaseVersion>(STORE_VERSIONS, versionId);
    if (version) {
      return version.blob;
    }
  }

  // Fallback to current in local storage
  const result = await browser.storage.local.get(STORAGE_KEY_DB);
  if (result[STORAGE_KEY_DB]) {
    return base64ToArrayBuffer(result[STORAGE_KEY_DB]);
  }

  throw new Error(`Database version ${versionId} not found`);
}

// ── Integrity Checking ──────────────────────────────────────────

export async function validateDatabaseIntegrity(blob: ArrayBuffer): Promise<IntegrityCheckResult> {
  const checksum = await calculateChecksum(blob);

  return {
    valid: true,  // TODO: Add kdbxweb validation
    checksum,
    size: blob.byteLength,
    timestamp: Date.now(),
  };
}

// ── Health Reporting ───────────────────────────────────────────

export async function getStorageHealthReport(): Promise<StorageHealthReport> {
  const report: StorageHealthReport = {
    chromLocalSize: 0,
    indexedDbSize: 0,
    lastSyncTime: 0,
    integrity: {
      checksumMatch: false,
      versionCount: 0,
      lastVersion: 0,
    },
    issues: [],
    timestamp: Date.now(),
  };

  try {
    // Get chrome.storage.local size
    const local = await browser.storage.local.getBytesInUse();
    report.chromLocalSize = local;

    // Get IndexedDB size
    if (navigator.storage && navigator.storage.estimate) {
      const estimate = await navigator.storage.estimate();
      report.indexedDbSize = estimate.usage ?? 0;
    }

    // Get sync status from IndexedDB
    if (idbInstance) {
      const syncStatus = await getFromIndexedDB<IDBSyncStatus>(STORE_SYNC_STATUS, 'sync:status');
      if (syncStatus) {
        report.lastSyncTime = syncStatus.lastSyncTime;
        report.integrity.checksumMatch = syncStatus.integrityStatus === 'healthy';
      }

      // Count versions
      const versionsCount = await countObjectStore(STORE_VERSIONS);
      report.integrity.versionCount = versionsCount;

      const current = await getFromIndexedDB<IDBDatabase>(STORE_DATABASES, 'db:current');
      if (current) {
        report.integrity.lastVersion = current.version;
      }
    }
  } catch (err) {
    report.issues.push('Health check error: ' + String(err));
  }

  return report;
}

// ── Version Pruning ────────────────────────────────────────────

export async function pruneOldVersions(maxVersions: number = 5): Promise<void> {
  if (!idbInstance) return;

  try {
    const versions = await getAllFromIndexedDB<IDBDatabaseVersion>(STORE_VERSIONS);

    if (versions.length > maxVersions) {
      // Sort by version ascending, delete oldest
      versions.sort((a, b) => a.version - b.version);

      for (let i = 0; i < versions.length - maxVersions; i++) {
        await deleteFromIndexedDB(STORE_VERSIONS, versions[i].version);
      }

      console.log(`[persistent-storage] Pruned to ${maxVersions} versions`);
    }
  } catch (err) {
    console.warn('[persistent-storage] Version pruning failed:', err);
  }
}

// ── Storage Cleanup ────────────────────────────────────────────

export async function removeDatabaseCompletely(): Promise<void> {
  try {
    // Clear chrome.storage.local
    await browser.storage.local.remove([STORAGE_KEY_DB, STORAGE_KEY_META]);
  } catch (err) {
    console.warn('Failed to clear chrome.storage.local:', err);
  }

  if (idbInstance) {
    try {
      // Clear all stores
      await deleteAllFromObjectStore(STORE_DATABASES);
      await deleteAllFromObjectStore(STORE_VERSIONS);
      await deleteAllFromObjectStore(STORE_BACKUPS);
      await deleteAllFromObjectStore(STORE_RECOVERY);
      await deleteAllFromObjectStore(STORE_JOURNAL);
      await deleteAllFromObjectStore(STORE_INCOMPLETE);
    } catch (err) {
      console.warn('Failed to clear IndexedDB:', err);
    }
  }
}

// ── Sync Between Storages ──────────────────────────────────────

async function syncFromLocalToIndexedDB(): Promise<void> {
  if (!idbInstance) return;

  try {
    const result = await browser.storage.local.get([STORAGE_KEY_DB, STORAGE_KEY_META]);
    const base64 = result[STORAGE_KEY_DB] as string | undefined;
    const meta = result[STORAGE_KEY_META] as DatabaseMeta | undefined;

    // Check if already synced
    const current = await getFromIndexedDB<IDBDatabase>(STORE_DATABASES, 'db:current');
    if (current) {
      return;  // Already synced
    }

    if (base64 && meta) {
      const blob = base64ToArrayBuffer(base64);
      const checksum = await calculateChecksum(blob);

      await putToIndexedDB<IDBDatabase>(STORE_DATABASES, {
        id: 'db:current',
        blob,
        checksum,
        timestamp: Date.now(),
        version: 1,
        metadata: meta,
        source: 'import',
      });

      console.log('[persistent-storage] Synced existing database to IndexedDB');
    }
  } catch (err) {
    console.warn('[persistent-storage] Sync from local failed:', err);
  }
}

// ── Checksum Calculation ───────────────────────────────────────

export async function calculateChecksum(
  data: ArrayBuffer,
  algorithm: ChecksumAlgorithm = 'sha256'
): Promise<string> {
  if (algorithm === 'sha256') {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  throw new Error(`Unsupported checksum algorithm: ${algorithm}`);
}

// ── Base64 Conversion ──────────────────────────────────────────

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

// ── IndexedDB Helpers ──────────────────────────────────────────

function getDatabase(): IDBDatabase {
  if (!idbInstance) throw new Error('IndexedDB not initialized');
  return idbInstance;
}

async function getFromIndexedDB<T>(storeName: string, key: IDBValidKey): Promise<T | undefined> {
  const db = getDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.get(key);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getAllFromIndexedDB<T>(storeName: string): Promise<T[]> {
  const db = getDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function putToIndexedDB<T>(storeName: string, value: T): Promise<IDBValidKey> {
  const db = getDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.put(value);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function deleteFromIndexedDB(storeName: string, key: IDBValidKey): Promise<void> {
  const db = getDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.delete(key);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function deleteAllFromObjectStore(storeName: string): Promise<void> {
  const db = getDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function countObjectStore(storeName: string): Promise<number> {
  const db = getDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.count();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
