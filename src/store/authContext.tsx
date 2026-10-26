import React, { createContext, useContext, useState, useEffect } from 'react';
import { Usuario } from '../types';

interface AuthContextType {
  usuario: Usuario | null;
  isAdmin: boolean;
  loginGoogle: () => void;
  loginAdmin: (senha: string) => boolean;
  loginAdminPreview: () => void;
  loginCandidato: (email: string, nome?: string) => void;
  simularEmailCandidato: (email: string, nome: string) => void;
  atualizarDadosUsuario: (dados: Partial<Usuario>) => void;
  inscreverConcurso: (concursoId: string, cargoId: string) => void;
  desinscreverConcurso: (concursoId: string, cargoId: string) => void;
  logout: () => void;
}

const AUTH_STORAGE_KEY = 'certam_auth_user_v3';

const AuthContext = createContext<AuthContextType>({
  usuario: null,
  isAdmin: false,
  loginGoogle: () => {},
  loginAdmin: () => false,
  loginAdminPreview: () => {},
  loginCandidato: () => {},
  simularEmailCandidato: () => {},
  atualizarDadosUsuario: () => {},
  inscreverConcurso: () => {},
  desinscreverConcurso: () => {},
  logout: () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [usuario, setUsuario] = useState<Usuario | null>(() => {
    try {
      // Limpeza imediata de versoes legadas do localStorage que gravavam admin para todos os visitantes
      localStorage.removeItem('certam_auth_user');
      localStorage.removeItem('certam_auth_session');

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
    // IMPORTANTE: Por padrao, nenhum candidato ou visitante comeca logado como administrador
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

  // Login de candidato via Google (nunca e admin por padrao)
  const loginGoogle = () => {
    const novoUsuario: Usuario = {
      nome: 'Mariana Duarte Becker',
      email: 'mariana.becker@gmail.com',
      is_admin: false,
      candidato_id: 'cand-002',
      telefone: '(51) 98122-4455',
      whatsapp: '(51) 98122-4455',
      cpf: '***.812.300-**',
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
        is_admin: true,
        candidato_id: 'cand-001',
        telefone: '(51) 99872-3341',
        whatsapp: '(51) 99872-3341',
        cpf: '***.451.980-**',
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

  // Login de candidato com e-mail proprio (SEMPRE is_admin: false)
  const loginCandidato = (email: string, nome?: string) => {
    const emailLimpo = email.trim().toLowerCase();
    const nomeLimpo = nome?.trim() || emailLimpo.split('@')[0];

    const novoCandidato: Usuario = {
      nome: nomeLimpo,
      email: emailLimpo,
      is_admin: false,
      candidato_id: `cand-${Date.now().toString(36)}`,
      telefone: '',
      whatsapp: '',
      cpf: '',
      concursos_inscritos: [
        {
          concurso_id: 'tjrs_2024',
          cargo_id: 'analista_judiciario',
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
      return { ...prev, ...dados };
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
