/**
 * Form draft persistence for popup context.
 * Saves form fields to chrome.storage.session so they survive popup close.
 * Session storage is cleared when the browser quits.
 */

const KEY_CREATE_VAULT = 'draft_createVault';
const KEY_UNLOCK = 'draft_unlock';
const KEY_ENTRY_FORM = 'draft_entryForm';

// ── CreateVault ───────────────────────────────────────────────

export interface CreateVaultDraft {
  name: string;
  password: string;
  confirmPassword: string;
  mode: 'create' | 'import';
}

export async function loadCreateVaultDraft(): Promise<CreateVaultDraft | null> {
  try {
    const r = await browser.storage.session.get(KEY_CREATE_VAULT);
    const d = r[KEY_CREATE_VAULT];
    if (!d || typeof d !== 'object') return null;
    return {
      name: String(d.name ?? ''),
      password: String(d.password ?? ''),
      confirmPassword: String(d.confirmPassword ?? ''),
      mode: d.mode === 'import' ? 'import' : 'create',
    };
  } catch {
    return null;
  }
}

export async function saveCreateVaultDraft(draft: CreateVaultDraft): Promise<void> {
  try {
    await browser.storage.session.set({ [KEY_CREATE_VAULT]: draft });
  } catch {
    // ignore
  }
}

export async function clearCreateVaultDraft(): Promise<void> {
  try {
    await browser.storage.session.remove(KEY_CREATE_VAULT);
  } catch {
    // ignore
  }
}

// ── Unlock ─────────────────────────────────────────────────────

export async function loadUnlockDraft(): Promise<string | null> {
  try {
    const r = await browser.storage.session.get(KEY_UNLOCK);
    const p = r[KEY_UNLOCK];
    return typeof p === 'string' ? p : null;
  } catch {
    return null;
  }
}

export async function saveUnlockDraft(password: string): Promise<void> {
  try {
    await browser.storage.session.set({ [KEY_UNLOCK]: password });
  } catch {
    // ignore
  }
}

export async function clearUnlockDraft(): Promise<void> {
  try {
    await browser.storage.session.remove(KEY_UNLOCK);
  } catch {
    // ignore
  }
}

// ── EntryForm (new + edit) ──────────────────────────────────────

export interface EntryFormDraft {
  title: string;
  username: string;
  password: string;
  url: string;
  notes: string;
  tags: string;
}

function entryFormKey(entryId?: string): string {
  return entryId ? `${KEY_ENTRY_FORM}_edit_${entryId}` : `${KEY_ENTRY_FORM}_new`;
}

export async function loadEntryFormDraft(entryId?: string): Promise<EntryFormDraft | null> {
  try {
    const key = entryFormKey(entryId);
    const r = await browser.storage.session.get(key);
    const d = r[key];
    if (!d || typeof d !== 'object') return null;
    return {
      title: String(d.title ?? ''),
      username: String(d.username ?? ''),
      password: String(d.password ?? ''),
      url: String(d.url ?? ''),
      notes: String(d.notes ?? ''),
      tags: String(d.tags ?? ''),
    };
  } catch {
    return null;
  }
}

export async function saveEntryFormDraft(
  draft: EntryFormDraft,
  entryId?: string,
): Promise<void> {
  try {
    await browser.storage.session.set({ [entryFormKey(entryId)]: draft });
  } catch {
    // ignore
  }
}

export async function clearEntryFormDraft(entryId?: string): Promise<void> {
  try {
    await browser.storage.session.remove(entryFormKey(entryId));
  } catch {
    // ignore
  }
}
