import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { getMilestones, createMilestone, updateMilestone, deleteMilestone } from '../api';
import Toast from './Toast';

const TYPE_CONFIG = {
  entrada:      { label: 'Entrada no Alumnus', emoji: '🚀', color: '#0EA5E9', bg: '#F0F9FF' },
  publicacao:   { label: 'Publicação',         emoji: '📄', color: '#3B82F6', bg: '#EFF6FF' },
  qualificacao: { label: 'Qualificação',       emoji: '📋', color: '#7C3AED', bg: '#F5F3FF' },
  defesa:       { label: 'Defesa',             emoji: '🎓', color: '#10B981', bg: '#ECFDF5' },
  premio:       { label: 'Prêmio',             emoji: '🏆', color: '#F59E0B', bg: '#FFFBEB' },
  outro:        { label: 'Outro',              emoji: '📌', color: '#6B7280', bg: '#F9FAFB' },
};

const DURATION_YEARS = { graduacao: 4, mestrado: 2, doutorado: 4, postdoc: 1 };
const TYPE_OPTIONS = Object.entries(TYPE_CONFIG)
  .filter(([value]) => value !== 'entrada')
  .map(([value, { label, emoji }]) => ({ value, label, emoji }));

function isoToDate(iso) {
  if (!iso) return null;
  return iso.slice(0, 10); // "2024-01-15T..." → "2024-01-15"
}

function formatDate(isoDate) {
  const d = isoToDate(isoDate);
  if (!d) return '';
  return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
}

function getPredictedEnd(researcher) {
  if (!researcher?.enrollment_date || !DURATION_YEARS[researcher?.status]) return null;
  const [y, m, d] = researcher.enrollment_date.split('-').map(Number);
  const years = DURATION_YEARS[researcher.status];
  return `${y + years}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// ── Modal ────────────────────────────────────────────────────────────────────

function MilestoneModal({ initial, onSave, onClose }) {
  // Opções do select: inclui o tipo atual mesmo que seja 'entrada'
  const modalTypeOptions = initial?.type && !(TYPE_OPTIONS.find(o => o.value === initial.type))
    ? [{ value: initial.type, label: TYPE_CONFIG[initial.type]?.label ?? initial.type, emoji: TYPE_CONFIG[initial.type]?.emoji ?? '' }, ...TYPE_OPTIONS]
    : TYPE_OPTIONS;

  const [form, setForm] = useState({
    type:  initial?.type  ?? 'publicacao',
    title: initial?.title ?? '',
    date:  isoToDate(initial?.date) ?? new Date().toISOString().slice(0, 10),
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function set(field, value) { setForm(f => ({ ...f, [field]: value })); }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.title.trim()) { setError('Título obrigatório'); return; }
    if (!form.date)          { setError('Data obrigatória');  return; }
    setSaving(true);
    try {
      await onSave({ ...form, title: form.title.trim() });
      onClose();
    } catch {
      setError('Erro ao salvar marco');
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <form
        className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4"
        onClick={e => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-800">
            {initial ? 'Editar marco' : 'Novo marco'}
          </h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors" title="Fechar">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Tipo</label>
            <select
              value={form.type}
              onChange={e => set('type', e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              {modalTypeOptions.map(o => <option key={o.value} value={o.value}>{o.emoji} {o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Título</label>
            <input
              type="text"
              value={form.title}
              onChange={e => set('title', e.target.value)}
              placeholder="Ex: Artigo aceito na SBBD 2024"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Data</label>
            <input
              type="date"
              value={form.date}
              onChange={e => set('date', e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Item horizontal ──────────────────────────────────────────────────────────

function TimelineItem({ item, position, canEdit, onEdit, onDelete, isPast }) {
  const cfg  = TYPE_CONFIG[item.type] ?? TYPE_CONFIG.outro;
  const isAuto   = !!item._auto;
  const dotColor = isAuto ? '#D1D5DB' : cfg.color;

  // Alterna cards acima (even) e abaixo (odd) da linha
  const isAbove = position % 2 === 0;

  const card = (
    <div
      className={`group w-28 shrink-0 rounded-lg border bg-white p-2 shadow-sm transition-opacity ${isPast ? '' : 'opacity-50'} ${isAuto ? 'border-dashed' : ''}`}
      style={{ borderColor: isAuto ? '#D1D5DB' : cfg.color }}
    >
      <div className="flex items-start justify-between gap-1">
        <p
          className="text-[11px] font-medium leading-snug line-clamp-2 flex-1"
          style={{ color: isAuto ? '#9CA3AF' : cfg.color }}
        >
          {item.title}
        </p>
        {canEdit && !isAuto && (
          <div className="flex gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <button type="button" onClick={() => onEdit(item)} className="p-0.5 rounded text-gray-400 hover:text-blue-600 transition-colors" title="Editar">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13l6.5-6.5a2 2 0 112.828 2.828L11.828 15.828a4 4 0 01-1.414.828l-3 1 1-3a4 4 0 01.828-1.414z" />
              </svg>
            </button>
            <button type="button" onClick={() => onDelete(item.id)} className="p-0.5 rounded text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Remover marco">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );

  const connector = <div className="w-px h-3 bg-gray-200 mx-auto" />;
  const dot = (
    <div
      className="w-3 h-3 rounded-full mx-auto ring-2 ring-white shrink-0"
      style={{ backgroundColor: dotColor }}
    />
  );
  const dateLabel = (
    <p className="text-xs text-gray-400 text-center mt-1 w-40 shrink-0">{formatDate(item.date)}</p>
  );

  return (
    <div className="flex flex-col items-center w-28 shrink-0">
      {isAbove ? (
        <>
          {card}
          {connector}
          {dot}
          {dateLabel}
          {/* espaço para alinhar com cards abaixo */}
          <div className="h-3" />
          <div className="h-3 opacity-0" />
          <div className="h-3 opacity-0" />
        </>
      ) : (
        <>
          {/* espaço espelho do card acima */}
          <div className="h-[5rem] opacity-0" />
          {dateLabel}
          {dot}
          {connector}
          {card}
        </>
      )}
    </div>
  );
}

// ── Componente principal ─────────────────────────────────────────────────────

export default function MilestoneTimeline({ userId, researcher, canEdit, preview = false, slug, alwaysOpen = false }) {
  const [open,          setOpen]          = useState(true);
  const [milestones,    setMilestones]    = useState([]);
  const [modalOpen,     setModalOpen]     = useState(false);
  const [editing,       setEditing]       = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [toast,         setToast]         = useState('');

  useEffect(() => {
    if (userId) {
      getMilestones(userId).then(data => setMilestones(Array.isArray(data) ? data : []));
    }
  }, [userId]);

  const autoItems = [];
  const predictedEnd = getPredictedEnd(researcher);
  if (predictedEnd && researcher?.status !== 'egresso') {
    autoItems.push({
      id: '_previsao',
      _auto: true,
      _autoLabel: 'Previsão',
      type: 'outro',
      title: 'Previsão de conclusão',
      date: predictedEnd,
    });
  }

  const today    = new Date().toISOString().slice(0, 10);
  const allItems = [...autoItems, ...milestones].sort((a, b) => a.date.localeCompare(b.date));

  async function handleSave(data) {
    if (editing) {
      const updated = await updateMilestone(userId, editing.id, data);
      setMilestones(ms => ms.map(m => m.id === editing.id ? updated : m));
      setToast('Marco atualizado');
    } else {
      const created = await createMilestone(userId, data);
      setMilestones(ms => [...ms, created]);
      setToast('Marco adicionado');
    }
    setEditing(null);
  }

  async function handleDelete(milestoneId) {
    await deleteMilestone(userId, milestoneId);
    setMilestones(ms => ms.filter(m => m.id !== milestoneId));
    setPendingDelete(null);
    setToast('Marco removido');
  }

  if (!userId) return null;

  if (preview) {
    const recentItems = milestones
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-3);
    return (
      <section className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-800">🏁 Marcos temporais</h2>
          {slug && milestones.length > 0 && (
            <Link to={`/app/profile/${slug}/milestones`} className="text-sm text-blue-600 hover:underline">
              Ver todos →
            </Link>
          )}
        </div>
        <div className="px-6 py-4">
          {recentItems.length === 0 ? (
            <p className="text-sm text-gray-400 italic">Nenhum marco registrado.</p>
          ) : (
            <ul className="space-y-2">
              {recentItems.map(item => {
                const cfg = TYPE_CONFIG[item.type] ?? TYPE_CONFIG.outro;
                return (
                  <li key={item.id} className="flex items-center gap-3">
                    <span className="text-base shrink-0">{cfg.emoji}</span>
                    <span className="text-sm text-gray-800 flex-1 min-w-0 truncate">{item.title}</span>
                    <span className="text-xs text-gray-400 shrink-0">{formatDate(item.date)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="bg-white rounded-xl border shadow-sm overflow-hidden">
      {alwaysOpen ? (
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-bold text-gray-800">🏁 Marcos temporais</h2>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
        >
          <h2 className="text-lg font-bold text-gray-800">🏁 Marcos temporais</h2>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      )}

      {(open || alwaysOpen) && <div className="px-5 pb-5 border-t">
        <div className="flex justify-end pt-3 mb-2">
          {canEdit && (
            <button
              type="button"
              onClick={() => { setEditing(null); setModalOpen(true); }}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Adicionar marco
            </button>
          )}
        </div>

      <div className="overflow-x-auto pb-1">
        <div className="relative inline-flex items-center gap-0 min-w-max px-2">
          {/* Linha horizontal central */}
          <div className="absolute left-0 right-0 h-px bg-gray-200" style={{ top: '50%' }} />

          {allItems.map((item, i) => (
            <TimelineItem
              key={item.id}
              item={item}
              position={i}
              canEdit={canEdit}
              isPast={item.date <= today}
              onEdit={m => { setEditing(m); setModalOpen(true); }}
              onDelete={id => setPendingDelete(id)}
            />
          ))}

          {/* Seta no final da linha */}
          <div className="relative flex items-center ml-1">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      </div>
      </div>}

      <Toast message={toast} onClose={() => setToast('')} />

      {pendingDelete !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setPendingDelete(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-base font-semibold text-gray-800">Remover marco</h2>
            <p className="text-sm text-gray-500">Tem certeza que deseja remover este marco? Essa ação não pode ser desfeita.</p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setPendingDelete(null)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors">
                Cancelar
              </button>
              <button type="button" onClick={() => handleDelete(pendingDelete)} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">
                Remover
              </button>
            </div>
          </div>
        </div>
      )}

      {modalOpen && (
        <MilestoneModal
          initial={editing}
          onSave={handleSave}
          onClose={() => { setModalOpen(false); setEditing(null); }}
        />
      )}
    </section>
  );
}
