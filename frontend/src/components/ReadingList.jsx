import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { slugify } from '../mentionUtils.jsx';
import { getReadings, createReading, updateReadingStatus, deleteReading, summarizeReading } from '../api';
import Toast from './Toast';

export const STATUS_ORDER = ['quero_ler', 'lendo', 'lido'];
export const STATUS_LABEL = { quero_ler: 'Quero ler', lendo: 'Lendo', lido: 'Lido' };
export const STATUS_STYLE = {
  quero_ler: { color: '#6B7280', bg: '#F9FAFB', border: '#E5E7EB' },
  lendo:     { color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
  lido:      { color: '#059669', bg: '#ECFDF5', border: '#A7F3D0' },
};

export function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function StatusBadge({ status }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.quero_ler;
  return (
    <span
      className="text-[10px] px-1.5 py-0.5 rounded border font-medium leading-none"
      style={{ color: s.color, background: s.bg, borderColor: s.border }}
    >
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

export function HistoryBadge({ history }) {
  const [open, setOpen] = useState(false);
  if (!history || history.length <= 1) return null;
  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen(o => !o)}
        className="text-[10px] text-gray-400 hover:text-gray-600 underline leading-none"
      >
        histórico
      </button>
      {open && (
        <div
          className="absolute z-50 bottom-5 left-0 bg-white border border-gray-200 rounded shadow-lg p-2 min-w-[180px] text-[11px] text-gray-600"
          onMouseLeave={() => setOpen(false)}
        >
          {[...history].reverse().map(h => (
            <div key={h.id} className="flex justify-between gap-3 py-0.5 border-b border-gray-100 last:border-0">
              <span className="font-medium">{STATUS_LABEL[h.status] ?? h.status}</span>
              <span className="text-gray-400">{fmtDate(h.changed_at)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function useReadings(userId) {
  const [readings, setReadings]     = useState([]);
  const [summarizing, setSummarizing] = useState(null);
  const [toast, setToast]           = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [summaryReading, setSummaryReading] = useState(null);
  const pollRef = useRef({});

  useEffect(() => {
    return () => Object.values(pollRef.current).forEach(clearInterval);
  }, []);

  async function load() {
    const data = await getReadings(userId);
    if (data) {
      setReadings(data);
      data.forEach(r => { if (!r.title) startPolling(r.id); });
    }
  }

  function startPolling(readingId) {
    if (pollRef.current[readingId]) return;
    let attempts = 0;
    pollRef.current[readingId] = setInterval(async () => {
      attempts++;
      const data = await getReadings(userId);
      if (!data) return;
      const found = data.find(r => r.id === readingId);
      if (found?.title || attempts >= 10) {
        clearInterval(pollRef.current[readingId]);
        delete pollRef.current[readingId];
        setReadings(data);
      }
    }, 3000);
  }

  async function handleAdd(url) {
    const res = await createReading(userId, url);
    if (res?.id) {
      setReadings(prev => [res, ...prev]);
      setToast({ message: 'Leitura adicionada', type: 'success' });
      if (!res.title) startPolling(res.id);
      return true;
    }
    const msg = res?.detail ?? 'Erro ao adicionar leitura';
    setToast({ message: typeof msg === 'string' ? msg : 'Erro ao adicionar leitura', type: 'error' });
    return false;
  }

  async function handleStatusChange(readingId, newStatus) {
    const res = await updateReadingStatus(userId, readingId, newStatus);
    if (res?.id) {
      setReadings(prev => prev.map(r => r.id === readingId ? res : r));
      setToast({ message: `Status: ${STATUS_LABEL[newStatus]}`, type: 'success' });
    }
  }

  async function handleDelete(readingId) {
    await deleteReading(userId, readingId);
    setReadings(prev => prev.filter(r => r.id !== readingId));
    setPendingDelete(null);
    setToast({ message: 'Leitura removida', type: 'success' });
  }

  async function handleSummarize(readingId) {
    const reading = readings.find(r => r.id === readingId);
    setSummarizing(readingId);
    await summarizeReading(userId, readingId);
    setSummarizing(null);
    setToast({ message: 'Resumo sendo gerado, aguarde…', type: 'success' });
    let attempts = 0;
    const iv = setInterval(async () => {
      attempts++;
      const data = await getReadings(userId);
      if (!data) return;
      const found = data.find(r => r.id === readingId);
      if (found?.summary || attempts >= 15) {
        clearInterval(iv);
        setReadings(data);
        if (found?.summary) setToast({ message: 'Resumo disponível!', type: 'success' });
      }
    }, 3000);
  }

  return {
    readings, setReadings, load,
    summarizing, toast, setToast,
    pendingDelete, setPendingDelete,
    summaryReading, setSummaryReading,
    handleAdd, handleStatusChange, handleDelete, handleSummarize,
  };
}

// ── Versão compacta para o perfil ────────────────────────────────────────────

export default function ReadingList({ userId, canEdit, slug, preview = false }) {
  const [urlInput, setUrlInput] = useState('');
  const [adding, setAdding]     = useState(false);

  const {
    readings, load, toast, setToast,
    pendingDelete, setPendingDelete,
    handleAdd, handleStatusChange, handleDelete,
  } = useReadings(userId);

  useEffect(() => {
    if (userId) load();
  }, [userId]);

  async function submitAdd(e) {
    e.preventDefault();
    const url = urlInput.trim();
    if (!url) return;
    setAdding(true);
    const ok = await handleAdd(url);
    setAdding(false);
    if (ok) setUrlInput('');
  }

  const previewItems = [...readings]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 3);

  return (
    <section className="bg-white rounded-xl border shadow-sm overflow-hidden">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="px-6 py-4 border-b flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-800">📚 Leituras</h2>
        {slug && readings.length > 1 && (
          <Link to={`/app/profile/${slug}/readings`} className="text-sm text-blue-600 hover:underline">
            Ver todos →
          </Link>
        )}
      </div>

      <div className="px-6 py-4 space-y-3">
        {canEdit && !preview && (
          <form onSubmit={submitAdd} className="flex gap-2">
            <input
              type="url"
              value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
              placeholder="https://arxiv.org/abs/..."
              className="flex-1 border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              required
            />
            <button
              type="submit"
              disabled={adding}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded disabled:opacity-50"
            >
              {adding ? '…' : 'Adicionar'}
            </button>
          </form>
        )}

        {previewItems.length === 0 && (
          <p className="text-sm text-gray-400 italic">Nenhuma leitura ainda.</p>
        )}

        <div className="space-y-2">
          {previewItems.map(r => (
            <div key={r.id} className="flex items-start justify-between gap-3 py-2 border-b border-gray-100 last:border-0">
              <div className="flex-1 min-w-0">
                <a
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-blue-700 hover:underline line-clamp-1"
                  title={r.url}
                >
                  {r.title || r.url}
                </a>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Adicionado em {fmtDate(r.created_at)}
                  {r.created_by_name && (
                    <> · por <Link to={`/app/profile/${slugify(r.created_by_name)}`} className="hover:underline hover:text-gray-600">{r.created_by_name}</Link></>
                  )}
                </p>
              </div>
              {canEdit ? (
                <div className="flex items-center gap-1 shrink-0">
                  {(() => {
                    const idx  = STATUS_ORDER.indexOf(r.status);
                    const prev = idx > 0 ? STATUS_ORDER[idx - 1] : null;
                    const next = idx < STATUS_ORDER.length - 1 ? STATUS_ORDER[idx + 1] : null;
                    const s    = STATUS_STYLE[r.status];
                    return (
                      <>
                        {prev ? (
                          <button
                            onClick={() => handleStatusChange(r.id, prev)}
                            className="text-gray-400 hover:text-gray-600 leading-none"
                            title={STATUS_LABEL[prev]}
                          >‹</button>
                        ) : <span className="w-2" />}
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded border font-medium leading-none"
                          style={{ color: s.color, background: s.bg, borderColor: s.border }}
                        >
                          {STATUS_LABEL[r.status]}
                        </span>
                        {next ? (
                          <button
                            onClick={() => handleStatusChange(r.id, next)}
                            className="text-gray-400 hover:text-gray-600 leading-none"
                            title={STATUS_LABEL[next]}
                          >›</button>
                        ) : <span className="w-2" />}
                      </>
                    );
                  })()}
                </div>
              ) : (
                <StatusBadge status={r.status} />
              )}
            </div>
          ))}
        </div>

      </div>

      {pendingDelete && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
            <p className="text-gray-800 font-medium mb-1">Remover leitura?</p>
            <p className="text-sm text-gray-500 mb-5 line-clamp-2">
              {pendingDelete.title || pendingDelete.url}
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setPendingDelete(null)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancelar</button>
              <button onClick={() => handleDelete(pendingDelete.id)} className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg">Remover</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
