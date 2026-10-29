import React, { useState, useMemo } from 'react';
import { Concurso, CronogramaItem } from '../types';
import { certamStore } from '../store/certamStore';
import { useAuth } from '../store/authContext';
import {
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  Pencil,
  Plus,
  Trash2,
  X,
  Save,
  ArrowUpDown,
  MessageSquareText,
  Briefcase,
} from 'lucide-react';

interface LinhaDoTempoConcursoProps {
  concurso: Concurso;
  cargoId?: string;
  cargoNome?: string;
  onAtualizado?: () => void;
}

const MESES_PT: Record<string, number> = {
  jan: 0, janeiro: 0,
  fev: 1, fevereiro: 1,
  mar: 2, marco: 2, março: 2,
  abr: 3, abril: 3,
  mai: 4, maio: 4,
  jun: 5, junho: 5,
  jul: 6, julho: 6,
  ago: 7, agosto: 7,
  set: 8, setembro: 8,
  out: 9, outubro: 9,
  nov: 10, novembro: 10,
  dez: 11, dezembro: 11,
};

export function extrairTimestampEtapa(etapa: CronogramaItem): number {
  const raw = (etapa.data_realizada || etapa.data_prevista || '').trim();
  if (!raw) return 0;

  // Formato DD/MM/YYYY
  const matchDMY = raw.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (matchDMY) {
    const dia = parseInt(matchDMY[1], 10);
    const mes = parseInt(matchDMY[2], 10) - 1;
    const ano = parseInt(matchDMY[3], 10);
    return new Date(ano, mes, dia).getTime();
  }

  // Formato YYYY-MM-DD
  const matchYMD = raw.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (matchYMD) {
    const ano = parseInt(matchYMD[1], 10);
    const mes = parseInt(matchYMD[2], 10) - 1;
    const dia = parseInt(matchYMD[3], 10);
    return new Date(ano, mes, dia).getTime();
  }

  // Formato MM/YYYY
  const matchMY = raw.match(/^(\d{1,2})[\/\-](\d{4})$/);
  if (matchMY) {
    const mes = parseInt(matchMY[1], 10) - 1;
    const ano = parseInt(matchMY[2], 10);
    return new Date(ano, mes, 15).getTime();
  }

  // Formato Mês/YYYY (ex: Outubro/2026 ou Out/2026)
  const lower = raw.toLowerCase();
  const matchAno = lower.match(/(\d{4})/);
  if (matchAno) {
    const ano = parseInt(matchAno[1], 10);
    for (const [nomeMes, idxMes] of Object.entries(MESES_PT)) {
      if (lower.includes(nomeMes)) {
        return new Date(ano, idxMes, 15).getTime();
      }
    }
    return new Date(ano, 0, 1).getTime();
  }

  const parsed = Date.parse(raw);
  return isNaN(parsed) ? 0 : parsed;
}

export function ordenarEtapasPorDataRecente(lista: CronogramaItem[]): CronogramaItem[] {
  return [...lista].sort((a, b) => {
    const tsA = extrairTimestampEtapa(a);
    const tsB = extrairTimestampEtapa(b);
    if (tsB !== tsA) return tsB - tsA; // Mais recente no topo, mais antiga abaixo
    return 0;
  });
}

export const LinhaDoTempoConcurso: React.FC<LinhaDoTempoConcursoProps> = ({
  concurso,
  cargoId,
  cargoNome,
  onAtualizado,
}) => {
  const { isAdmin } = useAuth();
  const [modalEditarAberto, setModalEditarAberto] = useState(false);
  const [etapasEditadas, setEtapasEditadas] = useState<CronogramaItem[]>([]);

  // Filtra a linha do tempo individual do cargo selecionado (Item 3)
  // e ordena automaticamente pela data do acontecimento (mais recente no topo)
  const etapas: CronogramaItem[] = useMemo(() => {
    const todas = concurso.cronograma || [];
    let filtradas: CronogramaItem[];

    if (cargoId) {
      const especificasDoCargo = todas.filter((et) => et.cargo_id === cargoId);
      if (especificasDoCargo.length > 0) {
        filtradas = especificasDoCargo;
      } else {
        // Se o cargo ainda não possui etapas exclusivas gravadas, exibe apenas etapas gerais sem cargo_id (se houver)
        filtradas = todas.filter((et) => !et.cargo_id);
      }
    } else {
      filtradas = todas;
    }

    return ordenarEtapasPorDataRecente(filtradas);
  }, [concurso.cronograma, cargoId]);

  const getStatusBadge = (status: CronogramaItem['status']) => {
    switch (status) {
      case 'concluido':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Concluída
          </span>
        );
      case 'em_andamento':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-md border border-amber-300 animate-pulse">
            <Clock className="w-3 h-3 text-amber-600" />
            Etapa Vigente
          </span>
        );
      case 'pendente':
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-md">
            <Clock className="w-3 h-3 text-slate-400" />
            Prevista
          </span>
        );
    }
  };

  const abrirModalGerenciamento = () => {
    // Clona as etapas atuais deste cargo para edição individualizada
    const cloneParaCargo = etapas.map((et, idx) => ({
      ...et,
      id: et.id || `cron-${cargoId || 'geral'}-${idx}-${Date.now().toString(36)}`,
      concurso_id: concurso.id,
      cargo_id: cargoId || et.cargo_id,
    }));
    setEtapasEditadas(ordenarEtapasPorDataRecente(cloneParaCargo));
    setModalEditarAberto(true);
  };

  const handleSalvarCronograma = () => {
    const ordenadas = ordenarEtapasPorDataRecente(etapasEditadas);
    certamStore.atualizarCronograma(concurso.id, ordenadas, cargoId);
    setModalEditarAberto(false);
    if (onAtualizado) onAtualizado();
  };

  const handleAdicionarItem = () => {
    const hoje = new Date();
    const dataFormatada = hoje.toLocaleDateString('pt-BR');
    const novo: CronogramaItem = {
      id: `cron-${cargoId || 'geral'}-${Date.now().toString(36)}`,
      concurso_id: concurso.id,
      cargo_id: cargoId,
      titulo: 'Novo Acontecimento / Publicação',
      data_prevista: dataFormatada,
      data_realizada: dataFormatada,
      observacao: '',
      status: 'concluido',
    };
    setEtapasEditadas((prev) => ordenarEtapasPorDataRecente([novo, ...prev]));
  };

  const handleRemoverItem = (id: string) => {
    setEtapasEditadas((prev) => prev.filter((e) => e.id !== id));
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-7 card-shadow space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-serif font-bold text-lg text-[#07192B] flex items-center gap-2">
              <Calendar className="w-5 h-5 text-teal-600" />
              <span>
                Linha do Tempo Oficial{cargoNome ? ` • ${cargoNome}` : ''}
              </span>
            </h3>
            {cargoNome && (
              <span className="px-2.5 py-0.5 rounded-md bg-teal-50 text-teal-800 border border-teal-200 text-[10px] font-bold flex items-center gap-1">
                <Briefcase className="w-3 h-3 text-teal-600" />
                <span>Individual deste Cargo</span>
              </span>
            )}
            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-mono font-bold flex items-center gap-1">
              <ArrowUpDown className="w-3 h-3" />
              <span>Ordenada por data (Mais recente no topo)</span>
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Acompanhe os acontecimentos ordenados automaticamente da data mais recente para a mais antiga
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isAdmin && (
            <button
              type="button"
              onClick={abrirModalGerenciamento}
              className="px-3.5 py-1.5 bg-[#07192B] hover:bg-[#0C2640] text-[#2DD4AA] font-bold text-xs rounded-xl transition-all cursor-pointer shadow-xs flex items-center gap-1.5 shrink-0"
              title="Editar cronograma e acontecimentos deste cargo"
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>Editar Linha do Tempo (Admin)</span>
            </button>
          )}

          <div className="hidden md:flex items-center gap-2 text-2xs text-slate-600 pl-2 border-l border-slate-200">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span>Realizado</span>
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-500 ml-2" />
            <span>Vigente</span>
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-slate-300 ml-2" />
            <span>Futura</span>
          </div>
        </div>
      </div>

      {etapas.length === 0 ? (
        <div className="p-8 text-center text-xs text-slate-400">
          Nenhum acontecimento cadastrado na linha do tempo{cargoNome ? ` do cargo ${cargoNome}` : ' deste concurso'}.
        </div>
      ) : (
        <div className="relative pl-6 sm:pl-8 before:absolute before:left-3 sm:before:left-4 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 space-y-6">
          {etapas.map((etapa, idx) => {
            const isConcluida = etapa.status === 'concluido';
            const isVigente = etapa.status === 'em_andamento';

            return (
              <div key={etapa.id || idx} className="relative group">
                {/* Marcador do Ponto na Linha */}
                <div
                  className={`absolute -left-6 sm:-left-8 top-1 w-6 h-6 rounded-full border-2 flex items-center justify-center text-2xs font-bold transition-all ${
                    isConcluida
                      ? 'bg-emerald-500 border-white text-white shadow-xs'
                      : isVigente
                      ? 'bg-amber-500 border-white text-white ring-4 ring-amber-100 shadow-sm'
                      : 'bg-white border-slate-300 text-slate-400'
                  }`}
                >
                  {isConcluida ? '✓' : idx + 1}
                </div>

                {/* Conteúdo da Etapa */}
                <div
                  className={`p-4 rounded-xl border transition-all ${
                    isVigente
                      ? 'bg-amber-50/40 border-amber-300 shadow-xs'
                      : 'bg-slate-50/70 hover:bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-bold text-sm text-slate-900 leading-tight">
                        {etapa.titulo}
                      </h4>
                      {getStatusBadge(etapa.status)}
                    </div>

                    <div className="text-xs font-mono font-bold text-teal-800 shrink-0 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                      {etapa.data_realizada ? (
                        <span>Data: {etapa.data_realizada}</span>
                      ) : (
                        <span>Previsão: {etapa.data_prevista}</span>
                      )}
                    </div>
                  </div>

                  {etapa.descricao && (
                    <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                      {etapa.descricao}
                    </p>
                  )}

                  {etapa.observacao && (
                    <div className="mt-2.5 p-2.5 rounded-lg bg-white border border-slate-200/90 text-xs text-slate-700 flex items-start gap-2">
                      <MessageSquareText className="w-3.5 h-3.5 text-teal-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-slate-800 text-[11px] block">Observação:</span>
                        <p className="text-slate-600 leading-relaxed whitespace-pre-line">{etapa.observacao}</p>
                      </div>
                    </div>
                  )}

                  {etapa.link_edital && (
                    <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex items-center gap-1.5">
                      <a
                        href={etapa.link_edital}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] font-semibold text-teal-700 hover:text-teal-900 flex items-center gap-1 cursor-pointer"
                      >
                        <span>Acessar publicação oficial / edital no portal do órgão</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Edição da Linha do Tempo (Exclusivo Admin) */}
      {modalEditarAberto && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in-50">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 my-8 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-teal-600" />
                  <h3 className="font-bold text-base text-slate-900 font-serif">
                    Gerenciar Linha do Tempo{cargoNome ? ` • ${cargoNome}` : ''}
                  </h3>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Os acontecimentos são reorganizados automaticamente pela data (mais recente no topo).
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalEditarAberto(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={handleAdicionarItem}
                className="px-3.5 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-900 border border-teal-200 text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-teal-700" />
                <span>Adicionar Novo Acontecimento</span>
              </button>

              <button
                type="button"
                onClick={() => setEtapasEditadas((prev) => ordenarEtapasPorDataRecente(prev))}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold rounded-xl flex items-center gap-1 cursor-pointer"
                title="Reorganizar lista imediatamente pelas datas informadas"
              >
                <ArrowUpDown className="w-3 h-3" />
                <span>Reordenar por Data Agora</span>
              </button>
            </div>

            <div className="space-y-3 max-h-[58vh] overflow-y-auto pr-1">
              {etapasEditadas.map((et, i) => (
                <div key={et.id || i} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <input
                      type="text"
                      value={et.titulo}
                      onChange={(e) => {
                        const val = e.target.value;
                        setEtapasEditadas((prev) =>
                          prev.map((item, idx) => (idx === i ? { ...item, titulo: val } : item))
                        );
                      }}
                      className="font-bold text-xs text-slate-900 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 flex-1 focus:outline-teal-500"
                      placeholder="Título do acontecimento / etapa"
                    />
                    <select
                      value={et.status}
                      onChange={(e) => {
                        const val = e.target.value as any;
                        setEtapasEditadas((prev) =>
                          prev.map((item, idx) => (idx === i ? { ...item, status: val } : item))
                        );
                      }}
                      className="text-xs bg-white border border-slate-200 rounded-lg px-2 py-1.5 font-medium"
                    >
                      <option value="concluido">Concluída</option>
                      <option value="em_andamento">Em Andamento</option>
                      <option value="pendente">Prevista</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => handleRemoverItem(et.id)}
                      className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg cursor-pointer"
                      title="Excluir etapa"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className="text-[10px] font-semibold text-slate-500 block mb-0.5">
                        Data Prevista (DD/MM/AAAA):
                      </label>
                      <input
                        type="text"
                        value={et.data_prevista || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEtapasEditadas((prev) =>
                            prev.map((item, idx) => (idx === i ? { ...item, data_prevista: val } : item))
                          );
                        }}
                        className="w-full text-xs bg-white border border-slate-200 rounded-lg px-2 py-1 font-mono"
                        placeholder="Ex: 15/12/2026"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-slate-500 block mb-0.5">
                        Data Realizada / Acontecimento (DD/MM/AAAA):
                      </label>
                      <input
                        type="text"
                        value={et.data_realizada || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEtapasEditadas((prev) =>
                            prev.map((item, idx) => (idx === i ? { ...item, data_realizada: val } : item))
                          );
                        }}
                        className="w-full text-xs bg-white border border-slate-200 rounded-lg px-2 py-1 font-mono"
                        placeholder="Ex: 28/10/2026"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-semibold text-slate-500 block mb-0.5">
                      Observação / Detalhes do Acontecimento (opcional):
                    </label>
                    <textarea
                      rows={2}
                      value={et.observacao || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setEtapasEditadas((prev) =>
                          prev.map((item, idx) => (idx === i ? { ...item, observacao: val } : item))
                        );
                      }}
                      className="w-full text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 leading-relaxed"
                      placeholder="Acrescente uma observação, resumo da publicação, página do Diário Oficial ou orientações aos candidatos..."
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-semibold text-slate-500 block mb-0.5">
                      Link Oficial / Edital (opcional):
                    </label>
                    <input
                      type="text"
                      value={et.link_edital || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setEtapasEditadas((prev) =>
                          prev.map((item, idx) => (idx === i ? { ...item, link_edital: val } : item))
                        );
                      }}
                      className="w-full text-xs bg-white border border-slate-200 rounded-lg px-2 py-1"
                      placeholder="https://..."
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <span className="text-[11px] text-slate-500">
                Ao salvar, a linha do tempo será ordenada automaticamente pelas datas.
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setModalEditarAberto(false)}
                  className="px-3.5 py-1.5 text-xs text-slate-600 hover:text-slate-800 font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSalvarCronograma}
                  className="px-4 py-1.5 bg-[#07192B] hover:bg-[#0C2640] text-[#2DD4AA] font-bold text-xs rounded-xl shadow-xs flex items-center gap-1 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Salvar Linha do Tempo</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
