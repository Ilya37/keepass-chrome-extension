import { useState, useEffect, useCallback } from 'react';
import type { AppState, EntryData } from '@/lib/types';
import type { StateResponse, MessageResponse, ExportResponse } from '@/lib/messages';
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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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
    try {
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
        console.warn('[App] Failed to get state from background');
        setPage({ name: 'create_vault' });
      }
    } catch (err) {
      console.error('[App] Failed to refresh state:', err);
    }
  }, []);

  useEffect(() => {
    refreshState();
  }, [refreshState]);

  const handleLock = async () => {
    try {
      await sendMessage({ type: 'LOCK' });
      await refreshState();
    } catch (err) {
      console.error('[App] Failed to lock database:', err);
    }
  };

  const handleDeleteDatabase = async () => {
    setShowDeleteConfirm(false);
    await sendMessage({ type: 'DELETE_DATABASE' });
    await refreshState();
  };

  const handleExportDatabase = async () => {
    try {
      console.log('[Export] Requesting export from background...');
      const res = await sendMessage<ExportResponse>({ type: 'EXPORT_DATABASE' });
      if (res.success && res.data) {
        console.log('[Export] Got data from background, size:', res.data.length);

        // Create blob from array
        const buffer = new Uint8Array(res.data);
        const blob = new Blob([buffer], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);

        // Create filename with database name
        const dbName = appState?.status === 'unlocked' ? appState.meta.name : 'keepass';
        const filename = `${dbName}-export-${new Date().toISOString().split('T')[0]}.kdbx`;
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.style.display = 'none';
        document.body.appendChild(link);

        console.log('[Export] Clicking download link, filename:', filename);
        link.click();

        // Cleanup
        setTimeout(() => {
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          console.log('[Export] Download completed');
        }, 100);
      } else {
        console.error('[Export] Export failed:', res.error);
      }
    } catch (err) {
      console.error('[Export] Error:', err);
    }
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
              onClick={handleExportDatabase}
              className="hover:bg-emerald-700 rounded p-1.5 transition-colors"
              title="Export Database"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
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
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="hover:bg-red-600 rounded p-1.5 transition-colors"
              title="Delete Database"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
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

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Delete Database?</h3>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              This will permanently delete all your passwords. This action cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteDatabase}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
