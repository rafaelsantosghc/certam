import { MensagemPrivada, BloqueioUsuario } from '../types';
import { cloudSync } from './cloudSync';

const DM_STORAGE_KEY = 'certam_dm_messages_v5';
const BLOCK_STORAGE_KEY = 'certam_blocked_users_v5';

const DEFAULT_DMS: MensagemPrivada[] = [];

export interface ContatoConversa {
  email: string;
  nome: string;
  ultimaMensagem: string;
  dataHora: string;
  naoLidas: number;
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
    const list = this.getMensagens();
    const nova: MensagemPrivada = {
      ...msg,
      id: `dm-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      data_hora: 'Hoje às ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      lida: false,
    };
    list.push(nova);
    this.salvarMensagens(list);
    return nova;
  },

  marcarComoLidas(usuario1Email: string, usuario2Email: string) {
    const list = this.getMensagens();
    let alterou = false;
    const u1 = usuario1Email.toLowerCase();
    const u2 = usuario2Email.toLowerCase();

    list.forEach((m) => {
      // Se a mensagem foi enviada de u2 para u1 (ou entre eles) e não foi lida
      if (
        ((m.remetente_email.toLowerCase() === u2 && m.destinatario_email.toLowerCase() === u1) ||
         (m.remetente_email.toLowerCase() === u1 && m.destinatario_email.toLowerCase() === u2)) &&
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
    const list = this.getMensagens();
    const u1 = usuario1.toLowerCase();
    const u2 = usuario2.toLowerCase();
    return list.filter(
      (m) =>
        (m.remetente_email.toLowerCase() === u1 && m.destinatario_email.toLowerCase() === u2) ||
        (m.remetente_email.toLowerCase() === u2 && m.destinatario_email.toLowerCase() === u1)
    );
  },

  getConversa(usuario1: string, usuario2: string): MensagemPrivada[] {
    return this.getMensagensEntre(usuario1, usuario2);
  },

  getContatosConversas(meuEmail: string): ContatoConversa[] {
    const list = this.getMensagens();
    const eu = meuEmail.toLowerCase();
    const mapa = new Map<string, ContatoConversa>();

    list.forEach((m) => {
      const isRemetente = m.remetente_email.toLowerCase() === eu;
      const isDestinatario = m.destinatario_email.toLowerCase() === eu;
      if (!isRemetente && !isDestinatario) return;

      const outroEmail = isRemetente ? m.destinatario_email : m.remetente_email;
      const outroNome = isRemetente ? m.destinatario_nome : m.remetente_nome;
      const key = outroEmail.toLowerCase();

      const existing = mapa.get(key);
      const naoLidas = existing ? existing.naoLidas : 0;
      const novoNaoLidas = isDestinatario && !m.lida ? naoLidas + 1 : naoLidas;

      mapa.set(key, {
        email: outroEmail,
        nome: outroNome || outroEmail,
        ultimaMensagem: m.texto,
        dataHora: m.data_hora,
        naoLidas: novoNaoLidas,
      });
    });

    return Array.from(mapa.values());
  },

  getContatos(meuEmail: string) {
    return this.getContatosConversas(meuEmail);
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
    const blocks = this.getBlockedUsers();
    const u1 = usuarioEmail.toLowerCase();
    const u2 = outroUsuarioEmail.toLowerCase();
    return blocks.some(
      (b) =>
        (b.usuario_email.toLowerCase() === u1 && b.usuario_bloqueado_email.toLowerCase() === u2) ||
        (b.usuario_email.toLowerCase() === u2 && b.usuario_bloqueado_email.toLowerCase() === u1)
    );
  },

  isBlocked(usuarioEmail: string, bloqueadorEmail: string): boolean {
    return this.isUsuarioBloqueado(usuarioEmail, bloqueadorEmail);
  },

  bloquearUsuario(meuEmail: string, bloqueadoEmail: string) {
    const blocks = this.getBlockedUsers();
    const u1 = meuEmail.toLowerCase();
    const u2 = bloqueadoEmail.toLowerCase();

    if (!blocks.some((b) => b.usuario_email.toLowerCase() === u1 && b.usuario_bloqueado_email.toLowerCase() === u2)) {
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
    const u1 = meuEmail.toLowerCase();
    const u2 = bloqueadoEmail.toLowerCase();
    const blocks = this.getBlockedUsers().filter(
      (b) =>
        !(
          b.usuario_email.toLowerCase() === u1 &&
          b.usuario_bloqueado_email.toLowerCase() === u2
        )
    );
    localStorage.setItem(BLOCK_STORAGE_KEY, JSON.stringify(blocks));
    window.dispatchEvent(new CustomEvent('certam_blocked_updated'));
  },
};
