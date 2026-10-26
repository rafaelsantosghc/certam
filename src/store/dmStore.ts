import { MensagemPrivada, BloqueioUsuario } from '../types';

const DM_STORAGE_KEY = 'certam_dm_messages_v3';
const BLOCK_STORAGE_KEY = 'certam_blocked_users_v3';

const DEFAULT_DMS: MensagemPrivada[] = [
  {
    id: 'dm-1',
    remetente_email: 'mariana.becker@gmail.com',
    remetente_nome: 'Mariana Duarte Becker',
    destinatario_email: 'rafasms0@hotmail.com',
    destinatario_nome: 'Rafael Santos da Silva',
    concurso_referencia_id: 'tjrs_2024',
    cargo_referencia_id: 'analista_judiciario',
    texto: 'Olá Rafael! Tudo bem? Vi que você é o 1º colocado de Analista e colocou Porto Alegre. Você já tem lotação definida por ter FG/CC?',
    data_hora: 'Ontem às 18:20',
    lida: true,
  },
  {
    id: 'dm-2',
    remetente_email: 'rafasms0@hotmail.com',
    remetente_nome: 'Rafael Santos da Silva',
    destinatario_email: 'mariana.becker@gmail.com',
    destinatario_nome: 'Mariana Duarte Becker',
    concurso_referencia_id: 'tjrs_2024',
    cargo_referencia_id: 'analista_judiciario',
    texto: 'Oi Mariana! Sim, permaneço na assessoria do 2º Grau em Porto Alegre, então a vaga de 1º Grau no Foro Central ficará livre para você!',
    data_hora: 'Ontem às 18:35',
    lida: true,
  },
];

export const dmStore = {
  getMensagens(): MensagemPrivada[] {
    try {
      const stored = localStorage.getItem(DM_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    this.salvarMensagens(DEFAULT_DMS);
    return DEFAULT_DMS;
  },

  salvarMensagens(list: MensagemPrivada[]) {
    try {
      localStorage.setItem(DM_STORAGE_KEY, JSON.stringify(list));
      window.dispatchEvent(new CustomEvent('certam_dm_updated', { detail: list }));
    } catch {
      // ignore
    }
  },

  enviarMensagem(msg: Omit<MensagemPrivada, 'id' | 'data_hora' | 'lida'>): MensagemPrivada {
    const list = this.getMensagens();
    const nova: MensagemPrivada = {
      ...msg,
      id: `dm-${Date.now().toString(36)}`,
      data_hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      lida: false,
    };
    list.push(nova);
    this.salvarMensagens(list);
    return nova;
  },

  getMensagensEntre(emailA: string, emailB: string): MensagemPrivada[] {
    const list = this.getMensagens();
    const eA = emailA.toLowerCase();
    const eB = emailB.toLowerCase();
    return list.filter(
      (m) =>
        (m.remetente_email.toLowerCase() === eA && m.destinatario_email.toLowerCase() === eB) ||
        (m.remetente_email.toLowerCase() === eB && m.destinatario_email.toLowerCase() === eA)
    );
  },

  marcarComoLidas(meuEmail: string, outroEmail: string) {
    const list = this.getMensagens();
    const eMeu = meuEmail.toLowerCase();
    const eOutro = outroEmail.toLowerCase();
    let modificado = false;

    list.forEach((m) => {
      if (
        m.destinatario_email.toLowerCase() === eMeu &&
        m.remetente_email.toLowerCase() === eOutro &&
        !m.lida
      ) {
        m.lida = true;
        modificado = true;
      }
    });

    if (modificado) {
      this.salvarMensagens(list);
    }
  },

  getContatosConversas(meuEmail: string): { email: string; nome: string; ultimaMensagem: string; dataHora: string; naoLidas: number }[] {
    const list = this.getMensagens();
    const eMeu = meuEmail.toLowerCase();
    const mapa = new Map<string, { email: string; nome: string; ultimaMensagem: string; dataHora: string; naoLidas: number }>();

    list.forEach((m) => {
      const souRemetente = m.remetente_email.toLowerCase() === eMeu;
      const souDestinatario = m.destinatario_email.toLowerCase() === eMeu;

      if (!souRemetente && !souDestinatario) return;

      const outroEmail = souRemetente ? m.destinatario_email : m.remetente_email;
      const outroNome = souRemetente ? m.destinatario_nome : m.remetente_nome;
      const eOutroLow = outroEmail.toLowerCase();

      const atual = mapa.get(eOutroLow) || {
        email: outroEmail,
        nome: outroNome,
        ultimaMensagem: m.texto,
        dataHora: m.data_hora,
        naoLidas: 0,
      };

      atual.ultimaMensagem = m.texto;
      atual.dataHora = m.data_hora;
      if (souDestinatario && !m.lida) {
        atual.naoLidas += 1;
      }

      mapa.set(eOutroLow, atual);
    });

    return Array.from(mapa.values());
  },

  // -------------------------------------------------------------
  // BLOQUEIOS
  // -------------------------------------------------------------
  getBlockedUsers(): BloqueioUsuario[] {
    try {
      const s = localStorage.getItem(BLOCK_STORAGE_KEY);
      if (s) {
        const p = JSON.parse(s);
        if (Array.isArray(p)) return p;
      }
    } catch {
      // ignore
    }
    return [];
  },

  salvarBlockedUsers(list: BloqueioUsuario[]) {
    try {
      localStorage.setItem(BLOCK_STORAGE_KEY, JSON.stringify(list));
      window.dispatchEvent(new CustomEvent('certam_blocked_updated', { detail: list }));
    } catch {
      // ignore
    }
  },

  bloquearUsuario(meuEmail: string, emailBloquear: string) {
    const list = this.getBlockedUsers();
    const jaExiste = list.some(
      (b) => b.usuario_email.toLowerCase() === meuEmail.toLowerCase() && b.usuario_bloqueado_email.toLowerCase() === emailBloquear.toLowerCase()
    );
    if (!jaExiste) {
      list.push({
        usuario_email: meuEmail,
        usuario_bloqueado_email: emailBloquear,
        data_bloqueio: new Date().toLocaleString('pt-BR'),
      });
      this.salvarBlockedUsers(list);
    }
  },

  desbloquearUsuario(meuEmail: string, emailDesbloquear: string) {
    const list = this.getBlockedUsers().filter(
      (b) => !(b.usuario_email.toLowerCase() === meuEmail.toLowerCase() && b.usuario_bloqueado_email.toLowerCase() === emailDesbloquear.toLowerCase())
    );
    this.salvarBlockedUsers(list);
  },

  isUsuarioBloqueado(meuEmail: string, outroEmail: string): boolean {
    const list = this.getBlockedUsers();
    return list.some(
      (b) =>
        (b.usuario_email.toLowerCase() === meuEmail.toLowerCase() && b.usuario_bloqueado_email.toLowerCase() === outroEmail.toLowerCase()) ||
        (b.usuario_email.toLowerCase() === outroEmail.toLowerCase() && b.usuario_bloqueado_email.toLowerCase() === meuEmail.toLowerCase())
    );
  },
};
