import { Concurso, Cargo, CronogramaItem, DocumentoItem, QuadroVagas, ComunicadoItem, ConvocacaoHistorico } from '../types';
import { cloudSync } from './cloudSync';

const STORAGE_KEY = 'certam_concursos_cargos_v6';
const BANNED_LEGACY_IDS = new Set(['tjrs_2024', 'tjrs_analista_2024', 'mprs_2024']);

function isLegacyBannedConcurso(c: any): boolean {
  if (!c || typeof c !== 'object') return true;
  const id = String(c.id || '').toLowerCase();
  if (BANNED_LEGACY_IDS.has(id)) return true;
  if (String(c.orgao || '').toUpperCase() === 'TJRS' && String(c.ano || '') === '2024') {
    return true;
  }
  return false;
}

export const DEFAULT_CONCURSOS: Concurso[] = [
  {
    id: 'tjrs_2025',
    nome: 'Concurso TJRS - Tribunal de Justiça do Rio Grande do Sul',
    orgao: 'TJRS',
    ano: '2025',
    edital: 'Edital 01/2025',
    status: 'Homologado',
    homologado: true,
    regiao: 'Sul',
    esfera: 'Estadual',
    estado: 'RS',
    descricao: 'Tribunal de Justiça do Estado do Rio Grande do Sul',
    tipo_lotacao: 'Comarca',
    cargos: [
      {
        id: 'analista_judici_rio___rea_judici',
        nome: 'Analista Judiciário - Área Judiciária',
        nivel: 'Superior',
        vagas_imediatas: 0,
        tem_cr: true,
        ativo: true,
      },
      {
        id: 'analista_judici_rio___rea_admini',
        nome: 'Analista Judiciário - Área Administrativa',
        nivel: 'Superior',
        vagas_imediatas: 0,
        tem_cr: true,
        ativo: true,
      },
      {
        id: 't_cnico_judici_rio___rea_adminis',
        nome: 'Técnico Judiciário - Área Administrativa',
        nivel: 'Médio',
        vagas_imediatas: 0,
        tem_cr: true,
        ativo: true,
      },
    ],
  },
  {
    id: 'test_2025',
    nome: 'TEST - 2025',
    orgao: 'TEST',
    ano: '2025',
    edital: 'Edital 01/2025',
    status: 'Homologado',
    homologado: true,
    regiao: 'Sul',
    esfera: 'Estadual',
    estado: 'RS',
    descricao: '',
    tipo_lotacao: 'Lotação',
    cargos: [
      {
        id: 'geral',
        nome: 'Cargo Geral',
        nivel: 'Superior',
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
      const stored = cloudSync.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          const filtered = parsed.filter((c) => !isLegacyBannedConcurso(c));
          if (filtered.length !== parsed.length) {
            // Remove permanentemente o tjrs_2024 legado do armazenamento local
            if (filtered.length > 0) {
              cloudSync.setItem(STORAGE_KEY, filtered, true);
              return filtered;
            }
          }
          if (filtered.length > 0) {
            return filtered;
          }
        }
      }
    } catch {
      // Fallback
    }
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

  salvarConcurso(concurso: Concurso, forceReplace = true): boolean {
    if (!concurso || !concurso.id) return false;
    const list = [...this.getConcursos()].filter((c) => !isLegacyBannedConcurso(c));
    const index = list.findIndex((c) => c.id === concurso.id);
    if (!Array.isArray(concurso.cargos) || concurso.cargos.length === 0) {
      concurso.cargos = [
        {
          id: 'geral',
          nome: 'Cargo Geral',
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
    this.salvarTodos(list, forceReplace);
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
    return this.salvarConcurso(conc, true);
  },

  removerCargo(concursoId: string, cargoId: string): boolean {
    const conc = this.getConcurso(concursoId);
    if (!conc || !conc.cargos) return false;
    conc.cargos = conc.cargos.filter((cg) => cg.id !== cargoId);
    return this.salvarConcurso(conc, true);
  },

  removerConcurso(concursoId: string): boolean {
    const list = this.getConcursos().filter(
      (c) => c.id !== concursoId && !isLegacyBannedConcurso(c)
    );
    this.salvarTodos(list, true);
    return true;
  },

  salvarTodos(concursos: Concurso[], forceReplace = true) {
    const cleanList = concursos.filter((c) => !isLegacyBannedConcurso(c));
    cloudSync.setItem(STORAGE_KEY, cleanList, forceReplace);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('certam_concursos_updated', { detail: cleanList }));
    }
  },

  // Documentos
  adicionarDocumento(concursoId: string, doc: DocumentoItem) {
    const conc = this.getConcurso(concursoId);
    if (!conc) return;
    conc.documentos = conc.documentos || [];
    conc.documentos.unshift(doc);
    this.salvarConcurso(conc, true);
  },

  // Comunicados
  adicionarComunicado(concursoId: string, com: ComunicadoItem) {
    const conc = this.getConcurso(concursoId);
    if (!conc) return;
    conc.comunicados = conc.comunicados || [];
    conc.comunicados.unshift(com);
    this.salvarConcurso(conc, true);
  },

  // Cronograma
  atualizarCronograma(concursoId: string, cronograma: CronogramaItem[], cargoId?: string) {
    const conc = this.getConcurso(concursoId);
    if (!conc) return;

    if (cargoId) {
      // Mantém as etapas dos outros cargos e substitui apenas as deste cargoId
      const deOutrosCargos = (conc.cronograma || []).filter(
        (et) => et.cargo_id && et.cargo_id !== cargoId
      );
      const desteCargo = cronograma.map((et) => ({
        ...et,
        concurso_id: concursoId,
        cargo_id: cargoId,
      }));
      conc.cronograma = [...deOutrosCargos, ...desteCargo];
    } else {
      conc.cronograma = cronograma;
    }

    this.salvarConcurso(conc, true);
  },

  // Catálogo de Lotações do Concurso
  adicionarLotacaoAoCatalogo(concursoId: string, nomeLotacao: string, regiao?: string): boolean {
    const conc = this.getConcurso(concursoId);
    if (!conc) return false;
    const nomeTrim = nomeLotacao.trim();
    if (!nomeTrim) return false;

    conc.catalogo_lotacoes = conc.catalogo_lotacoes || [];
    const existe = conc.catalogo_lotacoes.some(
      (l) => l.nome.toLowerCase() === nomeTrim.toLowerCase()
    );
    if (existe) return false;

    conc.catalogo_lotacoes.push({
      id: `lot-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      nome: nomeTrim,
      regiao,
      vagas_total: 0,
    });
    conc.catalogo_lotacoes.sort((a, b) => a.nome.localeCompare(b.nome));
    this.salvarConcurso(conc, true);
    return true;
  },

  adicionarLotacoesAoCatalogoEmLote(concursoId: string, nomesLotacoes: string[]): number {
    const conc = this.getConcurso(concursoId);
    if (!conc || !nomesLotacoes || nomesLotacoes.length === 0) return 0;

    conc.catalogo_lotacoes = conc.catalogo_lotacoes || [];
    const existentesLower = new Set(conc.catalogo_lotacoes.map((l) => l.nome.toLowerCase()));
    let adicionadas = 0;

    nomesLotacoes.forEach((nomeRaw, idx) => {
      const nomeTrim = (nomeRaw || '').trim();
      if (!nomeTrim) return;
      const key = nomeTrim.toLowerCase();
      if (existentesLower.has(key)) return;
      existentesLower.add(key);
      conc.catalogo_lotacoes!.push({
        id: `lot-${Date.now().toString(36)}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
        nome: nomeTrim,
        vagas_total: 0,
      });
      adicionadas++;
    });

    if (adicionadas > 0) {
      conc.catalogo_lotacoes.sort((a, b) => a.nome.localeCompare(b.nome));
      this.salvarConcurso(conc, true);
    }
    return adicionadas;
  },

  removerLotacaoDoCatalogo(concursoId: string, lotacaoId: string): boolean {
    const conc = this.getConcurso(concursoId);
    if (!conc || !conc.catalogo_lotacoes) return false;
    conc.catalogo_lotacoes = conc.catalogo_lotacoes.filter((l) => l.id !== lotacaoId);
    this.salvarConcurso(conc, true);
    return true;
  },
};
