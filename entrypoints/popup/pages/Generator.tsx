import { useState, useEffect, useCallback } from 'react';
import type { GeneratorOptions } from '@/lib/types';
import type { GeneratePasswordResponse } from '@/lib/messages';
import { sendMessage } from '@/lib/messages';
import { DEFAULT_GENERATOR_OPTIONS } from '@/lib/constants';
import { calculateStrength } from '@/lib/password-generator';
import { CopyButton } from '../components/CopyButton';
import { StrengthMeter } from '../components/StrengthMeter';

export function Generator() {
  const [password, setPassword] = useState('');
  const [options, setOptions] = useState<GeneratorOptions>({
    ...DEFAULT_GENERATOR_OPTIONS,
  });

  const generate = useCallback(async () => {
    const res = await sendMessage<GeneratePasswordResponse>({
      type: 'GENERATE_PASSWORD',
      payload: options,
    });
    if (res.success) {
      setPassword(res.data);
    }
  }, [options]);

  useEffect(() => {
    generate();
  }, [generate]);

  const toggleOption = (key: keyof GeneratorOptions) => {
    if (key === 'length' || key === 'excludeAmbiguous') return;
    setOptions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="p-4">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">
        Password Generator
      </h2>

      {/* Generated password */}
      <div className="bg-white rounded-lg border border-gray-200 p-3 mb-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-mono text-gray-800 break-all select-all flex-1 mr-2">
            {password}
          </p>
          <div className="flex items-center gap-1 flex-shrink-0">
            <CopyButton text={password} />
            <button
              onClick={generate}
              className="text-gray-400 hover:text-gray-600 p-1"
              title="Regenerate"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>
        <StrengthMeter password={password} />
      </div>

      {/* Options */}
      <div className="space-y-3">
        {/* Length slider */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-sm font-medium text-gray-700">Length</label>
            <span className="text-sm font-mono text-gray-600">
              {options.length}
            </span>
          </div>
          <input
            type="range"
            min={4}
            max={64}
            value={options.length}
            onChange={(e) =>
              setOptions((prev) => ({
                ...prev,
                length: parseInt(e.target.value),
              }))
            }
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
          />
        </div>

        {/* Checkboxes */}
        {[
          { key: 'uppercase' as const, label: 'Uppercase (A-Z)' },
          { key: 'lowercase' as const, label: 'Lowercase (a-z)' },
          { key: 'digits' as const, label: 'Digits (0-9)' },
          { key: 'special' as const, label: 'Special (!@#$...)' },
          {
            key: 'excludeAmbiguous' as const,
            label: 'Exclude ambiguous (0, O, l, 1, I)',
          },
        ].map(({ key, label }) => (
          <label
            key={key}
            className="flex items-center justify-between cursor-pointer"
          >
            <span className="text-sm text-gray-700">{label}</span>
            <div className="relative">
              <input
                type="checkbox"
                checked={options[key] as boolean}
                onChange={() => {
                  if (key === 'excludeAmbiguous') {
                    setOptions((prev) => ({
                      ...prev,
                      excludeAmbiguous: !prev.excludeAmbiguous,
                    }));
                  } else {
                    toggleOption(key);
                  }
                }}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600" />
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}
