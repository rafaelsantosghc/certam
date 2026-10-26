import { Candidato } from '../types';

export const CANDIDATOS_ANALISTA_TJRS: Candidato[] = [];
export const CANDIDATOS_ANALISTA_ADM_TJRS: Candidato[] = [];
export const CANDIDATOS_TECNICO_TJRS: Candidato[] = [];
export const CANDIDATOS_ANALISTA_MPRS: Candidato[] = [];
export const CANDIDATOS_TECNICO_MPRS: Candidato[] = [];

export const MASTER_CADASTRO_GERAL: Candidato[] = [];

/**
 * Remove acentuação, pontuações e converte para caixa baixa para matching tolerante
 */
export const normalizarTexto = (str: string = ''): string => {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
};

/**
 * Remove qualquer caractere não numérico do CPF
 */
export const limparCpf = (cpfStr: string = ''): string => {
  return cpfStr.replace(/\D/g, '');
};

/**
 * Identifica o candidato no cadastro geral
 */
export const identificarCandidatoMaster = (
  nomeInput?: string,
  cpfInput?: string,
  concursoId?: string,
  cargoId?: string
): Candidato | null => {
  const cpfLimpo = cpfInput ? limparCpf(cpfInput) : '';
  const nomeNorm = nomeInput ? normalizarTexto(nomeInput) : '';

  // 1. Prioridade: Cruzamento por CPF
  if (cpfLimpo.length >= 7) {
    const matchCpf = MASTER_CADASTRO_GERAL.find((c) => {
      if (!c.cpf) return false;
      const cLimpo = limparCpf(c.cpf);
      if (cLimpo === cpfLimpo) return true;
      if (cpfLimpo.length === 11 && cLimpo.length === 11 && cLimpo === cpfLimpo) return true;
      return false;
    });
    if (matchCpf) {
      if (!concursoId && !cargoId) return matchCpf;
      const isConcMatch =
        !concursoId ||
        matchCpf.concurso_id === concursoId ||
        (concursoId.startsWith('tjrs') && matchCpf.concurso_id?.startsWith('tjrs')) ||
        (concursoId.startsWith('mprs') && matchCpf.concurso_id?.startsWith('mprs'));
      if (isConcMatch) {
        if (!cargoId || matchCpf.cargo_id === cargoId) return matchCpf;
      }
      return matchCpf;
    }
  }

  // 2. Prioridade: Cruzamento por Nome Completo exato/normalizado
  if (nomeNorm.length >= 3) {
    const matchNome = MASTER_CADASTRO_GERAL.find((c) => {
      const cNorm = normalizarTexto(c.nome);
      if (cNorm === nomeNorm) return true;
      return false;
    });
    if (matchNome) {
      if (!concursoId && !cargoId) return matchNome;
      const isConcMatch =
        !concursoId ||
        matchNome.concurso_id === concursoId ||
        (concursoId.startsWith('tjrs') && matchNome.concurso_id?.startsWith('tjrs')) ||
        (concursoId.startsWith('mprs') && matchNome.concurso_id?.startsWith('mprs'));
      if (isConcMatch) {
        if (!cargoId || matchNome.cargo_id === cargoId) return matchNome;
      }
      return matchNome;
    }
  }

  return null;
};
