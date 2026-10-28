import React, { useState, useEffect } from 'react';
import { Lote } from '../types';
import { lotesStore } from '../store/lotesStore';
import { X, Layers, Check, Plus, Trash2, AlertCircle, Lock, Eye, Printer } from 'lucide-react';

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

  const [nome, setNome] = useState('');
  const [ativo, setAtivo] = useState(true);
  const [travado, setTravado] = useState(false);
  const [isRankingVisible, setIsRankingVisible] = useState(true);
  const [isPrintingEnabled, setIsPrintingEnabled] = useState(true);
  const [senha, setSenha] = useState('');
  const [comarcas, setComarcas] = useState<{ nome: string; vagas: number }[]>([]);
  const [novaComarcaNome, setNovaComarcaNome] = useState('');
  const [novaComarcaVagas, setNovaComarcaVagas] = useState(1);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (lote) {
      setNome(lote.nome || '');
      setAtivo(lote.ativo ?? true);
      setTravado(lote.travado ?? false);
      setIsRankingVisible(lote.is_ranking_visible ?? true);
      setIsPrintingEnabled(lote.is_printing_enabled ?? true);
      setSenha(lote.senha || '');
      setComarcas(lote.comarcas ? [...lote.comarcas] : []);
    } else {
      setNome('');
      setAtivo(true);
      setTravado(false);
      setIsRankingVisible(true);
      setIsPrintingEnabled(true);
      setSenha('');
      setComarcas([]);
    }
    setNovaComarcaNome('');
    setNovaComarcaVagas(1);
    setErro(null);
  }, [lote, aberto]);

  if (!aberto) return null;

  const handleAdicionarComarca = () => {
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

  const handleAtualizarVagasComarca = (index: number, vagas: number) => {
    setComarcas((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], vagas: Math.max(0, vagas) };
      return copy;
    });
  };

  const totalVagas = comarcas.reduce((acc, c) => acc + (Number(c.vagas) || 0), 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) {
      setErro('Informe o nome ou identificação do lote.');
      return;
    }
    if (!concursoId || !cargoId) {
      setErro('Concurso e cargo de vinculação são obrigatórios.');
      return;
    }

    const finalId = lote?.id || `lote-${concursoId}-${cargoId}-${Date.now().toString(36)}`;

    const loteAtualizado: Lote = {
      id: finalId,
      concurso_id: concursoId,
      cargo_id: cargoId,
      nome: nome.trim(),
      ativo,
      travado,
      is_ranking_visible: isRankingVisible,
      is_printing_enabled: isPrintingEnabled,
      senha: senha.trim() || undefined,
      comarcas,
      candidatos_ids: lote?.candidatos_ids || [],
    };

    if (isEdicao) {
      lotesStore.atualizarLote(loteAtualizado);
    } else {
      lotesStore.criarLote(loteAtualizado);
    }

    if (onSalvo) onSalvo(loteAtualizado);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in-50">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-7 shadow-2xl border border-slate-200 my-8 space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-500/10 text-teal-700 flex items-center justify-center shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base font-serif">
                {isEdicao ? `Editar Lote: ${lote?.nome}` : 'Cadastrar Novo Lote de Convocação'}
              </h3>
              <p className="text-2xs text-slate-500">
                Configure as comarcas, vagas ofertadas e permissões do lote
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
              Nome do Lote / Chamamento <span className="text-rose-500">*</span>:
            </label>
            <input
              type="text"
              placeholder="Ex: Lote 1 (1º Chamamento Oficial - Posse Imediata)"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-teal-600 outline-hidden transition-all text-slate-900 font-semibold"
              required
            />
          </div>

          {/* Opções e Travas do Lote */}
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={ativo}
                onChange={(e) => setAtivo(e.target.checked)}
                className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 w-4 h-4 cursor-pointer"
              />
              <span className="font-bold text-slate-800">Lote Ativo para Acesso</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={travado}
                onChange={(e) => setTravado(e.target.checked)}
                className="rounded border-slate-300 text-amber-600 focus:ring-amber-500 w-4 h-4 cursor-pointer"
              />
              <span className="font-bold text-amber-900 flex items-center gap-1">
                <Lock className="w-3.5 h-3.5 text-amber-600" />
                <span>Travar Escolhas de Comarcas</span>
              </span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isRankingVisible}
                onChange={(e) => setIsRankingVisible(e.target.checked)}
                className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 w-4 h-4 cursor-pointer"
              />
              <span className="font-medium text-slate-700 flex items-center gap-1">
                <Eye className="w-3.5 h-3.5 text-slate-500" />
                <span>Ranking e Simulação Visíveis</span>
              </span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isPrintingEnabled}
                onChange={(e) => setIsPrintingEnabled(e.target.checked)}
                className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 w-4 h-4 cursor-pointer"
              />
              <span className="font-medium text-slate-700 flex items-center gap-1">
                <Printer className="w-3.5 h-3.5 text-slate-500" />
                <span>Habilitar Impressão / Exportação</span>
              </span>
            </label>
          </div>

          {/* Gestão de Comarcas e Vagas do Lote */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                  <span>Comarcas & Vagas Ofertadas</span>
                  <span className="px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 font-mono text-[10px] font-bold border border-teal-200">
                    {totalVagas} vagas no total
                  </span>
                </h4>
                <p className="text-2xs text-slate-500">
                  Adicione as comarcas que estarão disponíveis para escolha dos candidatos contemplados.
                </p>
              </div>
            </div>

            {/* Inserção de Nova Comarca */}
            <div className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-2xl border border-slate-200">
              <input
                type="text"
                placeholder="Nome da Comarca (ex: Porto Alegre, Passo Fundo)"
                value={novaComarcaNome}
                onChange={(e) => setNovaComarcaNome(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAdicionarComarca();
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
                onClick={handleAdicionarComarca}
                className="px-3.5 py-1.5 bg-teal-700 hover:bg-teal-800 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer flex items-center gap-1 shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Incluir</span>
              </button>
            </div>

            {/* Lista de Comarcas Inseridas */}
            <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-56 overflow-y-auto">
              {comarcas.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400">
                  Nenhuma comarca adicionada ainda. Digite o nome acima e clique em &quot;Incluir&quot;.
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
                            onChange={(e) => handleAtualizarVagasComarca(idx, Number(e.target.value))}
                            className="w-16 px-2 py-1 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono font-bold text-center"
                          />
                        </td>
                        <td className="py-2 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoverComarca(idx)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded-md cursor-pointer transition-colors"
                            title="Remover comarca do lote"
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
              <span>{isEdicao ? 'Salvar Lote' : 'Criar Lote'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
