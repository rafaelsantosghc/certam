import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ChatMensagem, CanalChatId } from '../types';
import {
  chatStore,
  CATALOGO_EMOJIS_CATEGORIAS,
  TODOS_EMOJIS_CHAT,
  SalaChatConcurso,
} from '../store/chatStore';
import { dmStore } from '../store/dmStore';
import { certamStore } from '../store/certamStore';
import { cloudSync } from '../store/cloudSync';
import { useAuth } from '../store/authContext';
import { useChatPermissions } from '../hooks/useChatPermissions';
import {
  MessageSquare,
  Send,
  Pin,
  Trash2,
  Heart,
  Shield,
  Hash,
  Bell,
  BellOff,
  Mail,
  Ban,
  Smile,
  Sparkles,
  Volume2,
  VolumeX,
  AlertCircle,
  RotateCcw,
  CheckCheck,
  Loader2,
  Lock,
  Award,
  Layers,
  Briefcase,
  ArrowDown,
} from 'lucide-react';

interface CommunityForumProps {
  concursoId: string;
  cargoId: string;
  concursoNome?: string;
  cargoNome: string;
  isRestritoBloqueado?: boolean;
  onSolicitarAcesso?: () => void;
  onAbrirDM?: (destinatarioEmail: string, destinatarioNome: string) => void;
  onRequireAuth?: () => void;
}

const READ_MSG_STORAGE_KEY = 'certam_chat_read_msg_ids_v1';

export const CommunityForum: React.FC<CommunityForumProps> = ({
  concursoId,
  cargoId,
  concursoNome,
  cargoNome,
  isRestritoBloqueado,
  onSolicitarAcesso,
  onAbrirDM,
  onRequireAuth,
}) => {
  const { usuario, isAdmin, atualizarDadosUsuario } = useAuth();
  const [canalAtivo, setCanalAtivo] = useState<string>('geral');
  const [mensagens, setMensagens] = useState<ChatMensagem[]>([]);
  const [novoTexto, setNovoTexto] = useState('');
  const [posicaoInput, setPosicaoInput] = useState('');
  const [comarcaInput, setComarcaInput] = useState('');
  const [bloqueadosList, setBloqueadosList] = useState<string[]>([]);
  const [emojiPickerMsgId, setEmojiPickerMsgId] = useState<string | null>(null);
  const [showInputEmojiPicker, setShowInputEmojiPicker] = useState(false);
  const [categoriaEmojiAtiva, setCategoriaEmojiAtiva] = useState<string>('reacoes');
  const [emojisFrequentes, setEmojisFrequentes] = useState<string[]>(() =>
    chatStore.getEmojisFrequentes(8)
  );
  const [, setMuteVersion] = useState(0);
  const [primeiraNaoLidaId, setPrimeiraNaoLidaId] = useState<string | null>(null);
  const [mostrarBotaoDescer, setMostrarBotaoDescer] = useState(false);

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const lastRoomSelectionKeyRef = useRef<string>('');

  const concursoObj = useMemo(() => {
    const lista = certamStore.getConcursos();
    return lista.find((c) => c.id === concursoId) || null;
  }, [concursoId]);

  const { salasPermitidas } = useChatPermissions(concursoObj, usuario, isAdmin);

  const salasDisponiveis = useMemo<SalaChatConcurso[]>(() => {
    if (!concursoObj || salasPermitidas.length === 0) {
      return [
        {
          id: 'geral',
          tipo: 'geral',
          concursoId,
          cargoId: 'geral',
          cargoNome: 'Geral',
          cargoScope: 'geral',
          titulo: 'Chat Geral',
          tituloCurto: 'Chat Geral',
          descricao: 'Novidades e acompanhamento geral do concurso para todos os interessados',
          restrito: false,
          temAcesso: true,
        },
      ];
    }
    return [...salasPermitidas].sort((a, b) => {
      if (a.tipo === 'geral') return -1;
      if (b.tipo === 'geral') return 1;
      const aDoCargo = a.cargoId === cargoId ? 0 : 1;
      const bDoCargo = b.cargoId === cargoId ? 0 : 1;
      return aDoCargo - bDoCargo;
    });
  }, [concursoObj, salasPermitidas, cargoId, concursoId]);

  const salaAtual = useMemo<SalaChatConcurso>(() => {
    return (
      salasDisponiveis.find((s) => s.id === canalAtivo) ||
      salasDisponiveis[0] || {
        id: 'geral',
        tipo: 'geral',
        concursoId,
        cargoId: 'geral',
        cargoNome: 'Geral',
        cargoScope: 'geral',
        titulo: 'Chat Geral',
        tituloCurto: 'Chat Geral',
        descricao: 'Novidades e acompanhamento geral do concurso',
        restrito: false,
        temAcesso: true,
      }
    );
  }, [salasDisponiveis, canalAtivo, concursoId]);

  const salaSilenciada = chatStore.isSalaSilenciada(concursoId, salaAtual.id);
  const concursoSilenciado = chatStore.isConcursoSilenciado(concursoId);

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

  const obterPrimeiraNaoLidaSala = (sala: SalaChatConcurso): string | null => {
    if (!sala.temAcesso) return null;
    const msgs = chatStore.getMensagens(
      concursoId,
      sala.cargoScope,
      sala.id as CanalChatId
    );
    if (msgs.length === 0) return null;
    const readMap = getReadIdsMap();
    const roomKey = `${concursoId}_${sala.id}`;
    const readSet = new Set(readMap[roomKey] || []);
    const primeira = msgs.find(
      (m) =>
        !readSet.has(m.id) &&
        !chatStore.isMensagemDoProprioUsuario(m, usuario)
    );
    return primeira?.id || null;
  };

  const contarNaoLidasSala = (sala: SalaChatConcurso): number => {
    if (!sala.temAcesso) return 0;
    const msgs = chatStore.getMensagens(
      concursoId,
      sala.cargoScope,
      sala.id as CanalChatId
    );
    if (msgs.length === 0) return 0;
    const readMap = getReadIdsMap();
    const roomKey = `${concursoId}_${sala.id}`;
    const readSet = new Set(readMap[roomKey] || []);
    return msgs.filter(
      (m) =>
        !readSet.has(m.id) &&
        !chatStore.isMensagemDoProprioUsuario(m, usuario)
    ).length;
  };

  const marcarSalaLida = (sala: SalaChatConcurso) => {
    if (!sala.temAcesso || typeof window === 'undefined') return;
    try {
      const msgs = chatStore.getMensagens(
        concursoId,
        sala.cargoScope,
        sala.id as CanalChatId
      );
      const readMap = getReadIdsMap();
      const roomKey = `${concursoId}_${sala.id}`;
      const set = new Set(readMap[roomKey] || []);
      msgs.forEach((m) => set.add(m.id));
      readMap[roomKey] = Array.from(set);
      localStorage.setItem(READ_MSG_STORAGE_KEY, JSON.stringify(readMap));
    } catch {
      // ignore
    }
  };

  const carregarMensagens = () => {
    if (!salaAtual.temAcesso) {
      setMensagens([]);
      return;
    }
    const msgs = chatStore.getMensagens(
      concursoId,
      salaAtual.cargoScope,
      salaAtual.id as CanalChatId
    );
    setMensagens([...msgs]);
    if (usuario) {
      const blocks = dmStore.getBlockedUsers();
      const meusBloqueios = blocks
        .filter((b) => b.usuario_email.toLowerCase() === usuario.email.toLowerCase())
        .map((b) => b.usuario_bloqueado_email.toLowerCase());
      setBloqueadosList(meusBloqueios);
    }
  };

  useEffect(() => {
    chatStore.initRealtime();
    carregarMensagens();
    void cloudSync.pullFromServer();

    const handleUpdate = () => carregarMensagens();
    const handleMuteUpdate = () => setMuteVersion((v) => v + 1);
    const handleEmojiUpdate = () => setEmojisFrequentes(chatStore.getEmojisFrequentes(8));

    window.addEventListener('certam_chat_updated', handleUpdate);
    window.addEventListener('certam_blocked_updated', handleUpdate);
    window.addEventListener('certam_chat_mute_updated', handleMuteUpdate);
    window.addEventListener('certam_emojis_updated', handleEmojiUpdate);
    window.addEventListener('storage', handleUpdate);

    return () => {
      window.removeEventListener('certam_chat_updated', handleUpdate);
      window.removeEventListener('certam_blocked_updated', handleUpdate);
      window.removeEventListener('certam_chat_mute_updated', handleMuteUpdate);
      window.removeEventListener('certam_emojis_updated', handleEmojiUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, [concursoId, salaAtual.id, salaAtual.cargoScope, salaAtual.temAcesso, usuario]);

  const rolarAteOFim = (suave = true) => {
    const container = messagesContainerRef.current;
    if (!container) return;
    container.scrollTo({
      top: container.scrollHeight,
      behavior: suave ? 'smooth' : 'auto',
    });
    setMostrarBotaoDescer(false);
  };

  const handleScrollContainer = () => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const distanciaDoFim =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    setMostrarBotaoDescer(distanciaDoFim > 90);
  };

  // Abre a conversa posicionada na mensagem mais antiga não lida (ou no final se tudo estiver lido)
  useEffect(() => {
    if (!salaAtual.temAcesso) return;
    const roomKey = `${concursoId}_${salaAtual.id}`;
    if (lastRoomSelectionKeyRef.current !== roomKey) {
      lastRoomSelectionKeyRef.current = roomKey;
      const firstUnread = obterPrimeiraNaoLidaSala(salaAtual);
      setPrimeiraNaoLidaId(firstUnread);
      marcarSalaLida(salaAtual);

      requestAnimationFrame(() => {
        setTimeout(() => {
          const container = messagesContainerRef.current;
          if (!container) return;
          if (firstUnread) {
            const targetEl = container.querySelector(
              `[data-forum-msg-id="${firstUnread}"]`
            ) as HTMLElement | null;
            if (targetEl) {
              targetEl.scrollIntoView({ behavior: 'auto', block: 'start' });
              handleScrollContainer();
              return;
            }
          }
          container.scrollTop = container.scrollHeight;
          setMostrarBotaoDescer(false);
        }, 40);
      });
    }
  }, [concursoId, salaAtual.id, salaAtual.cargoScope, salaAtual.temAcesso, usuario]);

  const handleEnviar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoTexto.trim()) return;
    if (!salaAtual.temAcesso) return;
    if (isRestritoBloqueado) {
      onSolicitarAcesso?.();
      return;
    }
    if (!usuario) {
      (onRequireAuth || onSolicitarAcesso)?.();
      return;
    }

    const cores = ['#0D5C75', '#0F766E', '#1D4ED8', '#6366F1', '#475569'];
    const corHash =
      cores[
        usuario.nome.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % cores.length
      ];

    const currentSenderId = chatStore.obterIdentificadorUsuario(usuario);

    chatStore.enviarMensagem(
      concursoId,
      salaAtual.cargoScope,
      salaAtual.id as CanalChatId,
      {
        sender_id: currentSenderId,
        autor: usuario.nome,
        email: usuario.email,
        avatar_cor: corHash,
        texto: novoTexto.trim(),
        is_admin: isAdmin,
        is_fixado: false,
        posicao_candidato: posicaoInput ? parseInt(posicaoInput, 10) : undefined,
        comarca_preferida: comarcaInput.trim() || undefined,
        curtidas: 0,
        curtido_por: [],
        reacoes: {},
      }
    );

    setNovoTexto('');
    setShowInputEmojiPicker(false);
    setPrimeiraNaoLidaId(null);
    marcarSalaLida(salaAtual);
    carregarMensagens();
    setTimeout(() => rolarAteOFim(true), 50);
  };

  const handleCurtir = (msgId: string) => {
    if (!salaAtual.temAcesso) return;
    chatStore.curtirMensagem(
      concursoId,
      salaAtual.cargoScope,
      salaAtual.id as CanalChatId,
      msgId,
      usuario
    );
    carregarMensagens();
  };

  const handleReagirEmoji = (msgId: string, emoji: string) => {
    if (!salaAtual.temAcesso) return;
    chatStore.reagirEmoji(
      concursoId,
      salaAtual.cargoScope,
      salaAtual.id as CanalChatId,
      msgId,
      emoji,
      usuario
    );
    setEmojisFrequentes(chatStore.getEmojisFrequentes(8));
    setEmojiPickerMsgId(null);
    carregarMensagens();
  };

  const handleInserirEmojiNoTexto = (emoji: string) => {
    setNovoTexto((prev) => `${prev}${emoji}`);
    chatStore.registrarUsoEmoji(emoji);
    setEmojisFrequentes(chatStore.getEmojisFrequentes(8));
  };

  const handleAlternarFixado = (msgId: string) => {
    if (!isAdmin) return;
    chatStore.alternarFixado(
      concursoId,
      salaAtual.cargoScope,
      salaAtual.id as CanalChatId,
      msgId
    );
    carregarMensagens();
  };

  const handleApagar = (msgId: string) => {
    if (!isAdmin) return;
    chatStore.apagarMensagem(
      concursoId,
      salaAtual.cargoScope,
      salaAtual.id as CanalChatId,
      msgId
    );
    carregarMensagens();
  };

  const handleToggleMuteCanal = (canalId: string) => {
    const agoraSilenciado = chatStore.alternarSilenciarSala(concursoId, canalId);
    if (usuario) {
      const chaveCanal = `${concursoId}_${canalId}`;
      const atuais = new Set(usuario.canais_silenciados || []);
      if (agoraSilenciado) {
        atuais.add(chaveCanal);
      } else {
        atuais.delete(chaveCanal);
      }
      atualizarDadosUsuario({ canais_silenciados: Array.from(atuais) });
    }
    setMuteVersion((v) => v + 1);
  };

  const handleToggleMuteConcurso = () => {
    chatStore.alternarSilenciarConcurso(concursoId);
    setMuteVersion((v) => v + 1);
  };

  const handleBloquearUsuario = (emailAlvo: string) => {
    if (!usuario) return;
    dmStore.bloquearUsuario(usuario.email, emailAlvo);
    const atuais = new Set(usuario.usuarios_bloqueados || []);
    atuais.add(emailAlvo);
    atualizarDadosUsuario({ usuarios_bloqueados: Array.from(atuais) });
    carregarMensagens();
  };

  const handleAbrirMensagemPrivada = (emailAlvo: string, nomeAlvo: string) => {
    if (onAbrirDM) {
      onAbrirDM(emailAlvo, nomeAlvo);
      return;
    }
    window.dispatchEvent(
      new CustomEvent('certam_abrir_dm_chat', {
        detail: { email: emailAlvo, nome: nomeAlvo },
      })
    );
  };

  const mensagensFiltradas = mensagens.filter(
    (m) =>
      !bloqueadosList.includes(m.email.toLowerCase()) &&
      !(usuario?.usuarios_bloqueados || []).includes(m.email)
  );

  const mensagensFixadas = mensagensFiltradas.filter((m) => m.is_fixado);
  const mensagensRegulares = mensagensFiltradas.filter((m) => !m.is_fixado);

  const handleReenviar = async (msgId: string) => {
    await chatStore.reenviarMensagem(
      concursoId,
      salaAtual.cargoScope,
      salaAtual.id as CanalChatId,
      msgId
    );
    carregarMensagens();
  };

  const renderIconeSala = (sala: SalaChatConcurso) => {
    if (!sala.temAcesso) return <Lock className="w-4 h-4 text-amber-500" />;
    if (sala.tipo === 'geral') return <Hash className="w-4 h-4" />;
    if (sala.tipo === 'cargo') return <Briefcase className="w-4 h-4" />;
    if (sala.tipo === 'aprovados') return <Award className="w-4 h-4" />;
    return <Layers className="w-4 h-4" />;
  };

  const renderMessageActionsAndReactions = (msg: ChatMensagem) => {
    const jaCurtiu = chatStore.usuarioCurtiuMensagem(msg, usuario);
    const minhaReacao = chatStore.obterReacaoDoUsuario(msg, usuario);
    const totalCurtidas = Array.isArray(msg.curtido_por) ? msg.curtido_por.length : 0;
    const reacoesEntries = Object.entries(msg.reacoes || {}).filter(
      ([, lista]) => Array.isArray(lista) && lista.length > 0
    );

    return (
      <div className="pt-2 border-t border-slate-100 space-y-2">
        {msg.status_envio === 'enviando' && (
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200/80">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-600" />
            <span>Aguardando confirmação do servidor...</span>
          </div>
        )}

        {msg.status_envio === 'erro' && (
          <div className="flex items-center justify-between gap-2 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2 text-rose-800">
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>
                {msg.erro_envio || 'Falha ao confirmar recebimento pelo servidor.'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => handleReenviar(msg.id)}
              className="inline-flex items-center gap-1 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-2.5 py-1 rounded-lg transition-colors cursor-pointer shrink-0 shadow-2xs"
              title="Reenviar mensagem manualmente"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reenviar</span>
            </button>
          </div>
        )}

        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center flex-wrap gap-1.5 relative">
            {msg.status_envio !== 'enviando' && msg.status_envio !== 'erro' && (
              <span
                className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full"
                title="Recebimento confirmado pelo servidor"
              >
                <CheckCheck className="w-3 h-3 text-emerald-600" />
              </span>
            )}
            <button
              type="button"
              onClick={() => handleCurtir(msg.id)}
              title={
                jaCurtiu
                  ? 'Você curtiu esta mensagem (clique para retirar a curtida)'
                  : 'Curtir mensagem (1 curtida por usuário)'
              }
              className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border transition-all cursor-pointer ${
                jaCurtiu
                  ? 'bg-rose-50 text-rose-600 border-rose-300 shadow-2xs'
                  : 'bg-slate-50 text-slate-500 border-slate-200 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50/50'
              }`}
            >
              <Heart className={`w-3.5 h-3.5 ${jaCurtiu ? 'fill-rose-500 text-rose-500' : ''}`} />
              <span>{totalCurtidas}</span>
            </button>

            {reacoesEntries.map(([emoji, users]) => {
              const reagiuEste = minhaReacao === emoji;
              return (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => handleReagirEmoji(msg.id, emoji)}
                  title={
                    reagiuEste
                      ? 'Sua reação (clique para remover)'
                      : 'Clique para reagir com este emoji'
                  }
                  className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full border transition-all cursor-pointer ${
                    reagiuEste
                      ? 'bg-teal-50 border-teal-400 text-teal-800 shadow-2xs'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span>{emoji}</span>
                  <span className="text-[11px]">{users.length}</span>
                </button>
              );
            })}

            <div className="relative">
              <button
                type="button"
                onClick={() =>
                  setEmojiPickerMsgId(emojiPickerMsgId === msg.id ? null : msg.id)
                }
                className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full border transition-colors cursor-pointer ${
                  emojiPickerMsgId === msg.id
                    ? 'bg-teal-50 text-teal-700 border-teal-300'
                    : 'bg-slate-50 text-slate-500 border-slate-200 hover:text-teal-700 hover:bg-teal-50/50'
                }`}
                title="Reagir com emoji (máximo de 1 reação por mensagem)"
              >
                <Smile className="w-3.5 h-3.5" />
                <span className="text-[11px]">Reagir</span>
              </button>

              {emojiPickerMsgId === msg.id && (
                <div className="absolute left-0 bottom-9 z-40 w-72 sm:w-80 bg-white border border-slate-200 rounded-2xl shadow-2xl p-3 animate-in fade-in zoom-in-95 duration-150">
                  <div className="mb-2.5 pb-2 border-b border-slate-100">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700 flex items-center gap-1">
                        <Sparkles className="w-3 h-3" /> Mais utilizados por você
                      </span>
                      <button
                        type="button"
                        onClick={() => setEmojiPickerMsgId(null)}
                        className="text-[10px] font-bold text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        Fechar
                      </button>
                    </div>
                    <div className="grid grid-cols-8 gap-1 bg-teal-50/60 p-1.5 rounded-xl border border-teal-100">
                      {emojisFrequentes.map((emj) => (
                        <button
                          key={`freq-${emj}`}
                          type="button"
                          onClick={() => handleReagirEmoji(msg.id, emj)}
                          className={`text-base p-1 rounded-lg hover:bg-white hover:scale-110 transition-transform cursor-pointer flex items-center justify-center ${
                            minhaReacao === emj ? 'bg-teal-200/70 ring-1 ring-teal-500' : ''
                          }`}
                          title={`Reagir com ${emj}`}
                        >
                          {emj}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 mb-2 overflow-x-auto pb-1">
                    {CATALOGO_EMOJIS_CATEGORIAS.map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setCategoriaEmojiAtiva(cat.id)}
                        className={`text-[10px] font-bold px-2 py-1 rounded-lg whitespace-nowrap transition-colors cursor-pointer ${
                          categoriaEmojiAtiva === cat.id
                            ? 'bg-slate-900 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {cat.titulo.split(' ')[0]}
                      </button>
                    ))}
                  </div>

                  <div className="max-h-40 overflow-y-auto pr-1 grid grid-cols-8 gap-1">
                    {(
                      CATALOGO_EMOJIS_CATEGORIAS.find((c) => c.id === categoriaEmojiAtiva)
                        ?.emojis || TODOS_EMOJIS_CHAT
                    ).map((emj, i) => (
                      <button
                        key={`cat-${emj}-${i}`}
                        type="button"
                        onClick={() => handleReagirEmoji(msg.id, emj)}
                        className={`text-base p-1 rounded-lg hover:bg-slate-100 hover:scale-110 transition-transform cursor-pointer flex items-center justify-center ${
                          minhaReacao === emj ? 'bg-teal-100 ring-1 ring-teal-500' : ''
                        }`}
                        title={`Reagir com ${emj}`}
                      >
                        {emj}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {usuario && usuario.email.toLowerCase() !== msg.email.toLowerCase() && (
              <>
                <button
                  type="button"
                  onClick={() => handleAbrirMensagemPrivada(msg.email, msg.autor)}
                  className="text-xs text-teal-700 hover:text-teal-900 font-semibold flex items-center gap-1 cursor-pointer"
                  title="Enviar mensagem privada no chat flutuante"
                >
                  <Mail className="w-3.5 h-3.5" /> Mensagem Privada
                </button>
                <button
                  type="button"
                  onClick={() => handleBloquearUsuario(msg.email)}
                  className="text-xs text-slate-400 hover:text-rose-600 font-medium flex items-center gap-1 cursor-pointer"
                  title="Bloquear este usuário"
                >
                  <Ban className="w-3 h-3" /> Bloquear
                </button>
              </>
            )}

            {isAdmin && (
              <>
                <button
                  type="button"
                  onClick={() => handleAlternarFixado(msg.id)}
                  className="text-xs text-amber-700 hover:text-amber-900 font-medium cursor-pointer"
                >
                  {msg.is_fixado ? 'Desafixar' : 'Fixar'}
                </button>
                <button
                  type="button"
                  onClick={() => handleApagar(msg.id)}
                  className="text-xs text-rose-600 hover:text-rose-800 font-medium flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" /> Remover
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
      {/* Cabeçalho do Fórum */}
      <div className="bg-gradient-to-r from-[#07192B] via-[#0A2540] to-[#0D3B56] px-6 py-5 text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-teal-300 text-xs font-bold uppercase tracking-wider mb-1">
            <MessageSquare className="w-4 h-4" />
            Salas Oficiais de Chat do Concurso
          </div>
          <h3 className="text-xl font-bold tracking-tight font-serif">
            {concursoNome ? `${concursoNome} — ${cargoNome}` : cargoNome}
          </h3>
          <p className="text-xs text-slate-300 mt-0.5">
            Salas divididas por Chat Geral, Chat do Cargo, Chat dos Aprovados e Chat de Lotes.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
          <button
            type="button"
            onClick={() => handleToggleMuteCanal(salaAtual.id)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border transition-all cursor-pointer ${
              salaSilenciada
                ? 'bg-amber-500/20 border-amber-400/40 text-amber-200 hover:bg-amber-500/30'
                : 'bg-white/10 border-white/15 text-slate-200 hover:bg-white/15'
            }`}
          >
            {salaSilenciada ? (
              <>
                <BellOff className="w-4 h-4 text-amber-300" />
                Sala Silenciada
              </>
            ) : (
              <>
                <Bell className="w-4 h-4 text-teal-300" />
                Silenciar Sala
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleToggleMuteConcurso}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border transition-all cursor-pointer ${
              concursoSilenciado
                ? 'bg-rose-500/25 border-rose-400/50 text-rose-200 hover:bg-rose-500/35'
                : 'bg-white/10 border-white/15 text-slate-200 hover:bg-white/15'
            }`}
          >
            {concursoSilenciado ? (
              <>
                <VolumeX className="w-4 h-4 text-rose-300" />
                Concurso Silenciado
              </>
            ) : (
              <>
                <Volume2 className="w-4 h-4 text-teal-300" />
                Silenciar Concurso
              </>
            )}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[540px]">
        {/* Barra Lateral de Salas */}
        <div className="lg:col-span-4 xl:col-span-3 bg-slate-50 border-b lg:border-b-0 lg:border-r border-slate-200 p-4 flex flex-col justify-between">
          <div>
            <p className="text-2xs font-bold uppercase tracking-wider text-slate-400 px-2 mb-2.5">
              Salas do Concurso ({salasDisponiveis.length})
            </p>
            <div className="space-y-1.5 max-h-[380px] overflow-y-auto pr-1">
              {salasDisponiveis.map((sala) => {
                const ativo = salaAtual.id === sala.id;
                const silenciado = chatStore.isSalaSilenciada(concursoId, sala.id);
                const naoLidas = contarNaoLidasSala(sala);
                return (
                  <div key={sala.id} className="relative group">
                    <button
                      type="button"
                      onClick={() => setCanalAtivo(sala.id)}
                      className={`w-full text-left px-3 py-2.5 rounded-xl transition-all flex items-start gap-2.5 cursor-pointer ${
                        ativo
                          ? 'bg-teal-700 text-white shadow-xs'
                          : !sala.temAcesso
                          ? 'bg-slate-100/80 text-slate-500 hover:bg-slate-200/60'
                          : 'text-slate-700 hover:bg-slate-200/70'
                      }`}
                    >
                      <div className={`mt-0.5 ${ativo ? 'text-teal-200' : 'text-slate-400'}`}>
                        {renderIconeSala(sala)}
                      </div>
                      <div className="flex-1 min-w-0 pr-6">
                        <div className="text-xs font-bold flex items-center gap-1.5">
                          <span className="truncate">{sala.titulo}</span>
                          {naoLidas > 0 && (
                            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-rose-500 text-white">
                              {naoLidas}
                            </span>
                          )}
                        </div>
                        <p
                          className={`text-2xs line-clamp-1 mt-0.5 ${
                            ativo ? 'text-teal-100' : 'text-slate-500'
                          }`}
                        >
                          {sala.descricao}
                        </p>
                      </div>
                    </button>
                    {sala.temAcesso && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleMuteCanal(sala.id);
                        }}
                        title={
                          silenciado
                            ? 'Ativar notificações desta sala'
                            : 'Silenciar notificações desta sala'
                        }
                        className={`absolute right-2.5 top-3 p-1 rounded-lg transition-colors cursor-pointer ${
                          silenciado
                            ? ativo
                              ? 'text-amber-300 bg-white/10'
                              : 'text-amber-600 bg-amber-50'
                            : ativo
                            ? 'text-teal-200/70 hover:text-white'
                            : 'text-slate-400 hover:text-slate-700'
                        }`}
                      >
                        {silenciado ? (
                          <BellOff className="w-3.5 h-3.5" />
                        ) : (
                          <Bell className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-6 p-3.5 bg-white rounded-xl border border-slate-200/80 text-xs text-slate-600 space-y-1.5">
            <p className="font-bold text-slate-800 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-teal-600" />
              Controle de Acesso por Sala
            </p>
            <p className="text-2xs text-slate-500 leading-relaxed">
              O Chat dos Aprovados é exclusivo para classificados do cargo, e cada Chat de Lote é restrito aos convocados do respectivo lote.
            </p>
          </div>
        </div>

        {/* Área de Mensagens da Sala */}
        <div className="lg:col-span-8 xl:col-span-9 flex flex-col justify-between bg-slate-50/30 relative">
          {/* Topo da Sala */}
          <div className="px-6 py-3.5 bg-white border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-teal-700">{renderIconeSala(salaAtual)}</span>
              <div>
                <h4 className="text-sm font-bold text-slate-900">{salaAtual.titulo}</h4>
                <p className="text-2xs text-slate-500">{salaAtual.descricao}</p>
              </div>
            </div>
            {salaAtual.temAcesso && (
              <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
                {mensagensFiltradas.length} mensagem(ns)
              </span>
            )}
          </div>

          {!salaAtual.temAcesso ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 mb-3 shadow-xs">
                <Lock className="w-7 h-7" />
              </div>
              <h4 className="text-base font-bold text-slate-900 mb-1">
                Sala Restrita — {salaAtual.titulo}
              </h4>
              <p className="text-xs text-slate-600 max-w-md leading-relaxed">
                {salaAtual.motivoBloqueio ||
                  'Você não possui permissão para visualizar ou enviar mensagens nesta sala.'}
              </p>
            </div>
          ) : (
            <>
              {/* Lista de Mensagens */}
              <div
                ref={messagesContainerRef}
                onScroll={handleScrollContainer}
                className="p-6 space-y-4 max-h-[460px] overflow-y-auto flex-1 relative"
              >
                {mensagensFixadas.length > 0 && (
                  <div className="space-y-2 mb-4">
                    <p className="text-2xs font-bold uppercase tracking-wider text-amber-700 flex items-center gap-1">
                      <Pin className="w-3.5 h-3.5" /> Mensagens Fixadas
                    </p>
                    {mensagensFixadas.map((msg) => (
                      <div
                        key={msg.id}
                        className="bg-amber-50/90 border border-amber-200 rounded-xl p-4 shadow-2xs"
                      >
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-xs text-slate-900">{msg.autor}</span>
                            {msg.is_admin && (
                              <span className="bg-teal-700 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                                <Shield className="w-2.5 h-2.5" /> Admin
                              </span>
                            )}
                          </div>
                          <span className="text-2xs text-slate-400 font-mono">{msg.data_hora}</span>
                        </div>
                        <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line mb-2">
                          {msg.texto}
                        </p>
                        {renderMessageActionsAndReactions(msg)}
                      </div>
                    ))}
                  </div>
                )}

                {mensagensRegulares.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 text-sm">
                    Nenhuma mensagem nesta sala ainda. Seja o primeiro a participar!
                  </div>
                ) : (
                  mensagensRegulares.map((msg) => {
                    const isPrimeiraNaoLida = primeiraNaoLidaId === msg.id;
                    return (
                      <React.Fragment key={msg.id}>
                        {isPrimeiraNaoLida && (
                          <div
                            data-forum-msg-id={msg.id}
                            className="flex items-center gap-2 my-2"
                          >
                            <div className="flex-1 h-px bg-teal-300" />
                            <span className="text-[10px] font-bold uppercase tracking-wider text-teal-800 bg-teal-50 border border-teal-200 px-2.5 py-0.5 rounded-full">
                              Mensagens não lidas a partir daqui
                            </span>
                            <div className="flex-1 h-px bg-teal-300" />
                          </div>
                        )}
                        <div
                          data-forum-msg-id={!isPrimeiraNaoLida ? msg.id : undefined}
                          className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-2xs hover:border-slate-300 transition-all"
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-xs"
                              style={{ backgroundColor: msg.avatar_cor || '#0D5C75' }}
                            >
                              {msg.autor.substring(0, 2).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-xs text-slate-900">
                                    {msg.autor}
                                  </span>
                                  {msg.is_admin && (
                                    <span className="bg-teal-700 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                                      <Shield className="w-2.5 h-2.5" /> Admin
                                    </span>
                                  )}
                                  {msg.posicao_candidato && (
                                    <span className="bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full">
                                      {msg.posicao_candidato}º Lugar
                                    </span>
                                  )}
                                  {msg.comarca_preferida && (
                                    <span className="bg-teal-50 text-teal-800 border border-teal-200 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                                      Prefere: {msg.comarca_preferida}
                                    </span>
                                  )}
                                </div>
                                <span className="text-2xs text-slate-400 font-mono">
                                  {msg.data_hora}
                                </span>
                              </div>

                              <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line mt-1 mb-2.5">
                                {msg.texto}
                              </p>

                              {renderMessageActionsAndReactions(msg)}
                            </div>
                          </div>
                        </div>
                      </React.Fragment>
                    );
                  })
                )}
              </div>

              {mostrarBotaoDescer && (
                <div className="sticky bottom-20 flex justify-end px-6 pointer-events-none z-20">
                  <button
                    type="button"
                    onClick={() => rolarAteOFim(true)}
                    className="pointer-events-auto inline-flex items-center gap-1.5 bg-[#07192B] hover:bg-teal-700 text-white text-xs font-bold px-3.5 py-2 rounded-full shadow-lg border border-teal-400/30 transition-all cursor-pointer"
                    title="Ir ao final da conversa"
                  >
                    <ArrowDown className="w-3.5 h-3.5 text-teal-300" />
                    <span>Ir ao final</span>
                  </button>
                </div>
              )}

              {/* Formulário de Envio */}
              <form
                onSubmit={handleEnviar}
                className="p-4 bg-white border-t border-slate-200 space-y-3"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <input
                    type="number"
                    placeholder="Sua posição no cargo (opcional, ex: 18)"
                    value={posicaoInput}
                    onChange={(e) => setPosicaoInput(e.target.value)}
                    className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600"
                  />
                  <input
                    type="text"
                    placeholder="Lotação de interesse (opcional, ex: Porto Alegre)"
                    value={comarcaInput}
                    onChange={(e) => setComarcaInput(e.target.value)}
                    className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600"
                  />
                </div>

                <div className="flex gap-2 relative">
                  <div className="relative flex items-center">
                    <button
                      type="button"
                      onClick={() => setShowInputEmojiPicker((v) => !v)}
                      className="h-full px-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
                      title="Inserir emoji na mensagem"
                    >
                      <Smile className="w-4 h-4" />
                    </button>

                    {showInputEmojiPicker && (
                      <div className="absolute left-0 bottom-12 z-40 w-72 sm:w-80 bg-white border border-slate-200 rounded-2xl shadow-2xl p-3">
                        <div className="mb-2 pb-2 border-b border-slate-100">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700 flex items-center gap-1 mb-1">
                            <Sparkles className="w-3 h-3" /> Seus Emojis Mais Usados
                          </span>
                          <div className="grid grid-cols-8 gap-1 bg-teal-50/60 p-1.5 rounded-xl border border-teal-100">
                            {emojisFrequentes.map((emj) => (
                              <button
                                key={`inp-freq-${emj}`}
                                type="button"
                                onClick={() => handleInserirEmojiNoTexto(emj)}
                                className="text-base p-1 rounded-lg hover:bg-white cursor-pointer"
                              >
                                {emj}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="max-h-36 overflow-y-auto grid grid-cols-8 gap-1">
                          {TODOS_EMOJIS_CHAT.map((emj, idx) => (
                            <button
                              key={`inp-all-${emj}-${idx}`}
                              type="button"
                              onClick={() => handleInserirEmojiNoTexto(emj)}
                              className="text-base p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
                            >
                              {emj}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <input
                    type="text"
                    required
                    placeholder={
                      usuario
                        ? `Escreva uma mensagem em ${salaAtual.tituloCurto}...`
                        : 'Entre ou cadastre-se para enviar mensagens no chat...'
                    }
                    value={novoTexto}
                    onChange={(e) => setNovoTexto(e.target.value)}
                    className="flex-1 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600"
                  />
                  <button
                    type="submit"
                    className="bg-teal-700 hover:bg-teal-600 text-white font-semibold text-xs sm:text-sm px-5 py-2.5 rounded-xl flex items-center gap-2 transition-colors shadow-xs cursor-pointer"
                  >
                    <Send className="w-4 h-4" />
                    Enviar
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
