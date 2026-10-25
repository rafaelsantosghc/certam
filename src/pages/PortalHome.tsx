import React, { useState, useMemo } from 'react';
import { certamStore } from '../store/certamStore';
import { Concurso } from '../types';
import {
  Search,
  Plus,
  ArrowRight,
  Briefcase,
  HelpCircle,
} from 'lucide-react';

interface PortalHomeProps {
  onNavigate: (view: string, params?: { concursoId?: string; cargoId?: string; tab?: string }) => void;
}

export const PortalHome: React.FC<PortalHomeProps> = ({ onNavigate }) => {
  const [concursos] = useState<Concurso[]>(() => certamStore.getConcursos());
  const [filtroTexto, setFiltroTexto] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'ativos'>('todos');

  // Compute total metrics
  const totalCargos = useMemo(() => {
    return concursos.reduce((acc, c) => acc + (c.cargos?.length || 0), 0);
  }, [concursos]);

  const totalVagas = useMemo(() => {
    return concursos.reduce((acc, c) => {
      const v = (c.cargos || []).reduce((cacc, cg) => cacc + (cg.vagas_imediatas || 0), 0);
      return acc + v;
    }, 0);
  }, [concursos]);

  // Filtered list
  const concursosFiltrados = useMemo(() => {
    return concursos.filter((c) => {
      const matchTexto =
        !filtroTexto.trim() ||
        c.nome.toLowerCase().includes(filtroTexto.toLowerCase()) ||
        c.orgao.toLowerCase().includes(filtroTexto.toLowerCase()) ||
        c.cargos.some((cg) => cg.nome.toLowerCase().includes(filtroTexto.toLowerCase()));

      const matchStatus = filtroStatus === 'todos' || c.status === 'ativo' || c.status === 'Convocando';

      return matchTexto && matchStatus;
    });
  }, [concursos, filtroTexto, filtroStatus]);

  return (
    <div className="space-y-8 max-w-[1880px] w-full mx-auto">
      {/* Apresentação Geral do Portal */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#2DD4AA]/15 text-[#135A7A] text-xs font-semibold mb-2">
            <span>🏛️</span>
            <span>Portal de Concursos Cadastrados</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#0F172A] tracking-tight font-serif">
            Concursos &amp; Cargos Disponíveis
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-3xl leading-relaxed">
            Cada certame é dividido em seus cargos respectivos. Selecione o cargo desejado para acessar sua lista de classificação exclusiva, fórum próprio e simulação de lotações.
          </p>
        </div>

        {/* Botão Admin Cadastrar Concurso */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onNavigate('admin', { tab: 'concursos' })}
            className="inline-flex items-center gap-2 bg-[#07192B] hover:bg-[#0C2640] text-white font-bold px-4 py-2.5 rounded-xl text-xs shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Cadastrar Novo Concurso</span>
          </button>
        </div>
      </div>

      {/* 4 KPI CARDS GERAIS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        <div className="bg-white rounded-xl p-5 border border-slate-200/80 card-shadow card-shadow-hover transition-all">
          <span className="text-xs font-semibold text-[#475569] block">Concursos Cadastrados</span>
          <div className="text-3xl font-extrabold text-[#0F172A] font-mono mt-1">{concursos.length}</div>
          <span className="text-xs text-[#2DD4AA] font-semibold mt-1 block">Certames no sistema</span>
        </div>

        <div className="bg-white rounded-xl p-5 border border-slate-200/80 card-shadow card-shadow-hover transition-all">
          <span className="text-xs font-semibold text-[#475569] block">Cargos Estruturados</span>
          <div className="text-3xl font-extrabold text-[#0F172A] font-mono mt-1">{totalCargos}</div>
          <span className="text-xs text-[#94A3B8] mt-1 block">Carreiras com listas isoladas</span>
        </div>

        <div className="bg-white rounded-xl p-5 border border-slate-200/80 card-shadow card-shadow-hover transition-all">
          <span className="text-xs font-semibold text-[#475569] block">Vagas Imediatas</span>
          <div className="text-3xl font-extrabold text-[#0F172A] font-mono mt-1">{totalVagas}</div>
          <span className="text-xs text-[#94A3B8] mt-1 block">Convocação inicial homologada</span>
        </div>

        <div className="bg-white rounded-xl p-5 border border-slate-200/80 card-shadow card-shadow-hover transition-all">
          <span className="text-xs font-semibold text-[#475569] block">Chamamentos / Lotes</span>
          <div className="text-3xl font-extrabold text-[#0F172A] font-mono mt-1">01</div>
          <span className="text-xs text-emerald-600 font-semibold mt-1 block">Simulação de lotação ativa</span>
        </div>
      </div>

      {/* BARRA DE FILTROS E BUSCA */}
      <div className="bg-white rounded-xl p-4 sm:p-5 border border-slate-200/80 card-shadow space-y-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              value={filtroTexto}
              onChange={(e) => setFiltroTexto(e.target.value)}
              placeholder="Pesquisar por órgão, concurso ou cargo cadastrado..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#2DD4AA]"
            />
          </div>

          {/* Filtros por Status */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200/60 overflow-x-auto shrink-0">
            <button
              type="button"
              onClick={() => setFiltroStatus('todos')}
              className={`px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                filtroStatus === 'todos'
                  ? 'bg-white text-slate-900 font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 font-medium'
              }`}
            >
              Todos
            </button>
            <button
              type="button"
              onClick={() => setFiltroStatus('ativos')}
              className={`px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                filtroStatus === 'ativos'
                  ? 'bg-white text-slate-900 font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 font-medium'
              }`}
            >
              Ativos
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
          <span>
            Exibindo <strong>{concursosFiltrados.length}</strong> concurso(s)
          </span>
          {filtroTexto && (
            <button
              type="button"
              onClick={() => setFiltroTexto('')}
              className="text-[#135A7A] hover:underline font-semibold cursor-pointer"
            >
              Limpar filtros de busca
            </button>
          )}
        </div>
      </div>

      {/* GRID DE CARDS DOS CONCURSOS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {concursosFiltrados.map((concurso) => (
          <div
            key={concurso.id}
            className="bg-white rounded-2xl border border-slate-200/90 card-shadow card-shadow-hover overflow-hidden flex flex-col justify-between"
          >
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <span className="px-2.5 py-1 rounded-lg bg-teal-50 border border-teal-200 text-[#135A7A] text-xs font-bold font-mono uppercase">
                  {concurso.orgao} • {concurso.ano}
                </span>
                <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                  {concurso.status}
                </span>
              </div>

              <div>
                <h3 className="text-base sm:text-lg font-bold font-serif text-slate-900 leading-snug">
                  {concurso.nome}
                </h3>
                <p className="text-xs text-slate-500 mt-1.5 line-clamp-2 leading-relaxed">
                  {concurso.descricao}
                </p>
              </div>

              {/* Cargos deste concurso */}
              <div className="pt-2 border-t border-slate-100 space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono block">
                  Cargos Cadastrados ({concurso.cargos?.length || 0})
                </span>
                <div className="space-y-1.5">
                  {concurso.cargos?.map((cargo) => (
                    <button
                      key={cargo.id}
                      type="button"
                      onClick={() =>
                        onNavigate('concurso', {
                          concursoId: concurso.id,
                          cargoId: cargo.id,
                          tab: 'dashboard',
                        })
                      }
                      className="w-full text-left p-2.5 rounded-xl bg-slate-50 hover:bg-teal-50/60 border border-slate-200/80 hover:border-teal-300 transition-all flex items-center justify-between group cursor-pointer"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="flex items-center gap-1.5">
                          <Briefcase className="w-3.5 h-3.5 text-[#135A7A] shrink-0" />
                          <span className="text-xs font-bold text-slate-800 truncate group-hover:text-teal-900">
                            {cargo.nome}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500 ml-5 block">
                          Nível {cargo.nivel} • {cargo.vagas_imediatas} vagas {cargo.tem_cr ? '+ CR' : ''}
                        </span>
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-teal-700 group-hover:translate-x-0.5 transition-all shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Rodapé do Card */}
            <div className="bg-slate-50/80 p-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[11px] text-slate-400 font-mono">{concurso.edital}</span>
              <button
                type="button"
                onClick={() =>
                  onNavigate('concurso', {
                    concursoId: concurso.id,
                    cargoId: concurso.cargos?.[0]?.id || 'geral',
                    tab: 'dashboard',
                  })
                }
                className="text-xs font-bold text-[#135A7A] hover:text-[#2DD4AA] transition-colors flex items-center gap-1 cursor-pointer"
              >
                <span>Acessar Cargo</span>
                <span>→</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* SEÇÃO GUIA: COMO FUNCIONA O SISTEMA CERTAM */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-6 sm:p-8 card-shadow space-y-6">
        <div className="border-b border-slate-100 pb-4">
          <h2 className="text-lg sm:text-xl font-bold font-serif text-slate-900 flex items-center gap-2.5">
            <HelpCircle className="w-5 h-5 text-teal-600" />
            <span>Como Funciona o Sistema CERTAM para Cada Cargo</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Cada cargo possui sua própria lista oficial de homologação, simulador e fórum. Nada se mistura.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2.5 bg-slate-50 p-5 rounded-2xl border border-slate-100">
            <div className="w-8 h-8 rounded-lg bg-[#07192B] text-[#2DD4AA] flex items-center justify-center font-bold text-sm">
              1
            </div>
            <h3 className="text-sm font-bold text-slate-900">Listas Isoladas por Cargo</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Analista e Técnico Judiciário possuem notas de corte, bancas de concurso e ordem de convocação 100% separadas.
            </p>
          </div>

          <div className="space-y-2.5 bg-slate-50 p-5 rounded-2xl border border-slate-100">
            <div className="w-8 h-8 rounded-lg bg-[#135A7A] text-teal-200 flex items-center justify-center font-bold text-sm">
              2
            </div>
            <h3 className="text-sm font-bold text-slate-900">Simulação de Lotação</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Descubra antecipadamente em qual comarca você tomará posse com base nas intenções reais e renúncias de quem está à sua frente.
            </p>
          </div>

          <div className="space-y-2.5 bg-slate-50 p-5 rounded-2xl border border-slate-100">
            <div className="w-8 h-8 rounded-lg bg-[#2DD4AA] text-slate-950 flex items-center justify-center font-bold text-sm">
              3
            </div>
            <h3 className="text-sm font-bold text-slate-900">Canal Seguro &amp; Transparente</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Dados protegidos conforme a LGPD e conferência dupla para evitar manifestações e vagas fantasmas.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
