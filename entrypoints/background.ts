import type { MessageRequest, MessageResponse, StateResponse, EntriesResponse, EntryResponse, GroupsResponse, GeneratePasswordResponse, ExportResponse, BackupHistoryResponse, StorageHealthResponse, RecoveryStatusResponse } from '@/lib/messages';
import type { AppState } from '@/lib/types';
import { ALARM_AUTO_LOCK, ALARM_CLIPBOARD_CLEAR, DEFAULT_LOCK_TIMEOUT_MINUTES } from '@/lib/constants';
import { initCryptoEngine } from '@/lib/crypto-setup';
import * as kdbx from '@/lib/kdbx';
import * as storage from '@/lib/storage';
import * as persistentStorage from '@/lib/persistent-storage';
import * as backupSystem from '@/lib/backup-system';
import * as recoverySystem from '@/lib/recovery-system';
import * as stateJournal from '@/lib/state-journal';
import { generatePassword } from '@/lib/password-generator';
import { clearClipboard } from '@/lib/clipboard';

/** Error code sent when the database is not unlocked (e.g. service worker restarted) */
const NOT_UNLOCKED_ERROR = 'NOT_UNLOCKED';


// ── Storage Systems Initialization ─────────────────────────────

async function initializeStorageSystems(): Promise<void> {
  try {
    // Initialize all storage layers (local, IndexedDB, etc.)
    await storage.initializeAllStorageSystems();

    // Initialize state journal (recovers incomplete operations)
    await stateJournal.initializeStateJournal();
    const recovery = await stateJournal.recoverIncompleteOperations();
    if (recovery.incompleteCount > 0) {
      console.warn('Recovered incomplete operations:', recovery.incompleteCount);
      // TODO: Handle incomplete operations (retry or rollback)
    }

    // Initialize backup system (hourly snapshots)
    await backupSystem.initializeBackupSystem();
  } catch (err) {
    console.error('Storage initialization failed:', err);
  }
}

// Storage initialization promise - ensures we wait for storage to be ready
let storageInitialized: Promise<void> | null = null;

export default defineBackground(() => {
  // Initialize Argon2 for kdbxweb before any database operations
  try {
    initCryptoEngine();
  } catch (err) {
    console.error('Failed to initialize crypto engine:', err);
  }

  // Initialize new storage systems (IndexedDB, backup, recovery, journal)
  // Store promise so we can await it before operations that need storage
  storageInitialized = initializeStorageSystems()
    .then(() => {
      console.log('[Background] Storage systems initialized successfully');
    })
    .catch((err) => {
      console.error('Failed to initialize storage systems:', err);
    });

  // ── Auto-unlock after service worker restart ───────────────
  // Chrome MV3 can kill the service worker at any time.
  // We store encrypted unlock token in chrome.storage.session (cleared on browser quit)
  // so we can transparently re-unlock the database.

  async function tryAutoUnlock(): Promise<boolean> {
    if (kdbx.isUnlocked()) return true;

    // Try to load encrypted unlock token (new system)
    const tokenData = await storage.loadEncryptedUnlockToken();
    if (!tokenData || Date.now() > tokenData.expiresAt) {
      // Fallback to old plaintext password (for migration period)
      const oldPassword = await storage.loadSessionPassword();
      if (!oldPassword) return false;

      const dbData = await persistentStorage.loadDatabase();
      if (!dbData) return false;

      try {
        const op = await stateJournal.beginOperation('auto_unlock', {});
        await kdbx.openDatabase(dbData.blob, oldPassword);
        await stateJournal.completeOperation(op, '');
        resetAutoLockTimer();
        return true;
      } catch (err) {
        console.warn('Auto-unlock failed (old method):', err);
        await storage.clearSessionPassword();
        await stateJournal.rollbackOperation(await stateJournal.beginOperation('auto_unlock_failed', {}), String(err));
        return false;
      }
    }

    // Load database from new persistent storage
    const dbData = await persistentStorage.loadDatabase();
    if (!dbData) return false;

    try {
      // Decrypt token to get password (simplified - in real impl would use proper decryption)
      const password = tokenData.token;

      const op = await stateJournal.beginOperation('auto_unlock', {});
      await kdbx.openDatabase(dbData.blob, password);
      await stateJournal.completeOperation(op, '');
      resetAutoLockTimer();
      return true;
    } catch (err) {
      console.warn('Auto-unlock failed:', err);
      await storage.clearEncryptedUnlockToken();
      await stateJournal.rollbackOperation(await stateJournal.beginOperation('auto_unlock_failed', {}), String(err));
      return false;
    }
  }

  // ── State helpers ──────────────────────────────────────────

  async function getAppState(): Promise<AppState> {
    if (kdbx.isUnlocked()) {
      return { status: 'unlocked', meta: kdbx.getDatabaseMeta() };
    }

    // Try auto-unlock (service worker might have restarted)
    if (await tryAutoUnlock()) {
      return { status: 'unlocked', meta: kdbx.getDatabaseMeta() };
    }

    const meta = await storage.loadDatabaseMeta();
    if (meta) {
      return { status: 'locked', meta };
    }
    return { status: 'no_database' };
  }

  /** Guard: ensure database is unlocked before data operations */
  async function requireUnlocked(): Promise<MessageResponse | null> {
    if (kdbx.isUnlocked()) return null;
    // Try auto-unlock before failing
    if (await tryAutoUnlock()) return null;
    return { success: false, error: NOT_UNLOCKED_ERROR };
  }

  function resetAutoLockTimer(): void {
    browser.alarms.create(ALARM_AUTO_LOCK, {
      delayInMinutes: DEFAULT_LOCK_TIMEOUT_MINUTES,
    });
  }

  /** Save current database state to persistent storage */
  async function persistDatabase(): Promise<void> {
    const op = await stateJournal.beginOperation('database_save', {});

    try {
      const data = await kdbx.saveDatabase();
      const meta = kdbx.getDatabaseMeta();

      // Record edit for backup system
      backupSystem.recordEdit();

      // Check if edit threshold reached for snapshot
      if (backupSystem.shouldCreateEditThresholdSnapshot()) {
        await backupSystem.createSnapshot(data, meta, 'edit_threshold');
      }

      // Save to dual storage (chrome.storage.local + IndexedDB)
      const result = await persistentStorage.persistDatabase(data, meta, 'edit');

      if (!result.success) {
        throw new Error(`Storage sync failed: ${result.error}`);
      }

      // Calculate checksum for journal
      const checksum = await persistentStorage.calculateChecksum(data);
      await stateJournal.completeOperation(op, checksum);
    } catch (err) {
      await stateJournal.rollbackOperation(op, String(err));
      throw err;
    }
  }

  // ── Alarm handler ──────────────────────────────────────────

  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ALARM_AUTO_LOCK) {
      kdbx.closeDatabase();
      storage.clearSessionPassword();
    }
    if (alarm.name === ALARM_CLIPBOARD_CLEAR) {
      clearClipboard();
    }
  });

  // ── Message handler ────────────────────────────────────────

  // Use native chrome API directly to avoid webextension-polyfill issues
  // with async message handling in MV3 Service Workers
  chrome.runtime.onMessage.addListener(
    (message: MessageRequest, _sender, sendResponse) => {
      handleMessage(message).then((response) => {
        sendResponse(response);
      }).catch((err) => {
        console.error('Message handler error:', err);
        sendResponse({ success: false, error: String(err) });
      });
      return true; // keep message channel open for async sendResponse
    },
  );

  async function handleMessage(msg: MessageRequest): Promise<MessageResponse> {
    try {
      // Ensure storage is initialized before processing messages
      if (storageInitialized) {
        await storageInitialized;
      }

      switch (msg.type) {
        case 'GET_STATE': {
          const state = await getAppState();
          return { success: true, data: state } as StateResponse;
        }

        case 'CREATE_DATABASE': {
          const op = await stateJournal.beginOperation('create_database', msg.payload);
          try {
            const { name, password } = msg.payload;
            await kdbx.createDatabase(name, password);
            await persistDatabase();

            // Initialize recovery codes and password hash
            const recoveryData = await recoverySystem.initializeRecoveryCodes(password);

            // Save encrypted unlock token (instead of plaintext password)
            await storage.saveEncryptedUnlockToken(password, 3600);

            // Also keep plaintext for this session for compatibility
            await storage.saveSessionPassword(password);

            resetAutoLockTimer();
            await stateJournal.completeOperation(op, '');

            // Return recovery codes to user
            return {
              success: true,
              data: {
                appState: await getAppState(),
                recoveryCodes: recoveryData.codes,
              },
            } as unknown as StateResponse;
          } catch (err) {
            await stateJournal.rollbackOperation(op, String(err));
            throw err;
          }
        }

        case 'IMPORT_DATABASE': {
          const op = await stateJournal.beginOperation('import_database', { dataSize: msg.payload.data.length });
          try {
            const { data, password } = msg.payload;
            const arr = new Uint8Array(data);
            const buffer = arr.buffer;
            try {
              await kdbx.openDatabase(buffer, password);
            } catch (err) {
              console.error('[bg] IMPORT_DATABASE openDatabase failed:', err);
              const errMsg = err instanceof Error ? err.message : String(err);
              if (errMsg.includes('InvalidKey')) {
                return { success: false, error: 'Wrong master password.' };
              }
              throw err;
            }
            await persistDatabase();

            // Initialize recovery codes for imported database
            const recoveryData = await recoverySystem.initializeRecoveryCodes(password);

            // Save encrypted unlock token
            await storage.saveEncryptedUnlockToken(password, 3600);
            await storage.saveSessionPassword(password);

            resetAutoLockTimer();
            await stateJournal.completeOperation(op, '');

            return {
              success: true,
              data: {
                appState: await getAppState(),
                recoveryCodes: recoveryData.codes,
              },
            } as unknown as StateResponse;
          } catch (err) {
            await stateJournal.rollbackOperation(op, String(err));
            throw err;
          }
        }

        case 'UNLOCK': {
          const op = await stateJournal.beginOperation('unlock', {});
          try {
            // Load from new persistent storage (dual storage with fallback)
            const dbData = await persistentStorage.loadDatabase();
            if (!dbData) return { success: false, error: 'No database found' };

            try {
              await kdbx.openDatabase(dbData.blob, msg.payload.password);
            } catch (err) {
              console.error('[bg] UNLOCK openDatabase failed:', err);
              const errMsg = err instanceof Error ? err.message : String(err);
              if (errMsg.includes('InvalidKey')) {
                return { success: false, error: 'Wrong password. Try again.' };
              }
              throw err;
            }

            // Save encrypted unlock token
            await storage.saveEncryptedUnlockToken(msg.payload.password, 3600);

            // Also keep plaintext for this session (compatibility)
            await storage.saveSessionPassword(msg.payload.password);

            resetAutoLockTimer();
            await stateJournal.completeOperation(op, '');

            return { success: true, data: await getAppState() } as StateResponse;
          } catch (err) {
            await stateJournal.rollbackOperation(op, String(err));
            throw err;
          }
        }

        case 'LOCK': {
          kdbx.closeDatabase();
          await storage.clearSessionPassword();
          await storage.clearEncryptedUnlockToken();
          browser.alarms.clear(ALARM_AUTO_LOCK);
          return { success: true };
        }

        case 'GET_ENTRIES': {
          const guard = await requireUnlocked();
          if (guard) return guard;
          resetAutoLockTimer();
          const entries = kdbx.getEntries(
            msg.payload?.groupId,
            msg.payload?.search,
          );
          return { success: true, data: entries } as EntriesResponse;
        }

        case 'GET_ENTRY': {
          const guard = await requireUnlocked();
          if (guard) return guard;
          resetAutoLockTimer();
          const entry = kdbx.getEntry(msg.payload.id);
          if (!entry) return { success: false, error: 'Entry not found' };
          return { success: true, data: entry } as EntryResponse;
        }

        case 'CREATE_ENTRY': {
          const guard = await requireUnlocked();
          if (guard) return guard;
          resetAutoLockTimer();
          const created = kdbx.createEntry(msg.payload.entry);
          await persistDatabase();
          return { success: true, data: created } as EntryResponse;
        }

        case 'UPDATE_ENTRY': {
          const guard = await requireUnlocked();
          if (guard) return guard;
          resetAutoLockTimer();
          const updated = kdbx.updateEntry(msg.payload.entry);
          if (!updated) return { success: false, error: 'Entry not found' };
          await persistDatabase();
          return { success: true, data: updated } as EntryResponse;
        }

        case 'DELETE_ENTRY': {
          const guard = await requireUnlocked();
          if (guard) return guard;
          resetAutoLockTimer();
          const deleted = kdbx.deleteEntry(msg.payload.id);
          if (!deleted) return { success: false, error: 'Entry not found' };
          await persistDatabase();
          return { success: true };
        }

        case 'GET_GROUPS': {
          const guard = await requireUnlocked();
          if (guard) return guard;
          resetAutoLockTimer();
          const groups = kdbx.getGroups();
          return { success: true, data: groups } as GroupsResponse;
        }

        case 'GENERATE_PASSWORD': {
          const pw = generatePassword(msg.payload);
          return { success: true, data: pw } as GeneratePasswordResponse;
        }

        case 'COPY_TO_CLIPBOARD': {
          browser.alarms.create(ALARM_CLIPBOARD_CLEAR, {
            delayInMinutes: 15 / 60,
          });
          return { success: true };
        }

        case 'DELETE_DATABASE': {
          const op = await stateJournal.beginOperation('delete_database', {});
          try {
            kdbx.closeDatabase();

            // Remove from both storage systems
            await persistentStorage.removeDatabaseCompletely();
            await storage.removeDatabaseFromStorage();

            // Clear recovery codes
            await recoverySystem.clearRecoveryCodes();

            // Clear tokens
            await storage.clearEncryptedUnlockToken();
            await storage.clearSessionPassword();

            // Clear backup system state
            backupSystem.cleanup();

            browser.alarms.clear(ALARM_AUTO_LOCK);
            await stateJournal.completeOperation(op, '');
            return { success: true, data: await getAppState() } as StateResponse;
          } catch (err) {
            await stateJournal.rollbackOperation(op, String(err));
            throw err;
          }
        }

        case 'EXPORT_DATABASE': {
          const guard = await requireUnlocked();
          if (guard) return guard;
          const exportData = await kdbx.saveDatabase();
          const exportArr = Array.from(new Uint8Array(exportData));
          console.log('[Export] Database exported, size:', exportArr.length, 'bytes');
          return { success: true, data: exportArr } as ExportResponse;
        }

        case 'GET_ENTRIES_FOR_URL': {
          if (!kdbx.isUnlocked()) {
            await tryAutoUnlock();
            if (!kdbx.isUnlocked()) {
              return { success: true, data: [] } as EntriesResponse;
            }
          }
          resetAutoLockTimer();
          const urlEntries = kdbx.getEntriesForUrl(msg.payload.url);
          return { success: true, data: urlEntries } as EntriesResponse;
        }

        case 'FILL_IN_TAB': {
          const guard = await requireUnlocked();
          if (guard) return guard;
          const { tabId, username, password } = msg.payload;
          try {
            await browser.scripting.executeScript({
              target: { tabId },
              func: (user: string, pass: string) => {
                const setNativeValue = (input: HTMLInputElement, value: string) => {
                  const setter = Object.getOwnPropertyDescriptor(
                    window.HTMLInputElement.prototype,
                    'value',
                  )?.set;
                  if (setter) setter.call(input, value);
                  else input.value = value;
                  input.dispatchEvent(new Event('input', { bubbles: true }));
                  input.dispatchEvent(new Event('change', { bubbles: true }));
                };
                const pwFields = document.querySelectorAll<HTMLInputElement>('input[type="password"]');
                if (pwFields.length === 0) return;
                const field = pwFields[0];
                const form = field.closest('form');
                const userField = form?.querySelector<HTMLInputElement>(
                  'input[type="text"], input[type="email"], input[name*="user"], input[name*="login"], input[name*="email"], input[autocomplete="username"]',
                );
                if (userField) setNativeValue(userField, user);
                setNativeValue(field, pass);
              },
              args: [username, password],
            });
            return { success: true };
          } catch (err) {
            return { success: false, error: String(err) };
          }
        }

        case 'GET_BACKUP_HISTORY': {
          const guard = await requireUnlocked();
          if (guard) return guard;
          resetAutoLockTimer();

          const limit = msg.payload?.limit ?? 10;
          const backups = await backupSystem.getBackupHistory(limit);

          return {
            success: true,
            data: {
              backups: backups.map((b) => ({
                timestamp: b.timestamp,
                version: b.version,
                reason: b.reason,
                size: b.metadata?.name ? b.size : 0,
              })),
              totalSize: backups.reduce((sum, b) => sum + b.size, 0),
            },
          } as unknown as BackupHistoryResponse;
        }

        case 'RESTORE_FROM_BACKUP': {
          const op = await stateJournal.beginOperation('restore_backup', msg.payload);
          try {
            const { timestamp, password } = msg.payload;
            const blob = await persistentStorage.recoverDatabaseVersion(Date.parse(new Date(timestamp).toISOString()) / 1000);

            await kdbx.openDatabase(blob, password);
            await persistDatabase();
            await storage.saveEncryptedUnlockToken(password, 3600);

            resetAutoLockTimer();
            await stateJournal.completeOperation(op, '');

            return { success: true, data: await getAppState() } as StateResponse;
          } catch (err) {
            await stateJournal.rollbackOperation(op, String(err));
            return { success: false, error: String(err) };
          }
        }

        case 'GET_STORAGE_HEALTH': {
          const health = await persistentStorage.getStorageHealthReport();
          return {
            success: true,
            data: health,
          } as unknown as StorageHealthResponse;
        }

        case 'GET_RECOVERY_STATUS': {
          const remaining = await recoverySystem.getRemainingRecoveryCodes();
          return {
            success: true,
            data: {
              hasRecoveryCodes: remaining > 0,
              remainingCodes: remaining,
              codesGenerated: 20,  // TODO: Get actual generated count
            },
          } as unknown as RecoveryStatusResponse;
        }

        default:
          return { success: false, error: 'Unknown message type' };
      }
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      console.error('Background message error:', error);
      return { success: false, error };
    }
  }
});
