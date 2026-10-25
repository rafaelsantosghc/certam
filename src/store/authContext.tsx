import React, { createContext, useContext, useState, useEffect } from 'react';
import { Usuario } from '../types';

interface AuthContextType {
  usuario: Usuario | null;
  isAdmin: boolean;
  loginGoogle: () => void;
  loginAdminPreview: () => void;
  simularEmailCandidato: (email: string, nome: string) => void;
  logout: () => void;
}

const AUTH_STORAGE_KEY = 'certam_auth_user';

const AuthContext = createContext<AuthContextType>({
  usuario: null,
  isAdmin: false,
  loginGoogle: () => {},
  loginAdminPreview: () => {},
  simularEmailCandidato: () => {},
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
    // Default to admin preview for immediate accessibility
    return {
      nome: 'Rafael Santos (Admin)',
      email: 'rafasms0@hotmail.com',
      avatar: '',
      is_admin: true,
      candidato_id: 'cand-001',
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
    // Authenticate candidate session
    const novoUsuario: Usuario = {
      nome: 'Candidato Homologado',
      email: 'candidato.tjrs@gmail.com',
      is_admin: false,
      candidato_id: 'cand-002',
    };
    setUsuario(novoUsuario);
  };

  const loginAdminPreview = () => {
    const adminUsuario: Usuario = {
      nome: 'Rafael Santos',
      email: 'rafasms0@hotmail.com',
      is_admin: true,
      candidato_id: 'cand-001',
    };
    setUsuario(adminUsuario);
  };

  const simularEmailCandidato = (email: string, nome: string) => {
    const isAdminUser = email.toLowerCase() === 'rafasms0@hotmail.com';
    setUsuario({
      nome: nome || 'Candidato Participante',
      email,
      is_admin: isAdminUser,
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
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
