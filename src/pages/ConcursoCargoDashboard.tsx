import React, { useState, useMemo, useEffect } from 'react';
import { certamStore } from '../store/certamStore';
import { lotesStore } from '../store/lotesStore';
import { useAuth } from '../store/authContext';
import { Concurso, Cargo, Candidato } from '../types';
import { COMARCAS_RS } from '../data/comarcas';
import { normalizarTexto } from '../data/defaultCandidates';
import { RegionalMapSvg } from '../components/RegionalMapSvg';
import { CommunityForum } from '../components/CommunityForum';
import { FaqSection } from '../components/FaqSection';
import { LinhaDoTempoConcurso } from '../components/LinhaDoTempoConcurso';
import { QuadroVagasView } from '../components/QuadroVagasView';
import { DocumentosConcursoView } from '../components/DocumentosConcursoView';
import { ComunicadosConcursoView } from '../components/ComunicadosConcursoView';
import { SolicitarVinculacaoModal } from '../components/SolicitarVinculacaoModal';
import { MensagensPrivadasDrawer } from '../components/MensagensPrivadasDrawer';
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
  MessageSquare,
  HelpCircle,
  Calendar,
  Briefcase,
  FileText,
  Megaphone,
  TrendingUp,
  MessageCircle,
  AlertCircle,
  ShieldCheck,
  ChevronRight,
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

  const [abaAtiva, setAbaAtiva] = useState<
    | 'dashboard'
    | 'cronograma'
    | 'classificacao'
    | 'quadro_vagas'
    | 'documentos'
    | 'comunicados'
    | 'candidato'
    | 'forum'
    | 'faq'
  >((initialTab as any) || 'dashboard');

  useEffect(() => {
    if (initialTab) {
      setAbaAtiva(initialTab as any);
    }
  }, [initialTab]);

  // Candidatos deste cargo
  const [candidatos, setCandidatos] = useState<Candidato[]>(() =>
    lotesStore.getCandidatos(concurso.id, cargo.id)
  );

  useEffect(() => {
    setCandidatos(lotesStore.getCandidatos(concurso.id, cargo.id));
  }, [concurso.id, cargo.id]);

  // Modal de detalhes do candidato
  const [candidatoModal, setCandidatoModal] = useState<Candidato | null>(null);

  // Modal de Solicitação de Validação Manual
  const [modalValidacaoAberto, setModalValidacaoAberto] = useState(false);

  // Drawer de Mensagens Privadas
  const [dmDrawerAberto, setDmDrawerAberto] = useState(false);
  const [dmDestinatarioEmail, setDmDestinatarioEmail] = useState<string | undefined>(undefined);
  const [dmDestinatarioNome, setDmDestinatarioNome] = useState<string | undefined>(undefined);

  // Toast alert
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  // -------------------------------------------------------------
  // REGRA DE IDENTIFICAÇÃO DE APROVADO HOMOLOGADO
  // -------------------------------------------------------------
  const isCandidatoAprovado = useMemo(() => {
    if (isAdmin) return true;
    if (!usuario) return false;

    // 1. Verificar por ID
    const matchId = candidatos.find((c) => c.id === usuario.candidato_id);
    if (matchId) return true;

    // 2. Verificar por CPF se cadastrado
    if (usuario.cpf) {
      const cpfLimpo = usuario.cpf.replace(/\D/g, '');
      if (cpfLimpo.length >= 6) {
        const matchCpf = candidatos.find(
          (c) => c.cpf && c.cpf.replace(/\D/g, '').includes(cpfLimpo.slice(0, 6))
        );
        if (matchCpf) return true;
      }
    }

    // 3. Verificar por Nome Completo normalizado
    if (usuario.nome && usuario.nome.length >= 3) {
      const nomeNorm = normalizarTexto(usuario.nome);
      const matchNome = candidatos.find((c) => normalizarTexto(c.nome) === nomeNorm);
      if (matchNome) return true;
    }

    // 4. Verificar por e-mail
    if (usuario.email) {
      const matchEmail = candidatos.find(
        (c) => c.email && c.email.toLowerCase() === usuario.email.toLowerCase()
      );
      if (matchEmail) return true;
    }

    return false;
  }, [usuario, isAdmin, candidatos]);

  // Se o concurso está homologado e o usuário NÃO é aprovado, restringe o chat
  const isChatRestrito = useMemo(() => {
    const estáHomologado = concurso.homologado || concurso.status === 'Homologado';
    if (!estáHomologado) return false;
    return !isCandidatoAprovado;
  }, [concurso, isCandidatoAprovado]);

  // Candidato logado vinculado nesta lista (se houver)
  const meuCandidato = useMemo(() => {
    if (!usuario) return null;
    return (
      candidatos.find(
        (c) =>
          c.id === usuario.candidato_id ||
          (usuario.cpf && c.cpf && c.cpf.replace(/\D/g, '') === usuario.cpf.replace(/\D/g, '')) ||
          (usuario.email && c.email?.toLowerCase() === usuario.email.toLowerCase()) ||
          (usuario.nome && normalizarTexto(c.nome) === normalizarTexto(usuario.nome))
      ) || null
    );
  }, [candidatos, usuario]);

  // KPIs
  const kpiStats = useMemo(() => {
    const total = candidatos.length;
    const assumem = candidatos.filter((c) => c.intencao === 'Sim').length;
    const desistem = candidatos.filter((c) => c.intencao === 'Não' || c.status === 'Desistência').length;
    const convocados = candidatos.filter((c) => c.status === 'Convocado Titular' || c.status === 'Nomeado').length;

    return { total, assumem, desistem, convocados };
  }, [candidatos]);

  // Filtros da Classificação
  const [filtroBusca, setFiltroBusca] = useState('');
  const [filtroCota, setFiltroCota] = useState<string>('todas');
  const [filtroStatus, setFiltroStatus] = useState<string>('todos');
  const [filtroIntencao, setFiltroIntencao] = useState<string>('todas');
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [itensPorPagina, setItensPorPagina] = useState<number | 'todos'>(50);

  const candidatosFiltrados = useMemo(() => {
    return candidatos.filter((c) => {
      const matchBusca =
        !filtroBusca.trim() ||
        c.nome.toLowerCase().includes(filtroBusca.toLowerCase()) ||
        c.posicao.toString() === filtroBusca.trim() ||
        (c.comarca_desejada_1 && c.comarca_desejada_1.toLowerCase().includes(filtroBusca.toLowerCase()));

      const matchCota = filtroCota === 'todas' || c.cota === filtroCota;
      const matchStatus = filtroStatus === 'todos' || c.status === filtroStatus;
      const matchIntencao = filtroIntencao === 'todas' || c.intencao === filtroIntencao;

      return matchBusca && matchCota && matchStatus && matchIntencao;
    });
  }, [candidatos, filtroBusca, filtroCota, filtroStatus, filtroIntencao]);

  const totalPaginas = useMemo(() => {
    if (itensPorPagina === 'todos') return 1;
    return Math.ceil(candidatosFiltrados.length / (itensPorPagina as number)) || 1;
  }, [candidatosFiltrados, itensPorPagina]);

  const candidatosPaginados = useMemo(() => {
    if (itensPorPagina === 'todos') return candidatosFiltrados;
    const start = (paginaAtual - 1) * (itensPorPagina as number);
    return candidatosFiltrados.slice(start, start + (itensPorPagina as number));
  }, [candidatosFiltrados, paginaAtual, itensPorPagina]);

  // Escolha de comarcas na aba candidato
  const [minhasEscolhas, setMinhasEscolhas] = useState<string[]>([]);
  const [minhaIntencao, setMinhaIntencao] = useState<'Sim' | 'Talvez' | 'final_fila' | 'Não'>('Sim');

  useEffect(() => {
    if (meuCandidato) {
      setMinhasEscolhas(meuCandidato.escolhas_comarcas || (meuCandidato.comarca_desejada_1 ? [meuCandidato.comarca_desejada_1] : []));
      setMinhaIntencao(meuCandidato.intencao as any || 'Sim');
    }
  }, [meuCandidato]);

  const handleSalvarMinhasComarcas = (e: React.FormEvent) => {
    e.preventDefault();
    if (!meuCandidato) {
      showToast('Apenas candidatos da lista homologada podem definir escolhas de comarca.');
      return;
    }

    const atualizado: Candidato = {
      ...meuCandidato,
      escolhas_comarcas: minhasEscolhas,
      comarca_desejada_1: minhasEscolhas[0] || undefined,
      intencao: minhaIntencao,
    };

    lotesStore.salvarCandidato(concurso.id, cargo.id, atualizado);
    setCandidatos(lotesStore.getCandidatos(concurso.id, cargo.id));
    showToast('Preferências de comarcas salvas com sucesso!');
  };

  const adicionarComarca = (nome: string) => {
    if (!minhasEscolhas.includes(nome)) {
      setMinhasEscolhas([...minhasEscolhas, nome]);
    }
  };

  const removerComarca = (nome: string) => {
    setMinhasEscolhas(minhasEscolhas.filter((c) => c !== nome));
  };

  const moverComarca = (index: number, direcao: 'cima' | 'baixo') => {
    const nova = [...minhasEscolhas];
    const target = direcao === 'cima' ? index - 1 : index + 1;
    if (target >= 0 && target < nova.length) {
      const temp = nova[index];
      nova[index] = nova[target];
      nova[target] = temp;
      setMinhasEscolhas(nova);
    }
  };

  const handleAbrirMensagemComCandidato = (cand: Candidato) => {
    if (!cand.email) {
      showToast('Este candidato ainda não informou um e-mail para contato direto.');
      return;
    }
    setDmDestinatarioEmail(cand.email);
    setDmDestinatarioNome(cand.nome);
    setDmDrawerAberto(true);
  };

  return (
    <div className="space-y-6 max-w-[1880px] w-full mx-auto">
      {/* Toast Feedback */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#07192B] text-white px-5 py-3 rounded-xl shadow-2xl border border-teal-400 flex items-center gap-3 animate-fade-in">
          <CheckCircle2 className="w-5 h-5 text-[#2DD4AA] shrink-0" />
          <span className="text-xs sm:text-sm font-semibold">{toastMsg}</span>
        </div>
      )}

      {/* TOP BANNER INSTITUCIONAL DO CONCURSO & SELETOR DE CARGO */}
      <div className="bg-[#07192B] text-white rounded-2xl border border-[#0F2942] p-5 sm:p-6 card-shadow flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md bg-[#2DD4AA]/20 text-[#2DD4AA] text-xs font-bold font-mono uppercase">
              {concurso.orgao} • {concurso.ano}
            </span>
            <span className="text-2xs text-slate-400 font-semibold">{concurso.esfera}</span>
            <span className="text-slate-500">·</span>
            <span
              className={`text-2xs font-bold px-2 py-0.5 rounded ${
                concurso.homologado || concurso.status === 'Homologado'
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : 'bg-amber-500/20 text-amber-300'
              }`}
            >
              {concurso.status}
            </span>
          </div>

          <h1 className="text-xl sm:text-2xl font-bold font-serif text-white">
            {concurso.nome}
          </h1>

          {/* Seletor de Cargos do Concurso */}
          <div className="flex items-center gap-1.5 overflow-x-auto pt-1">
            <span className="text-2xs text-slate-400 font-semibold uppercase mr-1">Cargos:</span>
            {concurso.cargos?.map((cg) => {
              const isSelected = cg.id === cargo.id;
              return (
                <button
                  key={cg.id}
                  type="button"
                  onClick={() => onNavigate('concurso', { concursoId: concurso.id, cargoId: cg.id, tab: abaAtiva })}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#2DD4AA] text-slate-950 font-bold shadow-xs'
                      : 'bg-white/10 hover:bg-white/20 text-slate-300'
                  }`}
                >
                  {cg.nome}
                </button>
              );
            })}
          </div>
        </div>

        {/* Simulador de Lotes e Atalhos */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() =>
              onNavigate('lote', {
                concursoId: concurso.id,
                cargoId: cargo.id,
              })
            }
            className="flex items-center gap-1.5 bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 text-white font-bold px-4 py-2 rounded-xl text-xs shadow-xs transition-all cursor-pointer"
          >
            <span>Simulador de Lotes →</span>
          </button>
        </div>
      </div>

      {/* BARRA DE NAVEGAÇÃO DE ABAS TEMÁTICAS */}
      <div className="bg-white rounded-2xl border border-slate-200 px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3 card-shadow overflow-x-auto">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <button
            type="button"
            onClick={() => setAbaAtiva('dashboard')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              abaAtiva === 'dashboard'
                ? 'bg-[#0C2640] text-[#2DD4AA]'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Visão Geral do Cargo</span>
          </button>

          <button
            type="button"
            onClick={() => setAbaAtiva('cronograma')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              abaAtiva === 'cronograma'
                ? 'bg-[#0C2640] text-[#2DD4AA]'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Linha do Tempo Oficial</span>
          </button>

          <button
            type="button"
            onClick={() => setAbaAtiva('classificacao')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              abaAtiva === 'classificacao'
                ? 'bg-[#0C2640] text-[#2DD4AA]'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <ListOrdered className="w-4 h-4" />
            <span>Lista de Classificação</span>
          </button>

          <button
            type="button"
            onClick={() => setAbaAtiva('quadro_vagas')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              abaAtiva === 'quadro_vagas'
                ? 'bg-[#0C2640] text-[#2DD4AA]'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>Quadro de Vagas & Nomeações</span>
          </button>

          <button
            type="button"
            onClick={() => setAbaAtiva('documentos')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              abaAtiva === 'documentos'
                ? 'bg-[#0C2640] text-[#2DD4AA]'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Documentos Oficiais</span>
          </button>

          <button
            type="button"
            onClick={() => setAbaAtiva('comunicados')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              abaAtiva === 'comunicados'
                ? 'bg-[#0C2640] text-[#2DD4AA]'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Megaphone className="w-4 h-4" />
            <span>Comunicados & Mobilização (PLs)</span>
          </button>

          <button
            type="button"
            onClick={() => setAbaAtiva('candidato')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              abaAtiva === 'candidato'
                ? 'bg-[#0C2640] text-[#2DD4AA]'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>Preferências de Comarcas</span>
          </button>

          <button
            type="button"
            onClick={() => setAbaAtiva('forum')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap relative ${
              abaAtiva === 'forum'
                ? 'bg-[#0C2640] text-[#2DD4AA]'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Comunidade & Chat</span>
            {isChatRestrito && (
              <span title="Restrito aos aprovados">
                <Lock className="w-3 h-3 text-amber-500" />
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setAbaAtiva('faq')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              abaAtiva === 'faq'
                ? 'bg-[#0C2640] text-[#2DD4AA]'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <HelpCircle className="w-4 h-4" />
            <span>Dúvidas & FAQ</span>
          </button>
        </div>
      </div>

      {/* =================================================================== */}
      {/* ABA 1: DASHBOARD GERAL DO CARGO                                     */}
      {/* =================================================================== */}
      {abaAtiva === 'dashboard' && (
        <section className="space-y-6">
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
              <span className="text-xs font-semibold text-slate-500">Vagas Imediatas em Edital</span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-slate-900 font-mono">
                  {cargo.vagas_imediatas}
                </span>
                {cargo.tem_cr && (
                  <span className="text-xs text-teal-700 font-semibold font-mono bg-teal-50 px-2 py-0.5 rounded">
                    + Cadastro Reserva
                  </span>
                )}
              </div>
              <span className="text-xs text-slate-400 mt-1">Remuneração: {cargo.remuneracao_inicial || 'R$ 10.250,80'}</span>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-slate-200 card-shadow flex flex-col justify-between">
              <span className="text-xs font-semibold text-slate-500">Candidatos no Ranking</span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-slate-900 font-mono">
                  {kpiStats.total}
                </span>
                <span className="text-xs text-slate-400 font-medium">homologados</span>
              </div>
              <span className="text-xs text-[#2DD4AA] font-bold mt-1 font-mono">
                {kpiStats.convocados} convocados no 1º lote
              </span>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-slate-200 card-shadow flex flex-col justify-between">
              <span className="text-xs font-semibold text-slate-500">Confirmam Interesse em Assumir</span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-slate-900 font-mono">
                  {kpiStats.assumem}
                </span>
                <span className="text-xs text-emerald-600 font-medium">titulares</span>
              </div>
              <span className="text-xs text-slate-400 mt-1">Interesse ativo na posse</span>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-slate-200 card-shadow flex flex-col justify-between">
              <span className="text-xs font-semibold text-slate-500">Cargos Vagos Reais no Órgão</span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-amber-900 font-mono">
                  {cargo.vagas_reais_abertas || 284}
                </span>
                <span className="text-xs text-amber-700 font-semibold">vacâncias</span>
              </div>
              <span className="text-xs text-slate-400 mt-1">Espaço orçamentário para nomeações</span>
            </div>
          </div>

          {/* Grade do Dashboard */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 card-shadow p-5 sm:p-6 flex flex-col">
              <RegionalMapSvg />
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs text-slate-500 font-medium">Simulador de Alocação</span>
                <button
                  type="button"
                  onClick={() => setAbaAtiva('candidato')}
                  className="text-xs font-bold text-[#135A7A] hover:text-[#2DD4AA] transition-colors cursor-pointer"
                >
                  Minhas Preferências →
                </button>
              </div>
            </div>

            <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 card-shadow p-5 sm:p-6 flex flex-col">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                <h3 className="text-base font-bold text-slate-900 font-serif">
                  Prévia da Classificação Oficial
                </h3>
                <button
                  type="button"
                  onClick={() => setAbaAtiva('classificacao')}
                  className="text-xs font-semibold text-teal-700 hover:underline cursor-pointer"
                >
                  Ver Lista Completa ({candidatos.length})
                </button>
              </div>

              <div className="overflow-x-auto min-h-[380px]">
                <table className="w-full text-left text-xs divide-y divide-slate-100">
                  <thead>
                    <tr className="text-slate-700 font-bold border-b border-slate-200">
                      <th className="py-2 px-2 w-10">Pos.</th>
                      <th className="py-2 px-3">Nome do Candidato</th>
                      <th className="py-2 px-3">1ª Opção</th>
                      <th className="py-2 px-2 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {candidatos.slice(0, 8).map((cand) => (
                      <tr key={cand.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2.5 px-2 font-mono font-bold text-slate-900">
                          {cand.posicao}º
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="font-bold text-slate-800">{cand.nome}</span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">
                          {isCandidatoAprovado ? (
                            cand.comarca_desejada_1 || 'Porto Alegre'
                          ) : (
                            <span className="text-[11px] text-slate-400 font-mono italic">
                              🔒 Restrito a Aprovados
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-2 text-right">
                          <span className="text-[11px] font-semibold text-teal-800 bg-teal-50 px-2 py-0.5 rounded">
                            {cand.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* =================================================================== */}
      {/* ABA 2: LINHA DO TEMPO OFICIAL DO CONCURSO                           */}
      {/* =================================================================== */}
      {abaAtiva === 'cronograma' && (
        <section className="space-y-6">
          <LinhaDoTempoConcurso concurso={concurso} />
        </section>
      )}

      {/* =================================================================== */}
      {/* ABA 3: LISTA DE CLASSIFICAÇÃO COM PROTEÇÃO DE DADOS                 */}
      {/* =================================================================== */}
      {abaAtiva === 'classificacao' && (
        <section className="space-y-6">
          {/* Banner de Aviso de Privacidade e Solicitação de Validação */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 card-shadow flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200 text-teal-800 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5 text-teal-600" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900">
                  {isCandidatoAprovado
                    ? 'Visualização Completa Liberada para Candidatos Homologados'
                    : 'Visualização Pública de Classificação (Posição e Nome)'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {isCandidatoAprovado
                    ? 'Você possui cadastro vinculado e pode consultar as notas por disciplina, cotas e preferências de comarca de todos os candidatos.'
                    : 'O público em geral visualiza apenas a colocação e o nome. Para visualizar notas detalhadas e preferências, identifique-se como aprovado.'}
                </p>
              </div>
            </div>

            {!isCandidatoAprovado && (
              <button
                type="button"
                onClick={() => setModalValidacaoAberto(true)}
                className="px-4 py-2 bg-[#07192B] hover:bg-[#0C2640] text-[#2DD4AA] font-bold text-xs rounded-xl transition-all cursor-pointer shadow-xs whitespace-nowrap shrink-0 flex items-center gap-1.5"
              >
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Não fui identificado? Solicitar ao Admin</span>
              </button>
            )}
          </div>

          {/* Filtros da Tabela */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 card-shadow space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Pesquisar por nome ou posição..."
                  value={filtroBusca}
                  onChange={(e) => {
                    setFiltroBusca(e.target.value);
                    setPaginaAtual(1);
                  }}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-teal-600 focus:outline-hidden"
                />
              </div>

              <select
                value={filtroCota}
                onChange={(e) => {
                  setFiltroCota(e.target.value);
                  setPaginaAtual(1);
                }}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-hidden"
              >
                <option value="todas">Todas as Cotas</option>
                <option value="Ampla">Ampla Concorrência</option>
                <option value="PPP">Pessoas Pretas ou Pardas (PPP)</option>
                <option value="PCD">Pessoas com Deficiência (PCD)</option>
              </select>

              <select
                value={filtroIntencao}
                onChange={(e) => {
                  setFiltroIntencao(e.target.value);
                  setPaginaAtual(1);
                }}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-hidden"
              >
                <option value="todas">Todas as Intenções de Posse</option>
                <option value="Sim">Pretende Assumir</option>
                <option value="Talvez">Em Dúvida</option>
                <option value="Não">Vai Desistir</option>
                <option value="final_fila">Fim de Fila</option>
              </select>

              <select
                value={filtroStatus}
                onChange={(e) => {
                  setFiltroStatus(e.target.value);
                  setPaginaAtual(1);
                }}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-hidden"
              >
                <option value="todos">Todos os Status</option>
                <option value="Convocado Titular">Convocado Titular</option>
                <option value="Aguardando">Aguardando Convocação</option>
                <option value="Desistência">Desistência Formalizada</option>
              </select>
            </div>
          </div>

          {/* Tabela de Classificação */}
          <div className="bg-white rounded-2xl border border-slate-200 card-shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs divide-y divide-slate-100">
                <thead className="bg-[#07192B] text-white font-serif text-2xs uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-3 text-center w-12 font-semibold">Pos.</th>
                    <th className="py-3 px-4 font-semibold">Candidato</th>
                    <th className="py-3 px-3 font-semibold text-center">Cota</th>
                    <th className="py-3 px-3 font-semibold text-right">Nota Final</th>
                    <th className="py-3 px-3 font-semibold text-center">Intenção</th>
                    <th className="py-3 px-4 font-semibold">Comarca Preferencial</th>
                    <th className="py-3 px-3 font-semibold">Status</th>
                    <th className="py-3 px-3 font-semibold text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {candidatosPaginados.map((cand) => (
                    <tr key={cand.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-3 text-center font-mono font-bold text-slate-900">
                        {cand.posicao}º
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900">
                        <div>{cand.nome}</div>
                        {isCandidatoAprovado && cand.cpf && (
                          <span className="text-[10px] font-mono text-slate-400 block font-normal">
                            CPF: {cand.cpf}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center font-mono">
                        {isCandidatoAprovado ? (
                          <span className="px-2 py-0.5 rounded text-[11px] bg-slate-100 text-slate-700 font-semibold">
                            {cand.cota}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-2xs italic">Restrito</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                        {isCandidatoAprovado ? (
                          cand.nota_final.toFixed(2)
                        ) : (
                          <span className="text-slate-400 font-normal text-2xs italic">Restrito</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {isCandidatoAprovado ? (
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              cand.intencao === 'Sim'
                                ? 'bg-emerald-50 text-emerald-800'
                                : cand.intencao === 'Não'
                                ? 'bg-rose-50 text-rose-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {cand.intencao === 'Sim' ? 'Assume' : cand.intencao === 'Não' ? 'Desiste' : 'Análise'}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-2xs italic">Restrito</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-700">
                        {isCandidatoAprovado ? (
                          cand.comarca_desejada_1 || 'Porto Alegre'
                        ) : (
                          <span className="text-slate-400 text-2xs italic flex items-center gap-1">
                            <Lock className="w-3 h-3 text-slate-400" />
                            <span>Restrito a Aprovados</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-[11px] font-semibold text-teal-800">
                        {cand.status}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {isCandidatoAprovado && (
                            <>
                              <button
                                type="button"
                                onClick={() => setCandidatoModal(cand)}
                                className="p-1 text-slate-600 hover:text-teal-700 rounded hover:bg-slate-100 cursor-pointer"
                                title="Visualizar notas detalhadas"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              {usuario && (
                                <button
                                  type="button"
                                  onClick={() => handleAbrirMensagemComCandidato(cand)}
                                  className="p-1 text-slate-600 hover:text-[#135A7A] rounded hover:bg-slate-100 cursor-pointer"
                                  title="Enviar mensagem privada 1 a 1"
                                >
                                  <MessageCircle className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </>
                          )}
                        </div>
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
                <button
                  type="button"
                  disabled={paginaAtual <= 1}
                  onClick={() => setPaginaAtual((p) => Math.max(1, p - 1))}
                  className="px-3 py-1 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg font-semibold disabled:opacity-40 cursor-pointer"
                >
                  ← Anterior
                </button>
                <button
                  type="button"
                  disabled={paginaAtual >= totalPaginas}
                  onClick={() => setPaginaAtual((p) => Math.min(totalPaginas, p + 1))}
                  className="px-3 py-1 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg font-semibold disabled:opacity-40 cursor-pointer"
                >
                  Próxima →
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* =================================================================== */}
      {/* ABA 4: QUADRO DE VAGAS & NOMEAÇÕES                                  */}
      {/* =================================================================== */}
      {abaAtiva === 'quadro_vagas' && (
        <section className="space-y-6">
          <QuadroVagasView concurso={concurso} cargoIdSelecionado={cargo.id} />
        </section>
      )}

      {/* =================================================================== */}
      {/* ABA 5: DOCUMENTOS OFICIAIS                                          */}
      {/* =================================================================== */}
      {abaAtiva === 'documentos' && (
        <section className="space-y-6">
          <DocumentosConcursoView concurso={concurso} />
        </section>
      )}

      {/* =================================================================== */}
      {/* ABA 6: COMUNICADOS & MOBILIZAÇÃO DOS APROVADOS                      */}
      {/* =================================================================== */}
      {abaAtiva === 'comunicados' && (
        <section className="space-y-6">
          <ComunicadosConcursoView concurso={concurso} />
        </section>
      )}

      {/* =================================================================== */}
      {/* ABA 7: ÁREA DO CANDIDATO & PREFERÊNCIAS DE COMARCA                  */}
      {/* =================================================================== */}
      {abaAtiva === 'candidato' && (
        <section className="space-y-6">
          {!usuario ? (
            <div className="bg-[#07192B] text-white rounded-2xl p-8 sm:p-12 text-center max-w-2xl mx-auto shadow-md border border-[#1C2D4A] space-y-4">
              <UserCheck className="w-12 h-12 text-[#2DD4AA] mx-auto" />
              <h3 className="text-xl font-bold font-serif text-white">Identifique-se no CERTAM</h3>
              <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto leading-relaxed">
                Faça login para salvar suas opções de comarca, intenção de posse e simular sua colocação na audiência.
              </p>
              <button
                type="button"
                onClick={loginGoogle}
                className="bg-[#2DD4AA] hover:bg-[#20BE96] text-slate-950 font-bold px-6 py-2.5 rounded-xl text-xs transition-all cursor-pointer shadow-md"
              >
                Entrar com Google
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-7 card-shadow space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="font-serif font-bold text-lg text-[#07192B]">
                    Minhas Preferências de Lotação • {cargo.nome}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Defina sua ordem de preferência de comarcas para calibrar o simulador oficial de audiência pública
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-600">Minha Intenção:</span>
                  <select
                    value={minhaIntencao}
                    onChange={(e) => setMinhaIntencao(e.target.value as any)}
                    className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold"
                  >
                    <option value="Sim">Pretendo Assumir</option>
                    <option value="Talvez">Em Dúvida</option>
                    <option value="final_fila">Solicitar Fim de Fila</option>
                    <option value="Não">Vou Desistir</option>
                  </select>
                </div>
              </div>

              {/* Construtor de Lista de Comarcas */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Comarcas Disponíveis */}
                <div className="lg:col-span-6 bg-slate-50 rounded-2xl border border-slate-200 p-4 space-y-3">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                    Comarcas do Estado ({COMARCAS_RS.length})
                  </span>
                  <div className="max-h-[420px] overflow-y-auto space-y-1.5 pr-1">
                    {COMARCAS_RS.map((comarca) => {
                      const jaEscolhida = minhasEscolhas.includes(comarca.nome);
                      return (
                        <div
                          key={comarca.id}
                          className="p-2.5 bg-white rounded-xl border border-slate-200 flex items-center justify-between text-xs hover:border-teal-400 transition-colors"
                        >
                          <div>
                            <span className="font-bold text-slate-800">{comarca.nome}</span>
                            <span className="text-2xs text-slate-400 ml-2">({comarca.regiao})</span>
                          </div>
                          <button
                            type="button"
                            disabled={jaEscolhida}
                            onClick={() => adicionarComarca(comarca.nome)}
                            className="px-2.5 py-1 bg-teal-50 hover:bg-teal-100 text-teal-800 font-bold text-[11px] rounded-lg transition-colors cursor-pointer disabled:opacity-40"
                          >
                            {jaEscolhida ? 'Adicionada' : '+ Adicionar'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Minhas Escolhas Ordenadas */}
                <div className="lg:col-span-6 bg-teal-50/30 rounded-2xl border-2 border-teal-200 p-4 space-y-3 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-teal-950 uppercase tracking-wider">
                        Minha Ordem de Preferência ({minhasEscolhas.length})
                      </span>
                      <button
                        type="button"
                        onClick={() => setMinhasEscolhas([])}
                        className="text-2xs font-semibold text-rose-600 hover:underline"
                      >
                        Limpar Lista
                      </button>
                    </div>

                    <div className="max-h-[380px] overflow-y-auto space-y-1.5 pr-1">
                      {minhasEscolhas.length === 0 ? (
                        <div className="p-8 text-center text-xs text-slate-400">
                          Clique em &apos;+ Adicionar&apos; ao lado para montar sua ordem de prioridade.
                        </div>
                      ) : (
                        minhasEscolhas.map((comarca, idx) => (
                          <div
                            key={comarca}
                            className="p-2.5 bg-white rounded-xl border border-teal-200 flex items-center justify-between text-xs shadow-2xs"
                          >
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded bg-[#07192B] text-teal-300 font-mono font-bold text-xs flex items-center justify-center">
                                {idx + 1}
                              </span>
                              <span className="font-bold text-slate-800">{comarca}</span>
                            </div>

                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                disabled={idx === 0}
                                onClick={() => moverComarca(idx, 'cima')}
                                className="p-1 hover:bg-slate-100 rounded disabled:opacity-30 cursor-pointer"
                              >
                                <ArrowUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={idx === minhasEscolhas.length - 1}
                                onClick={() => moverComarca(idx, 'baixo')}
                                className="p-1 hover:bg-slate-100 rounded disabled:opacity-30 cursor-pointer"
                              >
                                <ArrowDown className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => removerComarca(comarca)}
                                className="p-1 hover:bg-rose-50 text-rose-500 rounded cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-teal-200 flex justify-end">
                    <button
                      type="button"
                      onClick={handleSalvarMinhasComarcas}
                      className="px-5 py-2.5 bg-[#07192B] hover:bg-[#0C2640] text-[#2DD4AA] font-bold text-xs rounded-xl transition-all cursor-pointer shadow-sm flex items-center gap-1.5"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Salvar Minhas Escolhas</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {/* =================================================================== */}
      {/* ABA 8: FÓRUM & CHAT COMPLETO DA COMUNIDADE                          */}
      {/* =================================================================== */}
      {abaAtiva === 'forum' && (
        <section className="space-y-6">
          <CommunityForum
            concursoId={concurso.id}
            cargoId={cargo.id}
            cargoNome={cargo.nome}
            isRestritoBloqueado={isChatRestrito}
            onSolicitarAcesso={() => setModalValidacaoAberto(true)}
          />
        </section>
      )}

      {/* =================================================================== */}
      {/* ABA 9: DÚVIDAS FREQUENTES & FAQ                                     */}
      {/* =================================================================== */}
      {abaAtiva === 'faq' && (
        <section className="space-y-6">
          <FaqSection
            concursoId={concurso.id}
            cargoId={cargo.id}
            concursoNome={concurso.nome}
            onOpenChat={() => setAbaAtiva('forum')}
          />
        </section>
      )}

      {/* MODAIS DA PÁGINA */}
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

            <div className="p-5 sm:p-6 space-y-5 overflow-y-auto text-xs text-slate-700">
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

              <div>
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-400 font-mono mb-2">
                  Ordem de Escolha de Comarcas
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {candidatoModal.escolhas_comarcas && candidatoModal.escolhas_comarcas.length > 0 ? (
                    candidatoModal.escolhas_comarcas.map((c, i) => (
                      <span
                        key={i}
                        className="px-3 py-1 bg-teal-50 border border-teal-200 text-teal-900 rounded-lg text-xs font-semibold flex items-center gap-1.5"
                      >
                        <span className="font-mono text-teal-700 font-bold">{i + 1}º</span>
                        <span>{c}</span>
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-slate-400 italic">
                      1ª Opção: {candidatoModal.comarca_desejada_1 || 'Porto Alegre'}
                    </span>
                  )}
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setCandidatoModal(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-xs cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Solicitação de Validação Manual */}
      <SolicitarVinculacaoModal
        aberto={modalValidacaoAberto}
        onClose={() => setModalValidacaoAberto(false)}
        concursoId={concurso.id}
        concursoNome={concurso.nome}
        cargoId={cargo.id}
        cargoNome={cargo.nome}
      />

      {/* Drawer de Mensagens Privadas */}
      <MensagensPrivadasDrawer
        aberto={dmDrawerAberto}
        onClose={() => setDmDrawerAberto(false)}
        destinatarioInicialEmail={dmDestinatarioEmail}
        destinatarioInicialNome={dmDestinatarioNome}
      />
    </div>
  );
};
