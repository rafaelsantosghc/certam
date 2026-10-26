import React, { useState, useEffect, useRef } from 'react';
import { chatStore } from '../store/chatStore';
import { useAuth } from '../store/authContext';
import { ChatMensagem, CanalChatId } from '../types';
import { sanitizeInput } from '../utils/security';
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
  Lock,
  UserCheck,
  AlertCircle,
} from 'lucide-react';

interface CommunityForumProps {
  concursoId: string;
  cargoId: string;
  cargoNome: string;
  isCompact?: boolean;
  isRestritoBloqueado?: boolean;
  onSolicitarAcesso?: () => void;
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
  isRestritoBloqueado = false,
  onSolicitarAcesso,
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

  // Se o chat for restrito e o usuário não for aprovado/admin, mostra a tela de bloqueio
  if (isRestritoBloqueado) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 card-shadow p-8 sm:p-12 text-center max-w-2xl mx-auto space-y-5">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto shadow-xs">
          <Lock className="w-7 h-7" />
        </div>

        <div>
          <h3 className="font-serif font-bold text-xl text-slate-900">
            Canal Exclusivo para Aprovados Homologados
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 mt-2 leading-relaxed max-w-lg mx-auto">
            Este concurso já foi oficialmente homologado. Por determinação das regras do portal e garantia de privacidade dos concursados, as salas de discussão deste cargo são restritas aos candidatos que figuram na lista de aprovados.
          </p>
        </div>

        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 space-y-2 max-w-md mx-auto text-left">
          <div className="flex items-center gap-2 font-bold text-slate-800">
            <UserCheck className="w-4 h-4 text-teal-600" />
            <span>Como ter meu acesso liberado?</span>
          </div>
          <p className="text-2xs text-slate-500 leading-relaxed">
            1. Certifique-se de que seu Nome Completo e CPF cadastrados no seu perfil coincidem com a lista homologada pelo tribunal/órgão.
            <br />
            2. Caso seu nome conste na lista mas seu CPF não foi reconhecido automaticamente, acione a verificação manual abaixo.
          </p>
        </div>

        {onSolicitarAcesso && (
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={onSolicitarAcesso}
              className="w-full sm:w-auto px-5 py-2.5 bg-[#07192B] hover:bg-[#0C2640] text-[#2DD4AA] font-bold text-xs rounded-xl transition-all cursor-pointer shadow-sm flex items-center justify-center gap-2"
            >
              <AlertCircle className="w-4 h-4" />
              <span>Solicitar Validação ao Administrador</span>
            </button>
          </div>
        )}
      </div>
    );
  }

  // Mensagens fixadas vs normais
  const mensagensFixadas = mensagens.filter((m) => m.is_fixado);
  const mensagensNormais = mensagens.filter((m) => !m.is_fixado);

  const handleEnviar = (e: React.FormEvent) => {
    e.preventDefault();
    const textoLimpo = sanitizeInput(novoTexto, 2000);
    if (!textoLimpo) return;

    const autorFinal = sanitizeInput(nomeAutor, 80) || usuario?.nome || 'Candidato Aprovado';
    const emailFinal = usuario?.email || 'candidato@certam.com.br';

    chatStore.enviarMensagem(concursoId, cargoId, canalAtivo, autorFinal, emailFinal, textoLimpo, {
      isAdmin: Boolean(isAdmin),
      isFixado: isAdmin && fixarNovaMsg,
      posicao: posicaoAutor ? Number(posicaoAutor) : undefined,
      comarcaPreferida: sanitizeInput(comarcaAutor, 80) || undefined,
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

  const handleRemover = (msgId: string) => {
    if (!isAdmin) return;
    if (window.confirm('Tem certeza que deseja moderar e remover esta mensagem?')) {
      chatStore.removerMensagem(concursoId, cargoId, canalAtivo, msgId);
    }
  };

  return (
    <div className={`bg-white rounded-2xl border border-slate-200 card-shadow overflow-hidden flex flex-col ${isCompact ? 'h-[500px]' : 'h-[720px]'}`}>
      {/* Top Header do Chat com Seleção de Canais */}
      <div className="p-3 sm:p-4 bg-[#07192B] text-white border-b border-[#0F2942] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-teal-500/20 text-[#2DD4AA] flex items-center justify-center font-bold">
            <MessageSquare className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-serif font-bold text-sm sm:text-base text-white">
              Comunidade Oficial • {cargoNome}
            </h3>
            <p className="text-2xs text-slate-300">
              Canal ativo: {CANAIS.find((c) => c.id === canalAtivo)?.nome} ({mensagens.length} mensagens)
            </p>
          </div>
        </div>

        {/* Abas dos 4 Canais de Bate-papo */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
          {CANAIS.map((c) => {
            const isAtivo = canalAtivo === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setCanalAtivo(c.id)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                  isAtivo
                    ? 'bg-[#2DD4AA] text-slate-950 font-bold shadow-xs'
                    : 'bg-white/10 hover:bg-white/20 text-slate-300'
                }`}
                title={c.descricao}
              >
                <span>{c.emoji}</span>
                <span>{c.nome}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Área Central: Mensagens Fixadas e Mensagens Normais */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-slate-50/50">
        {/* Mensagens Fixadas pelo Administrador */}
        {mensagensFixadas.length > 0 && (
          <div className="space-y-2 mb-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 flex items-center gap-1 font-mono">
              <Pin className="w-3 h-3 rotate-45" />
              Mensagens Fixadas pela Coordenação
            </span>
            {mensagensFixadas.map((m) => (
              <div
                key={m.id}
                className="p-3.5 bg-amber-50/70 border border-amber-300 rounded-xl space-y-1.5 shadow-2xs"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-slate-900">{m.autor}</span>
                    <span className="text-3xs font-bold px-1.5 py-0.5 rounded bg-amber-200 text-amber-900 font-mono">
                      ADMIN
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">{m.data_hora}</span>
                </div>
                <p className="text-xs text-slate-800 leading-relaxed font-medium whitespace-pre-line">
                  {m.texto}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Mensagens Normais da Comunidade */}
        {mensagensNormais.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs py-12 space-y-2">
            <MessageSquare className="w-8 h-8 text-slate-300" />
            <p>Nenhuma mensagem neste canal ainda. Seja o primeiro a compartilhar informações!</p>
          </div>
        ) : (
          mensagensNormais.map((msg) => {
            const isMinha = usuario?.email && msg.email?.toLowerCase() === usuario.email.toLowerCase();

            return (
              <div
                key={msg.id}
                className={`p-3.5 rounded-2xl border transition-all ${
                  msg.is_admin
                    ? 'bg-amber-50/40 border-amber-200'
                    : isMinha
                    ? 'bg-teal-50/40 border-teal-200 ml-4 sm:ml-8'
                    : 'bg-white border-slate-200 mr-4 sm:mr-8'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-xs text-slate-900">{msg.autor}</span>
                    {msg.posicao_candidato && (
                      <span className="text-3xs font-mono font-bold bg-[#07192B] text-teal-300 px-1.5 py-0.5 rounded">
                        {msg.posicao_candidato}º Lugar
                      </span>
                    )}
                    {msg.comarca_preferida && (
                      <span className="text-3xs font-semibold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                        <MapPin className="w-2.5 h-2.5 text-teal-600" />
                        {msg.comarca_preferida}
                      </span>
                    )}
                  </div>

                  <span className="text-[10px] text-slate-400 font-mono shrink-0">{msg.data_hora}</span>
                </div>

                <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line">
                  {msg.texto}
                </p>

                {/* Ações da Mensagem: Curtir, Fixar e Moderar */}
                <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-2xs text-slate-500">
                  <button
                    type="button"
                    onClick={() => handleCurtir(msg.id)}
                    className="flex items-center gap-1 hover:text-rose-600 transition-colors cursor-pointer"
                  >
                    <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500/20" />
                    <span>{msg.curtidas || 0}</span>
                  </button>

                  {isAdmin && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleAlternarFixado(msg.id)}
                        className="text-amber-700 hover:underline cursor-pointer"
                      >
                        {msg.is_fixado ? 'Desafixar' : 'Fixar'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemover(msg.id)}
                        className="text-rose-600 hover:underline cursor-pointer"
                      >
                        Remover
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={mensagensEndRef} />
      </div>

      {/* Input Inferior de Envio */}
      <form onSubmit={handleEnviar} className="p-3 sm:p-4 bg-white border-t border-slate-200 shrink-0 space-y-2">
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder={`Enviar mensagem no canal ${CANAIS.find((c) => c.id === canalAtivo)?.nome}...`}
            value={novoTexto}
            onChange={(e) => setNovoTexto(e.target.value)}
            className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-teal-600 focus:outline-hidden"
          />
          <button
            type="submit"
            disabled={!novoTexto.trim()}
            className="px-4 py-2.5 bg-[#07192B] hover:bg-[#0C2640] text-[#2DD4AA] disabled:opacity-40 font-bold rounded-xl text-xs transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
          >
            <Send className="w-4 h-4" />
            <span className="hidden sm:inline">Enviar</span>
          </button>
        </div>
      </form>
    </div>
  );
};
