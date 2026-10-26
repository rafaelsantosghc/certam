import { NotificacaoItem } from '../types';

const NOTIFICATIONS_STORAGE_KEY = 'certam_notifications_events_v5';

export const DEFAULT_NOTIFICATIONS: NotificacaoItem[] = [];

export const notificationStore = {
  getNotificacoes(): NotificacaoItem[] {
    try {
      localStorage.removeItem('certam_notifications_events_v4');
      const stored = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    this.salvarNotificacoes(DEFAULT_NOTIFICATIONS);
    return DEFAULT_NOTIFICATIONS;
  },

  salvarNotificacoes(list: NotificacaoItem[]) {
    try {
      localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(list));
      window.dispatchEvent(new CustomEvent('certam_notifications_updated', { detail: list }));
    } catch {
      // ignore
    }
  },

  enviarNotificacao(notif: Omit<NotificacaoItem, 'id' | 'data_hora'>): NotificacaoItem {
    const list = this.getNotificacoes();
    const nova: NotificacaoItem = {
      ...notif,
      id: `notif-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      data_hora:
        new Date().toLocaleDateString('pt-BR') +
        ' ' +
        new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    };
    list.unshift(nova);
    this.salvarNotificacoes(list);
    return nova;
  },

  criarNotificacao(notif: Omit<NotificacaoItem, 'id' | 'data_hora'>): NotificacaoItem {
    return this.enviarNotificacao(notif);
  },

  removerNotificacao(id: string) {
    const list = this.getNotificacoes().filter((n) => n.id !== id);
    this.salvarNotificacoes(list);
  },
};
