import { NotificacaoItem, Usuario } from '../types';
import { certamStore } from '../store/certamStore';
import { ADMIN_EMAILS } from '../store/authContext';

/**
 * Identifica se uma notificação é destinada EXCLUSIVAMENTE ao Administrador do Portal
 * (ex: novo cadastro no 1º acesso para conferência/vinculação, nova solicitação de alteração cadastral,
 * nova solicitação de vinculação manual ou mensagem de contato).
 * Também reconhece notificações legadas já salvas no cache/banco.
 */
export function isNotificacaoParaAdmin(n: NotificacaoItem): boolean {
  if (!n) return false;
  if (n.destinatario_papel === 'admin') return true;
  if (n.tipo === 'novo_cadastro_admin' || n.tipo === 'solicitacao_auditoria_admin') return true;
  if (n.aba_admin_destino) return true;
  if (n.link_destino && n.link_destino.includes('admin=1')) return true;

  const tituloLower = String(n.titulo ?? '').toLowerCase();
  const destNomeLower = String(n.destinatario_nome ?? '').toLowerCase();
  if (
    tituloLower.includes('novo cadastro realizado') ||
    tituloLower.includes('nova solicitação de alteração') ||
    tituloLower.includes('nova solicitação de vinculação') ||
    tituloLower.includes('nova mensagem para a administração') ||
    destNomeLower.includes('administrador')
  ) {
    return true;
  }

  return false;
}

/**
 * Identifica se uma notificação é um retorno individual destinado EXCLUSIVAMENTE a um Candidato
 * (ex: deferimento/indeferimento de alteração cadastral, homologação/recusa de vínculo, resposta a contato).
 */
export function isNotificacaoExclusivaCandidato(n: NotificacaoItem): boolean {
  if (!n) return false;
  if (isNotificacaoParaAdmin(n)) return false;

  if (n.destinatario_papel === 'candidato') return true;
  if (
    n.tipo === 'aprovacao_perfil' ||
    n.tipo === 'indeferimento_perfil' ||
    n.tipo === 'validacao_aprovada' ||
    n.tipo === 'validacao_indeferida' ||
    n.tipo === 'resposta_contato'
  ) {
    return true;
  }

  if (n.destinatario_email || n.destinatario_cpf || n.destinatario_usuario_id) {
    return true;
  }

  return false;
}

/**
 * Determina se uma notificação deve aparecer (no Sino e no Toast) para o usuário atual.
 *
 * Regras:
 * 1. Notificações de conferência/moderação do Admin (`isNotificacaoParaAdmin`):
 *    - Aparecem APENAS para quem está autenticado como Administrador (`isAdmin === true`).
 *    - Nunca aparecem para candidatos comuns ou visitantes.
 * 2. Notificações individuais de retorno ao Candidato (`isNotificacaoExclusivaCandidato`):
 *    - NUNCA aparecem para o Administrador (`isAdmin === true`), pois o Admin é quem deferiu/indeferiu/respondeu.
 *    - Aparecem APENAS para o próprio candidato titular (correspondência por ID, CPF ou E-mail).
 * 3. Notificações públicas/broadcast do Portal (`convocacao`, `cronograma`, `documento`, `comunicado`, `chat`, `geral`):
 *    - Aparecem para todos os usuários do portal.
 */
export function podeExibirNotificacaoParaUsuario(
  n: NotificacaoItem,
  usuario: Usuario | null,
  isAdmin: boolean
): boolean {
  if (!n) return false;

  // 1. Notificação exclusiva para o Administrador
  if (isNotificacaoParaAdmin(n)) {
    return Boolean(isAdmin);
  }

  // 2. Notificação individual exclusiva para o Candidato (deferimento, indeferimento, homologação, resposta)
  if (isNotificacaoExclusivaCandidato(n)) {
    // O Administrador que realizou o deferimento/indeferimento não deve receber a notificação do candidato
    if (isAdmin) {
      return false;
    }

    if (!usuario) {
      return false;
    }

    // Correspondência por ID de usuário ou candidato
    if (
      n.destinatario_usuario_id &&
      (usuario.id === n.destinatario_usuario_id || usuario.candidato_id === n.destinatario_usuario_id)
    ) {
      return true;
    }

    // Correspondência por CPF
    const cpfUser = String(usuario.cpf ?? '').replace(/\D/g, '');
    const cpfDest = String(n.destinatario_cpf ?? '').replace(/\D/g, '');
    if (cpfUser.length >= 9 && cpfDest.length >= 9 && cpfUser === cpfDest) {
      return true;
    }

    // Correspondência por E-mail
    const emailUser = String(usuario.email ?? '').toLowerCase().trim();
    const emailContatoUser = String(usuario.email_contato ?? '').toLowerCase().trim();
    const emailDest = String(n.destinatario_email ?? '').toLowerCase().trim();

    if (emailDest && (emailUser === emailDest || emailContatoUser === emailDest)) {
      return true;
    }

    return false;
  }

  // 3. Notificações gerais / broadcast do portal (convocações, cronograma, documentos, comunicados)
  return true;
}

export interface MetadadosVisuaisNotificacao {
  categoria:
    | 'admin_verificacao'
    | 'deferimento'
    | 'indeferimento'
    | 'resposta_contato'
    | 'convocacao'
    | 'cronograma'
    | 'documento'
    | 'comunicado';
  headerTag: string;
  badgeLabel: string;
  acaoLabel: string;
  temaCor: 'amber' | 'emerald' | 'rose' | 'cyan' | 'teal';
}

/**
 * Classifica visualmente a notificação para exibição consistente no Toast e no Sino,
 * garantindo que avisos administrativos nunca apareçam como "Indeferimento".
 */
export function obterMetadadosVisuaisNotificacao(n: NotificacaoItem): MetadadosVisuaisNotificacao {
  if (isNotificacaoParaAdmin(n)) {
    const isNovoCadastro =
      n.tipo === 'novo_cadastro_admin' ||
      String(n.titulo ?? '').toLowerCase().includes('novo cadastro');
    return {
      categoria: 'admin_verificacao',
      headerTag: isNovoCadastro ? 'Aviso ao Administrador' : 'Fila de Moderação Admin',
      badgeLabel: isNovoCadastro ? 'Verificar Cadastro' : 'Pendente Admin',
      acaoLabel: 'Clique para verificar no Painel do Administrador',
      temaCor: 'amber',
    };
  }

  switch (n.tipo) {
    case 'aprovacao_perfil':
      return {
        categoria: 'deferimento',
        headerTag: 'Deferimento Oficial',
        badgeLabel: 'Deferido',
        acaoLabel: 'Clique para visualizar seu cadastro atualizado',
        temaCor: 'emerald',
      };

    case 'validacao_aprovada':
      return {
        categoria: 'deferimento',
        headerTag: 'Homologação Oficial',
        badgeLabel: 'Homologado',
        acaoLabel:
          n.concurso_id && n.concurso_id !== 'geral' && n.concurso_id !== 'outro'
            ? 'Clique para abrir sua classificação no concurso'
            : 'Clique para visualizar seu cadastro homologado',
        temaCor: 'emerald',
      };

    case 'indeferimento_perfil':
      return {
        categoria: 'indeferimento',
        headerTag: 'Indeferimento Cadastral',
        badgeLabel: 'Indeferido',
        acaoLabel: 'Clique para revisar e corrigir seus dados no perfil',
        temaCor: 'rose',
      };

    case 'validacao_indeferida':
      return {
        categoria: 'indeferimento',
        headerTag: 'Indeferimento de Vínculo',
        badgeLabel: 'Recusado',
        acaoLabel: 'Clique para revisar os detalhes da solicitação',
        temaCor: 'rose',
      };

    case 'resposta_contato':
      return {
        categoria: 'resposta_contato',
        headerTag: 'Atendimento CERTAM',
        badgeLabel: 'Respondido',
        acaoLabel: 'Clique para ver os detalhes do retorno',
        temaCor: 'teal',
      };

    case 'convocacao':
      return {
        categoria: 'convocacao',
        headerTag: 'Chamamento Oficial',
        badgeLabel: 'Convocação',
        acaoLabel: 'Clique para acessar os lotes e convocações',
        temaCor: 'cyan',
      };

    case 'cronograma':
      return {
        categoria: 'cronograma',
        headerTag: 'Etapa do Certame',
        badgeLabel: 'Cronograma',
        acaoLabel: 'Clique para abrir o cronograma do concurso',
        temaCor: 'teal',
      };

    case 'documento':
      return {
        categoria: 'documento',
        headerTag: 'Publicação Oficial',
        badgeLabel: 'Documento',
        acaoLabel: 'Clique para acessar os documentos oficiais',
        temaCor: 'teal',
      };

    case 'chat':
      return {
        categoria: 'comunicado',
        headerTag: 'Comunidade do Certame',
        badgeLabel: 'Fórum',
        acaoLabel: 'Clique para abrir a comunidade do concurso',
        temaCor: 'teal',
      };

    case 'comunicado':
    case 'geral':
    default:
      return {
        categoria: 'comunicado',
        headerTag: 'Comunicado Oficial',
        badgeLabel: n.tipo === 'comunicado' ? 'Comunicado' : 'Informativo',
        acaoLabel: 'Clique para acessar a página correspondente',
        temaCor: 'teal',
      };
  }
}

/**
 * Redireciona o usuário para a página, aba ou modal correspondente ao clicar na notificação
 * (tanto no Toast flutuante quanto na lista do Sino de Notificações).
 */
export function executarRedirecionamentoNotificacao(
  n: NotificacaoItem,
  onNavigate?: (view: string, params?: any) => void,
  concursoAtualId?: string
): void {
  if (!n) return;

  // 1. Notificações destinadas ao Administrador -> Redireciona para o Painel Admin na aba exata
  if (isNotificacaoParaAdmin(n)) {
    let abaAlvo: string = n.aba_admin_destino || 'validacoes';

    if (!n.aba_admin_destino && n.link_destino) {
      try {
        const url = new URL(n.link_destino, window.location.origin);
        const tabParam = url.searchParams.get('tab');
        if (tabParam) {
          abaAlvo = tabParam;
        }
      } catch {
        // ignore
      }
    }

    const tituloLower = String(n.titulo ?? '').toLowerCase();
    if (!n.aba_admin_destino) {
      if (tituloLower.includes('alteração') || tituloLower.includes('auditoria')) {
        abaAlvo = 'auditoria';
      } else if (tituloLower.includes('contato') || tituloLower.includes('mensagem')) {
        abaAlvo = 'contatos';
      } else if (tituloLower.includes('novo cadastro') || tituloLower.includes('vinculação')) {
        abaAlvo = 'validacoes';
      }
    }

    if (onNavigate) {
      onNavigate('admin', { tab: abaAlvo });
    }
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('certam_abrir_aba_admin', { detail: abaAlvo }));
    }, 40);
    return;
  }

  // 2. Deferimento ou Indeferimento de Perfil Cadastral -> Abre o Modal de Perfil do Candidato
  if (n.tipo === 'aprovacao_perfil' || n.tipo === 'indeferimento_perfil') {
    window.dispatchEvent(new CustomEvent('certam_abrir_perfil_candidato'));
    return;
  }

  // 3. Homologação ou Indeferimento de Vinculação -> Vai para a Classificação do Concurso (se houver) ou Perfil
  if (n.tipo === 'validacao_aprovada' || n.tipo === 'validacao_indeferida') {
    const cId = n.concurso_id && n.concurso_id !== 'geral' && n.concurso_id !== 'outro' ? n.concurso_id : undefined;
    if (cId && onNavigate) {
      const conc = certamStore.getConcurso(cId);
      if (conc) {
        const cgId =
          n.cargo_id && n.cargo_id !== 'geral' && n.cargo_id !== 'outro'
            ? n.cargo_id
            : conc.cargos?.[0]?.id;
        onNavigate('concurso', { concursoId: conc.id, cargoId: cgId, tab: 'classificacao' });
        setTimeout(() => {
          window.dispatchEvent(
            new CustomEvent('certam_mudar_aba_concurso', {
              detail: { concursoId: conc.id, cargoId: cgId, tab: 'classificacao' },
            })
          );
        }, 40);
        return;
      }
    }
    window.dispatchEvent(new CustomEvent('certam_abrir_perfil_candidato'));
    return;
  }

  // 4. Resposta ao Contato da Administração
  if (n.tipo === 'resposta_contato') {
    const cId = n.concurso_id && n.concurso_id !== 'geral' && n.concurso_id !== 'outro' ? n.concurso_id : undefined;
    if (cId && onNavigate) {
      const conc = certamStore.getConcurso(cId);
      if (conc) {
        const cgId =
          n.cargo_id && n.cargo_id !== 'geral' && n.cargo_id !== 'outro'
            ? n.cargo_id
            : conc.cargos?.[0]?.id;
        onNavigate('concurso', { concursoId: conc.id, cargoId: cgId, tab: 'dashboard' });
        return;
      }
    }
    window.dispatchEvent(new CustomEvent('certam_abrir_perfil_candidato'));
    return;
  }

  // 5. Demais notificações (convocacao, cronograma, documento, comunicado, chat, geral) ou com link_destino
  let idFromUrl: string | null = null;
  let cargoFromUrl: string | null = null;
  let tabFromUrl: string | null = null;
  let loteFromUrl: string | null = null;
  let adminFromUrl = false;

  if (n.link_destino) {
    try {
      const url = new URL(n.link_destino, window.location.origin);
      idFromUrl = url.searchParams.get('id');
      cargoFromUrl = url.searchParams.get('cargo');
      tabFromUrl = url.searchParams.get('tab');
      loteFromUrl = url.searchParams.get('lote');
      if (url.searchParams.get('admin') === '1' || url.pathname.includes('admin')) {
        adminFromUrl = true;
      }
    } catch {
      // ignore
    }
  }

  if (adminFromUrl) {
    const abaAlvo = tabFromUrl || 'validacoes';
    onNavigate?.('admin', { tab: abaAlvo });
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('certam_abrir_aba_admin', { detail: abaAlvo }));
    }, 40);
    return;
  }

  const todosConcursos = certamStore.getConcursos();
  const candidatoConcursoId = [n.concurso_id, idFromUrl, concursoAtualId].find(
    (val) => val && val !== 'todos' && val !== 'geral' && val !== 'outro'
  );

  const concAlvo =
    (candidatoConcursoId ? certamStore.getConcurso(candidatoConcursoId) : undefined) ||
    todosConcursos[0];

  if (!concAlvo || !onNavigate) {
    return;
  }

  const candidatoCargoId = [n.cargo_id, cargoFromUrl].find(
    (val) => val && val !== 'todos' && val !== 'geral' && val !== 'outro'
  );
  const cargoAlvo =
    (candidatoCargoId && concAlvo.cargos?.find((c) => c.id === candidatoCargoId)?.id) ||
    concAlvo.cargos?.[0]?.id;

  const abasValidas = new Set([
    'dashboard',
    'cronograma',
    'classificacao',
    'quadro_vagas',
    'lotes',
    'documentos',
    'comunicados',
    'candidato',
    'forum',
    'faq',
  ]);

  let abaFinal = 'dashboard';
  if (tabFromUrl && abasValidas.has(tabFromUrl)) {
    abaFinal = tabFromUrl;
  } else {
    switch (n.tipo) {
      case 'convocacao':
        abaFinal = 'lotes';
        break;
      case 'cronograma':
        abaFinal = 'cronograma';
        break;
      case 'documento':
        abaFinal = 'documentos';
        break;
      case 'comunicado':
        abaFinal = 'comunicados';
        break;
      case 'chat':
        abaFinal = 'forum';
        break;
      default:
        abaFinal = 'dashboard';
        break;
    }
  }

  if (loteFromUrl || tabFromUrl === 'lote') {
    onNavigate('lote', {
      concursoId: concAlvo.id,
      cargoId: cargoAlvo,
      loteId: loteFromUrl || undefined,
    });
    return;
  }

  onNavigate('concurso', {
    concursoId: concAlvo.id,
    cargoId: cargoAlvo,
    tab: abaFinal,
  });

  setTimeout(() => {
    window.dispatchEvent(
      new CustomEvent('certam_mudar_aba_concurso', {
        detail: { concursoId: concAlvo.id, cargoId: cargoAlvo, tab: abaFinal },
      })
    );
  }, 40);
}

/**
 * Retorna o e-mail padrão do Administrador para notificações administrativas.
 */
export function getAdminNotificationEmail(): string {
  return ADMIN_EMAILS[0] || 'rafasms0@hotmail.com';
}
