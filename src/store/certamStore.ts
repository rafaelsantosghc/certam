import { Concurso, Cargo, CronogramaItem, DocumentoItem, QuadroVagas, ComunicadoItem, ConvocacaoHistorico } from '../types';

const STORAGE_KEY = 'certam_concursos_cargos_v3';

export const DEFAULT_CONCURSOS: Concurso[] = [
  {
    id: 'tjrs_2024',
    nome: 'Tribunal de Justiça do Rio Grande do Sul (TJRS)',
    orgao: 'TJRS',
    ano: '2024',
    edital: 'Edital 01/2024',
    status: 'Homologado',
    homologado: true,
    data_homologacao: '18/10/2024',
    regiao: 'Sul',
    esfera: 'Estadual',
    estado: 'RS',
    descricao: 'Concurso Público para Provimento de Cargos de Servidores da Justiça Estadual de 1º e 2º Graus.',
    cargos: [
      {
        id: 'analista_judiciario',
        nome: 'Analista Judiciário - Área Judiciária',
        nivel: 'Superior',
        vagas_imediatas: 38,
        tem_cr: true,
        ativo: true,
        remuneracao_inicial: 'R$ 10.250,80',
        vagas_ocupadas: 1840,
        vagas_reais_abertas: 284,
      },
      {
        id: 'analista_administrativo',
        nome: 'Analista Judiciário - Área Administrativa',
        nivel: 'Superior',
        vagas_imediatas: 12,
        tem_cr: true,
        ativo: true,
        remuneracao_inicial: 'R$ 10.250,80',
        vagas_ocupadas: 610,
        vagas_reais_abertas: 96,
      },
      {
        id: 'tecnico_judiciario',
        nome: 'Técnico Judiciário - Área Administrativo-Judiciária',
        nivel: 'Médio',
        vagas_imediatas: 25,
        tem_cr: true,
        ativo: true,
        remuneracao_inicial: 'R$ 5.980,45',
        vagas_ocupadas: 3420,
        vagas_reais_abertas: 492,
      },
    ],
    cronograma: [
      {
        id: 'crono-1',
        concurso_id: 'tjrs_2024',
        titulo: 'Publicação do Edital de Abertura',
        data_prevista: '15/01/2024',
        data_realizada: '15/01/2024',
        status: 'concluido',
        link_edital: 'https://www.tjrs.jus.br/novo/concursos/',
        descricao: 'Publicação no Diário da Justiça Eletrônico do RS.',
      },
      {
        id: 'crono-2',
        concurso_id: 'tjrs_2024',
        titulo: 'Aplicação das Provas Objetivas e Discursivas',
        data_prevista: '19/05/2024',
        data_realizada: '19/05/2024',
        status: 'concluido',
        descricao: 'Realização dos exames em Porto Alegre, Caxias do Sul, Passo Fundo, Pelotas e Santa Maria.',
      },
      {
        id: 'crono-3',
        concurso_id: 'tjrs_2024',
        titulo: 'Divulgação do Resultado Preliminar',
        data_prevista: '10/08/2024',
        data_realizada: '10/08/2024',
        status: 'concluido',
        descricao: 'Notas das provas objetivas e pontuação da discursiva.',
      },
      {
        id: 'crono-4',
        concurso_id: 'tjrs_2024',
        titulo: 'Julgamento de Recursos e Resultado Final',
        data_prevista: '25/09/2024',
        data_realizada: '25/09/2024',
        status: 'concluido',
        descricao: 'Publicação da classificação definitiva homologada pela comissão.',
      },
      {
        id: 'crono-5',
        concurso_id: 'tjrs_2024',
        titulo: 'Homologação pelo Órgão Especial do TJRS',
        data_prevista: '18/10/2024',
        data_realizada: '18/10/2024',
        status: 'concluido',
        descricao: 'Homologação oficial assinada pela Presidência do TJRS. Início da vigência de 2 anos.',
      },
      {
        id: 'crono-6',
        concurso_id: 'tjrs_2024',
        titulo: '1º Chamamento Convocatório (Lote 1)',
        data_prevista: '12/12/2024',
        data_realizada: '12/12/2024',
        status: 'concluido',
        descricao: 'Convocação de 38 Analistas e 25 Técnicos para audiência pública de escolha de comarcas.',
      },
      {
        id: 'crono-7',
        concurso_id: 'tjrs_2024',
        titulo: 'Audiência Pública e Posse dos Convocados (Lote 1)',
        data_prevista: '15/02/2025',
        data_realizada: '15/02/2025',
        status: 'concluido',
        descricao: 'Alocação por ordem de classificação e ato de posse solene.',
      },
      {
        id: 'crono-8',
        concurso_id: 'tjrs_2024',
        titulo: '2º Chamamento Convocatório (Lote 2 - Previsto)',
        data_prevista: '10/04/2025',
        status: 'em_andamento',
        descricao: 'Previsão de convocação de mais 45 servidores para reposição de aposentadorias de 2024/2025.',
      },
      {
        id: 'crono-9',
        concurso_id: 'tjrs_2024',
        titulo: '3º Chamamento Convocatório (Lote 3)',
        data_prevista: '15/08/2025',
        status: 'pendente',
        descricao: 'Estimativa baseada na dotação orçamentária aprovada pela LOA 2025.',
      },
    ],
    quadro_vagas: [
      {
        concurso_id: 'tjrs_2024',
        cargo_id: 'analista_judiciario',
        cargo_nome: 'Analista Judiciário - Área Judiciária',
        cargos_criados_lei: 2124,
        vagas_ocupadas: 1840,
        vagas_reais_abertas: 284,
        aposentadorias_previstas: 72,
        data_atualizacao: '15/02/2025',
        fonte_oficial: 'Portal da Transparência do TJRS (Resolução 102 CNJ)',
      },
      {
        concurso_id: 'tjrs_2024',
        cargo_id: 'analista_administrativo',
        cargo_nome: 'Analista Judiciário - Área Administrativa',
        cargos_criados_lei: 706,
        vagas_ocupadas: 610,
        vagas_reais_abertas: 96,
        aposentadorias_previstas: 24,
        data_atualizacao: '15/02/2025',
        fonte_oficial: 'Portal da Transparência do TJRS (Resolução 102 CNJ)',
      },
      {
        concurso_id: 'tjrs_2024',
        cargo_id: 'tecnico_judiciario',
        cargo_nome: 'Técnico Judiciário - Área Administrativo-Judiciária',
        cargos_criados_lei: 3912,
        vagas_ocupadas: 3420,
        vagas_reais_abertas: 492,
        aposentadorias_previstas: 130,
        data_atualizacao: '15/02/2025',
        fonte_oficial: 'Portal da Transparência do TJRS (Resolução 102 CNJ)',
      },
    ],
    documentos: [
      {
        id: 'doc-1',
        concurso_id: 'tjrs_2024',
        titulo: 'Edital de Abertura Nº 01/2024 - Servidores TJRS',
        tipo: 'Edital de Abertura',
        data_publicacao: '15/01/2024',
        url_ou_arquivo: 'https://www.tjrs.jus.br/novo/concursos/edital-01-2024.pdf',
        tamanho: '2.4 MB',
        descricao: 'Regras gerais, conteúdo programático, vagas e cotas reservadas.',
      },
      {
        id: 'doc-2',
        concurso_id: 'tjrs_2024',
        titulo: 'Ato de Homologação Final Nº 42/2024 - Órgão Especial',
        tipo: 'Homologação',
        data_publicacao: '18/10/2024',
        url_ou_arquivo: 'https://www.tjrs.jus.br/novo/concursos/homologacao-tjrs-2024.pdf',
        tamanho: '850 KB',
        descricao: 'Publicação da homologação do resultado final no DJE.',
      },
      {
        id: 'doc-3',
        concurso_id: 'tjrs_2024',
        titulo: 'Edital de Convocação Nº 01/2024 - Lote 1 e Escolha de Comarcas',
        tipo: 'Convocação',
        data_publicacao: '12/12/2024',
        url_ou_arquivo: 'https://www.tjrs.jus.br/novo/concursos/convocacao-lote-1.pdf',
        tamanho: '1.1 MB',
        descricao: 'Instruções para a audiência pública presencial/telepresencial de escolha de vagas.',
      },
      {
        id: 'doc-4',
        concurso_id: 'tjrs_2024',
        titulo: 'Resolução TJRS Nº 1.450/2023 - Plano de Carreira dos Servidores',
        tipo: 'Legislação / PL',
        data_publicacao: '20/11/2023',
        url_ou_arquivo: 'https://www.tjrs.jus.br/novo/legislacao/resolucao-1450.pdf',
        tamanho: '520 KB',
        descricao: 'Tabela salarial, progressões e adicionais de qualificação.',
      },
    ],
    comunicados: [
      {
        id: 'com-1',
        concurso_id: 'tjrs_2024',
        titulo: 'Mobilização Comissões de Aprovados: Monitoramento do PL de Cargos Comissionados na ALRS',
        resumo: 'Comissão de Aprovados acompanha tramitação na Assembleia Legislativa que propõe criação de CCs. Meta é defender a nomeação prioritária de concursados efetivos.',
        texto_completo: 'A comissão de aprovados do TJRS informa que esteve reunida com lideranças parlamentares da Comissão de Constituição e Justiça (CCJ) da ALRS para apresentar nota técnica evidenciando que a contratação de cargos comissionados onera os cofres públicos em mais de 35% em comparação com a nomeação de concursados dos quadros efetivos. O tribunal conta hoje com mais de 770 cargos vagos entre Técnicos e Analistas. Foi criado um comitê permanente de vigília legislativa.',
        autor: 'Comissão Geral de Aprovados TJRS 2024',
        data: '10/02/2025',
        importante: true,
        tags: ['Mobilização', 'Assembleia Legislativa', 'Cargos Comissionados vs Efetivos', 'Nomeações'],
      },
      {
        id: 'com-2',
        concurso_id: 'tjrs_2024',
        titulo: 'Reunião com a Presidência do TJRS sobre Cronograma do 2º Lote Convocatório',
        resumo: 'Diretoria Geral de Gestão de Pessoas confirma tratativas avançadas para publicação do edital do 2º lote até abril/2025.',
        texto_completo: 'Em audiência realizada nesta semana, o Diretor de Gestão de Pessoas do TJRS informou que o impacto orçamentário para o chamamento de cerca de 45 a 60 novos servidores já recebeu parecer preliminar favorável da assessoria de finanças. O foco principal das novas nomeações será nas comarcas do interior que apresentam maior déficit funcional.',
        autor: 'Representação dos Aprovados CERTAM',
        data: '14/02/2025',
        importante: false,
        tags: ['2º Lote', 'Lotação', 'Orçamento'],
      },
    ],
    convocacoes: [
      {
        id: 'conv-1',
        concurso_id: 'tjrs_2024',
        cargo_id: 'analista_judiciario',
        lote_nome: 'Lote 1 (1º Chamamento Oficial)',
        numero_chamamento: 1,
        data_edital: '12/12/2024',
        total_convocados: 38,
        ampla_qtd: 28,
        ppp_qtd: 8,
        pcd_qtd: 2,
        status_processamento: 'Posse Efetuada',
      },
      {
        id: 'conv-2',
        concurso_id: 'tjrs_2024',
        cargo_id: 'tecnico_judiciario',
        lote_nome: 'Lote 1 (1º Chamamento Oficial)',
        numero_chamamento: 1,
        data_edital: '12/12/2024',
        total_convocados: 25,
        ampla_qtd: 18,
        ppp_qtd: 5,
        pcd_qtd: 2,
        status_processamento: 'Posse Efetuada',
      },
    ],
  },
  {
    id: 'mprs_2024',
    nome: 'Ministério Público do Estado do Rio Grande do Sul (MPRS)',
    orgao: 'MPRS',
    ano: '2024',
    edital: 'Edital 01/2024',
    status: 'Homologado',
    homologado: true,
    data_homologacao: '20/11/2024',
    regiao: 'Sul',
    esfera: 'Estadual',
    estado: 'RS',
    descricao: 'Concurso Público para Provimento de Cargos Efetivos dos Serviços Auxiliares do MPRS.',
    cargos: [
      {
        id: 'analista_mprs',
        nome: 'Analista do Ministério Público',
        nivel: 'Superior',
        vagas_imediatas: 15,
        tem_cr: true,
        ativo: true,
        remuneracao_inicial: 'R$ 10.450,20',
        vagas_ocupadas: 920,
        vagas_reais_abertas: 142,
      },
      {
        id: 'tecnico_mprs',
        nome: 'Técnico do Ministério Público',
        nivel: 'Médio',
        vagas_imediatas: 20,
        tem_cr: true,
        ativo: true,
        remuneracao_inicial: 'R$ 5.850,00',
        vagas_ocupadas: 1480,
        vagas_reais_abertas: 215,
      },
    ],
    cronograma: [
      {
        id: 'mprs-crono-1',
        concurso_id: 'mprs_2024',
        titulo: 'Publicação do Edital do Concurso',
        data_prevista: '05/02/2024',
        data_realizada: '05/02/2024',
        status: 'concluido',
        descricao: 'Edital publicado no Diário Eletrônico do MPRS.',
      },
      {
        id: 'mprs-crono-2',
        concurso_id: 'mprs_2024',
        titulo: 'Provas Objetivas e Discursivas',
        data_prevista: '09/06/2024',
        data_realizada: '09/06/2024',
        status: 'concluido',
        descricao: 'Exames realizados nas cidades-polo do estado.',
      },
      {
        id: 'mprs-crono-3',
        concurso_id: 'mprs_2024',
        titulo: 'Homologação do Resultado Final',
        data_prevista: '20/11/2024',
        data_realizada: '20/11/2024',
        status: 'concluido',
        descricao: 'Ato oficial homologatório assinado pelo Procurador-Geral de Justiça.',
      },
      {
        id: 'mprs-crono-4',
        concurso_id: 'mprs_2024',
        titulo: '1ª Convocação Oficial para Posse',
        data_prevista: '20/03/2025',
        status: 'em_andamento',
        descricao: 'Previsão de convocação de 20 Técnicos e 15 Analistas para promotorias e procuradorias.',
      },
    ],
    quadro_vagas: [
      {
        concurso_id: 'mprs_2024',
        cargo_id: 'analista_mprs',
        cargo_nome: 'Analista do Ministério Público',
        cargos_criados_lei: 1062,
        vagas_ocupadas: 920,
        vagas_reais_abertas: 142,
        aposentadorias_previstas: 38,
        data_atualizacao: '10/02/2025',
        fonte_oficial: 'Portal da Transparência MPRS',
      },
      {
        concurso_id: 'mprs_2024',
        cargo_id: 'tecnico_mprs',
        cargo_nome: 'Técnico do Ministério Público',
        cargos_criados_lei: 1695,
        vagas_ocupadas: 1480,
        vagas_reais_abertas: 215,
        aposentadorias_previstas: 64,
        data_atualizacao: '10/02/2025',
        fonte_oficial: 'Portal da Transparência MPRS',
      },
    ],
    documentos: [
      {
        id: 'mprs-doc-1',
        concurso_id: 'mprs_2024',
        titulo: 'Edital de Abertura Nº 01/2024 - MPRS Servidores',
        tipo: 'Edital de Abertura',
        data_publicacao: '05/02/2024',
        url_ou_arquivo: 'https://www.mprs.mp.br/concursos/edital-01-2024.pdf',
        tamanho: '2.1 MB',
      },
      {
        id: 'mprs-doc-2',
        concurso_id: 'mprs_2024',
        titulo: 'Ato de Homologação Final Nº 15/2024 - PGJ MPRS',
        tipo: 'Homologação',
        data_publicacao: '20/11/2024',
        url_ou_arquivo: 'https://www.mprs.mp.br/concursos/homologacao-2024.pdf',
        tamanho: '780 KB',
      },
    ],
    comunicados: [
      {
        id: 'mprs-com-1',
        concurso_id: 'mprs_2024',
        titulo: 'Previsão de Cronograma de Nomeações do MPRS para 2025',
        resumo: 'Procuradoria-Geral de Justiça assegura no orçamento dotação para preenchimento de vacâncias prioritárias em promotorias do interior.',
        texto_completo: 'A administração do Ministério Público do RS destacou que, com a homologação concluída no final de 2024, as primeiras nomeações ocorrerão de forma escalonada a partir do final do primeiro trimestre de 2025.',
        autor: 'Comissão de Aprovados MPRS',
        data: '08/02/2025',
        importante: true,
        tags: ['Convocação', 'Interior', 'Orçamento'],
      },
    ],
    convocacoes: [],
  },
];

export const certamStore = {
  getConcursos(): Concurso[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Assegura que campos essenciais estejam presentes
          return parsed;
        }
      }
    } catch {
      // Fallback
    }
    this.salvarTodos(DEFAULT_CONCURSOS);
    return DEFAULT_CONCURSOS;
  },

  getConcurso(id: string): Concurso | null {
    const list = this.getConcursos();
    return list.find((c) => c.id === id || (id === 'tjrs' && c.id === 'tjrs_2024')) || list[0] || null;
  },

  getCargo(concursoId: string, cargoId: string): Cargo | null {
    const conc = this.getConcurso(concursoId);
    if (!conc || !conc.cargos) return null;
    return conc.cargos.find((cg) => cg.id === cargoId) || conc.cargos[0] || null;
  },

  salvarConcurso(concurso: Concurso): boolean {
    if (!concurso || !concurso.id) return false;
    const list = this.getConcursos();
    const index = list.findIndex((c) => c.id === concurso.id);
    if (!Array.isArray(concurso.cargos) || concurso.cargos.length === 0) {
      concurso.cargos = [
        {
          id: 'geral',
          nome: 'Geral / Lista Única',
          nivel: 'Superior',
          vagas_imediatas: 0,
          tem_cr: true,
          ativo: true,
        },
      ];
    }
    if (index >= 0) {
      list[index] = { ...list[index], ...concurso };
    } else {
      list.push(concurso);
    }
    this.salvarTodos(list);
    return true;
  },

  salvarCargo(concursoId: string, cargo: Cargo): boolean {
    const conc = this.getConcurso(concursoId);
    if (!conc) return false;
    if (!conc.cargos) conc.cargos = [];
    const index = conc.cargos.findIndex((cg) => cg.id === cargo.id);
    if (index >= 0) {
      conc.cargos[index] = { ...conc.cargos[index], ...cargo };
    } else {
      conc.cargos.push(cargo);
    }
    return this.salvarConcurso(conc);
  },

  removerCargo(concursoId: string, cargoId: string): boolean {
    const conc = this.getConcurso(concursoId);
    if (!conc || !conc.cargos) return false;
    conc.cargos = conc.cargos.filter((cg) => cg.id !== cargoId);
    return this.salvarConcurso(conc);
  },

  removerConcurso(concursoId: string): boolean {
    const list = this.getConcursos().filter((c) => c.id !== concursoId);
    this.salvarTodos(list);
    return true;
  },

  salvarTodos(concursos: Concurso[]) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(concursos));
      window.dispatchEvent(new CustomEvent('certam_concursos_updated', { detail: concursos }));
    } catch {
      // ignore
    }
  },

  // Documentos
  adicionarDocumento(concursoId: string, doc: DocumentoItem) {
    const conc = this.getConcurso(concursoId);
    if (!conc) return;
    conc.documentos = conc.documentos || [];
    conc.documentos.unshift(doc);
    this.salvarConcurso(conc);
  },

  // Comunicados
  adicionarComunicado(concursoId: string, com: ComunicadoItem) {
    const conc = this.getConcurso(concursoId);
    if (!conc) return;
    conc.comunicados = conc.comunicados || [];
    conc.comunicados.unshift(com);
    this.salvarConcurso(conc);
  },

  // Cronograma
  atualizarCronograma(concursoId: string, cronograma: CronogramaItem[]) {
    const conc = this.getConcurso(concursoId);
    if (!conc) return;
    conc.cronograma = cronograma;
    this.salvarConcurso(conc);
  },
};
