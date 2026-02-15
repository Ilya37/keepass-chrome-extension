import type { MessageRequest, MessageResponse, StateResponse, EntriesResponse, EntryResponse, GroupsResponse, GeneratePasswordResponse, ExportResponse } from '@/lib/messages';
import type { AppState } from '@/lib/types';
import { ALARM_AUTO_LOCK, ALARM_CLIPBOARD_CLEAR, DEFAULT_LOCK_TIMEOUT_MINUTES } from '@/lib/constants';
import { initCryptoEngine } from '@/lib/crypto-setup';
import * as kdbx from '@/lib/kdbx';
import * as storage from '@/lib/storage';
import { generatePassword } from '@/lib/password-generator';
import { clearClipboard } from '@/lib/clipboard';

/** Error code sent when the database is not unlocked (e.g. service worker restarted) */
const NOT_UNLOCKED_ERROR = 'NOT_UNLOCKED';

export default defineBackground(() => {
  console.log('[bg] defineBackground callback entered');

  // Initialize Argon2 for kdbxweb before any database operations
  try {
    initCryptoEngine();
    console.log('[bg] crypto engine initialized');
  } catch (err) {
    console.error('[bg] FAILED to init crypto engine:', err);
  }
  console.log('[bg] KeePass Extension background started');

  // ── Auto-unlock after service worker restart ───────────────
  // Chrome MV3 can kill the service worker at any time.
  // We store the master password in chrome.storage.session (cleared on browser quit)
  // so we can transparently re-unlock the database.

  async function tryAutoUnlock(): Promise<boolean> {
    if (kdbx.isUnlocked()) return true;

    const password = await storage.loadSessionPassword();
    if (!password) return false;

    const blob = await storage.loadDatabaseBlob();
    if (!blob) return false;

    try {
      await kdbx.openDatabase(blob, password);
      console.log('Database auto-unlocked after SW restart');
      resetAutoLockTimer();
      return true;
    } catch (err) {
      console.warn('Auto-unlock failed:', err);
      await storage.clearSessionPassword();
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
    const data = await kdbx.saveDatabase();
    await storage.saveDatabaseBlob(data);
    await storage.saveDatabaseMeta(kdbx.getDatabaseMeta());
  }

  // ── Alarm handler ──────────────────────────────────────────

  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ALARM_AUTO_LOCK) {
      kdbx.closeDatabase();
      storage.clearSessionPassword();
      console.log('Database auto-locked');
    }
    if (alarm.name === ALARM_CLIPBOARD_CLEAR) {
      clearClipboard();
      console.log('Clipboard cleared');
    }
  });

  // ── Message handler ────────────────────────────────────────

  // Use native chrome API directly to avoid webextension-polyfill issues
  // with async message handling in MV3 Service Workers
  chrome.runtime.onMessage.addListener(
    (message: MessageRequest, _sender, sendResponse) => {
      console.log('[background] received message:', message.type);
      handleMessage(message).then((response) => {
        console.log('[background] sending response for', message.type);
        sendResponse(response);
      }).catch((err) => {
        console.error('[background] handleMessage error:', err);
        sendResponse({ success: false, error: String(err) });
      });
      return true; // keep message channel open for async sendResponse
    },
  );

  async function handleMessage(msg: MessageRequest): Promise<MessageResponse> {
    try {
      switch (msg.type) {
        case 'GET_STATE': {
          const state = await getAppState();
          return { success: true, data: state } as StateResponse;
        }

        case 'CREATE_DATABASE': {
          const { name, password } = msg.payload;
          await kdbx.createDatabase(name, password);
          await persistDatabase();
          await storage.saveSessionPassword(password);
          resetAutoLockTimer();
          return { success: true, data: await getAppState() } as StateResponse;
        }

        case 'IMPORT_DATABASE': {
          const { data, password } = msg.payload;
          const buffer = new Uint8Array(data).buffer;
          await kdbx.openDatabase(buffer, password);
          await persistDatabase();
          await storage.saveSessionPassword(password);
          resetAutoLockTimer();
          return { success: true, data: await getAppState() } as StateResponse;
        }

        case 'UNLOCK': {
          const blob = await storage.loadDatabaseBlob();
          if (!blob) return { success: false, error: 'No database found' };
          await kdbx.openDatabase(blob, msg.payload.password);
          await storage.saveSessionPassword(msg.payload.password);
          resetAutoLockTimer();
          return { success: true, data: await getAppState() } as StateResponse;
        }

        case 'LOCK': {
          kdbx.closeDatabase();
          await storage.clearSessionPassword();
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

        case 'EXPORT_DATABASE': {
          const guard = await requireUnlocked();
          if (guard) return guard;
          const exportData = await kdbx.saveDatabase();
          const exportArr = Array.from(new Uint8Array(exportData));
          return { success: true, data: exportArr } as ExportResponse;
        }

        case 'GET_ENTRIES_FOR_URL': {
          if (!kdbx.isUnlocked()) {
            // Try auto-unlock silently for content script
            await tryAutoUnlock();
            if (!kdbx.isUnlocked()) {
              return { success: true, data: [] } as EntriesResponse;
            }
          }
          resetAutoLockTimer();
          const urlEntries = kdbx.getEntriesForUrl(msg.payload.url);
          return { success: true, data: urlEntries } as EntriesResponse;
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
