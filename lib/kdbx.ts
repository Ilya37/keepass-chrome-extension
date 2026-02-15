import * as kdbxweb from 'kdbxweb';
import type { EntryData, GroupData, DatabaseMeta } from './types';

/**
 * Wrapper around kdbxweb for working with .kdbx databases.
 * This is the core data layer — all access to entries/groups goes through here.
 */

let currentDb: kdbxweb.Kdbx | null = null;

// ── Database lifecycle ─────────────────────────────────────────

/** Create a new empty database with a master password */
export async function createDatabase(name: string, password: string): Promise<kdbxweb.Kdbx> {
  const credentials = new kdbxweb.Credentials(
    kdbxweb.ProtectedValue.fromString(password),
  );
  await credentials.ready;
  const db = kdbxweb.Kdbx.create(credentials, name);
  currentDb = db;
  return db;
}

/** Open an existing .kdbx database from raw bytes */
export async function openDatabase(
  data: ArrayBuffer,
  password: string,
): Promise<kdbxweb.Kdbx> {
  const credentials = new kdbxweb.Credentials(
    kdbxweb.ProtectedValue.fromString(password),
  );
  await credentials.ready;
  const db = await kdbxweb.Kdbx.load(data, credentials);
  currentDb = db;
  return db;
}

/** Save the current database to ArrayBuffer (.kdbx binary) */
export async function saveDatabase(): Promise<ArrayBuffer> {
  if (!currentDb) throw new Error('No database is open');
  return currentDb.save();
}

/** Close / lock the database, clearing it from memory */
export function closeDatabase(): void {
  currentDb = null;
}

/** Check if database is currently unlocked */
export function isUnlocked(): boolean {
  return currentDb !== null;
}

/** Get the underlying kdbx instance (internal use) */
export function getDb(): kdbxweb.Kdbx {
  if (!currentDb) throw new Error('Database is not unlocked');
  return currentDb;
}

// ── Database metadata ──────────────────────────────────────────

export function getDatabaseMeta(): DatabaseMeta {
  const db = getDb();
  let entryCount = 0;
  for (const _entry of db.getDefaultGroup().allEntries()) {
    entryCount++;
  }
  return {
    name: db.meta.name || 'Untitled',
    lastModified: new Date().toISOString(),
    entryCount,
  };
}

// ── Groups ─────────────────────────────────────────────────────

export function getGroups(): GroupData[] {
  const db = getDb();
  const result: GroupData[] = [];

  function collectGroups(group: kdbxweb.KdbxGroup) {
    // Skip recycle bin
    if (
      db.meta.recycleBinUuid &&
      group.uuid.equals(db.meta.recycleBinUuid)
    ) {
      return;
    }

    result.push({
      id: group.uuid.toString(),
      name: group.name || 'Unnamed',
      parentId: group.parentGroup?.uuid.toString() ?? null,
      icon: group.icon ?? 48,
    });

    for (const subGroup of group.groups) {
      collectGroups(subGroup);
    }
  }

  collectGroups(db.getDefaultGroup());
  return result;
}

// ── Entries ─────────────────────────────────────────────────────

/** Safely convert a kdbxweb time value to ISO string */
function timeToIso(time: unknown): string {
  if (time instanceof Date) return time.toISOString();
  if (typeof time === 'number' && time > 0) return new Date(time).toISOString();
  return new Date().toISOString();
}

function kdbxEntryToData(entry: kdbxweb.KdbxEntry): EntryData {
  const getField = (name: string): string => {
    const val = entry.fields.get(name);
    if (!val) return '';
    if (typeof val === 'string') return val;
    // ProtectedValue
    return val.getText();
  };

  return {
    id: entry.uuid.toString(),
    title: getField('Title'),
    username: getField('UserName'),
    password: getField('Password'),
    url: getField('URL'),
    notes: getField('Notes'),
    tags: entry.tags || [],
    groupId: entry.parentGroup?.uuid.toString() ?? '',
    created: timeToIso(entry.times.creationTime),
    modified: timeToIso(entry.times.lastModTime),
  };
}

/** Get all entries, optionally filtered by group or search query */
export function getEntries(groupId?: string, search?: string): EntryData[] {
  const db = getDb();
  const entries: EntryData[] = [];

  for (const entry of db.getDefaultGroup().allEntries()) {
    // Skip entries in recycle bin
    if (
      db.meta.recycleBinUuid &&
      entry.parentGroup?.uuid.equals(db.meta.recycleBinUuid)
    ) {
      continue;
    }

    const data = kdbxEntryToData(entry);

    // Filter by group
    if (groupId && data.groupId !== groupId) continue;

    // Filter by search
    if (search) {
      const q = search.toLowerCase();
      const matches =
        data.title.toLowerCase().includes(q) ||
        data.username.toLowerCase().includes(q) ||
        data.url.toLowerCase().includes(q) ||
        data.notes.toLowerCase().includes(q) ||
        data.tags.some((t) => t.toLowerCase().includes(q));
      if (!matches) continue;
    }

    entries.push(data);
  }

  return entries;
}

/** Get a single entry by ID */
export function getEntry(id: string): EntryData | null {
  const db = getDb();
  for (const entry of db.getDefaultGroup().allEntries()) {
    if (entry.uuid.toString() === id) {
      return kdbxEntryToData(entry);
    }
  }
  return null;
}

/** Get entries matching a URL (for autofill) */
export function getEntriesForUrl(url: string): EntryData[] {
  try {
    const hostname = new URL(url).hostname;
    return getEntries().filter((e) => {
      try {
        return e.url && new URL(e.url).hostname === hostname;
      } catch {
        return e.url.includes(hostname);
      }
    });
  } catch {
    return [];
  }
}

/** Create a new entry in a group */
export function createEntry(
  data: Omit<EntryData, 'id' | 'created' | 'modified'>,
): EntryData {
  const db = getDb();

  // Find target group
  let targetGroup = db.getDefaultGroup();
  if (data.groupId) {
    const found = db.getGroup(data.groupId);
    if (found) targetGroup = found;
  }

  const entry = db.createEntry(targetGroup);
  entry.fields.set('Title', data.title);
  entry.fields.set('UserName', data.username);
  entry.fields.set(
    'Password',
    kdbxweb.ProtectedValue.fromString(data.password),
  );
  entry.fields.set('URL', data.url);
  entry.fields.set('Notes', data.notes);
  entry.tags = data.tags || [];

  return kdbxEntryToData(entry);
}

/** Update an existing entry */
export function updateEntry(data: EntryData): EntryData | null {
  const db = getDb();
  for (const entry of db.getDefaultGroup().allEntries()) {
    if (entry.uuid.toString() === data.id) {
      // Save current state to history
      entry.pushHistory();

      entry.fields.set('Title', data.title);
      entry.fields.set('UserName', data.username);
      entry.fields.set(
        'Password',
        kdbxweb.ProtectedValue.fromString(data.password),
      );
      entry.fields.set('URL', data.url);
      entry.fields.set('Notes', data.notes);
      entry.tags = data.tags || [];
      entry.times.update();

      return kdbxEntryToData(entry);
    }
  }
  return null;
}

/** Delete an entry (moves to recycle bin or deletes permanently) */
export function deleteEntry(id: string): boolean {
  const db = getDb();
  for (const entry of db.getDefaultGroup().allEntries()) {
    if (entry.uuid.toString() === id) {
      db.remove(entry);
      return true;
    }
  }
  return false;
}
