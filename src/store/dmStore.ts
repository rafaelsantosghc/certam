import { MensagemPrivada, BloqueioUsuario, HistoricoEdicaoMensagem, Usuario } from '../types';
import { podeEditarMensagemChat } from './chatStore';
import { cloudSync } from './cloudSync';
import { chatRealtimeClient } from './chatRealtimeClient';
import { userRegistryStore } from './userRegistryStore';
import { certamStore } from './certamStore';
import { lotesStore } from './lotesStore';

const DM_STORAGE_KEY = 'certam_dm_messages_v5';
const BLOCK_STORAGE_KEY = 'certam_blocked_users_v5';

const DEFAULT_DMS: MensagemPrivada[] = [];

export interface ContatoConversa {
  email: string;
  nome: string;
  ultimaMensagem: string;
  dataHora: string;
  naoLidas: number;
  ultimaMsgId?: string;
}

export interface SugestaoContatoDm {
  email: string;
  nome: string;
  detalhe?: string;
}

const DM_MAX_MESSAGES_PER_CONVERSATION = 100;
const DM_RETENTION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias
let lastDmCreatedAt = 0;

function extrairTimestampDm(m: MensagemPrivada, fallbackIdx = -1): number {
  if (typeof m.created_at === 'number' && m.created_at > 0) {
    return m.created_at;
  }
  const match = String(m.id || '').match(/^dm-([a-z0-9]+)-/i);
  if (match && match[1]) {
    const parsed = parseInt(match[1], 36);
    if (!Number.isNaN(parsed) && parsed > 1000000000000) return parsed;
  }
  return fallbackIdx;
}

function ordenarMensagensDmCronologicamente(list: MensagemPrivada[]): MensagemPrivada[] {
  if (!Array.isArray(list) || list.length <= 1) return list || [];
  const dedupMap = new Map<string, { msg: MensagemPrivada; idx: number }>();
  list.forEach((m, idx) => {
    if (!m || !m.id) return;
    const prev = dedupMap.get(m.id);
    if (!prev) {
      dedupMap.set(m.id, { msg: m, idx });
    } else {
      dedupMap.set(m.id, {
        msg: {
          ...prev.msg,
          ...m,
          lida: Boolean(prev.msg.lida || m.lida),
          created_at: prev.msg.created_at || m.created_at,
        },
        idx: prev.idx,
      });
    }
  });

  return Array.from(dedupMap.values())
    .map((entry) => ({
      msg: entry.msg,
      ts: extrairTimestampDm(entry.msg, entry.idx),
      idx: entry.idx,
    }))
    .sort((a, b) => (a.ts !== b.ts ? a.ts - b.ts : a.idx - b.idx))
    .map((entry) => entry.msg);
}

function aplicarRetencaoDm(
  list: MensagemPrivada[],
  maxPerPair: number = DM_MAX_MESSAGES_PER_CONVERSATION,
  maxAgeMs: number = DM_RETENTION_MAX_AGE_MS
): { mantidas: MensagemPrivada[]; removidas: number } {
  if (!Array.isArray(list) || list.length === 0) {
    return { mantidas: [], removidas: 0 };
  }
  const ordenadas = ordenarMensagensDmCronologicamente(list);
  const now = Date.now();
  const porPar = new Map<string, MensagemPrivada[]>();

  for (const m of ordenadas) {
    if (!m || !m.remetente_email || !m.destinatario_email) continue;
    const ts = extrairTimestampDm(m, -1);
    if (ts > 1000000000000 && now - ts > maxAgeMs) {
      continue;
    }
    const parKey = [
      m.remetente_email.trim().toLowerCase(),
      m.destinatario_email.trim().toLowerCase(),
    ]
      .sort()
      .join('__');
    const arr = porPar.get(parKey) || [];
    arr.push(m);
    porPar.set(parKey, arr);
  }

  const idsMantidos = new Set<string>();
  for (const arr of porPar.values()) {
    const recortado = arr.length > maxPerPair ? arr.slice(arr.length - maxPerPair) : arr;
    recortado.forEach((item) => idsMantidos.add(item.id));
  }

  const mantidas = ordenadas.filter((m) => m && idsMantidos.has(m.id));
  return {
    mantidas,
    removidas: Math.max(0, list.length - mantidas.length),
  };
}

export const dmStore = {
  getMensagens(): MensagemPrivada[] {
    try {
      const stored = cloudSync.getItem(DM_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          const { mantidas, removidas } = aplicarRetencaoDm(parsed);
          if (removidas > 0) {
            cloudSync.setItemLocalOnly(DM_STORAGE_KEY, mantidas);
          }
          return mantidas;
        }
      }
    } catch {
      // ignore
    }
    return DEFAULT_DMS;
  },

  purgarMensagensAntigas(
    maxPerPair: number = DM_MAX_MESSAGES_PER_CONVERSATION,
    maxAgeMs: number = DM_RETENTION_MAX_AGE_MS
  ): number {
    try {
      const stored = cloudSync.getItem(DM_STORAGE_KEY);
      if (!stored) return 0;
      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed)) return 0;
      const { mantidas, removidas } = aplicarRetencaoDm(parsed, maxPerPair, maxAgeMs);
      if (removidas > 0) {
        this.salvarMensagens(mantidas);
      }
      return removidas;
    } catch {
      return 0;
    }
  },

  salvarMensagens(list: MensagemPrivada[]) {
    const { mantidas } = aplicarRetencaoDm(list);
    cloudSync.setItem(DM_STORAGE_KEY, mantidas, false);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('certam_dm_updated', { detail: mantidas }));
    }
  },

  enviarMensagem(msg: Omit<MensagemPrivada, 'id' | 'data_hora' | 'lida'>): MensagemPrivada {
    chatRealtimeClient.init();
    const list = [...this.getMensagens()];
    const maxExistingTs = list.reduce((acc, item, idx) => Math.max(acc, extrairTimestampDm(item, idx)), 0);
    const monotonicNow = Math.max(Date.now(), lastDmCreatedAt + 1, maxExistingTs + 1);
    lastDmCreatedAt = monotonicNow;

    const nova: MensagemPrivada = {
      ...msg,
      id: `dm-${monotonicNow.toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      data_hora:
        'Hoje às ' +
        new Date(monotonicNow).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      lida: false,
      created_at: monotonicNow,
      updated_at: monotonicNow,
    };
    list.push(nova);
    const ordenadas = ordenarMensagensDmCronologicamente(list);
    this.salvarMensagens(ordenadas);

    // Envia também via canal em tempo real (WebSocket / ACK) para entrega imediata ao destinatário
    void chatRealtimeClient.sendEntriesWithAck(nova.id, {
      [DM_STORAGE_KEY]: JSON.stringify(ordenadas),
    });

    return nova;
  },

  /**
   * Obtém o ID da mensagem mais antiga ainda não lida enviada pelo outro usuário para mim,
   * antes de marcar a conversa como lida.
   */
  getPrimeiraMensagemNaoLidaId(meuEmail: string, outroEmail: string): string | null {
    if (!meuEmail || !outroEmail) return null;
    const eu = meuEmail.trim().toLowerCase();
    const outro = outroEmail.trim().toLowerCase();
    const msgs = this.getMensagensEntre(eu, outro);
    const primeiraNaoLida = msgs.find(
      (m) => m.remetente_email.trim().toLowerCase() === outro && !m.lida
    );
    return primeiraNaoLida ? primeiraNaoLida.id : null;
  },

  marcarComoLidas(usuario1Email: string, usuario2Email: string) {
    if (!usuario1Email || !usuario2Email) return;
    const list = this.getMensagens();
    let alterou = false;
    const u1 = usuario1Email.trim().toLowerCase();
    const u2 = usuario2Email.trim().toLowerCase();

    list.forEach((m) => {
      // Marca como lidas as mensagens enviadas por u2 para u1
      if (
        m.remetente_email.trim().toLowerCase() === u2 &&
        m.destinatario_email.trim().toLowerCase() === u1 &&
        !m.lida
      ) {
        m.lida = true;
        alterou = true;
      }
    });
    if (alterou) {
      this.salvarMensagens(list);
    }
  },

  getMensagensEntre(usuario1: string, usuario2: string): MensagemPrivada[] {
    if (!usuario1 || !usuario2) return [];
    const list = this.getMensagens();
    const u1 = usuario1.trim().toLowerCase();
    const u2 = usuario2.trim().toLowerCase();
    return list.filter(
      (m) =>
        (m.remetente_email.trim().toLowerCase() === u1 &&
          m.destinatario_email.trim().toLowerCase() === u2) ||
        (m.remetente_email.trim().toLowerCase() === u2 &&
          m.destinatario_email.trim().toLowerCase() === u1)
    );
  },

  getConversa(usuario1: string, usuario2: string): MensagemPrivada[] {
    return this.getMensagensEntre(usuario1, usuario2);
  },

  getTotalNaoLidas(meuEmail: string): number {
    if (!meuEmail) return 0;
    const contatos = this.getContatosConversas(meuEmail);
    return contatos.reduce((acc, c) => acc + (c.naoLidas || 0), 0);
  },

  getContatosConversas(meuEmail: string): ContatoConversa[] {
    if (!meuEmail) return [];
    const list = this.getMensagens();
    const eu = meuEmail.trim().toLowerCase();
    const mapa = new Map<string, ContatoConversa>();

    list.forEach((m) => {
      const isRemetente = m.remetente_email.trim().toLowerCase() === eu;
      const isDestinatario = m.destinatario_email.trim().toLowerCase() === eu;
      if (!isRemetente && !isDestinatario) return;

      const outroEmail = isRemetente ? m.destinatario_email : m.remetente_email;
      const outroNome = isRemetente ? m.destinatario_nome : m.remetente_nome;
      const key = outroEmail.trim().toLowerCase();

      const existing = mapa.get(key);
      const naoLidas = existing ? existing.naoLidas : 0;
      const novoNaoLidas = isDestinatario && !m.lida ? naoLidas + 1 : naoLidas;

      mapa.set(key, {
        email: outroEmail,
        nome: outroNome || outroEmail,
        ultimaMensagem: m.texto,
        dataHora: m.data_hora,
        naoLidas: novoNaoLidas,
        ultimaMsgId: m.id,
      });
    });

    return Array.from(mapa.values());
  },

  getContatos(meuEmail: string) {
    return this.getContatosConversas(meuEmail);
  },

  /**
   * Retorna sugestões de usuários e candidatos cadastrados no portal para iniciar uma nova conversa privada.
   */
  getSugestoesContatos(meuEmail: string, termoBusca: string = ''): SugestaoContatoDm[] {
    const eu = (meuEmail || '').trim().toLowerCase();
    const busca = termoBusca.trim().toLowerCase();
    const map = new Map<string, SugestaoContatoDm>();

    try {
      const users = userRegistryStore.getAllUsers();
      users.forEach((u) => {
        const em = String(u.email || u.email_contato || '').trim().toLowerCase();
        if (!em || em === eu || em === 'candidato@certam.com.br' || em.endsWith('@portalcertam.com.br')) {
          return;
        }
        map.set(em, {
          email: em,
          nome: u.nome || em,
          detalhe: u.is_admin ? 'Administrador' : u.orgao || 'Candidato Registrado',
        });
      });
    } catch {
      // ignore
    }

    try {
      const concursos = certamStore.getConcursos();
      concursos.forEach((c) => {
        (c.cargos || []).forEach((cg) => {
          const cands = lotesStore.getCandidatos(c.id, cg.id);
          cands.forEach((cand) => {
            const em = String(cand.email || '').trim().toLowerCase();
            if (!em || em === eu || em === 'candidato@certam.com.br' || em.endsWith('@portalcertam.com.br')) {
              return;
            }
            if (!map.has(em)) {
              map.set(em, {
                email: em,
                nome: cand.nome || em,
                detalhe: `${c.orgao} • ${cand.posicao}º (${cg.nome})`,
              });
            }
          });
        });
      });
    } catch {
      // ignore
    }

    const todos = Array.from(map.values());
    if (!busca) return todos.slice(0, 15);
    return todos
      .filter(
        (item) =>
          item.nome.toLowerCase().includes(busca) ||
          item.email.toLowerCase().includes(busca) ||
          (item.detalhe && item.detalhe.toLowerCase().includes(busca))
      )
      .slice(0, 15);
  },

  getBlockedUsers(): BloqueioUsuario[] {
    try {
      const stored = localStorage.getItem(BLOCK_STORAGE_KEY);
      if (stored) return JSON.parse(stored);
    } catch {
      // ignore
    }
    return [];
  },

  isUsuarioBloqueado(usuarioEmail: string, outroUsuarioEmail: string): boolean {
    if (!usuarioEmail || !outroUsuarioEmail) return false;
    const blocks = this.getBlockedUsers();
    const u1 = usuarioEmail.trim().toLowerCase();
    const u2 = outroUsuarioEmail.trim().toLowerCase();
    return blocks.some(
      (b) =>
        (b.usuario_email.trim().toLowerCase() === u1 &&
          b.usuario_bloqueado_email.trim().toLowerCase() === u2) ||
        (b.usuario_email.trim().toLowerCase() === u2 &&
          b.usuario_bloqueado_email.trim().toLowerCase() === u1)
    );
  },

  isBlocked(usuarioEmail: string, bloqueadorEmail: string): boolean {
    return this.isUsuarioBloqueado(usuarioEmail, bloqueadorEmail);
  },

  bloquearUsuario(meuEmail: string, bloqueadoEmail: string) {
    const blocks = this.getBlockedUsers();
    const u1 = meuEmail.trim().toLowerCase();
    const u2 = bloqueadoEmail.trim().toLowerCase();

    if (
      !blocks.some(
        (b) =>
          b.usuario_email.trim().toLowerCase() === u1 &&
          b.usuario_bloqueado_email.trim().toLowerCase() === u2
      )
    ) {
      blocks.push({
        usuario_email: meuEmail,
        usuario_bloqueado_email: bloqueadoEmail,
        data_bloqueio: new Date().toISOString(),
      });
      localStorage.setItem(BLOCK_STORAGE_KEY, JSON.stringify(blocks));
      window.dispatchEvent(new CustomEvent('certam_blocked_updated'));
    }
  },

  desbloquearUsuario(meuEmail: string, bloqueadoEmail: string) {
    const u1 = meuEmail.trim().toLowerCase();
    const u2 = bloqueadoEmail.trim().toLowerCase();
    const blocks = this.getBlockedUsers().filter(
      (b) =>
        !(
          b.usuario_email.trim().toLowerCase() === u1 &&
          b.usuario_bloqueado_email.trim().toLowerCase() === u2
        )
    );
    localStorage.setItem(BLOCK_STORAGE_KEY, JSON.stringify(blocks));
    window.dispatchEvent(new CustomEvent('certam_blocked_updated'));
  },

  removerMensagem(msgId: string) {
    const list = this.getMensagens().filter((m) => m.id !== msgId);
    this.salvarMensagens(list);
  },

  editarMensagem(
    msgId: string,
    novoTexto: string,
    usuario: Usuario
  ): { sucesso: boolean; erro?: string; msg?: MensagemPrivada } {
    const list = this.getMensagens();
    const m = list.find((msg) => msg.id === msgId);
    if (!m) return { sucesso: false, erro: 'Mensagem não encontrada.' };

    const isAdmin = Boolean(usuario.is_admin);
    const checagem = podeEditarMensagemChat(
      {
        id: m.id,
        created_at: m.created_at,
        data_hora: m.data_hora,
        email: m.remetente_email,
        autor: m.remetente_nome,
      },
      usuario,
      isAdmin
    );
    if (!checagem.pode) {
      return { sucesso: false, erro: checagem.motivo };
    }

    const textoLimpo = (novoTexto || '').trim();
    if (!textoLimpo) {
      return { sucesso: false, erro: 'O texto da mensagem não pode ficar vazio.' };
    }

    if (m.texto === textoLimpo) {
      return { sucesso: true, msg: m };
    }

    const historicoItem: HistoricoEdicaoMensagem = {
      texto_anterior: m.texto,
      editado_em: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      editado_por_nome: usuario.nome || 'Usuário',
      editado_por_email: usuario.email,
      is_admin: isAdmin,
    };

    m.historico_edicoes = m.historico_edicoes || [];
    m.historico_edicoes.push(historicoItem);
    m.texto = textoLimpo;
    m.editado = true;
    m.editado_em = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    m.updated_at = Date.now();

    this.salvarMensagens(list);
    return { sucesso: true, msg: m };
  },
};
