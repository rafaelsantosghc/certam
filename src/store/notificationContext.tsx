import React, { createContext, useContext, useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { NotificacaoItem } from '../types';
import { notificationStore } from './notificationStore';
import { chatStore } from './chatStore';
import { useAuth } from './authContext';
import { podeExibirNotificacaoParaUsuario } from '../utils/notificationUtils';

function isNotificacaoChatSilenciada(item: NotificacaoItem, canaisSilenciadosUsuario?: string[]): boolean {
  if (!item) return false;
  const isChatNotif =
    item.tipo === 'chat' ||
    String(item.id || '').startsWith('notif-chat-') ||
    String(item.link_destino || '').includes('tab=forum');

  if (!isChatNotif) return false;

  const concId = item.concurso_id || '';
  const canalId = item.canal_id || 'geral';

  if (concId && chatStore.isSalaSilenciada(concId, canalId)) {
    return true;
  }
  if (concId && chatStore.isSalaSilenciada(`${concId}_${canalId}`)) {
    return true;
  }
  if (Array.isArray(canaisSilenciadosUsuario) && canaisSilenciadosUsuario.length > 0) {
    if (
      (concId && canaisSilenciadosUsuario.includes(concId)) ||
      (concId && canaisSilenciadosUsuario.includes(`${concId}_${canalId}`)) ||
      canaisSilenciadosUsuario.includes(canalId)
    ) {
      return true;
    }
  }
  return false;
}

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

  // Filtra notificações rigorosamente de acordo com o destinatário e o papel do usuário (Admin vs Candidato vs Geral)
  const filtrarVisiveis = useCallback(
    (list: NotificacaoItem[]): NotificacaoItem[] => {
      return list.filter((n) => podeExibirNotificacaoParaUsuario(n, usuario, isAdmin));
    },
    [usuario, isAdmin]
  );

  const exibirToast = useCallback(
    (item: NotificacaoItem) => {
      if (!item) return;

      // Impede exibição de toast caso a conversa/concurso/canal esteja silenciado no localStorage
      if (isNotificacaoChatSilenciada(item, usuario?.canais_silenciados)) {
        return;
      }

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
    },
    [usuario?.canais_silenciados]
  );

  const fecharToast = useCallback(() => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    setToastAtivo(null);
  }, []);

  // Se o usuário trocar de perfil/sessão ou silenciar a conversa atual, fecha imediatamente o toast
  useEffect(() => {
    if (
      toastAtivo &&
      ((!String(toastAtivo.id ?? '').startsWith('notif-teste-') &&
        !podeExibirNotificacaoParaUsuario(toastAtivo, usuario, isAdmin)) ||
        isNotificacaoChatSilenciada(toastAtivo, usuario?.canais_silenciados))
    ) {
      fecharToast();
    }
  }, [usuario, isAdmin, toastAtivo, fecharToast]);

  useEffect(() => {
    const handleMuteUpdated = () => {
      if (toastAtivo && isNotificacaoChatSilenciada(toastAtivo, usuario?.canais_silenciados)) {
        fecharToast();
      }
    };
    window.addEventListener('certam_chat_mute_updated', handleMuteUpdated);
    return () => window.removeEventListener('certam_chat_mute_updated', handleMuteUpdated);
  }, [toastAtivo, usuario?.canais_silenciados, fecharToast]);

  // Escuta os eventos no ciclo de vida de AppContent e captura o estado mais recente
  useEffect(() => {
    const atualizarNotificacoesEChecarToast = (novaNotifDireta?: NotificacaoItem) => {
      const listaMaisRecente = notificationStore.getNotificacoes();
      setNotificacoes(listaMaisRecente);

      const readIds = usuario?.read_notification_ids || [];

      // Se recebemos um item específico via evento, exibe APENAS se o usuário atual for o destinatário válido
      if (novaNotifDireta) {
        if (podeExibirNotificacaoParaUsuario(novaNotifDireta, usuario, isAdmin)) {
          lastProcessedIdRef.current = novaNotifDireta.id;
          exibirToast(novaNotifDireta);
        }
        return;
      }

      // Caso contrário, avalia a mais recente da lista visível para este usuário
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
      const items =
        e?.detail && Array.isArray(e.detail) ? e.detail : notificationStore.getNotificacoes();
      setNotificacoes(items);

      const visiveis = filtrarVisiveis(items);
      const readIds = usuario?.read_notification_ids || [];

      if (visiveis.length > 0) {
        const top = visiveis[0];
        const isNaoLida = !readIds.includes(top.id);
        const jaExibida =
          typeof sessionStorage !== 'undefined' &&
          sessionStorage.getItem(`certam_toast_shown_${top.id}`) === 'true';

        // Dispara o Toast se a notificação for nova, não lida e visível para este usuário
        if (isNaoLida && !jaExibida && lastProcessedIdRef.current !== top.id) {
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
  }, [usuario, isAdmin, filtrarVisiveis, exibirToast]);

  const notificacoesVisiveis = useMemo(() => {
    return filtrarVisiveis(notificacoes);
  }, [notificacoes, filtrarVisiveis]);

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
    if (podeExibirNotificacaoParaUsuario(nova, usuario, isAdmin)) {
      exibirToast(nova);
    }
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
