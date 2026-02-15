/** Represents a simplified entry from the kdbx database for UI display */
export interface EntryData {
  id: string;
  title: string;
  username: string;
  password: string;
  url: string;
  notes: string;
  tags: string[];
  groupId: string;
  created: string;
  modified: string;
}

/** Represents a group/folder in the database */
export interface GroupData {
  id: string;
  name: string;
  parentId: string | null;
  icon: number;
}

/** Database metadata stored alongside the encrypted blob */
export interface DatabaseMeta {
  name: string;
  lastModified: string;
  entryCount: number;
}

/** Application state */
export type AppState =
  | { status: 'no_database' }
  | { status: 'locked'; meta: DatabaseMeta }
  | { status: 'unlocked'; meta: DatabaseMeta };

/** Password generator options */
export interface GeneratorOptions {
  length: number;
  uppercase: boolean;
  lowercase: boolean;
  digits: boolean;
  special: boolean;
  excludeAmbiguous: boolean;
}
