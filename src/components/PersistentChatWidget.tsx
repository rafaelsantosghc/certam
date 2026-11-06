import React, { useState, useEffect, useRef, useMemo } from 'react';
import { certamStore } from '../store/certamStore';
import {
  chatStore,
  SalaChatConcurso,
  CATALOGO_EMOJIS_CATEGORIAS,
  TODOS_EMOJIS_CHAT,
} from '../store/chatStore';
import { dmStore, ContatoConversa, SugestaoContatoDm } from '../store/dmStore';
import { useAuth } from '../store/authContext';
import { useNotifications } from '../store/notificationContext';
import { useChatPermissions } from '../hooks/useChatPermissions';
import { useMessageStatus } from '../hooks/useMessageStatus';
import { Concurso, ChatMensagem, MensagemPrivada } from '../types';
import { sanitizeInput } from '../utils/security';
import {
  MessageSquare,
  MessageCircle,
  ChevronDown,
  ChevronLeft,
  ArrowDown,
  Send,
  Heart,
  Smile,
  Bell,
  BellOff,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Pin,
  Trash2,
  Maximize2,
  Minimize2,
  Sparkles,
  Volume2,
  VolumeX,
  X,
  AlertCircle,
  RotateCcw,
  CheckCheck,
  Loader2,
  ListFilter,
  Lock,
  Search,
  Mail,
  Users,
  Briefcase,
  Award,
  Layers,
  Eye,
  Download,
  Mic,
  Square,
} from 'lucide-react';

interface PersistentChatWidgetProps {
  concursoInicialId?: string;
  onRequireAuth?: () => void;
}

interface ResumoNovaMensagemChat {
  id: string;
  modo: 'concursos' | 'privadas';
  concursoId?: string;
  concursoSigla: string;
  salaId?: string;
  salaTitulo: string;
  dmEmail?: string;
  autor: string;
  resumoTexto: string;
  dataHora: string;
}

export const PersistentChatWidget: React.FC<PersistentChatWidgetProps> = ({
  concursoInicialId,
  onRequireAuth,
}) => {
  const { usuario, isAdmin } = useAuth();
  const {
    notificarNovaMensagemChat,
    browserNotificationPermission,
    solicitarPermissaoNotificacaoNavegador,
  } = useNotifications();

  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [abaModo, setAbaModo] = useState<'concursos' | 'privadas'>('concursos');
  const [mobileViewMode, setMobileViewMode] = useState<'mensagens' | 'conversas'>('mensagens');

  const [concursos, setConcursos] = useState<Concurso[]>(() => certamStore.getConcursos());
  const [concursoAtivoId, setConcursoAtivoId] = useState<string>(() => {
    const list = certamStore.getConcursos();
    return concursoInicialId || list[0]?.id || 'tjrs_2025';
  });
  const [salaAtivaId, setSalaAtivaId] = useState<string>('geral');
  const [mensagens, setMensagens] = useState<ChatMensagem[]>([]);
  const [texto, setTexto] = useState('');

  // Estados de Mensagens Privadas (DMs) integradas no widget
  const [dmConversas, setDmConversas] = useState<ContatoConversa[]>([]);
  const [dmContatoEmail, setDmContatoEmail] = useState<string | null>(null);
  const [dmContatoNome, setDmContatoNome] = useState<string>('');
  const [dmMensagens, setDmMensagens] = useState<MensagemPrivada[]>([]);
  const [dmBusca, setDmBusca] = useState<string>('');
  const [dmIsBloqueado, setDmIsBloqueado] = useState<boolean>(false);

  // Busca em tempo real no histórico de mensagens da conversa ativa
  const [termoBuscaHistorico, setTermoBuscaHistorico] = useState<string>('');

  // Estados de Emojis
  const [emojiPickerMsgId, setEmojiPickerMsgId] = useState<string | null>(null);
  const [showInputEmojiPicker, setShowInputEmojiPicker] = useState(false);
  const [categoriaEmojiAtiva, setCategoriaEmojiAtiva] = useState<string>('reacoes');
  const [emojisFrequentes, setEmojisFrequentes] = useState<string[]>(() =>
    chatStore.getEmojisFrequentes(8)
  );

  // Estados de Contadores de Não Lidas e Resumos
  const [unreadByConcurso, setUnreadByConcurso] = useState<Record<string, number>>({});
  const [unreadBySala, setUnreadBySala] = useState<Record<string, number>>({});
  const [ultimaMsgPorConcurso, setUltimaMsgPorConcurso] = useState<
    Record<string, { autor: string; texto: string; salaTitulo: string; dataHora: string } | null>
  >({});
  const [ultimaMsgPorSala, setUltimaMsgPorSala] = useState<
    Record<string, { autor: string; texto: string; dataHora: string; temAudio?: boolean } | null>
  >({});
  const [categoriaFiltroLateral, setCategoriaFiltroLateral] = useState<
    'todas' | 'geral' | 'cargo' | 'aprovados' | 'lote'
  >('todas');
  const [resumoBanner, setResumoBanner] = useState<ResumoNovaMensagemChat | null>(null);
  const [, setMuteVersion] = useState(0);
  const [dadosVersion, setDadosVersion] = useState(0);

  // Estados de Gravação de Áudio (MediaRecorder -> Blob -> Base64 no localStorage)
  const [gravandoAudio, setGravandoAudio] = useState<boolean>(false);
  const [tempoGravacaoSegundos, setTempoGravacaoSegundos] = useState<number>(0);
  const [audioPreviewBase64, setAudioPreviewBase64] = useState<string | null>(null);
  const [audioPreviewDuracao, setAudioPreviewDuracao] = useState<number>(0);
  const [audioPreviewMimeType, setAudioPreviewMimeType] = useState<string>('audio/webm');
  const [erroGravacaoAudio, setErroGravacaoAudio] = useState<string | null>(null);

  // Controle de Posicionamento na Mensagem Mais Antiga Não Lida + Botão Descer até o Fim
  const [primeiraNaoLidaId, setPrimeiraNaoLidaId] = useState<string | null>(null);
  const [mostrarBotaoDescer, setMostrarBotaoDescer] = useState<boolean>(false);

  // Lazy loading de mensagens antigas (exibe inicialmente as últimas 50, incrementando ao rolar para cima)
  const [limiteMensagensExibidas, setLimiteMensagensExibidas] = useState<number>(50);
  const prevScrollHeightRef = useRef<number>(0);

  // IntersectionObserver e Badge de Novas Mensagens ao ler histórico
  const [isUserAtBottom, setIsUserAtBottom] = useState<boolean>(true);
  const [novasMensagensNaoLidasCount, setNovasMensagensNaoLidasCount] = useState<number>(0);
  const bottomSentinelRef = useRef<HTMLDivElement>(null);

  const knownMsgIdsRef = useRef<Set<string>>(new Set());
  const knownDmIdsRef = useRef<Set<string>>(new Set());
  const initializedKnownIdsRef = useRef(false);
  const selfSentMsgIdsRef = useRef<Set<string>>(new Set());
  const bannerTimeoutRef = useRef<number | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastRoomSignatureRef = useRef<string>('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<number | null>(null);
  const recordingStartAtRef = useRef<number>(0);
  const cancelRecordingRef = useRef<boolean>(false);

  const READ_MSG_STORAGE_KEY = 'certam_chat_read_msg_ids_v1';
  const AUDIO_BLOBS_STORAGE_KEY = 'certam_chat_audio_blobs_v1';
  const MAX_AUDIO_DURATION_SECONDS = 45;

  const meuEmail = useMemo(() => {
    const isUserAdmin = Boolean(
      isAdmin ||
        usuario?.is_admin ||
        usuario?.role === 'admin' ||
        usuario?.tipo_usuario === 'admin' ||
        usuario?.email?.toLowerCase() === 'rafasms0@hotmail.com'
    );
    return (
      usuario?.email?.trim().toLowerCase() ||
      (isUserAdmin ? 'rafasms0@hotmail.com' : '')
    );
  }, [usuario, isAdmin]);

  const getReadIdsMap = (): Record<string, string[]> => {
    if (typeof window === 'undefined') return {};
    try {
      const raw = localStorage.getItem(READ_MSG_STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  };

  const salvarReadIdsMap = (map: Record<string, string[]>) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(READ_MSG_STORAGE_KEY, JSON.stringify(map));
    } catch {
      // ignore
    }
  };

  const concursoAtivo = useMemo(
    () => concursos.find((c) => c.id === concursoAtivoId) || concursos[0],
    [concursos, concursoAtivoId]
  );

  // Hook que valida se usuario.id ou usuario.cpf consta na lista de aprovados do concurso específico
  // antes de renderizar o Chat dos Aprovados (e Chat do Lote) no PersistentChatWidget
  const {
    salasPermitidas: salasDoConcursoAtivo,
    categoriasVisiveis,
    aprovacoesPorCargo,
    podeRenderizarSala,
  } = useChatPermissions(concursoAtivo, usuario, isAdmin, dadosVersion);

  const salaAtiva = useMemo<SalaChatConcurso>(() => {
    return (
      salasDoConcursoAtivo.find((s) => s.id === salaAtivaId) ||
      salasDoConcursoAtivo[0] || {
        id: 'geral',
        tipo: 'geral',
        concursoId: concursoAtivo?.id || 'tjrs_2025',
        cargoId: 'geral',
        cargoNome: 'Geral',
        cargoScope: 'geral',
        titulo: 'Chat Geral',
        tituloCurto: 'Chat Geral',
        descricao: 'Aberto a todos que acompanham as novidades do concurso',
        restrito: false,
        temAcesso: true,
      }
    );
  }, [salasDoConcursoAtivo, salaAtivaId, concursoAtivo]);

  // Se a sala ativa deixou de existir (ex: Cargo virou Aprovados após homologação), ajusta automaticamente
  useEffect(() => {
    if (
      salasDoConcursoAtivo.length > 0 &&
      !salasDoConcursoAtivo.some((s) => s.id === salaAtivaId)
    ) {
      setSalaAtivaId(salasDoConcursoAtivo[0].id);
    }
  }, [salasDoConcursoAtivo, salaAtivaId]);

  const chaveSalaStatusLeitura = useMemo(() => {
    if (abaModo === 'concursos') {
      return `${concursoAtivoId}_${salaAtiva.id}`;
    }
    if (abaModo === 'privadas' && dmContatoEmail && meuEmail) {
      const par = [meuEmail.toLowerCase(), dmContatoEmail.toLowerCase()].sort().join('__');
      return `dm_${par}`;
    }
    return '';
  }, [abaModo, concursoAtivoId, salaAtiva.id, dmContatoEmail, meuEmail]);

  // Hook useMessageStatus: cruza timestamps de leitura do localStorage com o array de mensagens
  const { getMessageReadStatus } = useMessageStatus(
    abaModo === 'concursos' ? mensagens : dmMensagens,
    chaveSalaStatusLeitura,
    usuario,
    isOpen && mobileViewMode === 'mensagens'
  );

  // Filtra histórico de mensagens pelo texto buscado em tempo real
  const mensagensFiltradasBusca = useMemo(() => {
    const q = termoBuscaHistorico.trim().toLowerCase();
    if (!q) return mensagens;
    return mensagens.filter(
      (m) =>
        m.texto.toLowerCase().includes(q) ||
        (m.autor && m.autor.toLowerCase().includes(q))
    );
  }, [mensagens, termoBuscaHistorico]);

  const dmMensagensFiltradasBusca = useMemo(() => {
    const q = termoBuscaHistorico.trim().toLowerCase();
    if (!q) return dmMensagens;
    return dmMensagens.filter((m) => m.texto.toLowerCase().includes(q));
  }, [dmMensagens, termoBuscaHistorico]);

  const destacarTextoBusca = (textoOriginal: string, termo: string): React.ReactNode => {
    const limpo = termo.trim();
    if (!limpo || !textoOriginal) return textoOriginal;
    try {
      const escapado = limpo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(${escapado})`, 'gi');
      const partes = textoOriginal.split(regex);
      if (partes.length <= 1) return textoOriginal;
      return partes.map((parte, idx) =>
        parte.toLowerCase() === limpo.toLowerCase() ? (
          <mark
            key={`hl-${idx}`}
            className="bg-amber-200 text-slate-950 font-bold px-0.5 rounded-xs"
          >
            {parte}
          </mark>
        ) : (
          <React.Fragment key={`txt-${idx}`}>{parte}</React.Fragment>
        )
      );
    } catch {
      return textoOriginal;
    }
  };

  /**
   * Identifica o ID da mensagem mais antiga não lida em uma sala de concurso ANTES de marcá-la como lida.
   */
  const obterPrimeiraNaoLidaSala = (concId: string, sala: SalaChatConcurso): string | null => {
    if (!concId || !sala || (sala.restrito && !sala.temAcesso)) return null;
    const roomKey = `${concId}_${sala.id}`;
    const msgs = chatStore.getMensagens(concId, sala.cargoScope, 'geral');
    if (msgs.length === 0) return null;
    const map = getReadIdsMap();
    const readIds = map[roomKey];
    if (!Array.isArray(readIds)) return null;
    const readSet = new Set<string>(readIds);
    const primeiraNaoLida = msgs.find(
      (m) =>
        !readSet.has(m.id) &&
        !selfSentMsgIdsRef.current.has(m.id) &&
        !chatStore.isMensagemDoProprioUsuario(m, usuario)
    );
    return primeiraNaoLida ? primeiraNaoLida.id : null;
  };

  const marcarSalaComoLida = (concId: string, sala: SalaChatConcurso) => {
    if (!concId || !sala || (sala.restrito && !sala.temAcesso)) return;
    const roomKey = `${concId}_${sala.id}`;
    const msgs = chatStore.getMensagens(concId, sala.cargoScope, 'geral');
    const map = getReadIdsMap();
    const set = new Set<string>(map[roomKey] || []);
    let changed = false;
    msgs.forEach((m) => {
      if (!set.has(m.id)) {
        set.add(m.id);
        changed = true;
      }
    });
    if (changed || !map[roomKey]) {
      map[roomKey] = Array.from(set);
      salvarReadIdsMap(map);
    }
  };

  const sincronizarResumosEContadores = (
    listaConcursos: Concurso[],
    abertoAtual: boolean,
    modoAtual: 'concursos' | 'privadas',
    concAtivoId: string,
    sAtiva: SalaChatConcurso
  ) => {
    const readMap = getReadIdsMap();
    const isFirstInit = Object.keys(readMap).length === 0;
    let readMapModified = false;

    if (abertoAtual && modoAtual === 'concursos' && concAtivoId && sAtiva && sAtiva.temAcesso) {
      const activeKey = `${concAtivoId}_${sAtiva.id}`;
      const activeMsgs = chatStore.getMensagens(concAtivoId, sAtiva.cargoScope, 'geral');
      const set = new Set<string>(readMap[activeKey] || []);
      activeMsgs.forEach((m) => {
        if (!set.has(m.id)) {
          set.add(m.id);
          readMapModified = true;
        }
      });
      readMap[activeKey] = Array.from(set);
    }

    const nextUnreadConcurso: Record<string, number> = {};
    const nextUnreadSala: Record<string, number> = {};
    const nextUltimaMsg: Record<
      string,
      { autor: string; texto: string; salaTitulo: string; dataHora: string } | null
    > = {};
    const nextUltimaMsgSala: Record<
      string,
      { autor: string; texto: string; dataHora: string; temAudio?: boolean } | null
    > = {};

    listaConcursos.forEach((c) => {
      let totalNaoLidasConcurso = 0;
      let msgMaisRecente: {
        msg: ChatMensagem;
        salaTitulo: string;
        ordem: number;
      } | null = null;

      const salas = chatStore.getSalasDoConcurso(c, usuario, isAdmin);

      salas.forEach((sala, sIdx) => {
        const roomKey = `${c.id}_${sala.id}`;
        // Proteção estrita: salas restritas sem permissão não expõem contagem nem fragmento de mensagens
        if (sala.restrito && !sala.temAcesso) {
          nextUnreadSala[roomKey] = 0;
          nextUltimaMsgSala[roomKey] = null;
          return;
        }

        const msgs = chatStore.getMensagens(c.id, sala.cargoScope, 'geral');

        if (isFirstInit) {
          readMap[roomKey] = msgs.map((m) => m.id);
          readMapModified = true;
        }

        const readSet = new Set<string>(readMap[roomKey] || []);
        const isCurrentOpenRoom =
          abertoAtual &&
          modoAtual === 'concursos' &&
          concAtivoId === c.id &&
          sAtiva.id === sala.id;

        let naoLidasSala = 0;
        msgs.forEach((m, idx) => {
          const enviadaPorMim =
            selfSentMsgIdsRef.current.has(m.id) ||
            chatStore.isMensagemDoProprioUsuario(m, usuario);

          if (isCurrentOpenRoom || enviadaPorMim) {
            if (!readSet.has(m.id)) {
              readSet.add(m.id);
              readMap[roomKey] = Array.from(readSet);
              readMapModified = true;
            }
          } else if (!readSet.has(m.id)) {
            naoLidasSala++;
          }

          const ts = Number(m.created_at || m.updated_at || 0) || (idx + 1) * 10 + sIdx;
          if (!msgMaisRecente || ts >= msgMaisRecente.ordem) {
            msgMaisRecente = { msg: m, salaTitulo: sala.tituloCurto, ordem: ts };
          }
        });

        const ultimaDaSala = msgs.length > 0 ? msgs[msgs.length - 1] : null;
        nextUltimaMsgSala[roomKey] = ultimaDaSala
          ? {
              autor: ultimaDaSala.autor,
              texto: ultimaDaSala.texto,
              dataHora: ultimaDaSala.data_hora,
              temAudio: Boolean(ultimaDaSala.audio_base64),
            }
          : null;

        nextUnreadSala[roomKey] = naoLidasSala;
        totalNaoLidasConcurso += naoLidasSala;
      });

      nextUnreadConcurso[c.id] = totalNaoLidasConcurso;
      if (msgMaisRecente) {
        const { msg, salaTitulo } = msgMaisRecente as {
          msg: ChatMensagem;
          salaTitulo: string;
          ordem: number;
        };
        nextUltimaMsg[c.id] = {
          autor: msg.autor,
          texto: msg.texto,
          salaTitulo,
          dataHora: msg.data_hora,
        };
      } else {
        nextUltimaMsg[c.id] = null;
      }
    });

    if (readMapModified) {
      salvarReadIdsMap(readMap);
    }

    setUnreadByConcurso(nextUnreadConcurso);
    setUnreadBySala(nextUnreadSala);
    setUltimaMsgPorConcurso(nextUltimaMsg);
    setUltimaMsgPorSala(nextUltimaMsgSala);
  };

  const recarregarDadosDm = () => {
    if (!meuEmail) {
      setDmConversas([]);
      setDmMensagens([]);
      return;
    }
    const lista = dmStore.getContatosConversas(meuEmail);
    setDmConversas(lista);
    if (dmContatoEmail) {
      const msgs = dmStore.getMensagensEntre(meuEmail, dmContatoEmail);
      setDmMensagens([...msgs]);
      setDmIsBloqueado(dmStore.isUsuarioBloqueado(meuEmail, dmContatoEmail));
    }
  };

  useEffect(() => {
    if (concursoInicialId && concursos.some((c) => c.id === concursoInicialId)) {
      setConcursoAtivoId(concursoInicialId);
    }
  }, [concursoInicialId, concursos]);

  // Escuta evento global 'certam_abrir_dm_chat' disparado de qualquer lugar do portal para abrir uma conversa privada
  useEffect(() => {
    const handleAbrirDmGlobal = (e: Event) => {
      const detail = (e as CustomEvent)?.detail || {};
      setIsOpen(true);
      setAbaModo('privadas');
      setResumoBanner(null);
      if (detail.email) {
        setDmContatoEmail(detail.email);
        setDmContatoNome(detail.nome || detail.email);
        setMobileViewMode('mensagens');
      } else {
        const convs = meuEmail ? dmStore.getContatosConversas(meuEmail) : [];
        if (convs.length > 0 && !dmContatoEmail) {
          setDmContatoEmail(convs[0].email);
          setDmContatoNome(convs[0].nome);
        }
        setMobileViewMode(detail.email ? 'mensagens' : 'conversas');
      }
    };

    window.addEventListener('certam_abrir_dm_chat', handleAbrirDmGlobal);
    return () => window.removeEventListener('certam_abrir_dm_chat', handleAbrirDmGlobal);
  }, [meuEmail, dmContatoEmail]);

  const salaAtualSilenciada =
    abaModo === 'privadas'
      ? dmContatoEmail
        ? chatStore.isDmSilenciada(dmContatoEmail)
        : false
      : chatStore.isSalaSilenciada(concursoAtivoId, salaAtiva.id);

  const concursoAtualSilenciado = chatStore.isConcursoSilenciado(concursoAtivoId);

  const carregarMensagensAtivas = () => {
    if (!concursoAtivoId) return;
    if (salaAtiva.restrito && !salaAtiva.temAcesso) {
      setMensagens([]);
      return;
    }
    const msgs = chatStore.getMensagens(concursoAtivoId, salaAtiva.cargoScope, 'geral');
    setMensagens([...msgs]);
  };

  // Reset do limite de lazy loading ao trocar de sala ou concurso
  useEffect(() => {
    setLimiteMensagensExibidas(50);
  }, [concursoAtivoId, salaAtivaId, abaModo, dmContatoEmail]);

  // Posiciona automaticamente na mensagem mais antiga não lida ao abrir a conversa (ou no final se todas já foram lidas)
  const posicionarScrollConversa = (targetUnreadId: string | null) => {
    window.setTimeout(() => {
      const container = messagesContainerRef.current;
      if (!container) return;

      if (targetUnreadId) {
        const unreadEl = container.querySelector(
          `[data-chat-msg-id="${targetUnreadId}"]`
        ) as HTMLElement | null;
        if (unreadEl) {
          const offsetTopWithinContainer = unreadEl.offsetTop - container.offsetTop;
          container.scrollTop = Math.max(0, offsetTopWithinContainer - 28);
          const dist = container.scrollHeight - container.scrollTop - container.clientHeight;
          setMostrarBotaoDescer(dist > 36);
          return;
        }
      }

      // Se não há mensagens não lidas, posiciona diretamente no fim (mensagem mais recente)
      container.scrollTop = container.scrollHeight;
      setMostrarBotaoDescer(false);
    }, 45);
  };

  const rolarAteOFim = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: 'smooth',
      });
    } else {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    setPrimeiraNaoLidaId(null);
    setMostrarBotaoDescer(false);
  };

  const handleContainerScroll = () => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    setMostrarBotaoDescer(distanceFromBottom > 48);

    // Lazy loading: ao rolar próximo ao topo (scrollTop < 40), carrega mais 50 mensagens anteriores
    if (container.scrollTop < 40) {
      const listaAtual = abaModo === 'concursos' ? mensagensFiltradasBusca : dmMensagensFiltradasBusca;
      if (limiteMensagensExibidas < listaAtual.length) {
        prevScrollHeightRef.current = container.scrollHeight;
        setLimiteMensagensExibidas((prev) => Math.min(listaAtual.length, prev + 50));
        // Restaura a posição de scroll após renderizar as mensagens anteriores
        window.setTimeout(() => {
          if (messagesContainerRef.current) {
            const novaAltura = messagesContainerRef.current.scrollHeight;
            messagesContainerRef.current.scrollTop = novaAltura - prevScrollHeightRef.current;
          }
        }, 10);
      }
    }
  };

  const verificarSeUsuarioEstaNoFinal = (): boolean => {
    return isUserAtBottom;
  };

  // Configuração do IntersectionObserver para detectar com precisão quando o usuário está no fim da lista
  useEffect(() => {
    const container = messagesContainerRef.current;
    const sentinel = bottomSentinelRef.current;
    if (!container || !sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const atBottom = entry.isIntersecting;
          setIsUserAtBottom(atBottom);
          if (atBottom) {
            setNovasMensagensNaoLidasCount(0);
          }
        });
      },
      {
        root: container,
        threshold: 0.1,
      }
    );

    observer.observe(sentinel);
    return () => {
      observer.disconnect();
    };
  }, [isOpen, abaModo, concursoAtivoId, salaAtivaId, dmContatoEmail]);

  // Purga automática de mensagens antigas (por período de retenção ou limite de contagem) ao inicializar e periodicamente para preservar o localStorage
  useEffect(() => {
    const executarPurgaHistorico = () => {
      const resultadoPurgaChat = chatStore.purgarMensagensAntigas();
      const removidasDm = dmStore.purgarMensagensAntigas();
      if (resultadoPurgaChat.totalRemovidas > 0 || removidasDm > 0) {
        setDadosVersion((v) => v + 1);
      }
    };

    executarPurgaHistorico();
    const purgeInterval = window.setInterval(executarPurgaHistorico, 10 * 60 * 1000);
    return () => window.clearInterval(purgeInterval);
  }, []);

  // Inicializa IDs de mensagens já existentes para só notificar mensagens novas que chegarem a partir de agora
  useEffect(() => {
    if (initializedKnownIdsRef.current) return;
    const allConcursos = certamStore.getConcursos();
    allConcursos.forEach((c) => {
      const salas = chatStore.getSalasDoConcurso(c, usuario, isAdmin);
      salas.forEach((sala) => {
        if (sala.restrito && !sala.temAcesso) return;
        const msgs = chatStore.getMensagens(c.id, sala.cargoScope, 'geral');
        msgs.forEach((m) => knownMsgIdsRef.current.add(m.id));
      });
    });

    if (meuEmail) {
      dmStore.getMensagens().forEach((dm) => knownDmIdsRef.current.add(dm.id));
    }

    sincronizarResumosEContadores(allConcursos, isOpen, abaModo, concursoAtivoId, salaAtiva);
    recarregarDadosDm();
    initializedKnownIdsRef.current = true;
  }, [meuEmail]);

  // Quando o usuário abre o chat ou troca de conversa/sala/DM:
  // 1. Captura o ID da mensagem mais antiga não lida ANTES de marcar como lida
  // 2. Marca como lida
  // 3. Posiciona o scroll na mensagem mais antiga não lida (ou no fim se não houver não lidas)
  useEffect(() => {
    const signature = isOpen
      ? `${abaModo}:${concursoAtivoId}:${salaAtiva.id}:${dmContatoEmail || ''}`
      : '';

    if (isOpen && signature !== lastRoomSignatureRef.current) {
      lastRoomSignatureRef.current = signature;

      if (abaModo === 'concursos') {
        const unreadId = obterPrimeiraNaoLidaSala(concursoAtivoId, salaAtiva);
        setPrimeiraNaoLidaId(unreadId);
        marcarSalaComoLida(concursoAtivoId, salaAtiva);
        carregarMensagensAtivas();
        sincronizarResumosEContadores(
          certamStore.getConcursos(),
          isOpen,
          abaModo,
          concursoAtivoId,
          salaAtiva
        );
        posicionarScrollConversa(unreadId);
      } else if (abaModo === 'privadas') {
        const unreadDmId =
          meuEmail && dmContatoEmail
            ? dmStore.getPrimeiraMensagemNaoLidaId(meuEmail, dmContatoEmail)
            : null;
        setPrimeiraNaoLidaId(unreadDmId);
        if (meuEmail && dmContatoEmail) {
          dmStore.marcarComoLidas(meuEmail, dmContatoEmail);
        }
        recarregarDadosDm();
        posicionarScrollConversa(unreadDmId);
      }
    } else {
      if (!isOpen) {
        lastRoomSignatureRef.current = '';
      }
      carregarMensagensAtivas();
      recarregarDadosDm();
      sincronizarResumosEContadores(
        certamStore.getConcursos(),
        isOpen,
        abaModo,
        concursoAtivoId,
        salaAtiva
      );
    }
  }, [concursoAtivoId, salaAtiva.id, dmContatoEmail, abaModo, isOpen, usuario, dadosVersion]);

  const playIncomingChatSound = () => {
    if (typeof window === 'undefined') return;
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.09);
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.045, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.19);
      setTimeout(() => {
        void ctx.close().catch(() => {});
      }, 250);
    } catch {
      // ignore
    }
  };

  // Monitoramento em tempo real de todas as conversas (Concursos e Mensagens Privadas)
  useEffect(() => {
    const verificarNovasMensagensGlobal = () => {
      const listaConcursos = certamStore.getConcursos();
      setConcursos(listaConcursos);
      setDadosVersion((v) => v + 1);

      const currentSenderId = chatStore.obterIdentificadorUsuario(usuario).trim().toLowerCase();
      const currentSenderIds = chatStore.obterConjuntoSenderIdsUsuarioAtual(usuario);

      let ultimaNovaParaNotificar: ResumoNovaMensagemChat | null = null;

      listaConcursos.forEach((conc) => {
        const salas = chatStore.getSalasDoConcurso(conc, usuario, isAdmin);
        salas.forEach((sala) => {
          // Segurança estrita: nunca notifica sobre salas restritas (Aprovados/Lote) às quais o usuário não tem acesso
          if (sala.restrito && !sala.temAcesso) return;

          const msgs = chatStore.getMensagens(conc.id, sala.cargoScope, 'geral');
          const incomingFromOtherParticipants = msgs.filter((m) => {
            const msgSenderId = String(m.sender_id || m.email || '').trim().toLowerCase();
            const isOwnSenderId =
              Boolean(msgSenderId) &&
              (msgSenderId === currentSenderId || currentSenderIds.has(msgSenderId));
            const isSelfMessage =
              isOwnSenderId ||
              selfSentMsgIdsRef.current.has(m.id) ||
              chatStore.isMensagemDoProprioUsuario(m, usuario);

            if (isSelfMessage) {
              knownMsgIdsRef.current.add(m.id);
              selfSentMsgIdsRef.current.add(m.id);
              return false;
            }
            return true;
          });

          incomingFromOtherParticipants.forEach((m) => {
            if (!knownMsgIdsRef.current.has(m.id)) {
              knownMsgIdsRef.current.add(m.id);

              const estaVisualizandoEstaSalaAberta =
                isOpen &&
                abaModo === 'concursos' &&
                mobileViewMode === 'mensagens' &&
                concursoAtivoId === conc.id &&
                salaAtiva.id === sala.id;

              const conversaSilenciada =
                chatStore.isSalaSilenciada(conc.id, sala.id) ||
                chatStore.isConcursoSilenciado(conc.id);

              if (!conversaSilenciada && !estaVisualizandoEstaSalaAberta) {
                const sigla = conc.orgao || conc.nome;
                const resumoCurto =
                  m.texto.length > 68 ? `${m.texto.substring(0, 68)}...` : m.texto;
                ultimaNovaParaNotificar = {
                  id: m.id,
                  modo: 'concursos',
                  concursoId: conc.id,
                  concursoSigla: sigla,
                  salaId: sala.id,
                  salaTitulo: sala.tituloCurto,
                  autor: m.autor,
                  resumoTexto: resumoCurto,
                  dataHora: m.data_hora || 'Agora',
                };

                // Dispara alerta via API de Notificações do Navegador integrada ao NotificationProvider (mesmo com o chat fechado)
                notificarNovaMensagemChat({
                  id: m.id,
                  modo: 'concursos',
                  concursoId: conc.id,
                  concursoSigla: sigla,
                  salaId: sala.id,
                  salaTitulo: sala.tituloCurto,
                  autor: m.autor,
                  resumoTexto: resumoCurto,
                  senderId: m.sender_id || m.email,
                  onClickAbrir: () => {
                    setAbaModo('concursos');
                    setConcursoAtivoId(conc.id);
                    setSalaAtivaId(sala.id);
                    setMobileViewMode('mensagens');
                    setIsOpen(true);
                    setResumoBanner(null);
                  },
                });
              }
            }
          });
        });
      });

      // Verifica também novas Mensagens Privadas (DMs) recebidas de outros usuários
      if (meuEmail) {
        const todasDms = dmStore.getMensagens();
        todasDms.forEach((dm) => {
          if (knownDmIdsRef.current.has(dm.id)) return;
          knownDmIdsRef.current.add(dm.id);

          const remEmail = dm.remetente_email.trim().toLowerCase();
          const destEmail = dm.destinatario_email.trim().toLowerCase();
          if (remEmail === meuEmail || destEmail !== meuEmail) return;
          if (dmStore.isUsuarioBloqueado(meuEmail, remEmail)) return;

          const estaVisualizandoEstaDm =
            isOpen &&
            abaModo === 'privadas' &&
            mobileViewMode === 'mensagens' &&
            dmContatoEmail?.trim().toLowerCase() === remEmail;

          if (estaVisualizandoEstaDm) {
            dmStore.marcarComoLidas(meuEmail, remEmail);
          } else if (!chatStore.isDmSilenciada(remEmail)) {
            const resumoCurto =
              dm.texto.length > 68 ? `${dm.texto.substring(0, 68)}...` : dm.texto;
            ultimaNovaParaNotificar = {
              id: dm.id,
              modo: 'privadas',
              concursoSigla: 'Mensagem Privada',
              salaTitulo: dm.remetente_nome || remEmail,
              dmEmail: dm.remetente_email,
              autor: dm.remetente_nome || remEmail,
              resumoTexto: resumoCurto,
              dataHora: dm.data_hora || 'Agora',
            };

            // Dispara alerta de Mensagem Privada via API de Notificações do Navegador integrada ao NotificationProvider
            notificarNovaMensagemChat({
              id: dm.id,
              modo: 'privadas',
              concursoSigla: 'Mensagem Privada',
              salaTitulo: dm.remetente_nome || remEmail,
              dmEmail: dm.remetente_email,
              autor: dm.remetente_nome || remEmail,
              resumoTexto: resumoCurto,
              senderId: dm.remetente_email,
              onClickAbrir: () => {
                setAbaModo('privadas');
                setDmContatoEmail(dm.remetente_email);
                setDmContatoNome(dm.remetente_nome || remEmail);
                setMobileViewMode('mensagens');
                setIsOpen(true);
                setResumoBanner(null);
              },
            });
          }
        });
      }

      sincronizarResumosEContadores(
        listaConcursos,
        isOpen,
        abaModo,
        concursoAtivoId,
        salaAtiva
      );
      recarregarDadosDm();

      if (ultimaNovaParaNotificar) {
        playIncomingChatSound();
        setResumoBanner(ultimaNovaParaNotificar);

        if (bannerTimeoutRef.current) {
          window.clearTimeout(bannerTimeoutRef.current);
        }
        bannerTimeoutRef.current = window.setTimeout(() => {
          setResumoBanner(null);
        }, 6000);
      }

       const estavaNoFinal = verificarSeUsuarioEstaNoFinal();
       carregarMensagensAtivas();

       if (isOpen) {
         if (estavaNoFinal) {
           window.setTimeout(() => {
             rolarAteOFim();
           }, 50);
         } else if (ultimaNovaParaNotificar) {
           setNovasMensagensNaoLidasCount((prev) => prev + 1);
         }
       }
     };

    const handleMuteChanged = () => {
      setMuteVersion((v) => v + 1);
      if (resumoBanner) {
        if (
          resumoBanner.modo === 'concursos' &&
          resumoBanner.concursoId &&
          (chatStore.isSalaSilenciada(resumoBanner.concursoId, resumoBanner.salaId) ||
            chatStore.isConcursoSilenciado(resumoBanner.concursoId))
        ) {
          setResumoBanner(null);
        } else if (
          resumoBanner.modo === 'privadas' &&
          resumoBanner.dmEmail &&
          chatStore.isDmSilenciada(resumoBanner.dmEmail)
        ) {
          setResumoBanner(null);
        }
      }
    };

    const handleEmojisChanged = () => {
      setEmojisFrequentes(chatStore.getEmojisFrequentes(8));
    };

    chatStore.initRealtime();

    window.addEventListener('certam_chat_updated', verificarNovasMensagensGlobal);
    window.addEventListener('certam_dm_updated', verificarNovasMensagensGlobal);
    window.addEventListener('certam_blocked_updated', verificarNovasMensagensGlobal);
    window.addEventListener('certam_concursos_updated', verificarNovasMensagensGlobal);
    window.addEventListener('certam_lotes_updated', verificarNovasMensagensGlobal);
    window.addEventListener('certam_candidatos_updated', verificarNovasMensagensGlobal);
    window.addEventListener('certam_chat_mute_updated', handleMuteChanged);
    window.addEventListener('certam_emojis_updated', handleEmojisChanged);
    window.addEventListener('storage', verificarNovasMensagensGlobal);

    return () => {
      window.removeEventListener('certam_chat_updated', verificarNovasMensagensGlobal);
      window.removeEventListener('certam_dm_updated', verificarNovasMensagensGlobal);
      window.removeEventListener('certam_blocked_updated', verificarNovasMensagensGlobal);
      window.removeEventListener('certam_concursos_updated', verificarNovasMensagensGlobal);
      window.removeEventListener('certam_lotes_updated', verificarNovasMensagensGlobal);
      window.removeEventListener('certam_candidatos_updated', verificarNovasMensagensGlobal);
      window.removeEventListener('certam_chat_mute_updated', handleMuteChanged);
      window.removeEventListener('certam_emojis_updated', handleEmojisChanged);
      window.removeEventListener('storage', verificarNovasMensagensGlobal);
    };
  }, [
    concursoAtivoId,
    salaAtiva,
    abaModo,
    dmContatoEmail,
    meuEmail,
    isOpen,
    mobileViewMode,
    usuario,
    isAdmin,
    resumoBanner,
  ]);

  const handleToggleMuteSalaAtual = () => {
    if (browserNotificationPermission === 'default') {
      void solicitarPermissaoNotificacaoNavegador();
    }
    if (abaModo === 'privadas') {
      if (dmContatoEmail) {
        chatStore.alternarSilenciarDm(dmContatoEmail);
        setMuteVersion((v) => v + 1);
      }
      return;
    }
    chatStore.alternarSilenciarSala(concursoAtivoId, salaAtiva.id);
    setMuteVersion((v) => v + 1);
  };

  const handleToggleMuteConcursoAtual = () => {
    if (browserNotificationPermission === 'default') {
      void solicitarPermissaoNotificacaoNavegador();
    }
    chatStore.alternarSilenciarConcurso(concursoAtivoId);
    setMuteVersion((v) => v + 1);
  };

  const handleExportarConversaJson = () => {
    const exportedAt = new Date().toISOString();
    const dateStamp = exportedAt.slice(0, 10);

    const payload =
      abaModo === 'privadas'
        ? {
            portal: 'CERTAM',
            tipo_backup: 'conversa_privada',
            exportado_em: exportedAt,
            usuario_email: meuEmail || usuario?.email || null,
            contato_email: dmContatoEmail || null,
            contato_nome: dmContatoNome || null,
            total_mensagens: dmMensagens.length,
            mensagens: dmMensagens,
          }
        : {
            portal: 'CERTAM',
            tipo_backup: 'chat_concurso',
            exportado_em: exportedAt,
            concurso_id: concursoAtivo?.id || concursoAtivoId,
            concurso_orgao: concursoAtivo?.orgao || null,
            concurso_nome: concursoAtivo?.nome || null,
            sala_id: salaAtiva.id,
            sala_titulo: salaAtiva.titulo,
            sala_tipo: salaAtiva.tipo,
            total_mensagens: mensagens.length,
            mensagens,
          };

    const rawSlug =
      abaModo === 'privadas'
        ? `privado_${dmContatoNome || dmContatoEmail || 'conversa'}`
        : `${concursoAtivo?.orgao || concursoAtivoId}_${salaAtiva.id}`;
    const safeSlug = rawSlug
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9_-]+/g, '_')
      .replace(/^_+|_+$/g, '');

    const jsonString = JSON.stringify(payload, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `certam_chat_${safeSlug || 'historico'}_${dateStamp}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleToggleBloqueioDm = () => {
    if (!meuEmail || !dmContatoEmail) return;
    if (dmIsBloqueado) {
      dmStore.desbloquearUsuario(meuEmail, dmContatoEmail);
      setDmIsBloqueado(false);
    } else {
      dmStore.bloquearUsuario(meuEmail, dmContatoEmail);
      setDmIsBloqueado(true);
    }
  };

  const handleIniciarConversaPrivada = (emailAlvo: string, nomeAlvo: string) => {
    if (!usuario && !isAdmin) {
      onRequireAuth?.();
      return;
    }
    if (!emailAlvo || emailAlvo.trim().toLowerCase() === meuEmail) return;
    setAbaModo('privadas');
    setDmContatoEmail(emailAlvo.trim());
    setDmContatoNome(nomeAlvo || emailAlvo.trim());
    setMobileViewMode('mensagens');
  };

  const formatarDuracaoAudio = (segundos?: number): string => {
    const total = Math.max(0, Math.round(Number(segundos || 0)));
    const min = Math.floor(total / 60);
    const sec = total % 60;
    return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  const encerrarRecursosMidia = () => {
    if (recordingTimerRef.current) {
      window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      encerrarRecursosMidia();
    };
  }, []);

  const salvarAudioBlobOffline = (
    msgId: string,
    base64DataUrl: string,
    duracaoSegundos: number,
    mimeType: string
  ) => {
    if (typeof window === 'undefined' || !base64DataUrl) return;
    try {
      const raw = localStorage.getItem(AUDIO_BLOBS_STORAGE_KEY);
      const parsed: Record<
        string,
        { base64: string; duracao: number; mimeType: string; savedAt: number }
      > = raw ? JSON.parse(raw) : {};
      parsed[msgId] = {
        base64: base64DataUrl,
        duracao: duracaoSegundos,
        mimeType,
        savedAt: Date.now(),
      };
      // Mantém os últimos 25 áudios no cache dedicado do localStorage para não exceder a cota offline
      const keys = Object.keys(parsed);
      if (keys.length > 25) {
        const sortedKeys = keys.sort(
          (a, b) => (parsed[a]?.savedAt || 0) - (parsed[b]?.savedAt || 0)
        );
        sortedKeys.slice(0, keys.length - 25).forEach((k) => {
          delete parsed[k];
        });
      }
      localStorage.setItem(AUDIO_BLOBS_STORAGE_KEY, JSON.stringify(parsed));
    } catch {
      // ignora caso a cota do localStorage esteja próxima do limite
    }
  };

  const converterBlobParaBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('Falha ao converter áudio para Base64.'));
        }
      };
      reader.onerror = () => reject(new Error('Erro de leitura do Blob de áudio.'));
      reader.readAsDataURL(blob);
    });
  };

  const iniciarGravacaoAudio = async () => {
    if (!usuario && !isAdmin) {
      onRequireAuth?.();
      return;
    }
    if (abaModo === 'privadas' && dmIsBloqueado) return;
    if (abaModo === 'concursos' && salaAtiva.restrito && !salaAtiva.temAcesso) return;

    setErroGravacaoAudio(null);

    if (
      typeof window === 'undefined' ||
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== 'function' ||
      typeof window.MediaRecorder === 'undefined'
    ) {
      setErroGravacaoAudio('Seu navegador não suporta gravação de voz (MediaRecorder).');
      return;
    }

    try {
      encerrarRecursosMidia();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const candidatosMime = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4',
      ];
      const mimeSuportado =
        candidatosMime.find(
          (m) => typeof MediaRecorder.isTypeSupported === 'function' && MediaRecorder.isTypeSupported(m)
        ) || '';

      const recorder = mimeSuportado
        ? new MediaRecorder(stream, { mimeType: mimeSuportado, audioBitsPerSecond: 32000 })
        : new MediaRecorder(stream);

      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      cancelRecordingRef.current = false;
      recordingStartAtRef.current = Date.now();
      setTempoGravacaoSegundos(0);
      setAudioPreviewBase64(null);
      setGravandoAudio(true);

      recorder.ondataavailable = (ev: BlobEvent) => {
        if (ev.data && ev.data.size > 0) {
          audioChunksRef.current.push(ev.data);
        }
      };

      recorder.onstop = async () => {
        const duracaoFinal = Math.max(
          1,
          Math.round((Date.now() - recordingStartAtRef.current) / 1000)
        );
        const mimeFinal = recorder.mimeType || mimeSuportado || 'audio/webm';
        encerrarRecursosMidia();
        setGravandoAudio(false);

        if (cancelRecordingRef.current || audioChunksRef.current.length === 0) {
          audioChunksRef.current = [];
          return;
        }

        try {
          const audioBlob = new Blob(audioChunksRef.current, { type: mimeFinal });
          audioChunksRef.current = [];
          const base64Url = await converterBlobParaBase64(audioBlob);

          // Transcrição automática em background usando Web Speech API (se disponível)
          let transcricaoGerada = '';
          const SpeechRecognitionAPI =
            (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
          if (SpeechRecognitionAPI) {
            try {
              const recognition = new SpeechRecognitionAPI();
              recognition.lang = 'pt-BR';
              recognition.interimResults = false;
              recognition.maxAlternatives = 1;
              transcricaoGerada = await new Promise<string>((resolve) => {
                let resolved = false;
                recognition.onresult = (event: any) => {
                  const text = event.results?.[0]?.[0]?.transcript || '';
                  if (!resolved) {
                    resolved = true;
                    resolve(text);
                  }
                };
                recognition.onerror = () => {
                  if (!resolved) {
                    resolved = true;
                    resolve('');
                  }
                };
                recognition.onend = () => {
                  if (!resolved) {
                    resolved = true;
                    resolve('');
                  }
                };
                try {
                  recognition.start();
                  // Timeout de segurança de 4 segundos para a transcrição
                  window.setTimeout(() => {
                    if (!resolved) {
                      resolved = true;
                      try { recognition.stop(); } catch {}
                      resolve('');
                    }
                  }, 4000);
                } catch {
                  resolve('');
                }
              });
            } catch {
              // ignora erro de speech recognition
            }
          }

          setAudioPreviewBase64(base64Url);
          setAudioPreviewDuracao(duracaoFinal);
          setAudioPreviewMimeType(mimeFinal);
          if (transcricaoGerada) {
            setTexto((prev) => (prev ? `${prev} [Transcrição: ${transcricaoGerada}]` : `Transcrição: ${transcricaoGerada}`));
          }
        } catch {
          setErroGravacaoAudio('Não foi possível converter o áudio gravado para Base64.');
        }
      };

      recorder.start(250);

      recordingTimerRef.current = window.setInterval(() => {
        const elapsed = Math.floor((Date.now() - recordingStartAtRef.current) / 1000);
        setTempoGravacaoSegundos(elapsed);
        if (elapsed >= MAX_AUDIO_DURATION_SECONDS && mediaRecorderRef.current?.state === 'recording') {
          mediaRecorderRef.current.stop();
        }
      }, 300);
    } catch {
      encerrarRecursosMidia();
      setGravandoAudio(false);
      setErroGravacaoAudio(
        'Permissão de microfone negada ou indisponível no navegador.'
      );
    }
  };

  const pararGravacaoAudio = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      cancelRecordingRef.current = false;
      mediaRecorderRef.current.stop();
    } else {
      encerrarRecursosMidia();
      setGravandoAudio(false);
    }
  };

  const cancelarGravacaoAudio = () => {
    cancelRecordingRef.current = true;
    audioChunksRef.current = [];
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    } else {
      encerrarRecursosMidia();
      setGravandoAudio(false);
    }
    setTempoGravacaoSegundos(0);
  };

  const limparAudioPreview = () => {
    setAudioPreviewBase64(null);
    setAudioPreviewDuracao(0);
    setErroGravacaoAudio(null);
  };

  const handleEnviar = (e: React.FormEvent) => {
    e.preventDefault();
    const temTexto = Boolean(texto.trim());
    const temAudio = Boolean(audioPreviewBase64);
    if (!temTexto && !temAudio) return;
    if (!usuario && !isAdmin) {
      onRequireAuth?.();
      return;
    }

    const isUserAdmin = Boolean(
      isAdmin ||
        usuario?.is_admin ||
        usuario?.role === 'admin' ||
        usuario?.tipo_usuario === 'admin' ||
        usuario?.email?.toLowerCase() === 'rafasms0@hotmail.com'
    );

    const nomeAutor =
      usuario?.nome?.trim() || (isUserAdmin ? 'Rafael Santos Morais da Silva' : 'Candidato');
    const emailAutor =
      usuario?.email?.trim().toLowerCase() ||
      (isUserAdmin ? 'rafasms0@hotmail.com' : 'candidato@certam.com.br');

    const textoLimpo = temTexto
      ? sanitizeInput(texto.trim(), 1000)
      : `🎤 Mensagem de voz (${audioPreviewDuracao || 1}s)`;

    // Modo Mensagens Privadas (DM)
    if (abaModo === 'privadas') {
      if (!dmContatoEmail || dmIsBloqueado) return;
      const novaDm = dmStore.enviarMensagem({
        remetente_email: emailAutor,
        remetente_nome: nomeAutor,
        destinatario_email: dmContatoEmail,
        destinatario_nome: dmContatoNome || dmContatoEmail,
        texto: textoLimpo,
        ...(temAudio && audioPreviewBase64
          ? {
              audio_base64: audioPreviewBase64,
              audio_duracao: audioPreviewDuracao || 1,
              audio_mime_type: audioPreviewMimeType,
            }
          : {}),
      });
      if (temAudio && audioPreviewBase64) {
        salvarAudioBlobOffline(
          novaDm.id,
          audioPreviewBase64,
          audioPreviewDuracao || 1,
          audioPreviewMimeType
        );
      }
      knownDmIdsRef.current.add(novaDm.id);
      setTexto('');
      limparAudioPreview();
      setShowInputEmojiPicker(false);
      setPrimeiraNaoLidaId(null);
      recarregarDadosDm();
      rolarAteOFim();
      return;
    }

    // Modo Chat de Concurso: bloqueia estritamente envio caso a sala seja restrita (Aprovados ou Lote) e o usuário não tenha acesso
    if (salaAtiva.restrito && !salaAtiva.temAcesso) {
      return;
    }

    const cores = ['#0D5C75', '#0F766E', '#1D4ED8', '#6366F1', '#475569'];
    const corHash =
      cores[
        nomeAutor.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % cores.length
      ];
    const currentSenderId = chatStore.obterIdentificadorUsuario(
      usuario || {
        nome: nomeAutor,
        email: emailAutor,
        is_admin: isUserAdmin,
      }
    );

    const nova = chatStore.enviarMensagem(concursoAtivoId, salaAtiva.cargoScope, 'geral', {
      sender_id: currentSenderId,
      autor: nomeAutor,
      email: emailAutor,
      avatar_cor: corHash,
      texto: textoLimpo,
      is_admin: isUserAdmin,
      is_fixado: false,
      posicao_candidato: salaAtiva.posicaoUsuarioNoCargo,
      curtidas: 0,
      curtido_por: [],
      reacoes: {},
      ...(temAudio && audioPreviewBase64
        ? {
            audio_base64: audioPreviewBase64,
            audio_duracao: audioPreviewDuracao || 1,
            audio_mime_type: audioPreviewMimeType,
          }
        : {}),
    });

    if (temAudio && audioPreviewBase64) {
      salvarAudioBlobOffline(
        nova.id,
        audioPreviewBase64,
        audioPreviewDuracao || 1,
        audioPreviewMimeType
      );
    }

    selfSentMsgIdsRef.current.add(nova.id);
    knownMsgIdsRef.current.add(nova.id);

    setTexto('');
    limparAudioPreview();
    setShowInputEmojiPicker(false);
    setPrimeiraNaoLidaId(null);
    carregarMensagensAtivas();
    rolarAteOFim();
  };

  const handleCurtir = (msgId: string) => {
    chatStore.curtirMensagem(concursoAtivoId, salaAtiva.cargoScope, 'geral', msgId, usuario);
    carregarMensagensAtivas();
  };

  const handleReagir = (msgId: string, emoji: string) => {
    chatStore.reagirEmoji(concursoAtivoId, salaAtiva.cargoScope, 'geral', msgId, emoji, usuario);
    setEmojisFrequentes(chatStore.getEmojisFrequentes(8));
    setEmojiPickerMsgId(null);
    carregarMensagensAtivas();
  };

  const handleReenviar = async (msgId: string) => {
    await chatStore.reenviarMensagem(concursoAtivoId, salaAtiva.cargoScope, 'geral', msgId);
    carregarMensagensAtivas();
  };

  const handleInserirEmojiTexto = (emoji: string) => {
    setTexto((prev) => `${prev}${emoji}`);
    chatStore.registrarUsoEmoji(emoji);
    setEmojisFrequentes(chatStore.getEmojisFrequentes(8));
  };

  const totalUnreadConcursos = (Object.values(unreadByConcurso) as number[]).reduce(
    (acc, n) => acc + n,
    0
  );
  const totalUnreadDms = useMemo(
    () => dmConversas.reduce((acc, c) => acc + (c.naoLidas || 0), 0),
    [dmConversas]
  );
  const totalUnread = totalUnreadConcursos + totalUnreadDms;

  const dmConversasFiltradas = useMemo(() => {
    const q = dmBusca.trim().toLowerCase();
    if (!q) return dmConversas;
    return dmConversas.filter(
      (c) => c.nome.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)
    );
  }, [dmConversas, dmBusca]);

  const sugestoesNovosContatosDm = useMemo<SugestaoContatoDm[]>(() => {
    if (!meuEmail) return [];
    const todos = dmStore.getSugestoesContatos(meuEmail, dmBusca);
    const emailsComConversa = new Set(dmConversas.map((c) => c.email.trim().toLowerCase()));
    return todos.filter((s) => !emailsComConversa.has(s.email.trim().toLowerCase()));
  }, [meuEmail, dmBusca, dmConversas, dadosVersion]);

  const renderIconeSala = (sala: SalaChatConcurso) => {
    if (sala.restrito && !sala.temAcesso) {
      return <Lock className="w-3 h-3 text-amber-600 shrink-0" />;
    }
    switch (sala.tipo) {
      case 'geral':
        return <Users className="w-3 h-3 text-teal-600 shrink-0" />;
      case 'cargo':
        return <Briefcase className="w-3 h-3 text-sky-600 shrink-0" />;
      case 'aprovados':
        return <Award className="w-3 h-3 text-emerald-600 shrink-0" />;
      case 'lote':
        return <Layers className="w-3 h-3 text-indigo-600 shrink-0" />;
    }
  };

  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [sidebarRetraido, setSidebarRetraido] = useState(false);
  const dragRelRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const handleMouseDownHeader = (e: React.MouseEvent) => {
    setDragging(true);
    const box = (e.currentTarget as HTMLElement).closest('.chat-widget-box')?.getBoundingClientRect() || { left: window.innerWidth - 600, top: window.innerHeight - 600 };
    dragRelRef.current = {
      x: e.clientX - box.left,
      y: e.clientY - box.top,
    };
    e.stopPropagation();
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragging) return;
      const newX = Math.max(10, Math.min(window.innerWidth - 120, e.clientX - dragRelRef.current.x));
      const newY = Math.max(10, Math.min(window.innerHeight - 100, e.clientY - dragRelRef.current.y));
      setPos({ x: newX, y: newY });
    };
    const handleMouseUp = () => setDragging(false);

    if (dragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging]);

  return (
    <div
      className="fixed z-[45] flex flex-col items-end max-w-[calc(100vw-1rem)] chat-widget-box"
      style={
        pos
          ? { left: `${pos.x}px`, top: `${pos.y}px`, bottom: 'auto', right: 'auto' }
          : { bottom: '24px', right: '24px' }
      }
    >
      {/* Balãozinho flutuante compacto no canto inferior direito seguindo o padrão visual do botão de abrir conversas */}
      {resumoBanner && (
        <div
          className="floating-bubble animate-floating-bubble mb-2.5 flex items-center gap-2.5 bg-gradient-to-r from-[#07192B] via-[#0B2D48] to-[#0F766E] text-white px-3.5 py-2.5 rounded-2xl shadow-2xl border border-teal-400/40 ring-4 ring-teal-500/15 w-[280px] sm:w-[320px] max-w-[calc(100vw-1.5rem)] animate-in slide-in-from-bottom-3 duration-200"
          role="status"
          aria-live="polite"
        >
          <button
            type="button"
            onClick={() => {
              if (resumoBanner.modo === 'privadas' && resumoBanner.dmEmail) {
                setAbaModo('privadas');
                setDmContatoEmail(resumoBanner.dmEmail);
                setDmContatoNome(resumoBanner.autor);
              } else {
                setAbaModo('concursos');
                if (resumoBanner.concursoId) setConcursoAtivoId(resumoBanner.concursoId);
                if (resumoBanner.salaId) setSalaAtivaId(resumoBanner.salaId);
              }
              setMobileViewMode('mensagens');
              setIsOpen(true);
              setResumoBanner(null);
            }}
            className="flex items-center gap-2.5 flex-1 min-w-0 text-left cursor-pointer"
          >
            <div className="relative flex items-center justify-center w-8 h-8 rounded-xl bg-teal-500/20 border border-teal-300/30 shrink-0">
              {resumoBanner.modo === 'privadas' ? (
                <MessageCircle className="w-4 h-4 text-teal-300" />
              ) : (
                <MessageSquare className="w-4 h-4 text-teal-300" />
              )}
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-[#07192B]" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-extrabold uppercase tracking-wide bg-teal-400/20 text-teal-200 px-1.5 py-0.2 rounded border border-teal-400/30 truncate max-w-[110px]">
                  {resumoBanner.concursoSigla}
                </span>
                <span className="text-[10px] font-bold text-teal-200/90 truncate max-w-[100px]">
                  {resumoBanner.salaTitulo}
                </span>
                <span className="text-[9px] text-teal-200/70 ml-auto shrink-0">
                  {resumoBanner.dataHora}
                </span>
              </div>
              <p className="text-[11px] font-bold text-white truncate mt-0.5">
                {resumoBanner.autor.split(' ')[0]}:{' '}
                <span className="font-normal text-teal-100/95">{resumoBanner.resumoTexto}</span>
              </p>
            </div>
          </button>

          <div className="flex items-center gap-0.5 shrink-0 border-l border-teal-400/25 pl-1.5">
            <button
              type="button"
              onClick={() => {
                if (resumoBanner.modo === 'privadas' && resumoBanner.dmEmail) {
                  chatStore.alternarSilenciarDm(resumoBanner.dmEmail);
                } else if (resumoBanner.concursoId) {
                  chatStore.alternarSilenciarSala(
                    resumoBanner.concursoId,
                    resumoBanner.salaId || 'geral'
                  );
                }
                setResumoBanner(null);
                setMuteVersion((v) => v + 1);
              }}
              className="p-1 text-teal-200/80 hover:text-amber-300 hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
              title="Silenciar esta conversa"
            >
              <BellOff className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setResumoBanner(null)}
              className="p-1 text-teal-200/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
              title="Fechar notificação"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Botão Flutuante Sempre em Destaque quando minimizado */}
      {!isOpen ? (
        <button
          type="button"
          onClick={() => {
            if (browserNotificationPermission === 'default') {
              void solicitarPermissaoNotificacaoNavegador();
            }
            setIsOpen(true);
            setResumoBanner(null);
          }}
          className="floating-bubble animate-floating-bubble group flex items-center gap-3 bg-gradient-to-r from-[#07192B] via-[#0B2D48] to-[#0F766E] hover:from-[#0A2540] hover:to-[#0D9488] text-white px-4 py-3 rounded-2xl shadow-2xl border border-teal-400/40 transition-all hover:scale-[1.02] cursor-pointer ring-4 ring-teal-500/15"
        >
          <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-teal-500/20 border border-teal-300/30">
            <MessageSquare className="w-5 h-5 text-teal-300" />
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-[#07192B]" />
            {totalUnread > 0 && (
              <span className="absolute -top-2 -right-2 bg-rose-500 text-white text-[10px] font-extrabold px-1.5 py-0.5 rounded-full min-w-[20px] text-center shadow-md animate-bounce">
                {totalUnread}
              </span>
            )}
          </div>
          <div className="text-left pr-1">
            <div className="text-xs font-extrabold tracking-wide flex items-center gap-1.5">
              <span>Chat & Mensagens</span>
              <span className="text-[10px] font-bold bg-teal-400/20 text-teal-200 px-1.5 py-0.5 rounded border border-teal-400/30">
                Ao Vivo
              </span>
            </div>
            <div className="text-[11px] text-teal-100/90 font-medium">
              {concursoAtivo?.orgao || 'Comunidade'} • {salasDoConcursoAtivo.length} chat(s)
              {totalUnreadDms > 0 ? ` • ${totalUnreadDms} DM(s)` : ''}
            </div>
          </div>
        </button>
      ) : (
        /* Janela Persistente do Chat com Layout de Lista Lateral Responsivo, Resizável e Movível */
        <div
          className={`bg-white rounded-2xl shadow-2xl border border-slate-300 flex flex-col overflow-hidden transition-all duration-200 ${
            isExpanded
              ? 'w-[96vw] sm:w-[720px] md:w-[800px]'
              : 'w-[94vw] sm:w-[580px] md:w-[640px]'
          }`}
          style={{ resize: 'both', overflow: 'auto', minWidth: '340px', minHeight: '460px', maxWidth: '98vw', maxHeight: '92vh' }}
        >
          {/* Cabeçalho Principal (Movível / Draggable) */}
          <div
            onMouseDown={handleMouseDownHeader}
            className="bg-gradient-to-r from-[#07192B] via-[#0A2540] to-[#0D3B56] px-3.5 py-2.5 text-white flex items-center justify-between gap-2 shrink-0 cursor-move select-none"
            title="Arraste para mover a janela do chat"
          >
            <div className="flex items-center gap-2 min-w-0">
              <button
                type="button"
                onClick={() =>
                  setMobileViewMode((prev) =>
                    prev === 'mensagens' ? 'conversas' : 'mensagens'
                  )
                }
                className="sm:hidden inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[10px] font-bold text-teal-200 border border-teal-400/30 cursor-pointer shrink-0"
                title={
                  mobileViewMode === 'mensagens'
                    ? 'Ver lista de conversas'
                    : 'Voltar para as mensagens'
                }
              >
                {mobileViewMode === 'mensagens' ? (
                  <>
                    <ListFilter className="w-3 h-3" />
                    <span>Conversas</span>
                    {totalUnread > 0 && (
                      <span className="bg-rose-500 text-white text-[9px] font-extrabold px-1.5 rounded-full">
                        {totalUnread}
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    <ChevronLeft className="w-3 h-3" />
                    <span>Mensagens</span>
                  </>
                )}
              </button>

              <div className="relative hidden sm:block">
                {abaModo === 'privadas' ? (
                  <MessageCircle className="w-4 h-4 text-teal-300 shrink-0" />
                ) : (
                  <MessageSquare className="w-4 h-4 text-teal-300 shrink-0" />
                )}
                <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400" />
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-extrabold tracking-wide truncate flex items-center gap-1.5">
                  <span>
                    {abaModo === 'privadas'
                      ? 'Mensagens Privadas'
                      : 'Chat dos Concursos'}
                  </span>
                  {salaAtualSilenciada && (
                    <span className="text-[9px] bg-amber-500/30 text-amber-200 border border-amber-400/40 px-1.5 py-0.2 rounded">
                      Silenciado
                    </span>
                  )}
                </h4>
                <p className="text-[10px] text-teal-200 truncate">
                  {abaModo === 'privadas'
                    ? dmContatoNome
                      ? `Conversa direta com ${dmContatoNome}`
                      : 'Comunicação direta 1 a 1 entre candidatos'
                    : `${concursoAtivo?.orgao || concursoAtivo?.nome} • ${salaAtiva.tituloCurto}`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0" onMouseDown={(e) => e.stopPropagation()}>
              {/* Botão Retrair / Expandir Menu de Conversas */}
              <button
                type="button"
                onClick={() => setSidebarRetraido(!sidebarRetraido)}
                title={sidebarRetraido ? 'Expandir menu de conversas' : 'Retrair menu de conversas'}
                className="p-1.5 rounded-lg hover:bg-white/10 text-teal-300 transition-colors cursor-pointer hidden sm:flex items-center gap-1 text-[10px] font-bold"
              >
                <ChevronLeft className={`w-3.5 h-3.5 transition-transform ${sidebarRetraido ? 'rotate-180' : ''}`} />
                <span className="hidden md:inline">{sidebarRetraido ? 'Expandir' : 'Retrair'}</span>
              </button>

              {/* Silenciar Conversa Atual */}
              <button
                type="button"
                onClick={handleToggleMuteSalaAtual}
                title={
                  salaAtualSilenciada
                    ? 'Ativar notificações desta conversa'
                    : 'Silenciar notificações desta conversa'
                }
                className={`p-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1 text-[10px] font-bold ${
                  salaAtualSilenciada
                    ? 'bg-amber-500/25 text-amber-300 border border-amber-400/40'
                    : 'hover:bg-white/10 text-slate-300'
                }`}
              >
                {salaAtualSilenciada ? (
                  <BellOff className="w-3.5 h-3.5" />
                ) : (
                  <Bell className="w-3.5 h-3.5" />
                )}
              </button>

              {/* Silenciar Concurso Inteiro */}
              {abaModo === 'concursos' && (
                <button
                  type="button"
                  onClick={handleToggleMuteConcursoAtual}
                  title={
                    concursoAtualSilenciado
                      ? 'Reativar notificações de todo este concurso'
                      : 'Silenciar todos os chats deste concurso'
                  }
                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                    concursoAtualSilenciado
                      ? 'bg-rose-500/25 text-rose-300 border border-rose-400/40'
                      : 'hover:bg-white/10 text-slate-300'
                  }`}
                >
                  {concursoAtualSilenciado ? (
                    <VolumeX className="w-3.5 h-3.5" />
                  ) : (
                    <Volume2 className="w-3.5 h-3.5" />
                  )}
                </button>
              )}

              {/* Exportar Histórico da Conversa Atual (.JSON) */}
              <button
                type="button"
                onClick={handleExportarConversaJson}
                title="Exportar histórico atual da conversa em arquivo JSON (Backup pessoal)"
                className="p-1.5 rounded-lg hover:bg-white/10 text-teal-300 hover:text-teal-200 transition-colors cursor-pointer flex items-center gap-1"
              >
                <Download className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                title={isExpanded ? 'Restaurar tamanho' : 'Expandir janela do chat'}
                className="p-1.5 rounded-lg hover:bg-white/10 text-slate-300 transition-colors cursor-pointer"
              >
                {isExpanded ? (
                  <Minimize2 className="w-3.5 h-3.5" />
                ) : (
                  <Maximize2 className="w-3.5 h-3.5" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                title="Minimizar chat (permanece ativo na tela)"
                className="p-1.5 rounded-lg hover:bg-white/10 text-slate-300 transition-colors cursor-pointer"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Corpo com Lista Lateral Responsiva + Painel de Mensagens */}
          <div className="flex flex-1 min-h-0 overflow-hidden">
            {/* Lista Lateral Responsiva: Alterna entre Concursos e Mensagens Privadas */}
            <aside
              className={`${
                sidebarRetraido ? 'hidden sm:hidden' : mobileViewMode === 'conversas' ? 'flex w-full' : 'hidden sm:flex'
              } sm:w-48 md:w-56 bg-slate-900 border-r border-slate-800 flex-col shrink-0`}
            >
              {/* Seletor Principal: Concursos vs Mensagens Privadas */}
              <div className="p-1.5 bg-slate-950 border-b border-slate-800 grid grid-cols-2 gap-1">
                <button
                  type="button"
                  onClick={() => setAbaModo('concursos')}
                  className={`px-2 py-1.5 rounded-lg text-[10px] font-extrabold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                    abaModo === 'concursos'
                      ? 'bg-teal-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <MessageSquare className="w-3 h-3 shrink-0" />
                  <span>Concursos</span>
                  {totalUnreadConcursos > 0 && (
                    <span className="bg-rose-500 text-white text-[9px] font-extrabold px-1.5 py-0.2 rounded-full leading-none">
                      {totalUnreadConcursos}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (!usuario && !isAdmin) {
                      onRequireAuth?.();
                      return;
                    }
                    setAbaModo('privadas');
                    if (!dmContatoEmail && dmConversas.length > 0) {
                      setDmContatoEmail(dmConversas[0].email);
                      setDmContatoNome(dmConversas[0].nome);
                    }
                  }}
                  className={`px-2 py-1.5 rounded-lg text-[10px] font-extrabold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                    abaModo === 'privadas'
                      ? 'bg-teal-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <MessageCircle className="w-3 h-3 shrink-0" />
                  <span>Privadas</span>
                  {totalUnreadDms > 0 && (
                    <span className="bg-rose-500 text-white text-[9px] font-extrabold px-1.5 py-0.2 rounded-full leading-none">
                      {totalUnreadDms}
                    </span>
                  )}
                </button>
              </div>

              {abaModo === 'concursos' ? (
                <>
                  {/* Seletor de Concurso no topo do Painel Lateral */}
                  <div className="px-2.5 py-2 border-b border-slate-800 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400">
                        Concurso Ativo ({concursos.length})
                      </span>
                      {totalUnreadConcursos > 0 && (
                        <span className="bg-rose-500 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-full leading-none">
                          {totalUnreadConcursos} nova(s)
                        </span>
                      )}
                    </div>
                    <div className="space-y-1 max-h-24 overflow-y-auto pr-0.5">
                      {concursos.map((c) => {
                        const ativo = c.id === concursoAtivoId;
                        const unread = unreadByConcurso[c.id] || 0;
                        const concSilenciado = chatStore.isConcursoSilenciado(c.id);
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              setConcursoAtivoId(c.id);
                              setCategoriaFiltroLateral('todas');
                            }}
                            className={`w-full px-2 py-1.5 rounded-lg text-left flex items-center justify-between gap-1.5 transition-all cursor-pointer border ${
                              ativo
                                ? 'bg-teal-600 text-white border-teal-400/60 shadow-2xs'
                                : unread > 0
                                ? 'bg-slate-800/95 text-white border-teal-500/40 hover:bg-slate-800'
                                : 'bg-slate-800/50 text-slate-300 border-slate-800 hover:bg-slate-800 hover:text-white'
                            }`}
                          >
                            <span className="text-[11px] font-extrabold truncate">
                              {c.orgao || c.nome.substring(0, 16)}
                            </span>
                            <div className="flex items-center gap-1 shrink-0">
                              {concSilenciado && (
                                <BellOff className="w-2.5 h-2.5 text-amber-300 shrink-0" />
                              )}
                              {unread > 0 && (
                                <span
                                  className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-full min-w-[16px] text-center leading-none ${
                                    concSilenciado
                                      ? 'bg-amber-400 text-slate-950'
                                      : 'bg-rose-500 text-white'
                                  }`}
                                >
                                  {unread}
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Status dinâmico de permissão do usuário via useChatPermissions */}
                  <div className="px-2.5 py-1.5 bg-slate-950/60 border-b border-slate-800/90 flex items-center justify-between gap-1">
                    <span className="text-[9px] font-bold text-slate-400 truncate">
                      {isAdmin ? (
                        <span className="text-teal-300 font-extrabold">
                          Admin • Todas categorias
                        </span>
                      ) : (Object.values(aprovacoesPorCargo) as Array<{ aprovado?: boolean }>).some(
                          (p) => p?.aprovado
                        ) ? (
                        <span className="text-emerald-300 font-extrabold">
                          Aprovado • Chats liberados
                        </span>
                      ) : usuario?.cargo_id ? (
                        <span className="text-slate-300">Cargo vinculado</span>
                      ) : (
                        <span>Acesso Público (Geral/Cargo)</span>
                      )}
                    </span>
                    <span className="text-[9px] font-mono text-teal-400 font-bold shrink-0">
                      {categoriasVisiveis.reduce((acc, cat) => acc + cat.salas.length, 0)} sala(s)
                    </span>
                  </div>

                  {/* Filtro rápido de categorias no Painel Lateral */}
                  <div className="px-2 py-1.5 border-b border-slate-800 flex items-center gap-1 overflow-x-auto no-scrollbar">
                    {(
                      [
                        { id: 'todas', label: 'Todos' },
                        { id: 'geral', label: 'Geral' },
                        { id: 'cargo', label: 'Cargo' },
                        { id: 'aprovados', label: 'Aprovados' },
                        { id: 'lote', label: 'Lotes' },
                      ] as const
                    ).map((f) => {
                      const isAtivo = categoriaFiltroLateral === f.id;
                      return (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => setCategoriaFiltroLateral(f.id)}
                          className={`px-1.5 py-0.5 rounded-md text-[9px] font-extrabold whitespace-nowrap transition-colors cursor-pointer ${
                            isAtivo
                              ? 'bg-teal-500 text-slate-950'
                              : 'bg-slate-800/90 text-slate-400 hover:text-white'
                          }`}
                        >
                          {f.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Lista Lateral de Chats Ativos Agrupados por Categoria (via useChatPermissions) */}
                  <div
                    className={`overflow-y-auto p-1.5 space-y-2.5 ${
                      isExpanded ? 'h-[335px]' : 'h-[235px]'
                    }`}
                  >
                    {categoriasVisiveis
                      .filter(
                        (cat) =>
                          categoriaFiltroLateral === 'todas' || cat.id === categoriaFiltroLateral
                      )
                      .map((cat) => {
                        const CatIcon =
                          cat.id === 'geral'
                            ? Users
                            : cat.id === 'cargo'
                            ? Briefcase
                            : cat.id === 'aprovados'
                            ? Award
                            : Layers;

                        return (
                          <div key={cat.id} className="space-y-1">
                            <div className="px-1.5 py-0.5 flex items-center justify-between">
                              <span className="text-[9px] font-extrabold uppercase tracking-wider text-teal-400 flex items-center gap-1">
                                <CatIcon className="w-2.5 h-2.5 shrink-0" />
                                <span>{cat.titulo}</span>
                              </span>
                              <span className="text-[9px] font-mono text-slate-400">
                                {cat.salas.length}
                              </span>
                            </div>

                            {cat.salas.map((sala) => {
                              if (!podeRenderizarSala(sala)) return null;
                              const ativa = salaAtiva.id === sala.id;
                              const roomKey = `${concursoAtivoId}_${sala.id}`;
                              const unreadSala = unreadBySala[roomKey] || 0;
                              const silenciada = chatStore.isSalaSilenciada(
                                concursoAtivoId,
                                sala.id
                              );
                              const ultimaDaSala = ultimaMsgPorSala[roomKey];
                              const resumoSala = ultimaDaSala
                                ? `${ultimaDaSala.autor.split(' ')[0]}: ${
                                    ultimaDaSala.texto.length > 22
                                      ? `${ultimaDaSala.texto.substring(0, 22)}...`
                                      : ultimaDaSala.texto
                                  }`
                                : sala.cargoNome || sala.descricao;

                              return (
                                <button
                                  key={sala.id}
                                  type="button"
                                  onClick={() => {
                                    setSalaAtivaId(sala.id);
                                    setMobileViewMode('mensagens');
                                  }}
                                  className={`w-full px-2 py-1.5 rounded-xl text-left flex flex-col justify-between transition-all cursor-pointer border ${
                                    ativa
                                      ? 'bg-teal-600/95 text-white border-teal-300/60 shadow-xs'
                                      : unreadSala > 0
                                      ? 'bg-slate-800/95 text-white border-teal-500/40 hover:bg-slate-800'
                                      : 'bg-slate-800/50 text-slate-300 border-slate-800/90 hover:bg-slate-800 hover:text-white'
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-1 w-full">
                                    <span className="text-[10px] font-extrabold truncate">
                                      {sala.tituloCurto}
                                    </span>
                                    <div className="flex items-center gap-1 shrink-0">
                                      {sala.posicaoUsuarioNoCargo && (
                                        <span
                                          className={`text-[8px] font-mono px-1 py-0.2 rounded ${
                                            ativa
                                              ? 'bg-slate-950/35 text-teal-100'
                                              : 'bg-teal-950 text-teal-300 border border-teal-700/50'
                                          }`}
                                          title={`Sua classificação neste cargo: ${sala.posicaoUsuarioNoCargo}º`}
                                        >
                                          {sala.posicaoUsuarioNoCargo}º
                                        </span>
                                      )}
                                      {silenciada && (
                                        <BellOff className="w-2.5 h-2.5 text-amber-300 shrink-0" />
                                      )}
                                      {unreadSala > 0 && (
                                        <span className="bg-rose-500 text-white text-[9px] font-extrabold px-1.5 py-0.2 rounded-full leading-none">
                                          {unreadSala}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <span
                                    className={`text-[9px] truncate w-full mt-0.5 leading-tight ${
                                      ativa
                                        ? 'text-teal-100'
                                        : unreadSala > 0
                                        ? 'text-teal-300 font-semibold'
                                        : 'text-slate-400'
                                    }`}
                                  >
                                    {resumoSala}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        );
                      })}

                    {categoriasVisiveis.filter(
                      (cat) =>
                        categoriaFiltroLateral === 'todas' || cat.id === categoriaFiltroLateral
                    ).length === 0 && (
                      <div className="text-center py-6 px-2 text-[10px] text-slate-400">
                        Nenhum chat disponível nesta categoria para seu cargo ou status atual.
                      </div>
                    )}
                  </div>
                </>
              ) : (
                /* Lista Lateral de Mensagens Privadas (DMs) */
                <>
                  <div className="p-2 border-b border-slate-800">
                    <div className="relative">
                      <Search className="w-3 h-3 text-slate-400 absolute left-2.5 top-2" />
                      <input
                        type="text"
                        value={dmBusca}
                        onChange={(e) => setDmBusca(e.target.value)}
                        placeholder="Buscar colega ou iniciar DM..."
                        className="w-full pl-7 pr-2 py-1 bg-slate-800 border border-slate-700 rounded-lg text-[10px] text-white placeholder-slate-400 focus:border-teal-400 outline-hidden"
                      />
                    </div>
                  </div>

                  <div
                    className={`overflow-y-auto p-1.5 space-y-1 ${
                      isExpanded ? 'h-[445px]' : 'h-[345px]'
                    }`}
                  >
                    {dmConversasFiltradas.map((conv) => {
                      const ativo =
                        dmContatoEmail?.trim().toLowerCase() ===
                        conv.email.trim().toLowerCase();
                      const dmSilenciada = chatStore.isDmSilenciada(conv.email);
                      return (
                        <button
                          key={conv.email}
                          type="button"
                          onClick={() => {
                            setDmContatoEmail(conv.email);
                            setDmContatoNome(conv.nome);
                            setMobileViewMode('mensagens');
                          }}
                          className={`w-full px-2.5 py-2 rounded-xl text-left flex flex-col justify-between transition-all cursor-pointer border ${
                            ativo
                              ? 'bg-teal-600 text-white border-teal-400/50 shadow-sm'
                              : conv.naoLidas > 0
                              ? 'bg-slate-800/95 text-white border-teal-500/50 hover:bg-slate-800'
                              : 'bg-slate-800/60 text-slate-300 border-slate-800 hover:bg-slate-800 hover:text-white'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1 w-full">
                            <span className="text-[11px] font-extrabold truncate">
                              {conv.nome}
                            </span>
                            <div className="flex items-center gap-1 shrink-0">
                              {dmSilenciada && (
                                <BellOff className="w-2.5 h-2.5 text-amber-300 shrink-0" />
                              )}
                              {conv.naoLidas > 0 && (
                                <span className="bg-rose-500 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none">
                                  {conv.naoLidas}
                                </span>
                              )}
                            </div>
                          </div>
                          <span
                            className={`text-[10px] truncate w-full mt-1 leading-tight ${
                              ativo
                                ? 'text-teal-100'
                                : conv.naoLidas > 0
                                ? 'text-teal-300 font-semibold'
                                : 'text-slate-400'
                            }`}
                          >
                            {conv.ultimaMensagem || 'Conversa iniciada'}
                          </span>
                        </button>
                      );
                    })}

                    {/* Sugestões para iniciar nova conversa privada */}
                    {sugestoesNovosContatosDm.length > 0 && (
                      <div className="pt-2">
                        <span className="px-2 text-[9px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                          {dmBusca.trim() ? 'Resultados no Portal' : 'Iniciar Nova Conversa'}
                        </span>
                        <div className="space-y-1">
                          {sugestoesNovosContatosDm.slice(0, 8).map((sug) => (
                            <button
                              key={sug.email}
                              type="button"
                              onClick={() => {
                                setDmContatoEmail(sug.email);
                                setDmContatoNome(sug.nome);
                                setDmBusca('');
                                setMobileViewMode('mensagens');
                              }}
                              className="w-full px-2.5 py-1.5 rounded-lg text-left bg-slate-800/40 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800/80 transition-colors cursor-pointer"
                            >
                              <div className="text-[10px] font-bold truncate">{sug.nome}</div>
                              <div className="text-[9px] text-slate-400 truncate">
                                {sug.detalhe || sug.email}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {dmConversasFiltradas.length === 0 && sugestoesNovosContatosDm.length === 0 && (
                      <div className="p-4 text-center text-[10px] text-slate-400">
                        Nenhuma conversa privada encontrada. Clique no ícone de mensagem em qualquer colega do chat para conversar em privado.
                      </div>
                    )}
                  </div>
                </>
              )}
            </aside>

            {/* Painel Principal de Mensagens */}
            <div
              className={`${
                mobileViewMode === 'conversas' ? 'hidden sm:flex' : 'flex'
              } flex-1 flex-col min-w-0 bg-white relative`}
            >
              {abaModo === 'concursos' ? (
                <>
                  {/* Sub-abas dos Chats do Concurso: Geral, Cargo (pré-homologação), Aprovados e Lotes */}
                  <div className="bg-slate-100 px-2.5 py-1.5 flex flex-col gap-1 border-b border-slate-200 shrink-0">
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
                        {salasDoConcursoAtivo.map((sala) => {
                          const ativo = salaAtiva.id === sala.id;
                          const silenciado = chatStore.isSalaSilenciada(
                            concursoAtivoId,
                            sala.id
                          );
                          const unreadSala =
                            unreadBySala[`${concursoAtivoId}_${sala.id}`] || 0;
                          const bloqueada = sala.restrito && !sala.temAcesso;

                          return (
                            <button
                              key={sala.id}
                              type="button"
                              onClick={() => setSalaAtivaId(sala.id)}
                              title={sala.descricao}
                              className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 shrink-0 border ${
                                ativo
                                  ? 'bg-white text-teal-900 shadow-2xs border-teal-500/50'
                                  : bloqueada
                                  ? 'bg-slate-200/70 text-slate-500 border-slate-300/60 hover:text-slate-700'
                                  : 'bg-white/60 text-slate-700 border-slate-200/70 hover:bg-white hover:text-slate-900'
                              }`}
                            >
                              {renderIconeSala(sala)}
                              <span>{sala.tituloCurto}</span>
                              {silenciado && (
                                <BellOff className="w-2.5 h-2.5 text-amber-600 shrink-0" />
                              )}
                              {!bloqueada && unreadSala > 0 && (
                                <span
                                  className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded-full ${
                                    silenciado
                                      ? 'bg-amber-500 text-white'
                                      : 'bg-rose-500 text-white'
                                  }`}
                                >
                                  {unreadSala}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>

                      <button
                        type="button"
                        onClick={handleToggleMuteSalaAtual}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md border flex items-center gap-1 shrink-0 cursor-pointer transition-colors ${
                          salaAtualSilenciada
                            ? 'bg-amber-50 border-amber-300 text-amber-800'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                        title="Alternar silenciamento de notificações desta conversa"
                      >
                        {salaAtualSilenciada ? (
                          <>
                            <BellOff className="w-2.5 h-2.5 text-amber-600" /> Silenciado
                          </>
                        ) : (
                          <>
                            <Bell className="w-2.5 h-2.5 text-teal-600" /> Notificar
                          </>
                        )}
                      </button>
                    </div>

                    {/* Faixa descritiva do escopo da sala atual */}
                    <div className="flex items-center justify-between gap-2 text-[10px] text-slate-500 px-0.5">
                      <span className="truncate">{salaAtiva.descricao}</span>
                      {salaAtiva.restrito && salaAtiva.temAcesso && (
                        <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded shrink-0">
                          ✓ Acesso Autorizado
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Validação de segurança via useChatPermissions antes de renderizar o Chat dos Aprovados ou Chat do Lote */}
                  {!podeRenderizarSala(salaAtiva) || (salaAtiva.restrito && !salaAtiva.temAcesso) ? (
                    <div
                      className={`flex flex-col items-center justify-center text-center p-6 bg-slate-50/80 shrink-0 ${
                        isExpanded ? 'h-[455px]' : 'h-[355px]'
                      }`}
                    >
                      <div className="w-11 h-11 rounded-2xl bg-amber-100 text-amber-700 border border-amber-300 flex items-center justify-center mb-3 shadow-xs">
                        <Lock className="w-5 h-5" />
                      </div>
                      <h5 className="text-xs font-extrabold text-slate-900 mb-1">
                        {salaAtiva.tipo === 'aprovados'
                          ? 'Chat Exclusivo dos Candidatos Aprovados'
                          : `Chat Exclusivo dos Convocados (${salaAtiva.loteNome})`}
                      </h5>
                      <p className="text-[11px] text-slate-600 max-w-xs leading-relaxed mb-4">
                        {salaAtiva.motivoBloqueio}
                      </p>
                      <div className="flex items-center gap-2">
                        {!usuario && (
                          <button
                            type="button"
                            onClick={() => onRequireAuth?.()}
                            className="px-3.5 py-2 rounded-xl bg-[#07192B] hover:bg-[#0C2640] text-[#2DD4AA] text-xs font-bold cursor-pointer transition-colors"
                          >
                            Entrar na minha conta
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setSalaAtivaId('geral')}
                          className="px-3 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-bold cursor-pointer transition-colors"
                        >
                          Ir para o Chat Geral
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Barra de Busca em Tempo Real no Histórico de Mensagens */}
                      <div className="px-2.5 py-1.5 bg-white border-b border-slate-200/80 flex items-center gap-1.5 shrink-0">
                        <div className="relative flex-1">
                          <Search className="w-3 h-3 text-slate-400 absolute left-2.5 top-2" />
                          <input
                            type="text"
                            value={termoBuscaHistorico}
                            onChange={(e) => setTermoBuscaHistorico(e.target.value)}
                            placeholder="Buscar no histórico desta conversa..."
                            className="w-full pl-7 pr-6 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[10px] text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:border-teal-500 focus:bg-white"
                          />
                          {termoBuscaHistorico && (
                            <button
                              type="button"
                              onClick={() => setTermoBuscaHistorico('')}
                              className="absolute right-1.5 top-1.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                              title="Limpar busca"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                        {termoBuscaHistorico.trim() && (
                          <span className="text-[9px] font-mono font-bold text-teal-700 bg-teal-50 border border-teal-200 px-1.5 py-0.5 rounded shrink-0">
                            {mensagensFiltradasBusca.length} resultado(s)
                          </span>
                        )}
                      </div>

                      {/* Container de tamanho fixo com overflow-y-auto posicionado a partir da mensagem mais antiga não lida */}
                      <div
                        ref={messagesContainerRef}
                        onScroll={handleContainerScroll}
                        className={`overflow-y-auto overscroll-contain p-3 space-y-2.5 bg-slate-50/60 shrink-0 relative ${
                          isExpanded ? 'h-[365px]' : 'h-[265px]'
                        }`}
                      >
                        {mensagensFiltradasBusca.length === 0 ? (
                          <div className="text-center py-12 px-4 text-slate-400 text-xs">
                            {termoBuscaHistorico.trim() ? (
                              <>
                                Nenhuma mensagem encontrada contendo{' '}
                                <strong>"{termoBuscaHistorico}"</strong>.
                              </>
                            ) : (
                              <>
                                Nenhuma mensagem em <strong>{salaAtiva.tituloCurto}</strong> de{' '}
                                {concursoAtivo?.orgao}. Inicie a conversa!
                              </>
                            )}
                          </div>
                        ) : (
                          (() => {
                            const listaVisivel = mensagensFiltradasBusca.slice(
                              Math.max(0, mensagensFiltradasBusca.length - limiteMensagensExibidas)
                            );
                            return listaVisivel.map((msg) => {
                            const jaCurtiu = chatStore.usuarioCurtiuMensagem(msg, usuario);
                            const minhaReacao = chatStore.obterReacaoDoUsuario(msg, usuario);
                            const totalCurtidas = Array.isArray(msg.curtido_por)
                              ? msg.curtido_por.length
                              : 0;
                            const reacoesEntries = Object.entries(msg.reacoes || {}).filter(
                              ([, users]) => Array.isArray(users) && users.length > 0
                            );
                            const isPrimeiraNaoLida = primeiraNaoLidaId === msg.id;
                            const ehMinhaMsg = chatStore.isMensagemDoProprioUsuario(
                              msg,
                              usuario
                            );
                            const readStatus = getMessageReadStatus(msg.id);

                            return (
                              <React.Fragment key={msg.id}>
                                {isPrimeiraNaoLida && (
                                  <div className="flex items-center gap-2 my-1.5">
                                    <div className="h-px bg-teal-400/60 flex-1" />
                                    <span className="text-[9px] font-extrabold uppercase tracking-wider bg-teal-600 text-white px-2.5 py-0.5 rounded-full shadow-2xs">
                                      Mensagens não lidas a partir daqui
                                    </span>
                                    <div className="h-px bg-teal-400/60 flex-1" />
                                  </div>
                                )}
                                <div
                                  data-chat-msg-id={msg.id}
                                  className={`rounded-xl p-2.5 border text-xs transition-all ${
                                    isPrimeiraNaoLida
                                      ? 'bg-teal-50/70 border-teal-300 ring-1 ring-teal-400/40'
                                      : msg.is_fixado
                                      ? 'bg-amber-50/90 border-amber-200'
                                      : 'bg-white border-slate-200/80 shadow-2xs'
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-1 mb-1">
                                    <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                                      <span
                                        className="w-5 h-5 rounded-full text-white text-[9px] font-bold flex items-center justify-center shrink-0"
                                        style={{
                                          backgroundColor: msg.avatar_cor || '#0D5C75',
                                        }}
                                      >
                                        {msg.autor.substring(0, 2).toUpperCase()}
                                      </span>
                                      <span className="font-bold text-slate-900 truncate">
                                        {msg.autor}
                                      </span>
                                      {msg.is_admin && (
                                        <span className="bg-teal-700 text-white text-[9px] font-bold px-1.5 py-0.2 rounded flex items-center gap-0.5">
                                          <Shield className="w-2.5 h-2.5" /> Admin
                                        </span>
                                      )}
                                      {msg.posicao_candidato && (
                                        <span className="bg-slate-100 text-slate-700 border border-slate-200 text-[9px] font-mono font-bold px-1.5 py-0.2 rounded">
                                          {msg.posicao_candidato}º lugar
                                        </span>
                                      )}
                                      {msg.is_fixado && (
                                        <Pin className="w-3 h-3 text-amber-600 shrink-0" />
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                      {!ehMinhaMsg &&
                                        msg.email &&
                                        msg.email !== 'candidato@certam.com.br' && (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              handleIniciarConversaPrivada(
                                                msg.email,
                                                msg.autor
                                              )
                                            }
                                            className="p-1 rounded-md text-slate-400 hover:text-teal-700 hover:bg-teal-50 transition-colors cursor-pointer"
                                            title={`Enviar mensagem privada para ${msg.autor}`}
                                          >
                                            <Mail className="w-3 h-3" />
                                          </button>
                                        )}
                                      <span className="text-[10px] text-slate-400 font-mono shrink-0">
                                        {msg.data_hora}
                                      </span>
                                    </div>
                                  </div>

                                  <p className="text-slate-700 leading-relaxed whitespace-pre-line break-words mb-2">
                                    {destacarTextoBusca(msg.texto, termoBuscaHistorico)}
                                  </p>

                                  {msg.audio_base64 && (
                                    <div className="mb-2 p-2 rounded-xl bg-teal-50/70 border border-teal-200/80 flex flex-col gap-1">
                                      <div className="flex items-center justify-between text-[10px] font-bold text-teal-800">
                                        <span className="inline-flex items-center gap-1">
                                          <Mic className="w-3 h-3 text-teal-600" />
                                          <span>Mensagem de voz</span>
                                        </span>
                                        {typeof msg.audio_duracao === 'number' &&
                                          msg.audio_duracao > 0 && (
                                            <span className="font-mono text-[9px] bg-white px-1.5 py-0.5 rounded border border-teal-200">
                                              {formatarDuracaoAudio(msg.audio_duracao)}
                                            </span>
                                          )}
                                      </div>
                                      <audio
                                        controls
                                        preload="metadata"
                                        src={msg.audio_base64}
                                        className="w-full h-8"
                                      />
                                    </div>
                                  )}

                                  {msg.status_envio === 'enviando' && (
                                    <div className="mb-2 flex items-center gap-1.5 text-[10px] font-medium text-slate-500 bg-slate-50 px-2 py-1 rounded-lg border border-slate-200/80">
                                      <Loader2 className="w-3 h-3 animate-spin text-teal-600" />
                                      <span>Aguardando confirmação do servidor...</span>
                                    </div>
                                  )}

                                  {msg.status_envio === 'erro' && (
                                    <div className="mb-2 flex items-center justify-between gap-1.5 bg-rose-50 border border-rose-200 rounded-lg px-2.5 py-1.5 text-rose-800">
                                      <div className="flex items-center gap-1 text-[11px] font-semibold min-w-0">
                                        <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                                        <span className="truncate">
                                          {msg.erro_envio || 'Falha ao confirmar recebimento.'}
                                        </span>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => handleReenviar(msg.id)}
                                        className="inline-flex items-center gap-1 bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold px-2 py-1 rounded-md transition-colors cursor-pointer shrink-0"
                                        title="Reenviar mensagem manualmente"
                                      >
                                        <RotateCcw className="w-2.5 h-2.5" />
                                        <span>Reenviar</span>
                                      </button>
                                    </div>
                                  )}

                                  <div className="flex items-center justify-between gap-1 pt-1.5 border-t border-slate-100 flex-wrap">
                                    <div className="flex items-center gap-1 flex-wrap relative">
                                      {msg.status_envio !== 'enviando' &&
                                        msg.status_envio !== 'erro' && (
                                          <span
                                            className="inline-flex items-center text-emerald-600 px-1"
                                            title="Recebimento confirmado pelo servidor"
                                          >
                                            <CheckCheck className="w-3 h-3" />
                                          </span>
                                        )}
                                      {readStatus.isReadByOthers && (
                                        <span
                                          className="inline-flex items-center gap-0.5 text-[10px] font-bold text-teal-700 bg-teal-50 border border-teal-200/80 px-1.5 py-0.5 rounded-full"
                                          title={
                                            readStatus.readersCount > 1
                                              ? `Mensagem visualizada por ${readStatus.readersCount} participantes`
                                              : 'Mensagem visualizada por outro participante'
                                          }
                                        >
                                          <Eye className="w-3 h-3 text-teal-600" />
                                          {readStatus.readersCount > 1 && (
                                            <span className="text-[9px]">
                                              {readStatus.readersCount}
                                            </span>
                                          )}
                                        </span>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => handleCurtir(msg.id)}
                                        title={
                                          jaCurtiu
                                            ? 'Clique para retirar sua curtida'
                                            : 'Curtir mensagem (1 por usuário)'
                                        }
                                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border transition-all cursor-pointer ${
                                          jaCurtiu
                                            ? 'bg-rose-50 text-rose-600 border-rose-300'
                                            : 'bg-slate-50 text-slate-500 border-slate-200 hover:text-rose-600'
                                        }`}
                                      >
                                        <Heart
                                          className={`w-3 h-3 ${
                                            jaCurtiu ? 'fill-rose-500 text-rose-500' : ''
                                          }`}
                                        />
                                        <span>{totalCurtidas}</span>
                                      </button>

                                      {reacoesEntries.map(([emoji, users]) => {
                                        const euReagi = minhaReacao === emoji;
                                        return (
                                          <button
                                            key={emoji}
                                            type="button"
                                            onClick={() => handleReagir(msg.id, emoji)}
                                            title={
                                              euReagi
                                                ? 'Sua reação (clique para retirar)'
                                                : 'Clique para reagir'
                                            }
                                            className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[11px] border transition-all cursor-pointer ${
                                              euReagi
                                                ? 'bg-teal-50 border-teal-400 text-teal-800 font-bold'
                                                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                                            }`}
                                          >
                                            <span>{emoji}</span>
                                            <span className="text-[10px]">{users.length}</span>
                                          </button>
                                        );
                                      })}

                                      <button
                                        type="button"
                                        onClick={() =>
                                          setEmojiPickerMsgId(
                                            emojiPickerMsgId === msg.id ? null : msg.id
                                          )
                                        }
                                        className="p-1 rounded-full bg-slate-50 hover:bg-slate-100 text-slate-500 border border-slate-200 cursor-pointer"
                                        title="Reagir com qualquer emoji"
                                      >
                                        <Smile className="w-3 h-3" />
                                      </button>

                                      {emojiPickerMsgId === msg.id && (
                                        <div className="absolute left-0 bottom-7 z-50 bg-white border border-slate-200 rounded-2xl shadow-2xl p-2.5 w-64 sm:w-72">
                                          <div className="mb-2 pb-1.5 border-b border-slate-100">
                                            <div className="flex items-center justify-between mb-1">
                                              <span className="text-[9px] font-bold uppercase tracking-wider text-teal-700 flex items-center gap-1">
                                                <Sparkles className="w-2.5 h-2.5" /> Mais usados
                                                por você
                                              </span>
                                              <button
                                                type="button"
                                                onClick={() => setEmojiPickerMsgId(null)}
                                                className="text-[9px] font-bold text-slate-400 hover:text-slate-600 cursor-pointer"
                                              >
                                                Fechar
                                              </button>
                                            </div>
                                            <div className="grid grid-cols-8 gap-1 bg-teal-50/60 p-1 rounded-lg border border-teal-100">
                                              {emojisFrequentes.map((emj) => (
                                                <button
                                                  key={`freq-${emj}`}
                                                  type="button"
                                                  onClick={() => handleReagir(msg.id, emj)}
                                                  className={`text-sm p-1 rounded hover:bg-white hover:scale-110 transition-transform cursor-pointer ${
                                                    minhaReacao === emj
                                                      ? 'bg-teal-200/70 ring-1 ring-teal-500'
                                                      : ''
                                                  }`}
                                                >
                                                  {emj}
                                                </button>
                                              ))}
                                            </div>
                                          </div>

                                          <div className="flex items-center gap-1 mb-1.5 overflow-x-auto pb-1">
                                            {CATALOGO_EMOJIS_CATEGORIAS.map((cat) => (
                                              <button
                                                key={cat.id}
                                                type="button"
                                                onClick={() => setCategoriaEmojiAtiva(cat.id)}
                                                className={`text-[9px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap cursor-pointer ${
                                                  categoriaEmojiAtiva === cat.id
                                                    ? 'bg-slate-900 text-white'
                                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                                }`}
                                              >
                                                {cat.titulo.split(' ')[0]}
                                              </button>
                                            ))}
                                          </div>

                                          <div className="max-h-32 overflow-y-auto grid grid-cols-8 gap-1">
                                            {(
                                              CATALOGO_EMOJIS_CATEGORIAS.find(
                                                (c) => c.id === categoriaEmojiAtiva
                                              )?.emojis || TODOS_EMOJIS_CHAT
                                            ).map((emj, idx) => (
                                              <button
                                                key={`all-${emj}-${idx}`}
                                                type="button"
                                                onClick={() => handleReagir(msg.id, emj)}
                                                className={`text-sm p-1 rounded hover:bg-slate-100 hover:scale-110 transition-transform cursor-pointer ${
                                                  minhaReacao === emj
                                                    ? 'bg-teal-100 ring-1 ring-teal-500'
                                                    : ''
                                                }`}
                                              >
                                                {emj}
                                              </button>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </div>

                                    {isAdmin && (
                                      <div className="flex items-center gap-1.5">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            chatStore.alternarFixado(
                                              concursoAtivoId,
                                              salaAtiva.cargoScope,
                                              'geral',
                                              msg.id
                                            );
                                            carregarMensagensAtivas();
                                          }}
                                          className="text-[10px] text-amber-700 hover:underline cursor-pointer"
                                        >
                                          {msg.is_fixado ? 'Desafixar' : 'Fixar'}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            chatStore.apagarMensagem(
                                              concursoAtivoId,
                                              salaAtiva.cargoScope,
                                              'geral',
                                              msg.id
                                            );
                                            carregarMensagensAtivas();
                                          }}
                                          className="text-[10px] text-rose-600 hover:underline flex items-center gap-0.5 cursor-pointer"
                                        >
                                          <Trash2 className="w-2.5 h-2.5" />
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </React.Fragment>
                            );
                          });
                          })()
                        )}
                        <div ref={messagesEndRef} />
                       <div ref={bottomSentinelRef} className="h-2 w-full" />
                      </div>

                      {/* Badge / Botão Flutuante Temporário para novas mensagens enquanto lê o histórico */}
                      {novasMensagensNaoLidasCount > 0 && !isUserAtBottom && (
                        <button
                          type="button"
                          onClick={() => {
                            rolarAteOFim();
                            setNovasMensagensNaoLidasCount(0);
                          }}
                          className="absolute right-4 bottom-16 z-30 inline-flex items-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white text-[10px] font-extrabold px-3.5 py-2 rounded-full shadow-xl border border-teal-300/60 cursor-pointer transition-all hover:scale-105 animate-pulse"
                          title="Novas mensagens recebidas. Clique para rolar até o fim."
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                          <span>↓ {novasMensagensNaoLidasCount} nova(s) mensagem(ns)</span>
                        </button>
                      )}

                      {/* Botão Flutuante 'Ir ao final' exibido apenas quando o usuário rola para cima */}
                      {mostrarBotaoDescer && novasMensagensNaoLidasCount === 0 && mensagens.length > 0 && (
                        <button
                          type="button"
                          onClick={rolarAteOFim}
                          className="absolute right-4 bottom-16 z-30 inline-flex items-center gap-1.5 bg-[#07192B]/95 hover:bg-[#0C2640] text-[#2DD4AA] text-[10px] font-extrabold px-3 py-1.5 rounded-full shadow-lg border border-teal-400/40 cursor-pointer transition-all hover:scale-105"
                          title="Ir ao final da conversa para ver a mensagem mais recente"
                        >
                          <ArrowDown className="w-3.5 h-3.5 animate-bounce" />
                          <span>Ir ao final</span>
                        </button>
                      )}
                    </>
                  )}
                </>
              ) : (
                /* Painel Principal de Mensagens Privadas (DMs) */
                <>
                  {dmContatoEmail ? (
                    <>
                      <div className="bg-slate-100 px-3 py-2 flex items-center justify-between gap-2 border-b border-slate-200 shrink-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-7 h-7 rounded-full bg-[#135A7A] text-white flex items-center justify-center font-bold text-[10px] shrink-0">
                            {(dmContatoNome || dmContatoEmail).slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <span className="font-bold text-xs text-slate-900 block truncate leading-tight">
                              {dmContatoNome || dmContatoEmail}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono truncate block">
                              {dmContatoEmail}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={handleToggleMuteSalaAtual}
                            className={`text-[10px] font-bold px-2 py-1 rounded-md border flex items-center gap-1 cursor-pointer transition-colors ${
                              salaAtualSilenciada
                                ? 'bg-amber-50 border-amber-300 text-amber-800'
                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                            }`}
                            title="Alternar silenciamento desta conversa privada"
                          >
                            {salaAtualSilenciada ? (
                              <>
                                <BellOff className="w-3 h-3 text-amber-600" /> Silenciado
                              </>
                            ) : (
                              <>
                                <Bell className="w-3 h-3 text-teal-600" /> Notificar
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={handleToggleBloqueioDm}
                            className={`text-[10px] font-bold px-2 py-1 rounded-md border flex items-center gap-1 cursor-pointer transition-colors ${
                              dmIsBloqueado
                                ? 'bg-rose-50 border-rose-300 text-rose-700'
                                : 'bg-white border-slate-200 text-slate-600 hover:text-rose-600'
                            }`}
                            title={
                              dmIsBloqueado
                                ? 'Desbloquear este usuário'
                                : 'Bloquear mensagens deste usuário'
                            }
                          >
                            {dmIsBloqueado ? (
                              <>
                                <ShieldAlert className="w-3 h-3" /> Bloqueado
                              </>
                            ) : (
                              <>
                                <ShieldCheck className="w-3 h-3" /> Bloquear
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Barra de Busca em Tempo Real nas Mensagens Privadas */}
                      <div className="px-2.5 py-1.5 bg-white border-b border-slate-200/80 flex items-center gap-1.5 shrink-0">
                        <div className="relative flex-1">
                          <Search className="w-3 h-3 text-slate-400 absolute left-2.5 top-2" />
                          <input
                            type="text"
                            value={termoBuscaHistorico}
                            onChange={(e) => setTermoBuscaHistorico(e.target.value)}
                            placeholder="Buscar nesta conversa privada..."
                            className="w-full pl-7 pr-6 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[10px] text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:border-teal-500 focus:bg-white"
                          />
                          {termoBuscaHistorico && (
                            <button
                              type="button"
                              onClick={() => setTermoBuscaHistorico('')}
                              className="absolute right-1.5 top-1.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                              title="Limpar busca"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                        {termoBuscaHistorico.trim() && (
                          <span className="text-[9px] font-mono font-bold text-teal-700 bg-teal-50 border border-teal-200 px-1.5 py-0.5 rounded shrink-0">
                            {dmMensagensFiltradasBusca.length} resultado(s)
                          </span>
                        )}
                      </div>

                      <div
                        ref={messagesContainerRef}
                        onScroll={handleContainerScroll}
                        className={`overflow-y-auto overscroll-contain p-3 space-y-2.5 bg-slate-50/60 shrink-0 relative ${
                          isExpanded ? 'h-[375px]' : 'h-[275px]'
                        }`}
                      >
                        {dmIsBloqueado && (
                          <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-[11px] text-center flex items-center justify-center gap-1.5">
                            <Lock className="w-3.5 h-3.5 shrink-0" />
                            <span>
                              Este contato está bloqueado. Clique em "Bloqueado" acima para
                              desbloquear.
                            </span>
                          </div>
                        )}

                        {dmMensagensFiltradasBusca.length === 0 ? (
                          <div className="text-center py-12 px-4 text-slate-400 text-xs">
                            {termoBuscaHistorico.trim() ? (
                              <>
                                Nenhuma mensagem encontrada contendo{' '}
                                <strong>"{termoBuscaHistorico}"</strong>.
                              </>
                            ) : (
                              <>
                                Envie a primeira mensagem privada para{' '}
                                <strong>{dmContatoNome || dmContatoEmail}</strong>.
                              </>
                            )}
                          </div>
                        ) : (
                          (() => {
                            const listaVisivelDm = dmMensagensFiltradasBusca.slice(
                              Math.max(0, dmMensagensFiltradasBusca.length - limiteMensagensExibidas)
                            );
                            return listaVisivelDm.map((m) => {
                            const souEu =
                              m.remetente_email.trim().toLowerCase() === meuEmail;
                            const isPrimeiraNaoLida = primeiraNaoLidaId === m.id;
                            const dmReadStatus = getMessageReadStatus(m.id);
                            return (
                              <React.Fragment key={m.id}>
                                {isPrimeiraNaoLida && (
                                  <div className="flex items-center gap-2 my-1.5">
                                    <div className="h-px bg-teal-400/60 flex-1" />
                                    <span className="text-[9px] font-extrabold uppercase tracking-wider bg-teal-600 text-white px-2.5 py-0.5 rounded-full shadow-2xs">
                                      Mensagens não lidas a partir daqui
                                    </span>
                                    <div className="h-px bg-teal-400/60 flex-1" />
                                  </div>
                                )}
                                <div
                                  data-chat-msg-id={m.id}
                                  className={`flex ${souEu ? 'justify-end' : 'justify-start'}`}
                                >
                                  <div
                                    className={`max-w-[78%] rounded-2xl px-3 py-2 text-xs leading-relaxed ${
                                      souEu
                                        ? 'bg-[#07192B] text-white rounded-br-xs'
                                        : isPrimeiraNaoLida
                                        ? 'bg-teal-50 text-slate-900 rounded-bl-xs border border-teal-300 ring-1 ring-teal-400/40'
                                        : 'bg-white text-slate-800 rounded-bl-xs border border-slate-200 shadow-2xs'
                                    }`}
                                  >
                                    <p className="whitespace-pre-line break-words">
                                      {destacarTextoBusca(m.texto, termoBuscaHistorico)}
                                    </p>
                                    {m.audio_base64 && (
                                      <div
                                        className={`mt-1.5 p-1.5 rounded-xl border ${
                                          souEu
                                            ? 'bg-slate-800/90 border-teal-500/40'
                                            : 'bg-slate-50 border-slate-200'
                                        }`}
                                      >
                                        <audio
                                          controls
                                          preload="metadata"
                                          src={m.audio_base64}
                                          className="w-full h-8 min-w-[180px]"
                                        />
                                      </div>
                                    )}
                                    <div
                                      className={`flex items-center justify-end gap-1 text-[9px] mt-1 font-mono ${
                                        souEu ? 'text-teal-300' : 'text-slate-400'
                                      }`}
                                    >
                                      <span>{m.data_hora}</span>
                                      {souEu && dmReadStatus.isReadByOthers && (
                                        <span
                                          className="inline-flex items-center gap-0.5 text-teal-300"
                                          title="Mensagem visualizada pelo destinatário"
                                        >
                                          <Eye className="w-3 h-3" />
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </React.Fragment>
                            );
                          });
                          })()
                        )}
                        <div ref={messagesEndRef} />
                      </div>

                      {mostrarBotaoDescer && dmMensagens.length > 0 && (
                        <button
                          type="button"
                          onClick={rolarAteOFim}
                          className="absolute right-4 bottom-16 z-30 inline-flex items-center gap-1.5 bg-[#07192B]/95 hover:bg-[#0C2640] text-[#2DD4AA] text-[10px] font-extrabold px-3 py-1.5 rounded-full shadow-lg border border-teal-400/40 cursor-pointer transition-all hover:scale-105"
                          title="Ir ao final da conversa para ver a mensagem mais recente"
                        >
                          <ArrowDown className="w-3.5 h-3.5 animate-bounce" />
                          <span>Ir ao final</span>
                        </button>
                      )}
                    </>
                  ) : (
                    <div
                      className={`flex flex-col items-center justify-center text-center p-6 bg-slate-50/70 shrink-0 ${
                        isExpanded ? 'h-[460px]' : 'h-[360px]'
                      }`}
                    >
                      <MessageCircle className="w-8 h-8 text-teal-600 mb-2" />
                      <h5 className="text-xs font-extrabold text-slate-800 mb-1">
                         Suas Mensagens Privadas
                      </h5>
                      <p className="text-[11px] text-slate-500 max-w-xs leading-relaxed">
                        Selecione um colega na barra lateral esquerda ou pesquise pelo nome para
                        iniciar uma conversa direta 1 a 1.
                      </p>
                    </div>
                  )}
                </>
              )}

              {/* Barra de Envio (exibida apenas quando a conversa está acessível) */}
              {((abaModo === 'concursos' && (!salaAtiva.restrito || salaAtiva.temAcesso)) ||
                (abaModo === 'privadas' && Boolean(dmContatoEmail))) && (
                <form
                  onSubmit={handleEnviar}
                  className="p-2.5 bg-white border-t border-slate-200 flex flex-col gap-1.5 shrink-0 relative"
                >
                  {erroGravacaoAudio && (
                    <div className="px-2.5 py-1.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-[10px] font-semibold flex items-center justify-between gap-2">
                      <span className="truncate">{erroGravacaoAudio}</span>
                      <button
                        type="button"
                        onClick={() => setErroGravacaoAudio(null)}
                        className="text-rose-500 hover:text-rose-700 cursor-pointer shrink-0"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}

                  {gravandoAudio && (
                    <div className="px-2.5 py-1.5 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-ping shrink-0" />
                        <span className="text-[11px] font-extrabold text-rose-800 truncate">
                          Gravando voz... {formatarDuracaoAudio(tempoGravacaoSegundos)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={cancelarGravacaoAudio}
                          className="px-2 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 text-[10px] font-bold cursor-pointer"
                          title="Cancelar gravação de voz"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={pararGravacaoAudio}
                          className="px-2 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer"
                          title="Concluir gravação"
                        >
                          <Square className="w-2.5 h-2.5 fill-current" />
                          <span>Concluir</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {!gravandoAudio && audioPreviewBase64 && (
                    <div className="px-2.5 py-1.5 rounded-xl bg-teal-50/90 border border-teal-200 flex flex-col gap-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-extrabold text-teal-900 inline-flex items-center gap-1">
                          <Mic className="w-3 h-3 text-teal-600" />
                          <span>
                            Áudio pronto ({formatarDuracaoAudio(audioPreviewDuracao)}) • Salvo em
                            Base64
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={limparAudioPreview}
                          className="text-[10px] font-bold text-rose-600 hover:underline inline-flex items-center gap-0.5 cursor-pointer"
                          title="Descartar gravação de áudio"
                        >
                          <Trash2 className="w-2.5 h-2.5" />
                          <span>Remover</span>
                        </button>
                      </div>
                      <audio
                        controls
                        preload="metadata"
                        src={audioPreviewBase64}
                        className="w-full h-7"
                      />
                    </div>
                  )}

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setShowInputEmojiPicker((v) => !v)}
                      className="p-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 cursor-pointer shrink-0"
                      title="Inserir emoji"
                    >
                      <Smile className="w-4 h-4" />
                    </button>

                    {showInputEmojiPicker && (
                      <div className="absolute left-2 bottom-14 z-50 bg-white border border-slate-200 rounded-2xl shadow-2xl p-2.5 w-64 sm:w-72">
                        <div className="mb-1.5 pb-1.5 border-b border-slate-100">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-teal-700 flex items-center gap-1 mb-1">
                            <Sparkles className="w-2.5 h-2.5" /> Seus Emojis Mais Usados
                          </span>
                          <div className="grid grid-cols-8 gap-1 bg-teal-50/60 p-1 rounded-lg border border-teal-100">
                            {emojisFrequentes.map((emj) => (
                              <button
                                key={`inpfreq-${emj}`}
                                type="button"
                                onClick={() => handleInserirEmojiTexto(emj)}
                                className="text-sm p-1 rounded hover:bg-white cursor-pointer"
                              >
                                {emj}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="max-h-32 overflow-y-auto grid grid-cols-8 gap-1">
                          {TODOS_EMOJIS_CHAT.map((emj, idx) => (
                            <button
                              key={`inpall-${emj}-${idx}`}
                              type="button"
                              onClick={() => handleInserirEmojiTexto(emj)}
                              className="text-sm p-1 rounded hover:bg-slate-100 cursor-pointer"
                            >
                              {emj}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <input
                      type="text"
                      value={texto}
                      disabled={(abaModo === 'privadas' && dmIsBloqueado) || gravandoAudio}
                      onChange={(e) => setTexto(e.target.value)}
                      placeholder={
                        !usuario && !isAdmin
                          ? 'Faça login para enviar mensagens...'
                          : gravandoAudio
                          ? 'Gravando mensagem de voz...'
                          : abaModo === 'privadas'
                          ? dmIsBloqueado
                            ? 'Contato bloqueado'
                            : `Mensagem privada para ${dmContatoNome || dmContatoEmail}...`
                          : `Mensagem em ${concursoAtivo?.orgao || 'chat'} (${salaAtiva.tituloCurto})...`
                      }
                      className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-teal-600 outline-hidden disabled:opacity-50"
                    />

                    <button
                      type="button"
                      onClick={gravandoAudio ? pararGravacaoAudio : iniciarGravacaoAudio}
                      disabled={abaModo === 'privadas' && dmIsBloqueado}
                      className={`p-2 rounded-xl border transition-colors cursor-pointer shrink-0 ${
                        gravandoAudio
                          ? 'bg-rose-600 hover:bg-rose-700 text-white border-rose-600 animate-pulse'
                          : audioPreviewBase64
                          ? 'bg-teal-50 text-teal-700 border-teal-300 hover:bg-teal-100'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200'
                      } disabled:opacity-40`}
                      title={
                        gravandoAudio
                          ? 'Parar gravação de áudio'
                          : 'Gravar mensagem de voz (salva em Base64 no localStorage)'
                      }
                    >
                      {gravandoAudio ? (
                        <Square className="w-4 h-4 fill-current" />
                      ) : (
                        <Mic className="w-4 h-4" />
                      )}
                    </button>

                    <button
                      type="submit"
                      disabled={
                        (!texto.trim() && !audioPreviewBase64) ||
                        gravandoAudio ||
                        (abaModo === 'privadas' && dmIsBloqueado)
                      }
                      className="p-2 rounded-xl bg-teal-700 hover:bg-teal-600 disabled:opacity-40 text-white transition-colors cursor-pointer shrink-0"
                      title={audioPreviewBase64 ? 'Enviar mensagem de voz' : 'Enviar mensagem'}
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
