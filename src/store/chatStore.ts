import { ChatMensagem, CanalChatId, Usuario, Concurso, Candidato, Lote } from '../types';
import { cloudSync } from './cloudSync';
import { chatRealtimeClient, ChatConnectionState } from './chatRealtimeClient';
import { lotesStore } from './lotesStore';
import { normalizarTexto, limparCpf } from '../data/defaultCandidates';
import { podeEditarCargo, podeEditarLote } from '../utils/permissions';

const CHAT_KEY = 'certam_chat_messages_v5';
const MUTED_ROOMS_STORAGE_KEY = 'certam_chat_muted_rooms_v1';
const FREQUENT_EMOJIS_STORAGE_KEY = 'certam_frequent_emojis_v1';
const CLIENT_ANON_ID_KEY = 'certam_chat_client_id_v1';

// Limites de retenção para purga automática de mensagens antigas (evita sobrecarga do localStorage)
export const CHAT_MAX_MESSAGES_PER_ROOM = 100;
export const CHAT_RETENTION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias

export const DEFAULT_FREQUENT_EMOJIS = ['👍', '❤️', '🔥', '🎉', '🚀', '👏', '🙏', '💡'];

export type TipoSalaChatConcurso = 'geral' | 'cargo' | 'aprovados' | 'lote';

export interface SalaChatConcurso {
  id: string;
  tipo: TipoSalaChatConcurso;
  concursoId: string;
  cargoId: string;
  cargoNome: string;
  loteId?: string;
  loteNome?: string;
  cargoScope: string;
  titulo: string;
  tituloCurto: string;
  descricao: string;
  restrito: boolean;
  temAcesso: boolean;
  posicaoUsuarioNoCargo?: number;
  motivoBloqueio?: string;
}

function abreviarNomeCargoChat(nome: string): string {
  const limpo = (nome || '').trim();
  if (!limpo) return 'Cargo';
  return limpo
    .replace(/Analista Judiciário\s*-\s*Área\s*/i, 'AJ - ')
    .replace(/Técnico Judiciário\s*-\s*Área\s*/i, 'TJ - ')
    .replace(/Analista Judiciário/i, 'AJ')
    .replace(/Técnico Judiciário/i, 'TJ');
}

export function localizarCandidatoDoUsuarioNoCargo(
  usuario: Usuario | null | undefined,
  candidatos: Candidato[]
): Candidato | null {
  if (!usuario || !Array.isArray(candidatos) || candidatos.length === 0) return null;
  const userIdStr = String(usuario.id || '').trim();
  const userCandIdStr = String(usuario.candidato_id || '').trim();
  const cpfUsuarioLimpo = limparCpf(usuario.cpf);
  const cpfValido = cpfUsuarioLimpo.length >= 9 && !/^0+$/.test(cpfUsuarioLimpo);

  return (
    candidatos.find((c) => {
      if (!c) return false;
      const cIdStr = String(c.id || '').trim();
      if (cIdStr) {
        if (userIdStr && cIdStr === userIdStr) return true;
        if (userCandIdStr && cIdStr === userCandIdStr) return true;
      }
      if (cpfValido && c.cpf) {
        const cpfCandLimpo = limparCpf(c.cpf);
        if (cpfCandLimpo.length >= 9 && cpfCandLimpo === cpfUsuarioLimpo) return true;
      }
      return false;
    }) || null
  );
}

export function verificarUsuarioConvocadoNoLote(
  usuario: Usuario | null | undefined,
  isAdmin: boolean,
  concursoId: string,
  cargoId: string,
  lote: Lote,
  meuCandidato: Candidato | null
): boolean {
  if (isAdmin || podeEditarLote(usuario || null, concursoId, cargoId)) return true;
  if (!usuario || !meuCandidato || !lote) return false;

  if (Array.isArray(lote.convocados) && lote.convocados.length > 0) {
    const achouConvocados = lote.convocados.some(
      (cv) =>
        (cv.candidato_id && cv.candidato_id === meuCandidato.id) ||
        (cv.nome && normalizarTexto(cv.nome) === normalizarTexto(meuCandidato.nome))
    );
    if (achouConvocados) return true;
  }

  if (Array.isArray(lote.candidatos_ids) && lote.candidatos_ids.length > 0) {
    const achouIds =
      lote.candidatos_ids.includes(meuCandidato.id) ||
      lote.candidatos_ids.some(
        (idOuNome) => normalizarTexto(idOuNome) === normalizarTexto(meuCandidato.nome)
      );
    if (achouIds) return true;
  }

  const loteCandNum = String(meuCandidato.numero_lote_convocado ?? '').replace(/\D/g, '');
  const loteAlvoNum = String(lote.numero_lote ?? lote.nome ?? '').replace(/\D/g, '');
  if (loteCandNum && loteAlvoNum && loteCandNum === loteAlvoNum) {
    return true;
  }

  return false;
}

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
  const isCpfRealValido = (cpfDigits: string) =>
    cpfDigits.length >= 9 && !/^0+$/.test(cpfDigits);

  if (usuarioOuEmail && typeof usuarioOuEmail === 'object') {
    const cpfLimpo = String(usuarioOuEmail.cpf || '').replace(/\D/g, '');
    if (isCpfRealValido(cpfLimpo)) return `cpf:${cpfLimpo}`;
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
          if (isCpfRealValido(cpfLimpo)) return `cpf:${cpfLimpo}`;
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

  const senderIdNormalizado = normalizarIdListaUsuario(
    msg.sender_id || msg.email || ''
  );

  const isOnline = typeof navigator === 'undefined' || navigator.onLine !== false;
  const ageMs = Date.now() - Number(msg.updated_at || msg.created_at || 0);
  const shouldHealStuckStatus =
    isOnline &&
    (msg.status_envio === 'erro' || (msg.status_envio === 'enviando' && ageMs > 4500));

  return {
    ...msg,
    sender_id: senderIdNormalizado || undefined,
    status_envio: shouldHealStuckStatus ? 'entregue' : msg.status_envio,
    erro_envio: shouldHealStuckStatus ? undefined : msg.erro_envio,
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

function ordenarMensagensChatCronologicamente(msgs: ChatMensagem[]): ChatMensagem[] {
  if (!Array.isArray(msgs) || msgs.length <= 1) return msgs || [];
  return msgs
    .map((m, idx) => ({
      m,
      ts: extrairTimestampOrdenacao(m, idx),
      idx,
    }))
    .sort((a, b) => (a.ts !== b.ts ? a.ts - b.ts : a.idx - b.idx))
    .map((entry) => entry.m);
}

/**
 * Purga mensagens antigas (acima de `maxAgeMs`) ou excedentes ao limite `maxCount` por sala,
 * preservando sempre as mensagens fixadas (`is_fixado: true`) e o histórico recente relevante.
 */
export function aplicarPoliticaRetencaoMensagens(
  msgs: ChatMensagem[],
  maxCount: number = CHAT_MAX_MESSAGES_PER_ROOM,
  maxAgeMs: number = CHAT_RETENTION_MAX_AGE_MS
): { mantidas: ChatMensagem[]; removidas: number } {
  if (!Array.isArray(msgs) || msgs.length === 0) {
    return { mantidas: [], removidas: 0 };
  }

  const ordenadas = ordenarMensagensChatCronologicamente(msgs);
  const now = Date.now();
  const fixadas: ChatMensagem[] = [];
  const regularesRecentes: ChatMensagem[] = [];

  for (let i = 0; i < ordenadas.length; i++) {
    const m = ordenadas[i];
    if (!m) continue;
    if (m.is_fixado) {
      fixadas.push(m);
      continue;
    }
    const ts = extrairTimestampOrdenacao(m, -1);
    const temTimestampReal = ts > 1000000000000;
    if (temTimestampReal && now - ts > maxAgeMs) {
      // Purga mensagem expirada por idade (> 30 dias)
      continue;
    }
    regularesRecentes.push(m);
  }

  const regularesLimitadas =
    regularesRecentes.length > maxCount
      ? regularesRecentes.slice(regularesRecentes.length - maxCount)
      : regularesRecentes;

  const idsMantidos = new Set<string>([
    ...fixadas.map((m) => m.id),
    ...regularesLimitadas.map((m) => m.id),
  ]);

  const mantidas = ordenadas.filter((m) => m && idsMantidos.has(m.id));
  return {
    mantidas,
    removidas: Math.max(0, msgs.length - mantidas.length),
  };
}

let lastChatCreatedAt = 0;
const selfSentMessageIds = new Set<string>();

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

  obterConjuntoSenderIdsUsuarioAtual(usuarioOuEmail?: string | Usuario | null): Set<string> {
    const ids = new Set<string>();
    const primaryId = normalizarIdListaUsuario(obterIdentificadorUsuarioChat(usuarioOuEmail));
    if (primaryId) ids.add(primaryId);

    const anonId = normalizarIdListaUsuario(getOrCreateAnonId());
    if (anonId) ids.add(anonId);

    if (usuarioOuEmail && typeof usuarioOuEmail === 'object') {
      if (usuarioOuEmail.id) ids.add(normalizarIdListaUsuario(String(usuarioOuEmail.id)));
      if (usuarioOuEmail.email) ids.add(normalizarIdListaUsuario(usuarioOuEmail.email));
      const cpfLimpo = String(usuarioOuEmail.cpf || '').replace(/\D/g, '');
      if (cpfLimpo.length >= 9) {
        ids.add(`cpf:${cpfLimpo}`);
        ids.add(cpfLimpo);
      }
    } else if (typeof usuarioOuEmail === 'string' && usuarioOuEmail.trim()) {
      ids.add(normalizarIdListaUsuario(usuarioOuEmail));
    }

    if (typeof window !== 'undefined') {
      try {
        const rawAuth = localStorage.getItem('certam_auth_user_v8');
        if (rawAuth) {
          const parsed = JSON.parse(rawAuth);
          if (parsed && typeof parsed === 'object') {
            if (parsed.id) ids.add(normalizarIdListaUsuario(String(parsed.id)));
            if (parsed.email) ids.add(normalizarIdListaUsuario(String(parsed.email)));
            const cpfLimpo = String(parsed.cpf || '').replace(/\D/g, '');
            if (cpfLimpo.length >= 9) {
              ids.add(`cpf:${cpfLimpo}`);
              ids.add(cpfLimpo);
            }
          }
        }
      } catch {
        // ignore
      }
    }

    ids.delete('');
    ids.delete('candidato@certam.com.br');
    return ids;
  },

  isMensagemDoProprioUsuario(
    msg: ChatMensagem,
    usuarioOuEmail?: string | Usuario | null
  ): boolean {
    if (!msg) return false;
    if (selfSentMessageIds.has(msg.id)) return true;

    const meusSenderIds = this.obterConjuntoSenderIdsUsuarioAtual(usuarioOuEmail);
    const msgSenderIdNorm = normalizarIdListaUsuario(msg.sender_id || '');
    if (msgSenderIdNorm && meusSenderIds.has(msgSenderIdNorm)) {
      return true;
    }

    const msgEmailNorm = normalizarIdListaUsuario(msg.email || '');
    if (msgEmailNorm && meusSenderIds.has(msgEmailNorm)) {
      return true;
    }

    if (usuarioOuEmail && typeof usuarioOuEmail === 'object') {
      const userNomeNorm = String(usuarioOuEmail.nome || '').trim().toLowerCase();
      const msgAutorNorm = String(msg.autor || '').trim().toLowerCase();
      const userEmailNorm = normalizarIdListaUsuario(usuarioOuEmail.email || '');
      if (
        userNomeNorm &&
        userNomeNorm !== 'candidato' &&
        msgAutorNorm === userNomeNorm &&
        (!msgEmailNorm || !userEmailNorm || msgEmailNorm === userEmailNorm)
      ) {
        return true;
      }
    }

    return false;
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
   * Constrói dinamicamente todas as salas de chat de um concurso seguindo as regras de negócio:
   * 1. Chat Geral: aberto a todos que acompanham as novidades do concurso.
   * 2. Chat do Cargo: existe para cada cargo SOMENTE até o concurso ser homologado e a lista de classificação daquele cargo ser preenchida.
   * 3. Chat dos Aprovados: existe para cada cargo com lista de classificação preenchida em concurso homologado; restrito estritamente aos aprovados na lista daquele cargo.
   * 4. Chat do Lote: existe 1 para cada lote de cada cargo do concurso; restrito estritamente aos convocados naquele lote específico.
   */
  getSalasDoConcurso(
    concurso: Concurso | null | undefined,
    usuario?: Usuario | null,
    isAdmin: boolean = false
  ): SalaChatConcurso[] {
    if (!concurso) return [];
    const userIsAdmin = Boolean(
      isAdmin ||
        usuario?.is_admin ||
        usuario?.role === 'admin' ||
        usuario?.tipo_usuario === 'admin' ||
        usuario?.email?.toLowerCase() === 'rafasms0@hotmail.com'
    );

    const salas: SalaChatConcurso[] = [
      {
        id: 'geral',
        tipo: 'geral',
        concursoId: concurso.id,
        cargoId: 'geral',
        cargoNome: 'Geral',
        cargoScope: 'geral',
        titulo: 'Chat Geral',
        tituloCurto: 'Chat Geral',
        descricao: 'Aberto a todos que acompanham as novidades do concurso',
        restrito: false,
        temAcesso: true,
      },
    ];

    const todosLotes = lotesStore.getLotes();
    const isConcursoHomologado = Boolean(
      concurso.homologado ||
        concurso.status === 'Homologado' ||
        concurso.status === 'Convocando'
    );

    const cargos = Array.isArray(concurso.cargos) ? concurso.cargos : [];

    cargos.forEach((cg) => {
      const candidatosCargo = lotesStore.getCandidatos(concurso.id, cg.id);
      const listaPreenchida = candidatosCargo.length > 0;
      const usarChatAprovados = isConcursoHomologado && listaPreenchida;
      const cargoCurto = abreviarNomeCargoChat(cg.nome);
      const meuCandidato = localizarCandidatoDoUsuarioNoCargo(usuario, candidatosCargo);

      if (!usarChatAprovados) {
        // O Chat do Cargo só existe até o concurso ser homologado e a lista de classificação ser preenchida
        salas.push({
          id: `cargo__${cg.id}`,
          tipo: 'cargo',
          concursoId: concurso.id,
          cargoId: cg.id,
          cargoNome: cg.nome,
          cargoScope: `cargo__${cg.id}`,
          titulo: `Chat do Cargo • ${cg.nome}`,
          tituloCurto: `Cargo: ${cargoCurto}`,
          descricao: `Para todos que desejam tratar do cargo ${cg.nome} antes da homologação/lista final`,
          restrito: false,
          temAcesso: true,
        });
      } else {
        // Concurso homologado e lista de classificação preenchida: substitui pelo Chat dos Aprovados
        const temAcessoAprovados = Boolean(
          userIsAdmin ||
            podeEditarCargo(usuario || null, concurso.id, cg.id) ||
            meuCandidato
        );
        salas.push({
          id: `aprovados__${cg.id}`,
          tipo: 'aprovados',
          concursoId: concurso.id,
          cargoId: cg.id,
          cargoNome: cg.nome,
          cargoScope: `aprovados__${cg.id}`,
          titulo: `Chat dos Aprovados • ${cg.nome}`,
          tituloCurto: `Aprovados: ${cargoCurto}`,
          descricao: `Exclusivo para candidatos que figuram na lista de classificação de ${cg.nome}`,
          restrito: true,
          temAcesso: temAcessoAprovados,
          posicaoUsuarioNoCargo: meuCandidato?.posicao,
          motivoBloqueio: !usuario
            ? `Faça login com sua conta vinculada ao CPF aprovado para acessar o Chat dos Aprovados de ${cg.nome}.`
            : `Acesso restrito: apenas candidatos que figuram na lista de classificação homologada do cargo "${cg.nome}" podem visualizar e participar deste chat.`,
        });
      }

      // Lotes deste cargo e concurso
      const lotesDoCargo = todosLotes
        .filter(
          (l) =>
            l.id !== 'simulacao' &&
            l.concurso_id === concurso.id &&
            (!l.cargo_id || l.cargo_id === cg.id)
        )
        .sort((a, b) => {
          const numA = String(a.numero_lote || a.nome || '').replace(/[^\d.]/g, '');
          const numB = String(b.numero_lote || b.nome || '').replace(/[^\d.]/g, '');
          return numA.localeCompare(numB, undefined, { numeric: true, sensitivity: 'base' });
        });

      // Também detecta lotes informados diretamente nos candidatos (numero_lote_convocado) caso ainda não haja objeto Lote correspondente
      const lotesVirtuaisMap = new Map<string, Lote>();
      candidatosCargo.forEach((cand) => {
        const numLoteRaw = String(cand.numero_lote_convocado ?? '').trim();
        if (!numLoteRaw) return;
        const numDigits = numLoteRaw.replace(/\D/g, '') || numLoteRaw;
        const jaExiste = lotesDoCargo.some((l) => {
          const lNum = String(l.numero_lote || l.nome || '').replace(/\D/g, '');
          return lNum === numDigits || l.id === numLoteRaw;
        });
        if (!jaExiste) {
          const vId = `lote_num_${numDigits}`;
          const existente = lotesVirtuaisMap.get(vId);
          if (existente) {
            existente.candidatos_ids.push(cand.id);
          } else {
            lotesVirtuaisMap.set(vId, {
              id: vId,
              concurso_id: concurso.id,
              cargo_id: cg.id,
              nome: `${numDigits}º Lote`,
              numero_lote: numDigits,
              ativo: true,
              is_ranking_visible: true,
              is_printing_enabled: true,
              travado: false,
              comarcas: [],
              candidatos_ids: [cand.id],
            });
          }
        }
      });

      const todosLotesCargoCombinados = [
        ...lotesDoCargo,
        ...Array.from(lotesVirtuaisMap.values()),
      ];

      todosLotesCargoCombinados.forEach((lote) => {
        const temAcessoLote = verificarUsuarioConvocadoNoLote(
          usuario,
          userIsAdmin,
          concurso.id,
          cg.id,
          lote,
          meuCandidato
        );

        salas.push({
          id: `lote__${cg.id}__${lote.id}`,
          tipo: 'lote',
          concursoId: concurso.id,
          cargoId: cg.id,
          cargoNome: cg.nome,
          loteId: lote.id,
          loteNome: lote.nome,
          cargoScope: `lote__${cg.id}__${lote.id}`,
          titulo: `Chat do Lote • ${lote.nome} (${cg.nome})`,
          tituloCurto: `${lote.nome} (${cargoCurto})`,
          descricao: `Exclusivo para candidatos convocados no ${lote.nome} do cargo ${cg.nome}`,
          restrito: true,
          temAcesso: temAcessoLote,
          posicaoUsuarioNoCargo: meuCandidato?.posicao,
          motivoBloqueio: !usuario
            ? `Faça login para verificar se você foi convocado no ${lote.nome} (${cg.nome}).`
            : meuCandidato
            ? `Acesso restrito: você está aprovado em ${meuCandidato.posicao}º lugar em ${cg.nome}, porém este chat é exclusivo para os candidatos convocados no ${lote.nome}.`
            : `Acesso restrito: apenas candidatos convocados no ${lote.nome} do cargo "${cg.nome}" podem visualizar e participar deste chat.`,
        });
      });
    });

    return salas;
  },

  /**
   * Obtém as mensagens da sala específica (Chat Geral, Chat do Cargo, Chat dos Aprovados ou Chat do Lote)
   * mantendo isolamento estrito entre as diferentes salas.
   */
  getMensagens(concursoId: string, cargoId: string = 'geral', canalId: CanalChatId = 'geral'): ChatMensagem[] {
    if (!concursoId) return [];
    const scope = cargoId || 'geral';
    const targetKey = `${CHAT_KEY}_${concursoId}_${scope}_${canalId}`;

    const msgMap = new Map<string, { msg: ChatMensagem; order: number }>();
    let runningIdx = 0;

    try {
      const raw = cloudSync.getItem(targetKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
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
        }
      }
    } catch {
      // ignore
    }

    const ordenadas = Array.from(msgMap.values())
      .sort((a, b) => a.order - b.order)
      .map((entry) => entry.msg);

    const { mantidas, removidas } = aplicarPoliticaRetencaoMensagens(ordenadas);
    if (removidas > 0) {
      cloudSync.setItemLocalOnly(targetKey, mantidas);
    }
    return mantidas;
  },

  /**
   * Executa a purga proativa de mensagens antigas ou excedentes em todas as salas do `localStorage`,
   * mantendo apenas o histórico relevante e limpando IDs órfãos do mapa de leitura.
   */
  purgarMensagensAntigas(
    maxCount: number = CHAT_MAX_MESSAGES_PER_ROOM,
    maxAgeMs: number = CHAT_RETENTION_MAX_AGE_MS
  ): { totalRemovidas: number; salasAfetadas: number } {
    if (typeof window === 'undefined') {
      return { totalRemovidas: 0, salasAfetadas: 0 };
    }

    let totalRemovidas = 0;
    let salasAfetadas = 0;
    const chatKeys: string[] = [];

    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(`${CHAT_KEY}_`)) {
          chatKeys.push(k);
        }
      }

      for (const key of chatKeys) {
        const raw = localStorage.getItem(key) || cloudSync.getItem(key);
        if (!raw) continue;
        try {
          const parsed = JSON.parse(raw);
          if (!Array.isArray(parsed)) continue;
          const normalizadas = parsed
            .filter((item) => item && typeof item === 'object' && item.id)
            .map((item) => normalizarMensagem(item as ChatMensagem));

          const { mantidas, removidas } = aplicarPoliticaRetencaoMensagens(
            normalizadas,
            maxCount,
            maxAgeMs
          );
          if (removidas > 0) {
            totalRemovidas += removidas;
            salasAfetadas++;
            cloudSync.setItem(key, mantidas, true);
          }
        } catch {
          // ignore
        }
      }

      // Também limita o histórico de IDs lidos em certam_chat_read_msg_ids_v1 para não crescer indefinidamente
      const readRaw = localStorage.getItem('certam_chat_read_msg_ids_v1');
      if (readRaw) {
        const readMap = JSON.parse(readRaw);
        if (readMap && typeof readMap === 'object') {
          let readChanged = false;
          for (const [rk, arr] of Object.entries(readMap)) {
            if (Array.isArray(arr) && arr.length > maxCount * 2) {
              readMap[rk] = arr.slice(arr.length - maxCount * 2);
              readChanged = true;
            }
          }
          if (readChanged) {
            localStorage.setItem('certam_chat_read_msg_ids_v1', JSON.stringify(readMap));
          }
        }
      }
    } catch {
      // ignore
    }

    return { totalRemovidas, salasAfetadas };
  },

  salvarMensagensLocalmente(
    concursoId: string,
    cargoId: string,
    canalId: CanalChatId,
    msgs: ChatMensagem[]
  ): Record<string, string> {
    const normalizedMsgs = msgs.map((m) => normalizarMensagem(m));
    const { mantidas } = aplicarPoliticaRetencaoMensagens(normalizedMsgs);
    const serialized = JSON.stringify(mantidas);
    const scope = cargoId || 'geral';
    const targetKey = `${CHAT_KEY}_${concursoId}_${scope}_${canalId}`;
    const entries: Record<string, string> = {
      [targetKey]: serialized,
    };

    cloudSync.setItemLocalOnly(targetKey, mantidas);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('certam_chat_updated', {
          detail: { concursoId, cargoId: scope, canalId, msgs: mantidas },
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
    const { mantidas } = aplicarPoliticaRetencaoMensagens(normalizedMsgs);
    const scope = cargoId || 'geral';
    const targetKey = `${CHAT_KEY}_${concursoId}_${scope}_${canalId}`;

    cloudSync.setItem(targetKey, mantidas, forceReplace);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('certam_chat_updated', {
          detail: { concursoId, cargoId: scope, canalId, msgs: mantidas },
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
    const scope = cargoId || 'geral';
    const msgsAtuais = this.getMensagens(concursoId, scope, canalId);
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

    const targetKey = `${CHAT_KEY}_${concursoId}_${scope}_${canalId}`;
    const serialized = JSON.stringify(msgsParaServidor);
    const entries: Record<string, string> = {
      [targetKey]: serialized,
    };

    const ackResult = await chatRealtimeClient.sendEntriesWithAck(msgId, entries);

    const msgsPosAck = this.getMensagens(concursoId, scope, canalId);
    const item = msgsPosAck.find((m) => m.id === msgId);
    if (!item) return ackResult.ok;

    if (ackResult.ok) {
      item.status_envio = 'entregue';
      item.ack_at = ackResult.serverTimestamp || Date.now();
      item.erro_envio = undefined;
      item.updated_at = Date.now();
      this.salvarMensagensLocalmente(concursoId, scope, canalId, msgsPosAck);
      return true;
    } else {
      item.status_envio = 'erro';
      item.erro_envio =
        ackResult.error ||
        'Não foi possível confirmar o recebimento pelo servidor. Clique para reenviar.';
      item.updated_at = Date.now();
      this.salvarMensagensLocalmente(concursoId, scope, canalId, msgsPosAck);
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
    const maxExistingTs = msgs.reduce(
      (acc, item, idx) => Math.max(acc, extrairTimestampOrdenacao(item, idx)),
      0
    );
    const nowMs = Math.max(Date.now(), lastChatCreatedAt + 1, maxExistingTs + 1);
    lastChatCreatedAt = nowMs;
    const now = new Date(nowMs);
    const dataHoraStr = `Hoje às ${now.getHours().toString().padStart(2, '0')}:${now
      .getMinutes()
      .toString()
      .padStart(2, '0')}`;

    let nova: ChatMensagem;

    if (typeof autorOrDados === 'string') {
      const cores = ['#0D5C75', '#0F766E', '#1D4ED8', '#6366F1', '#475569'];
      const avatarCor = cores[Math.floor(Math.random() * cores.length)];
      const resolvedEmail = email || obterIdentificadorUsuarioChat();
      const resolvedSenderId = obterIdentificadorUsuarioChat(resolvedEmail);

      nova = {
        id: `msg-${nowMs.toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
        sender_id: resolvedSenderId,
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
      const resolvedSenderId =
        autorOrDados.sender_id ||
        obterIdentificadorUsuarioChat(autorOrDados.email);

      nova = {
        ...autorOrDados,
        id: `msg-${nowMs.toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
        sender_id: resolvedSenderId,
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

    selfSentMessageIds.add(nova.id);
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

      if (nextState) {
        muted[concursoId] = true;
        muted[`${concursoId}_all`] = true;
      } else {
        delete muted[concursoId];
        delete muted[`${concursoId}_all`];
        Object.keys(muted).forEach((k) => {
          if (k.startsWith(`${concursoId}_`)) {
            delete muted[k];
          }
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
