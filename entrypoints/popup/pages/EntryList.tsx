import { useState, useEffect, useCallback } from 'react';
import type { EntryData } from '@/lib/types';
import type { EntriesResponse, MessageResponse } from '@/lib/messages';
import { sendMessage } from '@/lib/messages';

interface Props {
  onSelect: (entry: EntryData) => void;
  onAdd: () => void;
  onSessionLost: (res: MessageResponse) => boolean;
}

export function EntryList({ onSelect, onAdd, onSessionLost }: Props) {
  const [entries, setEntries] = useState<EntryData[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const loadEntries = useCallback(async (query?: string) => {
    const res = await sendMessage<EntriesResponse>({
      type: 'GET_ENTRIES',
      payload: query ? { search: query } : undefined,
    });
    if (res.success) {
      setEntries(res.data);
    } else {
      onSessionLost(res);
    }
    setLoading(false);
  }, [onSessionLost]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadEntries(search || undefined);
    }, 200);
    return () => clearTimeout(timer);
  }, [search, loadEntries]);

  const getFaviconUrl = (url: string) => {
    try {
      const hostname = new URL(url).hostname;
      return `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`;
    } catch {
      return null;
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Search bar */}
      <div className="p-3 border-b border-gray-200">
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search passwords..."
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
            autoFocus
          />
        </div>
      </div>

      {/* Entries */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-600" />
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-12 px-4">
            <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
            <p className="text-gray-500 text-sm">
              {search ? 'No entries found' : 'No passwords yet'}
            </p>
            {!search && (
              <p className="text-gray-400 text-xs mt-1">
                Click + to add your first entry
              </p>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {entries.map((entry) => (
              <button
                key={entry.id}
                onClick={() => onSelect(entry)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-100 transition-colors text-left"
              >
                <div className="w-8 h-8 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {entry.url ? (
                    <img
                      src={getFaviconUrl(entry.url) || ''}
                      alt=""
                      className="w-5 h-5"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">
                    {entry.title || 'Untitled'}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {entry.username}
                  </p>
                </div>
                <svg className="w-4 h-4 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Add button */}
      <div className="p-3 border-t border-gray-200">
        <button
          onClick={onAdd}
          className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Entry
        </button>
      </div>
    </div>
  );
}
