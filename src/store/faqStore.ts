import { FaqItem } from '../types';

const FAQ_STORAGE_KEY = 'certam_faq_items';

const INITIAL_FAQS: FaqItem[] = [
  {
    id: 'faq-1',
    concurso_id: 'tjrs_2024',
    categoria: 'Remuneração e Benefícios',
    pergunta: 'Qual é a remuneração inicial e quais benefícios são pagos aos servidores?',
    resposta: 'Para o cargo de Analista Judiciário (nível superior), o vencimento básico inicial gira em torno de R$ 7.794,14 a R$ 9.150,00, acrescido de auxílio-alimentação (aprox. R$ 1.500,00), auxílio-saúde (reembolso escalonado) e auxílio-transporte. Para Técnico Judiciário, o vencimento inicial é de aprox. R$ 4.300,00 mais benefícios. Servidores com pós-graduação, mestrado ou doutorado contam com adicional de qualificação (AQ de 5% a 12,5%).',
    destaque: true,
    data_atualizacao: '2024-10-15',
    tags: ['salário', 'benefícios', 'alimentação', 'saúde', 'qualificação'],
  },
  {
    id: 'faq-2',
    concurso_id: 'tjrs_2024',
    categoria: 'Escolha de Lotação',
    pergunta: 'Como funciona a dinâmica da audiência pública de escolha de comarcas?',
    resposta: 'A convocação é realizada em blocos de lotes pelo Diário da Justiça Eletrônico (DJE). No dia da audiência presencial ou sessão telepresencial, os candidatos são chamados estritamente pela ordem de classificação final. O 1º colocado tem prioridade absoluta para escolher qualquer uma das vagas disponíveis no lote; o 2º colocado escolhe entre as remanescentes, e assim sucessivamente. Por isso, manter a lista ordenada no CERTAM permite prever com exatidão a sua alocação antes mesmo de entrar na sala.',
    destaque: true,
    data_atualizacao: '2024-10-10',
    tags: ['audiência', 'lotação', 'ordem', 'comarcas', 'classificação'],
  },
  {
    id: 'faq-3',
    concurso_id: 'tjrs_2024',
    categoria: 'Escolha de Lotação',
    pergunta: 'O que acontece se eu pedir "Fim de Fila"?',
    resposta: 'O pedido de reposicionamento para o final da fila de classificação é um direito garantido pelo estatuto dos servidores e edital. Caso você não tenha interesse nas comarcas ofertadas no lote atual, você pode protocolar o pedido formal de final de fila antes da escolha. Você irá para a última posição da lista de aprovados do certame, podendo ser convocado novamente caso o tribunal esgote a lista e ainda haja validade do concurso.',
    destaque: false,
    data_atualizacao: '2024-09-28',
    tags: ['fim de fila', 'desistência', 'reconvocação', 'lotação'],
  },
  {
    id: 'faq-4',
    concurso_id: 'tjrs_2024',
    categoria: 'Posse e Documentos',
    pergunta: 'Quais os principais exames médicos e documentos exigidos para a posse?',
    resposta: 'A posse exige exame médico admissional pelo Departamento Médico Judiciário (DMJ), incluindo exames laboratoriais (hemograma, glicemia, creatinina, VDRL), avaliação psiquiátrica/psicológica, laudo oftalmológico e raio-X de tórax. Além disso, são exigidas certidões negativas criminais (Justiça Estadual, Federal e Eleitoral), quitação eleitoral, declaração de bens (ou autorização de acesso ao IRPF) e diploma reconhecido pelo MEC.',
    destaque: true,
    data_atualizacao: '2024-10-01',
    tags: ['documentos', 'exames médicos', 'DMJ', 'posse', 'laudos'],
  },
  {
    id: 'faq-5',
    concurso_id: 'tjrs_2024',
    categoria: 'Carreira e Teletrabalho',
    pergunta: 'Recém-empossados podem fazer teletrabalho (home office)?',
    resposta: 'Conforme a Resolução do TJRS e diretrizes do CNJ, durante o primeiro ano de estágio probatório a regra geral é o trabalho preferencialmente presencial para ambientação e treinamento na comarca/vara. Após esse período e atingidas as metas de produtividade da unidade judicial, o servidor pode solicitar adesão ao regime de teletrabalho parcial (híbrido) ou integral, mediante anuência do magistrado titular e da Corregedoria.',
    destaque: true,
    data_atualizacao: '2024-10-12',
    tags: ['teletrabalho', 'home office', 'estágio probatório', 'híbrido'],
  },
  {
    id: 'faq-6',
    concurso_id: 'tjrs_2024',
    categoria: 'Carreira e Teletrabalho',
    pergunta: 'Quanto tempo dura o estágio probatório e como funcionam as progressões?',
    resposta: 'O estágio probatório tem duração constitucional de 3 (três) anos de efetivo exercício, período no qual o servidor é avaliado semestralmente por sua chefia imediata quanto a assiduidade, disciplina, capacidade de iniciativa e produtividade. As progressões na carreira ocorrem por merecimento e antiguidade através dos padrões e classes do Plano de Carreiras do Tribunal de Justiça.',
    destaque: false,
    data_atualizacao: '2024-09-18',
    tags: ['estágio probatório', 'estabilidade', 'promoção', 'progressão'],
  },
  {
    id: 'faq-7',
    concurso_id: 'tjrs_2024',
    categoria: 'Recursos e Classificação',
    pergunta: 'Como funciona a convocação das cotas (PPP, PCD e Indígenas)?',
    resposta: 'As nomeações obedecem estritamente aos percentuais legais fixados em lei estadual e no edital (geralmente 20% para pessoas pretas e pardas e percentual destinado a PCDs). A cada ciclo de convocações, determinadas posições são reservadas prioritariamente para candidatos cotistas, conforme a alternância fixada nas tabelas do edital de abertura.',
    destaque: false,
    data_atualizacao: '2024-09-20',
    tags: ['cotas', 'PPP', 'PCD', 'alternância', 'classificação'],
  },
  {
    id: 'faq-8',
    concurso_id: '',
    categoria: 'Geral',
    pergunta: 'Os dados inseridos no simulador do CERTAM alteram o resultado oficial?',
    resposta: 'Não! O CERTAM é uma ferramenta colaborativa desenvolvida pela comunidade de concurseiros para proporcionar previsibilidade e transparência mútua antes das audiências oficiais. Nenhuma alteração feita aqui substitui os atos oficiais publicados no Diário da Justiça pelo órgão responsável.',
    destaque: false,
    data_atualizacao: '2024-10-01',
    tags: ['simulador', 'comunidade', 'oficial', 'segurança'],
  },
];

export const faqStore = {
  getFaqs(concursoId?: string, cargoId?: string): FaqItem[] {
    let items: FaqItem[] = [];
    try {
      const stored = localStorage.getItem(FAQ_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          items = parsed;
        }
      }
    } catch {
      // ignore
    }

    if (items.length === 0) {
      items = INITIAL_FAQS;
      this.salvarTodos(items);
    }

    if (!concursoId) return items;

    // Filtra pelo concurso ou globais (concurso_id vazio ou 'geral')
    return items.filter(
      (f) =>
        !f.concurso_id ||
        f.concurso_id === 'geral' ||
        f.concurso_id === concursoId ||
        (concursoId === 'tjrs' && f.concurso_id === 'tjrs_2024')
    );
  },

  salvarFaq(faq: FaqItem): void {
    const list = this.getFaqs();
    const index = list.findIndex((f) => f.id === faq.id);
    if (index >= 0) {
      list[index] = { ...list[index], ...faq, data_atualizacao: new Date().toISOString().split('T')[0] };
    } else {
      list.unshift({
        ...faq,
        id: faq.id || `faq-${Date.now()}`,
        data_atualizacao: new Date().toISOString().split('T')[0],
      });
    }
    this.salvarTodos(list);
  },

  excluirFaq(id: string): void {
    const list = this.getFaqs().filter((f) => f.id !== id);
    this.salvarTodos(list);
  },

  salvarTodos(items: FaqItem[]): void {
    try {
      localStorage.setItem(FAQ_STORAGE_KEY, JSON.stringify(items));
      window.dispatchEvent(new CustomEvent('certam_faq_updated', { detail: items }));
    } catch {
      // ignore
    }
  },
};
