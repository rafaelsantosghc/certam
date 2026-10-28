import React, { useState, useEffect } from 'react';
import { Cargo } from '../types';
import { certamStore } from '../store/certamStore';
import { X, Briefcase, Check, AlertCircle, Calendar, Hash, Clock } from 'lucide-react';

interface ModalEditarCargoProps {
  aberto: boolean;
  onClose: () => void;
  concursoId: string;
  cargo?: Cargo | null;
  onSalvo?: (cargo: Cargo) => void;
}

export const ModalEditarCargo: React.FC<ModalEditarCargoProps> = ({
  aberto,
  onClose,
  concursoId,
  cargo,
  onSalvo,
}) => {
  const isEdicao = !!cargo;

  const [id, setId] = useState('');
  const [nome, setNome] = useState('');
  const [nivel, setNivel] = useState<Cargo['nivel']>('Superior');
  const [remuneracaoInicial, setRemuneracaoInicial] = useState('');
  const [temCr, setTemCr] = useState(true);
  const [ativo, setAtivo] = useState(true);

  // 1. Quantitativo total do cargo
  const [quantitativoTotal, setQuantitativoTotal] = useState<number | ''>('');
  // 2. Vagas disponíveis
  const [vagasDisponiveis, setVagasDisponiveis] = useState<number | ''>('');
  // 3. Vagas imediatas
  const [vagasImediatas, setVagasImediatas] = useState<number | ''>(0);
  // 4. Nomeados por este concurso
  const [nomeadosConcurso, setNomeadosConcurso] = useState<number | ''>(0);
  // 5. Convocados ainda não nomeados
  const [convocadosNaoNomeados, setConvocadosNaoNomeados] = useState<number | ''>(0);
  // 6. Vagas previstas para o próximo lote & Data prevista
  const [vagasPrevistasProximoLote, setVagasPrevistasProximoLote] = useState<number | ''>('');
  const [dataPrevistaProximoLote, setDataPrevistaProximoLote] = useState('');
  // Data da última alteração dessas informações
  const [dataAtualizacaoVagas, setDataAtualizacaoVagas] = useState('');

  const [erro, setErro] = useState<string | null>(null);

  const obterDataHojeFormatada = () => {
    const hoje = new Date();
    const d = String(hoje.getDate()).padStart(2, '0');
    const m = String(hoje.getMonth() + 1).padStart(2, '0');
    const a = hoje.getFullYear();
    return `${d}/${m}/${a}`;
  };

  useEffect(() => {
    if (cargo) {
      setId(cargo.id);
      setNome(cargo.nome || '');
      setNivel(cargo.nivel || 'Superior');
      setRemuneracaoInicial(cargo.remuneracao_inicial || '');
      setTemCr(cargo.tem_cr ?? true);
      setAtivo(cargo.ativo ?? true);

      setQuantitativoTotal(cargo.quantitativo_total !== undefined ? cargo.quantitativo_total : '');
      setVagasDisponiveis(
        cargo.vagas_disponiveis !== undefined
          ? cargo.vagas_disponiveis
          : cargo.vagas_reais_abertas !== undefined
          ? cargo.vagas_reais_abertas
          : ''
      );
      setVagasImediatas(cargo.vagas_imediatas ?? 0);
      setNomeadosConcurso(cargo.nomeados_concurso !== undefined ? cargo.nomeados_concurso : 0);
      setConvocadosNaoNomeados(cargo.convocados_nao_nomeados !== undefined ? cargo.convocados_nao_nomeados : 0);
      setVagasPrevistasProximoLote(
        cargo.vagas_previstas_proximo_lote !== undefined ? cargo.vagas_previstas_proximo_lote : ''
      );
      setDataPrevistaProximoLote(cargo.data_prevista_proximo_lote || '');
      setDataAtualizacaoVagas(cargo.data_atualizacao_vagas || obterDataHojeFormatada());
    } else {
      setId('');
      setNome('');
      setNivel('Superior');
      setRemuneracaoInicial('');
      setTemCr(true);
      setAtivo(true);

      setQuantitativoTotal('');
      setVagasDisponiveis('');
      setVagasImediatas(0);
      setNomeadosConcurso(0);
      setConvocadosNaoNomeados(0);
      setVagasPrevistasProximoLote('');
      setDataPrevistaProximoLote('');
      setDataAtualizacaoVagas(obterDataHojeFormatada());
    }
    setErro(null);
  }, [cargo, aberto]);

  if (!aberto) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) {
      setErro('Por favor, informe o nome do cargo.');
      return;
    }
    if (!concursoId) {
      setErro('Concurso de vinculação não especificado.');
      return;
    }

    const finalId =
      cargo?.id ||
      id.trim().toLowerCase().replace(/[^a-z0-9]/g, '_') ||
      nome.trim().toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 32);

    const cargoAtualizado: Cargo = {
      id: finalId,
      nome: nome.trim(),
      nivel,
      tem_cr: temCr,
      ativo,
      remuneracao_inicial: remuneracaoInicial.trim() || undefined,

      // 1. Quantitativo total do cargo
      quantitativo_total: quantitativoTotal !== '' ? Number(quantitativoTotal) : undefined,
      // 2. Vagas disponíveis
      vagas_disponiveis: vagasDisponiveis !== '' ? Number(vagasDisponiveis) : undefined,
      // 3. Vagas imediatas (edital)
      vagas_imediatas: Number(vagasImediatas) || 0,
      // 4. Nomeados por este concurso
      nomeados_concurso: nomeadosConcurso !== '' ? Number(nomeadosConcurso) : 0,
      // 5. Convocados ainda não nomeados
      convocados_nao_nomeados: convocadosNaoNomeados !== '' ? Number(convocadosNaoNomeados) : 0,
      // 6. Vagas previstas para o próximo lote & Data
      vagas_previstas_proximo_lote:
        vagasPrevistasProximoLote !== '' ? Number(vagasPrevistasProximoLote) : undefined,
      data_prevista_proximo_lote: dataPrevistaProximoLote.trim() || undefined,
      // Marcação com a data da última alteração
      data_atualizacao_vagas: dataAtualizacaoVagas.trim() || obterDataHojeFormatada(),

      // Manter sincronizado para legados
      vagas_reais_abertas: vagasDisponiveis !== '' ? Number(vagasDisponiveis) : undefined,
    };

    certamStore.salvarCargo(concursoId, cargoAtualizado);
    if (onSalvo) onSalvo(cargoAtualizado);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in-50">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-7 shadow-2xl border border-slate-200 my-8 space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-500/10 text-teal-700 flex items-center justify-center shrink-0">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base font-serif">
                {isEdicao ? `Editar Cargo: ${cargo?.nome}` : 'Adicionar Cargo ao Concurso'}
              </h3>
              <p className="text-2xs text-slate-500">
                Informações cadastrais e quantitativos oficiais de vagas do cargo
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

        {erro && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{erro}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Seção 1: Identificação do Cargo */}
          <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
            <span className="text-2xs font-bold uppercase tracking-wider text-slate-500 block">
              Dados Gerais do Cargo
            </span>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Nome do Cargo <span className="text-rose-500">*</span>:
              </label>
              <input
                type="text"
                placeholder="Ex: Analista Judiciário - Área Judiciária"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl focus:border-teal-600 outline-hidden transition-all text-slate-900 font-semibold"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Nível de Escolaridade:</label>
                <select
                  value={nivel}
                  onChange={(e) => setNivel(e.target.value as Cargo['nivel'])}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl focus:border-teal-600 outline-hidden font-medium"
                >
                  <option value="Superior">Superior</option>
                  <option value="Médio">Médio</option>
                  <option value="Técnico">Técnico</option>
                  <option value="Fundamental">Fundamental</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Remuneração Inicial:</label>
                <input
                  type="text"
                  placeholder="Ex: R$ 10.250,80"
                  value={remuneracaoInicial}
                  onChange={(e) => setRemuneracaoInicial(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono focus:border-teal-600 outline-hidden"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-5 pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={temCr}
                  onChange={(e) => setTemCr(e.target.checked)}
                  className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 w-4 h-4 cursor-pointer"
                />
                <span className="font-bold text-slate-800 text-xs">Possui Cadastro Reserva</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={ativo}
                  onChange={(e) => setAtivo(e.target.checked)}
                  className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 w-4 h-4 cursor-pointer"
                />
                <span className="font-bold text-slate-800 text-xs">Cargo Ativo no Certame</span>
              </label>
            </div>
          </div>

          {/* Seção 2: Quantitativos Oficiais do Cargo (Exatamente os 6 campos solicitados) */}
          <div className="space-y-3 bg-teal-50/40 p-4 rounded-2xl border border-teal-200">
            <div className="flex items-center justify-between">
              <span className="text-2xs font-bold uppercase tracking-wider text-teal-900 flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5 text-teal-700" />
                <span>Quantitativos Oficiais de Vagas do Cargo</span>
              </span>
              <span className="text-[10px] text-teal-700 font-mono">
                Padrão oficial do certame
              </span>
            </div>

            {/* Linha 1: Quantitativo Total, Vagas Disponíveis, Vagas Imediatas */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Quantitativo Total do Cargo:
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="Ex: 500"
                  value={quantitativoTotal}
                  onChange={(e) => setQuantitativoTotal(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono font-bold text-slate-900 focus:border-teal-600 outline-hidden"
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block leading-tight">
                  Total de vagas criadas (ocupadas ou não)
                </span>
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Vagas Disponíveis:
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="Ex: 85"
                  value={vagasDisponiveis}
                  onChange={(e) => setVagasDisponiveis(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono font-bold text-amber-900 focus:border-teal-600 outline-hidden"
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block leading-tight">
                  Disponíveis para provimento no quadro
                </span>
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Vagas Imediatas (Edital):
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={vagasImediatas}
                  onChange={(e) => setVagasImediatas(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono font-bold text-slate-900 focus:border-teal-600 outline-hidden"
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block leading-tight">
                  Vagas disponibilizadas no edital
                </span>
              </div>
            </div>

            {/* Linha 2: Nomeados pelo concurso, Convocados ainda não nomeados */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Nomeados por Este Concurso:
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={nomeadosConcurso}
                  onChange={(e) => setNomeadosConcurso(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono font-bold text-teal-800 focus:border-teal-600 outline-hidden"
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block leading-tight">
                  Total já ocupado por este certame
                </span>
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Convocados Ainda Não Nomeados:
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={convocadosNaoNomeados}
                  onChange={(e) => setConvocadosNaoNomeados(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono font-bold text-cyan-800 focus:border-teal-600 outline-hidden"
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block leading-tight">
                  Em processo de nomeação / posse em andamento
                </span>
              </div>
            </div>

            {/* Linha 3: Vagas previstas para o próximo lote + Data prevista */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-teal-200/60 mt-1">
              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Vagas Previstas p/ Próximo Lote:
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="Ex: 30"
                  value={vagasPrevistasProximoLote}
                  onChange={(e) => setVagasPrevistasProximoLote(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono font-bold text-indigo-900 focus:border-teal-600 outline-hidden"
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block leading-tight">
                  Previsão de vagas a prover no próximo lote
                </span>
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1 flex items-center justify-between">
                  <span>Data Prevista Próximo Lote:</span>
                  <span className="text-[10px] font-normal text-slate-400">dia/mês/ano ou mês/ano</span>
                </label>
                <input
                  type="text"
                  placeholder="Ex: 15/11/2026 ou 11/2026"
                  value={dataPrevistaProximoLote}
                  onChange={(e) => setDataPrevistaProximoLote(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono text-slate-900 focus:border-teal-600 outline-hidden"
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block leading-tight">
                  Aceita tanto dia/mês/ano quanto mês/ano
                </span>
              </div>
            </div>

            {/* Marcação com a Data da Última Alteração */}
            <div className="pt-2 border-t border-teal-200/60 mt-1">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <label className="block font-bold text-slate-800 text-xs">
                    Data da Última Alteração Destas Informações:
                  </label>
                  <span className="text-[10px] text-slate-500">
                    Marcação exibida aos candidatos para acompanhar se as vagas estão atualizadas
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <input
                    type="text"
                    placeholder="DD/MM/AAAA"
                    value={dataAtualizacaoVagas}
                    onChange={(e) => setDataAtualizacaoVagas(e.target.value)}
                    className="w-32 px-3 py-1.5 bg-white border border-slate-300 rounded-xl font-mono text-xs text-slate-800 text-center focus:border-teal-600 outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => setDataAtualizacaoVagas(obterDataHojeFormatada())}
                    className="px-2.5 py-1.5 bg-teal-100 hover:bg-teal-200 text-teal-900 font-bold text-[11px] rounded-xl transition-colors cursor-pointer"
                  >
                    Hoje
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2.5">
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
              <span>{isEdicao ? 'Salvar Cargo' : 'Adicionar Cargo'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
