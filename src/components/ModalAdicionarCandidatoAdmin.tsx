import React, { useState, useEffect } from 'react';
import { Candidato } from '../types';
import { dropdownOptionsStore, DropdownOptionsConfig } from '../store/dropdownOptionsStore';
import { ModalGerenciarDropdowns } from './ModalGerenciarDropdowns';
import {
  UserPlus,
  X,
  Plus,
  Sliders,
  Award,
  Tag,
  MapPin,
  Calendar,
  User,
  Hash,
  FileText,
} from 'lucide-react';

interface ModalAdicionarCandidatoAdminProps {
  aberto: boolean;
  concursoId: string;
  cargoId: string;
  proximaPosicao: number;
  tipoLotacao?: string;
  onFechar: () => void;
  onAdicionar: (novoCandidato: Candidato) => void;
}

export const ModalAdicionarCandidatoAdmin: React.FC<ModalAdicionarCandidatoAdminProps> = ({
  aberto,
  concursoId,
  cargoId,
  proximaPosicao,
  tipoLotacao = 'Lotação',
  onFechar,
  onAdicionar,
}) => {
  const [opcoes, setOpcoes] = useState<DropdownOptionsConfig>(() =>
    dropdownOptionsStore.getOptions()
  );
  const [modalGerenciarOpcoesAberto, setModalGerenciarOpcoesAberto] = useState(false);

  const [posicao, setPosicao] = useState<number>(proximaPosicao);
  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');
  const [notaFinal, setNotaFinal] = useState<number>(75);
  const [status, setStatus] = useState('Aguardando Convocação');
  const [cotasSelecionadas, setCotasSelecionadas] = useState<string[]>(['Ampla']);
  const [loteConvocado, setLoteConvocado] = useState<string>('');
  const [dataConvocacao, setDataConvocacao] = useState<string>('');
  const [dataNomeacao, setDataNomeacao] = useState<string>('');
  const [lotacaoDefinitiva, setLotacaoDefinitiva] = useState<string>('');
  const [pref1, setPref1] = useState('');
  const [pref2, setPref2] = useState('');
  const [pref3, setPref3] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');

  useEffect(() => {
    if (aberto) {
      setPosicao(proximaPosicao);
      setNome('');
      setCpf('');
      setNotaFinal(75);
      setStatus('Aguardando Convocação');
      setCotasSelecionadas(['Ampla']);
      setLoteConvocado('');
      setDataConvocacao('');
      setDataNomeacao('');
      setLotacaoDefinitiva('');
      setPref1('');
      setPref2('');
      setPref3('');
      setEmail('');
      setWhatsapp('');
      setOpcoes(dropdownOptionsStore.getOptions());
    }
  }, [aberto, proximaPosicao]);

  if (!aberto) return null;

  const handleToggleCota = (cotaNome: string) => {
    let novoArray: string[];
    if (cotasSelecionadas.includes(cotaNome)) {
      novoArray = cotasSelecionadas.filter((c) => c !== cotaNome);
      if (novoArray.length === 0) novoArray = ['Ampla'];
    } else {
      novoArray = [...cotasSelecionadas, cotaNome];
    }
    setCotasSelecionadas(novoArray);
  };

  const handleSalvar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) {
      alert('Informe o nome do candidato.');
      return;
    }

    const cotaPrincipal = cotasSelecionadas.includes('PCD')
      ? 'PCD'
      : cotasSelecionadas.includes('PPP')
      ? 'PPP'
      : cotasSelecionadas.includes('Indígena')
      ? 'Indígena'
      : cotasSelecionadas.includes('Trans')
      ? 'Trans'
      : (cotasSelecionadas[0] as any) || 'Ampla';

    const escolhas = [pref1, pref2, pref3].filter(Boolean);

    const novo: Candidato = {
      id: `cand-${concursoId}-${cargoId}-${posicao}-${Date.now().toString(36)}`,
      concurso_id: concursoId,
      cargo_id: cargoId,
      posicao: Number(posicao) || proximaPosicao,
      nome: nome.trim(),
      cpf: cpf.trim() || undefined,
      nota_final: Number(notaFinal) || 0,
      cota: cotaPrincipal as any,
      cotas: cotasSelecionadas as any,
      status: status as any,
      numero_lote_convocado: loteConvocado ? Number(loteConvocado) : undefined,
      data_convocacao: dataConvocacao.trim() || undefined,
      data_nomeacao: dataNomeacao.trim() || undefined,
      comarca_definitiva: lotacaoDefinitiva.trim() || undefined,
      escolhas_comarcas: escolhas,
      intencao: 'Sim',
      email: email.trim() || undefined,
      whatsapp: whatsapp.trim() || undefined,
    };

    onAdicionar(novo);
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
        <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
          {/* Cabeçalho */}
          <div className="bg-[#0C2640] px-5 py-4 text-white flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-teal-500/20 text-[#2DD4AA] flex items-center justify-center border border-teal-500/30">
                <UserPlus className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold font-serif">Adicionar Candidato Manualmente</h3>
                <p className="text-2xs text-slate-300">
                  Cadastrar novo candidato nesta lista de classificação
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onFechar}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 cursor-pointer"
              aria-label="Fechar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Formulário */}
          <form onSubmit={handleSalvar} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
            {/* Linha 1 */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-3">
                <label className="block text-2xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <Hash className="w-3 h-3 text-slate-500" />
                  <span>Posição</span>
                </label>
                <input
                  type="number"
                  min="1"
                  value={posicao}
                  onChange={(e) => setPosicao(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold font-mono text-slate-900 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  required
                />
              </div>

              <div className="sm:col-span-6">
                <label className="block text-2xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <User className="w-3 h-3 text-slate-500" />
                  <span>Nome do Candidato</span>
                </label>
                <input
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Nome completo"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  required
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-2xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <FileText className="w-3 h-3 text-slate-500" />
                  <span>CPF</span>
                </label>
                <input
                  type="text"
                  value={cpf}
                  onChange={(e) => setCpf(e.target.value)}
                  placeholder="000.000.000-00"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono text-slate-900 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Linha 2 */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-4">
                <label className="block text-2xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <Award className="w-3 h-3 text-slate-500" />
                  <span>Nota Final</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={notaFinal}
                  onChange={(e) => setNotaFinal(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  required
                />
              </div>

              <div className="sm:col-span-8">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-2xs font-bold text-slate-700">Status Inicial</label>
                  <button
                    type="button"
                    onClick={() => setModalGerenciarOpcoesAberto(true)}
                    className="text-[10px] text-teal-700 hover:text-teal-900 font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Sliders className="w-2.5 h-2.5" />
                    <span>+ Gerenciar Opções</span>
                  </button>
                </div>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:outline-none cursor-pointer"
                >
                  {opcoes.status.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Linha 3: Cotas */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-2xs font-bold text-slate-700 flex items-center gap-1">
                  <Tag className="w-3 h-3 text-amber-600" />
                  <span>Cotas Aplicáveis</span>
                </label>
                <button
                  type="button"
                  onClick={() => setModalGerenciarOpcoesAberto(true)}
                  className="text-[10px] text-teal-700 hover:text-teal-900 font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Sliders className="w-2.5 h-2.5" />
                  <span>+ Gerenciar Cotas</span>
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {opcoes.cotas.map((cotaOp) => {
                  const selecionada = cotasSelecionadas.includes(cotaOp);
                  return (
                    <button
                      key={cotaOp}
                      type="button"
                      onClick={() => handleToggleCota(cotaOp)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
                        selecionada
                          ? 'bg-amber-500 text-slate-950 border-amber-600 shadow-2xs ring-2 ring-amber-300'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <span>{cotaOp}</span>
                      {selecionada && <span className="text-[10px]">✓</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Linha 4: Lotação Definitiva */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-2xs font-bold text-slate-700 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-indigo-600" />
                  <span>{tipoLotacao} Definitiva (Opcional)</span>
                </label>
                <button
                  type="button"
                  onClick={() => setModalGerenciarOpcoesAberto(true)}
                  className="text-[10px] text-teal-700 hover:text-teal-900 font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Sliders className="w-2.5 h-2.5" />
                  <span>+ Gerenciar Lotações</span>
                </button>
              </div>
              <select
                value={lotacaoDefinitiva}
                onChange={(e) => setLotacaoDefinitiva(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:outline-none cursor-pointer"
              >
                <option value="">-- Não Definida --</option>
                {opcoes.lotacoes.map((lot) => (
                  <option key={lot} value={lot}>
                    {lot}
                  </option>
                ))}
              </select>
            </div>

            {/* Linha 5: Contato */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-2xs font-bold text-slate-700 mb-1">E-mail</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="candidato@email.com"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-2xs font-bold text-slate-700 mb-1">WhatsApp / Telefone</label>
                <input
                  type="text"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="(00) 00000-0000"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Rodapé de Ações */}
            <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onFechar}
                className="px-4 py-2 border border-slate-300 text-slate-700 font-bold rounded-xl text-xs hover:bg-slate-50 cursor-pointer transition-colors"
              >
                Cancelar
              </button>

              <button
                type="submit"
                className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs cursor-pointer shadow-xs transition-colors flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Cadastrar Candidato</span>
              </button>
            </div>
          </form>
        </div>
      </div>

      <ModalGerenciarDropdowns
        aberto={modalGerenciarOpcoesAberto}
        onFechar={() => setModalGerenciarOpcoesAberto(false)}
        onSalvo={() => setOpcoes(dropdownOptionsStore.getOptions())}
      />
    </>
  );
};
