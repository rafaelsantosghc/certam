import { Candidato, Lote, ConfigCotas, CotaTipo } from '../types';

export interface ItemOrdemNomeacao {
  ordem: number;
  candidatoId: string;
  nome: string;
  posicaoOriginal: number;
  cotaCandidato: string;
  cotasCandidato?: CotaTipo[];
  vagaAtribuida: 'Ampla' | 'PPP' | 'PCD' | 'Indígena' | 'Trans';
  modalidadeChamada?: string;
  garantido: boolean; // true se já chamado em lote oficial do órgão
  loteNumero?: string | number;
  dataConvocacao?: string;
  dataNomeacao?: string;
  comarcaDefinitiva?: string;
  papel?: 'Titular' | 'Suplente';
  status:
    | 'Próximo (previsão)'
    | 'Aguardando Convocação'
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
 * Normaliza qualquer nomenclatura de cota para os padrões do sistema:
 * - 'PPP': Pessoas Negras / Pretos e Pardos (aceita 'CN', 'PPP', 'Negro', 'Preto', 'Pardo', 'Afro', etc.)
 * - 'PCD': Pessoas com Deficiência (aceita 'PCD', 'Deficiente', 'PPD', etc.)
 * - 'Indígena': Povos Indígenas (aceita 'Indígena', 'Indigena', 'Índio', etc.)
 * - 'Trans': Pessoas Trans (aceita 'Trans', 'Travesti', 'Transexual', etc.)
 * - 'Ampla': Ampla Concorrência (AC, Geral, etc.)
 */
export function normalizarCota(raw: string | undefined | null): 'Ampla' | 'PPP' | 'PCD' | 'Indígena' | 'Trans' {
  const cotas = normalizarCotasMultiplas(raw);
  return cotas[0] || 'Ampla';
}

/**
 * Identifica quando um candidato figura em mais de uma cota (ex: PCD + PPP / Negros)
 */
export function normalizarCotasMultiplas(raw: any): ('Ampla' | 'PPP' | 'PCD' | 'Indígena' | 'Trans')[] {
  if (!raw) return ['Ampla'];
  if (Array.isArray(raw)) {
    const cotas: ('Ampla' | 'PPP' | 'PCD' | 'Indígena' | 'Trans')[] = [];
    for (const item of raw) {
      const c = normalizarCota(item);
      if (!cotas.includes(c)) cotas.push(c);
    }
    return cotas.length > 0 ? cotas : ['Ampla'];
  }

  const str = raw.toString().trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const cotasEncontradas: ('Ampla' | 'PPP' | 'PCD' | 'Indígena' | 'Trans')[] = [];

  // PCD
  if (str.includes('pcd') || str.includes('defic') || str.includes('ppd') || str.includes('especial')) {
    cotasEncontradas.push('PCD');
  }

  // PPP / CN / Negros
  if (
    str.includes('cn') ||
    str.includes('ppp') ||
    str.includes('pn') ||
    str.includes('negro') ||
    str.includes('preto') ||
    str.includes('pardo') ||
    str.includes('afro') ||
    str.includes('racial')
  ) {
    cotasEncontradas.push('PPP');
  }

  // Indígena
  if (str.includes('indig') || str.includes('indio') || str.includes('povos ind')) {
    cotasEncontradas.push('Indígena');
  }

  // Trans
  if (str.includes('trans') || str.includes('travesti')) {
    cotasEncontradas.push('Trans');
  }

  if (cotasEncontradas.length === 0) {
    return ['Ampla'];
  }

  return cotasEncontradas;
}

/**
 * Calcula a Ordem de Nomeação de toda a lista de candidatos.
 * 1. Puxa a ordem oficial dos convocados nos lotes já realizados pelo órgão e fixa como ordem garantida.
 * 2. Simula a projeção especulativa para os candidatos restantes com base nas porcentagens de cotas configuradas.
 */
export function calcularOrdemNomeacao(
  candidatos: Candidato[],
  lotes: Lote[],
  configCotas: ConfigCotas = { ampla: 60, ppp: 20, pcd: 10, indigena: 5, trans: 5 },
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

    const vagaAtrib = normalizarCota(ofi.tipo_vaga);

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
      cotaCandidato: normalizarCota(candBase.cota || ofi.tipo_vaga),
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

  // Helper para obter todas as cotas do candidato
  const getCotasCand = (c: Candidato): ('Ampla' | 'PPP' | 'PCD' | 'Indígena' | 'Trans')[] => {
    if (c.cotas && c.cotas.length > 0) return c.cotas;
    return normalizarCotasMultiplas(c.cota);
  };

  // Criar filas por cota para os candidatos ativos (um candidato com múltiplas cotas entra em ambas as filas e na ampla)
  const filaAmpla = [...candidatosAtivos];
  const filaPcd = candidatosAtivos.filter((c) => getCotasCand(c).includes('PCD'));
  const filaPpp = candidatosAtivos.filter((c) => getCotasCand(c).includes('PPP'));
  const filaIndigena = candidatosAtivos.filter((c) => getCotasCand(c).includes('Indígena'));
  const filaTrans = candidatosAtivos.filter((c) => getCotasCand(c).includes('Trans'));

  const pcdPerc = Math.max(0, Math.min(100, configCotas.pcd ?? 10));
  const pppPerc = Math.max(0, Math.min(100, configCotas.ppp ?? 20));
  const indigenaPerc = Math.max(0, Math.min(100, configCotas.indigena ?? 5));
  const transPerc = Math.max(0, Math.min(100, configCotas.trans ?? 5));

  // Determinar índices de cotas clássicas em concursos públicos
  // Exemplo para 10% PCD: 5ª vaga, 15ª vaga, 25ª vaga...
  const isVagaPcd = (pos: number): boolean => {
    if (pcdPerc <= 0) return false;
    const passo = Math.max(2, Math.round(100 / pcdPerc));
    const offset = Math.max(1, Math.floor(passo / 2));
    return (pos - offset) % passo === 0;
  };

  // Exemplo para 20% PPP (CN): 3ª vaga, 8ª vaga, 13ª vaga, 18ª vaga, 23ª vaga...
  const isVagaPpp = (pos: number): boolean => {
    if (pppPerc <= 0) return false;
    const passo = Math.max(2, Math.round(100 / pppPerc));
    const offset = Math.max(1, Math.floor(passo / 2) + 1);
    return (pos - offset) % passo === 0;
  };

  // Exemplo para Indígenas: a cada 20 vagas (se 5%)
  const isVagaIndigena = (pos: number): boolean => {
    if (indigenaPerc <= 0) return false;
    const passo = Math.max(2, Math.round(100 / indigenaPerc));
    const offset = Math.max(1, Math.floor(passo * 0.75));
    return (pos - offset) % passo === 0;
  };

  // Exemplo para Trans: a cada 20 vagas (se 5%)
  const isVagaTrans = (pos: number): boolean => {
    if (transPerc <= 0) return false;
    const passo = Math.max(2, Math.round(100 / transPerc));
    const offset = Math.max(1, Math.floor(passo * 0.9));
    return (pos - offset) % passo === 0;
  };

  // Apenas considera vagas se explicitamente cadastradas (> 0). Caso contrário, não projeta "Próximo (previsão)"
  let vagasPrevistasRestantes = vagasProximoLote > 0 ? vagasProximoLote : 0;

  const removerDeFilasCotas = (candId: string) => {
    const idxAmpla = filaAmpla.findIndex((c) => c.id === candId);
    if (idxAmpla >= 0) filaAmpla.splice(idxAmpla, 1);

    const idxPcd = filaPcd.findIndex((c) => c.id === candId);
    if (idxPcd >= 0) filaPcd.splice(idxPcd, 1);

    const idxPpp = filaPpp.findIndex((c) => c.id === candId);
    if (idxPpp >= 0) filaPpp.splice(idxPpp, 1);

    const idxInd = filaIndigena.findIndex((c) => c.id === candId);
    if (idxInd >= 0) filaIndigena.splice(idxInd, 1);

    const idxTrans = filaTrans.findIndex((c) => c.id === candId);
    if (idxTrans >= 0) filaTrans.splice(idxTrans, 1);
  };

  while (filaAmpla.length > 0) {
    const posicaoGlobal = ordemAtual;
    let candidatoSelecionado: Candidato | null = null;
    let vagaTipo: 'Ampla' | 'PPP' | 'PCD' | 'Indígena' | 'Trans' = 'Ampla';

    // 1. Checa se esta posição é reserva de PCD
    if (isVagaPcd(posicaoGlobal) && filaPcd.length > 0) {
      candidatoSelecionado = filaPcd.shift()!;
      vagaTipo = 'PCD';
      removerDeFilasCotas(candidatoSelecionado.id);
    }
    // 2. Checa se esta posição é reserva de PPP (CN)
    else if (isVagaPpp(posicaoGlobal) && filaPpp.length > 0) {
      candidatoSelecionado = filaPpp.shift()!;
      vagaTipo = 'PPP';
      removerDeFilasCotas(candidatoSelecionado.id);
    }
    // 3. Checa se esta posição é reserva Indígena
    else if (isVagaIndigena(posicaoGlobal) && filaIndigena.length > 0) {
      candidatoSelecionado = filaIndigena.shift()!;
      vagaTipo = 'Indígena';
      removerDeFilasCotas(candidatoSelecionado.id);
    }
    // 4. Checa se esta posição é reserva Trans
    else if (isVagaTrans(posicaoGlobal) && filaTrans.length > 0) {
      candidatoSelecionado = filaTrans.shift()!;
      vagaTipo = 'Trans';
      removerDeFilasCotas(candidatoSelecionado.id);
    }
    // 5. Caso contrário, chama o próximo da Ampla Concorrência
    else {
      candidatoSelecionado = filaAmpla.shift()!;
      vagaTipo = 'Ampla';
      removerDeFilasCotas(candidatoSelecionado.id);
    }

    if (!candidatoSelecionado) break;

    // Determina status de previsão: apenas 'Próximo (previsão)' se houver lote previsto cadastrado
    let statusPrevisao: ItemOrdemNomeacao['status'] = 'Aguardando Convocação';
    if (vagasProximoLote > 0 && vagasPrevistasRestantes > 0) {
      statusPrevisao = 'Próximo (previsão)';
      vagasPrevistasRestantes--;
    } else {
      statusPrevisao = 'Aguardando Convocação';
    }

    const cotasDoCandidato = getCotasCand(candidatoSelecionado);
    const cotaFormatada = cotasDoCandidato.length > 1 ? cotasDoCandidato.join(' + ') : (cotasDoCandidato[0] || 'Ampla');

    resultado.push({
      ordem: ordemAtual,
      candidatoId: candidatoSelecionado.id,
      nome: candidatoSelecionado.nome,
      posicaoOriginal: candidatoSelecionado.posicao,
      cotaCandidato: cotaFormatada,
      cotasCandidato: cotasDoCandidato,
      vagaAtribuida: vagaTipo,
      modalidadeChamada: vagaTipo === 'Ampla' ? 'Ampla Concorrência' : `Cota ${vagaTipo}`,
      garantido: false, // Mera previsão especulativa
      loteNumero: undefined,
      dataConvocacao: undefined,
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
