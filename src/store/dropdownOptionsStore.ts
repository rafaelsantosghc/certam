import { cloudSync } from './cloudSync';
import { COMARCAS_RS } from '../data/comarcas';

const STORAGE_KEY = 'certam_dropdown_options_v1';

export interface DropdownOptionsConfig {
  status: string[];
  cotas: string[];
  lotacoes: string[];
}

const DEFAULT_OPTIONS: DropdownOptionsConfig = {
  status: [
    'Aguardando Convocação',
    'Convocado titular',
    'Convocado suplente',
    'Nomeado',
    'Posse',
    'Desistência',
    'Fim de Fila',
    'Exonerado',
    'Em Exercício',
  ],
  cotas: ['Ampla', 'PCD', 'PPP', 'Indígena', 'Trans'],
  lotacoes: COMARCAS_RS.map((c) => c.nome),
};

export const dropdownOptionsStore = {
  getOptions(): DropdownOptionsConfig {
    try {
      const stored = cloudSync.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && Array.isArray(parsed.status) && Array.isArray(parsed.cotas)) {
          return {
            status: parsed.status,
            cotas: parsed.cotas,
            lotacoes: Array.isArray(parsed.lotacoes) && parsed.lotacoes.length > 0
              ? parsed.lotacoes
              : DEFAULT_OPTIONS.lotacoes,
          };
        }
      }
    } catch {
      // ignore
    }
    return DEFAULT_OPTIONS;
  },

  salvarOptions(options: DropdownOptionsConfig) {
    cloudSync.setItem(STORAGE_KEY, options, true);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('certam_dropdown_options_updated', { detail: options }));
    }
  },

  adicionarOpcao(campo: keyof DropdownOptionsConfig, novaOpcao: string) {
    const limpa = novaOpcao.trim();
    if (!limpa) return;
    const current = this.getOptions();
    if (!current[campo].includes(limpa)) {
      current[campo] = [...current[campo], limpa];
      this.salvarOptions(current);
    }
  },

  removerOpcao(campo: keyof DropdownOptionsConfig, opcao: string) {
    const current = this.getOptions();
    current[campo] = current[campo].filter((o) => o !== opcao);
    this.salvarOptions(current);
  },
};
