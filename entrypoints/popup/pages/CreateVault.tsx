import { useState } from 'react';
import { sendMessage } from '@/lib/messages';
import type { StateResponse } from '@/lib/messages';
import { PasswordInput } from '../components/PasswordInput';
import { StrengthMeter } from '../components/StrengthMeter';
import { calculateStrength } from '@/lib/password-generator';

interface Props {
  onCreated: () => void;
}

export function CreateVault({ onCreated }: Props) {
  const [name, setName] = useState('My Passwords');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'create' | 'import'>('create');

  const handleCreate = async () => {
    setError('');
    if (!password) {
      setError('Enter a master password');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const res = await sendMessage<StateResponse>({
        type: 'CREATE_DATABASE',
        payload: { name, password },
      });
      if (res.success) {
        onCreated();
      } else {
        setError(res.error);
      }
    } catch (err) {
      setError('Failed to create database');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!password) {
      setError('Enter the master password for this file');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const buffer = await file.arrayBuffer();
      const data = Array.from(new Uint8Array(buffer));
      const res = await sendMessage<StateResponse>({
        type: 'IMPORT_DATABASE',
        payload: { data, password },
      });
      if (res.success) {
        onCreated();
      } else {
        setError(res.error);
      }
    } catch (err) {
      setError('Failed to import database. Check your password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4">
      <div className="text-center mb-6">
        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
          <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-gray-800">Welcome to KeePass</h2>
        <p className="text-sm text-gray-500 mt-1">Create a new vault or import an existing .kdbx file</p>
      </div>

      {/* Toggle */}
      <div className="flex bg-gray-200 rounded-lg p-1 mb-4">
        <button
          onClick={() => setMode('create')}
          className={`flex-1 text-sm py-1.5 rounded-md transition-colors ${
            mode === 'create' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'
          }`}
        >
          Create New
        </button>
        <button
          onClick={() => setMode('import')}
          className={`flex-1 text-sm py-1.5 rounded-md transition-colors ${
            mode === 'import' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'
          }`}
        >
          Import File
        </button>
      </div>

      <div className="space-y-3">
        {mode === 'create' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Database Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              placeholder="My Passwords"
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Master Password
          </label>
          <PasswordInput
            value={password}
            onChange={setPassword}
            placeholder="Enter master password"
          />
          {mode === 'create' && <StrengthMeter password={password} />}
        </div>

        {mode === 'create' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Confirm Password
            </label>
            <PasswordInput
              value={confirmPassword}
              onChange={setConfirmPassword}
              placeholder="Confirm master password"
            />
          </div>
        )}

        {error && (
          <div className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">
            {error}
          </div>
        )}

        {mode === 'create' ? (
          <button
            onClick={handleCreate}
            disabled={loading}
            className="w-full bg-emerald-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Creating...' : 'Create Vault'}
          </button>
        ) : (
          <label className="block">
            <span className="w-full bg-emerald-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors cursor-pointer text-center block">
              {loading ? 'Importing...' : 'Select .kdbx File'}
            </span>
            <input
              type="file"
              accept=".kdbx"
              onChange={handleImport}
              className="hidden"
              disabled={loading || !password}
            />
          </label>
        )}
      </div>
    </div>
  );
}
