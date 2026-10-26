import React, { createContext, useContext, useState, useEffect } from 'react';
import { Usuario } from '../types';
import { identificarCandidatoMaster } from '../data/defaultCandidates';

interface AuthContextType {
  usuario: Usuario | null;
  isAdmin: boolean;
  loginGoogle: () => void;
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

const AUTH_STORAGE_KEY = 'certam_auth_user_v4';

const AuthContext = createContext<AuthContextType>({
  usuario: null,
  isAdmin: false,
  loginGoogle: () => {},
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
    // IMPORTANTE: Por padrão, nenhum visitante começa logado como administrador
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

  // Login de candidato via Google
  const loginGoogle = () => {
    const nomePadrao = 'Mariana Duarte Becker';
    const cpfPadrao = '812.300.450-11';
    const match = identificarCandidatoMaster(nomePadrao, cpfPadrao);

    const novoUsuario: Usuario = {
      nome: nomePadrao,
      email: 'mariana.becker@gmail.com',
      email_contato: 'mariana.becker@gmail.com',
      is_admin: false,
      candidato_id: match ? match.id : 'cand-002',
      cpf: cpfPadrao,
      cpf_verificado: !!match,
      data_nascimento: '1994-08-20',
      telefone: '(51) 98122-4455',
      whatsapp: '(51) 98122-4455',
      read_notification_ids: [],
      outros_concursos: [
        {
          concurso_nome: 'TJRS 2024',
          ano: '2024',
          cargo: 'Analista Judiciário - Área Judiciária',
          classificacao: 2,
        },
      ],
      concursos_inscritos: [
        {
          concurso_id: 'tjrs_2024',
          cargo_id: 'analista_judiciario',
          data_inscricao: '12/01/2025',
        },
      ],
    };
    setUsuario(novoUsuario);
  };

  // Login administrativo protegido por senha
  const loginAdmin = (senha: string): boolean => {
    const senhasValidas = ['admin', 'certam2025', 'admin123', 'tjrs2024'];
    if (senhasValidas.includes(senha.trim())) {
      const adminUsuario: Usuario = {
        nome: 'Rafael Santos da Silva',
        email: 'rafasms0@hotmail.com',
        email_contato: 'rafasms0@hotmail.com',
        is_admin: true,
        candidato_id: 'cand-001',
        cpf: '012.345.670-89',
        cpf_verificado: true,
        data_nascimento: '1992-04-15',
        telefone: '(51) 99872-3341',
        whatsapp: '(51) 99872-3341',
        read_notification_ids: [],
        outros_concursos: [
          {
            concurso_nome: 'TJRS 2024',
            ano: '2024',
            cargo: 'Analista Judiciário - Área Judiciária',
            classificacao: 1,
          },
        ],
        concursos_inscritos: [
          {
            concurso_id: 'tjrs_2024',
            cargo_id: 'analista_judiciario',
            data_inscricao: '10/01/2025',
          },
        ],
      };
      setUsuario(adminUsuario);
      return true;
    }
    return false;
  };

  const loginAdminPreview = () => {
    loginAdmin('certam2025');
  };

  // Login de candidato com e-mail/dados próprios
  const loginCandidato = (email: string, nome?: string, cpf?: string) => {
    const emailLimpo = email.trim().toLowerCase();
    const nomeLimpo = nome?.trim() || emailLimpo.split('@')[0];
    const match = identificarCandidatoMaster(nomeLimpo, cpf);

    const novoCandidato: Usuario = {
      nome: nomeLimpo,
      email: emailLimpo,
      email_contato: emailLimpo,
      is_admin: false,
      candidato_id: match ? match.id : `cand-${Date.now().toString(36)}`,
      cpf: cpf || '',
      cpf_verificado: !!match,
      data_nascimento: match?.data_nascimento || '',
      telefone: match?.whatsapp || '',
      whatsapp: match?.whatsapp || '',
      read_notification_ids: [],
      outros_concursos: match
        ? [
            {
              concurso_nome: match.concurso_id === 'mprs_2024' ? 'MPRS 2024' : 'TJRS 2024',
              ano: '2024',
              cargo: match.cargo_id || 'Concursado',
              classificacao: match.posicao,
            },
          ]
        : [],
      concursos_inscritos: [
        {
          concurso_id: match?.concurso_id || 'tjrs_2024',
          cargo_id: match?.cargo_id || 'analista_judiciario',
          data_inscricao: new Date().toLocaleDateString('pt-BR'),
        },
      ],
    };
    setUsuario(novoCandidato);
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
