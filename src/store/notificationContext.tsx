import React, { createContext, useContext, useState, useEffect, useRef, useMemo } from 'react';
import { NotificacaoItem, Usuario } from '../types';
import { notificationStore } from './notificationStore';
import { useAuth } from './authContext';
import { isDebugMode, isAiStudioPreview } from '../utils/environment';

interface NotificationContextType {
  notificacoes: NotificacaoItem[];
  notificacoesVisiveis: NotificacaoItem[];
  naoLidasCount: number;
  toastAtivo: NotificacaoItem | null;
  exibirToast: (notif: NotificacaoItem) => void;
  fecharToast: () => void;
  marcarComoLida: (id: string) => void;
  marcarTodasComoLidas: () => void;
  dispararNotificacao: (notif: Omit<NotificacaoItem, 'id' | 'data_hora'>) => NotificacaoItem;
}

const NotificationContext = createContext<NotificationContextType>({
  notificacoes: [],
  notificacoesVisiveis: [],
  naoLidasCount: 0,
  toastAtivo: null,
  exibirToast: () => {},
  fecharToast: () => {},
  marcarComoLida: () => {},
  marcarTodasComoLidas: () => {},
  dispararNotificacao: () => ({} as NotificacaoItem),
});

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { usuario, isAdmin, marcarNotificacaoComoLida, marcarTodasNotificacoesComoLidas } = useAuth();
  const [notificacoes, setNotificacoes] = useState<NotificacaoItem[]>(() =>
    notificationStore.getNotificacoes()
  );
  const [toastAtivo, setToastAtivo] = useState<NotificacaoItem | null>(null);
  const toastTimerRef = useRef<any>(null);
  const lastProcessedIdRef = useRef<string | null>(null);

  // Filtra notificações de acordo com o papel do usuário e modo de depuração
  const filtrarVisiveis = (list: NotificacaoItem[]): NotificacaoItem[] => {
    const isDebug = isDebugMode();

    return list.filter((n) => {
      // No modo de depuração / preview, o admin ou tester pode ver os toasts de teste
      if (isDebug) {
        return true;
      }

      // Em produção: o administrador não recebe alertas direcionados exclusivamente a candidatos
      if (
        isAdmin &&
        (n.tipo === 'aprovacao_perfil' ||
          n.tipo === 'indeferimento_perfil' ||
          n.tipo === 'validacao_aprovada' ||
          n.tipo === 'validacao_indeferida')
      ) {
        return false;
      }

      if (n.destinatario_email) {
        if (!usuario) {
          return false;
        }
        const emailUser = usuario.email?.toLowerCase().trim();
        const emailDest = n.destinatario_email.toLowerCase().trim();
        return emailUser === emailDest;
      }

      return true; // Mensagens gerais do portal
    });
  };

  const exibirToast = (item: NotificacaoItem) => {
    if (!item) return;

    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }

    try {
      sessionStorage.setItem(`certam_toast_shown_${item.id}`, 'true');
    } catch {
      // ignore
    }

    setToastAtivo(item);

    // Mantém exibição do resumo pelo período exato de 5 segundos (5000ms)
    toastTimerRef.current = setTimeout(() => {
      setToastAtivo(null);
    }, 5000);
  };

  const fecharToast = () => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    setToastAtivo(null);
  };

  // Escuta os eventos no ciclo de vida de AppContent e captura o estado mais recente
  useEffect(() => {
    const atualizarNotificacoesEChecarToast = (novaNotifDireta?: NotificacaoItem) => {
      const listaMaisRecente = notificationStore.getNotificacoes();
      setNotificacoes(listaMaisRecente);

      const readIds = usuario?.read_notification_ids || [];

      // Se recebemos um item específico via evento
      if (novaNotifDireta) {
        lastProcessedIdRef.current = novaNotifDireta.id;
        exibirToast(novaNotifDireta);
        return;
      }

      // Caso contrário, avalia a mais recente da lista
      const visiveis = filtrarVisiveis(listaMaisRecente);
      if (visiveis.length > 0) {
        const top = visiveis[0];
        const isNaoLida = !readIds.includes(top.id);
        const jaExibida =
          typeof sessionStorage !== 'undefined' &&
          sessionStorage.getItem(`certam_toast_shown_${top.id}`) === 'true';

        if (lastProcessedIdRef.current !== top.id) {
          lastProcessedIdRef.current = top.id;
          if (isNaoLida && !jaExibida) {
            exibirToast(top);
          }
        }
      }
    };

    // Handler do evento 'certam_notifications_updated'
    const handleNotificationsUpdated = (e: any) => {
      const items = e?.detail && Array.isArray(e.detail) ? e.detail : notificationStore.getNotificacoes();
      setNotificacoes(items);

      const visiveis = filtrarVisiveis(items);
      const readIds = usuario?.read_notification_ids || [];

      if (visiveis.length > 0) {
        const top = visiveis[0];
        const isNaoLida = !readIds.includes(top.id);
        const jaExibida =
          typeof sessionStorage !== 'undefined' &&
          sessionStorage.getItem(`certam_toast_shown_${top.id}`) === 'true';

        // Dispara o Toast se a notificação for nova ou não lida
        if (isNaoLida && (!jaExibida || lastProcessedIdRef.current !== top.id)) {
          lastProcessedIdRef.current = top.id;
          exibirToast(top);
        }
      }
    };

    const handleNewNotification = (e: any) => {
      const item = e.detail as NotificacaoItem;
      if (item) {
        atualizarNotificacoesEChecarToast(item);
      } else {
        atualizarNotificacoesEChecarToast();
      }
    };

    const handleTestNotification = (e: any) => {
      const testItem = e.detail as NotificacaoItem;
      if (testItem) {
        lastProcessedIdRef.current = testItem.id;
        exibirToast(testItem);
      }
    };

    window.addEventListener('certam_notifications_updated', handleNotificationsUpdated);
    window.addEventListener('certam_new_notification', handleNewNotification);
    window.addEventListener('certam_test_notification', handleTestNotification);
    window.addEventListener('storage', handleNotificationsUpdated);

    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      window.removeEventListener('certam_notifications_updated', handleNotificationsUpdated);
      window.removeEventListener('certam_new_notification', handleNewNotification);
      window.removeEventListener('certam_test_notification', handleTestNotification);
      window.removeEventListener('storage', handleNotificationsUpdated);
    };
  }, [usuario, isAdmin]);

  const notificacoesVisiveis = useMemo(() => {
    return filtrarVisiveis(notificacoes);
  }, [notificacoes, usuario, isAdmin]);

  const readIds = usuario?.read_notification_ids || [];
  const naoLidasCount = useMemo(() => {
    return notificacoesVisiveis.filter((n) => !readIds.includes(n.id)).length;
  }, [notificacoesVisiveis, readIds]);

  const marcarComoLida = (id: string) => {
    marcarNotificacaoComoLida(id);
    if (toastAtivo?.id === id) {
      fecharToast();
    }
  };

  const marcarTodasComoLidas = () => {
    const allIds = notificacoesVisiveis.map((n) => n.id);
    marcarTodasNotificacoesComoLidas(allIds);
    fecharToast();
  };

  const dispararNotificacao = (notif: Omit<NotificacaoItem, 'id' | 'data_hora'>): NotificacaoItem => {
    const nova = notificationStore.enviarNotificacao(notif);
    exibirToast(nova);
    return nova;
  };

  return (
    <NotificationContext.Provider
      value={{
        notificacoes,
        notificacoesVisiveis,
        naoLidasCount,
        toastAtivo,
        exibirToast,
        fecharToast,
        marcarComoLida,
        marcarTodasComoLidas,
        dispararNotificacao,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => useContext(NotificationContext);
