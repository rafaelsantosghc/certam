import { Concurso, Cargo } from '../types';

const STORAGE_KEY = 'certam_concursos_cargos';

export const DEFAULT_CONCURSOS: Concurso[] = [
  {
    id: 'tjrs_2024',
    nome: 'Concurso TJRS - Tribunal de Justiça do Rio Grande do Sul',
    orgao: 'TJRS',
    ano: '2024',
    edital: 'Edital 01/2024',
    status: 'ativo',
    descricao: 'Tribunal de Justiça do Estado do Rio Grande do Sul - Servidores da Justiça Estadual',
    cargos: [
      {
        id: 'analista_judiciario',
        nome: 'Analista Judiciário - Área Judiciária',
        nivel: 'Superior',
        vagas_imediatas: 38,
        tem_cr: true,
        ativo: true,
      },
      {
        id: 'tecnico_judiciario',
        nome: 'Técnico Judiciário - Área Administrativa',
        nivel: 'Médio',
        vagas_imediatas: 0,
        tem_cr: true,
        ativo: true,
      },
    ],
  },
];

export const certamStore = {
  getConcursos(): Concurso[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // Fallback
    }
    this.salvarTodos(DEFAULT_CONCURSOS);
    return DEFAULT_CONCURSOS;
  },

  getConcurso(id: string): Concurso | null {
    const list = this.getConcursos();
    return list.find((c) => c.id === id || (id === 'tjrs' && c.id === 'tjrs_2024')) || list[0] || null;
  },

  getCargo(concursoId: string, cargoId: string): Cargo | null {
    const conc = this.getConcurso(concursoId);
    if (!conc || !conc.cargos) return null;
    return conc.cargos.find((cg) => cg.id === cargoId) || conc.cargos[0] || null;
  },

  salvarConcurso(concurso: Concurso): boolean {
    if (!concurso || !concurso.id) return false;
    const list = this.getConcursos();
    const index = list.findIndex((c) => c.id === concurso.id);
    if (!Array.isArray(concurso.cargos) || concurso.cargos.length === 0) {
      concurso.cargos = [
        {
          id: 'geral',
          nome: 'Geral / Lista Única',
          nivel: 'Superior',
          vagas_imediatas: 0,
          tem_cr: true,
          ativo: true,
        },
      ];
    }
    if (index >= 0) {
      list[index] = { ...list[index], ...concurso };
    } else {
      list.push(concurso);
    }
    this.salvarTodos(list);
    return true;
  },

  salvarCargo(concursoId: string, cargo: Cargo): boolean {
    const conc = this.getConcurso(concursoId);
    if (!conc) return false;
    if (!conc.cargos) conc.cargos = [];
    const index = conc.cargos.findIndex((c) => c.id === cargo.id);
    if (index >= 0) {
      conc.cargos[index] = { ...conc.cargos[index], ...cargo };
    } else {
      conc.cargos.push(cargo);
    }
    return this.salvarConcurso(conc);
  },

  excluirCargo(concursoId: string, cargoId: string): boolean {
    const conc = this.getConcurso(concursoId);
    if (!conc || !conc.cargos) return false;
    conc.cargos = conc.cargos.filter((c) => c.id !== cargoId);
    return this.salvarConcurso(conc);
  },

  excluirConcurso(id: string): boolean {
    const list = this.getConcursos().filter((c) => c.id !== id);
    this.salvarTodos(list);
    return true;
  },

  salvarTodos(list: Concurso[]) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      window.dispatchEvent(new CustomEvent('certam_concursos_updated', { detail: list }));
    } catch {
      // ignore
    }
  },
};
