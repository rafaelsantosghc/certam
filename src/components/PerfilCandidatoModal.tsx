import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../store/authContext';
import { certamStore } from '../store/certamStore';
import { auditStore } from '../store/auditStore';
import { Concurso, OutroConcursoAprovado, AlteracaoCampoItem } from '../types';
import { sanitizeInput } from '../utils/security';
import { buscarTodasAprovacoesCandidato, AprovacaoDetectada } from '../utils/candidateMatcher';
import {
  X,
  Send,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Clock,
  XCircle,
  User,
  Plus,
  Trash2,
  ArrowRight,
  ShieldCheck,
  Building,
  Sparkles,
  Check,
  Link2,
} from 'lucide-react';

interface PerfilCandidatoModalProps {
  aberto: boolean;
  onClose: () => void;
  onAbrirContatoAdmin?: (motivo: any) => void;
  obrigatorio?: boolean;
}

export const PerfilCandidatoModal: React.FC<PerfilCandidatoModalProps> = ({
  aberto,
  onClose,
  onAbrirContatoAdmin,
  obrigatorio = false,
}) => {
  const { usuario, atualizarDadosUsuario } = useAuth();

  // Form State
  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [emailContato, setEmailContato] = useState('');
  const [outrosConcursos, setOutrosConcursos] = useState<OutroConcursoAprovado[]>([]);

  // Diff / Revisão
  const [modalDiffAberto, setModalDiffAberto] = useState(false);
  const [diffAlteracoes, setDiffAlteracoes] = useState<AlteracaoCampoItem[]>([]);
  const [submetidoSucesso, setSubmetidoSucesso] = useState(false);
  const [primeiroCadastro, setPrimeiroCadastro] = useState(false);

  useEffect(() => {
    if (aberto && usuario) {
      setNome(usuario.nome || '');
      setCpf(usuario.cpf || '');
      setDataNascimento(usuario.data_nascimento || '');
      setWhatsapp(usuario.whatsapp || usuario.telefone || '');
      setEmailContato(usuario.email_contato || usuario.email || '');
      setOutrosConcursos(usuario.outros_concursos || []);

      // Se for o modal obrigatório de primeiro acesso ou ainda não tiver CPF cadastrado
      const isSemDados = Boolean(obrigatorio) || (!usuario.cpf && !usuario.data_nascimento);
      setPrimeiroCadastro(isSemDados);
      setTodasSolicitacoes(auditStore.getAuditRequests());
    }
  }, [
    aberto,
    obrigatorio,
    usuario?.email,
    usuario?.cpf,
    usuario?.data_nascimento,
    usuario?.nome,
    usuario?.whatsapp,
    usuario?.email_contato,
  ]);

  // Histórico da última solicitação de auditoria deste candidato
  const [todasSolicitacoes, setTodasSolicitacoes] = useState(() => auditStore.getAuditRequests());

  useEffect(() => {
    const handleAuditUpdate = () => {
      setTodasSolicitacoes(auditStore.getAuditRequests());
    };
    window.addEventListener('certam_audit_updated', handleAuditUpdate);
    window.addEventListener('certam_audit_rejected', handleAuditUpdate);
    window.addEventListener('certam_audit_approved', handleAuditUpdate);
    window.addEventListener('storage', handleAuditUpdate);
    return () => {
      window.removeEventListener('certam_audit_updated', handleAuditUpdate);
      window.removeEventListener('certam_audit_rejected', handleAuditUpdate);
      window.removeEventListener('certam_audit_approved', handleAuditUpdate);
      window.removeEventListener('storage', handleAuditUpdate);
    };
  }, []);

  const ultimaSolicitacao = useMemo(() => {
    if (!usuario) return null;
    const emailUser = usuario.email?.toLowerCase().trim();
    const cpfLimpo = (usuario.cpf || cpf)?.replace(/\D/g, '') || '';
    return todasSolicitacoes.find(
      (r) =>
        (emailUser && r.usuario_email?.toLowerCase().trim() === emailUser) ||
        (cpfLimpo && r.cpf && r.cpf.replace(/\D/g, '') === cpfLimpo)
    );
  }, [usuario, cpf, todasSolicitacoes]);

  // Identificação automática de todas as aprovações do candidato
  const aprovacoesIdentificadas: AprovacaoDetectada[] = useMemo(() => {
    return buscarTodasAprovacoesCandidato({
      cpf: cpf || usuario?.cpf,
      nome: nome || usuario?.nome,
      email: emailContato || usuario?.email,
      candidato_id: usuario?.candidato_id,
      outros_concursos: outrosConcursos,
    });
  }, [cpf, nome, emailContato, usuario, outrosConcursos]);

  if (!aberto || !usuario) return null;

  // Manter e-mail de login
  const handleManterEmailLogin = () => {
    setEmailContato(usuario.email);
  };

  // Formatar CPF
  const handleCpfChange = (val: string) => {
    const limpo = val.replace(/\D/g, '').slice(0, 11);
    let formatado = limpo;
    if (limpo.length > 9) {
      formatado = `${limpo.slice(0, 3)}.${limpo.slice(3, 6)}.${limpo.slice(6, 9)}-${limpo.slice(9)}`;
    } else if (limpo.length > 6) {
      formatado = `${limpo.slice(0, 3)}.${limpo.slice(3, 6)}.${limpo.slice(6)}`;
    } else if (limpo.length > 3) {
      formatado = `${limpo.slice(0, 3)}.${limpo.slice(3)}`;
    }
    setCpf(formatado);
  };

  // Formatar WhatsApp
  const handleWhatsappChange = (val: string) => {
    const limpo = val.replace(/\D/g, '').slice(0, 11);
    let formatado = limpo;
    if (limpo.length > 6) {
      formatado = `(${limpo.slice(0, 2)}) ${limpo.slice(2, 7)}-${limpo.slice(7)}`;
    } else if (limpo.length > 2) {
      formatado = `(${limpo.slice(0, 2)}) ${limpo.slice(2)}`;
    }
    setWhatsapp(formatado);
  };

  // Calcular Diffs entre os dados do usuário e o formulário
  const calcularDiffs = (): AlteracaoCampoItem[] => {
    const diffs: AlteracaoCampoItem[] = [];

    if (nome.trim() !== (usuario.nome || '').trim()) {
      diffs.push({
        campo: 'nome',
        campo_label: 'Nome Completo',
        valor_antigo: usuario.nome || '(não informado)',
        valor_novo: nome.trim(),
      });
    }

    if (cpf.trim() !== (usuario.cpf || '').trim()) {
      diffs.push({
        campo: 'cpf',
        campo_label: 'CPF',
        valor_antigo: usuario.cpf || '(não informado)',
        valor_novo: cpf.trim(),
      });
    }

    if (dataNascimento !== (usuario.data_nascimento || '')) {
      diffs.push({
        campo: 'data_nascimento',
        campo_label: 'Data de Nascimento',
        valor_antigo: usuario.data_nascimento || '(não informado)',
        valor_novo: dataNascimento || '(não informado)',
      });
    }

    if (whatsapp.trim() !== (usuario.whatsapp || usuario.telefone || '').trim()) {
      diffs.push({
        campo: 'whatsapp',
        campo_label: 'WhatsApp de Contato',
        valor_antigo: usuario.whatsapp || usuario.telefone || '(não informado)',
        valor_novo: whatsapp.trim(),
      });
    }

    if (emailContato.trim() !== (usuario.email_contato || usuario.email || '').trim()) {
      diffs.push({
        campo: 'email_contato',
        campo_label: 'E-mail para Comunicação',
        valor_antigo: usuario.email_contato || usuario.email || '(não informado)',
        valor_novo: emailContato.trim(),
      });
    }

    return diffs;
  };

  const handleSubmeterOuSalvar = (e: React.FormEvent) => {
    e.preventDefault();

    const outrosSincronizados: OutroConcursoAprovado[] = aprovacoesIdentificadas
      .filter((ap) => ap.origem === 'declarado')
      .map((ap) => ({
        concurso_nome: ap.concurso_nome,
        ano: ap.ano,
        cargo: ap.cargo_nome,
        classificacao: ap.posicao,
        concurso_id: ap.concurso_id,
        cargo_id: ap.cargo_id,
        origem: 'manual',
        status_aprovacao: ap.status,
      }));

    // Se for o primeiro preenchimento estritamente obrigatório de primeiro acesso
    if (obrigatorio && primeiroCadastro) {
      if (!nome.trim() || !cpf.trim() || !dataNascimento.trim() || !whatsapp.trim()) {
        return;
      }

      atualizarDadosUsuario({
        nome: sanitizeInput(nome, 100),
        cpf: sanitizeInput(cpf, 20),
        data_nascimento: sanitizeInput(dataNascimento, 15),
        whatsapp: sanitizeInput(whatsapp, 25),
        telefone: sanitizeInput(whatsapp, 25),
        email_contato: sanitizeInput(emailContato || usuario.email, 80),
        outros_concursos: outrosSincronizados,
      });
      setSubmetidoSucesso(true);
      setTimeout(() => {
        setSubmetidoSucesso(false);
        onClose();
      }, 1800);
      return;
    }

    // Qualquer solicitação de alteração de dados cadastrais gera registro na fila de Auditoria do Painel Admin (Item 2)
    let diffs = calcularDiffs();
    if (diffs.length === 0) {
      diffs = [
        {
          campo: 'nome',
          campo_label: 'Nome Completo',
          valor_antigo: usuario.nome || '(não informado)',
          valor_novo: nome.trim() || usuario.nome,
        },
        {
          campo: 'cpf',
          campo_label: 'CPF',
          valor_antigo: usuario.cpf || '(não informado)',
          valor_novo: cpf.trim() || usuario.cpf || '(não informado)',
        },
      ];
    }

    // Se ainda não tinha CPF ou data de nascimento salvos, salva a base inicial mas mantém a solicitação na auditoria
    if (primeiroCadastro) {
      atualizarDadosUsuario({
        nome: sanitizeInput(nome, 100),
        cpf: sanitizeInput(cpf, 20),
        data_nascimento: sanitizeInput(dataNascimento, 15),
        whatsapp: sanitizeInput(whatsapp, 25),
        telefone: sanitizeInput(whatsapp, 25),
        email_contato: sanitizeInput(emailContato || usuario.email, 80),
        outros_concursos: outrosSincronizados,
      });
    }

    // Registrar imediatamente no auditStore para moderação administrativa (Item 2)
    auditStore.submeterSolicitacaoAlteracao({
      usuario_email: usuario.email || emailContato.trim() || 'candidato@certam',
      usuario_nome: sanitizeInput(nome.trim() || usuario.nome || 'Candidato', 100),
      cpf: sanitizeInput(cpf.trim() || usuario.cpf || '', 20),
      alteracoes: diffs,
    });

    setTodasSolicitacoes(auditStore.getAuditRequests());
    setDiffAlteracoes(diffs);
    setPrimeiroCadastro(false);
    setSubmetidoSucesso(true);
    setTimeout(() => {
      setSubmetidoSucesso(false);
      onClose();
    }, 2200);
  };

  const handleConfirmarSubmissaoAdmin = () => {
    const diffs = diffAlteracoes.length > 0 ? diffAlteracoes : calcularDiffs();
    if (diffs.length > 0) {
      auditStore.submeterSolicitacaoAlteracao({
        usuario_email: usuario.email,
        usuario_nome: nome.trim() || usuario.nome,
        cpf: cpf.trim() || usuario.cpf || '',
        alteracoes: diffs,
      });
      setTodasSolicitacoes(auditStore.getAuditRequests());
    }

    setModalDiffAberto(false);
    setSubmetidoSucesso(true);
    setTimeout(() => {
      setSubmetidoSucesso(false);
      onClose();
    }, 2200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in-50">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-[#07192B] text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-500/20 text-[#2DD4AA] flex items-center justify-center font-bold">
              <User className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-base text-white">
                {obrigatorio ? 'Cadastro Inicial Obrigatório • CERTAM' : 'Cadastro e Perfil do Candidato'}
              </h3>
              <p className="text-2xs text-slate-300">
                {obrigatorio
                  ? 'Preencha seus dados cadastrais para começar a usar o portal e identificar suas aprovações'
                  : 'Informações para cruzamento no cadastro geral e identificação de aprovações'}
              </p>
            </div>
          </div>
          {!obrigatorio && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Feedback de Sucesso */}
        {submetidoSucesso ? (
          <div className="p-10 text-center space-y-3">
            <CheckCircle2 className="w-14 h-14 text-[#2DD4AA] mx-auto animate-bounce" />
            <h4 className="font-serif font-bold text-lg text-slate-900">
              {primeiroCadastro ? 'Dados Cadastrados com Sucesso!' : 'Alterações Submetidas ao Administrador!'}
            </h4>
            <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
              {primeiroCadastro
                ? 'Seu cadastro foi salvo e sincronizado com as listas oficiais de classificação do CERTAM.'
                : 'As alterações solicitadas foram enviadas para a fila de moderação do administrador. Assim que conferidas, serão homologadas.'}
            </p>
          </div>
        ) : modalDiffAberto ? (
          /* MODAL INTERMEDIÁRIO DE DIFF ANTES DA SUBMISSÃO */
          <div className="p-6 overflow-y-auto space-y-4 text-xs">
            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800">
              <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600" />
              <div>
                <span className="font-bold block">Revisão de Modificações no Cadastro</span>
                <span className="text-2xs text-amber-700">
                  Para garantir a integridade dos rankings oficiais, suas alterações serão analisadas pelo administrador antes de serem aplicadas.
                </span>
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
              <div className="grid grid-cols-12 bg-slate-50 px-3.5 py-2 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <span className="col-span-4">Campo</span>
                <span className="col-span-4 text-rose-700">Dado Anterior</span>
                <span className="col-span-4 text-teal-700">Nova Informação</span>
              </div>
              {diffAlteracoes.map((diff, i) => (
                <div key={i} className="grid grid-cols-12 px-3.5 py-2.5 items-center gap-2 hover:bg-slate-50">
                  <span className="col-span-4 font-semibold text-slate-800">{diff.campo_label}</span>
                  <span className="col-span-4 font-mono text-slate-500 line-through text-[11px] truncate">
                    {diff.valor_antigo}
                  </span>
                  <span className="col-span-4 font-mono text-teal-800 font-bold text-[11px] truncate flex items-center gap-1">
                    <ArrowRight className="w-3 h-3 text-teal-600 shrink-0" />
                    {diff.valor_novo}
                  </span>
                </div>
              ))}
            </div>

            <div className="pt-3 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setModalDiffAberto(false)}
                className="px-4 py-2 border border-slate-300 text-slate-700 font-semibold rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Voltar e Ajustar
              </button>
              <button
                type="button"
                onClick={handleConfirmarSubmissaoAdmin}
                className="flex items-center gap-1.5 px-5 py-2 bg-[#07192B] text-[#2DD4AA] font-bold rounded-xl hover:bg-[#0C2640] transition-colors cursor-pointer shadow-sm"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Confirmar e Submeter ao Admin</span>
              </button>
            </div>
          </div>
        ) : (
          /* FORMULÁRIO COMPLETO */
          <form onSubmit={handleSubmeterOuSalvar} className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs">
            {/* Aviso de Auditoria */}
            {!primeiroCadastro && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-2xs text-slate-600">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-teal-600 shrink-0" />
                  <span>
                    Qualquer alteração em seus dados cadastrais será auditada e submetida para aprovação da administração.
                  </span>
                </div>
              </div>
            )}

            {/* Banner de Feedback de Solicitação Recente */}
            {ultimaSolicitacao && (
              <>
                {ultimaSolicitacao.status === 'pendente' && (
                  <div className="p-3.5 bg-amber-50/90 border border-amber-300 rounded-xl flex items-start gap-2.5 text-amber-900">
                    <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold block">Solicitação em Análise pela Administração</span>
                      <p className="text-2xs text-amber-800 mt-0.5">
                        Você enviou uma solicitação de alteração em {ultimaSolicitacao.data_solicitacao}. Ela está na fila de moderação e será avaliada em breve.
                      </p>
                    </div>
                  </div>
                )}

                {ultimaSolicitacao.status === 'rejeitado' && (
                  <div className="p-3.5 bg-rose-50 border border-rose-300 rounded-xl flex items-start gap-2.5 text-rose-950 shadow-xs">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div className="space-y-1 w-full">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-rose-900 flex items-center gap-1.5">
                          <XCircle className="w-3.5 h-3.5 text-rose-600" />
                          Última Solicitação Indeferida
                        </span>
                        {ultimaSolicitacao.data_resposta && (
                          <span className="text-[10px] font-mono text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded">
                            {ultimaSolicitacao.data_resposta}
                          </span>
                        )}
                      </div>
                      <div className="p-2.5 bg-white/80 border border-rose-200 rounded-lg">
                        <span className="text-[11px] font-bold text-rose-900 block">
                          Justificativa do Administrador:
                        </span>
                        <p className="text-2xs text-rose-800 mt-0.5 font-medium">
                          {ultimaSolicitacao.motivo_rejeicao || 'Dados cadastrais divergentes da publicação oficial do certame.'}
                        </p>
                      </div>
                      <p className="text-[11px] text-rose-700">
                        Você pode corrigir os dados nos campos abaixo e submeter uma nova solicitação para reavaliação.
                      </p>
                    </div>
                  </div>
                )}

                {ultimaSolicitacao.status === 'aprovado' && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-emerald-900">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="text-2xs">
                      Sua última solicitação de alteração foi <strong>deferida e integrada ao cadastro geral</strong> {ultimaSolicitacao.data_resposta ? `em ${ultimaSolicitacao.data_resposta}` : ''}.
                    </span>
                  </div>
                )}
              </>
            )}

            {/* Nome Completo e CPF */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nome Completo <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-teal-600 focus:outline-hidden font-medium"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  CPF <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="000.000.000-00"
                  value={cpf}
                  onChange={(e) => handleCpfChange(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-teal-600 focus:outline-hidden font-mono font-medium"
                  required
                />
              </div>
            </div>

            {/* Data de Nascimento e WhatsApp */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Data de Nascimento <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={dataNascimento}
                  onChange={(e) => setDataNascimento(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-teal-600 focus:outline-hidden font-medium"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  WhatsApp para Contato <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="(00) 00000-0000"
                  value={whatsapp}
                  onChange={(e) => handleWhatsappChange(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-teal-600 focus:outline-hidden font-mono font-medium"
                  required
                />
              </div>
            </div>

            {/* E-mail de Contato com Botão de Manter E-mail de Login */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block font-semibold text-slate-700">
                  E-mail para Notificações e Contato <span className="text-rose-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={handleManterEmailLogin}
                  className="text-[11px] font-semibold text-teal-700 hover:text-teal-900 cursor-pointer underline"
                >
                  Manter e-mail de login ({usuario.email})
                </button>
              </div>
              <input
                type="email"
                value={emailContato}
                onChange={(e) => setEmailContato(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-teal-600 focus:outline-hidden font-medium"
                required
              />
            </div>

            {/* Outros Concursos e Cargos em que também está aprovado (IDENTIFICAÇÃO AUTOMÁTICA) */}
            <div className="pt-3 border-t border-slate-200 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                    <span>Concursos e Cargos em que Você está Aprovado</span>
                  </h4>
                  <p className="text-2xs text-slate-500">
                    O sistema identifica automaticamente todos os certames e cargos onde você figura na lista de aprovados.
                  </p>
                </div>
              </div>

              {/* Lista dos concursos identificados automaticamente */}
              {aprovacoesIdentificadas.length > 0 ? (
                <div className="space-y-2">
                  {aprovacoesIdentificadas.map((aprov) => (
                    <div
                      key={aprov.id}
                      className="p-3 rounded-xl border border-teal-200/90 bg-teal-50/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition-all"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <Building className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                          <span className="font-bold text-slate-900 text-xs">
                            {aprov.concurso_nome}
                          </span>
                          <span className="text-2xs font-mono text-slate-500">({aprov.ano})</span>
                          <span className="text-[10px] font-bold text-teal-800 bg-teal-100/90 px-2 py-0.5 rounded-md flex items-center gap-1">
                            <Check className="w-3 h-3 text-teal-700" />
                            <span>Identificado no Sistema</span>
                          </span>
                        </div>
                        <div className="text-xs text-slate-600 flex flex-wrap items-center gap-x-2 gap-y-0.5 pl-5">
                          <span className="font-medium text-slate-800">{aprov.cargo_nome}</span>
                          <span className="text-slate-300">·</span>
                          <span className="font-mono font-bold text-teal-800">
                            {aprov.posicao}º lugar
                          </span>
                          {aprov.cota && (
                            <>
                              <span className="text-slate-300">·</span>
                              <span className="text-slate-500 text-2xs">{aprov.cota}</span>
                            </>
                          )}
                          {aprov.status && (
                            <>
                              <span className="text-slate-300">·</span>
                              <span className="text-2xs font-semibold text-slate-600 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                                {aprov.status}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 text-center space-y-1">
                  <span className="text-xs font-semibold text-slate-600 block">
                    Nenhuma aprovação vinculada automaticamente ainda
                  </span>
                  <p className="text-2xs text-slate-400 max-w-md mx-auto">
                    Certifique-se de que seu nome e CPF estão preenchidos corretamente acima para cruzamento com as listas de homologação.
                  </p>
                </div>
              )}

              {/* Botões para acionar a administração */}
              <div className="pt-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onAbrirContatoAdmin?.('inclusao_concurso');
                  }}
                  className="flex-1 py-2 px-3 bg-white hover:bg-slate-50 border border-slate-300 hover:border-teal-500 rounded-xl text-xs font-semibold text-slate-700 flex items-center justify-center gap-1.5 transition-all shadow-2xs cursor-pointer text-center"
                >
                  <Plus className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                  <span>Informar outro concurso ou cargo não cadastrado</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onAbrirContatoAdmin?.('vinculacao_nao_efetivada');
                  }}
                  className="flex-1 py-2 px-3 bg-teal-50/70 hover:bg-teal-100 border border-teal-200 rounded-xl text-xs font-semibold text-teal-900 flex items-center justify-center gap-1.5 transition-all shadow-2xs cursor-pointer text-center"
                >
                  <Link2 className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                  <span>Minha vinculação não foi efetivada no certame</span>
                </button>
              </div>
            </div>

            {/* Ações Inferiores */}
            <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
              <span className="text-2xs text-slate-400">
                Campos com asterisco (<span className="text-rose-500">*</span>) são obrigatórios
              </span>

              <div className="flex items-center gap-2">
                {!obrigatorio && (
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 border border-slate-300 text-slate-700 font-semibold rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    Fechar
                  </button>
                )}

                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-5 py-2 bg-[#07192B] hover:bg-[#0C2640] text-[#2DD4AA] font-bold rounded-xl transition-colors cursor-pointer shadow-sm"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>
                    {obrigatorio
                      ? 'Salvar e Concluir Cadastro Obrigatório'
                      : primeiroCadastro
                      ? 'Salvar Dados Iniciais'
                      : 'Submeter Alterações ao Administrador'}
                  </span>
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
