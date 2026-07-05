import { useState, useEffect, useCallback, useMemo } from 'react';
import type { EntryData } from '@/lib/types';
import type { EntriesResponse, MessageResponse } from '@/lib/messages';
import { sendMessage } from '@/lib/messages';

interface Props {
  onSelect: (entry: EntryData) => void;
  onAdd: () => void;
  onSessionLost: (res: MessageResponse) => boolean;
}

export function EntryList({ onSelect, onAdd, onSessionLost }: Props) {
  const UNTAGGED_FILTER = '__untagged__';
  const [entries, setEntries] = useState<EntryData[]>([]);
  const [search, setSearch] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'tags'>('list');
  const [loading, setLoading] = useState(true);
  const [pageEntries, setPageEntries] = useState<EntryData[]>([]);
  const [pageTabId, setPageTabId] = useState<number | null>(null);

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

  const getCleanTags = useCallback((entry: EntryData): string[] => {
    return Array.from(new Set((entry.tags || []).map((tag) => tag.trim()).filter(Boolean)));
  }, []);

  const hasUntaggedEntries = useMemo(() => {
    return entries.some((entry) => getCleanTags(entry).length === 0);
  }, [entries, getCleanTags]);

  const tagStats = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of entries) {
      for (const tag of getCleanTags(entry)) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => a[0].localeCompare(b[0], undefined, { sensitivity: 'base' }))
      .map(([tag, count]) => ({ tag, count }));
  }, [entries, getCleanTags]);

  useEffect(() => {
    if (!selectedTag) return;
    if (selectedTag === UNTAGGED_FILTER) {
      if (!hasUntaggedEntries) setSelectedTag(null);
      return;
    }
    const tagStillPresent = entries.some((entry) => getCleanTags(entry).includes(selectedTag));
    if (!tagStillPresent) setSelectedTag(null);
  }, [entries, selectedTag, hasUntaggedEntries, getCleanTags]);

  const filteredEntries = useMemo(() => {
    if (!selectedTag) return entries;
    if (selectedTag === UNTAGGED_FILTER) {
      return entries.filter((entry) => getCleanTags(entry).length === 0);
    }
    return entries.filter((entry) => getCleanTags(entry).includes(selectedTag));
  }, [entries, selectedTag, getCleanTags]);

  const entriesByTag = useMemo(() => {
    const groups = new Map<string, EntryData[]>();
    const untagged: EntryData[] = [];

    for (const entry of entries) {
      const tags = getCleanTags(entry);
      if (tags.length === 0) {
        untagged.push(entry);
        continue;
      }

      for (const tag of tags) {
        const groupEntries = groups.get(tag);
        if (groupEntries) {
          groupEntries.push(entry);
        } else {
          groups.set(tag, [entry]);
        }
      }
    }

    const sortedGroups = Array.from(groups.entries())
      .sort((a, b) => a[0].localeCompare(b[0], undefined, { sensitivity: 'base' }))
      .map(([tag, groupedEntries]) => ({ tag, entries: groupedEntries }));

    return { groups: sortedGroups, untagged };
  }, [entries, getCleanTags]);

  const renderEntryButton = useCallback((entry: EntryData, key: string) => (
    <button
      key={key}
      onClick={() => onSelect(entry)}
      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-100 transition-colors text-left"
    >
      <div className="w-8 h-8 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
        </svg>
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
  ), [onSelect]);

  // Load entries for current tab (activeTab — user opened popup on this page)
  useEffect(() => {
    (async () => {
      try {
        const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id || !tab.url?.startsWith('http')) return;
        setPageTabId(tab.id);
        const res = await sendMessage<EntriesResponse>({
          type: 'GET_ENTRIES_FOR_URL',
          payload: { url: tab.url },
        });
        if (res.success && res.data.length > 0) setPageEntries(res.data);
      } catch {
        // Tab access might be denied
      }
    })();
  }, []);

  const handleFill = useCallback(
    async (entry: EntryData) => {
      if (pageTabId == null) return;
      const res = await sendMessage({
        type: 'FILL_IN_TAB',
        payload: { tabId: pageTabId, username: entry.username ?? '', password: entry.password ?? '' },
      });
      if (!res.success) onSessionLost(res);
      else window.close();
    },
    [pageTabId, onSessionLost],
  );

  return (
    <div className="flex flex-col h-full">
      {/* On this page — Fill (activeTab) */}
      {pageEntries.length > 0 && (
        <div className="mx-3 mt-2 mb-1 rounded-lg border border-emerald-200 bg-emerald-50 p-2">
          <p className="text-xs font-medium text-emerald-800 mb-2">On this page:</p>
          <div className="space-y-1">
            {pageEntries.slice(0, 3).map((entry) => (
              <div key={entry.id} className="flex items-center justify-between gap-2">
                <button
                  onClick={() => onSelect(entry)}
                  className="flex-1 min-w-0 text-left text-sm text-emerald-900 truncate hover:underline"
                >
                  {entry.title || 'Untitled'}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleFill(entry);
                  }}
                  className="flex-shrink-0 rounded bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-700"
                >
                  Fill
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

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
        <div className="mt-2 inline-flex w-full rounded-lg border border-gray-200 bg-white p-0.5">
          <button
            onClick={() => setViewMode('list')}
            className={`flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
              viewMode === 'list'
                ? 'bg-emerald-600 text-white'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            List
          </button>
          <button
            onClick={() => setViewMode('tags')}
            className={`flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
              viewMode === 'tags'
                ? 'bg-emerald-600 text-white'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            By tags
          </button>
        </div>
        {viewMode === 'list' && (tagStats.length > 0 || hasUntaggedEntries) && (
          <div className="mt-2 -mx-1 flex items-center gap-1 overflow-x-auto px-1 pb-1">
            <button
              onClick={() => setSelectedTag(null)}
              className={`whitespace-nowrap rounded-full border px-2.5 py-1 text-xs transition-colors ${
                selectedTag === null
                  ? 'border-emerald-600 bg-emerald-600 text-white'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
              }`}
            >
              All ({entries.length})
            </button>
            {tagStats.map(({ tag, count }) => (
              <button
                key={tag}
                onClick={() => setSelectedTag(tag)}
                className={`whitespace-nowrap rounded-full border px-2.5 py-1 text-xs transition-colors ${
                  selectedTag === tag
                    ? 'border-emerald-600 bg-emerald-600 text-white'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                }`}
              >
                {tag} ({count})
              </button>
            ))}
            {hasUntaggedEntries && (
              <button
                onClick={() => setSelectedTag(UNTAGGED_FILTER)}
                className={`whitespace-nowrap rounded-full border px-2.5 py-1 text-xs transition-colors ${
                  selectedTag === UNTAGGED_FILTER
                    ? 'border-emerald-600 bg-emerald-600 text-white'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                }`}
              >
                Untagged
              </button>
            )}
          </div>
        )}
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
        ) : viewMode === 'list' && filteredEntries.length === 0 ? (
          <div className="text-center py-12 px-4">
            <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-3-3v6m9 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-gray-500 text-sm">
              No entries for this tag
            </p>
          </div>
        ) : viewMode === 'tags' ? (
          <div className="divide-y divide-gray-100">
            {entriesByTag.groups.map((group) => (
              <div key={group.tag}>
                <div className="px-4 py-2 bg-gray-50 flex items-center justify-between">
                  <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                    {group.tag}
                  </p>
                  <span className="text-xs text-gray-500">
                    {group.entries.length}
                  </span>
                </div>
                {group.entries.map((entry) => renderEntryButton(entry, `${group.tag}:${entry.id}`))}
              </div>
            ))}
            {entriesByTag.untagged.length > 0 && (
              <div>
                <div className="px-4 py-2 bg-gray-50 flex items-center justify-between">
                  <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                    Untagged
                  </p>
                  <span className="text-xs text-gray-500">
                    {entriesByTag.untagged.length}
                  </span>
                </div>
                {entriesByTag.untagged.map((entry) => renderEntryButton(entry, `untagged:${entry.id}`))}
              </div>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredEntries.map((entry) => renderEntryButton(entry, entry.id))}
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
