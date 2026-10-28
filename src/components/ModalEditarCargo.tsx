import React, { useState, useEffect } from 'react';
import { Cargo } from '../types';
import { certamStore } from '../store/certamStore';
import { X, Briefcase, Check, AlertCircle } from 'lucide-react';

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
  const [vagasImediatas, setVagasImediatas] = useState(0);
  const [temCr, setTemCr] = useState(true);
  const [remuneracaoInicial, setRemuneracaoInicial] = useState('');
  const [vagasOcupadas, setVagasOcupadas] = useState(0);
  const [vagasReaisAbertas, setVagasReaisAbertas] = useState(0);
  const [ativo, setAtivo] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (cargo) {
      setId(cargo.id);
      setNome(cargo.nome || '');
      setNivel(cargo.nivel || 'Superior');
      setVagasImediatas(cargo.vagas_imediatas ?? 0);
      setTemCr(cargo.tem_cr ?? true);
      setRemuneracaoInicial(cargo.remuneracao_inicial || '');
      setVagasOcupadas(cargo.vagas_ocupadas ?? 0);
      setVagasReaisAbertas(cargo.vagas_reais_abertas ?? 0);
      setAtivo(cargo.ativo ?? true);
    } else {
      setId('');
      setNome('');
      setNivel('Superior');
      setVagasImediatas(0);
      setTemCr(true);
      setRemuneracaoInicial('');
      setVagasOcupadas(0);
      setVagasReaisAbertas(0);
      setAtivo(true);
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
      vagas_imediatas: Number(vagasImediatas) || 0,
      tem_cr: temCr,
      ativo,
      remuneracao_inicial: remuneracaoInicial.trim() || undefined,
      vagas_ocupadas: Number(vagasOcupadas) || undefined,
      vagas_reais_abertas: Number(vagasReaisAbertas) || undefined,
    };

    certamStore.salvarCargo(concursoId, cargoAtualizado);
    if (onSalvo) onSalvo(cargoAtualizado);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in-50">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-200 my-8 space-y-5">
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
                Acesso de edição restrito aos administradores
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
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Nome do Cargo <span className="text-rose-500">*</span>:
            </label>
            <input
              type="text"
              placeholder="Ex: Analista Judiciário - Área Judiciária"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-teal-600 outline-hidden transition-all text-slate-900 font-semibold"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Nível de Escolaridade:</label>
              <select
                value={nivel}
                onChange={(e) => setNivel(e.target.value as Cargo['nivel'])}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-teal-600 outline-hidden font-medium"
              >
                <option value="Superior">Superior</option>
                <option value="Médio">Médio</option>
                <option value="Técnico">Técnico</option>
                <option value="Fundamental">Fundamental</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Vagas Imediatas (Edital):</label>
              <input
                type="number"
                min="0"
                value={vagasImediatas}
                onChange={(e) => setVagasImediatas(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono focus:bg-white focus:border-teal-600 outline-hidden"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Remuneração Inicial:</label>
              <input
                type="text"
                placeholder="Ex: R$ 10.250,80"
                value={remuneracaoInicial}
                onChange={(e) => setRemuneracaoInicial(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono focus:bg-white focus:border-teal-600 outline-hidden"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Vagas Reais Abertas:</label>
              <input
                type="number"
                min="0"
                placeholder="0"
                value={vagasReaisAbertas}
                onChange={(e) => setVagasReaisAbertas(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono focus:bg-white focus:border-teal-600 outline-hidden"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Vagas Ocupadas em Lei:</label>
              <input
                type="number"
                min="0"
                placeholder="0"
                value={vagasOcupadas}
                onChange={(e) => setVagasOcupadas(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono focus:bg-white focus:border-teal-600 outline-hidden"
              />
            </div>

            <div className="space-y-2 pt-2">
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
                <span className="font-bold text-slate-800 text-xs">Cargo Ativo para Simulação</span>
              </label>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
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
