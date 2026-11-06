import { MensagemPrivada, BloqueioUsuario } from '../types';
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

export const dmStore = {
  getMensagens(): MensagemPrivada[] {
    try {
      const stored = cloudSync.getItem(DM_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    return DEFAULT_DMS;
  },

  salvarMensagens(list: MensagemPrivada[]) {
    cloudSync.setItem(DM_STORAGE_KEY, list, false);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('certam_dm_updated', { detail: list }));
    }
  },

  enviarMensagem(msg: Omit<MensagemPrivada, 'id' | 'data_hora' | 'lida'>): MensagemPrivada {
    chatRealtimeClient.init();
    const list = [...this.getMensagens()];
    const nova: MensagemPrivada = {
      ...msg,
      id: `dm-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      data_hora:
        'Hoje às ' +
        new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      lida: false,
    };
    list.push(nova);
    this.salvarMensagens(list);

    // Envia também via canal em tempo real (WebSocket / ACK) para entrega imediata ao destinatário
    void chatRealtimeClient.sendEntriesWithAck(nova.id, {
      [DM_STORAGE_KEY]: JSON.stringify(list),
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
};
