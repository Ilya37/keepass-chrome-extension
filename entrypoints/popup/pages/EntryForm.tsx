import { useState } from 'react';
import type { EntryData } from '@/lib/types';
import type { EntryResponse, GeneratePasswordResponse, MessageResponse } from '@/lib/messages';
import { sendMessage } from '@/lib/messages';
import { PasswordInput } from '../components/PasswordInput';
import { StrengthMeter } from '../components/StrengthMeter';

interface Props {
  entry?: EntryData;
  onSaved: () => void;
  onCancel: () => void;
  onSessionLost: (res: MessageResponse) => boolean;
}

export function EntryForm({ entry, onSaved, onCancel, onSessionLost }: Props) {
  const [title, setTitle] = useState(entry?.title ?? '');
  const [username, setUsername] = useState(entry?.username ?? '');
  const [password, setPassword] = useState(entry?.password ?? '');
  const [url, setUrl] = useState(entry?.url ?? '');
  const [notes, setNotes] = useState(entry?.notes ?? '');
  const [tags, setTags] = useState(entry?.tags.join(', ') ?? '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isEditing = !!entry;

  const handleGeneratePassword = async () => {
    const res = await sendMessage<GeneratePasswordResponse>({
      type: 'GENERATE_PASSWORD',
    });
    if (res.success) {
      setPassword(res.data);
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    setLoading(true);
    setError('');

    const parsedTags = tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    try {
      if (isEditing) {
        const res = await sendMessage<EntryResponse>({
          type: 'UPDATE_ENTRY',
          payload: {
            entry: {
              ...entry,
              title: title.trim(),
              username,
              password,
              url,
              notes,
              tags: parsedTags,
            },
          },
        });
        if (!res.success) {
          if (onSessionLost(res)) return;
          setError(res.error);
          return;
        }
      } else {
        const res = await sendMessage<EntryResponse>({
          type: 'CREATE_ENTRY',
          payload: {
            entry: {
              title: title.trim(),
              username,
              password,
              url,
              notes,
              tags: parsedTags,
              groupId: '',
            },
          },
        });
        if (!res.success) {
          if (onSessionLost(res)) return;
          setError(res.error);
          return;
        }
      }
      onSaved();
    } catch {
      setError('Failed to save entry');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">
        {isEditing ? 'Edit Entry' : 'New Entry'}
      </h2>

      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Title *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
            placeholder="e.g. Gmail, GitHub..."
            autoFocus
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Username
          </label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
            placeholder="user@example.com"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Password
          </label>
          <div className="flex gap-2">
            <div className="flex-1">
              <PasswordInput
                value={password}
                onChange={setPassword}
                placeholder="Password"
              />
            </div>
            <button
              type="button"
              onClick={handleGeneratePassword}
              className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-300 transition-colors flex-shrink-0"
              title="Generate password"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
          <StrengthMeter password={password} />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            URL
          </label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
            placeholder="https://example.com"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none resize-none"
            placeholder="Additional notes..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Tags
          </label>
          <input
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
            placeholder="tag1, tag2, ..."
          />
        </div>

        {error && (
          <div className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">
            {error}
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button
            onClick={handleSave}
            disabled={loading}
            className="flex-1 bg-emerald-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Entry'}
          </button>
          <button
            onClick={onCancel}
            className="px-4 py-2.5 bg-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-300 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
