import { Candidato, Lote, Comarca } from '../types';
import {
  CANDIDATOS_ANALISTA_TJRS,
  CANDIDATOS_ANALISTA_ADM_TJRS,
  CANDIDATOS_TECNICO_TJRS,
  CANDIDATOS_ANALISTA_MPRS,
  CANDIDATOS_TECNICO_MPRS,
} from '../data/defaultCandidates';
import { COMARCAS_RS } from '../data/comarcas';
import { cloudSync } from './cloudSync';

const LOTES_KEY = 'certam_lotes_data_v6';
const CANDIDATOS_KEY = 'certam_candidatos_data_v6';

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
      localStorage.removeItem('certam_lotes_data_v1');
      localStorage.removeItem('certam_lotes_data_v2');
      localStorage.removeItem('certam_lotes_data_v3');
      localStorage.removeItem('certam_lotes_data_v4');
      localStorage.removeItem('certam_lotes_data_v5');
      const s = localStorage.getItem(LOTES_KEY);
      if (s) {
        const p = JSON.parse(s);
        if (Array.isArray(p)) return p;
      }
    } catch {
      // ignore
    }
    const defaultLotes: Lote[] = [];
    return defaultLotes;
  },

  salvarLotes(lotes: Lote[], forceReplace = false) {
    try {
      const jsonStr = JSON.stringify(lotes);
      localStorage.setItem(LOTES_KEY, jsonStr);
      cloudSync.pushKey(LOTES_KEY, jsonStr, forceReplace);
      window.dispatchEvent(new CustomEvent('certam_lotes_updated', { detail: lotes }));
    } catch {
      // ignore
    }
  },

  getCandidatos(concursoId: string, cargoId: string): Candidato[] {
    const key = `${CANDIDATOS_KEY}_${concursoId}_${cargoId}`;
    try {
      localStorage.removeItem(`certam_candidatos_data_v4_${concursoId}_${cargoId}`);
      const s = localStorage.getItem(key);
      if (s) {
        const p = JSON.parse(s);
        if (Array.isArray(p)) return p;
      }
    } catch {
      // ignore
    }

    return [];
  },

  salvarCandidatos(concursoId: string, cargoId: string, candidatos: Candidato[], forceReplace = true) {
    const key = `${CANDIDATOS_KEY}_${concursoId}_${cargoId}`;
    try {
      const jsonStr = JSON.stringify(candidatos);
      localStorage.setItem(key, jsonStr);
      cloudSync.pushKey(key, jsonStr, forceReplace);
      window.dispatchEvent(new CustomEvent('certam_candidatos_updated', { detail: candidatos }));
    } catch {
      // ignore
    }
  },

  salvarCandidato(concursoId: string, cargoId: string, candidato: Candidato) {
    const list = this.getCandidatos(concursoId, cargoId);
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
