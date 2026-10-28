import React, { createContext, useContext, useState, useEffect } from 'react';
import { Usuario } from '../types';
import { identificarCandidatoMaster, MASTER_CADASTRO_GERAL } from '../data/defaultCandidates';
import { userRegistryStore } from './userRegistryStore';

interface AuthContextType {
  usuario: Usuario | null;
  isAdmin: boolean;
  loginGoogle: (email?: string, nome?: string, cpf?: string) => void;
  redirecionarGoogleOAuth: () => boolean;
  loginAdmin: (senha: string) => boolean;
  loginAdminPreview: () => void;
  loginCandidato: (email: string, nome?: string, cpf?: string) => void;
  simularEmailCandidato: (email: string, nome: string) => void;
  atualizarDadosUsuario: (dados: Partial<Usuario>) => void;
  marcarNotificacaoComoLida: (notifId: string) => void;
  marcarTodasNotificacoesComoLidas: (todasIds: string[]) => void;
  inscreverConcurso: (concursoId: string, cargoId: string) => void;
  desinscreverConcurso: (concursoId: string, cargoId: string) => void;
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
  loginCandidato: () => {},
  simularEmailCandidato: () => {},
  atualizarDadosUsuario: () => {},
  marcarNotificacaoComoLida: () => {},
  marcarTodasNotificacoesComoLidas: () => {},
  inscreverConcurso: () => {},
  desinscreverConcurso: () => {},
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
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    // Por padrão, visitante não logado
    return null;
  });

  useEffect(() => {
    try {
      if (usuario) {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(usuario));
      } else {
        localStorage.removeItem(AUTH_STORAGE_KEY);
      }
    } catch {
      // ignore
    }
  }, [usuario]);

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
          const isMatch =
            (prev.email && prev.email.toLowerCase() === req.usuario_email.toLowerCase()) ||
            (prev.cpf && req.cpf && prev.cpf.replace(/\D/g, '') === req.cpf.replace(/\D/g, ''));
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

  // Login administrativo exclusivo para e-mails homologados como administradores
  const loginAdmin = (_senha?: string): boolean => {
    if (usuario && ADMIN_EMAILS.some((adm) => adm.toLowerCase() === usuario.email?.toLowerCase())) {
      setUsuario((prev) => (prev ? { ...prev, is_admin: true } : null));
      return true;
    }
    return false;
  };

  const loginAdminPreview = () => {
    // Acesso direto concedido se o usuário for o administrador oficial
    if (usuario && ADMIN_EMAILS.some((adm) => adm.toLowerCase() === usuario.email?.toLowerCase())) {
      setUsuario((prev) => (prev ? { ...prev, is_admin: true } : null));
    }
  };

  // Login de candidato com e-mail/dados próprios via Google
  const loginCandidato = (email: string, nome?: string, cpf?: string) => {
    const emailLimpo = email.trim().toLowerCase();
    const matchEmail = MASTER_CADASTRO_GERAL.find((c) => c.email?.toLowerCase() === emailLimpo);
    const nomeLimpo = nome?.trim() || matchEmail?.nome || emailLimpo.split('@')[0];
    const match =
      (cpf ? identificarCandidatoMaster(nomeLimpo, cpf) : null) ||
      matchEmail ||
      identificarCandidatoMaster(nomeLimpo);

    const isAdminUser = ADMIN_EMAILS.some((adm) => adm.toLowerCase() === emailLimpo);

    const novoCandidato: Usuario = {
      nome: match ? match.nome : nomeLimpo,
      email: emailLimpo,
      email_contato: match?.email || emailLimpo,
      is_admin: isAdminUser,
      candidato_id: match ? match.id : `cand-${Date.now().toString(36)}`,
      cpf: cpf || match?.cpf || '',
      cpf_verificado: !!match,
      data_nascimento: match?.data_nascimento || '',
      telefone: match?.whatsapp || '',
      whatsapp: match?.whatsapp || '',
      read_notification_ids: [],
      outros_concursos: [],
      concursos_inscritos: match?.concurso_id && match?.cargo_id
        ? [
            {
              concurso_id: match.concurso_id,
              cargo_id: match.cargo_id,
              data_inscricao: new Date().toLocaleDateString('pt-BR'),
            },
          ]
        : [],
    };
    setUsuario(novoCandidato);

    // Se o candidato ainda não possui CPF ou data de nascimento, obriga preenchimento cadastral
    if (!novoCandidato.cpf || !novoCandidato.data_nascimento) {
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('certam_abrir_perfil_candidato_obrigatorio'));
      }, 350);
    }
  };

  const simularEmailCandidato = (email: string, nome: string) => {
    loginCandidato(email, nome);
  };

  const atualizarDadosUsuario = (dados: Partial<Usuario>) => {
    setUsuario((prev) => {
      if (!prev) return null;
      const atualizado = { ...prev, ...dados };
      // Se alterou nome ou CPF, re-cruzar no cadastro master
      if (dados.nome || dados.cpf) {
        const match = identificarCandidatoMaster(atualizado.nome, atualizado.cpf);
        if (match) {
          atualizado.candidato_id = match.id;
          atualizado.cpf_verificado = true;
        }
      }
      return atualizado;
    });
  };

  // Leitura de Notificações
  const marcarNotificacaoComoLida = (notifId: string) => {
    setUsuario((prev) => {
      if (!prev) return null;
      const ids = prev.read_notification_ids || [];
      if (ids.includes(notifId)) return prev;
      return {
        ...prev,
        read_notification_ids: [...ids, notifId],
      };
    });
  };

  const marcarTodasNotificacoesComoLidas = (todasIds: string[]) => {
    setUsuario((prev) => {
      if (!prev) return null;
      const set = new Set([...(prev.read_notification_ids || []), ...todasIds]);
      return {
        ...prev,
        read_notification_ids: Array.from(set),
      };
    });
  };

  const inscreverConcurso = (concursoId: string, cargoId: string) => {
    setUsuario((prev) => {
      if (!prev) return null;
      const inscritos = prev.concursos_inscritos || [];
      const jaInscrito = inscritos.some((i) => i.concurso_id === concursoId && i.cargo_id === cargoId);
      if (jaInscrito) return prev;
      return {
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
    });
  };

  const desinscreverConcurso = (concursoId: string, cargoId: string) => {
    setUsuario((prev) => {
      if (!prev) return null;
      const inscritos = (prev.concursos_inscritos || []).filter(
        (i) => !(i.concurso_id === concursoId && i.cargo_id === cargoId)
      );
      return {
        ...prev,
        concursos_inscritos: inscritos,
      };
    });
  };

  const logout = () => {
    setUsuario(null);
  };

  return (
    <AuthContext.Provider
      value={{
        usuario,
        isAdmin: !!usuario?.is_admin,
        loginGoogle,
        redirecionarGoogleOAuth,
        loginAdmin,
        loginAdminPreview,
        loginCandidato,
        simularEmailCandidato,
        atualizarDadosUsuario,
        marcarNotificacaoComoLida,
        marcarTodasNotificacoesComoLidas,
        inscreverConcurso,
        desinscreverConcurso,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
