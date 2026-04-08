import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { getNotes, createNote, deleteNote } from '../api';
import { modKey } from '../platform';
import Toast from './Toast';
import { slugify } from '../mentionUtils.jsx';
import RichEditor from './RichEditor';
import RichContent from './RichContent';
import { useConfirm } from './ConfirmModal';

function formatDate(iso) {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function NotesSection({ userId, institutionId, canAdd, isProfessor, currentUserId, researchers = [], preview = false, slug, alwaysOpen = false }) {
  const [open, setOpen] = useState(preview || alwaysOpen);
  const [notes, setNotes] = useState([]);
  const [text, setText] = useState('');
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const { confirm, modal: confirmModal } = useConfirm();
  const fileRef = useRef();
  const loadNotesInFlight = useRef(false);
  const loaded = useRef(false);

  async function load() {
    if (loadNotesInFlight.current) return;
    loadNotesInFlight.current = true;
    try {
      const data = await getNotes(userId, institutionId);
      setNotes(Array.isArray(data) ? data : []);
    } finally {
      loadNotesInFlight.current = false;
    }
  }

  useEffect(() => { loaded.current = false; setNotes([]); }, [userId, institutionId]);

  useEffect(() => {
    if (preview) { loaded.current = true; load(); return; }
    if (open && !loaded.current) { loaded.current = true; load(); }
  }, [open, preview]); // eslint-disable-line

  async function handleSubmit(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (!text.trim()) return;
    setSaving(true);
    await createNote(userId, text, file, institutionId);
    setText('');
    setFile(null);
    if (fileRef.current) fileRef.current.value = '';
    setSaving(false);
    setToast('Anotação adicionada');
    load();
  }

  async function handleDelete(id) {
    if (!await confirm({ title: 'Remover esta anotação?', confirmLabel: 'Remover' })) return;
    await deleteNote(id);
    load();
  }

  const visibleNotes = preview ? notes.slice(0, 3) : notes;

  if (preview) {
    return (
      <div className="space-y-0">
        {confirmModal}
        <Toast message={toast} onClose={() => setToast('')} />
        <section className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="px-6 py-4 border-b flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-800">📝 Anotações</h2>
            {slug && notes.length > 0 && (
              <Link to={`/app/profile/${slug}/notes`} className="text-sm text-blue-600 hover:underline">
                Ver todas →
              </Link>
            )}
          </div>
          <div className="px-6 py-4">
            {visibleNotes.length === 0 && loaded.current ? (
              <p className="text-xs text-gray-400">Nenhuma anotação ainda.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {visibleNotes.map(note => (
                  <li key={note.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-gray-400">{formatDate(note.created_at)}</span>
                      {note.created_by_name && (
                        <span className="text-xs text-gray-500">
                          por <Link to={`/app/profile/${slugify(note.created_by_name)}`} className="font-semibold text-gray-700 hover:underline hover:text-blue-600">{note.created_by_name}</Link>
                        </span>
                      )}
                    </div>
                    <RichContent html={note.text} researchers={researchers} className="text-sm text-gray-700 line-clamp-2" />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {confirmModal}
      <Toast message={toast} onClose={() => setToast('')} />
      <section className="bg-white rounded-xl shadow-sm border overflow-hidden">
        {alwaysOpen ? (
          <div className="px-6 py-4 border-b">
            <h2 className="text-lg font-bold text-gray-800">📝 Anotações de reuniões</h2>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setOpen(o => !o)}
            className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
          >
            <h2 className="text-lg font-bold text-gray-800">📝 Anotações de reuniões</h2>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        )}

        {(open || alwaysOpen) && (
          <div className="px-6 pb-6 space-y-4 border-t">
            {canAdd && (
              <form onSubmit={handleSubmit} className="space-y-2 pt-4">
                <RichEditor
                  variant="simple"
                  researchers={researchers}
                  value={text}
                  onChange={setText}
                  onSubmit={handleSubmit}
                  placeholder="Nova anotação... (@ para mencionar alguém)"
                />
                <div className="flex items-center gap-3">
                  <label className="text-sm text-gray-500 cursor-pointer hover:text-blue-600 flex items-center gap-1">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                    {file ? file.name : 'Anexar arquivo'}
                    <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => setFile(e.target.files[0] || null)} />
                  </label>
                  {file && (
                    <button type="button" onClick={() => { setFile(null); fileRef.current.value = ''; }} className="text-xs text-red-400 hover:text-red-600">
                      remover
                    </button>
                  )}
                  <button type="submit" disabled={saving || !text.trim()} className="ml-auto bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
                    {saving ? 'Salvando...' : <>Adicionar <span className="opacity-50 text-xs">{modKey}+Enter</span></>}
                  </button>
                </div>
              </form>
            )}

            {notes.length > 0 && (
              <div className="max-h-96 overflow-y-auto">
                <ul className="divide-y divide-gray-100">
                  {notes.map(note => (
                    <li key={note.id} className="py-4 first:pt-0 last:pb-0">
                      <div className="flex items-center justify-between mb-1">
                        <div>
                          <span className="text-xs text-gray-400">{formatDate(note.created_at)}</span>
                          {note.created_by_name && (
                            <span className="ml-1.5 text-xs text-gray-500">
                              por <Link to={`/app/profile/${slugify(note.created_by_name)}`} className="font-semibold text-gray-700 hover:underline hover:text-blue-600">{note.created_by_name}</Link>
                            </span>
                          )}
                        </div>
                        {(isProfessor || note.created_by_id === currentUserId) && (
                          <button onClick={() => handleDelete(note.id)} title="Remover anotação" className="p-1 rounded text-red-400 hover:text-red-600 hover:bg-red-50">
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </div>
                      <RichContent html={note.text} researchers={researchers} className="text-sm text-gray-700" />
                      {note.file_url && (
                        <a href={note.file_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 mt-1 text-xs text-blue-600 hover:underline">
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                          </svg>
                          {note.file_name || 'Anexo'}
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {notes.length === 0 && loaded.current && (
              <p className="text-xs text-gray-400 py-2">Nenhuma anotação ainda.</p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
