import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../store/authContext';
import { dmStore } from '../store/dmStore';
import { MensagemPrivada } from '../types';
import { sanitizeInput } from '../utils/security';
import {
  X,
  Send,
  User,
  MessageCircle,
  ShieldAlert,
  ShieldCheck,
  Search,
  BellOff,
  Bell,
  Lock,
} from 'lucide-react';

interface MensagensPrivadasDrawerProps {
  aberto: boolean;
  onClose: () => void;
  destinatarioInicialEmail?: string;
  destinatarioInicialNome?: string;
}

export const MensagensPrivadasDrawer: React.FC<MensagensPrivadasDrawerProps> = ({
  aberto,
  onClose,
  destinatarioInicialEmail,
  destinatarioInicialNome,
}) => {
  const { usuario } = useAuth();
  const [conversas, setConversas] = useState<any[]>([]);
  const [contatoAtivoEmail, setContatoAtivoEmail] = useState<string | null>(null);
  const [contatoAtivoNome, setContatoAtivoNome] = useState<string>('');
  const [mensagens, setMensagens] = useState<MensagemPrivada[]>([]);
  const [texto, setTexto] = useState('');
  const [filtroBusca, setFiltroBusca] = useState('');
  const [isBloqueado, setIsBloqueado] = useState(false);
  const [silenciado, setSilenciado] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const meuEmail = usuario?.email || '';

  // Carregar lista de conversas
  const recarregarConversas = () => {
    if (!meuEmail) return;
    const lista = dmStore.getContatosConversas(meuEmail);
    setConversas(lista);
  };

  useEffect(() => {
    recarregarConversas();
    const handleUpdate = () => {
      recarregarConversas();
      if (contatoAtivoEmail) {
        setMensagens(dmStore.getMensagensEntre(meuEmail, contatoAtivoEmail));
        setIsBloqueado(dmStore.isUsuarioBloqueado(meuEmail, contatoAtivoEmail));
      }
    };
    window.addEventListener('certam_dm_updated', handleUpdate);
    window.addEventListener('certam_blocked_updated', handleUpdate);
    return () => {
      window.removeEventListener('certam_dm_updated', handleUpdate);
      window.removeEventListener('certam_blocked_updated', handleUpdate);
    };
  }, [meuEmail, contatoAtivoEmail]);

  // Se abrir com um destinatário específico (ex: clicou em mensagem no perfil ou ranking)
  useEffect(() => {
    if (destinatarioInicialEmail) {
      setContatoAtivoEmail(destinatarioInicialEmail);
      setContatoAtivoNome(destinatarioInicialNome || destinatarioInicialEmail);
    } else if (conversas.length > 0 && !contatoAtivoEmail) {
      setContatoAtivoEmail(conversas[0].email);
      setContatoAtivoNome(conversas[0].nome);
    }
  }, [destinatarioInicialEmail, destinatarioInicialNome, conversas]);

  // Carregar mensagens da conversa ativa
  useEffect(() => {
    if (meuEmail && contatoAtivoEmail) {
      const msgs = dmStore.getMensagensEntre(meuEmail, contatoAtivoEmail);
      setMensagens(msgs);
      setIsBloqueado(dmStore.isUsuarioBloqueado(meuEmail, contatoAtivoEmail));
      dmStore.marcarComoLidas(meuEmail, contatoAtivoEmail);
      recarregarConversas();
    }
  }, [meuEmail, contatoAtivoEmail]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensagens]);

  if (!aberto || !usuario) return null;

  const handleEnviar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!texto.trim() || !contatoAtivoEmail || isBloqueado) return;

    dmStore.enviarMensagem({
      remetente_email: meuEmail,
      remetente_nome: usuario.nome,
      destinatario_email: contatoAtivoEmail,
      destinatario_nome: contatoAtivoNome,
      texto: sanitizeInput(texto, 1000),
    });

    setTexto('');
  };

  const handleToggleBloqueio = () => {
    if (!contatoAtivoEmail) return;
    if (isBloqueado) {
      dmStore.desbloquearUsuario(meuEmail, contatoAtivoEmail);
      setIsBloqueado(false);
    } else {
      if (window.confirm(`Deseja realmente bloquear ${contatoAtivoNome}? Vocês não poderão mais trocar mensagens.`)) {
        dmStore.bloquearUsuario(meuEmail, contatoAtivoEmail);
        setIsBloqueado(true);
      }
    }
  };

  const conversasFiltradas = conversas.filter(
    (c) =>
      c.nome.toLowerCase().includes(filtroBusca.toLowerCase()) ||
      c.email.toLowerCase().includes(filtroBusca.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/60 backdrop-blur-xs animate-in fade-in-50">
      <div className="bg-white w-full max-w-2xl h-full shadow-2xl border-l border-slate-200 flex flex-col">
        {/* Header do Drawer */}
        <div className="p-4 bg-[#07192B] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-500/20 text-[#2DD4AA] flex items-center justify-center font-bold">
              <MessageCircle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-base text-white">Mensagens Privadas</h3>
              <p className="text-2xs text-slate-300">Comunicação direta e segura entre candidatos aprovados</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Layout Dividido: Lista de Conversas (Esquerda) + Chat Ativo (Direita) */}
        <div className="flex-1 flex overflow-hidden">
          {/* Painel Esquerdo: Lista de Contatos */}
          <div className="w-1/3 border-r border-slate-200 flex flex-col bg-slate-50">
            <div className="p-3 border-b border-slate-200 bg-white">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Buscar colega..."
                  value={filtroBusca}
                  onChange={(e) => setFiltroBusca(e.target.value)}
                  className="w-full pl-8 pr-2.5 py-1.5 bg-slate-100 rounded-lg text-xs focus:bg-white focus:outline-hidden"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
              {conversasFiltradas.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400">
                  Nenhuma conversa iniciada.
                </div>
              ) : (
                conversasFiltradas.map((conv) => {
                  const isSelecionado = contatoAtivoEmail === conv.email;
                  return (
                    <div
                      key={conv.email}
                      onClick={() => {
                        setContatoAtivoEmail(conv.email);
                        setContatoAtivoNome(conv.nome);
                      }}
                      className={`p-3 transition-colors cursor-pointer ${
                        isSelecionado ? 'bg-teal-50 border-r-2 border-teal-600' : 'hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-800 truncate block">
                          {conv.nome}
                        </span>
                        {conv.naoLidas > 0 && (
                          <span className="bg-[#2DD4AA] text-slate-950 font-mono text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                            {conv.naoLidas}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">{conv.ultimaMensagem}</p>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Painel Direito: Chat da Conversa */}
          <div className="flex-1 flex flex-col bg-white">
            {contatoAtivoEmail ? (
              <>
                {/* Header do Chat Ativo com Ações de Bloqueio e Silenciar */}
                <div className="p-3 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-[#135A7A] text-white flex items-center justify-center font-bold text-xs">
                      {contatoAtivoNome ? contatoAtivoNome.slice(0, 2).toUpperCase() : 'CD'}
                    </div>
                    <div>
                      <span className="font-bold text-xs text-slate-900 block leading-tight">
                        {contatoAtivoNome}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono truncate block">
                        {contatoAtivoEmail}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setSilenciado(!silenciado)}
                      className={`p-1.5 rounded-lg text-xs cursor-pointer ${
                        silenciado ? 'text-amber-600 bg-amber-50' : 'text-slate-400 hover:text-slate-700'
                      }`}
                      title={silenciado ? 'Desilenciar notificações' : 'Silenciar notificações'}
                    >
                      {silenciado ? <BellOff className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
                    </button>

                    <button
                      type="button"
                      onClick={handleToggleBloqueio}
                      className={`p-1.5 rounded-lg text-xs cursor-pointer ${
                        isBloqueado
                          ? 'text-rose-700 bg-rose-50 font-bold'
                          : 'text-slate-400 hover:text-rose-600'
                      }`}
                      title={isBloqueado ? 'Desbloquear candidato' : 'Bloquear candidato'}
                    >
                      {isBloqueado ? <ShieldAlert className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Área de Mensagens */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {isBloqueado && (
                    <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-2xs text-center flex items-center justify-center gap-1.5">
                      <Lock className="w-3.5 h-3.5" />
                      <span>Este candidato está bloqueado. Desbloqueie para voltar a conversar.</span>
                    </div>
                  )}

                  {mensagens.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-xs text-slate-400 text-center">
                      Envie a primeira mensagem para iniciar o diálogo sobre lotações e comarcas.
                    </div>
                  ) : (
                    mensagens.map((m) => {
                      const souEu = m.remetente_email.toLowerCase() === meuEmail.toLowerCase();
                      return (
                        <div key={m.id} className={`flex ${souEu ? 'justify-end' : 'justify-start'}`}>
                          <div
                            className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed ${
                              souEu
                                ? 'bg-[#07192B] text-white rounded-br-xs'
                                : 'bg-slate-100 text-slate-800 rounded-bl-xs border border-slate-200'
                            }`}
                          >
                            <p>{m.texto}</p>
                            <span
                              className={`block text-[9px] mt-1 text-right font-mono ${
                                souEu ? 'text-teal-300' : 'text-slate-400'
                              }`}
                            >
                              {m.data_hora}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input de Envio */}
                <form
                  onSubmit={handleEnviar}
                  className="p-3 border-t border-slate-200 bg-white flex items-center gap-2 shrink-0"
                >
                  <input
                    type="text"
                    disabled={isBloqueado}
                    placeholder={isBloqueado ? 'Candidato bloqueado' : 'Escreva uma mensagem privada...'}
                    value={texto}
                    onChange={(e) => setTexto(e.target.value)}
                    className="flex-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:bg-white focus:border-teal-600 focus:outline-hidden disabled:bg-slate-100"
                  />
                  <button
                    type="submit"
                    disabled={isBloqueado || !texto.trim()}
                    className="p-2 bg-[#07192B] hover:bg-[#0C2640] text-[#2DD4AA] disabled:opacity-40 rounded-xl transition-colors cursor-pointer"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400 p-6 text-center">
                Selecione uma conversa ao lado para visualizar as mensagens privadas.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
