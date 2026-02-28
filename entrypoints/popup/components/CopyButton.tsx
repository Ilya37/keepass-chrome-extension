import { useState } from 'react';

interface Props {
  text: string;
}

export function CopyButton({ text }: Props) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);

  const handleCopy = async () => {
    setError(false);
    try {
      const has = await browser.permissions.contains({ permissions: ['clipboardWrite'] });
      if (!has) {
        const granted = await browser.permissions.request({ permissions: ['clipboardWrite'] });
        if (!granted) {
          setError(true);
          return;
        }
      }
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      // Schedule clipboard clear (background handles alarm)
      browser.runtime.sendMessage({ type: 'COPY_TO_CLIPBOARD', payload: { text } }).catch(() => {});
    } catch {
      setError(true);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className={`p-1 rounded transition-colors ${
        copied ? 'text-emerald-600' : error ? 'text-red-500' : 'text-gray-400 hover:text-gray-600'
      }`}
      title={copied ? 'Copied!' : error ? 'Grant clipboard permission' : 'Copy'}
    >
      {copied ? (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      )}
    </button>
  );
}
