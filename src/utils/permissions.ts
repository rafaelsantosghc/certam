import { Usuario } from '../types';

export const ADMIN_GLOBAL_EMAILS = ['rafasms0@hotmail.com'];

export const podeEditarConcurso = (
  usuario: Usuario | null,
  concursoId: string
): boolean => {
  if (!usuario) return false;
  if (usuario.is_admin) return true;
  if (usuario.email && ADMIN_GLOBAL_EMAILS.some((adm) => adm.toLowerCase() === usuario.email.toLowerCase())) {
    return true;
  }
  if (usuario.admin_concursos && usuario.admin_concursos.includes(concursoId)) {
    return true;
  }
  return false;
};

export const podeEditarCargo = (
  usuario: Usuario | null,
  concursoId: string,
  cargoId: string
): boolean => {
  if (!usuario) return false;
  if (podeEditarConcurso(usuario, concursoId)) return true;
  if (
    usuario.admin_cargos?.some(
      (c) => c.concurso_id === concursoId && c.cargo_id === cargoId
    )
  ) {
    return true;
  }
  return false;
};

export const podeEditarLote = (
  usuario: Usuario | null,
  concursoId: string,
  cargoId: string
): boolean => {
  return podeEditarCargo(usuario, concursoId, cargoId);
};
