import React from 'react';
import { createPortal } from 'react-dom';
import { useNotifications } from '../store/notificationContext';
import {
  obterMetadadosVisuaisNotificacao,
  executarRedirecionamentoNotificacao,
} from '../utils/notificationUtils';
import {
  Bell,
  CheckCircle2,
  XCircle,
  FileText,
  X,
  ExternalLink,
  Clock,
  ShieldCheck,
  Calendar,
  MessageSquare,
} from 'lucide-react';

interface NotificationToastProps {
  onNavigate?: (view: string, params?: any) => void;
  concursoAtualId?: string;
}

export const NotificationToast: React.FC<NotificationToastProps> = ({
  onNavigate,
  concursoAtualId,
}) => {
  const { toastAtivo, fecharToast, marcarComoLida } = useNotifications();

  if (!toastAtivo || typeof document === 'undefined') {
    return null;
  }

  const meta = obterMetadadosVisuaisNotificacao(toastAtivo);

  const styleByTheme = {
    emerald: {
      wrapper: 'bg-emerald-50/98 border-emerald-400 text-emerald-950 ring-4 ring-emerald-500/15',
      iconBg: 'bg-emerald-100 text-emerald-700 border-emerald-300',
      badge: 'bg-emerald-200/80 text-emerald-900 border-emerald-300',
      progressBar: 'bg-emerald-500',
      tag: 'text-emerald-800',
      link: 'text-emerald-900 hover:text-emerald-950',
    },
    rose: {
      wrapper: 'bg-rose-50/98 border-rose-400 text-rose-950 ring-4 ring-rose-500/15',
      iconBg: 'bg-rose-100 text-rose-700 border-rose-300',
      badge: 'bg-rose-200/80 text-rose-900 border-rose-300',
      progressBar: 'bg-rose-500',
      tag: 'text-rose-800',
      link: 'text-rose-900 hover:text-rose-950',
    },
    amber: {
      wrapper: 'bg-amber-50/98 border-amber-400 text-amber-950 ring-4 ring-amber-500/15',
      iconBg: 'bg-amber-100 text-amber-800 border-amber-300',
      badge: 'bg-amber-200/80 text-amber-950 border-amber-400',
      progressBar: 'bg-amber-500',
      tag: 'text-amber-900',
      link: 'text-amber-900 hover:text-amber-950',
    },
    cyan: {
      wrapper: 'bg-white/98 border-cyan-400 text-slate-900 ring-4 ring-cyan-500/15',
      iconBg: 'bg-cyan-50 text-cyan-700 border-cyan-200',
      badge: 'bg-cyan-100 text-cyan-900 border-cyan-300',
      progressBar: 'bg-cyan-500',
      tag: 'text-cyan-800',
      link: 'text-teal-800 hover:text-teal-950',
    },
    teal: {
      wrapper: 'bg-white/98 border-teal-400 text-slate-900 ring-4 ring-teal-500/15',
      iconBg: 'bg-teal-50 text-teal-700 border-teal-200',
      badge: 'bg-teal-100 text-teal-800 border-teal-200',
      progressBar: 'bg-teal-500',
      tag: 'text-teal-800',
      link: 'text-teal-800 hover:text-teal-950',
    },
  };

  const style = styleByTheme[meta.temaCor];

  const renderIcon = () => {
    switch (meta.categoria) {
      case 'deferimento':
        return <CheckCircle2 className="w-5 h-5 text-emerald-600 animate-in zoom-in-50 duration-200" />;
      case 'indeferimento':
        return <XCircle className="w-5 h-5 text-rose-600 animate-in zoom-in-50 duration-200" />;
      case 'admin_verificacao':
        return <ShieldCheck className="w-5 h-5 text-amber-700 animate-in zoom-in-50 duration-200" />;
      case 'convocacao':
      case 'documento':
        return <FileText className="w-5 h-5 text-cyan-600" />;
      case 'cronograma':
        return <Calendar className="w-5 h-5 text-teal-600" />;
      case 'resposta_contato':
        return <MessageSquare className="w-5 h-5 text-teal-600" />;
      default:
        return <Bell className="w-5 h-5 text-teal-600" />;
    }
  };

  const handleToastClick = () => {
    const item = toastAtivo;
    marcarComoLida(item.id);
    fecharToast();
    executarRedirecionamentoNotificacao(item, onNavigate, concursoAtualId);
  };

  return createPortal(
    <aside
      aria-live="polite"
      className={`fixed top-5 left-1/2 -translate-x-1/2 z-[999999] border shadow-2xl rounded-2xl p-4 max-w-lg w-[92%] sm:w-full notif-toast-animated backdrop-blur-md transition-all cursor-pointer ${style.wrapper}`}
      onClick={handleToastClick}
    >
      <div className="flex items-start gap-3.5">
        <div
          className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 shadow-xs ${style.iconBg}`}
        >
          {renderIcon()}
        </div>

        <div className="flex-1 min-w-0 pr-6">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`text-[10px] font-bold uppercase tracking-wider ${style.tag}`}>
              {meta.headerTag}
            </span>
            <span
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border font-mono ${style.badge}`}
            >
              {meta.badgeLabel}
            </span>
            <span className="text-[10px] text-slate-400 font-mono ml-auto flex items-center gap-1">
              <Clock className="w-2.5 h-2.5" />
              {toastAtivo.data_hora}
            </span>
          </div>

          <h4 className="text-sm font-bold leading-tight font-serif text-slate-900">
            {toastAtivo.titulo}
          </h4>

          <p className="text-xs text-slate-700 mt-1 line-clamp-2 leading-relaxed">
            {toastAtivo.mensagem}
          </p>

          {toastAtivo.motivo_justificativa && (
            <div className="mt-2 p-2 bg-rose-100/70 border border-rose-300 rounded-lg text-2xs text-rose-900 font-medium">
              <span className="font-bold">Motivo:</span> {toastAtivo.motivo_justificativa}
            </div>
          )}

          <div className={`mt-2.5 flex items-center gap-1.5 text-2xs font-semibold ${style.link}`}>
            <span>{meta.acaoLabel}</span>
            <ExternalLink className="w-3 h-3" />
          </div>
        </div>

        {/* Botão Fechar */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            fecharToast();
          }}
          className="absolute top-3 right-3 p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 transition-colors cursor-pointer"
          aria-label="Fechar notificação"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Barra de Progresso de 5 segundos */}
      <div className="w-full bg-slate-200/60 h-1 rounded-full mt-3 overflow-hidden">
        <div
          className={`h-full ${style.progressBar}`}
          style={{
            animation: 'toastCountdown 5000ms linear forwards',
          }}
        />
      </div>
    </aside>,
    document.body
  );
};
