import { Concurso, Cargo, CronogramaItem, DocumentoItem, QuadroVagas, ComunicadoItem, ConvocacaoHistorico } from '../types';

const STORAGE_KEY = 'certam_concursos_cargos_v6';

export const DEFAULT_CONCURSOS: Concurso[] = [];

export const certamStore = {
  getConcursos(): Concurso[] {
    try {
      localStorage.removeItem('certam_concursos_cargos_v1');
      localStorage.removeItem('certam_concursos_cargos_v2');
      localStorage.removeItem('certam_concursos_cargos_v3');
      localStorage.removeItem('certam_concursos_cargos_v4');
      localStorage.removeItem('certam_concursos_cargos_v5');

      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
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
    if (!id) return null;
    const list = this.getConcursos();
    return list.find((c) => c.id === id) || null;
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
    const index = conc.cargos.findIndex((cg) => cg.id === cargo.id);
    if (index >= 0) {
      conc.cargos[index] = { ...conc.cargos[index], ...cargo };
    } else {
      conc.cargos.push(cargo);
    }
    return this.salvarConcurso(conc);
  },

  removerCargo(concursoId: string, cargoId: string): boolean {
    const conc = this.getConcurso(concursoId);
    if (!conc || !conc.cargos) return false;
    conc.cargos = conc.cargos.filter((cg) => cg.id !== cargoId);
    return this.salvarConcurso(conc);
  },

  removerConcurso(concursoId: string): boolean {
    const list = this.getConcursos().filter((c) => c.id !== concursoId);
    this.salvarTodos(list);
    return true;
  },

  salvarTodos(concursos: Concurso[]) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(concursos));
      window.dispatchEvent(new CustomEvent('certam_concursos_updated', { detail: concursos }));
    } catch {
      // ignore
    }
  },

  // Documentos
  adicionarDocumento(concursoId: string, doc: DocumentoItem) {
    const conc = this.getConcurso(concursoId);
    if (!conc) return;
    conc.documentos = conc.documentos || [];
    conc.documentos.unshift(doc);
    this.salvarConcurso(conc);
  },

  // Comunicados
  adicionarComunicado(concursoId: string, com: ComunicadoItem) {
    const conc = this.getConcurso(concursoId);
    if (!conc) return;
    conc.comunicados = conc.comunicados || [];
    conc.comunicados.unshift(com);
    this.salvarConcurso(conc);
  },

  // Cronograma
  atualizarCronograma(concursoId: string, cronograma: CronogramaItem[]) {
    const conc = this.getConcurso(concursoId);
    if (!conc) return;
    conc.cronograma = cronograma;
    this.salvarConcurso(conc);
  },
};
