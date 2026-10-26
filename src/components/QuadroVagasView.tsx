import React from 'react';
import { Concurso, QuadroVagas, ConvocacaoHistorico } from '../types';
import { Briefcase, Users, TrendingUp, AlertCircle, Building2, CheckCircle2 } from 'lucide-react';

interface QuadroVagasViewProps {
  concurso: Concurso;
  cargoIdSelecionado?: string;
}

export const QuadroVagasView: React.FC<QuadroVagasViewProps> = ({ concurso, cargoIdSelecionado }) => {
  const quadros: QuadroVagas[] = concurso.quadro_vagas || [];
  const convocacoes: ConvocacaoHistorico[] = concurso.convocacoes || [];

  const quadroFiltrado = cargoIdSelecionado
    ? quadros.filter((q) => q.cargo_id === cargoIdSelecionado)
    : quadros;

  const totalCargosCriados = quadros.reduce((acc, q) => acc + q.cargos_criados_lei, 0);
  const totalOcupadas = quadros.reduce((acc, q) => acc + q.vagas_ocupadas, 0);
  const totalVagasReais = quadros.reduce((acc, q) => acc + q.vagas_reais_abertas, 0);
  const totalAposentadorias = quadros.reduce((acc, q) => acc + q.aposentadorias_previstas, 0);

  return (
    <div className="space-y-6">
      {/* Cards de Métricas Consolidadas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 card-shadow">
          <div className="flex items-center justify-between">
            <span className="text-2xs font-bold text-slate-500 uppercase tracking-wider">
              Total de Cargos em Lei
            </span>
            <Building2 className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 mt-2">
            {totalCargosCriados.toLocaleString('pt-BR')}
          </div>
          <span className="text-2xs text-slate-500 mt-1 block">Estrutura legal do órgão</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 card-shadow">
          <div className="flex items-center justify-between">
            <span className="text-2xs font-bold text-slate-500 uppercase tracking-wider">
              Cargos Ocupados
            </span>
            <Users className="w-4 h-4 text-teal-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-teal-800 mt-2">
            {totalOcupadas.toLocaleString('pt-BR')}
          </div>
          <span className="text-2xs text-teal-700 font-semibold mt-1 block">
            {totalCargosCriados > 0
              ? `${((totalOcupadas / totalCargosCriados) * 100).toFixed(1)}% de ocupação`
              : 'Em exercício'}
          </span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-amber-200 bg-amber-50/20 card-shadow">
          <div className="flex items-center justify-between">
            <span className="text-2xs font-bold text-amber-800 uppercase tracking-wider">
              Cargos Vagos Reais
            </span>
            <TrendingUp className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-amber-900 mt-2">
            {totalVagasReais.toLocaleString('pt-BR')}
          </div>
          <span className="text-2xs text-amber-700 font-bold mt-1 block">
            Espaço legal para novas nomeações
          </span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 card-shadow">
          <div className="flex items-center justify-between">
            <span className="text-2xs font-bold text-slate-500 uppercase tracking-wider">
              Aposentadorias Previstas
            </span>
            <AlertCircle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-rose-700 mt-2">
            +{totalAposentadorias.toLocaleString('pt-BR')}
          </div>
          <span className="text-2xs text-slate-500 mt-1 block">Vacâncias estimadas no próximo ano</span>
        </div>
      </div>

      {/* Detalhamento por Cargo */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 card-shadow space-y-4">
        <div>
          <h3 className="font-serif font-bold text-base text-[#07192B]">
            Quadro Oficial de Vacâncias por Cargo ({concurso.orgao})
          </h3>
          <p className="text-xs text-slate-500">
            Dados extraídos dos demonstrativos de transparência e relatórios da Resolução CNJ/CNMP
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border border-slate-200 rounded-xl overflow-hidden">
            <thead className="bg-[#07192B] text-white font-serif text-2xs uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4 font-semibold">Cargo Efetivo</th>
                <th className="py-3 px-3 font-semibold text-right">Cargos em Lei</th>
                <th className="py-3 px-3 font-semibold text-right">Ocupados</th>
                <th className="py-3 px-3 font-semibold text-right text-amber-300">Cargos Vagos Reais</th>
                <th className="py-3 px-3 font-semibold text-right">Aposentadorias</th>
                <th className="py-3 px-4 font-semibold">Atualização & Fonte</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {quadroFiltrado.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-400">
                    Nenhum demonstrativo cadastrado para este cargo.
                  </td>
                </tr>
              ) : (
                quadroFiltrado.map((q) => (
                  <tr key={q.cargo_id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-slate-900">{q.cargo_nome}</td>
                    <td className="py-3.5 px-3 text-right font-mono text-slate-700">
                      {q.cargos_criados_lei.toLocaleString('pt-BR')}
                    </td>
                    <td className="py-3.5 px-3 text-right font-mono text-teal-800 font-semibold">
                      {q.vagas_ocupadas.toLocaleString('pt-BR')}
                    </td>
                    <td className="py-3.5 px-3 text-right font-mono text-amber-900 font-bold bg-amber-50/50">
                      {q.vagas_reais_abertas.toLocaleString('pt-BR')}
                    </td>
                    <td className="py-3.5 px-3 text-right font-mono text-rose-700 font-medium">
                      +{q.aposentadorias_previstas}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                      <div>{q.data_atualizacao}</div>
                      <div className="text-[10px] text-slate-400 truncate max-w-[200px]">
                        {q.fonte_oficial || 'Portal da Transparência'}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Histórico de Convocações e Nomeações */}
      {convocacoes.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 card-shadow space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-serif font-bold text-base text-[#07192B]">
                Andamento das Convocações e Nomeações Oficiais
              </h3>
              <p className="text-xs text-slate-500">Histórico de lotes e chamamentos publicados no diário oficial</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {convocacoes.map((c) => (
              <div key={c.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-900">{c.lote_nome}</span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    {c.status_processamento || 'Concluído'}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center pt-1 border-t border-slate-200/60">
                  <div className="p-2 bg-white rounded-lg border border-slate-200">
                    <span className="block text-[10px] text-slate-500 uppercase font-semibold">Total</span>
                    <span className="text-sm font-bold font-mono text-slate-900">{c.total_convocados}</span>
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-slate-200">
                    <span className="block text-[10px] text-slate-500 uppercase font-semibold">Ampla</span>
                    <span className="text-sm font-bold font-mono text-teal-800">{c.ampla_qtd}</span>
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-slate-200">
                    <span className="block text-[10px] text-slate-500 uppercase font-semibold">PPP / PCD</span>
                    <span className="text-sm font-bold font-mono text-amber-800">{c.ppp_qtd + c.pcd_qtd}</span>
                  </div>
                </div>

                <div className="text-2xs text-slate-500 flex items-center justify-between">
                  <span>Edital publicado em: {c.data_edital}</span>
                  <span className="font-mono text-teal-700 font-bold">Chamamento #{c.numero_chamamento}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
