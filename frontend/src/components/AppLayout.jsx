import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Outlet, useOutletContext, useNavigate, Link, useLocation } from 'react-router-dom';
import Sidebar, { SidebarRail } from './Sidebar';
import { getGraph, getResearchers, getInstitutions, getMyEmails, updateMyProfile } from '../api';
import { removeToken, getTokenPayload, getMe } from '../auth';

function slugify(nome) {
  return (nome || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-');
}

function shortName(fullName) {
  const parts = (fullName || '').trim().split(/\s+/);
  if (parts.length <= 1) return fullName;
  return `${parts[0]} ${parts[parts.length - 1]}`;
}

const PRICING_HASH = '/#pricing';

/** Trial do professor: uma linha, fora do Link do logo (evita link aninhado). Clica → landing #pricing. */
function SidebarTrialHint({ user }) {
  const ownerPlanRole = user?.role === 'professor' || user?.role === 'superadmin';
  if (!user || !ownerPlanRole || user.plan_type !== 'trial') return null;
  const expired =
    user.plan_status === 'expired'
    || (user.trial_days_remaining != null && user.trial_days_remaining <= 0);
  const linkCls =
    'block text-xs leading-snug rounded-md -mx-1 px-1 py-0.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/80';
  if (expired) {
    return (
      <a href={PRICING_HASH} className={`${linkCls} font-medium text-red-700 hover:text-red-800 hover:underline`}>
        Trial encerrado
      </a>
    );
  }
  const n = user.trial_days_remaining;
  if (n == null) return null;
  const label = n === 1 ? 'Falta 1 dia de trial' : `Faltam ${n} dias de trial`;
  return (
    <a
      href={PRICING_HASH}
      className={`${linkCls} font-semibold text-amber-900 hover:text-amber-950 hover:underline`}
      title="Ver planos e preços"
    >
      {label}
    </a>
  );
}

function AppPageHeadingIcon({ name }) {
  const cls = 'w-5 h-5 shrink-0 text-blue-600';
  switch (name) {
    case 'grupo':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      );
    case 'reminders':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
      );
    case 'deadlines':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      );
    case 'manual':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      );
    case 'admin': {
      const adminCls = 'w-5 h-5 shrink-0 text-purple-600';
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className={adminCls} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      );
    }
    case 'plan':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
        </svg>
      );
    default:
      return null;
  }
}

/** Cabeçalho de perfil na topbar (dados via setProfileTopbar na ResearcherPage). */
function ProfileTopbarBlock({ data }) {
  const {
    nome,
    photoUrl,
    statusColor,
    statusLabel,
    email,
    lastLoginLine,
    onAvatarClick,
    uploadingPhoto,
  } = data;

  const avatarFace = photoUrl ? (
    <img src={photoUrl} alt="" className="w-10 h-10 rounded-full object-cover border-2" style={{ borderColor: statusColor }} />
  ) : (
    <div
      className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold border-2"
      style={{ backgroundColor: statusColor, borderColor: statusColor }}
    >
      {(nome || '?').charAt(0).toUpperCase()}
    </div>
  );

  const avatarOverlay = onAvatarClick ? (
    <span
      className={`absolute inset-0 rounded-full bg-black/40 flex items-center justify-center transition-opacity ${
        uploadingPhoto ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
      }`}
    >
      {uploadingPhoto ? (
        <svg className="w-4 h-4 text-white animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      )}
    </span>
  ) : null;

  return (
    <div className="flex items-center gap-2.5 min-w-0 flex-1">
      <div className="relative shrink-0">
        {onAvatarClick ? (
          <button
            type="button"
            onClick={onAvatarClick}
            disabled={uploadingPhoto}
            className="relative group rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:opacity-90"
            title="Alterar foto"
          >
            {avatarFace}
            {avatarOverlay}
          </button>
        ) : (
          <div className="relative rounded-full">
            {avatarFace}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-base font-bold text-gray-900 truncate leading-tight">{nome}</p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="text-xs px-2 py-0.5 rounded-full text-white shrink-0" style={{ backgroundColor: statusColor }}>
            {statusLabel}
          </span>
          {email ? <span className="text-xs text-gray-500 truncate">{email}</span> : null}
        </div>
        {lastLoginLine != null && lastLoginLine !== '' && (
          <p className="text-xs text-gray-400 truncate mt-0.5">{lastLoginLine}</p>
        )}
      </div>
    </div>
  );
}

export function useAppLayout() {
  return useOutletContext() ?? {};
}

export default function AppLayout() {
  const [researchers, setResearchers] = useState([]);
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(() => localStorage.getItem('sidebarOpen') !== 'false');
  const [loadingData, setLoadingData] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [institutionName, setInstitutionName] = useState(null);
  const [institutions, setInstitutions] = useState([]);
  const [currentInstitution, setCurrentInstitution] = useState(undefined);
  const [profileTopbar, setProfileTopbar] = useState(null);
  const [changePwOpen, setChangePwOpen] = useState(false);
  const [changePwNew, setChangePwNew] = useState('');
  const [changePwConfirm, setChangePwConfirm] = useState('');
  const [changePwError, setChangePwError] = useState('');
  const [changePwSaving, setChangePwSaving] = useState(false);
  const [instDropdownOpen, setInstDropdownOpen] = useState(false);
  const instDropdownRef = useRef(null);
  const settingsRef = useRef(null);
  const currentInstIdRef = useRef(null);
  const currentUserRef = useRef(null);
  const loadDataInFlight = useRef(false);
  const navigate = useNavigate();

  useEffect(() => { currentInstIdRef.current = currentInstitution?.id ?? null; }, [currentInstitution]);

  const loadData = useCallback(async () => {
    if (loadDataInFlight.current) return;
    loadDataInFlight.current = true;
    const instId = currentInstIdRef.current;
    try {
    const [graphData, researchersData] = await Promise.all([getGraph(instId), getResearchers(instId, true)]);
    // Include professor nodes in the researchers list so they appear in BoxView,
    // @ mentions, sidebar count, etc.
    const professorEntries = (graphData?.nodes || [])
      .filter(n => n.data?.status === 'professor')
      .map(n => ({
        id: n.id,
        nome: n.data.name,
        status: 'professor',
        ativo: true,
        _isProfessor: true,
        email: null,
        group_id: null,
        orientador_id: null,
        photo_url: n.data.photoUrl || null,
        photo_thumb_url: n.data.photoUrl || null,
        registered: true,
        matricula: null,
        curso: null,
        enrollment_date: null,
      }));
    setResearchers([...professorEntries, ...(researchersData || [])]);
    setNodes(
      (graphData?.nodes || []).map((n) => ({
        ...n,
        data: { ...n.data, name: shortName(n.data.name), researcherId: n.id },
      })),
    );
    setEdges(graphData?.edges || []);
    setLoadingData(false);
    } finally {
      loadDataInFlight.current = false;
    }
  }, []);

  // Reload data when institution changes
  useEffect(() => {
    if (currentInstitution !== undefined) loadData();
  }, [currentInstitution]); // eslint-disable-line

  function handleSetCurrentInstitution(inst) {
    setLoadingData(true);
    setCurrentInstitution(inst);
    setInstitutionName(inst.name);
    localStorage.setItem('selectedInstId', String(inst.id));
  }

  const refreshInstitutions = useCallback(async (selectId = null) => {
    const u = currentUserRef.current;
    if (!u) return;
    if (u.role === 'superadmin') {
      const list = await getInstitutions().catch(() => []);
      if (Array.isArray(list) && list.length > 0) {
        setInstitutions(list);
        const target = selectId ? list.find(i => i.id === selectId) : null;
        const chosen = target || list.find(i => i.id === (localStorage.getItem('selectedInstId') ? Number(localStorage.getItem('selectedInstId')) : null)) || list[0];
        setCurrentInstitution({ id: chosen.id, name: chosen.name });
        setInstitutionName(chosen.name);
        if (target) localStorage.setItem('selectedInstId', String(target.id));
      }
    } else if (u.role === 'professor') {
      const list = await getMyEmails().catch(() => []);
      if (Array.isArray(list) && list.length > 0) {
        const seen = new Set();
        const inst = list
          .map(e => ({ id: e.institution_id, name: e.institution_name }))
          .filter(i => { if (seen.has(i.id)) return false; seen.add(i.id); return true; });
        setInstitutions(inst);
        const target = selectId ? inst.find(i => i.id === selectId) : null;
        const chosen = target || inst.find(i => i.id === (localStorage.getItem('selectedInstId') ? Number(localStorage.getItem('selectedInstId')) : null)) || inst[0];
        setCurrentInstitution(chosen);
        setInstitutionName(chosen.name);
        if (target) localStorage.setItem('selectedInstId', String(target.id));
      }
    }
  }, []);

  useEffect(() => {
    getMe().then((u) => {
      if (u) {
        setCurrentUser(u);
        currentUserRef.current = u;
        const savedInstId = localStorage.getItem('selectedInstId') ? Number(localStorage.getItem('selectedInstId')) : null;
        if (u.role === 'superadmin') {
          getInstitutions().then(list => {
            if (Array.isArray(list) && list.length > 0) {
              setInstitutions(list);
              const preferred = savedInstId ? list.find(i => i.id === savedInstId) : null;
              const inst = preferred || list[0];
              setInstitutionName(inst.name);
              setCurrentInstitution({ id: inst.id, name: inst.name });
            } else {
              setCurrentInstitution(null);
            }
          }).catch(() => { setCurrentInstitution(null); });
        } else if (u.role === 'professor') {
          getMyEmails().then(list => {
            if (Array.isArray(list) && list.length > 0) {
              const seen = new Set();
              const inst = list
                .map(e => ({ id: e.institution_id, name: e.institution_name }))
                .filter(i => { if (seen.has(i.id)) return false; seen.add(i.id); return true; });
              setInstitutions(inst);
              const preferred = savedInstId ? inst.find(i => i.id === savedInstId) : null;
              const selected = preferred || inst[0];
              setInstitutionName(selected.name);
              setCurrentInstitution(selected);
            } else {
              setCurrentInstitution(null);
            }
          }).catch(() => { setCurrentInstitution(null); });
        } else if (u.institution_id) {
          // researcher: deriva instituição do perfil
          setCurrentInstitution({ id: u.institution_id, name: u.institution_name || '' });
          setInstitutionName(u.institution_name || '');
        } else {
          setCurrentInstitution(null);
        }
      }
    }).catch(() => {});
  }, []);

  // Fecha dropdowns ao clicar fora
  useEffect(() => {
    function handler(e) {
      if (settingsRef.current && !settingsRef.current.contains(e.target)) setSettingsOpen(false);
      if (instDropdownRef.current && !instDropdownRef.current.contains(e.target)) setInstDropdownOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const setSidebarOpenPersist = useCallback((next) => {
    setSidebarOpen((prev) => {
      const value = typeof next === 'function' ? next(prev) : next;
      localStorage.setItem('sidebarOpen', String(value));
      return value;
    });
  }, []);

  function handleLogout() {
    removeToken();
    window.location.href = '/';
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    if (changePwNew.length < 6) { setChangePwError('A senha deve ter ao menos 6 caracteres'); return; }
    if (changePwNew !== changePwConfirm) { setChangePwError('As senhas não coincidem'); return; }
    setChangePwSaving(true);
    setChangePwError('');
    await updateMyProfile({ password: changePwNew });
    setChangePwSaving(false);
    setChangePwOpen(false);
    setChangePwNew('');
    setChangePwConfirm('');
  }

  const payload = getTokenPayload();
  const userName =
    (currentUser?.nome && String(currentUser.nome).trim())
    || (payload?.nome && String(payload.nome).trim())
    || currentUser?.email
    || payload?.email
    || 'Usuário';

  function greeting() {
    const h = new Date().getHours();
    if (h < 12) return 'Bom dia';
    if (h < 18) return 'Boa tarde';
    return 'Boa noite';
  }
  const firstName = userName.split(' ')[0];

  const myResearcher = researchers.find(r => r.id === payload?.researcher_id);
  const profileSlug = myResearcher
    ? slugify(myResearcher.nome)
    : payload?.professor_id
      ? slugify(userName)
      : null;

  const updateGraphNodePosition = useCallback((nodeId, position) => {
    setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, position } : n));
  }, []);

  const outletContext = useMemo(
    () => ({
      sidebarOpen,
      setSidebarOpen: setSidebarOpenPersist,
      researchers,
      loadData,
      graphNodes: nodes,
      graphEdges: edges,
      updateGraphNodePosition,
      currentUser,
      setProfileTopbar,
      currentInstitution,
      setCurrentInstitution: handleSetCurrentInstitution,
      institutions,
      refreshInstitutions,
    }),
    [sidebarOpen, setSidebarOpenPersist, researchers, loadData, nodes, edges, updateGraphNodePosition, currentUser, currentInstitution, institutions, refreshInstitutions],
  );

  const { pathname } = useLocation();

  useEffect(() => {
    if (!pathname.startsWith('/app/profile/')) setProfileTopbar(null);
  }, [pathname]);
  const pageHeading = useMemo(() => {
    const p = pathname || '/';
    if (p === '/app/group') return { title: 'Grupo', icon: 'grupo' };
    if (p === '/app/manual' || p.startsWith('/app/manual/')) return { title: 'Manual de Sobrevivência', icon: 'manual' };
    if (p === '/app/reminders') return { title: 'Lembretes', icon: 'reminders' };
    if (p === '/app/deadlines') return { title: 'Próximos deadlines', icon: 'deadlines' };
    if (p === '/app/admin') return { title: 'Dashboard', icon: 'admin' };
    if (p === '/app/plan') return { title: 'Meu Plano', icon: 'plan' };
    return null;
  }, [pathname]);

  return (
    <div className="h-screen flex">
      {/* Sidebar */}
      <aside
        className={`shrink-0 h-screen border-r bg-gray-100 flex flex-col transition-[width] duration-200 ease-out overflow-hidden ${
          sidebarOpen ? 'w-80' : 'w-[3.25rem]'
        }`}
      >
        {sidebarOpen ? (
          <>
            <div className="p-4 border-b bg-white shrink-0">
              <Link to="/app/group" className="group flex items-start gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <h1 className="text-base font-bold text-blue-700 group-hover:text-blue-800 leading-tight">Alumnus</h1>
                  {institutions.length <= 1 && (
                    <p className="text-xs text-gray-500 leading-tight">{institutionName || 'Rede de pesquisa'}</p>
                  )}
                </div>
              </Link>
              {institutions.length > 1 && (
                <div className="mt-1 pl-9 relative" ref={instDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setInstDropdownOpen(o => !o)}
                    className="w-full flex items-center justify-between gap-1 text-xs text-gray-700 border rounded-md px-2 py-1.5 bg-white hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-blue-300 transition-colors"
                  >
                    <span className="truncate">{currentInstitution?.name || 'Selecionar'}</span>
                    <svg className={`w-3 h-3 shrink-0 text-gray-400 transition-transform ${instDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {instDropdownOpen && (
                    <div className="absolute left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg py-1 z-50 max-h-48 overflow-y-auto">
                      {institutions.map(inst => (
                        <button
                          key={inst.id}
                          type="button"
                          onClick={() => { handleSetCurrentInstitution(inst); setInstDropdownOpen(false); }}
                          className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                            inst.id === currentInstitution?.id
                              ? 'bg-blue-50 text-blue-700 font-medium'
                              : 'text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          {inst.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

            </div>
            <div className="flex-1 min-h-0 min-w-0 overflow-y-auto">
              <Sidebar
                researchers={researchers}
                onRefresh={loadData}
                role={payload?.role}
                isAdmin={['professor','superadmin'].includes(payload?.role)}
                currentUser={currentUser}
                currentInstitution={currentInstitution}
                institutions={institutions}
                profileSlug={profileSlug}
              />
            </div>
            <div className="shrink-0 py-2.5 px-4 border-t border-gray-200/80 bg-white">
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Sair
              </button>
            </div>
          </>
        ) : (
          <SidebarRail
            researchers={researchers}
            onExpand={() => setSidebarOpenPersist(true)}
            onLogout={handleLogout}
            currentUser={currentUser}
            role={payload?.role}
            isAdmin={['professor','superadmin'].includes(payload?.role)}
            currentInstitution={currentInstitution}
            profileSlug={profileSlug}
          />
        )}
      </aside>

      {/* Conteúdo principal */}
      <div className="flex-1 min-h-0 min-w-0 flex flex-col">
        {/* Topbar */}
        <header
          className={`relative shrink-0 bg-white border-b flex items-center justify-between px-4 gap-3 z-30 ${
            profileTopbar ? 'min-h-[3.25rem] py-1.5' : 'h-12'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {sidebarOpen && (
              <button
                type="button"
                aria-label="Recolher menu"
                title="Recolher menu"
                onClick={() => setSidebarOpenPersist((o) => !o)}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 shrink-0"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7M18 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            {profileTopbar ? (
              <ProfileTopbarBlock data={profileTopbar} />
            ) : pageHeading ? (
              <div className="flex items-center gap-2 min-w-0">
                <AppPageHeadingIcon name={pageHeading.icon} />
                <h1 className="text-base font-bold text-gray-900 truncate">{pageHeading.title}</h1>
              </div>
            ) : null}
          </div>

          {/* Centro: trial hint */}
          <div className="absolute left-1/2 -translate-x-1/2">
            <SidebarTrialHint user={currentUser} />
          </div>

          {/* Direita: saudação + configurações */}
          <div className="flex items-center gap-2">
            <span className="hidden sm:block text-sm text-gray-400">
              {greeting()},{' '}
              {profileSlug ? (
                <Link to={`/app/profile/${profileSlug}`} className="font-medium text-gray-600 hover:text-blue-600 transition-colors">
                  {firstName}
                </Link>
              ) : (
                <span className="font-medium text-gray-600">{firstName}</span>
              )}
            </span>
            {currentUser?.plan_type === 'trial' && currentUser?.role === 'professor' && (
              <Link to="/app/plan" className="text-[10px] font-bold uppercase tracking-wider bg-red-100 text-red-600 px-2 py-0.5 rounded-full border border-red-200 hover:bg-red-200 transition-colors">
                Trial
              </Link>
            )}
            {/* Configurações */}
            <div className="relative" ref={settingsRef}>
              <button
                type="button"
                aria-label="Configurações"
                title="Configurações"
                aria-expanded={settingsOpen}
                onClick={() => setSettingsOpen((o) => !o)}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>

              {settingsOpen && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-white border rounded-xl shadow-lg z-50 py-1 overflow-hidden">
                  {['professor','superadmin'].includes(payload?.role) && (
                    <>
                      <button
                        type="button"
                        onClick={() => { setSettingsOpen(false); navigate('/app/admin'); }}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-purple-700 hover:bg-purple-50"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-purple-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                        Dashboard
                      </button>
                      <button
                        type="button"
                        onClick={() => { setSettingsOpen(false); navigate('/app/institutions'); }}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                        Instituição
                      </button>
                    </>
                  )}
                  {profileSlug && (
                    <button
                      type="button"
                      onClick={() => { setSettingsOpen(false); navigate(`/app/profile/${profileSlug}`); }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      Meu perfil
                    </button>
                  )}
                  {payload?.role === 'professor' && (
                    <button
                      type="button"
                      onClick={() => { setSettingsOpen(false); navigate('/app/plan'); }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                      </svg>
                      Plano
                    </button>
                  )}
                  <div className="border-t mx-2 my-1" />
                  <button
                    type="button"
                    onClick={() => { setSettingsOpen(false); handleLogout(); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Sair
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto relative">
          {loadingData && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/70 backdrop-blur-sm">
              <svg className="w-8 h-8 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            </div>
          )}
          <Outlet context={outletContext} />
        </div>
      </div>
    </div>
  );
}
