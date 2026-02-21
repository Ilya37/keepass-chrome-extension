/**
 * Comprehensive type definitions for the new storage system.
 * Includes types for dual-storage (chrome.storage.local + IndexedDB),
 * backup management, recovery codes, and operation journaling.
 */

import type { DatabaseMeta } from './types';

// ── Storage Operations ───────────────────────────────────────────

export interface StorageSyncResult {
  success: boolean;
  primaryStored: boolean;
  backupStored: boolean;
  checksumMatch: boolean;
  error?: string;
  warnings: string[];
  syncTime: number;
}

export interface IntegrityCheckResult {
  valid: boolean;
  checksum: string;
  size: number;
  timestamp: number;
  corruption?: {
    section: string;
    details: string;
  }[];
}

export interface StorageHealthReport {
  chromLocalSize: number;
  indexedDbSize: number;
  lastSyncTime: number;
  integrity: {
    checksumMatch: boolean;
    versionCount: number;
    lastVersion: number;
  };
  issues: string[];
  timestamp: number;
}

export interface DatabaseLoadResult {
  blob: ArrayBuffer;
  metadata: DatabaseMeta;
  source: 'local' | 'indexed-db';
  version: number;
  checksum: string;
}

// ── Backup System ────────────────────────────────────────────────

export interface BackupEntry {
  timestamp: number;
  version: number;
  reason: 'hourly' | 'edit_threshold' | 'manual';
  size: number;
  checksum: string;
  metadata: DatabaseMeta;
}

export interface BackupStatistics {
  totalBackups: number;
  oldestBackup: number | null;
  newestBackup: number | null;
  totalStorageUsed: number;
  averageBackupSize: number;
  autoSnapshotInterval: number;  // milliseconds
  editThreshold: number;
}

// ── Recovery System ──────────────────────────────────────────────

export interface RecoveryCodes {
  codes: string[];
  created: number;
  used: number;
  remaining: number;
}

export interface RecoveryCodesData {
  codes: RecoveryCodeEntry[];
  passwordHash: string;
  hashVersion: number;
  algorithm: 'argon2id';
  created: number;
  lastRotated: number;
}

export interface RecoveryCodeEntry {
  code: string;
  used: boolean;
  usedAt: number | null;
  created: number;
}

export interface PasswordHashData {
  hash: string;
  version: number;
  algorithm: 'argon2id';
  created: number;
  saltLength: number;
  memorySize: number;
  iterations: number;
}

// ── State Journal ────────────────────────────────────────────────

export interface JournalEntry {
  id: string;
  timestamp: number;
  uuid: string;
  operation: string;
  payload: any;
  status: 'started' | 'completed' | 'rolled_back';
  databaseChecksum: string;
  resultChecksum: string;
  error: string | null;
  retries: number;
  createdAt: number;
  completedAt: number | null;
}

export interface IncompleteOperation {
  operationId: string;
  type: string;
  state: 'pending' | 'failed';
  attempts: number;
  lastAttempt: number;
  nextRetry: number;
}

export interface OperationRecoveryReport {
  incompleteCount: number;
  failedCount: number;
  recoveredCount: number;
  rolledBackCount: number;
  pendingOperations: IncompleteOperation[];
  timestamp: number;
}

export interface ConflictReport {
  hasConflicts: boolean;
  conflictPoints: ConflictPoint[];
  suggestedResolution: 'use_a' | 'use_b' | 'manual';
}

export interface ConflictPoint {
  entryId: string;
  field?: string;
  changeType: 'create' | 'update' | 'delete';
  versionAState: any;
  versionBState: any;
}

export type OperationId = string & { readonly __opId: unique symbol };

export interface OperationResult<T = void> {
  operationId: OperationId;
  result: T;
  checksum: string;
}

// ── Index DB Schemas ─────────────────────────────────────────────

export interface IDBDatabase {
  id: string;  // 'db:current' or 'db:v{n}'
  blob: ArrayBuffer;
  checksum: string;
  timestamp: number;
  version: number;
  metadata: DatabaseMeta;
  source: 'edit' | 'import' | 'recovery';
}

export interface IDBDatabaseVersion {
  version: number;
  blob: ArrayBuffer;
  checksum: string;
  timestamp: number;
  metadata: DatabaseMeta;
  reason: 'current' | 'manual' | 'recovery';
}

export interface IDBBackupSnapshot {
  timestamp: number;
  version: number;
  reason: 'hourly' | 'edit_threshold' | 'manual';
  blob: ArrayBuffer;
  checksum: string;
  metadata: DatabaseMeta;
  editCount: number;
  autoSnapshot: boolean;
}

export interface IDBRecoveryCodes {
  id: string;  // 'recovery:current'
  codes: RecoveryCodeEntry[];
  passwordHash: string;
  hashVersion: number;
  algorithm: 'argon2id';
  created: number;
  lastRotated: number;
}

export interface IDBStateJournalEntry {
  id: string;  // 'op:{timestamp}:{uuid}'
  timestamp: number;
  uuid: string;
  operation: string;
  payload: any;
  status: 'started' | 'completed' | 'rolled_back';
  databaseChecksum: string;
  resultChecksum: string;
  error: string | null;
  retries: number;
  createdAt: number;
  completedAt: number | null;
}

export interface IDBIncompleteOperation {
  operationId: string;  // 'op:{timestamp}:{uuid}'
  type: string;
  state: 'pending' | 'failed';
  attempts: number;
  lastAttempt: number;
  nextRetry: number;
}

export interface IDBSyncStatus {
  key: string;  // 'sync:status'
  lastSyncTime: number;
  lastChecksum: string;
  primaryStorage: 'local' | 'indexed-db';
  backupStorage: 'local' | 'indexed-db';
  integrityStatus: 'healthy' | 'degraded' | 'corrupted';
}

// ── Initialization Results ───────────────────────────────────────

export interface StorageInitResult {
  success: boolean;
  warnings: string[];
  localAvailable: boolean;
  indexedDbAvailable: boolean;
  timestamp: number;
}

export interface BackupSystemInitResult {
  success: boolean;
  existingBackups: number;
  warnings: string[];
}

export interface JournalInitResult {
  success: boolean;
  incompleteOperations: number;
  warnings: string[];
}

// ── Encryption Token ─────────────────────────────────────────────

export interface EncryptedUnlockToken {
  token: string;  // Encrypted password token
  expiresAt: number;  // Unix timestamp
  createdAt: number;  // Unix timestamp
}

// ── Message Response Types (for UI) ──────────────────────────────

export interface CreateDatabaseResponse {
  appState: any;  // AppState
  recoveryCodes: string[];  // 20 recovery codes for user to save
}

export interface BackupHistoryResponse {
  backups: BackupEntry[];
  totalSize: number;
}

export interface StorageHealthResponse extends StorageHealthReport {}

// ── Utility Types ────────────────────────────────────────────────

export type ChecksumAlgorithm = 'sha256';

export interface Checksum {
  algorithm: ChecksumAlgorithm;
  hash: string;
}

export interface VersionInfo {
  version: number;
  timestamp: number;
  entryCount: number;
  size: number;
}
