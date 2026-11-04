import React, { useState } from 'react';
import { Concurso, Cargo, LotacaoItem } from '../types';
import { Briefcase, Calendar, CheckCircle2, Clock, Hash, Layers, TrendingUp, Users, Pencil, ArrowUp, ArrowDown, ShieldCheck, X } from 'lucide-react';
import { useAuth } from '../store/authContext';
import { certamStore } from '../store/certamStore';
import { isDebugMode } from '../utils/environment';

interface QuadroVagasViewProps {
  concurso: Concurso;
  cargoIdSelecionado?: string;
}

export const QuadroVagasView: React.FC<QuadroVagasViewProps> = ({ concurso, cargoIdSelecionado }) => {
  const { isAdmin } = useAuth();
  const podeEditar = isAdmin;
  const [cargos, setCargos] = useState<Cargo[]>(() => concurso.cargos || []);
  const [catalogoLotacoes, setCatalogoLotacoes] = useState<LotacaoItem[]>(() => concurso.catalogo_lotacoes || []);

  const cargoEmDestaque = cargoIdSelecionado
    ? cargos.find((c) => c.id === cargoIdSelecionado) || cargos[0]
    : cargos[0];

  // Modais de Edição Administrativa
  const [modalEditarQuantitativos, setModalEditarQuantitativos] = useState(false);
  const [modalReorganizarQuadros, setModalReorganizarQuadros] = useState(false);

  // Estados do formulário de quantitativos
  const [formQuantTotal, setFormQuantTotal] = useState<number>(cargoEmDestaque?.quantitativo_total || 0);
  const [formVagasDisp, setFormVagasDisp] = useState<number>(cargoEmDestaque?.vagas_disponiveis || 0);
  const [formVagasImed, setFormVagasImed] = useState<number>(cargoEmDestaque?.vagas_imediatas || 0);
  const [formNomeados, setFormNomeados] = useState<number>(cargoEmDestaque?.nomeados_concurso || 0);
  const [formConvocados, setFormConvocados] = useState<number>(cargoEmDestaque?.convocados_nao_nomeados || 0);
  const [formVagasProxLote, setFormVagasProxLote] = useState<number>(cargoEmDestaque?.vagas_previstas_proximo_lote || 0);
  const [formDataProxLote, setFormDataProxLote] = useState<string>(cargoEmDestaque?.data_prevista_proximo_lote || '');
  const [formTemCr, setFormTemCr] = useState<boolean>(cargoEmDestaque?.tem_cr ?? true);

  const abrirModalQuantitativos = (cargoAlvo: Cargo) => {
    setFormQuantTotal(cargoAlvo.quantitativo_total || 0);
    setFormVagasDisp(cargoAlvo.vagas_disponiveis || 0);
    setFormVagasImed(cargoAlvo.vagas_imediatas || 0);
    setFormNomeados(cargoAlvo.nomeados_concurso || 0);
    setFormConvocados(cargoAlvo.convocados_nao_nomeados || 0);
    setFormVagasProxLote(cargoAlvo.vagas_previstas_proximo_lote || 0);
    setFormDataProxLote(cargoAlvo.data_prevista_proximo_lote || '');
    setFormTemCr(cargoAlvo.tem_cr ?? true);
    setModalEditarQuantitativos(true);
  };

  const salvarQuantitativos = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cargoEmDestaque) return;

    const cargoAtualizado: Cargo = {
      ...cargoEmDestaque,
      quantitativo_total: formQuantTotal,
      vagas_disponiveis: formVagasDisp,
      vagas_imediatas: formVagasImed,
      nomeados_concurso: formNomeados,
      convocados_nao_nomeados: formConvocados,
      vagas_previstas_proximo_lote: formVagasProxLote,
      data_prevista_proximo_lote: formDataProxLote,
      tem_cr: formTemCr,
      data_atualizacao_vagas: new Date().toLocaleDateString('pt-BR'),
    };

    const novosCargos = cargos.map((c) => (c.id === cargoAtualizado.id ? cargoAtualizado : c));
    setCargos(novosCargos);

    const concAtualizado = { ...concurso, cargos: novosCargos };
    certamStore.salvarCargo(concurso.id, cargoAtualizado);
    setModalEditarQuantitativos(false);
  };

  const moverQuadro = (index: number, direcao: 'cima' | 'baixo') => {
    const list = [...catalogoLotacoes];
    const targetIndex = direcao === 'cima' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= list.length) return;

    const temp = list[index];
    list[index] = list[targetIndex];
    list[targetIndex] = temp;

    setCatalogoLotacoes(list);
    const concAtualizado = { ...concurso, catalogo_lotacoes: list };
    certamStore.salvarConcurso(concAtualizado, true);
  };

  return (
    <div className="space-y-4">
      {/* Barra de Administração (Quando Modo Admin Ativo em Ambiente de Teste / isDebugMode) */}
      {podeEditar && (
        <div className="p-3.5 bg-gradient-to-r from-amber-50 to-amber-100/60 border border-amber-300 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-amber-500 text-slate-950 font-bold rounded-lg text-xs flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </span>
            <div>
              <span className="text-xs font-bold text-amber-950 block">Modo Administrador: Gestão do Quadro de Vagas</span>
              <p className="text-[11px] text-amber-800">Altere quantitativos, vagas imediatas, provimentos e reorganize a ordem dos quadros.</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => abrirModalQuantitativos(cargoEmDestaque)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#07192B] hover:bg-[#0C2640] text-[#2DD4AA] font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer whitespace-nowrap"
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>Editar Quantitativos</span>
            </button>
            <button
              type="button"
              onClick={() => setModalReorganizarQuadros(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs rounded-xl border border-amber-300 shadow-2xs transition-all cursor-pointer whitespace-nowrap"
            >
              <Layers className="w-3.5 h-3.5 text-amber-700" />
              <span>Reorganizar Quadros / Comarcas</span>
            </button>
          </div>
        </div>
      )}

      {/* CARD PRINCIPAL DO CARGO EM FOCO */}
      {cargoEmDestaque && (
        <div className="bg-white rounded-2xl border border-slate-200 card-shadow p-4 sm:p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-100 pb-3">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="px-2 py-0.5 rounded-md bg-teal-50 text-teal-800 font-mono text-[10px] font-bold uppercase border border-teal-200">
                  {concurso.orgao} • Nível {cargoEmDestaque.nivel}
                </span>
                {cargoEmDestaque.tem_cr && (
                  <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-mono font-medium">
                    Cadastro Reserva Ativo
                  </span>
                )}
              </div>
              <h2 className="text-lg sm:text-xl font-bold font-serif text-slate-900">
                {cargoEmDestaque.nome}
              </h2>
            </div>

            <div className="flex items-center gap-2">
              {podeEditar && (
                <button
                  type="button"
                  onClick={() => abrirModalQuantitativos(cargoEmDestaque)}
                  className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-lg shadow-2xs flex items-center gap-1 cursor-pointer"
                  title="Editar os quantitativos deste cargo"
                >
                  <Pencil className="w-3 h-3" />
                  <span>Editar Vagas</span>
                </button>
              )}

              {/* MARCAÇÃO COM A DATA DA ÚLTIMA ALTERAÇÃO */}
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-slate-600 text-[11px] font-medium self-start sm:self-auto shrink-0">
                <Clock className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                <span>
                  Última atualização:{' '}
                  <strong className="text-slate-900 font-mono">
                    {cargoEmDestaque.data_atualizacao_vagas || 'Em apuração'}
                  </strong>
                </span>
              </div>
            </div>
          </div>

          {/* OS QUANTITATIVOS OFICIAIS DO CARGO */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {/* Quantitativo total do cargo */}
            <div className="bg-slate-50/70 rounded-xl p-3 sm:p-3.5 border border-slate-200 flex flex-col justify-between hover:border-slate-300 transition-colors">
              <div>
                <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                  Quantitativo Total do Cargo
                </span>
                <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                  Total de vagas criadas (ocupadas ou não)
                </p>
              </div>
              <div className="mt-2 flex items-baseline">
                <span className="text-xl sm:text-2xl font-bold font-mono text-slate-900">
                  {cargoEmDestaque.quantitativo_total !== undefined
                    ? cargoEmDestaque.quantitativo_total.toLocaleString('pt-BR')
                    : 'Não informado'}
                </span>
              </div>
            </div>

            {/* Vagas disponíveis */}
            <div className="bg-amber-50/40 rounded-xl p-3 sm:p-3.5 border border-amber-200/90 flex flex-col justify-between hover:border-amber-300 transition-colors">
              <div>
                <span className="text-[11px] font-bold text-amber-900 uppercase tracking-wider block">
                  Vagas Disponíveis
                </span>
                <p className="text-[11px] text-amber-700/80 mt-0.5 leading-snug">
                  Existentes disponíveis para provimento no quadro
                </p>
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-xl sm:text-2xl font-bold font-mono text-amber-900">
                  {cargoEmDestaque.vagas_disponiveis !== undefined
                    ? cargoEmDestaque.vagas_disponiveis.toLocaleString('pt-BR')
                    : 'Em apuração'}
                </span>
                {cargoEmDestaque.vagas_disponiveis !== undefined && (
                  <span className="text-xs text-amber-800/80 font-medium">vagas</span>
                )}
              </div>
            </div>

            {/* Vagas imediatas */}
            <div className="bg-slate-50/70 rounded-xl p-3 sm:p-3.5 border border-slate-200 flex flex-col justify-between hover:border-slate-300 transition-colors">
              <div>
                <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                  Vagas Imediatas
                </span>
                <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                  Total disponibilizado no edital de abertura
                </p>
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-xl sm:text-2xl font-bold font-mono text-slate-900">
                  {cargoEmDestaque.vagas_imediatas || '0'}
                </span>
                {cargoEmDestaque.tem_cr && (
                  <span className="text-[10px] text-slate-600 font-mono font-semibold bg-slate-200/80 px-1.5 py-0.5 rounded">
                    + CR
                  </span>
                )}
              </div>
            </div>

            {/* Nomeados por este concurso */}
            <div className="bg-emerald-50/40 rounded-xl p-3 sm:p-3.5 border border-emerald-200/90 flex flex-col justify-between hover:border-emerald-300 transition-colors">
              <div>
                <span className="text-[11px] font-bold text-emerald-900 uppercase tracking-wider block">
                  Nomeados por Este Concurso
                </span>
                <p className="text-[11px] text-emerald-700/80 mt-0.5 leading-snug">
                  Total já ocupado por este certame
                </p>
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-xl sm:text-2xl font-bold font-mono text-emerald-900">
                  {cargoEmDestaque.nomeados_concurso !== undefined
                    ? cargoEmDestaque.nomeados_concurso
                    : 0}
                </span>
                <span className="text-xs text-emerald-800/80 font-medium">nomeado(s)</span>
              </div>
            </div>

            {/* Convocados ainda não nomeados */}
            <div className="bg-cyan-50/40 rounded-xl p-3 sm:p-3.5 border border-cyan-200/90 flex flex-col justify-between hover:border-cyan-300 transition-colors">
              <div>
                <span className="text-[11px] font-bold text-cyan-900 uppercase tracking-wider block">
                  Convocados Ainda Não Nomeados
                </span>
                <p className="text-[11px] text-cyan-700/80 mt-0.5 leading-snug">
                  Convocados com processo em andamento
                </p>
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-xl sm:text-2xl font-bold font-mono text-cyan-900">
                  {cargoEmDestaque.convocados_nao_nomeados !== undefined
                    ? cargoEmDestaque.convocados_nao_nomeados
                    : 0}
                </span>
                <span className="text-xs text-cyan-800/80 font-medium">em andamento</span>
              </div>
            </div>

            {/* Vagas previstas para o próximo lote */}
            <div className="bg-indigo-50/40 rounded-xl p-3 sm:p-3.5 border border-indigo-200/90 flex flex-col justify-between hover:border-indigo-300 transition-colors">
              <div>
                <span className="text-[11px] font-bold text-indigo-900 uppercase tracking-wider block">
                  Vagas Previstas p/ Próximo Lote
                </span>
                <p className="text-[11px] text-indigo-700/80 mt-0.5 leading-snug">
                  Previsão oficial e data do próximo chamamento
                </p>
              </div>
              <div className="mt-2 flex flex-wrap items-baseline gap-2">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xl sm:text-2xl font-bold font-mono text-indigo-950">
                    {cargoEmDestaque.vagas_previstas_proximo_lote !== undefined
                      ? cargoEmDestaque.vagas_previstas_proximo_lote
                      : 'A definir'}
                  </span>
                  {cargoEmDestaque.vagas_previstas_proximo_lote !== undefined && (
                    <span className="text-xs text-indigo-800/80 font-medium">vagas</span>
                  )}
                </div>
                {cargoEmDestaque.data_prevista_proximo_lote && (
                  <span className="px-2 py-0.5 rounded-md bg-indigo-100/90 text-indigo-900 font-mono text-[10px] font-bold">
                    Previsto: {cargoEmDestaque.data_prevista_proximo_lote}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TABELA CONSOLIDADA DOS CARGOS */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 card-shadow space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
          <div>
            <h3 className="font-serif font-bold text-sm sm:text-base text-[#07192B]">
              Quadro Comparativo de Vagas ({concurso.orgao})
            </h3>
            <p className="text-[11px] text-slate-500">
              Acompanhamento consolidado dos quantitativos oficiais por cargo
            </p>
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-left text-xs divide-y divide-slate-100">
            <thead className="bg-[#07192B] text-white font-medium text-[11px] uppercase tracking-wider">
              <tr>
                <th className="py-2.5 px-3 font-semibold">Cargo</th>
                <th className="py-2.5 px-2.5 text-right font-semibold">Quantitativo Total</th>
                <th className="py-2.5 px-2.5 text-right text-amber-300 font-semibold">Vagas Disponíveis</th>
                <th className="py-2.5 px-2.5 text-right font-semibold">Vagas Imediatas</th>
                <th className="py-2.5 px-2.5 text-right text-emerald-300 font-semibold">Nomeados Concurso</th>
                <th className="py-2.5 px-2.5 text-right text-cyan-300 font-semibold">Convocados em Andamento</th>
                <th className="py-2.5 px-2.5 text-right text-indigo-300 font-semibold">Próximo Lote</th>
                <th className="py-2.5 px-3 text-center font-semibold">Última Atualização</th>
                {podeEditar && <th className="py-2.5 px-3 text-right font-semibold">Ação Admin</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cargos.length === 0 ? (
                <tr>
                  <td colSpan={podeEditar ? 9 : 8} className="py-6 text-center text-slate-400 text-xs">
                    Nenhum cargo cadastrado neste concurso.
                  </td>
                </tr>
              ) : (
                cargos.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 px-3 font-bold text-slate-900">
                      <div>{c.nome}</div>
                      <span className="text-[10px] text-slate-400 font-mono font-normal">
                        Nível {c.nivel} {c.tem_cr ? '• CR' : ''}
                      </span>
                    </td>

                    {/* Quantitativo Total */}
                    <td className="py-2.5 px-2.5 text-right font-mono text-slate-800 font-semibold">
                      {c.quantitativo_total !== undefined ? c.quantitativo_total.toLocaleString('pt-BR') : '-'}
                    </td>

                    {/* Vagas Disponíveis */}
                    <td className="py-2.5 px-2.5 text-right font-mono text-amber-900 font-bold bg-amber-50/40">
                      {c.vagas_disponiveis !== undefined
                        ? c.vagas_disponiveis.toLocaleString('pt-BR')
                        : c.vagas_reais_abertas !== undefined
                        ? c.vagas_reais_abertas.toLocaleString('pt-BR')
                        : '-'}
                    </td>

                    {/* Vagas Imediatas */}
                    <td className="py-2.5 px-2.5 text-right font-mono text-slate-700">
                      {c.vagas_imediatas ?? 0}
                    </td>

                    {/* Nomeados por este concurso */}
                    <td className="py-2.5 px-2.5 text-right font-mono text-emerald-800 font-semibold bg-emerald-50/30">
                      {c.nomeados_concurso !== undefined ? c.nomeados_concurso : '0'}
                    </td>

                    {/* Convocados ainda não nomeados */}
                    <td className="py-2.5 px-2.5 text-right font-mono text-cyan-800 font-semibold">
                      {c.convocados_nao_nomeados !== undefined ? c.convocados_nao_nomeados : '0'}
                    </td>

                    {/* Vagas previstas para o próximo lote */}
                    <td className="py-2.5 px-2.5 text-right font-mono text-indigo-900 font-semibold">
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
                    <td className="py-2.5 px-3 text-center font-mono text-[11px] text-slate-600">
                      {c.data_atualizacao_vagas || 'Em apuração'}
                    </td>

                    {/* Ação Admin (Exclusivo isDebugMode) */}
                    {podeEditar && (
                      <td className="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => abrirModalQuantitativos(c)}
                          className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-[11px] font-bold cursor-pointer transition-colors inline-flex items-center gap-1"
                        >
                          <Pencil className="w-3 h-3 text-amber-700" />
                          <span>Editar</span>
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Admin: Editar Quantitativos do Cargo */}
      {modalEditarQuantitativos && cargoEmDestaque && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in-50">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
            <div className="p-4 sm:p-5 bg-[#07192B] text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-teal-500/20 text-[#2DD4AA] flex items-center justify-center">
                  <Pencil className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-base text-white">Editar Quantitativos de Vagas</h3>
                  <p className="text-2xs text-teal-300">{cargoEmDestaque.nome}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalEditarQuantitativos(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={salvarQuantitativos} className="p-5 space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Quantitativo Total do Cargo:</label>
                  <input
                    type="number"
                    value={formQuantTotal}
                    onChange={(e) => setFormQuantTotal(parseInt(e.target.value, 10) || 0)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Vagas Disponíveis:</label>
                  <input
                    type="number"
                    value={formVagasDisp}
                    onChange={(e) => setFormVagasDisp(parseInt(e.target.value, 10) || 0)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-amber-900"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Vagas Imediatas:</label>
                  <input
                    type="number"
                    value={formVagasImed}
                    onChange={(e) => setFormVagasImed(parseInt(e.target.value, 10) || 0)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nomeados Concurso:</label>
                  <input
                    type="number"
                    value={formNomeados}
                    onChange={(e) => setFormNomeados(parseInt(e.target.value, 10) || 0)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-emerald-800"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Convocados em Andamento:</label>
                  <input
                    type="number"
                    value={formConvocados}
                    onChange={(e) => setFormConvocados(parseInt(e.target.value, 10) || 0)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-cyan-800"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Previstas Próximo Lote:</label>
                  <input
                    type="number"
                    value={formVagasProxLote}
                    onChange={(e) => setFormVagasProxLote(parseInt(e.target.value, 10) || 0)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-indigo-900"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Data / Previsão Próximo Lote:</label>
                <input
                  type="text"
                  placeholder="Ex: Maio/2026 ou 15/05/2026"
                  value={formDataProxLote}
                  onChange={(e) => setFormDataProxLote(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>

              <div className="pt-1">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800">
                  <input
                    type="checkbox"
                    checked={formTemCr}
                    onChange={(e) => setFormTemCr(e.target.checked)}
                    className="w-4 h-4 text-teal-600 rounded"
                  />
                  <span>Possui Cadastro de Reserva (CR) Ativo</span>
                </label>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalEditarQuantitativos(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-600 hover:bg-slate-50 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#07192B] hover:bg-[#0C2640] text-[#2DD4AA] font-bold rounded-xl shadow-xs"
                >
                  Salvar Quantitativos
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Admin: Reorganizar Quadros / Comarcas */}
      {modalReorganizarQuadros && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in-50">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-4 sm:p-5 bg-[#07192B] text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-teal-500/20 text-[#2DD4AA] flex items-center justify-center">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-base text-white">Reorganizar Quadros de Lotação</h3>
                  <p className="text-2xs text-teal-300">Mova as comarcas para cima ou para baixo para ajustar a ordem de exibição</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalReorganizarQuadros(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-2 text-xs flex-1">
              {catalogoLotacoes.length === 0 ? (
                <p className="text-center text-slate-400 py-6">Nenhum quadro de lotação cadastrado no momento.</p>
              ) : (
                catalogoLotacoes.map((lot, idx) => (
                  <div key={lot.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 h-6 rounded-lg bg-slate-200 text-slate-700 font-mono font-bold text-xs flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <span className="font-bold text-slate-900">{lot.nome}</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => moverQuadro(idx, 'cima')}
                        className="p-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg disabled:opacity-30 cursor-pointer"
                        title="Mover para cima"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === catalogoLotacoes.length - 1}
                        onClick={() => moverQuadro(idx, 'baixo')}
                        className="p-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg disabled:opacity-30 cursor-pointer"
                        title="Mover para baixo"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setModalReorganizarQuadros(false)}
                className="px-5 py-2 bg-[#07192B] text-[#2DD4AA] font-bold text-xs rounded-xl shadow-xs"
              >
                Concluir Reorganização
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
