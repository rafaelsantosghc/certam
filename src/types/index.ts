export interface Cargo {
  id: string;
  nome: string;
  nivel: 'Superior' | 'Médio' | 'Técnico' | 'Fundamental';
  vagas_imediatas: number;
  tem_cr: boolean;
  ativo: boolean;
}

export interface Concurso {
  id: string;
  nome: string;
  orgao: string;
  ano: string;
  edital: string;
  status: 'ativo' | 'Homologado' | 'Convocando' | 'Inscrições Abertas' | 'encerrado';
  descricao: string;
  cargos: Cargo[];
}

export type CotaTipo = 'Ampla' | 'PPP' | 'PCD' | 'Indígena';

export type StatusCandidato = 
  | 'Aguardando'
  | 'Convocado Titular'
  | 'Nomeado'
  | 'Posse'
  | 'Exercício'
  | 'Fim de Fila'
  | 'Desistência';

export type IntencaoTipo = 'Sim' | 'Talvez' | 'final_fila' | 'Não' | 'Indefinido';

export interface Candidato {
  id: string;
  posicao: number;
  nome: string;
  cota: CotaTipo;
  nota_final: number;
  notas_disciplinas?: {
    portugues?: number;
    direito?: number;
    informatica?: number;
    especificos?: number;
  };
  intencao: IntencaoTipo;
  status: StatusCandidato;
  lotacao_atual?: string;
  comarca_desejada_1?: string;
  cpf?: string;
  email?: string;
  whatsapp?: string;
  ordem_nomeacao?: number;
  escolhas_comarcas: string[];
  fg_cc?: {
    possui: boolean;
    registro_funcional?: string;
    cargo_atual?: string;
    comarca_atual?: string;
    pretende_continuar?: string;
  };
}

export interface Comarca {
  id: number;
  nome: string;
  regiao: 'Metropolitana' | 'Serra' | 'Norte' | 'Centro' | 'Sul' | 'Fronteira';
  vagas_total: number;
  entrancia?: 'Inicial' | 'Intermediária' | 'Final';
}

export interface Lote {
  id: string;
  concurso_id: string;
  cargo_id: string;
  nome: string;
  ativo: boolean;
  is_ranking_visible: boolean;
  is_printing_enabled: boolean;
  travado: boolean;
  senha?: string;
  comarcas: { nome: string; vagas: number }[];
  candidatos_ids: string[];
}

export interface ChatMensagem {
  id: string;
  concurso_id: string;
  cargo_id: string;
  autor: string;
  email: string;
  avatar_cor: string;
  texto: string;
  data_hora: string;
  is_admin?: boolean;
}

export interface Usuario {
  nome: string;
  email: string;
  avatar?: string;
  is_admin: boolean;
  candidato_id?: string;
}
