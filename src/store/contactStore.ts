import { MensagemContatoAdmin, MotivoContato } from '../types';

const CONTACT_STORAGE_KEY = 'certam_contact_messages_v3';

export const MOTIVOS_LABELS: Record<MotivoContato, string> = {
  inclusao_concurso: 'Solicitar Inclusão de Novo Concurso / Cargo',
  erro_classificacao: 'Correção de Nota ou Posição na Classificação',
  vinculacao_cadastro: 'Vincular meu CPF ao Cadastro do Concurso',
  duvida: 'Dúvida sobre Escolha de Comarcas ou Posse',
  sugestao: 'Sugestão de Funcionalidade para o Portal',
  outro: 'Outro Assunto',
};

const DEFAULT_CONTATOS: MensagemContatoAdmin[] = [
  {
    id: 'ct-1',
    usuario_email: 'bruno.zanella@yahoo.com',
    usuario_nome: 'Bruno Henrique Zanella',
    motivo: 'inclusao_concurso',
    motivo_label: 'Solicitar Inclusão de Novo Concurso / Cargo',
    concurso_nome: 'Concurso TRT-4 (Tribunal Regional do Trabalho da 4ª Região)',
    ano_concurso: '2022',
    cargo_nome: 'Analista Judiciário - Área Judiciária',
    classificacao: '14º lugar',
    mensagem: 'Gostaria de solicitar a inclusão do concurso do TRT-4 para podermos acompanhar a lista de chamamentos e preferências no CERTAM.',
    data_envio: '23/02/2025 10:20',
    status: 'aberto',
  },
  {
    id: 'ct-2',
    usuario_email: 'patricia.schneider@gmail.com',
    usuario_nome: 'Patrícia Schneider Fagundes',
    motivo: 'duvida',
    motivo_label: 'Dúvida sobre Escolha de Comarcas ou Posse',
    concurso_nome: 'TJRS 2024',
    cargo_nome: 'Analista Judiciário',
    mensagem: 'Gostaria de saber se a audiência de posse exige presença física em Porto Alegre para candidatos PCD ou se há opção telepresencial.',
    data_envio: '24/02/2025 15:40',
    status: 'respondido',
    resposta_admin: 'Olá Patrícia! Conforme o Edital nº 01/2024, a audiência permite participação virtual mediante envio prévio do formulário de telepresença.',
    data_resposta: '24/02/2025 16:10',
  },
];

export const contactStore = {
  getMensagens(): MensagemContatoAdmin[] {
    try {
      const stored = localStorage.getItem(CONTACT_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    this.salvarMensagens(DEFAULT_CONTATOS);
    return DEFAULT_CONTATOS;
  },

  salvarMensagens(list: MensagemContatoAdmin[]) {
    try {
      localStorage.setItem(CONTACT_STORAGE_KEY, JSON.stringify(list));
      window.dispatchEvent(new CustomEvent('certam_contact_updated', { detail: list }));
    } catch {
      // ignore
    }
  },

  enviarMensagem(dados: Omit<MensagemContatoAdmin, 'id' | 'data_envio' | 'status' | 'motivo_label'>): MensagemContatoAdmin {
    const list = this.getMensagens();
    const nova: MensagemContatoAdmin = {
      ...dados,
      id: `ct-${Date.now().toString(36)}`,
      motivo_label: MOTIVOS_LABELS[dados.motivo] || 'Outro Assunto',
      data_envio: new Date().toLocaleString('pt-BR'),
      status: 'aberto',
    };
    list.unshift(nova);
    this.salvarMensagens(list);
    return nova;
  },

  responderMensagem(id: string, resposta: string): boolean {
    const list = this.getMensagens();
    const item = list.find((m) => m.id === id);
    if (!item) return false;
    item.status = 'respondido';
    item.resposta_admin = resposta;
    item.data_resposta = new Date().toLocaleString('pt-BR');
    this.salvarMensagens(list);
    return true;
  },

  arquivarMensagem(id: string): boolean {
    const list = this.getMensagens();
    const item = list.find((m) => m.id === id);
    if (!item) return false;
    item.status = 'arquivado';
    this.salvarMensagens(list);
    return true;
  },
};
