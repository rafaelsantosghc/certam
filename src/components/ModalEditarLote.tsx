import React, { useState, useEffect } from 'react';
import { Lote, CandidatoConvocadoLote, StatusLote, Candidato } from '../types';
import { lotesStore } from '../store/lotesStore';
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

  const [abaInterna, setAbaInterna] = useState<'dados_comarcas' | 'convocados'>('dados_comarcas');

  const [nome, setNome] = useState('');
  const [numeroLote, setNumeroLote] = useState<string>('1');
  const [ativo, setAtivo] = useState(true);
  const [travado, setTravado] = useState(false);
  const [statusLote, setStatusLote] = useState<StatusLote>('em_escolha');
  const [dataNomeacao, setDataNomeacao] = useState('');
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
  const [textoColadoConvocados, setTextoColadoConvocados] = useState('');

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
      setTravado(lote.travado ?? false);
      setStatusLote(lote.status_lote || (lote.travado ? 'escolhas_definidas' : 'em_escolha'));
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

    setTextoColadoComarcas('');
    setModalImportarComarcasAberto(false);
    setSucessoMsg(`Sucesso! ${novasComarcas.length} comarcas processadas da planilha.`);
    setErro(null);
  };

  // --------------------------------------------------------------------------
  // PARSER DE CANDIDATOS CONVOCADOS COLADOS DO EXCEL
  // --------------------------------------------------------------------------
  const handleProcessarImportacaoConvocados = (substituir: boolean) => {
    if (!textoColadoConvocados.trim()) {
      setErro('Cole as colunas de convocados da planilha do Excel antes de processar.');
      return;
    }

    const linhas = textoColadoConvocados.split(/\r?\n/).filter((l) => l.trim().length > 0);
    const novosConvocados: CandidatoConvocadoLote[] = [];

    let seqAuto = 1;
    for (const linha of linhas) {
      const linhaLower = linha.toLowerCase();
      // Ignorar cabeçalhos
      if (
        linhaLower.includes('ordem') ||
        linhaLower.includes('nomeação') ||
        (linhaLower.includes('candidato') && linhaLower.includes('vaga'))
      ) {
        continue;
      }

      // Separar colunas por tabulação (Excel), ponto-e-vírgula ou vírgula
      let colunas = linha.split('\t');
      if (colunas.length < 2) colunas = linha.split(';');
      if (colunas.length < 2) colunas = linha.split(',');

      if (colunas.length >= 2) {
        // Identificar colunas: Ordem, Nome, Tipo de Vaga, Titular/Suplente
        let ordem = parseInt(colunas[0].replace(/\D/g, ''), 10);
        let nomeCand = '';
        let tipoVaga = 'Ampla';
        let papel: 'Titular' | 'Suplente' = 'Titular';

        if (isNaN(ordem)) {
          // Se a 1ª coluna não for número, assume seqAuto e a 1ª coluna é o nome
          ordem = seqAuto++;
          nomeCand = colunas[0].trim();
          if (colunas[1]) tipoVaga = normalizarCota(colunas[1]);
          if (colunas[2]) papel = colunas[2].toLowerCase().includes('suplente') ? 'Suplente' : 'Titular';
        } else {
          seqAuto = Math.max(seqAuto, ordem + 1);
          nomeCand = colunas[1]?.trim() || '';

          const col2 = colunas[2] || '';
          const col3 = colunas[3] || '';

          // Detectar se a coluna 2 é papel ou cota
          const isCol2Papel = col2.toLowerCase().includes('titular') || col2.toLowerCase().includes('suplente');
          tipoVaga = normalizarCota(isCol2Papel ? col3 : col2);

          // Detectar Titular / Suplente
          if (col2.toLowerCase().includes('suplente') || col3.toLowerCase().includes('suplente')) {
            papel = 'Suplente';
          } else {
            papel = 'Titular';
          }
        }

        if (nomeCand) {
          novosConvocados.push({
            ordem_nomeacao: ordem,
            nome: nomeCand,
            tipo_vaga: tipoVaga,
            papel: papel,
          });
        }
      }
    }

    if (novosConvocados.length === 0) {
      setErro('Nenhum candidato válido identificado. Certifique-se de copiar as colunas de Ordem, Nome, Tipo de Vaga e Titular/Suplente.');
      return;
    }

    novosConvocados.sort((a, b) => a.ordem_nomeacao - b.ordem_nomeacao);

    if (substituir) {
      setConvocados(novosConvocados);
    } else {
      setConvocados((prev) => {
        const todos = [...prev, ...novosConvocados];
        todos.sort((a, b) => a.ordem_nomeacao - b.ordem_nomeacao);
        return todos;
      });
    }

    setTextoColadoConvocados('');
    setModalImportarConvocadosAberto(false);
    setSucessoMsg(`Sucesso! ${novosConvocados.length} candidatos convocados importados da planilha.`);
    setErro(null);
  };

  const handleAdicionarComarcaManual = () => {
    const nomeTrim = novaComarcaNome.trim();
    if (!nomeTrim) return;

    if (comarcas.some((c) => c.nome.toLowerCase() === nomeTrim.toLowerCase())) {
      setErro(`A comarca "${nomeTrim}" já foi adicionada a este lote.`);
      return;
    }

    setComarcas((prev) => [...prev, { nome: nomeTrim, vagas: Math.max(1, Number(novaComarcaVagas) || 1) }]);
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

    const loteAtualizado: Lote = {
      id: finalId,
      concurso_id: concursoId,
      cargo_id: cargoId,
      nome: nomeFinal,
      numero_lote: numLimpo,
      ativo,
      travado: travado || statusLote === 'escolhas_definidas' || statusLote === 'encerrado',
      status_lote: statusLote,
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

              {/* Status do Lote e Data da Nomeação */}
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-800 mb-1">Status Oficial do Lote:</label>
                  <select
                    value={statusLote}
                    onChange={(e) => setStatusLote(e.target.value as StatusLote)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-medium focus:border-teal-600 outline-hidden"
                  >
                    <option value="aberto">Aberto / Em Planejamento</option>
                    <option value="em_escolha">Em Escolha de Comarcas (Candidatos)</option>
                    <option value="escolhas_definidas">Escolhas Definidas (Audiência Concluída)</option>
                    <option value="encerrado">Encerrado / Nomeações Efetuadas</option>
                  </select>
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    {statusLote === 'escolhas_definidas' && 'Fixa as comarcas definitivas dos candidatos contemplados.'}
                  </span>
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1 flex items-center justify-between">
                    <span>Data Oficial da Nomeação:</span>
                    <span className="text-[10px] text-slate-400 font-normal">dia/mês/ano</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: 29/10/2026"
                    value={dataNomeacao}
                    onChange={(e) => setDataNomeacao(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono focus:border-teal-600 outline-hidden"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    Atualiza o status dos candidatos para &quot;Nomeado&quot; na lista de classificação.
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
                    onChange={(e) => setTravado(e.target.checked)}
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

                {/* Inclusão Manual */}
                <div className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-2xl border border-slate-200">
                  <input
                    type="text"
                    placeholder="Nome da Comarca (ex: Porto Alegre)"
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

                <button
                  type="button"
                  onClick={() => setModalImportarConvocadosAberto((v) => !v)}
                  className="px-3.5 py-1.5 bg-teal-700 hover:bg-teal-800 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer flex items-center gap-1.5 self-start sm:self-auto shrink-0 shadow-xs"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>{modalImportarConvocadosAberto ? 'Fechar Importador' : '📋 Colar Convocados do Excel'}</span>
                </button>
              </div>

              {/* CAIXA DE IMPORTAÇÃO EM MASSA DE CONVOCADOS */}
              {modalImportarConvocadosAberto && (
                <div className="p-4 bg-teal-50/50 rounded-2xl border border-teal-200 space-y-3 animate-in fade-in-50">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-teal-950 flex items-center gap-1.5">
                      <FileSpreadsheet className="w-4 h-4 text-teal-700" />
                      <span>Importar Convocados da Planilha (4 Colunas)</span>
                    </span>
                    <span className="text-[10px] text-teal-800 font-mono">Ordem • Nome • Cota/Ampla • Titular/Suplente</span>
                  </div>

                  <p className="text-2xs text-teal-900 leading-relaxed">
                    Copie as colunas do Excel com: <strong>Ordem de Nomeação</strong>, <strong>Nome Completo</strong>, <strong>Tipo de Vaga (Ampla, CN/PPP, PCD, Indígena, Trans)</strong> e <strong>Titular ou Suplente</strong>:
                  </p>

                  <textarea
                    rows={6}
                    placeholder={`1\tCarlos Eduardo Silveira\tAmpla\tTitular\n2\tMariana Rocha Santos\tCN\tTitular\n3\tRoberto Lima\tPCD\tTitular\n4\tKamila Guarani\tIndígena\tTitular\n5\tLorena Miller\tTrans\tTitular\n6\tFernanda Souza\tPPP\tSuplente`}
                    value={textoColadoConvocados}
                    onChange={(e) => setTextoColadoConvocados(e.target.value)}
                    className="w-full p-3 bg-white border border-teal-300 rounded-xl font-mono text-xs focus:outline-hidden focus:border-teal-700 text-slate-900"
                  />

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
                    <p>Nenhum candidato convocado importado neste lote ainda.</p>
                    <p className="text-teal-700 font-semibold">
                      Clique no botão &quot;📋 Colar Convocados do Excel&quot; acima para importar em massa.
                    </p>
                  </div>
                ) : (
                  <table className="w-full text-left text-xs divide-y divide-slate-100">
                    <thead className="bg-[#07192B] text-white font-semibold text-[11px] uppercase tracking-wider sticky top-0">
                      <tr>
                        <th className="py-2.5 px-3 w-16 text-center">Ordem</th>
                        <th className="py-2.5 px-3">Nome do Candidato</th>
                        <th className="py-2.5 px-3 text-center">Tipo de Vaga</th>
                        <th className="py-2.5 px-3 text-center">Papel</th>
                        <th className="py-2.5 px-3 w-16 text-center">Remover</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {convocados.map((cv, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2 px-3 text-center font-mono font-bold text-slate-900">
                            {cv.ordem_nomeacao}º
                          </td>
                          <td className="py-2 px-3 font-semibold text-slate-800">
                            {cv.nome}
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
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                cv.papel === 'Titular'
                                  ? 'bg-emerald-50 text-emerald-800'
                                  : 'bg-cyan-50 text-cyan-800'
                              }`}
                            >
                              {cv.papel}
                            </span>
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
                      ))}
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
