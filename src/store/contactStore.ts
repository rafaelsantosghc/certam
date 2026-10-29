import { MensagemContatoAdmin, MotivoContato } from '../types';
import { cloudSync } from './cloudSync';

const CONTACT_STORAGE_KEY = 'certam_contact_messages_v5';

export const MOTIVOS_LABELS: Record<MotivoContato, string> = {
  inclusao_concurso: 'Solicitar Inclusão de Novo Concurso / Cargo',
  vinculacao_nao_efetivada: 'Concurso/Cargo Cadastrado, mas Vinculação Não Efetivada',
  erro_classificacao: 'Correção de Nota ou Posição na Classificação',
  vinculacao_cadastro: 'Vincular meu CPF ao Cadastro do Concurso',
  duvida: 'Dúvida sobre Escolha de Comarcas ou Posse',
  sugestao: 'Sugestão de Funcionalidade para o Portal',
  outro: 'Outro Assunto',
};

const DEFAULT_CONTATOS: MensagemContatoAdmin[] = [];

export const contactStore = {
  getMensagens(): MensagemContatoAdmin[] {
    try {
      localStorage.removeItem('certam_contact_messages_v4');
      const stored = localStorage.getItem(CONTACT_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    return DEFAULT_CONTATOS;
  },

  salvarMensagens(list: MensagemContatoAdmin[], forceReplace = false) {
    try {
      const jsonStr = JSON.stringify(list);
      localStorage.setItem(CONTACT_STORAGE_KEY, jsonStr);
      cloudSync.pushKey(CONTACT_STORAGE_KEY, jsonStr, forceReplace);
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
    this.salvarMensagens(list, false);
    return nova;
  },

  responderMensagem(id: string, resposta: string): boolean {
    const list = this.getMensagens();
    const item = list.find((m) => m.id === id);
    if (!item) return false;
    item.status = 'respondido';
    item.resposta_admin = resposta;
    item.data_resposta = new Date().toLocaleString('pt-BR');
    this.salvarMensagens(list, false);
    return true;
  },

  arquivarMensagem(id: string): boolean {
    const list = this.getMensagens();
    const item = list.find((m) => m.id === id);
    if (!item) return false;
    item.status = 'arquivado';
    this.salvarMensagens(list, false);
    return true;
  },

  removerMensagem(id: string): boolean {
    const list = this.getMensagens().filter((m) => m.id !== id);
    this.salvarMensagens(list, true);
    return true;
  },
};
