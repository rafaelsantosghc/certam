import React, { createContext, useContext, useState, useEffect } from 'react';
import { Usuario } from '../types';
import { identificarCandidatoMaster, MASTER_CADASTRO_GERAL } from '../data/defaultCandidates';
import { userRegistryStore } from './userRegistryStore';
import { cloudSync } from './cloudSync';
import { isAiStudioPreview } from '../utils/environment';

interface AuthContextType {
  usuario: Usuario | null;
  isAdmin: boolean;
  loginGoogle: (email?: string, nome?: string, cpf?: string) => void;
  redirecionarGoogleOAuth: () => boolean;
  loginAdmin: (senha: string) => boolean;
  loginAdminPreview: () => void;
  alternarModoAdminPreview: () => void;
  loginCandidato: (email: string, nome?: string, cpf?: string) => void;
  simularEmailCandidato: (email: string, nome: string) => void;
  atualizarDadosUsuario: (dados: Partial<Usuario>) => void;
  marcarNotificacaoComoLida: (notifId: string) => void;
  marcarTodasNotificacoesComoLidas: (todasIds: string[]) => void;
  inscreverConcurso: (concursoId: string, cargoId: string) => void;
  desinscreverConcurso: (concursoId: string, cargoId: string) => void;
  acompanharConcurso: (concursoId: string) => void;
  desacompanharConcurso: (concursoId: string) => void;
  logout: () => void;
}

const AUTH_STORAGE_KEY = 'certam_auth_user_v8';
export const GOOGLE_CLIENT_ID_PADRAO = '893072513173-detf69cldt4cefhbg8ta3cpi5hb73rma.apps.googleusercontent.com';
export const ADMIN_EMAILS = ['rafasms0@hotmail.com'];

const AuthContext = createContext<AuthContextType>({
  usuario: null,
  isAdmin: false,
  loginGoogle: () => {},
  redirecionarGoogleOAuth: () => false,
  loginAdmin: () => false,
  loginAdminPreview: () => {},
  alternarModoAdminPreview: () => {},
  loginCandidato: () => {},
  simularEmailCandidato: () => {},
  atualizarDadosUsuario: () => {},
  marcarNotificacaoComoLida: () => {},
  marcarTodasNotificacoesComoLidas: () => {},
  inscreverConcurso: () => {},
  desinscreverConcurso: () => {},
  acompanharConcurso: () => {},
  desacompanharConcurso: () => {},
  logout: () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [usuario, setUsuario] = useState<Usuario | null>(() => {
    try {
      localStorage.removeItem('certam_auth_user');
      localStorage.removeItem('certam_auth_session');
      localStorage.removeItem('certam_auth_user_v3');
      localStorage.removeItem('certam_auth_user_v4');
      localStorage.removeItem('certam_auth_user_v5');
      localStorage.removeItem('certam_auth_user_v6');
      localStorage.removeItem('certam_auth_user_v7');

      const stored = localStorage.getItem(AUTH_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === 'object') {
          if (!isAiStudioPreview() && parsed.candidato_id === 'admin-preview-master') {
            localStorage.removeItem(AUTH_STORAGE_KEY);
            return null;
          }
          const isParsedAdmin = Boolean(
            parsed.is_admin ||
              parsed.role === 'admin' ||
              parsed.tipo_usuario === 'admin' ||
              ADMIN_EMAILS.some((adm) => adm.toLowerCase() === String(parsed.email || '').toLowerCase())
          );
          try {
            const fromRegistry =
              (parsed.id && userRegistryStore.getUserById(parsed.id)) ||
              (parsed.candidato_id && userRegistryStore.getUserById(parsed.candidato_id)) ||
              (parsed.email && userRegistryStore.getUserByEmail(parsed.email)) ||
              (parsed.cpf && userRegistryStore.getUserByCpf(parsed.cpf));
            if (fromRegistry) {
              const preserveAdmin = Boolean(
                isParsedAdmin ||
                  fromRegistry.is_admin ||
                  fromRegistry.role === 'admin' ||
                  ADMIN_EMAILS.some(
                    (adm) => adm.toLowerCase() === String(fromRegistry.email || '').toLowerCase()
                  )
              );
              return {
                ...parsed,
                ...fromRegistry,
                id: fromRegistry.id || parsed.id,
                cpf: fromRegistry.cpf || parsed.cpf,
                nome: fromRegistry.nome || parsed.nome,
                email: fromRegistry.email || parsed.email,
                data_nascimento: fromRegistry.data_nascimento || parsed.data_nascimento,
                whatsapp: fromRegistry.whatsapp || parsed.whatsapp,
                telefone: fromRegistry.telefone || parsed.telefone,
                email_contato: fromRegistry.email_contato || parsed.email_contato,
                status_cadastro: fromRegistry.status_cadastro || parsed.status_cadastro,
                is_admin: preserveAdmin,
                role: preserveAdmin ? 'admin' : fromRegistry.role || parsed.role || 'candidato',
                tipo_usuario: preserveAdmin
                  ? 'admin'
                  : fromRegistry.tipo_usuario || parsed.tipo_usuario || 'candidato',
                bloqueado: preserveAdmin ? false : Boolean(fromRegistry.bloqueado),
              };
            }
          } catch {
            // ignore
          }
          return {
            ...parsed,
            is_admin: isParsedAdmin,
            role: isParsedAdmin ? 'admin' : parsed.role || 'candidato',
            tipo_usuario: isParsedAdmin ? 'admin' : parsed.tipo_usuario || 'candidato',
          };
        }
      }
    } catch {
      // ignore
    }
    // Por padrão, visitante não logado
    return null;
  });

  // Inicializa sincronização com o servidor para compartilhar concursos, auditorias e cadastros entre sessões/navegadores (Itens 2, 5, 18)
  useEffect(() => {
    cloudSync.initAutoSync();
  }, []);

  useEffect(() => {
    try {
      if (usuario) {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(usuario));
        if (usuario.is_admin || usuario.email?.toLowerCase() === 'rafasms0@hotmail.com') {
          void cloudSync.pushAllLocal(true).then(() => cloudSync.pullFromServer());
        } else {
          void cloudSync.pullFromServer();
        }
      } else {
        localStorage.removeItem(AUTH_STORAGE_KEY);
        void cloudSync.pullFromServer();
      }
    } catch {
      // ignore
    }
  }, [usuario]);

  // Registra início de sessão e contabiliza tempo ativo acumulado do usuário para auditoria
  useEffect(() => {
    if (!usuario) return;
    const chaveUser = usuario.cpf || usuario.email || usuario.id;
    if (!chaveUser) return;

    const sessionStart = Date.now();
    let gravado = false;

    // Registra o acesso inicial caso ainda não haja acessos hoje
    userRegistryStore.registrarAcessoUsuario(chaveUser, 60);

    const interval = window.setInterval(() => {
      const segundosAtivos = Math.round((Date.now() - sessionStart) / 1000);
      if (segundosAtivos >= 60) {
        userRegistryStore.registrarAcessoUsuario(chaveUser, segundosAtivos);
      }
    }, 60000);

    const salvarAoSair = () => {
      if (gravado) return;
      gravado = true;
      const segundosAtivos = Math.round((Date.now() - sessionStart) / 1000);
      if (segundosAtivos >= 10) {
        userRegistryStore.registrarAcessoUsuario(chaveUser, segundosAtivos);
      }
    };

    window.addEventListener('beforeunload', salvarAoSair);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('beforeunload', salvarAoSair);
      salvarAoSair();
    };
  }, [usuario?.id, usuario?.cpf, usuario?.email]);

  // Processamento do retorno do Google OAuth (Implicit Flow com #access_token)
  useEffect(() => {
    try {
      const hash = window.location.hash;
      if (hash && hash.includes('access_token=')) {
        const params = new URLSearchParams(hash.replace(/^#/, ''));
        const token = params.get('access_token');
        if (token) {
          fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${token}` },
          })
            .then((res) => res.json())
            .then((googleUser) => {
              if (googleUser && (googleUser.email || googleUser.name)) {
                loginCandidato(googleUser.email, googleUser.name);
              }
              window.history.replaceState(null, '', window.location.pathname + window.location.search);
            })
            .catch((err) => {
              console.error('Falha ao obter perfil do Google:', err);
            });
        }
      }
    } catch {
      // ignore
    }
  }, []);

  // Redirecionamento oficial para o Google OAuth 2.0
  const redirecionarGoogleOAuth = (): boolean => {
    const clientId =
      (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID ||
      localStorage.getItem('certam_google_client_id') ||
      GOOGLE_CLIENT_ID_PADRAO;

    if (!clientId) return false;

    // Se a biblioteca oficial do Google Identity Services estiver pronta, prioriza
    const win = window as any;
    if (win.google?.accounts?.oauth2?.initTokenClient) {
      try {
        const client = win.google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: 'openid email profile',
          callback: (response: any) => {
            if (response?.access_token) {
              fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { Authorization: `Bearer ${response.access_token}` },
              })
                .then((res) => res.json())
                .then((googleUser) => {
                  if (googleUser && (googleUser.email || googleUser.name)) {
                    loginCandidato(googleUser.email, googleUser.name);
                  }
                })
                .catch((err) => console.error('Erro ao ler perfil do Google:', err));
            }
          },
        });
        client.requestAccessToken({ prompt: 'select_account' });
        return true;
      } catch (e) {
        console.warn('Fallback para redirecionamento HTTP Google OAuth:', e);
      }
    }

    const redirectUri = window.location.origin + window.location.pathname;
    const scope = encodeURIComponent('openid email profile');
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(
      clientId
    )}&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&response_type=token&scope=${scope}&prompt=select_account`;

    window.location.href = authUrl;
    return true;
  };

  // Login de candidato via Google
  const loginGoogle = (email?: string, nome?: string, cpf?: string) => {
    if (email) {
      loginCandidato(email, nome, cpf);
      return;
    }

    // Redirecionamento imediato para a tela oficial de autenticação do Google
    const redirecionou = redirecionarGoogleOAuth();
    if (!redirecionou) {
      window.dispatchEvent(new CustomEvent('certam_abrir_google_auth'));
    }
  };

  // Listener para aplicar imediatamente alterações aprovadas pelo administrador
  useEffect(() => {
    const handleAuditApproved = (e: any) => {
      const { req, mudancas } = e.detail || {};
      if (req && mudancas) {
        setUsuario((prev) => {
          if (!prev) return null;
          const prevCpf = prev.cpf ? prev.cpf.replace(/\D/g, '') : '';
          const reqCpf = req.cpf ? req.cpf.replace(/\D/g, '') : '';
          const isMatch =
            (req.usuario_id && (prev.id === req.usuario_id || prev.candidato_id === req.usuario_id)) ||
            (prev.email && req.usuario_email && prev.email.toLowerCase().trim() === req.usuario_email.toLowerCase().trim()) ||
            (prevCpf.length >= 7 && reqCpf.length >= 7 && prevCpf === reqCpf) ||
            (prev.nome && req.usuario_nome && prev.nome.trim().toLowerCase() === req.usuario_nome.trim().toLowerCase());
          if (isMatch) {
            const atualizado = { ...prev, ...mudancas };
            try {
              localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(atualizado));
            } catch {
              // ignore
            }
            return atualizado;
          }
          return prev;
        });
      }
    };
    window.addEventListener('certam_audit_approved', handleAuditApproved);
    return () => window.removeEventListener('certam_audit_approved', handleAuditApproved);
  }, []);

  // Listener em tempo real para sincronizar o perfil ativo quando qualquer edição cadastral for efetuada no painel admin
  useEffect(() => {
    const handleSyncFromRegistry = () => {
      setUsuario((prev) => {
        if (!prev) return null;
        const fromRegistry: Usuario | null | undefined =
          (prev.id ? userRegistryStore.getUserById(prev.id) : null) ||
          (prev.candidato_id ? userRegistryStore.getUserById(prev.candidato_id) : null) ||
          (prev.email ? userRegistryStore.getUserByEmail(prev.email) : null) ||
          (prev.cpf ? userRegistryStore.getUserByCpf(prev.cpf) : null);

        const preserveAdmin = Boolean(
          prev.is_admin ||
            prev.role === 'admin' ||
            prev.tipo_usuario === 'admin' ||
            fromRegistry?.is_admin ||
            fromRegistry?.role === 'admin' ||
            ADMIN_EMAILS.some(
              (adm) =>
                adm.toLowerCase() === String(fromRegistry?.email || prev.email || '').toLowerCase()
            )
        );

        if (
          fromRegistry &&
          (fromRegistry.nome !== prev.nome ||
            fromRegistry.cpf !== prev.cpf ||
            fromRegistry.whatsapp !== prev.whatsapp ||
            fromRegistry.telefone !== prev.telefone ||
            fromRegistry.email_contato !== prev.email_contato ||
            fromRegistry.status_cadastro !== prev.status_cadastro ||
            Boolean(fromRegistry.bloqueado) !== Boolean(prev.bloqueado) ||
            Boolean(prev.is_admin) !== preserveAdmin)
        ) {
          const atualizado: Usuario = {
            ...prev,
            ...fromRegistry,
            nome: fromRegistry.nome || prev.nome,
            cpf: fromRegistry.cpf || prev.cpf,
            email: fromRegistry.email || prev.email,
            email_contato: fromRegistry.email_contato || prev.email_contato,
            whatsapp: fromRegistry.whatsapp || prev.whatsapp,
            telefone: fromRegistry.telefone || prev.telefone,
            status_cadastro: fromRegistry.status_cadastro || prev.status_cadastro,
            is_admin: preserveAdmin,
            role: preserveAdmin ? 'admin' : fromRegistry.role || prev.role || 'candidato',
            tipo_usuario: preserveAdmin
              ? 'admin'
              : fromRegistry.tipo_usuario || prev.tipo_usuario || 'candidato',
            bloqueado: preserveAdmin ? false : Boolean(fromRegistry.bloqueado),
          };
          try {
            localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(atualizado));
          } catch {
            // ignore
          }
          return atualizado;
        }
        return prev;
      });
    };

    const handleProfileDirectUpdate = (e: any) => {
      const updated = e.detail;
      if (!updated) return;
      setUsuario((prev) => {
        if (!prev) return null;
        const prevCpf = prev.cpf ? prev.cpf.replace(/\D/g, '') : '';
        const updCpf = updated.cpf ? updated.cpf.replace(/\D/g, '') : '';
        const isMatch =
          (prev.id && updated.id && prev.id === updated.id) ||
          (prev.candidato_id && updated.candidato_id && prev.candidato_id === updated.candidato_id) ||
          (prev.email && updated.email && prev.email.toLowerCase().trim() === updated.email.toLowerCase().trim()) ||
          (prevCpf.length >= 7 && updCpf.length >= 7 && prevCpf === updCpf);

        if (isMatch) {
          const preserveAdmin = Boolean(
            prev.is_admin ||
              updated.is_admin ||
              prev.role === 'admin' ||
              updated.role === 'admin' ||
              ADMIN_EMAILS.some(
                (adm) =>
                  adm.toLowerCase() === String(updated.email || prev.email || '').toLowerCase()
              )
          );
          const atualizado: Usuario = {
            ...prev,
            ...updated,
            nome: updated.nome || prev.nome,
            is_admin: preserveAdmin,
            role: preserveAdmin ? 'admin' : updated.role || prev.role || 'candidato',
            tipo_usuario: preserveAdmin
              ? 'admin'
              : updated.tipo_usuario || prev.tipo_usuario || 'candidato',
          };
          try {
            localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(atualizado));
          } catch {
            // ignore
          }
          return atualizado;
        }
        return prev;
      });
    };

    window.addEventListener('certam_users_updated', handleSyncFromRegistry);
    window.addEventListener('certam_registry_updated', handleSyncFromRegistry);
    window.addEventListener('certam_profile_updated', handleProfileDirectUpdate);
    window.addEventListener('certam_user_profile_updated', handleProfileDirectUpdate);
    window.addEventListener('storage', handleSyncFromRegistry);
    return () => {
      window.removeEventListener('certam_users_updated', handleSyncFromRegistry);
      window.removeEventListener('certam_registry_updated', handleSyncFromRegistry);
      window.removeEventListener('certam_profile_updated', handleProfileDirectUpdate);
      window.removeEventListener('certam_user_profile_updated', handleProfileDirectUpdate);
      window.removeEventListener('storage', handleSyncFromRegistry);
    };
  }, []);

  // Login administrativo exclusivo para e-mails homologados como administradores
  const loginAdmin = (_senha?: string): boolean => {
    if (usuario && ADMIN_EMAILS.some((adm) => adm.toLowerCase() === usuario.email?.toLowerCase())) {
      setUsuario((prev) => (prev ? { ...prev, is_admin: true } : null));
      return true;
    }
    return false;
  };

  const loginAdminPreview = () => {
    // Bloqueio rigoroso: nunca funciona fora do preview do Google AI Studio
    if (!isAiStudioPreview()) {
      return;
    }

    const adminUser: Usuario = {
      nome: 'Rafael Administrador',
      email: 'rafasms0@hotmail.com',
      email_contato: 'rafasms0@hotmail.com',
      is_admin: true,
      tipo_usuario: 'admin',
      status_cadastro: 'ativo',
      candidato_id: 'admin-preview-master',
      cpf: '000.000.000-00',
      cpf_verificado: true,
      data_nascimento: '01/01/1990',
      telefone: '(51) 99999-9999',
      whatsapp: '(51) 99999-9999',
      read_notification_ids: [],
      outros_concursos: [],
      concursos_inscritos: [],
    };
    setUsuario(adminUser);
    try {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(adminUser));
    } catch {
      // ignore
    }
    userRegistryStore.vincularOuRegistrarUsuarioLogin(adminUser);
  };

  const alternarModoAdminPreview = () => {
    // Bloqueio rigoroso: nunca funciona fora do preview do Google AI Studio
    if (!isAiStudioPreview()) {
      return;
    }

    if (usuario && usuario.is_admin) {
      setUsuario(null);
      try {
        localStorage.removeItem(AUTH_STORAGE_KEY);
      } catch {
        // ignore
      }
    } else {
      loginAdminPreview();
    }
  };

  const loginCandidato = (email: string, nome?: string, cpf?: string) => {
    const emailLimpo = email.trim().toLowerCase();
    const existingInRegistry =
      userRegistryStore.getUserByEmail(emailLimpo) ||
      (cpf ? userRegistryStore.getUserByCpf(cpf) : null);

    const matchEmail = MASTER_CADASTRO_GERAL.find((c) => c.email?.toLowerCase() === emailLimpo);
    const nomeLimpo =
      existingInRegistry?.nome ||
      nome?.trim() ||
      matchEmail?.nome ||
      emailLimpo.split('@')[0];

    const match =
      (cpf ? identificarCandidatoMaster(nomeLimpo, cpf) : null) ||
      matchEmail;

    const isAdminUser = ADMIN_EMAILS.some((adm) => adm.toLowerCase() === emailLimpo);

    const baseCandidato: Usuario = {
      ...(existingInRegistry || {}),
      nome: existingInRegistry?.nome || (match ? match.nome : nomeLimpo),
      email: emailLimpo,
      email_contato: existingInRegistry?.email_contato || match?.email || emailLimpo,
      is_admin: isAdminUser,
      tipo_usuario: isAdminUser ? 'admin' : (existingInRegistry?.tipo_usuario || 'candidato'),
      status_cadastro: existingInRegistry?.status_cadastro || 'ativo',
      candidato_id: existingInRegistry?.candidato_id || (match ? match.id : `cand-${Date.now().toString(36)}`),
      cpf: existingInRegistry?.cpf || cpf || match?.cpf || '',
      cpf_verificado: Boolean(existingInRegistry?.cpf_verificado || existingInRegistry?.cpf || match?.cpf),
      data_nascimento: existingInRegistry?.data_nascimento || match?.data_nascimento || '',
      telefone: existingInRegistry?.telefone || match?.whatsapp || '',
      whatsapp: existingInRegistry?.whatsapp || match?.whatsapp || '',
      read_notification_ids: existingInRegistry?.read_notification_ids || [],
      outros_concursos: existingInRegistry?.outros_concursos || [],
      concursos_inscritos:
        existingInRegistry?.concursos_inscritos ||
        (match?.concurso_id && match?.cargo_id
          ? [
              {
                concurso_id: match.concurso_id,
                cargo_id: match.cargo_id,
                data_inscricao: new Date().toLocaleDateString('pt-BR'),
              },
            ]
          : []),
    };

    // Se já possuir CPF ou já estiver no Cadastro Geral, vincula normalmente;
    // se for o 1º acesso sem CPF, mantém em sessão e abre o modal obrigatório de Nome e CPF
    if (baseCandidato.cpf && baseCandidato.cpf.replace(/\D/g, '').length >= 9) {
      const vinculado = userRegistryStore.vincularOuRegistrarUsuarioLogin(baseCandidato);
      setUsuario(vinculado);
    } else {
      setUsuario(baseCandidato);
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('certam_abrir_perfil_candidato_obrigatorio'));
      }, 200);
    }
  };

  const simularEmailCandidato = (email: string, nome: string) => {
    loginCandidato(email, nome);
  };

  const atualizarDadosUsuario = (dados: Partial<Usuario>) => {
    let paraSalvar: Usuario | null = null;
    setUsuario((prev) => {
      if (!prev) return null;
      const atualizado: Usuario = {
        ...prev,
        ...dados,
        nome: dados.nome !== undefined ? dados.nome : prev.nome,
        cpf: dados.cpf !== undefined ? dados.cpf : prev.cpf,
        status_cadastro: 'ativo',
      };
      paraSalvar = atualizado;
      return atualizado;
    });
    if (paraSalvar) {
      const salvo = userRegistryStore.salvarUsuario(paraSalvar);
      if (salvo) {
        setUsuario(salvo);
      }
    }
  };

  // Leitura de Notificações
  const marcarNotificacaoComoLida = (notifId: string) => {
    let paraSalvar: Usuario | null = null;
    setUsuario((prev) => {
      if (!prev) return null;
      const ids = prev.read_notification_ids || [];
      if (ids.includes(notifId)) return prev;
      const atualizado: Usuario = {
        ...prev,
        read_notification_ids: [...ids, notifId],
      };
      paraSalvar = atualizado;
      return atualizado;
    });
    if (paraSalvar) {
      const salvo = userRegistryStore.salvarUsuario(paraSalvar);
      if (salvo) {
        setUsuario(salvo);
      }
    }
  };

  const marcarTodasNotificacoesComoLidas = (todasIds: string[]) => {
    let paraSalvar: Usuario | null = null;
    setUsuario((prev) => {
      if (!prev) return null;
      const set = new Set([...(prev.read_notification_ids || []), ...todasIds]);
      const atualizado: Usuario = {
        ...prev,
        read_notification_ids: Array.from(set),
      };
      paraSalvar = atualizado;
      return atualizado;
    });
    if (paraSalvar) {
      const salvo = userRegistryStore.salvarUsuario(paraSalvar);
      if (salvo) {
        setUsuario(salvo);
      }
    }
  };

  const inscreverConcurso = (concursoId: string, cargoId: string) => {
    let paraSalvar: Usuario | null = null;
    setUsuario((prev) => {
      if (!prev) return null;
      const inscritos = prev.concursos_inscritos || [];
      const jaInscrito = inscritos.some((i) => i.concurso_id === concursoId && i.cargo_id === cargoId);
      if (jaInscrito) return prev;
      const atualizado: Usuario = {
        ...prev,
        concursos_inscritos: [
          ...inscritos,
          {
            concurso_id: concursoId,
            cargo_id: cargoId,
            data_inscricao: new Date().toLocaleDateString('pt-BR'),
          },
        ],
      };
      paraSalvar = atualizado;
      return atualizado;
    });
    if (paraSalvar) {
      userRegistryStore.salvarUsuario(paraSalvar);
    }
  };

  const desinscreverConcurso = (concursoId: string, cargoId: string) => {
    let paraSalvar: Usuario | null = null;
    setUsuario((prev) => {
      if (!prev) return null;
      const inscritos = (prev.concursos_inscritos || []).filter(
        (i) => !(i.concurso_id === concursoId && i.cargo_id === cargoId)
      );
      const atualizado: Usuario = {
        ...prev,
        concursos_inscritos: inscritos,
      };
      paraSalvar = atualizado;
      return atualizado;
    });
    if (paraSalvar) {
      userRegistryStore.salvarUsuario(paraSalvar);
    }
  };

  const acompanharConcurso = (concursoId: string) => {
    let paraSalvar: Usuario | null = null;
    setUsuario((prev) => {
      if (!prev) return null;
      const acompanhados = new Set(prev.concursos_acompanhados || []);
      acompanhados.add(concursoId);
      const atualizado: Usuario = {
        ...prev,
        concursos_acompanhados: Array.from(acompanhados),
      };
      paraSalvar = atualizado;
      return atualizado;
    });
    if (paraSalvar) {
      userRegistryStore.salvarUsuario(paraSalvar);
    }
  };

  const desacompanharConcurso = (concursoId: string) => {
    let paraSalvar: Usuario | null = null;
    setUsuario((prev) => {
      if (!prev) return null;
      const acompanhados = (prev.concursos_acompanhados || []).filter((id) => id !== concursoId);
      const atualizado: Usuario = {
        ...prev,
        concursos_acompanhados: acompanhados,
      };
      paraSalvar = atualizado;
      return atualizado;
    });
    if (paraSalvar) {
      userRegistryStore.salvarUsuario(paraSalvar);
    }
  };

  const logout = () => {
    setUsuario(null);
  };

  return (
    <AuthContext.Provider
      value={{
        usuario,
        isAdmin: Boolean(
          usuario?.is_admin ||
            usuario?.role === 'admin' ||
            usuario?.tipo_usuario === 'admin' ||
            (usuario?.email &&
              ADMIN_EMAILS.some((adm) => adm.toLowerCase() === usuario.email.toLowerCase()))
        ),
        loginGoogle,
        redirecionarGoogleOAuth,
        loginAdmin,
        loginAdminPreview,
        alternarModoAdminPreview,
        loginCandidato,
        simularEmailCandidato,
        atualizarDadosUsuario,
        marcarNotificacaoComoLida,
        marcarTodasNotificacoesComoLidas,
        inscreverConcurso,
        desinscreverConcurso,
        acompanharConcurso,
        desacompanharConcurso,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
