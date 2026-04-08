import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { modKey, isModEnter } from '../platform';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getTips, createTip, deleteTip, uploadImage,
} from '../api';
import { getTokenPayload, isDashboardRole } from '../auth';
import { useAppLayout } from '../components/AppLayout';
import { keys } from '../queryKeys';
import Toast from '../components/Toast';
import RichEditor from '../components/RichEditor';
import { useConfirm } from '../components/ConfirmModal';
import { slugify } from '../mentionUtils.jsx';

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('pt-BR');
}

function EntryRow({ entry, canModerate, authUserId, onDelete }) {
  const canDeleteEntry = (entry.author_id != null && Number(entry.author_id) === authUserId) || canModerate;

  return (
    <div className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0 group">
      {/* Estatisticas */}
      <div className="flex items-center gap-3 shrink-0 text-xs tabular-nums">
        <div className={`flex flex-col items-center w-12 ${entry.vote_count > 0 ? 'text-blue-600' : 'text-gray-400'}`}>
          <span className="font-bold text-sm">{entry.vote_count}</span>
          <span className="text-[10px] uppercase tracking-wide">{entry.vote_count === 1 ? 'voto' : 'votos'}</span>
        </div>
        <div className={`flex flex-col items-center w-12 ${entry.comments.length > 0 ? 'text-green-600' : 'text-gray-400'}`}>
          <span className="font-bold text-sm">{entry.comments.length}</span>
          <span className="text-[10px] uppercase tracking-wide">{entry.comments.length === 1 ? 'coment.' : 'coment.'}</span>
        </div>
      </div>

      {/* Pergunta */}
      <div className="flex-1 min-w-0">
        <Link
          to={`/app/manual/${entry.id}`}
          className="text-sm font-medium text-blue-700 hover:text-blue-900 hover:underline leading-snug line-clamp-2"
        >
          {entry.question}
        </Link>
        <p className="text-xs text-gray-400 mt-1">
          {entry.author_name ? (
            <Link to={`/app/profile/${slugify(entry.author_name)}`} className="text-gray-500 hover:text-blue-600 hover:underline">{entry.author_name}</Link>
          ) : (
            <span className="italic">Autor desconhecido</span>
          )}
          {entry.created_at && (
            <span> &middot; {formatDate(entry.created_at)}</span>
          )}
        </p>
      </div>

      {/* Delete */}
      {canDeleteEntry && (
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); onDelete(entry.id); }}
          className="shrink-0 p-1.5 rounded-md text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
          title="Remover entrada"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      )}
    </div>
  );
}

export default function ManualPage() {
  const { currentInstitution, researchers = [] } = useAppLayout();
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [toast, setToast] = useState('');
  const [searchParams] = useSearchParams();
  const [showForm, setShowForm] = useState(searchParams.get('new') === '1');
  const { confirm, modal: confirmModal } = useConfirm();
  const payload = getTokenPayload();
  const canModerateManual = isDashboardRole(payload?.role);
  const authUserId = payload?.sub != null ? Number(payload.sub) : null;

  const queryClient = useQueryClient();
  const instId = currentInstitution !== undefined ? (currentInstitution?.id ?? null) : undefined;
  const { data: entries = [] } = useQuery({
    queryKey: keys.tips(instId),
    queryFn: () => getTips(instId),
    enabled: instId !== undefined,
  });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: keys.tips(instId) });

  const createMutation = useMutation({
    mutationFn: () => createTip({ question: question.trim(), answer: answer.trim() }, instId),
    onSuccess: () => {
      setQuestion('');
      setAnswer('');
      setShowForm(false);
      setToast('Entrada adicionada com sucesso');
      invalidate();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteTip(id),
    onSuccess: () => { setToast('Entrada removida'); invalidate(); },
  });

  function handleSubmit(e) {
    e?.preventDefault();
    if (!question.trim() || !answer.trim()) return;
    createMutation.mutate();
  }

  async function handleDelete(id) {
    if (!await confirm({ title: 'Remover esta entrada?', description: 'Esta acao nao pode ser desfeita.', confirmLabel: 'Remover' })) return;
    deleteMutation.mutate(id);
  }

  return (
    <div className="min-h-full bg-gray-50">
      {confirmModal}
      <Toast message={toast} onClose={() => setToast('')} />
      <main className="max-w-3xl mx-auto py-8 px-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Manual de Sobrevivência</h1>
            <p className="text-sm text-gray-500 mt-0.5">{entries.length} {entries.length === 1 ? 'pergunta' : 'perguntas'}</p>
          </div>
          <button
            type="button"
            onClick={() => setShowForm(f => !f)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            {showForm ? 'Cancelar' : 'Adicionar Manual'}
          </button>
        </div>

        {/* Formulario (togglavel) */}
        {showForm && (
          <section className="bg-white rounded-xl shadow-sm border p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-4">Nova entrada</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label htmlFor="manual-question" className="block text-xs font-medium text-gray-700 mb-1">
                  Pergunta <span className="text-red-500">*</span>
                </label>
                <input
                  id="manual-question"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder="Pergunta..."
                  value={question}
                  onChange={e => setQuestion(e.target.value)}
                  onKeyDown={(e) => { if (isModEnter(e)) { e.preventDefault(); handleSubmit(e); } }}
                  required
                />
              </div>
              <div>
                <label htmlFor="manual-answer" className="block text-xs font-medium text-gray-700 mb-1">
                  Resposta <span className="text-red-500">*</span>
                </label>
                <RichEditor
                  variant="full"
                  researchers={researchers}
                  value={answer}
                  onChange={setAnswer}
                  onSubmit={handleSubmit}
                  placeholder="Resposta..."
                  uploadImage={uploadImage}
                />
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={createMutation.isPending || !question.trim() || !answer.trim()}
                  className="ml-auto bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
                >
                  {createMutation.isPending ? 'Salvando...' : <>Publicar <span className="opacity-50 text-xs">{modKey}+Enter</span></>}
                </button>
              </div>
            </form>
          </section>
        )}

        {/* Lista */}
        <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {entries.length === 0 && (
            <div className="px-6 py-10 text-center">
              <p className="text-sm text-gray-400 italic">Nenhuma entrada ainda.</p>
            </div>
          )}
          {entries.map(entry => (
            <EntryRow
              key={entry.id}
              entry={entry}
              authUserId={authUserId}
              canModerate={canModerateManual}
              onDelete={handleDelete}
            />
          ))}
        </section>
      </main>
    </div>
  );
}
