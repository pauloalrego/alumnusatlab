import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ResearcherForm from './ResearcherForm';
import { deleteResearcher, getProfessors, getGroups, updateGroup, getReminders, createReminder, updateReminder, deleteReminder, getDeadlines, deleteDeadline, getTips } from '../api';
import { keys } from '../queryKeys';
import { canDeleteReminder, creatorDisplayName, isReminderFromSomeoneElse } from '../reminderAccess';
import { slugify } from '../mentionUtils.jsx';
import RichEditor from './RichEditor';
import RichContent from './RichContent';
import { isModEnter } from '../platform';
import { daysUntil } from '../deadlines';
import { useConfirm } from './ConfirmModal';

function today() {
  return new Date().toISOString().split('T')[0];
}

function RemindersDropdown({ rail = false, currentUser = null, researchers = [], institutionId = null }) {
  const [open, setOpen] = useState(false);
  const [showOld, setShowOld] = useState(false);
  const [text, setText] = useState('');
  const [date, setDate] = useState(today());
  const [error, setError] = useState('');
  const ref = useRef();
  const dateRef = useRef();
  const navigate = useNavigate();

  const queryClient = useQueryClient();
  const instId = institutionId;
  const { data: reminders = [] } = useQuery({
    queryKey: keys.reminders(instId),
    queryFn: () => getReminders(instId),
    enabled: instId !== undefined,
    staleTime: 30_000,
  });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: keys.reminders(instId) });

  const createMutation = useMutation({
    mutationFn: ({ text: t, date: d }) => createReminder({ text: t.trim(), due_date: d }, instId),
    onSuccess: () => { invalidate(); setText(''); setDate(''); },
    onError: () => setError('Erro ao adicionar lembrete'),
  });

  const toggleMutation = useMutation({
    mutationFn: (r) => updateReminder(r.id, { done: !r.done }),
    onSuccess: () => invalidate(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteReminder(id),
    onSuccess: () => invalidate(),
    onError: (e) => setError(e?.message || 'Não foi possível remover'),
  });

  useEffect(() => {
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function handleAdd(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (!text.trim() || !date) return;
    setError('');
    createMutation.mutate({ text, date });
  }

  function toggleDone(r) { toggleMutation.mutate(r); }

  function handleDelete(id) {
    setError('');
    deleteMutation.mutate(id);
  }

  const todayStr = today();
  const upcoming = reminders
    .filter(r => !r.done && r.due_date >= todayStr)
    .sort((a, b) => a.due_date.localeCompare(b.due_date));
  const old = reminders
    .filter(r => !r.done && r.due_date < todayStr)
    .sort((a, b) => b.due_date.localeCompare(a.due_date));

  const bellIcon = (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  );

  return (
    <div className="relative" ref={ref}>
      {rail ? (
        <button
          type="button"
          title="Lembretes"
          onClick={() => navigate('/app/reminders')}
          className="relative w-11 h-11 flex items-center justify-center bg-white border rounded-lg text-gray-700 shadow-sm hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 transition-colors"
        >
          {bellIcon}
          {upcoming.length > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[1.125rem] h-[1.125rem] flex items-center justify-center bg-blue-600 text-white text-[10px] font-bold rounded-full px-0.5 leading-none">
              {upcoming.length > 9 ? '9+' : upcoming.length}
            </span>
          )}
        </button>
      ) : (
        <div className="w-full flex items-center bg-white border rounded-lg text-sm text-gray-700 shadow-sm overflow-hidden">
          <Link
            to="/app/reminders"
            className="flex items-center gap-2 flex-1 px-3 py-2 hover:bg-blue-50 hover:text-blue-700 transition-colors min-w-0"
          >
            {bellIcon}
            <span className="flex-1 text-left truncate">Lembretes</span>
            {upcoming.length > 0 && (
              <span className="bg-blue-600 text-white text-xs rounded-full px-1.5 py-0.5 leading-none shrink-0">{upcoming.length}</span>
            )}
          </Link>
          <button
            type="button"
            onClick={() => setOpen(o => !o)}
            className="px-2 py-2 border-l hover:bg-blue-50 hover:text-blue-700 transition-colors text-gray-400 shrink-0"
            title="Expandir"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      )}

      {open && (
        <div
          className={
            rail
              ? 'absolute left-full top-0 ml-1 w-80 max-h-[min(28rem,calc(100vh-6rem))] overflow-y-auto bg-white border rounded-xl shadow-lg z-[60] overflow-x-hidden'
              : 'absolute left-0 right-0 top-full mt-1 bg-white border rounded-xl shadow-lg z-50 overflow-hidden'
          }
        >
          {/* Caixa de criação */}
          <div className="p-3 border-b bg-gray-50">
            <form onSubmit={handleAdd} className="space-y-2">
              <RichEditor
                variant="compact"
                researchers={researchers}
                value={text}
                onChange={setText}
                onSubmit={handleAdd}
                placeholder="Novo lembrete... (@ para mencionar)"
                className="text-sm"
              />
              <div className="flex items-center gap-2">
                <label className="flex-1 flex items-center gap-1.5 border rounded px-2 py-1.5 text-sm text-gray-600 cursor-pointer hover:border-blue-400 hover:text-blue-600 transition-colors bg-white">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span>{date ? new Date(date + 'T00:00:00').toLocaleDateString('pt-BR') : 'Selecionar data'}</span>
                  <input
                    ref={dateRef}
                    type="date"
                    className="sr-only"
                    value={date}
                    min={todayStr}
                    onChange={e => setDate(e.target.value)}
                  />
                </label>
                <button
                  type="submit"
                  disabled={createMutation.isPending || !text.trim() || !date}
                  className="bg-blue-600 text-white px-3 py-1.5 rounded text-xs hover:bg-blue-700 disabled:opacity-40"
                >
                  +
                </button>
              </div>
              {error && <p className="text-xs text-red-500">{error}</p>}
            </form>
          </div>

          {/* Caixa de listagem */}
          <div className="py-1">
            {upcoming.length === 0 && old.length === 0 && (
              <p className="text-xs text-gray-400 italic text-center py-3">Nenhum lembrete.</p>
            )}
            <ul className="divide-y divide-gray-100 max-h-56 overflow-y-auto">
              {upcoming.map(r => {
                const days = daysUntil(r.due_date);
                const urgent = days <= 3;
                return (
                  <li key={r.id} className="group flex items-start gap-2 px-3 py-2.5 hover:bg-gray-50 transition-colors">
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <RichContent html={r.text} researchers={researchers} inline className="text-sm text-gray-800 leading-snug break-words" />
                      <p className="text-xs text-gray-500">
                        <span className="text-gray-800">{creatorDisplayName(r, { viewerName: currentUser?.nome })}</span>
                        {' · '}
                        <span className={urgent ? 'text-orange-500 font-medium' : ''}>
                          {days === 0 ? 'Hoje!' : `${days}d`} · {new Date(r.due_date + 'T00:00:00').toLocaleDateString('pt-BR')}
                        </span>
                      </p>
                    </div>
                    {canDeleteReminder(r) && (
                      <button type="button" onClick={() => handleDelete(r.id)} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 shrink-0 mt-0.5 transition-colors" title="Remover">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>

            {old.length > 0 && (
              <div className="border-t">
                <button
                  onClick={() => setShowOld(o => !o)}
                  className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 w-full px-3 py-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {old.length} atrasado{old.length > 1 ? 's' : ''}
                </button>
                {showOld && (
                  <ul className="divide-y divide-gray-100 max-h-40 overflow-y-auto opacity-70">
                    {old.map(r => (
                      <li key={r.id} className="group flex items-start gap-2 px-3 py-2.5 hover:bg-gray-50 transition-colors">
                        <div className="flex-1 min-w-0 space-y-0.5">
                          <RichContent html={r.text} researchers={researchers} inline className="text-sm text-gray-700 leading-snug break-words" />
                          <p className="text-xs text-gray-500">
                            <span className="text-gray-800">{creatorDisplayName(r, { viewerName: currentUser?.nome })}</span>
                            {' · '}
                            <span className="text-red-400">Atrasado · {new Date(r.due_date + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                          </p>
                        </div>
                        {canDeleteReminder(r) && (
                          <button type="button" onClick={() => handleDelete(r.id)} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 shrink-0 mt-0.5 transition-colors" title="Remover">
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Dropdown({ label, icon, badge, alwaysBadge = false, children, rail = false, linkTo, onLabelClick, disabled = false }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();

  useEffect(() => {
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const chevron = (
    <svg xmlns="http://www.w3.org/2000/svg" className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
    </svg>
  );

  return (
    <div className="relative" ref={ref}>
      {/* Modo expandido com link separado no label */}
      {!rail && linkTo ? (
        <div className="w-full flex items-center bg-white border rounded-lg text-sm text-gray-700 shadow-sm overflow-hidden">
          <Link
            to={linkTo}
            className="flex items-center gap-2 flex-1 px-3 py-2 hover:bg-blue-50 hover:text-blue-700 transition-colors min-w-0"
            onDoubleClick={(e) => { if (onLabelClick) { e.preventDefault(); onLabelClick(); } }}
          >
            {icon}
            <span className="flex-1 text-left truncate">{label}</span>
            {badge != null && (alwaysBadge || badge > 0) && (
              <span className="bg-blue-600 text-white text-xs rounded-full px-1.5 py-0.5 leading-none shrink-0">{badge}</span>
            )}
          </Link>
          {!disabled && (
            <button
              type="button"
              onClick={() => setOpen(o => !o)}
              className="px-2 py-2 border-l hover:bg-blue-50 hover:text-blue-700 transition-colors text-gray-400 shrink-0"
              title="Expandir"
            >
              {chevron}
            </button>
          )}
        </div>
      ) : (
        <button
          type="button"
          title={rail ? label : undefined}
          onClick={() => setOpen(o => !o)}
          className={
            rail
              ? 'relative w-11 h-11 flex items-center justify-center bg-white border rounded-lg text-gray-700 shadow-sm hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 transition-colors'
              : 'w-full flex items-center gap-2 bg-white border rounded-lg px-3 py-2 text-sm text-gray-700 shadow-sm hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 transition-colors'
          }
        >
          {icon}
          {!rail && (
            <>
              <span className="flex-1 text-left">{label}</span>
              {badge != null && badge > 0 && (
                <span className="bg-blue-600 text-white text-xs rounded-full px-1.5 py-0.5 leading-none">{badge}</span>
              )}
              {chevron}
            </>
          )}
          {rail && badge != null && badge > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[1.125rem] h-[1.125rem] flex items-center justify-center bg-blue-600 text-white text-[10px] font-bold rounded-full px-0.5 leading-none">
              {badge > 9 ? '9+' : badge}
            </span>
          )}
        </button>
      )}
      {open && (
        <div
          className={
            rail
              ? 'absolute left-full top-0 ml-1 w-72 max-h-[min(24rem,calc(100vh-6rem))] overflow-y-auto bg-white border rounded-xl shadow-lg z-[60] p-3'
              : 'absolute left-0 right-0 top-full mt-1 bg-white border rounded-xl shadow-lg z-50 p-3'
          }
        >
          {children}
        </div>
      )}
    </div>
  );
}

const GROUP_ICON = (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const CALENDAR_ICON = (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const BOOK_ICON = (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
  </svg>
);

const INSTITUTION_ICON = (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
  </svg>
);

const PROFILE_ICON = (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);

/** Barra estreita com ícones quando o menu principal está recolhido */
export function SidebarRail({ researchers, onExpand, onLogout, currentUser = null, role = null, isAdmin = false, currentInstitution = undefined, profileSlug = null }) {
  const instId = currentInstitution !== undefined ? (currentInstitution?.id ?? null) : undefined;
  const { data: railDeadlines = [] } = useQuery({
    queryKey: keys.deadlines(instId),
    queryFn: () => getDeadlines(instId),
    enabled: instId !== undefined,
    staleTime: 30_000,
  });
  const upcomingDeadlines = railDeadlines.filter(d => daysUntil(d.date) >= 0);

  return (
    <div className="flex flex-col flex-1 min-h-0 h-full bg-gray-100">
      <div className="flex flex-col items-center gap-2.5 py-3 px-1.5 flex-1 min-h-0 overflow-y-auto overscroll-contain">
        <button
          type="button"
          onClick={onExpand}
          className="w-11 h-11 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 shadow-sm hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 transition-colors shrink-0"
          title="Expandir menu"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M6 5l7 7-7 7" />
          </svg>
        </button>

        {profileSlug && (
          <Link
            to={`/app/profile/${profileSlug}`}
            title="Meu perfil"
            className="w-11 h-11 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 shadow-sm hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 transition-colors shrink-0"
          >
            {PROFILE_ICON}
          </Link>
        )}

        <Link
          to="/app/group"
          title="Grupo — ir para o grafo"
          className="relative w-11 h-11 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 shadow-sm hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 transition-colors shrink-0"
        >
          {GROUP_ICON}
          {researchers.length > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[1.125rem] h-[1.125rem] flex items-center justify-center bg-blue-600 text-white text-[10px] font-bold rounded-full px-0.5 leading-none">
              {researchers.length > 9 ? '9+' : researchers.length}
            </span>
          )}
        </Link>

        <RemindersDropdown rail currentUser={currentUser} institutionId={currentInstitution === undefined ? undefined : (currentInstitution?.id ?? null)} />

        <Link
          to="/app/deadlines"
          title="Deadlines"
          className="relative w-11 h-11 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 shadow-sm hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 transition-colors shrink-0"
        >
          {CALENDAR_ICON}
          {upcomingDeadlines.length > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[1.125rem] h-[1.125rem] flex items-center justify-center bg-blue-600 text-white text-[10px] font-bold rounded-full px-0.5 leading-none">
              {upcomingDeadlines.length > 9 ? '9+' : upcomingDeadlines.length}
            </span>
          )}
        </Link>

        <Link
          to="/app/manual"
          title="Manual de Sobrevivência"
          className="w-11 h-11 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 shadow-sm hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 transition-colors shrink-0"
        >
          {BOOK_ICON}
        </Link>

        {(role === 'professor' || role === 'superadmin') && (
          <Link
            to="/app/activity"
            title="Atividade dos orientandos"
            className="w-11 h-11 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 shadow-sm hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 transition-colors shrink-0"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </Link>
        )}
      </div>

      <div className="shrink-0 py-2.5 flex justify-center border-t border-gray-200/80 bg-white">
        <button
          type="button"
          onClick={onLogout}
          className="w-11 h-11 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
          title="Sair"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default function Sidebar({ researchers, onRefresh, role, isAdmin = false, currentUser = null, currentInstitution = undefined, institutions = [], profileSlug = null }) {
  const [view, setView] = useState('list');
  const [editResearcher, setEditResearcher] = useState(null);
  const [currentGroup, setCurrentGroup] = useState(null);
  const [groupLabel, setGroupLabel] = useState('Grupo');
  const [renamingGroup, setRenamingGroup] = useState(false);
  const [renameInput, setRenameInput] = useState('');
  const { confirm, modal: confirmModal } = useConfirm();

  const queryClient = useQueryClient();
  const instId = currentInstitution !== undefined ? (currentInstitution?.id ?? null) : undefined;

  const { data: sidebarDeadlines = [] } = useQuery({
    queryKey: keys.deadlines(instId),
    queryFn: () => getDeadlines(instId),
    enabled: instId !== undefined,
    staleTime: 30_000,
  });

  const { data: sidebarTips = [] } = useQuery({
    queryKey: keys.tips(instId),
    queryFn: () => getTips(instId),
    enabled: instId !== undefined,
    staleTime: 30_000,
  });
  const sidebarTipCount = sidebarTips.length;

  const { data: professors = [] } = useQuery({
    queryKey: keys.professors(),
    queryFn: getProfessors,
    enabled: isAdmin,
    staleTime: 30_000,
  });

  const { data: allGroups = [] } = useQuery({
    queryKey: keys.groups(),
    queryFn: getGroups,
    enabled: instId !== undefined,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!Array.isArray(allGroups) || allGroups.length === 0) return;
    const filtered = instId != null
      ? allGroups.filter(g => g.institution_id === instId)
      : allGroups;
    const first = filtered[0] || allGroups[0] || null;
    if (first) { setCurrentGroup(first); setGroupLabel(first.name); }
  }, [allGroups, instId]); // eslint-disable-line

  function handleEdit(s) { setEditResearcher(s); setView('researcher-form'); }

  async function handleDeactivate(id) {
    if (!await confirm({ title: 'Inativar este pesquisador?', confirmLabel: 'Inativar', variant: 'warning' })) return;
    await deleteResearcher(id);
    onRefresh();
  }

  function handleSaved() { setView('list'); setEditResearcher(null); onRefresh(); }

  async function handleRenameGroup() {
    const name = renameInput.trim() || 'Grupo';
    setGroupLabel(name);
    setRenamingGroup(false);
    if (currentGroup) {
      try {
        const updated = await updateGroup(currentGroup.id, { name });
        if (updated?.name) setGroupLabel(updated.name);
      } catch {
        // silently ignore if update fails
      }
    }
  }

  if (view === 'researcher-form') {
    return (
      <div className="p-4">
        <ResearcherForm researcher={editResearcher} professors={professors} institutions={institutions} onSaved={handleSaved}
          onCancel={() => { setView('list'); setEditResearcher(null); }} />
      </div>
    );
  }

  const upcomingDeadlines = sidebarDeadlines.filter(d => daysUntil(d.date) >= 0);

  return (
    <div className="p-4 space-y-2 overflow-y-auto h-full">
      {confirmModal}

      {/* Meu perfil */}
      {profileSlug && (
        <Link
          to={`/app/profile/${profileSlug}`}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-700 bg-white border border-gray-200 shadow-sm hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 transition-colors"
        >
          {PROFILE_ICON}
          <span className="font-medium">Meu perfil</span>
        </Link>
      )}

      {/* Grupo */}
      {renamingGroup ? (
        <div className="w-full flex items-center gap-1 bg-white border rounded-lg px-2 py-1.5 shadow-sm">
          {GROUP_ICON}
          <input
            autoFocus
            className="flex-1 border rounded px-2 py-1 text-sm min-w-0"
            value={renameInput}
            onChange={e => setRenameInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleRenameGroup();
              if (e.key === 'Escape') setRenamingGroup(false);
            }}
          />
          <button onClick={handleRenameGroup} className="text-xs bg-blue-600 text-white rounded px-2 py-1 hover:bg-blue-700 shrink-0">OK</button>
          <button onClick={() => setRenamingGroup(false)} className="text-xs text-gray-400 hover:text-gray-600 px-1 shrink-0">✕</button>
        </div>
      ) : (
      <Dropdown
        label={groupLabel}
        icon={GROUP_ICON}
        badge={researchers.length}
        linkTo="/app/group"
        onLabelClick={isAdmin ? () => { setRenameInput(groupLabel); setRenamingGroup(true); } : undefined}
        disabled={researchers.length === 0}
      >
        <ul className="space-y-1">
          {researchers.map((s) => (
            <li key={s.id} className="flex items-center justify-between rounded px-1 py-1 text-sm hover:bg-gray-50">
              <Link to={`/app/profile/${slugify(s.nome)}`} className="flex-1 truncate hover:text-blue-600">{s.nome}</Link>
              {(role === 'professor' || isAdmin) && !s._isProfessor && (
                <span className="flex gap-1 shrink-0 ml-1">
                  <button onClick={() => handleEdit(s)} title="Editar" className="text-blue-500 hover:text-blue-700 p-0.5">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button onClick={() => handleDeactivate(s.id)} title="Inativar" className="text-red-400 hover:text-red-600 p-0.5">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                    </svg>
                  </button>
                </span>
              )}
            </li>
          ))}
        </ul>
      </Dropdown>
      )}

      {/* Lembretes */}
      <RemindersDropdown currentUser={currentUser} researchers={researchers} institutionId={currentInstitution === undefined ? undefined : (currentInstitution?.id ?? null)} />

      {/* Deadlines */}
      <Dropdown label="Próximos deadlines" icon={CALENDAR_ICON} badge={upcomingDeadlines.length} linkTo="/app/deadlines" disabled={sidebarDeadlines.length <= 1}>
        {(() => {
          const pastDeadlines = sidebarDeadlines.filter(d => daysUntil(d.date) < 0).sort((a, b) => new Date(b.date) - new Date(a.date));
          const canDeleteDeadline = (d) => isAdmin || d.created_by_id === currentUser?.id;
          async function handleDeleteDeadline(id) {
            try {
              await deleteDeadline(id);
              queryClient.invalidateQueries({ queryKey: keys.deadlines(instId) });
            } catch {}
          }
          return (
            <ul className="space-y-1.5">
              {upcomingDeadlines.map((d) => {
                const days = daysUntil(d.date);
                return (
                  <li key={d.id} className="group rounded px-1 py-1 flex items-start gap-1">
                    <div className="flex-1 min-w-0">
                      <a href={d.url} target="_blank" rel="noreferrer" className="text-sm font-medium text-blue-600 hover:underline block truncate">{d.label}</a>
                      <span className={`text-xs ${days <= 14 ? 'text-red-500 font-semibold' : 'text-gray-400'}`}>
                        {days === 0 ? 'Hoje!' : `${days}d`} · {new Date(d.date + 'T00:00:00').toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                    {canDeleteDeadline(d) && (
                      <button type="button" onClick={() => handleDeleteDeadline(d.id)}
                        className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-colors shrink-0 mt-0.5">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </li>
                );
              })}
              {pastDeadlines.length > 0 && <li className="border-t my-1" />}
              {pastDeadlines.map((d) => (
                <li key={d.id} className="group rounded px-1 py-1 flex items-start gap-1 opacity-40">
                  <div className="flex-1 min-w-0">
                    <a href={d.url} target="_blank" rel="noreferrer" className="text-sm font-medium text-blue-600 hover:underline block truncate">{d.label}</a>
                    <span className="text-xs text-gray-400">Encerrado · {new Date(d.date + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                  </div>
                  {canDeleteDeadline(d) && (
                    <button type="button" onClick={() => handleDeleteDeadline(d.id)}
                      className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-colors shrink-0 mt-0.5">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </li>
              ))}
            </ul>
          );
        })()}
      </Dropdown>

      {/* Manual de Sobrevivência */}
      <Link
        to="/app/manual"
        className="w-full flex items-center gap-2 bg-white border rounded-lg px-3 py-2 text-sm text-gray-700 shadow-sm hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 transition-colors"
      >
        {BOOK_ICON}
        <span className="flex-1">Manual de Sobrevivência</span>
        {sidebarTipCount > 0 && (
          <span className="bg-blue-600 text-white text-xs rounded-full px-1.5 py-0.5 leading-none shrink-0">{sidebarTipCount}</span>
        )}
      </Link>

      {/* Atividade dos orientandos (apenas professor) */}
      {(role === 'professor' || role === 'superadmin') && (
        <Link
          to="/app/activity"
          className="w-full flex items-center gap-2 bg-white border rounded-lg px-3 py-2 text-sm text-gray-700 shadow-sm hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <span className="flex-1">Atividade dos Orientandos</span>
        </Link>
      )}

    </div>
  );
}
