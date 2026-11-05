import React, { useState, useEffect, useRef } from 'react';
import { certamStore } from '../store/certamStore';
import {
  chatStore,
  CATALOGO_EMOJIS_CATEGORIAS,
  TODOS_EMOJIS_CHAT,
} from '../store/chatStore';
import { useAuth } from '../store/authContext';
import { useNotifications } from '../store/notificationContext';
import { Concurso, ChatMensagem, CanalChatId } from '../types';
import {
  MessageSquare,
  ChevronDown,
  Send,
  Heart,
  Smile,
  Bell,
  BellOff,
  Shield,
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
} from 'lucide-react';

interface PersistentChatWidgetProps {
  concursoInicialId?: string;
  onRequireAuth?: () => void;
}

const CANAIS_RAPIDOS: { id: CanalChatId; nome: string }[] = [
  { id: 'geral', nome: 'Geral' },
  { id: 'lotacao', nome: 'Lotação' },
  { id: 'posse', nome: 'Posse' },
  { id: 'recursos', nome: 'Recursos' },
];

interface ResumoNovaMensagemChat {
  id: string;
  concursoId: string;
  concursoSigla: string;
  canalId: CanalChatId;
  autor: string;
  resumoTexto: string;
  dataHora: string;
}

export const PersistentChatWidget: React.FC<PersistentChatWidgetProps> = ({
  concursoInicialId,
  onRequireAuth,
}) => {
  const { usuario, isAdmin } = useAuth();
  const { exibirToast } = useNotifications();

  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [concursos, setConcursos] = useState<Concurso[]>(() => certamStore.getConcursos());
  const [concursoAtivoId, setConcursoAtivoId] = useState<string>(() => {
    const list = certamStore.getConcursos();
    return concursoInicialId || list[0]?.id || 'tjrs_2025';
  });
  const [canalAtivo, setCanalAtivo] = useState<CanalChatId>('geral');
  const [mensagens, setMensagens] = useState<ChatMensagem[]>([]);
  const [texto, setTexto] = useState('');
  const [emojiPickerMsgId, setEmojiPickerMsgId] = useState<string | null>(null);
  const [showInputEmojiPicker, setShowInputEmojiPicker] = useState(false);
  const [categoriaEmojiAtiva, setCategoriaEmojiAtiva] = useState<string>('reacoes');
  const [emojisFrequentes, setEmojisFrequentes] = useState<string[]>(() =>
    chatStore.getEmojisFrequentes(8)
  );
  const [unreadByConcurso, setUnreadByConcurso] = useState<Record<string, number>>({});
  const [resumoBanner, setResumoBanner] = useState<ResumoNovaMensagemChat | null>(null);
  const [, setMuteVersion] = useState(0);

  const knownMsgIdsRef = useRef<Set<string>>(new Set());
  const initializedKnownIdsRef = useRef(false);
  const selfSentMsgIdsRef = useRef<Set<string>>(new Set());
  const bannerTimeoutRef = useRef<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (concursoInicialId && concursos.some((c) => c.id === concursoInicialId)) {
      setConcursoAtivoId(concursoInicialId);
    }
  }, [concursoInicialId, concursos]);

  const salaAtualSilenciada = chatStore.isSalaSilenciada(concursoAtivoId, canalAtivo);
  const concursoAtualSilenciado = chatStore.isConcursoSilenciado(concursoAtivoId);

  const carregarMensagensAtivas = () => {
    if (!concursoAtivoId) return;
    const msgs = chatStore.getMensagens(concursoAtivoId, 'geral', canalAtivo);
    setMensagens([...msgs]);
  };

  // Inicializa IDs de mensagens já existentes para só notificar mensagens novas que chegarem a partir de agora
  useEffect(() => {
    if (initializedKnownIdsRef.current) return;
    const allConcursos = certamStore.getConcursos();
    allConcursos.forEach((c) => {
      CANAIS_RAPIDOS.forEach((cn) => {
        const msgs = chatStore.getMensagens(c.id, 'geral', cn.id);
        msgs.forEach((m) => knownMsgIdsRef.current.add(m.id));
      });
    });
    initializedKnownIdsRef.current = true;
  }, []);

  useEffect(() => {
    carregarMensagensAtivas();
    setUnreadByConcurso((prev) => ({ ...prev, [concursoAtivoId]: 0 }));
  }, [concursoAtivoId, canalAtivo, isOpen]);

  // Monitoramento em tempo real de todas as conversas de todos os concursos
  useEffect(() => {
    const verificarNovasMensagensGlobal = () => {
      const listaConcursos = certamStore.getConcursos();
      setConcursos(listaConcursos);

      let ultimaNovaParaNotificar: {
        msg: ChatMensagem;
        conc: Concurso;
        canal: CanalChatId;
      } | null = null;

      listaConcursos.forEach((conc) => {
        CANAIS_RAPIDOS.forEach((cn) => {
          const msgs = chatStore.getMensagens(conc.id, 'geral', cn.id);
          msgs.forEach((m) => {
            if (!knownMsgIdsRef.current.has(m.id)) {
              knownMsgIdsRef.current.add(m.id);

              const enviadaNesteWidget = selfSentMsgIdsRef.current.has(m.id);
              const estaVisualizandoEstaSalaAberta =
                isOpen && concursoAtivoId === conc.id && canalAtivo === cn.id;

              if (!estaVisualizandoEstaSalaAberta && !enviadaNesteWidget) {
                setUnreadByConcurso((prev) => ({
                  ...prev,
                  [conc.id]: (prev[conc.id] || 0) + 1,
                }));
              }

              // Verifica no localStorage se a conversa/canal ou o concurso está silenciado
              const conversaSilenciada =
                chatStore.isSalaSilenciada(conc.id, cn.id) ||
                chatStore.isConcursoSilenciado(conc.id);

              if (!conversaSilenciada && (!enviadaNesteWidget || !estaVisualizandoEstaSalaAberta)) {
                ultimaNovaParaNotificar = { msg: m, conc, canal: cn.id };
              }
            }
          });
        });
      });

      if (ultimaNovaParaNotificar) {
        const { msg, conc, canal } = ultimaNovaParaNotificar as {
          msg: ChatMensagem;
          conc: Concurso;
          canal: CanalChatId;
        };
        const sigla = conc.orgao || conc.nome;
        const resumoCurto =
          msg.texto.length > 90 ? `${msg.texto.substring(0, 90)}...` : msg.texto;

        // 1. Dispara o Toast global de notificação (respeitando o bloqueio de conversas silenciadas)
        exibirToast({
          id: `notif-chat-${msg.id}`,
          concurso_id: conc.id,
          cargo_id: msg.cargo_id || 'geral',
          canal_id: canal,
          titulo: `Nova mensagem no Chat • ${sigla} (#${canal})`,
          mensagem: `${msg.autor}: "${resumoCurto}"`,
          tipo: 'chat',
          data_hora: msg.data_hora || 'Agora',
          link_destino: `/?id=${conc.id}&tab=forum`,
        });

        // 2. Exibe também o card flutuante de resumo rápido junto ao widget do chat
        setResumoBanner({
          id: msg.id,
          concursoId: conc.id,
          concursoSigla: sigla,
          canalId: canal,
          autor: msg.autor,
          resumoTexto: resumoCurto,
          dataHora: msg.data_hora || 'Agora',
        });

        if (bannerTimeoutRef.current) {
          window.clearTimeout(bannerTimeoutRef.current);
        }
        bannerTimeoutRef.current = window.setTimeout(() => {
          setResumoBanner(null);
        }, 6500);
      }

      carregarMensagensAtivas();
    };

    const handleMuteChanged = () => {
      setMuteVersion((v) => v + 1);
      if (
        resumoBanner &&
        (chatStore.isSalaSilenciada(resumoBanner.concursoId, resumoBanner.canalId) ||
          chatStore.isConcursoSilenciado(resumoBanner.concursoId))
      ) {
        setResumoBanner(null);
      }
    };

    const handleEmojisChanged = () => {
      setEmojisFrequentes(chatStore.getEmojisFrequentes(8));
    };

    chatStore.initRealtime();

    window.addEventListener('certam_chat_updated', verificarNovasMensagensGlobal);
    window.addEventListener('certam_concursos_updated', verificarNovasMensagensGlobal);
    window.addEventListener('certam_chat_mute_updated', handleMuteChanged);
    window.addEventListener('certam_emojis_updated', handleEmojisChanged);
    window.addEventListener('storage', verificarNovasMensagensGlobal);

    return () => {
      window.removeEventListener('certam_chat_updated', verificarNovasMensagensGlobal);
      window.removeEventListener('certam_concursos_updated', verificarNovasMensagensGlobal);
      window.removeEventListener('certam_chat_mute_updated', handleMuteChanged);
      window.removeEventListener('certam_emojis_updated', handleEmojisChanged);
      window.removeEventListener('storage', verificarNovasMensagensGlobal);
    };
  }, [concursoAtivoId, canalAtivo, isOpen, exibirToast, resumoBanner]);

  const handleToggleMuteSalaAtual = () => {
    chatStore.alternarSilenciarSala(concursoAtivoId, canalAtivo);
    setMuteVersion((v) => v + 1);
  };

  const handleToggleMuteConcursoAtual = () => {
    chatStore.alternarSilenciarConcurso(concursoAtivoId);
    setMuteVersion((v) => v + 1);
  };

  const handleEnviar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!texto.trim()) return;
    if (!usuario) {
      onRequireAuth?.();
      return;
    }

    const cores = ['#0D5C75', '#0F766E', '#1D4ED8', '#6366F1', '#475569'];
    const corHash =
      cores[
        usuario.nome.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % cores.length
      ];

    const nova = chatStore.enviarMensagem(concursoAtivoId, 'geral', canalAtivo, {
      autor: usuario.nome,
      email: usuario.email,
      avatar_cor: corHash,
      texto: texto.trim(),
      is_admin: isAdmin,
      is_fixado: false,
      curtidas: 0,
      curtido_por: [],
      reacoes: {},
    });

    selfSentMsgIdsRef.current.add(nova.id);
    knownMsgIdsRef.current.add(nova.id);

    setTexto('');
    setShowInputEmojiPicker(false);
    carregarMensagensAtivas();
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 60);
  };

  const handleCurtir = (msgId: string) => {
    chatStore.curtirMensagem(concursoAtivoId, 'geral', canalAtivo, msgId, usuario);
    carregarMensagensAtivas();
  };

  const handleReagir = (msgId: string, emoji: string) => {
    chatStore.reagirEmoji(concursoAtivoId, 'geral', canalAtivo, msgId, emoji, usuario);
    setEmojisFrequentes(chatStore.getEmojisFrequentes(8));
    setEmojiPickerMsgId(null);
    carregarMensagensAtivas();
  };

  const handleReenviar = async (msgId: string) => {
    await chatStore.reenviarMensagem(concursoAtivoId, 'geral', canalAtivo, msgId);
    carregarMensagensAtivas();
  };

  const handleInserirEmojiTexto = (emoji: string) => {
    setTexto((prev) => `${prev}${emoji}`);
    chatStore.registrarUsoEmoji(emoji);
    setEmojisFrequentes(chatStore.getEmojisFrequentes(8));
  };

  const totalUnread = (Object.values(unreadByConcurso) as number[]).reduce(
    (acc, n) => acc + n,
    0
  );
  const concursoAtivo = concursos.find((c) => c.id === concursoAtivoId) || concursos[0];

  return (
    <div className="fixed bottom-4 right-4 z-[9990] flex flex-col items-end max-w-[calc(100vw-1.5rem)]">
      {/* Banner flutuante de Resumo de Nova Mensagem em Tempo Real (apenas para conversas não silenciadas) */}
      {resumoBanner && !isOpen && (
        <div className="mb-3 w-80 sm:w-96 bg-white border-2 border-teal-500 rounded-2xl shadow-2xl p-3.5 animate-in slide-in-from-bottom-4 duration-200">
          <div className="flex items-start justify-between gap-2">
            <div
              onClick={() => {
                setConcursoAtivoId(resumoBanner.concursoId);
                setCanalAtivo(resumoBanner.canalId);
                setIsOpen(true);
                setResumoBanner(null);
              }}
              className="flex-1 min-w-0 cursor-pointer"
            >
              <div className="flex items-center gap-1.5 mb-1">
                <span className="bg-teal-700 text-white text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md">
                  {resumoBanner.concursoSigla}
                </span>
                <span className="text-[10px] font-bold text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200">
                  #{resumoBanner.canalId}
                </span>
                <span className="text-[10px] text-slate-400 font-mono ml-auto">
                  {resumoBanner.dataHora}
                </span>
              </div>
              <p className="text-xs font-bold text-slate-900 truncate">
                {resumoBanner.autor} enviou uma mensagem:
              </p>
              <p className="text-xs text-slate-600 line-clamp-2 mt-0.5 leading-snug">
                “{resumoBanner.resumoTexto}”
              </p>
            </div>
            <button
              type="button"
              onClick={() => setResumoBanner(null)}
              className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              title="Fechar aviso"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                setConcursoAtivoId(resumoBanner.concursoId);
                setCanalAtivo(resumoBanner.canalId);
                setIsOpen(true);
                setResumoBanner(null);
              }}
              className="text-[11px] font-bold text-teal-700 hover:text-teal-900 cursor-pointer"
            >
              Responder na conversa →
            </button>
            <button
              type="button"
              onClick={() => {
                chatStore.alternarSilenciarSala(resumoBanner.concursoId, resumoBanner.canalId);
                setResumoBanner(null);
                setMuteVersion((v) => v + 1);
              }}
              className="text-[11px] font-semibold text-slate-500 hover:text-amber-700 flex items-center gap-1 cursor-pointer"
            >
              <BellOff className="w-3 h-3" /> Silenciar conversa
            </button>
          </div>
        </div>
      )}

      {/* Botão Flutuante Sempre em Destaque quando minimizado */}
      {!isOpen ? (
        <button
          type="button"
          onClick={() => {
            setIsOpen(true);
            setResumoBanner(null);
          }}
          className="group flex items-center gap-3 bg-gradient-to-r from-[#07192B] via-[#0B2D48] to-[#0F766E] hover:from-[#0A2540] hover:to-[#0D9488] text-white px-4 py-3 rounded-2xl shadow-2xl border border-teal-400/40 transition-all hover:scale-[1.02] cursor-pointer ring-4 ring-teal-500/15"
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
              <span>Chat dos Concursos</span>
              <span className="text-[10px] font-bold bg-teal-400/20 text-teal-200 px-1.5 py-0.5 rounded border border-teal-400/30">
                Ao Vivo
              </span>
            </div>
            <div className="text-[11px] text-teal-100/90 font-medium">
              {concursoAtivo?.orgao || 'Comunidade'} • {mensagens.length} msg(s)
            </div>
          </div>
        </button>
      ) : (
        /* Janela Persistente do Chat */
        <div
          className={`bg-white rounded-2xl shadow-2xl border border-slate-300 flex flex-col overflow-hidden transition-all duration-200 ${
            isExpanded
              ? 'w-[95vw] sm:w-[560px] h-[82vh] max-h-[740px]'
              : 'w-[94vw] sm:w-[410px] h-[540px] max-h-[82vh]'
          }`}
        >
          {/* Cabeçalho Principal */}
          <div className="bg-gradient-to-r from-[#07192B] via-[#0A2540] to-[#0D3B56] px-3.5 py-2.5 text-white flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <div className="relative">
                <MessageSquare className="w-4 h-4 text-teal-300 shrink-0" />
                <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400" />
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-extrabold tracking-wide truncate flex items-center gap-1.5">
                  <span>Chat dos Concursos</span>
                  {salaAtualSilenciada && (
                    <span className="text-[9px] bg-amber-500/30 text-amber-200 border border-amber-400/40 px-1.5 py-0.2 rounded">
                      Silenciado
                    </span>
                  )}
                </h4>
                <p className="text-[10px] text-teal-200 truncate">
                  {concursoAtivo?.orgao || concursoAtivo?.nome} • #{canalAtivo}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {/* Silenciar Canal Atual */}
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
              <button
                type="button"
                onClick={handleToggleMuteConcursoAtual}
                title={
                  concursoAtualSilenciado
                    ? 'Reativar notificações de todo este concurso'
                    : 'Silenciar todas as abas deste concurso'
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

          {/* Abas de Conversas para Cada Concurso */}
          <div className="bg-slate-900 px-2 py-1.5 flex items-center gap-1.5 overflow-x-auto border-b border-slate-800 shrink-0">
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
                    setUnreadByConcurso((prev) => ({ ...prev, [c.id]: 0 }));
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                    ativo
                      ? 'bg-teal-600 text-white shadow-xs'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  <span>{c.orgao || c.nome.substring(0, 14)}</span>
                  {concSilenciado && (
                    <BellOff className="w-2.5 h-2.5 text-amber-300 shrink-0" />
                  )}
                  {unread > 0 && (
                    <span className="bg-rose-500 text-white text-[9px] font-extrabold px-1.5 py-0.2 rounded-full">
                      {unread}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Sub-abas de Canais do Concurso + Botão Rápido de Silenciar Conversa */}
          <div className="bg-slate-100 px-2.5 py-1.5 flex items-center justify-between gap-1 border-b border-slate-200 shrink-0">
            <div className="flex items-center gap-1 overflow-x-auto">
              {CANAIS_RAPIDOS.map((cn) => {
                const ativo = canalAtivo === cn.id;
                const silenciado = chatStore.isSalaSilenciada(concursoAtivoId, cn.id);
                return (
                  <button
                    key={cn.id}
                    type="button"
                    onClick={() => setCanalAtivo(cn.id)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                      ativo
                        ? 'bg-white text-teal-800 shadow-2xs border border-slate-200/80'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>#{cn.nome}</span>
                    {silenciado && <BellOff className="w-2.5 h-2.5 text-amber-600" />}
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

          {/* Lista de Mensagens */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5 bg-slate-50/60">
            {mensagens.length === 0 ? (
              <div className="text-center py-12 px-4 text-slate-400 text-xs">
                Nenhuma mensagem em #{canalAtivo} de {concursoAtivo?.orgao}. Inicie a conversa!
              </div>
            ) : (
              mensagens.map((msg) => {
                const jaCurtiu = chatStore.usuarioCurtiuMensagem(msg, usuario);
                const minhaReacao = chatStore.obterReacaoDoUsuario(msg, usuario);
                const totalCurtidas = Array.isArray(msg.curtido_por)
                  ? msg.curtido_por.length
                  : 0;
                const reacoesEntries = Object.entries(msg.reacoes || {}).filter(
                  ([, users]) => Array.isArray(users) && users.length > 0
                );

                return (
                  <div
                    key={msg.id}
                    className={`rounded-xl p-2.5 border text-xs transition-all ${
                      msg.is_fixado
                        ? 'bg-amber-50/90 border-amber-200'
                        : 'bg-white border-slate-200/80 shadow-2xs'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                        <span
                          className="w-5 h-5 rounded-full text-white text-[9px] font-bold flex items-center justify-center shrink-0"
                          style={{ backgroundColor: msg.avatar_cor || '#0D5C75' }}
                        >
                          {msg.autor.substring(0, 2).toUpperCase()}
                        </span>
                        <span className="font-bold text-slate-900 truncate">{msg.autor}</span>
                        {msg.is_admin && (
                          <span className="bg-teal-700 text-white text-[9px] font-bold px-1.5 py-0.2 rounded flex items-center gap-0.5">
                            <Shield className="w-2.5 h-2.5" /> Admin
                          </span>
                        )}
                        {msg.is_fixado && <Pin className="w-3 h-3 text-amber-600 shrink-0" />}
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono shrink-0">
                        {msg.data_hora}
                      </span>
                    </div>

                    <p className="text-slate-700 leading-relaxed whitespace-pre-line break-words mb-2">
                      {msg.texto}
                    </p>

                    {/* Estado de Confirmação (ACK) / Erro de Envio com Botão de Reenvio Manual */}
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

                    {/* Barra de Curtida Única (Toggle) + Reações de Emojis */}
                    <div className="flex items-center justify-between gap-1 pt-1.5 border-t border-slate-100 flex-wrap">
                      <div className="flex items-center gap-1 flex-wrap relative">
                        {msg.status_envio !== 'enviando' && msg.status_envio !== 'erro' && (
                          <span
                            className="inline-flex items-center text-emerald-600 px-1"
                            title="Recebimento confirmado pelo servidor"
                          >
                            <CheckCheck className="w-3 h-3" />
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

                        {/* Emojis já reagidos na mensagem */}
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

                        {/* Botão abrir seletor de todos os emojis */}
                        <button
                          type="button"
                          onClick={() =>
                            setEmojiPickerMsgId(emojiPickerMsgId === msg.id ? null : msg.id)
                          }
                          className="p-1 rounded-full bg-slate-50 hover:bg-slate-100 text-slate-500 border border-slate-200 cursor-pointer"
                          title="Reagir com qualquer emoji"
                        >
                          <Smile className="w-3 h-3" />
                        </button>

                        {emojiPickerMsgId === msg.id && (
                          <div className="absolute left-0 bottom-7 z-50 bg-white border border-slate-200 rounded-2xl shadow-2xl p-2.5 w-68 sm:w-72">
                            <div className="mb-2 pb-1.5 border-b border-slate-100">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[9px] font-bold uppercase tracking-wider text-teal-700 flex items-center gap-1">
                                  <Sparkles className="w-2.5 h-2.5" /> Mais usados por você
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
                                'geral',
                                canalAtivo,
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
                                'geral',
                                canalAtivo,
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
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Barra de Envio com Seletor de Emojis */}
          <form
            onSubmit={handleEnviar}
            className="p-2.5 bg-white border-t border-slate-200 flex items-center gap-1.5 shrink-0 relative"
          >
            <button
              type="button"
              onClick={() => setShowInputEmojiPicker((v) => !v)}
              className="p-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 cursor-pointer shrink-0"
              title="Inserir emoji"
            >
              <Smile className="w-4 h-4" />
            </button>

            {showInputEmojiPicker && (
              <div className="absolute left-2 bottom-14 z-50 bg-white border border-slate-200 rounded-2xl shadow-2xl p-2.5 w-72">
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
              onChange={(e) => setTexto(e.target.value)}
              placeholder={
                usuario
                  ? `Mensagem em ${concursoAtivo?.orgao || 'chat'} (#${canalAtivo})...`
                  : 'Faça login para enviar mensagens...'
              }
              className="flex-1 text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600"
            />
            <button
              type="submit"
              className="bg-teal-700 hover:bg-teal-600 text-white p-2 rounded-xl transition-colors cursor-pointer shrink-0"
              title="Enviar mensagem"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
