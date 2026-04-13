import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { modKey, isModEnter } from '../platform';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getTip, updateTip, deleteTip,
  toggleTipVote, addTipComment, deleteTipComment,
  uploadImage,
} from '../api';
import { getTokenPayload, isDashboardRole } from '../auth';
import { useAppLayout } from '../components/AppLayout';
import { keys } from '../queryKeys';
import Toast from '../components/Toast';
import { useConfirm } from '../components/ConfirmModal';
import RichContent from '../components/RichContent';
import RichEditor from '../components/RichEditor';
import { slugify } from '../mentionUtils.jsx';

function sameUser(a, b) {
  if (a == null || b == null) return false;
  return Number(a) === Number(b);
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('pt-BR');
}

export default function ManualDetailPage() {
  const { id } = useParams();
  const { currentInstitution, researchers = [] } = useAppLayout();
  const [toast, setToast] = useState('');
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editQuestion, setEditQuestion] = useState('');
  const [editAnswer, setEditAnswer] = useState('');
  const [saving, setSaving] = useState(false);
  const { confirm, modal: confirmModal } = useConfirm();
  const payload = getTokenPayload();
  const canModerate = isDashboardRole(payload?.role);
  const authUserId = payload?.sub != null ? Number(payload.sub) : null;

  const queryClient = useQueryClient();
  const instId = currentInstitution !== undefined ? (currentInstitution?.id ?? null) : undefined;

  const { data: entry, isLoading } = useQuery({
    queryKey: keys.tip(Number(id)),
    queryFn: () => getTip(id),
    enabled: !!id,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: keys.tip(Number(id)) });
    queryClient.invalidateQueries({ queryKey: keys.tips(instId) });
  };

  const deleteMutation = useMutation({
    mutationFn: () => deleteTip(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.tips(instId) });
      window.history.back();
    },
  });

  async function handleDelete() {
    if (!await confirm({ title: 'Remover esta entrada?', description: 'Esta acao nao pode ser desfeita.', confirmLabel: 'Remover' })) return;
    deleteMutation.mutate();
  }

  async function handleVote() {
    await toggleTipVote(id);
    invalidate();
  }

  async function handleComment(e) {
    e.preventDefault();
    if (!commentText.trim()) return;
    setSubmitting(true);
    await addTipComment(id, commentText.trim());
    setCommentText('');
    setSubmitting(false);
    invalidate();
  }

  async function handleDeleteComment(commentId) {
    await deleteTipComment(commentId);
    invalidate();
  }

  function startEditing() {
    setEditQuestion(entry.question);
    setEditAnswer(entry.answer);
    setEditing(true);
  }

  async function handleSaveEdit(e) {
    e?.preventDefault();
    if (!editQuestion.trim() || !editAnswer.trim()) return;
    setSaving(true);
    try {
      await updateTip(id, { question: editQuestion.trim(), answer: editAnswer.trim() });
      setEditing(false);
      setToast('Entrada atualizada');
      invalidate();
    } catch (err) {
      setToast(err?.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-full bg-gray-50">
        <main className="max-w-3xl mx-auto py-8 px-8">
          <p className="text-sm text-gray-400">Carregando...</p>
        </main>
      </div>
    );
  }

  if (!entry) {
    return (
      <div className="min-h-full bg-gray-50">
        <main className="max-w-3xl mx-auto py-8 px-8">
          <p className="text-sm text-gray-500">Entrada nao encontrada.</p>
          <Link to="/app/manual" className="text-sm text-blue-600 hover:underline mt-2 inline-block">Voltar ao manual</Link>
        </main>
      </div>
    );
  }

  const canDeleteEntry = sameUser(entry.author_id, authUserId) || canModerate;
  const canEdit = canDeleteEntry;

  return (
    <div className="min-h-full bg-gray-50">
      {confirmModal}
      <Toast message={toast} onClose={() => setToast('')} />
      <main className="max-w-3xl mx-auto py-8 px-8 space-y-6">
        {/* Navegacao */}
        <div className="flex items-center justify-between">
          <Link to="/app/manual" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-blue-600 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Voltar ao manual
          </Link>
          <Link
            to="/app/manual?new=1"
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Adicionar Manual
          </Link>
        </div>

        {/* Pergunta */}
        <article className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-6">
            <div className="flex items-start gap-4">
              {/* Votos */}
              <div className="flex flex-col items-center gap-1 shrink-0 pt-1">
                <button
                  type="button"
                  onClick={handleVote}
                  className={`w-9 h-9 flex items-center justify-center rounded-full transition-colors ${entry.user_voted ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:text-blue-500 hover:bg-blue-50'}`}
                  title={entry.user_voted ? 'Remover voto' : 'Votar'}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill={entry.user_voted ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  </svg>
                </button>
                <span className={`text-sm font-bold tabular-nums ${entry.vote_count > 0 ? 'text-blue-600' : 'text-gray-400'}`}>{entry.vote_count}</span>
              </div>

              {/* Conteudo */}
              <div className="flex-1 min-w-0">
                {editing ? (
                  <form onSubmit={handleSaveEdit} className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Pergunta</label>
                      <input
                        className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                        value={editQuestion}
                        onChange={e => setEditQuestion(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Resposta</label>
                      <RichEditor
                        variant="full"
                        researchers={researchers}
                        value={editAnswer}
                        onChange={setEditAnswer}
                        onSubmit={handleSaveEdit}
                        placeholder="Resposta..."
                        uploadImage={uploadImage}
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <button type="button" onClick={() => setEditing(false)} className="px-4 py-1.5 text-sm text-gray-600 hover:text-gray-800">
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={saving || !editQuestion.trim() || !editAnswer.trim()}
                        className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
                      >
                        {saving ? 'Salvando...' : 'Salvar'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-3">
                      <h1 className="text-lg font-bold text-gray-900 leading-snug">{entry.question}</h1>
                      <div className="flex gap-1 shrink-0">
                        {canEdit && (
                          <button
                            type="button"
                            onClick={startEditing}
                            className="p-1.5 rounded-md text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                            title="Editar entrada"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13l6.5-6.5a2 2 0 112.828 2.828L11.828 15.828a4 4 0 01-1.414.828l-3 1 1-3a4 4 0 01.828-1.414z" />
                            </svg>
                          </button>
                        )}
                        {canDeleteEntry && (
                          <button
                            type="button"
                            onClick={handleDelete}
                            className="p-1.5 rounded-md text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            title="Remover entrada"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>

                    <p className="text-xs text-gray-500 mt-1.5">
                      {entry.author_name ? (
                        <>Por <Link to={`/app/profile/${slugify(entry.author_name)}`} className="font-medium text-gray-700 hover:text-blue-600 hover:underline">{entry.author_name}</Link></>
                      ) : (
                        <span className="italic">Autor desconhecido</span>
                      )}
                      {entry.created_at && (
                        <span className="text-gray-400"> &middot; {formatDate(entry.created_at)}</span>
                      )}
                    </p>

                    {/* Resposta */}
                    <div className="mt-4 rounded-lg bg-gray-50 border border-gray-100 px-4 py-4">
                      <RichContent html={entry.answer} className="text-sm text-gray-800 leading-relaxed" />
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </article>

        {/* Comentarios */}
        <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">
              Comentarios
              {entry.comments.length > 0 && (
                <span className="text-gray-400 font-normal ml-1">({entry.comments.length})</span>
              )}
            </h2>

            {entry.comments.length === 0 && (
              <p className="text-xs text-gray-400 italic mb-4">Nenhum comentario ainda.</p>
            )}

            <div className="space-y-3 mb-4">
              {entry.comments.map(c => (
                <div key={c.id} className="flex gap-2 group/comment border-b border-gray-50 pb-3 last:border-0">
                  <div className="flex-1 min-w-0">
                    {c.author_name
                      ? <Link to={`/app/profile/${slugify(c.author_name)}`} className="text-xs font-semibold text-gray-600 hover:text-blue-600 hover:underline">{c.author_name}</Link>
                      : <span className="text-xs font-semibold text-gray-600">Anonimo</span>
                    }{' '}
                    <span className="text-xs text-gray-400">{formatDate(c.created_at)}</span>
                    <p className="text-xs text-gray-700 mt-0.5 whitespace-pre-wrap">{c.text}</p>
                  </div>
                  {(sameUser(c.author_id, authUserId) || canModerate) && (
                    <button
                      type="button"
                      onClick={() => handleDeleteComment(c.id)}
                      className="text-red-400 hover:text-red-600 opacity-0 group-hover/comment:opacity-100 shrink-0 p-0.5 self-start"
                      title="Remover comentario"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>

            <form onSubmit={handleComment} className="flex gap-2">
              <input
                className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                placeholder="Adicionar comentario..."
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                onKeyDown={e => isModEnter(e) && handleComment(e)}
                maxLength={500}
              />
              <button
                type="submit"
                disabled={submitting || !commentText.trim()}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-40"
              >
                Enviar <span className="opacity-50 text-xs">{modKey}+Enter</span>
              </button>
            </form>
          </div>
        </section>
      </main>
    </div>
  );
}
