import React, { useState, useEffect, useRef } from 'react';
import { chatStore } from '../store/chatStore';
import { useAuth } from '../store/authContext';
import { ChatMensagem, CanalChatId } from '../types';
import {
  MessageSquare,
  Pin,
  Send,
  Heart,
  Trash2,
  Users,
  ShieldAlert,
  Sparkles,
  MapPin,
  Trophy,
  Filter,
} from 'lucide-react';

interface CommunityForumProps {
  concursoId: string;
  cargoId: string;
  cargoNome: string;
  isCompact?: boolean;
}

const CANAIS: { id: CanalChatId; nome: string; descricao: string; emoji: string }[] = [
  { id: 'geral', nome: 'Bate-papo Geral', descricao: 'Discussões gerais e alinhamentos', emoji: '💬' },
  { id: 'lotacao', nome: 'Escolha de Comarcas', descricao: 'Cidades, distâncias e preferências', emoji: '📍' },
  { id: 'posse', nome: 'Posse & Exames DMJ', descricao: 'Documentos, laudos e prazos', emoji: '📑' },
  { id: 'recursos', nome: 'Recursos & Editais', descricao: 'Homologação e questões jurídicas', emoji: '⚖️' },
];

export const CommunityForum: React.FC<CommunityForumProps> = ({
  concursoId,
  cargoId,
  cargoNome,
  isCompact = false,
}) => {
  const { usuario, isAdmin } = useAuth();
  const [canalAtivo, setCanalAtivo] = useState<CanalChatId>('geral');
  const [mensagens, setMensagens] = useState<ChatMensagem[]>(() =>
    chatStore.getMensagens(concursoId, cargoId, 'geral')
  );

  const [novoTexto, setNovoTexto] = useState('');
  const [nomeAutor, setNomeAutor] = useState(usuario?.nome || '');
  const [posicaoAutor, setPosicaoAutor] = useState<string>('');
  const [comarcaAutor, setComarcaAutor] = useState<string>('');
  const [mostrarOpcoesAutor, setMostrarOpcoesAutor] = useState(false);
  const [fixarNovaMsg, setFixarNovaMsg] = useState(false);

  const mensagensEndRef = useRef<HTMLDivElement>(null);

  // Carrega mensagens e ouve evento de atualização
  useEffect(() => {
    setMensagens(chatStore.getMensagens(concursoId, cargoId, canalAtivo));

    const handleUpdate = () => {
      setMensagens(chatStore.getMensagens(concursoId, cargoId, canalAtivo));
    };

    window.addEventListener('certam_chat_updated', handleUpdate);
    return () => window.removeEventListener('certam_chat_updated', handleUpdate);
  }, [concursoId, cargoId, canalAtivo]);

  // Mensagens fixadas vs normais
  const mensagensFixadas = mensagens.filter((m) => m.is_fixado);
  const mensagensNormais = mensagens.filter((m) => !m.is_fixado);

  const handleEnviar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoTexto.trim()) return;

    const autorFinal = nomeAutor.trim() || usuario?.nome || 'Candidato Aprovado';
    const emailFinal = usuario?.email || 'candidato@certam.com.br';

    chatStore.enviarMensagem(concursoId, cargoId, canalAtivo, autorFinal, emailFinal, novoTexto.trim(), {
      isAdmin: Boolean(isAdmin),
      isFixado: isAdmin && fixarNovaMsg,
      posicao: posicaoAutor ? Number(posicaoAutor) : undefined,
      comarcaPreferida: comarcaAutor.trim() || undefined,
    });

    setNovoTexto('');
    setFixarNovaMsg(false);
    setTimeout(() => {
      mensagensEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleCurtir = (msgId: string) => {
    chatStore.curtirMensagem(concursoId, cargoId, canalAtivo, msgId);
  };

  const handleAlternarFixado = (msgId: string) => {
    if (!isAdmin) return;
    chatStore.alternarFixado(concursoId, cargoId, canalAtivo, msgId);
  };

  const handleExcluir = (msgId: string) => {
    if (!isAdmin) return;
    if (confirm('Deseja excluir esta mensagem do chat?')) {
      chatStore.excluirMensagem(concursoId, cargoId, canalAtivo, msgId);
    }
  };

  const canalAtualInfo = CANAIS.find((c) => c.id === canalAtivo) || CANAIS[0];

  return (
    <div className={`bg-white rounded-2xl border border-slate-200 card-shadow flex flex-col ${isCompact ? 'h-[620px]' : 'h-[750px]'}`}>
      {/* Cabeçalho do Fórum / Chat */}
      <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h3 className="text-base font-bold text-slate-900 leading-tight">
              Fórum &amp; Chat da Comunidade
            </h3>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200">
              {cargoNome}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Espaço de alinhamento transparente entre os candidatos do concurso
          </p>
        </div>

        {/* Status de Login / Perfil */}
        <div className="flex items-center gap-2">
          {isAdmin && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1 font-mono">
              <ShieldAlert className="w-3 h-3 text-amber-600" />
              MODO ADMIN (Fixar / Moderar)
            </span>
          )}
          <span className="text-xs text-slate-400 font-mono">
            {mensagens.length} {mensagens.length === 1 ? 'mensagem' : 'mensagens'}
          </span>
        </div>
      </div>

      {/* Seletor de Canais Temáticos */}
      <div className="bg-slate-50 border-b border-slate-200 px-4 py-2 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
        {CANAIS.map((c) => {
          const isSelected = canalAtivo === c.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setCanalAtivo(c.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 border ${
                isSelected
                  ? 'bg-[#07192B] text-white border-[#07192B] shadow-xs'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:text-slate-900'
              }`}
            >
              <span>{c.emoji}</span>
              <span>{c.nome}</span>
            </button>
          );
        })}
      </div>

      {/* Informação do Canal Atual */}
      <div className="px-4 py-1.5 bg-teal-50/50 border-b border-teal-100/50 flex items-center justify-between text-[11px] text-teal-900">
        <span className="font-medium">
          Tópico: <strong>{canalAtualInfo.descricao}</strong>
        </span>
        <button
          type="button"
          onClick={() => setMostrarOpcoesAutor(!mostrarOpcoesAutor)}
          className="text-teal-700 hover:text-teal-900 font-bold underline cursor-pointer"
        >
          {mostrarOpcoesAutor ? 'Ocultar meu perfil' : 'Editar meu perfil de envio'}
        </button>
      </div>

      {/* Configuração de Perfil do Autor (Opcional) */}
      {mostrarOpcoesAutor && (
        <div className="p-3 bg-slate-50 border-b border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-2.5 animate-in fade-in duration-150 text-xs">
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Seu Nome / Apelido:</label>
            <input
              type="text"
              value={nomeAutor}
              onChange={(e) => setNomeAutor(e.target.value)}
              placeholder="ex: João Silva"
              className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Sua Classificação (Opcional):</label>
            <input
              type="number"
              min="1"
              value={posicaoAutor}
              onChange={(e) => setPosicaoAutor(e.target.value)}
              placeholder="ex: 12 (para exibir 12º Aprovado)"
              className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-medium text-slate-800"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Comarca Desejada (Opcional):</label>
            <input
              type="text"
              value={comarcaAutor}
              onChange={(e) => setComarcaAutor(e.target.value)}
              placeholder="ex: Porto Alegre"
              className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800"
            />
          </div>
        </div>
      )}

      {/* Área de Mensagens com Rolagem */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50/30">
        {/* Bloco de Mensagens Fixadas pelo Administrador */}
        {mensagensFixadas.length > 0 && (
          <div className="space-y-2 mb-4">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-800 uppercase tracking-wider">
              <Pin className="w-3.5 h-3.5 fill-amber-600 text-amber-600" />
              <span>Avisos Fixados da Coordenação</span>
            </div>

            {mensagensFixadas.map((msg) => (
              <div
                key={msg.id}
                className="p-3.5 rounded-xl bg-amber-50/90 border border-amber-300 shadow-xs space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                      {msg.autor}
                      <span className="px-1.5 py-0.2 rounded text-[9px] bg-amber-200 text-amber-900 font-bold font-mono">
                        ADMIN
                      </span>
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-amber-700/80 font-mono">{msg.data_hora}</span>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => handleAlternarFixado(msg.id)}
                        className="p-1 hover:bg-amber-200 rounded text-amber-800 text-[10px] cursor-pointer"
                        title="Desafixar aviso"
                      >
                        Desafixar
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-slate-800 text-xs leading-relaxed font-medium whitespace-pre-line">
                  {msg.texto}
                </p>
                <div className="flex items-center justify-between pt-1 text-[11px]">
                  <button
                    type="button"
                    onClick={() => handleCurtir(msg.id)}
                    className="flex items-center gap-1 text-amber-800 hover:text-amber-950 font-bold cursor-pointer"
                  >
                    <Heart className="w-3 h-3 fill-rose-500 text-rose-500" />
                    <span>{msg.curtidas || 0}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Mensagens Normais */}
        {mensagensNormais.length === 0 && mensagensFixadas.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400 space-y-2">
            <MessageSquare className="w-8 h-8 text-slate-300" />
            <p className="text-xs font-semibold text-slate-600">Ainda não há mensagens no canal {canalAtualInfo.nome}.</p>
            <p className="text-[11px] text-slate-400">Seja o primeiro a enviar uma mensagem para seus colegas!</p>
          </div>
        ) : (
          mensagensNormais.map((msg) => (
            <div
              key={msg.id}
              className={`p-3.5 rounded-2xl border transition-all ${
                msg.is_admin
                  ? 'bg-teal-50/50 border-teal-200'
                  : 'bg-white border-slate-200 shadow-xs'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Avatar inicial */}
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white uppercase shrink-0"
                    style={{ backgroundColor: msg.avatar_cor || '#135A7A' }}
                  >
                    {msg.autor.charAt(0)}
                  </div>

                  <span className="font-bold text-slate-900 text-xs">{msg.autor}</span>

                  {msg.is_admin && (
                    <span className="px-1.5 py-0.2 rounded text-[9px] bg-teal-100 text-teal-800 font-bold font-mono">
                      ADMIN
                    </span>
                  )}

                  {msg.posicao_candidato && (
                    <span className="px-1.5 py-0.2 rounded text-[9px] bg-slate-100 text-slate-700 font-bold flex items-center gap-0.5">
                      <Trophy className="w-2.5 h-2.5 text-amber-500" />
                      {msg.posicao_candidato}º Aprovado
                    </span>
                  )}

                  {msg.comarca_preferida && (
                    <span className="px-1.5 py-0.2 rounded text-[9px] bg-emerald-50 text-emerald-800 font-bold flex items-center gap-0.5">
                      <MapPin className="w-2.5 h-2.5 text-emerald-600" />
                      {msg.comarca_preferida}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[10px] text-slate-400 font-mono">{msg.data_hora}</span>
                  {isAdmin && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleAlternarFixado(msg.id)}
                        className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-amber-600 cursor-pointer"
                        title="Fixar no topo"
                      >
                        <Pin className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleExcluir(msg.id)}
                        className="p-1 hover:bg-rose-50 rounded text-slate-400 hover:text-rose-600 cursor-pointer"
                        title="Excluir mensagem"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              <p className="text-slate-700 text-xs leading-relaxed mt-2 whitespace-pre-line">
                {msg.texto}
              </p>

              {/* Ação de Reação (Curtida) */}
              <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                <button
                  type="button"
                  onClick={() => handleCurtir(msg.id)}
                  className="flex items-center gap-1.5 text-slate-500 hover:text-rose-600 font-semibold cursor-pointer transition-colors"
                >
                  <Heart className={`w-3.5 h-3.5 ${(msg.curtidas || 0) > 0 ? 'fill-rose-500 text-rose-500' : ''}`} />
                  <span>{msg.curtidas || 0}</span>
                </button>
              </div>
            </div>
          ))
        )}

        <div ref={mensagensEndRef} />
      </div>

      {/* Caixa de Entrada de Mensagem */}
      <form onSubmit={handleEnviar} className="p-3 bg-white border-t border-slate-200 space-y-2">
        {isAdmin && (
          <div className="flex items-center gap-2 text-xs text-amber-800 bg-amber-50 px-2.5 py-1 rounded-lg">
            <input
              type="checkbox"
              id="fixarNovaMsg"
              checked={fixarNovaMsg}
              onChange={(e) => setFixarNovaMsg(e.target.checked)}
              className="rounded text-amber-600"
            />
            <label htmlFor="fixarNovaMsg" className="cursor-pointer font-bold flex items-center gap-1 text-[11px]">
              <Pin className="w-3 h-3 text-amber-700" />
              Fixar esta mensagem como Aviso Oficial no topo do canal
            </label>
          </div>
        )}

        <div className="flex items-center gap-2">
          <input
            type="text"
            required
            value={novoTexto}
            onChange={(e) => setNovoTexto(e.target.value)}
            placeholder={`Conversar em #${canalAtualInfo.nome}...`}
            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-[#2DD4AA] focus:outline-none transition-all"
          />

          <button
            type="submit"
            className="bg-[#07192B] hover:bg-[#0C2640] text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5 cursor-pointer shrink-0 transition-colors"
          >
            <Send className="w-3.5 h-3.5 text-[#2DD4AA]" />
            <span className="hidden sm:inline">Enviar</span>
          </button>
        </div>
      </form>
    </div>
  );
};
