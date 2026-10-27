import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../store/authContext';
import { notificationStore } from '../store/notificationStore';
import { NotificacaoItem } from '../types';
import {
  Bell,
  CheckCheck,
  Clock,
  ExternalLink,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  UserCheck,
  FileText,
} from 'lucide-react';

interface NotificationBellProps {
  onNavigate?: (view: string, params?: any) => void;
  concursoAtualId?: string;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({ onNavigate, concursoAtualId }) => {
  const { usuario, isAdmin, marcarNotificacaoComoLida, marcarTodasNotificacoesComoLidas } = useAuth();
  const [aberto, setAberto] = useState(false);
  const [notificacoes, setNotificacoes] = useState<NotificacaoItem[]>(() =>
    notificationStore.getNotificacoes()
  );
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleUpdate = () => {
      setNotificacoes(notificationStore.getNotificacoes());
    };
    window.addEventListener('certam_notifications_updated', handleUpdate);
    return () => window.removeEventListener('certam_notifications_updated', handleUpdate);
  }, []);

  // Fechar ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setAberto(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filtrar notificações para o usuário logado
  const notificacoesVisiveis = notificacoes.filter((n) => {
    if (n.destinatario_email) {
      if (!usuario) return false;
      const emailUser = usuario.email?.toLowerCase().trim();
      const emailDest = n.destinatario_email.toLowerCase().trim();
      return emailUser === emailDest || isAdmin;
    }
    return true; // Notificações globais do portal
  });

  const readIds = usuario?.read_notification_ids || [];
  const naoLidasCount = notificacoesVisiveis.filter((n) => !readIds.includes(n.id)).length;

  const handleMarcarTodas = () => {
    const allIds = notificacoesVisiveis.map((n) => n.id);
    marcarTodasNotificacoesComoLidas(allIds);
  };

  const handleItemClick = (n: NotificacaoItem) => {
    marcarNotificacaoComoLida(n.id);
    setAberto(false);

    if (n.tipo === 'aprovacao_perfil' || n.tipo === 'indeferimento_perfil') {
      window.dispatchEvent(new CustomEvent('certam_abrir_perfil_candidato'));
      return;
    }

    if (n.link_destino && onNavigate) {
      if (n.link_destino.includes('concurso')) {
        const url = new URL(n.link_destino, 'http://localhost');
        const id = url.searchParams.get('id') || 'tjrs_2025';
        const tab = url.searchParams.get('tab') || 'dashboard';
        onNavigate('concurso', { concursoId: id, tab });
      }
    }
  };

  const renderBadge = (tipo: NotificacaoItem['tipo']) => {
    switch (tipo) {
      case 'aprovacao_perfil':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            <span>Deferido</span>
          </span>
        );
      case 'indeferimento_perfil':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 border border-rose-200">
            <XCircle className="w-3 h-3 text-rose-600" />
            <span>Indeferido</span>
          </span>
        );
      case 'validacao_aprovada':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-teal-100 text-teal-800 border border-teal-200">
            <UserCheck className="w-3 h-3 text-teal-600" />
            <span>Homologado</span>
          </span>
        );
      case 'validacao_indeferida':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 border border-rose-200">
            <AlertTriangle className="w-3 h-3 text-rose-600" />
            <span>Recusado</span>
          </span>
        );
      case 'convocacao':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-cyan-100 text-cyan-800 border border-cyan-200">
            <FileText className="w-3 h-3 text-cyan-600" />
            <span>Convocação</span>
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setAberto((prev) => !prev)}
        className="relative p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
        aria-label="Notificações"
      >
        <Bell className="w-5 h-5" />
        {naoLidasCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 bg-[#2DD4AA] text-slate-950 text-[10px] font-bold font-mono rounded-full flex items-center justify-center shadow-xs">
            {naoLidasCount > 9 ? '9+' : naoLidasCount}
          </span>
        )}
      </button>

      {aberto && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-slate-200 z-50 overflow-hidden animate-in fade-in-50 duration-150">
          {/* Top Bar */}
          <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-serif font-bold text-sm text-[#07192B]">Notificações do Portal</span>
              {naoLidasCount > 0 && (
                <span className="text-[11px] font-mono text-teal-700 font-semibold bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200">
                  {naoLidasCount} nova{naoLidasCount > 1 ? 's' : ''}
                </span>
              )}
            </div>
            {naoLidasCount > 0 && (
              <button
                type="button"
                onClick={handleMarcarTodas}
                className="text-xs text-teal-700 hover:text-teal-900 font-semibold flex items-center gap-1 cursor-pointer transition-colors"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Marcar lidas</span>
              </button>
            )}
          </div>

          {/* Lista de Notificações */}
          <div className="max-h-[420px] overflow-y-auto divide-y divide-slate-100">
            {notificacoesVisiveis.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                Nenhuma notificação no momento.
              </div>
            ) : (
              notificacoesVisiveis.map((item) => {
                const isLida = readIds.includes(item.id);
                return (
                  <div
                    key={item.id}
                    onClick={() => handleItemClick(item)}
                    className={`p-3.5 transition-colors cursor-pointer hover:bg-slate-50 ${
                      !isLida ? 'bg-teal-50/30' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {!isLida && (
                          <span className="w-2 h-2 rounded-full bg-[#2DD4AA] shrink-0" />
                        )}
                        <h4 className="text-xs font-bold text-slate-800 leading-snug">
                          {item.titulo}
                        </h4>
                        {renderBadge(item.tipo)}
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono shrink-0 flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" />
                        {item.data_hora}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 mt-1 leading-relaxed pl-3.5">
                      {item.mensagem}
                    </p>

                    {item.motivo_justificativa && (
                      <div className="mt-2 ml-3.5 p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-2xs text-rose-800 space-y-1">
                        <span className="font-bold flex items-center gap-1 text-rose-900">
                          <XCircle className="w-3 h-3 text-rose-600" />
                          Motivo do Indeferimento:
                        </span>
                        <p className="font-medium text-rose-800">{item.motivo_justificativa}</p>
                      </div>
                    )}

                    {item.tipo === 'indeferimento_perfil' && (
                      <div className="mt-2 pl-3.5 flex items-center gap-1 text-[11px] font-semibold text-rose-700 hover:text-rose-900">
                        <span>Revisar dados no perfil</span>
                        <ExternalLink className="w-3 h-3" />
                      </div>
                    )}

                    {item.link_destino && item.tipo !== 'indeferimento_perfil' && (
                      <div className="mt-2 pl-3.5 flex items-center gap-1 text-[11px] font-semibold text-teal-700 hover:text-teal-900">
                        <span>Acessar detalhes</span>
                        <ExternalLink className="w-3 h-3" />
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
