import React, { useState, useMemo, useEffect } from 'react';
import { certamStore } from '../store/certamStore';
import { lotesStore } from '../store/lotesStore';
import { useAuth } from '../store/authContext';
import { podeEditarConcurso, podeEditarCargo } from '../utils/permissions';
import { ModalEditarConcurso } from '../components/ModalEditarConcurso';
import { ModalEditarCargo } from '../components/ModalEditarCargo';
import { Concurso, Cargo } from '../types';
import { QuadroVagasView } from '../components/QuadroVagasView';
import {
  Briefcase,
  ArrowRight,
  ArrowLeft,
  Calendar,
  Layers,
  FileText,
  TrendingUp,
  Building,
  CheckCircle2,
  Users,
  MapPin,
  ExternalLink,
  HelpCircle,
  Pencil,
  Plus,
  Clock,
} from 'lucide-react';

interface ConcursoGeralViewProps {
  concursoId: string;
  onNavigate: (view: string, params?: { concursoId?: string; cargoId?: string; tab?: string }) => void;
  onVoltar: () => void;
}

export const ConcursoGeralView: React.FC<ConcursoGeralViewProps> = ({
  concursoId,
  onNavigate,
  onVoltar,
}) => {
  const { usuario } = useAuth();
  const [concurso, setConcurso] = useState<Concurso>(() => {
    return certamStore.getConcurso(concursoId) || certamStore.getConcursos()[0];
  });

  useEffect(() => {
    const atual = certamStore.getConcurso(concursoId) || certamStore.getConcursos()[0];
    if (atual) setConcurso(atual);
  }, [concursoId]);

  const [modalEditarConcursoAberto, setModalEditarConcursoAberto] = useState(false);
  const [modalEditarCargoAberto, setModalEditarCargoAberto] = useState(false);
  const [cargoEditando, setCargoEditando] = useState<Cargo | null>(null);

  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const reloadData = () => {
    const atualizado = certamStore.getConcurso(concursoId) || certamStore.getConcursos()[0];
    if (atualizado) setConcurso(atualizado);
  };

  const podeEditarEsteConcurso = podeEditarConcurso(usuario, concurso.id);

  const cargosAtivos = useMemo(() => {
    return concurso.cargos?.filter((c) => c.ativo) || [];
  }, [concurso]);

  const totalVagasImediatas = useMemo(() => {
    return cargosAtivos.reduce((acc, c) => acc + (c.vagas_imediatas || 0), 0);
  }, [cargosAtivos]);

  const totalVagasDisponiveis = useMemo(() => {
    return cargosAtivos.reduce(
      (acc, c) => acc + (c.vagas_disponiveis ?? c.vagas_reais_abertas ?? 0),
      0
    );
  }, [cargosAtivos]);

  return (
    <div className="max-w-[1880px] mx-auto space-y-6">
      {/* Botão Global de Voltar */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onVoltar}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 font-semibold text-xs border border-slate-200 shadow-xs cursor-pointer transition-all"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Voltar para Concursos</span>
        </button>

        <span className="text-2xs text-slate-400 font-mono">
          CERTAM • Visão Geral do Certame
        </span>
      </div>

      {/* HEADER PRINCIPAL DO CONCURSO */}
      <div className="bg-[#07192B] text-white rounded-3xl p-6 sm:p-8 border border-[#0F2942] relative overflow-hidden card-shadow">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-teal-500/10 via-cyan-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="px-3 py-1 rounded-lg bg-teal-500/20 text-[#2DD4AA] text-xs font-mono font-bold tracking-wider uppercase border border-teal-500/30">
                {concurso.orgao} • {concurso.ano}
              </span>
              <span className="px-3 py-1 rounded-lg bg-white/10 text-slate-200 text-xs font-semibold">
                Esfera {concurso.esfera}
              </span>
              <span className="px-3 py-1 rounded-lg bg-white/10 text-slate-200 text-xs font-semibold">
                {concurso.regiao}
              </span>
              <span
                className={`px-3 py-1 rounded-lg text-xs font-bold ${
                  concurso.homologado || concurso.status === 'Homologado'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : concurso.status === 'Convocando'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'bg-white/10 text-slate-300'
                }`}
              >
                ● Status: {concurso.status}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold font-serif text-white leading-tight">
              {concurso.nome}
            </h1>

            <p className="text-sm text-slate-300 leading-relaxed">
              {concurso.descricao ||
                'Página informativa oficial com visão geral do certame, cargos contemplados, distribuição de vagas e acesso aos painéis de classificação individualizada por cargo.'}
            </p>
          </div>

          {/* Atalhos Rápidos do Concurso */}
          <div className="flex flex-wrap lg:flex-col gap-2 shrink-0">
            {podeEditarEsteConcurso && (
              <button
                type="button"
                onClick={() => setModalEditarConcursoAberto(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
              >
                <Pencil className="w-4 h-4 text-slate-950" />
                <span>Editar Concurso</span>
              </button>
            )}

            <button
              type="button"
              onClick={() =>
                onNavigate('concurso', {
                  concursoId: concurso.id,
                  cargoId: cargosAtivos[0]?.id || '',
                  tab: 'lotes',
                })
              }
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
            >
              <Layers className="w-4 h-4" />
              <span>Lotes de Convocação</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const cargoAlvo = cargosAtivos[0]?.id || 'geral';
                onNavigate('concurso', {
                  concursoId: concurso.id,
                  cargoId: cargoAlvo,
                  tab: 'faq',
                });
              }}
              className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-slate-200 font-semibold text-xs rounded-xl transition-all cursor-pointer"
            >
              <HelpCircle className="w-4 h-4 text-teal-300" />
              <span>Perguntas Frequentes (FAQ)</span>
            </button>
          </div>
        </div>

        {/* CARDS DE RESUMO DO CERTAME */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-6 mt-6 border-t border-white/10">
          <div className="bg-white/5 rounded-2xl p-3.5 border border-white/10">
            <span className="text-[11px] text-slate-400 block font-medium">Cargos Ofertados</span>
            <span className="text-xl font-bold font-mono text-white mt-0.5 block">
              {cargosAtivos.length} cargo(s)
            </span>
          </div>

          <div className="bg-white/5 rounded-2xl p-3.5 border border-white/10">
            <span className="text-[11px] text-slate-400 block font-medium">Vagas Imediatas</span>
            <span className="text-xl font-bold font-mono text-teal-300 mt-0.5 block">
              {totalVagasImediatas > 0 ? totalVagasImediatas : 'Cadastro Reserva'}
            </span>
          </div>

          <div className="bg-white/5 rounded-2xl p-3.5 border border-white/10">
            <span className="text-[11px] text-slate-400 block font-medium">Vagas Disponíveis</span>
            <span className="text-xl font-bold font-mono text-amber-300 mt-0.5 block">
              {totalVagasDisponiveis > 0 ? `${totalVagasDisponiveis} disponíveis` : 'Em apuração'}
            </span>
          </div>

          <div className="bg-white/5 rounded-2xl p-3.5 border border-white/10">
            <span className="text-[11px] text-slate-400 block font-medium">Edital de Abertura</span>
            <span className="text-xl font-bold font-mono text-slate-200 mt-0.5 block">
              {concurso.edital || '01/2025'}
            </span>
          </div>
        </div>
      </div>

      {/* SEÇÃO 1: CARGOS CONTEMPLADOS NO CONCURSO */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-xl font-bold font-serif text-slate-900 flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-teal-600" />
              <span>Cargos Contemplados no Certame</span>
            </h2>
            <p className="text-xs text-slate-500">
              Selecione o cargo desejado para acessar a classificação, linha do tempo, quadro de vagas e fórum.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500">
              {cargosAtivos.length} cargo(s) cadastrado(s)
            </span>
            {podeEditarEsteConcurso && (
              <button
                type="button"
                onClick={() => {
                  setCargoEditando(null);
                  setModalEditarCargoAberto(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#07192B] hover:bg-[#0C2640] text-[#2DD4AA] font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Adicionar Cargo</span>
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {cargosAtivos.map((cg) => {
            const candidatosDoCargo = lotesStore.getCandidatos(concurso.id, cg.id);
            const totalAprovados = candidatosDoCargo.length;

            return (
              <div
                key={cg.id}
                className="bg-white rounded-2xl border border-slate-200 card-shadow p-5 sm:p-6 flex flex-col justify-between hover:border-teal-500/50 hover:shadow-lg transition-all space-y-4 group"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-md bg-teal-50 text-teal-800 text-[11px] font-bold border border-teal-200">
                        Nível {cg.nivel}
                      </span>

                      {cg.tem_cr && (
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-mono font-bold">
                          CR Ativo
                        </span>
                      )}
                    </div>

                    {podeEditarCargo(usuario, concurso.id, cg.id) && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCargoEditando(cg);
                          setModalEditarCargoAberto(true);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-teal-50 hover:text-teal-800 text-slate-700 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                        title="Editar dados deste cargo"
                      >
                        <Pencil className="w-3 h-3 text-slate-500" />
                        <span>Editar</span>
                      </button>
                    )}
                  </div>

                  <div>
                    <h3 className="text-base sm:text-lg font-bold font-serif text-slate-900 group-hover:text-teal-900 transition-colors">
                      {cg.nome}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                      Carreira de {cg.nome} no âmbito do {concurso.orgao}.
                    </p>
                  </div>

                  {/* Informações Numéricas do Cargo */}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs">
                    <div className="bg-slate-50 rounded-xl p-2.5">
                      <span className="text-2xs text-slate-400 block font-medium">Vagas Imediatas</span>
                      <span className="text-sm font-bold font-mono text-slate-800">
                        {cg.vagas_imediatas || 'CR'}
                      </span>
                    </div>

                    <div className="bg-slate-50 rounded-xl p-2.5">
                      <span className="text-2xs text-slate-400 block font-medium">Vagas Disponíveis</span>
                      <span className="text-sm font-bold font-mono text-amber-900">
                        {cg.vagas_disponiveis !== undefined
                          ? cg.vagas_disponiveis
                          : cg.vagas_reais_abertas !== undefined
                          ? cg.vagas_reais_abertas
                          : '-'}
                      </span>
                    </div>

                    {cg.quantitativo_total !== undefined && (
                      <div className="bg-slate-50 rounded-xl p-2.5 col-span-2 flex items-center justify-between text-2xs">
                        <span className="text-slate-500 font-medium">Quantitativo Total:</span>
                        <span className="font-mono font-bold text-slate-800">
                          {cg.quantitativo_total.toLocaleString('pt-BR')} vagas
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Data da última atualização dos dados */}
                  {cg.data_atualizacao_vagas && (
                    <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1 pt-1">
                      <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                      <span>Atualizado em: {cg.data_atualizacao_vagas}</span>
                    </div>
                  )}
                </div>

                {/* Botão Principal de Acesso ao Cargo */}
                <button
                  type="button"
                  onClick={() =>
                    onNavigate('concurso', {
                      concursoId: concurso.id,
                      cargoId: cg.id,
                      tab: 'dashboard',
                    })
                  }
                  className="w-full py-2.5 px-4 bg-[#07192B] hover:bg-[#0C2640] text-[#2DD4AA] font-bold text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-xs transition-all group-hover:bg-[#0A2239]"
                >
                  <span>Acessar Informações do Cargo</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* SEÇÃO 2: QUADRO GERAL DE VAGAS E NOMEAÇÕES */}
      <section className="bg-white rounded-3xl border border-slate-200 card-shadow p-6 sm:p-8 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-xl font-bold font-serif text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-teal-600" />
              <span>Quadro Geral de Vagas &amp; Distribuição</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Levantamento comparativo de vagas editalícias, vagas reais abertas e estimativas de nomeação.
            </p>
          </div>

          <span className="px-3 py-1 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold">
            {concurso.orgao} • Vigência 2025/2026
          </span>
        </div>

        <QuadroVagasView
          concurso={concurso}
        />
      </section>

      {/* SEÇÃO 3: INFORMAÇÕES GERAIS E DOCUMENTOS DO CERTAME */}
      <section className="bg-white rounded-3xl border border-slate-200 card-shadow p-6 sm:p-8 space-y-4">
        <h2 className="text-xl font-bold font-serif text-slate-900 flex items-center gap-2">
          <FileText className="w-5 h-5 text-teal-600" />
          <span>Documentos e Links Oficiais do Concurso</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-700 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h4 className="font-bold text-xs text-slate-900">
                Edital de Abertura Nº {concurso.edital || '01/2025'}
              </h4>
              <p className="text-2xs text-slate-500">
                Regras gerais do certame, disciplinas avaliadas, requisitos e critérios de convocação.
              </p>
              <button
                type="button"
                onClick={() => {
                  const cargoAlvo = cargosAtivos[0]?.id || 'geral';
                  onNavigate('concurso', {
                    concursoId: concurso.id,
                    cargoId: cargoAlvo,
                    tab: 'documentos',
                  });
                }}
                className="text-xs font-bold text-teal-700 hover:underline inline-flex items-center gap-1 cursor-pointer pt-1"
              >
                <span>Consultar repositório de documentos</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-700 flex items-center justify-center shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h4 className="font-bold text-xs text-slate-900">
                Cronograma e Linha do Tempo
              </h4>
              <p className="text-2xs text-slate-500">
                Histórico completo desde a autorização, banca, aplicação de provas até as convocações.
              </p>
              <button
                type="button"
                onClick={() => {
                  const cargoAlvo = cargosAtivos[0]?.id || 'geral';
                  onNavigate('concurso', {
                    concursoId: concurso.id,
                    cargoId: cargoAlvo,
                    tab: 'cronograma',
                  });
                }}
                className="text-xs font-bold text-teal-700 hover:underline inline-flex items-center gap-1 cursor-pointer pt-1"
              >
                <span>Ver linha do tempo detalhada</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Toast Feedback */}
      {toastMsg && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-xl text-xs font-semibold text-white bg-[#07192B] border border-[#2DD4AA]/40 animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-[#2DD4AA]" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Modal Editar Concurso */}
      <ModalEditarConcurso
        aberto={modalEditarConcursoAberto}
        onClose={() => setModalEditarConcursoAberto(false)}
        concurso={concurso}
        onSalvo={(salvo) => {
          reloadData();
          showToast(`Concurso "${salvo.nome}" atualizado com sucesso!`);
        }}
      />

      {/* Modal Editar / Adicionar Cargo */}
      <ModalEditarCargo
        aberto={modalEditarCargoAberto}
        onClose={() => {
          setModalEditarCargoAberto(false);
          setCargoEditando(null);
        }}
        concursoId={concurso.id}
        cargo={cargoEditando}
        onSalvo={(salvo) => {
          reloadData();
          showToast(cargoEditando ? `Cargo "${salvo.nome}" atualizado!` : `Cargo "${salvo.nome}" cadastrado com sucesso!`);
        }}
      />
    </div>
  );
};
