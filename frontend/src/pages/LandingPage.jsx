import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getTokenPayload, saveToken } from '../auth';
import { formatApiDetail, readResponseJson } from '../apiErrors';
import {
  INSTITUTIONAL_EMAIL_ERROR_PT,
  REGISTER_PROFESSOR_ONLY_HINT_PT,
  isPublicEmailDomain,
} from '../institutionalEmail';

/* ── Saudação por horário ──────────────────────────────────────────────── */
function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

/* ── Auth Modal (mantido do código anterior) ──────────────────────────── */
function slugify(nome) {
  return (nome || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-');
}

function LoginForm() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const data = await readResponseJson(res, 'login');
      if (data._invalidJson) { setError(res.ok ? 'Resposta inválida.' : `Erro ${res.status}.`); return; }
      if (!res.ok) { setError(formatApiDetail(data) || 'Erro ao fazer login'); return; }
      if (!data.access_token) { setError('Resposta inesperada.'); return; }
      saveToken(data.access_token);
      let payload;
      try { payload = JSON.parse(atob(data.access_token.split('.')[1])); } catch { setError('Sessão inválida.'); return; }
      if (payload.role === 'researcher') {
        if (!payload.researcher_id) { navigate('/app/manual', { replace: true }); }
        else {
          const r = await fetch(`/api/researchers/${payload.researcher_id}`, { headers: { Authorization: `Bearer ${data.access_token}` } });
          const stu = await readResponseJson(r, 'login.profile');
          if (!r.ok || stu._invalidJson) { setError('Login ok, mas não foi possível carregar seu perfil.'); return; }
          navigate(`/app/profile/${slugify(stu.nome)}`, { replace: true });
        }
      } else { navigate('/app', { replace: true }); }
    } catch (err) {
      const offline = err instanceof TypeError || err?.message?.includes('fetch');
      setError(offline ? 'Sem conexão com o servidor.' : 'Falha inesperada. Tente novamente.');
    } finally { setLoading(false); }
  }

  return (
    <>
      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <input type="email" required placeholder="Email" className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" value={form.email} onChange={set('email')} />
        <input type="password" required placeholder="Senha" className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" value={form.password} onChange={set('password')} />
        <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">{loading ? 'Entrando...' : 'Entrar'}</button>
      </form>
    </>
  );
}

function RegisterForm({ onSwitchToLogin }) {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true); setError('');
    if (isPublicEmailDomain(form.email)) {
      setError(INSTITUTIONAL_EMAIL_ERROR_PT);
      setLoading(false);
      return;
    }
    try {
      const res = await fetch('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const data = await readResponseJson(res, 'register');
      if (data._invalidJson) { setError(`Erro ${res.status}.`); return; }
      if (!res.ok) { setError(formatApiDetail(data) || 'Erro ao cadastrar'); return; }
      setSuccess(true);
      setTimeout(() => onSwitchToLogin?.(), 1500);
    } catch (err) {
      const offline = err instanceof TypeError || err?.message?.includes('fetch');
      setError(offline ? 'Sem conexão com o servidor.' : 'Falha inesperada.');
    } finally { setLoading(false); }
  }

  if (success) return (
    <div className="text-center py-4">
      <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
        <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
      </div>
      <p className="text-sm font-medium text-gray-800">Conta criada!</p>
      <p className="text-xs text-gray-500 mt-1">Redirecionando para o login…</p>
    </div>
  );

  return (
    <>
      <p className="text-xs text-gray-600 mb-3 leading-relaxed">{REGISTER_PROFESSOR_ONLY_HINT_PT}</p>
      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <input type="email" required placeholder="E-mail institucional (universidade)" className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" value={form.email} onChange={set('email')} />
        <input type="password" required placeholder="Senha (mín. 8 caracteres)" className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" value={form.password} onChange={set('password')} />
        <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">{loading ? 'Cadastrando...' : 'Criar conta'}</button>
      </form>
    </>
  );
}

function AuthModal({ tab, onClose, onTabChange }) {
  const overlayRef = useRef(null);
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);

  return (
    <div ref={overlayRef} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4" onClick={e => { if (e.target === overlayRef.current) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8 relative">
        <button type="button" onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
        <div className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          </div>
          <span className="text-xl font-bold text-blue-700">Alumnus</span>
        </div>
        <div className="flex rounded-lg border border-gray-200 p-1 mb-6 bg-gray-50">
          <button type="button" onClick={() => onTabChange('entrar')} className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${tab === 'entrar' ? 'bg-white text-blue-700 shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-700'}`}>Entrar</button>
          <button type="button" onClick={() => onTabChange('cadastro')} className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${tab === 'cadastro' ? 'bg-white text-blue-700 shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-700'}`}>Cadastrar</button>
        </div>
        {tab === 'entrar' ? <LoginForm /> : <RegisterForm onSwitchToLogin={() => onTabChange('entrar')} />}
      </div>
    </div>
  );
}

/* ── Screenshot placeholder ────────────────────────────────────────────── */
function ScreenshotPlaceholder({ label, aspect = 'aspect-video' }) {
  return (
    <div className={`w-full ${aspect} rounded-2xl bg-gray-100 border-2 border-dashed border-gray-300 flex flex-col items-center justify-center gap-3 text-gray-400`}>
      <svg className="w-10 h-10 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
      <span className="text-sm font-medium">{label}</span>
    </div>
  );
}

/* ── Main component ────────────────────────────────────────────────────── */
export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [modal, setModal] = useState(null);

  const payload = getTokenPayload();
  const isLoggedIn = !!payload;
  const firstName = payload?.nome?.split?.(' ')?.[0] || payload?.email?.split?.('@')?.[0] || '';

  function openModal(tab) { setModal(tab); }
  function closeModal() { setModal(null); }

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>

      {modal && <AuthModal tab={modal} onClose={closeModal} onTabChange={setModal} />}

      {/* ── NAVBAR ─────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 bg-white border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <svg className="w-4.5 h-4.5 text-white w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <span className="font-bold text-gray-900 text-lg tracking-tight">Alumnus</span>
          </div>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-8 text-sm text-gray-500 font-medium">
            <a href="#funcionalidades" className="hover:text-gray-900 transition-colors">Funcionalidades</a>
          </div>

          <div className="hidden md:flex items-center gap-3">
            {isLoggedIn ? (
              <>
                <span className="text-sm text-gray-500">{greeting()}, <span className="font-semibold text-gray-700">{firstName}</span></span>
                <Link to="/app" className="text-sm bg-blue-600 text-white px-5 py-2 rounded-full hover:bg-blue-700 transition-colors font-semibold">
                  Acessar plataforma
                </Link>
              </>
            ) : (
              <button type="button" onClick={() => openModal('entrar')} className="text-sm bg-blue-600 text-white px-5 py-2 rounded-full hover:bg-blue-700 transition-colors font-semibold">
                Entrar
              </button>
            )}
          </div>

          {/* Mobile toggle */}
          <button className="md:hidden p-2 rounded-lg hover:bg-gray-100" onClick={() => setMenuOpen(o => !o)}>
            <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {menuOpen ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /> : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />}
            </svg>
          </button>
        </div>
        {menuOpen && (
          <div className="md:hidden border-t bg-white px-6 py-4 space-y-1 text-sm">
            <a href="#funcionalidades" className="block py-2 text-gray-600 hover:text-gray-900" onClick={() => setMenuOpen(false)}>Funcionalidades</a>
            <div className="pt-3 border-t mt-2">
              {isLoggedIn ? (
                <Link to="/app" className="block text-center py-2.5 bg-blue-600 text-white rounded-full font-semibold">Acessar plataforma</Link>
              ) : (
                <button type="button" onClick={() => { setMenuOpen(false); openModal('entrar'); }} className="block w-full text-center py-2.5 bg-blue-600 text-white rounded-full font-semibold">Entrar</button>
              )}
            </div>
          </div>
        )}
      </nav>

      {/* ── HERO ───────────────────────────────────────────────────────── */}
      <section className="py-24 md:py-36 px-6 text-center" style={{ backgroundColor: '#fafaf8' }}>
        <div className="max-w-4xl mx-auto">
          {/* Badge institucional Alan Turing */}
          <div className="inline-flex items-center gap-3 bg-white border border-gray-200 rounded-full px-5 py-2 mb-10 shadow-sm">
            <img src="/alan-turing-logo.png" alt="Laboratório Alan Turing" className="h-6 w-auto" />
            <span className="text-sm text-gray-600 font-medium">Ferramenta utilizada no <span className="font-semibold text-gray-800">Laboratório Alan Turing — UFC</span></span>
          </div>

          <h1 className="text-5xl md:text-7xl font-extrabold text-gray-900 leading-[1.05] tracking-tight mb-8">
            Seu grupo de pesquisa,<br />
            <span className="text-blue-600">em um só lugar.</span>
          </h1>
          <p className="text-xl md:text-2xl text-gray-500 leading-relaxed max-w-2xl mx-auto mb-12">
            Visualize pesquisadores como um grafo interativo. Acompanhe perfis, reuniões, publicações e prazos — sem planilhas, sem dispersão.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            {isLoggedIn ? (
              <Link to="/app" className="bg-blue-600 text-white text-lg font-semibold px-10 py-4 rounded-full hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200">
                Acessar plataforma →
              </Link>
            ) : (
              <button type="button" onClick={() => openModal('entrar')} className="bg-blue-600 text-white text-lg font-semibold px-10 py-4 rounded-full hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200">
                Entrar na plataforma →
              </button>
            )}
          </div>
        </div>

        {/* Hero screenshot placeholder */}
        <div className="max-w-5xl mx-auto mt-20">
          <div className="rounded-3xl overflow-hidden shadow-2xl shadow-gray-200 border border-gray-200 bg-white">
            <div className="flex items-center gap-1.5 px-5 py-3.5 border-b border-gray-100 bg-gray-50">
              <div className="w-3 h-3 rounded-full bg-red-400/80" />
              <div className="w-3 h-3 rounded-full bg-yellow-400/80" />
              <div className="w-3 h-3 rounded-full bg-green-400/80" />
              <span className="ml-3 text-xs text-gray-400 font-mono">alumnus — grafo do grupo</span>
            </div>
            <img src="/screenshots/screen1.png" alt="Grafo interativo do grupo de pesquisa" className="w-full object-cover" />
          </div>
        </div>
      </section>

      {/* ── PROBLEMA ───────────────────────────────────────────────────── */}
      <section className="py-28 px-6 bg-white">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-sm font-bold uppercase tracking-widest text-blue-500 mb-6">O problema</p>
          <h2 className="text-4xl md:text-5xl font-extrabold text-gray-900 leading-tight mb-8 tracking-tight">
            Orientar é complexo.<br />A ferramenta não precisa ser.
          </h2>
          <p className="text-xl text-gray-500 leading-relaxed">
            Professores orientadores acumulam informações de dezenas de alunos em e-mails, planilhas e cadernos separados. Não há visão do grupo como um todo. Reuniões se perdem, deadlines escapam, e as relações entre pesquisadores ficam invisíveis.
          </p>
        </div>

        {/* Pain points — 3 colunas */}
        <div className="max-w-4xl mx-auto mt-16 grid md:grid-cols-3 gap-8">
          {[
            { icon: '📋', title: 'Dados espalhados', desc: 'Informações de cada orientando vivem em lugares diferentes, impossíveis de consultar rapidamente.' },
            { icon: '🔗', title: 'Relações invisíveis', desc: 'Quem orienta quem, co-autorias e projetos compartilhados não aparecem em lugar nenhum.' },
            { icon: '⏰', title: 'Prazos que somem', desc: 'Deadlines de conferências e reuniões controlados de forma manual, sem notificações centralizadas.' },
          ].map(({ icon, title, desc }) => (
            <div key={title} className="text-center">
              <div className="text-4xl mb-4">{icon}</div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">{title}</h3>
              <p className="text-gray-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURE 1: Grafo ───────────────────────────────────────────── */}
      <section className="py-28 px-6" style={{ backgroundColor: '#fafaf8' }}>
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-16 items-center">
          <div>
            <p className="text-sm font-bold uppercase tracking-widest text-blue-500 mb-5">Grafo interativo</p>
            <h2 className="text-4xl md:text-5xl font-extrabold text-gray-900 leading-tight tracking-tight mb-6">
              Veja seu grupo como ele realmente é.
            </h2>
            <p className="text-lg text-gray-500 leading-relaxed mb-8">
              Cada pesquisador é um nó. Cada relação de orientação, co-autoria ou colaboração vira uma aresta. Arraste, aproxime e clique para explorar a rede do seu grupo em tempo real.
            </p>
            <ul className="space-y-3">
              {['Cores distintas por nível acadêmico', 'Drag, zoom e pan no canvas', 'Posições salvas automaticamente', 'Clique no nó para acessar o perfil'].map(t => (
                <li key={t} className="flex items-center gap-3 text-gray-600">
                  <svg className="w-5 h-5 text-blue-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl overflow-hidden shadow-xl shadow-gray-200 border border-gray-200 bg-white">
            <img src="/screenshots/screen1.png" alt="Grafo do grupo de pesquisa" className="w-full object-cover" />
          </div>
        </div>
      </section>

      {/* ── FEATURE 2: Perfis ──────────────────────────────────────────── */}
      <section className="py-28 px-6 bg-white" id="funcionalidades">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-16 items-center">
          <div className="order-2 md:order-1 rounded-2xl overflow-hidden shadow-xl shadow-gray-200 border border-gray-200 bg-white">
            <img src="/screenshots/screen2.png" alt="Dashboard do orientador" className="w-full object-cover" />
          </div>
          <div className="order-1 md:order-2">
            <p className="text-sm font-bold uppercase tracking-widest text-blue-500 mb-5">Dashboard do orientador</p>
            <h2 className="text-4xl md:text-5xl font-extrabold text-gray-900 leading-tight tracking-tight mb-6">
              Visão completa do grupo em uma tela.
            </h2>
            <p className="text-lg text-gray-500 leading-relaxed mb-8">
              Acompanhe em tempo real quantos orientandos estão ativos, quantos ainda não se cadastraram, lembretes e entradas no manual — tudo consolidado no dashboard.
            </p>
            <ul className="space-y-3">
              {['Contadores por categoria em destaque', 'Lista de usuários com último acesso', 'Controle de papéis e permissões', 'Filtrado ao seu grupo automaticamente'].map(t => (
                <li key={t} className="flex items-center gap-3 text-gray-600">
                  <svg className="w-5 h-5 text-blue-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── FEATURE 3: Deadlines ───────────────────────────────────────── */}
      <section className="py-28 px-6" style={{ backgroundColor: '#fafaf8' }}>
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-16 items-center">
          <div>
            <p className="text-sm font-bold uppercase tracking-widest text-blue-500 mb-5">Lembretes & Deadlines</p>
            <h2 className="text-4xl md:text-5xl font-extrabold text-gray-900 leading-tight tracking-tight mb-6">
              Nenhum prazo escapa.
            </h2>
            <p className="text-lg text-gray-500 leading-relaxed mb-8">
              Deadlines de conferências ficam visíveis na barra lateral, com contagem regressiva. Lembretes de orientações, reuniões e tarefas ficam acessíveis para todo o grupo.
            </p>
            <ul className="space-y-3">
              {['Barra lateral com próximos prazos', 'Download automático de deadlines por URL', 'Lembrete de proximidade do deadline', 'Separação entre vencidos e futuros'].map(t => (
                <li key={t} className="flex items-center gap-3 text-gray-600">
                  <svg className="w-5 h-5 text-blue-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl overflow-hidden shadow-xl shadow-gray-200 border border-gray-200 bg-white">
            <img src="/screenshots/screen3.png" alt="Página de deadlines" className="w-full object-cover" />
          </div>
        </div>
      </section>

      {/* ── FEATURE 4: Mural / Manual ──────────────────────────────────── */}
      <section className="py-28 px-6 bg-white">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-16 items-center">
          <div className="order-2 md:order-1 rounded-2xl overflow-hidden shadow-xl shadow-gray-200 border border-gray-200 bg-white">
            <img src="/screenshots/screen4.png" alt="Página de lembretes do grupo" className="w-full object-cover" />
          </div>
          <div className="order-1 md:order-2">
            <p className="text-sm font-bold uppercase tracking-widest text-blue-500 mb-5">Lembretes do grupo</p>
            <h2 className="text-4xl md:text-5xl font-extrabold text-gray-900 leading-tight tracking-tight mb-6">
              Tudo que o grupo precisa lembrar, em um só lugar.
            </h2>
            <p className="text-lg text-gray-500 leading-relaxed mb-8">
              Crie lembretes para o grupo inteiro ou para membros específicos. Mencione colegas com @nome, defina datas de vencimento e acompanhe o que está pendente ou já foi concluído.
            </p>
            <ul className="space-y-3">
              {['Lembretes com data de vencimento', 'Menções com @nome para notificar', 'Separação entre pendentes e concluídos', 'Visível para todos do grupo'].map(t => (
                <li key={t} className="flex items-center gap-3 text-gray-600">
                  <svg className="w-5 h-5 text-blue-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── ROLES ──────────────────────────────────────────────────────── */}
      <section className="py-28 px-6" style={{ backgroundColor: '#f0f4ff' }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-sm font-bold uppercase tracking-widest text-blue-500 mb-5">Controle de acesso</p>
            <h2 className="text-4xl md:text-5xl font-extrabold text-gray-900 leading-tight tracking-tight">
              Cada pessoa vê exatamente o que precisa.
            </h2>
          </div>
          <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
            {[
              {
                role: 'Professor',
                color: 'bg-violet-100 text-violet-700',
                dot: 'bg-violet-500',
                desc: 'Visão completa do grupo. Gerencia pesquisadores, edita perfis, cria reuniões e acompanha toda a produção do laboratório.',
                items: ['Grafo completo do grupo', 'Edição de todos os perfis', 'Dashboard do grupo', 'Métricas globais do laboratório'],
              },
              {
                role: 'Pesquisador',
                color: 'bg-blue-100 text-blue-700',
                dot: 'bg-blue-500',
                desc: 'Acesso ao próprio perfil, ao grafo do grupo, ao mural e ao manual. Colabora sem ver dados que não são seus.',
                items: ['Próprio perfil completo', 'Grafo e mural do grupo', 'Manual de sobrevivência', 'Deadlines e lembretes'],
              },
            ].map(({ role, color, dot, desc, items }) => (
              <div key={role} className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
                <div className="flex items-center gap-2 mb-4">
                  <span className={`w-2.5 h-2.5 rounded-full ${dot}`} />
                  <span className={`text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full ${color}`}>{role}</span>
                </div>
                <p className="text-gray-600 leading-relaxed mb-6 text-sm">{desc}</p>
                <ul className="space-y-2">
                  {items.map(i => (
                    <li key={i} className="flex items-center gap-2 text-sm text-gray-500">
                      <svg className="w-4 h-4 text-blue-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                      {i}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA FINAL ──────────────────────────────────────────────────── */}
      <section className="py-28 px-6 bg-white">
        <div className="max-w-3xl mx-auto text-center">
          <div className="flex justify-center mb-8">
            <img src="/alan-turing-logo.png" alt="Laboratório Alan Turing" className="h-12 w-auto opacity-80" />
          </div>
          <h2 className="text-4xl md:text-5xl font-extrabold text-gray-900 leading-tight tracking-tight mb-6">
            Ferramenta oficial do<br />Laboratório Alan Turing
          </h2>
          {isLoggedIn ? (
            <Link to="/app" className="inline-block bg-blue-600 text-white text-lg font-semibold px-10 py-4 rounded-full hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200">
              Acessar plataforma →
            </Link>
          ) : (
            <button type="button" onClick={() => openModal('entrar')} className="bg-blue-600 text-white text-lg font-semibold px-10 py-4 rounded-full hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200">
              Entrar na plataforma →
            </button>
          )}
        </div>
      </section>

      {/* ── FOOTER ─────────────────────────────────────────────────────── */}
      <footer className="bg-gray-900 py-16 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col md:flex-row items-start justify-between gap-10">
            <div>
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                  <svg className="w-[18px] h-[18px] text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <span className="font-bold text-white text-lg">Alumnus</span>
              </div>
              <p className="text-gray-500 text-sm max-w-xs leading-relaxed">
                Gestão de grupos de pesquisa acadêmica. Ferramenta oficial do Laboratório Alan Turing — UFC.
              </p>
              <p className="text-gray-600 text-xs mt-4">
                © {new Date().getFullYear()} Alumnus · Desenvolvido por{' '}
                <a href="https://github.com/gustavopinto" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors">
                  Gustavo Pinto
                </a>
              </p>
            </div>
            <div className="flex gap-16">
              <div>
                <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-4">Plataforma</p>
                <ul className="space-y-3">
                  <li><a href="#funcionalidades" className="text-gray-500 hover:text-white text-sm transition-colors">Funcionalidades</a></li>
                  {isLoggedIn ? (
                    <li><Link to="/app" className="text-gray-500 hover:text-white text-sm transition-colors">Acessar plataforma</Link></li>
                  ) : (
                    <li><button type="button" onClick={() => openModal('entrar')} className="text-gray-500 hover:text-white text-sm transition-colors">Entrar</button></li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
