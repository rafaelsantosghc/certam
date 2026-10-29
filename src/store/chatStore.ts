import { ChatMensagem, CanalChatId } from '../types';
import { cloudSync } from './cloudSync';

const CHAT_KEY = 'certam_chat_messages_v5';

const INITIAL_MESSAGES: Record<string, ChatMensagem[]> = {};

export const chatStore = {
  getMensagens(concursoId: string, cargoId: string, canalId: CanalChatId = 'geral'): ChatMensagem[] {
    const key = `${CHAT_KEY}_${concursoId}_${cargoId}_${canalId}`;
    try {
      const s = cloudSync.getItem(key);
      if (s) {
        const p = JSON.parse(s);
        if (Array.isArray(p)) return p;
      }
    } catch {
      // ignore
    }
    const defaultKey = `${concursoId}_${cargoId}_${canalId}`;
    return INITIAL_MESSAGES[defaultKey] || [];
  },

  salvarMensagens(concursoId: string, cargoId: string, canalId: CanalChatId, msgs: ChatMensagem[]) {
    const key = `${CHAT_KEY}_${concursoId}_${cargoId}_${canalId}`;
    cloudSync.setItem(key, msgs, false);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('certam_chat_updated', {
          detail: { concursoId, cargoId, canalId, msgs },
        })
      );
    }
  },

  enviarMensagem(
    concursoId: string,
    cargoId: string,
    canalId: CanalChatId,
    autorOrDados: string | Omit<ChatMensagem, 'id' | 'concurso_id' | 'cargo_id' | 'canal_id' | 'data_hora'>,
    email?: string,
    texto?: string,
    extra?: {
      isAdmin?: boolean;
      isFixado?: boolean;
      posicao?: number;
      comarcaPreferida?: string;
    }
  ): ChatMensagem {
    const msgs = this.getMensagens(concursoId, cargoId, canalId);
    const now = new Date();
    const dataHoraStr = `Hoje às ${now.getHours().toString().padStart(2, '0')}:${now
      .getMinutes()
      .toString()
      .padStart(2, '0')}`;

    let nova: ChatMensagem;

    if (typeof autorOrDados === 'string') {
      const cores = ['#0D5C75', '#0F766E', '#1D4ED8', '#6366F1', '#475569'];
      const avatarCor = cores[Math.floor(Math.random() * cores.length)];

      nova = {
        id: `msg-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
        concurso_id: concursoId,
        cargo_id: cargoId,
        canal_id: canalId,
        autor: autorOrDados,
        email: email || 'candidato@certam.com.br',
        avatar_cor: avatarCor,
        texto: texto || '',
        data_hora: dataHoraStr,
        curtidas: 0,
        is_admin: extra?.isAdmin || false,
        is_fixado: extra?.isFixado || false,
        posicao_candidato: extra?.posicao,
        comarca_preferida: extra?.comarcaPreferida,
      };
    } else {
      nova = {
        ...autorOrDados,
        id: `msg-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
        concurso_id: concursoId,
        cargo_id: cargoId,
        canal_id: canalId,
        data_hora: dataHoraStr,
        curtidas: 0,
      };
    }

    msgs.push(nova);
    this.salvarMensagens(concursoId, cargoId, canalId, msgs);
    return nova;
  },

  curtirMensagem(concursoId: string, cargoId: string, canalId: CanalChatId, msgId: string) {
    const msgs = this.getMensagens(concursoId, cargoId, canalId);
    const m = msgs.find((msg) => msg.id === msgId);
    if (m) {
      m.curtidas = (m.curtidas || 0) + 1;
      this.salvarMensagens(concursoId, cargoId, canalId, msgs);
    }
  },

  fixarMensagem(concursoId: string, cargoId: string, canalId: CanalChatId, msgId: string, fixar: boolean) {
    const msgs = this.getMensagens(concursoId, cargoId, canalId);
    const m = msgs.find((msg) => msg.id === msgId);
    if (m) {
      m.is_fixado = fixar;
      this.salvarMensagens(concursoId, cargoId, canalId, msgs);
    }
  },

  alternarFixado(concursoId: string, cargoId: string, canalId: CanalChatId, msgId: string) {
    const msgs = this.getMensagens(concursoId, cargoId, canalId);
    const m = msgs.find((msg) => msg.id === msgId);
    if (m) {
      m.is_fixado = !m.is_fixado;
      this.salvarMensagens(concursoId, cargoId, canalId, msgs);
    }
  },

  removerMensagem(concursoId: string, cargoId: string, canalId: CanalChatId, msgId: string) {
    let msgs = this.getMensagens(concursoId, cargoId, canalId);
    msgs = msgs.filter((m) => m.id !== msgId);
    this.salvarMensagens(concursoId, cargoId, canalId, msgs);
  },

  apagarMensagem(concursoId: string, cargoId: string, canalId: CanalChatId, msgId: string) {
    this.removerMensagem(concursoId, cargoId, canalId, msgId);
  },
};
