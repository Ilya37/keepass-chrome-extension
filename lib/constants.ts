/** Storage key for the encrypted .kdbx database blob */
export const STORAGE_KEY_DB = 'kdbx_database';

/** Storage key for database metadata (name, last modified) */
export const STORAGE_KEY_META = 'kdbx_meta';

/** Default auto-lock timeout in minutes */
export const DEFAULT_LOCK_TIMEOUT_MINUTES = 15;

/** Clipboard auto-clear timeout in seconds */
export const CLIPBOARD_CLEAR_SECONDS = 15;

/** Alarm name for auto-lock */
export const ALARM_AUTO_LOCK = 'auto-lock';

/** Alarm name for clipboard clear */
export const ALARM_CLIPBOARD_CLEAR = 'clipboard-clear';

/** Default password generator settings */
export const DEFAULT_GENERATOR_OPTIONS = {
  length: 20,
  uppercase: true,
  lowercase: true,
  digits: true,
  special: true,
  excludeAmbiguous: false,
} as const;
