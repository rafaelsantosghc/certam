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

  curtirMensagem(concursoId: string, cargoId: string, canalId: CanalChatId, msgId: string, userEmail = 'candidato@certam.com.br') {
    const msgs = this.getMensagens(concursoId, cargoId, canalId);
    const m = msgs.find((msg) => msg.id === msgId);
    if (m) {
      m.curtido_por = m.curtido_por || [];
      const idx = m.curtido_por.indexOf(userEmail);
      if (idx >= 0) {
        // Já curtiu -> retira a curtida
        m.curtido_por.splice(idx, 1);
        m.curtidas = Math.max(0, (m.curtidas || 1) - 1);
      } else {
        // Não curtiu -> adiciona curtida
        m.curtido_por.push(userEmail);
        m.curtidas = (m.curtidas || 0) + 1;
      }
      this.salvarMensagens(concursoId, cargoId, canalId, msgs);
    }
  },

  reagirEmoji(concursoId: string, cargoId: string, canalId: CanalChatId, msgId: string, emoji: string, userEmail = 'candidato@certam.com.br') {
    const msgs = this.getMensagens(concursoId, cargoId, canalId);
    const m = msgs.find((msg) => msg.id === msgId);
    if (m) {
      m.reacoes = m.reacoes || {};
      m.reacoes[emoji] = m.reacoes[emoji] || [];
      const idx = m.reacoes[emoji].indexOf(userEmail);
      if (idx >= 0) {
        m.reacoes[emoji].splice(idx, 1);
        if (m.reacoes[emoji].length === 0) {
          delete m.reacoes[emoji];
        }
      } else {
        m.reacoes[emoji].push(userEmail);
        this.registrarUsoEmoji(emoji);
      }
      this.salvarMensagens(concursoId, cargoId, canalId, msgs);
    }
  },

  registrarUsoEmoji(emoji: string) {
    try {
      const key = 'certam_frequent_emojis_v1';
      const raw = localStorage.getItem(key);
      const counts: Record<string, number> = raw ? JSON.parse(raw) : {};
      counts[emoji] = (counts[emoji] || 0) + 1;
      localStorage.setItem(key, JSON.stringify(counts));
    } catch {
      // ignore
    }
  },

  getEmojisFrequentes(): string[] {
    try {
      const key = 'certam_frequent_emojis_v1';
      const raw = localStorage.getItem(key);
      if (!raw) return ['👍', '❤️', '🔥', '🎉', '🚀', '👏', '💡', '✨'];
      const counts: Record<string, number> = JSON.parse(raw);
      return Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .map(([e]) => e)
        .slice(0, 8);
    } catch {
      return ['👍', '❤️', '🔥', '🎉', '🚀', '👏', '💡', '✨'];
    }
  },

  isSalaSilenciada(roomKey: string): boolean {
    try {
      const raw = localStorage.getItem('certam_chat_muted_rooms_v1');
      const muted: Record<string, boolean> = raw ? JSON.parse(raw) : {};
      return Boolean(muted[roomKey]);
    } catch {
      return false;
    }
  },

  alternarSilenciarSala(roomKey: string): boolean {
    try {
      const raw = localStorage.getItem('certam_chat_muted_rooms_v1');
      const muted: Record<string, boolean> = raw ? JSON.parse(raw) : {};
      const next = !muted[roomKey];
      muted[roomKey] = next;
      localStorage.setItem('certam_chat_muted_rooms_v1', JSON.stringify(muted));
      return next;
    } catch {
      return false;
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
