import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../store/authContext';
import { useNotifications } from '../store/notificationContext';
import { NotificacaoItem } from '../types';
import {
  obterMetadadosVisuaisNotificacao,
  executarRedirecionamentoNotificacao,
} from '../utils/notificationUtils';
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
  ShieldCheck,
  Calendar,
  MessageSquare,
} from 'lucide-react';

interface NotificationBellProps {
  onNavigate?: (view: string, params?: any) => void;
  concursoAtualId?: string;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({
  onNavigate,
  concursoAtualId,
}) => {
  const { usuario } = useAuth();
  const { notificacoesVisiveis, naoLidasCount, marcarComoLida, marcarTodasComoLidas } =
    useNotifications();
  const [aberto, setAberto] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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

  const readIds = usuario?.read_notification_ids || [];

  const handleMarcarTodas = () => {
    marcarTodasComoLidas();
  };

  const handleItemClick = (n: NotificacaoItem) => {
    marcarComoLida(n.id);
    setAberto(false);
    executarRedirecionamentoNotificacao(n, onNavigate, concursoAtualId);
  };

  const renderBadge = (item: NotificacaoItem) => {
    const meta = obterMetadadosVisuaisNotificacao(item);

    if (meta.categoria === 'admin_verificacao') {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300">
          <ShieldCheck className="w-3 h-3 text-amber-700" />
          <span>{meta.badgeLabel}</span>
        </span>
      );
    }

    switch (item.tipo) {
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
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200">
            <UserCheck className="w-3 h-3 text-emerald-600" />
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
      case 'resposta_contato':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-teal-100 text-teal-800 border border-teal-200">
            <MessageSquare className="w-3 h-3 text-teal-600" />
            <span>Respondido</span>
          </span>
        );
      case 'convocacao':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-cyan-100 text-cyan-800 border border-cyan-200">
            <FileText className="w-3 h-3 text-cyan-600" />
            <span>Convocação</span>
          </span>
        );
      case 'cronograma':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-teal-100 text-teal-800 border border-teal-200">
            <Calendar className="w-3 h-3 text-teal-600" />
            <span>Cronograma</span>
          </span>
        );
      case 'documento':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-teal-100 text-teal-800 border border-teal-200">
            <FileText className="w-3 h-3 text-teal-600" />
            <span>Documento</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
            <span>{meta.badgeLabel}</span>
          </span>
        );
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
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-slate-200 z-[100] overflow-hidden animate-in fade-in-50 duration-150">
          {/* Top Bar */}
          <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-serif font-bold text-sm text-[#07192B]">
                Notificações do Portal
              </span>
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
                const meta = obterMetadadosVisuaisNotificacao(item);
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
                        {renderBadge(item)}
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

                    <div
                      className={`mt-2 pl-3.5 flex items-center gap-1 text-[11px] font-semibold ${
                        meta.categoria === 'indeferimento'
                          ? 'text-rose-700 hover:text-rose-900'
                          : meta.categoria === 'admin_verificacao'
                          ? 'text-amber-800 hover:text-amber-950'
                          : 'text-teal-700 hover:text-teal-900'
                      }`}
                    >
                      <span>{meta.acaoLabel}</span>
                      <ExternalLink className="w-3 h-3" />
                    </div>
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
