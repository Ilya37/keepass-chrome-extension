/**
 * State Journal for atomic operations and crash recovery.
 * - Logs all database mutations with checksums
 * - Detects incomplete operations on startup
 * - Supports rollback and recovery
 * - Maintains audit trail for forensics
 */

import { randomUUID } from 'crypto';
import type {
  JournalEntry,
  OperationId,
  IncompleteOperation,
  OperationRecoveryReport,
  ConflictReport,
} from './storage-types';

// ── Constants ────────────────────────────────────────────────────

const MAX_JOURNAL_ENTRIES = 500;
const OPERATION_RETRY_DELAY_MS = 5000;
const OPERATION_MAX_RETRIES = 3;

// ── Global State ─────────────────────────────────────────────────

let journalInitialized = false;
let pendingOperations = new Map<OperationId, IncompleteOperation>();

// ── Initialization ───────────────────────────────────────────────

/**
 * Initialize state journal on service worker startup.
 * Detects and handles incomplete operations from previous session.
 */
export async function initializeStateJournal(): Promise<void> {
  try {
    console.log('[state-journal] Initializing state journal');

    // TODO: Load incomplete operations from IndexedDB
    // For now, just initialize the flag

    journalInitialized = true;
    console.log('[state-journal] State journal initialized');
  } catch (err) {
    console.error('[state-journal] Initialization failed:', err);
    throw err;
  }
}

// ── Operation Tracking ───────────────────────────────────────────

/**
 * Begin a new atomic operation.
 * Returns operation ID for tracking.
 */
export async function beginOperation(
  operationType: string,
  payload: any,
): Promise<OperationId> {
  try {
    const timestamp = Date.now();
    const uuid = generateUUID();
    const operationId = `op:${timestamp}:${uuid}` as OperationId;

    const entry: JournalEntry = {
      id: operationId,
      timestamp,
      uuid,
      operation: operationType,
      payload,
      status: 'started',
      databaseChecksum: 'unknown',
      resultChecksum: '',
      error: null,
      retries: 0,
      createdAt: timestamp,
      completedAt: null,
    };

    // Track as incomplete
    pendingOperations.set(operationId, {
      operationId,
      type: operationType,
      state: 'pending',
      attempts: 0,
      lastAttempt: timestamp,
      nextRetry: timestamp + OPERATION_RETRY_DELAY_MS,
    });

    // TODO: Store in IndexedDB
    console.log(`[state-journal] Operation started: ${operationType} (${operationId.substring(0, 20)}...)`);

    return operationId;
  } catch (err) {
    console.error('[state-journal] Failed to begin operation:', err);
    throw err;
  }
}

/**
 * Complete an operation successfully.
 */
export async function completeOperation(
  operationId: OperationId,
  resultChecksum: string,
): Promise<void> {
  try {
    const operation = pendingOperations.get(operationId);
    if (!operation) {
      console.warn(`[state-journal] Operation not found: ${operationId}`);
      return;
    }

    // Mark as completed
    pendingOperations.delete(operationId);

    // TODO: Update in IndexedDB
    // Set status to 'completed', add resultChecksum, set completedAt

    console.log(`[state-journal] Operation completed: ${operation.type} (${resultChecksum.substring(0, 16)}...)`);
  } catch (err) {
    console.error('[state-journal] Failed to complete operation:', err);
    throw err;
  }
}

/**
 * Rollback an operation on error.
 */
export async function rollbackOperation(operationId: OperationId, error: string): Promise<void> {
  try {
    const operation = pendingOperations.get(operationId);
    if (!operation) {
      console.warn(`[state-journal] Operation not found for rollback: ${operationId}`);
      return;
    }

    // Mark as rolled back
    pendingOperations.delete(operationId);

    // TODO: Update in IndexedDB
    // Set status to 'rolled_back', add error message, set completedAt

    console.log(`[state-journal] Operation rolled back: ${operation.type}`);
    console.log(`  Error: ${error}`);
  } catch (err) {
    console.error('[state-journal] Failed to rollback operation:', err);
    throw err;
  }
}

// ── Crash Recovery ──────────────────────────────────────────────

/**
 * Recover incomplete operations on startup.
 * Called after service worker restart.
 */
export async function recoverIncompleteOperations(): Promise<OperationRecoveryReport> {
  const report: OperationRecoveryReport = {
    incompleteCount: 0,
    failedCount: 0,
    recoveredCount: 0,
    rolledBackCount: 0,
    pendingOperations: [],
    timestamp: Date.now(),
  };

  try {
    console.log('[state-journal] Checking for incomplete operations');

    // TODO: Load incomplete operations from IndexedDB
    // For each incomplete operation:
    // 1. Check if it was completed before crash
    // 2. If completed, remove from incomplete list
    // 3. If not completed, decide whether to retry or rollback

    if (pendingOperations.size === 0) {
      console.log('[state-journal] No incomplete operations found');
      return report;
    }

    for (const [opId, op] of pendingOperations.entries()) {
      report.incompleteCount++;
      report.pendingOperations.push(op);

      if (op.attempts >= OPERATION_MAX_RETRIES) {
        report.failedCount++;
        console.warn(`[state-journal] Operation exceeded max retries: ${op.type}`);
      } else {
        // Will be retried
        report.recoveredCount++;
      }
    }

    console.log(
      `[state-journal] Recovery report: ${report.incompleteCount} incomplete, ` +
        `${report.recoveredCount} recovered, ${report.failedCount} failed`
    );

    return report;
  } catch (err) {
    console.error('[state-journal] Recovery error:', err);
    return report;
  }
}

// ── Operation History ───────────────────────────────────────────

/**
 * Get operation history for audit trail.
 */
export async function getOperationHistory(
  limit: number = 100,
  startTime?: number,
): Promise<JournalEntry[]> {
  try {
    // TODO: Query IndexedDB with limit and optional time filter
    console.log(`[state-journal] Getting operation history (limit: ${limit})`);
    return [];
  } catch (err) {
    console.error('[state-journal] Failed to get operation history:', err);
    return [];
  }
}

/**
 * Query operations by type.
 */
export async function getOperationsByType(operationType: string): Promise<JournalEntry[]> {
  try {
    // TODO: Query IndexedDB for operations matching type
    console.log(`[state-journal] Getting operations of type: ${operationType}`);
    return [];
  } catch (err) {
    console.error('[state-journal] Failed to query operations:', err);
    return [];
  }
}

/**
 * Get all failed operations.
 */
export async function getFailedOperations(): Promise<JournalEntry[]> {
  try {
    // TODO: Query IndexedDB for operations with error != null
    console.log('[state-journal] Getting failed operations');
    return [];
  } catch (err) {
    console.error('[state-journal] Failed to get failed operations:', err);
    return [];
  }
}

// ── Cleanup ──────────────────────────────────────────────────────

/**
 * Remove old journal entries to prevent unbounded growth.
 * Keeps last N entries.
 */
export async function pruneJournal(maxEntries: number = MAX_JOURNAL_ENTRIES): Promise<void> {
  try {
    // TODO: Query IndexedDB to count entries
    // If count > maxEntries:
    //   - Sort by timestamp
    //   - Delete oldest (count - maxEntries) entries

    console.log(`[state-journal] Pruning journal to ${maxEntries} entries`);
  } catch (err) {
    console.warn('[state-journal] Journal pruning failed:', err);
  }
}

/**
 * Clear all journal entries (use with caution).
 */
export async function clearJournal(): Promise<void> {
  try {
    // TODO: Delete all entries from state_journal store

    pendingOperations.clear();
    console.log('[state-journal] Journal cleared');
  } catch (err) {
    console.warn('[state-journal] Failed to clear journal:', err);
  }
}

// ── Conflict Detection ───────────────────────────────────────────

/**
 * Detect conflicts between two database versions.
 * Useful for syncing or recovery scenarios.
 */
export async function detectConflicts(
  versionA: ArrayBuffer,
  versionB: ArrayBuffer,
): Promise<ConflictReport> {
  const report: ConflictReport = {
    hasConflicts: false,
    conflictPoints: [],
    suggestedResolution: 'manual',
  };

  try {
    // TODO: Implement conflict detection
    // Compare checksums, entry counts, modified times, etc.
    // Identify entries that differ between versions

    console.log('[state-journal] Analyzing potential conflicts');

    return report;
  } catch (err) {
    console.error('[state-journal] Conflict detection failed:', err);
    return report;
  }
}

// ── Statistics ───────────────────────────────────────────────────

/**
 * Get journal statistics.
 */
export async function getJournalStatistics(): Promise<{
  totalEntries: number;
  completedOperations: number;
  failedOperations: number;
  rolledBackOperations: number;
  pendingOperations: number;
  oldestEntry: number | null;
  newestEntry: number | null;
}> {
  try {
    // TODO: Query IndexedDB for statistics
    return {
      totalEntries: 0,
      completedOperations: 0,
      failedOperations: 0,
      rolledBackOperations: 0,
      pendingOperations: pendingOperations.size,
      oldestEntry: null,
      newestEntry: null,
    };
  } catch (err) {
    console.error('[state-journal] Failed to get statistics:', err);
    return {
      totalEntries: 0,
      completedOperations: 0,
      failedOperations: 0,
      rolledBackOperations: 0,
      pendingOperations: pendingOperations.size,
      oldestEntry: null,
      newestEntry: null,
    };
  }
}

// ── Utility Functions ────────────────────────────────────────────

/**
 * Generate UUID v4.
 * Note: This is a simplified version. In production, use proper uuid library.
 */
function generateUUID(): string {
  // Use crypto.randomUUID if available, otherwise fallback
  try {
    // Note: crypto module from Node.js, but in browser use crypto.getRandomValues
    const arr = new Uint8Array(16);
    (globalThis.crypto || {}).getRandomValues(arr);

    // Set version (4) and variant (RFC 4122)
    arr[6] = (arr[6] & 0x0f) | 0x40;  // Version 4
    arr[8] = (arr[8] & 0x3f) | 0x80;  // Variant 1

    const hex = Array.from(arr).map((b) => b.toString(16).padStart(2, '0'));
    return [
      hex.slice(0, 4).join(''),
      hex.slice(4, 6).join(''),
      hex.slice(6, 8).join(''),
      hex.slice(8, 10).join(''),
      hex.slice(10, 16).join(''),
    ].join('-');
  } catch {
    // Fallback for environments without crypto
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}

/**
 * Format operation ID for display.
 */
export function formatOperationId(operationId: OperationId): string {
  return operationId.substring(0, 30) + '...';
}

/**
 * Get operation type description for UI.
 */
export function getOperationDescription(operationType: string): string {
  const descriptions: Record<string, string> = {
    entry_create: 'Created entry',
    entry_update: 'Updated entry',
    entry_delete: 'Deleted entry',
    group_create: 'Created group',
    group_update: 'Updated group',
    database_save: 'Saved database',
    password_change: 'Changed password',
    create_database: 'Created database',
    import_database: 'Imported database',
    auto_unlock: 'Auto-unlocked database',
    delete_database: 'Deleted database',
    recover_backup: 'Recovered from backup',
  };

  return descriptions[operationType] || operationType;
}
