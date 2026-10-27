export interface Cargo {
  id: string;
  nome: string;
  nivel: 'Superior' | 'Médio' | 'Técnico' | 'Fundamental';
  vagas_imediatas: number;
  tem_cr: boolean;
  ativo: boolean;
  remuneracao_inicial?: string;
  vagas_ocupadas?: number;
  vagas_reais_abertas?: number;
}

export type ConcursoStatus =
  | 'ativo'
  | 'Homologado'
  | 'Convocando'
  | 'Inscrições Abertas'
  | 'previsto'
  | 'encerrado';

export interface CronogramaItem {
  id: string;
  concurso_id: string;
  cargo_id?: string;
  titulo: string;
  data_prevista: string;
  data_realizada?: string;
  status: 'concluido' | 'em_andamento' | 'pendente';
  link_edital?: string;
  descricao?: string;
}

export interface QuadroVagas {
  concurso_id: string;
  cargo_id: string;
  cargo_nome: string;
  cargos_criados_lei: number;
  vagas_ocupadas: number;
  vagas_reais_abertas: number;
  aposentadorias_previstas: number;
  data_atualizacao: string;
  fonte_oficial?: string;
}

export type TipoDocumento =
  | 'Edital de Abertura'
  | 'Retificação'
  | 'Resultado Preliminar'
  | 'Resultado Final'
  | 'Homologação'
  | 'Convocação'
  | 'Decisão Judicial'
  | 'Legislação / PL';

export interface DocumentoItem {
  id: string;
  concurso_id: string;
  cargo_id?: string;
  titulo: string;
  tipo: TipoDocumento;
  data_publicacao: string;
  url_ou_arquivo: string;
  tamanho?: string;
  descricao?: string;
}

export interface ComunicadoItem {
  id: string;
  concurso_id: string;
  cargo_id?: string;
  titulo: string;
  resumo: string;
  texto_completo: string;
  autor: string;
  data: string;
  importante: boolean;
  tags?: string[];
  link_externo?: string;
}

export interface ConvocacaoHistorico {
  id: string;
  concurso_id: string;
  cargo_id: string;
  lote_nome: string;
  numero_chamamento: number;
  data_edital: string;
  total_convocados: number;
  ampla_qtd: number;
  ppp_qtd: number;
  pcd_qtd: number;
  indigena_qtd?: number;
  link_doe?: string;
  status_processamento?: 'Em Andamento' | 'Concluído' | 'Posse Efetuada';
}

export interface Concurso {
  id: string;
  nome: string;
  orgao: string;
  ano: string;
  edital: string;
  status: ConcursoStatus;
  homologado: boolean;
  data_homologacao?: string;
  regiao: 'Sul' | 'Sudeste' | 'Nordeste' | 'Centro-Oeste' | 'Norte' | 'Nacional';
  esfera: 'Estadual' | 'Municipal' | 'Federal';
  estado?: string;
  descricao: string;
  cargos: Cargo[];
  cronograma?: CronogramaItem[];
  documentos?: DocumentoItem[];
  quadro_vagas?: QuadroVagas[];
  comunicados?: ComunicadoItem[];
  convocacoes?: ConvocacaoHistorico[];
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
  concurso_id?: string;
  cargo_id?: string;
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
  data_nascimento?: string;
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

export type FaqCategoria =
  | 'Remuneração e Benefícios'
  | 'Escolha de Lotação'
  | 'Posse e Documentos'
  | 'Carreira e Teletrabalho'
  | 'Recursos e Classificação'
  | 'Geral';

export interface FaqItem {
  id: string;
  concurso_id?: string;
  cargo_id?: string;
  categoria: FaqCategoria;
  pergunta: string;
  resposta: string;
  destaque?: boolean;
  data_atualizacao?: string;
  tags?: string[];
}

export type CanalChatId = 'geral' | 'lotacao' | 'posse' | 'recursos';

export interface ChatMensagem {
  id: string;
  concurso_id: string;
  cargo_id: string;
  canal_id?: CanalChatId;
  autor: string;
  email: string;
  avatar_cor: string;
  texto: string;
  data_hora: string;
  is_admin?: boolean;
  is_fixado?: boolean;
  posicao_candidato?: number;
  comarca_preferida?: string;
  curtidas?: number;
}

export interface OutroConcursoAprovado {
  concurso_nome: string;
  ano: string;
  cargo: string;
  classificacao: number;
  concurso_id?: string;
  cargo_id?: string;
  origem?: 'automatico' | 'manual' | 'solicitado';
  status_aprovacao?: string;
}

export interface UsuarioInscricao {
  concurso_id: string;
  cargo_id: string;
  data_inscricao?: string;
}

export interface Usuario {
  nome: string;
  email: string;
  avatar?: string;
  is_admin: boolean;
  candidato_id?: string;
  telefone?: string;
  whatsapp?: string;
  cpf?: string;
  data_nascimento?: string;
  email_contato?: string;
  outros_concursos?: OutroConcursoAprovado[];
  concursos_inscritos?: UsuarioInscricao[];
  read_notification_ids?: string[];
  canais_silenciados?: string[];
  usuarios_bloqueados?: string[];
  cpf_verificado?: boolean;
}

// -------------------------------------------------------------
// SISTEMA DE AUDITORIA DE ALTERAÇÃO DE PERFIL
// -------------------------------------------------------------
export interface AlteracaoCampoItem {
  campo: string;
  campo_label: string;
  valor_antigo: string;
  valor_novo: string;
}

export interface PerfilAuditRequest {
  id: string;
  usuario_email: string;
  usuario_nome: string;
  cpf: string;
  data_solicitacao: string;
  status: 'pendente' | 'aprovado' | 'rejeitado';
  alteracoes: AlteracaoCampoItem[];
  motivo_rejeicao?: string;
  data_resposta?: string;
}

// -------------------------------------------------------------
// SOLICITAÇÃO DE VINCULAÇÃO MANUAL (CASO NÃO IDENTIFICADO)
// -------------------------------------------------------------
export interface SolicitacaoVinculacao {
  id: string;
  usuario_email: string;
  usuario_nome: string;
  cpf: string;
  concurso_id: string;
  cargo_id: string;
  posicao_declarada: number;
  nota_declarada?: number;
  comprovante_info?: string;
  data_solicitacao: string;
  status: 'pendente' | 'aprovado' | 'rejeitado';
  motivo_rejeicao?: string;
  concurso_nome?: string;
  cargo_nome?: string;
  ano_concurso?: string;
  tipo?: 'vinculacao_nao_efetivada' | 'inclusao_novo_concurso';
}

// -------------------------------------------------------------
// FALE COM O ADMINISTRADOR
// -------------------------------------------------------------
export type MotivoContato =
  | 'inclusao_concurso'
  | 'vinculacao_nao_efetivada'
  | 'erro_classificacao'
  | 'vinculacao_cadastro'
  | 'duvida'
  | 'sugestao'
  | 'outro';

export interface MensagemContatoAdmin {
  id: string;
  usuario_email: string;
  usuario_nome: string;
  motivo: MotivoContato;
  motivo_label: string;
  concurso_nome?: string;
  ano_concurso?: string;
  cargo_nome?: string;
  classificacao?: string;
  mensagem: string;
  data_envio: string;
  status: 'aberto' | 'respondido' | 'arquivado';
  resposta_admin?: string;
  data_resposta?: string;
}

// -------------------------------------------------------------
// MENSAGENS PRIVADAS (1 a 1) E BLOQUEIOS
// -------------------------------------------------------------
export interface MensagemPrivada {
  id: string;
  remetente_email: string;
  remetente_nome: string;
  destinatario_email: string;
  destinatario_nome: string;
  concurso_referencia_id?: string;
  cargo_referencia_id?: string;
  texto: string;
  data_hora: string;
  lida: boolean;
}

export interface BloqueioUsuario {
  usuario_email: string;
  usuario_bloqueado_email: string;
  data_bloqueio: string;
}

// -------------------------------------------------------------
// NOTIFICAÇÕES INTERNAS OTIMIZADAS NO PORTAL
// -------------------------------------------------------------
export type TipoNotificacao =
  | 'convocacao'
  | 'cronograma'
  | 'documento'
  | 'chat'
  | 'aprovacao_perfil'
  | 'indeferimento_perfil'
  | 'validacao_aprovada'
  | 'validacao_indeferida'
  | 'comunicado'
  | 'geral';

export interface NotificacaoItem {
  id: string;
  concurso_id?: string;
  cargo_id?: string;
  destinatario_email?: string;
  destinatario_nome?: string;
  titulo: string;
  mensagem: string;
  tipo: TipoNotificacao;
  data_hora: string;
  link_destino?: string;
  urgente?: boolean;
  motivo_justificativa?: string;
}
