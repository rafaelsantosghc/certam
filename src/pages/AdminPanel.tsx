import React, { useState, useMemo, useEffect } from 'react';
import { certamStore } from '../store/certamStore';
import { lotesStore } from '../store/lotesStore';
import { faqStore } from '../store/faqStore';
import { auditStore } from '../store/auditStore';
import { contactStore } from '../store/contactStore';
import { notificationStore } from '../store/notificationStore';
import { cloudSync, FullSyncDiagnosticsReport } from '../store/cloudSync';
import { errorLogStore, ErrorLogEntry } from '../store/errorLogStore';
import { useAuth } from '../store/authContext';
import {
  Concurso,
  Cargo,
  Candidato,
  FaqItem,
  FaqCategoria,
  PerfilAuditRequest,
  SolicitacaoVinculacao,
  MensagemContatoAdmin,
  NotificacaoItem,
  TipoNotificacao,
  Lote,
  DocumentoItem,
  TipoDocumento,
} from '../types';
import { sanitizeInput, sanitizeFileName } from '../utils/security';
import { normalizarCota } from '../utils/ordemNomeacao';
import * as XLSX from 'xlsx';
import {
  Plus,
  Trash2,
  Search,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  Users,
  Building,
  Pencil,
  Check,
  HelpCircle,
  Bookmark,
  Sparkles,
  Lock,
  ShieldCheck,
  UserCheck,
  Mail,
  Bell,
  ArrowRight,
  X,
  XCircle,
  MessageSquare,
  AlertTriangle,
  AlertCircle,
  Send,
  Inbox,
  ArrowLeft,
  Download,
  Upload,
  Layers,
  Briefcase,
  Eye,
} from 'lucide-react';
import { ModalDetalhesCandidatoAdmin } from '../components/ModalDetalhesCandidatoAdmin';
import { userRegistryStore } from '../store/userRegistryStore';
import { MASTER_CADASTRO_GERAL, normalizarTexto, limparCpf } from '../data/defaultCandidates';
import { ModalEditarConcurso } from '../components/ModalEditarConcurso';
import { ModalEditarCargo } from '../components/ModalEditarCargo';
import { ModalEditarLote } from '../components/ModalEditarLote';
import {
  obterMetadadosVisuaisNotificacao,
  isNotificacaoParaAdmin,
  isNotificacaoExclusivaCandidato,
} from '../utils/notificationUtils';

interface AdminPanelProps {
  initialTab?: string;
  onNavigate: (view: string, params?: { concursoId?: string; cargoId?: string; tab?: string }) => void;
  onVoltar?: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  initialTab = 'concursos',
  onNavigate,
  onVoltar,
}) => {
  const { usuario, isAdmin, loginGoogle, loginAdminPreview, atualizarDadosUsuario } = useAuth();
  const [senhaAdmin, setSenhaAdmin] = useState('');
  const [erroSenha, setErroSenha] = useState(false);

  // Garante que as credenciais do administrador estejam sincronizadas no contexto global ao acessar o AdminPanel
  useEffect(() => {
    if (isAdmin && usuario && (!usuario.is_admin || usuario.role !== 'admin' || !usuario.email)) {
      atualizarDadosUsuario({
        is_admin: true,
        role: 'admin',
        tipo_usuario: 'admin',
        email: usuario.email || 'rafasms0@hotmail.com',
      });
    }
  }, [isAdmin, usuario, atualizarDadosUsuario]);

  const abasAdminValidas = new Set([
    'concursos',
    'lotes',
    'cadastros',
    'auditoria',
    'validacoes',
    'contatos',
    'notificacoes',
    'candidatos',
    'importar',
    'faq',
    'supabase',
    'logs_erros',
    'documentos_admin',
    'classificacao_admin',
    'vagas_admin',
  ]);

  const [abaAdmin, setAbaAdmin] = useState<
    | 'concursos'
    | 'lotes'
    | 'cadastros'
    | 'auditoria'
    | 'validacoes'
    | 'contatos'
    | 'notificacoes'
    | 'candidatos'
    | 'importar'
    | 'faq'
    | 'supabase'
    | 'logs_erros'
    | 'documentos_admin'
    | 'classificacao_admin'
    | 'vagas_admin'
  >(() => (initialTab && abasAdminValidas.has(initialTab) ? (initialTab as any) : 'concursos'));

  useEffect(() => {
    if (initialTab && abasAdminValidas.has(initialTab)) {
      setAbaAdmin(initialTab as any);
    }
  }, [initialTab]);

  useEffect(() => {
    const handleAbrirAba = (e: any) => {
      const target = e?.detail;
      if (target && abasAdminValidas.has(target)) {
        setAbaAdmin(target);
      }
    };
    window.addEventListener('certam_abrir_aba_admin', handleAbrirAba);
    return () => window.removeEventListener('certam_abrir_aba_admin', handleAbrirAba);
  }, []);

  const [diagReport, setDiagReport] = useState<FullSyncDiagnosticsReport | null>(null);
  const [diagLoading, setDiagLoading] = useState(false);
  const [cleaningConflicts, setCleaningConflicts] = useState(false);
  const [supabaseUrlInput, setSupabaseUrlInput] = useState<string>(
    () => cloudSync.getSupabaseConfig()?.url || ''
  );
  const [supabaseKeyInput, setSupabaseKeyInput] = useState<string>(
    () => cloudSync.getSupabaseConfig()?.anonKey || ''
  );

  // Estados do Monitor Centralizado de Erros (ErrorBoundary -> Supabase public.error_logs)
  const [errorLogs, setErrorLogs] = useState<ErrorLogEntry[]>(() => errorLogStore.getLogs());
  const [errorTableStatus, setErrorTableStatus] = useState<{ tableExists: boolean; error?: string }>({
    tableExists: false,
  });
  const [loadingErrorLogs, setLoadingErrorLogs] = useState(false);
  const [sqlErrorTableCopiado, setSqlErrorTableCopiado] = useState(false);
  const [filtroErroStatus, setFiltroErroStatus] = useState<'todos' | 'pendentes' | 'resolvidos'>('todos');
  const [buscaErroLog, setBuscaErroLog] = useState('');

  const [concursos, setConcursos] = useState<Concurso[]>(() => certamStore.getConcursos());
  const [lotesLista, setLotesLista] = useState<Lote[]>(() => lotesStore.getLotes());
  const [filtroLoteConcurso, setFiltroLoteConcurso] = useState<string>('todos');
  const [modalEditarLoteAberto, setModalEditarLoteAberto] = useState(false);
  const [loteEditando, setLoteEditando] = useState<Lote | null>(null);
  const [loteConcursoAlvoId, setLoteConcursoAlvoId] = useState<string>('');
  const [loteCargoAlvoId, setLoteCargoAlvoId] = useState<string>('');
  const [busca, setBusca] = useState('');

  // Estados para Gestão Administrativa (Documentos, Classificação, Vagas)
  const [docAdminConcursoId, setDocAdminConcursoId] = useState<string>(concursos[0]?.id || '');
  const [docAdminTitulo, setDocAdminTitulo] = useState('');
  const [docAdminTipo, setDocAdminTipo] = useState<TipoDocumento>('Edital de Abertura');
  const [docAdminUrl, setDocAdminUrl] = useState('');
  const [docAdminDesc, setDocAdminDesc] = useState('');
  const [docAdminEditandoId, setDocAdminEditandoId] = useState<string | null>(null);

  const [classifAdminConcursoId, setClassifAdminConcursoId] = useState<string>(concursos[0]?.id || '');
  const [classifAdminCargoId, setClassifAdminCargoId] = useState<string>(concursos[0]?.cargos?.[0]?.id || '');
  const [novoOpcaoDropdown, setNovoOpcaoDropdown] = useState('');

  const [vagasAdminConcursoId, setVagasAdminConcursoId] = useState<string>(concursos[0]?.id || '');
  const [vagasAdminCargoId, setVagasAdminCargoId] = useState<string>(concursos[0]?.cargos?.[0]?.id || '');

  // -------------------------------------------------------------
  // CADASTRO GERAL DE USUÁRIOS (Item 18)
  // -------------------------------------------------------------
  const [usuariosGerais, setUsuariosGerais] = useState<any[]>(() =>
    userRegistryStore.getAllUsers()
  );
  const [buscaUsuario, setBuscaUsuario] = useState('');
  const [filtroStatusUsuario, setFiltroStatusUsuario] = useState<string>('todos');
  const [filtroRoleUsuario, setFiltroRoleUsuario] = useState<string>('todos');
  const [modalEditarUsuarioAberto, setModalEditarUsuarioAberto] = useState(false);
  const [usuarioEditando, setUsuarioEditando] = useState<any | null>(null);
  const [modalNovoUsuarioAberto, setModalNovoUsuarioAberto] = useState(false);
  const [modalDetalhesUsuarioAberto, setModalDetalhesUsuarioAberto] = useState(false);
  const [usuarioDetalhes, setUsuarioDetalhes] = useState<any | null>(null);
  const [userFormNome, setUserFormNome] = useState('');
  const [userFormCpf, setUserFormCpf] = useState('');
  const [userFormEmail, setUserFormEmail] = useState('');
  const [userFormTelefone, setUserFormTelefone] = useState('');
  const [userFormRole, setUserFormRole] = useState<'admin' | 'candidato'>('candidato');
  const [userFormStatus, setUserFormStatus] = useState<'ativo' | 'primeiro_acesso' | 'aguardando_primeiro_acesso'>('ativo');
  const [userFormBloqueado, setUserFormBloqueado] = useState(false);
  const [vinculoCandSelecionado, setVinculoCandSelecionado] = useState<Record<string, string>>({});

  // -------------------------------------------------------------
  // DADOS AUDITORIA, VINCULAÇÕES, CONTATOS & NOTIFICAÇÕES
  // -------------------------------------------------------------
  const [auditRequests, setAuditRequests] = useState<PerfilAuditRequest[]>(() =>
    auditStore.getAuditRequests()
  );
  const [vinculacoes, setVinculacoes] = useState<SolicitacaoVinculacao[]>(() =>
    auditStore.getVinculacoes()
  );
  const [contatos, setContatos] = useState<MensagemContatoAdmin[]>(() =>
    contactStore.getMensagens()
  );
  const [notificacoes, setNotificacoes] = useState<NotificacaoItem[]>(() =>
    notificationStore.getNotificacoes()
  );

  useEffect(() => {
    const handleAudit = () => setAuditRequests(auditStore.getAuditRequests());
    const handleVinc = () => setVinculacoes(auditStore.getVinculacoes());
    const handleCont = () => setContatos(contactStore.getMensagens());
    const handleNotif = () => setNotificacoes(notificationStore.getNotificacoes());
    const handleUsers = () => setUsuariosGerais(userRegistryStore.getAllUsers());

    const handleConcursos = () => setConcursos(certamStore.getConcursos());
    const handleLotes = () => setLotesLista(lotesStore.getLotes());
    const handleErrorLogs = () => setErrorLogs(errorLogStore.getLogs());

    const handleStorage = () => {
      setAuditRequests(auditStore.getAuditRequests());
      setVinculacoes(auditStore.getVinculacoes());
      setContatos(contactStore.getMensagens());
      setNotificacoes(notificationStore.getNotificacoes());
      setConcursos(certamStore.getConcursos());
      setLotesLista(lotesStore.getLotes());
      setUsuariosGerais(userRegistryStore.getAllUsers());
      setErrorLogs(errorLogStore.getLogs());
    };

    window.addEventListener('certam_audit_updated', handleAudit);
    window.addEventListener('certam_vinculacoes_updated', handleVinc);
    window.addEventListener('certam_contact_updated', handleCont);
    window.addEventListener('certam_notifications_updated', handleNotif);
    window.addEventListener('certam_users_updated', handleUsers);
    window.addEventListener('certam_concursos_updated', handleConcursos);
    window.addEventListener('certam_lotes_updated', handleLotes);
    window.addEventListener('certam_error_logs_updated', handleErrorLogs);
    window.addEventListener('storage', handleStorage);

    const refreshInterval = window.setInterval(() => {
      setAuditRequests(auditStore.getAuditRequests());
      setVinculacoes(auditStore.getVinculacoes());
      setContatos(contactStore.getMensagens());
      setNotificacoes(notificationStore.getNotificacoes());
      setUsuariosGerais(userRegistryStore.getAllUsers());
      setConcursos(certamStore.getConcursos());
      setLotesLista(lotesStore.getLotes());
      setErrorLogs(errorLogStore.getLogs());
    }, 3500);

    return () => {
      window.clearInterval(refreshInterval);
      window.removeEventListener('certam_audit_updated', handleAudit);
      window.removeEventListener('certam_vinculacoes_updated', handleVinc);
      window.removeEventListener('certam_contact_updated', handleCont);
      window.removeEventListener('certam_notifications_updated', handleNotif);
      window.removeEventListener('certam_users_updated', handleUsers);
      window.removeEventListener('certam_concursos_updated', handleConcursos);
      window.removeEventListener('certam_lotes_updated', handleLotes);
      window.removeEventListener('certam_error_logs_updated', handleErrorLogs);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  // Recarregar dados e sincronizar com servidor sempre que o admin trocar de aba no painel (Item 2 e Item 5)
  useEffect(() => {
    const syncAndRefresh = async () => {
      await cloudSync.pullFromServer();
      setAuditRequests(auditStore.getAuditRequests());
      setVinculacoes(auditStore.getVinculacoes());
      setContatos(contactStore.getMensagens());
      setNotificacoes(notificationStore.getNotificacoes());
      setConcursos(certamStore.getConcursos());
      setLotesLista(lotesStore.getLotes());
      setUsuariosGerais(userRegistryStore.getAllUsers());
      setErrorLogs(errorLogStore.getLogs());
      if (abaAdmin === 'logs_erros' || abaAdmin === 'supabase') {
        const res = await errorLogStore.fetchFromSupabaseTable();
        setErrorLogs(res.logs);
        setErrorTableStatus({ tableExists: res.tableExists, error: res.error });
      }
    };
    syncAndRefresh();
  }, [abaAdmin]);

  // Modais e Estados de FAQ
  const [faqs, setFaqs] = useState<FaqItem[]>(() => faqStore.getFaqs());
  const [buscaFaq, setBuscaFaq] = useState('');
  const [modalNovoFaqAberto, setModalNovoFaqAberto] = useState(false);
  const [modalEditarFaqAberto, setModalEditarFaqAberto] = useState(false);
  const [faqEditandoId, setFaqEditandoId] = useState<string>('');
  const [faqPergunta, setFaqPergunta] = useState('');
  const [faqResposta, setFaqResposta] = useState('');
  const [faqCategoria, setFaqCategoria] = useState<FaqCategoria>('Remuneração e Benefícios');
  const [faqConcursoId, setFaqConcursoId] = useState<string>('tjrs_2025');
  const [faqDestaque, setFaqDestaque] = useState(false);
  const [faqTags, setFaqTags] = useState('');

  // Modais de Criação de Concurso e Cargo
  const [modalNovoConcursoAberto, setModalNovoConcursoAberto] = useState(false);
  const [modalNovoCargoAberto, setModalNovoCargoAberto] = useState(false);
  const [concursoAlvoId, setConcursoAlvoId] = useState<string>('');

  // Modais de Edição
  const [modalEditarConcursoAberto, setModalEditarConcursoAberto] = useState(false);
  const [concursoEditando, setConcursoEditando] = useState<Concurso | null>(null);
  const [editConcursoNome, setEditConcursoNome] = useState('');
  const [editConcursoOrgao, setEditConcursoOrgao] = useState('');
  const [editConcursoAno, setEditConcursoAno] = useState('');
  const [editConcursoEdital, setEditConcursoEdital] = useState('');
  const [editConcursoStatus, setEditConcursoStatus] = useState<Concurso['status']>('ativo');
  const [editConcursoDesc, setEditConcursoDesc] = useState('');

  const [modalEditarCargoAberto, setModalEditarCargoAberto] = useState(false);
  const [cargoEditando, setCargoEditando] = useState<Cargo | null>(null);
  const [cargoEditandoConcursoId, setCargoEditandoConcursoId] = useState<string>('');
  const [editCargoNome, setEditCargoNome] = useState('');
  const [editCargoNivel, setEditCargoNivel] = useState<Cargo['nivel']>('Superior');
  const [editCargoVagas, setEditCargoVagas] = useState(0);
  const [editCargoCr, setEditCargoCr] = useState(true);
  const [editCargoAtivo, setEditCargoAtivo] = useState(true);

  // Form Novo Concurso
  const [formId, setFormId] = useState('');
  const [formNome, setFormNome] = useState('');
  const [formOrgao, setFormOrgao] = useState('');
  const [formAno, setFormAno] = useState('2025');
  const [formEdital, setFormEdital] = useState('Edital 01/2025');
  const [formStatus, setFormStatus] = useState<Concurso['status']>('ativo');
  const [formCargoInicial, setFormCargoInicial] = useState('Analista Judiciário');
  const [formDesc, setFormDesc] = useState('');

  // Form Novo Cargo
  const [formCargoNome, setFormCargoNome] = useState('');
  const [formCargoId, setFormCargoId] = useState('');
  const [formCargoNivel, setFormCargoNivel] = useState<Cargo['nivel']>('Superior');
  const [formCargoVagas, setFormCargoVagas] = useState(0);
  const [formCargoCr, setFormCargoCr] = useState(true);

  // Nova Notificação (Broadcast)
  const [notifTitulo, setNotifTitulo] = useState('');
  const [notifMensagem, setNotifMensagem] = useState('');
  const [notifConcursoId, setNotifConcursoId] = useState(concursos[0]?.id || 'todos');
  const [notifTipo, setNotifTipo] = useState<TipoNotificacao>('convocacao');

  // Resposta Contato
  const [respostaContatoId, setRespostaContatoId] = useState<string | null>(null);
  const [respostaTexto, setRespostaTexto] = useState('');

  // Modal de Justificativa de Indeferimento (Auditoria de Perfil)
  const [modalIndeferirAuditAberto, setModalIndeferirAuditAberto] = useState(false);
  const [auditAlvoParaIndeferir, setAuditAlvoParaIndeferir] = useState<PerfilAuditRequest | null>(null);
  const [motivoJustificativaAudit, setMotivoJustificativaAudit] = useState('');
  const [erroMotivoAudit, setErroMotivoAudit] = useState(false);

  // Modal de Justificativa de Indeferimento (Validação de Candidato)
  const [modalIndeferirVincAberto, setModalIndeferirVincAberto] = useState(false);
  const [vincAlvoParaIndeferir, setVincAlvoParaIndeferir] = useState<SolicitacaoVinculacao | null>(null);
  const [motivoJustificativaVinc, setMotivoJustificativaVinc] = useState('');
  const [erroMotivoVinc, setErroMotivoVinc] = useState(false);

  // -------------------------------------------------------------
  // IMPORTADOR DE PLANILHAS INTERATIVO (Itens 8, 15, 18)
  // -------------------------------------------------------------
  const [importConcursoId, setImportConcursoId] = useState<string>(concursos[0]?.id || '');
  const [importCargoId, setImportCargoId] = useState<string>(concursos[0]?.cargos?.[0]?.id || '');
  const [previewPlanilha, setPreviewPlanilha] = useState<Partial<Candidato>[]>([]);
  const [colunasPlanilha, setColunasPlanilha] = useState<string[]>([]);
  const [linhasBrutasPlanilha, setLinhasBrutasPlanilha] = useState<any[]>([]);
  const [mapeamentoColunas, setMapeamentoColunas] = useState<{
    posicao: string;
    nome: string;
    cpf: string;
    nota_final: string;
    cota: string;
    data_convocacao: string;
    data_nomeacao: string;
    lotacao_definitiva: string;
    papel: string;
    email: string;
    whatsapp: string;
  }>({
    posicao: '',
    nome: '',
    cpf: '',
    nota_final: '',
    cota: '',
    data_convocacao: '',
    data_nomeacao: '',
    lotacao_definitiva: '',
    papel: '',
    email: '',
    whatsapp: '',
  });
  const [nomeArquivo, setNomeArquivo] = useState('');
  const [erroImportacao, setErroImportacao] = useState<string | null>(null);
  const [importando, setImportando] = useState(false);
  const [limitePreview, setLimitePreview] = useState<100 | 250 | 500 | 'todos'>(100);
  const [paginaPreview, setPaginaPreview] = useState<number>(1);

  const handleConcursoChange = (novoId: string) => {
    setImportConcursoId(novoId);
    const conc = concursos.find((c) => c.id === novoId);
    if (conc && conc.cargos && conc.cargos.length > 0) {
      setImportCargoId(conc.cargos[0].id);
    }
  };

  const detectarMelhorColuna = (cols: string[], termos: string[]) => {
    for (const c of cols) {
      const cNorm = c.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      for (const t of termos) {
        if (cNorm === t || cNorm.includes(t)) {
          return c;
        }
      }
    }
    return '';
  };

  const aplicarMapeamento = (
    mapa: typeof mapeamentoColunas,
    rows: any[] = linhasBrutasPlanilha,
    targetConcId: string = importConcursoId,
    targetCargoId: string = importCargoId
  ) => {
    if (!rows || rows.length === 0) return;

    const extrairCotasDeTexto = (txt: string, acumulador: Set<Candidato['cota']>) => {
      const lower = txt
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      if (
        lower.includes('pcd') ||
        lower.includes('defic') ||
        lower.includes('p.c.d') ||
        lower.includes('especial')
      ) {
        acumulador.add('PCD');
      }
      if (
        lower.includes('ppp') ||
        lower.includes('negro') ||
        lower.includes('pardo') ||
        lower.includes('preto') ||
        lower.includes('afro') ||
        /\bcn\b/.test(lower)
      ) {
        acumulador.add('PPP');
      }
      if (lower.includes('indig')) {
        acumulador.add('Indígena');
      }
      if (lower.includes('trans')) {
        acumulador.add('Trans');
      }
    };

    // Pré-classificar os cabeçalhos das colunas apenas UMA vez fora do loop de linhas (Item 8: Alta Performance)
    const sampleCols = Object.keys(rows[0] || {});
    const colunasPcd: string[] = [];
    const colunasPpp: string[] = [];
    const colunasCotaExtra: string[] = [];

    sampleCols.forEach((colKey) => {
      const keyNorm = colKey
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      if (keyNorm.includes('pcd') || keyNorm.includes('defic')) {
        colunasPcd.push(colKey);
      }
      if (
        keyNorm.includes('ppp') ||
        keyNorm.includes('negro') ||
        keyNorm.includes('pardo') ||
        /\bcn\b/.test(keyNorm)
      ) {
        colunasPpp.push(colKey);
      }
      if (
        colKey !== mapa.cota &&
        (keyNorm.includes('cota') ||
          keyNorm.includes('modalidade') ||
          keyNorm.includes('reserva') ||
          keyNorm.includes('lista') ||
          keyNorm.includes('concorrencia'))
      ) {
        colunasCotaExtra.push(colKey);
      }
    });

    const isPositiveCell = (valStr: string): boolean => {
      if (!valStr) return false;
      const v = valStr.toLowerCase().trim();
      return (
        v !== 'nao' &&
        v !== 'não' &&
        v !== 'n' &&
        v !== '-' &&
        v !== '0' &&
        v !== 'false' &&
        v !== 'ampla'
      );
    };

    const tsBase = Date.now().toString(36);

    const parsedRaw: Partial<Candidato>[] = rows.map((row, idx) => {
      const getVal = (colName: string) =>
        colName && row[colName] !== undefined ? String(row[colName]).trim() : '';

      const rawPos = getVal(mapa.posicao);
      const posicao = parseInt(rawPos.replace(/\D/g, ''), 10) || idx + 1;
      const nome = getVal(mapa.nome) || `Candidato ${idx + 1}`;
      const cpf = getVal(mapa.cpf) || undefined;
      const rawNota = getVal(mapa.nota_final);
      const nota = rawNota ? parseFloat(rawNota.replace(',', '.')) || 0 : 0;
      const rawCota = getVal(mapa.cota) || 'Ampla';
      const dataConvocacao = getVal(mapa.data_convocacao) || undefined;
      const dataNomeacao = getVal(mapa.data_nomeacao) || undefined;
      const lotacaoDefinitiva = getVal(mapa.lotacao_definitiva) || undefined;
      const rawPapel = getVal(mapa.papel).toLowerCase();
      const papel = rawPapel.includes('suplente') ? 'Suplente' : 'Titular';
      const email = getVal(mapa.email).toLowerCase() || undefined;
      const whatsapp = getVal(mapa.whatsapp) || undefined;

      // Item 8: Detectar múltiplas cotas (PCD e PPP simultaneamente) em O(1) usando as colunas pré-classificadas
      const setCotas = new Set<Candidato['cota']>(['Ampla']);
      extrairCotasDeTexto(rawCota, setCotas);

      for (let i = 0; i < colunasPcd.length; i++) {
        const valStr = String(row[colunasPcd[i]] ?? '').trim();
        if (isPositiveCell(valStr)) {
          setCotas.add('PCD');
          break;
        }
      }

      for (let i = 0; i < colunasPpp.length; i++) {
        const valStr = String(row[colunasPpp[i]] ?? '').trim();
        if (isPositiveCell(valStr)) {
          setCotas.add('PPP');
          break;
        }
      }

      for (let i = 0; i < colunasCotaExtra.length; i++) {
        const valStr = String(row[colunasCotaExtra[i]] ?? '').trim();
        if (valStr) {
          extrairCotasDeTexto(valStr, setCotas);
        }
      }

      const cotasIdentificadas = Array.from(setCotas);
      const cotaPrincipal: Candidato['cota'] = cotasIdentificadas.includes('PCD')
        ? 'PCD'
        : cotasIdentificadas.includes('PPP')
        ? 'PPP'
        : cotasIdentificadas.includes('Indígena')
        ? 'Indígena'
        : cotasIdentificadas.includes('Trans')
        ? 'Trans'
        : normalizarCota(rawCota);

      let statusCalc: Candidato['status'] = 'Aguardando Convocação';
      if (dataNomeacao) {
        statusCalc = 'Nomeado';
      } else if (dataConvocacao) {
        statusCalc = papel === 'Suplente' ? 'Convocado suplente' : 'Convocado titular';
      }

      return {
        id: `cand-${targetConcId}-${targetCargoId}-${posicao}-${Date.now().toString(36)}-${idx}`,
        concurso_id: targetConcId,
        cargo_id: targetCargoId,
        posicao,
        nome,
        cpf,
        nota_final: nota,
        cota: cotaPrincipal,
        cotas: cotasIdentificadas,
        data_convocacao: dataConvocacao,
        data_nomeacao: dataNomeacao,
        comarca_definitiva: lotacaoDefinitiva,
        status: statusCalc,
        intencao: 'Sim',
        email,
        whatsapp,
        escolhas_comarcas: lotacaoDefinitiva ? [lotacaoDefinitiva] : [],
      };
    });

    // Item 8: Unificar linhas duplicadas do mesmo candidato (quando a planilha traz o candidato em uma linha da lista PCD e outra da lista PPP/Ampla)
    const mapaUnificados = new Map<string, Partial<Candidato>>();
    parsedRaw.forEach((cand) => {
      const cpfKey = cand.cpf ? cand.cpf.replace(/\D/g, '') : '';
      const nomeKey = (cand.nome || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      const chave = cpfKey.length >= 6 ? `cpf:${cpfKey}` : `nome:${nomeKey}`;

      const existente = mapaUnificados.get(chave);
      if (!existente) {
        mapaUnificados.set(chave, cand);
      } else {
        const cotasUnidas = Array.from(
          new Set<Candidato['cota']>([
            'Ampla',
            ...(existente.cotas || [existente.cota || 'Ampla']),
            ...(cand.cotas || [cand.cota || 'Ampla']),
          ])
        );
        const cotaPrin: Candidato['cota'] = cotasUnidas.includes('PCD')
          ? 'PCD'
          : cotasUnidas.includes('PPP')
          ? 'PPP'
          : existente.cota || 'Ampla';
        mapaUnificados.set(chave, {
          ...existente,
          posicao: Math.min(existente.posicao || 999999, cand.posicao || 999999),
          nota_final: Math.max(existente.nota_final || 0, cand.nota_final || 0),
          cpf: existente.cpf || cand.cpf,
          cota: cotaPrin,
          cotas: cotasUnidas,
          data_convocacao: existente.data_convocacao || cand.data_convocacao,
          data_nomeacao: existente.data_nomeacao || cand.data_nomeacao,
          comarca_definitiva: existente.comarca_definitiva || cand.comarca_definitiva,
        });
      }
    });

    const parsed = Array.from(mapaUnificados.values());
    parsed.sort((a, b) => (a.posicao || 0) - (b.posicao || 0));
    setPreviewPlanilha(parsed);
    setPaginaPreview(1);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setNomeArquivo(sanitizeFileName(file.name));
    setErroImportacao(null);
    setImportando(false);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const buffer = evt.target?.result as ArrayBuffer;
        if (!buffer) {
          setErroImportacao('Não foi possível carregar o conteúdo do arquivo.');
          return;
        }

        const wb = XLSX.read(buffer, { type: 'array' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

        if (!data || data.length === 0) {
          setErroImportacao('A planilha está vazia ou não contém linhas de dados.');
          setPreviewPlanilha([]);
          setColunasPlanilha([]);
          setLinhasBrutasPlanilha([]);
          return;
        }

        const cols = Object.keys(data[0] || {});
        setColunasPlanilha(cols);
        setLinhasBrutasPlanilha(data);

        // Auto-detecção inteligente de colunas
        const novoMapa = {
          posicao: detectarMelhorColuna(cols, ['classificacao', 'classif', 'posicao', 'ordem', 'colocacao', 'pos', 'num']),
          nome: detectarMelhorColuna(cols, ['nome', 'candidato', 'nome completo', 'interessado']),
          cpf: detectarMelhorColuna(cols, ['cpf', 'documento', 'doc']),
          nota_final: detectarMelhorColuna(cols, ['nota', 'pontos', 'pontuacao', 'total', 'resultado', 'final']),
          cota: detectarMelhorColuna(cols, ['cota', 'modalidade', 'vaga', 'tipo vaga', 'reserva']),
          data_convocacao: detectarMelhorColuna(cols, ['convocacao', 'data convocacao', 'convocado', 'data de convocacao', 'edital convocacao']),
          data_nomeacao: detectarMelhorColuna(cols, ['nomeacao', 'data nomeacao', 'nomeado', 'data de nomeacao', 'posse', 'doe']),
          lotacao_definitiva: detectarMelhorColuna(cols, ['lotacao', 'comarca', 'unidade', 'regiao', 'setor', 'destino']),
          papel: detectarMelhorColuna(cols, ['papel', 'titular', 'suplente', 'tipo convocacao']),
          email: detectarMelhorColuna(cols, ['email', 'e-mail', 'correio']),
          whatsapp: detectarMelhorColuna(cols, ['telefone', 'celular', 'whatsapp', 'fone']),
        };

        setMapeamentoColunas(novoMapa);
        aplicarMapeamento(novoMapa, data, importConcursoId, importCargoId);
      } catch (err) {
        console.error('Erro ao ler planilha:', err);
        setErroImportacao('Erro ao processar o arquivo. Verifique se é um arquivo Excel (.xlsx, .xls) ou CSV válido.');
      }
    };
    reader.onerror = () => {
      setErroImportacao('Falha ao ler o arquivo no navegador. Tente novamente.');
    };
    reader.readAsArrayBuffer(file);
  };

  const handleAtualizarMapeamentoColuna = (campo: keyof typeof mapeamentoColunas, coluna: string) => {
    const atualizado = { ...mapeamentoColunas, [campo]: coluna };
    setMapeamentoColunas(atualizado);
    aplicarMapeamento(atualizado, linhasBrutasPlanilha, importConcursoId, importCargoId);
  };

  const handleEditarCelulaPreview = (index: number, campo: keyof Candidato, valor: any) => {
    setPreviewPlanilha((prev) => {
      const copy = [...prev];
      if (copy[index]) {
        copy[index] = { ...copy[index], [campo]: valor };
      }
      return copy;
    });
  };

  const handleRemoverLinhaPreview = (index: number) => {
    setPreviewPlanilha((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleAdicionarLinhaManualPreview = () => {
    const novaLinha: Partial<Candidato> = {
      id: `cand-${importConcursoId}-${importCargoId}-${previewPlanilha.length + 1}-${Date.now().toString(36)}`,
      concurso_id: importConcursoId,
      cargo_id: importCargoId,
      posicao: previewPlanilha.length + 1,
      nome: `Novo Candidato ${previewPlanilha.length + 1}`,
      cota: 'Ampla',
      cotas: ['Ampla'],
      nota_final: 80,
      status: 'Aguardando Convocação',
      intencao: 'Sim',
      escolhas_comarcas: [],
    };
    setPreviewPlanilha((prev) => [...prev, novaLinha]);
  };

  const handleConfirmarImportacao = () => {
    if (previewPlanilha.length === 0 || importando) return;
    setImportando(true);

    // Executar em micro-task assíncrona para permitir que a interface renderize o estado "Importando..." sem travar (Item 8)
    window.setTimeout(() => {
      try {
        const candidatosCompletos: Candidato[] = previewPlanilha.map((p, idx) => ({
          id: p.id || `cand-${importConcursoId}-${importCargoId}-${idx + 1}`,
          concurso_id: importConcursoId,
          cargo_id: importCargoId,
          posicao: p.posicao || idx + 1,
          nome: p.nome || `Candidato ${idx + 1}`,
          cpf: p.cpf,
          nota_final: p.nota_final ?? 0,
          cota: p.cota || 'Ampla',
          cotas: p.cotas && p.cotas.length > 0 ? p.cotas : [p.cota || 'Ampla'],
          data_convocacao: p.data_convocacao,
          data_nomeacao: p.data_nomeacao,
          comarca_definitiva: p.comarca_definitiva,
          status: p.status || 'Aguardando Convocação',
          intencao: p.intencao || 'Sim',
          email: p.email,
          whatsapp: p.whatsapp,
          escolhas_comarcas: p.escolhas_comarcas || (p.comarca_definitiva ? [p.comarca_definitiva] : []),
        }));

        const concObj = concursos.find((c) => c.id === importConcursoId);
        const cargoObj = concObj?.cargos?.find((cg) => cg.id === importCargoId);

        // 1. Salvar lista de classificação do cargo em lote e publicar imediatamente para todos os usuários
        lotesStore.salvarCandidatos(importConcursoId, importCargoId, candidatosCompletos, true);
        void cloudSync.pushKey(
          `certam_candidatos_data_v6_${importConcursoId}_${importCargoId}`,
          candidatosCompletos,
          true
        );

        // 2. Sincronizar todos os candidatos com o Cadastro Geral de Usuários em uma única operação em lote O(N) (Item 8 & Item 18)
        userRegistryStore.cadastrarOuSincronizarCandidatosEmLote(
          candidatosCompletos,
          importConcursoId,
          importCargoId,
          concObj?.orgao,
          cargoObj?.nome
        );

        // 3. Se informou lotação definitiva, adiciona todas de uma só vez ao catálogo do concurso
        const lotacoesUnicas = Array.from(
          new Set(
            candidatosCompletos
              .map((c) => c.comarca_definitiva || '')
              .filter((l) => l.trim().length > 0)
          )
        );
        if (lotacoesUnicas.length > 0) {
          certamStore.adicionarLotacoesAoCatalogoEmLote(importConcursoId, lotacoesUnicas);
        }

        void cloudSync.pushAllLocal(true);
        setUsuariosGerais(userRegistryStore.getAllUsers());
        setImportando(false);
        showToast(
          `${candidatosCompletos.length} candidatos importados e publicados para todos os usuários!`
        );
        setPreviewPlanilha([]);
        setLinhasBrutasPlanilha([]);
        setNomeArquivo('');
      } catch (err) {
        console.error('Erro na importação em lote:', err);
        setImportando(false);
        setErroImportacao('Ocorreu um erro ao finalizar a gravação dos candidatos.');
      }
    }, 20);
  };

  // Toast
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const reloadData = () => {
    setConcursos(certamStore.getConcursos());
    setLotesLista(lotesStore.getLotes());
  };

  const handleExcluirConcurso = (concursoId: string, nome: string) => {
    if (window.confirm(`Tem certeza que deseja excluir o concurso "${nome}" e todos os seus cargos associados?`)) {
      certamStore.removerConcurso(concursoId);
      reloadData();
      showToast(`Concurso "${nome}" excluído com sucesso.`);
    }
  };

  const handleExcluirCargo = (concursoId: string, cargoId: string, nome: string) => {
    if (window.confirm(`Tem certeza que deseja excluir o cargo "${nome}"?`)) {
      certamStore.removerCargo(concursoId, cargoId);
      reloadData();
      showToast(`Cargo "${nome}" excluído com sucesso.`);
    }
  };

  const handleExcluirLote = (loteId: string, nome: string) => {
    if (window.confirm(`Tem certeza que deseja excluir o lote de convocação "${nome}"?`)) {
      lotesStore.removerLote(loteId);
      setLotesLista(lotesStore.getLotes());
      showToast(`Lote "${nome}" excluído com sucesso.`);
    }
  };

  // Metrics
  const metricas = useMemo(() => {
    const totalConcursos = concursos.length;
    const totalCargos = concursos.reduce((acc, c) => acc + (c.cargos?.length || 0), 0);
    const pendentesAudit = auditRequests.filter((r) => r.status === 'pendente').length;
    const pendentesVinc = vinculacoes.filter((v) => v.status === 'pendente').length;
    const contatosAbertos = contatos.filter((c) => c.status === 'aberto').length;
    return { totalConcursos, totalCargos, pendentesAudit, pendentesVinc, contatosAbertos };
  }, [concursos, auditRequests, vinculacoes, contatos]);

  const usuariosGeraisFiltrados = useMemo(() => {
    return usuariosGerais.filter((u) => {
      if (!u || typeof u !== 'object') return false;
      const q = buscaUsuario.trim().toLowerCase();
      const qDigits = buscaUsuario.replace(/\D/g, '');
      const uNome = String(u.nome || '').toLowerCase();
      const uEmail = String(u.email || '').toLowerCase();
      const uCpfDigits = String(u.cpf || '').replace(/\D/g, '');
      const uTel = String(u.telefone || u.whatsapp || '');

      const matchBusca =
        !q ||
        uNome.includes(q) ||
        uEmail.includes(q) ||
        (qDigits.length > 0 && uCpfDigits.includes(qDigits)) ||
        uTel.includes(buscaUsuario.trim());

      const isPrimeiroAcesso =
        u.status_cadastro === 'primeiro_acesso' ||
        u.status_cadastro === 'aguardando_primeiro_acesso' ||
        u.status_cadastro === 'aguardando_vinculacao';

      const matchStatus =
        filtroStatusUsuario === 'todos' ||
        (filtroStatusUsuario === 'bloqueado' && u.bloqueado) ||
        (filtroStatusUsuario === 'ativo' && !u.bloqueado && u.status_cadastro === 'ativo') ||
        (filtroStatusUsuario === 'aguardando' && !u.bloqueado && isPrimeiroAcesso);

      const uRole = u.role || (u.is_admin ? 'admin' : 'candidato');
      const matchRole =
        filtroRoleUsuario === 'todos' || uRole === filtroRoleUsuario;

      return matchBusca && matchStatus && matchRole;
    });
  }, [usuariosGerais, buscaUsuario, filtroStatusUsuario, filtroRoleUsuario]);

  // Se não for o administrador oficial autorizado, bloqueia imediatamente
  if (!isAdmin || !usuario) {
    return (
      <div className="max-w-md mx-auto my-12 p-6 sm:p-8 bg-white rounded-2xl shadow-xl border border-slate-200 text-center space-y-4">
        <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center mx-auto">
          <Lock className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold font-serif text-slate-900">Área Administrativa Restrita</h2>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            O acesso ao painel de administração é concedido exclusivamente ao administrador oficial homologado via Google (<strong className="text-slate-800">rafasms0@hotmail.com</strong>).
          </p>
        </div>

        <div className="pt-2 space-y-3">
          <button
            type="button"
            onClick={() => loginGoogle()}
            className="w-full py-2.5 px-4 bg-[#07192B] hover:bg-[#0C2640] text-[#2DD4AA] font-bold rounded-xl text-xs cursor-pointer shadow-sm transition-colors flex items-center justify-center gap-2"
          >
            <span>Entrar com o Google (rafasms0@hotmail.com)</span>
          </button>

          <button
            type="button"
            onClick={onVoltar || (() => onNavigate('portal'))}
            className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer block mx-auto"
          >
            ← Voltar para a Página Inicial
          </button>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // HANDLERS DE APROVAÇÃO DE AUDITORIA DE PERFIL
  // -------------------------------------------------------------
  const handleAprovarAuditoria = (req: PerfilAuditRequest) => {
    auditStore.aprovarSolicitacao(req.id);

    // 1. Extrair todas as mudanças aprovadas
    const mudancas: any = {};
    (req.alteracoes || []).forEach((alt) => {
      if (alt.campo === 'nome') mudancas.nome = alt.valor_novo;
      if (alt.campo === 'cpf') mudancas.cpf = alt.valor_novo;
      if (alt.campo === 'data_nascimento') mudancas.data_nascimento = alt.valor_novo;
      if (alt.campo === 'whatsapp') {
        mudancas.whatsapp = alt.valor_novo;
        mudancas.telefone = alt.valor_novo;
      }
      if (alt.campo === 'email_contato') {
        mudancas.email_contato = alt.valor_novo;
        mudancas.email = alt.valor_novo;
      }
    });

    // 2. Atualizar no repositório persistente de perfis cadastrados do CERTAM (por ID, por email, por CPF e por nome)
    let atualizadoNoRegistro = false;
    if (req.usuario_id) {
      if (userRegistryStore.atualizarCamposUsuario(req.usuario_id, mudancas)) atualizadoNoRegistro = true;
    }
    if (req.usuario_email) {
      if (userRegistryStore.atualizarCamposUsuario(req.usuario_email, mudancas)) atualizadoNoRegistro = true;
    }
    if (req.cpf) {
      if (userRegistryStore.atualizarCamposUsuario(req.cpf, mudancas)) atualizadoNoRegistro = true;
    }
    if (req.usuario_nome) {
      if (userRegistryStore.atualizarCamposUsuario(req.usuario_nome, mudancas)) atualizadoNoRegistro = true;
    }

    const reqCpfLimpo = req.cpf ? limparCpf(req.cpf) : '';

    // Se o usuário ainda estava apenas virtual na listagem geral (getAllUsers), consolida no registro persistente com as mudanças
    if (!atualizadoNoRegistro) {
      const todos = userRegistryStore.getAllUsers();
      const encontradoVirtual = todos.find((u) => {
        const uCpf = u.cpf ? limparCpf(u.cpf) : '';
        return (
          (req.usuario_id && (u.id === req.usuario_id || u.candidato_id === req.usuario_id)) ||
          (req.usuario_email && u.email && u.email.toLowerCase().trim() === req.usuario_email.toLowerCase().trim()) ||
          (reqCpfLimpo.length >= 7 && uCpf.length >= 7 && uCpf === reqCpfLimpo) ||
          (req.usuario_nome && u.nome && normalizarTexto(u.nome) === normalizarTexto(req.usuario_nome))
        );
      });

      if (encontradoVirtual) {
        userRegistryStore.salvarUsuario({
          ...encontradoVirtual,
          ...mudancas,
        });
      } else {
        userRegistryStore.salvarUsuario({
          id: req.usuario_id || `user-${Date.now().toString(36)}`,
          nome: mudancas.nome || req.usuario_nome,
          cpf: mudancas.cpf || req.cpf,
          email: mudancas.email || req.usuario_email,
          email_contato: mudancas.email_contato || req.usuario_email,
          telefone: mudancas.telefone || mudancas.whatsapp,
          whatsapp: mudancas.whatsapp || mudancas.telefone,
          data_nascimento: mudancas.data_nascimento,
          is_admin: false,
          role: 'candidato',
          status_cadastro: 'ativo',
        });
      }
    }

    // 3. Atualizar também na chave de persistência do localStorage ANTES de disparar eventos
    try {
      const storedKey = 'certam_auth_user_v8';
      const storedStr = localStorage.getItem(storedKey);
      if (storedStr) {
        const storedUser = JSON.parse(storedStr);
        const storedCpfLimpo = storedUser?.cpf ? limparCpf(storedUser.cpf) : '';
        if (
          storedUser &&
          ((req.usuario_id && (storedUser.id === req.usuario_id || storedUser.candidato_id === req.usuario_id)) ||
            (storedUser.email && req.usuario_email && storedUser.email.toLowerCase().trim() === req.usuario_email.toLowerCase().trim()) ||
            (storedCpfLimpo.length >= 7 && reqCpfLimpo.length >= 7 && storedCpfLimpo === reqCpfLimpo) ||
            (storedUser.nome && req.usuario_nome && normalizarTexto(storedUser.nome) === normalizarTexto(req.usuario_nome)))
        ) {
          const atualizado = { ...storedUser, ...mudancas };
          localStorage.setItem(storedKey, JSON.stringify(atualizado));
        }
      }
    } catch {
      // ignore
    }

    // 4. Aplicar diretamente no perfil ativo se for o usuário conectado (ex: admin ou candidato)
    const userCpfLimpo = usuario?.cpf ? limparCpf(usuario.cpf) : '';
    const isCurrentActiveUser =
      (req.usuario_id && (usuario?.id === req.usuario_id || usuario?.candidato_id === req.usuario_id)) ||
      (usuario?.email && req.usuario_email && usuario.email.toLowerCase().trim() === req.usuario_email.toLowerCase().trim()) ||
      (userCpfLimpo.length >= 7 && reqCpfLimpo.length >= 7 && userCpfLimpo === reqCpfLimpo) ||
      (usuario?.nome && req.usuario_nome && normalizarTexto(usuario.nome) === normalizarTexto(req.usuario_nome));

    if (isCurrentActiveUser) {
      atualizarDadosUsuario(mudancas);
    }

    // 5. Aplicar alterações nas listas de candidatos de todos os concursos/cargos
    concursos.forEach((c) => {
      c.cargos?.forEach((cg) => {
        const cands = lotesStore.getCandidatos(c.id, cg.id);
        const matchIndex = cands.findIndex((cand) => {
          const candCpfLimpo = cand.cpf ? limparCpf(cand.cpf) : '';
          return (
            (req.usuario_id && cand.id === req.usuario_id) ||
            (reqCpfLimpo.length >= 7 && candCpfLimpo.length >= 7 && candCpfLimpo === reqCpfLimpo) ||
            (req.usuario_email && cand.email && cand.email.toLowerCase().trim() === req.usuario_email.toLowerCase().trim()) ||
            (req.usuario_nome && cand.nome && normalizarTexto(cand.nome) === normalizarTexto(req.usuario_nome))
          );
        });
        if (matchIndex >= 0) {
          const mod = { ...cands[matchIndex] };
          (req.alteracoes || []).forEach((alt) => {
            if (alt.campo === 'nome') mod.nome = alt.valor_novo;
            if (alt.campo === 'cpf') mod.cpf = alt.valor_novo;
            if (alt.campo === 'data_nascimento') mod.data_nascimento = alt.valor_novo;
            if (alt.campo === 'whatsapp') mod.whatsapp = alt.valor_novo;
            if (alt.campo === 'email_contato') mod.email = alt.valor_novo;
          });
          lotesStore.salvarCandidato(c.id, cg.id, mod);
        }
      });
    });

    // 6. Atualizar no MASTER_CADASTRO_GERAL para garantir consistência de cruzamentos em memória
    const masterIdx = MASTER_CADASTRO_GERAL.findIndex((cand) => {
      const candCpfLimpo = cand.cpf ? limparCpf(cand.cpf) : '';
      return (
        (req.usuario_id && cand.id === req.usuario_id) ||
        (reqCpfLimpo.length >= 7 && candCpfLimpo.length >= 7 && candCpfLimpo === reqCpfLimpo) ||
        (req.usuario_email && cand.email && cand.email.toLowerCase().trim() === req.usuario_email.toLowerCase().trim()) ||
        (req.usuario_nome && cand.nome && normalizarTexto(cand.nome) === normalizarTexto(req.usuario_nome))
      );
    });
    if (masterIdx >= 0) {
      (req.alteracoes || []).forEach((alt) => {
        if (alt.campo === 'nome') MASTER_CADASTRO_GERAL[masterIdx].nome = alt.valor_novo;
        if (alt.campo === 'cpf') MASTER_CADASTRO_GERAL[masterIdx].cpf = alt.valor_novo;
        if (alt.campo === 'data_nascimento') MASTER_CADASTRO_GERAL[masterIdx].data_nascimento = alt.valor_novo;
        if (alt.campo === 'whatsapp') MASTER_CADASTRO_GERAL[masterIdx].whatsapp = alt.valor_novo;
        if (alt.campo === 'email_contato') MASTER_CADASTRO_GERAL[masterIdx].email = alt.valor_novo;
      });
    }

    // 7. Atualizar a listagem de usuários e auditorias do painel administrativo
    setUsuariosGerais(userRegistryStore.getAllUsers());
    setAuditRequests(auditStore.getAuditRequests());

    // 8. Disparar eventos globais para sincronização de abas e telas abertas
    window.dispatchEvent(new CustomEvent('certam_audit_approved', { detail: { req, mudancas } }));

    // 9. Notificar APENAS o candidato titular sobre o deferimento das alterações
    const camposAlteradosStr = (req.alteracoes || []).map((a) => a.campo_label).join(', ');
    notificationStore.criarNotificacao({
      destinatario_papel: 'candidato',
      destinatario_usuario_id: req.usuario_id,
      destinatario_cpf: mudancas.cpf || req.cpf,
      destinatario_email: mudancas.email || req.usuario_email,
      destinatario_nome: mudancas.nome || req.usuario_nome,
      titulo: 'Alteração Cadastral Deferida',
      mensagem: `Sua solicitação de atualização cadastral (${camposAlteradosStr}) foi analisada e DEFERIDA pela administração. Os dados já estão consolidados no Cadastro Geral e no seu acesso.`,
      tipo: 'aprovacao_perfil',
      urgente: false,
    });

    showToast(`Alterações de ${mudancas.nome || req.usuario_nome} aprovadas e cadastro geral atualizado!`);
  };

  const handleAbrirIndeferirAuditoria = (req: PerfilAuditRequest) => {
    setAuditAlvoParaIndeferir(req);
    setMotivoJustificativaAudit('');
    setErroMotivoAudit(false);
    setModalIndeferirAuditAberto(true);
  };

  const handleConfirmarIndeferimentoAuditoria = () => {
    if (!auditAlvoParaIndeferir) return;
    const motivoLimpo = motivoJustificativaAudit.trim();
    if (!motivoLimpo) {
      setErroMotivoAudit(true);
      return;
    }

    auditStore.rejeitarSolicitacao(auditAlvoParaIndeferir.id, motivoLimpo);

    const camposAlteradosStr = auditAlvoParaIndeferir.alteracoes.map((a) => a.campo_label).join(', ');
    notificationStore.criarNotificacao({
      destinatario_papel: 'candidato',
      destinatario_usuario_id: auditAlvoParaIndeferir.usuario_id,
      destinatario_cpf: auditAlvoParaIndeferir.cpf,
      destinatario_email: auditAlvoParaIndeferir.usuario_email,
      destinatario_nome: auditAlvoParaIndeferir.usuario_nome,
      titulo: 'Alteração Cadastral Indeferida',
      mensagem: `Sua solicitação de alteração cadastral (${camposAlteradosStr}) foi INDEFERIDA pela moderação. Justificativa: "${motivoLimpo}". Acesse seu perfil para revisar e submeter novas informações.`,
      tipo: 'indeferimento_perfil',
      motivo_justificativa: motivoLimpo,
      urgente: true,
    });

    window.dispatchEvent(
      new CustomEvent('certam_audit_rejected', {
        detail: { req: auditAlvoParaIndeferir, motivo: motivoLimpo },
      })
    );

    setModalIndeferirAuditAberto(false);
    setAuditAlvoParaIndeferir(null);
    setMotivoJustificativaAudit('');
    showToast('Alteração indeferida e candidato notificado com a justificativa!');
  };

  // -------------------------------------------------------------
  // HANDLERS DE VALIDAÇÃO MANUAL DE CANDIDATO E VINCULAÇÃO POR NOME PARECIDO
  // -------------------------------------------------------------
  const handleVincularPorSugestaoNome = (
    v: SolicitacaoVinculacao,
    sug: {
      candidato_id: string;
      nome: string;
      concurso_id?: string;
      concurso_nome?: string;
      cargo_id?: string;
      cargo_nome?: string;
      posicao?: number;
    }
  ) => {
    auditStore.aprovarVinculacao(v.id);

    const concAlvoId = sug.concurso_id || v.concurso_id;
    const cargoAlvoId = sug.cargo_id || v.cargo_id;

    userRegistryStore.vincularUsuarioACadastroExistente({
      usuarioEmail: v.usuario_email,
      usuarioCpf: v.cpf,
      usuarioId: v.usuario_id,
      alvoCandidatoId: sug.candidato_id,
      concursoId: concAlvoId,
      cargoId: cargoAlvoId,
    });

    setUsuariosGerais(userRegistryStore.getAllUsers());
    setVinculacoes(auditStore.getVinculacoes());

    notificationStore.criarNotificacao({
      destinatario_papel: 'candidato',
      destinatario_usuario_id: v.usuario_id || sug.candidato_id,
      destinatario_cpf: v.cpf,
      concurso_id: concAlvoId,
      cargo_id: cargoAlvoId,
      destinatario_email: v.usuario_email,
      destinatario_nome: sug.nome || v.usuario_nome,
      titulo: 'Cadastro Vinculado pelo Administrador',
      mensagem: `Seu acesso (${v.usuario_email}) e CPF (${v.cpf}) foram vinculados ao registro oficial de "${sug.nome}"${
        sug.concurso_nome ? ` no concurso ${sug.concurso_nome}` : ''
      }.`,
      tipo: 'validacao_aprovada',
      link_destino:
        concAlvoId && concAlvoId !== 'geral' && concAlvoId !== 'outro'
          ? `/?id=${concAlvoId}${cargoAlvoId && cargoAlvoId !== 'geral' ? `&cargo=${cargoAlvoId}` : ''}&tab=classificacao`
          : undefined,
      urgente: false,
    });

    showToast(`Usuário "${v.usuario_nome}" vinculado com sucesso ao cadastro "${sug.nome}"!`);
  };

  const handleVincularUsuarioGeralACandidato = (
    u: any,
    sug: {
      candidato_id: string;
      nome: string;
      concurso_id?: string;
      concurso_nome?: string;
      cargo_id?: string;
      cargo_nome?: string;
      posicao?: number;
    }
  ) => {
    userRegistryStore.vincularUsuarioACadastroExistente({
      usuarioEmail: u.email,
      usuarioCpf: u.cpf,
      usuarioId: u.id,
      alvoCandidatoId: sug.candidato_id,
      concursoId: sug.concurso_id,
      cargoId: sug.cargo_id,
    });

    setUsuariosGerais(userRegistryStore.getAllUsers());
    setModalEditarUsuarioAberto(false);
    setUsuarioEditando(null);

    if (u.email || u.cpf) {
      notificationStore.criarNotificacao({
        destinatario_papel: 'candidato',
        destinatario_usuario_id: u.id || sug.candidato_id,
        destinatario_cpf: u.cpf,
        concurso_id: sug.concurso_id,
        cargo_id: sug.cargo_id,
        destinatario_email: u.email,
        destinatario_nome: sug.nome || u.nome,
        titulo: 'Cadastro Vinculado pelo Administrador',
        mensagem: `Seu cadastro foi vinculado pela administração ao registro oficial de "${sug.nome}"${
          sug.concurso_nome ? ` (${sug.concurso_nome})` : ''
        }.`,
        tipo: 'validacao_aprovada',
        link_destino:
          sug.concurso_id && sug.concurso_id !== 'geral'
            ? `/?id=${sug.concurso_id}${sug.cargo_id ? `&cargo=${sug.cargo_id}` : ''}&tab=classificacao`
            : undefined,
        urgente: false,
      });
    }

    showToast(`Cadastro de "${u.nome}" vinculado com sucesso a "${sug.nome}"!`);
  };

  const handleAprovarVinculacao = (v: SolicitacaoVinculacao) => {
    auditStore.aprovarVinculacao(v.id);

    // Se for um novo cadastro no 1º acesso sem concurso específico e nenhum candidato de lista foi selecionado, apenas homologa o novo cadastro geral
    const idEscolhidoAdmin = vinculoCandSelecionado[v.id] || v.candidato_vinculado_id;
    if (v.tipo === 'novo_cadastro' && !idEscolhidoAdmin) {
      userRegistryStore.atualizarCamposUsuario(v.usuario_id || v.usuario_email || v.cpf, {
        cpf_verificado: true,
        status_cadastro: 'ativo',
      });
      setUsuariosGerais(userRegistryStore.getAllUsers());
      setVinculacoes(auditStore.getVinculacoes());
      notificationStore.criarNotificacao({
        destinatario_papel: 'candidato',
        destinatario_usuario_id: v.usuario_id,
        destinatario_cpf: v.cpf,
        destinatario_email: v.usuario_email,
        destinatario_nome: v.usuario_nome,
        titulo: 'Novo Cadastro Homologado',
        mensagem: `Seu cadastro com o CPF ${v.cpf} foi conferido e homologado pela administração do CERTAM.`,
        tipo: 'validacao_aprovada',
        urgente: false,
      });
      showToast(`Novo cadastro de ${v.usuario_nome} homologado com sucesso!`);
      return;
    }

    // Inserir ou atualizar na lista do concurso vinculando ao aprovado selecionado (Item 1)
    const cands = lotesStore.getCandidatos(v.concurso_id, v.cargo_id);
    const candExistente =
      (idEscolhidoAdmin ? cands.find((c) => c.id === idEscolhidoAdmin) : undefined) ||
      cands.find((c) => c.posicao === v.posicao_declarada);

    let idCandFinal = candExistente?.id || `cand-aprovado-${Date.now().toString(36)}`;

    if (candExistente) {
      lotesStore.salvarCandidato(v.concurso_id, v.cargo_id, {
        ...candExistente,
        cpf: v.cpf || candExistente.cpf,
        email: v.usuario_email,
      });
    } else {
      const cotaDecl = (v.cota_declarada as Candidato['cota']) || 'Ampla';
      const novo: Candidato = {
        id: idCandFinal,
        concurso_id: v.concurso_id,
        cargo_id: v.cargo_id,
        posicao: v.posicao_declarada,
        nome: v.usuario_nome,
        cota: cotaDecl,
        cotas: cotaDecl !== 'Ampla' ? ['Ampla', cotaDecl] : ['Ampla'],
        nota_final: v.nota_declarada || 90.0,
        intencao: 'Sim',
        status: 'Aguardando Convocação',
        cpf: v.cpf,
        email: v.usuario_email,
        escolhas_comarcas: [],
      };
      cands.push(novo);
      lotesStore.salvarCandidatos(v.concurso_id, v.cargo_id, cands);
    }

    // Atualizar o Cadastro Geral vinculando o usuário que fez a solicitação ao aprovado
    userRegistryStore.vincularOuRegistrarUsuarioLogin({
      email: v.usuario_email,
      nome: candExistente?.nome || v.usuario_nome,
      cpf: v.cpf || candExistente?.cpf,
      is_admin: false,
      candidato_id: idCandFinal,
      concurso_id: v.concurso_id,
      cargo_id: v.cargo_id,
    });
    setUsuariosGerais(userRegistryStore.getAllUsers());
    setVinculacoes(auditStore.getVinculacoes());

    notificationStore.criarNotificacao({
      destinatario_papel: 'candidato',
      destinatario_usuario_id: v.usuario_id || idCandFinal,
      destinatario_cpf: v.cpf,
      concurso_id: v.concurso_id,
      cargo_id: v.cargo_id,
      destinatario_email: v.usuario_email,
      destinatario_nome: v.usuario_nome,
      titulo: 'Validação de Aprovado Deferida',
      mensagem: `Sua vinculação ao certame ${v.concurso_nome || v.concurso_id} no cargo ${v.cargo_nome || v.cargo_id} (${candExistente?.posicao || v.posicao_declarada}º lugar) foi DEFERIDA e homologada no sistema.`,
      tipo: 'validacao_aprovada',
      link_destino:
        v.concurso_id && v.concurso_id !== 'geral' && v.concurso_id !== 'outro'
          ? `/?id=${v.concurso_id}${v.cargo_id && v.cargo_id !== 'geral' ? `&cargo=${v.cargo_id}` : ''}&tab=classificacao`
          : undefined,
      urgente: false,
    });

    showToast(`Candidato ${v.usuario_nome} vinculado ao aprovado e homologado no cargo!`);
  };

  const handleAbrirIndeferirVinculacao = (v: SolicitacaoVinculacao) => {
    setVincAlvoParaIndeferir(v);
    setMotivoJustificativaVinc('');
    setErroMotivoVinc(false);
    setModalIndeferirVincAberto(true);
  };

  const handleConfirmarIndeferimentoVinculacao = () => {
    if (!vincAlvoParaIndeferir) return;
    const motivoLimpo = motivoJustificativaVinc.trim();
    if (!motivoLimpo) {
      setErroMotivoVinc(true);
      return;
    }

    auditStore.rejeitarVinculacao(vincAlvoParaIndeferir.id, motivoLimpo);

    notificationStore.criarNotificacao({
      destinatario_papel: 'candidato',
      destinatario_usuario_id: vincAlvoParaIndeferir.usuario_id,
      destinatario_cpf: vincAlvoParaIndeferir.cpf,
      destinatario_email: vincAlvoParaIndeferir.usuario_email,
      destinatario_nome: vincAlvoParaIndeferir.usuario_nome,
      concurso_id: vincAlvoParaIndeferir.concurso_id,
      cargo_id: vincAlvoParaIndeferir.cargo_id,
      titulo: 'Validação de Aprovado Indeferida',
      mensagem: `Sua solicitação de vinculação ao cargo ${vincAlvoParaIndeferir.cargo_nome || vincAlvoParaIndeferir.cargo_id} foi INDEFERIDA. Justificativa: "${motivoLimpo}".`,
      tipo: 'validacao_indeferida',
      motivo_justificativa: motivoLimpo,
      urgente: true,
    });

    setModalIndeferirVincAberto(false);
    setVincAlvoParaIndeferir(null);
    setMotivoJustificativaVinc('');
    showToast('Vinculação indeferida e candidato notificado!');
  };

  // -------------------------------------------------------------
  // HANDLERS DE RESPOSTA A CONTATO
  // -------------------------------------------------------------
  const handleEnviarRespostaContato = (id: string) => {
    if (!respostaTexto.trim()) return;
    const msg = contatos.find((c) => c.id === id);
    contactStore.responderMensagem(id, respostaTexto);

    if (msg) {
      notificationStore.criarNotificacao({
        destinatario_papel: 'candidato',
        destinatario_email: msg.usuario_email,
        destinatario_nome: msg.usuario_nome,
        titulo: 'Resposta ao Contato / Solicitação',
        mensagem: `Sua mensagem sobre "${msg.motivo_label}" foi respondida pela administração: "${respostaTexto.trim()}"`,
        tipo: 'resposta_contato',
        urgente: false,
      });
    }

    setRespostaContatoId(null);
    setRespostaTexto('');
    showToast('Resposta enviada e candidato notificado!');
  };

  const handleDispararNotificacao = (e: React.FormEvent) => {
    e.preventDefault();
    if (!notifTitulo.trim() || !notifMensagem.trim()) return;

    const tabPorTipo: Record<string, string> = {
      convocacao: 'lotes',
      cronograma: 'cronograma',
      documento: 'documentos',
      comunicado: 'comunicados',
      chat: 'forum',
      geral: 'dashboard',
    };
    const abaDestino = tabPorTipo[notifTipo] || 'dashboard';
    const concDestino = notifConcursoId === 'todos' ? concursos[0]?.id || 'tjrs_2025' : notifConcursoId;

    notificationStore.criarNotificacao({
      destinatario_papel: 'todos',
      concurso_id: notifConcursoId === 'todos' ? undefined : notifConcursoId,
      titulo: notifTitulo,
      mensagem: notifMensagem,
      tipo: notifTipo,
      link_destino: `/?id=${concDestino}&tab=${abaDestino}`,
      urgente: false,
    });

    setNotifTitulo('');
    setNotifMensagem('');
    showToast('Notificação interna disparada para todos os candidatos no portal!');
  };

  // -------------------------------------------------------------
  // HANDLERS DO CADASTRO GERAL DE USUÁRIOS (Item 18)
  // -------------------------------------------------------------
  const handleAbrirEditarUsuario = (u: any) => {
    setUsuarioEditando(u);
    setUserFormNome(String(u.nome || ''));
    setUserFormCpf(String(u.cpf || ''));
    setUserFormEmail(String(u.email || ''));
    setUserFormTelefone(String(u.telefone || u.whatsapp || ''));
    setUserFormRole(u.role || (u.is_admin ? 'admin' : 'candidato'));
    setUserFormStatus(u.status_cadastro || 'ativo');
    setUserFormBloqueado(Boolean(u.bloqueado));
    setModalEditarUsuarioAberto(true);
  };

  const handleSalvarEdicaoUsuario = (e: React.FormEvent) => {
    e.preventDefault();
    if (!usuarioEditando) return;
    const atualizado = {
      ...usuarioEditando,
      nome: userFormNome.trim(),
      cpf: userFormCpf.trim() || undefined,
      email: userFormEmail.trim(),
      telefone: userFormTelefone.trim() || undefined,
      whatsapp: userFormTelefone.trim() || undefined,
      role: userFormRole,
      is_admin: userFormRole === 'admin',
      tipo_usuario: userFormRole,
      status_cadastro: userFormStatus,
      bloqueado: userFormBloqueado,
    };
    const salvo = userRegistryStore.salvarUsuario(atualizado);
    setUsuariosGerais(userRegistryStore.getAllUsers());
    setModalEditarUsuarioAberto(false);
    setUsuarioEditando(null);

    // Se o usuário ativo for o alterado (por email, cpf ou id), atualiza imediatamente na sessão atual
    const activeCpfLimpo = usuario?.cpf ? limparCpf(usuario.cpf) : '';
    const updCpfLimpo = salvo.cpf ? limparCpf(salvo.cpf) : '';
    const isCurrentActive =
      (usuario?.id && salvo.id && usuario.id === salvo.id) ||
      (usuario?.candidato_id && salvo.candidato_id && usuario.candidato_id === salvo.candidato_id) ||
      (usuario?.email && salvo.email && String(usuario.email).toLowerCase().trim() === String(salvo.email).toLowerCase().trim()) ||
      (activeCpfLimpo.length >= 7 && updCpfLimpo.length >= 7 && activeCpfLimpo === updCpfLimpo);

    if (isCurrentActive) {
      atualizarDadosUsuario(salvo);
    }

    showToast(`Cadastro de ${salvo.nome} atualizado com sucesso!`);
  };

  const handleToggleBloquearUsuario = (id: string) => {
    const atual = userRegistryStore.getUserById(id) || userRegistryStore.getUserByEmail(id);
    if (!atual) return;
    userRegistryStore.bloquearUsuario(id, !atual.bloqueado);
    setUsuariosGerais(userRegistryStore.getAllUsers());
    showToast(atual.bloqueado ? `Usuário ${atual.nome} desbloqueado!` : `Usuário ${atual.nome} bloqueado no sistema!`);
  };

  const handleExcluirUsuario = (id: string, nome: string) => {
    if (window.confirm(`Tem certeza que deseja excluir o cadastro de "${nome}"? Esta ação removerá o usuário do sistema.`)) {
      userRegistryStore.removerUsuario(id);
      setUsuariosGerais(userRegistryStore.getAllUsers());
      showToast(`Cadastro de "${nome}" excluído com sucesso.`);
    }
  };

  const handleAbrirNovoUsuario = () => {
    setUserFormNome('');
    setUserFormCpf('');
    setUserFormEmail('');
    setUserFormTelefone('');
    setUserFormRole('candidato');
    setUserFormStatus('ativo');
    setUserFormBloqueado(false);
    setModalNovoUsuarioAberto(true);
  };

  const handleSalvarNovoUsuario = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userFormNome.trim() || !userFormEmail.trim()) {
      alert('Nome e E-mail são campos obrigatórios.');
      return;
    }
    userRegistryStore.salvarUsuario({
      id: `user-${Date.now().toString(36)}`,
      nome: userFormNome.trim(),
      email: userFormEmail.trim(),
      cpf: userFormCpf.trim() || undefined,
      telefone: userFormTelefone.trim() || undefined,
      whatsapp: userFormTelefone.trim() || undefined,
      is_admin: userFormRole === 'admin',
      tipo_usuario: userFormRole,
      status_cadastro: userFormStatus === 'aguardando_primeiro_acesso' ? 'aguardando_vinculacao' : 'ativo',
      bloqueado: userFormBloqueado,
    });
    setUsuariosGerais(userRegistryStore.getAllUsers());
    setModalNovoUsuarioAberto(false);
    showToast(`Usuário ${userFormNome.trim()} cadastrado com sucesso!`);
  };

  return (
    <div className="space-y-6 max-w-[1880px] w-full mx-auto">
      {/* Toast flutuante */}
      {toastMsg && (
        <div className="fixed bottom-24 right-4 sm:right-6 z-[999999] flex items-center gap-2 px-4 py-3 rounded-xl shadow-2xl text-xs font-semibold text-white bg-[#07192B] border border-[#2DD4AA]/60 animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-[#2DD4AA] shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* HERO BANNER (#07192B) */}
      <div className="bg-[#07192B] rounded-2xl p-6 sm:p-8 text-white card-shadow relative overflow-hidden border border-[#0F2942]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-bold bg-[#135A7A]/50 border border-teal-500/30 text-teal-300">
              <ShieldCheck className="w-3.5 h-3.5 text-[#2DD4AA]" />
              <span>PAINEL DE CONTROLE ADMINISTRATIVO CERTAM</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold font-serif text-white tracking-tight">
              Gestão Centralizada de Certames & Moderação
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Gerencie concursos, lotes de convocação, catálogo de lotações, cadastro geral unificado de concurseiros, pedidos de auditoria cadastral e importação inteligente de listas de classificação.
            </p>
          </div>

          {/* Cards de Métricas Rápidas */}
          <div className="flex items-center gap-3 overflow-x-auto pb-1">
            <div className="bg-[#0C2640] border border-teal-500/20 rounded-xl p-3 text-center min-w-[90px]">
              <span className="text-[10px] uppercase font-mono font-bold text-teal-400 block">Concursos</span>
              <div className="text-xl font-bold text-white mt-0.5">{metricas.totalConcursos}</div>
            </div>
            <div className="bg-[#0C2640] border border-teal-500/20 rounded-xl p-3 text-center min-w-[90px]">
              <span className="text-[10px] uppercase font-mono font-bold text-emerald-400 block">Usuários</span>
              <div className="text-xl font-bold text-emerald-300 mt-0.5">{usuariosGerais.length}</div>
            </div>
            <div className="bg-[#0C2640] border border-teal-500/20 rounded-xl p-3 text-center min-w-[90px]">
              <span className="text-[10px] uppercase font-mono font-bold text-amber-400 block">Auditorias</span>
              <div className="text-xl font-bold text-amber-300 mt-0.5">{metricas.pendentesAudit}</div>
            </div>
            <div className="bg-[#0C2640] border border-teal-500/20 rounded-xl p-3 text-center min-w-[90px]">
              <span className="text-[10px] uppercase font-mono font-bold text-cyan-400 block">Validações</span>
              <div className="text-xl font-bold text-cyan-300 mt-0.5">{metricas.pendentesVinc}</div>
            </div>
            <div className="bg-[#0C2640] border border-teal-500/20 rounded-xl p-3 text-center min-w-[90px]">
              <span className="text-[10px] uppercase font-mono font-bold text-rose-400 block">Mensagens</span>
              <div className="text-xl font-bold text-rose-300 mt-0.5">{metricas.contatosAbertos}</div>
            </div>
          </div>
        </div>
      </div>

      {/* BARRA DE NAVEGAÇÃO DE ABAS ADMIN */}
      <div className="bg-white rounded-2xl border border-slate-200 px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3 overflow-x-auto card-shadow">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <button
            type="button"
            onClick={() => setAbaAdmin('concursos')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              abaAdmin === 'concursos'
                ? 'bg-[#0C2640] text-[#2DD4AA]'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Building className="w-4 h-4" />
            <span>Concursos & Cargos</span>
          </button>

          <button
            type="button"
            onClick={() => setAbaAdmin('lotes')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              abaAdmin === 'lotes'
                ? 'bg-[#0C2640] text-[#2DD4AA]'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Lotes de Convocação</span>
          </button>

          <button
            type="button"
            onClick={() => setAbaAdmin('cadastros')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap relative ${
              abaAdmin === 'cadastros'
                ? 'bg-[#0C2640] text-[#2DD4AA]'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Cadastros Gerais</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 text-slate-800 font-bold font-mono">
              {usuariosGerais.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setAbaAdmin('auditoria')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap relative ${
              abaAdmin === 'auditoria'
                ? 'bg-[#0C2640] text-[#2DD4AA]'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Auditoria de Perfil</span>
            {metricas.pendentesAudit > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500 text-slate-950 font-bold font-mono">
                {metricas.pendentesAudit}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setAbaAdmin('validacoes')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap relative ${
              abaAdmin === 'validacoes'
                ? 'bg-[#0C2640] text-[#2DD4AA]'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>Validação de Aprovados</span>
            {metricas.pendentesVinc > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-cyan-400 text-slate-950 font-bold font-mono">
                {metricas.pendentesVinc}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setAbaAdmin('contatos')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap relative ${
              abaAdmin === 'contatos'
                ? 'bg-[#0C2640] text-[#2DD4AA]'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Inbox className="w-4 h-4" />
            <span>Caixa de Entrada / Fale Conosco</span>
            {metricas.contatosAbertos > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-500 text-white font-bold font-mono">
                {metricas.contatosAbertos}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setAbaAdmin('notificacoes')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              abaAdmin === 'notificacoes'
                ? 'bg-[#0C2640] text-[#2DD4AA]'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Bell className="w-4 h-4" />
            <span>Disparador de Notificações</span>
          </button>

          <button
            type="button"
            onClick={() => setAbaAdmin('importar')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              abaAdmin === 'importar'
                ? 'bg-[#0C2640] text-[#2DD4AA]'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Importar XLSX</span>
          </button>

          <button
            type="button"
            onClick={() => setAbaAdmin('faq')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              abaAdmin === 'faq'
                ? 'bg-[#0C2640] text-[#2DD4AA]'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <HelpCircle className="w-4 h-4" />
            <span>FAQ Oficial</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setAbaAdmin('supabase');
              const cfg = cloudSync.getSupabaseConfig();
              if (cfg) {
                setSupabaseUrlInput(cfg.url);
                setSupabaseKeyInput(cfg.anonKey);
              }
              setDiagLoading(true);
              cloudSync
                .runDiagnostics()
                .then((rep) => setDiagReport(rep))
                .finally(() => setDiagLoading(false));
            }}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              abaAdmin === 'supabase'
                ? 'bg-[#0C2640] text-[#2DD4AA]'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Sparkles className="w-4 h-4 text-emerald-500" />
            <span>Supabase & Sincronização</span>
          </button>

          <button
            type="button"
            onClick={async () => {
              setAbaAdmin('logs_erros');
              setLoadingErrorLogs(true);
              const res = await errorLogStore.fetchFromSupabaseTable();
              setErrorLogs(res.logs);
              setErrorTableStatus({ tableExists: res.tableExists, error: res.error });
              setLoadingErrorLogs(false);
            }}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap relative ${
              abaAdmin === 'logs_erros'
                ? 'bg-[#0C2640] text-[#2DD4AA]'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <AlertTriangle className="w-4 h-4 text-rose-500" />
            <span>Logs de Erros (Tempo Real)</span>
            {errorLogs.filter((l) => !l.resolvido).length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-600 text-white font-bold font-mono">
                {errorLogs.filter((l) => !l.resolvido).length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setAbaAdmin('documentos_admin')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              abaAdmin === 'documentos_admin'
                ? 'bg-[#0C2640] text-[#2DD4AA]'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Documentos Oficiais</span>
          </button>

          <button
            type="button"
            onClick={() => setAbaAdmin('classificacao_admin')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              abaAdmin === 'classificacao_admin'
                ? 'bg-[#0C2640] text-[#2DD4AA]'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Editor de Classificação</span>
          </button>

          <button
            type="button"
            onClick={() => setAbaAdmin('vagas_admin')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              abaAdmin === 'vagas_admin'
                ? 'bg-[#0C2640] text-[#2DD4AA]'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Briefcase className="w-4 h-4" />
            <span>Quadro de Vagas</span>
          </button>
        </div>
      </div>

      {/* ============================================================== */}
      {/* ABA 1: CONCURSOS & CARGOS                                      */}
      {/* ============================================================== */}
      {abaAdmin === 'concursos' && (
        <section className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold font-serif text-slate-900">
                Concursos & Cargos Cadastrados
              </h2>
              <p className="text-xs text-slate-500">
                Gestão dos certames ativos no CERTAM. Configure editais, órgãos, adicione ou edite cargos específicos.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setConcursoEditando(null);
                setModalEditarConcursoAberto(true);
              }}
              className="px-4 py-2 bg-[#07192B] hover:bg-[#0C2640] text-[#2DD4AA] font-bold text-xs rounded-xl transition-all cursor-pointer shadow-xs flex items-center gap-2 shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Cadastrar Novo Concurso</span>
            </button>
          </div>

          {/* Lista de Concursos */}
          {concursos.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center space-y-4 card-shadow">
              <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center mx-auto shadow-xs">
                <Building className="w-6 h-6" />
              </div>
              <div className="max-w-md mx-auto space-y-1">
                <h3 className="font-bold text-base text-slate-800">Nenhum concurso cadastrado</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Todos os dados de teste foram removidos. O portal está limpo para inserção de editais, cargos e dados reais.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setConcursoEditando(null);
                  setModalEditarConcursoAberto(true);
                }}
                className="px-5 py-2.5 bg-[#07192B] hover:bg-[#0C2640] text-[#2DD4AA] font-bold text-xs rounded-xl transition-all cursor-pointer shadow-md inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>Cadastrar Primeiro Concurso</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5">
              {concursos.map((c) => (
              <div
                key={c.id}
                className="bg-white rounded-2xl border border-slate-200 card-shadow p-5 sm:p-6 space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-500 font-mono uppercase">
                        {c.orgao} • {c.ano}
                      </span>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                        {c.status}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold font-serif text-slate-900 mt-1">{c.nome}</h3>
                    <p className="text-xs text-slate-500">{c.descricao}</p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setConcursoEditando(c);
                        setModalEditarConcursoAberto(true);
                      }}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-lg transition-colors cursor-pointer flex items-center gap-1 border border-slate-200"
                      title="Editar informações do concurso"
                    >
                      <Pencil className="w-3.5 h-3.5 text-slate-600" />
                      <span>Editar Concurso</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setConcursoAlvoId(c.id);
                        setCargoEditando(null);
                        setModalEditarCargoAberto(true);
                      }}
                      className="px-3 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 font-bold text-xs rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Adicionar Cargo</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExcluirConcurso(c.id, c.nome)}
                      className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-rose-200"
                      title="Excluir Concurso"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Tabela de Cargos deste Concurso */}
                <div>
                  <span className="text-2xs font-bold text-slate-400 uppercase tracking-wider block mb-2">
                    Cargos Vinculados ({c.cargos?.length || 0})
                  </span>
                  <div className="overflow-x-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-left text-xs divide-y divide-slate-100">
                      <thead className="bg-slate-50 text-slate-700 font-bold text-2xs uppercase tracking-wider">
                        <tr>
                          <th className="py-2.5 px-3">Cargo</th>
                          <th className="py-2.5 px-2 text-center">Nível</th>
                          <th className="py-2.5 px-2 text-right">Quant. Total</th>
                          <th className="py-2.5 px-2 text-right text-amber-900">Vagas Disponíveis</th>
                          <th className="py-2.5 px-2 text-right">Vagas Imediatas</th>
                          <th className="py-2.5 px-2 text-right text-emerald-800">Nomeados</th>
                          <th className="py-2.5 px-2 text-right text-cyan-800">Convocados</th>
                          <th className="py-2.5 px-2 text-right text-indigo-900">Próx. Lote</th>
                          <th className="py-2.5 px-2 text-center">Atualizado em</th>
                          <th className="py-2.5 px-3 text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {c.cargos?.map((cg) => (
                          <tr key={cg.id} className="hover:bg-slate-50">
                            <td className="py-2.5 px-3 font-bold text-slate-900">
                              <div>{cg.nome}</div>
                              <span className="text-[10px] text-slate-400 font-mono font-normal">
                                {cg.ativo ? '🟢 Ativo' : '⚪ Inativo'} {cg.tem_cr ? '• CR' : ''}
                              </span>
                            </td>
                            <td className="py-2.5 px-2 text-center font-mono">{cg.nivel}</td>
                            <td className="py-2.5 px-2 text-right font-mono text-slate-800 font-semibold">
                              {cg.quantitativo_total !== undefined ? cg.quantitativo_total.toLocaleString('pt-BR') : '-'}
                            </td>
                            <td className="py-2.5 px-2 text-right font-mono text-amber-900 font-bold bg-amber-50/40">
                              {cg.vagas_disponiveis !== undefined
                                ? cg.vagas_disponiveis.toLocaleString('pt-BR')
                                : cg.vagas_reais_abertas !== undefined
                                ? cg.vagas_reais_abertas.toLocaleString('pt-BR')
                                : '-'}
                            </td>
                            <td className="py-2.5 px-2 text-right font-mono font-bold text-slate-900">
                              {cg.vagas_imediatas}
                            </td>
                            <td className="py-2.5 px-2 text-right font-mono text-emerald-800 font-semibold">
                              {cg.nomeados_concurso !== undefined ? cg.nomeados_concurso : '0'}
                            </td>
                            <td className="py-2.5 px-2 text-right font-mono text-cyan-800 font-semibold">
                              {cg.convocados_nao_nomeados !== undefined ? cg.convocados_nao_nomeados : '0'}
                            </td>
                            <td className="py-2.5 px-2 text-right font-mono text-indigo-900 text-[11px]">
                              {cg.vagas_previstas_proximo_lote !== undefined ? (
                                <span>
                                  {cg.vagas_previstas_proximo_lote} vag.
                                  {cg.data_prevista_proximo_lote && ` (${cg.data_prevista_proximo_lote})`}
                                </span>
                              ) : (
                                '-'
                              )}
                            </td>
                            <td className="py-2.5 px-2 text-center font-mono text-[10px] text-slate-500">
                              {cg.data_atualizacao_vagas || 'Em apuração'}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setConcursoAlvoId(c.id);
                                    setCargoEditando(cg);
                                    setModalEditarCargoAberto(true);
                                  }}
                                  className="px-2.5 py-1 bg-slate-100 hover:bg-teal-50 hover:text-teal-800 text-slate-700 font-semibold rounded-md transition-colors cursor-pointer flex items-center gap-1 text-[11px]"
                                  title="Editar dados deste cargo"
                                >
                                  <Pencil className="w-3 h-3 text-slate-600" />
                                  <span>Editar</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleExcluirCargo(c.id, cg.id, cg.nome)}
                                  className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                                  title="Excluir Cargo"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ))}
            </div>
          )}
        </section>
      )}

      {/* ============================================================== */}
      {/* ABA: LOTES DE CONVOCAÇÃO (ADMIN)                                */}
      {/* ============================================================== */}
      {abaAdmin === 'lotes' && (
        <section className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold font-serif text-slate-900 flex items-center gap-2">
                <Layers className="w-5 h-5 text-teal-600" />
                <span>Gestão de Lotes de Convocação</span>
              </h2>
              <p className="text-xs text-slate-500">
                Cadastre e edite lotes de convocação, configure vagas ofertadas por comarca, trave escolhas e controle visibilidade de ranking.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                const primConc = concursos[0];
                const primCargo = primConc?.cargos?.[0];
                setLoteConcursoAlvoId(primConc?.id || '');
                setLoteCargoAlvoId(primCargo?.id || '');
                setLoteEditando(null);
                setModalEditarLoteAberto(true);
              }}
              className="px-4 py-2 bg-[#07192B] hover:bg-[#0C2640] text-[#2DD4AA] font-bold text-xs rounded-xl transition-all cursor-pointer shadow-xs flex items-center gap-2 shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Novo Lote de Convocação</span>
            </button>
          </div>

          {/* Filtro por Concurso */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 card-shadow flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-slate-600">Filtrar por Concurso:</span>
              <select
                value={filtroLoteConcurso}
                onChange={(e) => setFiltroLoteConcurso(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:outline-hidden"
              >
                <option value="todos">Todos os Concursos ({lotesLista.length} lotes)</option>
                {concursos.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome} ({c.orgao})
                  </option>
                ))}
              </select>
            </div>

            <span className="text-2xs text-slate-400 font-mono">
              Total exibindo: {
                lotesLista.filter((l) => filtroLoteConcurso === 'todos' || l.concurso_id === filtroLoteConcurso).length
              } lote(s)
            </span>
          </div>

          {/* Lista de Lotes */}
          {lotesLista.filter((l) => filtroLoteConcurso === 'todos' || l.concurso_id === filtroLoteConcurso).length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center space-y-4 card-shadow">
              <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center mx-auto shadow-xs">
                <Layers className="w-6 h-6" />
              </div>
              <div className="max-w-md mx-auto space-y-1">
                <h3 className="font-bold text-base text-slate-800">Nenhum lote cadastrado</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Crie o primeiro lote de convocação para permitir que candidatos convocados realizem simulações de audiência de escolha de comarcas.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const primConc = concursos[0];
                  const primCargo = primConc?.cargos?.[0];
                  setLoteConcursoAlvoId(primConc?.id || '');
                  setLoteCargoAlvoId(primCargo?.id || '');
                  setLoteEditando(null);
                  setModalEditarLoteAberto(true);
                }}
                className="px-5 py-2.5 bg-[#07192B] hover:bg-[#0C2640] text-[#2DD4AA] font-bold text-xs rounded-xl transition-all cursor-pointer shadow-md inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>Criar Primeiro Lote</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5">
              {lotesLista
                .filter((l) => filtroLoteConcurso === 'todos' || l.concurso_id === filtroLoteConcurso)
                .sort((a, b) => {
                  const numA = (a.numero_lote || a.nome || '').toString().replace(/[^\d.]/g, '');
                  const numB = (b.numero_lote || b.nome || '').toString().replace(/[^\d.]/g, '');
                  return numA.localeCompare(numB, undefined, { numeric: true, sensitivity: 'base' });
                })
                .map((lote) => {
                  const conc = concursos.find((c) => c.id === lote.concurso_id);
                  const cargo = conc?.cargos?.find((cg) => cg.id === lote.cargo_id);
                  const totalVagas = lote.comarcas?.reduce((acc, c) => acc + c.vagas, 0) || 0;
                  const totalConvocados = lote.candidatos_ids?.length || 0;

                  return (
                    <div
                      key={lote.id}
                      className="bg-white rounded-2xl border border-slate-200 card-shadow p-5 sm:p-6 space-y-4"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-xs text-teal-800 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-md font-mono uppercase">
                              {conc?.orgao || lote.concurso_id} {cargo ? `• ${cargo.nome}` : ''}
                            </span>
                            <span
                              className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                                lote.travado
                                  ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                  : lote.ativo
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {lote.travado ? '🔒 Escolha Travada' : lote.ativo ? '🟢 Aberto para Escolha' : 'Inativo'}
                            </span>
                            <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                              ID: {lote.id}
                            </span>
                          </div>
                          <h3 className="text-lg font-bold font-serif text-slate-900">{lote.nome}</h3>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setLoteConcursoAlvoId(lote.concurso_id);
                              setLoteCargoAlvoId(lote.cargo_id || '');
                              setLoteEditando(lote);
                              setModalEditarLoteAberto(true);
                            }}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-lg transition-colors cursor-pointer flex items-center gap-1 border border-slate-200"
                          >
                            <Pencil className="w-3.5 h-3.5 text-slate-600" />
                            <span>Editar Lote</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleExcluirLote(lote.id, lote.nome)}
                            className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-rose-200"
                            title="Excluir Lote"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Métricas do Lote */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                          <span className="text-2xs text-slate-400 font-bold uppercase block">Vagas Ofertadas</span>
                          <span className="text-lg font-bold font-mono text-teal-700">{totalVagas}</span>
                        </div>
                        <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                          <span className="text-2xs text-slate-400 font-bold uppercase block">Convocados no Lote</span>
                          <span className="text-lg font-bold font-mono text-slate-800">{totalConvocados}</span>
                        </div>
                        <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                          <span className="text-2xs text-slate-400 font-bold uppercase block">Comarcas Ofertadas</span>
                          <span className="text-lg font-bold font-mono text-slate-800">{lote.comarcas?.length || 0}</span>
                        </div>
                        <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                          <span className="text-2xs text-slate-400 font-bold uppercase block">Visibilidade do Ranking</span>
                          <span className="text-xs font-bold text-slate-800 mt-1 block">
                            {lote.is_ranking_visible ? '✓ Visível' : 'Oculto'}
                          </span>
                        </div>
                      </div>

                      {/* Distribuição de Comarcas */}
                      <div>
                        <span className="text-2xs font-bold text-slate-400 uppercase tracking-wider block mb-2">
                          Comarcas e Quantidade de Vagas:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {lote.comarcas?.map((c, i) => (
                            <span
                              key={i}
                              className="px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 flex items-center gap-1.5"
                            >
                              <span className="font-medium">{c.nome}</span>
                              <span className="px-1.5 py-0.2 rounded bg-teal-100 text-teal-800 font-mono font-bold text-[10px]">
                                {c.vagas} {c.vagas === 1 ? 'vaga' : 'vagas'}
                              </span>
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </section>
      )}

      {/* ============================================================== */}
      {/* ABA CADASTROS GERAIS DE USUÁRIOS & IMPORTADOS (Item 18)        */}
      {/* ============================================================== */}
      {abaAdmin === 'cadastros' && (
        <section className="space-y-6">
          <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 card-shadow flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="px-2.5 py-0.5 rounded-md bg-teal-50 text-teal-800 font-mono text-[10px] font-bold uppercase border border-teal-200">
                Base Unificada de Concurseiros
              </span>
              <h2 className="text-xl font-bold font-serif text-slate-900 mt-1.5">
                Cadastro Geral de Usuários ({usuariosGerais.length} registros)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5 max-w-2xl">
                Visualize e gerencie todos os usuários cadastrados no portal e todos os candidatos importados via planilha (vinculáveis automaticamente por CPF ou nome completo no primeiro acesso).
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  const rows = usuariosGerais.map((u) => ({
                    ID: u.id,
                    'Nome Completo': u.nome,
                    CPF: u.cpf || '',
                    'E-mail': u.email || u.email_contato || '',
                    'Telefone / WhatsApp': u.telefone || u.whatsapp || '',
                    Perfil: u.role === 'admin' ? 'Admin' : 'Candidato',
                    'Situação Cadastral': u.bloqueado ? 'Bloqueado' : u.status_cadastro || 'Ativo',
                    'Órgão / Concurso': u.orgao || u.concurso_id || 'Portal Geral',
                    Cargo: u.cargo_nome || u.cargo_id || '-',
                  }));
                  const ws = XLSX.utils.json_to_sheet(rows);
                  const wb = XLSX.utils.book_new();
                  XLSX.utils.book_append_sheet(wb, ws, 'CadastroGeral');
                  XLSX.writeFile(wb, `certam-cadastro-geral-${new Date().toISOString().split('T')[0]}.xlsx`);
                  showToast('Planilha consolidada do Cadastro Geral (.XLSX) exportada com sucesso!');
                }}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Download className="w-4 h-4" />
                <span>Exportar Cadastro (.XLSX)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const res = userRegistryStore.varrerELimparDuplicidadesBancoEStorage();
                  setUsuariosGerais(userRegistryStore.getAllUsers());
                  showToast(
                    `Varredura concluída! ${res.registrosAnalisados} cadastros e ${res.candidatosVerificados} candidatos analisados. ${res.duplicidadesRemovidas} duplicidade(s) corrigida(s).`
                  );
                }}
                className="px-4 py-2.5 bg-teal-50 hover:bg-teal-100 text-teal-900 border border-teal-300 font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
                title="Efetua varredura profunda no banco e storage para eliminar duplicidades e unificar cadastros"
              >
                <Sparkles className="w-4 h-4 text-teal-600" />
                <span>Varredura & Deduplicação</span>
              </button>

              <button
                type="button"
                onClick={handleAbrirNovoUsuario}
                className="px-4 py-2.5 bg-[#07192B] hover:bg-[#0C2640] text-[#2DD4AA] font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Novo Cadastro Manual</span>
              </button>
            </div>
          </div>

          {/* Filtros de Busca e Status */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 card-shadow grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="sm:col-span-2 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por nome completo, CPF, e-mail ou telefone..."
                value={buscaUsuario}
                onChange={(e) => setBuscaUsuario(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:border-teal-600 outline-hidden"
              />
            </div>

            <div>
              <select
                value={filtroStatusUsuario}
                onChange={(e) => setFiltroStatusUsuario(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium"
              >
                <option value="todos">Todos os Status ({usuariosGerais.length})</option>
                <option value="ativo">Ativos no Portal</option>
                <option value="aguardando">Aguardando 1º Acesso (Importados)</option>
                <option value="bloqueado">Acesso Bloqueado</option>
              </select>
            </div>

            <div>
              <select
                value={filtroRoleUsuario}
                onChange={(e) => setFiltroRoleUsuario(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium"
              >
                <option value="todos">Todos os Perfis</option>
                <option value="candidato">Candidatos Comuns</option>
                <option value="admin">Administradores</option>
              </select>
            </div>
          </div>

          {/* Tabela de Cadastros Gerais */}
          <div className="bg-white rounded-2xl border border-slate-200 card-shadow overflow-hidden">
            <div className="overflow-x-auto max-h-[600px]">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#07192B] text-white text-[11px] uppercase tracking-wider sticky top-0 z-10">
                  <tr>
                    <th className="py-3 px-4">Nome Completo</th>
                    <th className="py-3 px-3">CPF</th>
                    <th className="py-3 px-3">E-mail / Contato</th>
                    <th className="py-3 px-3">Concurso / Cargo Vinculado</th>
                    <th className="py-3 px-3 text-center">Perfil</th>
                    <th className="py-3 px-3 text-center">Situação Cadastral</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {usuariosGeraisFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-slate-400">
                        Nenhum usuário encontrado para os filtros aplicados.
                      </td>
                    </tr>
                  ) : (
                    usuariosGeraisFiltrados.map((u) => (
                      <tr key={u.id} className={`hover:bg-slate-50/80 transition-colors ${u.bloqueado ? 'bg-rose-50/30' : ''}`}>
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">{u.nome}</div>
                          <button
                            type="button"
                            onClick={() => {
                              setUsuarioDetalhes(u);
                              setModalDetalhesUsuarioAberto(true);
                            }}
                            className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-semibold text-teal-700 hover:text-teal-900 hover:underline cursor-pointer"
                          >
                            <Eye className="w-3 h-3" />
                            <span>Ver Dossiê e Histórico</span>
                          </button>
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-700">
                          {u.cpf || <span className="text-slate-400 italic">Não informado</span>}
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-mono text-slate-700">{u.email || '—'}</div>
                          {(u.telefone || u.whatsapp) && (
                            <span className="text-[10px] text-slate-500 font-mono block">
                              Tel: {u.telefone || u.whatsapp}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          {u.orgao || u.cargo_nome ? (
                            <div>
                              <span className="font-semibold text-teal-800 block">{u.orgao || u.concurso_id}</span>
                              <span className="text-[11px] text-slate-500">{u.cargo_nome || u.cargo_id}</span>
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <span className="text-slate-400 italic text-[11px] block">Cadastro Geral Portal</span>
                              {(() => {
                                const sugs = userRegistryStore.buscarSugestoesNomesParecidos(
                                  u.nome,
                                  u.cpf,
                                  u.email,
                                  2,
                                  u.id || u.candidato_id
                                );
                                if (sugs.length === 0) return null;
                                const top = sugs[0];
                                return (
                                  <div className="p-1.5 rounded-lg bg-amber-50 border border-amber-200 text-[10px] space-y-1">
                                    <div className="font-bold text-amber-900 flex items-center gap-1">
                                      <span>Sugestão ({top.similaridade}%):</span>
                                      <span className="truncate max-w-[150px]" title={top.nome}>
                                        {top.nome}
                                      </span>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => handleVincularUsuarioGeralACandidato(u, top)}
                                      className="px-2 py-0.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded text-[10px] cursor-pointer transition-colors"
                                    >
                                      Vincular Cadastro
                                    </button>
                                  </div>
                                );
                              })()}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono ${
                              u.role === 'admin'
                                ? 'bg-purple-100 text-purple-900 border border-purple-300'
                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}
                          >
                            {u.role === 'admin' ? 'Admin' : 'Candidato'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          {u.bloqueado ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                              <Lock className="w-3 h-3" />
                              <span>Bloqueado</span>
                            </span>
                          ) : u.status_cadastro === 'primeiro_acesso' ||
                            u.status_cadastro === 'aguardando_primeiro_acesso' ||
                            u.status_cadastro === 'aguardando_vinculacao' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                              <span>Primeiro Acesso</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Ativo</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setUsuarioDetalhes(u);
                                setModalDetalhesUsuarioAberto(true);
                              }}
                              className="px-2.5 py-1 bg-teal-50 hover:bg-teal-100 text-teal-800 rounded-lg font-bold text-[11px] transition-colors cursor-pointer flex items-center gap-1 border border-teal-200"
                              title="Visualizar ficha completa, situação nos concursos, histórico de acessos e modificações"
                            >
                              <Eye className="w-3 h-3 text-teal-600" />
                              <span>Mais Info</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAbrirEditarUsuario(u)}
                              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-[11px] transition-colors cursor-pointer flex items-center gap-1 border border-slate-200"
                              title="Editar cadastro"
                            >
                              <Pencil className="w-3 h-3" />
                              <span>Editar</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleBloquearUsuario(u.id)}
                              className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-colors cursor-pointer flex items-center gap-1 border ${
                                u.bloqueado
                                  ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
                                  : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200'
                              }`}
                              title={u.bloqueado ? 'Desbloquear acesso' : 'Bloquear acesso'}
                            >
                              <Lock className="w-3 h-3" />
                              <span>{u.bloqueado ? 'Desbloquear' : 'Bloquear'}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleExcluirUsuario(u.id, u.nome)}
                              className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Excluir cadastro"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Modal de Edição / Novo Usuário */}
          {(modalEditarUsuarioAberto || modalNovoUsuarioAberto) && (
            <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="font-bold text-slate-900 text-base font-serif">
                    {modalEditarUsuarioAberto ? `Editar Cadastro: ${usuarioEditando?.nome}` : 'Novo Cadastro de Usuário'}
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      setModalEditarUsuarioAberto(false);
                      setModalNovoUsuarioAberto(false);
                      setUsuarioEditando(null);
                    }}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form
                  onSubmit={modalEditarUsuarioAberto ? handleSalvarEdicaoUsuario : handleSalvarNovoUsuario}
                  className="space-y-3 text-xs"
                >
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Nome Completo:</label>
                    <input
                      type="text"
                      value={userFormNome}
                      onChange={(e) => setUserFormNome(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-semibold"
                      required
                    />
                  </div>

                  {/* Sugestões de Nomes Parecidos dentro do Modal de Edição */}
                  {modalEditarUsuarioAberto &&
                    usuarioEditando &&
                    userFormNome.trim().length >= 3 &&
                    (() => {
                      const sugs = userRegistryStore.buscarSugestoesNomesParecidos(
                        userFormNome,
                        userFormCpf,
                        userFormEmail,
                        4,
                        usuarioEditando?.id || usuarioEditando?.candidato_id
                      );
                      if (sugs.length === 0) return null;
                      return (
                        <div className="p-3 rounded-xl bg-teal-50/70 border border-teal-200 space-y-2">
                          <span className="font-bold text-teal-950 text-[11px] flex items-center gap-1.5">
                            <UserCheck className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                            <span>Sugestões de Nomes Parecidos para Vinculação:</span>
                          </span>
                          <div className="space-y-1.5">
                            {sugs.map((sug) => (
                              <div
                                key={`${sug.candidato_id}-${sug.concurso_id || 'geral'}`}
                                className="p-2 bg-white rounded-lg border border-teal-200/80 flex items-center justify-between gap-2"
                              >
                                <div className="min-w-0">
                                  <div className="font-bold text-slate-900 text-xs truncate">
                                    {sug.nome}{' '}
                                    <span className="text-[10px] font-mono text-teal-700 bg-teal-100 px-1.5 py-0.5 rounded">
                                      {sug.similaridade}% compatível
                                    </span>
                                  </div>
                                  <div className="text-[10px] text-slate-500 truncate">
                                    {sug.concurso_nome || 'Cadastro Geral'}
                                    {sug.cargo_nome ? ` • ${sug.cargo_nome}` : ''}
                                    {sug.posicao ? ` • ${sug.posicao}º lugar` : ''}
                                    {sug.cpf ? ` • CPF: ${sug.cpf}` : ''}
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleVincularUsuarioGeralACandidato(usuarioEditando, sug)}
                                  className="px-2.5 py-1 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-lg text-[10px] shrink-0 cursor-pointer"
                                >
                                  Vincular a este
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">CPF:</label>
                      <input
                        type="text"
                        placeholder="000.000.000-00"
                        value={userFormCpf}
                        onChange={(e) => setUserFormCpf(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Telefone / WhatsApp:</label>
                      <input
                        type="text"
                        placeholder="(00) 00000-0000"
                        value={userFormTelefone}
                        onChange={(e) => setUserFormTelefone(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      E-mail de Acesso / Vinculação (em branco até o 1º acesso):
                    </label>
                    <input
                      type="email"
                      placeholder="Preenchido automaticamente quando o candidato fizer o 1º acesso"
                      value={userFormEmail}
                      onChange={(e) => setUserFormEmail(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Perfil de Acesso:</label>
                      <select
                        value={userFormRole}
                        onChange={(e) => setUserFormRole(e.target.value as any)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-semibold"
                      >
                        <option value="candidato">Candidato</option>
                        <option value="admin">Administrador</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Status de Vinculação:</label>
                      <select
                        value={userFormStatus}
                        onChange={(e) => setUserFormStatus(e.target.value as any)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-semibold"
                      >
                        <option value="ativo">Ativo (Vinculado)</option>
                        <option value="primeiro_acesso">Primeiro Acesso (Aguardando Vínculo)</option>
                      </select>
                    </div>
                  </div>

                  <div className="pt-1">
                    <label className="flex items-center gap-2 cursor-pointer select-none p-2.5 rounded-xl bg-rose-50/60 border border-rose-200">
                      <input
                        type="checkbox"
                        checked={userFormBloqueado}
                        onChange={(e) => setUserFormBloqueado(e.target.checked)}
                        className="rounded border-rose-300 text-rose-600 w-4 h-4 cursor-pointer"
                      />
                      <span className="font-bold text-rose-900">Bloquear acesso deste usuário ao portal</span>
                    </label>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => {
                        setModalEditarUsuarioAberto(false);
                        setModalNovoUsuarioAberto(false);
                        setUsuarioEditando(null);
                      }}
                      className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 rounded-xl bg-[#07192B] hover:bg-[#0C2640] text-[#2DD4AA] font-bold cursor-pointer"
                    >
                      Salvar Cadastro
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Modal de Detalhes Completos do Candidato (Dossiê, Acessos e Modificações) */}
          <ModalDetalhesCandidatoAdmin
            usuario={usuarioDetalhes}
            aberto={modalDetalhesUsuarioAberto}
            onClose={() => {
              setModalDetalhesUsuarioAberto(false);
              setUsuarioDetalhes(null);
            }}
            onEditar={(u) => handleAbrirEditarUsuario(u)}
          />
        </section>
      )}

      {/* ============================================================== */}
      {/* ABA 2: AUDITORIA DE ALTERAÇÕES DE PERFIL COM DIFF              */}
      {/* ============================================================== */}
      {abaAdmin === 'auditoria' && (
        <section className="space-y-6">
          <div className="border-b border-slate-200 pb-3">
            <h2 className="text-xl font-bold font-serif text-slate-900">
              Auditoria de Alterações Submetidas pelos Candidatos
            </h2>
            <p className="text-xs text-slate-500">
              Analise comparativa &quot;Antes&quot; vs &quot;Depois&quot; para coibir fraudes cadastrais e manipulação de classificações.
            </p>
          </div>

          {auditRequests.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-xs text-slate-400 card-shadow">
              Nenhuma solicitação de alteração na fila de moderação.
            </div>
          ) : (
            <div className="space-y-4">
              {auditRequests.map((req) => (
                <div
                  key={req.id}
                  className={`bg-white rounded-2xl border p-5 sm:p-6 card-shadow space-y-4 ${
                    req.status === 'pendente'
                      ? 'border-amber-300 ring-2 ring-amber-50'
                      : 'border-slate-200'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900">{req.usuario_nome}</span>
                        <span className="text-2xs font-mono text-slate-400">CPF: {req.cpf}</span>
                        <span
                          className={`text-2xs font-bold px-2 py-0.5 rounded uppercase ${
                            req.status === 'pendente'
                              ? 'bg-amber-100 text-amber-900'
                              : req.status === 'aprovado'
                              ? 'bg-emerald-100 text-emerald-900'
                              : 'bg-rose-100 text-rose-900'
                          }`}
                        >
                          {req.status}
                        </span>
                      </div>
                      <span className="text-2xs text-slate-400 block mt-0.5">
                        E-mail: {req.usuario_email} · Submetido em: {req.data_solicitacao}
                      </span>
                    </div>

                    {req.status === 'pendente' && (
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleAbrirIndeferirAuditoria(req)}
                          className="px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                        >
                          Rejeitar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAprovarAuditoria(req)}
                          className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 shadow-xs"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Aprovar Alteração</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Comparativo DIFF Lado a Lado */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                    <div className="grid grid-cols-12 bg-slate-50 px-3.5 py-2 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                      <span className="col-span-4">Campo Modificado</span>
                      <span className="col-span-4 text-rose-700">Dado Anterior</span>
                      <span className="col-span-4 text-teal-700">Nova Informação Solicitada</span>
                    </div>
                    {req.alteracoes.map((alt, i) => (
                      <div key={i} className="grid grid-cols-12 px-3.5 py-2.5 items-center gap-2 hover:bg-slate-50">
                        <span className="col-span-4 font-bold text-slate-800 text-xs">
                          {alt.campo_label}
                        </span>
                        <span className="col-span-4 font-mono text-slate-500 line-through text-xs truncate">
                          {alt.valor_antigo}
                        </span>
                        <span className="col-span-4 font-mono text-teal-800 font-bold text-xs truncate flex items-center gap-1">
                          <ArrowRight className="w-3 h-3 text-teal-600 shrink-0" />
                          {alt.valor_novo}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ============================================================== */}
      {/* ABA 3: VALIDAÇÃO MANUAL DE CANDIDATOS E NOVOS CADASTROS        */}
      {/* ============================================================== */}
      {abaAdmin === 'validacoes' && (
        <section className="space-y-6">
          <div className="border-b border-slate-200 pb-3">
            <h2 className="text-xl font-bold font-serif text-slate-900">
              Fila de Validação Manual e Novos Cadastros (1º Acesso)
            </h2>
            <p className="text-xs text-slate-500">
              Novos usuários cadastrados com CPF inédito no 1º acesso (com sugestões automáticas de nomes parecidos para vinculação) e solicitações de validação manual.
            </p>
          </div>

          {vinculacoes.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-xs text-slate-400 card-shadow">
              Nenhuma solicitação de validação ou novo cadastro pendente no momento.
            </div>
          ) : (
            <div className="space-y-4">
              {vinculacoes.map((v) => {
                const candsDoCargo = lotesStore.getCandidatos(v.concurso_id, v.cargo_id);
                const candSugerido = candsDoCargo.find((c) => c.posicao === v.posicao_declarada);
                const idSelecionado =
                  vinculoCandSelecionado[v.id] !== undefined
                    ? vinculoCandSelecionado[v.id]
                    : candSugerido?.id || '';

                const sugestoesNomes = userRegistryStore.buscarSugestoesNomesParecidos(
                  v.usuario_nome,
                  v.cpf,
                  v.usuario_email,
                  5,
                  v.usuario_id
                );

                return (
                  <div
                    key={v.id}
                    className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 card-shadow flex flex-col gap-4"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          {v.tipo === 'novo_cadastro' && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-teal-100 text-teal-900 border border-teal-300 uppercase">
                              Novo Cadastro • 1º Acesso
                            </span>
                          )}
                          <span className="font-bold text-sm text-slate-900">{v.usuario_nome}</span>
                          <span className="text-2xs font-mono text-slate-500">({v.usuario_email})</span>
                          <span className="text-2xs font-mono text-slate-400">CPF: {v.cpf}</span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                              v.status === 'pendente'
                                ? 'bg-amber-100 text-amber-900'
                                : v.status === 'aprovado'
                                ? 'bg-emerald-100 text-emerald-900'
                                : 'bg-rose-100 text-rose-900'
                            }`}
                          >
                            {v.status}
                          </span>
                        </div>

                        <div className="text-xs text-slate-600 flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-teal-800">
                            {v.concurso_nome || v.concurso_id} • {v.cargo_nome || v.cargo_id}
                          </span>
                          {v.ano_concurso && (
                            <span className="text-2xs font-mono text-slate-500">({v.ano_concurso})</span>
                          )}
                          {v.tipo !== 'novo_cadastro' && (
                            <>
                              <span className="text-slate-300">·</span>
                              <span className="font-mono font-bold text-slate-800">
                                Classificação oficial declarada: {v.posicao_declarada}º lugar
                              </span>
                            </>
                          )}
                          {v.cota_declarada && (
                            <>
                              <span className="text-slate-300">·</span>
                              <span className="font-mono font-bold text-purple-800">
                                Modalidade: {v.cota_declarada}
                              </span>
                            </>
                          )}
                          {v.nota_declarada && (
                            <>
                              <span className="text-slate-300">·</span>
                              <span className="font-mono text-slate-600">Nota: {v.nota_declarada}</span>
                            </>
                          )}
                        </div>

                        {v.comprovante_info && (
                          <p className="text-2xs text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100 max-w-2xl">
                            <strong>Informação do Sistema / Candidato:</strong> {v.comprovante_info}
                          </p>
                        )}
                      </div>

                      {v.status === 'pendente' && (
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleAbrirIndeferirVinculacao(v)}
                            className="px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Indeferir...</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAprovarVinculacao(v)}
                            className="px-4 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 shadow-xs"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>
                              {v.tipo === 'novo_cadastro' && !idSelecionado
                                ? 'Homologar como Novo Cadastro'
                                : 'Vincular e Homologar Aprovado'}
                            </span>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Sugestões Automáticas de Nomes Parecidos para Vinculação em 1 Clique */}
                    {v.status === 'pendente' && sugestoesNomes.length > 0 && (
                      <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2.5 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-amber-950 flex items-center gap-1.5">
                            <UserCheck className="w-4 h-4 text-amber-700 shrink-0" />
                            <span>
                              Nomes Parecidos Encontrados para &quot;{v.usuario_nome}&quot; (Sugestões de Vínculo):
                            </span>
                          </span>
                          <span className="text-[10px] font-mono text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                            {sugestoesNomes.length} sugestão(ões)
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {sugestoesNomes.map((sug) => (
                            <div
                              key={`${sug.candidato_id}-${sug.concurso_id || 'geral'}`}
                              className="p-2.5 bg-white rounded-xl border border-amber-200 flex items-center justify-between gap-3 shadow-2xs"
                            >
                              <div className="min-w-0 space-y-0.5">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-bold text-slate-900 text-xs">{sug.nome}</span>
                                  <span className="text-[10px] font-mono font-bold text-teal-800 bg-teal-100 px-1.5 py-0.5 rounded">
                                    {sug.similaridade}% compatível
                                  </span>
                                </div>
                                <div className="text-[11px] text-slate-600 truncate">
                                  {sug.concurso_nome || 'Cadastro Geral'}
                                  {sug.cargo_nome ? ` • ${sug.cargo_nome}` : ''}
                                  {sug.posicao ? ` • ${sug.posicao}º lugar` : ''}
                                  {sug.cpf ? ` • CPF: ${sug.cpf}` : ''}
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleVincularPorSugestaoNome(v, sug)}
                                className="px-3 py-1.5 bg-[#07192B] hover:bg-[#0C2640] text-[#2DD4AA] font-bold rounded-lg text-[11px] shrink-0 cursor-pointer transition-colors"
                              >
                                Vincular a este
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Seletor para vincular a solicitação a um aprovado da lista / cadastro geral */}
                    {v.status === 'pendente' && candsDoCargo.length > 0 && (
                      <div className="p-3 bg-teal-50/50 border border-teal-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                        <label className="font-bold text-teal-950 flex items-center gap-1.5">
                          <UserCheck className="w-4 h-4 text-teal-700 shrink-0" />
                          <span>Vincular manualmente a outro aprovado da lista deste cargo:</span>
                        </label>
                        <select
                          value={idSelecionado}
                          onChange={(e) =>
                            setVinculoCandSelecionado((prev) => ({
                              ...prev,
                              [v.id]: e.target.value,
                            }))
                          }
                          className="px-3 py-1.5 bg-white border border-teal-300 rounded-lg text-xs font-semibold text-slate-800 max-w-md w-full"
                        >
                          <option value="">
                            {v.tipo === 'novo_cadastro'
                              ? `-- Manter como novo cadastro sem vínculo na lista (${v.usuario_nome}) --`
                              : `-- Criar novo registro na ${v.posicao_declarada}ª posição (${v.usuario_nome}) --`}
                          </option>
                          {candsDoCargo.map((cand) => (
                            <option key={cand.id} value={cand.id}>
                              {cand.posicao}º lugar — {cand.nome} ({cand.cota} • Nota {cand.nota_final})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {v.status === 'rejeitado' && v.motivo_rejeicao && (
                      <div className="w-full mt-1 p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-2xs text-rose-800">
                        <span className="font-bold block text-rose-900">Motivo do Indeferimento:</span>
                        <p className="mt-0.5">{v.motivo_rejeicao}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ============================================================== */}
      {/* ABA 4: CAIXA DE ENTRADA / FALE COM O ADMIN                     */}
      {/* ============================================================== */}
      {abaAdmin === 'contatos' && (
        <section className="space-y-6">
          <div className="border-b border-slate-200 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-xl font-bold font-serif text-slate-900">
                Caixa de Entrada • Mensagens dos Concurseiros
              </h2>
              <p className="text-xs text-slate-500">
                Solicitações de inclusão de novos certames com nome, ano e colocação, dúvidas de posse e suporte.
              </p>
            </div>
          </div>

          {contatos.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-xs text-slate-400 card-shadow">
              Nenhuma mensagem recebida na caixa de entrada.
            </div>
          ) : (
            <div className="space-y-4">
              {contatos.map((msg) => (
                <div
                  key={msg.id}
                  className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 card-shadow space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-slate-100 pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-teal-800 bg-teal-50 px-2.5 py-0.5 rounded-md border border-teal-200">
                          {msg.motivo_label}
                        </span>
                        <span className="text-2xs font-mono text-slate-400">{msg.data_envio}</span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            msg.status === 'aberto'
                              ? 'bg-amber-100 text-amber-900'
                              : msg.status === 'respondido'
                              ? 'bg-emerald-100 text-emerald-900'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {msg.status}
                        </span>
                      </div>
                      <h3 className="font-bold text-sm text-slate-900 mt-1">
                        De: {msg.usuario_nome} ({msg.usuario_email})
                      </h3>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {msg.status === 'aberto' && (
                        <button
                          type="button"
                          onClick={() => {
                            setRespostaContatoId(msg.id);
                            setRespostaTexto('');
                          }}
                          className="px-3.5 py-1.5 bg-[#07192B] hover:bg-[#0C2640] text-[#2DD4AA] font-bold text-xs rounded-xl transition-all cursor-pointer shadow-xs"
                        >
                          Responder
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => contactStore.arquivarMensagem(msg.id)}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl"
                      >
                        Arquivar
                      </button>
                    </div>
                  </div>

                  {/* Detalhes de Solicitação de Inclusão de Novo Concurso */}
                  {msg.concurso_nome && (
                    <div className="p-3 bg-teal-50/40 border border-teal-200 rounded-xl grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <div>
                        <span className="text-2xs font-bold uppercase text-slate-400 block">Concurso</span>
                        <span className="font-bold text-slate-800">{msg.concurso_nome}</span>
                      </div>
                      <div>
                        <span className="text-2xs font-bold uppercase text-slate-400 block">Ano</span>
                        <span className="font-mono text-slate-800">{msg.ano_concurso || '2025'}</span>
                      </div>
                      <div>
                        <span className="text-2xs font-bold uppercase text-slate-400 block">Cargo Aprovado</span>
                        <span className="text-slate-800">{msg.cargo_nome || '-'}</span>
                      </div>
                      <div>
                        <span className="text-2xs font-bold uppercase text-slate-400 block">Classificação</span>
                        <span className="font-mono text-teal-800 font-bold">{msg.classificacao || '-'}</span>
                      </div>
                    </div>
                  )}

                  <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100 whitespace-pre-line font-medium">
                    {msg.mensagem}
                  </p>

                  {/* Resposta do Administrador (se houver) */}
                  {msg.resposta_admin && (
                    <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl space-y-1 text-xs">
                      <span className="font-bold text-emerald-900 block text-2xs uppercase">
                        Sua Resposta ({msg.data_resposta}):
                      </span>
                      <p className="text-emerald-950 leading-relaxed">{msg.resposta_admin}</p>
                    </div>
                  )}

                  {/* Formulário de Resposta Aberto */}
                  {respostaContatoId === msg.id && (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                      <label className="block text-2xs font-bold text-slate-700 uppercase">
                        Escrever Resposta para o Candidato:
                      </label>
                      <textarea
                        rows={3}
                        value={respostaTexto}
                        onChange={(e) => setRespostaTexto(e.target.value)}
                        placeholder="Escreva a orientação oficial..."
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs focus:outline-hidden"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setRespostaContatoId(null)}
                          className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleEnviarRespostaContato(msg.id)}
                          className="px-4 py-1.5 bg-[#07192B] text-[#2DD4AA] text-xs font-bold rounded-xl cursor-pointer"
                        >
                          Enviar Resposta
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ============================================================== */}
      {/* ABA 5: DISPARADOR DE NOTIFICAÇÕES INTERNAS                     */}
      {/* ============================================================== */}
      {abaAdmin === 'notificacoes' && (
        <section className="space-y-6">
          <div className="border-b border-slate-200 pb-3">
            <h2 className="text-xl font-bold font-serif text-slate-900">
              Central de Notificações Internas do Portal
            </h2>
            <p className="text-xs text-slate-500">
              Dispare avisos no ícone de sino do portal otimizados em broadcast único para não duplicar registros no banco.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Formulário de Disparo */}
            <form
              onSubmit={handleDispararNotificacao}
              className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 card-shadow space-y-3.5 text-xs"
            >
              <h3 className="font-bold text-sm text-slate-900 font-serif">Nova Notificação Broadcast</h3>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Concurso Alvo:</label>
                <select
                  value={notifConcursoId}
                  onChange={(e) => setNotifConcursoId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl"
                >
                  <option value="todos">Todos os Concursos (Geral)</option>
                  {concursos.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome} ({c.orgao})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tipo de Aviso:</label>
                <select
                  value={notifTipo}
                  onChange={(e) => setNotifTipo(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl"
                >
                  <option value="convocacao">Convocação / Novo Lote</option>
                  <option value="cronograma">Etapa do Cronograma</option>
                  <option value="documento">Edital / Documento Publicado</option>
                  <option value="comunicado">Comunicado Oficial / PL</option>
                  <option value="geral">Geral</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Título da Notificação:</label>
                <input
                  type="text"
                  placeholder="Ex: Convocação do 2º Lote Publicada"
                  value={notifTitulo}
                  onChange={(e) => setNotifTitulo(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Mensagem do Alerta:</label>
                <textarea
                  rows={3}
                  placeholder="Descreva o conteúdo do comunicado para os concurseiros..."
                  value={notifMensagem}
                  onChange={(e) => setNotifMensagem(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl leading-relaxed"
                  required
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-2.5 bg-[#07192B] hover:bg-[#0C2640] text-[#2DD4AA] font-bold rounded-xl transition-all cursor-pointer shadow-sm flex items-center justify-center gap-2"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Publicar Notificação no Portal</span>
                </button>
              </div>
            </form>

            {/* Histórico de Notificações Publicadas */}
            <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 card-shadow space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-slate-900 font-serif">
                  Avisos Ativos no Sino ({notificacoes.length})
                </h3>
                {notificacoes.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      notificationStore.salvarNotificacoes([], true);
                      setNotificacoes([]);
                      showToast('Histórico de notificações limpo!');
                    }}
                    className="text-2xs font-bold text-rose-600 hover:text-rose-800 px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200 cursor-pointer"
                  >
                    Limpar Todas
                  </button>
                )}
              </div>
              <div className="max-h-[460px] overflow-y-auto space-y-2.5 divide-y divide-slate-100">
                {notificacoes.map((item) => {
                  const meta = obterMetadadosVisuaisNotificacao(item);
                  const paraAdmin = isNotificacaoParaAdmin(item);
                  const paraCandidato = isNotificacaoExclusivaCandidato(item);
                  return (
                    <div key={item.id} className="pt-2.5 first:pt-0 flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-xs text-slate-800">{item.titulo}</span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                              meta.temaCor === 'amber'
                                ? 'bg-amber-100 text-amber-900 border-amber-300'
                                : meta.temaCor === 'emerald'
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                : meta.temaCor === 'rose'
                                ? 'bg-rose-100 text-rose-800 border-rose-200'
                                : 'bg-teal-50 text-teal-800 border-teal-200'
                            }`}
                          >
                            {meta.badgeLabel}
                          </span>
                          <span className="text-2xs font-mono text-slate-400 ml-auto">{item.data_hora}</span>
                        </div>
                        <p className="text-xs text-slate-600 mt-1 leading-relaxed">{item.mensagem}</p>
                        <div className="flex items-center gap-3 flex-wrap mt-1">
                          <span className="text-[10px] font-mono text-teal-700 font-semibold">
                            Público-Alvo:{' '}
                            {paraAdmin
                              ? 'Exclusivo Admin'
                              : paraCandidato
                              ? `Candidato: ${item.destinatario_nome || ''} (${item.destinatario_email || item.destinatario_cpf || 'individual'})`
                              : `Broadcast (${item.concurso_id || 'Todos os Concursos'})`}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          notificationStore.removerNotificacao(item.id);
                          setNotificacoes(notificationStore.getNotificacoes());
                        }}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer shrink-0"
                        title="Remover esta notificação"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ============================================================== */}
      {/* ABA 6: IMPORTAÇÃO DE PLANILHAS (XLSX / CSV)                    */}
      {/* ============================================================== */}
      {abaAdmin === 'importar' && (
        <section className="space-y-6">
          <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 card-shadow space-y-4">
            <h2 className="text-xl font-bold font-serif text-slate-900">
              Importação em Lote de Listas Oficiais
            </h2>
            <p className="text-xs text-slate-500">
              Envie arquivos Excel (.xlsx) ou CSV com as colunas de classificação, nome, nota e cotas.
            </p>
            {concursos.length === 0 ? (
              <div className="p-5 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900 text-xs space-y-2">
                <p className="font-semibold text-sm">Nenhum concurso cadastrado no momento.</p>
                <p className="text-slate-600">
                  Para importar a planilha de classificação, cadastre primeiro um concurso e os respectivos cargos na aba <strong>Concursos &amp; Cargos</strong>.
                </p>
                <button
                  type="button"
                  onClick={() => setAbaAdmin('concursos')}
                  className="px-4 py-2 bg-[#07192B] hover:bg-[#0C2640] text-[#2DD4AA] font-bold text-xs rounded-xl transition-all cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Building className="w-3.5 h-3.5" />
                  <span>Ir para Concursos &amp; Cargos</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Concurso:</label>
                  <select
                    value={importConcursoId}
                    onChange={(e) => handleConcursoChange(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                  >
                    {concursos.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Cargo:</label>
                  <select
                    value={importCargoId}
                    onChange={(e) => setImportCargoId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                  >
                    {concursos
                      .find((c) => c.id === importConcursoId)
                      ?.cargos?.map((cg) => (
                        <option key={cg.id} value={cg.id}>
                          {cg.nome}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Arquivo da Planilha:</label>
                  <input
                    type="file"
                    accept=".xlsx, .xls, .csv"
                    onChange={handleFileUpload}
                    className="block w-full text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-[#07192B] file:text-white border border-slate-300 rounded-xl bg-slate-50 p-1 cursor-pointer"
                  />
                  {nomeArquivo && (
                    <span className="text-[11px] text-teal-700 font-medium mt-1 block">
                      Arquivo selecionado: <strong>{nomeArquivo}</strong>
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* BARRA DE AÇÃO DIRETA QUANDO ARQUIVO ESTÁ SELECIONADO */}
            {nomeArquivo && (
              <div className="p-4 bg-teal-50/70 border border-teal-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">{nomeArquivo}</h4>
                    <p className="text-2xs text-teal-800">
                      {previewPlanilha.length > 0
                        ? `${previewPlanilha.length} candidatos identificados e validados para importação.`
                        : 'Carregando e processando linhas da planilha...'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={importando || previewPlanilha.length === 0}
                  onClick={handleConfirmarImportacao}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer transition-all flex items-center justify-center gap-2 whitespace-nowrap disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {importando
                      ? 'Importando...'
                      : previewPlanilha.length > 0
                      ? `Confirmar e Enviar Importação (${previewPlanilha.length})`
                      : 'Processando arquivo...'}
                  </span>
                </button>
              </div>
            )}

            {/* Alerta de Erro na Importação */}
            {erroImportacao && (
              <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-rose-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{erroImportacao}</span>
              </div>
            )}

            {/* MAPEAMENTO DE COLUNAS E PREVIEW EDITÁVEL (Item 15) */}
            {previewPlanilha.length > 0 && (
              <div className="space-y-5 pt-4 border-t border-slate-200">
                {/* Painel de Mapeamento de Colunas da Planilha */}
                {colunasPlanilha.length > 0 && (
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-xs text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-teal-600" />
                          <span>Mapeamento Interativo de Colunas da Planilha</span>
                        </h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Defina qual coluna do seu arquivo corresponde a cada campo oficial do sistema (ex: separe Data de Convocação de Data de Nomeação).
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-xs">
                      {[
                        { key: 'posicao', label: 'Posição / Classif.' },
                        { key: 'nome', label: 'Nome do Candidato' },
                        { key: 'cpf', label: 'CPF' },
                        { key: 'nota_final', label: 'Nota Final' },
                        { key: 'cota', label: 'Cota(s) (PCD/PPP/Ampla)' },
                        { key: 'data_convocacao', label: 'Data de Convocação' },
                        { key: 'data_nomeacao', label: 'Data de Nomeação' },
                        { key: 'lotacao_definitiva', label: 'Lotação Definitiva' },
                        { key: 'papel', label: 'Papel (Titular/Suplente)' },
                        { key: 'email', label: 'E-mail' },
                      ].map((item) => (
                        <div key={item.key} className="bg-white p-2.5 rounded-xl border border-slate-200">
                          <label className="block font-bold text-slate-700 text-[11px] mb-1 truncate">
                            {item.label}:
                          </label>
                          <select
                            value={(mapeamentoColunas as any)[item.key] || ''}
                            onChange={(e) =>
                              handleAtualizarMapeamentoColuna(
                                item.key as keyof typeof mapeamentoColunas,
                                e.target.value
                              )
                            }
                            className="w-full px-2 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-[11px] font-medium focus:border-teal-600 outline-hidden"
                          >
                            <option value="">-- Ignorar / Não mapear --</option>
                            {colunasPlanilha.map((col) => (
                              <option key={col} value={col}>
                                {col}
                              </option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4 text-teal-600" />
                      <span>Tabela Editável antes da Importação ({previewPlanilha.length} candidatos)</span>
                    </h3>
                    <p className="text-2xs text-slate-500">
                      Clique diretamente em qualquer campo abaixo para fazer ajustes rápidos antes de consolidar a importação.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleAdicionarLinhaManualPreview}
                      className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl border border-slate-300 cursor-pointer flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Adicionar Linha</span>
                    </button>

                    <button
                      type="button"
                      disabled={importando}
                      onClick={handleConfirmarImportacao}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer transition-all flex items-center justify-center gap-2 whitespace-nowrap disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>
                        {importando
                          ? 'Importando...'
                          : `Confirmar Importação (${previewPlanilha.length})`}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Seletor de Quantidade de Linhas e Paginação do Importador (Item 15) */}
                {(() => {
                  const totalLinhas = previewPlanilha.length;
                  const totalPagsPreview =
                    limitePreview === 'todos'
                      ? 1
                      : Math.max(1, Math.ceil(totalLinhas / (limitePreview as number)));
                  const pagSegura = Math.min(paginaPreview, totalPagsPreview);
                  const offsetInicio =
                    limitePreview === 'todos' ? 0 : (pagSegura - 1) * (limitePreview as number);
                  const linhasExibidas =
                    limitePreview === 'todos'
                      ? previewPlanilha
                      : previewPlanilha.slice(offsetInicio, offsetInicio + (limitePreview as number));

                  const renderControlesPreview = () => (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-slate-600">
                          Exibindo{' '}
                          <strong className="text-slate-900">
                            {totalLinhas === 0 ? 0 : offsetInicio + 1} a{' '}
                            {offsetInicio + linhasExibidas.length}
                          </strong>{' '}
                          de <strong className="text-slate-900">{totalLinhas}</strong> candidatos
                        </span>

                        <div className="flex items-center gap-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase mr-1">
                            Linhas por página:
                          </span>
                          {([100, 250, 500, 'todos'] as const).map((lim) => (
                            <button
                              key={lim}
                              type="button"
                              onClick={() => {
                                setLimitePreview(lim);
                                setPaginaPreview(1);
                              }}
                              className={`px-2.5 py-1 rounded-lg font-mono text-[11px] font-bold cursor-pointer transition-colors ${
                                limitePreview === lim
                                  ? 'bg-[#07192B] text-[#2DD4AA]'
                                  : 'bg-white hover:bg-slate-200 text-slate-700 border border-slate-200'
                              }`}
                            >
                              {lim === 'todos' ? `Todos (${totalLinhas})` : lim}
                            </button>
                          ))}
                        </div>
                      </div>

                      {totalPagsPreview > 1 && (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={pagSegura <= 1}
                            onClick={() => setPaginaPreview(Math.max(1, pagSegura - 1))}
                            className="px-3 py-1 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg font-semibold disabled:opacity-40 cursor-pointer"
                          >
                            ← Anterior
                          </button>
                          <span className="font-mono text-slate-700 font-bold">
                            Pág. {pagSegura} / {totalPagsPreview}
                          </span>
                          <button
                            type="button"
                            disabled={pagSegura >= totalPagsPreview}
                            onClick={() => setPaginaPreview(Math.min(totalPagsPreview, pagSegura + 1))}
                            className="px-3 py-1 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg font-semibold disabled:opacity-40 cursor-pointer"
                          >
                            Próxima →
                          </button>
                        </div>
                      )}
                    </div>
                  );

                  return (
                    <>
                      {renderControlesPreview()}

                      {/* Tabela Editável de Prévia dos Candidatos */}
                      <div className="border border-slate-200 rounded-xl overflow-x-auto max-h-[540px]">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-[#07192B] text-white text-[11px] uppercase tracking-wider sticky top-0 z-10">
                            <tr>
                              <th className="py-2.5 px-2 w-16">Pos.</th>
                              <th className="py-2.5 px-2 min-w-[200px]">Nome Completo</th>
                              <th className="py-2.5 px-2 w-32">CPF</th>
                              <th className="py-2.5 px-2 w-20">Nota</th>
                              <th className="py-2.5 px-2 w-56">Cotas Contempladas (Ampla + PCD/PPP)</th>
                              <th className="py-2.5 px-2 w-32">Data Convocação</th>
                              <th className="py-2.5 px-2 w-32">Data Nomeação</th>
                              <th className="py-2.5 px-2 w-36">Lotação Definitiva</th>
                              <th className="py-2.5 px-2 w-10 text-center">Ação</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 bg-white">
                            {linhasExibidas.map((cand, localIdx) => {
                              const realIdx = offsetInicio + localIdx;
                              const cotasAtuais: Candidato['cota'][] =
                                cand.cotas && cand.cotas.length > 0
                                  ? cand.cotas
                                  : [cand.cota || 'Ampla'];

                              const toggleCotaCand = (cotaAlvo: Candidato['cota']) => {
                                const set = new Set<Candidato['cota']>(['Ampla', ...cotasAtuais]);
                                if (set.has(cotaAlvo)) {
                                  set.delete(cotaAlvo);
                                } else {
                                  set.add(cotaAlvo);
                                }
                                const novas = Array.from(set);
                                const novaPrincipal: Candidato['cota'] = novas.includes('PCD')
                                  ? 'PCD'
                                  : novas.includes('PPP')
                                  ? 'PPP'
                                  : novas.includes('Indígena')
                                  ? 'Indígena'
                                  : novas.includes('Trans')
                                  ? 'Trans'
                                  : 'Ampla';
                                handleEditarCelulaPreview(realIdx, 'cotas', novas);
                                handleEditarCelulaPreview(realIdx, 'cota', novaPrincipal);
                              };

                              return (
                                <tr key={cand.id || realIdx} className="hover:bg-slate-50">
                                  <td className="py-1.5 px-2">
                                    <input
                                      type="number"
                                      value={cand.posicao || realIdx + 1}
                                      onChange={(e) =>
                                        handleEditarCelulaPreview(
                                          realIdx,
                                          'posicao',
                                          parseInt(e.target.value, 10) || 1
                                        )
                                      }
                                      className="w-14 px-1.5 py-1 bg-slate-50 border border-slate-200 rounded font-mono font-bold text-slate-900 text-xs"
                                    />
                                  </td>
                                  <td className="py-1.5 px-2">
                                    <input
                                      type="text"
                                      value={cand.nome || ''}
                                      onChange={(e) =>
                                        handleEditarCelulaPreview(realIdx, 'nome', e.target.value)
                                      }
                                      className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded font-semibold text-slate-800 text-xs"
                                    />
                                  </td>
                                  <td className="py-1.5 px-2">
                                    <input
                                      type="text"
                                      placeholder="CPF"
                                      value={cand.cpf || ''}
                                      onChange={(e) =>
                                        handleEditarCelulaPreview(realIdx, 'cpf', e.target.value)
                                      }
                                      className="w-28 px-2 py-1 bg-slate-50 border border-slate-200 rounded font-mono text-slate-600 text-[11px]"
                                    />
                                  </td>
                                  <td className="py-1.5 px-2">
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={cand.nota_final ?? 0}
                                      onChange={(e) =>
                                        handleEditarCelulaPreview(
                                          realIdx,
                                          'nota_final',
                                          parseFloat(e.target.value) || 0
                                        )
                                      }
                                      className="w-18 px-1.5 py-1 bg-slate-50 border border-slate-200 rounded font-mono font-bold text-teal-700 text-xs"
                                    />
                                  </td>
                                  {/* Item 8: Seletor multi-cota (PCD + PPP simultâneos) */}
                                  <td className="py-1.5 px-2">
                                    <div className="flex items-center gap-1 flex-wrap">
                                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                        Ampla
                                      </span>
                                      {(['PCD', 'PPP', 'Indígena', 'Trans'] as const).map((ct) => {
                                        const ativo = cotasAtuais.includes(ct);
                                        return (
                                          <button
                                            key={ct}
                                            type="button"
                                            onClick={() => toggleCotaCand(ct)}
                                            className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer border transition-colors ${
                                              ativo
                                                ? ct === 'PCD'
                                                  ? 'bg-purple-600 text-white border-purple-700'
                                                  : ct === 'PPP'
                                                  ? 'bg-amber-600 text-white border-amber-700'
                                                  : 'bg-teal-700 text-white border-teal-800'
                                                : 'bg-white text-slate-400 border-slate-200 hover:border-slate-400'
                                            }`}
                                            title="Clique para marcar/desmarcar esta cota para o candidato"
                                          >
                                            {ct}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </td>
                                  <td className="py-1.5 px-2">
                                    <input
                                      type="text"
                                      placeholder="dd/mm/aaaa"
                                      value={cand.data_convocacao || ''}
                                      onChange={(e) =>
                                        handleEditarCelulaPreview(
                                          realIdx,
                                          'data_convocacao',
                                          e.target.value
                                        )
                                      }
                                      className="w-28 px-2 py-1 bg-slate-50 border border-slate-200 rounded font-mono text-[11px] text-slate-700"
                                    />
                                  </td>
                                  <td className="py-1.5 px-2">
                                    <input
                                      type="text"
                                      placeholder="dd/mm/aaaa"
                                      value={cand.data_nomeacao || ''}
                                      onChange={(e) =>
                                        handleEditarCelulaPreview(
                                          realIdx,
                                          'data_nomeacao',
                                          e.target.value
                                        )
                                      }
                                      className="w-28 px-2 py-1 bg-slate-50 border border-slate-200 rounded font-mono text-[11px] text-slate-700"
                                    />
                                  </td>
                                  <td className="py-1.5 px-2">
                                    <input
                                      type="text"
                                      placeholder="Lotação oficial"
                                      value={cand.comarca_definitiva || ''}
                                      onChange={(e) =>
                                        handleEditarCelulaPreview(
                                          realIdx,
                                          'comarca_definitiva',
                                          e.target.value
                                        )
                                      }
                                      className="w-32 px-2 py-1 bg-slate-50 border border-slate-200 rounded text-[11px] text-slate-700"
                                    />
                                  </td>
                                  <td className="py-1.5 px-2 text-center">
                                    <button
                                      type="button"
                                      onClick={() => handleRemoverLinhaPreview(realIdx)}
                                      className="p-1 text-rose-500 hover:bg-rose-50 rounded cursor-pointer"
                                      title="Remover linha"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {renderControlesPreview()}
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ============================================================== */}
      {/* ABA 7: CENTRAL DE PERGUNTAS FREQUENTES (FAQ)                   */}
      {/* ============================================================== */}
      {abaAdmin === 'faq' && (
        <section className="space-y-6">
          <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 card-shadow flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold font-serif text-slate-900">FAQ e Base de Conhecimento</h2>
              <p className="text-xs text-slate-500">
                Orientações sobre comarcas, remuneração, teletrabalho e posse.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setFaqPergunta('');
                setFaqResposta('');
                setModalNovoFaqAberto(true);
              }}
              className="px-4 py-2 bg-[#07192B] text-[#2DD4AA] font-bold text-xs rounded-xl shadow-xs"
            >
              + Adicionar Pergunta
            </button>
          </div>

          <div className="space-y-3">
            {faqs.map((f) => (
              <div key={f.id} className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2 card-shadow">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-900">{f.pergunta}</span>
                  <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono">
                    {f.categoria}
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">{f.resposta}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ============================================================== */}
      {/* ABA 8: DIAGNÓSTICO SUPABASE & SINCRONIZAÇÃO EM TEMPO REAL      */}
      {/* ============================================================== */}
      {abaAdmin === 'supabase' && (
        <section className="space-y-6">
          {/* Cabeçalho e Ações de Verificação e Limpeza Geral */}
          <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 card-shadow flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1 max-w-2xl">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span>BANCO DE DADOS EXCLUSIVO DO SITE ATUAL (public.configuracoes)</span>
              </div>
              <h2 className="text-xl font-bold font-serif text-slate-900">
                Limpeza Geral do Supabase & Sincronização de Classificação
              </h2>
              <p className="text-xs text-slate-500 leading-relaxed">
                O site atual utiliza <strong>exclusivamente</strong> a tabela{' '}
                <code className="font-mono text-slate-700">public.configuracoes</code>. Use os botões ao lado para eliminar dados residuais de outro site antigo, publicar todas as listas de classificação (<code className="font-mono text-slate-700">certam_candidatos_data_v6_*</code>) para usuários comuns e copiar o script SQL que apaga todas as tabelas inutilizadas.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  const sqlLimpeza = `-- LIMPEZA GERAL: MANTÉM APENAS public.configuracoes E APAGA TABELAS/DADOS DO OUTRO SITE
CREATE TABLE IF NOT EXISTS public.configuracoes (
    chave TEXT PRIMARY KEY,
    valor JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.configuracoes ADD COLUMN IF NOT EXISTS valor JSONB;
ALTER TABLE public.configuracoes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

DROP TABLE IF EXISTS public.respostas CASCADE;
DROP TABLE IF EXISTS public.lotes CASCADE;
DROP TABLE IF EXISTS public.concursos CASCADE;
DROP TABLE IF EXISTS public.comarcas_tjrs CASCADE;
DROP TABLE IF EXISTS public.candidatos_base CASCADE;

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'configuracoes') LOOP
    EXECUTE format('DROP TABLE IF EXISTS public.%I CASCADE', r.tablename);
  END LOOP;
END $$;

DELETE FROM public.configuracoes
WHERE chave NOT LIKE 'certam_%'
   OR chave LIKE 'certam_candidatos_data_v1_%'
   OR chave LIKE 'certam_candidatos_data_v2_%'
   OR chave LIKE 'certam_candidatos_data_v3_%'
   OR chave LIKE 'certam_candidatos_data_v4_%'
   OR chave LIKE 'certam_candidatos_data_v5_%'
   OR chave LIKE '%tjrs_2024%'
   OR chave LIKE '%mprs_2024%';

ALTER TABLE public.configuracoes ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.configuracoes TO anon, authenticated, service_role;
DROP POLICY IF EXISTS "configuracoes_leitura_publica" ON public.configuracoes;
CREATE POLICY "configuracoes_leitura_publica" ON public.configuracoes FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "configuracoes_escrita_publica" ON public.configuracoes;
CREATE POLICY "configuracoes_escrita_publica" ON public.configuracoes FOR ALL TO public USING (true) WITH CHECK (true);
NOTIFY pgrst, 'reload schema';`;
                  navigator.clipboard.writeText(sqlLimpeza);
                  showToast('Script SQL de limpeza geral copiado! Cole no SQL Editor do Supabase e clique em RUN.');
                }}
                className="px-4 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold text-xs rounded-xl cursor-pointer transition-all shadow-xs"
              >
                Copiar SQL (Eliminar Tabelas do Outro Site)
              </button>

              <button
                type="button"
                disabled={diagLoading}
                onClick={async () => {
                  setDiagLoading(true);
                  try {
                    await cloudSync.pullFromServer();
                    await cloudSync.pushAllLocal(true);
                    const rep = await cloudSync.runDiagnostics();
                    setDiagReport(rep);
                    reloadData();
                    setAuditRequests(auditStore.getAuditRequests());
                    setVinculacoes(auditStore.getVinculacoes());
                    setContatos(contactStore.getMensagens());
                    setUsuariosGerais(userRegistryStore.getAllUsers());
                    showToast('Teste de envio e recebimento concluído com sucesso!');
                  } finally {
                    setDiagLoading(false);
                  }
                }}
                className="px-4 py-2.5 bg-[#07192B] hover:bg-[#0C2640] text-[#2DD4AA] font-bold text-xs rounded-xl cursor-pointer transition-all shadow-xs disabled:opacity-50"
              >
                {diagLoading ? 'Verificando comunicação...' : 'Testar Envio e Recebimento Agora'}
              </button>

              <button
                type="button"
                disabled={cleaningConflicts}
                onClick={async () => {
                  setCleaningConflicts(true);
                  try {
                    const res = await cloudSync.cleanConflictsAndSyncAll();
                    const rep = await cloudSync.runDiagnostics();
                    setDiagReport(rep);
                    reloadData();
                    setAuditRequests(auditStore.getAuditRequests());
                    setVinculacoes(auditStore.getVinculacoes());
                    setContatos(contactStore.getMensagens());
                    setUsuariosGerais(userRegistryStore.getAllUsers());
                    showToast(
                      `Limpeza geral concluída! ${res.publishedKeysCount} bases (incluindo listas de classificação) publicadas!`
                    );
                  } finally {
                    setCleaningConflicts(false);
                  }
                }}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl cursor-pointer transition-all shadow-xs disabled:opacity-50"
              >
                {cleaningConflicts
                  ? 'Limpando e republicando...'
                  : 'Limpar Banco e Republicar Tudo Agora'}
              </button>
            </div>
          </div>

          {/* Configuração Direta da Conexão Supabase */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 card-shadow space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Credenciais de Conexão com o Projeto Supabase (REST API / PostgreSQL)
                </h3>
                <p className="text-xs text-slate-500">
                  Caso as variáveis <code className="font-mono text-slate-700">VITE_SUPABASE_URL</code> e{' '}
                  <code className="font-mono text-slate-700">VITE_SUPABASE_ANON_KEY</code> não estejam definidas no ambiente, informe abaixo os dados do seu projeto (disponíveis no Supabase em{' '}
                  <strong>Project Settings → API</strong>) para ativar a sincronização direta com a tabela única{' '}
                  <code className="font-mono text-slate-700">public.configuracoes</code>.
                </p>
              </div>
              <span
                className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold shrink-0 ${
                  cloudSync.getSupabaseConfig()
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                }`}
              >
                {cloudSync.getSupabaseConfig() ? 'SUPABASE CONFIGURADO' : 'USANDO SERVIDOR LOCAL (/api/sync)'}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Project URL (ex: https://xyzcompany.supabase.co)
                </label>
                <input
                  type="text"
                  value={supabaseUrlInput}
                  onChange={(e) => setSupabaseUrlInput(e.target.value)}
                  placeholder="https://seu-projeto.supabase.co"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono text-slate-800 bg-slate-50 focus:bg-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Anon / Public Key (chave pública anon)
                </label>
                <input
                  type="password"
                  value={supabaseKeyInput}
                  onChange={(e) => setSupabaseKeyInput(e.target.value)}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono text-slate-800 bg-slate-50 focus:bg-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              {cloudSync.getSupabaseConfig() && (
                <button
                  type="button"
                  onClick={async () => {
                    await cloudSync.clearSupabaseConfig();
                    setSupabaseUrlInput('');
                    setSupabaseKeyInput('');
                    const rep = await cloudSync.runDiagnostics();
                    setDiagReport(rep);
                    showToast('Configuração manual do Supabase removida.');
                  }}
                  className="px-3.5 py-2 border border-slate-300 hover:bg-slate-100 text-slate-600 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Desconectar Chave Manual
                </button>
              )}
              <button
                type="button"
                onClick={async () => {
                  if (!supabaseUrlInput.trim() || !supabaseKeyInput.trim()) {
                    showToast('Preencha a URL do projeto e a chave Anon/Public do Supabase.');
                    return;
                  }
                  setDiagLoading(true);
                  try {
                    const ok = await cloudSync.setSupabaseConfig(supabaseUrlInput, supabaseKeyInput);
                    const rep = await cloudSync.runDiagnostics();
                    setDiagReport(rep);
                    reloadData();
                    if (ok) {
                      showToast('Conectado ao Supabase e dados sincronizados com sucesso!');
                    } else {
                      showToast('Credenciais salvas, mas o Supabase retornou erro. Verifique a tabela abaixo.');
                    }
                  } finally {
                    setDiagLoading(false);
                  }
                }}
                className="px-4 py-2 bg-[#07192B] hover:bg-[#0C2640] text-[#2DD4AA] rounded-xl text-xs font-bold cursor-pointer"
              >
                Salvar e Conectar ao Supabase
              </button>
            </div>
          </div>

          {/* Resumo Visual do Estado Atual das Bases Sincronizadas */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl p-4 border border-slate-200 card-shadow space-y-1">
              <span className="text-[10px] font-mono uppercase font-bold text-slate-400">
                Concursos Publicados (v6)
              </span>
              <div className="text-lg font-bold text-slate-900">
                {concursos.length} concurso(s) • {metricas.totalCargos} cargo(s)
              </div>
              <p className="text-[11px] text-emerald-700 font-medium">
                Chave ativa: <code className="font-mono">certam_concursos_cargos_v6</code>
              </p>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-slate-200 card-shadow space-y-1">
              <span className="text-[10px] font-mono uppercase font-bold text-slate-400">
                Fila de Auditoria Cadastral (v5)
              </span>
              <div className="text-lg font-bold text-slate-900">
                {auditRequests.length} solicitação(ões) ({metricas.pendentesAudit} pendente)
              </div>
              <p className="text-[11px] text-emerald-700 font-medium">
                Chave ativa: <code className="font-mono">certam_perfil_audit_requests_v5</code>
              </p>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-slate-200 card-shadow space-y-1">
              <span className="text-[10px] font-mono uppercase font-bold text-slate-400">
                Mensagens de Contato / Admin (v5)
              </span>
              <div className="text-lg font-bold text-slate-900">
                {contatos.length} mensagem(ns) ({metricas.contatosAbertos} aberta)
              </div>
              <p className="text-[11px] text-emerald-700 font-medium">
                Chave ativa: <code className="font-mono">certam_contact_messages_v5</code>
              </p>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-slate-200 card-shadow space-y-1">
              <span className="text-[10px] font-mono uppercase font-bold text-slate-400">
                Cadastro Geral & Lotes
              </span>
              <div className="text-lg font-bold text-slate-900">
                {usuariosGerais.length} usuário(s) • {lotesLista.length} lote(s)
              </div>
              <p className="text-[11px] text-emerald-700 font-medium">
                Chaves: <code className="font-mono">users_v2</code> & <code className="font-mono">lotes_v6</code>
              </p>
            </div>
          </div>

          {/* PLANO 7: BACKUP COMPLETO EM 1 CLIQUE + MONITOR DE LIMITES GRATUITOS (SUPABASE & VERCEL) */}
          {(() => {
            const quotaMetrics = cloudSync.getQuotaAndSyncMetrics();
            return (
              <div className="bg-gradient-to-r from-[#07192B] to-[#0C2640] text-white rounded-2xl p-6 border border-[#135A7A]/60 card-shadow space-y-5">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/10 pb-4">
                  <div className="space-y-1">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#2DD4AA]/15 border border-[#2DD4AA]/40 text-[#2DD4AA] text-[10px] font-mono font-bold uppercase">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Proteção de Dados & Monitor de Cota Gratuita (Supabase / Vercel)</span>
                    </div>
                    <h3 className="text-base sm:text-lg font-bold font-serif text-white">
                      Backup Completo em 1 Clique, Delta Sync Incremental & Cache IndexedDB
                    </h3>
                    <p className="text-xs text-slate-300 max-w-3xl leading-relaxed">
                      Exporte uma cópia integral de segurança (<code className="font-mono text-teal-300">.json</code>) com todos os concursos, listas de classificação, lotes, cadastros e auditorias, ou restaure um backup a qualquer momento.
                    </p>
                  </div>

                  {/* Botões de Backup 1-Clique e Restauração */}
                  <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        const jsonStr = cloudSync.exportFullBackupJson();
                        const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        const dateTag = new Date().toISOString().slice(0, 10);
                        a.href = url;
                        a.download = `certam_backup_completo_${dateTag}.json`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                        showToast('Backup completo (.json) exportado com sucesso!');
                      }}
                      className="px-4 py-2.5 bg-[#2DD4AA] hover:bg-[#20BE96] text-slate-950 font-bold text-xs rounded-xl cursor-pointer transition-all shadow-sm flex items-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      <span>Baixar Backup Completo (.JSON)</span>
                    </button>

                    <label className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 font-bold text-xs rounded-xl cursor-pointer transition-all flex items-center gap-2">
                      <Upload className="w-4 h-4 text-teal-300" />
                      <span>Restaurar Backup (.JSON)</span>
                      <input
                        type="file"
                        accept=".json,application/json"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          try {
                            const text = await file.text();
                            setDiagLoading(true);
                            const res = await cloudSync.importFullBackupJson(text);
                            if (res.ok) {
                              reloadData();
                              setAuditRequests(auditStore.getAuditRequests());
                              setVinculacoes(auditStore.getVinculacoes());
                              setContatos(contactStore.getMensagens());
                              setUsuariosGerais(userRegistryStore.getAllUsers());
                              const rep = await cloudSync.runDiagnostics();
                              setDiagReport(rep);
                              showToast(`Backup restaurado com sucesso! (${res.restoredKeys} bases sincronizadas)`);
                            } else {
                              showToast(res.error || 'Falha ao importar backup.');
                            }
                          } catch {
                            showToast('Erro ao ler arquivo JSON de backup.');
                          } finally {
                            setDiagLoading(false);
                            e.target.value = '';
                          }
                        }}
                      />
                    </label>

                    <button
                      type="button"
                      onClick={async () => {
                        const ok = await cloudSync.triggerKeepAlivePing();
                        showToast(
                          ok
                            ? 'Keep-Alive enviado ao Supabase com sucesso! Projeto ativo.'
                            : 'Supabase não configurado ou indisponível no momento.'
                        );
                      }}
                      className="px-3.5 py-2.5 bg-teal-500/20 hover:bg-teal-500/30 border border-teal-400/40 text-teal-200 font-bold text-xs rounded-xl cursor-pointer transition-all"
                      title="Evita que o projeto gratuito do Supabase entre em pausa por inatividade"
                    >
                      ⚡ Ping Keep-Alive
                    </button>
                  </div>
                </div>

                {/* Indicadores de Uso dos Limites Gratuitos */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                  <div className="bg-white/5 border border-white/10 rounded-xl p-3.5 space-y-1">
                    <span className="text-[10px] font-mono uppercase text-slate-300 block">
                      Banco Supabase (Limite Free: 500 MB)
                    </span>
                    <div className="flex items-baseline justify-between">
                      <strong className="text-base font-mono text-white">
                        {quotaMetrics.totalStorageMB} MB
                      </strong>
                      <span className="text-[11px] font-mono text-[#2DD4AA]">
                        {quotaMetrics.supabaseDbUsagePercent}% usado ({quotaMetrics.totalKeys} chaves)
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#2DD4AA] rounded-full"
                        style={{ width: `${Math.max(2, quotaMetrics.supabaseDbUsagePercent)}%` }}
                      />
                    </div>
                  </div>

                  <div className="bg-white/5 border border-white/10 rounded-xl p-3.5 space-y-1">
                    <span className="text-[10px] font-mono uppercase text-slate-300 block">
                      Economia de Banda (Delta Sync)
                    </span>
                    <div className="flex items-baseline justify-between">
                      <strong className="text-base font-mono text-emerald-300">
                        {quotaMetrics.estimatedMBSaved} MB poupados
                      </strong>
                      <span className="text-[10px] font-mono text-slate-300">
                        {quotaMetrics.keysSkippedByDelta} leituras evitadas
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-300">
                      Baixa apenas chaves cujo <code className="font-mono">updated_at</code> mudou
                    </p>
                  </div>

                  <div className="bg-white/5 border border-white/10 rounded-xl p-3.5 space-y-1">
                    <span className="text-[10px] font-mono uppercase text-slate-300 block">
                      Cache Local Expandido (IndexedDB)
                    </span>
                    <div className="flex items-center justify-between">
                      <strong className="text-sm font-mono text-teal-300">
                        {quotaMetrics.indexedDbActive ? '✓ Ativo (Sem limite 5MB)' : 'Memória + LocalStorage'}
                      </strong>
                    </div>
                    <p className="text-[10px] text-slate-300">
                      Suporta dezenas de milhares de candidatos sem estourar cota do navegador
                    </p>
                  </div>

                  <div className="bg-white/5 border border-white/10 rounded-xl p-3.5 space-y-1">
                    <span className="text-[10px] font-mono uppercase text-slate-300 block">
                      Otimização Vercel & Keep-Alive
                    </span>
                    <div className="flex items-center justify-between">
                      <strong className="text-sm font-mono text-amber-300">
                        Polling 15s (Aba Visível)
                      </strong>
                    </div>
                    <p className="text-[10px] text-slate-300">
                      {quotaMetrics.lastKeepAliveAt
                        ? `Último Keep-Alive: ${new Date(quotaMetrics.lastKeepAliveAt).toLocaleTimeString('pt-BR')}`
                        : 'Pausa requisições automaticamente em segundo plano'}
                    </p>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Relatório Detalhado do Diagnóstico */}
          {diagReport && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Coluna 1: Servidor de Sincronização (/api/sync) */}
              <div className="bg-white rounded-2xl p-6 border border-slate-200 card-shadow space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      1. Servidor de Sincronização (<code className="font-mono">/api/sync</code>)
                    </h3>
                    <p className="text-xs text-slate-500">
                      Latência: {diagReport.localApi.latencyMs} ms • Total de chaves ativas:{' '}
                      {diagReport.localApi.totalKeys}
                    </p>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold ${
                      diagReport.localApi.ok && diagReport.localApi.roundtripOk
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}
                  >
                    {diagReport.localApi.ok && diagReport.localApi.roundtripOk
                      ? 'ENVIO & RECEBIMENTO OK'
                      : diagReport.localApi.error || 'INDISPONÍVEL'}
                  </span>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-700 text-[10px] uppercase font-mono">
                      <tr>
                        <th className="py-2 px-3">Chave no Servidor</th>
                        <th className="py-2 px-3">Registros</th>
                        <th className="py-2 px-3">Tamanho</th>
                        <th className="py-2 px-3">Última Atualização</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {diagReport.localApi.keys.map((item) => (
                        <tr key={item.key} className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-mono text-[11px] font-bold text-slate-800">
                            {item.key}
                          </td>
                          <td className="py-2 px-3 font-mono text-slate-700">{item.itemCount}</td>
                          <td className="py-2 px-3 font-mono text-slate-500">
                            {(item.sizeBytes / 1024).toFixed(1)} KB
                          </td>
                          <td className="py-2 px-3 font-mono text-[11px] text-slate-500">
                            {item.updatedAt
                              ? new Date(item.updatedAt).toLocaleTimeString('pt-BR')
                              : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Coluna 2: Tabelas do Supabase PostgreSQL */}
              <div className="bg-white rounded-2xl p-6 border border-slate-200 card-shadow space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      2. Tabelas no Supabase PostgreSQL
                    </h3>
                    <p className="text-xs text-slate-500">
                      {diagReport.supabase.configured
                        ? `Endpoint: ${diagReport.supabase.url}`
                        : 'Informe a URL e Anon Key acima para inspecionar as tabelas do Supabase ao vivo'}
                    </p>
                  </div>
                  {diagReport.supabase.configured && (
                    <span
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold ${
                        diagReport.supabase.connected && diagReport.supabase.roundtripOk
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}
                    >
                      {diagReport.supabase.connected && diagReport.supabase.roundtripOk
                        ? 'LEITURA & ESCRITA OK'
                        : diagReport.supabase.error || 'ERRO DE CONEXÃO'}
                    </span>
                  )}
                </div>

                {diagReport.supabase.configured ? (
                  <>
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-100 text-slate-700 text-[10px] uppercase font-mono">
                          <tr>
                            <th className="py-2 px-3">Tabela</th>
                            <th className="py-2 px-3">Status</th>
                            <th className="py-2 px-3">Linhas</th>
                            <th className="py-2 px-3">Conflitos / Observações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {diagReport.supabase.tables.map((tb) => (
                            <tr key={tb.table} className="hover:bg-slate-50">
                              <td className="py-2 px-3 font-mono font-bold text-slate-800">
                                public.{tb.table}
                              </td>
                              <td className="py-2 px-3">
                                {tb.ok ? (
                                  <span className="text-emerald-700 font-bold text-[11px]">
                                    OK ({tb.latencyMs}ms)
                                  </span>
                                ) : (
                                  <span className="text-rose-600 font-bold text-[11px]">
                                    {tb.error || 'Falha'}
                                  </span>
                                )}
                              </td>
                              <td className="py-2 px-3 font-mono font-bold text-slate-800">
                                {tb.rowCount}
                              </td>
                              <td className="py-2 px-3 text-[11px]">
                                {tb.conflictKeys && tb.conflictKeys.length > 0 ? (
                                  <span className="text-amber-700 font-semibold">
                                    Conflito: {tb.conflictKeys.join(', ')}
                                  </span>
                                ) : (
                                  <span className="text-slate-500">Sem conflitos</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {diagReport.supabase.conflictsFound.length > 0 && (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900">
                        <strong>Conflitos detectados nas tabelas do Supabase:</strong>{' '}
                        {diagReport.supabase.conflictsFound.join(', ')}. Clique no botão verde{' '}
                        <strong>"Limpar Conflitos e Republicar Tudo Agora"</strong> no topo para remover automaticamente esses registros legados.
                      </div>
                    )}
                  </>
                ) : (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 space-y-2 leading-relaxed">
                    <p>
                      <strong>Como verificar diretamente no painel do Supabase:</strong>
                    </p>
                    <ol className="list-decimal list-inside space-y-1">
                      <li>
                        Acesse o painel do seu projeto em{' '}
                        <code className="font-mono text-slate-800">https://supabase.com/dashboard</code> e abra{' '}
                        <strong>Table Editor</strong>.
                      </li>
                      <li>
                        Verifique a tabela <code className="font-mono text-slate-800">public.configuracoes</code> e a tabela dedicada de telemetria de erros <code className="font-mono text-slate-800">public.error_logs</code>.
                      </li>
                      <li>
                        Cole a <strong>Project URL</strong> e a <strong>Anon Key</strong> no quadro acima e clique em{' '}
                        <strong>Salvar e Conectar ao Supabase</strong> para testar a gravação e leitura diretamente daqui.
                      </li>
                    </ol>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      )}

      {/* ============================================================== */}
      {/* ABA: MONITOR CENTRALIZADO DE LOGS DE ERROS (SUPABASE REAL-TIME) */}
      {/* ============================================================== */}
      {abaAdmin === 'logs_erros' && (
        <section className="space-y-6 bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 card-shadow">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md text-[11px] font-mono font-bold bg-rose-50 text-rose-700 border border-rose-200 mb-2">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                <span>TELEMETRIA CENTRALIZADA • ERRORBOUNDARY → SUPABASE (public.error_logs)</span>
              </div>
              <h2 className="text-xl font-bold font-serif text-slate-900 flex items-center gap-2">
                <span>Monitoramento de Erros e Exceções em Tempo Real</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Todas as falhas capturadas pelo <code className="font-mono text-slate-700">ErrorBoundary</code> e exceções globais de execução são enviadas automaticamente para a tabela <code className="font-mono text-slate-700">public.system_logs</code> no Supabase e sincronizadas em tempo real.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={async () => {
                  setLoadingErrorLogs(true);
                  await errorLogStore.logError({
                    error: new Error('Falha simulada pelo Administrador para verificação de telemetria ErrorBoundary -> Supabase'),
                    componentStack: '\n    at ErrorBoundarySimulationButton (src/pages/AdminPanel.tsx)\n    at AdminPanel (src/pages/AdminPanel.tsx)\n    at AppContent (src/App.tsx)',
                    origem: 'TesteAdmin',
                  });
                  const res = await errorLogStore.fetchFromSupabaseTable();
                  setErrorLogs(res.logs);
                  setErrorTableStatus({ tableExists: res.tableExists, error: res.error });
                  setLoadingErrorLogs(false);
                  showToast('Log de teste disparado e sincronizado com o Supabase (public.system_logs)!');
                }}
                className="px-3.5 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl text-xs transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
              >
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Simular Falha ErrorBoundary</span>
              </button>

              <button
                type="button"
                disabled={loadingErrorLogs}
                onClick={async () => {
                  setLoadingErrorLogs(true);
                  const res = await errorLogStore.fetchFromSupabaseTable();
                  setErrorLogs(res.logs);
                  setErrorTableStatus({ tableExists: res.tableExists, error: res.error });
                  setLoadingErrorLogs(false);
                  showToast('Logs sincronizados em tempo real com o Supabase!');
                }}
                className="px-3.5 py-2 bg-[#0C2640] hover:bg-[#13385C] text-[#2DD4AA] font-bold rounded-xl text-xs transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{loadingErrorLogs ? 'Consultando Supabase...' : 'Atualizar de public.system_logs'}</span>
              </button>

              {errorLogs.length > 0 && (
                <button
                  type="button"
                  onClick={async () => {
                    await errorLogStore.limparTodosLogs();
                    setErrorLogs([]);
                    showToast('Todos os logs de erro foram removidos.');
                  }}
                  className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold rounded-xl text-xs transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Limpar Histórico</span>
                </button>
              )}
            </div>
          </div>

          {/* Cards de Status da Tabela e Contadores */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] font-mono uppercase font-bold text-slate-500 block">
                Total de Ocorrências Capturadas
              </span>
              <div className="text-2xl font-bold text-slate-900 mt-1">{errorLogs.length}</div>
              <span className="text-[11px] text-slate-500">Histórico consolidado em nuvem</span>
            </div>

            <div className="p-4 rounded-xl bg-rose-50/60 border border-rose-200">
              <span className="text-[10px] font-mono uppercase font-bold text-rose-700 block">
                Falhas Pendentes de Análise
              </span>
              <div className="text-2xl font-bold text-rose-700 mt-1">
                {errorLogs.filter((l) => !l.resolvido).length}
              </div>
              <span className="text-[11px] text-rose-600">Aguardando revisão do admin</span>
            </div>

            <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200">
              <span className="text-[10px] font-mono uppercase font-bold text-emerald-700 block">
                Problemas Resolvidos
              </span>
              <div className="text-2xl font-bold text-emerald-700 mt-1">
                {errorLogs.filter((l) => l.resolvido).length}
              </div>
              <span className="text-[11px] text-emerald-600">Marcados como solucionados</span>
            </div>

            <div
              className={`p-4 rounded-xl border ${
                errorTableStatus.tableExists
                  ? 'bg-teal-50/60 border-teal-200'
                  : 'bg-amber-50/60 border-amber-200'
              }`}
            >
              <span className="text-[10px] font-mono uppercase font-bold text-slate-700 block">
                Status da Tabela public.error_logs
              </span>
              <div className="text-sm font-bold mt-1.5 flex items-center gap-1.5">
                {errorTableStatus.tableExists ? (
                  <span className="text-teal-800 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4 text-teal-600" />
                    Tabela Dedicada Ativa
                  </span>
                ) : (
                  <span className="text-amber-900 flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    Espelhado via CloudSync
                  </span>
                )}
              </div>
              <span className="text-[11px] text-slate-600 block mt-0.5">
                {errorTableStatus.tableExists
                  ? 'Gravando direto em REST /rest/v1/error_logs'
                  : 'Execute o SQL abaixo para criar a tabela dedicada'}
              </span>
            </div>
          </div>

          {/* Instrução SQL para criação da tabela dedicada no Supabase caso ainda não exista */}
          <div className="p-4 bg-slate-900 text-slate-100 rounded-2xl border border-slate-800 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-teal-400">
                  Estrutura SQL da Tabela Dedicada no Supabase (public.error_logs)
                </h3>
                <p className="text-[11px] text-slate-300 mt-0.5">
                  O sistema envia cada falha automaticamente via <code className="text-teal-300">POST /rest/v1/error_logs</code> e também faz fallback automático em <code className="text-teal-300">public.configuracoes</code>. Caso deseje criar ou recriar a tabela relacional dedicada no Supabase SQL Editor, copie o script abaixo:
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(errorLogStore.getSqlCreateTableScript());
                  setSqlErrorTableCopiado(true);
                  showToast('Script SQL copiado para a área de transferência!');
                  setTimeout(() => setSqlErrorTableCopiado(false), 3000);
                }}
                className="px-3.5 py-2 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-xl text-xs transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 self-start sm:self-auto"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{sqlErrorTableCopiado ? 'SQL Copiado!' : 'Copiar Script SQL'}</span>
              </button>
            </div>
            <pre className="text-[11px] font-mono bg-slate-950 text-teal-300 p-3 rounded-xl overflow-x-auto border border-slate-800 max-h-40">
              {errorLogStore.getSqlCreateTableScript()}
            </pre>
          </div>

          {/* Barra de Filtros e Busca de Logs */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-1.5">
              {(['todos', 'pendentes', 'resolvidos'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setFiltroErroStatus(st)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer capitalize ${
                    filtroErroStatus === st
                      ? 'bg-[#0C2640] text-[#2DD4AA]'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {st === 'todos' ? 'Todos os Logs' : st === 'pendentes' ? 'Não Resolvidos' : 'Resolvidos'}
                </button>
              ))}
            </div>

            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filtrar por mensagem, origem, e-mail, URL ou protocolo..."
                value={buscaErroLog}
                onChange={(e) => setBuscaErroLog(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
              />
            </div>
          </div>

          {/* Lista de Logs Capturados */}
          <div className="space-y-3">
            {errorLogs
              .filter((log) => {
                if (filtroErroStatus === 'pendentes' && log.resolvido) return false;
                if (filtroErroStatus === 'resolvidos' && !log.resolvido) return false;
                if (!buscaErroLog.trim()) return true;
                const q = buscaErroLog.toLowerCase();
                return (
                  log.mensagem.toLowerCase().includes(q) ||
                  log.origem.toLowerCase().includes(q) ||
                  log.id.toLowerCase().includes(q) ||
                  (log.usuario_email && log.usuario_email.toLowerCase().includes(q)) ||
                  (log.usuario_nome && log.usuario_nome.toLowerCase().includes(q)) ||
                  log.url.toLowerCase().includes(q)
                );
              })
              .map((log) => (
                <div
                  key={log.id}
                  className={`p-4 rounded-2xl border transition-all ${
                    log.resolvido
                      ? 'bg-slate-50/70 border-slate-200 opacity-80'
                      : 'bg-white border-rose-200 shadow-sm'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase ${
                          log.origem === 'ErrorBoundary'
                            ? 'bg-rose-100 text-rose-800 border border-rose-200'
                            : log.origem === 'TesteAdmin'
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                        }`}
                      >
                        {log.origem}
                      </span>
                      <span className="text-xs font-mono font-bold text-slate-700">{log.data_hora}</span>
                      <span className="text-[11px] font-mono text-slate-400">ID: {log.id}</span>
                      {log.enviado_supabase_tabela && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-teal-50 text-teal-700 border border-teal-200">
                          Gravado em public.{log.tabela_supabase || 'system_logs'}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={async () => {
                          await errorLogStore.marcarComoResolvido(log.id, !log.resolvido);
                          setErrorLogs(errorLogStore.getLogs());
                          showToast(
                            !log.resolvido
                              ? 'Erro marcado como resolvido!'
                              : 'Erro reaberto para análise.'
                          );
                        }}
                        className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all flex items-center gap-1 ${
                          log.resolvido
                            ? 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                            : 'bg-emerald-600 text-white hover:bg-emerald-500'
                        }`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{log.resolvido ? 'Resolvido (Reabrir)' : 'Marcar como Resolvido'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={async () => {
                          await errorLogStore.excluirLog(log.id);
                          setErrorLogs(errorLogStore.getLogs());
                          showToast('Registro de erro excluído.');
                        }}
                        className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg cursor-pointer"
                        title="Excluir log"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-2.5 space-y-2">
                    <div className="text-xs sm:text-sm font-bold text-slate-900 font-mono break-words">
                      {log.error_message || log.mensagem}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-600">
                      <span>
                        <strong>Usuário / CPF:</strong>{' '}
                        <code className="font-mono text-slate-800 bg-slate-100 px-1 py-0.5 rounded">
                          {log.user_id || log.usuario_cpf || log.usuario_id || 'Anônimo'}
                        </code>
                        {log.usuario_nome && ` • ${log.usuario_nome}`}
                        {log.usuario_email && ` (${log.usuario_email})`}
                      </span>
                      <span>
                        <strong>Carimbo de Tempo:</strong>{' '}
                        <code className="font-mono">{log.carimbo_tempo || log.timestamp || log.created_at}</code>
                      </span>
                      <span>
                        <strong>URL:</strong> <code className="font-mono">{log.url}</code>
                      </span>
                    </div>

                    {(log.stack || log.component_stack) && (
                      <details className="mt-2 group">
                        <summary className="text-[11px] font-mono font-bold text-teal-700 cursor-pointer hover:underline select-none">
                          Inspecionar Stack Trace & React Component Stack
                        </summary>
                        <div className="mt-2 space-y-2">
                          {log.stack && (
                            <div>
                              <span className="text-[10px] font-mono uppercase font-bold text-slate-500 block mb-1">
                                Error Stack Trace:
                              </span>
                              <pre className="p-2.5 rounded-xl bg-slate-900 text-rose-300 font-mono text-[10px] overflow-x-auto max-h-44">
                                {log.stack}
                              </pre>
                            </div>
                          )}
                          {log.component_stack && (
                            <div>
                              <span className="text-[10px] font-mono uppercase font-bold text-slate-500 block mb-1">
                                React ErrorBoundary Component Stack:
                              </span>
                              <pre className="p-2.5 rounded-xl bg-slate-900 text-amber-300 font-mono text-[10px] overflow-x-auto max-h-44">
                                {log.component_stack}
                              </pre>
                            </div>
                          )}
                        </div>
                      </details>
                    )}
                  </div>
                </div>
              ))}

            {errorLogs.length === 0 && (
              <div className="p-10 text-center bg-slate-50 border border-dashed border-slate-200 rounded-2xl space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                <h3 className="text-sm font-bold text-slate-800">
                  Nenhuma falha registrada no ErrorBoundary até o momento
                </h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  O sistema está monitorando exceções de renderização e falhas globais em tempo real. Você pode clicar em <strong>"Simular Falha ErrorBoundary"</strong> no topo para testar o envio imediato ao Supabase.
                </p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ============================================================== */}
      {/* ABA: DOCUMENTOS OFICIAIS (ADMIN)                                */}
      {/* ============================================================== */}
      {abaAdmin === 'documentos_admin' && (
        <section className="space-y-6 bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 card-shadow">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-xl font-bold font-serif text-slate-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-teal-600" />
                <span>Gestão de Documentos Oficiais e Editais</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Adicione, edite ou remova editais, termos de convocação e avisos oficiais para cada concurso.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={docAdminConcursoId}
                onChange={(e) => setDocAdminConcursoId(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold"
              >
                {concursos.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome} ({c.orgao})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Formulário Adicionar / Editar Documento */}
          <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
            <h3 className="font-bold text-xs text-slate-900 uppercase tracking-wider">
              {docAdminEditandoId ? 'Editar Documento Oficial' : 'Adicionar Novo Documento Oficial'}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Título do Documento:</label>
                <input
                  type="text"
                  placeholder="Ex: Edital de Abertura nº 01/2025"
                  value={docAdminTitulo}
                  onChange={(e) => setDocAdminTitulo(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Tipo de Documento:</label>
                <select
                  value={docAdminTipo}
                  onChange={(e) => setDocAdminTipo(e.target.value as TipoDocumento)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl"
                >
                  <option value="Edital de Abertura">Edital de Abertura</option>
                  <option value="Retificação">Retificação</option>
                  <option value="Convocação">Convocação</option>
                  <option value="Resultado Final">Resultado Final</option>
                  <option value="Homologação">Homologação</option>
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">URL / Link do PDF:</label>
                <input
                  type="text"
                  placeholder="https://... ou arquivo.pdf"
                  value={docAdminUrl}
                  onChange={(e) => setDocAdminUrl(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Descrição / Observação:</label>
                <input
                  type="text"
                  placeholder="Detalhes adicionais..."
                  value={docAdminDesc}
                  onChange={(e) => setDocAdminDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              {docAdminEditandoId && (
                <button
                  type="button"
                  onClick={() => {
                    setDocAdminEditandoId(null);
                    setDocAdminTitulo('');
                    setDocAdminUrl('');
                    setDocAdminDesc('');
                  }}
                  className="px-3.5 py-2 text-xs text-slate-600 hover:text-slate-900 font-semibold"
                >
                  Cancelar Edição
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  if (!docAdminTitulo.trim() || !docAdminUrl.trim()) {
                    showToast('Preencha o título e o link/URL do documento.');
                    return;
                  }
                  const conc = certamStore.getConcurso(docAdminConcursoId);
                  if (!conc) return;
                  conc.documentos = conc.documentos || [];

                  if (docAdminEditandoId) {
                    conc.documentos = conc.documentos.map((d) =>
                      d.id === docAdminEditandoId
                        ? { ...d, titulo: docAdminTitulo, tipo: docAdminTipo, url_ou_arquivo: docAdminUrl, descricao: docAdminDesc }
                        : d
                    );
                    certamStore.salvarConcurso(conc, true);
                    showToast('Documento atualizado com sucesso!');
                  } else {
                    const novoDoc: DocumentoItem = {
                      id: `doc-${Date.now().toString(36)}`,
                      concurso_id: docAdminConcursoId,
                      titulo: docAdminTitulo,
                      tipo: docAdminTipo,
                      url_ou_arquivo: docAdminUrl,
                      descricao: docAdminDesc,
                      data_publicacao: new Date().toLocaleDateString('pt-BR'),
                      tamanho: 'PDF Oficial',
                    };
                    conc.documentos.unshift(novoDoc);
                    certamStore.salvarConcurso(conc, true);
                    showToast('Documento oficial adicionado com sucesso!');
                  }

                  setDocAdminEditandoId(null);
                  setDocAdminTitulo('');
                  setDocAdminUrl('');
                  setDocAdminDesc('');
                  reloadData();
                }}
                className="px-5 py-2 bg-[#07192B] text-[#2DD4AA] text-xs font-bold rounded-xl cursor-pointer shadow-sm"
              >
                {docAdminEditandoId ? 'Salvar Alterações' : 'Adicionar Documento Oficial'}
              </button>
            </div>
          </div>

          {/* Lista de Documentos Atuais */}
          <div className="space-y-3">
            <h3 className="font-bold text-xs text-slate-900 uppercase tracking-wider">
              Documentos Cadastrados no Concurso
            </h3>
            {(() => {
              const conc = certamStore.getConcurso(docAdminConcursoId);
              const docs = conc?.documentos || [];
              if (docs.length === 0) {
                return <p className="text-xs text-slate-400 py-6 text-center">Nenhum documento cadastrado para este concurso.</p>;
              }
              return (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden bg-white">
                  {docs.map((d) => (
                    <div key={d.id} className="p-4 flex items-center justify-between gap-4 hover:bg-slate-50">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-teal-100 text-teal-800">
                              {d.tipo}
                            </span>
                            <span className="text-2xs font-mono text-slate-400">{d.data_publicacao}</span>
                          </div>
                          <h4 className="font-bold text-xs text-slate-900 truncate mt-0.5">{d.titulo}</h4>
                          {d.descricao && <p className="text-2xs text-slate-500 truncate">{d.descricao}</p>}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setDocAdminEditandoId(d.id);
                            setDocAdminTitulo(d.titulo);
                            setDocAdminTipo(d.tipo);
                            setDocAdminUrl(d.url_ou_arquivo);
                            setDocAdminDesc(d.descricao || '');
                          }}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          <Pencil className="w-3 h-3" />
                          <span>Editar</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`Deseja remover o documento "${d.titulo}"?`)) {
                              const targetConc = certamStore.getConcurso(docAdminConcursoId);
                              if (targetConc) {
                                targetConc.documentos = (targetConc.documentos || []).filter((item) => item.id !== d.id);
                                certamStore.salvarConcurso(targetConc, true);
                                reloadData();
                                showToast('Documento removido com sucesso.');
                              }
                            }
                          }}
                          className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg cursor-pointer"
                          title="Remover Documento"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </section>
      )}

      {/* ============================================================== */}
      {/* ABA: EDITOR DE CLASSIFICAÇÃO & LISTAS SUSPENSAS (ADMIN)         */}
      {/* ============================================================== */}
      {abaAdmin === 'classificacao_admin' && (
        <section className="space-y-6 bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 card-shadow">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-xl font-bold font-serif text-slate-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-teal-600" />
                <span>Editor Manual de Lista de Classificação & Listas Suspensas</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Edite manualmente campos de candidatos e gerencie opções das listas suspensas (como Comarcas/Lotações e Cotas).
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={classifAdminConcursoId}
                onChange={(e) => {
                  setClassifAdminConcursoId(e.target.value);
                  const c = concursos.find((x) => x.id === e.target.value);
                  if (c?.cargos?.[0]) setClassifAdminCargoId(c.cargos[0].id);
                }}
                className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold"
              >
                {concursos.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
              <select
                value={classifAdminCargoId}
                onChange={(e) => setClassifAdminCargoId(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold"
              >
                {concursos
                  .find((c) => c.id === classifAdminConcursoId)
                  ?.cargos?.map((cg) => (
                    <option key={cg.id} value={cg.id}>{cg.nome}</option>
                  ))}
              </select>
              <button
                type="button"
                onClick={() => {
                  const cands = lotesStore.getCandidatos(classifAdminConcursoId, classifAdminCargoId);
                  const rows = cands.map((c) => ({
                    Posição: c.posicao,
                    Nome: c.nome,
                    CPF: c.cpf || '',
                    'Nota Final': c.nota_final,
                    Cota: (c.cotas && c.cotas.length > 0 ? c.cotas.join(' / ') : c.cota) || 'Ampla',
                    Status: c.status || 'Aguardando Convocação',
                    Intenção: c.intencao || 'Sim',
                    'Lotação Definitiva': c.comarca_definitiva || '',
                    'Preferências de Comarca': c.escolhas_comarcas?.join(', ') || c.comarca_desejada_1 || '',
                    'E-mail': c.email || '',
                    WhatsApp: c.whatsapp || '',
                  }));
                  const ws = XLSX.utils.json_to_sheet(rows);
                  const wb = XLSX.utils.book_new();
                  XLSX.utils.book_append_sheet(wb, ws, 'Classificacao');
                  XLSX.writeFile(wb, `certam-classificacao-${classifAdminConcursoId}-${classifAdminCargoId}.xlsx`);
                  showToast('Lista de classificação exportada em Excel (.XLSX)!');
                }}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Exportar Planilha (.XLSX)</span>
              </button>
            </div>
          </div>

          {/* Gestão de Listas Suspensas (Catálogo de Lotações/Comarcas) */}
          <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
            <h3 className="font-bold text-xs text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-teal-600" />
              <span>Gerenciar Opções da Lista Suspensiva (Catálogo de Comarcas / Lotações)</span>
            </h3>
            <div className="flex flex-col sm:flex-row items-center gap-2">
              <input
                type="text"
                placeholder="Nome da Nova Comarca / Lotação (ex: Porto Alegre, Santa Maria...)"
                value={novoOpcaoDropdown}
                onChange={(e) => setNovoOpcaoDropdown(e.target.value)}
                className="flex-1 w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs"
              />
              <button
                type="button"
                onClick={() => {
                  if (!novoOpcaoDropdown.trim()) return;
                  const added = certamStore.adicionarLotacaoAoCatalogo(classifAdminConcursoId, novoOpcaoDropdown);
                  if (added) {
                    showToast(`Comarca "${novoOpcaoDropdown}" adicionada à lista suspensa!`);
                    setNovoOpcaoDropdown('');
                    reloadData();
                  } else {
                    showToast('Essa comarca já consta na lista suspensa.');
                  }
                }}
                className="px-4 py-2 bg-[#07192B] text-[#2DD4AA] text-xs font-bold rounded-xl cursor-pointer whitespace-nowrap shadow-xs"
              >
                + Adicionar Opção à Lista
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5 pt-1">
              {(() => {
                const conc = certamStore.getConcurso(classifAdminConcursoId);
                const lotacoes = conc?.catalogo_lotacoes || [];
                if (lotacoes.length === 0) {
                  return <span className="text-xs text-slate-400">Nenhuma comarca cadastrada no catálogo.</span>;
                }
                return lotacoes.map((lot) => (
                  <span
                    key={lot.id}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 shadow-2xs"
                  >
                    <span>{lot.nome}</span>
                    <button
                      type="button"
                      onClick={() => {
                        certamStore.removerLotacaoDoCatalogo(classifAdminConcursoId, lot.id);
                        reloadData();
                        showToast(`Comarca "${lot.nome}" removida da lista suspensa.`);
                      }}
                      className="text-rose-500 hover:text-rose-700 ml-1 font-bold cursor-pointer"
                      title="Remover opção"
                    >
                      ×
                    </button>
                  </span>
                ));
              })()}
            </div>
          </div>

          {/* Tabela de Candidatos com Edição Manual de Cada Campo */}
          <div className="space-y-3">
            <h3 className="font-bold text-xs text-slate-900 uppercase tracking-wider">
              Edição Manual de Candidatos e Campos da Lista
            </h3>
            {(() => {
              const cands = lotesStore.getCandidatos(classifAdminConcursoId, classifAdminCargoId);
              if (cands.length === 0) {
                return (
                  <div className="p-8 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl border border-slate-200">
                    Nenhum candidato cadastrado para este cargo. Use a aba <strong>Importar XLSX</strong> para carregar a lista ou adicione manualmente.
                  </div>
                );
              }
              return (
                <div className="border border-slate-200 rounded-2xl overflow-x-auto max-h-[500px]">
                  <table className="w-full text-left text-xs divide-y divide-slate-100">
                    <thead className="bg-[#07192B] text-white text-[11px] uppercase tracking-wider sticky top-0 z-10">
                      <tr>
                        <th className="py-2.5 px-2 w-16">Pos.</th>
                        <th className="py-2.5 px-2 min-w-[200px]">Nome do Candidato</th>
                        <th className="py-2.5 px-2 w-28">Nota</th>
                        <th className="py-2.5 px-2 w-32">Cota</th>
                        <th className="py-2.5 px-2 w-32">Status</th>
                        <th className="py-2.5 px-2 w-36">Lotação Definitiva</th>
                        <th className="py-2.5 px-2 w-20 text-center">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {cands.map((cand, idx) => (
                        <tr key={cand.id} className="hover:bg-slate-50">
                          <td className="py-2 px-2">
                            <input
                              type="number"
                              value={cand.posicao}
                              onChange={(e) => {
                                cand.posicao = parseInt(e.target.value, 10) || 1;
                                lotesStore.salvarCandidato(classifAdminConcursoId, classifAdminCargoId, cand);
                                reloadData();
                              }}
                              className="w-14 px-1.5 py-1 bg-slate-50 border border-slate-300 rounded font-mono font-bold text-xs"
                            />
                          </td>
                          <td className="py-2 px-2">
                            <input
                              type="text"
                              value={cand.nome}
                              onChange={(e) => {
                                cand.nome = e.target.value;
                                lotesStore.salvarCandidato(classifAdminConcursoId, classifAdminCargoId, cand);
                              }}
                              onBlur={() => reloadData()}
                              className="w-full px-2 py-1 bg-slate-50 border border-slate-300 rounded font-semibold text-xs"
                            />
                          </td>
                          <td className="py-2 px-2">
                            <input
                              type="number"
                              step="0.01"
                              value={cand.nota_final}
                              onChange={(e) => {
                                cand.nota_final = parseFloat(e.target.value) || 0;
                                lotesStore.salvarCandidato(classifAdminConcursoId, classifAdminCargoId, cand);
                                reloadData();
                              }}
                              className="w-20 px-2 py-1 bg-slate-50 border border-slate-300 rounded font-mono font-bold text-teal-700 text-xs"
                            />
                          </td>
                          <td className="py-2 px-2">
                            <select
                              value={cand.cota || 'Ampla'}
                              onChange={(e) => {
                                cand.cota = e.target.value as any;
                                lotesStore.salvarCandidato(classifAdminConcursoId, classifAdminCargoId, cand);
                                reloadData();
                              }}
                              className="w-full px-2 py-1 bg-slate-50 border border-slate-300 rounded text-xs font-semibold"
                            >
                              <option value="Ampla">Ampla</option>
                              <option value="PCD">PCD</option>
                              <option value="PPP">PPP</option>
                              <option value="Indígena">Indígena</option>
                              <option value="Trans">Trans</option>
                            </select>
                          </td>
                          <td className="py-2 px-2">
                            <select
                              value={cand.status || 'Aguardando Convocação'}
                              onChange={(e) => {
                                cand.status = e.target.value as any;
                                lotesStore.salvarCandidato(classifAdminConcursoId, classifAdminCargoId, cand);
                                reloadData();
                              }}
                              className="w-full px-2 py-1 bg-slate-50 border border-slate-300 rounded text-xs"
                            >
                              <option value="Aguardando Convocação">Aguardando Convocação</option>
                              <option value="Convocado titular">Convocado titular</option>
                              <option value="Convocado suplente">Convocado suplente</option>
                              <option value="Nomeado">Nomeado</option>
                            </select>
                          </td>
                          <td className="py-2 px-2">
                            <input
                              type="text"
                              value={cand.comarca_definitiva || ''}
                              onChange={(e) => {
                                cand.comarca_definitiva = e.target.value;
                                lotesStore.salvarCandidato(classifAdminConcursoId, classifAdminCargoId, cand);
                                reloadData();
                              }}
                              placeholder="Lotação..."
                              className="w-full px-2 py-1 bg-slate-50 border border-slate-300 rounded text-xs"
                            />
                          </td>
                          <td className="py-2 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => {
                                if (window.confirm(`Remover candidato ${cand.nome}?`)) {
                                  const novaLista = cands.filter((c) => c.id !== cand.id);
                                  lotesStore.salvarCandidatos(classifAdminConcursoId, classifAdminCargoId, novaLista, true);
                                  reloadData();
                                  showToast('Candidato removido.');
                                }
                              }}
                              className="p-1 text-rose-500 hover:bg-rose-50 rounded cursor-pointer"
                              title="Remover candidato"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </div>
        </section>
      )}

      {/* ============================================================== */}
      {/* ABA: QUADRO DE VAGAS & QUANTITATIVOS (ADMIN)                    */}
      {/* ============================================================== */}
      {abaAdmin === 'vagas_admin' && (
        <section className="space-y-6 bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 card-shadow">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-xl font-bold font-serif text-slate-900 flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-teal-600" />
                <span>Gestão de Quadro de Vagas e Quantitativos</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Edite os quantitativos de vagas imediatas, cadastro de reserva e reorganize a ordem dos quadros.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={vagasAdminConcursoId}
                onChange={(e) => {
                  setVagasAdminConcursoId(e.target.value);
                  const c = concursos.find((x) => x.id === e.target.value);
                  if (c?.cargos?.[0]) setVagasAdminCargoId(c.cargos[0].id);
                }}
                className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold"
              >
                {concursos.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
              <select
                value={vagasAdminCargoId}
                onChange={(e) => setVagasAdminCargoId(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold"
              >
                {concursos
                  .find((c) => c.id === vagasAdminConcursoId)
                  ?.cargos?.map((cg) => (
                    <option key={cg.id} value={cg.id}>{cg.nome}</option>
                  ))}
              </select>
            </div>
          </div>

          {/* Editar Quantitativos Gerais do Cargo */}
          {(() => {
            const conc = certamStore.getConcurso(vagasAdminConcursoId);
            const cargo = conc?.cargos?.find((cg) => cg.id === vagasAdminCargoId);
            if (!cargo) return <p className="text-xs text-slate-400">Selecione um cargo válido.</p>;

            return (
              <div className="space-y-6">
                <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-4">
                  <h3 className="font-bold text-xs text-slate-900 uppercase tracking-wider">
                    Quantitativo Oficial do Cargo: {cargo.nome}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Vagas Imediatas:</label>
                      <input
                        type="number"
                        value={cargo.vagas_imediatas || 0}
                        onChange={(e) => {
                          cargo.vagas_imediatas = parseInt(e.target.value, 10) || 0;
                          certamStore.salvarCargo(vagasAdminConcursoId, cargo);
                          reloadData();
                        }}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Quantitativo Total:</label>
                      <input
                        type="number"
                        value={cargo.quantitativo_total || 0}
                        onChange={(e) => {
                          cargo.quantitativo_total = parseInt(e.target.value, 10) || 0;
                          certamStore.salvarCargo(vagasAdminConcursoId, cargo);
                          reloadData();
                        }}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono font-bold text-teal-700"
                      />
                    </div>
                    <div className="flex items-center pt-5">
                      <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800">
                        <input
                          type="checkbox"
                          checked={cargo.tem_cr}
                          onChange={(e) => {
                            cargo.tem_cr = e.target.checked;
                            certamStore.salvarCargo(vagasAdminConcursoId, cargo);
                            reloadData();
                          }}
                          className="w-4 h-4 text-teal-600 rounded"
                        />
                        <span>Possui Cadastro de Reserva (CR)</span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Organização e Reordenação de Lotações / Quadros de Vagas */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-xs text-slate-900 uppercase tracking-wider">
                      Reorganizar e Mover Quadros de Lotação
                    </h3>
                  </div>
                  {(!conc?.catalogo_lotacoes || conc.catalogo_lotacoes.length === 0) ? (
                    <p className="text-xs text-slate-400 py-4">Nenhuma comarca cadastrada no quadro de vagas.</p>
                  ) : (
                    <div className="space-y-2">
                      {conc.catalogo_lotacoes.map((lot, idx) => (
                        <div key={lot.id} className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between gap-3 card-shadow">
                          <div className="flex items-center gap-3">
                            <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-600 font-mono font-bold text-xs flex items-center justify-center">
                              {idx + 1}
                            </span>
                            <span className="font-bold text-xs text-slate-900">{lot.nome}</span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => {
                                const list = [...conc.catalogo_lotacoes!];
                                const temp = list[idx];
                                list[idx] = list[idx - 1];
                                list[idx - 1] = temp;
                                conc.catalogo_lotacoes = list;
                                certamStore.salvarConcurso(conc, true);
                                reloadData();
                              }}
                              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold disabled:opacity-30 cursor-pointer"
                              title="Mover para cima"
                            >
                              ↑ Mover Cima
                            </button>
                            <button
                              type="button"
                              disabled={idx === conc.catalogo_lotacoes!.length - 1}
                              onClick={() => {
                                const list = [...conc.catalogo_lotacoes!];
                                const temp = list[idx];
                                list[idx] = list[idx + 1];
                                list[idx + 1] = temp;
                                conc.catalogo_lotacoes = list;
                                certamStore.salvarConcurso(conc, true);
                                reloadData();
                              }}
                              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold disabled:opacity-30 cursor-pointer"
                              title="Mover para baixo"
                            >
                              ↓ Mover Baixo
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </section>
      )}

      {/* ============================================================== */}
      {/* MODAIS GERENCIAIS: CONCURSO, CARGO & LOTE                     */}
      {/* ============================================================== */}
      <ModalEditarConcurso
        aberto={modalEditarConcursoAberto}
        onClose={() => {
          setModalEditarConcursoAberto(false);
          setConcursoEditando(null);
        }}
        concurso={concursoEditando}
        onSalvo={(salvo) => {
          reloadData();
          showToast(concursoEditando ? `Concurso "${salvo.nome}" atualizado!` : `Concurso "${salvo.nome}" cadastrado com sucesso!`);
        }}
      />

      <ModalEditarCargo
        aberto={modalEditarCargoAberto}
        onClose={() => {
          setModalEditarCargoAberto(false);
          setCargoEditando(null);
        }}
        concursoId={concursoAlvoId}
        cargo={cargoEditando}
        onSalvo={(salvo) => {
          reloadData();
          showToast(cargoEditando ? `Cargo "${salvo.nome}" atualizado!` : `Cargo "${salvo.nome}" cadastrado com sucesso!`);
        }}
      />

      <ModalEditarLote
        aberto={modalEditarLoteAberto}
        onClose={() => {
          setModalEditarLoteAberto(false);
          setLoteEditando(null);
        }}
        concursoId={loteConcursoAlvoId}
        cargoId={loteCargoAlvoId}
        lote={loteEditando}
        onSalvo={(salvo) => {
          reloadData();
          showToast(loteEditando ? `Lote "${salvo.nome}" atualizado!` : `Lote "${salvo.nome}" cadastrado com sucesso!`);
        }}
      />

      {/* ============================================================== */}
      {/* MODAL DE JUSTIFICATIVA DE INDEFERIMENTO - AUDITORIA DE PERFIL   */}
      {/* ============================================================== */}
      {modalIndeferirAuditAberto && auditAlvoParaIndeferir && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in-50">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-4 sm:p-5 bg-gradient-to-r from-rose-950 to-[#07192B] text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-rose-500/20 text-rose-300 flex items-center justify-center font-bold">
                  <XCircle className="w-4 h-4 text-rose-400" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-base text-white">
                    Indeferir Alteração Cadastral
                  </h3>
                  <p className="text-2xs text-rose-200">
                    O candidato será notificado internamente com a justificativa apresentada
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setModalIndeferirAuditAberto(false);
                  setAuditAlvoParaIndeferir(null);
                  setErroMotivoAudit(false);
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Conteúdo */}
            <div className="p-5 space-y-4 text-xs">
              {/* Dados do Candidato */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-sm">{auditAlvoParaIndeferir.usuario_nome}</span>
                  <span className="font-mono text-2xs text-slate-500">CPF: {auditAlvoParaIndeferir.cpf}</span>
                </div>
                <span className="text-2xs text-slate-500 block">
                  E-mail: {auditAlvoParaIndeferir.usuario_email}
                </span>

                <div className="pt-2 border-t border-slate-200 mt-2">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                    Alterações Solicitadas:
                  </span>
                  <div className="space-y-1">
                    {auditAlvoParaIndeferir.alteracoes.map((alt, i) => (
                      <div key={i} className="text-2xs text-slate-700 flex items-center gap-1.5">
                        <span className="font-semibold">{alt.campo_label}:</span>
                        <span className="line-through text-slate-400">{alt.valor_antigo}</span>
                        <ArrowRight className="w-2.5 h-2.5 text-slate-400" />
                        <span className="font-bold text-slate-800">{alt.valor_novo}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Sugestões Rápidas de Justificativa */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1.5 text-2xs uppercase tracking-wider">
                  Sugestões Rápidas de Motivo:
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    'Divergência entre o nome informado e o documento oficial.',
                    'CPF incompatível com os registros oficiais do certame.',
                    'Data de nascimento divergente da publicação oficial.',
                    'Comprovação documental obrigatória para alteração cadastral.',
                    'Inconsistência cadastral não justificada.',
                  ].map((sugestao, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setMotivoJustificativaAudit(sugestao);
                        setErroMotivoAudit(false);
                      }}
                      className="px-2 py-1 bg-slate-100 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 border border-slate-200 rounded-lg text-[11px] text-slate-600 transition-colors text-left cursor-pointer"
                    >
                      {sugestao}
                    </button>
                  ))}
                </div>
              </div>

              {/* Textarea da Justificativa */}
              <div>
                <label className="block font-semibold text-slate-800 mb-1">
                  Justificativa do Indeferimento <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={4}
                  value={motivoJustificativaAudit}
                  onChange={(e) => {
                    setMotivoJustificativaAudit(e.target.value);
                    if (e.target.value.trim()) setErroMotivoAudit(false);
                  }}
                  placeholder="Descreva de forma clara o motivo do indeferimento para que o candidato possa corrigir as informações e submeter nova solicitação..."
                  className={`w-full p-3 rounded-xl border text-xs focus:outline-hidden transition-all ${
                    erroMotivoAudit
                      ? 'border-rose-400 bg-rose-50/50 focus:border-rose-600'
                      : 'border-slate-300 bg-slate-50 focus:bg-white focus:border-rose-600'
                  }`}
                />
                {erroMotivoAudit && (
                  <p className="text-2xs text-rose-600 mt-1 font-semibold flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 shrink-0" />
                    <span>A justificativa do indeferimento é obrigatória para notificar o candidato.</span>
                  </p>
                )}
                <p className="text-2xs text-slate-400 mt-1">
                  Esta mensagem aparecerá na notificação interna (ícone do sininho) e no perfil do candidato.
                </p>
              </div>

              {/* Ações */}
              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setModalIndeferirAuditAberto(false);
                    setAuditAlvoParaIndeferir(null);
                    setErroMotivoAudit(false);
                  }}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold cursor-pointer transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmarIndeferimentoAuditoria}
                  className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold cursor-pointer transition-colors shadow-xs"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Confirmar Indeferimento e Notificar</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL DE JUSTIFICATIVA DE INDEFERIMENTO - VALIDAÇÃO / VINCULAÇÃO */}
      {/* ============================================================== */}
      {modalIndeferirVincAberto && vincAlvoParaIndeferir && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in-50">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
            <div className="p-4 sm:p-5 bg-gradient-to-r from-rose-950 to-[#07192B] text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-rose-500/20 text-rose-300 flex items-center justify-center font-bold">
                  <XCircle className="w-4 h-4 text-rose-400" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-base text-white">
                    Indeferir Validação de Aprovado
                  </h3>
                  <p className="text-2xs text-rose-200">
                    O candidato será notificado sobre o motivo da recusa da vinculação
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setModalIndeferirVincAberto(false);
                  setVincAlvoParaIndeferir(null);
                  setErroMotivoVinc(false);
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-sm">{vincAlvoParaIndeferir.usuario_nome}</span>
                  <span className="font-mono text-2xs text-slate-500">CPF: {vincAlvoParaIndeferir.cpf}</span>
                </div>
                <div className="text-2xs text-slate-600 font-medium">
                  Certame: {vincAlvoParaIndeferir.concurso_nome || vincAlvoParaIndeferir.concurso_id} • Cargo: {vincAlvoParaIndeferir.cargo_nome || vincAlvoParaIndeferir.cargo_id}
                </div>
                <div className="text-2xs text-slate-500 font-mono">
                  Posição declarada: {vincAlvoParaIndeferir.posicao_declarada}º lugar
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1.5 text-2xs uppercase tracking-wider">
                  Sugestões Rápidas:
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    'Nome não localizado na publicação oficial do Diário Oficial.',
                    'Classificação declarada diverge do resultado homologado.',
                    'Comprovante ilegível ou incompatível com a convocação.',
                  ].map((sug, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        setMotivoJustificativaVinc(sug);
                        setErroMotivoVinc(false);
                      }}
                      className="px-2 py-1 bg-slate-100 hover:bg-rose-50 hover:text-rose-700 border border-slate-200 rounded-lg text-[11px] text-slate-600 transition-colors text-left cursor-pointer"
                    >
                      {sug}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-800 mb-1">
                  Justificativa do Indeferimento <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={motivoJustificativaVinc}
                  onChange={(e) => {
                    setMotivoJustificativaVinc(e.target.value);
                    if (e.target.value.trim()) setErroMotivoVinc(false);
                  }}
                  placeholder="Informe ao candidato o motivo da recusa da vinculação..."
                  className={`w-full p-3 rounded-xl border text-xs focus:outline-hidden transition-all ${
                    erroMotivoVinc
                      ? 'border-rose-400 bg-rose-50/50 focus:border-rose-600'
                      : 'border-slate-300 bg-slate-50 focus:bg-white focus:border-rose-600'
                  }`}
                />
                {erroMotivoVinc && (
                  <p className="text-2xs text-rose-600 mt-1 font-semibold flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 shrink-0" />
                    <span>A justificativa é obrigatória.</span>
                  </p>
                )}
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setModalIndeferirVincAberto(false);
                    setVincAlvoParaIndeferir(null);
                    setErroMotivoVinc(false);
                  }}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold cursor-pointer transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmarIndeferimentoVinculacao}
                  className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold cursor-pointer transition-colors shadow-xs"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Confirmar Indeferimento</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
