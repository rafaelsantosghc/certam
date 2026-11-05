import { ChatMensagem, CanalChatId, Usuario } from '../types';
import { cloudSync } from './cloudSync';
import { chatRealtimeClient, ChatConnectionState } from './chatRealtimeClient';

const CHAT_KEY = 'certam_chat_messages_v5';
const MUTED_ROOMS_STORAGE_KEY = 'certam_chat_muted_rooms_v1';
const FREQUENT_EMOJIS_STORAGE_KEY = 'certam_frequent_emojis_v1';
const CLIENT_ANON_ID_KEY = 'certam_chat_client_id_v1';

export const DEFAULT_FREQUENT_EMOJIS = ['👍', '❤️', '🔥', '🎉', '🚀', '👏', '🙏', '💡'];

export interface CategoriaEmojiChat {
  id: string;
  titulo: string;
  emojis: string[];
}

export const CATALOGO_EMOJIS_CATEGORIAS: CategoriaEmojiChat[] = [
  {
    id: 'reacoes',
    titulo: 'Reações & Gestos',
    emojis: [
      '👍', '👎', '❤️', '🔥', '🎉', '🚀', '👏', '🙏', '🙌', '🤝',
      '💪', '🫡', '🫶', '👌', '✌️', '🤞', '🤟', '🤘', '☝️', '👆',
      '👇', '👉', '👈', '✋', '🖐️', '🖖', '👋', '🤏', '✍️', '🤳',
    ],
  },
  {
    id: 'rostos',
    titulo: 'Rostos & Emoções',
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃',
      '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙',
      '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🫢', '🫣',
      '🤫', '🤔', '🫡', '🤐', '🤨', '😐', '😑', '😶', '🫥', '😏',
      '😒', '🙄', '😬', '😮‍💨', '🤥', '😌', '😔', '😪', '🤤', '😴',
      '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵', '🥶', '🥴', '😵',
      '🤯', '🤠', '🥳', '🥸', '😎', '🤓', '🧐', '😕', '🫤', '😟',
      '🙁', '☹️', '😮', '😯', '😲', '😳', '🥺', '🥹', '😦', '😧',
      '😨', '😰', '😥', '😢', '😭', '😱', '😖', '😣', '😞', '😓',
      '😩', '😫', '🥱', '😤', '😡', '😠', '🤬',
    ],
  },
  {
    id: 'concursos',
    titulo: 'Concursos, Estudos & Sucesso',
    emojis: [
      '📚', '📖', '📝', '✏️', '✒️', '🖊️', '🎓', '🏆', '🥇', '🥈',
      '🥉', '🏅', '🎖️', '⚖️', '🏛️', '💼', '📊', '📈', '📉', '📋',
      '📌', '📍', '📎', '🗂️', '📅', '📆', '⏰', '⏳', '⌛', '💡',
      '🔍', '🔎', '🔑', '🎯', '🚀', '⭐', '🌟', '✨', '⚡', '💥',
      '💯', '✅', '☑️', '✔️', '❌', '⚠️', '🚨', '📢', '📣', '🔔',
    ],
  },
  {
    id: 'coracoes_simbolos',
    titulo: 'Corações & Diversos',
    emojis: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔',
      '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️',
      '☕', '🍵', '🍀', '🌈', '☀️', '🌙', '🌎', '🏠', '🏢', '🚗',
      '✈️', '🎉', '🎊', '🎈', '🎁', '💬', '💭', '🗯️', '💤', '🎵',
    ],
  },
];

export const TODOS_EMOJIS_CHAT: string[] = Array.from(
  new Set(CATALOGO_EMOJIS_CATEGORIAS.flatMap((cat) => cat.emojis))
);

function getOrCreateAnonId(): string {
  if (typeof window === 'undefined') return 'anon_server';
  try {
    let id = localStorage.getItem(CLIENT_ANON_ID_KEY);
    if (!id) {
      id = `anon_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
      localStorage.setItem(CLIENT_ANON_ID_KEY, id);
    }
    return id;
  } catch {
    return 'anon_fallback';
  }
}

export function obterIdentificadorUsuarioChat(
  usuarioOuEmail?: string | Usuario | null
): string {
  if (usuarioOuEmail && typeof usuarioOuEmail === 'object') {
    const cpfLimpo = String(usuarioOuEmail.cpf || '').replace(/\D/g, '');
    if (cpfLimpo.length >= 9) return `cpf:${cpfLimpo}`;
    const emailLimpo = String(usuarioOuEmail.email || '').trim().toLowerCase();
    if (emailLimpo && emailLimpo !== 'candidato@certam.com.br') return emailLimpo;
    if (usuarioOuEmail.id) return String(usuarioOuEmail.id).trim().toLowerCase();
  }

  if (typeof usuarioOuEmail === 'string') {
    const limpo = usuarioOuEmail.trim().toLowerCase();
    if (limpo && limpo !== 'candidato@certam.com.br') {
      return limpo;
    }
  }

  if (typeof window !== 'undefined') {
    try {
      const rawAuth = localStorage.getItem('certam_auth_user_v8');
      if (rawAuth) {
        const parsed = JSON.parse(rawAuth);
        if (parsed && typeof parsed === 'object') {
          const cpfLimpo = String(parsed.cpf || '').replace(/\D/g, '');
          if (cpfLimpo.length >= 9) return `cpf:${cpfLimpo}`;
          const emailLimpo = String(parsed.email || '').trim().toLowerCase();
          if (emailLimpo && emailLimpo !== 'candidato@certam.com.br') return emailLimpo;
        }
      }
    } catch {
      // ignore
    }
  }

  return getOrCreateAnonId();
}

function normalizarIdListaUsuario(rawId: string): string {
  return String(rawId || '').trim().toLowerCase();
}

function normalizarMensagem(msg: ChatMensagem): ChatMensagem {
  const curtidoPorRaw = Array.isArray(msg.curtido_por) ? msg.curtido_por : [];
  const curtidoPorUnico = Array.from(
    new Set(
      curtidoPorRaw
        .map((u) => normalizarIdUsuarioOuLegado(u))
        .filter((u) => Boolean(u) && u !== 'candidato@certam.com.br')
    )
  );

  // Garante que cada usuário tenha no máximo 1 reação de emoji por mensagem
  const reacoesNormalizadas: Record<string, string[]> = {};
  const usuariosQueJaReagiram = new Set<string>();

  if (msg.reacoes && typeof msg.reacoes === 'object') {
    for (const [emoji, lista] of Object.entries(msg.reacoes)) {
      if (!Array.isArray(lista) || !emoji) continue;
      const listaLimpa: string[] = [];
      for (const u of lista) {
        const normU = normalizarIdUsuarioOuLegado(u);
        if (!normU || normU === 'candidato@certam.com.br') continue;
        if (!usuariosQueJaReagiram.has(normU)) {
          usuariosQueJaReagiram.add(normU);
          listaLimpa.push(normU);
        }
      }
      if (listaLimpa.length > 0) {
        reacoesNormalizadas[emoji] = listaLimpa;
      }
    }
  }

  return {
    ...msg,
    curtido_por: curtidoPorUnico,
    curtidas: curtidoPorUnico.length,
    reacoes: reacoesNormalizadas,
  };
}

function normalizarIdUsuarioOuLegado(u: string): string {
  return normalizarIdListaUsuario(u);
}

function extrairTimestampOrdenacao(m: ChatMensagem, fallbackIndex: number): number {
  if (typeof m.created_at === 'number' && m.created_at > 0) {
    return m.created_at;
  }
  const match = String(m.id || '').match(/^msg-([a-z0-9]+)-/i);
  if (match && match[1]) {
    const parsed = parseInt(match[1], 36);
    if (!Number.isNaN(parsed) && parsed > 1000000000000) {
      return parsed;
    }
  }
  return fallbackIndex;
}

export const chatStore = {
  initRealtime(): void {
    chatRealtimeClient.init();
  },

  getConnectionState(): ChatConnectionState {
    return chatRealtimeClient.getConnectionState();
  },

  reconectarAgora(): void {
    chatRealtimeClient.ensureConnected(true);
  },

  obterIdentificadorUsuario(usuarioOuEmail?: string | Usuario | null): string {
    return obterIdentificadorUsuarioChat(usuarioOuEmail);
  },

  usuarioCurtiuMensagem(msg: ChatMensagem, usuarioOuEmail?: string | Usuario | null): boolean {
    const meuId = obterIdentificadorUsuarioChat(usuarioOuEmail);
    const emailAlt =
      usuarioOuEmail && typeof usuarioOuEmail === 'object'
        ? String(usuarioOuEmail.email || '').trim().toLowerCase()
        : '';
    const lista = Array.isArray(msg.curtido_por) ? msg.curtido_por : [];
    return lista.some((u) => {
      const norm = normalizarIdListaUsuario(u);
      return norm === meuId || (Boolean(emailAlt) && norm === emailAlt);
    });
  },

  obterReacaoDoUsuario(msg: ChatMensagem, usuarioOuEmail?: string | Usuario | null): string | null {
    if (!msg.reacoes || typeof msg.reacoes !== 'object') return null;
    const meuId = obterIdentificadorUsuarioChat(usuarioOuEmail);
    const emailAlt =
      usuarioOuEmail && typeof usuarioOuEmail === 'object'
        ? String(usuarioOuEmail.email || '').trim().toLowerCase()
        : '';
    for (const [emoji, users] of Object.entries(msg.reacoes)) {
      if (
        Array.isArray(users) &&
        users.some((u) => {
          const norm = normalizarIdListaUsuario(u);
          return norm === meuId || (Boolean(emailAlt) && norm === emailAlt);
        })
      ) {
        return emoji;
      }
    }
    return null;
  },

  /**
   * Obtém todas as mensagens do concurso + canal de forma unificada,
   * mesclando automaticamente mensagens enviadas no widget global ('geral')
   * e nas abas de cargos específicos do mesmo concurso para que todos os usuários
   * recebam as mensagens em tempo real.
   */
  getMensagens(concursoId: string, cargoId: string = 'geral', canalId: CanalChatId = 'geral'): ChatMensagem[] {
    if (!concursoId) return [];
    const prefix = `${CHAT_KEY}_${concursoId}_`;
    const suffix = `_${canalId}`;
    const canonicalKey = `${CHAT_KEY}_${concursoId}_geral_${canalId}`;
    const specificKey = `${CHAT_KEY}_${concursoId}_${cargoId || 'geral'}_${canalId}`;

    const keysToRead = new Set<string>([canonicalKey, specificKey]);
    try {
      const allKeys = cloudSync.getAllKeys();
      for (const k of allKeys) {
        if (k.startsWith(prefix) && k.endsWith(suffix)) {
          keysToRead.add(k);
        }
      }
    } catch {
      // ignore
    }

    const msgMap = new Map<string, { msg: ChatMensagem; order: number }>();
    let runningIdx = 0;

    for (const key of keysToRead) {
      try {
        const raw = cloudSync.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) continue;

        for (const item of parsed) {
          if (!item || typeof item !== 'object' || !item.id) continue;
          const norm = normalizarMensagem(item as ChatMensagem);
          const existing = msgMap.get(norm.id);
          const order = extrairTimestampOrdenacao(norm, runningIdx++);

          if (!existing) {
            msgMap.set(norm.id, { msg: norm, order });
          } else {
            const existingTs = Number(existing.msg.updated_at || existing.msg.created_at || 0);
            const incomingTs = Number(norm.updated_at || norm.created_at || 0);
            if (incomingTs >= existingTs) {
              msgMap.set(norm.id, {
                msg: norm,
                order: Math.min(existing.order, order),
              });
            }
          }
        }
      } catch {
        // ignore
      }
    }

    return Array.from(msgMap.values())
      .sort((a, b) => a.order - b.order)
      .map((entry) => entry.msg);
  },

  salvarMensagensLocalmente(
    concursoId: string,
    cargoId: string,
    canalId: CanalChatId,
    msgs: ChatMensagem[]
  ): Record<string, string> {
    const normalizedMsgs = msgs.map((m) => normalizarMensagem(m));
    const serialized = JSON.stringify(normalizedMsgs);
    const canonicalKey = `${CHAT_KEY}_${concursoId}_geral_${canalId}`;
    const specificKey = `${CHAT_KEY}_${concursoId}_${cargoId || 'geral'}_${canalId}`;
    const entries: Record<string, string> = {
      [canonicalKey]: serialized,
    };

    cloudSync.setItemLocalOnly(canonicalKey, normalizedMsgs);
    if (specificKey !== canonicalKey) {
      cloudSync.setItemLocalOnly(specificKey, normalizedMsgs);
      entries[specificKey] = serialized;
    }

    try {
      const prefix = `${CHAT_KEY}_${concursoId}_`;
      const suffix = `_${canalId}`;
      for (const k of cloudSync.getAllKeys()) {
        if (k.startsWith(prefix) && k.endsWith(suffix) && k !== canonicalKey && k !== specificKey) {
          cloudSync.setItemLocalOnly(k, normalizedMsgs);
          entries[k] = serialized;
        }
      }
    } catch {
      // ignore
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('certam_chat_updated', {
          detail: { concursoId, cargoId, canalId, msgs: normalizedMsgs },
        })
      );
    }

    return entries;
  },

  salvarMensagens(
    concursoId: string,
    cargoId: string,
    canalId: CanalChatId,
    msgs: ChatMensagem[],
    forceReplace = false
  ) {
    const normalizedMsgs = msgs.map((m) => normalizarMensagem(m));
    const canonicalKey = `${CHAT_KEY}_${concursoId}_geral_${canalId}`;
    const specificKey = `${CHAT_KEY}_${concursoId}_${cargoId || 'geral'}_${canalId}`;

    // Salva na chave canônica unificada do concurso+canal
    cloudSync.setItem(canonicalKey, normalizedMsgs, forceReplace);

    // Sincroniza também na chave específica do cargo (e outras chaves já existentes do mesmo concurso+canal)
    if (specificKey !== canonicalKey) {
      cloudSync.setItem(specificKey, normalizedMsgs, forceReplace);
    }

    try {
      const prefix = `${CHAT_KEY}_${concursoId}_`;
      const suffix = `_${canalId}`;
      for (const k of cloudSync.getAllKeys()) {
        if (k.startsWith(prefix) && k.endsWith(suffix) && k !== canonicalKey && k !== specificKey) {
          cloudSync.setItem(k, normalizedMsgs, forceReplace);
        }
      }
    } catch {
      // ignore
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('certam_chat_updated', {
          detail: { concursoId, cargoId, canalId, msgs: normalizedMsgs },
        })
      );
    }
  },

  /**
   * Aguarda confirmação de recebimento (ACK) do servidor para uma mensagem específica.
   * Caso o servidor confirme, marca `status_envio = 'entregue'`.
   * Caso falhe ou dê timeout, marca `status_envio = 'erro'` permitindo reenvio manual pelo usuário.
   */
  async confirmarRecebimentoMensagem(
    concursoId: string,
    cargoId: string,
    canalId: CanalChatId,
    msgId: string
  ): Promise<boolean> {
    const msgsAtuais = this.getMensagens(concursoId, cargoId, canalId);
    const alvo = msgsAtuais.find((m) => m.id === msgId);
    if (!alvo) return false;

    // Prepara payload para o servidor já com status 'entregue' caso seja persistido com sucesso
    const msgsParaServidor = msgsAtuais.map((m) =>
      m.id === msgId
        ? {
            ...m,
            status_envio: 'entregue' as const,
            erro_envio: undefined,
            updated_at: Date.now(),
          }
        : m
    );

    const canonicalKey = `${CHAT_KEY}_${concursoId}_geral_${canalId}`;
    const specificKey = `${CHAT_KEY}_${concursoId}_${cargoId || 'geral'}_${canalId}`;
    const serialized = JSON.stringify(msgsParaServidor);
    const entries: Record<string, string> = {
      [canonicalKey]: serialized,
    };
    if (specificKey !== canonicalKey) {
      entries[specificKey] = serialized;
    }

    const ackResult = await chatRealtimeClient.sendEntriesWithAck(msgId, entries);

    const msgsPosAck = this.getMensagens(concursoId, cargoId, canalId);
    const item = msgsPosAck.find((m) => m.id === msgId);
    if (!item) return ackResult.ok;

    if (ackResult.ok) {
      item.status_envio = 'entregue';
      item.ack_at = ackResult.serverTimestamp || Date.now();
      item.erro_envio = undefined;
      item.updated_at = Date.now();
      this.salvarMensagensLocalmente(concursoId, cargoId, canalId, msgsPosAck);
      return true;
    } else {
      item.status_envio = 'erro';
      item.erro_envio =
        ackResult.error ||
        'Não foi possível confirmar o recebimento pelo servidor. Clique para reenviar.';
      item.updated_at = Date.now();
      this.salvarMensagensLocalmente(concursoId, cargoId, canalId, msgsPosAck);
      return false;
    }
  },

  /**
   * Reenvia manualmente uma mensagem que apresentou falha de confirmação (ACK).
   */
  async reenviarMensagem(
    concursoId: string,
    cargoId: string,
    canalId: CanalChatId,
    msgId: string
  ): Promise<boolean> {
    const msgs = this.getMensagens(concursoId, cargoId, canalId);
    const item = msgs.find((m) => m.id === msgId);
    if (!item) return false;

    item.status_envio = 'enviando';
    item.erro_envio = undefined;
    item.updated_at = Date.now();
    this.salvarMensagensLocalmente(concursoId, cargoId, canalId, msgs);

    return this.confirmarRecebimentoMensagem(concursoId, cargoId, canalId, msgId);
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
    chatRealtimeClient.init();
    const msgs = this.getMensagens(concursoId, cargoId, canalId);
    const now = new Date();
    const nowMs = now.getTime();
    const dataHoraStr = `Hoje às ${now.getHours().toString().padStart(2, '0')}:${now
      .getMinutes()
      .toString()
      .padStart(2, '0')}`;

    let nova: ChatMensagem;

    if (typeof autorOrDados === 'string') {
      const cores = ['#0D5C75', '#0F766E', '#1D4ED8', '#6366F1', '#475569'];
      const avatarCor = cores[Math.floor(Math.random() * cores.length)];
      const resolvedEmail = email || obterIdentificadorUsuarioChat();

      nova = {
        id: `msg-${nowMs.toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
        concurso_id: concursoId,
        cargo_id: cargoId || 'geral',
        canal_id: canalId,
        autor: autorOrDados,
        email: resolvedEmail,
        avatar_cor: avatarCor,
        texto: (texto || '').trim(),
        data_hora: dataHoraStr,
        curtidas: 0,
        curtido_por: [],
        reacoes: {},
        is_admin: extra?.isAdmin || false,
        is_fixado: extra?.isFixado || false,
        posicao_candidato: extra?.posicao,
        comarca_preferida: extra?.comarcaPreferida,
        created_at: nowMs,
        updated_at: nowMs,
        status_envio: 'enviando',
      };
    } else {
      nova = {
        ...autorOrDados,
        id: `msg-${nowMs.toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
        concurso_id: concursoId,
        cargo_id: cargoId || 'geral',
        canal_id: canalId,
        data_hora: dataHoraStr,
        curtidas: 0,
        curtido_por: [],
        reacoes: {},
        created_at: nowMs,
        updated_at: nowMs,
        status_envio: 'enviando',
      };
    }

    msgs.push(nova);
    // 1. Insere otimisticamente com status 'enviando'
    this.salvarMensagensLocalmente(concursoId, cargoId, canalId, msgs);

    // 2. Aguarda confirmação de recebimento (ACK) do servidor
    void this.confirmarRecebimentoMensagem(concursoId, cargoId, canalId, nova.id);

    return nova;
  },

  /**
   * Toggle estrito de curtida:
   * - Cada usuário só pode curtir 1 única vez cada mensagem.
   * - Se já curtiu, clicar novamente remove a curtida.
   * - O total de curtidas é sempre exatamente `curtido_por.length`.
   */
  curtirMensagem(
    concursoId: string,
    cargoId: string,
    canalId: CanalChatId,
    msgId: string,
    usuarioOuEmail?: string | Usuario | null
  ): boolean {
    const msgs = this.getMensagens(concursoId, cargoId, canalId);
    const m = msgs.find((msg) => msg.id === msgId);
    if (!m) return false;

    const userId = obterIdentificadorUsuarioChat(usuarioOuEmail);
    const emailAlt =
      usuarioOuEmail && typeof usuarioOuEmail === 'object'
        ? String(usuarioOuEmail.email || '').trim().toLowerCase()
        : '';

    const atuais = Array.isArray(m.curtido_por)
      ? m.curtido_por
          .map((u) => normalizarIdListaUsuario(u))
          .filter((u) => Boolean(u) && u !== 'candidato@certam.com.br')
      : [];

    const jaCurtiu = atuais.some(
      (u) => u === userId || (Boolean(emailAlt) && u === emailAlt)
    );

    let novaLista: string[];
    if (jaCurtiu) {
      novaLista = atuais.filter(
        (u) => u !== userId && (!emailAlt || u !== emailAlt)
      );
    } else {
      novaLista = Array.from(new Set([...atuais, userId]));
    }

    m.curtido_por = novaLista;
    m.curtidas = novaLista.length;
    m.updated_at = Date.now();

    this.salvarMensagens(concursoId, cargoId, canalId, msgs, true);
    return !jaCurtiu;
  },

  /**
   * Reação com emoji (toggle estrito e limite de 1 reação por usuário por mensagem):
   * - Se o usuário clicar no mesmo emoji que já havia reagido, remove a reação.
   * - Se clicar em outro emoji, substitui a reação anterior daquele usuário na mensagem.
   */
  reagirEmoji(
    concursoId: string,
    cargoId: string,
    canalId: CanalChatId,
    msgId: string,
    emoji: string,
    usuarioOuEmail?: string | Usuario | null
  ): void {
    if (!emoji) return;
    const msgs = this.getMensagens(concursoId, cargoId, canalId);
    const m = msgs.find((msg) => msg.id === msgId);
    if (!m) return;

    const userId = obterIdentificadorUsuarioChat(usuarioOuEmail);
    const emailAlt =
      usuarioOuEmail && typeof usuarioOuEmail === 'object'
        ? String(usuarioOuEmail.email || '').trim().toLowerCase()
        : '';

    const reacoesAtuais: Record<string, string[]> = m.reacoes && typeof m.reacoes === 'object' ? { ...m.reacoes } : {};
    const listaDoEmojiAlvo = Array.isArray(reacoesAtuais[emoji]) ? reacoesAtuais[emoji] : [];
    const jaTinhaEsteEmoji = listaDoEmojiAlvo.some((u) => {
      const norm = normalizarIdListaUsuario(u);
      return norm === userId || (Boolean(emailAlt) && norm === emailAlt);
    });

    // Remove o usuário de TODOS os emojis desta mensagem (garante no máximo 1 reação por usuário por mensagem)
    const novasReacoes: Record<string, string[]> = {};
    for (const [emjKey, listaUsuarios] of Object.entries(reacoesAtuais)) {
      if (!Array.isArray(listaUsuarios)) continue;
      const filtrada = listaUsuarios
        .map((u) => normalizarIdListaUsuario(u))
        .filter(
          (u) =>
            Boolean(u) &&
            u !== 'candidato@certam.com.br' &&
            u !== userId &&
            (!emailAlt || u !== emailAlt)
        );
      if (filtrada.length > 0) {
        novasReacoes[emjKey] = Array.from(new Set(filtrada));
      }
    }

    // Se ainda não tinha reagido com este emoji específico, adiciona-o agora
    if (!jaTinhaEsteEmoji) {
      const listaAtual = novasReacoes[emoji] || [];
      novasReacoes[emoji] = Array.from(new Set([...listaAtual, userId]));
      this.registrarUsoEmoji(emoji);
    }

    m.reacoes = novasReacoes;
    m.updated_at = Date.now();

    this.salvarMensagens(concursoId, cargoId, canalId, msgs, true);
  },

  registrarUsoEmoji(emoji: string) {
    if (typeof window === 'undefined' || !emoji) return;
    try {
      const raw = localStorage.getItem(FREQUENT_EMOJIS_STORAGE_KEY);
      const counts: Record<string, number> = raw ? JSON.parse(raw) : {};
      counts[emoji] = (counts[emoji] || 0) + 1;
      localStorage.setItem(FREQUENT_EMOJIS_STORAGE_KEY, JSON.stringify(counts));
      window.dispatchEvent(new CustomEvent('certam_emojis_updated'));
    } catch {
      // ignore
    }
  },

  getEmojisFrequentes(limit = 8): string[] {
    if (typeof window === 'undefined') return DEFAULT_FREQUENT_EMOJIS.slice(0, limit);
    try {
      const raw = localStorage.getItem(FREQUENT_EMOJIS_STORAGE_KEY);
      if (!raw) return DEFAULT_FREQUENT_EMOJIS.slice(0, limit);
      const counts: Record<string, number> = JSON.parse(raw);
      const sortedUserEmojis = Object.entries(counts)
        .filter(([e, count]) => Boolean(e) && typeof count === 'number' && count > 0)
        .sort((a, b) => b[1] - a[1])
        .map(([e]) => e);

      const combined = Array.from(new Set([...sortedUserEmojis, ...DEFAULT_FREQUENT_EMOJIS]));
      return combined.slice(0, limit);
    } catch {
      return DEFAULT_FREQUENT_EMOJIS.slice(0, limit);
    }
  },

  getContagemUsoEmojis(): Record<string, number> {
    if (typeof window === 'undefined') return {};
    try {
      const raw = localStorage.getItem(FREQUENT_EMOJIS_STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  },

  // ---------------------------------------------------------------------------
  // GERENCIAMENTO DE ESTADO DE SILENCIAMENTO DE CONVERSAS (PERSISTIDO NO LOCALSTORAGE)
  // ---------------------------------------------------------------------------
  getMapaSalasSilenciadas(): Record<string, boolean> {
    if (typeof window === 'undefined') return {};
    try {
      const raw = localStorage.getItem(MUTED_ROOMS_STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  },

  isSalaSilenciada(concursoIdOuRoomKey: string, canalId?: string): boolean {
    if (!concursoIdOuRoomKey) return false;
    const muted = this.getMapaSalasSilenciadas();

    // Se passou chave composta (ex: "tjrs_2025_geral") ou ID direto
    if (muted[concursoIdOuRoomKey]) return true;

    // Verifica também se o concurso inteiro está silenciado
    const concursoBase = concursoIdOuRoomKey.replace(/_(geral|lotacao|posse|recursos)$/, '');
    if (muted[concursoBase] || muted[`${concursoBase}_all`]) {
      return true;
    }

    if (canalId) {
      if (muted[`${concursoBase}_${canalId}`]) return true;
    }

    return false;
  },

  isConcursoSilenciado(concursoId: string): boolean {
    if (!concursoId) return false;
    const muted = this.getMapaSalasSilenciadas();
    return Boolean(muted[concursoId] || muted[`${concursoId}_all`]);
  },

  alternarSilenciarSala(concursoIdOuRoomKey: string, canalId?: string): boolean {
    if (typeof window === 'undefined' || !concursoIdOuRoomKey) return false;
    try {
      const muted = this.getMapaSalasSilenciadas();
      const targetKey = canalId ? `${concursoIdOuRoomKey}_${canalId}` : concursoIdOuRoomKey;
      const nextState = !muted[targetKey];
      if (nextState) {
        muted[targetKey] = true;
      } else {
        delete muted[targetKey];
      }
      localStorage.setItem(MUTED_ROOMS_STORAGE_KEY, JSON.stringify(muted));
      window.dispatchEvent(new CustomEvent('certam_chat_mute_updated', { detail: muted }));
      return nextState;
    } catch {
      return false;
    }
  },

  alternarSilenciarConcurso(concursoId: string): boolean {
    if (typeof window === 'undefined' || !concursoId) return false;
    try {
      const muted = this.getMapaSalasSilenciadas();
      const isCurrentlyMuted = Boolean(muted[concursoId] || muted[`${concursoId}_all`]);
      const nextState = !isCurrentlyMuted;

      const canais: CanalChatId[] = ['geral', 'lotacao', 'posse', 'recursos'];
      if (nextState) {
        muted[concursoId] = true;
        muted[`${concursoId}_all`] = true;
        canais.forEach((c) => {
          muted[`${concursoId}_${c}`] = true;
        });
      } else {
        delete muted[concursoId];
        delete muted[`${concursoId}_all`];
        canais.forEach((c) => {
          delete muted[`${concursoId}_${c}`];
        });
      }

      localStorage.setItem(MUTED_ROOMS_STORAGE_KEY, JSON.stringify(muted));
      window.dispatchEvent(new CustomEvent('certam_chat_mute_updated', { detail: muted }));
      return nextState;
    } catch {
      return false;
    }
  },

  isDmSilenciada(outroEmail: string): boolean {
    if (!outroEmail) return false;
    const muted = this.getMapaSalasSilenciadas();
    return Boolean(muted[`dm_${outroEmail.trim().toLowerCase()}`]);
  },

  alternarSilenciarDm(outroEmail: string): boolean {
    if (!outroEmail) return false;
    return this.alternarSilenciarSala(`dm_${outroEmail.trim().toLowerCase()}`);
  },

  fixarMensagem(concursoId: string, cargoId: string, canalId: CanalChatId, msgId: string, fixar: boolean) {
    const msgs = this.getMensagens(concursoId, cargoId, canalId);
    const m = msgs.find((msg) => msg.id === msgId);
    if (m) {
      m.is_fixado = fixar;
      m.updated_at = Date.now();
      this.salvarMensagens(concursoId, cargoId, canalId, msgs, true);
    }
  },

  alternarFixado(concursoId: string, cargoId: string, canalId: CanalChatId, msgId: string) {
    const msgs = this.getMensagens(concursoId, cargoId, canalId);
    const m = msgs.find((msg) => msg.id === msgId);
    if (m) {
      m.is_fixado = !m.is_fixado;
      m.updated_at = Date.now();
      this.salvarMensagens(concursoId, cargoId, canalId, msgs, true);
    }
  },

  removerMensagem(concursoId: string, cargoId: string, canalId: CanalChatId, msgId: string) {
    let msgs = this.getMensagens(concursoId, cargoId, canalId);
    msgs = msgs.filter((m) => m.id !== msgId);
    this.salvarMensagens(concursoId, cargoId, canalId, msgs, true);
  },

  apagarMensagem(concursoId: string, cargoId: string, canalId: CanalChatId, msgId: string) {
    this.removerMensagem(concursoId, cargoId, canalId, msgId);
  },
};
