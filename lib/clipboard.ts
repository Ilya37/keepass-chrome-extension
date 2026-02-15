import { CLIPBOARD_CLEAR_SECONDS, ALARM_CLIPBOARD_CLEAR } from './constants';

/**
 * Copy text to clipboard and schedule auto-clear
 */
export async function copyToClipboard(text: string): Promise<void> {
  // Use the offscreen API or fallback to execCommand in service worker context
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Fallback: create a textarea in offscreen document or content script
    // For now, this is handled through the popup context where clipboard API works
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
