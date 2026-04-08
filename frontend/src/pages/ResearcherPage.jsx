import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAppLayout } from '../components/AppLayout';
import { getProfileBySlug, updateResearcher, updateMyProfile, updateUserProfile, uploadPhoto, getDeadlineInterests, getDeadlines } from '../api';
import { getTokenPayload } from '../auth';
import { modKey, isModEnter } from '../platform';
import Toast from '../components/Toast';
import MilestoneTimeline from '../components/MilestoneTimeline';
import ReadingList from '../components/ReadingList';
import NotesSection from '../components/NotesSection';
import { slugify } from '../mentionUtils.jsx';
import RichEditor from '../components/RichEditor';
import RichContent from '../components/RichContent';
import { useConfirm } from '../components/ConfirmModal';

const STATUS_LABELS = { graduacao: 'Graduação', mestrado: 'Mestrado', doutorado: 'Doutorado', postdoc: 'Pós-doc', professor: 'Professor', egresso: 'Egresso' };
const STATUS_COLORS = { graduacao: '#3B82F6', mestrado: '#F59E0B', doutorado: '#10B981', postdoc: '#06B6D4', professor: '#7C3AED', egresso: '#6B7280' };

function formatDate(iso) {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatLastLogin(iso) {
  const now = new Date();
  const loginDate = new Date(iso);
  const diffMs = now - loginDate;
  const diffDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  if (diffDays === 0) return 'Último acesso: hoje';
  if (diffDays === 1) return 'Último acesso: ontem';
  if (diffDays <= 10) return `Último acesso: há ${diffDays} dias`;
  return 'Último acesso: há mais de 10 dias';
}

/** Extrai o handle a partir de texto, URL ou @usuario (sem @ no retorno). */
function stripSocialUrlToHandle(raw) {
  if (!raw || !String(raw).trim()) return '';
  let s = String(raw).trim();
  if (/^https?:\/\//i.test(s)) {
    try {
      const u = new URL(s);
      const host = u.hostname.replace(/^www\./, '');
      const path = (u.pathname || '/').replace(/^\//, '').split('/')[0] || '';
      if (['instagram.com', 'x.com', 'twitter.com'].includes(host)) {
        s = path.split('?')[0];
      } else {
        s = s.replace(/^https?:\/\/(www\.)?(instagram\.com|x\.com|twitter\.com)\//i, '').split('/')[0].split('?')[0];
      }
    } catch {
      s = s.replace(/^https?:\/\/(www\.)?(instagram\.com|x\.com|twitter\.com)\//i, '').split('/')[0].split('?')[0];
    }
  }
  return s.replace(/^@+/, '').replace(/\/$/, '');
}

function socialToAtForm(raw) {
  const h = stripSocialUrlToHandle(raw);
  return h ? `@${h}` : '';
}

/** No blur: URL vira @handle; texto sem @ ganha @. */
function normalizeSocialInputOnBlur(value) {
  const t = (value || '').trim();
  if (!t) return '';
  if (/^https?:\/\//i.test(t)) {
    const h = stripSocialUrlToHandle(t);
    return h ? `@${h}` : '';
  }
  if (!t.startsWith('@')) return `@${t.replace(/^@+/, '')}`;
  return t;
}

function extractApiErrorMessage(detail) {
  if (!detail) return '';
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    const first = detail[0];
    if (typeof first === 'string') return first;
    if (first && typeof first === 'object' && first.msg) return String(first.msg);
    return 'Erro de validação';
  }
  if (typeof detail === 'object' && detail.msg) return String(detail.msg);
  return '';
}

const LATTES_RE = /^https?:\/\/lattes\.cnpq\.br\/\d{16}$/;

function validateLattesForm(value) {
  const t = (value || '').trim();
  if (!t) return '';
  if (!LATTES_RE.test(t)) return 'URL inválida. Use o formato: http://lattes.cnpq.br/1234567890123456';
  return '';
}

function validateInstagramForm(value) {
  const t = (value || '').trim();
  if (!t) return '';
  if (/^https?:\/\//i.test(t)) {
    const h = stripSocialUrlToHandle(t);
    if (!h) return 'URL do Instagram inválida';
    if (!/^[A-Za-z0-9._]{1,30}$/.test(h)) {
      return 'Instagram: usuário inválido (1–30 caracteres: letras, números, . e _)';
    }
    return '';
  }
  if (!t.startsWith('@')) return 'Use @ no início (ex.: @usuario)';
  const rest = t.slice(1);
  if (!rest) return 'Informe o usuário após @';
  if (!/^[A-Za-z0-9._]{1,30}$/.test(rest)) {
    return 'Instagram: usuário inválido (1–30 caracteres: letras, números, . e _)';
  }
  return '';
}

function validateTwitterForm(value) {
  const t = (value || '').trim();
  if (!t) return '';
  if (/^https?:\/\//i.test(t)) {
    const h = stripSocialUrlToHandle(t);
    if (!h) return 'URL do X inválida';
    if (!/^[A-Za-z0-9_]{1,15}$/.test(h)) {
      return 'X/Twitter: usuário inválido (1–15 caracteres: letras, números e _)';
    }
    return '';
  }
  if (!t.startsWith('@')) return 'Use @ no início (ex.: @usuario)';
  const rest = t.slice(1);
  if (!rest) return 'Informe o usuário após @';
  if (!/^[A-Za-z0-9_]{1,15}$/.test(rest)) {
    return 'X/Twitter: usuário inválido (1–15 caracteres: letras, números e _)';
  }
  return '';
}

const DEFAULT_BIRTH_DATE = '1990-01-01';

function buildProfileForm(u) {
  if (!u) return { lattes_url: '', scholar_url: '', linkedin_url: '', github_url: '', instagram_url: '', twitter_url: '', whatsapp: '', interesses: '', bio: '', birth_date: '' };
  return {
    lattes_url: u.lattes_url || '',
    scholar_url: u.scholar_url || '',
    linkedin_url: u.linkedin_url || '',
    github_url: u.github_url || '',
    instagram_url: socialToAtForm(u.instagram_url),
    twitter_url: socialToAtForm(u.twitter_url),
    whatsapp: u.whatsapp || '',
    interesses: u.interesses || '',
    bio: u.bio || '',
    birth_date: u.birth_date ? u.birth_date.slice(0, 10) : '',
  };
}


function ProfileSection({ researcher, user, canEdit, isProfessor, isOwnProfile, onSaved, myDeadlines = [] }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(() => buildProfileForm(user));
  const [whatsappError, setWhatsappError] = useState('');
  const [lattesError, setLattesError] = useState('');
  const [instagramError, setInstagramError] = useState('');
  const [twitterError, setTwitterError] = useState('');
  const [saving, setSaving] = useState(false);
  const [statusSaving, setStatusSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoPreview, setPhotoPreview] = useState(user?.photo_url || null);
  const [pendingPhotoFileId, setPendingPhotoFileId] = useState(null);
  const [pendingPhotoThumbFileId, setPendingPhotoThumbFileId] = useState(null);
  const [saveError, setSaveError] = useState('');
  const photoRef = useRef();

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  useEffect(() => {
    if (editing) return;
    setForm(buildProfileForm(user));
    setPhotoPreview(user?.photo_url || null);
  }, [user, editing]);

  function maskPhone(value) {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 10)
      return digits.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3').replace(/-$/, '');
    return digits.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3').replace(/-$/, '');
  }

  function handleWhatsApp(e) {
    const masked = maskPhone(e.target.value);
    setForm({ ...form, whatsapp: masked });
    const digits = masked.replace(/\D/g, '');
    setWhatsappError(digits.length > 0 && digits.length < 10 ? 'Número inválido' : '');
  }

  async function handlePhotoSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingPhoto(true);
    const res = await uploadPhoto(file);
    setPendingPhotoFileId(res.file_id);
    setPendingPhotoThumbFileId(res.thumb_file_id || null);
    setPhotoPreview(res.file_id ? `/api/files/${res.file_id}` : null);
    setUploadingPhoto(false);
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaveError('');
    const digits = form.whatsapp.replace(/\D/g, '');
    if (form.whatsapp && digits.length < 10) { setWhatsappError('Número inválido'); return; }
    const ltErr = validateLattesForm(form.lattes_url);
    const igErr = validateInstagramForm(form.instagram_url);
    const twErr = validateTwitterForm(form.twitter_url);
    setLattesError(ltErr);
    setInstagramError(igErr);
    setTwitterError(twErr);
    if (ltErr || igErr || twErr) return;
    if (newPassword && newPassword !== confirmPassword) {
      setPasswordError('As senhas não coincidem');
      return;
    }
    if (newPassword && newPassword.length < 6) {
      setPasswordError('A senha deve ter ao menos 6 caracteres');
      return;
    }
    setPasswordError('');
    setSaving(true);
    try {
      if (user) {
        const payload = {
          birth_date: form.birth_date || null,
          lattes_url: form.lattes_url || null,
          scholar_url: form.scholar_url || null,
          linkedin_url: form.linkedin_url || null,
          github_url: form.github_url || null,
          instagram_url: form.instagram_url.trim() ? stripSocialUrlToHandle(form.instagram_url) : null,
          twitter_url: form.twitter_url.trim() ? stripSocialUrlToHandle(form.twitter_url) : null,
          whatsapp: form.whatsapp || null,
          interesses: form.interesses || null,
          bio: form.bio || null,
          ...(pendingPhotoFileId
            ? { photo_file_id: pendingPhotoFileId, photo_thumb_file_id: pendingPhotoThumbFileId || null }
            : {}),
          ...(newPassword ? { password: newPassword } : {}),
        };
        const numericUserId = Number(user.id);
        const resp = isOwnProfile || !Number.isFinite(numericUserId)
          ? await updateMyProfile(payload)
          : await updateUserProfile(numericUserId, payload);
        if (resp?.detail) {
          throw new Error(extractApiErrorMessage(resp.detail) || 'Erro ao salvar perfil');
        }
      }
      setEditing(false);
      setPendingPhotoFileId(null);
      setPendingPhotoThumbFileId(null);
      setNewPassword('');
      setConfirmPassword('');
      setToast('Perfil salvo com sucesso');
      Promise.resolve(onSaved()).catch(() => {
        setToast('Perfil salvo, mas houve erro ao atualizar a visualização');
      });
    } catch (err) {
      setSaveError(err?.message || 'Não foi possível salvar o perfil');
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(newStatus) {
    if (!researcher?.id || newStatus === researcher.status) return;
    setStatusSaving(true);
    try {
      await updateResearcher(researcher.id, { status: newStatus });
      setToast('Nível atualizado');
      onSaved();
    } catch {
      setToast('Erro ao atualizar nível');
    } finally {
      setStatusSaving(false);
    }
  }

  function handleCancel() {
    setEditing(false);
    setPhotoPreview(user?.photo_url || null);
    setPendingPhotoFileId(null);
    setPendingPhotoThumbFileId(null);
    setInstagramError('');
    setTwitterError('');
    setSaveError('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError('');
  }

  const links = [
    { key: 'lattes_url', label: 'Lattes', value: user?.lattes_url,
      cls: 'text-teal-700 bg-teal-50 border-teal-200 hover:bg-teal-100',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/>
        </svg>
      )},
    { key: 'scholar_url', label: 'Google Scholar', value: user?.scholar_url,
      cls: 'text-indigo-600 bg-indigo-50 border-indigo-200 hover:bg-indigo-100',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 3L1 9l4 2.18V17h2v-4.82L12 14l7-3.82V17h2v-5.82L23 9 12 3zm0 2.36L18.5 9 12 12.36 5.5 9 12 5.36zM5 19v2h14v-2H5z"/>
        </svg>
      )},
    { key: 'linkedin_url', label: 'LinkedIn', value: user?.linkedin_url,
      cls: 'text-blue-700 bg-blue-50 border-blue-200 hover:bg-blue-100',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 3a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h14m-.5 15.5v-5.3a3.26 3.26 0 00-3.26-3.26c-.85 0-1.84.52-2.32 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 011.4 1.4v4.93h2.79M6.88 8.56a1.68 1.68 0 001.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 00-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z"/>
        </svg>
      )},
    { key: 'github_url', label: 'GitHub', value: user?.github_url,
      cls: 'text-gray-800 bg-gray-100 border-gray-300 hover:bg-gray-200',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2A10 10 0 002 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0012 2z"/>
        </svg>
      )},
    { key: 'instagram_url', label: 'Instagram', value: user?.instagram_url ? (user.instagram_url.startsWith('http') ? user.instagram_url : `https://instagram.com/${user.instagram_url.replace(/^@/, '')}`) : null,
      cls: 'text-pink-600 bg-pink-50 border-pink-200 hover:bg-pink-100',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M7.8 2h8.4C19.4 2 22 4.6 22 7.8v8.4a5.8 5.8 0 01-5.8 5.8H7.8C4.6 22 2 19.4 2 16.2V7.8A5.8 5.8 0 017.8 2m-.2 2A3.6 3.6 0 004 7.6v8.8C4 18.39 5.61 20 7.6 20h8.8a3.6 3.6 0 003.6-3.6V7.6C20 5.61 18.39 4 16.4 4H7.6m9.65 1.5a1.25 1.25 0 011.25 1.25A1.25 1.25 0 0117.25 8 1.25 1.25 0 0116 6.75a1.25 1.25 0 011.25-1.25M12 7a5 5 0 015 5 5 5 0 01-5 5 5 5 0 01-5-5 5 5 0 015-5m0 2a3 3 0 00-3 3 3 3 0 003 3 3 3 0 003-3 3 3 0 00-3-3z"/>
        </svg>
      )},
    { key: 'twitter_url', label: 'Twitter / X', value: user?.twitter_url ? (user.twitter_url.startsWith('http') ? user.twitter_url : `https://x.com/${user.twitter_url.replace(/^@/, '')}`) : null,
      cls: 'text-sky-600 bg-sky-50 border-sky-200 hover:bg-sky-100',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.253 5.622 5.91-5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
        </svg>
      )},
  ];

  return (
    <>
    <Toast message={toast} onClose={() => setToast('')} />
    <section className="bg-white rounded-xl shadow-sm border p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-800">👤 Perfil</h2>
        {canEdit && !editing && user && (
          <button
            type="button"
            onClick={() => {
              setForm(buildProfileForm(user));
              setInstagramError('');
              setTwitterError('');
              setWhatsappError('');
              setSaveError('');
              setEditing(true);
            }}
            className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Editar
          </button>
        )}
      </div>

      {editing ? (
        <form onSubmit={handleSave} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2">Foto de perfil</label>
            <div className="flex items-center gap-3">
              {photoPreview ? (
                <img src={photoPreview} alt="" className="w-14 h-14 rounded-full object-cover border-2 border-gray-200" />
              ) : (
                <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 text-xs border-2 border-dashed border-gray-300">
                  sem foto
                </div>
              )}
              <div>
                <button
                  type="button"
                  onClick={() => photoRef.current.click()}
                  disabled={uploadingPhoto}
                  className="text-sm text-blue-600 hover:underline disabled:opacity-50"
                >
                  {uploadingPhoto ? 'Enviando...' : 'Escolher imagem'}
                </button>
                <p className="text-xs text-gray-400 mt-0.5">JPG, PNG ou WebP · máx. 5 MB</p>
                <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoSelect} />
              </div>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Data de nascimento *</label>
            <input
              type="date"
              required
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              value={form.birth_date}
              onChange={set('birth_date')}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">WhatsApp *</label>
            <input
              type="tel"
              required
              className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 ${whatsappError ? 'border-red-400' : ''}`}
              placeholder="(XX) XXXXX-XXXX"
              value={form.whatsapp}
              onChange={handleWhatsApp}
            />
            {whatsappError && <p className="text-xs text-red-500 mt-0.5">{whatsappError}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Lattes</label>
            <input
              type="url"
              className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 ${lattesError ? 'border-red-400' : ''}`}
              placeholder="http://lattes.cnpq.br/1234567890123456"
              value={form.lattes_url}
              onChange={e => { set('lattes_url')(e); setLattesError(validateLattesForm(e.target.value)); }}
            />
            {lattesError && <p className="text-xs text-red-500 mt-0.5">{lattesError}</p>}
          </div>
          {[
            { key: 'scholar_url', label: 'Google Scholar', placeholder: 'https://scholar.google.com/...' },
            { key: 'linkedin_url', label: 'LinkedIn', placeholder: 'https://linkedin.com/in/...' },
            { key: 'github_url', label: 'GitHub', placeholder: 'https://github.com/...' },
          ].map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
              <input
                type="url"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                placeholder={placeholder}
                value={form[key]}
                onChange={set(key)}
              />
            </div>
          ))}
          {[
            { key: 'instagram_url', label: 'Instagram', error: instagramError, setError: setInstagramError },
            { key: 'twitter_url', label: 'Twitter / X', error: twitterError, setError: setTwitterError },
          ].map(({ key, label, error, setError }) => (
            <div key={key}>
              <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
              <input
                type="text"
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 ${error ? 'border-red-400' : ''}`}
                placeholder="@usuario"
                maxLength={50}
                value={form[key]}
                onChange={(e) => {
                  setError('');
                  setForm({ ...form, [key]: e.target.value });
                }}
                onBlur={() => {
                  const norm = normalizeSocialInputOnBlur(form[key]);
                  if (norm !== form[key]) setForm({ ...form, [key]: norm });
                }}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? `${key}-err` : undefined}
              />
              {error && <p id={`${key}-err`} className="text-xs text-red-500 mt-0.5">{error}</p>}
            </div>
          ))}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Bio</label>
            <textarea
              className="w-full border rounded-lg px-3 py-2 text-sm h-16 resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="Breve descrição sobre você..."
              value={form.bio}
              onChange={set('bio')}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Interesses de pesquisa</label>
            <textarea
              className="w-full border rounded-lg px-3 py-2 text-sm h-20 resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="Ex: engenharia de software, mineração de repositórios..."
              value={form.interesses}
              onChange={set('interesses')}
            />
          </div>
          <div className="border-t pt-3 space-y-2">
            <label className="block text-xs font-medium text-gray-500">Nova senha (opcional)</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                type="password"
                placeholder="Nova senha"
                value={newPassword}
                onChange={e => { setNewPassword(e.target.value); setPasswordError(''); }}
                className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                minLength={6}
              />
              <input
                type="password"
                placeholder="Confirmar nova senha"
                value={confirmPassword}
                onChange={e => { setConfirmPassword(e.target.value); setPasswordError(''); }}
                className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            {passwordError && <p className="text-xs text-red-500">{passwordError}</p>}
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
            <button type="button" onClick={handleCancel} className="bg-gray-200 px-4 py-1.5 rounded-lg text-sm hover:bg-gray-300">
              Cancelar
            </button>
          </div>
          {saveError && <p className="text-xs text-red-500">{saveError}</p>}
        </form>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {links.map(({ label, value, icon, cls }) => value ? (
              <a key={label} href={value} target="_blank" rel="noreferrer"
                className={`inline-flex items-center gap-1.5 text-sm px-3 py-1 rounded-full border transition-colors ${cls}`}>
                {icon}
                {label}
              </a>
            ) : null)}
            {user?.whatsapp && (
              <a
                href={`https://wa.me/55${user.whatsapp.replace(/\D/g, '')}`}
                target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-green-600 hover:underline bg-green-50 px-3 py-1 rounded-full border border-green-100"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                WhatsApp
              </a>
            )}
            {links.every(l => !l.value) && !user?.interesses && !user?.whatsapp && (
              <p className="text-sm text-gray-400 italic">Nenhuma informação de perfil cadastrada.</p>
            )}
          </div>
          {user?.bio && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">Bio</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{user.bio}</p>
            </div>
          )}
          {user?.interesses && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">Interesses de pesquisa</p>
              <p className="text-sm text-gray-700">{user.interesses}</p>
            </div>
          )}
          {isProfessor && researcher && (
            <div className="border-t pt-3 mt-1 space-y-3">
              <div className="flex items-center gap-3">
                <p className="text-xs font-medium text-gray-500 w-16 shrink-0">Nível</p>
                <select
                  value={researcher.status}
                  onChange={e => handleStatusChange(e.target.value)}
                  disabled={statusSaving}
                  className="text-sm border rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50"
                >
                  <option value="graduacao">Graduação</option>
                  <option value="mestrado">Mestrado</option>
                  <option value="doutorado">Doutorado</option>
                  <option value="postdoc">Pós-doc</option>
                  <option value="egresso">Egresso</option>
                </select>
                {statusSaving && <span className="text-xs text-gray-400">Salvando...</span>}
              </div>
              {(researcher.matricula || researcher.curso || researcher.enrollment_date) && (
                <div className="flex gap-6 flex-wrap">
                  {researcher.matricula && (
                    <div>
                      <p className="text-xs font-medium text-gray-500">Matrícula</p>
                      <p className="text-sm text-gray-700">{researcher.matricula}</p>
                    </div>
                  )}
                  {researcher.curso && (
                    <div>
                      <p className="text-xs font-medium text-gray-500">Curso</p>
                      <p className="text-sm text-gray-700">{researcher.curso}</p>
                    </div>
                  )}
                  {researcher.enrollment_date && (
                    <div>
                      <p className="text-xs font-medium text-gray-500">Ingresso</p>
                      <p className="text-sm text-gray-700">
                        {new Date(researcher.enrollment_date + 'T00:00:00').toLocaleDateString('pt-BR', { month: '2-digit', year: 'numeric' })}
                      </p>
                    </div>
                  )}
                  {researcher.enrollment_date && (researcher.status === 'mestrado' || researcher.status === 'doutorado') && (() => {
                    const years = researcher.status === 'mestrado' ? 2 : 4;
                    const d = new Date(researcher.enrollment_date + 'T00:00:00');
                    d.setFullYear(d.getFullYear() + years);
                    return (
                      <div>
                        <p className="text-xs font-medium text-gray-500">Possível Formatura</p>
                        <p className="text-sm text-gray-700">
                          {d.toLocaleDateString('pt-BR', { month: '2-digit', year: 'numeric' })}
                        </p>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          )}
        </div>
      )}
      {myDeadlines.length > 0 && (() => {
        const today = new Date().toISOString().split('T')[0];
        const active = myDeadlines.filter(d => d.date >= today);
        const past   = myDeadlines.filter(d => d.date < today).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);
        const calIcon = (
          <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        );
        return (
          <>
            <hr className="border-gray-100 mt-6" />
            <div className="px-6 py-5 flex gap-0">
              {active.length > 0 && (
                <div className={`flex flex-col gap-2 ${past.length > 0 ? 'w-1/2 pr-5' : 'w-full'}`}>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Trabalhando em</p>
                  <div className="flex flex-wrap gap-2">
                    {active.map(d => (
                      <a key={d.id} href={d.url} target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors font-medium"
                      >
                        {calIcon}{d.label}
                      </a>
                    ))}
                  </div>
                </div>
              )}
              {active.length > 0 && past.length > 0 && (
                <div className="w-px bg-gray-200 self-stretch mx-0" />
              )}
              {past.length > 0 && (
                <div className={`flex flex-col gap-2 ${active.length > 0 ? 'w-1/2 pl-5' : 'w-full'}`}>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Últimos deadlines</p>
                  <div className="flex flex-wrap gap-2">
                    {past.map(d => (
                      <a key={d.id} href={d.url} target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-gray-200 bg-gray-50 text-gray-400 hover:bg-gray-100 transition-colors font-medium"
                      >
                        {calIcon}{d.label}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        );
      })()}
    </section>
    </>
  );
}

export default function ResearcherPage() {
  const { slug } = useParams();
  const { setProfileTopbar, researchers = [], currentInstitution, loadData } = useAppLayout();
  const [researcher, setResearcher] = useState(null);
  const [researcherUser, setResearcherUser] = useState(null);
  const [myDeadlines, setMyDeadlines] = useState([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInputRef = useRef();

  const payload = getTokenPayload();
  const isProfessor = payload?.role === 'professor' || payload?.role === 'superadmin';
  const isOwnProfile = researcherUser?.id != null && Number(payload?.sub) === Number(researcherUser.id);
  const canEdit = isProfessor || isOwnProfile;
  const loadInFlight = useRef(false);

  async function load() {
    if (loadInFlight.current) return;
    loadInFlight.current = true;
    let r = null;
    let u = null;
    const profile = await getProfileBySlug(slug);
    if (profile && !profile.detail) {
      r = profile.researcher || null;
      u = profile.user || null;
    }

    setResearcher(r);
    setResearcherUser(u);

    // Deadlines are secondary for this screen.
    // Profile data must still refresh even if these requests fail.
    try {
      const [allInterests, allDeadlines] = await Promise.all([
        getDeadlineInterests(currentInstitution?.id),
        getDeadlines(currentInstitution?.id),
      ]);
      if (u && allInterests && allDeadlines) {
        const ids = new Set(allInterests.filter(i => i.user_id === u.id).map(i => i.deadline_id));
        setMyDeadlines(allDeadlines.filter(d => ids.has(d.id)));
      } else {
        setMyDeadlines([]);
      }
    } catch {
      setMyDeadlines([]);
    } finally {
      loadInFlight.current = false;
    }
  }

  useEffect(() => { if (currentInstitution === undefined) return; load(); }, [slug, currentInstitution]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setProfileTopbar(null);
  }, [slug, setProfileTopbar]);

  const handleAvatarClick = useCallback(() => {
    photoInputRef.current?.click();
  }, []);

  useEffect(() => {
    const displayName = researcher?.nome || researcherUser?.nome;
    if (!displayName) return;
    if (slugify(displayName) !== slug) return;
    const color = STATUS_COLORS[researcher?.status] || '#6B7280';
    setProfileTopbar({
      nome: displayName,
      photoUrl: researcherUser?.photo_url || null,
      statusColor: color,
      statusLabel: researcher ? (STATUS_LABELS[researcher.status] || researcher.status) : (researcherUser?.role === 'professor' ? 'Professor' : 'Usuário'),
      email: researcher?.email || researcherUser?.email,
      lastLoginLine: isProfessor
        ? (researcherUser?.last_login ? formatLastLogin(researcherUser.last_login) : 'Nunca acessou')
        : null,
      onAvatarClick: canEdit ? handleAvatarClick : null,
      uploadingPhoto,
    });
    return () => setProfileTopbar(null);
  }, [
    researcher,
    researcherUser,
    isProfessor,
    canEdit,
    uploadingPhoto,
    slug,
    handleAvatarClick,
    setProfileTopbar,
  ]);

  async function handlePhotoChange(e) {
    const file = e.target.files[0];
    if (!file || !researcherUser) return;
    setUploadingPhoto(true);
    const res = await uploadPhoto(file);
    await updateUserProfile(researcherUser.id, { photo_file_id: res.file_id, photo_thumb_file_id: res.thumb_file_id || null });
    setUploadingPhoto(false);
    load();
  }

  if (!researcher && !researcherUser) {
    return <div className="flex items-center justify-center min-h-[50vh] text-gray-400">Carregando...</div>;
  }

  return (
    <div className="min-h-full bg-gray-50">
      {canEdit && (
        <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
      )}

      <main className="max-w-4xl mx-auto py-8 px-4 space-y-6">
        {isOwnProfile && researcherUser && (!researcherUser.bio && !researcherUser.whatsapp && !researcherUser.interesses && !researcherUser.lattes_url && !researcherUser.scholar_url || researcherUser.birth_date?.slice(0, 10) === DEFAULT_BIRTH_DATE) && (
          <div className="bg-amber-50 border border-amber-300 rounded-xl px-5 py-4 flex items-start gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-sm font-semibold text-amber-800">Nenhuma informação de perfil cadastrada.</p>
              <p className="text-xs text-amber-700 mt-0.5">Clique em "Editar" no seu perfil para adicionar suas informações.</p>
              {researcherUser.birth_date?.slice(0, 10) === DEFAULT_BIRTH_DATE && (
                <p className="text-xs text-amber-700 mt-0.5">Sua data de nascimento ainda não foi definida — ajuste-a ao editar o perfil.</p>
              )}
            </div>
          </div>
        )}
        <ProfileSection researcher={researcher} user={researcherUser} canEdit={canEdit} isProfessor={isProfessor} isOwnProfile={isOwnProfile} onSaved={() => { load(); loadData?.(); }} myDeadlines={myDeadlines} />
        {researcherUser && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ReadingList
              userId={researcherUser.id}
              canEdit={isProfessor || isOwnProfile}
              slug={slug}
              preview
            />
            <MilestoneTimeline
              userId={researcherUser.id}
              researcher={researcher}
              canEdit={isProfessor || isOwnProfile}
              preview
              slug={slug}
            />
          </div>
        )}
        {researcherUser && (
          <NotesSection
            key={`notes-${currentInstitution?.id ?? 'none'}`}
            userId={researcherUser.id}
            institutionId={currentInstitution?.id ?? null}
            canAdd={isProfessor || isOwnProfile}
            isProfessor={isProfessor}
            currentUserId={payload?.sub != null ? Number(payload.sub) : null}
            researchers={researchers}
            preview
            slug={slug}
          />
        )}
      </main>
    </div>
  );
}
