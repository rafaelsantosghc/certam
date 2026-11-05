import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../store/authContext';
import { certamStore } from '../store/certamStore';
import { auditStore } from '../store/auditStore';
import { userRegistryStore } from '../store/userRegistryStore';
import { notificationStore } from '../store/notificationStore';
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
  const [mensagemSucessoTitulo, setMensagemSucessoTitulo] = useState('');
  const [mensagemSucessoDetalhe, setMensagemSucessoDetalhe] = useState('');
  const [erroValidacao, setErroValidacao] = useState('');

  useEffect(() => {
    if (aberto && usuario) {
      setNome(usuario.nome || '');
      setCpf(usuario.cpf || '');
      setDataNascimento(usuario.data_nascimento || '');
      setWhatsapp(usuario.whatsapp || usuario.telefone || '');
      setEmailContato(usuario.email_contato || usuario.email || '');
      setOutrosConcursos(usuario.outros_concursos || []);
      setErroValidacao('');

      // Se for o modal obrigatório de primeiro acesso ou ainda não tiver CPF de 11 dígitos cadastrado
      const cpfDigits = (usuario.cpf || '').replace(/\D/g, '');
      const isSemDados = Boolean(obrigatorio) || cpfDigits.length < 11;
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
    const emailUser = String(usuario.email || '').toLowerCase().trim();
    const cpfLimpo = String(usuario.cpf || cpf || '').replace(/\D/g, '');
    return todasSolicitacoes.find(
      (r) =>
        (emailUser && String(r.usuario_email || '').toLowerCase().trim() === emailUser) ||
        (cpfLimpo && r.cpf && String(r.cpf).replace(/\D/g, '') === cpfLimpo)
    );
  }, [usuario, cpf, todasSolicitacoes]);

  // Identificação automática de todas as aprovações do candidato
  const aprovacoesIdentificadas: AprovacaoDetectada[] = useMemo(() => {
    return buscarTodasAprovacoesCandidato({
      cpf: String(cpf || usuario?.cpf || ''),
      nome: String(nome || usuario?.nome || ''),
      email: String(emailContato || usuario?.email || ''),
      candidato_id: usuario?.candidato_id,
      outros_concursos: outrosConcursos,
    });
  }, [cpf, nome, emailContato, usuario, outrosConcursos]);

  // Verificação em tempo real do CPF digitado no 1º acesso (deve ficar antes de qualquer return condicional)
  const statusCpfDigitado = useMemo(() => {
    const digits = String(cpf || '').replace(/\D/g, '');
    if (digits.length < 11) return null;
    const reg = userRegistryStore.getUserByCpf(cpf);
    const aprovs = buscarTodasAprovacoesCandidato({ cpf });
    if (reg || aprovs.length > 0) {
      return {
        existe: true,
        nomeEncontrado: reg?.nome || aprovs[0]?.concurso_nome || 'Cadastro existente',
        concursoInfo:
          aprovs.length > 0
            ? `${aprovs[0].concurso_nome} (${aprovs[0].cargo_nome} • ${aprovs[0].posicao}º lugar)`
            : reg?.orgao
            ? `${reg.orgao} (${reg.cargo_nome || ''})`
            : 'Cadastro Geral do Portal',
      };
    }
    return { existe: false };
  }, [cpf]);

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

    if (nome.trim() !== String(usuario.nome || '').trim()) {
      diffs.push({
        campo: 'nome',
        campo_label: 'Nome Completo',
        valor_antigo: String(usuario.nome || '(não informado)'),
        valor_novo: nome.trim(),
      });
    }

    if (cpf.trim() !== String(usuario.cpf || '').trim()) {
      diffs.push({
        campo: 'cpf',
        campo_label: 'CPF',
        valor_antigo: String(usuario.cpf || '(não informado)'),
        valor_novo: cpf.trim(),
      });
    }

    if (dataNascimento !== String(usuario.data_nascimento || '')) {
      diffs.push({
        campo: 'data_nascimento',
        campo_label: 'Data de Nascimento',
        valor_antigo: String(usuario.data_nascimento || '(não informado)'),
        valor_novo: dataNascimento || '(não informado)',
      });
    }

    if (whatsapp.trim() !== String(usuario.whatsapp || usuario.telefone || '').trim()) {
      diffs.push({
        campo: 'whatsapp',
        campo_label: 'WhatsApp de Contato',
        valor_antigo: String(usuario.whatsapp || usuario.telefone || '(não informado)'),
        valor_novo: whatsapp.trim(),
      });
    }

    if (emailContato.trim() !== String(usuario.email_contato || usuario.email || '').trim()) {
      diffs.push({
        campo: 'email_contato',
        campo_label: 'E-mail para Comunicação',
        valor_antigo: String(usuario.email_contato || usuario.email || '(não informado)'),
        valor_novo: emailContato.trim(),
      });
    }

    return diffs;
  };

  const handleSubmeterOuSalvar = (e: React.FormEvent) => {
    e.preventDefault();
    setErroValidacao('');

    const nomeLimpo = sanitizeInput(nome.trim(), 100);
    const cpfDigits = cpf.replace(/\D/g, '');
    const cpfFormatado =
      cpfDigits.length === 11
        ? `${cpfDigits.slice(0, 3)}.${cpfDigits.slice(3, 6)}.${cpfDigits.slice(6, 9)}-${cpfDigits.slice(9)}`
        : sanitizeInput(cpf.trim(), 20);

    if (!nomeLimpo || cpfDigits.length < 11) {
      setErroValidacao('Por favor, preencha seu Nome Completo e um CPF válido com 11 dígitos.');
      return;
    }

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

    const diffs = calcularDiffs();
    const jaPossuiaCpfVinculado = Boolean((usuario.cpf || '').replace(/\D/g, '').length >= 11);

    // 1. Preenchimento obrigatório de 1º acesso (ou quando o usuário ainda não tinha CPF definido)
    if (obrigatorio || primeiroCadastro || !jaPossuiaCpfVinculado) {
      const emailLogin = (usuario.email || emailContato.trim() || 'candidato@certam').toLowerCase().trim();
      const existingByCpf = userRegistryStore.getUserByCpf(cpfFormatado);
      const aprovacoesPorCpf = buscarTodasAprovacoesCandidato({ cpf: cpfFormatado });
      const cpfJaExisteNoSistema = Boolean(existingByCpf) || aprovacoesPorCpf.length > 0;

      if (cpfJaExisteNoSistema) {
        // O CPF já existe no cadastro geral / listas de classificação: vincula automaticamente!
        const primeiraAprov = aprovacoesPorCpf[0];
        const nomeConsolidado = existingByCpf?.nome || nomeLimpo;
        const candIdVinculado =
          existingByCpf?.candidato_id || existingByCpf?.id || usuario.id || `user-${Date.now().toString(36)}`;

        const dadosVinculados = {
          id: existingByCpf?.id || candIdVinculado,
          candidato_id: candIdVinculado,
          nome: nomeConsolidado,
          cpf: cpfFormatado,
          cpf_verificado: true,
          status_cadastro: 'ativo' as const,
          data_nascimento:
            sanitizeInput(dataNascimento, 15) || existingByCpf?.data_nascimento || usuario.data_nascimento || '',
          whatsapp: sanitizeInput(whatsapp, 25) || existingByCpf?.whatsapp || existingByCpf?.telefone || '',
          telefone: sanitizeInput(whatsapp, 25) || existingByCpf?.telefone || existingByCpf?.whatsapp || '',
          email: emailLogin,
          email_contato: sanitizeInput(emailContato || emailLogin, 80),
          concurso_id: existingByCpf?.concurso_id || primeiraAprov?.concurso_id || usuario.concurso_id,
          cargo_id: existingByCpf?.cargo_id || primeiraAprov?.cargo_id || usuario.cargo_id,
          outros_concursos: outrosSincronizados,
        };

        userRegistryStore.vincularOuRegistrarUsuarioLogin({
          ...usuario,
          ...dadosVinculados,
        });
        atualizarDadosUsuario(dadosVinculados);

        // Se o nome digitado pelo usuário for diferente do nome que constava no CPF existente, registra na auditoria para ciência/aprovação
        if (
          existingByCpf?.nome &&
          existingByCpf.nome.trim().toLowerCase() !== nomeLimpo.toLowerCase()
        ) {
          auditStore.submeterSolicitacaoAlteracao({
            usuario_id: dadosVinculados.id,
            usuario_email: emailLogin,
            usuario_nome: existingByCpf.nome,
            cpf: cpfFormatado,
            alteracoes: [
              {
                campo: 'nome',
                campo_label: 'Nome Completo',
                valor_antigo: existingByCpf.nome,
                valor_novo: nomeLimpo,
              },
            ],
          });

          notificationStore.criarNotificacao({
            destinatario_papel: 'admin',
            destinatario_email: 'rafasms0@hotmail.com',
            destinatario_nome: 'Administrador CERTAM',
            aba_admin_destino: 'auditoria',
            titulo: 'Nova Solicitação de Alteração Cadastral',
            mensagem: `O candidato "${existingByCpf.nome}" (${emailLogin}) solicitou atualizar o Nome Completo para "${nomeLimpo}" durante a vinculação por CPF (${cpfFormatado}).`,
            tipo: 'solicitacao_auditoria_admin',
            link_destino: '/?admin=1&tab=auditoria',
            urgente: false,
          });
        }

        setMensagemSucessoTitulo('CPF Localizado! Cadastro Vinculado Automaticamente!');
        setMensagemSucessoDetalhe(
          `Seu CPF (${cpfFormatado}) foi localizado no Cadastro Geral do CERTAM e seu acesso foi vinculado automaticamente ao registro de "${nomeConsolidado}".`
        );
      } else {
        // O CPF NÃO existe no cadastro geral: cria o usuário com o novo CPF, pesquisa nomes parecidos e avisa o administrador
        const novoId = usuario.id || usuario.candidato_id || `user-${Date.now().toString(36)}`;
        const sugestoesNomes = userRegistryStore.buscarSugestoesNomesParecidos(
          nomeLimpo,
          cpfFormatado,
          emailLogin,
          5
        );

        const dadosNovoUsuario = {
          id: novoId,
          candidato_id: novoId,
          nome: nomeLimpo,
          cpf: cpfFormatado,
          cpf_verificado: false,
          status_cadastro: 'ativo' as const,
          data_nascimento: sanitizeInput(dataNascimento, 15) || '',
          whatsapp: sanitizeInput(whatsapp, 25) || '',
          telefone: sanitizeInput(whatsapp, 25) || '',
          email: emailLogin,
          email_contato: sanitizeInput(emailContato || emailLogin, 80),
          outros_concursos: outrosSincronizados,
        };

        userRegistryStore.salvarUsuario({
          ...dadosNovoUsuario,
          is_admin: Boolean(usuario.is_admin),
          role: usuario.is_admin ? 'admin' : 'candidato',
        });
        atualizarDadosUsuario(dadosNovoUsuario);

        const primeiraSugestao = sugestoesNomes[0];
        const resumoSugestoes =
          sugestoesNomes.length > 0
            ? `Nomes parecidos localizados para sugestão de vínculo: ${sugestoesNomes
                .map(
                  (s) =>
                    `${s.nome} (${s.similaridade}% compatível — ${s.concurso_nome || 'Cadastro Geral'}${
                      s.posicao ? `, ${s.posicao}º lugar` : ''
                    })`
                )
                .join('; ')}.`
            : 'Nenhum candidato com nome semelhante foi localizado automaticamente nas listas atuais.';

        // Registra na fila de Validações / Novos Cadastros do Admin para facilitar a vinculação em 1 clique
        const primeiroConcurso = certamStore.getConcursos()[0];
        auditStore.solicitarVinculacao({
          tipo: 'novo_cadastro',
          usuario_id: novoId,
          usuario_email: emailLogin,
          usuario_nome: nomeLimpo,
          cpf: cpfFormatado,
          concurso_id: primeiraSugestao?.concurso_id || primeiroConcurso?.id || 'geral',
          concurso_nome:
            primeiraSugestao?.concurso_nome || primeiroConcurso?.orgao || 'Cadastro Geral do Portal',
          cargo_id: primeiraSugestao?.cargo_id || primeiroConcurso?.cargos?.[0]?.id || 'geral',
          cargo_nome:
            primeiraSugestao?.cargo_nome ||
            primeiroConcurso?.cargos?.[0]?.nome ||
            'Novo Cadastro no 1º Acesso',
          posicao_declarada: primeiraSugestao?.posicao || 1,
          candidato_vinculado_id: primeiraSugestao?.candidato_id,
          comprovante_info: `Novo cadastro realizado no 1º acesso com CPF inédito (${cpfFormatado}). ${resumoSugestoes}`,
        });

        // Dispara notificação administrativa (categoria própria de conferência, nunca como indeferimento)
        notificationStore.criarNotificacao({
          destinatario_papel: 'admin',
          destinatario_email: 'rafasms0@hotmail.com',
          destinatario_nome: 'Administrador CERTAM',
          aba_admin_destino: 'validacoes',
          titulo: 'Novo Cadastro Realizado no 1º Acesso',
          mensagem: `O usuário "${nomeLimpo}" (${emailLogin}) cadastrou um novo CPF (${cpfFormatado}) não existente no Cadastro Geral. ${
            sugestoesNomes.length > 0
              ? `Foram encontradas ${sugestoesNomes.length} sugestão(ões) de nomes parecidos (ex: ${sugestoesNomes[0].nome} - ${sugestoesNomes[0].similaridade}%) para vinculação.`
              : 'Acesse o Painel Admin para conferir o novo cadastro.'
          }`,
          tipo: 'novo_cadastro_admin',
          link_destino: '/?admin=1&tab=validacoes',
          urgente: false,
        });

        setMensagemSucessoTitulo('Novo Cadastro Criado com Sucesso!');
        setMensagemSucessoDetalhe(
          `Seu cadastro foi criado com o CPF ${cpfFormatado} e o administrador foi avisado para conferência e vinculação.`
        );
      }

      setTodasSolicitacoes(auditStore.getAuditRequests());
      setPrimeiroCadastro(false);
      setSubmetidoSucesso(true);
      setTimeout(() => {
        setSubmetidoSucesso(false);
        onClose();
      }, 2200);
      return;
    }

    // 2. Qualquer alteração de dados cadastrais solicitada pelo candidato já cadastrado vai para a fila de Auditoria do Painel Admin
    const finalDiffs: AlteracaoCampoItem[] =
      diffs.length > 0
        ? diffs
        : [
            {
              campo: 'nome',
              campo_label: 'Nome Completo',
              valor_antigo: usuario.nome || '(não informado)',
              valor_novo: nomeLimpo || usuario.nome,
            },
          ];

    const nomeSolicitante = sanitizeInput(usuario.nome || nomeLimpo || 'Candidato', 100);
    const emailSolicitante = usuario.email || emailContato.trim() || 'candidato@certam';
    const cpfSolicitante = sanitizeInput(usuario.cpf || cpfFormatado || '', 20);
    const camposLabelStr = finalDiffs.map((d) => d.campo_label).join(', ');

    auditStore.submeterSolicitacaoAlteracao({
      usuario_id: usuario.id || usuario.candidato_id,
      usuario_email: emailSolicitante,
      usuario_nome: nomeSolicitante,
      cpf: cpfSolicitante,
      alteracoes: finalDiffs,
    });

    notificationStore.criarNotificacao({
      destinatario_papel: 'admin',
      destinatario_email: 'rafasms0@hotmail.com',
      destinatario_nome: 'Administrador CERTAM',
      aba_admin_destino: 'auditoria',
      titulo: 'Nova Solicitação de Alteração Cadastral',
      mensagem: `O usuário "${nomeSolicitante}" (${emailSolicitante}) solicitou alteração em: ${camposLabelStr}. Clique para revisar na Auditoria de Perfis.`,
      tipo: 'solicitacao_auditoria_admin',
      link_destino: '/?admin=1&tab=auditoria',
      urgente: false,
    });

    setMensagemSucessoTitulo('Alterações Submetidas ao Administrador!');
    setMensagemSucessoDetalhe(
      'As alterações solicitadas foram enviadas para a fila de moderação do administrador. Assim que aprovadas, serão consolidadas no Cadastro Geral e no seu acesso.'
    );
    setTodasSolicitacoes(auditStore.getAuditRequests());
    setDiffAlteracoes(finalDiffs);
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
      const nomeSolicitante = usuario.nome || nome.trim();
      const camposLabelStr = diffs.map((d) => d.campo_label).join(', ');
      auditStore.submeterSolicitacaoAlteracao({
        usuario_id: usuario.id || usuario.candidato_id,
        usuario_email: usuario.email,
        usuario_nome: nomeSolicitante,
        cpf: usuario.cpf || cpf.trim() || '',
        alteracoes: diffs,
      });

      notificationStore.criarNotificacao({
        destinatario_papel: 'admin',
        destinatario_email: 'rafasms0@hotmail.com',
        destinatario_nome: 'Administrador CERTAM',
        aba_admin_destino: 'auditoria',
        titulo: 'Nova Solicitação de Alteração Cadastral',
        mensagem: `O usuário "${nomeSolicitante}" (${usuario.email}) solicitou alteração em: ${camposLabelStr}. Clique para revisar na Auditoria de Perfis.`,
        tipo: 'solicitacao_auditoria_admin',
        link_destino: '/?admin=1&tab=auditoria',
        urgente: false,
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
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in-50">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-[#07192B] text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-500/20 text-[#2DD4AA] flex items-center justify-center font-bold">
              <User className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-base text-white">
                {obrigatorio || primeiroCadastro
                  ? 'Identificação Obrigatória de 1º Acesso • CERTAM'
                  : 'Cadastro e Perfil do Candidato'}
              </h3>
              <p className="text-2xs text-slate-300">
                {obrigatorio || primeiroCadastro
                  ? 'Informe seu Nome Completo e CPF para vinculação automática ao Cadastro Geral ou criação do seu acesso'
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
              {mensagemSucessoTitulo ||
                (primeiroCadastro ? 'Dados Cadastrados com Sucesso!' : 'Alterações Submetidas ao Administrador!')}
            </h4>
            <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
              {mensagemSucessoDetalhe ||
                (primeiroCadastro
                  ? 'Seu cadastro foi salvo e sincronizado com as listas oficiais de classificação do CERTAM.'
                  : 'As alterações solicitadas foram enviadas para a fila de moderação do administrador. Assim que conferidas, serão homologadas.')}
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
            {/* Aviso de 1º Acesso ou de Auditoria */}
            {obrigatorio || primeiroCadastro ? (
              <div className="p-3.5 bg-teal-50 border border-teal-200 rounded-xl flex items-start gap-2.5 text-teal-950">
                <ShieldCheck className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="font-bold block">Identificação Obrigatória no Primeiro Acesso</span>
                  <p className="text-2xs text-teal-800 leading-relaxed">
                    Defina seu <strong>Nome Completo</strong> e seu <strong>CPF</strong>. Se o CPF já constar no Cadastro Geral, seu acesso será vinculado automaticamente. Caso contrário, seu cadastro será criado e o administrador receberá um aviso com sugestões de vinculação.
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-2xs text-slate-600">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-teal-600 shrink-0" />
                  <span>
                    Qualquer alteração em seus dados cadastrais será auditada e submetida para aprovação da administração.
                  </span>
                </div>
              </div>
            )}

            {erroValidacao && (
              <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl flex items-center gap-2 text-rose-800 font-semibold">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{erroValidacao}</span>
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
                  placeholder="Digite seu nome completo"
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
                {(obrigatorio || primeiroCadastro) && statusCpfDigitado && (
                  <div className="mt-1.5">
                    {statusCpfDigitado.existe ? (
                      <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-lg flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>
                          CPF encontrado ({statusCpfDigitado.nomeEncontrado}) — será vinculado automaticamente!
                        </span>
                      </span>
                    ) : (
                      <span className="text-[11px] font-medium text-amber-800 bg-amber-50 border border-amber-200 px-2 py-1 rounded-lg flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span>
                          Novo CPF — será criado novo cadastro e enviado aviso de vinculação ao Admin.
                        </span>
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Data de Nascimento e WhatsApp */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Data de Nascimento <span className="text-slate-400 font-normal">(opcional no 1º acesso)</span>
                </label>
                <input
                  type="date"
                  value={dataNascimento}
                  onChange={(e) => setDataNascimento(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-teal-600 focus:outline-hidden font-medium"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  WhatsApp para Contato <span className="text-slate-400 font-normal">(opcional no 1º acesso)</span>
                </label>
                <input
                  type="text"
                  placeholder="(00) 00000-0000"
                  value={whatsapp}
                  onChange={(e) => handleWhatsappChange(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-teal-600 focus:outline-hidden font-mono font-medium"
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
