import React, { useState, useMemo, useEffect } from 'react';
import { certamStore } from '../store/certamStore';
import { lotesStore } from '../store/lotesStore';
import { chatStore } from '../store/chatStore';
import { useAuth } from '../store/authContext';
import { Concurso, Cargo, Candidato, ChatMensagem } from '../types';
import { COMARCAS_RS } from '../data/comarcas';
import { RegionalMapSvg } from '../components/RegionalMapSvg';
import {
  BarChart3,
  ListOrdered,
  UserCheck,
  Send,
  Search,
  Eye,
  Plus,
  ArrowUp,
  ArrowDown,
  Trash2,
  CheckCircle2,
  Lock,
  Save,
} from 'lucide-react';

interface ConcursoCargoDashboardProps {
  concursoId: string;
  cargoId: string;
  initialTab?: string;
  onNavigate: (view: string, params?: { concursoId?: string; cargoId?: string; tab?: string }) => void;
}

export const ConcursoCargoDashboard: React.FC<ConcursoCargoDashboardProps> = ({
  concursoId,
  cargoId,
  initialTab = 'dashboard',
  onNavigate,
}) => {
  const { usuario, isAdmin, loginGoogle } = useAuth();

  const concurso: Concurso = useMemo(() => {
    return certamStore.getConcurso(concursoId) || certamStore.getConcursos()[0];
  }, [concursoId]);

  const cargo: Cargo = useMemo(() => {
    return certamStore.getCargo(concurso.id, cargoId) || concurso.cargos[0];
  }, [concurso, cargoId]);

  const [abaAtiva, setAbaAtiva] = useState<'dashboard' | 'classificacao' | 'candidato'>(
    (initialTab as 'dashboard' | 'classificacao' | 'candidato') || 'dashboard'
  );

  // Candidates for this cargo
  const [candidatos, setCandidatos] = useState<Candidato[]>(() =>
    lotesStore.getCandidatos(concurso.id, cargo.id)
  );

  // Reload when cargo changes
  useEffect(() => {
    setCandidatos(lotesStore.getCandidatos(concurso.id, cargo.id));
  }, [concurso.id, cargo.id]);

  // Chat for this cargo
  const [mensagensChat, setMensagensChat] = useState<ChatMensagem[]>(() =>
    chatStore.getMensagens(concurso.id, cargo.id)
  );
  const [novoTextoChat, setNovoTextoChat] = useState('');

  useEffect(() => {
    setMensagensChat(chatStore.getMensagens(concurso.id, cargo.id));
    const handleChatUpdate = () => {
      setMensagensChat(chatStore.getMensagens(concurso.id, cargo.id));
    };
    window.addEventListener('certam_chat_updated', handleChatUpdate);
    return () => window.removeEventListener('certam_chat_updated', handleChatUpdate);
  }, [concurso.id, cargo.id]);

  // Candidate detail modal state
  const [candidatoModal, setCandidatoModal] = useState<Candidato | null>(null);

  // Toast alert
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  // Chat send
  const handleEnviarChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoTextoChat.trim()) return;
    const autor = usuario ? usuario.nome : 'Candidato Participante';
    const email = usuario ? usuario.email : 'candidato@email.com';
    chatStore.enviarMensagem(concurso.id, cargo.id, autor, email, novoTextoChat, isAdmin);
    setNovoTextoChat('');
  };

  // KPIs
  const kpiStats = useMemo(() => {
    const total = candidatos.length;
    const assumem = candidatos.filter((c) => c.intencao === 'Sim').length;
    const desistem = candidatos.filter((c) => c.intencao === 'Não' || c.status === 'Desistência').length;
    const convocados = candidatos.filter((c) => c.status === 'Convocado Titular' || c.status === 'Nomeado').length;

    return { total, assumem, desistem, convocados };
  }, [candidatos]);

  // Classificação filter state
  const [filtroBusca, setFiltroBusca] = useState('');
  const [filtroCota, setFiltroCota] = useState<string>('todas');
  const [filtroStatus, setFiltroStatus] = useState<string>('todos');
  const [filtroIntencao, setFiltroIntencao] = useState<string>('todas');
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [itensPorPagina, setItensPorPagina] = useState<number | 'todos'>(50);

  const candidatosFiltrados = useMemo(() => {
    return candidatos.filter((c) => {
      const matchTexto =
        !filtroBusca.trim() ||
        c.nome.toLowerCase().includes(filtroBusca.toLowerCase()) ||
        (c.comarca_desejada_1 && c.comarca_desejada_1.toLowerCase().includes(filtroBusca.toLowerCase()));

      const matchCota = filtroCota === 'todas' || c.cota === filtroCota;
      const matchStatus = filtroStatus === 'todos' || c.status === filtroStatus;
      const matchIntencao = filtroIntencao === 'todas' || c.intencao === filtroIntencao;

      return matchTexto && matchCota && matchStatus && matchIntencao;
    });
  }, [candidatos, filtroBusca, filtroCota, filtroStatus, filtroIntencao]);

  const candidatosPaginados = useMemo(() => {
    if (itensPorPagina === 'todos') return candidatosFiltrados;
    const start = (paginaAtual - 1) * itensPorPagina;
    return candidatosFiltrados.slice(start, start + itensPorPagina);
  }, [candidatosFiltrados, paginaAtual, itensPorPagina]);

  const totalPaginas = useMemo(() => {
    if (itensPorPagina === 'todos' || itensPorPagina <= 0) return 1;
    return Math.max(1, Math.ceil(candidatosFiltrados.length / itensPorPagina));
  }, [candidatosFiltrados.length, itensPorPagina]);

  // Tab 3: Candidate choices builder
  const candidatoLogado = useMemo(() => {
    if (!usuario) return null;
    return candidatos.find((c) => c.email === usuario.email) || candidatos[0];
  }, [usuario, candidatos]);

  const [minhasEscolhas, setMinhasEscolhas] = useState<string[]>(() => {
    return candidatoLogado?.escolhas_comarcas || ['Porto Alegre', 'Canoas', 'São Leopoldo'];
  });

  useEffect(() => {
    if (candidatoLogado?.escolhas_comarcas) {
      setMinhasEscolhas(candidatoLogado.escolhas_comarcas);
    }
  }, [candidatoLogado]);

  const [buscaComarcaDisponivel, setBuscaComarcaDisponivel] = useState('');

  const comarcasDisponiveis = useMemo(() => {
    return COMARCAS_RS.filter(
      (c) =>
        !minhasEscolhas.includes(c.nome) &&
        (!buscaComarcaDisponivel.trim() ||
          c.nome.toLowerCase().includes(buscaComarcaDisponivel.toLowerCase()))
    );
  }, [minhasEscolhas, buscaComarcaDisponivel]);

  const adicionarComarca = (nome: string) => {
    if (!minhasEscolhas.includes(nome)) {
      setMinhasEscolhas([...minhasEscolhas, nome]);
    }
  };

  const removerComarca = (nome: string) => {
    setMinhasEscolhas(minhasEscolhas.filter((c) => c !== nome));
  };

  const moverComarca = (index: number, direcao: 'cima' | 'baixo') => {
    const novoArray = [...minhasEscolhas];
    const targetIndex = direcao === 'cima' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= novoArray.length) return;
    const temp = novoArray[index];
    novoArray[index] = novoArray[targetIndex];
    novoArray[targetIndex] = temp;
    setMinhasEscolhas(novoArray);
  };

  const salvarPreferencias = () => {
    if (!candidatoLogado) return;
    const atualizado: Candidato = {
      ...candidatoLogado,
      escolhas_comarcas: minhasEscolhas,
      comarca_desejada_1: minhasEscolhas[0] || candidatoLogado.comarca_desejada_1,
    };
    lotesStore.salvarCandidato(concurso.id, cargo.id, atualizado);
    setCandidatos(lotesStore.getCandidatos(concurso.id, cargo.id));
    showToast('Preferências de comarcas salvas com sucesso!');
  };

  return (
    <div className="space-y-6 max-w-[1880px] w-full mx-auto">
      {/* Toast flutuante */}
      {toastMsg && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-xl text-xs font-semibold text-white bg-[#07192B] border border-[#2DD4AA]/40 animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-[#2DD4AA]" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* BARRA DEDICADA DE SELEÇÃO DE CARGOS DO CONCURSO */}
      <div className="bg-[#07192B] rounded-2xl border border-[#0F2942] px-4 sm:px-6 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-white shadow-sm">
        <div className="flex items-center gap-2.5 overflow-x-auto">
          <span className="text-2xs uppercase tracking-wider font-mono text-teal-300 font-bold shrink-0">
            💼 Cargo:
          </span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {concurso.cargos?.map((cg) => {
              const isSelected = cg.id === cargo.id;
              return (
                <button
                  key={cg.id}
                  type="button"
                  onClick={() =>
                    onNavigate('concurso', {
                      concursoId: concurso.id,
                      cargoId: cg.id,
                      tab: abaAtiva,
                    })
                  }
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#2DD4AA] text-slate-950 shadow-xs'
                      : 'bg-white/10 hover:bg-white/20 text-slate-300'
                  }`}
                >
                  {cg.nome}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onNavigate('admin', { tab: 'concursos' })}
            className="text-2xs text-amber-300 hover:text-white font-semibold flex items-center gap-1 bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-xl border border-white/10 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Organizar Cargos</span>
          </button>
        </div>
      </div>

      {/* NAVEGAÇÃO DE ABAS SUPERIORES */}
      <div className="bg-white rounded-2xl border border-slate-200 px-4 sm:px-6 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 card-shadow">
        <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setAbaAtiva('dashboard')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
              abaAtiva === 'dashboard'
                ? 'bg-[#0C2640] text-[#2DD4AA]'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Dashboard do Cargo</span>
          </button>

          <button
            type="button"
            onClick={() => setAbaAtiva('classificacao')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
              abaAtiva === 'classificacao'
                ? 'bg-[#0C2640] text-[#2DD4AA]'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <ListOrdered className="w-4 h-4" />
            <span>Classificação Completa &amp; Notas</span>
          </button>

          <button
            type="button"
            onClick={() => setAbaAtiva('candidato')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
              abaAtiva === 'candidato'
                ? 'bg-[#0C2640] text-[#2DD4AA]'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>Área do Candidato &amp; Comarcas</span>
          </button>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() =>
              onNavigate('lote', {
                concursoId: concurso.id,
                cargoId: cargo.id,
              })
            }
            className="flex items-center gap-1.5 bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 text-white font-bold px-3.5 py-2 rounded-xl text-xs shadow-xs transition-all cursor-pointer"
          >
            <span>🏛️</span>
            <span>Simulador de Lotes deste Cargo →</span>
          </button>
        </div>
      </div>

      {/* =================================================================== */}
      {/* ABA 1: DASHBOARD EXECUTIVO                                         */}
      {/* =================================================================== */}
      {abaAtiva === 'dashboard' && (
        <section className="space-y-6">
          {/* Título da Seção e Detalhes do Cargo */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 font-serif">
                {cargo.nome}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {concurso.nome} • Edital {concurso.edital} • Nível {cargo.nivel}
              </p>
            </div>
          </div>

          {/* 4 KPI CARDS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-5">
            <div className="bg-white rounded-2xl p-5 border border-slate-200 card-shadow flex flex-col justify-between">
              <span className="text-xs font-semibold text-slate-500">Vagas Imediatas</span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-slate-900 font-mono">
                  {cargo.vagas_imediatas}
                </span>
                {cargo.tem_cr && (
                  <span className="text-xs text-teal-700 font-semibold font-mono bg-teal-50 px-2 py-0.5 rounded">
                    + CR
                  </span>
                )}
              </div>
              <span className="text-xs text-slate-400 mt-1">Conforme edital oficial</span>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-slate-200 card-shadow flex flex-col justify-between">
              <span className="text-xs font-semibold text-slate-500">Candidatos Cadastrados</span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-slate-900 font-mono">
                  {kpiStats.total}
                </span>
                <span className="text-xs text-slate-400 font-medium">na lista</span>
              </div>
              <span className="text-xs text-[#2DD4AA] font-bold mt-1">
                {kpiStats.convocados} convocados no 1º Lote
              </span>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-slate-200 card-shadow flex flex-col justify-between">
              <span className="text-xs font-semibold text-slate-500">Pretendem Assumir</span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-slate-900 font-mono">
                  {kpiStats.assumem}
                </span>
                <span className="text-xs text-emerald-600 font-medium">confirmados</span>
              </div>
              <span className="text-xs text-slate-400 mt-1">Interesse ativo declarado</span>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-slate-200 card-shadow flex flex-col justify-between">
              <span className="text-xs font-semibold text-slate-500">Desistências / Fim de Fila</span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-rose-600 font-mono">
                  {kpiStats.desistem}
                </span>
                <span className="text-xs text-slate-400 font-medium">candidatos</span>
              </div>
              <span className="text-xs text-slate-400 mt-1">Avanço da fila de convocação</span>
            </div>
          </div>

          {/* GRADE DE 3 COLUNAS DO DESIGN CERTAM */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* COLUNA 1: MAPA REGIONAL (lg:col-span-4) */}
            <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 card-shadow p-5 sm:p-6 flex flex-col">
              <RegionalMapSvg />
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs text-slate-500 font-medium">Organização individual</span>
                <button
                  type="button"
                  onClick={() => setAbaAtiva('candidato')}
                  className="text-xs font-bold text-[#135A7A] hover:text-[#2DD4AA] transition-colors cursor-pointer flex items-center gap-1"
                >
                  <span>Simulador de Comarcas →</span>
                </button>
              </div>
            </div>

            {/* COLUNA 2: LISTA DE CLASSIFICAÇÃO COMPACTA (lg:col-span-5) */}
            <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 card-shadow p-5 sm:p-6 flex flex-col">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                <h3 className="text-base font-bold text-slate-900">Lista de Classificação</h3>
                <span className="text-2xs text-slate-400 font-mono">Top Aprovados</span>
              </div>

              <div className="overflow-x-auto min-h-[380px]">
                <table className="w-full text-left text-xs divide-y divide-slate-100">
                  <thead>
                    <tr className="text-slate-700 font-bold border-b border-slate-200">
                      <th className="py-2.5 px-2 w-10">Pos.</th>
                      <th className="py-2.5 px-3">Candidato</th>
                      <th className="py-2.5 px-3">1ª Comarca</th>
                      <th className="py-2.5 px-2 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 font-medium">
                    {candidatos.slice(0, 10).map((cand) => (
                      <tr
                        key={cand.id}
                        onClick={() => setCandidatoModal(cand)}
                        className="hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        <td className="py-2.5 px-2 font-mono font-bold text-slate-900">
                          {cand.posicao}º
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-slate-800">{cand.nome}</div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {cand.cota} • Nota {cand.nota_final.toFixed(2)}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">
                          {cand.comarca_desejada_1 || 'Porto Alegre'}
                        </td>
                        <td className="py-2.5 px-2 text-right">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              cand.intencao === 'Não'
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : cand.status === 'Convocado Titular'
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {cand.intencao === 'Não' ? 'Desiste' : cand.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs text-slate-500 font-medium">
                  Mostrando primeiros 10 colocados
                </span>
                <button
                  type="button"
                  onClick={() => setAbaAtiva('classificacao')}
                  className="text-xs font-bold text-[#135A7A] hover:text-[#2DD4AA] transition-colors cursor-pointer flex items-center gap-1"
                >
                  <span>Ver lista completa →</span>
                </button>
              </div>
            </div>

            {/* COLUNA 3: CHAT DOS CANDIDATOS DO CARGO (lg:col-span-3) */}
            <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200 card-shadow p-5 flex flex-col h-[600px]">
              <div className="pb-3 border-b border-slate-100 mb-3">
                <h3 className="text-base font-bold text-slate-900 leading-tight">
                  Chat dos Candidatos
                </h3>
                <span className="text-[11px] text-teal-700 font-semibold truncate block">
                  Comunidade exclusiva deste cargo
                </span>
              </div>

              {/* Lista de Mensagens */}
              <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs">
                {mensagensChat.map((msg) => (
                  <div key={msg.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800 text-[11px] flex items-center gap-1">
                        {msg.autor}
                        {msg.is_admin && (
                          <span className="px-1 py-0.2 rounded text-[9px] bg-amber-100 text-amber-800 font-mono">
                            ADMIN
                          </span>
                        )}
                      </span>
                      <span className="text-[10px] text-slate-400">{msg.data_hora}</span>
                    </div>
                    <p className="text-slate-600 text-xs leading-relaxed">{msg.texto}</p>
                  </div>
                ))}
              </div>

              {/* Caixa de Envio */}
              <form onSubmit={handleEnviarChat} className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2">
                <input
                  type="text"
                  value={novoTextoChat}
                  onChange={(e) => setNovoTextoChat(e.target.value)}
                  placeholder="Escreva para a turma..."
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-[#2DD4AA] focus:outline-none"
                />
                <button
                  type="submit"
                  className="bg-[#2DD4AA] hover:bg-teal-400 text-slate-950 font-bold px-3 py-2 rounded-xl text-xs shadow-xs transition-colors cursor-pointer shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
          </div>
        </section>
      )}

      {/* =================================================================== */}
      {/* ABA 2: CLASSIFICAÇÃO COMPLETA & NOTAS                               */}
      {/* =================================================================== */}
      {abaAtiva === 'classificacao' && (
        <section className="space-y-6">
          {/* Barra de Filtros e Busca */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 card-shadow space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5">
              <div className="md:col-span-5 relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Search className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  value={filtroBusca}
                  onChange={(e) => setFiltroBusca(e.target.value)}
                  placeholder="Buscar por nome do candidato ou comarca..."
                  className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#2DD4AA] font-medium"
                />
              </div>

              <div className="md:col-span-2">
                <select
                  value={filtroCota}
                  onChange={(e) => setFiltroCota(e.target.value)}
                  className="w-full py-2.5 px-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-[#2DD4AA]"
                >
                  <option value="todas">Cota: Todas</option>
                  <option value="Ampla">Ampla Concorrência</option>
                  <option value="PPP">PPP / Negros (CN)</option>
                  <option value="PCD">PCD</option>
                  <option value="Indígena">Indígena (CI)</option>
                </select>
              </div>

              <div className="md:col-span-3">
                <select
                  value={filtroStatus}
                  onChange={(e) => setFiltroStatus(e.target.value)}
                  className="w-full py-2.5 px-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-[#2DD4AA]"
                >
                  <option value="todos">Status: Todos</option>
                  <option value="Aguardando">Aguardando Convocação</option>
                  <option value="Convocado Titular">Convocado Titular</option>
                  <option value="Nomeado">Nomeado</option>
                  <option value="Posse">Posse</option>
                  <option value="Exercício">Em Exercício</option>
                  <option value="Fim de Fila">Fim de Fila</option>
                  <option value="Desistência">Desistência / Renúncia</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <select
                  value={filtroIntencao}
                  onChange={(e) => setFiltroIntencao(e.target.value)}
                  className="w-full py-2.5 px-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-[#2DD4AA]"
                >
                  <option value="todas">Intenção: Todas</option>
                  <option value="Sim">Assume (Sim)</option>
                  <option value="Talvez">Em Análise (Talvez)</option>
                  <option value="final_fila">Fim de Fila</option>
                  <option value="Não">Desiste (Não)</option>
                  <option value="Indefinido">Não Informou</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
              <div>
                Exibindo <strong className="text-slate-900 font-bold">{candidatosFiltrados.length}</strong> candidato(s) deste cargo
              </div>
              {(filtroBusca || filtroCota !== 'todas' || filtroStatus !== 'todos' || filtroIntencao !== 'todas') && (
                <button
                  type="button"
                  onClick={() => {
                    setFiltroBusca('');
                    setFiltroCota('todas');
                    setFiltroStatus('todos');
                    setFiltroIntencao('todas');
                  }}
                  className="text-[#135A7A] hover:text-[#2DD4AA] font-semibold cursor-pointer text-xs"
                >
                  Limpar filtros
                </button>
              )}
            </div>
          </div>

          {/* Tabela Principal */}
          <div className="bg-white rounded-2xl border border-slate-200 card-shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm divide-y divide-slate-100">
                <thead className="bg-slate-100 text-slate-700 font-bold text-2xs uppercase tracking-wider font-mono">
                  <tr>
                    <th className="px-4 py-3.5 text-center">Class.</th>
                    <th className="px-5 py-3.5">Candidato &amp; Detalhes</th>
                    <th className="px-4 py-3.5 text-center">Cota</th>
                    <th className="px-4 py-3.5 text-right">Nota Final</th>
                    <th className="px-4 py-3.5 text-center">Intenção</th>
                    <th className="px-5 py-3.5">1ª Comarca Desejada</th>
                    <th className="px-4 py-3.5">Status / Lotação</th>
                    <th className="px-4 py-3.5 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {candidatosPaginados.map((cand) => (
                    <tr key={cand.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-center font-mono font-bold text-slate-900">
                        {cand.posicao}º
                      </td>
                      <td className="px-5 py-3">
                        <div className="font-bold text-slate-900">{cand.nome}</div>
                        <div className="text-[11px] font-mono text-slate-400">
                          {cand.cpf || '***.***.***-**'}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold font-mono bg-slate-100 text-slate-700 border border-slate-200">
                          {cand.cota}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                        {cand.nota_final.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            cand.intencao === 'Sim'
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : cand.intencao === 'Não'
                              ? 'bg-rose-50 text-rose-800 border border-rose-200'
                              : cand.intencao === 'final_fila'
                              ? 'bg-amber-50 text-amber-800 border border-amber-200'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {cand.intencao === 'Sim'
                            ? 'Assume'
                            : cand.intencao === 'Não'
                            ? 'Desiste'
                            : cand.intencao === 'final_fila'
                            ? 'Fim de Fila'
                            : 'Análise'}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-slate-700">
                        {cand.comarca_desejada_1 || 'Porto Alegre'}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <span className="font-bold text-slate-800 block">{cand.status}</span>
                        {cand.lotacao_atual && (
                          <span className="text-[11px] text-teal-700 font-semibold block">
                            Lotação: {cand.lotacao_atual}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => setCandidatoModal(cand)}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors cursor-pointer inline-flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Notas</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Paginação */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="text-slate-600 font-medium">
                Página <strong className="text-slate-900">{paginaAtual}</strong> de{' '}
                <strong className="text-slate-900">{totalPaginas}</strong> | Total:{' '}
                <strong className="text-slate-900">{candidatosFiltrados.length}</strong> candidatos
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={itensPorPagina}
                  onChange={(e) => {
                    const val = e.target.value === 'todos' ? 'todos' : parseInt(e.target.value, 10);
                    setItensPorPagina(val as number | 'todos');
                    setPaginaAtual(1);
                  }}
                  className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-semibold focus:ring-1 focus:ring-[#2DD4AA] cursor-pointer"
                >
                  <option value="25">25 por pág.</option>
                  <option value="50">50 por pág.</option>
                  <option value="100">100 por pág.</option>
                  <option value="todos">Todos</option>
                </select>

                <button
                  type="button"
                  disabled={paginaAtual <= 1}
                  onClick={() => setPaginaAtual((p) => Math.max(1, p - 1))}
                  className="px-3 py-1 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg font-semibold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  ← Anterior
                </button>
                <button
                  type="button"
                  disabled={paginaAtual >= totalPaginas}
                  onClick={() => setPaginaAtual((p) => Math.min(totalPaginas, p + 1))}
                  className="px-3 py-1 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg font-semibold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  Próxima →
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* =================================================================== */}
      {/* ABA 3: ÁREA DO CANDIDATO & ESCOLHA DE COMARCAS                      */}
      {/* =================================================================== */}
      {abaAtiva === 'candidato' && (
        <section className="space-y-6">
          {!usuario ? (
            <div className="bg-gradient-to-r from-[#07192B] via-[#0C2640] to-[#135A7A] text-white rounded-2xl p-8 sm:p-12 text-center max-w-2xl mx-auto shadow-md border border-[#1C2D4A] space-y-4">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-2xl">
                <Lock className="w-7 h-7 text-[#2DD4AA]" />
              </div>
              <h3 className="text-xl sm:text-2xl font-bold font-serif">Área do Candidato Aprovado</h3>
              <p className="text-xs sm:text-sm text-slate-300 max-w-lg mx-auto leading-relaxed">
                Para vincular sua colocação homologada e organizar suas preferências de comarcas para este cargo, entre com sua conta Google.
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={loginGoogle}
                  className="inline-flex items-center gap-3 bg-white hover:bg-slate-100 text-slate-900 font-bold px-6 py-3 rounded-xl shadow-md text-sm transition-all cursor-pointer"
                >
                  <span>Entrar com Google</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Perfil do Candidato */}
              <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 card-shadow space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                  <div>
                    <span className="text-3xs font-bold uppercase tracking-wider text-[#135A7A] font-mono">
                      Meu Perfil no Cargo
                    </span>
                    <h3 className="text-xl sm:text-2xl font-bold font-serif text-slate-900 mt-0.5">
                      {candidatoLogado?.nome || usuario.nome}
                    </h3>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">{usuario.email}</p>
                  </div>

                  <span className="px-3 py-1 rounded-full text-xs font-bold font-mono uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200 self-start sm:self-auto">
                    {candidatoLogado?.status || 'Aguardando Convocação'}
                  </span>
                </div>

                {/* Grade de Informações */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/80">
                    <span className="text-3xs font-bold text-slate-400 uppercase font-mono block">
                      Classificação Ampla
                    </span>
                    <div className="text-xl font-bold font-mono text-slate-900 mt-1">
                      {candidatoLogado?.posicao ? `${candidatoLogado.posicao}º Lugar` : '-'}
                    </div>
                  </div>

                  <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/80">
                    <span className="text-3xs font-bold text-slate-400 uppercase font-mono block">Cota</span>
                    <div className="text-xl font-bold font-mono text-[#135A7A] mt-1">
                      {candidatoLogado?.cota || 'Ampla'}
                    </div>
                  </div>

                  <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/80">
                    <span className="text-3xs font-bold text-slate-400 uppercase font-mono block">
                      Nota Final
                    </span>
                    <div className="text-xl font-bold font-mono text-slate-900 mt-1">
                      {candidatoLogado?.nota_final ? candidatoLogado.nota_final.toFixed(2) : '-'}
                    </div>
                  </div>

                  <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/80">
                    <span className="text-3xs font-bold text-slate-400 uppercase font-mono block">
                      Lotação Atual
                    </span>
                    <div className="text-xl font-bold text-slate-900 mt-1">
                      {candidatoLogado?.lotacao_atual || 'Não assumiu ainda'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Construtor de Preferências de Comarcas (2 Colunas) */}
              <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 card-shadow space-y-5">
                <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base sm:text-lg font-bold font-serif text-slate-900 flex items-center gap-2">
                      <span>⭐</span>
                      <span>Minhas Preferências de Comarcas</span>
                    </h3>
                    <p className="text-xs text-slate-500">
                      Organize sua ordem de prioridade de lotação para este cargo específico.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={salvarPreferencias}
                    className="bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 text-white font-bold px-4 py-2.5 rounded-xl text-xs shadow-xs transition-all cursor-pointer flex items-center gap-2 self-start sm:self-auto"
                  >
                    <Save className="w-4 h-4" />
                    <span>Salvar Minhas Preferências</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Coluna Esquerda: Disponíveis no RS */}
                  <div className="lg:col-span-6 bg-slate-50 rounded-2xl border border-slate-200 p-5 flex flex-col h-[600px]">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-3">
                      <h4 className="text-sm font-bold text-slate-900">
                        Comarcas do RS ({comarcasDisponiveis.length})
                      </h4>
                      <button
                        type="button"
                        onClick={() => {
                          const novos = comarcasDisponiveis.map((c) => c.nome);
                          setMinhasEscolhas([...minhasEscolhas, ...novos]);
                        }}
                        className="text-xs bg-white text-teal-800 border border-teal-300 font-semibold px-2.5 py-1 rounded-lg hover:bg-teal-50 cursor-pointer"
                      >
                        + Adicionar Todas
                      </button>
                    </div>

                    <div className="mb-3">
                      <input
                        type="text"
                        value={buscaComarcaDisponivel}
                        onChange={(e) => setBuscaComarcaDisponivel(e.target.value)}
                        placeholder="Pesquisar comarca..."
                        className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs focus:ring-2 focus:ring-[#2DD4AA]"
                      />
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
                      {comarcasDisponiveis.map((comarca) => (
                        <div
                          key={comarca.id}
                          className="p-2.5 rounded-xl bg-white border border-slate-200/80 flex items-center justify-between text-xs hover:border-teal-400 transition-colors"
                        >
                          <div>
                            <span className="font-bold text-slate-800">{comarca.nome}</span>
                            <span className="text-[10px] text-slate-400 ml-2">
                              {comarca.regiao} • {comarca.vagas_total} vagas
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => adicionarComarca(comarca.nome)}
                            className="px-2 py-1 bg-teal-50 hover:bg-teal-100 text-teal-900 font-bold rounded-lg text-xs cursor-pointer"
                          >
                            + Adicionar
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Coluna Direita: Minhas Escolhas Ordenadas */}
                  <div className="lg:col-span-6 bg-teal-50/40 rounded-2xl border-2 border-teal-300 p-5 flex flex-col h-[600px]">
                    <div className="flex items-center justify-between pb-3 border-b border-teal-200 mb-3">
                      <h4 className="text-sm font-bold text-teal-950 flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#2DD4AA]"></span>
                        <span>Minha Lista de Posse ({minhasEscolhas.length})</span>
                      </h4>
                      <button
                        type="button"
                        onClick={() => setMinhasEscolhas([])}
                        className="text-xs text-rose-600 hover:text-rose-800 font-semibold cursor-pointer"
                      >
                        Limpar Lista
                      </button>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                      {minhasEscolhas.length === 0 ? (
                        <div className="text-center py-16 text-slate-400 text-xs">
                          Nenhuma comarca adicionada à sua lista de posse. Clique em '+ Adicionar' ao lado para montar sua ordem de preferência.
                        </div>
                      ) : (
                        minhasEscolhas.map((comarcaNome, idx) => (
                          <div
                            key={comarcaNome}
                            className="p-2.5 rounded-xl bg-white border border-teal-200 shadow-2xs flex items-center justify-between text-xs"
                          >
                            <div className="flex items-center gap-2.5">
                              <span className="w-6 h-6 rounded-lg bg-[#07192B] text-teal-300 font-mono font-bold text-xs flex items-center justify-center shrink-0">
                                {idx + 1}º
                              </span>
                              <span className="font-bold text-slate-900">{comarcaNome}</span>
                            </div>

                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                disabled={idx === 0}
                                onClick={() => moverComarca(idx, 'cima')}
                                className="p-1 rounded bg-slate-100 hover:bg-slate-200 disabled:opacity-30 cursor-pointer"
                                title="Subir prioridade"
                              >
                                <ArrowUp className="w-3.5 h-3.5 text-slate-700" />
                              </button>
                              <button
                                type="button"
                                disabled={idx === minhasEscolhas.length - 1}
                                onClick={() => moverComarca(idx, 'baixo')}
                                className="p-1 rounded bg-slate-100 hover:bg-slate-200 disabled:opacity-30 cursor-pointer"
                                title="Descer prioridade"
                              >
                                <ArrowDown className="w-3.5 h-3.5 text-slate-700" />
                              </button>
                              <button
                                type="button"
                                onClick={() => removerComarca(comarcaNome)}
                                className="p-1 rounded hover:bg-rose-50 text-rose-500 cursor-pointer"
                                title="Remover da lista"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {/* MODAL DE DETALHES DO CANDIDATO */}
      {candidatoModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-[#07192B] text-white p-5 border-b border-[#0F2942] flex items-center justify-between shrink-0">
              <div>
                <span className="text-3xs font-mono px-2 py-0.5 rounded bg-teal-500/20 text-[#2DD4AA] font-bold uppercase">
                  {candidatoModal.cota}
                </span>
                <h3 className="text-lg font-bold font-serif text-white mt-1">
                  {candidatoModal.nome}
                </h3>
                <p className="text-xs text-slate-300 mt-0.5 font-mono">
                  {candidatoModal.posicao}º Lugar Geral • Nota Final: {candidatoModal.nota_final.toFixed(2)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCandidatoModal(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg text-lg leading-none cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-5 sm:p-6 space-y-5 overflow-y-auto text-xs sm:text-sm text-slate-700">
              <div>
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-400 font-mono mb-2">
                  Notas por Disciplina
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <span className="text-2xs text-slate-500 block">Língua Portuguesa</span>
                    <strong className="text-sm font-mono text-slate-900 mt-1 block">
                      {candidatoModal.notas_disciplinas?.portugues ?? '-'}
                    </strong>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <span className="text-2xs text-slate-500 block">Conhecimentos Jurídicos</span>
                    <strong className="text-sm font-mono text-slate-900 mt-1 block">
                      {candidatoModal.notas_disciplinas?.direito ?? '-'}
                    </strong>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <span className="text-2xs text-slate-500 block">Informática</span>
                    <strong className="text-sm font-mono text-slate-900 mt-1 block">
                      {candidatoModal.notas_disciplinas?.informatica ?? '-'}
                    </strong>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <span className="text-2xs text-slate-500 block">Específicos</span>
                    <strong className="text-sm font-mono text-slate-900 mt-1 block">
                      {candidatoModal.notas_disciplinas?.especificos ?? '-'}
                    </strong>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-2 text-xs">
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500 font-mono">
                  Situação no Concurso
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-700">
                  <div>
                    <strong>Status:</strong> <span>{candidatoModal.status}</span>
                  </div>
                  <div>
                    <strong>Intenção Declarada:</strong>{' '}
                    <span>
                      {candidatoModal.intencao === 'Sim'
                        ? 'Assume a vaga'
                        : candidatoModal.intencao === 'Não'
                        ? 'Desistência'
                        : candidatoModal.intencao === 'final_fila'
                        ? 'Fim de Fila'
                        : 'Não informou'}
                    </span>
                  </div>
                  <div>
                    <strong>Lotação:</strong>{' '}
                    <span>{candidatoModal.lotacao_atual || 'Aguardando Lote'}</span>
                  </div>
                  <div>
                    <strong>1ª Comarca Desejada:</strong>{' '}
                    <span>{candidatoModal.comarca_desejada_1 || 'Porto Alegre'}</span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500 font-mono mb-2">
                  Ordem de Escolha de Comarcas ({candidatoModal.escolhas_comarcas?.length || 0})
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {candidatoModal.escolhas_comarcas?.map((c, i) => (
                    <span
                      key={c}
                      className="px-2.5 py-1 rounded-lg bg-teal-50 border border-teal-200 text-teal-900 text-xs font-semibold"
                    >
                      {i + 1}º {c}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-slate-50 border-t border-slate-200 p-4 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setCandidatoModal(null)}
                className="bg-[#07192B] hover:bg-slate-900 text-white font-bold px-4 py-2 rounded-xl text-xs cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
