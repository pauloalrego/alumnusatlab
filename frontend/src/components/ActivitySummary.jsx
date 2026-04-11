import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getUserActivity } from '../api';
import { slugify } from '../mentionUtils.jsx';

/* ── Constantes ─────────────────────────────────────────────────────────────── */

const ACTION_LABELS = {
  reading_created: 'adicionou uma leitura',
  reading_status_changed: 'atualizou status de leitura',
  milestone_created: 'criou um marco',
  milestone_updated: 'atualizou um marco',
  note_created: 'adicionou uma nota',
  note_updated: 'editou uma nota',
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
  const now = Date.now();
  const thirtyDays = 30 * 86400000;
  const recent = events.filter(e => now - new Date(e.created_at).getTime() < thirtyDays);

  const readings = recent.filter(e => e.action === 'reading_created').length;
  const readingsCompleted = recent.filter(e => e.action === 'reading_status_changed' && e.metadata_json?.to === 'lido').length;
  const milestones = recent.filter(e => e.action === 'milestone_created').length;
  const notes = recent.filter(e => e.action === 'note_created').length;
  const logins = recent.filter(e => e.action === 'login').length;

  const lastLogin = events.find(e => e.action === 'login');
  const lastAction = events.find(e => e.action !== 'login');

  return { readings, readingsCompleted, milestones, notes, logins, lastLogin, lastAction, total: recent.length };
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

function EngagementBar({ stats }) {
  const lastLoginDays = stats.lastLogin ? daysAgo(stats.lastLogin.created_at) : null;
  const lastActionDays = stats.lastAction ? daysAgo(stats.lastAction.created_at) : null;

  let engagementLevel, engagementColor, engagementLabel;
  if (lastActionDays === null) {
    engagementLevel = 0; engagementColor = 'bg-gray-300'; engagementLabel = 'Sem atividade';
  } else if (lastActionDays <= 3) {
    engagementLevel = 4; engagementColor = 'bg-green-500'; engagementLabel = 'Ativo';
  } else if (lastActionDays <= 7) {
    engagementLevel = 3; engagementColor = 'bg-blue-500'; engagementLabel = 'Regular';
  } else if (lastActionDays <= 14) {
    engagementLevel = 2; engagementColor = 'bg-amber-500'; engagementLabel = 'Pouco ativo';
  } else {
    engagementLevel = 1; engagementColor = 'bg-red-500'; engagementLabel = 'Inativo';
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
            ? (lastLoginDays === 0 ? 'Acessou hoje' : lastLoginDays === 1 ? 'Acessou ontem' : `Acessou ha ${lastLoginDays}d`)
            : 'Nunca acessou'}
        </p>
      </div>
    </div>
  );
}

/* ── Componente principal ───────────────────────────────────────────────────── */

export default function ActivitySummary({ userId, userName }) {
  const [expanded, setExpanded] = useState(false);

  const { data: events = [], isLoading } = useQuery({
    queryKey: ['activity', 'user', userId],
    queryFn: () => getUserActivity(userId, 100),
    staleTime: 30_000,
    enabled: !!userId,
  });

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4">
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <svg className="w-4 h-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Carregando atividade...
        </div>
      </div>
    );
  }

  const stats = computeStats(events);
  const nonLoginEvents = events.filter(e => e.action !== 'login');
  const previewEvents = nonLoginEvents.slice(0, 5);
  const expandedEvents = nonLoginEvents.slice(0, 30);
  const displayEvents = expanded ? expandedEvents : previewEvents;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <h3 className="text-sm font-semibold text-gray-800">Engajamento</h3>
          <span className="text-[10px] text-gray-400 font-normal">ultimos 30 dias</span>
        </div>
        <EngagementBar stats={stats} />
      </div>

      {/* Indicadores */}
      <div className="px-5 py-4 grid grid-cols-4 gap-4 border-b border-gray-100">
        <Indicator
          label="Leituras"
          value={stats.readings}
          sublabel={stats.readingsCompleted > 0 ? `${stats.readingsCompleted} concluida${stats.readingsCompleted > 1 ? 's' : ''}` : null}
          color="text-blue-600"
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          }
        />
        <Indicator
          label="Marcos"
          value={stats.milestones}
          color="text-green-600"
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <Indicator
          label="Notas"
          value={stats.notes}
          color="text-purple-600"
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
            </svg>
          }
        />
        <Indicator
          label="Acessos"
          value={stats.logins}
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
            {displayEvents.map(event => (
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

          {/* Expandir / recolher */}
          {nonLoginEvents.length > 5 && (
            <div className="border-t border-gray-100">
              <button
                type="button"
                onClick={() => setExpanded(prev => !prev)}
                className="w-full px-5 py-2.5 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50/50 transition-colors text-center font-medium"
              >
                {expanded
                  ? 'Mostrar menos'
                  : `Ver mais ${Math.min(nonLoginEvents.length, 30) - 5} eventos`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
