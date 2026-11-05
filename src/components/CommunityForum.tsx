import React, { useState, useEffect, useRef } from 'react';
import { ChatMensagem, CanalChatId } from '../types';
import {
  chatStore,
  CATALOGO_EMOJIS_CATEGORIAS,
  TODOS_EMOJIS_CHAT,
} from '../store/chatStore';
import { dmStore } from '../store/dmStore';
import { cloudSync } from '../store/cloudSync';
import { useAuth } from '../store/authContext';
import {
  MessageSquare,
  Send,
  Pin,
  Trash2,
  Heart,
  Shield,
  Hash,
  MapPin,
  FileCheck,
  Scale,
  Bell,
  BellOff,
  Mail,
  Ban,
  Smile,
  Sparkles,
  Volume2,
  VolumeX,
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

const CANAIS: { id: CanalChatId; nome: string; desc: string; icone: React.ReactNode }[] = [
  {
    id: 'geral',
    nome: 'Bate-papo Geral',
    desc: 'Conversas gerais sobre o andamento do certame e expectativas',
    icone: <Hash className="w-4 h-4" />,
  },
  {
    id: 'lotacao',
    nome: 'Escolha de Lotação',
    desc: 'Troca de informações sobre cidades, vagas e intenções de escolha',
    icone: <MapPin className="w-4 h-4" />,
  },
  {
    id: 'posse',
    nome: 'Exames e Posse',
    desc: 'Dúvidas sobre documentação, exames médicos e trâmites de posse',
    icone: <FileCheck className="w-4 h-4" />,
  },
  {
    id: 'recursos',
    nome: 'Recursos e Cotas',
    desc: 'Discussões sobre etapas recursais, heteroidentificação e perícias',
    icone: <Scale className="w-4 h-4" />,
  },
];

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
  const [canalAtivo, setCanalAtivo] = useState<CanalChatId>('geral');
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const salaSilenciada = chatStore.isSalaSilenciada(concursoId, canalAtivo);
  const concursoSilenciado = chatStore.isConcursoSilenciado(concursoId);

  const carregarMensagens = () => {
    const msgs = chatStore.getMensagens(concursoId, cargoId, canalAtivo);
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

    // Sincronização em tempo real contínua para conversa fluida
    const rtInterval = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      void cloudSync.pullFromServer();
    }, 2500);

    return () => {
      window.removeEventListener('certam_chat_updated', handleUpdate);
      window.removeEventListener('certam_blocked_updated', handleUpdate);
      window.removeEventListener('certam_chat_mute_updated', handleMuteUpdate);
      window.removeEventListener('certam_emojis_updated', handleEmojiUpdate);
      window.removeEventListener('storage', handleUpdate);
      window.clearInterval(rtInterval);
    };
  }, [concursoId, cargoId, canalAtivo, usuario]);

  const handleEnviar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoTexto.trim()) return;
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

    chatStore.enviarMensagem(concursoId, cargoId, canalAtivo, {
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
    });

    setNovoTexto('');
    setShowInputEmojiPicker(false);
    carregarMensagens();
  };

  const handleCurtir = (msgId: string) => {
    chatStore.curtirMensagem(concursoId, cargoId, canalAtivo, msgId, usuario);
    carregarMensagens();
  };

  const handleReagirEmoji = (msgId: string, emoji: string) => {
    chatStore.reagirEmoji(concursoId, cargoId, canalAtivo, msgId, emoji, usuario);
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
    chatStore.alternarFixado(concursoId, cargoId, canalAtivo, msgId);
    carregarMensagens();
  };

  const handleApagar = (msgId: string) => {
    if (!isAdmin) return;
    chatStore.apagarMensagem(concursoId, cargoId, canalAtivo, msgId);
    carregarMensagens();
  };

  const handleToggleMuteCanal = (canalId: CanalChatId) => {
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

  const mensagensFiltradas = mensagens.filter(
    (m) =>
      !bloqueadosList.includes(m.email.toLowerCase()) &&
      !(usuario?.usuarios_bloqueados || []).includes(m.email)
  );

  const mensagensFixadas = mensagensFiltradas.filter((m) => m.is_fixado);
  const mensagensRegulares = mensagensFiltradas.filter((m) => !m.is_fixado);
  const canalInfo = CANAIS.find((c) => c.id === canalAtivo) || CANAIS[0];

  const renderMessageActionsAndReactions = (msg: ChatMensagem) => {
    const jaCurtiu = chatStore.usuarioCurtiuMensagem(msg, usuario);
    const minhaReacao = chatStore.obterReacaoDoUsuario(msg, usuario);
    const totalCurtidas = Array.isArray(msg.curtido_por) ? msg.curtido_por.length : 0;
    const reacoesEntries = Object.entries(msg.reacoes || {}).filter(
      ([, lista]) => Array.isArray(lista) && lista.length > 0
    );

    return (
      <div className="pt-2 border-t border-slate-100 space-y-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center flex-wrap gap-1.5 relative">
            {/* Botão Curtir (Toggle único por usuário) */}
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

            {/* Reações de Emoji existentes na mensagem */}
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

            {/* Botão Abrir Seletor Completo de Emojis */}
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
                  {/* Emojis mais utilizados pelo usuário */}
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

                  {/* Abas de categorias de emojis */}
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

                  {/* Grade de todos os emojis da categoria */}
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

          {/* Ações de Mensagem Privada, Bloqueio e Moderação Admin */}
          <div className="flex items-center gap-3">
            {usuario && usuario.email.toLowerCase() !== msg.email.toLowerCase() && (
              <>
                {onAbrirDM && (
                  <button
                    type="button"
                    onClick={() => onAbrirDM(msg.email, msg.autor)}
                    className="text-xs text-teal-700 hover:text-teal-900 font-semibold flex items-center gap-1 cursor-pointer"
                    title="Enviar mensagem privada (1 a 1)"
                  >
                    <Mail className="w-3.5 h-3.5" /> Mensagem Privada
                  </button>
                )}
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
            Comunidade & Fórum Oficial em Tempo Real
          </div>
          <h3 className="text-xl font-bold tracking-tight font-serif">
            {concursoNome ? `${concursoNome} — ${cargoNome}` : cargoNome}
          </h3>
          <p className="text-xs text-slate-300 mt-0.5">
            Espaço sincronizado em tempo real com o chat flutuante do portal.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
          <button
            type="button"
            onClick={() => handleToggleMuteCanal(canalAtivo)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border transition-all cursor-pointer ${
              salaSilenciada
                ? 'bg-amber-500/20 border-amber-400/40 text-amber-200 hover:bg-amber-500/30'
                : 'bg-white/10 border-white/15 text-slate-200 hover:bg-white/15'
            }`}
            title={
              salaSilenciada
                ? 'Reativar notificações deste canal'
                : 'Silenciar notificações deste canal'
            }
          >
            {salaSilenciada ? (
              <>
                <BellOff className="w-4 h-4 text-amber-300" />
                Canal Silenciado
              </>
            ) : (
              <>
                <Bell className="w-4 h-4 text-teal-300" />
                Silenciar Canal
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
            title={
              concursoSilenciado
                ? 'Reativar notificações de todas as conversas deste concurso'
                : 'Silenciar todas as notificações deste concurso'
            }
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
        {/* Barra Lateral de Canais */}
        <div className="lg:col-span-4 xl:col-span-3 bg-slate-50 border-b lg:border-b-0 lg:border-r border-slate-200 p-4 flex flex-col justify-between">
          <div>
            <p className="text-2xs font-bold uppercase tracking-wider text-slate-400 px-2 mb-2.5">
              Canais de Discussão
            </p>
            <div className="space-y-1.5">
              {CANAIS.map((c) => {
                const ativo = canalAtivo === c.id;
                const silenciado = chatStore.isSalaSilenciada(concursoId, c.id);
                return (
                  <div key={c.id} className="relative group">
                    <button
                      type="button"
                      onClick={() => setCanalAtivo(c.id)}
                      className={`w-full text-left px-3 py-2.5 rounded-xl transition-all flex items-start gap-2.5 cursor-pointer ${
                        ativo
                          ? 'bg-teal-700 text-white shadow-xs'
                          : 'text-slate-700 hover:bg-slate-200/70'
                      }`}
                    >
                      <div className={`mt-0.5 ${ativo ? 'text-teal-200' : 'text-slate-400'}`}>
                        {c.icone}
                      </div>
                      <div className="flex-1 min-w-0 pr-6">
                        <div className="text-xs font-bold flex items-center gap-1.5">
                          <span className="truncate">{c.nome}</span>
                        </div>
                        <p
                          className={`text-2xs line-clamp-1 mt-0.5 ${
                            ativo ? 'text-teal-100' : 'text-slate-500'
                          }`}
                        >
                          {c.desc}
                        </p>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleMuteCanal(c.id);
                      }}
                      title={
                        silenciado
                          ? 'Ativar notificações deste canal'
                          : 'Silenciar notificações deste canal'
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
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-6 p-3.5 bg-white rounded-xl border border-slate-200/80 text-xs text-slate-600 space-y-1.5">
            <p className="font-bold text-slate-800 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-teal-600" />
              Diretrizes da Comunidade
            </p>
            <p className="text-2xs text-slate-500 leading-relaxed">
              Mantenha o respeito mútuo. Cada usuário pode curtir e reagir 1 vez por mensagem (clique novamente para retirar).
            </p>
          </div>
        </div>

        {/* Área de Mensagens do Canal */}
        <div className="lg:col-span-8 xl:col-span-9 flex flex-col justify-between bg-slate-50/30">
          {/* Topo do Canal */}
          <div className="px-6 py-3.5 bg-white border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-teal-700">{canalInfo.icone}</span>
              <div>
                <h4 className="text-sm font-bold text-slate-900">{canalInfo.nome}</h4>
                <p className="text-2xs text-slate-500">{canalInfo.desc}</p>
              </div>
            </div>
            <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
              {mensagensFiltradas.length} mensagem(ns)
            </span>
          </div>

          {/* Lista de Mensagens */}
          <div className="p-6 space-y-4 max-h-[460px] overflow-y-auto flex-1">
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
                        {msg.posicao_candidato && (
                          <span className="bg-slate-200 text-slate-700 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full">
                            {msg.posicao_candidato}º Lugar
                          </span>
                        )}
                        {msg.comarca_preferida && (
                          <span className="bg-teal-50 text-teal-800 border border-teal-200 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                            Interesse: {msg.comarca_preferida}
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
                Nenhuma mensagem neste canal ainda. Seja o primeiro a participar!
              </div>
            ) : (
              mensagensRegulares.map((msg) => (
                <div
                  key={msg.id}
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
                          <span className="font-bold text-xs text-slate-900">{msg.autor}</span>
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
                        <span className="text-2xs text-slate-400 font-mono">{msg.data_hora}</span>
                      </div>

                      <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line mt-1 mb-2.5">
                        {msg.texto}
                      </p>

                      {renderMessageActionsAndReactions(msg)}
                    </div>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Formulário de Envio */}
          <form onSubmit={handleEnviar} className="p-4 bg-white border-t border-slate-200 space-y-3">
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
                    ? `Escreva uma mensagem em #${canalInfo.nome.toLowerCase()}...`
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
        </div>
      </div>
    </div>
  );
};
