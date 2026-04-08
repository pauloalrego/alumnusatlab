import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getProfileBySlug } from '../api';
import { getTokenPayload } from '../auth';
import { useAppLayout } from '../components/AppLayout';
import {
  STATUS_ORDER, STATUS_LABEL, STATUS_STYLE,
  fmtDate, StatusBadge, HistoryBadge, useReadings,
} from '../components/ReadingList';
import Toast from '../components/Toast';

const STATUS_LABELS_PROFILE = { graduacao: 'Graduação', mestrado: 'Mestrado', doutorado: 'Doutorado', postdoc: 'Pós-doc', professor: 'Professor', egresso: 'Egresso' };
const STATUS_COLORS_PROFILE  = { graduacao: '#3B82F6', mestrado: '#F59E0B', doutorado: '#10B981', postdoc: '#06B6D4', professor: '#7C3AED', egresso: '#6B7280' };

function AddForm({ onAdd }) {
  const [url, setUrl]     = useState('');
  const [adding, setAdding] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;
    setAdding(true);
    const ok = await onAdd(trimmed);
    setAdding(false);
    if (ok) setUrl('');
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="url"
        value={url}
        onChange={e => setUrl(e.target.value)}
        placeholder="https://arxiv.org/abs/..."
        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
        required
      />
      <button
        type="submit"
        disabled={adding}
        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg disabled:opacity-50"
      >
        {adding ? '…' : 'Adicionar'}
      </button>
    </form>
  );
}

function ReadingCard({ reading, canEdit, onStatusChange, onDelete, onSummarize, summarizing, onViewSummary }) {
  const idx        = STATUS_ORDER.indexOf(reading.status);
  const prevStatus = idx > 0 ? STATUS_ORDER[idx - 1] : null;
  const nextStatus = idx < STATUS_ORDER.length - 1 ? STATUS_ORDER[idx + 1] : null;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 text-sm shadow-sm flex flex-col gap-2">
      <a
        href={reading.url}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-blue-700 hover:underline line-clamp-2 leading-snug"
        title={reading.url}
      >
        {reading.title || reading.url}
      </a>

      {!reading.title && (
        <span className="text-[10px] text-gray-400 italic">Carregando título…</span>
      )}

      <p className="text-[11px] text-gray-400">Adicionado em {fmtDate(reading.created_at)}</p>

      {canEdit && (
        <div className="flex items-center gap-2 flex-wrap">
          {prevStatus && (() => {
            const s = STATUS_STYLE[prevStatus];
            return (
              <button
                onClick={() => onStatusChange(reading.id, prevStatus)}
                style={{ color: s.color, background: s.bg, borderColor: s.border }}
                className="text-[11px] px-2 py-0.5 rounded border leading-none hover:opacity-80"
              >
                ← {STATUS_LABEL[prevStatus]}
              </button>
            );
          })()}
          {nextStatus && (() => {
            const s = STATUS_STYLE[nextStatus];
            return (
              <button
                onClick={() => onStatusChange(reading.id, nextStatus)}
                style={{ color: s.color, background: s.bg, borderColor: s.border }}
                className="text-[11px] px-2 py-0.5 rounded border leading-none hover:opacity-80"
              >
                → {STATUS_LABEL[nextStatus]}
              </button>
            );
          })()}
          <button
            onClick={() => onDelete(reading)}
            className="text-[11px] text-gray-400 hover:text-red-500 leading-none ml-auto"
            title="Remover"
          >
            ✕
          </button>
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        {reading.summary ? (
          <button
            onClick={() => onViewSummary(reading)}
            className="text-[11px] text-purple-600 hover:text-purple-800 underline leading-none"
          >
            Ler resumo
          </button>
        ) : canEdit ? (
          <button
            onClick={() => onSummarize(reading.id)}
            disabled={summarizing === reading.id}
            className="text-[11px] text-purple-600 hover:text-purple-800 underline disabled:opacity-50 leading-none"
          >
            {summarizing === reading.id ? 'Resumindo…' : 'Resumir'}
          </button>
        ) : null}
        <HistoryBadge history={reading.status_history} />
      </div>
    </div>
  );
}

const COLUMNS = [
  { key: 'quero_ler', label: 'Quero ler', color: '#6B7280', bg: '#F9FAFB', border: '#E5E7EB' },
  { key: 'lendo',     label: 'Lendo',     color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
  { key: 'lido',      label: 'Lido',      color: '#059669', bg: '#ECFDF5', border: '#A7F3D0' },
];

export default function ReadingsPage() {
  const { slug }       = useParams();
  const [profile, setProfile] = useState(null);

  const { setProfileTopbar } = useAppLayout();

  const payload     = getTokenPayload();
  const userId      = profile?.user?.id;
  const isOwnProfile = profile?.user?.id != null && Number(payload?.sub) === Number(profile.user.id);
  const isProfessor  = payload?.role === 'professor' || payload?.role === 'superadmin';
  const canEdit      = isProfessor || isOwnProfile;

  useEffect(() => {
    if (slug) getProfileBySlug(slug).then(setProfile);
  }, [slug]);

  useEffect(() => {
    if (!profile?.user) return;
    const user       = profile.user;
    const researcher = profile.researcher;
    const color      = STATUS_COLORS_PROFILE[researcher?.status] || '#6B7280';
    setProfileTopbar({
      nome:        user.nome,
      photoUrl:    user.photo_url || null,
      statusColor: color,
      statusLabel: researcher
        ? (STATUS_LABELS_PROFILE[researcher.status] || researcher.status)
        : (user.role === 'professor' ? 'Professor' : 'Usuário'),
      email:         researcher?.email || user.email,
      lastLoginLine: null,
      onAvatarClick: null,
      uploadingPhoto: false,
      hideSettings:  true,
    });
    return () => setProfileTopbar(null);
  }, [profile, setProfileTopbar]);

  const {
    readings, load,
    summarizing, toast, setToast,
    pendingDelete, setPendingDelete,
    summaryReading, setSummaryReading,
    handleAdd, handleStatusChange, handleDelete, handleSummarize,
  } = useReadings(userId);

  useEffect(() => {
    if (userId) load();
  }, [userId]);

  const byStatus = (status) => readings.filter(r => r.status === status);

  const nome = profile?.user?.nome ?? '';

  return (
    <div className="min-h-full bg-gray-50">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <main className="max-w-5xl mx-auto py-8 px-4 space-y-6">
        {/* Cabeçalho */}
        <div className="flex items-center gap-3">
          <Link
            to={`/app/profile/${slug}`}
            className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Perfil
          </Link>
          <span className="text-gray-300">/</span>
          <h1 className="text-lg font-bold text-gray-800">📚 Leituras{nome ? ` de ${nome}` : ''}</h1>
        </div>

        {/* Formulário de adição */}
        {canEdit && <AddForm onAdd={handleAdd} />}


        {/* Kanban */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {COLUMNS.map(col => (
            <div key={col.key}>
              <div
                className="text-xs font-semibold px-2 py-1.5 rounded-t border-b mb-3"
                style={{ color: col.color, background: col.bg, borderColor: col.border }}
              >
                {col.label}
                <span className="ml-1 font-normal text-gray-400">({byStatus(col.key).length})</span>
              </div>
              <div className="space-y-2">
                {byStatus(col.key).map(reading => (
                  <ReadingCard
                    key={reading.id}
                    reading={reading}
                    canEdit={canEdit}
                    onStatusChange={handleStatusChange}
                    onDelete={setPendingDelete}
                    onSummarize={handleSummarize}
                    summarizing={summarizing}
                    onViewSummary={setSummaryReading}
                  />
                ))}
                {byStatus(col.key).length === 0 && (
                  <p className="text-xs text-gray-400 italic px-1">Nenhuma leitura aqui.</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Confirmação de remoção */}
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

      {/* Popup de resumo */}
      {summaryReading && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setSummaryReading(null)}>
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4 gap-3">
              <h3 className="text-base font-semibold text-gray-800 leading-snug">
                {summaryReading.title || summaryReading.url}
              </h3>
              <button onClick={() => setSummaryReading(null)} className="text-gray-400 hover:text-gray-600 shrink-0 text-lg leading-none">✕</button>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{summaryReading.summary}</p>
          </div>
        </div>
      )}
    </div>
  );
}
