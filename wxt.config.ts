import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';
import type { Plugin } from 'vite';

/**
 * Vite plugin that neutralizes new Worker() calls from fflate
 * (bundled inside kdbxweb). Chrome MV3 Service Workers cannot
 * create Web Workers. kdbxweb only uses sync gzip functions so
 * the async worker path is never reached at runtime.
 */
function stripFflateWorker(): Plugin {
  return {
    name: 'strip-fflate-worker',
    transform(code, id) {
      if (id.includes('kdbxweb') && code.includes('new Worker(')) {
        return {
          code: code.replace(
            /new Worker\(/g,
            'new (function(){throw new Error("Worker not available")}||Worker)(',
          ),
          map: null,
        };
      }
      return null;
    },
  };
}

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'KeePass Password Manager',
    description:
      'KeePass-compatible password manager. All data is encrypted locally — nothing leaves your browser.',
    homepage_url: 'https://github.com/Ilya37/keepass-chrome-extension',
    permissions: ['storage', 'alarms', 'activeTab', 'scripting'],
    optional_permissions: ['clipboardWrite'],
    content_security_policy: {
      extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'; style-src 'self' 'unsafe-inline'",
    },
  },
  vite: () => ({
    plugins: [tailwindcss(), stripFflateWorker()],
  }),
});
