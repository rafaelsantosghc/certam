import { ChatMensagem } from '../types';

const CHAT_KEY = 'certam_chat_messages';

const INITIAL_MESSAGES: Record<string, ChatMensagem[]> = {
  'tjrs_2024_analista_judiciario': [
    {
      id: 'msg-1',
      concurso_id: 'tjrs_2024',
      cargo_id: 'analista_judiciario',
      autor: 'Rafael Santos',
      email: 'rafasms0@hotmail.com',
      avatar_cor: '#135A7A',
      texto: 'Olá colegas aprovados! Criei este espaço para alinharmos as preferências de comarca de forma transparente.',
      data_hora: 'Ontem às 14:32',
      is_admin: true,
    },
    {
      id: 'msg-2',
      concurso_id: 'tjrs_2024',
      cargo_id: 'analista_judiciario',
      autor: 'Mariana Becker',
      email: 'mariana.becker@gmail.com',
      avatar_cor: '#1D8A8A',
      texto: 'Excelente iniciativa! Minha prioridade máxima é Porto Alegre ou Canoas. Já cadastrei minha lista de preferências.',
      data_hora: 'Ontem às 15:10',
    },
    {
      id: 'msg-3',
      concurso_id: 'tjrs_2024',
      cargo_id: 'analista_judiciario',
      autor: 'Carlos Meneghetti',
      email: 'carlos.meneghetti@adv.oabr.org.br',
      avatar_cor: '#07192B',
      texto: 'Vou focar na Serra Gaúcha (Caxias ou Bento). Isso já libera vaga na capital para os próximos colocados!',
      data_hora: 'Hoje às 09:15',
    },
  ],
};

export const chatStore = {
  getMensagens(concursoId: string, cargoId: string): ChatMensagem[] {
    const key = `${CHAT_KEY}_${concursoId}_${cargoId}`;
    try {
      const s = localStorage.getItem(key);
      if (s) {
        const p = JSON.parse(s);
        if (Array.isArray(p)) return p;
      }
    } catch {
      // ignore
    }
    const initial = INITIAL_MESSAGES[`${concursoId}_${cargoId}`] || [];
    this.salvarMensagens(concursoId, cargoId, initial);
    return initial;
  },

  enviarMensagem(
    concursoId: string,
    cargoId: string,
    autor: string,
    email: string,
    texto: string,
    isAdmin = false
  ): ChatMensagem {
    const list = this.getMensagens(concursoId, cargoId);
    const cores = ['#07192B', '#135A7A', '#1D8A8A', '#0E7490', '#047857'];
    const randomCor = cores[Math.floor(Math.random() * cores.length)];

    const nova: ChatMensagem = {
      id: `msg-${Date.now()}`,
      concurso_id: concursoId,
      cargo_id: cargoId,
      autor,
      email,
      avatar_cor: isAdmin ? '#135A7A' : randomCor,
      texto,
      data_hora: 'Agora',
      is_admin: isAdmin,
    };

    const atualizado = [...list, nova];
    this.salvarMensagens(concursoId, cargoId, atualizado);
    return nova;
  },

  salvarMensagens(concursoId: string, cargoId: string, mensagens: ChatMensagem[]) {
    const key = `${CHAT_KEY}_${concursoId}_${cargoId}`;
    try {
      localStorage.setItem(key, JSON.stringify(mensagens));
      window.dispatchEvent(new CustomEvent('certam_chat_updated', { detail: { concursoId, cargoId, mensagens } }));
    } catch {
      // ignore
    }
  },
};
