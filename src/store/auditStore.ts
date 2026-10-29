import { PerfilAuditRequest, SolicitacaoVinculacao, AlteracaoCampoItem } from '../types';
import { cloudSync } from './cloudSync';

const AUDIT_STORAGE_KEY = 'certam_perfil_audit_requests_v5';
const VINCULACOES_STORAGE_KEY = 'certam_vinculacao_requests_v5';

export const auditStore = {
  getAuditRequests(): PerfilAuditRequest[] {
    try {
      const stored =
        cloudSync.getItem(AUDIT_STORAGE_KEY) || cloudSync.getItem('certam_audit_requests_v5');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    return [];
  },

  salvarAuditRequests(list: PerfilAuditRequest[], forceReplace = false) {
    cloudSync.setItem(AUDIT_STORAGE_KEY, list, forceReplace);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('certam_audit_updated', { detail: list }));
    }
  },

  submeterSolicitacaoAlteracao(dados: {
    usuario_email: string;
    usuario_nome: string;
    cpf: string;
    alteracoes: AlteracaoCampoItem[];
  }): PerfilAuditRequest {
    const list = [...this.getAuditRequests()];
    const nova: PerfilAuditRequest = {
      id: `audit-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      usuario_email: dados.usuario_email,
      usuario_nome: dados.usuario_nome,
      cpf: dados.cpf,
      data_solicitacao: new Date().toLocaleString('pt-BR'),
      status: 'pendente',
      alteracoes: dados.alteracoes,
    };
    list.unshift(nova);
    this.salvarAuditRequests(list, false);
    return nova;
  },

  aprovarSolicitacao(id: string): PerfilAuditRequest | null {
    const list = [...this.getAuditRequests()];
    const item = list.find((r) => r.id === id);
    if (!item) return null;
    item.status = 'aprovado';
    item.data_resposta = new Date().toLocaleString('pt-BR');
    this.salvarAuditRequests(list, false);
    return item;
  },

  rejeitarSolicitacao(id: string, motivo?: string): PerfilAuditRequest | null {
    const list = [...this.getAuditRequests()];
    const item = list.find((r) => r.id === id);
    if (!item) return null;
    item.status = 'rejeitado';
    item.motivo_rejeicao = motivo || 'Dados divergentes do cadastro oficial.';
    item.data_resposta = new Date().toLocaleString('pt-BR');
    this.salvarAuditRequests(list, false);
    return item;
  },

  // -------------------------------------------------------------
  // SOLICITAÇÕES DE VINCULAÇÃO MANUAL (CANDIDATO NÃO IDENTIFICADO)
  // -------------------------------------------------------------
  getVinculacoes(): SolicitacaoVinculacao[] {
    try {
      const stored = cloudSync.getItem(VINCULACOES_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    return [];
  },

  salvarVinculacoes(list: SolicitacaoVinculacao[], forceReplace = false) {
    cloudSync.setItem(VINCULACOES_STORAGE_KEY, list, forceReplace);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('certam_vinculacoes_updated', { detail: list }));
    }
  },

  solicitarVinculacao(
    dados: Omit<SolicitacaoVinculacao, 'id' | 'data_solicitacao' | 'status'>
  ): SolicitacaoVinculacao {
    const list = this.getVinculacoes();
    const nova: SolicitacaoVinculacao = {
      ...dados,
      id: `vinc-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      data_solicitacao: new Date().toLocaleString('pt-BR'),
      status: 'pendente',
    };
    list.unshift(nova);
    this.salvarVinculacoes(list);
    return nova;
  },

  aprovarVinculacao(id: string, candidatoVinculadoId?: string): SolicitacaoVinculacao | null {
    const list = this.getVinculacoes();
    const item = list.find((r) => r.id === id);
    if (!item) return null;
    item.status = 'aprovado';
    if (candidatoVinculadoId) {
      item.candidato_vinculado_id = candidatoVinculadoId;
    }
    this.salvarVinculacoes(list);
    return item;
  },

  rejeitarVinculacao(id: string, motivo?: string): SolicitacaoVinculacao | null {
    const list = this.getVinculacoes();
    const item = list.find((r) => r.id === id);
    if (!item) return null;
    item.status = 'rejeitado';
    item.motivo_rejeicao = motivo || 'Nome ou CPF não localizados no resultado final.';
    this.salvarVinculacoes(list);
    return item;
  },
};
