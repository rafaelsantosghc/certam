import { certamStore } from '../store/certamStore';
import { lotesStore } from '../store/lotesStore';
import { MASTER_CADASTRO_GERAL, normalizarTexto, limparCpf } from '../data/defaultCandidates';
import { OutroConcursoAprovado, Candidato } from '../types';

export interface AprovacaoDetectada {
  id: string;
  concurso_id: string;
  concurso_nome: string;
  ano: string;
  cargo_id: string;
  cargo_nome: string;
  posicao: number;
  status: string;
  cota?: string;
  nota_final?: number;
  origem: 'sistema_automatico' | 'declarado';
}

/**
 * Identifica automaticamente todos os concursos e cargos em que o candidato
 * figura na lista oficial de aprovados ou cadastros homologados no CERTAM.
 */
export function buscarTodasAprovacoesCandidato(dados: {
  cpf?: string;
  nome?: string;
  email?: string;
  candidato_id?: string;
  outros_concursos?: OutroConcursoAprovado[];
}): AprovacaoDetectada[] {
  const aprovacoesMap = new Map<string, AprovacaoDetectada>();

  const cpfLimpo = dados.cpf ? limparCpf(dados.cpf) : '';
  const nomeNorm = dados.nome ? normalizarTexto(dados.nome) : '';
  const emailLimpo = dados.email ? dados.email.trim().toLowerCase() : '';
  const idAlvo = dados.candidato_id;

  const matchCandidate = (c: Partial<Candidato>): boolean => {
    if (idAlvo && c.id === idAlvo) return true;
    if (cpfLimpo.length >= 7 && c.cpf) {
      const cCpf = limparCpf(c.cpf);
      if (cCpf === cpfLimpo || (cpfLimpo.length === 11 && cCpf.length === 11 && cCpf === cpfLimpo)) {
        return true;
      }
    }
    if (emailLimpo && c.email && c.email.trim().toLowerCase() === emailLimpo) {
      return true;
    }
    if (nomeNorm.length >= 3 && c.nome && normalizarTexto(c.nome) === nomeNorm) {
      return true;
    }
    return false;
  };

  // 1. Vasculha todos os concursos e cargos registrados nas tabelas ativas
  const concursos = certamStore.getConcursos();
  for (const conc of concursos) {
    if (!conc.cargos) continue;
    for (const cargo of conc.cargos) {
      const listaCandidatos = lotesStore.getCandidatos(conc.id, cargo.id);
      const cand = listaCandidatos.find(matchCandidate);
      if (cand) {
        const key = `${conc.id}_${cargo.id}`;
        aprovacoesMap.set(key, {
          id: cand.id || `aprov-${conc.id}-${cargo.id}`,
          concurso_id: conc.id,
          concurso_nome: conc.nome,
          ano: conc.ano || '2025',
          cargo_id: cargo.id,
          cargo_nome: cargo.nome,
          posicao: cand.posicao || 1,
          status: cand.status || 'Classificado',
          cota: cand.cota || 'Ampla',
          nota_final: cand.nota_final,
          origem: 'sistema_automatico',
        });
      }
    }
  }

  // 2. Vasculha o Cadastro Geral Master
  for (const m of MASTER_CADASTRO_GERAL) {
    if (matchCandidate(m)) {
      const concId = m.concurso_id || 'tjrs_2025';
      const cargoId = m.cargo_id || 'analista_judiciario';
      const key = `${concId}_${cargoId}`;

      if (!aprovacoesMap.has(key)) {
        const concObj = concursos.find((c) => c.id === concId);
        const cargoObj = concObj?.cargos.find((cg) => cg.id === cargoId);

        let concNome = concObj?.nome || (concId.startsWith('mprs') ? 'MPRS 2025' : 'TJRS 2025');
        let cargoNome = cargoObj?.nome || (cargoId.includes('tecnico') ? 'Técnico Judiciário' : 'Analista Judiciário');

        aprovacoesMap.set(key, {
          id: m.id,
          concurso_id: concId,
          concurso_nome: concNome,
          ano: concObj?.ano || '2025',
          cargo_id: cargoId,
          cargo_nome: cargoNome,
          posicao: m.posicao || 1,
          status: m.status || 'Convocado Titular',
          cota: m.cota || 'Ampla',
          nota_final: m.nota_final,
          origem: 'sistema_automatico',
        });
      }
    }
  }

  // 3. Inclui aprovações previamente declaradas/homologadas que não estão na base padrão
  if (Array.isArray(dados.outros_concursos)) {
    for (const outro of dados.outros_concursos) {
      if (!outro.concurso_nome || !outro.cargo) continue;
      const key = `manual_${normalizarTexto(outro.concurso_nome)}_${normalizarTexto(outro.cargo)}`;
      if (!aprovacoesMap.has(key)) {
        aprovacoesMap.set(key, {
          id: `out-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
          concurso_id: outro.concurso_id || 'outro',
          concurso_nome: outro.concurso_nome,
          ano: outro.ano || '2025',
          cargo_id: outro.cargo_id || 'outro',
          cargo_nome: outro.cargo,
          posicao: outro.classificacao || 1,
          status: outro.status_aprovacao || 'Aprovado (Informado)',
          origem: outro.origem === 'automatico' ? 'sistema_automatico' : 'declarado',
        });
      }
    }
  }

  return Array.from(aprovacoesMap.values()).sort((a, b) => a.posicao - b.posicao);
}
