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
 * Normaliza o identificador/nome do concurso para agrupar variações como
 * 'TJRS 2025', 'tjrs_2025' e 'Tribunal de Justiça do Rio Grande do Sul (TJRS)'
 */
export function extrairSlugConcurso(nomeOuId: string): string {
  const norm = normalizarTexto(nomeOuId || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

  if (norm.includes('tjrs') || norm.includes('tribunaldejusticadoriograndedosul')) return 'tjrs';
  if (norm.includes('mprs') || norm.includes('ministeriopublicodoriograndedosul')) return 'mprs';
  if (norm.includes('tjsc') || norm.includes('tribunaldejusticadesantacatarina')) return 'tjsc';
  if (norm.includes('tjpr') || norm.includes('tribunaldejusticadoparana')) return 'tjpr';
  if (norm.includes('trf4') || norm.includes('tribunalregionalfederalda4')) return 'trf4';
  return norm.slice(0, 20);
}

/**
 * Normaliza o cargo para agrupar variações como
 * 'analista_judiciario' e 'Analista Judiciário - Área Judiciária'
 */
export function extrairSlugCargo(nomeOuId: string): string {
  const norm = normalizarTexto(nomeOuId || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

  if (
    norm.includes('analistajudiciario') ||
    norm.includes('analistaareajudiciaria') ||
    norm === 'analistajudiciario'
  ) {
    return 'analista_judiciario';
  }
  if (
    norm.includes('analistaadministrativo') ||
    norm.includes('analistaareaadministrativa')
  ) {
    return 'analista_administrativo';
  }
  if (norm.includes('analistamprs') || (norm.includes('analista') && norm.includes('ministeriopublico'))) {
    return 'analista_mprs';
  }
  if (
    norm.includes('tecnicojudiciario') ||
    norm.includes('tecnicoadministrativo') ||
    norm === 'tecnicojudiciario'
  ) {
    return 'tecnico_judiciario';
  }
  if (norm.includes('tecnicomprs') || (norm.includes('tecnico') && norm.includes('ministeriopublico'))) {
    return 'tecnico_mprs';
  }
  if (norm.includes('analista')) return 'analista';
  if (norm.includes('tecnico')) return 'tecnico';
  return norm.slice(0, 25);
}

/**
 * Identifica automaticamente todos os concursos e cargos em que o candidato
 * figura na lista oficial de aprovados ou cadastros homologados no CERTAM,
 * garantindo deduplicação estrita sem repetições do mesmo certame e cargo.
 */
export function buscarTodasAprovacoesCandidato(dados: {
  cpf?: string;
  nome?: string;
  email?: string;
  candidato_id?: string;
  outros_concursos?: OutroConcursoAprovado[];
}): AprovacaoDetectada[] {
  const canonicalMap = new Map<string, AprovacaoDetectada>();

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

  // 1. Vasculha todos os concursos e cargos registrados nas tabelas ativas do portal
  const concursos = certamStore.getConcursos();
  for (const conc of concursos) {
    if (!conc.cargos) continue;
    for (const cargo of conc.cargos) {
      const listaCandidatos = lotesStore.getCandidatos(conc.id, cargo.id);
      const cand = listaCandidatos.find(matchCandidate);
      if (cand) {
        const canonicalKey = `${extrairSlugConcurso(conc.id)}_${extrairSlugCargo(cargo.id)}`;
        canonicalMap.set(canonicalKey, {
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
      const canonicalKey = `${extrairSlugConcurso(concId)}_${extrairSlugCargo(cargoId)}`;

      if (!canonicalMap.has(canonicalKey)) {
        const concObj = concursos.find((c) => c.id === concId);
        const cargoObj = concObj?.cargos.find((cg) => cg.id === cargoId);

        const concNome = concObj?.nome || (concId.startsWith('mprs') ? 'MPRS 2025' : 'TJRS 2025');
        const cargoNome =
          cargoObj?.nome ||
          (cargoId.includes('tecnico') ? 'Técnico Judiciário' : 'Analista Judiciário - Área Judiciária');

        canonicalMap.set(canonicalKey, {
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

  // 3. Inclui apenas aprovações manuais/declaradas que NÃO coincidem com concursos do sistema
  if (Array.isArray(dados.outros_concursos)) {
    for (const outro of dados.outros_concursos) {
      if (!outro.concurso_nome || !outro.cargo) continue;

      const slugConc = extrairSlugConcurso(outro.concurso_id || outro.concurso_nome);
      const slugCargo = extrairSlugCargo(outro.cargo_id || outro.cargo);
      const canonicalKey = `${slugConc}_${slugCargo}`;

      // Se já foi identificado no sistema oficial, descarta a duplicata manual
      if (canonicalMap.has(canonicalKey)) {
        continue;
      }

      // Se não existe na base oficial, registra como concurso externo/informado
      canonicalMap.set(canonicalKey, {
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

  return Array.from(canonicalMap.values()).sort((a, b) => a.posicao - b.posicao);
}
