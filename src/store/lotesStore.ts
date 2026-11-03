import { Candidato, Lote, Comarca } from '../types';
import { cloudSync } from './cloudSync';
import { certamStore } from './certamStore';

const LOTES_KEY = 'certam_lotes_data_v6';
const CANDIDATOS_KEY = 'certam_candidatos_data_v6';

function normSlug(str: string = ''): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function extrairTipoCargoCanonico(str: string = ''): string {
  const s = normSlug(str);
  if (!s) return '';
  if ((s.includes('analista') || s.includes('aj')) && (s.includes('adm') || s.includes('administrat'))) {
    return 'analista_administrativo';
  }
  if ((s.includes('analista') || s.includes('aj')) && (s.includes('jud') || s.includes('direito'))) {
    return 'analista_judiciario';
  }
  if (s.includes('tecnico') || s.includes('t_cnico') || s.includes('tj')) {
    return 'tecnico_judiciario';
  }
  if (s.includes('oficial')) {
    return 'oficial_justica';
  }
  return s;
}

function parseCandidatosArray(raw: string | null | undefined): Candidato[] {
  if (!raw) return [];
  try {
    const p = JSON.parse(raw);
    if (Array.isArray(p) && p.length > 0) return p;
  } catch {
    // ignore
  }
  return [];
}

export interface SimulacaoResultado {
  alocacoes: {
    candidatoId: string;
    candidatoNome: string;
    posicao: number;
    comarcaAlocada: string | null;
    preferenciaNumero: number | null;
    status: string;
    cota: string;
    intencao: string;
  }[];
  vagasOcupadas: Record<string, number>;
  vagasRestantes: Record<string, number>;
  totalVagasOfertadas: number;
  totalVagasPreenchidas: number;
  totalDesistencias: number;
  totalAssumem: number;
}

export const lotesStore = {
  getLotes(): Lote[] {
    try {
      const s = cloudSync.getItem(LOTES_KEY);
      if (s) {
        const p = JSON.parse(s);
        if (Array.isArray(p)) return p;
      }
    } catch {
      // ignore
    }
    return [];
  },

  salvarLotes(lotes: Lote[], forceReplace = false) {
    cloudSync.setItem(LOTES_KEY, lotes, forceReplace);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('certam_lotes_updated', { detail: lotes }));
    }
  },

  getCandidatos(concursoId: string, cargoId: string): Candidato[] {
    if (!concursoId) return [];
    const exactKey = `${CANDIDATOS_KEY}_${concursoId}_${cargoId}`;
    const exactList = parseCandidatosArray(cloudSync.getItem(exactKey));
    if (exactList.length > 0) {
      return exactList;
    }

    // Resolução inteligente de variações de slug de cargo (ex: 'geral' renomeado ou slug truncado)
    try {
      const conc = certamStore.getConcurso(concursoId);
      const cargoObj = conc?.cargos?.find((cg) => cg.id === cargoId);
      const cargoIndex = conc?.cargos ? conc.cargos.findIndex((cg) => cg.id === cargoId) : -1;
      const targetNormId = normSlug(cargoId);
      const targetNormNome = normSlug(cargoObj?.nome || '');
      const targetCanonico = extrairTipoCargoCanonico(cargoObj?.nome || cargoId);

      const prefix = `${CANDIDATOS_KEY}_${concursoId}_`;
      const allKeys = cloudSync
        .getAllKeys()
        .filter((k) => k.startsWith(prefix) && k !== exactKey);

      const nonEmptyCandidatesBySuffix: { suffix: string; list: Candidato[] }[] = [];
      for (const k of allKeys) {
        const list = parseCandidatosArray(cloudSync.getItem(k));
        if (list.length > 0) {
          nonEmptyCandidatesBySuffix.push({
            suffix: k.slice(prefix.length),
            list,
          });
        }
      }

      if (nonEmptyCandidatesBySuffix.length === 0) {
        return [];
      }

      // 1. Match por slug normalizado ou tipo canônico do cargo
      for (const item of nonEmptyCandidatesBySuffix) {
        const sNorm = normSlug(item.suffix);
        const sCanon = extrairTipoCargoCanonico(item.suffix);
        if (
          (targetNormId && sNorm === targetNormId) ||
          (targetNormNome && sNorm === targetNormNome) ||
          (targetNormNome && sNorm.length >= 6 && targetNormNome.startsWith(sNorm)) ||
          (targetNormId && sNorm.length >= 6 && targetNormId.startsWith(sNorm)) ||
          (targetCanonico && sCanon === targetCanonico)
        ) {
          return item.list;
        }
      }

      // 2. Se for o 1º cargo do concurso (ou cargo único) e houver lista salva sob '_geral'
      const hasExplicitGeralCargo = conc?.cargos?.some((cg) => cg.id === 'geral');
      if ((cargoIndex === 0 || (conc?.cargos?.length || 0) <= 1) && !hasExplicitGeralCargo) {
        const geralEntry = nonEmptyCandidatesBySuffix.find((x) => normSlug(x.suffix) === 'geral');
        if (geralEntry) {
          return geralEntry.list;
        }
      }

      // 3. Se o concurso possui apenas 1 cargo e existe apenas 1 lista de candidatos para este concurso
      if ((conc?.cargos?.length || 0) === 1 && nonEmptyCandidatesBySuffix.length === 1) {
        return nonEmptyCandidatesBySuffix[0].list;
      }
    } catch {
      // ignore fallback error
    }

    return [];
  },

  salvarCandidatos(concursoId: string, cargoId: string, candidatos: Candidato[], forceReplace = true) {
    const key = `${CANDIDATOS_KEY}_${concursoId}_${cargoId}`;
    cloudSync.setItem(key, candidatos, forceReplace);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('certam_candidatos_updated', { detail: candidatos }));
    }
  },

  salvarCandidato(concursoId: string, cargoId: string, candidato: Candidato) {
    const list = [...this.getCandidatos(concursoId, cargoId)];
    const index = list.findIndex(
      (c) => c.id === candidato.id || (candidato.email && c.email === candidato.email)
    );
    if (index >= 0) {
      list[index] = { ...list[index], ...candidato };
    } else {
      list.push(candidato);
    }
    this.salvarCandidatos(concursoId, cargoId, list, false);
  },

  getLote(loteId: string): Lote | null {
    const lotes = this.getLotes();
    return lotes.find((l) => l.id === loteId) || lotes[0] || null;
  },

  criarLote(lote: Lote) {
    const lotes = this.getLotes();
    lotes.push(lote);
    this.salvarLotes(lotes, false);
  },

  atualizarLote(lote: Lote) {
    const lotes = this.getLotes();
    const idx = lotes.findIndex((l) => l.id === lote.id);
    if (idx >= 0) {
      lotes[idx] = lote;
      this.salvarLotes(lotes, false);
    }
  },

  removerLote(loteId: string) {
    const lotes = this.getLotes().filter((l) => l.id !== loteId);
    this.salvarLotes(lotes, true);
  },

  executarSimulacao(
    lote: Lote,
    candidatos: Candidato[],
    desconsiderarDesistentes: boolean = true
  ): SimulacaoResultado {
    const vagasOcupadas: Record<string, number> = {};
    const vagasRestantes: Record<string, number> = {};
    let totalVagasOfertadas = 0;

    lote.comarcas.forEach((c) => {
      vagasOcupadas[c.nome] = 0;
      vagasRestantes[c.nome] = c.vagas;
      totalVagasOfertadas += c.vagas;
    });

    const ordenados = [...candidatos].sort((a, b) => a.posicao - b.posicao);

    let totalDesistencias = 0;
    let totalAssumem = 0;
    let totalVagasPreenchidas = 0;

    const alocacoes = ordenados.map((cand) => {
      const vaiDesistir =
        cand.intencao === 'Não' ||
        cand.status === 'Desistência' ||
        cand.status === 'Fim de Fila';

      if (vaiDesistir) {
        totalDesistencias++;
        if (desconsiderarDesistentes) {
          return {
            candidatoId: cand.id,
            candidatoNome: cand.nome,
            posicao: cand.posicao,
            comarcaAlocada: null,
            preferenciaNumero: null,
            status: cand.status,
            cota: cand.cota,
            intencao: cand.intencao,
          };
        }
      } else {
        totalAssumem++;
      }

      let comarcaEscolhida: string | null = null;
      let preferenciaNumero: number | null = null;

      const escolhas =
        cand.escolhas_comarcas && cand.escolhas_comarcas.length > 0
          ? cand.escolhas_comarcas
          : cand.comarca_desejada_1
          ? [cand.comarca_desejada_1]
          : [];

      for (let i = 0; i < escolhas.length; i++) {
        const comarca = escolhas[i];
        if (vagasRestantes[comarca] && vagasRestantes[comarca] > 0) {
          comarcaEscolhida = comarca;
          preferenciaNumero = i + 1;
          vagasRestantes[comarca]--;
          vagasOcupadas[comarca] = (vagasOcupadas[comarca] || 0) + 1;
          totalVagasPreenchidas++;
          break;
        }
      }

      return {
        candidatoId: cand.id,
        candidatoNome: cand.nome,
        posicao: cand.posicao,
        comarcaAlocada: comarcaEscolhida,
        preferenciaNumero,
        status: cand.status,
        cota: cand.cota,
        intencao: cand.intencao,
      };
    });

    return {
      alocacoes,
      vagasOcupadas,
      vagasRestantes,
      totalVagasOfertadas,
      totalVagasPreenchidas,
      totalDesistencias,
      totalAssumem,
    };
  },

  simularLotacao(candidatos: Candidato[], comarcas: Comarca[]): SimulacaoResultado {
    const loteMock: Lote = {
      id: 'simulacao',
      concurso_id: 'tjrs_2025',
      cargo_id: 'analista_judiciario',
      nome: 'Simulação Geral',
      ativo: true,
      is_ranking_visible: true,
      is_printing_enabled: true,
      travado: false,
      comarcas: comarcas.map((c) => ({ nome: c.nome, vagas: c.vagas_total })),
      candidatos_ids: candidatos.map((c) => c.id),
    };
    return this.executarSimulacao(loteMock, candidatos, true);
  },
};
