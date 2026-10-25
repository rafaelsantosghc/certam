import { Candidato, Lote, Comarca } from '../types';
import { CANDIDATOS_ANALISTA_TJRS, CANDIDATOS_TECNICO_TJRS } from '../data/defaultCandidates';
import { COMARCAS_RS } from '../data/comarcas';

const LOTES_KEY = 'certam_lotes_data';
const CANDIDATOS_KEY = 'certam_candidatos_data';
const CONFIG_KEY = 'certam_config_data';

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
      const s = localStorage.getItem(LOTES_KEY);
      if (s) {
        const p = JSON.parse(s);
        if (Array.isArray(p) && p.length > 0) return p;
      }
    } catch {
      // ignore
    }
    const defaultLotes: Lote[] = [
      {
        id: 'lote_1',
        concurso_id: 'tjrs_2024',
        cargo_id: 'analista_judiciario',
        nome: 'Lote 1 (1º Chamamento Oficial)',
        ativo: true,
        is_ranking_visible: true,
        is_printing_enabled: true,
        travado: false,
        comarcas: COMARCAS_RS.map((c) => ({ nome: c.nome, vagas: c.vagas_total })),
        candidatos_ids: CANDIDATOS_ANALISTA_TJRS.map((c) => c.id),
      },
    ];
    this.salvarLotes(defaultLotes);
    return defaultLotes;
  },

  salvarLotes(lotes: Lote[]) {
    try {
      localStorage.setItem(LOTES_KEY, JSON.stringify(lotes));
      window.dispatchEvent(new CustomEvent('certam_lotes_updated', { detail: lotes }));
    } catch {
      // ignore
    }
  },

  getCandidatos(concursoId: string, cargoId: string): Candidato[] {
    const key = `${CANDIDATOS_KEY}_${concursoId}_${cargoId}`;
    try {
      const s = localStorage.getItem(key);
      if (s) {
        const p = JSON.parse(s);
        if (Array.isArray(p) && p.length > 0) return p;
      }
    } catch {
      // ignore
    }
    const base = cargoId === 'tecnico_judiciario' ? CANDIDATOS_TECNICO_TJRS : CANDIDATOS_ANALISTA_TJRS;
    this.salvarCandidatos(concursoId, cargoId, base);
    return base;
  },

  salvarCandidatos(concursoId: string, cargoId: string, candidatos: Candidato[]) {
    const key = `${CANDIDATOS_KEY}_${concursoId}_${cargoId}`;
    try {
      localStorage.setItem(key, JSON.stringify(candidatos));
      window.dispatchEvent(new CustomEvent('certam_candidatos_updated', { detail: candidatos }));
    } catch {
      // ignore
    }
  },

  salvarCandidato(concursoId: string, cargoId: string, candidato: Candidato) {
    const list = this.getCandidatos(concursoId, cargoId);
    const index = list.findIndex((c) => c.id === candidato.id || (candidato.email && c.email === candidato.email));
    if (index >= 0) {
      list[index] = { ...list[index], ...candidato };
    } else {
      list.push(candidato);
    }
    this.salvarCandidatos(concursoId, cargoId, list);
    return list;
  },

  getConfig(chave: string, valorPadrao: unknown = null) {
    try {
      const s = localStorage.getItem(`${CONFIG_KEY}_${chave}`);
      if (s) return JSON.parse(s);
    } catch {
      // ignore
    }
    return valorPadrao;
  },

  salvarConfig(chave: string, valor: unknown) {
    try {
      localStorage.setItem(`${CONFIG_KEY}_${chave}`, JSON.stringify(valor));
    } catch {
      // ignore
    }
  },

  // Executa o algoritmo oficial de simulação de escolha de comarcas
  simularLotacao(
    candidatos: Candidato[],
    comarcasCatalogo: Comarca[] = COMARCAS_RS
  ): SimulacaoResultado {
    const ordenados = [...candidatos].sort((a, b) => a.posicao - b.posicao);

    // Mapeamento de vagas totais
    const vagasOcupadas: Record<string, number> = {};
    const vagasRestantes: Record<string, number> = {};
    let totalVagasOfertadas = 0;

    comarcasCatalogo.forEach((c) => {
      vagasOcupadas[c.nome] = 0;
      vagasRestantes[c.nome] = c.vagas_total;
      totalVagasOfertadas += c.vagas_total;
    });

    let totalDesistencias = 0;
    let totalAssumem = 0;

    const alocacoes = ordenados.map((cand) => {
      if (cand.intencao === 'Não' || cand.status === 'Desistência') {
        totalDesistencias++;
        return {
          candidatoId: cand.id,
          candidatoNome: cand.nome,
          posicao: cand.posicao,
          comarcaAlocada: null,
          preferenciaNumero: null,
          status: 'Desistência / Renúncia',
          cota: cand.cota,
          intencao: cand.intencao,
        };
      }

      if (cand.intencao === 'final_fila' || cand.status === 'Fim de Fila') {
        return {
          candidatoId: cand.id,
          candidatoNome: cand.nome,
          posicao: cand.posicao,
          comarcaAlocada: null,
          preferenciaNumero: null,
          status: 'Fim de Fila Requerido',
          cota: cand.cota,
          intencao: cand.intencao,
        };
      }

      totalAssumem++;

      // Tenta alocar a melhor comarca da lista de prioridades do candidato
      let comarcaEscolhida: string | null = null;
      let preferenciaIndex: number | null = null;

      const escolhas = cand.escolhas_comarcas || [];
      for (let i = 0; i < escolhas.length; i++) {
        const comarca = escolhas[i];
        if (vagasRestantes[comarca] && vagasRestantes[comarca] > 0) {
          comarcaEscolhida = comarca;
          preferenciaIndex = i + 1;
          vagasOcupadas[comarca] = (vagasOcupadas[comarca] || 0) + 1;
          vagasRestantes[comarca] -= 1;
          break;
        }
      }

      // Se não escolheu nenhuma comarca específica ou todas esgotaram, verifica a primeira comarca desejada informada
      if (!comarcaEscolhida && cand.comarca_desejada_1 && (vagasRestantes[cand.comarca_desejada_1] || 0) > 0) {
        comarcaEscolhida = cand.comarca_desejada_1;
        preferenciaIndex = 1;
        vagasOcupadas[comarcaEscolhida] = (vagasOcupadas[comarcaEscolhida] || 0) + 1;
        vagasRestantes[comarcaEscolhida] -= 1;
      }

      return {
        candidatoId: cand.id,
        candidatoNome: cand.nome,
        posicao: cand.posicao,
        comarcaAlocada: comarcaEscolhida,
        preferenciaNumero: preferenciaIndex,
        status: comarcaEscolhida ? `Alocado (${preferenciaIndex}ª Opção)` : 'Sem Vaga nas Opções Escolhidas',
        cota: cand.cota,
        intencao: cand.intencao,
      };
    });

    const totalVagasPreenchidas = Object.values(vagasOcupadas).reduce((acc, curr) => acc + curr, 0);

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
};
