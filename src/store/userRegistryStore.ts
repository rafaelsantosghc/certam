import { Usuario } from '../types';

const REGISTRY_STORAGE_KEY = 'certam_users_registry_v1';

export const userRegistryStore = {
  getRegistry(): Record<string, Usuario> {
    try {
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

  salvarUsuario(usuario: Usuario) {
    if (!usuario || !usuario.email) return;
    const emailKey = usuario.email.toLowerCase().trim();
    const reg = this.getRegistry();
    reg[emailKey] = {
      ...usuario,
      email: emailKey,
    };
    this.salvarRegistry(reg);
  },

  atualizarCamposUsuario(email: string, campos: Partial<Usuario>): Usuario | null {
    if (!email) return null;
    const emailKey = email.toLowerCase().trim();
    const reg = this.getRegistry();
    const existente = reg[emailKey];
    if (!existente) return null;

    const atualizado = {
      ...existente,
      ...campos,
      email: emailKey,
    };
    reg[emailKey] = atualizado;
    this.salvarRegistry(reg);
    return atualizado;
  },
};
