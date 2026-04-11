import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAppLayout } from '../components/AppLayout';
import { getMyResearchersActivity } from '../api';
import { keys } from '../queryKeys';
import { slugify } from '../mentionUtils.jsx';

/* ── Constantes ─────────────────────────────────────────────────────────────── */

const ACTION_LABELS = {
  reading_created: 'adicionou uma leitura',
  reading_status_changed: 'atualizou status de leitura',
  milestone_created: 'criou um marco',
  milestone_updated: 'atualizou um marco',
  note_created: 'adicionou uma nota',
  note_updated: 'editou uma nota',
};

const ACTION_CATEGORY = {
  reading_created: 'reading',
  reading_status_changed: 'reading',
  milestone_created: 'milestone',
  milestone_updated: 'milestone',
  note_created: 'note',
  note_updated: 'note',
};

const CATEGORY_LABELS = {
  reading: 'Leituras',
  milestone: 'Marcos',
  note: 'Notas',
};

const CATEGORY_COLORS = {
  reading: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', accent: 'text-blue-600', iconBg: 'bg-blue-100' },
  milestone: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', accent: 'text-green-600', iconBg: 'bg-green-100' },
  note: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', accent: 'text-purple-600', iconBg: 'bg-purple-100' },
};

const ACTION_COLORS = {
  reading_created: 'bg-blue-100 text-blue-600',
  reading_status_changed: 'bg-cyan-100 text-cyan-600',
  milestone_created: 'bg-green-100 text-green-600',
  milestone_updated: 'bg-emerald-100 text-emerald-600',
  note_created: 'bg-purple-100 text-purple-600',
  note_updated: 'bg-violet-100 text-violet-600',
};

const CATEGORY_ICONS = {
  reading: (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  ),
  milestone: (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  note: (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
    </svg>
  ),
};

const ACTION_ICONS = {
  reading_created: CATEGORY_ICONS.reading,
  reading_status_changed: (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  ),
  milestone_created: CATEGORY_ICONS.milestone,
  milestone_updated: (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  ),
  note_created: CATEGORY_ICONS.note,
  note_updated: (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  ),
};

const READING_STATUS = { quero_ler: 'Quero ler', lendo: 'Lendo', lido: 'Lido' };

const PERIOD_OPTIONS = [
  { value: '7', label: '7 dias' },
  { value: '14', label: '14 dias' },
  { value: '30', label: '30 dias' },
  { value: 'all', label: 'Tudo' },
];

/* ── Helpers ────────────────────────────────────────────────────────────────── */

function formatRelativeTime(iso) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  const hr = Math.floor(diffMs / 3600000);
  const d = Math.floor(diffMs / 86400000);
  if (min < 1) return 'agora';
  if (min < 60) return `${min}min`;
  if (hr < 24) return `${hr}h`;
  if (d === 1) return 'ontem';
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function formatFullDate(iso) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function groupByDate(events) {
  const groups = {};
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  for (const event of events) {
    const d = new Date(event.created_at);
    const ds = d.toDateString();
    let label;
    if (ds === today) label = 'Hoje';
    else if (ds === yesterday) label = 'Ontem';
    else label = d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
    if (!groups[label]) groups[label] = [];
    groups[label].push(event);
  }
  return Object.entries(groups);
}

function renderDetail(event) {
  const meta = event.metadata_json;
  if (!meta) return null;
  if (event.action === 'reading_status_changed' && meta.from && meta.to) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-gray-500 mt-0.5">
        <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{READING_STATUS[meta.from] || meta.from}</span>
        <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
        </svg>
        <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{READING_STATUS[meta.to] || meta.to}</span>
      </span>
    );
  }
  if (event.action === 'reading_created' && meta.url) {
    const domain = (() => { try { return new URL(meta.url).hostname.replace('www.', ''); } catch { return meta.url; } })();
    return (
      <a href={meta.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 hover:underline mt-0.5">
        <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
        {domain}
      </a>
    );
  }
  if ((event.action === 'milestone_created' || event.action === 'milestone_updated') && meta.title) {
    return <span className="text-xs text-gray-500 mt-0.5 block">{meta.title}</span>;
  }
  return null;
}

/* ── Componentes ────────────────────────────────────────────────────────────── */

function StatCard({ category, count, active, onClick }) {
  const c = CATEGORY_COLORS[category];
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all ${
        active ? `${c.bg} ${c.border} ring-1 ring-inset ring-current/10` : 'bg-white border-gray-200 hover:border-gray-300'
      }`}
    >
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${active ? c.iconBg : 'bg-gray-100'} ${active ? c.accent : 'text-gray-400'}`}>
        {CATEGORY_ICONS[category]}
      </div>
      <div>
        <p className={`text-lg font-bold leading-none ${active ? c.text : 'text-gray-800'}`}>{count}</p>
        <p className={`text-xs mt-0.5 ${active ? c.accent : 'text-gray-500'}`}>{CATEGORY_LABELS[category]}</p>
      </div>
    </button>
  );
}

function FilterChip({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
        active
          ? 'bg-blue-600 text-white'
          : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300 hover:text-gray-800'
      }`}
    >
      {label}
    </button>
  );
}

/* ── Pagina ─────────────────────────────────────────────────────────────────── */

export default function ActivityPage() {
  const { currentUser } = useAppLayout();
  const [filterUser, setFilterUser] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterPeriod, setFilterPeriod] = useState('30');

  const { data: events = [], isLoading } = useQuery({
    queryKey: keys.activity(),
    queryFn: () => getMyResearchersActivity(500),
    staleTime: 30_000,
  });

  // Derivar usuarios-alvo
  const targetUsers = useMemo(() =>
    [...new Map(events.map(e => [e.target_user_id, e.target_user_name])).entries()]
      .sort((a, b) => (a[1] || '').localeCompare(b[1] || '')),
    [events],
  );

  // Filtro composto
  const filtered = useMemo(() => {
    const now = Date.now();
    const periodMs = filterPeriod === 'all' ? Infinity : Number(filterPeriod) * 86400000;
    return events.filter(e => {
      if (filterUser !== 'all' && String(e.target_user_id) !== filterUser) return false;
      if (filterCategory !== 'all' && ACTION_CATEGORY[e.action] !== filterCategory) return false;
      if (periodMs !== Infinity && now - new Date(e.created_at).getTime() > periodMs) return false;
      return true;
    });
  }, [events, filterUser, filterCategory, filterPeriod]);

  // Contadores por categoria (sobre os filtrados menos o filtro de categoria)
  const categoryCounts = useMemo(() => {
    const now = Date.now();
    const periodMs = filterPeriod === 'all' ? Infinity : Number(filterPeriod) * 86400000;
    const base = events.filter(e => {
      if (filterUser !== 'all' && String(e.target_user_id) !== filterUser) return false;
      if (periodMs !== Infinity && now - new Date(e.created_at).getTime() > periodMs) return false;
      return true;
    });
    const counts = { reading: 0, milestone: 0, note: 0 };
    for (const e of base) {
      const cat = ACTION_CATEGORY[e.action];
      if (cat) counts[cat]++;
    }
    return counts;
  }, [events, filterUser, filterPeriod]);

  const grouped = useMemo(() => groupByDate(filtered), [filtered]);
  const hasFilters = filterUser !== 'all' || filterCategory !== 'all' || filterPeriod !== '30';

  return (
    <div className="min-h-full bg-gray-50">
      <main className="max-w-3xl mx-auto py-8 px-8 space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-gray-900">Atividade dos Orientandos</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {events.length} {events.length === 1 ? 'evento' : 'eventos'} registrados
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <svg className="w-6 h-6 animate-spin text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : events.length === 0 ? (
          <section className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="px-6 py-16 text-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 mx-auto text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p className="text-sm text-gray-500">Nenhuma atividade registrada ainda.</p>
              <p className="text-xs text-gray-400 mt-1">As atividades dos seus orientandos vao aparecer aqui conforme eles usam a plataforma.</p>
            </div>
          </section>
        ) : (
          <>
            {/* Cards de resumo */}
            <div className="grid grid-cols-3 gap-3">
              {['reading', 'milestone', 'note'].map(cat => (
                <StatCard
                  key={cat}
                  category={cat}
                  count={categoryCounts[cat]}
                  active={filterCategory === cat}
                  onClick={() => setFilterCategory(prev => prev === cat ? 'all' : cat)}
                />
              ))}
            </div>

            {/* Barra de filtros */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Aluno */}
              <select
                value={filterUser}
                onChange={e => setFilterUser(e.target.value)}
                className="border border-gray-200 rounded-full px-3 py-1 text-xs text-gray-700 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                <option value="all">Todos ({targetUsers.length})</option>
                {targetUsers.map(([id, name]) => (
                  <option key={id} value={String(id)}>{name}</option>
                ))}
              </select>

              {/* Separador */}
              <div className="w-px h-5 bg-gray-200" />

              {/* Periodo */}
              {PERIOD_OPTIONS.map(opt => (
                <FilterChip
                  key={opt.value}
                  label={opt.label}
                  active={filterPeriod === opt.value}
                  onClick={() => setFilterPeriod(opt.value)}
                />
              ))}

              {/* Limpar filtros */}
              {hasFilters && (
                <>
                  <div className="w-px h-5 bg-gray-200" />
                  <button
                    type="button"
                    onClick={() => { setFilterUser('all'); setFilterCategory('all'); setFilterPeriod('30'); }}
                    className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    Limpar filtros
                  </button>
                </>
              )}
            </div>

            {/* Timeline */}
            <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              {filtered.length === 0 ? (
                <div className="px-6 py-10 text-center">
                  <p className="text-sm text-gray-400 italic">Nenhum evento para os filtros selecionados.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {grouped.map(([dateLabel, dayEvents]) => (
                    <div key={dateLabel}>
                      <div className="px-5 py-2 bg-gray-50/80 border-b border-gray-100 sticky top-0 z-10">
                        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{dateLabel}</h2>
                      </div>
                      <div>
                        {dayEvents.map(event => (
                          <div
                            key={event.id}
                            className="flex items-start gap-3 px-5 py-3 hover:bg-gray-50/50 transition-colors group"
                          >
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${ACTION_COLORS[event.action] || 'bg-gray-100 text-gray-500'}`}>
                              {ACTION_ICONS[event.action] || (
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-gray-800 leading-snug">
                                <Link
                                  to={`/app/profile/${slugify(event.target_user_name || '')}`}
                                  className="font-medium text-gray-900 hover:text-blue-600 transition-colors"
                                >
                                  {event.target_user_name}
                                </Link>
                                {' '}
                                <span className="text-gray-500">
                                  {ACTION_LABELS[event.action] || event.action}
                                </span>
                              </p>
                              {renderDetail(event)}
                            </div>
                            <span
                              className="text-[11px] text-gray-400 shrink-0 mt-1 tabular-nums"
                              title={formatFullDate(event.created_at)}
                            >
                              {formatRelativeTime(event.created_at)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Contador */}
            {filtered.length > 0 && (
              <p className="text-xs text-gray-400 text-center">
                Mostrando {filtered.length} de {events.length} {events.length === 1 ? 'evento' : 'eventos'}
              </p>
            )}
          </>
        )}
      </main>
    </div>
  );
}
