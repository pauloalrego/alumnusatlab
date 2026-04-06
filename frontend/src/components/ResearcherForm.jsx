import React, { useState, useEffect } from 'react';
import { createResearcher, updateResearcher } from '../api';
import Toast from './Toast';
import { modKey, isModEnter } from '../platform';

const EMPTY = { nome: '', status: 'graduacao', email: '', orientador_id: '', matricula: '', curso: '', enrollment_date: '', institution_id: '' };

export default function ResearcherForm({ researcher, professors = [], institutions = [], onSaved, onCancel }) {
  const [form, setForm] = useState(EMPTY);
  const [toast, setToast] = useState('');

  useEffect(() => {
    if (researcher) {
      setForm({
        nome: researcher.nome || '',
        status: researcher.status || 'graduacao',
        email: researcher.email || '',
        orientador_id: researcher.orientador_id || '',
        matricula: researcher.matricula || '',
        curso: researcher.curso || '',
        enrollment_date: researcher.enrollment_date || '',
        institution_id: researcher.institution_id || '',
      });
    } else {
      setForm(EMPTY);
    }
  }, [researcher]);

  useEffect(() => {
    if (!researcher && institutions.length === 1) {
      setForm(prev => ({ ...prev, institution_id: String(institutions[0].id) }));
    }
  }, [institutions, researcher]);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  async function handleSubmit(e) {
    e.preventDefault();
    const payload = {
      ...form,
      orientador_id: form.orientador_id ? Number(form.orientador_id) : null,
      institution_id: form.institution_id ? Number(form.institution_id) : null,
    };
    if (researcher) {
      await updateResearcher(researcher.id, payload);
      setToast('Pesquisador atualizado com sucesso');
    } else {
      await createResearcher(payload);
      setToast('Pesquisador criado com sucesso');
    }
    setTimeout(onSaved, 1200);
  }

  return (
    <>
    <Toast message={toast} onClose={() => setToast('')} />
    <form onSubmit={handleSubmit} className="space-y-3">
      <h3 className="font-bold text-lg">{researcher ? 'Editar Pesquisador' : 'Novo Pesquisador'}</h3>

      <input className="w-full border rounded px-3 py-2 text-sm" placeholder="Nome *" required value={form.nome} onChange={set('nome')} />

      <select className="w-full border rounded px-3 py-2 text-sm" value={form.status} onChange={set('status')}>
        <option value="graduacao">Graduação</option>
        <option value="mestrado">Mestrado</option>
        <option value="doutorado">Doutorado</option>
        <option value="postdoc">Pós-doc</option>
      </select>

      <input className="w-full border rounded px-3 py-2 text-sm" placeholder="E-mail" value={form.email} onChange={set('email')} />

      <select className="w-full border rounded px-3 py-2 text-sm" value={form.orientador_id} onChange={set('orientador_id')}>
        <option value="">Sem orientador</option>
        {professors.map((p) => (
          <option key={p.id} value={p.id}>{p.nome}</option>
        ))}
      </select>

      {!researcher && institutions.length > 0 && (
        institutions.length === 1 ? (
          <p className="text-xs text-gray-500 px-1">Instituição: <span className="font-medium text-gray-700">{institutions[0].name}</span></p>
        ) : (
          <select className="w-full border rounded px-3 py-2 text-sm" value={form.institution_id} onChange={set('institution_id')}>
            <option value="">Selecionar instituição…</option>
            {institutions.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
        )
      )}

      <div className="flex gap-2">
        <input className="flex-1 border rounded px-3 py-2 text-sm" placeholder="Matrícula" value={form.matricula} onChange={set('matricula')} />
        <input className="flex-1 border rounded px-3 py-2 text-sm" placeholder="Curso" value={form.curso} onChange={set('curso')} />
      </div>

      <div>
        <label className="text-xs text-gray-500">
          Data de ingresso {(form.status === 'mestrado' || form.status === 'doutorado') ? '*' : ''}
        </label>
        <input
          type="date"
          className="w-full border rounded px-3 py-2 text-sm mt-1"
          value={form.enrollment_date}
          required={form.status === 'mestrado' || form.status === 'doutorado'}
          onChange={set('enrollment_date')}
        />
      </div>

      <div className="flex gap-2">
        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">
          {researcher ? <><span>Salvar</span> <span className="opacity-50 text-xs">{modKey}+Enter</span></> : <><span>Criar</span> <span className="opacity-50 text-xs">{modKey}+Enter</span></>}
        </button>
        <button type="button" onClick={onCancel} className="bg-gray-200 px-4 py-2 rounded text-sm hover:bg-gray-300">
          Cancelar
        </button>
      </div>
    </form>
    </>
  );
}
