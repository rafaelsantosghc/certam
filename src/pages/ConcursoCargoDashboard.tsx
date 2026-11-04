import React, { useState, useMemo, useEffect, useRef } from 'react';
import { certamStore } from '../store/certamStore';
import { lotesStore } from '../store/lotesStore';
import { userRegistryStore } from '../store/userRegistryStore';
import { cloudSync } from '../store/cloudSync';
import { useAuth } from '../store/authContext';
import { podeEditarConcurso, podeEditarCargo, podeEditarLote } from '../utils/permissions';
import { classificationCache } from '../utils/classificationCache';
import { ModalEditarConcurso } from '../components/ModalEditarConcurso';
import { ModalEditarCargo } from '../components/ModalEditarCargo';
import { ModalEditarLote } from '../components/ModalEditarLote';
import { ModalEscolhaComarcasLote } from '../components/ModalEscolhaComarcasLote';
import { calcularOrdemNomeacao, ItemOrdemNomeacao } from '../utils/ordemNomeacao';
import { Concurso, Cargo, Candidato, Lote, ConfigCotas } from '../types';
import { COMARCAS_RS } from '../data/comarcas';
import { normalizarTexto } from '../data/defaultCandidates';
import { matchFonético } from '../utils/phoneticSearch';
import { isDebugMode } from '../utils/environment';
import { RegionalMapSvg } from '../components/RegionalMapSvg';
import { CommunityForum } from '../components/CommunityForum';
import { FaqSection } from '../components/FaqSection';
import { LinhaDoTempoConcurso } from '../components/LinhaDoTempoConcurso';
import { QuadroVagasView } from '../components/QuadroVagasView';
import { DocumentosConcursoView } from '../components/DocumentosConcursoView';
import { ComunicadosConcursoView } from '../components/ComunicadosConcursoView';
import { SolicitarVinculacaoModal } from '../components/SolicitarVinculacaoModal';
import { MensagensPrivadasDrawer } from '../components/MensagensPrivadasDrawer';
import { ModalEditarCandidatoAdmin } from '../components/ModalEditarCandidatoAdmin';
import { ModalGerenciarDropdowns } from '../components/ModalGerenciarDropdowns';
import { ModalAdicionarCandidatoAdmin } from '../components/ModalAdicionarCandidatoAdmin';
import {
  BarChart3,
  ListOrdered,
  UserCheck,
  Send,
  Search,
  Eye,
  Plus,
  Pencil,
  ArrowUp,
  ArrowDown,
  Trash2,
  CheckCircle2,
  XCircle,
  BookmarkCheck,
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
  ChevronDown,
  ChevronUp,
  Clock,
  Users,
  ArrowLeft,
  ArrowRight,
  Layers,
  Sliders,
  Sparkles,
  Percent,
  MapPin,
} from 'lucide-react';

interface ConcursoCargoDashboardProps {
  concursoId: string;
  cargoId: string;
  initialTab?: string;
  onNavigate: (view: string, params?: { concursoId?: string; cargoId?: string; tab?: string; loteId?: string }) => void;
  onVoltar?: () => void;
}

export const ConcursoCargoDashboard: React.FC<ConcursoCargoDashboardProps> = ({
  concursoId,
  cargoId,
  initialTab = 'dashboard',
  onNavigate,
  onVoltar,
}) => {
  const { usuario, isAdmin, loginGoogle, acompanharConcurso, desacompanharConcurso } = useAuth();

  const [concurso, setConcurso] = useState<Concurso>(() => {
    return certamStore.getConcurso(concursoId) || certamStore.getConcursos()[0];
  });

  const [cargo, setCargo] = useState<Cargo>(() => {
    const c = certamStore.getConcurso(concursoId) || certamStore.getConcursos()[0];
    return (c ? certamStore.getCargo(c.id, cargoId) || c.cargos?.[0] : undefined) as Cargo;
  });

  const tipoLotacao = concurso?.tipo_lotacao || 'Lotação';

  const [lotes, setLotes] = useState<Lote[]>(() => lotesStore.getLotes());

  useEffect(() => {
    const syncData = () => {
      const c = certamStore.getConcurso(concursoId) || certamStore.getConcursos()[0];
      if (!c) return;
      const cg = certamStore.getCargo(c.id, cargoId) || c.cargos?.[0];
      setConcurso(c);
      if (cg) {
        setCargo(cg);
        setCandidatos(lotesStore.getCandidatos(c.id, cg.id));
      }
      setLotes(lotesStore.getLotes());
    };
    syncData();
    void cloudSync.pullFromServer().then(syncData);
    window.addEventListener('storage', syncData);
    window.addEventListener('certam_concursos_updated', syncData);
    window.addEventListener('certam_lotes_updated', syncData);
    window.addEventListener('certam_candidatos_updated', syncData);

    const interval = window.setInterval(syncData, 3500);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('storage', syncData);
      window.removeEventListener('certam_concursos_updated', syncData);
      window.removeEventListener('certam_lotes_updated', syncData);
      window.removeEventListener('certam_candidatos_updated', syncData);
    };
  }, [concursoId, cargoId]);

  const [modalEditarConcursoAberto, setModalEditarConcursoAberto] = useState(false);
  const [modalEditarCargoAberto, setModalEditarCargoAberto] = useState(false);
  const [modalEditarLoteAberto, setModalEditarLoteAberto] = useState(false);
  const [loteEditando, setLoteEditando] = useState<Lote | null>(null);
  const [lotesExpandidosComarcas, setLotesExpandidosComarcas] = useState<Record<string, boolean>>({});
  const [lotesExpandidosConvocados, setLotesExpandidosConvocados] = useState<Record<string, boolean>>({});

  const topScrollRef1 = useRef<HTMLDivElement>(null);
  const bottomScrollRef1 = useRef<HTMLDivElement>(null);
  const topScrollRef2 = useRef<HTMLDivElement>(null);
  const bottomScrollRef2 = useRef<HTMLDivElement>(null);

  const podeEditarEsteConcurso = podeEditarConcurso(usuario, concurso.id);
  const podeEditarEsteCargo = podeEditarCargo(usuario, concurso.id, cargo.id);
  const podeEditarEsteLote = podeEditarLote(usuario, concurso.id, cargo.id);

  const reloadData = () => {
    const c = certamStore.getConcurso(concursoId) || certamStore.getConcursos()[0];
    setConcurso(c);
    setCargo(certamStore.getCargo(c.id, cargoId) || c.cargos[0]);
    setLotes(lotesStore.getLotes());
    setCandidatos(lotesStore.getCandidatos(c.id, cargo.id));
  };

  const handleExcluirLote = (loteId: string, nome: string) => {
    if (window.confirm(`Tem certeza que deseja excluir o lote "${nome}"?`)) {
      lotesStore.removerLote(loteId);
      setLotes(lotesStore.getLotes());
      showToast(`Lote "${nome}" excluído com sucesso.`);
    }
  };

  const [abaAtiva, setAbaAtiva] = useState<
    | 'dashboard'
    | 'cronograma'
    | 'classificacao'
    | 'quadro_vagas'
    | 'lotes'
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
    let isMounted = true;
    async function loadCachedCandidates() {
      const cached = await classificationCache.get(concurso.id, cargo.id);
      if (cached && cached.length > 0 && isMounted) {
        setCandidatos(cached);
      }
      const fresh = lotesStore.getCandidatos(concurso.id, cargo.id);
      if (fresh && fresh.length > 0 && isMounted) {
        setCandidatos(fresh);
        void classificationCache.set(concurso.id, cargo.id, fresh);
      }
    }
    void loadCachedCandidates();
    return () => {
      isMounted = false;
    };
  }, [concurso.id, cargo.id]);

  useEffect(() => {
    if (candidatos && candidatos.length > 0) {
      void classificationCache.set(concurso.id, cargo.id, candidatos);
    }
  }, [candidatos, concurso.id, cargo.id]);

  // Publica automaticamente o concurso e a lista de classificação para todos os usuários sempre que o Admin visualizar o cargo
  useEffect(() => {
    if (isAdmin && concurso?.id && cargo?.id && candidatos.length > 0) {
      void cloudSync.pushKey('certam_concursos_cargos_v6', certamStore.getConcursos(), true);
      void cloudSync.pushKey(
        `certam_candidatos_data_v6_${concurso.id}_${cargo.id}`,
        candidatos,
        true
      );
    }
  }, [isAdmin, concurso?.id, cargo?.id, candidatos.length]);

  // Modal de detalhes do candidato
  const [candidatoModal, setCandidatoModal] = useState<Candidato | null>(null);

  // Modal de Solicitação de Validação Manual
  const [modalValidacaoAberto, setModalValidacaoAberto] = useState(false);

  // Drawer de Mensagens Privadas
  const [dmDrawerAberto, setDmDrawerAberto] = useState(false);
  const [dmDestinatarioEmail, setDmDestinatarioEmail] = useState<string | undefined>(undefined);
  const [dmDestinatarioNome, setDmDestinatarioNome] = useState<string | undefined>(undefined);

  // Toast alert
  const [toastData, setToastData] = useState<{ msg: string; tipo: 'sucesso' | 'erro' } | null>(null);
  const showToast = (msg: string, tipo: 'sucesso' | 'erro' = 'sucesso') => {
    setToastData({ msg, tipo });
    setTimeout(() => setToastData(null), 3500);
  };

  // Modais de Edição e Gestão de Candidatos pelo Admin (Item Reestruturação Admin)
  const [modalEditarCandidatoAdminAberto, setModalEditarCandidatoAdminAberto] = useState(false);
  const [candidatoEditandoAdmin, setCandidatoEditandoAdmin] = useState<Candidato | null>(null);
  const [modalGerenciarDropdownsAberto, setModalGerenciarDropdownsAberto] = useState(false);
  const [modalAdicionarCandidatoAdminAberto, setModalAdicionarCandidatoAdminAberto] = useState(false);

  const handleSalvarCandidatoAdmin = (candidatoAtualizado: Candidato) => {
    lotesStore.salvarCandidato(concurso.id, cargo.id, candidatoAtualizado);
    const atualizados = lotesStore.getCandidatos(concurso.id, cargo.id);
    setCandidatos(atualizados);
    void classificationCache.set(concurso.id, cargo.id, atualizados);
    setModalEditarCandidatoAdminAberto(false);
    setCandidatoEditandoAdmin(null);
    showToast(`Candidato "${candidatoAtualizado.nome}" atualizado com sucesso!`);
  };

  const handleAdicionarCandidatoAdmin = (novo: Candidato) => {
    lotesStore.salvarCandidato(concurso.id, cargo.id, novo);
    const atualizados = lotesStore.getCandidatos(concurso.id, cargo.id);
    setCandidatos(atualizados);
    void classificationCache.set(concurso.id, cargo.id, atualizados);
    setModalAdicionarCandidatoAdminAberto(false);
    showToast(`Candidato "${novo.nome}" adicionado com sucesso!`);
  };

  const handleExcluirCandidato = (cand: Candidato) => {
    if (window.confirm(`Deseja realmente excluir o candidato "${cand.nome}" (Posição ${cand.posicao}º)?`)) {
      lotesStore.removerCandidato(concurso.id, cargo.id, cand.id);
      const atualizados = lotesStore.getCandidatos(concurso.id, cargo.id);
      setCandidatos(atualizados);
      void classificationCache.set(concurso.id, cargo.id, atualizados);
      showToast(`Candidato "${cand.nome}" removido da lista.`);
    }
  };

  // Candidato logado vinculado nesta lista (se houver)
  const meuCandidato = useMemo(() => {
    if (!usuario) return null;
    const cpfUsuarioLimpo = usuario.cpf ? usuario.cpf.replace(/\D/g, '') : '';
    const emailUsuarioLimpo = usuario.email ? usuario.email.trim().toLowerCase() : '';
    const nomeUsuarioNorm = usuario.nome && usuario.nome.trim().length >= 3 ? normalizarTexto(usuario.nome) : '';

    return (
      candidatos.find((c) => {
        if (usuario.candidato_id && c.id && c.id === usuario.candidato_id) return true;
        if (cpfUsuarioLimpo.length >= 6 && c.cpf) {
          const cpfCandLimpo = c.cpf.replace(/\D/g, '');
          if (cpfCandLimpo.length >= 6 && cpfCandLimpo === cpfUsuarioLimpo) return true;
        }
        if (emailUsuarioLimpo && c.email && c.email.trim().toLowerCase() === emailUsuarioLimpo) {
          return true;
        }
        if (nomeUsuarioNorm && c.nome && normalizarTexto(c.nome) === nomeUsuarioNorm) {
          return true;
        }
        return false;
      }) || null
    );
  }, [candidatos, usuario]);

  // -------------------------------------------------------------
  // REGRA DE IDENTIFICAÇÃO DE APROVADO HOMOLOGADO
  // -------------------------------------------------------------
  const isAprovadoComoCandidato = useMemo(() => {
    return Boolean(meuCandidato);
  }, [meuCandidato]);

  const isCandidatoAprovado = useMemo(() => {
    if (isAdmin) return true;
    return isAprovadoComoCandidato;
  }, [isAdmin, isAprovadoComoCandidato]);

  // Se o concurso está homologado e o usuário NÃO é aprovado, restringe o chat
  const isChatRestrito = useMemo(() => {
    const estáHomologado = concurso.homologado || concurso.status === 'Homologado';
    if (!estáHomologado) return false;
    return !isCandidatoAprovado;
  }, [concurso, isCandidatoAprovado]);

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

  // Item 12: Ao trocar de cargo ou concurso, retornar automaticamente para a página 1 da lista
  useEffect(() => {
    setPaginaAtual(1);
  }, [concurso.id, cargo.id]);

  const candidatosFiltrados = useMemo(() => {
    return candidatos.filter((c) => {
      const matchBusca =
        !filtroBusca.trim() ||
        matchFonético(c.nome, filtroBusca) ||
        c.posicao.toString() === filtroBusca.trim() ||
        (c.comarca_desejada_1 && matchFonético(c.comarca_desejada_1, filtroBusca)) ||
        (c.comarca_definitiva && matchFonético(c.comarca_definitiva, filtroBusca));

      const cotasDoCand = c.cotas && c.cotas.length > 0 ? c.cotas : [c.cota];
      const matchCota =
        filtroCota === 'todas' ||
        (filtroCota === 'PPP'
          ? cotasDoCand.some((ct) => ct === 'PPP' || (ct as string) === 'CN') ||
            c.cota === 'PPP' ||
            (c.cota as string) === 'CN'
          : cotasDoCand.includes(filtroCota as any) || c.cota === filtroCota);
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

  // Sub-aba na Lista de Classificação
  const [subAbaClassificacao, setSubAbaClassificacao] = useState<'geral' | 'ordem_nomeacao'>('geral');
  const [configCotas, setConfigCotas] = useState<ConfigCotas>({
    ampla: 60,
    ppp: 20,
    pcd: 10,
    indigena: 5,
    trans: 5,
  });
  const [painelCotasAberto, setPainelCotasAberto] = useState(false);

  // Modal para Candidato escolher comarcas dentro do Lote específico
  const [loteSelecionadoParaEscolha, setLoteSelecionadoParaEscolha] = useState<Lote | null>(null);
  const [modalEscolhaComarcasAberto, setModalEscolhaComarcasAberto] = useState(false);

  // Simulador Inteligente de Posição Efetiva de Chamamento (Plano 5)
  const [vagasSimuladasChamamento, setVagasSimuladasChamamento] = useState<number>(
    cargo.vagas_previstas_proximo_lote && cargo.vagas_previstas_proximo_lote > 0
      ? cargo.vagas_previstas_proximo_lote
      : 15
  );

  // Cálculo da Ordem de Nomeação (puxa lotes oficiais garantidos + projeta cotas para os demais)
  const listaOrdemNomeacao = useMemo(() => {
    const lotesDesteCargo = lotes.filter(
      (l) => l.concurso_id === concurso.id && (l.cargo_id === cargo.id || !l.cargo_id || l.concurso_id === 'tjrs_2025')
    );
    return calcularOrdemNomeacao(
      candidatos,
      lotesDesteCargo,
      configCotas,
      vagasSimuladasChamamento || cargo.vagas_previstas_proximo_lote || 0
    );
  }, [candidatos, lotes, concurso.id, cargo.id, configCotas, cargo.vagas_previstas_proximo_lote, vagasSimuladasChamamento]);

  // Mapa de Posição Efetiva Líquida descontando Nomeados, Convocados Titulares, Desistentes e Fim de Fila
  const simulacaoFilaEfetiva = useMemo(() => {
    const candById = new Map<string, Candidato>();
    candidatos.forEach((c) => candById.set(c.id, c));

    let jaConvocadosNomeados = 0;
    let desistentesOuFimDeFila = 0;
    let contadorFilaLiquida = 0;

    const posEfetivaPorCandidatoId = new Map<
      string,
      {
        posicaoEfetiva: number | null;
        contempladoSimulacao: boolean;
        motivoForaDaFila?: 'convocado' | 'desistente' | 'fim_fila';
        vagaCotaSimulada?: string;
      }
    >();

    // Percorre na ordem legal de chamamento (alternância de cotas)
    for (const item of listaOrdemNomeacao) {
      const cand = candById.get(item.candidatoId);
      const status: string = item.status || cand?.status || '';
      const intencao: string = cand?.intencao || 'Sim';

      const isJaChamado =
        item.garantido ||
        status === 'Nomeado' ||
        status === 'Convocado titular' ||
        status === 'Convocado Titular' ||
        status === 'Posse' ||
        status === 'Exercício';

      const isDesistente =
        status === 'Desistente' || status === 'Desistência' || intencao === 'Não';

      const isFimFila =
        status === 'Final de lista' || status === 'Fim de Fila' || intencao === 'final_fila';

      if (isJaChamado) {
        jaConvocadosNomeados++;
        posEfetivaPorCandidatoId.set(item.candidatoId, {
          posicaoEfetiva: null,
          contempladoSimulacao: false,
          motivoForaDaFila: 'convocado',
          vagaCotaSimulada: item.vagaAtribuida,
        });
      } else if (isDesistente) {
        desistentesOuFimDeFila++;
        posEfetivaPorCandidatoId.set(item.candidatoId, {
          posicaoEfetiva: null,
          contempladoSimulacao: false,
          motivoForaDaFila: 'desistente',
          vagaCotaSimulada: item.vagaAtribuida,
        });
      } else if (isFimFila) {
        desistentesOuFimDeFila++;
        posEfetivaPorCandidatoId.set(item.candidatoId, {
          posicaoEfetiva: null,
          contempladoSimulacao: false,
          motivoForaDaFila: 'fim_fila',
          vagaCotaSimulada: item.vagaAtribuida,
        });
      } else {
        contadorFilaLiquida++;
        posEfetivaPorCandidatoId.set(item.candidatoId, {
          posicaoEfetiva: contadorFilaLiquida,
          contempladoSimulacao: contadorFilaLiquida <= vagasSimuladasChamamento,
          vagaCotaSimulada: item.vagaAtribuida,
        });
      }
    }

    return {
      jaConvocadosNomeados,
      desistentesOuFimDeFila,
      totalFilaLiquida: contadorFilaLiquida,
      posEfetivaPorCandidatoId,
    };
  }, [candidatos, listaOrdemNomeacao, vagasSimuladasChamamento]);

  // Plano 4 — Adequação à LGPD: Mascaramento de CPF de terceiros para não-administradores
  const formatarCpfSeguroLgpd = (cpfRaw?: string, candId?: string): string => {
    if (!cpfRaw) return '';
    if (isAdmin || (meuCandidato && candId && meuCandidato.id === candId)) {
      return cpfRaw;
    }
    const digitos = cpfRaw.replace(/\D/g, '');
    if (digitos.length === 11) {
      return `***.${digitos.slice(3, 6)}.${digitos.slice(6, 9)}-**`;
    }
    if (digitos.length >= 6) {
      return `***.${digitos.slice(0, 3)}.${digitos.slice(3, 6)}-**`;
    }
    return '***.***.***-**';
  };

  const ordemNomeacaoFiltrada = useMemo(() => {
    return listaOrdemNomeacao.filter((item) => {
      const matchBusca =
        !filtroBusca.trim() ||
        item.nome.toLowerCase().includes(filtroBusca.toLowerCase()) ||
        item.ordem.toString() === filtroBusca.trim() ||
        item.posicaoOriginal.toString() === filtroBusca.trim();

      const matchCota =
        filtroCota === 'todas' ||
        item.cotaCandidato === filtroCota ||
        item.vagaAtribuida === filtroCota;

      const matchStatus = filtroStatus === 'todos' || item.status === filtroStatus;

      return matchBusca && matchCota && matchStatus;
    });
  }, [listaOrdemNomeacao, filtroBusca, filtroCota, filtroStatus]);

  const totalPaginasOrdem = useMemo(() => {
    if (itensPorPagina === 'todos') return 1;
    return Math.ceil(ordemNomeacaoFiltrada.length / (itensPorPagina as number)) || 1;
  }, [ordemNomeacaoFiltrada, itensPorPagina]);

  const ordemNomeacaoPaginada = useMemo(() => {
    if (itensPorPagina === 'todos') return ordemNomeacaoFiltrada;
    const start = (paginaAtual - 1) * (itensPorPagina as number);
    return ordemNomeacaoFiltrada.slice(start, start + (itensPorPagina as number));
  }, [ordemNomeacaoFiltrada, paginaAtual, itensPorPagina]);

  // Helper de renderização do status padronizado
  const renderBadgeStatus = (status?: string) => {
    switch (status) {
      case 'Nomeado':
        return (
          <span className="inline-flex items-center whitespace-nowrap gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-teal-100 text-teal-900 border border-teal-300 font-mono">
            Nomeado
          </span>
        );
      case 'Convocado titular':
      case 'Convocado Titular':
        return (
          <span className="inline-flex items-center whitespace-nowrap gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
            Convocado titular
          </span>
        );
      case 'Convocado suplente':
        return (
          <span className="inline-flex items-center whitespace-nowrap gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-50 text-cyan-800 border border-cyan-200">
            Convocado suplente
          </span>
        );
      case 'Próximo (previsão)':
        return (
          <span className="inline-flex items-center whitespace-nowrap gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-200">
            Próximo (previsão)
          </span>
        );
      case 'Final de lista':
      case 'Fim de Fila':
        return (
          <span className="inline-flex items-center whitespace-nowrap gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
            Final de lista
          </span>
        );
      case 'Desistente':
      case 'Desistência':
        return (
          <span className="inline-flex items-center whitespace-nowrap gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
            Desistente
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center whitespace-nowrap gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
            {status || 'Aguardando'}
          </span>
        );
    }
  };

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
      showToast('Apenas candidatos da lista homologada podem definir escolhas de lotação.', 'erro');
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
    showToast('Preferências de lotação salvas com sucesso!', 'sucesso');
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
      {/* Botão de Voltar para a Visão Geral do Concurso */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onVoltar || (() => onNavigate('concurso_geral', { concursoId: concurso.id }))}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 font-semibold text-xs border border-slate-200 shadow-xs cursor-pointer transition-all"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Voltar para o Concurso Geral</span>
        </button>

        <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-xs font-mono text-slate-700 shadow-2xs">
          <span className="font-bold text-[#0C2640]">CERTAM</span>
          <span className="text-slate-400">•</span>
          <span className="font-semibold text-teal-800">{concurso.orgao}</span>
          <span className="text-slate-400">•</span>
          <span className="text-slate-600">{cargo.nome}</span>
        </div>
      </div>

      {/* Toast Feedback (Item 4: XCircle para erro e CheckCircle2 para sucesso) */}
      {toastData && (
        <div
          className={`fixed bottom-6 right-6 z-[200] px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-fade-in ${
            toastData.tipo === 'erro'
              ? 'bg-[#21090f] text-rose-200 border border-rose-500/70'
              : 'bg-[#07192B] text-white border border-[#2DD4AA]'
          }`}
        >
          {toastData.tipo === 'erro' ? (
            <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-[#2DD4AA] shrink-0" />
          )}
          <span className="text-xs sm:text-sm font-semibold">{toastData.msg}</span>
        </div>
      )}

      {/* TOP BANNER INSTITUCIONAL DO CONCURSO & SELETOR DE CARGO (Item 14: Cabeçalho sempre visível e compacto) */}
      <div className="sticky top-0 z-20 bg-[#07192B]/95 backdrop-blur-md text-white rounded-2xl border border-[#0F2942] p-3.5 sm:p-4 card-shadow flex flex-col md:flex-row md:items-center justify-between gap-3 transition-all">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2 py-0.5 rounded-md bg-[#2DD4AA]/20 text-[#2DD4AA] text-[11px] font-bold font-mono uppercase">
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

            {/* Subtipo de Lotação configurado */}
            <span className="text-2xs text-teal-300/80 font-mono">
              • {tipoLotacao}s
            </span>
          </div>

          <h1 className="text-lg sm:text-xl font-bold font-serif text-white truncate max-w-xl">
            {concurso.nome}
          </h1>

          {/* Seletor de Cargos do Concurso */}
          <div className="flex items-center gap-1.5 overflow-x-auto pt-0.5">
            <span className="text-2xs text-slate-400 font-semibold uppercase mr-1">Cargos:</span>
            {concurso.cargos?.map((cg) => {
              const isSelected = cg.id === cargo.id;
              return (
                <button
                  key={cg.id}
                  type="button"
                  onClick={() => onNavigate('concurso', { concursoId: concurso.id, cargoId: cg.id, tab: abaAtiva })}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
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

        {/* Ações e Atalhos Administrativos e do Candidato (Item 1 & Item 6) */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* Botão de Acompanhar Concurso (Item 1) */}
          {usuario && (
            <button
              type="button"
              onClick={() => {
                if (usuario.concursos_acompanhados?.includes(concurso.id)) {
                  desacompanharConcurso(concurso.id);
                  showToast(`Você deixou de acompanhar ${concurso.nome}.`, 'sucesso');
                } else {
                  acompanharConcurso(concurso.id);
                  showToast(`Agora você está acompanhando ${concurso.nome}!`, 'sucesso');
                }
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                usuario.concursos_acompanhados?.includes(concurso.id)
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-rose-500/30'
                  : 'bg-teal-500/20 text-teal-300 border-teal-500/40 hover:bg-teal-500/30'
              }`}
              title={
                usuario.concursos_acompanhados?.includes(concurso.id)
                  ? 'Deixar de acompanhar este concurso'
                  : 'Acompanhar este concurso no portal'
              }
            >
              <BookmarkCheck className="w-3.5 h-3.5" />
              <span>
                {usuario.concursos_acompanhados?.includes(concurso.id)
                  ? 'Acompanhando'
                  : 'Acompanhar Concurso'}
              </span>
            </button>
          )}

          {podeEditarEsteConcurso && (
            <button
              type="button"
              onClick={() => setModalEditarConcursoAberto(true)}
              className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-slate-200 font-bold px-3 py-1.5 rounded-xl text-xs shadow-xs transition-all cursor-pointer border border-white/10"
              title="Editar dados gerais do concurso"
            >
              <Pencil className="w-3.5 h-3.5 text-teal-300" />
              <span>Editar Concurso</span>
            </button>
          )}

          {podeEditarEsteCargo && (
            <button
              type="button"
              onClick={() => setModalEditarCargoAberto(true)}
              className="flex items-center gap-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold px-3 py-1.5 rounded-xl text-xs shadow-xs transition-all cursor-pointer"
              title="Editar dados deste cargo (vagas, escolaridade, etc.)"
            >
              <Pencil className="w-3.5 h-3.5 text-slate-950" />
              <span>Editar Cargo</span>
            </button>
          )}
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
            onClick={() => setAbaAtiva('lotes')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              abaAtiva === 'lotes'
                ? 'bg-[#0C2640] text-[#2DD4AA]'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Lotes de Convocação</span>
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
          <div className="grid gap-4 sm:gap-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
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
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">Vagas Disponíveis no Quadro</span>
                {cargo.data_atualizacao_vagas && (
                  <span className="text-[10px] text-slate-400 font-mono" title="Data da última alteração">
                    {cargo.data_atualizacao_vagas}
                  </span>
                )}
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-amber-900 font-mono">
                  {cargo.vagas_disponiveis !== undefined
                    ? cargo.vagas_disponiveis
                    : cargo.vagas_reais_abertas !== undefined
                    ? cargo.vagas_reais_abertas
                    : '-'}
                </span>
                <span className="text-xs text-amber-700 font-semibold">disponíveis</span>
              </div>
              <span className="text-xs text-slate-400 mt-1">
                {cargo.vagas_previstas_proximo_lote !== undefined
                  ? `Próx. lote: ${cargo.vagas_previstas_proximo_lote} vagas${cargo.data_prevista_proximo_lote ? ` (${cargo.data_prevista_proximo_lote})` : ''}`
                  : 'Total existente para provimento'}
              </span>
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
          <LinhaDoTempoConcurso
            concurso={concurso}
            cargoId={cargo.id}
            cargoNome={cargo.nome}
            onAtualizado={reloadData}
          />
        </section>
      )}

      {/* =================================================================== */}
      {/* ABA 3: LISTA DE CLASSIFICAÇÃO COM PROTEÇÃO DE DADOS                 */}
      {/* =================================================================== */}
      {/* =================================================================== */}
      {/* ABA 3: LISTA DE CLASSIFICAÇÃO COM SUB-ABAS E ORDEM DE NOMEAÇÃO       */}
      {/* =================================================================== */}
      {abaAtiva === 'classificacao' && (
        <section className="space-y-5">
          {/* SELETOR DE SUB-ABAS DA CLASSIFICAÇÃO */}
          <div className="bg-white rounded-2xl border border-slate-200 p-2 card-shadow flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 overflow-x-auto">
              <button
                type="button"
                onClick={() => {
                  setSubAbaClassificacao('geral');
                  setPaginaAtual(1);
                }}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  subAbaClassificacao === 'geral'
                    ? 'bg-[#07192B] text-[#2DD4AA] shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <ListOrdered className="w-4 h-4" />
                <span>Classificação Geral por Nota</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSubAbaClassificacao('ordem_nomeacao');
                  setPaginaAtual(1);
                }}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  subAbaClassificacao === 'ordem_nomeacao'
                    ? 'bg-[#07192B] text-[#2DD4AA] shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Sliders className="w-4 h-4" />
                <span>Ordem de Nomeação (Previsão com Cotas)</span>
              </button>
            </div>

            {subAbaClassificacao === 'ordem_nomeacao' && (
              <button
                type="button"
                onClick={() => setPainelCotasAberto((v) => !v)}
                className="px-3 py-1.5 rounded-xl border border-teal-200 bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Percent className="w-3.5 h-3.5 text-teal-700" />
                <span>{painelCotasAberto ? 'Fechar Configuração de Cotas' : 'Ajustar Porcentagens de Cotas'}</span>
              </button>
            )}
          </div>

          {/* PAINEL DE CONFIGURAÇÃO DE COTAS (QUANDO EM ORDEM DE NOMEAÇÃO) */}
          {subAbaClassificacao === 'ordem_nomeacao' && (
            <div className="space-y-4">
              {/* AVISO LEGAL ESPECULATIVO */}
              <div className="p-4 bg-amber-50/70 border border-amber-200/90 rounded-2xl text-amber-900 text-xs space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-amber-950">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Aviso Importante: Projeção Especulativa de Convocação</span>
                </div>
                <p className="text-amber-800 leading-relaxed text-[11px]">
                  A ordem de nomeação é <strong>meramente especulativa</strong> e tem como objetivo orientar a expectativa dos candidatos.
                  As convocações já formalizadas em <strong>lotes oficiais</strong> pelo órgão público ({concurso.orgao}) têm <strong>ordem garantida e fixada</strong>, enquanto as posições dos demais candidatos são calculadas por projeção estatística segundo o critério de alternância de cotas.
                </p>
              </div>

              {painelCotasAberto && (
                <div className="p-4 bg-white rounded-2xl border border-slate-200 card-shadow space-y-3 animate-in fade-in-50">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-teal-600" />
                      <span>Configurar Percentuais de Reserva de Vagas (Cotas)</span>
                    </span>
                    <span className="text-2xs text-slate-400">Total deve somar 100%</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                    <div>
                      <label className="block text-2xs font-bold text-slate-600 mb-1">
                        Ampla Concorrência (%):
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={configCotas.ampla}
                        onChange={(e) =>
                          setConfigCotas((prev) => ({ ...prev, ampla: Number(e.target.value) || 0 }))
                        }
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900"
                      />
                    </div>

                    <div>
                      <label className="block text-2xs font-bold text-amber-800 mb-1">
                        Negros - PPP / CN (%):
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={configCotas.ppp}
                        onChange={(e) =>
                          setConfigCotas((prev) => ({ ...prev, ppp: Number(e.target.value) || 0 }))
                        }
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold text-amber-900"
                      />
                    </div>

                    <div>
                      <label className="block text-2xs font-bold text-purple-800 mb-1">
                        Deficiência - PCD (%):
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={configCotas.pcd}
                        onChange={(e) =>
                          setConfigCotas((prev) => ({ ...prev, pcd: Number(e.target.value) || 0 }))
                        }
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold text-purple-900"
                      />
                    </div>

                    <div>
                      <label className="block text-2xs font-bold text-emerald-800 mb-1">
                        Povos Indígenas (%):
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={configCotas.indigena ?? 5}
                        onChange={(e) =>
                          setConfigCotas((prev) => ({ ...prev, indigena: Number(e.target.value) || 0 }))
                        }
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold text-emerald-900"
                      />
                    </div>

                    <div>
                      <label className="block text-2xs font-bold text-pink-800 mb-1">
                        Pessoas Trans (%):
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={configCotas.trans ?? 5}
                        onChange={(e) =>
                          setConfigCotas((prev) => ({ ...prev, trans: Number(e.target.value) || 0 }))
                        }
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold text-pink-900"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Banner de Aviso de Privacidade e Solicitação de Validação */}
          <div className="bg-white rounded-2xl border border-slate-200 p-3.5 sm:p-4 card-shadow flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-200 text-teal-800 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-4 h-4 text-teal-600" />
              </div>
              <div>
                <h3 className="font-bold text-xs text-slate-900">
                  {isCandidatoAprovado
                    ? 'Visualização Completa Liberada para Candidatos Homologados'
                    : 'Visualização Pública de Classificação (Posição e Nome)'}
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {isCandidatoAprovado
                    ? 'Acesso a lotes de convocação, datas de nomeação, comarcas definitivas e notas detalhadas.'
                    : 'Para visualizar notas detalhadas e preferências completas, identifique-se como aprovado.'}
                </p>
              </div>
            </div>

            {!isCandidatoAprovado && (
              <button
                type="button"
                onClick={() => setModalValidacaoAberto(true)}
                className="px-3 py-1.5 bg-[#07192B] hover:bg-[#0C2640] text-[#2DD4AA] font-bold text-xs rounded-xl transition-all cursor-pointer shadow-xs whitespace-nowrap shrink-0 flex items-center gap-1.5"
              >
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Não fui identificado? Solicitar ao Admin</span>
              </button>
            )}
          </div>

          {/* PLANO 5: SIMULADOR INTELIGENTE DE POSIÇÃO REAL DE CHAMAMENTO */}
          <div className="bg-gradient-to-r from-[#07192B] to-[#0C2640] text-white rounded-2xl p-4 sm:p-5 card-shadow border border-[#135A7A]/60 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#2DD4AA]/15 border border-[#2DD4AA]/40 text-[#2DD4AA] text-[10px] font-mono font-bold uppercase">
                  <Sparkles className="w-3 h-3" />
                  <span>Simulador Inteligente de Fila Líquida & Chamamento</span>
                </div>
                <h3 className="text-sm sm:text-base font-bold font-serif text-white">
                  Projeção Dinâmica de Posição Real (Descontando Nomeados, Desistências e Alternância de Cotas)
                </h3>
                <p className="text-2xs text-slate-300 leading-relaxed max-w-3xl">
                  Calcula automaticamente a posição real de espera de cada aprovado descontando os candidatos já convocados/nomeados ({simulacaoFilaEfetiva.jaConvocadosNomeados}) e os que declararam desistência ou fim de fila ({simulacaoFilaEfetiva.desistentesOuFimDeFila}).
                </p>
              </div>

              {/* Controle Interativo de Vagas Simuladas */}
              <div className="bg-white/10 backdrop-blur-xs border border-white/15 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center gap-3 shrink-0">
                <div>
                  <label className="block text-[10px] font-mono uppercase text-teal-300 font-bold">
                    Simular Próximo Chamamento:
                  </label>
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="range"
                      min={1}
                      max={Math.max(100, simulacaoFilaEfetiva.totalFilaLiquida || 100)}
                      value={vagasSimuladasChamamento}
                      onChange={(e) => setVagasSimuladasChamamento(Math.max(1, Number(e.target.value) || 1))}
                      className="w-28 sm:w-36 accent-[#2DD4AA] cursor-pointer"
                    />
                    <input
                      type="number"
                      min={1}
                      max={5000}
                      value={vagasSimuladasChamamento}
                      onChange={(e) => setVagasSimuladasChamamento(Math.max(1, Number(e.target.value) || 1))}
                      className="w-16 px-2 py-1 rounded-lg bg-[#07192B] border border-teal-400/50 text-[#2DD4AA] font-mono font-bold text-xs text-center"
                    />
                    <span className="text-xs font-bold text-white">novas vagas</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Resumo de KPIs da Fila Efetiva + Posição do Candidato Logado */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
              <div className="bg-white/5 border border-white/10 rounded-xl p-2.5">
                <span className="text-[10px] font-mono uppercase text-slate-300 block">Já Convocados / Nomeados</span>
                <strong className="text-base font-mono font-bold text-teal-300">
                  {simulacaoFilaEfetiva.jaConvocadosNomeados}
                </strong>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-2.5">
                <span className="text-[10px] font-mono uppercase text-slate-300 block">Desistências / Fim de Fila</span>
                <strong className="text-base font-mono font-bold text-amber-300">
                  {simulacaoFilaEfetiva.desistentesOuFimDeFila}
                </strong>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-2.5">
                <span className="text-[10px] font-mono uppercase text-slate-300 block">Aguardando na Fila Real</span>
                <strong className="text-base font-mono font-bold text-white">
                  {simulacaoFilaEfetiva.totalFilaLiquida}
                </strong>
              </div>
              <div className="bg-[#2DD4AA]/15 border border-[#2DD4AA]/40 rounded-xl p-2.5">
                <span className="text-[10px] font-mono uppercase text-[#2DD4AA] font-bold block">
                  Sua Posição Efetiva na Fila
                </span>
                {meuCandidato ? (
                  (() => {
                    const minhaSim = simulacaoFilaEfetiva.posEfetivaPorCandidatoId.get(meuCandidato.id);
                    if (minhaSim?.motivoForaDaFila === 'convocado') {
                      return (
                        <strong className="text-xs font-mono font-bold text-emerald-300 block mt-0.5">
                          ✓ Já Convocado / Nomeado ({meuCandidato.posicao}º oficial)
                        </strong>
                      );
                    }
                    if (minhaSim?.posicaoEfetiva) {
                      return (
                        <div className="flex items-center justify-between gap-1 mt-0.5">
                          <strong className="text-sm font-mono font-bold text-white">
                            {minhaSim.posicaoEfetiva}º na fila real
                          </strong>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold ${
                              minhaSim.contempladoSimulacao
                                ? 'bg-emerald-400 text-slate-950'
                                : 'bg-white/15 text-slate-200'
                            }`}
                          >
                            {minhaSim.contempladoSimulacao
                              ? `ENTRA NAS +${vagasSimuladasChamamento}`
                              : `Faltam ${minhaSim.posicaoEfetiva - vagasSimuladasChamamento}`}
                          </span>
                        </div>
                      );
                    }
                    return (
                      <strong className="text-xs font-mono text-amber-200 block mt-0.5">
                        {meuCandidato.posicao}º oficial (Fora da fila ativa)
                      </strong>
                    );
                  })()
                ) : (
                  <span className="text-[11px] text-slate-300 block mt-0.5">
                    Vincule seu CPF para ver sua projeção
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Filtros da Tabela */}
          <div className="bg-white rounded-2xl border border-slate-200 p-3.5 sm:p-4 card-shadow space-y-3">
            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Pesquisar por nome ou posição..."
                  value={filtroBusca}
                  onChange={(e) => {
                    setFiltroBusca(e.target.value);
                    setPaginaAtual(1);
                  }}
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-teal-600 outline-hidden"
                />
              </div>

              <select
                value={filtroCota}
                onChange={(e) => {
                  setFiltroCota(e.target.value);
                  setPaginaAtual(1);
                }}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white outline-hidden"
              >
                <option value="todas">Todas as Cotas</option>
                <option value="Ampla">Ampla Concorrência</option>
                <option value="PPP">Pessoas Negras (PPP / CN)</option>
                <option value="PCD">Pessoas com Deficiência (PCD)</option>
                <option value="Indígena">Povos Indígenas</option>
                <option value="Trans">Pessoas Trans</option>
              </select>

              <select
                value={filtroIntencao}
                onChange={(e) => {
                  setFiltroIntencao(e.target.value);
                  setPaginaAtual(1);
                }}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white outline-hidden"
              >
                <option value="todas">Todas as Intenções</option>
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
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white outline-hidden"
              >
                <option value="todos">Todos os Status</option>
                <option value="Próximo (previsão)">Próximo (previsão)</option>
                <option value="Convocado titular">Convocado titular</option>
                <option value="Convocado suplente">Convocado suplente</option>
                <option value="Nomeado">Nomeado</option>
                <option value="Final de lista">Final de lista</option>
                <option value="Desistente">Desistente</option>
              </select>
            </div>
          </div>

          {/* Item 13: Barra de Paginação Dupla (Topo e Rodapé) com seletor de itens e opção "Todos" */}
          {(() => {
            const renderBarraPaginacao = (
              pagina: number,
              totalPags: number,
              totalRegistros: number,
              onMudarPagina: (nova: number) => void
            ) => (
              <div className="p-3 bg-slate-50 border-b border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="text-slate-600 font-medium">
                    Página <strong className="text-slate-900">{pagina}</strong> de{' '}
                    <strong className="text-slate-900">{totalPags}</strong> | Total:{' '}
                    <strong className="text-slate-900">{totalRegistros}</strong> registros
                  </div>

                  <div className="flex items-center gap-1 text-xs text-slate-600">
                    <span className="text-[10px] font-bold text-slate-400 uppercase mr-0.5">Exibir:</span>
                    {([25, 50, 100, 'todos'] as const).map((qtd) => (
                      <button
                        key={qtd}
                        type="button"
                        onClick={() => {
                          setItensPorPagina(qtd);
                          setPaginaAtual(1);
                        }}
                        className={`px-2 py-0.5 rounded-md font-mono text-[11px] font-bold transition-colors cursor-pointer ${
                          itensPorPagina === qtd
                            ? 'bg-[#0C2640] text-[#2DD4AA]'
                            : 'bg-white hover:bg-slate-200 text-slate-700 border border-slate-200'
                        }`}
                      >
                        {qtd === 'todos' ? 'Todos' : qtd}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={pagina <= 1}
                    onClick={() => onMudarPagina(Math.max(1, pagina - 1))}
                    className="px-3 py-1 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg font-semibold disabled:opacity-40 cursor-pointer shadow-2xs"
                  >
                    ← Anterior
                  </button>
                  <button
                    type="button"
                    disabled={pagina >= totalPags}
                    onClick={() => onMudarPagina(Math.min(totalPags, pagina + 1))}
                    className="px-3 py-1 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg font-semibold disabled:opacity-40 cursor-pointer shadow-2xs"
                  >
                    Próxima →
                  </button>
                </div>
              </div>
            );

            return (
              <>
                {/* BARRA DE GESTÃO DE CLASSIFICAÇÃO PARA ADMIN (Exclusivo isDebugMode) */}
                {isAdmin && isDebugMode() && (
                  <div className="bg-amber-50/90 border border-amber-300 rounded-2xl p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3 shadow-xs">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold text-sm shadow-2xs">
                        👑
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                          <span>Gestão de Classificação (Modo Administrador)</span>
                          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-amber-200 text-amber-900 font-mono font-bold">Ativo</span>
                        </div>
                        <p className="text-2xs text-slate-600">
                          Edite manualmente qualquer campo de cada candidato, adicione novos ou configure as opções das listas suspensas.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => setModalAdicionarCandidatoAdminAberto(true)}
                        className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                        title="Adicionar novo candidato manualmente a esta lista"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>+ Adicionar Candidato</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setModalGerenciarDropdownsAberto(true)}
                        className="px-3 py-1.5 bg-white hover:bg-amber-100 text-slate-800 border border-amber-300 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                        title="Gerenciar opções de listas suspensas (Status, Cotas, Lotações)"
                      >
                        <Sliders className="w-3.5 h-3.5 text-amber-600" />
                        <span>Gerenciar Listas Suspensas</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* TABELA: CLASSIFICAÇÃO GERAL POR NOTA */}
                {subAbaClassificacao === 'geral' && (
                  <div className="bg-white rounded-2xl border border-slate-200 card-shadow overflow-hidden">
                    {/* Paginação Superior */}
                    {renderBarraPaginacao(
                      paginaAtual,
                      totalPaginas,
                      candidatosFiltrados.length,
                      (p) => setPaginaAtual(p)
                    )}

                    {/* Barra de rolagem superior sincronizada */}
                    <div
                      ref={topScrollRef1}
                      onScroll={() => {
                        if (topScrollRef1.current && bottomScrollRef1.current) {
                          bottomScrollRef1.current.scrollLeft = topScrollRef1.current.scrollLeft;
                        }
                      }}
                      className="overflow-x-auto h-3.5 bg-slate-100 border-b border-slate-200"
                    >
                      <div style={{ width: '1100px', height: '1px' }} />
                    </div>
                    <div
                      ref={bottomScrollRef1}
                      onScroll={() => {
                        if (topScrollRef1.current && bottomScrollRef1.current) {
                          topScrollRef1.current.scrollLeft = bottomScrollRef1.current.scrollLeft;
                        }
                      }}
                      className="overflow-x-auto"
                    >
                      <div className="grid grid-cols-[fit-content(70px)_minmax(200px,1fr)_fit-content(90px)_fit-content(90px)_fit-content(90px)_fit-content(110px)_minmax(140px,1fr)_minmax(160px,1fr)_fit-content(130px)_fit-content(80px)] min-w-[1100px] text-xs divide-y divide-slate-100">
                        {/* Header da Grid */}
                        <div className="bg-[#07192B] text-white font-serif text-[11px] uppercase tracking-wider py-2.5 px-3 col-span-10 grid grid-cols-subgrid items-center">
                          <div className="text-center font-semibold sticky left-0 z-20 bg-[#07192B]">Pos.</div>
                          <div className="font-semibold sticky left-[65px] sm:left-[75px] z-20 bg-[#07192B] shadow-[2px_0_5px_rgba(0,0,0,0.08)]">Candidato</div>
                          <div className="text-center font-semibold">Cota</div>
                          <div className="text-right font-semibold">Nota Final</div>
                          <div className="text-center font-semibold">Lote Convocado</div>
                          <div className="text-center font-semibold">Data Convocação</div>
                          <div className="font-semibold">{tipoLotacao} Definitiva</div>
                          <div className="font-semibold">Preferências Informadas</div>
                          <div className="text-center font-semibold">Status</div>
                          <div className="text-center font-semibold">Ações</div>
                        </div>

                        {candidatosPaginados.length === 0 ? (
                          <div className="col-span-10 py-10 text-center text-xs text-slate-400">
                            Nenhum candidato localizado com os filtros selecionados.
                          </div>
                        ) : (
                          candidatosPaginados.map((cand) => (
                            <div
                              key={cand.id}
                              className="col-span-10 grid grid-cols-subgrid items-center hover:bg-slate-50 transition-colors py-2.5 px-3 group"
                            >
                              <div className="text-center font-mono font-bold text-slate-900 sticky left-0 z-10 bg-white group-hover:bg-slate-50 transition-colors">
                                <div>{cand.posicao}º</div>
                                {(() => {
                                  const simInfo = simulacaoFilaEfetiva.posEfetivaPorCandidatoId.get(cand.id);
                                  if (!simInfo || !simInfo.posicaoEfetiva) return null;
                                  return (
                                    <span
                                      className={`inline-block px-1 py-0.2 rounded text-[9px] font-mono font-bold mt-0.5 ${
                                        simInfo.contempladoSimulacao
                                          ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                          : 'bg-slate-100 text-slate-600'
                                      }`}
                                      title="Posição efetiva na fila líquida (descontando nomeados, desistentes e aplicando alternância de cotas)"
                                    >
                                      Fila: {simInfo.posicaoEfetiva}º
                                    </span>
                                  );
                                })()}
                              </div>
                              <div className="font-bold text-slate-900 pr-2 sticky left-[65px] sm:left-[75px] z-10 bg-white group-hover:bg-slate-50 transition-colors shadow-[2px_0_5px_rgba(0,0,0,0.06)]">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span>{cand.nome}</span>
                                  {(() => {
                                    const infoVinc = userRegistryStore.verificarVinculoCandidato(cand);
                                    return infoVinc.vinculado ? (
                                      <span
                                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 whitespace-nowrap"
                                        title="Candidato já acessou e vinculou conta no portal"
                                      >
                                        <UserCheck className="w-2.5 h-2.5 text-emerald-700" />
                                        <span>Vinculado</span>
                                      </span>
                                    ) : null;
                                  })()}
                                  {(() => {
                                    const simInfo = simulacaoFilaEfetiva.posEfetivaPorCandidatoId.get(cand.id);
                                    if (!simInfo?.contempladoSimulacao) return null;
                                    return (
                                      <span
                                        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-teal-50 text-teal-800 border border-teal-300 whitespace-nowrap"
                                        title={`Contemplado na simulação de +${vagasSimuladasChamamento} vagas (${simInfo.vagaCotaSimulada || 'Ampla'})`}
                                      >
                                        <span>⚡ Simulado ({simInfo.posicaoEfetiva}º)</span>
                                      </span>
                                    );
                                  })()}
                                </div>
                                {isCandidatoAprovado && cand.cpf && (
                                  <span className="text-[10px] font-mono text-slate-400 block font-normal">
                                    CPF: {formatarCpfSeguroLgpd(cand.cpf, cand.id)}
                                  </span>
                                )}
                              </div>
                              <div className="text-center font-mono">
                                {isCandidatoAprovado ? (
                                  <div className="flex items-center justify-center gap-1 flex-wrap">
                                    {(() => {
                                      const listaCotas =
                                        cand.cotas && cand.cotas.length > 0
                                          ? cand.cotas.filter((ct, _, arr) =>
                                              arr.length > 1 ? ct !== 'Ampla' : true
                                            )
                                          : [cand.cota];
                                      return listaCotas.map((ct, idxCt) => (
                                        <span
                                          key={idxCt}
                                          className={`box-decoration-clone px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap ${
                                            ct === 'PCD'
                                              ? 'bg-purple-100 text-purple-900 border border-purple-200'
                                              : ct === 'PPP' || (ct as string) === 'CN'
                                              ? 'bg-amber-100 text-amber-900 border border-amber-200'
                                              : ct === 'Indígena'
                                              ? 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                                              : ct === 'Trans'
                                              ? 'bg-pink-100 text-pink-900 border border-pink-200'
                                              : 'bg-slate-100 text-slate-700'
                                          }`}
                                        >
                                          {ct === 'PPP' || (ct as string) === 'CN' ? 'PPP / CN' : ct}
                                        </span>
                                      ));
                                    })()}
                                  </div>
                                ) : (
                                  <span className="text-slate-400 text-2xs italic whitespace-nowrap">Restrito</span>
                                )}
                              </div>
                              <div className="text-right font-mono font-bold text-slate-900">
                                {isCandidatoAprovado ? (
                                  cand.nota_final.toFixed(2)
                                ) : (
                                  <span className="text-slate-400 font-normal text-2xs italic">Restrito</span>
                                )}
                              </div>
                              <div className="text-center">
                                {cand.numero_lote_convocado ? (
                                  <span className="box-decoration-clone px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-teal-50 text-teal-800 border border-teal-200 whitespace-nowrap">
                                    {cand.numero_lote_convocado}
                                  </span>
                                ) : (
                                  <span className="text-slate-400 font-mono">-</span>
                                )}
                              </div>
                              <div className="text-center font-mono text-slate-700 whitespace-nowrap">
                                {cand.data_convocacao || cand.data_nomeacao || '-'}
                              </div>
                              <div className="text-slate-700">
                                {cand.comarca_definitiva ? (
                                  <span className="box-decoration-clone inline-block font-semibold text-purple-950 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200 text-[11px]">
                                    {cand.comarca_definitiva}
                                  </span>
                                ) : (
                                  <span className="text-slate-400 font-mono text-[11px]">-</span>
                                )}
                              </div>
                              <div className="text-slate-700 pr-2">
                                {cand.escolhas_comarcas && cand.escolhas_comarcas.length > 0 ? (
                                  <span
                                    className="text-slate-700 text-[11px] truncate block"
                                    title={cand.escolhas_comarcas.map((e, idx) => `${idx + 1}ª: ${e}`).join(' | ')}
                                  >
                                    {cand.escolhas_comarcas[0]} {cand.escolhas_comarcas.length > 1 && `(+${cand.escolhas_comarcas.length - 1})`}
                                  </span>
                                ) : cand.comarca_desejada_1 ? (
                                  <span className="text-slate-600 text-[11px]">
                                    {cand.comarca_desejada_1}
                                  </span>
                                ) : (
                                  <span className="text-slate-400 text-2xs italic">Pendente</span>
                                )}
                              </div>
                              <div className="text-center">
                                {renderBadgeStatus(cand.status)}
                              </div>
                              <div className="text-center">
                                <div className="flex items-center justify-center gap-1">
                                  {isAdmin && isDebugMode() && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setCandidatoEditandoAdmin(cand);
                                          setModalEditarCandidatoAdminAberto(true);
                                        }}
                                        className="p-1 text-amber-700 hover:text-amber-950 bg-amber-50 hover:bg-amber-100 rounded border border-amber-300 cursor-pointer transition-colors shadow-2xs"
                                        title="Editar manualmente campos deste candidato (Admin)"
                                      >
                                        <Pencil className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleExcluirCandidato(cand)}
                                        className="p-1 text-rose-600 hover:text-rose-950 bg-rose-50 hover:bg-rose-100 rounded border border-rose-300 cursor-pointer transition-colors shadow-2xs"
                                        title="Excluir este candidato da lista (Admin)"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </>
                                  )}
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
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Paginação Inferior */}
                    {renderBarraPaginacao(
                      paginaAtual,
                      totalPaginas,
                      candidatosFiltrados.length,
                      (p) => setPaginaAtual(p)
                    )}
                  </div>
                )}

                {/* TABELA: ORDEM DE NOMEAÇÃO (PREVISÃO COM COTAS) */}
                {subAbaClassificacao === 'ordem_nomeacao' && (
                  <div className="bg-white rounded-2xl border border-slate-200 card-shadow overflow-hidden">
                    {/* Paginação Superior */}
                    {renderBarraPaginacao(
                      paginaAtual,
                      totalPaginasOrdem,
                      ordemNomeacaoFiltrada.length,
                      (p) => setPaginaAtual(p)
                    )}

                    {/* Barra de rolagem superior sincronizada */}
                    <div
                      ref={topScrollRef2}
                      onScroll={() => {
                        if (topScrollRef2.current && bottomScrollRef2.current) {
                          bottomScrollRef2.current.scrollLeft = topScrollRef2.current.scrollLeft;
                        }
                      }}
                      className="overflow-x-auto h-3.5 bg-slate-100 border-b border-slate-200"
                    >
                      <div style={{ width: '1100px', height: '1px' }} />
                    </div>
                    <div
                      ref={bottomScrollRef2}
                      onScroll={() => {
                        if (topScrollRef2.current && bottomScrollRef2.current) {
                          topScrollRef2.current.scrollLeft = topScrollRef2.current.scrollLeft;
                        }
                      }}
                      className="overflow-x-auto"
                    >
                      <div className="grid grid-cols-[fit-content(80px)_minmax(200px,1fr)_minmax(160px,1fr)_fit-content(110px)_fit-content(110px)_fit-content(90px)_fit-content(110px)_minmax(140px,1fr)_fit-content(130px)] min-w-[1100px] text-xs divide-y divide-slate-100">
                        {/* Header da Grid */}
                        <div className="bg-[#07192B] text-white font-serif text-[11px] uppercase tracking-wider py-2.5 px-3 col-span-9 grid grid-cols-subgrid items-center">
                          <div className="text-center font-semibold sticky left-0 z-20 bg-[#07192B]">Ordem</div>
                          <div className="font-semibold sticky left-[65px] sm:left-[75px] z-20 bg-[#07192B] shadow-[2px_0_5px_rgba(0,0,0,0.08)]">Candidato</div>
                          <div className="font-semibold">Garantia / Tipo</div>
                          <div className="text-center font-semibold">Cota do Candidato</div>
                          <div className="text-center font-semibold">Vaga Atribuída</div>
                          <div className="text-center font-semibold">Lote Convocado</div>
                          <div className="text-center font-semibold">Data Convocação</div>
                          <div className="font-semibold">{tipoLotacao} Definitiva</div>
                          <div className="text-center font-semibold">Status</div>
                        </div>

                        {ordemNomeacaoPaginada.length === 0 ? (
                          <div className="col-span-9 py-10 text-center text-xs text-slate-400">
                            Nenhum candidato localizado na simulação de ordem de nomeação.
                          </div>
                        ) : (
                          ordemNomeacaoPaginada.map((item) => (
                            <div
                              key={`${item.ordem}-${item.candidatoId}`}
                              className={`col-span-9 grid grid-cols-subgrid items-center transition-colors py-2.5 px-3 group ${
                                item.garantido
                                  ? 'bg-emerald-50/25 hover:bg-emerald-50/40 border-l-4 border-l-emerald-600'
                                  : 'hover:bg-slate-50'
                              }`}
                            >
                              <div className="text-center font-mono font-bold text-slate-900 sticky left-0 z-10 bg-white group-hover:bg-slate-50 transition-colors">
                                {item.ordem}º
                              </div>

                              <div className="font-bold text-slate-900 pr-2 sticky left-[65px] sm:left-[75px] z-10 bg-white group-hover:bg-slate-50 transition-colors shadow-[2px_0_5px_rgba(0,0,0,0.06)]">
                                <div>{item.nome}</div>
                                <span className="text-[10px] font-mono text-slate-400 font-normal">
                                  {item.posicaoOriginal}º lugar original
                                </span>
                              </div>

                              <div className="pr-2">
                                {item.garantido ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300 whitespace-nowrap">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-700 shrink-0" />
                                    <span>Ordem Garantida (Oficial)</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200 whitespace-nowrap">
                                    <Sparkles className="w-3 h-3 text-indigo-500 shrink-0" />
                                    <span>Previsão Especulativa</span>
                                  </span>
                                )}
                              </div>

                              <div className="text-center font-mono">
                                <span
                                  className={`box-decoration-clone px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap ${
                                    item.cotaCandidato === 'PCD'
                                      ? 'bg-purple-100 text-purple-900 border border-purple-200'
                                      : item.cotaCandidato === 'PPP' || item.cotaCandidato === 'CN'
                                      ? 'bg-amber-100 text-amber-900 border border-amber-200'
                                      : item.cotaCandidato === 'Indígena'
                                      ? 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                                      : item.cotaCandidato === 'Trans'
                                      ? 'bg-pink-100 text-pink-900 border border-pink-200'
                                      : 'bg-slate-100 text-slate-700'
                                  }`}
                                >
                                  {item.cotaCandidato === 'PPP' || item.cotaCandidato === 'CN' ? 'PPP / CN' : item.cotaCandidato}
                                </span>
                              </div>

                              <div className="text-center font-mono">
                                <span
                                  className={`box-decoration-clone px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap ${
                                    item.vagaAtribuida === 'PCD'
                                      ? 'bg-purple-100 text-purple-900 border border-purple-200'
                                      : item.vagaAtribuida === 'PPP'
                                      ? 'bg-amber-100 text-amber-900 border border-amber-200'
                                      : item.vagaAtribuida === 'Indígena'
                                      ? 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                                      : item.vagaAtribuida === 'Trans'
                                      ? 'bg-pink-100 text-pink-900 border border-pink-200'
                                      : 'bg-teal-50 text-teal-900 border border-teal-200'
                                  }`}
                                >
                                  Vaga {item.vagaAtribuida === 'PPP' ? 'PPP / CN' : item.vagaAtribuida}
                                </span>
                              </div>

                              <div className="text-center">
                                {item.loteNumero ? (
                                  <span className="box-decoration-clone px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-teal-50 text-teal-800 border border-teal-200 whitespace-nowrap">
                                    {item.loteNumero}
                                  </span>
                                ) : (
                                  <span className="text-slate-400 font-mono">-</span>
                                )}
                              </div>

                              <div className="text-center font-mono text-slate-700 whitespace-nowrap">
                                {item.dataConvocacao || item.dataNomeacao || '-'}
                              </div>

                              <div className="text-slate-700">
                                {item.comarcaDefinitiva ? (
                                  <span className="box-decoration-clone inline-block font-semibold text-purple-950 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200 text-[11px]">
                                    {item.comarcaDefinitiva}
                                  </span>
                                ) : (
                                  <span className="text-slate-400 font-mono">-</span>
                                )}
                              </div>

                              <div className="text-center">
                                {renderBadgeStatus(item.status)}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Paginação Inferior */}
                    {renderBarraPaginacao(
                      paginaAtual,
                      totalPaginasOrdem,
                      ordemNomeacaoFiltrada.length,
                      (p) => setPaginaAtual(p)
                    )}
                  </div>
                )}
              </>
            );
          })()}
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
      {/* ABA: LOTES DE CONVOCAÇÃO                                            */}
      {/* =================================================================== */}
      {abaAtiva === 'lotes' && (
        <section className="space-y-6">
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 card-shadow flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="px-3 py-1 rounded-lg bg-teal-50 text-teal-800 text-xs font-mono font-bold uppercase border border-teal-200">
                Lotes Oficiais &amp; Audiência de Escolha
              </span>
              <h2 className="text-xl sm:text-2xl font-bold font-serif text-slate-900 mt-2">
                Lotes de Convocação e Escolha de Comarcas
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl leading-relaxed">
                Acompanhe o cronograma de lotes de nomeação, número de vagas ofertadas por comarca e
                manifestações de preferência dos convocados homologados.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {podeEditarEsteLote && (
                <button
                  type="button"
                  onClick={() => {
                    setLoteEditando(null);
                    setModalEditarLoteAberto(true);
                  }}
                  className="px-4 py-2.5 bg-[#07192B] hover:bg-[#0C2640] text-[#2DD4AA] font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Plus className="w-4 h-4" />
                  <span>Novo Lote de Convocação</span>
                </button>
              )}
            </div>
          </div>

          {/* LISTA DOS LOTES DISPONÍVEIS */}
          <div className="space-y-4">
            {lotes
              .filter(
                (l) =>
                  l.concurso_id === concurso.id &&
                  (!l.cargo_id || l.cargo_id === cargo.id)
              )
              .sort((a, b) => {
                const numA = (a.numero_lote || a.nome || '').toString().replace(/[^\d.]/g, '');
                const numB = (b.numero_lote || b.nome || '').toString().replace(/[^\d.]/g, '');
                return numA.localeCompare(numB, undefined, { numeric: true, sensitivity: 'base' });
              })
              .map((lote) => {
                const totalVagas = lote.comarcas.reduce((acc, c) => acc + c.vagas, 0);

                // Convocados e contagem titulares / suplentes / preenchimento
                let totalTitulares = 0;
                let totalSuplentes = 0;
                let totalConvocados = 0;
                let preenchidos = 0;

                if (lote.convocados && lote.convocados.length > 0) {
                  totalConvocados = lote.convocados.length;
                  totalTitulares = lote.convocados.filter(c => (c.papel || '').toLowerCase().includes('titular')).length;
                  totalSuplentes = lote.convocados.filter(c => (c.papel || '').toLowerCase().includes('suplente')).length;
                  preenchidos = lote.convocados.filter(c => {
                    if (c.comarca_escolhida) return true;
                    const candObj = candidatos.find(cd => (c.candidato_id && cd.id === c.candidato_id) || cd.nome.toLowerCase() === c.nome.toLowerCase());
                    return Boolean(candObj && ((candObj.escolhas_comarcas && candObj.escolhas_comarcas.length > 0) || (candObj.intencao && candObj.intencao !== 'Indefinido') || candObj.comarca_definitiva));
                  }).length;
                } else if (lote.candidatos_ids && lote.candidatos_ids.length > 0) {
                  totalConvocados = lote.candidatos_ids.length;
                  totalTitulares = Math.min(totalConvocados, totalVagas);
                  totalSuplentes = Math.max(0, totalConvocados - totalTitulares);
                  preenchidos = candidatos.filter(c => 
                    lote.candidatos_ids.includes(c.id) &&
                    ((c.escolhas_comarcas && c.escolhas_comarcas.length > 0) ||
                     (c.intencao && c.intencao !== 'Indefinido') ||
                     Boolean(c.comarca_definitiva))
                  ).length;
                } else {
                  totalConvocados = 0;
                  totalTitulares = 0;
                  totalSuplentes = 0;
                  preenchidos = 0;
                }

                const faltamPreencher = Math.max(0, totalConvocados - preenchidos);
                const percentualPreenchido = totalConvocados > 0 ? Math.round((preenchidos / totalConvocados) * 100) : 0;
                const expandido = Boolean(lotesExpandidosComarcas[lote.id]);
                const expandidoConvocados = Boolean(lotesExpandidosConvocados[lote.id]);

                const getStatusLoteLabel = (st?: string) => {
                  switch (st) {
                    case 'criado':
                      return 'Aguardando Início';
                    case 'em_escolha':
                      return 'Em Escolha de Comarcas';
                    case 'escolhas_definidas':
                      return 'Escolhas Definidas';
                    case 'encerrado':
                      return 'Encerrado';
                    default:
                      return 'Em Andamento';
                  }
                };

                // Item 6: Verificar estritamente se o candidato logado está contemplado na lista configurada para este lote
                const estaContempladoComoCandidato = Boolean(
                  meuCandidato &&
                    ((lote.convocados &&
                      lote.convocados.length > 0 &&
                      lote.convocados.some(
                        (cv) =>
                          (cv.candidato_id && cv.candidato_id === meuCandidato.id) ||
                          normalizarTexto(cv.nome) === normalizarTexto(meuCandidato.nome)
                      )) ||
                      ((!lote.convocados || lote.convocados.length === 0) &&
                        lote.candidatos_ids &&
                        lote.candidatos_ids.length > 0 &&
                        (lote.candidatos_ids.includes(meuCandidato.id) ||
                          lote.candidatos_ids.some(
                            (idOuNome) => normalizarTexto(idOuNome) === normalizarTexto(meuCandidato.nome)
                          ))))
                );
                const temAcessoAoLote = estaContempladoComoCandidato || isAdmin;

                return (
                  <div
                    key={lote.id}
                    className="bg-white rounded-3xl border border-slate-200 card-shadow p-6 sm:p-7 space-y-5 hover:border-teal-500/40 transition-all"
                  >
                    {/* Cabeçalho do Lote */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="px-2.5 py-0.5 rounded-md bg-[#07192B] text-teal-300 font-mono text-[11px] font-bold uppercase">
                            {concurso.orgao} • {cargo.nome}
                          </span>
                          <span
                            className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold ${
                              lote.status_lote === 'escolhas_definidas'
                                ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                : lote.status_lote === 'encerrado'
                                ? 'bg-slate-200 text-slate-800'
                                : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            }`}
                          >
                            {getStatusLoteLabel(lote.status_lote)}
                          </span>
                          <span
                            className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold flex items-center gap-1 ${
                              lote.travado
                                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                : 'bg-teal-50 text-teal-800 border border-teal-200'
                            }`}
                          >
                            {lote.travado ? (
                              <>
                                <Lock className="w-3 h-3 text-amber-700" />
                                <span>Bloqueado (Travado)</span>
                              </>
                            ) : (
                              <span>🟢 Aberto p/ Escolhas</span>
                            )}
                          </span>
                        </div>
                        <h3 className="text-xl font-bold font-serif text-slate-900">
                          {lote.nome}
                        </h3>
                      </div>

                      <div className="flex items-center gap-3">
                        {podeEditarEsteLote && (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setLoteEditando(lote);
                                setModalEditarLoteAberto(true);
                              }}
                              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 border border-slate-200"
                              title="Editar configurações do lote"
                            >
                              <Pencil className="w-3.5 h-3.5 text-slate-600" />
                              <span>Editar Lote</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleExcluirLote(lote.id, lote.nome)}
                              className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer border border-transparent hover:border-rose-200"
                              title="Excluir Lote"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Resumo Estruturado das Informações do Lote */}
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                      {/* 1. Vagas Ofertadas */}
                      <div className="bg-slate-50/80 rounded-2xl p-3.5 border border-slate-200/80">
                        <span className="text-2xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                          Vagas Ofertadas
                        </span>
                        <div className="text-xl font-mono font-bold text-teal-700">
                          {totalVagas}
                        </div>
                        <span className="text-[11px] text-slate-500 mt-0.5 block truncate">
                          {lote.comarcas.length} comarcas
                        </span>
                      </div>

                      {/* 2. Titulares e Suplentes */}
                      <div className="bg-slate-50/80 rounded-2xl p-3.5 border border-slate-200/80">
                        <span className="text-2xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                          Convocados
                        </span>
                        <div className="text-xl font-mono font-bold text-slate-900">
                          {totalConvocados}
                        </div>
                        <span className="text-[11px] text-slate-600 mt-0.5 block truncate font-medium">
                          {totalTitulares} tit. • {totalSuplentes} supl.
                        </span>
                      </div>

                      {/* 3. Data da Convocação */}
                      <div className="bg-slate-50/80 rounded-2xl p-3.5 border border-slate-200/80">
                        <span className="text-2xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                          Convocação
                        </span>
                        <div className="text-sm font-semibold text-slate-900 truncate">
                          {lote.data_convocacao || 'Em definição'}
                        </div>
                        <span className="text-[11px] text-slate-500 mt-0.5 block truncate">
                          {lote.data_convocacao ? 'Data oficial / prevista' : 'Aguardando publicação'}
                        </span>
                      </div>

                      {/* 4. Audiência de Escolha */}
                      <div className="bg-slate-50/80 rounded-2xl p-3.5 border border-slate-200/80">
                        <span className="text-2xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                          Audiência Escolha
                        </span>
                        <div className="text-sm font-semibold text-slate-900 truncate">
                          {lote.data_audiencia || 'Em definição'}
                        </div>
                        <span className="text-[11px] text-slate-500 mt-0.5 block truncate">
                          {lote.data_audiencia ? 'Sessão de escolha' : 'A definir'}
                        </span>
                      </div>

                      {/* 5. Data da Nomeação */}
                      <div className="bg-slate-50/80 rounded-2xl p-3.5 border border-slate-200/80">
                        <span className="text-2xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                          Data Nomeação
                        </span>
                        <div className="text-sm font-semibold text-slate-900 truncate">
                          {lote.data_nomeacao || 'Em definição'}
                        </div>
                        <span className="text-[11px] text-slate-500 mt-0.5 block truncate">
                          {lote.data_nomeacao ? 'Previsão no DOE' : 'Aguardando lote'}
                        </span>
                      </div>

                      {/* 6. Status Geral */}
                      <div className="bg-slate-50/80 rounded-2xl p-3.5 border border-slate-200/80">
                        <span className="text-2xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                          Status Lote
                        </span>
                        <div className="text-sm font-bold text-slate-900 truncate">
                          {getStatusLoteLabel(lote.status_lote)}
                        </div>
                        <span className="text-[11px] text-slate-500 mt-0.5 block truncate">
                          {lote.travado ? 'Trava ativada' : 'Manifestação livre'}
                        </span>
                      </div>
                    </div>

                    {/* 7. Barra de Progresso de Preenchimento das Preferências */}
                    <div className="bg-slate-50/60 rounded-2xl p-4 border border-slate-200/60 space-y-2">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-1">
                        <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-teal-600" />
                          <span>Preenchimento das Preferências de Comarcas</span>
                        </div>
                        <div className="text-slate-600 font-medium">
                          <span className="font-bold text-teal-700">{preenchidos}</span> já preencheram •{' '}
                          <span className="font-bold text-amber-700">{faltamPreencher}</span> ainda faltam preencher{' '}
                          <span className="text-slate-400 font-mono">({percentualPreenchido}%)</span>
                        </div>
                      </div>
                      <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-teal-600 h-2 rounded-full transition-all duration-500"
                          style={{ width: `${percentualPreenchido}%` }}
                        />
                      </div>
                    </div>

                    {/* Acordeão Retrátil das Comarcas Contempladas */}
                    <div className="pt-1 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() =>
                          setLotesExpandidosComarcas((prev) => ({
                            ...prev,
                            [lote.id]: !prev[lote.id],
                          }))
                        }
                        className="w-full flex items-center justify-between py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                      >
                        <span className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-teal-600" />
                          <span>
                            Detalhamento das comarcas ({lote.comarcas.length} comarcas contempladas • {totalVagas} vagas)
                          </span>
                        </span>
                        <span className="flex items-center gap-1 text-slate-500 text-xs">
                          <span>{expandido ? 'Ocultar comarcas' : 'Ver relação de comarcas'}</span>
                          {expandido ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </span>
                      </button>

                      {expandido && (
                        <div className="mt-2 p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 max-h-60 overflow-y-auto">
                          <div className="flex flex-wrap gap-1.5">
                            {lote.comarcas.map((c, i) => (
                              <span
                                key={i}
                                className="px-2.5 py-1 rounded-xl bg-white border border-slate-200 text-xs font-medium text-slate-700 flex items-center gap-1.5 shadow-2xs"
                              >
                                <span>{c.nome}</span>
                                <span className="px-1.5 py-0.2 rounded-md bg-teal-100 text-teal-800 font-mono font-bold text-[10px]">
                                  {c.vagas} {c.vagas === 1 ? 'vaga' : 'vagas'}
                                </span>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Acordeão Retrátil dos Candidatos Convocados no Lote com Indicador de Vínculo (Item 6) */}
                    <div className="pt-1 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() =>
                          setLotesExpandidosConvocados((prev) => ({
                            ...prev,
                            [lote.id]: !prev[lote.id],
                          }))
                        }
                        className="w-full flex items-center justify-between py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                      >
                        <span className="flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-teal-600" />
                          <span>
                            Candidatos chamados neste lote ({totalConvocados} configurados)
                          </span>
                        </span>
                        <span className="flex items-center gap-1 text-slate-500 text-xs">
                          <span>{expandidoConvocados ? 'Ocultar convocados' : 'Ver candidatos e vínculos'}</span>
                          {expandidoConvocados ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </span>
                      </button>

                      {expandidoConvocados && (
                        <div className="mt-2 p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 max-h-64 overflow-y-auto">
                          {!lote.convocados || lote.convocados.length === 0 ? (
                            <div className="text-center py-4 text-xs text-slate-500">
                              Nenhum candidato configurado neste lote ainda.{' '}
                              {podeEditarEsteLote && 'Clique em "Editar Lote" acima para definir os candidatos chamados.'}
                            </div>
                          ) : (
                            <div className="divide-y divide-slate-200/70">
                              {lote.convocados.map((cv, i) => {
                                const infoVinc = userRegistryStore.verificarVinculoCandidato({
                                  id: cv.candidato_id,
                                  nome: cv.nome,
                                });
                                return (
                                  <div
                                    key={i}
                                    className="py-2 flex items-center justify-between gap-2 text-xs"
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      <span className="font-mono font-bold text-slate-700 w-8 shrink-0">
                                        {cv.ordem_nomeacao}º
                                      </span>
                                      <span className="font-semibold text-slate-900 truncate">
                                        {cv.nome}
                                      </span>
                                      <span className="px-2 py-0.5 rounded bg-white border border-slate-200 text-[10px] font-mono text-slate-600">
                                        {cv.tipo_vaga} • {cv.papel}
                                      </span>
                                    </div>
                                    {infoVinc.vinculado ? (
                                      <span
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 shrink-0"
                                        title="Usuário já se cadastrou no site e se vinculou a este candidato"
                                      >
                                        <UserCheck className="w-3 h-3 text-emerald-700" />
                                        <span>Usuário Vinculado</span>
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-200/70 text-slate-600 shrink-0">
                                        <span>Sem vínculo ainda</span>
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Área do Candidato / Acesso ao Lote */}
                    <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        {estaContempladoComoCandidato ? (
                          <div className="flex items-center gap-2 text-emerald-800 bg-emerald-50 px-3.5 py-2 rounded-xl border border-emerald-200">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span className="text-xs font-semibold">
                              Você está contemplado neste lote!
                              {meuCandidato && ` (${meuCandidato.posicao}º lugar na classificação)`}
                            </span>
                          </div>
                        ) : isAdmin ? (
                          <div className="flex items-center gap-2 text-amber-900 bg-amber-50 px-3.5 py-2 rounded-xl border border-amber-300">
                            <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0" />
                            <span className="text-xs font-semibold">
                              Acesso liberado por ser Administrador
                            </span>
                          </div>
                        ) : isAprovadoComoCandidato && meuCandidato ? (
                          <div className="text-xs text-slate-500">
                            Sua classificação ({meuCandidato.posicao}º lugar) não consta neste lote e aguarda os próximos lotes de convocação.
                          </div>
                        ) : (
                          <div className="text-xs text-slate-500">
                            O acesso à página do lote e à manifestação de {tipoLotacao.toLowerCase()}s é restrito aos candidatos convocados neste lote.
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        {temAcessoAoLote ? (
                          <>
                            {estaContempladoComoCandidato && (
                              <button
                                type="button"
                                onClick={() => {
                                  setLoteSelecionadoParaEscolha(lote);
                                  setModalEscolhaComarcasAberto(true);
                                }}
                                className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 font-bold text-xs rounded-xl shadow-2xs transition-all cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap"
                              >
                                <MapPin className="w-3.5 h-3.5 text-teal-600" />
                                <span>Escolher {tipoLotacao}s</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() =>
                                onNavigate('lote', {
                                  concursoId: concurso.id,
                                  cargoId: cargo.id,
                                  loteId: lote.id,
                                })
                              }
                              className="px-5 py-2.5 bg-[#07192B] hover:bg-[#0C2640] text-[#2DD4AA] font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap"
                            >
                              <span>Acessar Página do {lote.numero_lote ? `Lote ${lote.numero_lote}` : lote.nome}</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : (
                          <div
                            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 text-slate-400 font-medium text-xs rounded-xl border border-slate-200 cursor-not-allowed select-none"
                            title="Acesso à página e escolha deste lote exclusivo para convocados contemplados neste lote"
                          >
                            <Lock className="w-3.5 h-3.5 text-slate-400" />
                            <span>Acesso Restrito aos Convocados deste Lote</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
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
                onClick={() => loginGoogle()}
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
        <div className="fixed inset-0 z-[150] overflow-y-auto bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
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

      {/* Modal Editar Cargo */}
      <ModalEditarCargo
        aberto={modalEditarCargoAberto}
        onClose={() => setModalEditarCargoAberto(false)}
        concursoId={concurso.id}
        cargo={cargo}
        onSalvo={(salvo) => {
          reloadData();
          showToast(`Cargo "${salvo.nome}" atualizado com sucesso!`);
        }}
      />

      {/* Modal Editar / Criar Lote */}
      <ModalEditarLote
        aberto={modalEditarLoteAberto}
        onClose={() => {
          setModalEditarLoteAberto(false);
          setLoteEditando(null);
        }}
        concursoId={concurso.id}
        cargoId={cargo.id}
        lote={loteEditando}
        onSalvo={(salvo) => {
          reloadData();
          showToast(loteEditando ? `Lote "${salvo.nome}" atualizado!` : `Lote "${salvo.nome}" criado com sucesso!`);
        }}
      />

      {/* Modal Escolha de Comarcas no Lote pelo Candidato */}
      {modalEscolhaComarcasAberto && loteSelecionadoParaEscolha && (
        <ModalEscolhaComarcasLote
          aberto={modalEscolhaComarcasAberto}
          onClose={() => {
            setModalEscolhaComarcasAberto(false);
            setLoteSelecionadoParaEscolha(null);
          }}
          lote={loteSelecionadoParaEscolha}
          candidato={meuCandidato}
          concursoId={concurso.id}
          cargoId={cargo.id}
          onSalvo={() => {
            setCandidatos(lotesStore.getCandidatos(concurso.id, cargo.id));
            reloadData();
            showToast('Preferências de comarca no lote salvas com sucesso!');
          }}
        />
      )}

      {/* Modal Admin Editar Candidato Manualmente */}
      <ModalEditarCandidatoAdmin
        aberto={modalEditarCandidatoAdminAberto}
        candidato={candidatoEditandoAdmin}
        tipoLotacao={tipoLotacao}
        onFechar={() => {
          setModalEditarCandidatoAdminAberto(false);
          setCandidatoEditandoAdmin(null);
        }}
        onSalvar={handleSalvarCandidatoAdmin}
      />

      {/* Modal Admin Adicionar Candidato Manualmente */}
      <ModalAdicionarCandidatoAdmin
        aberto={modalAdicionarCandidatoAdminAberto}
        concursoId={concurso.id}
        cargoId={cargo.id}
        proximaPosicao={candidatos.length + 1}
        tipoLotacao={tipoLotacao}
        onFechar={() => setModalAdicionarCandidatoAdminAberto(false)}
        onAdicionar={handleAdicionarCandidatoAdmin}
      />

      {/* Modal Admin Gerenciar Opções de Listas Suspensas */}
      <ModalGerenciarDropdowns
        aberto={modalGerenciarDropdownsAberto}
        onFechar={() => setModalGerenciarDropdownsAberto(false)}
        onSalvo={() => {
          reloadData();
          showToast('Opções de listas suspensas atualizadas!');
        }}
      />
    </div>
  );
};
