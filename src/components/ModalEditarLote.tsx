import React, { useState, useEffect } from 'react';
import { Lote, CandidatoConvocadoLote, StatusLote, Candidato } from '../types';
import { lotesStore } from '../store/lotesStore';
import { certamStore } from '../store/certamStore';
import { userRegistryStore } from '../store/userRegistryStore';
import { normalizarCota } from '../utils/ordemNomeacao';
import {
  X,
  Layers,
  Check,
  Plus,
  Trash2,
  AlertCircle,
  Lock,
  Eye,
  Printer,
  FileSpreadsheet,
  Users,
  Calendar,
  CheckCircle2,
  FileText,
  MapPin,
  UserCheck,
  Search,
} from 'lucide-react';

interface ModalEditarLoteProps {
  aberto: boolean;
  onClose: () => void;
  concursoId: string;
  cargoId: string;
  lote?: Lote | null;
  onSalvo?: (lote: Lote) => void;
}

export const ModalEditarLote: React.FC<ModalEditarLoteProps> = ({
  aberto,
  onClose,
  concursoId,
  cargoId,
  lote,
  onSalvo,
}) => {
  const isEdicao = !!lote;
  const concurso = certamStore.getConcurso(concursoId);
  const tipoLotacao = concurso?.tipo_lotacao || 'Lotação';

  const [abaInterna, setAbaInterna] = useState<'dados_comarcas' | 'convocados'>('dados_comarcas');

  const [nome, setNome] = useState('');
  const [numeroLote, setNumeroLote] = useState<string>('1');
  const [ativo, setAtivo] = useState(true);
  const [travado, setTravado] = useState(false);
  const [statusLote, setStatusLote] = useState<StatusLote>('em_escolha');
  const [dataNomeacao, setDataNomeacao] = useState('');
  const [dataConvocacao, setDataConvocacao] = useState('');
  const [dataAudiencia, setDataAudiencia] = useState('');
  const [isRankingVisible, setIsRankingVisible] = useState(true);
  const [isPrintingEnabled, setIsPrintingEnabled] = useState(true);
  const [senha, setSenha] = useState('');

  // Comarcas
  const [comarcas, setComarcas] = useState<{ nome: string; vagas: number }[]>([]);
  const [novaComarcaNome, setNovaComarcaNome] = useState('');
  const [novaComarcaVagas, setNovaComarcaVagas] = useState(1);
  const [modalImportarComarcasAberto, setModalImportarComarcasAberto] = useState(false);
  const [textoColadoComarcas, setTextoColadoComarcas] = useState('');

  // Candidatos Convocados
  const [convocados, setConvocados] = useState<CandidatoConvocadoLote[]>([]);
  const [modalImportarConvocadosAberto, setModalImportarConvocadosAberto] = useState(false);
  const [seletorListaCargoAberto, setSeletorListaCargoAberto] = useState(true);
  const [textoColadoConvocados, setTextoColadoConvocados] = useState('');
  const [buscaCandCargo, setBuscaCandCargo] = useState('');
  const [filtroCotaCargo, setFiltroCotaCargo] = useState<string>('todas');
  const [filtroSelecaoCargo, setFiltroSelecaoCargo] = useState<'todos' | 'selecionados' | 'nao_selecionados'>('todos');
  const [limiteListaCargo, setLimiteListaCargo] = useState<100 | 250 | 500 | 'todos'>(100);
  const [papelPadraoFaixa, setPapelPadraoFaixa] = useState<'Titular' | 'Suplente'>('Titular');

  // Estado de questionamento quando candidatos colados do Excel não existem na lista de classificação do cargo (Item 6)
  const [questionamentoNaoEncontrados, setQuestionamentoNaoEncontrados] = useState<{
    substituir: boolean;
    todos: CandidatoConvocadoLote[];
    apenasReconhecidos: CandidatoConvocadoLote[];
    naoEncontrados: CandidatoConvocadoLote[];
  } | null>(null);

  const candidatosDoCargo = React.useMemo(
    () => lotesStore.getCandidatos(concursoId, cargoId),
    [concursoId, cargoId, aberto]
  );

  const [erro, setErro] = useState<string | null>(null);
  const [sucessoMsg, setSucessoMsg] = useState<string | null>(null);

  useEffect(() => {
    if (lote) {
      const numRaw = lote.numero_lote !== undefined && lote.numero_lote !== null
        ? lote.numero_lote.toString()
        : (lote.nome || '').replace(/^lote\s*/i, '').trim();
      const numFinal = numRaw || '1';
      setNumeroLote(numFinal);
      setNome(`Lote ${numFinal}`);
      setAtivo(lote.ativo ?? true);
      const isLoteTravado = lote.travado ?? false;
      setTravado(isLoteTravado);
      setStatusLote(lote.status_lote || (isLoteTravado ? 'escolhas_definidas' : 'em_escolha'));
      setDataConvocacao(lote.data_convocacao || '');
      setDataAudiencia(lote.data_audiencia || '');
      setDataNomeacao(lote.data_nomeacao || '');
      setIsRankingVisible(lote.is_ranking_visible ?? true);
      setIsPrintingEnabled(lote.is_printing_enabled ?? true);
      setSenha(lote.senha || '');
      setComarcas(lote.comarcas ? [...lote.comarcas] : []);
      setConvocados(lote.convocados ? [...lote.convocados] : []);
    } else {
      setNumeroLote('1');
      setNome('Lote 1');
      setAtivo(true);
      setTravado(false);
      setStatusLote('em_escolha');
      setDataConvocacao('');
      setDataAudiencia('');
      setDataNomeacao('');
      setIsRankingVisible(true);
      setIsPrintingEnabled(true);
      setSenha('');
      setComarcas([]);
      setConvocados([]);
    }
    setNovaComarcaNome('');
    setNovaComarcaVagas(1);
    setTextoColadoComarcas('');
    setTextoColadoConvocados('');
    setModalImportarComarcasAberto(false);
    setModalImportarConvocadosAberto(false);
    setQuestionamentoNaoEncontrados(null);
    setErro(null);
    setSucessoMsg(null);
    setAbaInterna('dados_comarcas');
  }, [lote, aberto]);

  if (!aberto) return null;

  // --------------------------------------------------------------------------
  // PARSER DE COMARCAS COLADAS DO EXCEL
  // --------------------------------------------------------------------------
  const handleProcessarImportacaoComarcas = (substituir: boolean) => {
    if (!textoColadoComarcas.trim()) {
      setErro('Cole o conteúdo da planilha do Excel antes de importar.');
      return;
    }

    const linhas = textoColadoComarcas.split(/\r?\n/).filter((l) => l.trim().length > 0);
    const novasComarcas: { nome: string; vagas: number }[] = [];

    for (const linha of linhas) {
      // Ignora possíveis cabeçalhos
      const linhaLower = linha.toLowerCase();
      if (
        linhaLower.includes('comarca') &&
        (linhaLower.includes('vaga') || linhaLower.includes('qtd'))
      ) {
        continue;
      }

      // Separar por Tabulação (padrão de cópia do Excel), ponto-e-vírgula ou vírgula
      let partes = linha.split('\t');
      if (partes.length < 2) {
        partes = linha.split(';');
      }
      if (partes.length < 2) {
        partes = linha.split(',');
      }

      let nomeComarca = '';
      let vagasComarca = 1;

      if (partes.length >= 2) {
        nomeComarca = partes[0].trim();
        const vagasParsed = parseInt(partes[1].replace(/\D/g, ''), 10);
        vagasComarca = isNaN(vagasParsed) ? 1 : Math.max(0, vagasParsed);
      } else {
        // Formato com hífen "Porto Alegre - 4" ou somente o nome
        const regexHifen = /^(.*?)[-–—:]\s*(\d+)/;
        const match = linha.match(regexHifen);
        if (match) {
          nomeComarca = match[1].trim();
          vagasComarca = Math.max(1, parseInt(match[2], 10));
        } else {
          nomeComarca = linha.trim();
          vagasComarca = 1;
        }
      }

      if (nomeComarca) {
        novasComarcas.push({ nome: nomeComarca, vagas: vagasComarca });
      }
    }

    if (novasComarcas.length === 0) {
      setErro('Nenhuma comarca válida identificada no texto colado.');
      return;
    }

    if (substituir) {
      setComarcas(novasComarcas);
    } else {
      // Acrescenta ou atualiza vagas se já existir
      setComarcas((prev) => {
        const mapa = new Map<string, number>();
        prev.forEach((c) => mapa.set(c.nome.toLowerCase(), c.vagas));
        novasComarcas.forEach((nc) => {
          const key = nc.nome.toLowerCase();
          mapa.set(key, (mapa.get(key) || 0) + nc.vagas);
        });
        const resultado: { nome: string; vagas: number }[] = [];
        // Mantém nomes originais
        const adicionados = new Set<string>();
        prev.forEach((c) => {
          resultado.push({ nome: c.nome, vagas: mapa.get(c.nome.toLowerCase()) || c.vagas });
          adicionados.add(c.nome.toLowerCase());
        });
        novasComarcas.forEach((nc) => {
          if (!adicionados.has(nc.nome.toLowerCase())) {
            resultado.push({ nome: nc.nome, vagas: nc.vagas });
            adicionados.add(nc.nome.toLowerCase());
          }
        });
        return resultado;
      });
    }

    // Item 17: Sincronizar catálogo geral de lotações do concurso
    novasComarcas.forEach((nc) => {
      certamStore.adicionarLotacaoAoCatalogo(concursoId, nc.nome);
    });

    setTextoColadoComarcas('');
    setModalImportarComarcasAberto(false);
    setSucessoMsg(`Sucesso! ${novasComarcas.length} ${tipoLotacao.toLowerCase()}s processadas da planilha e sincronizadas com o catálogo.`);
    setErro(null);
  };

  const normalizarNomeBusca = (str: string = ''): string =>
    str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();

  const concluirImportacaoConvocados = (listaFinal: CandidatoConvocadoLote[], substituir: boolean) => {
    const ordenados = [...listaFinal].sort((a, b) => a.ordem_nomeacao - b.ordem_nomeacao);
    if (substituir) {
      setConvocados(ordenados);
    } else {
      setConvocados((prev) => {
        const copy = [...prev];
        ordenados.forEach((nv) => {
          const idxExistente = copy.findIndex(
            (cv) =>
              (cv.candidato_id && nv.candidato_id && cv.candidato_id === nv.candidato_id) ||
              normalizarNomeBusca(cv.nome) === normalizarNomeBusca(nv.nome)
          );
          if (idxExistente >= 0) {
            copy[idxExistente] = nv;
          } else {
            copy.push(nv);
          }
        });
        copy.sort((a, b) => a.ordem_nomeacao - b.ordem_nomeacao);
        return copy;
      });
    }

    setQuestionamentoNaoEncontrados(null);
    setTextoColadoConvocados('');
    setModalImportarConvocadosAberto(false);
    setSucessoMsg(`Sucesso! ${ordenados.length} candidatos convocados aplicados ao lote.`);
    setErro(null);
  };

  // --------------------------------------------------------------------------
  // PARSER DE CANDIDATOS CONVOCADOS COLADOS DO EXCEL (COM VALIDAÇÃO NA LISTA DO CARGO)
  // --------------------------------------------------------------------------
  const handleProcessarImportacaoConvocados = (substituir: boolean) => {
    if (!textoColadoConvocados.trim()) {
      setErro('Cole as colunas de convocados da planilha do Excel antes de processar.');
      return;
    }

    const linhas = textoColadoConvocados.split(/\r?\n/).filter((l) => l.trim().length > 0);
    const novosConvocados: CandidatoConvocadoLote[] = [];
    const apenasReconhecidos: CandidatoConvocadoLote[] = [];
    const naoEncontrados: CandidatoConvocadoLote[] = [];

    let seqAuto = 1;
    for (const linha of linhas) {
      const linhaLower = linha.toLowerCase();
      // Ignorar cabeçalhos
      if (
        (linhaLower.includes('ordem') && linhaLower.includes('nome')) ||
        linhaLower.includes('nomeação') ||
        (linhaLower.includes('candidato') && linhaLower.includes('vaga'))
      ) {
        continue;
      }

      // Separar colunas por tabulação (Excel), ponto-e-vírgula ou vírgula
      let colunas = linha.split('\t');
      if (colunas.length < 2) colunas = linha.split(';');
      if (colunas.length < 2) colunas = linha.split(',');

      let ordem = seqAuto;
      let nomeCand = '';
      let tipoVaga = 'Ampla';
      let papel: 'Titular' | 'Suplente' = 'Titular';

      if (colunas.length >= 2) {
        const parsedOrdem = parseInt(colunas[0].replace(/\D/g, ''), 10);
        if (isNaN(parsedOrdem)) {
          ordem = seqAuto++;
          nomeCand = colunas[0].trim();
          if (colunas[1]) tipoVaga = normalizarCota(colunas[1]);
          if (colunas[2]) papel = colunas[2].toLowerCase().includes('suplente') ? 'Suplente' : 'Titular';
        } else {
          ordem = parsedOrdem;
          seqAuto = Math.max(seqAuto, ordem + 1);
          nomeCand = colunas[1]?.trim() || '';

          const col2 = colunas[2] || '';
          const col3 = colunas[3] || '';

          const isCol2Papel =
            col2.toLowerCase().includes('titular') || col2.toLowerCase().includes('suplente');
          tipoVaga = normalizarCota(isCol2Papel ? col3 : col2);

          if (col2.toLowerCase().includes('suplente') || col3.toLowerCase().includes('suplente')) {
            papel = 'Suplente';
          } else {
            papel = 'Titular';
          }
        }
      } else {
        // Caso o usuário tenha colado apenas 1 coluna com os nomes
        const textoLimpo = linha.replace(/^\d+[\s.\-–—)]+/, '').trim();
        nomeCand = textoLimpo;
        ordem = seqAuto++;
      }

      if (nomeCand) {
        const nomeNorm = normalizarNomeBusca(nomeCand);
        const candMatch = candidatosDoCargo.find(
          (c) => normalizarNomeBusca(c.nome) === nomeNorm
        );

        const itemConvocado: CandidatoConvocadoLote = {
          candidato_id: candMatch?.id,
          ordem_nomeacao: ordem,
          nome: candMatch?.nome || nomeCand,
          tipo_vaga: candMatch && (!colunas[2] || tipoVaga === 'Ampla') ? candMatch.cota || 'Ampla' : tipoVaga,
          papel: papel,
        };

        novosConvocados.push(itemConvocado);
        if (candMatch) {
          apenasReconhecidos.push(itemConvocado);
        } else {
          naoEncontrados.push(itemConvocado);
        }
      }
    }

    if (novosConvocados.length === 0) {
      setErro(
        'Nenhum candidato válido identificado. Certifique-se de copiar as colunas de Ordem, Nome, Tipo de Vaga e Titular/Suplente.'
      );
      return;
    }

    // Item 6: Questionar caso algum candidato importado via texto não exista na lista de classificação do cargo
    if (naoEncontrados.length > 0) {
      setQuestionamentoNaoEncontrados({
        substituir,
        todos: novosConvocados,
        apenasReconhecidos,
        naoEncontrados,
      });
      setErro(null);
      return;
    }

    concluirImportacaoConvocados(novosConvocados, substituir);
  };

  const handleAdicionarComarcaManual = () => {
    const nomeTrim = novaComarcaNome.trim();
    if (!nomeTrim) return;

    if (comarcas.some((c) => c.nome.toLowerCase() === nomeTrim.toLowerCase())) {
      setErro(`A ${tipoLotacao.toLowerCase()} "${nomeTrim}" já foi adicionada a este lote.`);
      return;
    }

    setComarcas((prev) => [...prev, { nome: nomeTrim, vagas: Math.max(1, Number(novaComarcaVagas) || 1) }]);
    // Sincronizar catálogo do concurso
    certamStore.adicionarLotacaoAoCatalogo(concursoId, nomeTrim);
    setNovaComarcaNome('');
    setNovaComarcaVagas(1);
    setErro(null);
  };

  const handleRemoverComarca = (index: number) => {
    setComarcas((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleRemoverConvocado = (index: number) => {
    setConvocados((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleToggleCandidatoDaLista = (cand: Candidato, papel: 'Titular' | 'Suplente' = papelPadraoFaixa) => {
    setConvocados((prev) => {
      const jaExiste = prev.some(
        (cv) =>
          (cv.candidato_id && cv.candidato_id === cand.id) ||
          normalizarNomeBusca(cv.nome) === normalizarNomeBusca(cand.nome)
      );
      if (jaExiste) {
        return prev.filter(
          (cv) =>
            !(
              (cv.candidato_id && cv.candidato_id === cand.id) ||
              normalizarNomeBusca(cv.nome) === normalizarNomeBusca(cand.nome)
            )
        );
      }
      const proxOrdem = prev.length > 0 ? Math.max(...prev.map((p) => p.ordem_nomeacao || 0)) + 1 : 1;
      return [
        ...prev,
        {
          candidato_id: cand.id,
          ordem_nomeacao: proxOrdem,
          nome: cand.nome,
          tipo_vaga: cand.cota || 'Ampla',
          papel,
        },
      ];
    });
  };

  const totalVagas = comarcas.reduce((acc, c) => acc + (Number(c.vagas) || 0), 0);
  const totalTitulares = convocados.filter((c) => c.papel === 'Titular').length;
  const totalSuplentes = convocados.filter((c) => c.papel === 'Suplente').length;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numLimpo = numeroLote.trim();
    if (!numLimpo) {
      setErro('Informe o número do lote (ex: 1, 1.1, 1.2, 2, 2.1).');
      return;
    }
    if (!concursoId || !cargoId) {
      setErro('Concurso e cargo de vinculação são obrigatórios.');
      return;
    }

    const finalId = lote?.id || `lote-${concursoId}-${cargoId}-${Date.now().toString(36)}`;
    const nomeFinal = `Lote ${numLimpo}`;

    // Criar mapa de candidatos_ids
    const candidatosIds = convocados.map((c) => c.candidato_id || c.nome);

    const finalTravado = Boolean(travado);
    let finalStatus: StatusLote = statusLote;
    if (!finalTravado) {
      if (statusLote === 'escolhas_definidas' || statusLote === 'encerrado') {
        finalStatus = 'em_escolha';
      }
    } else {
      if (statusLote === 'em_escolha' || statusLote === 'aberto') {
        finalStatus = 'escolhas_definidas';
      }
    }

    const loteAtualizado: Lote = {
      id: finalId,
      concurso_id: concursoId,
      cargo_id: cargoId,
      nome: nomeFinal,
      numero_lote: numLimpo,
      ativo,
      travado: finalTravado,
      status_lote: finalStatus,
      data_convocacao: dataConvocacao.trim() || undefined,
      data_audiencia: dataAudiencia.trim() || undefined,
      data_nomeacao: dataNomeacao.trim() || undefined,
      is_ranking_visible: isRankingVisible,
      is_printing_enabled: isPrintingEnabled,
      senha: senha.trim() || undefined,
      comarcas,
      candidatos_ids: candidatosIds,
      convocados,
      definicoes_escolhas: lote?.definicoes_escolhas || {},
    };

    if (isEdicao) {
      lotesStore.atualizarLote(loteAtualizado);
    } else {
      lotesStore.criarLote(loteAtualizado);
    }

    // SINCRONIZAR CANDIDATOS DO CONCURSO/CARGO COM OS DADOS OFICIAIS DO LOTE
    try {
      const candidatosDoCargo = lotesStore.getCandidatos(concursoId, cargoId);
      if (candidatosDoCargo.length > 0 && convocados.length > 0) {
        let alterados = false;
        const candidatosAtualizados = candidatosDoCargo.map((cand) => {
          const convMatch = convocados.find(
            (cv) =>
              (cv.candidato_id && cv.candidato_id === cand.id) ||
              cv.nome.toLowerCase().trim() === cand.nome.toLowerCase().trim()
          );

          if (convMatch) {
            alterados = true;
            let novoStatus: Candidato['status'] =
              dataNomeacao.trim() || statusLote === 'encerrado'
                ? 'Nomeado'
                : convMatch.papel === 'Suplente'
                ? 'Convocado suplente'
                : 'Convocado titular';

            return {
              ...cand,
              numero_lote_convocado: loteAtualizado.numero_lote || loteAtualizado.nome,
              ordem_nomeacao: convMatch.ordem_nomeacao,
              papel_convocacao: convMatch.papel,
              tipo_vaga_convocacao: convMatch.tipo_vaga,
              data_nomeacao: dataNomeacao.trim() || cand.data_nomeacao,
              status: novoStatus as any,
              comarca_definitiva:
                convMatch.comarca_escolhida ||
                (statusLote === 'escolhas_definidas' ? cand.escolhas_comarcas?.[0] : cand.comarca_definitiva),
            };
          }
          return cand;
        });

        if (alterados) {
          lotesStore.salvarCandidatos(concursoId, cargoId, candidatosAtualizados);
        }
      }
    } catch (err) {
      console.warn('Erro ao sincronizar candidatos com lote:', err);
    }

    if (onSalvo) onSalvo(loteAtualizado);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in-50">
      <div className="bg-white rounded-3xl max-w-3xl w-full p-6 sm:p-7 shadow-2xl border border-slate-200 my-8 space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-teal-500/10 text-teal-700 flex items-center justify-center shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base font-serif">
                {isEdicao ? `Editar Lote ${numeroLote || lote?.numero_lote || ''}` : 'Cadastrar Novo Lote de Convocação'}
              </h3>
              <p className="text-2xs text-slate-500">
                Gerencie comarcas ofertadas, candidatos convocados e importações em massa do Excel
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* NAVEGAÇÃO DE SUB-ABAS DO MODAL */}
        <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
          <button
            type="button"
            onClick={() => setAbaInterna('dados_comarcas')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              abaInterna === 'dados_comarcas'
                ? 'bg-[#07192B] text-[#2DD4AA]'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <MapPin className="w-4 h-4" />
            <span>Dados Gerais &amp; Comarcas ({totalVagas} vagas)</span>
          </button>

          <button
            type="button"
            onClick={() => setAbaInterna('convocados')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              abaInterna === 'convocados'
                ? 'bg-[#07192B] text-[#2DD4AA]'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Candidatos Convocados ({convocados.length})</span>
          </button>
        </div>

        {erro && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{erro}</span>
          </div>
        )}

        {sucessoMsg && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{sucessoMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* =============================================================== */}
          {/* ABA 1: DADOS GERAIS E COMARCAS                                  */}
          {/* =============================================================== */}
          {abaInterna === 'dados_comarcas' && (
            <div className="space-y-4">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Número do Lote <span className="text-rose-500">*</span>:
                </label>
                <input
                  type="text"
                  placeholder="Ex: 1, 1.1, 1.2, 2, 2.1..."
                  value={numeroLote}
                  onChange={(e) => {
                    const val = e.target.value;
                    setNumeroLote(val);
                    setNome(val ? `Lote ${val.trim()}` : '');
                  }}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl focus:border-teal-600 outline-hidden font-mono font-bold text-slate-900 text-sm"
                  required
                />
                <span className="text-2xs text-slate-500 mt-1 block">
                  Informe apenas o número do lote. Lotes complementares podem ser numerados como 1.1, 1.2, 2.1, 2.2, etc.
                </span>
              </div>

              {/* Status do Lote e Datas Oficiais / Previsões */}
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-800 mb-1">Status Oficial do Lote:</label>
                  <select
                    value={statusLote}
                    onChange={(e) => {
                      const newStatus = e.target.value as StatusLote;
                      setStatusLote(newStatus);
                      if (newStatus === 'escolhas_definidas' || newStatus === 'encerrado') {
                        setTravado(true);
                      } else if (newStatus === 'em_escolha' || newStatus === 'aberto') {
                        setTravado(false);
                      }
                    }}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-medium focus:border-teal-600 outline-hidden"
                  >
                    <option value="aberto">Aberto / Em Planejamento</option>
                    <option value="em_escolha">Em Escolha de Comarcas (Candidatos)</option>
                    <option value="escolhas_definidas">Escolhas Definidas (Audiência Concluída)</option>
                    <option value="encerrado">Encerrado / Nomeações Efetuadas</option>
                  </select>
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    {statusLote === 'escolhas_definidas' && 'Audiência concluída. Trava a escolha e consolida alocações.'}
                    {statusLote === 'em_escolha' && 'Candidatos convocados podem manifestar preferências.'}
                    {statusLote === 'aberto' && 'Lote em preparação administrativa.'}
                    {statusLote === 'encerrado' && 'Lote finalizado com nomeações publicadas.'}
                  </span>
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1 flex items-center justify-between">
                    <span>Data da Convocação:</span>
                    <span className="text-[10px] text-slate-400 font-normal">dia/mês/ano ou mês/ano</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: 15/10/2026 ou Outubro/2026"
                    value={dataConvocacao}
                    onChange={(e) => setDataConvocacao(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono focus:border-teal-600 outline-hidden"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    Data do edital de chamamento deste lote (definida ou previsão).
                  </span>
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1 flex items-center justify-between">
                    <span>Data da Audiência de Escolha:</span>
                    <span className="text-[10px] text-slate-400 font-normal">dia/mês/ano ou mês/ano</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: 22/10/2026"
                    value={dataAudiencia}
                    onChange={(e) => setDataAudiencia(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono focus:border-teal-600 outline-hidden"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    Data da sessão de alocação de comarcas (definida ou previsão).
                  </span>
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1 flex items-center justify-between">
                    <span>Data Oficial da Nomeação:</span>
                    <span className="text-[10px] text-slate-400 font-normal">dia/mês/ano ou mês/ano</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: 29/10/2026"
                    value={dataNomeacao}
                    onChange={(e) => setDataNomeacao(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono focus:border-teal-600 outline-hidden"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    Data da publicação em DOE / Posse (definida ou previsão).
                  </span>
                </div>
              </div>

              {/* Trava e Visibilidade */}
              <div className="flex flex-wrap items-center gap-4 px-2">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={ativo}
                    onChange={(e) => setAtivo(e.target.checked)}
                    className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 w-4 h-4 cursor-pointer"
                  />
                  <span className="font-semibold text-slate-800">Lote Ativo</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={travado}
                    onChange={(e) => {
                      const isChecked = e.target.checked;
                      setTravado(isChecked);
                      if (!isChecked && (statusLote === 'escolhas_definidas' || statusLote === 'encerrado')) {
                        setStatusLote('em_escolha');
                      } else if (isChecked && statusLote === 'em_escolha') {
                        setStatusLote('escolhas_definidas');
                      }
                    }}
                    className="rounded border-slate-300 text-amber-600 focus:ring-amber-500 w-4 h-4 cursor-pointer"
                  />
                  <span className="font-semibold text-amber-900 flex items-center gap-1">
                    <Lock className="w-3.5 h-3.5 text-amber-600" />
                    <span>Bloquear Escolhas (Travado)</span>
                  </span>
                </label>
              </div>

              {/* Seção de Comarcas do Lote */}
              <div className="space-y-3 pt-3 border-t border-slate-200">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                      <span>Comarcas &amp; Vagas Ofertadas</span>
                      <span className="px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 font-mono text-[10px] font-bold border border-teal-200">
                        {totalVagas} vagas no total ({comarcas.length} comarcas)
                      </span>
                    </h4>
                    <p className="text-2xs text-slate-500">
                      Adicione manualmente ou copie e cole a coluna do Excel com Comarca e Vagas.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setModalImportarComarcasAberto((v) => !v)}
                    className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold rounded-xl text-xs transition-colors cursor-pointer flex items-center gap-1.5 self-start sm:self-auto shrink-0"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
                    <span>{modalImportarComarcasAberto ? 'Fechar Importador' : '📋 Colar do Excel (Em Massa)'}</span>
                  </button>
                </div>

                {/* CAIXA DE IMPORTAÇÃO EM MASSA DE COMARCAS */}
                {modalImportarComarcasAberto && (
                  <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-200 space-y-3 animate-in fade-in-50">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-emerald-950 flex items-center gap-1.5">
                        <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                        <span>Importação em Massa de Comarcas (Copiar e Colar)</span>
                      </span>
                      <span className="text-[10px] text-emerald-800 font-mono">
                        Separado por Tabulação do Excel
                      </span>
                    </div>

                    <p className="text-2xs text-emerald-800 leading-relaxed">
                      Selecione e copie (Ctrl+C) as colunas do seu Excel contendo o <strong>Nome da Comarca</strong> e o <strong>Número de Vagas</strong> e cole (Ctrl+V) abaixo:
                    </p>

                    <textarea
                      rows={5}
                      placeholder={`Exemplo de conteúdo copiado do Excel:\nPorto Alegre\t15\nCanoas\t4\nPasso Fundo\t2\nCaxias do Sul\t6`}
                      value={textoColadoComarcas}
                      onChange={(e) => setTextoColadoComarcas(e.target.value)}
                      className="w-full p-3 bg-white border border-emerald-300 rounded-xl font-mono text-xs focus:outline-hidden focus:border-teal-700 text-slate-900"
                    />

                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-2xs text-slate-500 italic">
                        Aceita também formatos como &quot;Porto Alegre; 15&quot; ou apenas a lista com os nomes.
                      </span>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleProcessarImportacaoComarcas(false)}
                          className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-semibold rounded-xl text-xs cursor-pointer"
                        >
                          Acrescentar às Atuais
                        </button>
                        <button
                          type="button"
                          onClick={() => handleProcessarImportacaoComarcas(true)}
                          className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs shadow-xs cursor-pointer flex items-center gap-1"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Substituir &amp; Importar</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Inclusão Manual com Autocomplete do Catálogo */}
                <div className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-2xl border border-slate-200">
                  <input
                    type="text"
                    list="catalogo-lotacoes-lote"
                    placeholder={`Nome da ${tipoLotacao} (selecione ou digite nova)`}
                    value={novaComarcaNome}
                    onChange={(e) => setNovaComarcaNome(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAdicionarComarcaManual();
                      }
                    }}
                    className="grow px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs focus:border-teal-600 outline-hidden"
                  />
                  <datalist id="catalogo-lotacoes-lote">
                    {concurso?.catalogo_lotacoes?.map((item) => (
                      <option key={item.id} value={item.nome} />
                    ))}
                  </datalist>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-2xs text-slate-400 font-bold">Vagas:</span>
                    <input
                      type="number"
                      min="1"
                      value={novaComarcaVagas}
                      onChange={(e) => setNovaComarcaVagas(Math.max(1, Number(e.target.value) || 1))}
                      className="w-16 px-2 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-center"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAdicionarComarcaManual}
                    className="px-3.5 py-1.5 bg-teal-700 hover:bg-teal-800 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer flex items-center gap-1 shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Incluir</span>
                  </button>
                </div>

                {/* Tabela de Comarcas */}
                <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-52 overflow-y-auto">
                  {comarcas.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-400">
                      Nenhuma comarca adicionada ainda. Use o botão &quot;Colar do Excel&quot; ou adicione manualmente acima.
                    </div>
                  ) : (
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 text-slate-700 font-semibold text-[11px] uppercase tracking-wider sticky top-0">
                        <tr>
                          <th className="py-2 px-3">Comarca</th>
                          <th className="py-2 px-3 w-28 text-center">Vagas</th>
                          <th className="py-2 px-3 w-16 text-center">Ação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {comarcas.map((c, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="py-2 px-3 font-semibold text-slate-800">{c.nome}</td>
                            <td className="py-2 px-3 text-center">
                              <input
                                type="number"
                                min="0"
                                value={c.vagas}
                                onChange={(e) => {
                                  const val = Math.max(0, Number(e.target.value) || 0);
                                  setComarcas((prev) => {
                                    const copy = [...prev];
                                    copy[idx] = { ...copy[idx], vagas: val };
                                    return copy;
                                  });
                                }}
                                className="w-16 px-2 py-1 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono font-bold text-center"
                              />
                            </td>
                            <td className="py-2 px-3 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoverComarca(idx)}
                                className="p-1 text-slate-400 hover:text-rose-600 rounded-md cursor-pointer transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* =============================================================== */}
          {/* ABA 2: CANDIDATOS CONVOCADOS DO LOTE (IMPORTAÇÃO EM MASSA)      */}
          {/* =============================================================== */}
          {abaInterna === 'convocados' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                    <span>Lista Oficial de Convocados</span>
                    <span className="px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 font-mono text-[10px] font-bold border border-teal-200">
                      {convocados.length} convocados ({totalTitulares} titulares, {totalSuplentes} suplentes)
                    </span>
                  </h4>
                  <p className="text-2xs text-slate-500">
                    Fixa a ordem de nomeação e vincula os candidatos chamados pelo órgão neste lote.
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setSeletorListaCargoAberto((v) => !v)}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 font-bold rounded-xl text-xs transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Users className="w-3.5 h-3.5 text-teal-700" />
                    <span>{seletorListaCargoAberto ? 'Ocultar Lista do Cargo' : 'Selecionar da Lista do Cargo'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setModalImportarConvocadosAberto((v) => !v)}
                    className="px-3.5 py-1.5 bg-teal-700 hover:bg-teal-800 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer flex items-center gap-1.5 shrink-0 shadow-xs"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>{modalImportarConvocadosAberto ? 'Fechar Importador' : '📋 Colar Convocados do Excel'}</span>
                  </button>
                </div>
              </div>

              {/* SELETOR MANUAL DIRETO NA LISTA DE CLASSIFICAÇÃO DO CARGO (Item 6) */}
              {seletorListaCargoAberto && (
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                        <Users className="w-4 h-4 text-teal-700" />
                        <span>
                          Lista de Classificação do Cargo ({candidatosDoCargo.length} aprovados cadastrados)
                        </span>
                      </span>
                      <p className="text-[11px] text-slate-500">
                        Selecione manualmente na lista de classificação os candidatos que integram este lote (Ampla e Cotas).
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[11px] font-bold text-slate-600">Papel ao selecionar:</span>
                      <select
                        value={papelPadraoFaixa}
                        onChange={(e) => setPapelPadraoFaixa(e.target.value as 'Titular' | 'Suplente')}
                        className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800"
                      >
                        <option value="Titular">Titular</option>
                        <option value="Suplente">Suplente</option>
                      </select>
                    </div>
                  </div>

                  {/* Barra de Busca e Filtros por Cota, Status de Seleção e Limite de Linhas */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 p-2.5 bg-white rounded-xl border border-slate-200 items-center">
                    <div className="sm:col-span-5 relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                      <input
                        type="text"
                        placeholder="Buscar por nome, posição ou CPF..."
                        value={buscaCandCargo}
                        onChange={(e) => setBuscaCandCargo(e.target.value)}
                        className="w-full pl-8 pr-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:bg-white focus:border-teal-600 outline-hidden"
                      />
                    </div>

                    <div className="sm:col-span-3">
                      <select
                        value={filtroCotaCargo}
                        onChange={(e) => setFiltroCotaCargo(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700"
                      >
                        <option value="todas">Todas as Cotas / Listas</option>
                        <option value="Ampla">Ampla Concorrência</option>
                        <option value="PPP">Cota PPP / Negros</option>
                        <option value="PCD">Cota PCD</option>
                        <option value="Indígena">Cota Indígena</option>
                        <option value="Trans">Cota Trans</option>
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <select
                        value={filtroSelecaoCargo}
                        onChange={(e) => setFiltroSelecaoCargo(e.target.value as any)}
                        className="w-full px-2 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700"
                      >
                        <option value="todos">Todos</option>
                        <option value="selecionados">No Lote ({convocados.length})</option>
                        <option value="nao_selecionados">Não Selecionados</option>
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <select
                        value={limiteListaCargo}
                        onChange={(e) =>
                          setLimiteListaCargo(
                            e.target.value === 'todos' ? 'todos' : (Number(e.target.value) as any)
                          )
                        }
                        className="w-full px-2 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-700"
                        title="Quantidade de candidatos exibidos na lista"
                      >
                        <option value={100}>Exibir 100</option>
                        <option value={250}>Exibir 250</option>
                        <option value={500}>Exibir 500</option>
                        <option value="todos">Exibir Todos</option>
                      </select>
                    </div>
                  </div>

                  {/* Lista de Classificação do Cargo para Seleção Manual */}
                  <div className="max-h-64 overflow-y-auto border border-slate-200 rounded-xl bg-white divide-y divide-slate-100">
                    {candidatosDoCargo.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-400">
                        Nenhum candidato importado na lista de classificação deste cargo ainda.
                      </div>
                    ) : (
                      (() => {
                        const filtrados = candidatosDoCargo.filter((c) => {
                          const termo = buscaCandCargo.trim().toLowerCase();
                          if (termo) {
                            const matchNome = normalizarNomeBusca(c.nome).includes(normalizarNomeBusca(termo));
                            const matchPos = String(c.posicao) === termo.replace(/\D/g, '');
                            const matchCpf = c.cpf && c.cpf.replace(/\D/g, '').includes(termo.replace(/\D/g, ''));
                            if (!matchNome && !matchPos && !matchCpf) return false;
                          }
                          if (filtroCotaCargo !== 'todas') {
                            const cotasCand = c.cotas && c.cotas.length > 0 ? c.cotas : [c.cota || 'Ampla'];
                            if (filtroCotaCargo === 'Ampla') {
                              if (c.cota !== 'Ampla' && !cotasCand.includes('Ampla')) return false;
                            } else if (!cotasCand.includes(filtroCotaCargo as any) && c.cota !== filtroCotaCargo) {
                              return false;
                            }
                          }
                          const estaNoLote = convocados.some(
                            (cv) =>
                              (cv.candidato_id && cv.candidato_id === c.id) ||
                              normalizarNomeBusca(cv.nome) === normalizarNomeBusca(c.nome)
                          );
                          if (filtroSelecaoCargo === 'selecionados' && !estaNoLote) return false;
                          if (filtroSelecaoCargo === 'nao_selecionados' && estaNoLote) return false;
                          return true;
                        });

                        const exibidos =
                          limiteListaCargo === 'todos' ? filtrados : filtrados.slice(0, limiteListaCargo);

                        if (exibidos.length === 0) {
                          return (
                            <div className="p-6 text-center text-xs text-slate-400">
                              Nenhum candidato encontrado para o filtro selecionado.
                            </div>
                          );
                        }

                        return exibidos.map((cand) => {
                          const convocadoItem = convocados.find(
                            (cv) =>
                              (cv.candidato_id && cv.candidato_id === cand.id) ||
                              normalizarNomeBusca(cv.nome) === normalizarNomeBusca(cand.nome)
                          );
                          const selecionado = Boolean(convocadoItem);
                          const infoVinculo = userRegistryStore.verificarVinculoCandidato(cand);
                          const cotasBadge = (
                            cand.cotas && cand.cotas.length > 0 ? cand.cotas : [cand.cota || 'Ampla']
                          )
                            .filter((ct, _, arr) => arr.length === 1 || ct !== 'Ampla')
                            .join(' + ');

                          return (
                            <div
                              key={cand.id}
                              onClick={() => handleToggleCandidatoDaLista(cand, papelPadraoFaixa)}
                              className={`px-3 py-2 flex items-center justify-between gap-2 text-xs hover:bg-slate-50 cursor-pointer transition-colors ${
                                selecionado ? 'bg-teal-50/70' : ''
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <input
                                  type="checkbox"
                                  checked={selecionado}
                                  onChange={() => {}}
                                  className="rounded border-slate-300 text-teal-600 cursor-pointer w-4 h-4 shrink-0"
                                />
                                <span className="font-mono font-bold text-slate-700 w-10 shrink-0">
                                  {cand.posicao}º
                                </span>
                                <span className="font-semibold text-slate-900 truncate">{cand.nome}</span>
                                <span
                                  className={`px-1.5 py-0.5 rounded font-mono text-[10px] font-bold shrink-0 ${
                                    cotasBadge.includes('PCD') && cotasBadge.includes('PPP')
                                      ? 'bg-purple-100 text-purple-900 border border-purple-300'
                                      : cotasBadge.includes('PCD')
                                      ? 'bg-purple-50 text-purple-800 border border-purple-200'
                                      : cotasBadge.includes('PPP')
                                      ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                      : 'bg-slate-100 text-slate-600'
                                  }`}
                                >
                                  {cotasBadge || 'Ampla'}
                                </span>
                                {infoVinculo.vinculado ? (
                                  <span
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 shrink-0"
                                    title={`Usuário vinculado: ${infoVinculo.usuario?.email || infoVinculo.usuario?.nome}`}
                                  >
                                    <UserCheck className="w-3 h-3 text-emerald-700" />
                                    <span>Conta Vinculada</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500 border border-slate-200 shrink-0">
                                    <span>Sem acesso ainda</span>
                                  </span>
                                )}
                              </div>

                              <div
                                className="flex items-center gap-1.5 shrink-0"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {selecionado ? (
                                  <>
                                    <span className="px-2 py-0.5 rounded bg-teal-100 text-teal-900 font-mono text-[10px] font-bold">
                                      {convocadoItem?.ordem_nomeacao}º • {convocadoItem?.papel}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => handleToggleCandidatoDaLista(cand)}
                                      className="px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200"
                                    >
                                      Remover
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => handleToggleCandidatoDaLista(cand, 'Titular')}
                                      className="px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer bg-teal-50 text-teal-800 hover:bg-teal-100 border border-teal-200"
                                    >
                                      + Titular
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleToggleCandidatoDaLista(cand, 'Suplente')}
                                      className="px-2 py-1 rounded-lg text-[11px] font-semibold cursor-pointer bg-cyan-50 text-cyan-800 hover:bg-cyan-100 border border-cyan-200"
                                    >
                                      + Suplente
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        });
                      })()
                    )}
                  </div>
                </div>
              )}

              {/* CAIXA DE IMPORTAÇÃO EM MASSA DE CONVOCADOS VIA TEXTO EXCEL */}
              {modalImportarConvocadosAberto && (
                <div className="p-4 bg-teal-50/50 rounded-2xl border border-teal-200 space-y-3 animate-in fade-in-50">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-teal-950 flex items-center gap-1.5">
                      <FileSpreadsheet className="w-4 h-4 text-teal-700" />
                      <span>Importar Convocados da Planilha (Colunas do Excel)</span>
                    </span>
                    <span className="text-[10px] text-teal-800 font-mono">
                      Ordem • Nome • Cota/Ampla • Titular/Suplente
                    </span>
                  </div>

                  <p className="text-2xs text-teal-900 leading-relaxed">
                    Copie as colunas do Excel com: <strong>Ordem de Nomeação</strong>, <strong>Nome Completo</strong>,{' '}
                    <strong>Tipo de Vaga (Ampla, CN/PPP, PCD, Indígena, Trans)</strong> e{' '}
                    <strong>Titular ou Suplente</strong>. O sistema verificará automaticamente se todos os nomes constam na lista de classificação deste cargo:
                  </p>

                  <textarea
                    rows={6}
                    placeholder={`1\tCarlos Eduardo Silveira\tAmpla\tTitular\n2\tMariana Rocha Santos\tCN\tTitular\n3\tRoberto Lima\tPCD\tTitular\n4\tKamila Guarani\tIndígena\tTitular\n5\tLorena Miller\tTrans\tTitular\n6\tFernanda Souza\tPPP\tSuplente`}
                    value={textoColadoConvocados}
                    onChange={(e) => {
                      setTextoColadoConvocados(e.target.value);
                      if (questionamentoNaoEncontrados) setQuestionamentoNaoEncontrados(null);
                    }}
                    className="w-full p-3 bg-white border border-teal-300 rounded-xl font-mono text-xs focus:outline-hidden focus:border-teal-700 text-slate-900"
                  />

                  {/* ALERTA / QUESTIONAMENTO SE ALGUM CANDIDATO COLADO NÃO EXISTIR NA LISTA DE CLASSIFICAÇÃO DO CARGO (Item 6) */}
                  {questionamentoNaoEncontrados && (
                    <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-2xl space-y-3 animate-in fade-in-50">
                      <div className="flex items-start gap-2.5 text-amber-950">
                        <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <span className="font-bold text-xs block">
                            Atenção: {questionamentoNaoEncontrados.naoEncontrados.length} candidato(s) colado(s) não foram localizados na lista de classificação deste cargo!
                          </span>
                          <p className="text-[11px] text-amber-800 leading-relaxed">
                            Dos <strong>{questionamentoNaoEncontrados.todos.length}</strong> nomes informados no texto,{' '}
                            <strong>{questionamentoNaoEncontrados.apenasReconhecidos.length}</strong> constam na lista de classificação do cargo e{' '}
                            <strong>{questionamentoNaoEncontrados.naoEncontrados.length}</strong> não foram encontrados:
                          </p>
                        </div>
                      </div>

                      <div className="max-h-28 overflow-y-auto bg-white/90 border border-amber-200 rounded-xl p-2.5 divide-y divide-amber-100">
                        {questionamentoNaoEncontrados.naoEncontrados.map((nc, i) => (
                          <div key={i} className="py-1 flex items-center justify-between text-[11px] text-amber-950">
                            <span className="font-mono font-bold">
                              {nc.ordem_nomeacao}º — {nc.nome}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold">
                              Não consta na lista do cargo
                            </span>
                          </div>
                        ))}
                      </div>

                      <p className="text-[11px] font-bold text-amber-900">
                        Como você deseja prosseguir com esta importação?
                      </p>

                      <div className="flex flex-wrap items-center gap-2">
                        {questionamentoNaoEncontrados.apenasReconhecidos.length > 0 && (
                          <button
                            type="button"
                            onClick={() =>
                              concluirImportacaoConvocados(
                                questionamentoNaoEncontrados.apenasReconhecidos,
                                questionamentoNaoEncontrados.substituir
                              )
                            }
                            className="px-3.5 py-1.5 bg-teal-700 hover:bg-teal-800 text-white font-bold rounded-xl text-xs cursor-pointer shadow-xs"
                          >
                            Importar Apenas os {questionamentoNaoEncontrados.apenasReconhecidos.length} Reconhecidos na Lista
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() =>
                            concluirImportacaoConvocados(
                              questionamentoNaoEncontrados.todos,
                              questionamentoNaoEncontrados.substituir
                            )
                          }
                          className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs cursor-pointer shadow-xs"
                        >
                          Importar Todos os {questionamentoNaoEncontrados.todos.length} Mesmo Assim
                        </button>

                        <button
                          type="button"
                          onClick={() => setQuestionamentoNaoEncontrados(null)}
                          className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-semibold rounded-xl text-xs cursor-pointer"
                        >
                          Cancelar e Revisar Texto
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-2xs text-slate-500 italic">
                      Dica: O sistema reconhece automaticamente variações como &quot;CN&quot; e &quot;PPP&quot; (Negros), PCD, Indígena, Trans e Ampla Concorrência.
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleProcessarImportacaoConvocados(false)}
                        className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-semibold rounded-xl text-xs cursor-pointer"
                      >
                        Acrescentar à Lista
                      </button>
                      <button
                        type="button"
                        onClick={() => handleProcessarImportacaoConvocados(true)}
                        className="px-3.5 py-1.5 bg-teal-800 hover:bg-teal-900 text-white font-bold rounded-xl text-xs shadow-xs cursor-pointer flex items-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Substituir &amp; Importar</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Tabela de Convocados do Lote */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-72 overflow-y-auto">
                {convocados.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400 space-y-2">
                    <Users className="w-8 h-8 mx-auto text-slate-300" />
                    <p>Nenhum candidato convocado configurado neste lote ainda.</p>
                    <p className="text-teal-700 font-semibold">
                      Selecione candidatos da lista do cargo acima ou cole do Excel.
                    </p>
                  </div>
                ) : (
                  <table className="w-full text-left text-xs divide-y divide-slate-100">
                    <thead className="bg-[#07192B] text-white font-semibold text-[11px] uppercase tracking-wider sticky top-0">
                      <tr>
                        <th className="py-2.5 px-3 w-16 text-center">Ordem</th>
                        <th className="py-2.5 px-3">Nome do Candidato</th>
                        <th className="py-2.5 px-3 text-center">Vínculo no Site</th>
                        <th className="py-2.5 px-3 text-center">Tipo de Vaga</th>
                        <th className="py-2.5 px-3 text-center">Papel</th>
                        <th className="py-2.5 px-3 w-16 text-center">Remover</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {convocados.map((cv, idx) => {
                        const infoVinculo = userRegistryStore.verificarVinculoCandidato({
                          id: cv.candidato_id,
                          nome: cv.nome,
                        });
                        return (
                          <tr key={idx} className="hover:bg-slate-50 transition-colors">
                            <td className="py-2 px-3 text-center font-mono font-bold text-slate-900">
                              {cv.ordem_nomeacao}º
                            </td>
                            <td className="py-2 px-3 font-semibold text-slate-800">
                              {cv.nome}
                            </td>
                            <td className="py-2 px-3 text-center">
                              {infoVinculo.vinculado ? (
                                <span
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300"
                                  title={`Vinculado a: ${infoVinculo.usuario?.email || infoVinculo.usuario?.nome}`}
                                >
                                  <UserCheck className="w-3 h-3 text-emerald-700" />
                                  <span>Usuário Vinculado</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500 border border-slate-200">
                                  <span>Aguardando 1º Acesso</span>
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-center">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  cv.tipo_vaga === 'PCD'
                                    ? 'bg-purple-100 text-purple-900 border border-purple-200'
                                    : cv.tipo_vaga === 'PPP'
                                    ? 'bg-amber-100 text-amber-900 border border-amber-200'
                                    : cv.tipo_vaga === 'Indígena'
                                    ? 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                                    : cv.tipo_vaga === 'Trans'
                                    ? 'bg-pink-100 text-pink-900 border border-pink-200'
                                    : 'bg-slate-100 text-slate-700'
                                }`}
                              >
                                {cv.tipo_vaga === 'PPP' ? 'PPP / CN' : cv.tipo_vaga}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-center">
                              <select
                                value={cv.papel}
                                onChange={(e) => {
                                  const novoPapel = e.target.value as 'Titular' | 'Suplente';
                                  setConvocados((prev) => {
                                    const copy = [...prev];
                                    copy[idx] = { ...copy[idx], papel: novoPapel };
                                    return copy;
                                  });
                                }}
                                className={`px-2 py-0.5 rounded text-[10px] font-bold border cursor-pointer ${
                                  cv.papel === 'Titular'
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                    : 'bg-cyan-50 text-cyan-800 border-cyan-200'
                                }`}
                              >
                                <option value="Titular">Titular</option>
                                <option value="Suplente">Suplente</option>
                              </select>
                            </td>
                            <td className="py-2 px-3 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoverConvocado(idx)}
                                className="p-1 text-slate-400 hover:text-rose-600 rounded-md cursor-pointer transition-colors"
                                title="Remover convocado"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* RODAPÉ DO MODAL */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2.5">
            <span className="text-2xs text-slate-500">
              {convocados.length > 0 && `Ao salvar, ${convocados.length} convocados serão vinculados ao certame.`}
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-slate-300 hover:bg-slate-50 rounded-xl text-slate-700 font-semibold cursor-pointer transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 bg-[#07192B] hover:bg-[#0C2640] text-[#2DD4AA] font-bold rounded-xl shadow-md cursor-pointer transition-all flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>{isEdicao ? 'Salvar Alterações do Lote' : 'Criar Lote de Convocação'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
