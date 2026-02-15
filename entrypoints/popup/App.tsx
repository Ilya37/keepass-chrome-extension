import { useState, useEffect, useCallback } from 'react';
import type { AppState, EntryData } from '@/lib/types';
import type { StateResponse, MessageResponse } from '@/lib/messages';
import { sendMessage, isNotUnlockedError } from '@/lib/messages';
import { CreateVault } from './pages/CreateVault';
import { Unlock } from './pages/Unlock';
import { EntryList } from './pages/EntryList';
import { EntryForm } from './pages/EntryForm';
import { EntryDetail } from './pages/EntryDetail';
import { Generator } from './pages/Generator';

type Page =
  | { name: 'loading' }
  | { name: 'create_vault' }
  | { name: 'unlock' }
  | { name: 'entry_list' }
  | { name: 'entry_detail'; entry: EntryData }
  | { name: 'entry_form'; entry?: EntryData }
  | { name: 'generator' };

function App() {
  const [page, setPage] = useState<Page>({ name: 'loading' });
  const [appState, setAppState] = useState<AppState | null>(null);

  /**
   * Check any response for NOT_UNLOCKED error.
   * If the service worker restarted and the DB is no longer in memory,
   * redirect the user to the unlock page.
   * Returns true if the error was handled (caller should abort its flow).
   */
  const handleSessionLost = useCallback((res: MessageResponse): boolean => {
    if (isNotUnlockedError(res)) {
      setAppState((prev) =>
        prev && prev.status === 'unlocked'
          ? { status: 'locked', meta: prev.meta }
          : prev,
      );
      setPage({ name: 'unlock' });
      return true;
    }
    return false;
  }, []);

  const refreshState = useCallback(async () => {
    const res = await sendMessage<StateResponse>({ type: 'GET_STATE' });
    if (res.success) {
      setAppState(res.data);
      const state = res.data;
      if (state.status === 'no_database') {
        setPage({ name: 'create_vault' });
      } else if (state.status === 'locked') {
        setPage({ name: 'unlock' });
      } else {
        setPage({ name: 'entry_list' });
      }
    } else {
      // Background service not available — default to create vault screen
      console.warn('Failed to get state from background:', res.error);
      setPage({ name: 'create_vault' });
    }
  }, []);

  useEffect(() => {
    refreshState();
  }, [refreshState]);

  const handleLock = async () => {
    await sendMessage({ type: 'LOCK' });
    await refreshState();
  };

  const header = (
    <div className="flex items-center justify-between px-4 py-3 bg-emerald-600 text-white">
      <div className="flex items-center gap-2">
        {page.name !== 'entry_list' &&
          page.name !== 'create_vault' &&
          page.name !== 'unlock' &&
          page.name !== 'loading' && (
            <button
              onClick={() => setPage({ name: 'entry_list' })}
              className="hover:bg-emerald-700 rounded p-1 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
        <h1 className="text-base font-semibold">KeePass</h1>
      </div>
      <div className="flex items-center gap-1">
        {appState?.status === 'unlocked' && (
          <>
            <button
              onClick={() => setPage({ name: 'generator' })}
              className="hover:bg-emerald-700 rounded p-1.5 transition-colors"
              title="Password Generator"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
            </button>
            <button
              onClick={handleLock}
              className="hover:bg-emerald-700 rounded p-1.5 transition-colors"
              title="Lock Database"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </button>
          </>
        )}
      </div>
    </div>
  );

  const renderPage = () => {
    switch (page.name) {
      case 'loading':
        return (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
          </div>
        );
      case 'create_vault':
        return <CreateVault onCreated={refreshState} />;
      case 'unlock':
        return (
          <Unlock
            meta={appState?.status === 'locked' ? appState.meta : undefined}
            onUnlocked={refreshState}
          />
        );
      case 'entry_list':
        return (
          <EntryList
            onSelect={(entry) => setPage({ name: 'entry_detail', entry })}
            onAdd={() => setPage({ name: 'entry_form' })}
            onSessionLost={handleSessionLost}
          />
        );
      case 'entry_detail':
        return (
          <EntryDetail
            entry={page.entry}
            onEdit={(entry) => setPage({ name: 'entry_form', entry })}
            onDelete={() => setPage({ name: 'entry_list' })}
            onBack={() => setPage({ name: 'entry_list' })}
            onSessionLost={handleSessionLost}
          />
        );
      case 'entry_form':
        return (
          <EntryForm
            entry={page.entry}
            onSaved={() => setPage({ name: 'entry_list' })}
            onCancel={() =>
              page.entry
                ? setPage({ name: 'entry_detail', entry: page.entry })
                : setPage({ name: 'entry_list' })
            }
            onSessionLost={handleSessionLost}
          />
        );
      case 'generator':
        return <Generator />;
    }
  };

  return (
    <div className="w-full min-h-[500px] bg-gray-50 flex flex-col">
      {header}
      <div className="flex-1 overflow-y-auto">{renderPage()}</div>
    </div>
  );
}

export default App;
