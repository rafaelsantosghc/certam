import { useMemo, useCallback } from 'react';
import { Concurso, Usuario, Candidato } from '../types';
import {
  chatStore,
  SalaChatConcurso,
  verificarUsuarioConvocadoNoLote,
} from '../store/chatStore';
import { lotesStore } from '../store/lotesStore';
import { limparCpf } from '../data/defaultCandidates';
import { podeEditarCargo, podeEditarLote } from '../utils/permissions';

export interface ValidacaoCargoAprovado {
  cargoId: string;
  cargoNome: string;
  aprovado: boolean;
  candidato: Candidato | null;
  lotesPermitidosIds: Set<string>;
}

export interface CategoriaChatLateral {
  id: 'geral' | 'cargo' | 'aprovados' | 'lote';
  titulo: string;
  descricaoCurta: string;
  salas: SalaChatConcurso[];
}

export interface SalasPorCategoriaChat {
  geral: SalaChatConcurso[];
  cargo: SalaChatConcurso[];
  aprovados: SalaChatConcurso[];
  lote: SalaChatConcurso[];
}

export interface UseChatPermissionsResult {
  isUserAdmin: boolean;
  isAprovadoNoConcurso: boolean;
  aprovacoesPorCargo: Record<string, ValidacaoCargoAprovado>;
  isAprovadoNoCargo: (cargoId: string) => boolean;
  isConvocadoNoLote: (cargoId: string, loteId?: string) => boolean;
  podeRenderizarSala: (sala: SalaChatConcurso) => boolean;
  salasPermitidas: SalaChatConcurso[];
  salasPorCategoria: SalasPorCategoriaChat;
  categoriasVisiveis: CategoriaChatLateral[];
  todasSalas: SalaChatConcurso[];
}

/**
 * Valida estritamente se `usuario.id` (ou `usuario.candidato_id`) ou `usuario.cpf`
 * está presente na lista de aprovados (`Candidato[]`) do cargo/concurso específico.
 */
export function validarUsuarioNaListaDeAprovados(
  usuario: Usuario | null | undefined,
  candidatos: Candidato[]
): Candidato | null {
  if (!usuario || !Array.isArray(candidatos) || candidatos.length === 0) {
    return null;
  }

  const userIdStr = String(usuario.id || '').trim();
  const userCandidatoIdStr = String(usuario.candidato_id || '').trim();
  const cpfUsuarioLimpo = limparCpf(usuario.cpf);
  const cpfValido = cpfUsuarioLimpo.length >= 9 && !/^0+$/.test(cpfUsuarioLimpo);

  return (
    candidatos.find((cand) => {
      if (!cand) return false;
      const candIdStr = String(cand.id || '').trim();

      // 1. Validação por ID do usuário ou candidato_id vinculado
      if (candIdStr) {
        if (userIdStr && candIdStr === userIdStr) return true;
        if (userCandidatoIdStr && candIdStr === userCandidatoIdStr) return true;
      }

      // 2. Validação por CPF (dígitos numéricos limpos)
      if (cpfValido && cand.cpf) {
        const cpfCandLimpo = limparCpf(cand.cpf);
        if (cpfCandLimpo.length >= 9 && cpfCandLimpo === cpfUsuarioLimpo) {
          return true;
        }
      }

      return false;
    }) || null
  );
}

/**
 * Hook `useChatPermissions`:
 * Valida se `usuario.id` ou `usuario.cpf` está presente na lista de aprovados
 * do concurso específico antes de permitir/renderizar o Chat dos Aprovados e o Chat do Lote,
 * e agrupa dinamicamente os chats visíveis por categoria (Geral, Cargo, Aprovados, Lotes).
 */
export function useChatPermissions(
  concurso: Concurso | null | undefined,
  usuario: Usuario | null | undefined,
  isAdmin: boolean = false,
  dadosVersion: number = 0
): UseChatPermissionsResult {
  const isUserAdmin = useMemo(() => {
    return Boolean(
      isAdmin ||
        usuario?.is_admin ||
        usuario?.role === 'admin' ||
        usuario?.tipo_usuario === 'admin' ||
        usuario?.email?.trim().toLowerCase() === 'rafasms0@hotmail.com'
    );
  }, [usuario, isAdmin]);

  const aprovacoesPorCargo = useMemo<Record<string, ValidacaoCargoAprovado>>(() => {
    void dadosVersion;
    if (!concurso || !Array.isArray(concurso.cargos)) return {};

    const mapa: Record<string, ValidacaoCargoAprovado> = {};
    const todosLotes = lotesStore.getLotes();

    for (const cg of concurso.cargos) {
      const candidatosCargo = lotesStore.getCandidatos(concurso.id, cg.id);
      const candidatoEncontrado = validarUsuarioNaListaDeAprovados(usuario, candidatosCargo);
      const temPermissaoModeracaoCargo = podeEditarCargo(usuario || null, concurso.id, cg.id);
      const aprovado = Boolean(
        isUserAdmin || temPermissaoModeracaoCargo || candidatoEncontrado
      );

      const lotesPermitidosIds = new Set<string>();
      const lotesDoCargo = todosLotes.filter(
        (l) =>
          l.id !== 'simulacao' &&
          l.concurso_id === concurso.id &&
          (!l.cargo_id || l.cargo_id === cg.id)
      );

      for (const lote of lotesDoCargo) {
        const convocado = verificarUsuarioConvocadoNoLote(
          usuario,
          isUserAdmin,
          concurso.id,
          cg.id,
          lote,
          candidatoEncontrado
        );
        if (convocado) {
          lotesPermitidosIds.add(lote.id);
        }
      }

      // Lotes virtuais definidos diretamente em numero_lote_convocado do candidato
      if (candidatoEncontrado?.numero_lote_convocado) {
        const numDigits = String(candidatoEncontrado.numero_lote_convocado)
          .replace(/\D/g, '')
          .trim();
        if (numDigits) {
          lotesPermitidosIds.add(`lote_num_${numDigits}`);
        }
      }

      if (isUserAdmin || podeEditarLote(usuario || null, concurso.id, cg.id)) {
        lotesDoCargo.forEach((l) => lotesPermitidosIds.add(l.id));
        candidatosCargo.forEach((c) => {
          const numDigits = String(c.numero_lote_convocado || '')
            .replace(/\D/g, '')
            .trim();
          if (numDigits) lotesPermitidosIds.add(`lote_num_${numDigits}`);
        });
      }

      mapa[cg.id] = {
        cargoId: cg.id,
        cargoNome: cg.nome,
        aprovado,
        candidato: candidatoEncontrado,
        lotesPermitidosIds,
      };
    }

    return mapa;
  }, [concurso, usuario, isUserAdmin, dadosVersion]);

  const isAprovadoNoCargo = useCallback(
    (cargoId: string): boolean => {
      if (isUserAdmin) return true;
      if (!cargoId || !concurso) return false;
      if (podeEditarCargo(usuario || null, concurso.id, cargoId)) return true;
      return Boolean(aprovacoesPorCargo[cargoId]?.aprovado);
    },
    [isUserAdmin, concurso, usuario, aprovacoesPorCargo]
  );

  const isConvocadoNoLote = useCallback(
    (cargoId: string, loteId?: string): boolean => {
      if (isUserAdmin) return true;
      if (!cargoId || !loteId || !concurso) return false;
      if (podeEditarLote(usuario || null, concurso.id, cargoId)) return true;
      const infoCargo = aprovacoesPorCargo[cargoId];
      if (!infoCargo || !infoCargo.aprovado) return false;
      return infoCargo.lotesPermitidosIds.has(loteId);
    },
    [isUserAdmin, concurso, usuario, aprovacoesPorCargo]
  );

  const isAprovadoNoConcurso = useMemo(() => {
    if (isUserAdmin) return true;
    return Object.values(aprovacoesPorCargo).some((v) => v.aprovado);
  }, [isUserAdmin, aprovacoesPorCargo]);

  const todasSalas = useMemo<SalaChatConcurso[]>(() => {
    void dadosVersion;
    if (!concurso) return [];
    const salasBrutas = chatStore.getSalasDoConcurso(concurso, usuario, isUserAdmin);
    return salasBrutas.map((sala) => {
      if (sala.tipo === 'aprovados') {
        const permitido = isAprovadoNoCargo(sala.cargoId);
        return {
          ...sala,
          temAcesso: permitido,
        };
      }
      if (sala.tipo === 'lote') {
        const permitido = isConvocadoNoLote(sala.cargoId, sala.loteId);
        return {
          ...sala,
          temAcesso: permitido,
        };
      }
      return sala;
    });
  }, [concurso, usuario, isUserAdmin, dadosVersion, isAprovadoNoCargo, isConvocadoNoLote]);

  const podeRenderizarSala = useCallback(
    (sala: SalaChatConcurso): boolean => {
      if (!sala) return false;
      if (sala.tipo === 'geral') return true;
      if (sala.tipo === 'cargo') {
        if (isUserAdmin || !usuario) return true;
        // Se o usuário especificou cargos inscritos no concurso e não é aprovado em outro, prioriza ou permite todos os cargos públicos pré-homologação
        return true;
      }
      if (sala.tipo === 'aprovados') {
        return isAprovadoNoCargo(sala.cargoId);
      }
      if (sala.tipo === 'lote') {
        return isConvocadoNoLote(sala.cargoId, sala.loteId);
      }
      return Boolean(sala.temAcesso);
    },
    [isUserAdmin, usuario, isAprovadoNoCargo, isConvocadoNoLote]
  );

  const salasPermitidas = useMemo<SalaChatConcurso[]>(() => {
    return todasSalas.filter((sala) => podeRenderizarSala(sala));
  }, [todasSalas, podeRenderizarSala]);

  const salasPorCategoria = useMemo<SalasPorCategoriaChat>(() => {
    return {
      geral: salasPermitidas.filter((s) => s.tipo === 'geral'),
      cargo: salasPermitidas.filter((s) => s.tipo === 'cargo'),
      aprovados: salasPermitidas.filter((s) => s.tipo === 'aprovados'),
      lote: salasPermitidas.filter((s) => s.tipo === 'lote'),
    };
  }, [salasPermitidas]);

  const categoriasVisiveis = useMemo<CategoriaChatLateral[]>(() => {
    const categorias: CategoriaChatLateral[] = [
      {
        id: 'geral',
        titulo: 'Geral',
        descricaoCurta: 'Comunidade aberta do certame',
        salas: salasPorCategoria.geral,
      },
      {
        id: 'cargo',
        titulo: 'Cargo',
        descricaoCurta: 'Salas por cargo (pré-homologação)',
        salas: salasPorCategoria.cargo,
      },
      {
        id: 'aprovados',
        titulo: 'Aprovados',
        descricaoCurta: 'Exclusivo para aprovados na lista',
        salas: salasPorCategoria.aprovados,
      },
      {
        id: 'lote',
        titulo: 'Lotes',
        descricaoCurta: 'Exclusivo por lote de convocação',
        salas: salasPorCategoria.lote,
      },
    ];
    return categorias.filter((cat) => cat.salas.length > 0);
  }, [salasPorCategoria]);

  return {
    isUserAdmin,
    isAprovadoNoConcurso,
    aprovacoesPorCargo,
    isAprovadoNoCargo,
    isConvocadoNoLote,
    podeRenderizarSala,
    salasPermitidas,
    salasPorCategoria,
    categoriasVisiveis,
    todasSalas,
  };
}
