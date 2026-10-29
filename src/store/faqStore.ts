import { FaqItem } from '../types';
import { cloudSync } from './cloudSync';

const FAQ_STORAGE_KEY = 'certam_faq_items_v6';

const INITIAL_FAQS: FaqItem[] = [
  {
    id: 'faq-geral-1',
    concurso_id: '',
    categoria: 'Geral',
    pergunta: 'Os dados e simulações do portal CERTAM alteram o resultado oficial do concurso?',
    resposta: 'Não. O CERTAM é uma plataforma independente de transparência e acompanhamento colaborativo. Os atos oficiais de homologação, chamamento e posse continuam sendo publicados exclusivamente pelos órgãos em seus respectivos Diários Oficiais.',
    destaque: true,
    data_atualizacao: new Date().toLocaleDateString('pt-BR'),
    tags: ['simulador', 'oficial', 'segurança'],
  },
];

export const faqStore = {
  getFaqs(concursoId?: string, cargoId?: string): FaqItem[] {
    let items: FaqItem[] = [];
    try {
      const stored = cloudSync.getItem(FAQ_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          items = parsed;
        }
      }
    } catch {
      // ignore
    }

    if (items.length === 0) {
      items = INITIAL_FAQS;
    }

    if (!concursoId) return items;

    // Filtra pelo concurso ou globais (concurso_id vazio ou 'geral')
    return items.filter((f) => {
      const matchConcurso = !f.concurso_id || f.concurso_id === 'geral' || f.concurso_id === concursoId;
      if (!matchConcurso) return false;
      if (cargoId && f.cargo_id && f.cargo_id !== cargoId) return false;
      return true;
    });
  },

  salvarTodos(faqs: FaqItem[]) {
    cloudSync.setItem(FAQ_STORAGE_KEY, faqs, true);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('certam_faqs_updated', { detail: faqs }));
    }
  },

  adicionarFaq(faq: Omit<FaqItem, 'id' | 'data_atualizacao'>): FaqItem {
    const list = this.getFaqs();
    const novo: FaqItem = {
      ...faq,
      id: `faq-${Date.now().toString(36)}`,
      data_atualizacao: new Date().toLocaleDateString('pt-BR'),
    };
    list.unshift(novo);
    this.salvarTodos(list);
    return novo;
  },

  atualizarFaq(faq: FaqItem): boolean {
    const list = this.getFaqs();
    const index = list.findIndex((f) => f.id === faq.id);
    if (index >= 0) {
      list[index] = {
        ...faq,
        data_atualizacao: new Date().toLocaleDateString('pt-BR'),
      };
      this.salvarTodos(list);
      return true;
    }
    return false;
  },

  removerFaq(id: string): boolean {
    const list = this.getFaqs();
    const filtrados = list.filter((f) => f.id !== id);
    this.salvarTodos(filtrados);
    return true;
  },
};
