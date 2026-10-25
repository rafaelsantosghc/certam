import { ChatMensagem, CanalChatId } from '../types';

const CHAT_KEY = 'certam_chat_messages';

const INITIAL_MESSAGES: Record<string, ChatMensagem[]> = {
  'tjrs_2024_analista_judiciario_geral': [
    {
      id: 'msg-pin-1',
      concurso_id: 'tjrs_2024',
      cargo_id: 'analista_judiciario',
      canal_id: 'geral',
      autor: 'Coordenação CERTAM',
      email: 'admin@certam.com.br',
      avatar_cor: '#135A7A',
      texto: '📌 AVISO OFICIAL: A audiência do 1º Lote está prevista para o final deste mês. Mantenham sua lista de comarcas atualizada no simulador para termos o mapa de alocação 100% calibrado!',
      data_hora: 'Ontem às 10:00',
      is_admin: true,
      is_fixado: true,
      curtidas: 18,
    },
    {
      id: 'msg-1',
      concurso_id: 'tjrs_2024',
      cargo_id: 'analista_judiciario',
      canal_id: 'geral',
      autor: 'Rafael Santos',
      email: 'rafasms0@hotmail.com',
      avatar_cor: '#135A7A',
      texto: 'Olá colegas aprovados! Criei este espaço para alinharmos as preferências de comarca de forma transparente e em comunidade.',
      data_hora: 'Ontem às 14:32',
      is_admin: true,
      posicao_candidato: 1,
      comarca_preferida: 'Porto Alegre',
      curtidas: 12,
    },
    {
      id: 'msg-2',
      concurso_id: 'tjrs_2024',
      cargo_id: 'analista_judiciario',
      canal_id: 'geral',
      autor: 'Mariana Becker',
      email: 'mariana.becker@gmail.com',
      avatar_cor: '#1D8A8A',
      texto: 'Excelente iniciativa! Minha prioridade máxima é Porto Alegre ou Canoas. Já cadastrei minha lista de preferências.',
      data_hora: 'Ontem às 15:10',
      posicao_candidato: 2,
      comarca_preferida: 'Canoas',
      curtidas: 6,
    },
    {
      id: 'msg-3',
      concurso_id: 'tjrs_2024',
      cargo_id: 'analista_judiciario',
      canal_id: 'geral',
      autor: 'Carlos Meneghetti',
      email: 'carlos.meneghetti@adv.oabr.org.br',
      avatar_cor: '#07192B',
      texto: 'Vou focar na Serra Gaúcha (Caxias ou Bento). Isso já libera vaga na capital para os próximos colocados!',
      data_hora: 'Hoje às 09:15',
      posicao_candidato: 3,
      comarca_preferida: 'Caxias do Sul',
      curtidas: 8,
    },
  ],
  'tjrs_2024_analista_judiciario_lotacao': [
    {
      id: 'msg-lot-1',
      concurso_id: 'tjrs_2024',
      cargo_id: 'analista_judiciario',
      canal_id: 'lotacao',
      autor: 'Luciana Martins',
      email: 'luciana.m@gmail.com',
      avatar_cor: '#0E7490',
      texto: 'Alguém com informações sobre a Vara de Família de Novo Hamburgo? Sabem se o clima de trabalho e a equipe são bons?',
      data_hora: 'Hoje às 11:20',
      posicao_candidato: 8,
      comarca_preferida: 'Novo Hamburgo',
      curtidas: 4,
    },
    {
      id: 'msg-lot-2',
      concurso_id: 'tjrs_2024',
      cargo_id: 'analista_judiciario',
      canal_id: 'lotacao',
      autor: 'Rodrigo Alves',
      email: 'rodrigo.alves@tjrs.jus.br',
      avatar_cor: '#135A7A',
      texto: 'Sim! Novo Hamburgo tem excelente infraestrutura e fórum recém-reformado. Fica bem próximo da estação do Trensurb.',
      data_hora: 'Hoje às 11:45',
      is_admin: false,
      curtidas: 5,
    },
  ],
  'tjrs_2024_analista_judiciario_posse': [
    {
      id: 'msg-pos-1',
      concurso_id: 'tjrs_2024',
      cargo_id: 'analista_judiciario',
      canal_id: 'posse',
      autor: 'Coordenação CERTAM',
      email: 'admin@certam.com.br',
      avatar_cor: '#135A7A',
      texto: '📌 Dica de Posse: Não deixem a emissão das certidões negativas criminais para a última semana. Algumas demoram até 5 dias úteis se houver homônimo!',
      data_hora: 'Hoje às 08:30',
      is_admin: true,
      is_fixado: true,
      curtidas: 14,
    },
    {
      id: 'msg-pos-2',
      concurso_id: 'tjrs_2024',
      cargo_id: 'analista_judiciario',
      canal_id: 'posse',
      autor: 'Fernanda Lima',
      email: 'fernanda.lima@hotmail.com',
      avatar_cor: '#1D8A8A',
      texto: 'O agendamento do DMJ para o exame de saúde já abriu ou precisamos esperar a publicação da nomeação no diário oficial?',
      data_hora: 'Hoje às 10:15',
      posicao_candidato: 14,
      curtidas: 3,
    },
  ],
  'tjrs_2024_analista_judiciario_recursos': [
    {
      id: 'msg-rec-1',
      concurso_id: 'tjrs_2024',
      cargo_id: 'analista_judiciario',
      canal_id: 'recursos',
      autor: 'Guilherme Silveira',
      email: 'guilherme.s@direito.adv.br',
      avatar_cor: '#07192B',
      texto: 'Lista homologada sem pendências de liminares ativas no tribunal. Caminho 100% livre para as primeiras convocações!',
      data_hora: 'Ontem às 18:00',
      curtidas: 11,
    },
  ],
};

export const chatStore = {
  getMensagens(concursoId: string, cargoId: string, canalId: CanalChatId = 'geral'): ChatMensagem[] {
    const key = `${CHAT_KEY}_${concursoId}_${cargoId}_${canalId}`;
    try {
      const s = localStorage.getItem(key);
      if (s) {
        const p = JSON.parse(s);
        if (Array.isArray(p)) return p;
      }
    } catch {
      // ignore
    }

    const initialKey = `${concursoId}_${cargoId}_${canalId}`;
    const fallbackKey = `${concursoId}_${cargoId}`;
    const initial = INITIAL_MESSAGES[initialKey] || (canalId === 'geral' ? INITIAL_MESSAGES[fallbackKey] || [] : []);
    this.salvarMensagens(concursoId, cargoId, canalId, initial);
    return initial;
  },

  enviarMensagem(
    concursoId: string,
    cargoId: string,
    canalId: CanalChatId,
    autor: string,
    email: string,
    texto: string,
    options?: {
      isAdmin?: boolean;
      isFixado?: boolean;
      posicao?: number;
      comarcaPreferida?: string;
    }
  ): ChatMensagem {
    const list = this.getMensagens(concursoId, cargoId, canalId);
    const cores = ['#07192B', '#135A7A', '#1D8A8A', '#0E7490', '#047857', '#334155'];
    const randomCor = cores[Math.floor(Math.random() * cores.length)];

    const nova: ChatMensagem = {
      id: `msg-${Date.now()}`,
      concurso_id: concursoId,
      cargo_id: cargoId,
      canal_id: canalId,
      autor,
      email,
      avatar_cor: options?.isAdmin ? '#135A7A' : randomCor,
      texto,
      data_hora: 'Agora',
      is_admin: options?.isAdmin,
      is_fixado: options?.isFixado ?? false,
      posicao_candidato: options?.posicao,
      comarca_preferida: options?.comarcaPreferida,
      curtidas: 0,
    };

    const atualizado = [...list, nova];
    this.salvarMensagens(concursoId, cargoId, canalId, atualizado);
    return nova;
  },

  alternarFixado(concursoId: string, cargoId: string, canalId: CanalChatId, mensagemId: string): void {
    const list = this.getMensagens(concursoId, cargoId, canalId);
    const atualizado = list.map((m) => {
      if (m.id === mensagemId) {
        return { ...m, is_fixado: !m.is_fixado };
      }
      return m;
    });
    this.salvarMensagens(concursoId, cargoId, canalId, atualizado);
  },

  curtirMensagem(concursoId: string, cargoId: string, canalId: CanalChatId, mensagemId: string): void {
    const list = this.getMensagens(concursoId, cargoId, canalId);
    const atualizado = list.map((m) => {
      if (m.id === mensagemId) {
        return { ...m, curtidas: (m.curtidas || 0) + 1 };
      }
      return m;
    });
    this.salvarMensagens(concursoId, cargoId, canalId, atualizado);
  },

  excluirMensagem(concursoId: string, cargoId: string, canalId: CanalChatId, mensagemId: string): void {
    const list = this.getMensagens(concursoId, cargoId, canalId);
    const atualizado = list.filter((m) => m.id !== mensagemId);
    this.salvarMensagens(concursoId, cargoId, canalId, atualizado);
  },

  salvarMensagens(concursoId: string, cargoId: string, canalId: CanalChatId, mensagens: ChatMensagem[]) {
    const key = `${CHAT_KEY}_${concursoId}_${cargoId}_${canalId}`;
    try {
      localStorage.setItem(key, JSON.stringify(mensagens));
      window.dispatchEvent(
        new CustomEvent('certam_chat_updated', {
          detail: { concursoId, cargoId, canalId, mensagens },
        })
      );
    } catch {
      // ignore
    }
  },
};
