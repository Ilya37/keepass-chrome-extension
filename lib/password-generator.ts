import type { GeneratorOptions } from './types';
import { DEFAULT_GENERATOR_OPTIONS } from './constants';

const UPPERCASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const LOWERCASE = 'abcdefghijklmnopqrstuvwxyz';
const DIGITS = '0123456789';
const SPECIAL = '!@#$%^&*()_+-=[]{}|;:,.<>?';
const AMBIGUOUS = 'O0l1I';

/**
 * Generate a cryptographically random password
 */
export function generatePassword(
  options?: Partial<GeneratorOptions>,
): string {
  const opts: GeneratorOptions = { ...DEFAULT_GENERATOR_OPTIONS, ...options };

  let charset = '';
  if (opts.uppercase) charset += UPPERCASE;
  if (opts.lowercase) charset += LOWERCASE;
  if (opts.digits) charset += DIGITS;
  if (opts.special) charset += SPECIAL;

  if (opts.excludeAmbiguous) {
    charset = charset
      .split('')
      .filter((c) => !AMBIGUOUS.includes(c))
      .join('');
  }

  if (charset.length === 0) {
    charset = LOWERCASE + DIGITS;
  }

  const array = new Uint32Array(opts.length);
  crypto.getRandomValues(array);

  let password = '';
  for (let i = 0; i < opts.length; i++) {
    password += charset[array[i] % charset.length];
  }

  return password;
}

/**
 * Calculate password strength (0-4 scale)
 * 0 = very weak, 1 = weak, 2 = fair, 3 = strong, 4 = very strong
 */
export function calculateStrength(password: string): number {
  if (!password) return 0;

  let score = 0;

  // Length
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (password.length >= 20) score++;

  // Character variety
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasDigit = /\d/.test(password);
  const hasSpecial = /[^a-zA-Z0-9]/.test(password);

  const variety = [hasLower, hasUpper, hasDigit, hasSpecial].filter(
    Boolean,
  ).length;
  if (variety >= 3) score++;
  if (variety >= 4) score++;

  // Cap at 4
  return Math.min(score, 4);
}
