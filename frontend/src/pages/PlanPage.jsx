import React from 'react';
import { useOutletContext } from 'react-router-dom';

const FEATURES = [
  'Grafo interativo do grupo',
  'Perfis completos de pesquisadores',
  'Anotações de reuniões',
  'Deadlines de conferências',
  'Lembretes com @menções',
  'Mural colaborativo',
  'Manual de sobrevivência',
  'Dashboard do orientador',
];

function planLabel(type) {
  if (type === 'monthly') return 'Mensal';
  if (type === 'annual') return 'Anual';
  return 'Trial';
}

function statusLabel(status) {
  if (status === 'active') return 'Ativo';
  if (status === 'expired') return 'Expirado';
  return status || '—';
}

export default function PlanPage() {
  const { currentUser } = useOutletContext();

  const planType = currentUser?.plan_type || 'trial';
  const planStatus = currentUser?.plan_status || 'active';
  const trialDays = currentUser?.trial_days_remaining;
  const isTrial = planType === 'trial';
  const isExpired = planStatus === 'expired';

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      {/* Plano atual */}
      <div className="mb-10">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Meu Plano</h1>

        <div className={`rounded-2xl border-2 p-6 ${isExpired ? 'border-red-200 bg-red-50' : 'border-blue-200 bg-blue-50'}`}>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1">Plano atual</p>
              <p className="text-2xl font-extrabold text-gray-900">{planLabel(planType)}</p>
            </div>
            <div className={`px-3 py-1 rounded-full text-xs font-bold ${
              isExpired
                ? 'bg-red-100 text-red-700'
                : 'bg-green-100 text-green-700'
            }`}>
              {statusLabel(planStatus)}
            </div>
          </div>

          {isTrial && trialDays != null && (
            <div className="mt-4">
              <div className="flex items-center justify-between text-sm mb-1.5">
                <span className="text-gray-600">Dias restantes</span>
                <span className={`font-bold ${trialDays <= 5 ? 'text-red-600' : 'text-gray-900'}`}>
                  {trialDays} {trialDays === 1 ? 'dia' : 'dias'}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${trialDays <= 5 ? 'bg-red-500' : 'bg-blue-500'}`}
                  style={{ width: `${Math.max(2, (trialDays / 30) * 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Funcionalidades incluídas */}
      <div className="bg-gray-50 rounded-2xl border border-gray-200 p-8 mb-10">
        <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-6 text-center">
          Tudo incluso em qualquer plano
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          {FEATURES.map(f => (
            <div key={f} className="flex items-center gap-2 text-sm text-gray-700">
              <svg className="w-4 h-4 text-blue-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              {f}
            </div>
          ))}
        </div>
      </div>

      {/* Cards de planos */}
      <h2 className="text-lg font-bold text-gray-900 mb-4">Planos disponíveis</h2>
      <div className="grid md:grid-cols-3 gap-6">
        {/* Trial */}
        <div className={`rounded-2xl border-2 p-8 ${
          planType === 'trial' ? 'border-blue-400 bg-blue-50 ring-2 ring-blue-200' : 'border-dashed border-gray-200 bg-gray-50'
        }`}>
          <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-4">Trial</p>
          <div className="mb-1">
            <span className="text-4xl font-extrabold text-gray-900">Grátis</span>
          </div>
          <p className="text-sm text-gray-400 mb-6">30 dias · sem cartão · acesso completo</p>
          {planType === 'trial' ? (
            <span className="block text-center py-2.5 rounded-full text-sm font-semibold bg-blue-600 text-white">
              Plano atual
            </span>
          ) : (
            <span className="block text-center py-2.5 rounded-full text-sm font-semibold border-2 border-gray-200 text-gray-400">
              —
            </span>
          )}
        </div>

        {/* Mensal */}
        <div className={`rounded-2xl border-2 p-8 ${
          planType === 'monthly' ? 'border-blue-400 bg-blue-50 ring-2 ring-blue-200' : 'border-gray-200 bg-white'
        }`}>
          <p className="text-xs font-bold uppercase tracking-widest text-blue-600 mb-4">Mensal</p>
          <div className="flex items-end gap-1 mb-1">
            <span className="text-xl text-gray-400 mb-0.5">R$</span>
            <span className="text-4xl font-extrabold text-gray-900">20</span>
            <span className="text-base text-gray-400 mb-0.5">/mês</span>
          </div>
          <p className="text-sm text-gray-400 mb-6">Cancele quando quiser</p>
          {planType === 'monthly' ? (
            <span className="block text-center py-2.5 rounded-full text-sm font-semibold bg-blue-600 text-white">
              Plano atual
            </span>
          ) : (
            <a
              href="mailto:gpinto@ufpa.br?subject=Alumnus%20-%20Plano%20Mensal"
              className="block text-center py-2.5 rounded-full text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
              Assinar mensalmente
            </a>
          )}
        </div>

        {/* Anual */}
        <div className={`rounded-2xl border-2 p-8 relative ${
          planType === 'annual' ? 'border-blue-400 bg-blue-600 text-white ring-2 ring-blue-300' : 'border-blue-600 bg-blue-600 text-white'
        }`}>
          <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold bg-white text-blue-600 shadow-sm whitespace-nowrap">
            Mais popular
          </span>
          <p className="text-xs font-bold uppercase tracking-widest text-blue-200 mb-4">Anual</p>
          <div className="flex items-end gap-1 mb-1">
            <span className="text-xl text-blue-200 mb-0.5">R$</span>
            <span className="text-4xl font-extrabold">200</span>
            <span className="text-base text-blue-200 mb-0.5">/ano</span>
          </div>
          <p className="text-sm text-blue-200 mb-6">R$ 16,67/mês · 2 meses grátis</p>
          {planType === 'annual' ? (
            <span className="block text-center py-2.5 rounded-full text-sm font-semibold bg-white text-blue-600">
              Plano atual
            </span>
          ) : (
            <a
              href="mailto:gpinto@ufpa.br?subject=Alumnus%20-%20Plano%20Anual"
              className="block text-center py-2.5 rounded-full text-sm font-semibold bg-white text-blue-600 hover:bg-blue-50 transition-colors"
            >
              Assinar anualmente
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
