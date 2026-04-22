import React, { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getUserActivity, getUserStats } from '../api';
import { slugify } from '../mentionUtils.jsx';

/* ── Constantes ─────────────────────────────────────────────────────────────── */

const ACTION_LABELS = {
  reading_created: 'adicionou uma leitura',
  reading_status_changed: 'atualizou status de leitura',
  milestone_created: 'criou um marco',
  milestone_updated: 'atualizou um marco',
  note_created: 'adicionou uma anotação',
  note_updated: 'editou uma anotação',
  login: 'acessou a plataforma',
};

const ACTION_COLORS = {
  reading_created: 'bg-blue-100 text-blue-600',
  reading_status_changed: 'bg-cyan-100 text-cyan-600',
  milestone_created: 'bg-green-100 text-green-600',
  milestone_updated: 'bg-emerald-100 text-emerald-600',
  note_created: 'bg-purple-100 text-purple-600',
  note_updated: 'bg-violet-100 text-violet-600',
  login: 'bg-amber-100 text-amber-600',
};

const ACTION_ICONS = {
  reading_created: (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  ),
  reading_status_changed: (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  ),
  milestone_created: (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  milestone_updated: (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  ),
  note_created: (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
    </svg>
  ),
  note_updated: (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
    </svg>
  ),
  login: (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
    </svg>
  ),
};

const READING_STATUS = { quero_ler: 'Quero ler', lendo: 'Lendo', lido: 'Lido' };

/* ── Helpers ────────────────────────────────────────────────────────────────── */

function daysAgo(iso) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

function formatRelativeTime(iso) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  const hr = Math.floor(diffMs / 3600000);
  const d = Math.floor(diffMs / 86400000);
  if (min < 1) return 'agora';
  if (min < 60) return `${min}min`;
  if (hr < 24) return `${hr}h`;
  if (d === 1) return 'ontem';
  if (d < 7) return `ha ${d}d`;
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function formatFullDate(iso) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function computeStats(events) {
  const lastLogin = events.find(e => e.action === 'login');
  const now = Date.now();
  const thirtyDays = 30 * 86400000;
  const recent = events.filter(e => now - new Date(e.created_at).getTime() < thirtyDays);
  const readingsCompleted = recent.filter(e => e.action === 'reading_status_changed' && e.metadata_json?.to === 'lido').length;

  return { readingsCompleted, lastLogin };
}

function renderDetail(event) {
  const meta = event.metadata_json;
  if (!meta) return null;
  if (event.action === 'reading_status_changed' && meta.from && meta.to) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-gray-400 mt-0.5">
        <span className="px-1 py-0.5 rounded bg-gray-100">{READING_STATUS[meta.from] || meta.from}</span>
        <span>&rarr;</span>
        <span className="px-1 py-0.5 rounded bg-gray-100">{READING_STATUS[meta.to] || meta.to}</span>
      </span>
    );
  }
  if (event.action === 'reading_created' && meta.url) {
    const domain = (() => { try { return new URL(meta.url).hostname.replace('www.', ''); } catch { return ''; } })();
    return domain ? <span className="text-[11px] text-blue-400 mt-0.5">{domain}</span> : null;
  }
  if ((event.action === 'milestone_created' || event.action === 'milestone_updated') && meta.title) {
    return <span className="text-[11px] text-gray-400 mt-0.5 block truncate">{meta.title}</span>;
  }
  return null;
}

/* ── Componentes ────────────────────────────────────────────────────────────── */

function Indicator({ label, value, sublabel, color = 'text-gray-800', icon }) {
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      {icon && (
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${color.replace('text-', 'bg-').replace('800', '100').replace('600', '100').replace('700', '100')} ${color}`}>
          {icon}
        </div>
      )}
      <div className="min-w-0">
        <p className={`text-lg font-bold leading-none ${color}`}>{value}</p>
        <p className="text-[11px] text-gray-500 mt-0.5 leading-tight">{label}</p>
        {sublabel && <p className="text-[10px] text-gray-400 leading-tight">{sublabel}</p>}
      </div>
    </div>
  );
}

function EngagementBar({ score, lastLoginDays }) {

  let engagementLevel, engagementColor, engagementLabel;
  if (score === 0) {
    engagementLevel = 0; engagementColor = 'bg-gray-300'; engagementLabel = 'Sem atividade';
  } else if (score < 20) {
    engagementLevel = 1; engagementColor = 'bg-red-500'; engagementLabel = 'Inativo';
  } else if (score < 45) {
    engagementLevel = 2; engagementColor = 'bg-amber-500'; engagementLabel = 'Pouco ativo';
  } else if (score < 70) {
    engagementLevel = 3; engagementColor = 'bg-blue-500'; engagementLabel = 'Regular';
  } else {
    engagementLevel = 4; engagementColor = 'bg-green-500'; engagementLabel = 'Ativo';
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className={`w-2 h-5 rounded-sm ${i <= engagementLevel ? engagementColor : 'bg-gray-200'}`} />
        ))}
      </div>
      <div>
        <p className="text-xs font-semibold text-gray-700">{engagementLabel}</p>
        <p className="text-[10px] text-gray-400">
          {lastLoginDays !== null
            ? (lastLoginDays <= 0 ? 'Acessou hoje' : lastLoginDays === 1 ? 'Acessou ontem' : `Acessou ha ${lastLoginDays}d`)
            : 'Nunca acessou'}
        </p>
      </div>
    </div>
  );
}

/* ── Componente principal ───────────────────────────────────────────────────── */

const PAGE_INITIAL = 5;
const PAGE_SIZE = 10;

export default function ActivitySummary({ userId, userName }) {
  const [open, setOpen] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [events, setEvents] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const initialLoaded = useRef(false);

  const { isLoading } = useQuery({
    queryKey: ['activity', 'user', userId],
    queryFn: async () => {
      const data = await getUserActivity(userId, PAGE_INITIAL, 0);
      setEvents(data);
      setHasMore(data.length === PAGE_INITIAL);
      initialLoaded.current = true;
      return data;
    },
    staleTime: 30_000,
    enabled: !!userId && open,
  });

  async function loadMore() {
    setLoadingMore(true);
    const data = await getUserActivity(userId, PAGE_SIZE, events.length);
    setEvents(prev => [...prev, ...data]);
    setHasMore(data.length === PAGE_SIZE);
    setLoadingMore(false);
  }

  const { data: dbStats } = useQuery({
    queryKey: ['activity', 'user', userId, 'stats'],
    queryFn: () => getUserStats(userId),
    staleTime: 30_000,
    enabled: !!userId && open,
  });

  const stats = computeStats(events);
  const nonLoginEvents = events.filter(e => e.action !== 'login');

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header — sempre visível, clicável para expandir */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full px-5 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <h3 className="text-sm font-semibold text-gray-800">Engajamento</h3>
          <span className="text-[10px] text-gray-400 font-normal">ultimos 30 dias</span>
        </div>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <>
          {isLoading ? (
            <div className="px-5 py-4 border-t border-gray-100 flex items-center gap-2 text-sm text-gray-400">
              <svg className="w-4 h-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Carregando atividade...
            </div>
          ) : (
            <>
              {/* Barra de engajamento + ajuda */}
              <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
                <EngagementBar
                  score={dbStats?.engagement_score ?? 0}
                  lastLoginDays={stats.lastLogin ? daysAgo(stats.lastLogin.created_at) : null}
                />
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); setShowHelp(h => !h); }}
                  className="w-5 h-5 rounded-full border border-gray-300 text-gray-400 hover:text-blue-600 hover:border-blue-400 flex items-center justify-center text-[11px] font-bold leading-none transition-colors shrink-0"
                  title="Como o engajamento e calculado"
                >
                  ?
                </button>
              </div>

              {showHelp && (
                <div className="px-5 py-4 bg-blue-50 border-b border-blue-100 text-xs text-gray-700 space-y-2">
                  <p className="font-semibold text-gray-800">Como o engajamento e calculado?</p>
                  <p>O score (0–100) combina tres dimensoes dos ultimos 30 dias:</p>
                  <ul className="space-y-1.5 ml-1">
                    <li><span className="font-semibold">Frequencia (40%)</span> — dias distintos com atividade. 15+ dias = pontuacao maxima.</li>
                    <li><span className="font-semibold">Producao (40%)</span> — soma ponderada de acoes: leitura concluida (8 pts), marco criado (6), leitura adicionada (5), nota criada (3), edicoes (1). Maximo de 40 pontos.</li>
                    <li><span className="font-semibold">Recencia (20%)</span> — ultima acao produtiva: hoje (20 pts), 1–3 dias (15), 4–7 dias (10), 8–14 dias (5), 15+ dias (0).</li>
                  </ul>
                  <div className="flex items-center gap-3 pt-1 text-[11px] text-gray-500">
                    <span className="flex items-center gap-1"><span className="w-2 h-3 rounded-sm bg-green-500 inline-block" /> 70–100 Ativo</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-3 rounded-sm bg-blue-500 inline-block" /> 45–69 Regular</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-3 rounded-sm bg-amber-500 inline-block" /> 20–44 Pouco ativo</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-3 rounded-sm bg-red-500 inline-block" /> 1–19 Inativo</span>
                  </div>
                </div>
              )}

              {/* Indicadores (totais do banco) */}
              <div className="px-5 py-4 grid grid-cols-4 gap-4 border-b border-gray-100">
                <Indicator
                  label="Leituras"
                  value={dbStats?.readings ?? stats.readings}
                  sublabel={stats.readingsCompleted > 0 ? `${stats.readingsCompleted} concluida${stats.readingsCompleted > 1 ? 's' : ''}` : 'total'}
                  color="text-blue-600"
                  icon={
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  }
                />
                <Indicator
                  label="Marcos"
                  value={dbStats?.milestones ?? stats.milestones}
                  sublabel="total"
                  color="text-green-600"
                  icon={
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  }
                />
                <Indicator
                  label="Anotacoes"
                  value={dbStats?.notes ?? stats.notes}
                  sublabel="total"
                  color="text-purple-600"
                  icon={
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                    </svg>
                  }
                />
                <Indicator
                  label="Acessos"
                  value={dbStats?.logins ?? stats.logins}
                  sublabel="total"
                  color="text-amber-600"
                  icon={
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                    </svg>
                  }
                />
              </div>

              {/* Timeline */}
              {nonLoginEvents.length === 0 ? (
                <div className="px-5 py-6 text-center">
                  <p className="text-xs text-gray-400 italic">Nenhuma atividade registrada nos ultimos 30 dias.</p>
                </div>
              ) : (
                <>
                  <div className="divide-y divide-gray-50">
                    {nonLoginEvents.map(event => (
                      <div key={event.id} className="flex items-start gap-2.5 px-5 py-2.5 hover:bg-gray-50/50 transition-colors">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${ACTION_COLORS[event.action] || 'bg-gray-100 text-gray-500'}`}>
                          {ACTION_ICONS[event.action] || null}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-gray-700 leading-snug">
                            {ACTION_LABELS[event.action] || event.action}
                          </p>
                          {renderDetail(event)}
                        </div>
                        <span
                          className="text-[10px] text-gray-400 shrink-0 mt-0.5 tabular-nums"
                          title={formatFullDate(event.created_at)}
                        >
                          {formatRelativeTime(event.created_at)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {hasMore && (
                    <div className="border-t border-gray-100">
                      <button
                        type="button"
                        onClick={loadMore}
                        disabled={loadingMore}
                        className="w-full px-5 py-2.5 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50/50 transition-colors text-center font-medium disabled:opacity-50"
                      >
                        {loadingMore ? 'Carregando...' : 'Ver mais'}
                      </button>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
