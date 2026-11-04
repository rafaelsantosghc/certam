import React from 'react';
import { createPortal } from 'react-dom';
import { useNotifications } from '../store/notificationContext';
import {
  Bell,
  CheckCircle2,
  XCircle,
  FileText,
  X,
  ExternalLink,
  Clock,
} from 'lucide-react';

interface NotificationToastProps {
  onNavigate?: (view: string, params?: any) => void;
}

export const NotificationToast: React.FC<NotificationToastProps> = ({ onNavigate }) => {
  const { toastAtivo, fecharToast, marcarComoLida } = useNotifications();

  if (!toastAtivo || typeof document === 'undefined') {
    return null;
  }

  const isSuccess =
    toastAtivo.tipo === 'aprovacao_perfil' || toastAtivo.tipo === 'validacao_aprovada';
  const isAlert =
    toastAtivo.tipo === 'indeferimento_perfil' ||
    toastAtivo.tipo === 'validacao_indeferida' ||
    toastAtivo.urgente;

  const style = isSuccess
    ? {
        wrapper: 'bg-emerald-50/98 border-emerald-400 text-emerald-950 ring-4 ring-emerald-500/15',
        iconBg: 'bg-emerald-100 text-emerald-700 border-emerald-300',
        badge: 'bg-emerald-200/80 text-emerald-900 border-emerald-300',
        progressBar: 'bg-emerald-500',
        tag: 'text-emerald-800',
      }
    : isAlert
    ? {
        wrapper: 'bg-rose-50/98 border-rose-400 text-rose-950 ring-4 ring-rose-500/15',
        iconBg: 'bg-rose-100 text-rose-700 border-rose-300',
        badge: 'bg-rose-200/80 text-rose-900 border-rose-300',
        progressBar: 'bg-rose-500',
        tag: 'text-rose-800',
      }
    : {
        wrapper: 'bg-white/98 border-teal-400 text-slate-900 ring-4 ring-teal-500/15',
        iconBg: 'bg-teal-50 text-teal-700 border-teal-200',
        badge: 'bg-teal-100 text-teal-800 border-teal-200',
        progressBar: 'bg-teal-500',
        tag: 'text-teal-800',
      };

  const handleToastClick = () => {
    marcarComoLida(toastAtivo.id);
    fecharToast();

    if (toastAtivo.tipo === 'aprovacao_perfil' || toastAtivo.tipo === 'indeferimento_perfil') {
      window.dispatchEvent(new CustomEvent('certam_abrir_perfil_candidato'));
      return;
    }

    if (toastAtivo.link_destino && onNavigate) {
      if (toastAtivo.link_destino.includes('concurso')) {
        const url = new URL(toastAtivo.link_destino, 'http://localhost');
        const id = url.searchParams.get('id') || 'tjrs_2025';
        const tab = url.searchParams.get('tab') || 'dashboard';
        onNavigate('concurso', { concursoId: id, tab });
      }
    }
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
          {isSuccess ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 animate-in zoom-in-50 duration-200" />
          ) : isAlert ? (
            <XCircle className="w-5 h-5 text-rose-600 animate-in zoom-in-50 duration-200" />
          ) : toastAtivo.tipo === 'convocacao' ? (
            <FileText className="w-5 h-5 text-cyan-600" />
          ) : (
            <Bell className="w-5 h-5 text-teal-600" />
          )}
        </div>

        <div className="flex-1 min-w-0 pr-6">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`text-[10px] font-bold uppercase tracking-wider ${style.tag}`}>
              {isSuccess
                ? 'Deferimento Oficial'
                : isAlert
                ? 'Indeferimento / Aviso'
                : 'Nova Notificação'}
            </span>
            <span
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border font-mono ${style.badge}`}
            >
              {isSuccess
                ? 'Deferido'
                : isAlert
                ? 'Indeferido'
                : toastAtivo.tipo === 'convocacao'
                ? 'Convocação'
                : 'Novo'}
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

          <div className="mt-2.5 flex items-center gap-1.5 text-2xs font-semibold text-teal-800">
            <span>Clique para abrir detalhes na central</span>
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
