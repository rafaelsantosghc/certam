import React, { createContext, useContext, useState, useEffect } from 'react';
import { Usuario } from '../types';

interface AuthContextType {
  usuario: Usuario | null;
  isAdmin: boolean;
  loginGoogle: () => void;
  loginAdminPreview: () => void;
  simularEmailCandidato: (email: string, nome: string) => void;
  atualizarDadosUsuario: (dados: Partial<Usuario>) => void;
  inscreverConcurso: (concursoId: string, cargoId: string) => void;
  desinscreverConcurso: (concursoId: string, cargoId: string) => void;
  logout: () => void;
}

const AUTH_STORAGE_KEY = 'certam_auth_user';

const AuthContext = createContext<AuthContextType>({
  usuario: null,
  isAdmin: false,
  loginGoogle: () => {},
  loginAdminPreview: () => {},
  simularEmailCandidato: () => {},
  atualizarDadosUsuario: () => {},
  inscreverConcurso: () => {},
  desinscreverConcurso: () => {},
  logout: () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [usuario, setUsuario] = useState<Usuario | null>(() => {
    try {
      const stored = localStorage.getItem(AUTH_STORAGE_KEY);
      if (stored) return JSON.parse(stored);
    } catch {
      // ignore
    }
    // Default to admin/candidate preview for immediate accessibility
    return {
      nome: 'Rafael Santos da Silva',
      email: 'rafasms0@hotmail.com',
      avatar: '',
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

  const loginAdminPreview = () => {
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
  };

  const simularEmailCandidato = (email: string, nome: string) => {
    const isAdminUser = email.toLowerCase() === 'rafasms0@hotmail.com';
    setUsuario((prev) => ({
      nome: nome || (prev?.nome ?? 'Candidato Participante'),
      email,
      is_admin: isAdminUser,
      candidato_id: prev?.candidato_id || 'cand-001',
      telefone: prev?.telefone || '',
      whatsapp: prev?.whatsapp || '',
      cpf: prev?.cpf || '',
      concursos_inscritos: prev?.concursos_inscritos || [
        {
          concurso_id: 'tjrs_2024',
          cargo_id: 'analista_judiciario',
          data_inscricao: '15/01/2025',
        },
      ],
    }));
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
        loginAdminPreview,
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
