import { Candidato, Lote, ConfigCotas } from '../types';

export interface ItemOrdemNomeacao {
  ordem: number;
  candidatoId: string;
  nome: string;
  posicaoOriginal: number;
  cotaCandidato: string;
  vagaAtribuida: 'Ampla' | 'PPP' | 'PCD' | 'Indígena';
  garantido: boolean; // true se já chamado em lote oficial do órgão
  loteNumero?: string | number;
  dataNomeacao?: string;
  comarcaDefinitiva?: string;
  papel?: 'Titular' | 'Suplente';
  status:
    | 'Próximo (previsão)'
    | 'Convocado titular'
    | 'Convocado suplente'
    | 'Nomeado'
    | 'Final de lista'
    | 'Desistente';
  candidatoOriginal: Candidato;
}

export function normalizarNome(nome: string): string {
  return (nome || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Calcula a Ordem de Nomeação de toda a lista de candidatos.
 * 1. Puxa a ordem oficial dos convocados nos lotes já realizados pelo órgão e fixa como ordem garantida.
 * 2. Simula a projeção especulativa para os candidatos restantes com base nas porcentagens de cotas configuradas.
 */
export function calcularOrdemNomeacao(
  candidatos: Candidato[],
  lotes: Lote[],
  configCotas: ConfigCotas = { ampla: 70, ppp: 20, pcd: 10 },
  vagasProximoLote: number = 0
): ItemOrdemNomeacao[] {
  const resultado: ItemOrdemNomeacao[] = [];
  const candidatosJaAlocadosIds = new Set<string>();
  const nomesJaAlocados = new Set<string>();

  // --------------------------------------------------------------------------
  // ETAPA 1: FIXAR ORDEM OFICIAL DOS CANDIDATOS JÁ CHAMADOS EM LOTES ANTERIORES
  // --------------------------------------------------------------------------
  // Filtra lotes com chamamentos e ordena
  const lotesAtivos = [...lotes].filter((l) => l.ativo !== false);

  // Mapear candidatos por id e por nome normalizado para rápido acesso
  const candPorId = new Map<string, Candidato>();
  const candPorNome = new Map<string, Candidato>();
  for (const c of candidatos) {
    candPorId.set(c.id, c);
    candPorNome.set(normalizarNome(c.nome), c);
  }

  // Coletar todos os convocados oficiais de todos os lotes
  interface ConvocadoOficialInfo {
    ordem_oficial: number;
    nome: string;
    tipo_vaga: string;
    papel: 'Titular' | 'Suplente';
    lote_nome: string;
    lote_numero?: string | number;
    data_nomeacao?: string;
    comarca_definitiva?: string;
    candidato?: Candidato;
  }

  const convocadosOficiais: ConvocadoOficialInfo[] = [];

  for (const lote of lotesAtivos) {
    if (lote.convocados && lote.convocados.length > 0) {
      for (const conv of lote.convocados) {
        const cNomeNorm = normalizarNome(conv.nome);
        const matchCand =
          (conv.candidato_id && candPorId.get(conv.candidato_id)) ||
          candPorNome.get(cNomeNorm);

        // Se o lote tiver escolhas definidas, pega a comarca definitiva
        const comarcaDefinitiva =
          conv.comarca_escolhida ||
          (lote.definicoes_escolhas && lote.definicoes_escolhas[conv.candidato_id || '']) ||
          (lote.definicoes_escolhas && lote.definicoes_escolhas[conv.nome]) ||
          (lote.status_lote === 'escolhas_definidas' ? matchCand?.escolhas_comarcas?.[0] : undefined) ||
          matchCand?.comarca_definitiva;

        convocadosOficiais.push({
          ordem_oficial: conv.ordem_nomeacao || convocadosOficiais.length + 1,
          nome: conv.nome,
          tipo_vaga: conv.tipo_vaga || 'Ampla',
          papel: conv.papel || 'Titular',
          lote_nome: lote.nome,
          lote_numero: lote.numero_lote || lote.nome,
          data_nomeacao: conv.data_nomeacao || lote.data_nomeacao || matchCand?.data_nomeacao,
          comarca_definitiva: comarcaDefinitiva,
          candidato: matchCand,
        });
      }
    } else if (lote.candidatos_ids && lote.candidatos_ids.length > 0) {
      // Caso legado de lote apenas com candidatos_ids
      let seq = convocadosOficiais.length + 1;
      for (const cid of lote.candidatos_ids) {
        const match = candPorId.get(cid);
        if (match) {
          convocadosOficiais.push({
            ordem_oficial: seq++,
            nome: match.nome,
            tipo_vaga: match.cota || 'Ampla',
            papel: 'Titular',
            lote_nome: lote.nome,
            lote_numero: lote.numero_lote || lote.nome,
            data_nomeacao: lote.data_nomeacao || match.data_nomeacao,
            comarca_definitiva: match.comarca_definitiva || (lote.status_lote === 'escolhas_definidas' ? match.escolhas_comarcas?.[0] : undefined),
            candidato: match,
          });
        }
      }
    }
  }

  // Ordena os oficiais pela ordem de nomeação oficial
  convocadosOficiais.sort((a, b) => a.ordem_oficial - b.ordem_oficial);

  // Adiciona os convocados oficiais garantidos ao resultado
  let ordemAtual = 1;
  for (const ofi of convocadosOficiais) {
    const cId = ofi.candidato?.id || `conv-${ordemAtual}`;
    const cNomeNorm = normalizarNome(ofi.nome);

    if (candidatosJaAlocadosIds.has(cId) || nomesJaAlocados.has(cNomeNorm)) {
      continue;
    }

    candidatosJaAlocadosIds.add(cId);
    nomesJaAlocados.add(cNomeNorm);

    // Determina status
    let statusOficial: ItemOrdemNomeacao['status'] = 'Convocado titular';
    if (ofi.data_nomeacao) {
      statusOficial = 'Nomeado';
    } else if (ofi.papel === 'Suplente') {
      statusOficial = 'Convocado suplente';
    } else {
      statusOficial = 'Convocado titular';
    }

    const vagaAtrib =
      ofi.tipo_vaga.toLowerCase().includes('pcd')
        ? 'PCD'
        : ofi.tipo_vaga.toLowerCase().includes('ppp') || ofi.tipo_vaga.toLowerCase().includes('negro')
        ? 'PPP'
        : ofi.tipo_vaga.toLowerCase().includes('indig')
        ? 'Indígena'
        : 'Ampla';

    const candBase: Candidato = ofi.candidato || {
      id: cId,
      posicao: ofi.ordem_oficial,
      nome: ofi.nome,
      cota: vagaAtrib,
      nota_final: 0,
      intencao: 'Sim',
      status: statusOficial,
      escolhas_comarcas: ofi.comarca_definitiva ? [ofi.comarca_definitiva] : [],
      numero_lote_convocado: ofi.lote_numero,
      data_nomeacao: ofi.data_nomeacao,
      comarca_definitiva: ofi.comarca_definitiva,
    };

    resultado.push({
      ordem: ofi.ordem_oficial || ordemAtual,
      candidatoId: cId,
      nome: ofi.nome,
      posicaoOriginal: candBase.posicao || ofi.ordem_oficial,
      cotaCandidato: candBase.cota || ofi.tipo_vaga,
      vagaAtribuida: vagaAtrib,
      garantido: true,
      loteNumero: ofi.lote_numero,
      dataNomeacao: ofi.data_nomeacao,
      comarcaDefinitiva: ofi.comarca_definitiva,
      papel: ofi.papel,
      status: statusOficial,
      candidatoOriginal: candBase,
    });

    ordemAtual = Math.max(ordemAtual + 1, ofi.ordem_oficial + 1);
  }

  // --------------------------------------------------------------------------
  // ETAPA 2: PROJEÇÃO ESPECULATIVA DOS CANDIDATOS RESTANTES COM COTAS
  // --------------------------------------------------------------------------
  // Separar desistentes e fim de fila para o final
  const desistentes: Candidato[] = [];
  const fimDeFila: Candidato[] = [];
  const candidatosAtivos: Candidato[] = [];

  for (const c of candidatos) {
    if (candidatosJaAlocadosIds.has(c.id) || nomesJaAlocados.has(normalizarNome(c.nome))) {
      continue;
    }

    if (c.intencao === 'Não' || c.status === 'Desistência' || c.status === 'Desistente') {
      desistentes.push(c);
    } else if (c.intencao === 'final_fila' || c.status === 'Fim de Fila' || c.status === 'Final de lista') {
      fimDeFila.push(c);
    } else {
      candidatosAtivos.push(c);
    }
  }

  // Ordenar candidatos ativos por nota decrescente (ou posição original crescente)
  candidatosAtivos.sort((a, b) => {
    if (a.posicao && b.posicao) return a.posicao - b.posicao;
    return (b.nota_final || 0) - (a.nota_final || 0);
  });

  // Criar filas por cota para os candidatos ativos
  const filaAmpla = [...candidatosAtivos];
  const filaPcd = candidatosAtivos.filter((c) => c.cota === 'PCD');
  const filaPpp = candidatosAtivos.filter((c) => c.cota === 'PPP');
  const filaIndigena = candidatosAtivos.filter((c) => c.cota === 'Indígena');

  const pcdPerc = Math.max(0, Math.min(100, configCotas.pcd ?? 10));
  const pppPerc = Math.max(0, Math.min(100, configCotas.ppp ?? 20));

  // Determinar índices de cotas clássicas em concursos públicos
  // Exemplo para 10% PCD: 5ª vaga, 15ª vaga, 25ª vaga...
  // Exemplo para 20% PPP: 3ª vaga, 8ª vaga, 13ª vaga, 18ª vaga, 23ª vaga...
  const isVagaPcd = (pos: number): boolean => {
    if (pcdPerc <= 0) return false;
    // Intervalo baseado na porcentagem (ex: 10% -> a cada 10 vagas, iniciando na 5ª)
    const passo = Math.round(100 / pcdPerc);
    const offset = Math.max(1, Math.floor(passo / 2));
    return (pos - offset) % passo === 0;
  };

  const isVagaPpp = (pos: number): boolean => {
    if (pppPerc <= 0) return false;
    // Intervalo baseado na porcentagem (ex: 20% -> a cada 5 vagas, iniciando na 3ª)
    const passo = Math.round(100 / pppPerc);
    const offset = Math.max(1, Math.floor(passo / 2) + 1);
    return (pos - offset) % passo === 0;
  };

  let vagasPrevistasRestantes = vagasProximoLote > 0 ? vagasProximoLote : 5;

  while (filaAmpla.length > 0) {
    const posicaoGlobal = ordemAtual;
    let candidatoSelecionado: Candidato | null = null;
    let vagaTipo: 'Ampla' | 'PPP' | 'PCD' | 'Indígena' = 'Ampla';

    // 1. Checa se esta posição é reserva de PCD
    if (isVagaPcd(posicaoGlobal) && filaPcd.length > 0) {
      candidatoSelecionado = filaPcd.shift()!;
      vagaTipo = 'PCD';
      // Remover também da fila ampla
      const idx = filaAmpla.findIndex((c) => c.id === candidatoSelecionado!.id);
      if (idx >= 0) filaAmpla.splice(idx, 1);
    }
    // 2. Checa se esta posição é reserva de PPP
    else if (isVagaPpp(posicaoGlobal) && filaPpp.length > 0) {
      candidatoSelecionado = filaPpp.shift()!;
      vagaTipo = 'PPP';
      // Remover também da fila ampla
      const idx = filaAmpla.findIndex((c) => c.id === candidatoSelecionado!.id);
      if (idx >= 0) filaAmpla.splice(idx, 1);
    }
    // 3. Caso contrário, chama o próximo da Ampla Concorrência
    else {
      candidatoSelecionado = filaAmpla.shift()!;
      vagaTipo = 'Ampla';
      // Se este candidato também estava nas filas de cota, remove para não duplicar
      if (candidatoSelecionado.cota === 'PCD') {
        const idx = filaPcd.findIndex((c) => c.id === candidatoSelecionado!.id);
        if (idx >= 0) filaPcd.splice(idx, 1);
      } else if (candidatoSelecionado.cota === 'PPP') {
        const idx = filaPpp.findIndex((c) => c.id === candidatoSelecionado!.id);
        if (idx >= 0) filaPpp.splice(idx, 1);
      }
    }

    if (!candidatoSelecionado) break;

    // Determina status de previsão
    let statusPrevisao: ItemOrdemNomeacao['status'] = 'Próximo (previsão)';
    if (vagasPrevistasRestantes > 0) {
      statusPrevisao = 'Próximo (previsão)';
      vagasPrevistasRestantes--;
    } else {
      statusPrevisao = 'Próximo (previsão)';
    }

    resultado.push({
      ordem: ordemAtual,
      candidatoId: candidatoSelecionado.id,
      nome: candidatoSelecionado.nome,
      posicaoOriginal: candidatoSelecionado.posicao,
      cotaCandidato: candidatoSelecionado.cota || 'Ampla',
      vagaAtribuida: vagaTipo,
      garantido: false, // Mera previsão especulativa
      loteNumero: undefined,
      dataNomeacao: undefined,
      comarcaDefinitiva: candidatoSelecionado.comarca_definitiva || undefined,
      status: statusPrevisao,
      candidatoOriginal: candidatoSelecionado,
    });

    candidatosJaAlocadosIds.add(candidatoSelecionado.id);
    nomesJaAlocados.add(normalizarNome(candidatoSelecionado.nome));
    ordemAtual++;
  }

  // --------------------------------------------------------------------------
  // ETAPA 3: FIM DE FILA
  // --------------------------------------------------------------------------
  for (const ff of fimDeFila) {
    resultado.push({
      ordem: ordemAtual++,
      candidatoId: ff.id,
      nome: ff.nome,
      posicaoOriginal: ff.posicao,
      cotaCandidato: ff.cota || 'Ampla',
      vagaAtribuida: (ff.cota as any) || 'Ampla',
      garantido: false,
      status: 'Final de lista',
      candidatoOriginal: ff,
    });
  }

  // --------------------------------------------------------------------------
  // ETAPA 4: DESISTENTES FORMALIZADOS
  // --------------------------------------------------------------------------
  for (const des of desistentes) {
    resultado.push({
      ordem: ordemAtual++,
      candidatoId: des.id,
      nome: des.nome,
      posicaoOriginal: des.posicao,
      cotaCandidato: des.cota || 'Ampla',
      vagaAtribuida: (des.cota as any) || 'Ampla',
      garantido: false,
      status: 'Desistente',
      candidatoOriginal: des,
    });
  }

  return resultado;
}
