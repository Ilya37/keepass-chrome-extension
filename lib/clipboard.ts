import { CLIPBOARD_CLEAR_SECONDS, ALARM_CLIPBOARD_CLEAR } from './constants';

/**
 * Copy text to clipboard and schedule auto-clear
 */
export async function copyToClipboard(text: string): Promise<void> {
  // clipboardWrite permission allows navigator.clipboard in popup/offscreen contexts
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Copy is initiated from popup where clipboard API is available
    throw new Error('Clipboard API not available in this context');
  }

  // Schedule clipboard clear
  await browser.alarms.create(ALARM_CLIPBOARD_CLEAR, {
    delayInMinutes: CLIPBOARD_CLEAR_SECONDS / 60,
  });
}

/**
 * Clear the clipboard (called by alarm handler)
 */
export async function clearClipboard(): Promise<void> {
  try {
    await navigator.clipboard.writeText('');
  } catch {
    // Best effort - clipboard clearing may not work in all contexts
  }
}
