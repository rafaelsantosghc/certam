import React, { useState, useEffect, useRef } from 'react';
import { chatStore } from '../store/chatStore';
import { certamStore } from '../store/certamStore';
import { useAuth } from '../store/authContext';
import { notificationStore } from '../store/notificationStore';
import { ChatMensagem, CanalChatId, Concurso } from '../types';
import { sanitizeInput } from '../utils/security';
import {
  MessageSquare,
  X,
  Minimize2,
  Send,
  Heart,
  Pin,
  Bell,
  BellOff,
  Smile,
  ChevronDown,
  Sparkles,
  Check,
  Building,
} from 'lucide-react';

const CANAIS: { id: CanalChatId; nome: string; emoji: string }[] = [
  { id: 'geral', nome: 'Geral', emoji: '💬' },
  { id: 'lotacao', nome: 'Lotação', emoji: '📍' },
  { id: 'posse', nome: 'Posse', emoji: '📑' },
  { id: 'recursos', nome: 'Recursos', emoji: '⚖️' },
];

const FULL_EMOJIS = [
  '👍', '❤️', '🔥', '🎉', '🚀', '👏', '💡', '✨', '🏆', '🎯',
  '🥳', '💯', '🤩', '🙏', '🧠', '⚖️', '📋', '📊', '🥇', '⚡',
  '🦉', '⭐', '🌟', '💥', '💬', '📢', '📌', '🔍', '🔔', '😍',
  '😂', '🤔', '💻', '📚', '💼', '💪', '🙌', '👀', '✨', '☕'
];

export const PersistentChatWidget: React.FC = () => {
  const { usuario, isAdmin } = useAuth();
  const [aberto, setAberto] = useState(false);
  const [concursos, setConcursos] = useState<Concurso[]>(() => certamStore.getConcursos());
  const [concursoSelecionadoId, setConcursoSelecionadoId] = useState<string>('portal_geral');
  const [canalAtivo, setCanalAtivo] = useState<CanalChatId>('geral');
  
  const [mensagens, setMensagens] = useState<ChatMensagem[]>([]);
  const [novoTexto, setNovoTexto] = useState('');
  const [emojiPickerMsgId, setEmojiPickerMsgId] = useState<string | null>(null);
  const [silenciado, setSilenciado] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastMsgCountRef = useRef<number>(0);

  // Sincronizar concursos
  useEffect(() => {
    const list = certamStore.getConcursos();
    setConcursos(list);
    if (list.length > 0 && concursoSelecionadoId === 'portal_geral') {
      // default to first concurso if desired, or keep portal_geral
    }
  }, []);

  const realConcursoId = concursoSelecionadoId === 'portal_geral' ? (concursos[0]?.id || 'geral') : concursoSelecionadoId;
  const cargoIdFixo = 'geral';
  const roomKey = `${realConcursoId}_${canalAtivo}`;

  // Carregar mensagens e verificar silenciamento
  useEffect(() => {
    const msgs = chatStore.getMensagens(realConcursoId, cargoIdFixo, canalAtivo);
    setMensagens(msgs);
    lastMsgCountRef.current = msgs.length;
    setSilenciado(chatStore.isSalaSilenciada(roomKey));

    const handleUpdate = (e: any) => {
      const detail = e.detail;
      const updatedMsgs = chatStore.getMensagens(realConcursoId, cargoIdFixo, canalAtivo);
      setMensagens(updatedMsgs);

      if (!aberto && detail && !chatStore.isSalaSilenciada(roomKey)) {
        const ultima = updatedMsgs[updatedMsgs.length - 1];
        if (ultima && ultima.email !== usuario?.email) {
          setUnreadCount((prev) => prev + 1);
          notificationStore.criarNotificacao({
            destinatario_papel: 'candidato',
            destinatario_email: usuario?.email || 'candidato@certam.com.br',
            destinatario_nome: usuario?.nome || 'Candidato',
            titulo: `Nova mensagem no chat (${canalAtivo})`,
            mensagem: `"${ultima.autor}": ${ultima.texto.substring(0, 70)}...`,
            tipo: 'chat',
            urgente: false,
          });
        }
      }
    };

    window.addEventListener('certam_chat_updated', handleUpdate);
    return () => window.removeEventListener('certam_chat_updated', handleUpdate);
  }, [realConcursoId, cargoIdFixo, canalAtivo, aberto, usuario]);

  // Scroll to bottom when opening or new message
  useEffect(() => {
    if (aberto) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [aberto, mensagens]);

  const handleToggleSilenciar = () => {
    const next = chatStore.alternarSilenciarSala(roomKey);
    setSilenciado(next);
  };

  const handleEnviar = (e: React.FormEvent) => {
    e.preventDefault();
    const textoLimpo = sanitizeInput(novoTexto, 1500);
    if (!textoLimpo) return;

    const autorFinal = usuario?.nome || 'Candidato CERTAM';
    const emailFinal = usuario?.email || 'candidato@certam.com.br';

    chatStore.enviarMensagem(realConcursoId, cargoIdFixo, canalAtivo, autorFinal, emailFinal, textoLimpo, {
      isAdmin: Boolean(isAdmin),
    });

    setNovoTexto('');
  };

  const handleCurtir = (msgId: string) => {
    const userEmail = usuario?.email || 'candidato@certam.com.br';
    chatStore.curtirMensagem(realConcursoId, cargoIdFixo, canalAtivo, msgId, userEmail);
    setMensagens(chatStore.getMensagens(realConcursoId, cargoIdFixo, canalAtivo));
  };

  const handleReagirEmoji = (msgId: string, emoji: string) => {
    const userEmail = usuario?.email || 'candidato@certam.com.br';
    chatStore.reagirEmoji(realConcursoId, cargoIdFixo, canalAtivo, msgId, emoji, userEmail);
    setMensagens(chatStore.getMensagens(realConcursoId, cargoIdFixo, canalAtivo));
    setEmojiPickerMsgId(null);
  };

  const frequentes = chatStore.getEmojisFrequentes();

  return (
    <>
      {/* Botão Flutuante Inferior Direito */}
      <div className="fixed bottom-6 right-6 z-[120]">
        {!aberto && (
          <button
            type="button"
            onClick={() => {
              setAberto(true);
              setUnreadCount(0);
            }}
            className="w-14 h-14 rounded-full bg-[#07192B] hover:bg-[#0C2640] text-[#2DD4AA] shadow-2xl border-2 border-teal-500/50 flex items-center justify-center transition-transform hover:scale-105 cursor-pointer relative group"
            title="Abrir Chat Persistente do Portal"
          >
            <MessageSquare className="w-6 h-6" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-6 h-6 bg-rose-600 text-white font-bold text-xs rounded-full flex items-center justify-center shadow-md animate-pulse">
                {unreadCount}
              </span>
            )}
            <span className="absolute right-full mr-3 top-1/2 -translate-y-1/2 px-3 py-1 bg-slate-900 text-white text-xs font-bold rounded-xl shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
              Chat ao Vivo • Concursos
            </span>
          </button>
        )}
      </div>

      {/* Painel do Chat Persistente */}
      {aberto && (
        <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 w-[calc(100vw-2rem)] sm:w-[420px] h-[580px] z-[130] bg-white rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in slide-in-from-bottom-5">
          {/* Header do Chat */}
          <div className="p-4 bg-[#07192B] text-white flex flex-col gap-3 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-teal-500/20 text-[#2DD4AA] flex items-center justify-center font-bold">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-sm sm:text-base text-white">
                    Chat ao Vivo • CERTAM
                  </h3>
                  <p className="text-2xs text-teal-300">
                    Converse com concursados em tempo real
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                {/* Botão Silenciar */}
                <button
                  type="button"
                  onClick={handleToggleSilenciar}
                  className={`p-2 rounded-xl transition-colors cursor-pointer ${
                    silenciado
                      ? 'bg-rose-500/20 text-rose-300'
                      : 'bg-white/10 text-white hover:bg-white/20'
                  }`}
                  title={silenciado ? 'Notificações silenciadas para esta sala' : 'Silenciar notificações desta sala'}
                >
                  {silenciado ? <BellOff className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
                </button>

                {/* Minimizar */}
                <button
                  type="button"
                  onClick={() => setAberto(false)}
                  className="p-2 rounded-xl bg-white/10 text-white hover:bg-white/25 transition-colors cursor-pointer"
                  title="Minimizar Chat"
                >
                  <Minimize2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Seletor de Concursos / Sala */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              <select
                value={concursoSelecionadoId}
                onChange={(e) => setConcursoSelecionadoId(e.target.value)}
                className="w-full bg-[#0C2640] border border-teal-500/30 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-hidden"
              >
                <option value="portal_geral">💬 Geral do Portal</option>
                {concursos.map((c) => (
                  <option key={c.id} value={c.id}>
                    🏛️ {c.orgao} ({c.ano})
                  </option>
                ))}
              </select>
            </div>

            {/* Sub-abas de Canais */}
            <div className="flex items-center gap-1 overflow-x-auto pt-1">
              {CANAIS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCanalAtivo(c.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1 ${
                    canalAtivo === c.id
                      ? 'bg-[#2DD4AA] text-slate-950 font-bold'
                      : 'bg-white/10 hover:bg-white/20 text-slate-300'
                  }`}
                >
                  <span>{c.emoji}</span>
                  <span>{c.nome}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Lista de Mensagens */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/60">
            {mensagens.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs text-center py-12 space-y-2">
                <MessageSquare className="w-8 h-8 text-slate-300" />
                <p>Nenhuma mensagem nesta conversa ainda. Seja o primeiro a enviar!</p>
              </div>
            ) : (
              mensagens.map((msg) => {
                const userEmail = usuario?.email || 'candidato@certam.com.br';
                const jaCurtiu = Boolean(msg.curtido_por?.includes(userEmail));
                const isMinha = msg.email?.toLowerCase() === userEmail.toLowerCase();

                return (
                  <div
                    key={msg.id}
                    className={`p-3 rounded-2xl border text-xs space-y-1.5 transition-all ${
                      msg.is_admin
                        ? 'bg-amber-50/60 border-amber-200'
                        : isMinha
                        ? 'bg-teal-50/50 border-teal-200 ml-4'
                        : 'bg-white border-slate-200 mr-4'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-slate-900">{msg.autor}</span>
                        {msg.is_admin && (
                          <span className="text-3xs font-bold bg-amber-200 text-amber-900 px-1 py-0.2 rounded font-mono">
                            ADMIN
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">{msg.data_hora}</span>
                    </div>

                    <p className="text-slate-700 leading-relaxed whitespace-pre-line">{msg.texto}</p>

                    {/* Reações de Emojis Existentes */}
                    {msg.reacoes && Object.keys(msg.reacoes).length > 0 && (
                      <div className="flex items-center gap-1 flex-wrap pt-1">
                        {Object.entries(msg.reacoes).map(([emoji, emails]) => {
                          const userReagiu = emails.includes(userEmail);
                          return (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => handleReagirEmoji(msg.id, emoji)}
                              className={`px-2 py-0.5 rounded-full text-xs flex items-center gap-1 border transition-colors cursor-pointer ${
                                userReagiu
                                  ? 'bg-teal-100 border-teal-300 text-teal-900 font-bold'
                                  : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                              }`}
                            >
                              <span>{emoji}</span>
                              <span className="text-[10px] font-mono">{emails.length}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Ações Inferiores da Mensagem: Curtir e Reagir com Emoji */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-2xs text-slate-500">
                      <div className="flex items-center gap-3">
                        {/* Curtida com Toggle */}
                        <button
                          type="button"
                          onClick={() => handleCurtir(msg.id)}
                          className={`flex items-center gap-1 transition-colors cursor-pointer ${
                            jaCurtiu ? 'text-rose-600 font-bold' : 'hover:text-rose-600'
                          }`}
                          title={jaCurtiu ? 'Retirar curtida' : 'Curtir mensagem'}
                        >
                          <Heart className={`w-3.5 h-3.5 text-rose-500 ${jaCurtiu ? 'fill-rose-500' : 'fill-rose-500/20'}`} />
                          <span>{msg.curtidas || 0}</span>
                        </button>

                        {/* Botão Abrir Emoji Picker */}
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setEmojiPickerMsgId(emojiPickerMsgId === msg.id ? null : msg.id)}
                            className="flex items-center gap-1 hover:text-teal-700 transition-colors cursor-pointer text-slate-400"
                            title="Reagir com emoji"
                          >
                            <Smile className="w-3.5 h-3.5" />
                            <span>Reagir</span>
                          </button>

                          {/* Popup Picker de Emojis */}
                          {emojiPickerMsgId === msg.id && (
                            <div className="absolute left-0 bottom-full mb-2 p-2.5 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 w-64 space-y-2">
                              <div className="text-[10px] font-bold text-slate-500 uppercase font-mono">
                                Emojis Frequentes
                              </div>
                              <div className="flex items-center gap-1 flex-wrap">
                                {frequentes.map((em) => (
                                  <button
                                    key={em}
                                    type="button"
                                    onClick={() => handleReagirEmoji(msg.id, em)}
                                    className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-sm transition-transform hover:scale-125 cursor-pointer"
                                  >
                                    {em}
                                  </button>
                                ))}
                              </div>

                              <div className="text-[10px] font-bold text-slate-500 uppercase font-mono pt-1 border-t border-slate-100">
                                Todos os Emojis
                              </div>
                              <div className="grid grid-cols-8 gap-1 max-h-36 overflow-y-auto">
                                {FULL_EMOJIS.map((em, idx) => (
                                  <button
                                    key={idx}
                                    type="button"
                                    onClick={() => handleReagirEmoji(msg.id, em)}
                                    className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-sm transition-transform hover:scale-125 cursor-pointer"
                                  >
                                    {em}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input de Envio */}
          <form onSubmit={handleEnviar} className="p-3 bg-white border-t border-slate-200 shrink-0">
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Escreva sua mensagem..."
                value={novoTexto}
                onChange={(e) => setNovoTexto(e.target.value)}
                className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-teal-600 focus:outline-hidden"
              />
              <button
                type="submit"
                disabled={!novoTexto.trim()}
                className="px-4 py-2 bg-[#07192B] hover:bg-[#0C2640] text-[#2DD4AA] disabled:opacity-40 font-bold rounded-xl text-xs transition-colors cursor-pointer flex items-center gap-1 shadow-xs"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Enviar</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
};
