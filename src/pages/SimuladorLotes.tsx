import React, { useState, useMemo, useEffect } from 'react';
import { lotesStore } from '../store/lotesStore';
import { userRegistryStore } from '../store/userRegistryStore';
import { useAuth } from '../store/authContext';
import { COMARCAS_RS } from '../data/comarcas';
import { Candidato, Lote, Comarca } from '../types';
import { ModalEditarLote } from '../components/ModalEditarLote';
import * as XLSX from 'xlsx';
import {
  FileText,
  BarChart,
  Grid,
  MapPin,
  Printer,
  Shield,
  Save,
  CheckCircle2,
  Lock,
  Unlock,
  Download,
  ArrowUp,
  ArrowDown,
  Trash2,
  ArrowLeft,
  UserCheck,
  Pencil,
} from 'lucide-react';

interface SimuladorLotesProps {
  concursoId?: string;
  cargoId?: string;
  loteId?: string;
  onNavigate: (view: string, params?: { concursoId?: string; cargoId?: string; tab?: string; loteId?: string }) => void;
  onVoltar?: () => void;
}

export const SimuladorLotes: React.FC<SimuladorLotesProps> = ({
  concursoId = 'tjrs_2025',
  cargoId = 'analista_judiciario',
  loteId,
  onNavigate,
  onVoltar,
}) => {
  const { usuario, isAdmin, loginGoogle } = useAuth();

  const [lotes, setLotes] = useState<Lote[]>(() => lotesStore.getLotes());

  useEffect(() => {
    const syncLotes = () => setLotes(lotesStore.getLotes());
    window.addEventListener('storage', syncLotes);
    window.addEventListener('certam_lotes_updated', syncLotes);
    return () => {
      window.removeEventListener('storage', syncLotes);
      window.removeEventListener('certam_lotes_updated', syncLotes);
    };
  }, []);

  const lotesDoCargo = useMemo(() => {
    const filtrados = lotes.filter(
      (l) => l.concurso_id === concursoId && (!l.cargo_id || l.cargo_id === cargoId)
    );
    return filtrados.length > 0 ? filtrados : lotes;
  }, [lotes, concursoId, cargoId]);

  const [loteAtivoId, setLoteAtivoId] = useState<string>(() => {
    if (loteId) {
      const achado = lotes.find((l) => l.id === loteId);
      if (achado) return achado.id;
    }
    const doCargo = lotes.filter(
      (l) => l.concurso_id === concursoId && (!l.cargo_id || l.cargo_id === cargoId)
    );
    return doCargo[0]?.id || lotes[0]?.id || '';
  });

  useEffect(() => {
    if (loteId) {
      const achado = lotes.find((l) => l.id === loteId);
      if (achado) {
        setLoteAtivoId(achado.id);
        return;
      }
    }
    if (!lotes.some((l) => l.id === loteAtivoId)) {
      setLoteAtivoId(lotesDoCargo[0]?.id || lotes[0]?.id || '');
    }
  }, [loteId, lotes, lotesDoCargo, loteAtivoId]);

  const loteAtivo = useMemo(() => {
    if (loteId) {
      const porProp = lotes.find((l) => l.id === loteId);
      if (porProp && (!loteAtivoId || loteAtivoId === loteId)) return porProp;
    }
    return lotes.find((l) => l.id === loteAtivoId) || lotesDoCargo[0] || lotes[0] || null;
  }, [lotes, loteAtivoId, loteId, lotesDoCargo]);

  const concursoEfetivoId = loteAtivo?.concurso_id || concursoId;
  const cargoEfetivoId = loteAtivo?.cargo_id || cargoId;

  const [modalConfigurarLoteAberto, setModalConfigurarLoteAberto] = useState(false);

  const [abaAtiva, setAbaAtiva] = useState<'formulario' | 'dashboard' | 'geral' | 'comarcas' | 'impressao' | 'admin'>('formulario');

  // Candidatos do Cargo do Lote
  const [candidatos, setCandidatos] = useState<Candidato[]>(() =>
    lotesStore.getCandidatos(concursoEfetivoId, cargoEfetivoId)
  );

  useEffect(() => {
    const syncCandidatos = () => {
      setCandidatos(lotesStore.getCandidatos(concursoEfetivoId, cargoEfetivoId));
    };
    syncCandidatos();
    window.addEventListener('storage', syncCandidatos);
    window.addEventListener('certam_candidatos_updated', syncCandidatos);
    return () => {
      window.removeEventListener('storage', syncCandidatos);
      window.removeEventListener('certam_candidatos_updated', syncCandidatos);
    };
  }, [concursoEfetivoId, cargoEfetivoId]);

  const normalizarNome = (str?: string) =>
    (str || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();

  // Item 6: Verificar estritamente se o usuário logado é um candidato contemplado neste lote
  const isCandidatoContempladoNesteLote = useMemo(() => {
    if (!usuario || !loteAtivo) return false;

    const cpfLimpo = usuario.cpf ? usuario.cpf.replace(/\D/g, '') : '';
    const nomeLimpo = normalizarNome(usuario.nome);
    const emailLimpo = usuario.email ? usuario.email.trim().toLowerCase() : '';

    const cand = candidatos.find((c) => {
      if (usuario.candidato_id && c.id && c.id === usuario.candidato_id) return true;
      if (cpfLimpo.length >= 6 && c.cpf) {
        const cpfCandLimpo = c.cpf.replace(/\D/g, '');
        if (cpfCandLimpo.length >= 6 && cpfCandLimpo === cpfLimpo) return true;
      }
      if (emailLimpo && c.email && c.email.trim().toLowerCase() === emailLimpo) return true;
      if (nomeLimpo.length >= 3 && c.nome && normalizarNome(c.nome) === nomeLimpo) return true;
      return false;
    });

    if (!cand) return false;

    // Verificar estritamente na relação de convocados ou candidatos_ids do lote
    if (loteAtivo.convocados && loteAtivo.convocados.length > 0) {
      return loteAtivo.convocados.some(
        (cv) =>
          (cv.candidato_id && cv.candidato_id === cand.id) ||
          normalizarNome(cv.nome) === normalizarNome(cand.nome)
      );
    }

    if (loteAtivo.candidatos_ids && loteAtivo.candidatos_ids.length > 0) {
      return Boolean(
        loteAtivo.candidatos_ids.includes(cand.id) ||
          loteAtivo.candidatos_ids.some((idOuNome) => normalizarNome(idOuNome) === normalizarNome(cand.nome))
      );
    }

    return false;
  }, [usuario, loteAtivo, candidatos]);

  const temPermissaoAcesso = isCandidatoContempladoNesteLote || isAdmin;

  // Comarcas do lote ativo (ou fallback para COMARCAS_RS se não houver comarcas configuradas)
  const comarcasDoLote = useMemo<Comarca[]>(() => {
    if (loteAtivo && loteAtivo.comarcas && loteAtivo.comarcas.length > 0) {
      return loteAtivo.comarcas.map((c, idx) => {
        const ref = COMARCAS_RS.find((r) => r.nome.toLowerCase() === c.nome.toLowerCase());
        return {
          id: ref?.id ?? idx + 1000,
          nome: c.nome,
          regiao: ref?.regiao || 'Metropolitana',
          vagas_total: c.vagas,
        };
      });
    }
    return COMARCAS_RS;
  }, [loteAtivo]);

  // Filtrar os candidatos contemplados neste lote para a simulação
  const candidatosContempladosNoLote = useMemo(() => {
    if (!loteAtivo) return [];
    if (loteAtivo.convocados && loteAtivo.convocados.length > 0) {
      return candidatos.filter((c) =>
        loteAtivo.convocados!.some(
          (cv) =>
            (cv.candidato_id && cv.candidato_id === c.id) ||
            normalizarNome(cv.nome) === normalizarNome(c.nome)
        )
      );
    }
    if (loteAtivo.candidatos_ids && loteAtivo.candidatos_ids.length > 0) {
      return candidatos.filter(
        (c) =>
          loteAtivo.candidatos_ids.includes(c.id) ||
          loteAtivo.candidatos_ids.some((idOuNome) => normalizarNome(idOuNome) === normalizarNome(c.nome))
      );
    }
    return [];
  }, [candidatos, loteAtivo]);

  // Executa Simulação em Tempo Real apenas com os candidatos contemplados no lote
  const simulacao = useMemo(() => {
    return lotesStore.simularLotacao(candidatosContempladosNoLote, comarcasDoLote);
  }, [candidatosContempladosNoLote, comarcasDoLote]);

  // Candidato Logado
  const candidatoLogado = useMemo<Candidato | null>(() => {
    if (!usuario) return null;
    const cpfLimpo = usuario.cpf ? usuario.cpf.replace(/\D/g, '') : '';
    const nomeLimpo = normalizarNome(usuario.nome);
    const emailLimpo = usuario.email ? usuario.email.trim().toLowerCase() : '';

    const match = candidatos.find((c) => {
      if (usuario.candidato_id && c.id && c.id === usuario.candidato_id) return true;
      if (cpfLimpo.length >= 6 && c.cpf) {
        const cpfCandLimpo = c.cpf.replace(/\D/g, '');
        if (cpfCandLimpo.length >= 6 && cpfCandLimpo === cpfLimpo) return true;
      }
      if (emailLimpo && c.email && c.email.trim().toLowerCase() === emailLimpo) return true;
      if (nomeLimpo.length >= 3 && c.nome && normalizarNome(c.nome) === nomeLimpo) return true;
      return false;
    });
    if (match) return match;

    const novoCandidato: Candidato = {
      id: usuario.candidato_id || 'cand-novo',
      posicao: 999,
      nome: usuario.nome || '',
      email: usuario.email || '',
      whatsapp: usuario.whatsapp || usuario.telefone || '',
      cpf: usuario.cpf || '',
      cota: 'Ampla',
      nota_final: 0,
      intencao: 'Sim',
      status: 'Aguardando',
      lotacao_atual: '',
      comarca_desejada_1: comarcasDoLote[0]?.nome || 'Porto Alegre',
      escolhas_comarcas: comarcasDoLote.slice(0, 3).map((c) => c.nome),
      fg_cc: {
        possui: false,
        registro_funcional: '',
        cargo_atual: '',
        comarca_atual: '',
        pretende_continuar: 'Sim',
      },
    };
    return novoCandidato;
  }, [usuario, candidatos, comarcasDoLote]);

  // Form de Manifestação do Candidato
  const [intencao, setIntencao] = useState<Candidato['intencao']>(
    candidatoLogado?.intencao || 'Sim'
  );
  const [nomeCandidato, setNomeCandidato] = useState(candidatoLogado?.nome || '');
  const [cpfCandidato, setCpfCandidato] = useState(candidatoLogado?.cpf || '');
  const [whatsappCandidato, setWhatsappCandidato] = useState(candidatoLogado?.whatsapp || '');

  const [possuiFgCc, setPossuiFgCc] = useState(candidatoLogado?.fg_cc?.possui || false);
  const [fgRegistro, setFgRegistro] = useState(candidatoLogado?.fg_cc?.registro_funcional || '');
  const [fgCargo, setFgCargo] = useState(candidatoLogado?.fg_cc?.cargo_atual || '');
  const [fgComarca, setFgComarca] = useState(candidatoLogado?.fg_cc?.comarca_atual || '');
  const [fgPretendeContinuar, setFgPretendeContinuar] = useState(candidatoLogado?.fg_cc?.pretende_continuar || 'Sim');

  // Minhas escolhas de comarcas
  const [escolhasComarcas, setEscolhasComarcas] = useState<string[]>(() => {
    return candidatoLogado?.escolhas_comarcas || comarcasDoLote.slice(0, 3).map((c) => c.nome);
  });

  useEffect(() => {
    if (candidatoLogado) {
      setNomeCandidato(candidatoLogado.nome || '');
      setCpfCandidato(candidatoLogado.cpf || '');
      setWhatsappCandidato(candidatoLogado.whatsapp || '');
      setIntencao(candidatoLogado.intencao || 'Sim');
      if (candidatoLogado.escolhas_comarcas && candidatoLogado.escolhas_comarcas.length > 0) {
        setEscolhasComarcas(candidatoLogado.escolhas_comarcas);
      }
      if (candidatoLogado.fg_cc) {
        setPossuiFgCc(candidatoLogado.fg_cc.possui || false);
        setFgRegistro(candidatoLogado.fg_cc.registro_funcional || '');
        setFgCargo(candidatoLogado.fg_cc.cargo_atual || '');
        setFgComarca(candidatoLogado.fg_cc.comarca_atual || '');
        setFgPretendeContinuar(candidatoLogado.fg_cc.pretende_continuar || 'Sim');
      }
    } else {
      setNomeCandidato('');
      setCpfCandidato('');
      setWhatsappCandidato('');
    }
  }, [candidatoLogado]);

  // Filtro Comarcas
  const [buscaComarcaDisponivel, setBuscaComarcaDisponivel] = useState('');
  const comarcasDisponiveis = useMemo(() => {
    return comarcasDoLote.filter(
      (c) =>
        !escolhasComarcas.includes(c.nome) &&
        (!buscaComarcaDisponivel.trim() ||
          c.nome.toLowerCase().includes(buscaComarcaDisponivel.toLowerCase()))
    );
  }, [comarcasDoLote, escolhasComarcas, buscaComarcaDisponivel]);

  // Toast
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  // Salvar Escolha e Manifestação
  const handleSalvarManifestacao = (e: React.FormEvent) => {
    e.preventDefault();
    if (!candidatoLogado) return;

    const atualizado: Candidato = {
      ...candidatoLogado,
      nome: nomeCandidato || candidatoLogado.nome,
      cpf: cpfCandidato || candidatoLogado.cpf,
      whatsapp: whatsappCandidato || candidatoLogado.whatsapp,
      intencao,
      escolhas_comarcas: escolhasComarcas,
      comarca_desejada_1: escolhasComarcas[0] || candidatoLogado.comarca_desejada_1,
      status: intencao === 'Não' ? 'Desistência' : intencao === 'final_fila' ? 'Fim de Fila' : candidatoLogado.status,
      fg_cc: {
        possui: possuiFgCc,
        registro_funcional: fgRegistro,
        cargo_atual: fgCargo,
        comarca_atual: fgComarca,
        pretende_continuar: fgPretendeContinuar,
      },
    };

    lotesStore.salvarCandidato(concursoEfetivoId, cargoEfetivoId, atualizado);
    setCandidatos(lotesStore.getCandidatos(concursoEfetivoId, cargoEfetivoId));
    showToast('Manifestação e escolhas de comarca salvas com sucesso!');
  };

  // Reorder comarcas
  const moverComarca = (index: number, direcao: 'cima' | 'baixo') => {
    const novoArray = [...escolhasComarcas];
    const targetIndex = direcao === 'cima' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= novoArray.length) return;
    const temp = novoArray[index];
    novoArray[index] = novoArray[targetIndex];
    novoArray[targetIndex] = temp;
    setEscolhasComarcas(novoArray);
  };

  // Impressão A4 Colunas State
  const [colunasImpressao, setColunasImpressao] = useState<1 | 2 | 3 | 4 | 5>(3);

  // Admin Controles
  const [loteTravado, setLoteTravado] = useState(Boolean(loteAtivo?.travado));
  const [rankingVisivel, setRankingVisivel] = useState(Boolean(loteAtivo?.is_ranking_visible));

  useEffect(() => {
    if (loteAtivo) {
      setLoteTravado(Boolean(loteAtivo.travado));
      setRankingVisivel(Boolean(loteAtivo.is_ranking_visible));
    }
  }, [loteAtivo]);

  const toggleTravarLote = () => {
    if (!loteAtivo) return;
    const novoTravado = !loteTravado;
    setLoteTravado(novoTravado);
    loteAtivo.travado = novoTravado;
    lotesStore.salvarLotes(lotes);
    showToast(novoTravado ? 'Lote travado para manifestações!' : 'Lote destravado!');
  };

  const toggleRankingVisivel = () => {
    if (!loteAtivo) return;
    const novoVisivel = !rankingVisivel;
    setRankingVisivel(novoVisivel);
    loteAtivo.is_ranking_visible = novoVisivel;
    lotesStore.salvarLotes(lotes);
    showToast(novoVisivel ? 'Ranking liberado publicamente!' : 'Ranking ocultado dos candidatos!');
  };

  // Exportar Excel XLSX
  const exportarExcelSimulacao = () => {
    const dados = simulacao.alocacoes.map((a) => ({
      'Classificação': `${a.posicao}º`,
      'Nome do Candidato': a.candidatoNome,
      'Cota': a.cota,
      'Intenção': a.intencao,
      'Comarca Alocada': a.comarcaAlocada || 'Sem vaga',
      'Preferência': a.preferenciaNumero ? `${a.preferenciaNumero}ª opção` : '-',
      'Situação': a.status,
    }));

    const ws = XLSX.utils.json_to_sheet(dados);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Simulação Lote');
    XLSX.writeFile(wb, `CERTAM_Simulacao_${(loteAtivo?.nome || 'Lote').replace(/\s+/g, '_')}.xlsx`);
    showToast('Planilha Excel exportada com sucesso!');
  };

  if (!loteAtivo || !temPermissaoAcesso) {
    return (
      <div className="max-w-xl mx-auto my-12 p-8 bg-white rounded-3xl shadow-xl border border-slate-200 text-center space-y-5">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center mx-auto">
          <Lock className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <span className="px-3 py-1 rounded-lg bg-amber-100 text-amber-800 text-xs font-mono font-bold uppercase">
            Acesso Restrito ao Lote
          </span>
          <h2 className="text-xl sm:text-2xl font-bold font-serif text-slate-900">
            {loteAtivo?.numero_lote ? `Página do Lote ${loteAtivo.numero_lote}` : loteAtivo?.nome || 'Lote de Convocação'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
            Esta página e o formulário de manifestação de lotação são exclusivos para os candidatos convocados neste lote de convocação. Seu perfil ou classificação atual não consta na lista de convocados deste lote específico.
          </p>
        </div>

        {!usuario ? (
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
            <p className="text-xs text-slate-500">
              Faça login com sua conta Google para verificar sua convocação neste lote:
            </p>
            <button
              type="button"
              onClick={() => loginGoogle()}
              className="px-6 py-2.5 bg-[#07192B] hover:bg-[#0C2640] text-[#2DD4AA] font-bold text-xs rounded-xl shadow-md cursor-pointer transition-all"
            >
              Entrar com Google
            </button>
          </div>
        ) : (
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-600">
            Conta conectada: <strong className="text-slate-900">{usuario.email}</strong>.
            <br />
            Apenas os candidatos cadastrados na lista de convocados deste lote (e administradores) possuem acesso a esta página.
          </div>
        )}

        <div className="pt-2">
          <button
            type="button"
            onClick={onVoltar || (() => onNavigate('concurso', { concursoId: concursoEfetivoId, cargoId: cargoEfetivoId, tab: 'lotes' }))}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs cursor-pointer transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar para o Concurso</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[1880px] w-full mx-auto">
      {/* Botão Global de Voltar */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onVoltar || (() => onNavigate('concurso', { concursoId: concursoEfetivoId, cargoId: cargoEfetivoId, tab: 'lotes' }))}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 font-semibold text-xs border border-slate-200 shadow-xs cursor-pointer transition-all"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Voltar para o Concurso</span>
        </button>

        <span className="text-2xs text-slate-400 font-mono">
          CERTAM • Página do Lote e Audiência Pública
        </span>
      </div>

      {/* Aviso quando acesso foi liberado por ser Admin (Item 6) */}
      {isAdmin && !isCandidatoContempladoNesteLote && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl px-4 py-3 flex items-center justify-between gap-3 text-amber-950 shadow-2xs">
          <div className="flex items-center gap-2.5 text-xs">
            <Shield className="w-4 h-4 text-amber-700 shrink-0" />
            <span>
              <strong>Acesso liberado por ser Administrador:</strong> você está visualizando a página deste lote com permissão administrativa (seu usuário não consta como candidato contemplado neste lote).
            </span>
          </div>
          <span className="px-2.5 py-0.5 rounded-full bg-amber-200/80 text-amber-900 font-mono font-bold text-[10px] uppercase shrink-0">
            Modo Admin
          </span>
        </div>
      )}

      {/* Toast flutuante */}
      {toastMsg && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-xl text-xs font-semibold text-white bg-[#07192B] border border-[#2DD4AA]/40 animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-[#2DD4AA]" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* TOP HEADER DO LOTE */}
      <div className="bg-[#07192B] rounded-2xl border border-[#0F2942] p-5 sm:p-6 text-white shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-lg bg-teal-500/20 text-[#2DD4AA] border border-teal-500/30 font-mono font-bold text-xs uppercase">
              Lote de Convocação • {candidatosContempladosNoLote.length} Convocados
            </span>
            <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-emerald-500/20 text-emerald-300">
              {loteTravado ? '🔒 TRAVADO' : '🟢 ATIVO EM TEMPO REAL'}
            </span>
            {lotesDoCargo.length > 1 && (
              <select
                value={loteAtivo.id}
                onChange={(e) => setLoteAtivoId(e.target.value)}
                className="bg-[#0C2640] border border-teal-500/30 text-white font-semibold text-xs px-2.5 py-1 rounded-lg focus:outline-none cursor-pointer"
              >
                {lotesDoCargo.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.nome}
                  </option>
                ))}
              </select>
            )}
          </div>
          <h2 className="text-xl sm:text-2xl font-bold font-serif">{loteAtivo.nome}</h2>
          <p className="text-xs text-slate-300 mt-1">
            {simulacao.totalVagasOfertadas} vagas ofertadas em {comarcasDoLote.length} lotações •{' '}
            {simulacao.totalAssumem} manifestações ativas
          </p>
        </div>

        {/* Controles de Lote e Exportação */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={exportarExcelSimulacao}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-colors cursor-pointer border border-white/10"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar XLSX</span>
          </button>

          <button
            type="button"
            onClick={() => setAbaAtiva('impressao')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#2DD4AA] hover:bg-[#20BE96] text-slate-950 text-xs font-extrabold transition-colors cursor-pointer shadow-xs"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Folha de impressão A4</span>
          </button>
        </div>
      </div>

      {/* NAVEGAÇÃO DE ABAS DO SIMULADOR */}
      <div className="bg-white rounded-2xl border border-slate-200 px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3 overflow-x-auto card-shadow">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={() => setAbaAtiva('formulario')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
              abaAtiva === 'formulario'
                ? 'bg-[#0C2640] text-[#2DD4AA]'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Formulário de escolha</span>
          </button>

          <button
            type="button"
            onClick={() => setAbaAtiva('dashboard')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
              abaAtiva === 'dashboard'
                ? 'bg-[#0C2640] text-[#2DD4AA]'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <BarChart className="w-4 h-4" />
            <span>Meu dashboard provisório</span>
          </button>

          <button
            type="button"
            onClick={() => setAbaAtiva('geral')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
              abaAtiva === 'geral'
                ? 'bg-[#0C2640] text-[#2DD4AA]'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Grid className="w-4 h-4" />
            <span>Painel geral ({simulacao.totalVagasOfertadas} vagas)</span>
          </button>

          <button
            type="button"
            onClick={() => setAbaAtiva('comarcas')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
              abaAtiva === 'comarcas'
                ? 'bg-[#0C2640] text-[#2DD4AA]'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <MapPin className="w-4 h-4" />
            <span>Vagas por comarca</span>
          </button>

          <button
            type="button"
            onClick={() => setAbaAtiva('impressao')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
              abaAtiva === 'impressao'
                ? 'bg-[#0C2640] text-[#2DD4AA]'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Printer className="w-4 h-4" />
            <span>Folha de audiência</span>
          </button>

          {isAdmin && (
            <button
              type="button"
              onClick={() => setAbaAtiva('admin')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                abaAtiva === 'admin'
                  ? 'bg-amber-400 text-slate-950'
                  : 'text-amber-700 hover:bg-amber-50'
              }`}
            >
              <Shield className="w-4 h-4" />
              <span>Painel administrativo</span>
            </button>
          )}
        </div>
      </div>

      {/* ============================================================== */}
      {/* ABA 1: FORMULÁRIO DE ESCOLHA                                   */}
      {/* ============================================================== */}
      {abaAtiva === 'formulario' && (
        <section className="space-y-6">
          {!usuario ? (
            <div className="bg-gradient-to-r from-[#07192B] via-[#0C2640] to-[#135A7A] text-white rounded-2xl p-8 sm:p-12 text-center max-w-2xl mx-auto shadow-md border border-[#1C2D4A] space-y-4">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-2xl">
                <Lock className="w-7 h-7 text-[#2DD4AA]" />
              </div>
              <h3 className="text-xl sm:text-2xl font-bold font-serif">Autenticação Obrigatória</h3>
              <p className="text-xs sm:text-sm text-slate-300 max-w-lg mx-auto leading-relaxed">
                Para enviar suas intenções de lotação e organizar sua ordem de preferência de comarcas, entre com sua conta Google.
              </p>
              <button
                type="button"
                onClick={() => loginGoogle()}
                className="inline-flex items-center gap-3 bg-white hover:bg-slate-100 text-slate-900 font-bold px-6 py-3 rounded-xl shadow-md text-sm transition-all cursor-pointer"
              >
                <span>Entrar com Google</span>
              </button>
            </div>
          ) : (
            <form onSubmit={handleSalvarManifestacao} className="space-y-6">
              {/* Card de Dados Cadastrais & Intenção */}
              <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 card-shadow space-y-5">
                <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                  <h3 className="text-base sm:text-lg font-bold font-serif text-slate-900">
                    1. Identificação e manifestação de intenção
                  </h3>
                  <span className="text-xs font-mono font-bold text-teal-700 bg-teal-50 px-2.5 py-1 rounded-md border border-teal-200">
                    {candidatoLogado?.posicao}º lugar geral
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Nome completo:</label>
                    <input
                      type="text"
                      value={nomeCandidato}
                      onChange={(e) => setNomeCandidato(e.target.value)}
                      required
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-[#2DD4AA]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">CPF:</label>
                    <input
                      type="text"
                      value={cpfCandidato}
                      onChange={(e) => setCpfCandidato(e.target.value)}
                      placeholder="000.000.000-00"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-mono text-slate-900 focus:ring-2 focus:ring-[#2DD4AA]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">WhatsApp:</label>
                    <input
                      type="text"
                      value={whatsappCandidato}
                      onChange={(e) => setWhatsappCandidato(e.target.value)}
                      placeholder="(51) 99999-9999"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-mono text-slate-900 focus:ring-2 focus:ring-[#2DD4AA]"
                    />
                  </div>
                </div>

                {/* Seletor de Intenção */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Sua intenção em relação ao concurso:
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <label
                      className={`p-3.5 rounded-xl border flex items-center gap-2.5 cursor-pointer transition-all ${
                        intencao === 'Sim'
                          ? 'bg-emerald-50 border-emerald-400 text-emerald-950 font-bold'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <input
                        type="radio"
                        name="intencao"
                        checked={intencao === 'Sim'}
                        onChange={() => setIntencao('Sim')}
                        className="text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="text-xs">Pretendo assumir (Sim)</span>
                    </label>

                    <label
                      className={`p-3.5 rounded-xl border flex items-center gap-2.5 cursor-pointer transition-all ${
                        intencao === 'Talvez'
                          ? 'bg-amber-50 border-amber-400 text-amber-950 font-bold'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <input
                        type="radio"
                        name="intencao"
                        checked={intencao === 'Talvez'}
                        onChange={() => setIntencao('Talvez')}
                        className="text-amber-600 focus:ring-amber-500"
                      />
                      <span className="text-xs">Em análise (Talvez)</span>
                    </label>

                    <label
                      className={`p-3.5 rounded-xl border flex items-center gap-2.5 cursor-pointer transition-all ${
                        intencao === 'final_fila'
                          ? 'bg-indigo-50 border-indigo-400 text-indigo-950 font-bold'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <input
                        type="radio"
                        name="intencao"
                        checked={intencao === 'final_fila'}
                        onChange={() => setIntencao('final_fila')}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-xs">Fim de fila (Requerer)</span>
                    </label>

                    <label
                      className={`p-3.5 rounded-xl border flex items-center gap-2.5 cursor-pointer transition-all ${
                        intencao === 'Não'
                          ? 'bg-rose-50 border-rose-400 text-rose-950 font-bold'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <input
                        type="radio"
                        name="intencao"
                        checked={intencao === 'Não'}
                        onChange={() => setIntencao('Não')}
                        className="text-rose-600 focus:ring-rose-500"
                      />
                      <span className="text-xs">Desisto da vaga (Não)</span>
                    </label>
                  </div>
                </div>

                {/* Função Gratificada ou Cargo em Comissão (FG / CC) */}
                <div className="pt-3 border-t border-slate-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">
                      Possui função gratificada (FG) ou cargo em comissão (CC) no TJRS?
                    </span>
                    <button
                      type="button"
                      onClick={() => setPossuiFgCc(!possuiFgCc)}
                      className={`px-3 py-1 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                        possuiFgCc
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {possuiFgCc ? 'Sim' : 'Não'}
                    </button>
                  </div>

                  {possuiFgCc && (
                    <div className="p-4 rounded-xl bg-teal-50/50 border border-teal-200 grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-2xs font-bold text-slate-700 mb-1">
                          Registro funcional:
                        </label>
                        <input
                          type="text"
                          value={fgRegistro}
                          onChange={(e) => setFgRegistro(e.target.value)}
                          placeholder="Ex: 9843210"
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-2xs font-bold text-slate-700 mb-1">Cargo atual:</label>
                        <input
                          type="text"
                          value={fgCargo}
                          onChange={(e) => setFgCargo(e.target.value)}
                          placeholder="Ex: Assessor"
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-2xs font-bold text-slate-700 mb-1">
                          Comarca atual:
                        </label>
                        <input
                          type="text"
                          value={fgComarca}
                          onChange={(e) => setFgComarca(e.target.value)}
                          placeholder="Ex: Porto Alegre"
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-2xs font-bold text-slate-700 mb-1">
                          Pretende permanecer na comarca?
                        </label>
                        <select
                          value={fgPretendeContinuar}
                          onChange={(e) => setFgPretendeContinuar(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold"
                        >
                          <option value="Sim">Sim, pretendo permanecer nesta comarca</option>
                          <option value="Não">Não, pretendo escolher outra comarca</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Card de Ordenação de Comarcas */}
              <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 card-shadow space-y-4">
                <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                  <div>
                    <h3 className="text-base sm:text-lg font-bold font-serif text-slate-900">
                      2. Ordem de prioridade de comarcas para lotação
                    </h3>
                    <p className="text-xs text-slate-500">
                      Adicione e ordene suas opções. Na audiência pública de escolha, você receberá a primeira comarca da sua lista que ainda tiver vaga livre.
                    </p>
                  </div>

                  <button
                    type="submit"
                    className="bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 text-white font-bold px-5 py-2.5 rounded-xl text-xs shadow-xs transition-all cursor-pointer flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    <span>Salvar manifestação definitiva</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Disponíveis */}
                  <div className="lg:col-span-6 bg-slate-50 rounded-2xl border border-slate-200 p-5 flex flex-col h-[520px]">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-3">
                      <h4 className="text-sm font-bold text-slate-900">
                        Comarcas do concurso ({comarcasDisponiveis.length})
                      </h4>
                      <input
                        type="text"
                        value={buscaComarcaDisponivel}
                        onChange={(e) => setBuscaComarcaDisponivel(e.target.value)}
                        placeholder="Buscar comarca..."
                        className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs w-40 focus:ring-1 focus:ring-[#2DD4AA]"
                      />
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
                      {comarcasDisponiveis.map((c) => (
                        <div
                          key={c.id}
                          className="p-2.5 rounded-xl bg-white border border-slate-200/80 flex items-center justify-between text-xs hover:border-teal-400"
                        >
                          <div>
                            <span className="font-bold text-slate-800">{c.nome}</span>
                            <span className="text-[10px] text-slate-400 ml-2">
                              {c.vagas_total} vagas • {c.regiao}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setEscolhasComarcas([...escolhasComarcas, c.nome])}
                            className="px-2.5 py-1 bg-teal-50 hover:bg-teal-100 text-teal-800 font-bold rounded-lg text-xs cursor-pointer"
                          >
                            + Escolher
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Escolhidas */}
                  <div className="lg:col-span-6 bg-teal-50/40 rounded-2xl border-2 border-teal-300 p-5 flex flex-col h-[520px]">
                    <div className="flex items-center justify-between pb-3 border-b border-teal-200 mb-3">
                      <h4 className="text-sm font-bold text-teal-950">
                        Minha lista de preferência ({escolhasComarcas.length})
                      </h4>
                      <button
                        type="button"
                        onClick={() => setEscolhasComarcas([])}
                        className="text-xs text-rose-600 hover:text-rose-800 font-semibold cursor-pointer"
                      >
                        Limpar
                      </button>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                      {escolhasComarcas.map((nome, idx) => (
                        <div
                          key={nome}
                          className="p-2.5 rounded-xl bg-white border border-teal-200 shadow-2xs flex items-center justify-between text-xs"
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="w-6 h-6 rounded-lg bg-[#07192B] text-teal-300 font-mono font-bold text-xs flex items-center justify-center shrink-0">
                              {idx + 1}º
                            </span>
                            <span className="font-bold text-slate-900">{nome}</span>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => moverComarca(idx, 'cima')}
                              className="p-1 rounded bg-slate-100 hover:bg-slate-200 disabled:opacity-30 cursor-pointer"
                            >
                              <ArrowUp className="w-3.5 h-3.5 text-slate-700" />
                            </button>
                            <button
                              type="button"
                              disabled={idx === escolhasComarcas.length - 1}
                              onClick={() => moverComarca(idx, 'baixo')}
                              className="p-1 rounded bg-slate-100 hover:bg-slate-200 disabled:opacity-30 cursor-pointer"
                            >
                              <ArrowDown className="w-3.5 h-3.5 text-slate-700" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setEscolhasComarcas(escolhasComarcas.filter((c) => c !== nome))
                              }
                              className="p-1 rounded hover:bg-rose-50 text-rose-500 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </form>
          )}
        </section>
      )}

      {/* ============================================================== */}
      {/* ABA 2: MEU DASHBOARD PROVISÓRIO                                */}
      {/* ============================================================== */}
      {abaAtiva === 'dashboard' && (
        <section className="space-y-6">
          {candidatoLogado ? (
            (() => {
              const alocacaoMeu = simulacao.alocacoes.find(
                (a) => a.candidatoId === candidatoLogado.id
              );
              return (
                <div className="space-y-6">
                  {/* Card Resultado Provisório */}
                  <div className="bg-gradient-to-r from-[#07192B] via-[#0C2640] to-[#135A7A] text-white rounded-2xl p-6 sm:p-8 card-shadow space-y-4">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-lg bg-teal-500/20 text-[#2DD4AA] text-xs font-mono font-bold">
                        SIMULAÇÃO EM TEMPO REAL
                      </span>
                    </div>

                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <h3 className="text-xl sm:text-2xl font-bold font-serif">
                          Previsão de Lotação: {alocacaoMeu?.comarcaAlocada || 'Aguardando Distribuição'}
                        </h3>
                        <p className="text-xs sm:text-sm text-slate-300 mt-1">
                          Com base na sua colocação ({candidatoLogado.posicao}º Lugar) e na escolha dos candidatos anteriores.
                        </p>
                      </div>

                      <div className="bg-white/10 rounded-xl p-4 text-center border border-white/20 min-w-[140px]">
                        <span className="text-[10px] uppercase font-mono font-bold text-teal-300 block">
                          Opção Alocada
                        </span>
                        <div className="text-2xl font-extrabold text-white mt-0.5 font-mono">
                          {alocacaoMeu?.preferenciaNumero ? `${alocacaoMeu.preferenciaNumero}ª Escolha` : '-'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Métricas do Chamamento */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 card-shadow text-center">
                      <span className="text-xs text-slate-500 font-semibold block">Vagas Ofertadas</span>
                      <span className="text-3xl font-extrabold text-slate-900 font-mono mt-1 block">
                        {simulacao.totalVagasOfertadas}
                      </span>
                      <span className="text-2xs text-slate-400">Total no 1º Chamamento</span>
                    </div>

                    <div className="bg-white p-5 rounded-2xl border border-slate-200 card-shadow text-center">
                      <span className="text-xs text-slate-500 font-semibold block">Vagas Preenchidas</span>
                      <span className="text-3xl font-extrabold text-[#135A7A] font-mono mt-1 block">
                        {simulacao.totalVagasPreenchidas}
                      </span>
                      <span className="text-2xs text-emerald-600 font-semibold">Simuladas até agora</span>
                    </div>

                    <div className="bg-white p-5 rounded-2xl border border-slate-200 card-shadow text-center">
                      <span className="text-xs text-slate-500 font-semibold block">Desistências / Renúncias</span>
                      <span className="text-3xl font-extrabold text-rose-600 font-mono mt-1 block">
                        {simulacao.totalDesistencias}
                      </span>
                      <span className="text-2xs text-slate-400">Fila adiantada</span>
                    </div>
                  </div>
                </div>
              );
            })()
          ) : (
            <div className="text-center py-12 text-slate-500 text-xs">
              Faça login para consultar a sua previsão de lotação personalizada.
            </div>
          )}
        </section>
      )}

      {/* ============================================================== */}
      {/* ABA 3: PAINEL GERAL (166 VAGAS)                                */}
      {/* ============================================================== */}
      {abaAtiva === 'geral' && (
        <section className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 card-shadow overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/70">
              <div>
                <h3 className="font-bold text-slate-900 text-sm sm:text-base font-serif">
                  Quadro Geral de Distribuição de Vagas
                </h3>
                <p className="text-xs text-slate-500">
                  Cruzamento dos convocados com suas preferências de posse.
                </p>
              </div>

              <span className="px-3 py-1 rounded-xl bg-teal-50 text-teal-800 text-xs font-mono font-bold border border-teal-200 self-start sm:self-auto">
                {simulacao.alocacoes.length} convocados simulados
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm divide-y divide-slate-100">
                <thead className="bg-slate-100 text-slate-700 font-bold text-2xs uppercase tracking-wider font-mono">
                  <tr>
                    <th className="py-3 px-3 text-center">Pos.</th>
                    <th className="py-3 px-4">Candidato</th>
                    <th className="py-3 px-3 text-center">Vínculo no Site</th>
                    <th className="py-3 px-3 text-center">Cota</th>
                    <th className="py-3 px-3 text-center">Intenção</th>
                    <th className="py-3 px-4">Comarca Atribuída</th>
                    <th className="py-3 px-3 text-center">Opção Atendida</th>
                    <th className="py-3 px-4">Situação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {simulacao.alocacoes.map((item) => {
                    const infoVinculo = userRegistryStore.verificarVinculoCandidato({
                      id: item.candidatoId,
                      nome: item.candidatoNome,
                    });
                    return (
                      <tr key={item.candidatoId} className="hover:bg-slate-50">
                        <td className="py-3 px-3 text-center font-mono font-bold text-slate-900">
                          {item.posicao}º
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-800">{item.candidatoNome}</td>
                        <td className="py-3 px-3 text-center">
                          {infoVinculo.vinculado ? (
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300"
                              title={`Usuário cadastrado e vinculado: ${infoVinculo.usuario?.email || infoVinculo.usuario?.nome}`}
                            >
                              <UserCheck className="w-3 h-3 text-emerald-700" />
                              <span>Usuário Vinculado</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500 border border-slate-200">
                              <span>Sem vínculo ainda</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="px-2 py-0.5 rounded text-2xs font-mono bg-slate-100">
                            {item.cota}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                              item.intencao === 'Sim'
                                ? 'bg-emerald-50 text-emerald-800'
                                : item.intencao === 'Não'
                                ? 'bg-rose-50 text-rose-800'
                                : 'bg-amber-50 text-amber-800'
                            }`}
                          >
                            {item.intencao}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-900">
                          {item.comarcaAlocada || '-'}
                        </td>
                        <td className="py-3 px-3 text-center font-mono">
                          {item.preferenciaNumero ? `${item.preferenciaNumero}ª Opção` : '-'}
                        </td>
                        <td className="py-3 px-4 text-xs">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                              item.comarcaAlocada
                                ? 'bg-emerald-50 text-emerald-800'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {item.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* ============================================================== */}
      {/* ABA 4: VAGAS POR COMARCA                                       */}
      {/* ============================================================== */}
      {abaAtiva === 'comarcas' && (
        <section className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 card-shadow overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/70">
              <h3 className="font-bold text-slate-900 text-sm sm:text-base font-serif">
                Quadro de Vagas por Comarca
              </h3>
              <p className="text-xs text-slate-500">
                Acompanhe quantas vagas foram preenchidas e quantas ainda restam em cada comarca.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm divide-y divide-slate-100">
                <thead className="bg-slate-100 text-slate-700 font-bold text-2xs uppercase tracking-wider font-mono">
                  <tr>
                    <th className="py-3 px-4">Comarca</th>
                    <th className="py-3 px-3">Região</th>
                    <th className="py-3 px-3 text-center">Vagas Ofertadas</th>
                    <th className="py-3 px-3 text-center">Vagas Preenchidas</th>
                    <th className="py-3 px-3 text-center">Restantes</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {COMARCAS_RS.map((c) => {
                    const ocupadas = simulacao.vagasOcupadas[c.nome] || 0;
                    const restantes = simulacao.vagasRestantes[c.nome] ?? c.vagas_total;
                    const esgotada = restantes <= 0;

                    return (
                      <tr key={c.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-bold text-slate-900">{c.nome}</td>
                        <td className="py-3 px-3 text-slate-500">{c.regiao}</td>
                        <td className="py-3 px-3 text-center font-mono font-bold text-slate-800">
                          {c.vagas_total}
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-bold text-[#135A7A]">
                          {ocupadas}
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-bold">
                          <span className={esgotada ? 'text-rose-600' : 'text-emerald-700'}>
                            {restantes}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-2xs font-bold font-mono ${
                              esgotada
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            }`}
                          >
                            {esgotada ? 'ESGOTADA' : `${restantes} DISPONÍVEL(IS)`}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* ============================================================== */}
      {/* ABA 5: FOLHA DE AUDIÊNCIA (IMPRESSÃO A4 COM CÍRCULOS DE VAGA)  */}
      {/* ============================================================== */}
      {abaAtiva === 'impressao' && (
        <section className="space-y-6">
          <div className="bg-white rounded-2xl p-5 border border-slate-200 card-shadow flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
            <div>
              <h3 className="font-bold text-slate-900 font-serif text-base">
                Configuração da Folha de Audiência (Padrão A4)
              </h3>
              <p className="text-xs text-slate-500">
                Imprima com círculos vazios para preenchimento manual a caneta conforme a chamada oficial.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                <span>Colunas:</span>
                {[1, 2, 3, 4, 5].map((col) => (
                  <button
                    key={col}
                    type="button"
                    onClick={() => setColunasImpressao(col as 1 | 2 | 3 | 4 | 5)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      colunasImpressao === col
                        ? 'bg-[#07192B] text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {col}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 bg-[#2DD4AA] hover:bg-[#20BE96] text-slate-950 font-extrabold text-xs rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir Agora</span>
              </button>
            </div>
          </div>

          {/* Folha A4 Formatada */}
          <div className="folha-a4 bg-white p-8 rounded-2xl border border-slate-300 shadow-xl max-w-[210mm] mx-auto min-h-[297mm] space-y-4 font-sans text-xs">
            <div className="border-b-2 border-slate-800 pb-3 flex items-center justify-between">
              <div>
                <span className="font-serif font-black text-sm tracking-wider uppercase text-slate-900 block">
                  TRIBUNAL DE JUSTIÇA DO ESTADO DO RIO GRANDE DO SUL
                </span>
                <span className="text-2xs text-slate-600 block">
                  CERTAM • Folha de Acompanhamento de Escolha de Comarcas - Edital 01/2025
                </span>
              </div>
              <span className="font-mono text-xs font-bold text-slate-900 border border-slate-800 px-2 py-1">
                LOTE 1 • 166 VAGAS
              </span>
            </div>

            {/* Grid de Comarcas com Círculos de Vagas */}
            <div
              className={`grid gap-2 ${
                colunasImpressao === 1
                  ? 'grid-cols-1'
                  : colunasImpressao === 2
                  ? 'grid-cols-2'
                  : colunasImpressao === 3
                  ? 'grid-cols-3'
                  : colunasImpressao === 4
                  ? 'grid-cols-4'
                  : 'grid-cols-5'
              }`}
            >
              {COMARCAS_RS.map((c) => (
                <div
                  key={c.id}
                  className="p-2 border border-slate-300 rounded-lg flex items-center justify-between bg-slate-50/50"
                >
                  <div className="min-w-0 pr-1">
                    <span className="font-bold text-slate-900 block truncate text-2xs">{c.nome}</span>
                    <span className="text-[9px] text-slate-500 font-mono">
                      {c.vagas_total} vaga(s)
                    </span>
                  </div>

                  {/* Círculos para marcação a caneta */}
                  <div className="flex items-center gap-0.5 flex-wrap justify-end">
                    {Array.from({ length: Math.min(c.vagas_total, 8) }).map((_, i) => (
                      <span
                        key={i}
                        className="w-2.5 h-2.5 rounded-full border border-slate-800 inline-block bg-white"
                        title="Marcar preenchimento"
                      />
                    ))}
                    {c.vagas_total > 8 && (
                      <span className="text-[9px] font-mono font-bold text-slate-700">
                        +{c.vagas_total - 8}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-slate-200 text-[10px] text-slate-500 flex items-center justify-between mt-auto">
              <span>CERTAM • Sistema Independente de Gestão de Concursos</span>
              <span>www.certam.com.br</span>
            </div>
          </div>
        </section>
      )}

      {/* ============================================================== */}
      {/* ABA 6: ADMIN DO LOTE                                           */}
      {/* ============================================================== */}
      {abaAtiva === 'admin' && isAdmin && (
        <section className="space-y-6">
          <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 card-shadow space-y-6">
            <div className="border-b border-slate-100 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-bold font-serif text-slate-900 text-lg">
                  Painel do Administrador do Lote
                </h3>
                <p className="text-xs text-slate-500">
                  Configure comarcas/vagas contempladas, candidatos chamados neste lote e travas de segurança.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalConfigurarLoteAberto(true)}
                className="px-4 py-2.5 bg-[#07192B] hover:bg-[#0C2640] text-[#2DD4AA] font-bold text-xs rounded-xl shadow-xs cursor-pointer flex items-center gap-2 shrink-0"
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>Configurar Comarcas, Vagas e Convocados do Lote</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">Trava de Manifestações</h4>
                    <p className="text-xs text-slate-500">
                      Impedir que candidatos alterem suas comarcas durante a audiência.
                    </p>
                  </div>
                  {loteTravado ? (
                    <Lock className="w-5 h-5 text-rose-600" />
                  ) : (
                    <Unlock className="w-5 h-5 text-emerald-600" />
                  )}
                </div>
                <button
                  type="button"
                  onClick={toggleTravarLote}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer w-full ${
                    loteTravado
                      ? 'bg-rose-600 hover:bg-rose-700 text-white'
                      : 'bg-slate-200 hover:bg-slate-300 text-slate-800'
                  }`}
                >
                  {loteTravado ? 'Destravar Lote' : 'Travar Lote Agora'}
                </button>
              </div>

              <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">Visibilidade Pública do Ranking</h4>
                    <p className="text-xs text-slate-500">
                      Permitir que os candidatos vejam a simulação em tempo real.
                    </p>
                  </div>
                  <span className="text-lg">👁️</span>
                </div>
                <button
                  type="button"
                  onClick={toggleRankingVisivel}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer w-full ${
                    rankingVisivel
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      : 'bg-slate-200 hover:bg-slate-300 text-slate-800'
                  }`}
                >
                  {rankingVisivel ? 'Ranking Visível (Público)' : 'Ranking Oculto'}
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      <ModalEditarLote
        aberto={modalConfigurarLoteAberto}
        onClose={() => setModalConfigurarLoteAberto(false)}
        concursoId={concursoId}
        cargoId={cargoId}
        lote={loteAtivo}
        onSalvo={() => {
          setLotes(lotesStore.getLotes());
          setCandidatos(lotesStore.getCandidatos(concursoId, cargoId));
          showToast('Configurações de comarcas e convocados do lote salvas!');
        }}
      />
    </div>
  );
};
