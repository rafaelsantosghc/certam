import { PerfilAuditRequest, SolicitacaoVinculacao } from '../types';

const AUDIT_STORAGE_KEY = 'certam_audit_requests_v3';
const VINCULACAO_STORAGE_KEY = 'certam_vinculacao_requests_v3';

const DEFAULT_AUDIT_REQUESTS: PerfilAuditRequest[] = [
  {
    id: 'req-001',
    usuario_email: 'carlos.meneghetti@adv.oabr.org.br',
    usuario_nome: 'Carlos Eduardo Meneghetti',
    cpf: '294.110.880-33',
    data_solicitacao: '24/02/2025 14:15',
    status: 'pendente',
    alteracoes: [
      {
        campo: 'whatsapp',
        campo_label: 'WhatsApp de Contato',
        valor_antigo: '(54) 99655-1209',
        valor_novo: '(54) 99881-3320',
      },
      {
        campo: 'email_contato',
        campo_label: 'E-mail para Comunicações',
        valor_antigo: 'carlos.meneghetti@adv.oabr.org.br',
        valor_novo: 'carlos.eduardo.tj@gmail.com',
      },
    ],
  },
];

const DEFAULT_VINCULACOES: SolicitacaoVinculacao[] = [
  {
    id: 'vinc-001',
    usuario_email: 'lucas.costa.candidato@gmail.com',
    usuario_nome: 'Lucas Costa de Andrade',
    cpf: '881.420.930-18',
    concurso_id: 'tjrs_2024',
    cargo_id: 'analista_judiciario',
    posicao_declarada: 9,
    nota_declarada: 90.1,
    comprovante_info: 'Inscrição Nº 104928 - Diário da Justiça Eletrônico do RS de 25/09/2024',
    data_solicitacao: '25/02/2025 09:30',
    status: 'pendente',
  },
];

export const auditStore = {
  getAuditRequests(): PerfilAuditRequest[] {
    try {
      const stored = localStorage.getItem(AUDIT_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    this.salvarAuditRequests(DEFAULT_AUDIT_REQUESTS);
    return DEFAULT_AUDIT_REQUESTS;
  },

  salvarAuditRequests(requests: PerfilAuditRequest[]) {
    try {
      localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(requests));
      window.dispatchEvent(new CustomEvent('certam_audit_updated', { detail: requests }));
    } catch {
      // ignore
    }
  },

  submeterSolicitacaoAlteracao(req: Omit<PerfilAuditRequest, 'id' | 'data_solicitacao' | 'status'>): PerfilAuditRequest {
    const requests = this.getAuditRequests();
    const novaSolicitacao: PerfilAuditRequest = {
      ...req,
      id: `audit-${Date.now().toString(36)}`,
      data_solicitacao: new Date().toLocaleString('pt-BR'),
      status: 'pendente',
    };
    requests.unshift(novaSolicitacao);
    this.salvarAuditRequests(requests);
    return novaSolicitacao;
  },

  aprovarSolicitacao(id: string): boolean {
    const requests = this.getAuditRequests();
    const item = requests.find((r) => r.id === id);
    if (!item) return false;
    item.status = 'aprovado';
    item.data_resposta = new Date().toLocaleString('pt-BR');
    this.salvarAuditRequests(requests);
    return true;
  },

  rejeitarSolicitacao(id: string, motivo: string): boolean {
    const requests = this.getAuditRequests();
    const item = requests.find((r) => r.id === id);
    if (!item) return false;
    item.status = 'rejeitado';
    item.motivo_rejeicao = motivo;
    item.data_resposta = new Date().toLocaleString('pt-BR');
    this.salvarAuditRequests(requests);
    return true;
  },

  // -------------------------------------------------------------
  // SOLICITAÇÕES DE VINCULAÇÃO MANUAL (CASO NÃO IDENTIFICADO)
  // -------------------------------------------------------------
  getVinculacoes(): SolicitacaoVinculacao[] {
    try {
      const stored = localStorage.getItem(VINCULACAO_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    this.salvarVinculacoes(DEFAULT_VINCULACOES);
    return DEFAULT_VINCULACOES;
  },

  salvarVinculacoes(list: SolicitacaoVinculacao[]) {
    try {
      localStorage.setItem(VINCULACAO_STORAGE_KEY, JSON.stringify(list));
      window.dispatchEvent(new CustomEvent('certam_vinculacoes_updated', { detail: list }));
    } catch {
      // ignore
    }
  },

  solicitarVinculacao(sol: Omit<SolicitacaoVinculacao, 'id' | 'data_solicitacao' | 'status'>): SolicitacaoVinculacao {
    const list = this.getVinculacoes();
    const nova: SolicitacaoVinculacao = {
      ...sol,
      id: `vinc-${Date.now().toString(36)}`,
      data_solicitacao: new Date().toLocaleString('pt-BR'),
      status: 'pendente',
    };
    list.unshift(nova);
    this.salvarVinculacoes(list);
    return nova;
  },

  aprovarVinculacao(id: string): boolean {
    const list = this.getVinculacoes();
    const item = list.find((v) => v.id === id);
    if (!item) return false;
    item.status = 'aprovado';
    this.salvarVinculacoes(list);
    return true;
  },

  rejeitarVinculacao(id: string, motivo: string): boolean {
    const list = this.getVinculacoes();
    const item = list.find((v) => v.id === id);
    if (!item) return false;
    item.status = 'rejeitado';
    item.motivo_rejeicao = motivo;
    this.salvarVinculacoes(list);
    return true;
  },
};
