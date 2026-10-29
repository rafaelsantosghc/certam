import { Usuario, Candidato } from '../types';
import { cloudSync } from './cloudSync';

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

const isFakeEmail = (email?: string): boolean => {
  if (!email) return true;
  const lower = email.toLowerCase().trim();
  return lower === '' || lower.endsWith('@portalcertam.com.br') || lower.startsWith('cand-pre-');
};

export const userRegistryStore = {
  getRegistry(): Record<string, Usuario> {
    try {
      localStorage.removeItem('certam_users_registry_v1');
      const stored = localStorage.getItem(REGISTRY_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === 'object') {
          let needsMigration = false;
          const sanitized: Record<string, Usuario> = {};

          for (const [k, u] of Object.entries(parsed as Record<string, Usuario>)) {
            if (!u || typeof u !== 'object') continue;
            const userCopy: Usuario = { ...u };

            // Remover e-mails aleatórios gerados anteriormente para candidatos importados (Item 18)
            if (isFakeEmail(userCopy.email)) {
              if (userCopy.email !== '') {
                userCopy.email = '';
                needsMigration = true;
              }
              if (userCopy.email_contato && isFakeEmail(userCopy.email_contato)) {
                userCopy.email_contato = '';
              }
              if (
                userCopy.status_cadastro !== 'bloqueado' &&
                userCopy.status_cadastro !== 'primeiro_acesso'
              ) {
                userCopy.status_cadastro = 'primeiro_acesso';
                needsMigration = true;
              }
            } else if (
              userCopy.status_cadastro === 'aguardando_vinculacao' ||
              userCopy.status_cadastro === 'aguardando_primeiro_acesso'
            ) {
              userCopy.status_cadastro = 'primeiro_acesso';
              needsMigration = true;
            }

            const dictKey = (userCopy.id || userCopy.email || k).toLowerCase().trim();
            userCopy.id = userCopy.id || dictKey;
            sanitized[dictKey] = userCopy;
          }

          if (needsMigration) {
            this.salvarRegistry(sanitized);
          }

          return sanitized;
        }
      }
    } catch {
      // ignore
    }
    return {};
  },

  getAllUsers(): Usuario[] {
    const reg = this.getRegistry();
    return Object.values(reg).sort((a, b) => {
      // Colocar usuários ativos com login real primeiro ou ordenar alfabeticamente
      const aAtivo = a.status_cadastro === 'ativo' && !isFakeEmail(a.email) ? 0 : 1;
      const bAtivo = b.status_cadastro === 'ativo' && !isFakeEmail(b.email) ? 0 : 1;
      if (aAtivo !== bAtivo) return aAtivo - bAtivo;
      return (a.nome || '').localeCompare(b.nome || '');
    });
  },

  salvarRegistry(registry: Record<string, Usuario>) {
    try {
      const jsonStr = JSON.stringify(registry);
      localStorage.setItem(REGISTRY_STORAGE_KEY, jsonStr);
      cloudSync.pushKey(REGISTRY_STORAGE_KEY, jsonStr, true);
      window.dispatchEvent(new CustomEvent('certam_registry_updated', { detail: registry }));
      window.dispatchEvent(new CustomEvent('certam_users_updated', { detail: registry }));
    } catch {
      // ignore
    }
  },

  getUserByEmail(email: string): Usuario | null {
    if (!email || isFakeEmail(email)) return null;
    const emailNorm = email.toLowerCase().trim();
    const all = this.getAllUsers();
    return (
      all.find(
        (u) =>
          (u.email && u.email.toLowerCase().trim() === emailNorm) ||
          (u.email_contato && u.email_contato.toLowerCase().trim() === emailNorm)
      ) || null
    );
  },

  getUserById(id: string): Usuario | null {
    if (!id) return null;
    const reg = this.getRegistry();
    if (reg[id.toLowerCase().trim()]) return reg[id.toLowerCase().trim()];
    const all = Object.values(reg);
    return (
      all.find(
        (u) =>
          u.id === id ||
          u.candidato_id === id ||
          (u.email && u.email.toLowerCase().trim() === id.toLowerCase().trim())
      ) || null
    );
  },

  findRegistryKey(chave: string): string | null {
    if (!chave) return null;
    const reg = this.getRegistry();
    const chaveNorm = chave.toLowerCase().trim();
    if (reg[chaveNorm]) return chaveNorm;

    for (const [k, u] of Object.entries(reg)) {
      if (
        u.id?.toLowerCase().trim() === chaveNorm ||
        u.candidato_id?.toLowerCase().trim() === chaveNorm ||
        (u.email && u.email.toLowerCase().trim() === chaveNorm)
      ) {
        return k;
      }
    }
    return null;
  },

  salvarUsuario(usuario: Usuario): Usuario {
    if (!usuario) throw new Error('Usuário inválido');
    const reg = this.getRegistry();

    const existingKey =
      (usuario.id && this.findRegistryKey(usuario.id)) ||
      (usuario.email && !isFakeEmail(usuario.email) && this.findRegistryKey(usuario.email)) ||
      null;

    const finalId = usuario.id || existingKey || `user-${Date.now().toString(36)}`;
    const dictKey = existingKey || finalId.toLowerCase().trim();

    const cleanEmail =
      usuario.email && !isFakeEmail(usuario.email) ? usuario.email.toLowerCase().trim() : '';

    const defaultStatus = cleanEmail ? 'ativo' : 'primeiro_acesso';

    const finalUser: Usuario = {
      ...(existingKey ? reg[existingKey] : {}),
      ...usuario,
      id: finalId,
      email: cleanEmail,
      tipo_usuario: usuario.is_admin ? 'admin' : usuario.tipo_usuario || 'candidato',
      status_cadastro: usuario.bloqueado
        ? 'bloqueado'
        : usuario.status_cadastro || defaultStatus,
    };

    reg[dictKey] = finalUser;
    this.salvarRegistry(reg);
    return finalUser;
  },

  atualizarCamposUsuario(chave: string, campos: Partial<Usuario>): Usuario | null {
    if (!chave) return null;
    const reg = this.getRegistry();
    const targetKey = this.findRegistryKey(chave);
    if (!targetKey || !reg[targetKey]) return null;

    const existente = reg[targetKey];
    const novoEmail =
      campos.email !== undefined
        ? isFakeEmail(campos.email)
          ? ''
          : campos.email.toLowerCase().trim()
        : existente.email;

    const atualizado: Usuario = {
      ...existente,
      ...campos,
      email: novoEmail,
    };

    reg[targetKey] = atualizado;
    this.salvarRegistry(reg);
    return atualizado;
  },

  bloquearUsuario(chave: string, bloquear: boolean): boolean {
    const targetKey = this.findRegistryKey(chave);
    if (!targetKey) return false;
    const reg = this.getRegistry();
    const user = reg[targetKey];
    if (!user) return false;

    this.atualizarCamposUsuario(targetKey, {
      bloqueado: bloquear,
      status_cadastro: bloquear
        ? 'bloqueado'
        : user.email && !isFakeEmail(user.email)
        ? 'ativo'
        : 'primeiro_acesso',
    });
    return true;
  },

  removerUsuario(chave: string): boolean {
    const reg = this.getRegistry();
    const targetKey = this.findRegistryKey(chave);
    if (!targetKey || !reg[targetKey]) return false;
    delete reg[targetKey];
    this.salvarRegistry(reg);
    return true;
  },

  /**
   * Registra um usuário real que acabou de fazer login ou atualizar seu cadastro no site,
   * vinculando-o automaticamente a um candidato importado (por CPF ou Nome Completo) se existir.
   */
  vincularOuRegistrarUsuarioLogin(usuario: Usuario): Usuario {
    const reg = this.getRegistry();
    const entries = Object.entries(reg);

    const emailReal =
      usuario.email && !isFakeEmail(usuario.email) ? usuario.email.toLowerCase().trim() : '';
    const cpfLimpo = usuario.cpf ? limparCpf(usuario.cpf) : '';
    const nomeNorm = usuario.nome ? normalizarTexto(usuario.nome) : '';

    // 1. Verificar se já existe pelo e-mail real
    let matchEntry = emailReal
      ? entries.find(([_, u]) => u.email && u.email.toLowerCase().trim() === emailReal)
      : undefined;

    // 2. Verificar se existe candidato importado com o mesmo CPF
    let importedEntryByCpfOrName =
      cpfLimpo.length >= 9
        ? entries.find(([_, u]) => u.cpf && limparCpf(u.cpf) === cpfLimpo)
        : undefined;

    // 3. Verificar se existe candidato importado com o mesmo Nome Completo exato
    if (!importedEntryByCpfOrName && nomeNorm.length >= 5) {
      importedEntryByCpfOrName = entries.find(
        ([_, u]) => u.nome && normalizarTexto(u.nome) === nomeNorm
      );
    }

    // Se encontrou tanto um registro de login quanto um pré-cadastro importado separado, unificar!
    if (
      matchEntry &&
      importedEntryByCpfOrName &&
      matchEntry[0] !== importedEntryByCpfOrName[0]
    ) {
      const [loginKey, loginUser] = matchEntry;
      const [impKey, impUser] = importedEntryByCpfOrName;

      const inscricoesUnificadas = [...(impUser.concursos_inscritos || [])];
      (loginUser.concursos_inscritos || []).forEach((ins) => {
        if (
          !inscricoesUnificadas.some(
            (i) => i.concurso_id === ins.concurso_id && i.cargo_id === ins.cargo_id
          )
        ) {
          inscricoesUnificadas.push(ins);
        }
      });

      const unificado: Usuario = {
        ...impUser,
        ...loginUser,
        ...usuario,
        id: impUser.id || loginUser.id || loginKey,
        candidato_id: impUser.candidato_id || usuario.candidato_id || loginUser.candidato_id,
        email: emailReal || loginUser.email,
        cpf: usuario.cpf || impUser.cpf || loginUser.cpf || '',
        cpf_verificado: true,
        status_cadastro: 'ativo',
        concursos_inscritos: inscricoesUnificadas,
      };

      delete reg[loginKey];
      reg[impKey] = unificado;
      this.salvarRegistry(reg);
      return unificado;
    }

    const targetEntry = importedEntryByCpfOrName || matchEntry;

    if (targetEntry) {
      const [targetKey, existingUser] = targetEntry;
      const inscricoesUnificadas = [...(existingUser.concursos_inscritos || [])];
      (usuario.concursos_inscritos || []).forEach((ins) => {
        if (
          !inscricoesUnificadas.some(
            (i) => i.concurso_id === ins.concurso_id && i.cargo_id === ins.cargo_id
          )
        ) {
          inscricoesUnificadas.push(ins);
        }
      });

      const atualizado: Usuario = {
        ...existingUser,
        ...usuario,
        id: existingUser.id || usuario.id || targetKey,
        candidato_id: existingUser.candidato_id || usuario.candidato_id,
        email: emailReal || existingUser.email || '',
        cpf: usuario.cpf || existingUser.cpf || '',
        data_nascimento: usuario.data_nascimento || existingUser.data_nascimento || '',
        whatsapp: usuario.whatsapp || existingUser.whatsapp || '',
        telefone: usuario.telefone || usuario.whatsapp || existingUser.telefone || '',
        cpf_verificado: Boolean(usuario.cpf || existingUser.cpf_verificado),
        status_cadastro: existingUser.bloqueado ? 'bloqueado' : 'ativo',
        concursos_inscritos: inscricoesUnificadas,
        concursos_acompanhados:
          usuario.concursos_acompanhados || existingUser.concursos_acompanhados || [],
      };

      reg[targetKey] = atualizado;
      this.salvarRegistry(reg);
      return atualizado;
    }

    // Novo usuário que ainda não constava na lista: registrar como Ativo no Cadastro Geral
    const newId = usuario.id || `user-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 5)}`;
    const novoRegistro: Usuario = {
      ...usuario,
      id: newId,
      email: emailReal,
      email_contato: usuario.email_contato || emailReal,
      tipo_usuario: usuario.is_admin ? 'admin' : 'candidato',
      status_cadastro: 'ativo',
      candidato_id: usuario.candidato_id || newId,
    };

    reg[newId.toLowerCase()] = novoRegistro;
    this.salvarRegistry(reg);
    return novoRegistro;
  },

  /**
   * Verifica se um candidato (da lista de classificação ou lote) já possui um usuário real
   * cadastrado no site e vinculado a ele (Item 6 & Item 18).
   */
  verificarVinculoCandidato(cand: {
    id?: string;
    candidato_id?: string;
    cpf?: string;
    nome?: string;
    email?: string;
  }): { vinculado: boolean; usuario?: Usuario } {
    const all = this.getAllUsers();
    const cpfLimpo = cand.cpf ? limparCpf(cand.cpf) : '';
    const nomeNorm = cand.nome ? normalizarTexto(cand.nome) : '';
    const candId = cand.candidato_id || cand.id || '';

    const match = all.find((u) => {
      // Precisa ter feito o primeiro acesso (status_cadastro === 'ativo' e possuir e-mail real)
      const isAtivoComEmail = u.status_cadastro === 'ativo' && !isFakeEmail(u.email);
      if (!isAtivoComEmail) return false;

      if (candId && (u.candidato_id === candId || u.id === candId)) return true;
      if (cpfLimpo.length >= 9 && u.cpf && limparCpf(u.cpf) === cpfLimpo) return true;
      if (nomeNorm.length >= 4 && u.nome && normalizarTexto(u.nome) === nomeNorm) return true;
      if (cand.email && !isFakeEmail(cand.email) && u.email.toLowerCase() === cand.email.toLowerCase()) {
        return true;
      }
      return false;
    });

    return { vinculado: Boolean(match), usuario: match };
  },

  /**
   * Verifica se o candidato da planilha já existe por CPF ou Nome Completo.
   * Se não existir, cadastra como perfil vinculável (status: 'primeiro_acesso', sem e-mail aleatório).
   */
  cadastrarOuSincronizarCandidatoImportado(
    cand: Partial<Candidato>,
    concursoId?: string,
    cargoId?: string,
    orgaoNome?: string,
    cargoNome?: string
  ): { usuario: Usuario; jaExistia: boolean } {
    const reg = this.getRegistry();
    const entries = Object.entries(reg);

    const cpfLimpo = cand.cpf ? limparCpf(cand.cpf) : '';
    const nomeNorm = cand.nome ? normalizarTexto(cand.nome) : '';
    const realEmail =
      cand.email && !isFakeEmail(cand.email) ? cand.email.toLowerCase().trim() : '';

    // 1. Busca por CPF
    let matchEntry =
      cpfLimpo.length >= 7
        ? entries.find(([_, u]) => u.cpf && limparCpf(u.cpf) === cpfLimpo)
        : undefined;

    // 2. Busca por Nome Completo Exato
    if (!matchEntry && nomeNorm.length >= 3) {
      matchEntry = entries.find(([_, u]) => u.nome && normalizarTexto(u.nome) === nomeNorm);
    }

    if (matchEntry) {
      const [matchKey, match] = matchEntry;
      const inscricoes = [...(match.concursos_inscritos || [])];
      const jaInscrito = inscricoes.some(
        (i) => i.concurso_id === concursoId && i.cargo_id === cargoId
      );

      if (!jaInscrito && concursoId && cargoId) {
        inscricoes.push({
          concurso_id: concursoId,
          cargo_id: cargoId,
          data_inscricao: new Date().toLocaleDateString('pt-BR'),
        });
      }

      const atualizado: Usuario = {
        ...match,
        cpf: match.cpf || (cand.cpf ? cand.cpf.trim() : ''),
        candidato_id: match.candidato_id || cand.id,
        concurso_id: match.concurso_id || concursoId,
        cargo_id: match.cargo_id || cargoId,
        orgao: match.orgao || orgaoNome,
        cargo_nome: match.cargo_nome || cargoNome,
        concursos_inscritos: inscricoes,
      };

      reg[matchKey] = atualizado;
      this.salvarRegistry(reg);
      return { usuario: atualizado, jaExistia: true };
    }

    // Não existia: cria pré-cadastro vinculável SEM e-mail aleatório e com status "primeiro_acesso"
    const generatedId =
      cand.id ||
      `cand-pre-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;

    const novoPerfil: Usuario = {
      id: generatedId,
      nome: cand.nome ? cand.nome.trim() : 'Candidato Importado',
      email: realEmail, // Vazio até que o usuário faça o 1º acesso e vincule sua conta
      email_contato: realEmail,
      cpf: cand.cpf ? cand.cpf.trim() : '',
      cpf_verificado: Boolean(cand.cpf),
      whatsapp: cand.whatsapp || '',
      telefone: cand.whatsapp || '',
      is_admin: false,
      tipo_usuario: 'candidato',
      status_cadastro: 'primeiro_acesso',
      candidato_id: cand.id || generatedId,
      concurso_id: concursoId,
      cargo_id: cargoId,
      orgao: orgaoNome,
      cargo_nome: cargoNome,
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

    reg[generatedId.toLowerCase()] = novoPerfil;
    this.salvarRegistry(reg);
    return { usuario: novoPerfil, jaExistia: false };
  },
};
