import React, { useState, useMemo, useEffect } from 'react';
import { certamStore } from '../store/certamStore';
import { lotesStore } from '../store/lotesStore';
import { faqStore } from '../store/faqStore';
import { auditStore } from '../store/auditStore';
import { contactStore } from '../store/contactStore';
import { notificationStore } from '../store/notificationStore';
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
} from '../types';
import { sanitizeInput, sanitizeFileName } from '../utils/security';
import * as XLSX from 'xlsx';
import {
  Plus,
  Trash2,
  Search,
  CheckCircle2,
  FileSpreadsheet,
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
  Send,
  Eye,
  Inbox,
} from 'lucide-react';

interface AdminPanelProps {
  initialTab?: string;
  onNavigate: (view: string, params?: { concursoId?: string; cargoId?: string; tab?: string }) => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  initialTab = 'concursos',
  onNavigate,
}) => {
  const { usuario, isAdmin, loginAdmin, atualizarDadosUsuario } = useAuth();
  const [senhaAdmin, setSenhaAdmin] = useState('');
  const [erroSenha, setErroSenha] = useState(false);

  const [abaAdmin, setAbaAdmin] = useState<
    | 'concursos'
    | 'auditoria'
    | 'validacoes'
    | 'contatos'
    | 'notificacoes'
    | 'candidatos'
    | 'importar'
    | 'faq'
  >((initialTab as any) || 'concursos');

  const [concursos, setConcursos] = useState<Concurso[]>(() => certamStore.getConcursos());
  const [busca, setBusca] = useState('');

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

    window.addEventListener('certam_audit_updated', handleAudit);
    window.addEventListener('certam_vinculacoes_updated', handleVinc);
    window.addEventListener('certam_contact_updated', handleCont);
    window.addEventListener('certam_notifications_updated', handleNotif);

    return () => {
      window.removeEventListener('certam_audit_updated', handleAudit);
      window.removeEventListener('certam_vinculacoes_updated', handleVinc);
      window.removeEventListener('certam_contact_updated', handleCont);
      window.removeEventListener('certam_notifications_updated', handleNotif);
    };
  }, []);

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
  const [notifConcursoId, setNotifConcursoId] = useState('tjrs_2025');
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

  // Importador Planilhas
  const [importConcursoId, setImportConcursoId] = useState<string>(concursos[0]?.id || 'tjrs_2025');
  const [importCargoId, setImportCargoId] = useState<string>(concursos[0]?.cargos?.[0]?.id || 'analista_judiciario');
  const [previewPlanilha, setPreviewPlanilha] = useState<Partial<Candidato>[]>([]);
  const [nomeArquivo, setNomeArquivo] = useState('');

  // Toast
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const reloadData = () => {
    setConcursos(certamStore.getConcursos());
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

  // Se não estiver logado como admin
  if (!isAdmin) {
    const handleLoginAdminLocal = (e: React.FormEvent) => {
      e.preventDefault();
      const sucesso = loginAdmin(senhaAdmin);
      if (sucesso) {
        setErroSenha(false);
        showToast('Login de administrador realizado com sucesso!');
      } else {
        setErroSenha(true);
      }
    };

    return (
      <div className="max-w-md mx-auto my-12 p-6 sm:p-8 bg-white rounded-2xl shadow-xl border border-slate-200 text-center space-y-4">
        <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center mx-auto">
          <Lock className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold font-serif text-slate-900">Área Administrativa Restrita</h2>
          <p className="text-xs text-slate-500 mt-1">
            Informe sua senha de administrador para gerenciar certames, auditar perfis e moderar solicitações.
          </p>
        </div>

        <form onSubmit={handleLoginAdminLocal} className="space-y-4 text-left">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Senha de Acesso:
            </label>
            <input
              type="password"
              placeholder="Digite certam2025 ou admin"
              value={senhaAdmin}
              onChange={(e) => {
                setSenhaAdmin(e.target.value);
                setErroSenha(false);
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:bg-white focus:outline-hidden"
              autoFocus
            />
            {erroSenha && (
              <span className="text-2xs text-rose-600 mt-1 block">Senha incorreta. Tente certam2025.</span>
            )}
          </div>

          <button
            type="submit"
            className="w-full py-2.5 bg-[#07192B] hover:bg-[#0C2640] text-[#2DD4AA] font-bold rounded-xl text-xs cursor-pointer shadow-sm transition-colors"
          >
            Acessar Painel
          </button>
        </form>

        <div className="pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={() => onNavigate('portal')}
            className="text-xs text-slate-500 hover:text-slate-800"
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
    req.alteracoes.forEach((alt) => {
      if (alt.campo === 'nome') mudancas.nome = alt.valor_novo;
      if (alt.campo === 'cpf') mudancas.cpf = alt.valor_novo;
      if (alt.campo === 'data_nascimento') mudancas.data_nascimento = alt.valor_novo;
      if (alt.campo === 'whatsapp') {
        mudancas.whatsapp = alt.valor_novo;
        mudancas.telefone = alt.valor_novo;
      }
      if (alt.campo === 'email_contato') mudancas.email_contato = alt.valor_novo;
    });

    // 2. Aplicar diretamente no perfil ativo se for o usuário conectado (ex: admin ou candidato)
    const isCurrentActiveUser =
      (usuario?.email && usuario.email.toLowerCase() === req.usuario_email.toLowerCase()) ||
      (usuario?.cpf && req.cpf && usuario.cpf.replace(/\D/g, '') === req.cpf.replace(/\D/g, ''));

    if (isCurrentActiveUser) {
      atualizarDadosUsuario(mudancas);
    }

    // 3. Atualizar também na chave de persistência do localStorage
    try {
      const storedKey = 'certam_auth_user_v7';
      const storedStr = localStorage.getItem(storedKey);
      if (storedStr) {
        const storedUser = JSON.parse(storedStr);
        if (
          storedUser &&
          (storedUser.email?.toLowerCase() === req.usuario_email.toLowerCase() ||
            (storedUser.cpf && req.cpf && storedUser.cpf.replace(/\D/g, '') === req.cpf.replace(/\D/g, '')))
        ) {
          const atualizado = { ...storedUser, ...mudancas };
          localStorage.setItem(storedKey, JSON.stringify(atualizado));
        }
      }
    } catch {
      // ignore
    }

    // 4. Aplicar alterações nas listas de candidatos do lote/master list
    concursos.forEach((c) => {
      c.cargos?.forEach((cg) => {
        const cands = lotesStore.getCandidatos(c.id, cg.id);
        const matchIndex = cands.findIndex(
          (cand) =>
            (req.cpf && cand.cpf && cand.cpf.replace(/\D/g, '') === req.cpf.replace(/\D/g, '')) ||
            (req.usuario_email && cand.email?.toLowerCase() === req.usuario_email.toLowerCase())
        );
        if (matchIndex >= 0) {
          const mod = { ...cands[matchIndex] };
          req.alteracoes.forEach((alt) => {
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

    // 5. Disparar evento global para atualizar qualquer tela aberta
    window.dispatchEvent(new CustomEvent('certam_audit_approved', { detail: { req, mudancas } }));

    // 6. Notificar o candidato sobre o deferimento das alterações
    const camposAlteradosStr = req.alteracoes.map((a) => a.campo_label).join(', ');
    notificationStore.criarNotificacao({
      destinatario_email: req.usuario_email,
      destinatario_nome: req.usuario_nome,
      titulo: 'Alteração Cadastral Deferida',
      mensagem: `Sua solicitação de atualização cadastral (${camposAlteradosStr}) foi analisada e DEFERIDA pela administração. Os dados já estão consolidados no seu perfil e refletidos nas listas de classificação.`,
      tipo: 'aprovacao_perfil',
      urgente: false,
    });

    showToast(`Alterações de ${req.usuario_nome} aprovadas e candidato notificado!`);
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
  // HANDLERS DE VALIDAÇÃO MANUAL DE CANDIDATO
  // -------------------------------------------------------------
  const handleAprovarVinculacao = (v: SolicitacaoVinculacao) => {
    auditStore.aprovarVinculacao(v.id);

    // Inserir ou atualizar na lista do concurso
    const cands = lotesStore.getCandidatos(v.concurso_id, v.cargo_id);
    const candExistente = cands.find((c) => c.posicao === v.posicao_declarada);

    if (candExistente) {
      lotesStore.salvarCandidato(v.concurso_id, v.cargo_id, {
        ...candExistente,
        nome: v.usuario_nome,
        cpf: v.cpf,
        email: v.usuario_email,
      });
    } else {
      const novo: Candidato = {
        id: `cand-aprovado-${Date.now().toString(36)}`,
        concurso_id: v.concurso_id,
        cargo_id: v.cargo_id,
        posicao: v.posicao_declarada,
        nome: v.usuario_nome,
        cota: 'Ampla',
        nota_final: v.nota_declarada || 90.0,
        intencao: 'Sim',
        status: 'Convocado Titular',
        cpf: v.cpf,
        email: v.usuario_email,
        escolhas_comarcas: ['Porto Alegre'],
      };
      cands.push(novo);
      lotesStore.salvarCandidatos(v.concurso_id, v.cargo_id, cands);
    }

    notificationStore.criarNotificacao({
      concurso_id: v.concurso_id,
      cargo_id: v.cargo_id,
      destinatario_email: v.usuario_email,
      destinatario_nome: v.usuario_nome,
      titulo: 'Validação de Aprovado Deferida',
      mensagem: `Sua vinculação ao certame ${v.concurso_nome || v.concurso_id} no cargo ${v.cargo_nome || v.cargo_id} (${v.posicao_declarada}º lugar) foi DEFERIDA e homologada no sistema.`,
      tipo: 'validacao_aprovada',
      link_destino: `/concurso?id=${v.concurso_id}&tab=dashboard`,
      urgente: false,
    });

    showToast(`Candidato ${v.usuario_nome} validado e homologado no cargo!`);
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
    contactStore.responderMensagem(id, respostaTexto);
    setRespostaContatoId(null);
    setRespostaTexto('');
    showToast('Resposta enviada ao candidato!');
  };

  const handleDispararNotificacao = (e: React.FormEvent) => {
    e.preventDefault();
    if (!notifTitulo.trim() || !notifMensagem.trim()) return;

    notificationStore.criarNotificacao({
      concurso_id: notifConcursoId === 'todos' ? undefined : notifConcursoId,
      titulo: notifTitulo,
      mensagem: notifMensagem,
      tipo: notifTipo,
      link_destino: `/concurso?id=${notifConcursoId}&tab=cronograma`,
      urgente: true,
    });

    setNotifTitulo('');
    setNotifMensagem('');
    showToast('Notificação interna disparada para todos os candidatos no portal!');
  };

  return (
    <div className="space-y-6 max-w-[1880px] w-full mx-auto">
      {/* Toast flutuante */}
      {toastMsg && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-xl text-xs font-semibold text-white bg-[#07192B] border border-[#2DD4AA]/40 animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-[#2DD4AA]" />
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
              Audite solicitações de alteração de perfil com visualização lado a lado, valide candidatos não identificados automaticamente, cadastre novos concursos vigentes e responda dúvidas dos concurseiros.
            </p>
          </div>

          {/* Cards de Métricas Rápidas */}
          <div className="flex items-center gap-3 overflow-x-auto pb-1">
            <div className="bg-[#0C2640] border border-teal-500/20 rounded-xl p-3 text-center min-w-[90px]">
              <span className="text-[10px] uppercase font-mono font-bold text-teal-400 block">Concursos</span>
              <div className="text-xl font-bold text-white mt-0.5">{metricas.totalConcursos}</div>
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
                Gestão dos certames ativos no CERTAM. Configure editais, órgãos e adicione cargos específicos.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setFormId('');
                setFormNome('');
                setFormOrgao('');
                setFormDesc('');
                setModalNovoConcursoAberto(true);
              }}
              className="px-4 py-2 bg-[#07192B] hover:bg-[#0C2640] text-[#2DD4AA] font-bold text-xs rounded-xl transition-all cursor-pointer shadow-xs flex items-center gap-2 shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Cadastrar Novo Concurso</span>
            </button>
          </div>

          {/* Lista de Concursos */}
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
                        setConcursoAlvoId(c.id);
                        setFormCargoNome('');
                        setFormCargoId('');
                        setFormCargoVagas(0);
                        setModalNovoCargoAberto(true);
                      }}
                      className="px-3 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 font-bold text-xs rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Adicionar Cargo</span>
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
                          <th className="py-2.5 px-3 text-center">Nível</th>
                          <th className="py-2.5 px-3 text-right">Vagas Imediatas</th>
                          <th className="py-2.5 px-3 text-right">Vagas Reais Abertas</th>
                          <th className="py-2.5 px-3 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {c.cargos?.map((cg) => (
                          <tr key={cg.id} className="hover:bg-slate-50">
                            <td className="py-2.5 px-3 font-bold text-slate-900">{cg.nome}</td>
                            <td className="py-2.5 px-3 text-center font-mono">{cg.nivel}</td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold">{cg.vagas_imediatas}</td>
                            <td className="py-2.5 px-3 text-right font-mono text-amber-800 font-bold">
                              {cg.vagas_reais_abertas || '-'}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <span className="text-emerald-700 font-semibold">Ativo</span>
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
      {/* ABA 3: VALIDAÇÃO MANUAL DE CANDIDATOS                          */}
      {/* ============================================================== */}
      {abaAdmin === 'validacoes' && (
        <section className="space-y-6">
          <div className="border-b border-slate-200 pb-3">
            <h2 className="text-xl font-bold font-serif text-slate-900">
              Fila de Validação Manual de Aprovados
            </h2>
            <p className="text-xs text-slate-500">
              Candidatos que não foram reconhecidos automaticamente pelo cruzamento de Nome/CPF e solicitaram liberação ao administrador.
            </p>
          </div>

          {vinculacoes.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-xs text-slate-400 card-shadow">
              Nenhuma solicitação de validação pendente no momento.
            </div>
          ) : (
            <div className="space-y-4">
              {vinculacoes.map((v) => (
                <div
                  key={v.id}
                  className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 card-shadow flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900">{v.usuario_nome}</span>
                      <span className="text-2xs font-mono text-slate-400">CPF: {v.cpf}</span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded ${
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
                      <span className="text-slate-300">·</span>
                      <span className="font-mono font-bold text-slate-800">
                        Posição declarada: {v.posicao_declarada}º lugar
                      </span>
                      {v.nota_declarada && (
                        <>
                          <span className="text-slate-300">·</span>
                          <span className="font-mono text-slate-600">Nota: {v.nota_declarada}</span>
                        </>
                      )}
                    </div>

                    {v.comprovante_info && (
                      <p className="text-2xs text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100 max-w-xl">
                        <strong>Comprovante / Referência:</strong> {v.comprovante_info}
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
                        <span>Homologar Aprovado</span>
                      </button>
                    </div>
                  )}

                  {v.status === 'rejeitado' && v.motivo_rejeicao && (
                    <div className="w-full mt-2 p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-2xs text-rose-800">
                      <span className="font-bold block text-rose-900">Motivo do Indeferimento:</span>
                      <p className="mt-0.5">{v.motivo_rejeicao}</p>
                    </div>
                  )}
                </div>
              ))}
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
              <h3 className="font-bold text-sm text-slate-900 font-serif">
                Avisos Ativos no Sino ({notificacoes.length})
              </h3>
              <div className="max-h-[460px] overflow-y-auto space-y-2.5 divide-y divide-slate-100">
                {notificacoes.map((item) => (
                  <div key={item.id} className="pt-2.5 first:pt-0">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-800">{item.titulo}</span>
                      <span className="text-2xs font-mono text-slate-400">{item.data_hora}</span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">{item.mensagem}</p>
                    <span className="text-[10px] font-mono text-teal-700 font-semibold block mt-1">
                      Destino: {item.concurso_id || 'Global'}
                    </span>
                  </div>
                ))}
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Concurso:</label>
                <select
                  value={importConcursoId}
                  onChange={(e) => setImportConcursoId(e.target.value)}
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
                <label className="block text-xs font-bold text-slate-700 mb-1">Arquivo:</label>
                <input
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  className="block w-full text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-[#07192B] file:text-white border border-slate-300 rounded-xl bg-slate-50 p-1"
                />
              </div>
            </div>
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

      {/* MODAL NOVO CONCURSO */}
      {modalNovoConcursoAberto && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base font-serif">Cadastrar Novo Concurso</h3>
              <button
                type="button"
                onClick={() => setModalNovoConcursoAberto(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!formNome.trim() || !formOrgao.trim()) return;

                const novo: Concurso = {
                  id: (formId.trim() || formNome.toLowerCase().replace(/[^a-z0-9]/g, '_')).slice(0, 30),
                  nome: formNome,
                  orgao: formOrgao,
                  ano: formAno,
                  edital: formEdital,
                  status: formStatus,
                  homologado: formStatus === 'Homologado',
                  regiao: 'Sul',
                  esfera: 'Estadual',
                  descricao: formDesc || `Concurso público para provimento de vagas no ${formOrgao}.`,
                  cargos: [
                    {
                      id: formCargoInicial.toLowerCase().replace(/[^a-z0-9]/g, '_'),
                      nome: formCargoInicial,
                      nivel: 'Superior',
                      vagas_imediatas: 10,
                      tem_cr: true,
                      ativo: true,
                    },
                  ],
                };

                certamStore.salvarConcurso(novo);
                reloadData();
                setModalNovoConcursoAberto(false);
                showToast('Novo concurso cadastrado com sucesso!');
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nome Completo do Concurso:</label>
                <input
                  type="text"
                  placeholder="Ex: Tribunal de Justiça de Santa Catarina (TJSC)"
                  value={formNome}
                  onChange={(e) => setFormNome(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Órgão / Sigla:</label>
                  <input
                    type="text"
                    placeholder="Ex: TJSC"
                    value={formOrgao}
                    onChange={(e) => setFormOrgao(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Ano:</label>
                  <input
                    type="text"
                    value={formAno}
                    onChange={(e) => setFormAno(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Status:</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl"
                  >
                    <option value="ativo">Em Andamento</option>
                    <option value="Homologado">Homologado</option>
                    <option value="Convocando">Convocando</option>
                    <option value="Inscrições Abertas">Inscrições Abertas</option>
                    <option value="previsto">Previsto</option>
                    <option value="encerrado">Encerrado</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Cargo Inicial:</label>
                  <input
                    type="text"
                    value={formCargoInicial}
                    onChange={(e) => setFormCargoInicial(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl"
                    required
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalNovoConcursoAberto(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-600"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#07192B] text-[#2DD4AA] font-bold rounded-xl"
                >
                  Salvar Concurso
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL NOVO CARGO */}
      {modalNovoCargoAberto && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base font-serif">Adicionar Cargo ao Concurso</h3>
              <button
                type="button"
                onClick={() => setModalNovoCargoAberto(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!formCargoNome.trim()) return;
                const novoCargo: Cargo = {
                  id: (formCargoId.trim() || formCargoNome.toLowerCase().replace(/[^a-z0-9]/g, '_')).slice(0, 30),
                  nome: formCargoNome,
                  nivel: formCargoNivel,
                  vagas_imediatas: Number(formCargoVagas) || 0,
                  tem_cr: formCargoCr,
                  ativo: true,
                };
                certamStore.salvarCargo(concursoAlvoId, novoCargo);
                reloadData();
                setModalNovoCargoAberto(false);
                showToast('Novo cargo adicionado!');
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nome do Cargo:</label>
                <input
                  type="text"
                  placeholder="Ex: Oficial de Justiça"
                  value={formCargoNome}
                  onChange={(e) => setFormCargoNome(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nível de Escolaridade:</label>
                  <select
                    value={formCargoNivel}
                    onChange={(e) => setFormCargoNivel(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl"
                  >
                    <option value="Superior">Superior</option>
                    <option value="Médio">Médio</option>
                    <option value="Técnico">Técnico</option>
                    <option value="Fundamental">Fundamental</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Vagas Imediatas:</label>
                  <input
                    type="number"
                    min="0"
                    value={formCargoVagas}
                    onChange={(e) => setFormCargoVagas(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalNovoCargoAberto(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-600"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#07192B] text-[#2DD4AA] font-bold rounded-xl"
                >
                  Adicionar Cargo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
