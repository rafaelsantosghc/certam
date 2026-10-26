import { NotificacaoItem } from '../types';

const NOTIFICATIONS_STORAGE_KEY = 'certam_notifications_events_v4';

export const DEFAULT_NOTIFICATIONS: NotificacaoItem[] = [
  {
    id: 'notif-1',
    concurso_id: 'tjrs_2025',
    cargo_id: 'analista_judiciario',
    titulo: 'Previsão de Edital do 2º Lote Convocatório TJRS',
    mensagem: 'Comissão de Aprovados confirma tratativas adiantadas com a Presidência para abril/2026.',
    tipo: 'convocacao',
    data_hora: 'Hoje às 11:30',
    link_destino: '/concurso?id=tjrs_2025&tab=cronograma',
    urgente: true,
  },
  {
    id: 'notif-2',
    concurso_id: 'tjrs_2025',
    titulo: 'Mobilização na ALRS: PL de Cargos Comissionados',
    mensagem: 'Confira a nota técnica em defesa da prioridade para concursados efetivos no TJRS.',
    tipo: 'comunicado',
    data_hora: 'Ontem às 16:45',
    link_destino: '/concurso?id=tjrs_2025&tab=comunicados',
  },
  {
    id: 'notif-3',
    concurso_id: 'mprs_2025',
    titulo: 'Homologação Definitiva dos Resultados do MPRS',
    mensagem: 'Ato oficial publicado no DJE do MPRS. Cronograma do primeiro lote em definição.',
    tipo: 'documento',
    data_hora: '18/02/2026',
    link_destino: '/concurso?id=mprs_2025&tab=documentos',
  },
];

export const notificationStore = {
  getNotificacoes(): NotificacaoItem[] {
    try {
      const stored = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
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

  criarNotificacao(item: Omit<NotificacaoItem, 'id' | 'data_hora'>): NotificacaoItem {
    const list = this.getNotificacoes();
    const novo: NotificacaoItem = {
      ...item,
      id: `notif-${Date.now().toString(36)}`,
      data_hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    };
    list.unshift(novo);
    this.salvarNotificacoes(list);
    return novo;
  },

  // Contagem de não-lidas otimizada: compara a lista geral com os IDs lidos do usuário
  getNaoLidasCount(readIds: string[] = [], concursoFiltroId?: string): number {
    const list = this.getNotificacoes();
    return list.filter((n) => {
      if (concursoFiltroId && n.concurso_id && n.concurso_id !== concursoFiltroId) {
        return false;
      }
      return !readIds.includes(n.id);
    }).length;
  },
};
