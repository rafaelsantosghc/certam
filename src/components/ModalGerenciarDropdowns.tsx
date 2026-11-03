import React, { useState, useEffect } from 'react';
import { dropdownOptionsStore, DropdownOptionsConfig } from '../store/dropdownOptionsStore';
import { Sliders, Plus, Trash2, X, Check, Tag, MapPin, Award } from 'lucide-react';

interface ModalGerenciarDropdownsProps {
  aberto: boolean;
  onFechar: () => void;
  onSalvo?: () => void;
}

export const ModalGerenciarDropdowns: React.FC<ModalGerenciarDropdownsProps> = ({
  aberto,
  onFechar,
  onSalvo,
}) => {
  const [opcoes, setOpcoes] = useState<DropdownOptionsConfig>(() =>
    dropdownOptionsStore.getOptions()
  );
  const [abaAtiva, setAbaAtiva] = useState<'status' | 'cotas' | 'lotacoes'>('status');
  const [novaOpcao, setNovaOpcao] = useState('');
  const [msgSucesso, setMsgSucesso] = useState('');

  useEffect(() => {
    if (aberto) {
      setOpcoes(dropdownOptionsStore.getOptions());
      setNovaOpcao('');
      setMsgSucesso('');
    }
  }, [aberto]);

  if (!aberto) return null;

  const handleAdicionar = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const limpa = novaOpcao.trim();
    if (!limpa) return;

    if (opcoes[abaAtiva].some((op) => op.toLowerCase() === limpa.toLowerCase())) {
      alert(`A opção "${limpa}" já existe nesta lista suspensa.`);
      return;
    }

    dropdownOptionsStore.adicionarOpcao(abaAtiva, limpa);
    const atualizado = dropdownOptionsStore.getOptions();
    setOpcoes(atualizado);
    setNovaOpcao('');
    setMsgSucesso(`Opção "${limpa}" adicionada com sucesso!`);
    setTimeout(() => setMsgSucesso(''), 3000);
    if (onSalvo) onSalvo();
  };

  const handleRemover = (opcao: string) => {
    if (window.confirm(`Deseja remover "${opcao}" das opções da lista suspensa?`)) {
      dropdownOptionsStore.removerOpcao(abaAtiva, opcao);
      const atualizado = dropdownOptionsStore.getOptions();
      setOpcoes(atualizado);
      setMsgSucesso(`Opção "${opcao}" removida.`);
      setTimeout(() => setMsgSucesso(''), 3000);
      if (onSalvo) onSalvo();
    }
  };

  const labels = {
    status: {
      titulo: 'Opções de Status do Candidato',
      sub: 'Status exibidos no seletor de convocação e situação do candidato',
      placeholder: 'Ex: Convocado em 2ª Chamada, Licença, etc.',
      icon: Award,
    },
    cotas: {
      titulo: 'Opções de Cotas / Reserva de Vagas',
      sub: 'Modalidades de concorrência disponíveis nas listas de classificação',
      placeholder: 'Ex: Hipossuficiente, Quilombola, etc.',
      icon: Tag,
    },
    lotacoes: {
      titulo: 'Opções de Lotações / Comarcas',
      sub: 'Comarcas, cidades e unidades de lotação disponíveis nos seletores',
      placeholder: 'Ex: Comarca de Porto Alegre, Sede Administrativa, etc.',
      icon: MapPin,
    },
  };

  const configAtual = labels[abaAtiva];
  const IconeAtual = configAtual.icon;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-xl w-full border border-slate-200 shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
        {/* Cabeçalho */}
        <div className="bg-[#0C2640] px-5 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-teal-500/20 text-[#2DD4AA] flex items-center justify-center border border-teal-500/30">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold font-serif">Gerenciar Listas Suspensas (Dropdowns)</h3>
              <p className="text-2xs text-slate-300">
                Adicione e configure as opções disponíveis em cada campo da classificação
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

        {/* Abas dos campos configuráveis */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-4 pt-3 gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => {
              setAbaAtiva('status');
              setNovaOpcao('');
            }}
            className={`px-3 py-2 text-xs font-bold rounded-t-xl transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              abaAtiva === 'status'
                ? 'bg-white text-teal-800 border-t border-x border-slate-200 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Award className="w-3.5 h-3.5 text-teal-600" />
            <span>Status ({opcoes.status.length})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setAbaAtiva('cotas');
              setNovaOpcao('');
            }}
            className={`px-3 py-2 text-xs font-bold rounded-t-xl transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              abaAtiva === 'cotas'
                ? 'bg-white text-teal-800 border-t border-x border-slate-200 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Tag className="w-3.5 h-3.5 text-amber-600" />
            <span>Cotas ({opcoes.cotas.length})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setAbaAtiva('lotacoes');
              setNovaOpcao('');
            }}
            className={`px-3 py-2 text-xs font-bold rounded-t-xl transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              abaAtiva === 'lotacoes'
                ? 'bg-white text-teal-800 border-t border-x border-slate-200 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <MapPin className="w-3.5 h-3.5 text-indigo-600" />
            <span>Lotações / Comarcas ({opcoes.lotacoes.length})</span>
          </button>
        </div>

        {/* Conteúdo da Aba */}
        <div className="p-5 space-y-4 max-h-[65vh] overflow-y-auto">
          {msgSucesso && (
            <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{msgSucesso}</span>
            </div>
          )}

          <div>
            <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <IconeAtual className="w-3.5 h-3.5 text-teal-600" />
              <span>{configAtual.titulo}</span>
            </h4>
            <p className="text-2xs text-slate-500 mt-0.5">{configAtual.sub}</p>
          </div>

          {/* Form para adicionar nova opção */}
          <form onSubmit={handleAdicionar} className="flex gap-2">
            <input
              type="text"
              value={novaOpcao}
              onChange={(e) => setNovaOpcao(e.target.value)}
              placeholder={configAtual.placeholder}
              className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 bg-slate-50 focus:bg-white"
            />
            <button
              type="submit"
              disabled={!novaOpcao.trim()}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Adicionar Opção</span>
            </button>
          </form>

          {/* Lista de opções existentes */}
          <div className="space-y-1.5 pt-2">
            <div className="text-2xs font-bold uppercase tracking-wider text-slate-400">
              Opções Atualmente Cadastradas no Dropdown:
            </div>
            <div className="max-h-60 overflow-y-auto space-y-1 pr-1 border border-slate-100 p-2 rounded-xl bg-slate-50/50">
              {opcoes[abaAtiva].map((op, idx) => (
                <div
                  key={`${op}-${idx}`}
                  className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200 hover:border-slate-300 text-xs transition-all"
                >
                  <span className="font-medium text-slate-800 break-all">{op}</span>
                  <button
                    type="button"
                    onClick={() => handleRemover(op)}
                    className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors ml-2"
                    title={`Remover "${op}"`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Rodapé */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end">
          <button
            type="button"
            onClick={onFechar}
            className="px-4 py-2 bg-[#0C2640] hover:bg-[#07192B] text-[#2DD4AA] font-bold rounded-xl text-xs cursor-pointer shadow-xs transition-colors"
          >
            Concluir & Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
