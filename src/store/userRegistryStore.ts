import { Usuario, Candidato } from '../types';

const REGISTRY_STORAGE_KEY = 'certam_users_registry_v2';

const normalizarTexto = (str: string = ''): string => {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
};

const limparCpf = (cpfStr: string = ''): string => {
  return cpfStr.replace(/\D/g, '');
};

export const userRegistryStore = {
  getRegistry(): Record<string, Usuario> {
    try {
      localStorage.removeItem('certam_users_registry_v1');
      const stored = localStorage.getItem(REGISTRY_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch {
      // ignore
    }
    return {};
  },

  getAllUsers(): Usuario[] {
    const reg = this.getRegistry();
    return Object.values(reg).sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
  },

  salvarRegistry(registry: Record<string, Usuario>) {
    try {
      localStorage.setItem(REGISTRY_STORAGE_KEY, JSON.stringify(registry));
      window.dispatchEvent(new CustomEvent('certam_registry_updated', { detail: registry }));
    } catch {
      // ignore
    }
  },

  getUserByEmail(email: string): Usuario | null {
    if (!email) return null;
    const reg = this.getRegistry();
    return reg[email.toLowerCase().trim()] || null;
  },

  getUserById(id: string): Usuario | null {
    if (!id) return null;
    const all = this.getAllUsers();
    return all.find((u) => u.id === id || u.candidato_id === id) || null;
  },

  salvarUsuario(usuario: Usuario): Usuario {
    if (!usuario) throw new Error('Usuário inválido');
    const key = (usuario.id || usuario.email || `user-${Date.now().toString(36)}`).toLowerCase().trim();
    const reg = this.getRegistry();

    const finalUser: Usuario = {
      ...usuario,
      id: usuario.id || key,
      email: usuario.email ? usuario.email.toLowerCase().trim() : (reg[key]?.email || `${key}@portalcertam.com.br`),
      tipo_usuario: usuario.is_admin ? 'admin' : (usuario.tipo_usuario || 'candidato'),
      status_cadastro: usuario.bloqueado ? 'bloqueado' : (usuario.status_cadastro || 'ativo'),
    };

    reg[finalUser.email || key] = finalUser;
    this.salvarRegistry(reg);
    return finalUser;
  },

  atualizarCamposUsuario(chave: string, campos: Partial<Usuario>): Usuario | null {
    if (!chave) return null;
    const reg = this.getRegistry();
    const chaveNorm = chave.toLowerCase().trim();

    // Tenta encontrar por email ou por ID
    let emailAlvo = reg[chaveNorm] ? chaveNorm : null;
    if (!emailAlvo) {
      const encontrado = Object.values(reg).find((u) => u.id === chave || u.candidato_id === chave);
      if (encontrado && encontrado.email) {
        emailAlvo = encontrado.email.toLowerCase().trim();
      }
    }

    if (!emailAlvo || !reg[emailAlvo]) return null;

    const existente = reg[emailAlvo];
    const atualizado: Usuario = {
      ...existente,
      ...campos,
      email: campos.email ? campos.email.toLowerCase().trim() : existente.email,
    };

    reg[emailAlvo] = atualizado;
    this.salvarRegistry(reg);
    return atualizado;
  },

  bloquearUsuario(chave: string, bloquear: boolean): boolean {
    const user = this.getUserByEmail(chave) || this.getUserById(chave);
    if (!user) return false;
    this.atualizarCamposUsuario(user.email, {
      bloqueado: bloquear,
      status_cadastro: bloquear ? 'bloqueado' : 'ativo',
    });
    return true;
  },

  removerUsuario(chave: string): boolean {
    const reg = this.getRegistry();
    const chaveNorm = chave.toLowerCase().trim();

    let emailAlvo = reg[chaveNorm] ? chaveNorm : null;
    if (!emailAlvo) {
      const encontrado = Object.values(reg).find((u) => u.id === chave || u.candidato_id === chave);
      if (encontrado && encontrado.email) {
        emailAlvo = encontrado.email.toLowerCase().trim();
      }
    }

    if (!emailAlvo || !reg[emailAlvo]) return false;
    delete reg[emailAlvo];
    this.salvarRegistry(reg);
    return true;
  },

  /**
   * Verifica se o candidato da planilha já existe por CPF ou Nome Completo.
   * Se não existir, cadastra como perfil vinculável (status: aguardando_vinculacao).
   */
  cadastrarOuSincronizarCandidatoImportado(
    cand: Partial<Candidato>,
    concursoId?: string,
    cargoId?: string
  ): { usuario: Usuario; jaExistia: boolean } {
    const reg = this.getRegistry();
    const listaAtual = Object.values(reg);

    const cpfLimpo = cand.cpf ? limparCpf(cand.cpf) : '';
    const nomeNorm = cand.nome ? normalizarTexto(cand.nome) : '';

    // 1. Busca por CPF
    let match: Usuario | undefined;
    if (cpfLimpo.length >= 7) {
      match = listaAtual.find((u) => u.cpf && limparCpf(u.cpf) === cpfLimpo);
    }

    // 2. Busca por Nome Completo Exato
    if (!match && nomeNorm.length >= 3) {
      match = listaAtual.find((u) => u.nome && normalizarTexto(u.nome) === nomeNorm);
    }

    if (match) {
      // Já existia: sincroniza a inscrição do concurso se especificado
      const inscricoes = match.concursos_inscritos || [];
      const jaInscrito = inscricoes.some((i) => i.concurso_id === concursoId && i.cargo_id === cargoId);

      if (!jaInscrito && concursoId && cargoId) {
        inscricoes.push({
          concurso_id: concursoId,
          cargo_id: cargoId,
          data_inscricao: new Date().toLocaleDateString('pt-BR'),
        });
        this.atualizarCamposUsuario(match.email, { concursos_inscritos: inscricoes });
      }

      return { usuario: match, jaExistia: true };
    }

    // Não existia: cria pré-cadastro vinculável
    const generatedId = `cand-pre-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const emailTemp = cand.email ? cand.email.toLowerCase().trim() : `${generatedId}@portalcertam.com.br`;

    const novoPerfil: Usuario = {
      id: generatedId,
      nome: cand.nome ? cand.nome.trim() : 'Candidato Importado',
      email: emailTemp,
      email_contato: cand.email || '',
      cpf: cand.cpf ? cand.cpf.trim() : '',
      cpf_verificado: Boolean(cand.cpf),
      whatsapp: cand.whatsapp || '',
      telefone: cand.whatsapp || '',
      is_admin: false,
      tipo_usuario: 'candidato',
      status_cadastro: 'aguardando_vinculacao',
      candidato_id: cand.id || generatedId,
      concursos_inscritos:
        concursoId && cargoId
          ? [
              {
                concurso_id: concursoId,
                cargo_id: cargoId,
                data_inscricao: new Date().toLocaleDateString('pt-BR'),
              },
            ]
          : [],
    };

    reg[emailTemp] = novoPerfil;
    this.salvarRegistry(reg);
    return { usuario: novoPerfil, jaExistia: false };
  },
};
