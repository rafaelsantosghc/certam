import React from 'react';
import { Concurso, Cargo } from '../types';
import { Briefcase, Calendar, CheckCircle2, Clock, Hash, Layers, TrendingUp, Users } from 'lucide-react';

interface QuadroVagasViewProps {
  concurso: Concurso;
  cargoIdSelecionado?: string;
}

export const QuadroVagasView: React.FC<QuadroVagasViewProps> = ({ concurso, cargoIdSelecionado }) => {
  const cargos: Cargo[] = concurso.cargos || [];

  const cargoEmDestaque = cargoIdSelecionado
    ? cargos.find((c) => c.id === cargoIdSelecionado) || cargos[0]
    : cargos[0];

  const cargosParaExibir = cargoIdSelecionado
    ? cargos.filter((c) => c.id === cargoIdSelecionado)
    : cargos;

  return (
    <div className="space-y-6">
      {/* CARD PRINCIPAL DO CARGO EM FOCO */}
      {cargoEmDestaque && (
        <div className="bg-white rounded-3xl border border-slate-200 card-shadow p-6 sm:p-7 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 rounded-md bg-teal-50 text-teal-800 font-mono text-[11px] font-bold uppercase border border-teal-200">
                  {concurso.orgao} • Nível {cargoEmDestaque.nivel}
                </span>
                {cargoEmDestaque.tem_cr && (
                  <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-mono font-bold">
                    Cadastro Reserva Ativo
                  </span>
                )}
              </div>
              <h2 className="text-xl sm:text-2xl font-bold font-serif text-slate-900">
                {cargoEmDestaque.nome}
              </h2>
            </div>

            {/* MARCAÇÃO COM A DATA DA ÚLTIMA ALTERAÇÃO */}
            <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 text-xs font-medium self-start sm:self-auto shrink-0">
              <Clock className="w-3.5 h-3.5 text-teal-600 shrink-0" />
              <span>
                Última atualização:{' '}
                <strong className="text-slate-900 font-mono">
                  {cargoEmDestaque.data_atualizacao_vagas || 'Em apuração'}
                </strong>
              </span>
            </div>
          </div>

          {/* OS 6 QUANTITATIVOS OFICIAIS DO CARGO */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* 1. Quantitativo total do cargo */}
            <div className="bg-slate-50 rounded-2xl p-4 sm:p-5 border border-slate-200/90 flex flex-col justify-between">
              <div>
                <span className="text-2xs font-bold text-slate-500 uppercase tracking-wider block">
                  1. Quantitativo Total do Cargo
                </span>
                <p className="text-2xs text-slate-400 mt-0.5">
                  Total de vagas criadas (ocupadas ou não)
                </p>
              </div>
              <div className="mt-3">
                <span className="text-2xl sm:text-3xl font-bold font-mono text-slate-900">
                  {cargoEmDestaque.quantitativo_total !== undefined
                    ? cargoEmDestaque.quantitativo_total.toLocaleString('pt-BR')
                    : 'Não informado'}
                </span>
              </div>
            </div>

            {/* 2. Vagas disponíveis */}
            <div className="bg-amber-50/50 rounded-2xl p-4 sm:p-5 border border-amber-200 flex flex-col justify-between">
              <div>
                <span className="text-2xs font-bold text-amber-900 uppercase tracking-wider block">
                  2. Vagas Disponíveis
                </span>
                <p className="text-2xs text-amber-700/80 mt-0.5">
                  Existentes disponíveis para provimento no quadro
                </p>
              </div>
              <div className="mt-3">
                <span className="text-2xl sm:text-3xl font-bold font-mono text-amber-900">
                  {cargoEmDestaque.vagas_disponiveis !== undefined
                    ? `${cargoEmDestaque.vagas_disponiveis.toLocaleString('pt-BR')} vagas`
                    : 'Em apuração'}
                </span>
              </div>
            </div>

            {/* 3. Vagas imediatas */}
            <div className="bg-slate-50 rounded-2xl p-4 sm:p-5 border border-slate-200/90 flex flex-col justify-between">
              <div>
                <span className="text-2xs font-bold text-slate-500 uppercase tracking-wider block">
                  3. Vagas Imediatas
                </span>
                <p className="text-2xs text-slate-400 mt-0.5">
                  Total disponibilizado no edital de abertura
                </p>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-bold font-mono text-slate-900">
                  {cargoEmDestaque.vagas_imediatas || '0'}
                </span>
                {cargoEmDestaque.tem_cr && (
                  <span className="text-xs text-slate-500 font-mono">+ CR</span>
                )}
              </div>
            </div>

            {/* 4. Nomeados por este concurso */}
            <div className="bg-emerald-50/50 rounded-2xl p-4 sm:p-5 border border-emerald-200 flex flex-col justify-between">
              <div>
                <span className="text-2xs font-bold text-emerald-900 uppercase tracking-wider block">
                  4. Nomeados por Este Concurso
                </span>
                <p className="text-2xs text-emerald-700/80 mt-0.5">
                  Total já ocupado por este certame
                </p>
              </div>
              <div className="mt-3">
                <span className="text-2xl sm:text-3xl font-bold font-mono text-emerald-900">
                  {cargoEmDestaque.nomeados_concurso !== undefined
                    ? `${cargoEmDestaque.nomeados_concurso} nomeado(s)`
                    : '0 nomeados'}
                </span>
              </div>
            </div>

            {/* 5. Convocados ainda não nomeados */}
            <div className="bg-cyan-50/50 rounded-2xl p-4 sm:p-5 border border-cyan-200 flex flex-col justify-between">
              <div>
                <span className="text-2xs font-bold text-cyan-900 uppercase tracking-wider block">
                  5. Convocados Ainda Não Nomeados
                </span>
                <p className="text-2xs text-cyan-700/80 mt-0.5">
                  Convocados com processo em andamento
                </p>
              </div>
              <div className="mt-3">
                <span className="text-2xl sm:text-3xl font-bold font-mono text-cyan-900">
                  {cargoEmDestaque.convocados_nao_nomeados !== undefined
                    ? `${cargoEmDestaque.convocados_nao_nomeados} em andamento`
                    : '0'}
                </span>
              </div>
            </div>

            {/* 6. Vagas previstas para o próximo lote */}
            <div className="bg-indigo-50/50 rounded-2xl p-4 sm:p-5 border border-indigo-200 flex flex-col justify-between">
              <div>
                <span className="text-2xs font-bold text-indigo-900 uppercase tracking-wider block">
                  6. Vagas Previstas p/ Próximo Lote
                </span>
                <p className="text-2xs text-indigo-700/80 mt-0.5">
                  Previsão oficial e data do próximo chamamento
                </p>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-bold font-mono text-indigo-950">
                  {cargoEmDestaque.vagas_previstas_proximo_lote !== undefined
                    ? `${cargoEmDestaque.vagas_previstas_proximo_lote} vagas`
                    : 'A definir'}
                </span>
                {cargoEmDestaque.data_prevista_proximo_lote && (
                  <span className="px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-900 font-mono text-2xs font-bold">
                    Previsto: {cargoEmDestaque.data_prevista_proximo_lote}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TABELA CONSOLIDADA DOS CARGOS */}
      <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 card-shadow space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-serif font-bold text-base text-[#07192B]">
              Quadro Comparativo de Vagas ({concurso.orgao})
            </h3>
            <p className="text-xs text-slate-500">
              Acompanhamento oficial dos 6 indicadores de vagas por cargo
            </p>
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-2xl">
          <table className="w-full text-left text-xs divide-y divide-slate-100">
            <thead className="bg-[#07192B] text-white font-medium text-2xs uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Cargo</th>
                <th className="py-3 px-3 text-right">Quantitativo Total</th>
                <th className="py-3 px-3 text-right text-amber-300">Vagas Disponíveis</th>
                <th className="py-3 px-3 text-right">Vagas Imediatas</th>
                <th className="py-3 px-3 text-right text-emerald-300">Nomeados Concurso</th>
                <th className="py-3 px-3 text-right text-cyan-300">Convocados em Andamento</th>
                <th className="py-3 px-3 text-right text-indigo-300">Próximo Lote</th>
                <th className="py-3 px-4 text-center">Última Atualização</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cargos.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    Nenhum cargo cadastrado neste concurso.
                  </td>
                </tr>
              ) : (
                cargos.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      <div>{c.nome}</div>
                      <span className="text-[10px] text-slate-400 font-mono font-normal">
                        Nível {c.nivel} {c.tem_cr ? '• CR' : ''}
                      </span>
                    </td>

                    {/* 1. Quantitativo Total */}
                    <td className="py-3.5 px-3 text-right font-mono text-slate-800 font-semibold">
                      {c.quantitativo_total !== undefined ? c.quantitativo_total.toLocaleString('pt-BR') : '-'}
                    </td>

                    {/* 2. Vagas Disponíveis */}
                    <td className="py-3.5 px-3 text-right font-mono text-amber-900 font-bold bg-amber-50/40">
                      {c.vagas_disponiveis !== undefined
                        ? c.vagas_disponiveis.toLocaleString('pt-BR')
                        : c.vagas_reais_abertas !== undefined
                        ? c.vagas_reais_abertas.toLocaleString('pt-BR')
                        : '-'}
                    </td>

                    {/* 3. Vagas Imediatas */}
                    <td className="py-3.5 px-3 text-right font-mono text-slate-700">
                      {c.vagas_imediatas ?? 0}
                    </td>

                    {/* 4. Nomeados por este concurso */}
                    <td className="py-3.5 px-3 text-right font-mono text-emerald-800 font-semibold bg-emerald-50/30">
                      {c.nomeados_concurso !== undefined ? c.nomeados_concurso : '0'}
                    </td>

                    {/* 5. Convocados ainda não nomeados */}
                    <td className="py-3.5 px-3 text-right font-mono text-cyan-800 font-semibold">
                      {c.convocados_nao_nomeados !== undefined ? c.convocados_nao_nomeados : '0'}
                    </td>

                    {/* 6. Vagas previstas para o próximo lote */}
                    <td className="py-3.5 px-3 text-right font-mono text-indigo-900 font-semibold">
                      {c.vagas_previstas_proximo_lote !== undefined ? (
                        <div>
                          <span>{c.vagas_previstas_proximo_lote} vagas</span>
                          {c.data_prevista_proximo_lote && (
                            <span className="text-[10px] text-indigo-700 block font-normal">
                              ({c.data_prevista_proximo_lote})
                            </span>
                          )}
                        </div>
                      ) : (
                        '-'
                      )}
                    </td>

                    {/* Data da última alteração */}
                    <td className="py-3.5 px-4 text-center font-mono text-[11px] text-slate-600">
                      {c.data_atualizacao_vagas || 'Em apuração'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
