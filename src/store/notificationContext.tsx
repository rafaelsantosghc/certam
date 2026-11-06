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

export interface BrowserChatNotificationPayload {
  id: string;
  modo: 'concursos' | 'privadas';
  concursoId?: string;
  concursoSigla: string;
  salaId?: string;
  salaTitulo: string;
  dmEmail?: string;
  autor: string;
  resumoTexto: string;
  senderId?: string;
  onClickAbrir?: () => void;
}

interface NotificationContextType {
  notificacoes: NotificacaoItem[];
  notificacoesVisiveis: NotificacaoItem[];
  naoLidasCount: number;
  toastAtivo: NotificacaoItem | null;
  browserNotificationPermission: NotificationPermission;
  solicitarPermissaoNotificacaoNavegador: () => Promise<NotificationPermission>;
  dispararNotificacaoNavegador: (params: {
    titulo: string;
    corpo: string;
    tag?: string;
    onClick?: () => void;
  }) => void;
  notificarNovaMensagemChat: (payload: BrowserChatNotificationPayload) => void;
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
  browserNotificationPermission: 'default',
  solicitarPermissaoNotificacaoNavegador: async () => 'default',
  dispararNotificacaoNavegador: () => {},
  notificarNovaMensagemChat: () => {},
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
  const [browserNotificationPermission, setBrowserNotificationPermission] =
    useState<NotificationPermission>(() => {
      if (typeof window !== 'undefined' && 'Notification' in window) {
        return window.Notification.permission;
      }
      return 'default';
    });

  const toastTimerRef = useRef<any>(null);
  const lastProcessedIdRef = useRef<string | null>(null);
  const notifiedBrowserChatIdsRef = useRef<Set<string>>(new Set());

  const solicitarPermissaoNotificacaoNavegador = useCallback(async (): Promise<NotificationPermission> => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'denied';
    }
    try {
      if (window.Notification.permission === 'granted') {
        setBrowserNotificationPermission('granted');
        return 'granted';
      }
      const result = await window.Notification.requestPermission();
      setBrowserNotificationPermission(result);
      return result;
    } catch {
      return window.Notification.permission;
    }
  }, []);

  const dispararNotificacaoNavegador = useCallback(
    ({
      titulo,
      corpo,
      tag,
      onClick,
    }: {
      titulo: string;
      corpo: string;
      tag?: string;
      onClick?: () => void;
    }) => {
      if (typeof window === 'undefined' || !('Notification' in window)) return;
      if (window.Notification.permission !== 'granted') return;

      try {
        const notif = new window.Notification(titulo, {
          body: corpo,
          icon: '/icon.svg',
          badge: '/icon.svg',
          tag: tag || `certam-notif-${Date.now()}`,
          silent: false,
        });

        notif.onclick = () => {
          try {
            window.focus();
          } catch {
            // ignore
          }
          onClick?.();
          notif.close();
        };

        setTimeout(() => {
          try {
            notif.close();
          } catch {
            // ignore
          }
        }, 7000);
      } catch {
        // Fallback caso o ambiente restrinja construtor direto de Notification
      }
    },
    []
  );

  const notificarNovaMensagemChat = useCallback(
    (payload: BrowserChatNotificationPayload) => {
      if (!payload || !payload.id) return;
      if (notifiedBrowserChatIdsRef.current.has(payload.id)) return;

      // Garante que o próprio remetente nunca receba alerta de suas próprias mensagens
      const meusSenderIds = chatStore.obterConjuntoSenderIdsUsuarioAtual(usuario);
      const senderNorm = String(payload.senderId || '').trim().toLowerCase();
      if (senderNorm && meusSenderIds.has(senderNorm)) {
        return;
      }

      // Respeita silenciamento individual de sala/concurso/DM
      if (payload.modo === 'privadas' && payload.dmEmail) {
        if (chatStore.isDmSilenciada(payload.dmEmail)) return;
      } else if (payload.concursoId) {
        if (
          chatStore.isSalaSilenciada(payload.concursoId, payload.salaId || 'geral') ||
          chatStore.isConcursoSilenciado(payload.concursoId)
        ) {
          return;
        }
      }

      notifiedBrowserChatIdsRef.current.add(payload.id);

      const titulo =
        payload.modo === 'privadas'
          ? `Nova mensagem privada de ${payload.autor}`
          : `${payload.concursoSigla} • ${payload.salaTitulo}`;
      const corpo =
        payload.modo === 'privadas'
          ? payload.resumoTexto
          : `${payload.autor}: ${payload.resumoTexto}`;

      dispararNotificacaoNavegador({
        titulo,
        corpo,
        tag: `certam-chat-${payload.concursoId || 'dm'}-${payload.salaId || payload.dmEmail || 'geral'}`,
        onClick: payload.onClickAbrir,
      });
    },
    [usuario, dispararNotificacaoNavegador]
  );

  // Filtra notificações rigorosamente de acordo com o destinatário, o papel do usuário e exclui o próprio sender_id
  const filtrarVisiveis = useCallback(
    (list: NotificacaoItem[]): NotificacaoItem[] => {
      const meusSenderIds = chatStore.obterConjuntoSenderIdsUsuarioAtual(usuario);
      return list.filter((n) => {
        const notifSenderId = String(n.sender_id || n.remetente_id || '')
          .trim()
          .toLowerCase();
        if (notifSenderId && meusSenderIds.has(notifSenderId)) {
          return false;
        }
        return podeExibirNotificacaoParaUsuario(n, usuario, isAdmin);
      });
    },
    [usuario, isAdmin]
  );

  const exibirToast = useCallback(
    (item: NotificacaoItem) => {
      if (!item) return;

      // Filtra explicitamente o sender_id do próprio usuário para que nunca receba toast de suas próprias mensagens/ações
      const meusSenderIds = chatStore.obterConjuntoSenderIdsUsuarioAtual(usuario);
      const itemSenderId = String(item.sender_id || item.remetente_id || '')
        .trim()
        .toLowerCase();
      if (itemSenderId && meusSenderIds.has(itemSenderId)) {
        return;
      }

      // Notificações de chat utilizam o balão compacto flutuante no canto inferior direito (PersistentChatWidget), não o toast grande superior
      const isChatNotif =
        item.tipo === 'chat' ||
        String(item.id || '').startsWith('notif-chat-');
      if (isChatNotif) {
        return;
      }

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

      // Também dispara na API de notificações do navegador caso permitido
      dispararNotificacaoNavegador({
        titulo: item.titulo,
        corpo: item.mensagem,
        tag: `certam-portal-${item.id}`,
      });

      // Mantém exibição do resumo pelo período exato de 5 segundos (5000ms)
      toastTimerRef.current = setTimeout(() => {
        setToastAtivo(null);
      }, 5000);
    },
    [usuario, dispararNotificacaoNavegador]
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

      if (novaNotifDireta) {
        if (podeExibirNotificacaoParaUsuario(novaNotifDireta, usuario, isAdmin)) {
          lastProcessedIdRef.current = novaNotifDireta.id;
          exibirToast(novaNotifDireta);
        }
        return;
      }

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
        browserNotificationPermission,
        solicitarPermissaoNotificacaoNavegador,
        dispararNotificacaoNavegador,
        notificarNovaMensagemChat,
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
