import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAdminStats, getAdminUsers, updateUserRole, deleteUser, deletePendingResearcher, bulkDeleteUsers, createResearcher, inviteProfessor } from '../api';
import { keys } from '../queryKeys';
import { getTokenPayload } from '../auth';
import { useAppLayout } from '../components/AppLayout';
import Toast from '../components/Toast';
import { useConfirm } from '../components/ConfirmModal';
import { isPublicEmailDomain, INSTITUTIONAL_EMAIL_ERROR_PT } from '../institutionalEmail';

const ROLE_LABELS = { superadmin: 'Superadmin', professor: 'Professor', researcher: 'Aluno' };
const STATUS_LABELS = { graduacao: 'Graduação', mestrado: 'Mestrado', doutorado: 'Doutorado', postdoc: 'Pós-doc', professor: 'Professor' };
const STATUS_COLORS = {
  professor: 'bg-purple-100 text-purple-700 border-purple-200',
  postdoc:    'bg-cyan-100 text-cyan-700 border-cyan-200',
  doutorado: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  mestrado:  'bg-amber-100 text-amber-700 border-amber-200',
  graduacao: 'bg-blue-100 text-blue-700 border-blue-200',
};
const ROLE_COLORS = {
  superadmin: 'bg-red-100 text-red-700 border-red-200',
  admin:      'bg-purple-100 text-purple-700 border-purple-200',
  professor:  'bg-blue-100 text-blue-700 border-blue-200',
  researcher: 'bg-green-100 text-green-700 border-green-200',
  pending:    'bg-gray-100 text-gray-500 border-gray-200',
};

function StatCard({ label, value, color = 'text-blue-600' }) {
  return (
    <div className="bg-white rounded-xl border shadow-sm p-5 flex flex-col gap-1">
      <span className={`text-3xl font-bold ${color}`}>{value ?? '—'}</span>
      <span className="text-sm text-gray-500">{label}</span>
    </div>
  );
}

function shortName(nome) {
  if (!nome) return '';
  const parts = nome.trim().split(/\s+/);
  if (parts.length <= 2) return nome;
  return `${parts[0]} ${parts[parts.length - 1]}`;
}

function slugify(nome) {
  return (nome || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-');
}

const ROLE_ORDER = { superadmin: 0, professor: 1, researcher: 2 };

function sortUsers(rawUsers, col, dir) {
  return [...rawUsers].sort((a, b) => {
    let av, bv;
    if (col === 'nome') {
      // pendentes sempre no final
      if (a.pending !== b.pending) return a.pending ? 1 : -1;
      av = (a.nome || '').toLowerCase();
      bv = (b.nome || '').toLowerCase();
    } else if (col === 'perfil') {
      if (a.pending !== b.pending) return a.pending ? 1 : -1;
      av = ROLE_ORDER[a.role] ?? 99;
      bv = ROLE_ORDER[b.role] ?? 99;
      return dir === 'asc' ? av - bv : bv - av;
    } else if (col === 'instituicao') {
      av = (a.institutions?.[0] || '').toLowerCase();
      bv = (b.institutions?.[0] || '').toLowerCase();
    } else if (col === 'ultimo_acesso') {
      av = a.last_login || '';
      bv = b.last_login || '';
    } else {
      // default: pendentes → role → nome
      if (a.pending !== b.pending) return a.pending ? 1 : -1;
      if (a.role !== b.role) return (ROLE_ORDER[a.role] ?? 99) - (ROLE_ORDER[b.role] ?? 99);
      return (a.nome || '').localeCompare(b.nome || '', 'pt-BR');
    }
    const cmp = typeof av === 'string' ? av.localeCompare(bv, 'pt-BR') : av < bv ? -1 : av > bv ? 1 : 0;
    return dir === 'asc' ? cmp : -cmp;
  });
}

export default function AdminPage() {
  const navigate = useNavigate();
  const { institutions = [], loadData } = useAppLayout();
  const queryClient = useQueryClient();
  const { data: stats = null } = useQuery({ queryKey: keys.adminStats(), queryFn: getAdminStats });
  const { data: rawUsers = [] } = useQuery({ queryKey: keys.adminUsers(), queryFn: getAdminUsers });
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState('asc');

  const users = sortUsers(rawUsers, sortCol, sortDir);

  function handleSort(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  }

  const invalidateAdmin = () => {
    queryClient.invalidateQueries({ queryKey: keys.adminUsers() });
    queryClient.invalidateQueries({ queryKey: keys.adminStats() });
  };

  const [editingId, setEditingId] = useState(undefined);
  const [editRole, setEditRole] = useState('');
  const [saving, setSaving] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [newStudentNome, setNewStudentNome] = useState('');
  const [newStudentEmail, setNewStudentEmail] = useState('');
  const [newStudentStatus, setNewStudentStatus] = useState('mestrado');
  const [newStudentInstId, setNewStudentInstId] = useState('');
  const [newUserRole, setNewUserRole] = useState('researcher');
  const [addingStudent, setAddingStudent] = useState(false);
  const [addStudentError, setAddStudentError] = useState('');
  const [inviteLink, setInviteLink] = useState('');
  const [toast, setToast] = useState('');
  const { confirm, modal: confirmModal } = useConfirm();

  const myRole = getTokenPayload()?.role;
  const isSuperadmin = myRole === 'superadmin';
  const isProfessor = ['professor', 'superadmin'].includes(myRole);
  const canDelete = ['superadmin', 'professor'].includes(myRole);

  function copyInviteLink(u) {
    const token = btoa(u.email);
    const url = `${window.location.origin}/entrar?tab=cadastro&token=${token}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(u.researcher_id ?? u.id);
      setTimeout(() => setCopiedId(null), 2000);
      setToast('Link de convite copiado com sucesso');
    });
  }

  useEffect(() => {
    if (institutions.length > 0 && !newStudentInstId) {
      setNewStudentInstId(String(institutions[0].id));
    }
  }, [institutions]); // eslint-disable-line

  function rowKey(u) {
    return u.pending ? `r-${u.researcher_id}` : `u-${u.id}`;
  }

  function toggleSelect(u) {
    const k = rowKey(u);
    setSelected(prev => {
      const next = new Set(prev);
      next.has(k) ? next.delete(k) : next.add(k);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === users.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(users.map(rowKey)));
    }
  }

  async function handleBulkDelete() {
    if (!await confirm({ title: `Remover ${selected.size} usuário(s)?`, description: 'Esta ação não pode ser desfeita.', confirmLabel: 'Remover', variant: 'danger' })) return;
    setBulkDeleting(true);
    const user_ids = [];
    const researcher_ids = [];
    for (const k of selected) {
      if (k.startsWith('u-')) user_ids.push(Number(k.slice(2)));
      else researcher_ids.push(Number(k.slice(2)));
    }
    await bulkDeleteUsers(user_ids, researcher_ids);
    setSelected(new Set());
    setBulkDeleting(false);
    invalidateAdmin();
  }

  async function handleRoleChange(userId) {
    setSaving(true);
    await updateUserRole(userId, editRole, editRole === 'superadmin');
    setEditingId(null);
    setSaving(false);
    invalidateAdmin();
  }

  async function handleDelete(u) {
    if (!await confirm({ title: `Remover "${u.nome}"?`, description: 'Esta ação não pode ser desfeita.', confirmLabel: 'Remover', variant: 'danger' })) return;
    if (u.pending && u.researcher_id) {
      await deletePendingResearcher(u.researcher_id);
    } else {
      await deleteUser(u.id);
    }
    setInviteLink('');
    setShowAddStudent(false);
    setToast(`"${u.nome}" removido`);
    invalidateAdmin();
  }

  async function handleAddStudent(e) {
    e.preventDefault();
    if (!newStudentNome.trim() || !newStudentEmail.trim()) return;
    if (newUserRole === 'professor' && isPublicEmailDomain(newStudentEmail)) {
      setAddStudentError(INSTITUTIONAL_EMAIL_ERROR_PT);
      return;
    }
    setAddingStudent(true);
    setAddStudentError('');
    try {
      const instId = newStudentInstId ? Number(newStudentInstId) : null;
      let r;
      if (newUserRole === 'professor') {
        r = await inviteProfessor({ nome: newStudentNome.trim(), email: newStudentEmail.trim(), institution_id: instId });
      } else {
        const myPayload = getTokenPayload();
        r = await createResearcher({ nome: newStudentNome.trim(), email: newStudentEmail.trim(), status: newStudentStatus, orientador_id: myPayload?.professor_id || null, institution_id: instId });
      }
      if (r?.id) {
        const token = btoa(newStudentEmail.trim());
        const url = `${window.location.origin}/entrar?tab=cadastro&token=${token}`;
        setInviteLink(url);
        setNewStudentNome('');
        setNewStudentEmail('');
        setNewStudentStatus('mestrado');
        setNewUserRole('researcher');
        setNewStudentInstId(institutions.length > 0 ? String(institutions[0].id) : '');
        invalidateAdmin();
        loadData?.();
      } else {
        setAddStudentError(r?.detail || 'Erro ao cadastrar usuário');
      }
    } catch {
      setAddStudentError('Erro ao cadastrar usuário');
    } finally {
      setAddingStudent(false);
    }
  }

  function formatDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('pt-BR');
  }

  function formatLastLogin(iso) {
    if (!iso) return { text: '—', old: false };
    const diff = Date.now() - new Date(iso).getTime();
    const days = Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
    let text;
    if (days === 0) text = 'hoje';
    else if (days === 1) text = '1 dia';
    else text = `${days} dias`;
    return { text, old: days > 7 };
  }

  return (
    <div className="min-h-full bg-gray-50">
      {confirmModal}
      <Toast message={toast} onClose={() => setToast('')} />
      <main className="max-w-5xl mx-auto py-8 px-4 space-y-8">

        {/* Stats */}
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Visão geral</h2>
          <div className={`grid grid-cols-2 gap-4 ${isSuperadmin ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
            {isSuperadmin && (
              <StatCard label="Superadmins" value={stats?.users_by_role?.superadmin ?? 0} color="text-red-600" />
            )}
            <StatCard label="Professores"  value={stats?.users_by_role?.professor  ?? 0} color="text-blue-600" />
            <div className="bg-white rounded-xl border shadow-sm p-5 flex flex-col gap-1">
              <span className="text-3xl font-bold text-green-600">{stats?.users_by_role?.researcher ?? 0}</span>
              <span className="text-sm text-gray-500">Alunos</span>
              {(stats?.total_pending ?? 0) > 0 && (
                <span className="text-xs text-yellow-600 mt-0.5">{stats.total_pending} sem acesso validado</span>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-4">
            <StatCard label="Grupos de pesquisa" value={stats?.total_groups}          color="text-indigo-600" />
            <StatCard label="Lembretes"          value={stats?.total_reminders}       color="text-amber-600" />
            <StatCard label="Tips"               value={stats?.total_tips}            color="text-teal-600" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
            <StatCard label="Anotações"   value={stats?.total_notes}               color="text-rose-600" />
          </div>
        </section>

        {/* Users */}
        <section className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b flex items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-gray-800">Usuários</h2>
              <p className="text-sm text-gray-500 mt-0.5">{users.length} usuário{users.length !== 1 ? 's' : ''} cadastrado{users.length !== 1 ? 's' : ''}</p>
              {!isSuperadmin && (
                <p className="text-xs text-indigo-600 mt-1">
                  Exibindo apenas usuários das instituições às quais você está vinculado.
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {isProfessor && (
                <button
                  onClick={() => { setShowAddStudent(v => !v); setInviteLink(''); setAddStudentError(''); }}
                  className="flex items-center gap-1.5 bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Cadastrar Usuário
                </button>
              )}
              {canDelete && selected.size > 0 && (
                <button
                  onClick={handleBulkDelete}
                  disabled={bulkDeleting}
                  className="flex items-center gap-2 bg-red-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Remover {selected.size} selecionado{selected.size !== 1 ? 's' : ''}
                </button>
              )}
            </div>
          </div>

          {showAddStudent && (
            <div className="px-6 py-4 border-b bg-green-50">
              {inviteLink ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-green-800">Aluno cadastrado! Compartilhe o link de convite:</p>
                  <div className="flex gap-2">
                    <input readOnly value={inviteLink} className="flex-1 border rounded-lg px-3 py-2 text-xs bg-white text-gray-700 focus:outline-none" />
                    <button
                      onClick={() => { navigator.clipboard.writeText(inviteLink); setToast('Link de convite copiado com sucesso'); }}
                      className="bg-green-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-green-700"
                    >
                      Copiar
                    </button>
                  </div>
                  <button onClick={() => { setShowAddStudent(false); setInviteLink(''); }} className="text-xs text-gray-500 hover:text-gray-700">Fechar</button>
                </div>
              ) : (
                <form onSubmit={handleAddStudent} className="space-y-3">
                  <p className="text-sm font-semibold text-gray-700">Cadastrar novo usuário</p>
                  <div className="flex gap-3 flex-wrap">
                    <input
                      required
                      placeholder="Nome completo"
                      value={newStudentNome}
                      onChange={e => setNewStudentNome(e.target.value)}
                      className="flex-1 min-w-40 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                    />
                    <input
                      required
                      type="email"
                      placeholder="Email"
                      value={newStudentEmail}
                      onChange={e => setNewStudentEmail(e.target.value)}
                      className="flex-1 min-w-48 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                    />
                    <select
                      value={newUserRole}
                      onChange={e => setNewUserRole(e.target.value)}
                      className="border rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="researcher">Aluno</option>
                      <option value="professor">Professor</option>
                    </select>
                    {newUserRole === 'researcher' && (
                      <select
                        value={newStudentStatus}
                        onChange={e => setNewStudentStatus(e.target.value)}
                        className="border rounded-lg px-3 py-2 text-sm"
                      >
                        <option value="graduacao">Graduação</option>
                        <option value="mestrado">Mestrado</option>
                        <option value="doutorado">Doutorado</option>
                        <option value="postdoc">Pós-doc</option>
                      </select>
                    )}
                    {institutions.length === 1 ? (
                      <span className="flex items-center px-3 py-2 text-sm text-gray-600 border rounded-lg bg-gray-50">
                        {institutions[0].name}
                      </span>
                    ) : institutions.length > 1 ? (
                      <select
                        value={newStudentInstId}
                        onChange={e => setNewStudentInstId(e.target.value)}
                        className="border rounded-lg px-3 py-2 text-sm"
                      >
                        {institutions.map(i => (
                          <option key={i.id} value={i.id}>{i.name}</option>
                        ))}
                      </select>
                    ) : null}
                  </div>
                  {addStudentError && <p className="text-xs text-red-500">{addStudentError}</p>}
                  <div className="flex gap-2">
                    <button type="submit" disabled={addingStudent} className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700 disabled:opacity-50">
                      {addingStudent ? 'Cadastrando...' : 'Cadastrar e gerar link'}
                    </button>
                    <button type="button" onClick={() => setShowAddStudent(false)} className="bg-gray-200 px-4 py-2 rounded-lg text-sm hover:bg-gray-300">
                      Cancelar
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  {canDelete && (
                    <th className="pl-4 py-3 w-8">
                      <input type="checkbox" checked={users.length > 0 && selected.size === users.length} onChange={toggleAll} className="rounded border-gray-300" />
                    </th>
                  )}
                  {[
                    { key: 'nome',          label: 'Nome' },
                    { key: null,            label: 'Email' },
                    { key: 'perfil',        label: 'Perfil' },
                    { key: 'instituicao',   label: 'Instituição' },
                    { key: null,            label: 'WhatsApp' },
                    { key: 'ultimo_acesso', label: 'Último acesso' },
                    { key: null,            label: 'Ações' },
                  ].map(({ key, label }) =>
                    key ? (
                      <th key={label} className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => handleSort(key)}
                          className="inline-flex items-center gap-1 hover:text-gray-800 transition-colors"
                        >
                          {label}
                          <span className="text-[10px] leading-none">
                            {sortCol === key ? (sortDir === 'asc' ? '▲' : '▼') : '⬍'}
                          </span>
                        </button>
                      </th>
                    ) : (
                      <th key={label} className="px-4 py-3">{label}</th>
                    )
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map((u, idx) => (
                  <tr key={u.id ?? `pending-${idx}`} className={`hover:bg-gray-50 transition-colors ${u.pending ? 'opacity-60' : ''}`}>
                    {canDelete && (
                      <td className="pl-4 py-3 w-8">
                        <input type="checkbox" checked={selected.has(rowKey(u))} onChange={() => toggleSelect(u)} className="rounded border-gray-300" />
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {u.photo_url
                          ? <img src={u.photo_url} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
                          : <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-500 shrink-0">{(u.nome || '?')[0].toUpperCase()}</div>
                        }
                        <span className="font-medium text-gray-800">
                          {!u.pending && u.role !== 'superadmin'
                            ? <a href={`/app/profile/${slugify(u.nome)}`} className="hover:text-blue-600 hover:underline" title={u.nome}>{shortName(u.nome)}</a>
                            : shortName(u.nome)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{u.email}</td>
                    <td className="px-4 py-3">
                      {u.pending ? (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${ROLE_COLORS.pending}`}>
                          Pendente
                        </span>
                      ) : editingId === u.id && isSuperadmin ? (
                        <div className="flex items-center gap-2 flex-wrap">
                          <select
                            value={editRole}
                            onChange={e => setEditRole(e.target.value)}
                            className="border rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-purple-400"
                          >
                            <option value="superadmin">Superadmin</option>
                            <option value="professor">Professor</option>
                            <option value="researcher">Aluno</option>
                          </select>
                          <button
                            onClick={() => handleRoleChange(u.id)}
                            disabled={saving}
                            className="bg-purple-600 text-white px-2 py-1 rounded text-xs hover:bg-purple-700 disabled:opacity-50"
                          >
                            Salvar
                          </button>
                          <button
                            onClick={() => setEditingId(undefined)}
                            className="text-gray-500 hover:text-gray-700 text-xs px-1"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 flex-wrap">
                          {u.role !== 'researcher' ? (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${ROLE_COLORS[u.role] || 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                              {ROLE_LABELS[u.role] || u.role}
                            </span>
                          ) : (
                            <>
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${ROLE_COLORS.researcher}`}>
                                Aluno
                              </span>
                              {u.researcher_status && (
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${STATUS_COLORS[u.researcher_status] || 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                                  {STATUS_LABELS[u.researcher_status] || u.researcher_status}
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(u.institutions || []).map(name => (
                          <span key={name} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            {name}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {u.whatsapp
                        ? <a href={`https://wa.me/${u.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="hover:text-green-600 hover:underline">{u.whatsapp}</a>
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {(() => { const { text, old } = formatLastLogin(u.last_login); return <span className={old ? 'text-red-500' : 'text-gray-400'}>{text}</span>; })()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        {u.pending && editingId !== u.id && (
                          <button
                            onClick={() => copyInviteLink(u)}
                            className="p-1.5 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                            title="Copiar link de ativação"
                          >
                            {copiedId === (u.researcher_id ?? u.id) ? (
                              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            ) : (
                              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                              </svg>
                            )}
                          </button>
                        )}
                        {editingId !== u.id && isSuperadmin && (
                          <button
                            onClick={() => {
                              if (u.pending) {
                                navigate(`/app/profile/${slugify(u.nome)}`);
                              } else {
                                setEditingId(u.id); setEditRole(u.role);
                              }
                            }}
                            className="p-1.5 rounded text-gray-400 hover:text-purple-600 hover:bg-purple-50 transition-colors"
                            title={u.pending ? 'Ver perfil' : 'Editar perfil'}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                        )}
                        {editingId !== u.id && canDelete && (
                          <button
                            onClick={() => handleDelete(u)}
                            className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            title="Remover"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-400 italic">Nenhum usuário encontrado.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
