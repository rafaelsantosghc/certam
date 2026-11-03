import React, { useState, useEffect } from 'react';
import { Candidato } from '../types';
import { dropdownOptionsStore, DropdownOptionsConfig } from '../store/dropdownOptionsStore';
import { ModalGerenciarDropdowns } from './ModalGerenciarDropdowns';
import {
  Pencil,
  X,
  Save,
  Sliders,
  Award,
  Tag,
  MapPin,
  Calendar,
  User,
  Hash,
  FileText,
  CheckCircle2,
} from 'lucide-react';

interface ModalEditarCandidatoAdminProps {
  aberto: boolean;
  candidato: Candidato | null;
  tipoLotacao?: string;
  onFechar: () => void;
  onSalvar: (candidatoAtualizado: Candidato) => void;
}

export const ModalEditarCandidatoAdmin: React.FC<ModalEditarCandidatoAdminProps> = ({
  aberto,
  candidato,
  tipoLotacao = 'Lotação',
  onFechar,
  onSalvar,
}) => {
  const [formData, setFormData] = useState<Partial<Candidato>>({});
  const [opcoes, setOpcoes] = useState<DropdownOptionsConfig>(() =>
    dropdownOptionsStore.getOptions()
  );
  const [modalGerenciarOpcoesAberto, setModalGerenciarOpcoesAberto] = useState(false);

  useEffect(() => {
    if (candidato && aberto) {
      setFormData({
        ...candidato,
        cotas: candidato.cotas && candidato.cotas.length > 0 ? [...candidato.cotas] : [candidato.cota || 'Ampla'],
        escolhas_comarcas: candidato.escolhas_comarcas ? [...candidato.escolhas_comarcas] : [],
      });
      setOpcoes(dropdownOptionsStore.getOptions());
    }
  }, [candidato, aberto]);

  useEffect(() => {
    const handleUpdate = () => {
      setOpcoes(dropdownOptionsStore.getOptions());
    };
    window.addEventListener('certam_dropdown_options_updated', handleUpdate);
    return () => window.removeEventListener('certam_dropdown_options_updated', handleUpdate);
  }, []);

  if (!aberto || !candidato) return null;

  const handleSalvar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nome?.trim()) {
      alert('O nome do candidato é obrigatório.');
      return;
    }

    const atualizado: Candidato = {
      ...candidato,
      ...formData,
      posicao: Number(formData.posicao) || candidato.posicao,
      nota_final: Number(formData.nota_final) || 0,
      cota: (formData.cota as any) || 'Ampla',
      cotas: formData.cotas && formData.cotas.length > 0 ? (formData.cotas as any) : [formData.cota || 'Ampla'],
      numero_lote_convocado: formData.numero_lote_convocado ? Number(formData.numero_lote_convocado) : undefined,
    };

    onSalvar(atualizado);
  };

  const handleToggleCota = (cotaNome: string) => {
    const current = (formData.cotas || [formData.cota || 'Ampla']) as string[];
    let novoArray: string[];
    if (current.includes(cotaNome)) {
      novoArray = current.filter((c) => c !== cotaNome);
      if (novoArray.length === 0) novoArray = ['Ampla'];
    } else {
      novoArray = [...current, cotaNome];
    }
    const cotaPrincipal = novoArray.includes('PCD')
      ? 'PCD'
      : novoArray.includes('PPP')
      ? 'PPP'
      : novoArray.includes('Indígena')
      ? 'Indígena'
      : novoArray.includes('Trans')
      ? 'Trans'
      : (novoArray[0] as any) || 'Ampla';

    setFormData((prev) => ({
      ...prev,
      cotas: novoArray as any,
      cota: cotaPrincipal,
    }));
  };

  const handleEscolhaPreferencia = (indice: number, valor: string) => {
    const escolhas = [...(formData.escolhas_comarcas || [])];
    escolhas[indice] = valor;
    setFormData((prev) => ({
      ...prev,
      escolhas_comarcas: escolhas.filter(Boolean),
    }));
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
        <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
          {/* Cabeçalho */}
          <div className="bg-[#0C2640] px-5 py-4 text-white flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
                <Pencil className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold font-serif">Editar Candidato (Gestão Admin)</h3>
                <p className="text-2xs text-slate-300">
                  Edição manual de campos, notas, status e opções de lista suspensa
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

          {/* Formulário com todos os campos */}
          <form onSubmit={handleSalvar} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
            {/* Linha 1: Posição, Nome Completo, CPF */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-3">
                <label className="block text-2xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <Hash className="w-3 h-3 text-slate-500" />
                  <span>Posição (Nº)</span>
                </label>
                <input
                  type="number"
                  min="1"
                  value={formData.posicao || ''}
                  onChange={(e) => setFormData({ ...formData, posicao: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold font-mono text-slate-900 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  required
                />
              </div>

              <div className="sm:col-span-6">
                <label className="block text-2xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <User className="w-3 h-3 text-slate-500" />
                  <span>Nome Completo</span>
                </label>
                <input
                  type="text"
                  value={formData.nome || ''}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
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
                  value={formData.cpf || ''}
                  onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                  placeholder="000.000.000-00"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono text-slate-900 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Linha 2: Nota Final e Status (Lista Suspensa Editável) */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-4">
                <label className="block text-2xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <Award className="w-3 h-3 text-slate-500" />
                  <span>Nota Final</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.nota_final ?? ''}
                  onChange={(e) => setFormData({ ...formData, nota_final: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  required
                />
              </div>

              <div className="sm:col-span-8">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-2xs font-bold text-slate-700 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-teal-600" />
                    <span>Status do Candidato (Lista Suspensa)</span>
                  </label>
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
                  value={formData.status || 'Aguardando Convocação'}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:outline-none cursor-pointer"
                >
                  {opcoes.status.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                  {formData.status && !opcoes.status.includes(formData.status) && (
                    <option value={formData.status}>{formData.status}</option>
                  )}
                </select>
              </div>
            </div>

            {/* Linha 3: Cotas / Modalidades de Reserva (Lista Suspensa Editável) */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-2xs font-bold text-slate-700 flex items-center gap-1">
                  <Tag className="w-3 h-3 text-amber-600" />
                  <span>Cotas Aplicáveis (Marque uma ou mais opções)</span>
                </label>
                <button
                  type="button"
                  onClick={() => setModalGerenciarOpcoesAberto(true)}
                  className="text-[10px] text-teal-700 hover:text-teal-900 font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Sliders className="w-2.5 h-2.5" />
                  <span>+ Editar Opções de Cotas</span>
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {opcoes.cotas.map((cotaOp) => {
                  const selecionada = (formData.cotas || [formData.cota || 'Ampla']).includes(cotaOp as any);
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

            {/* Linha 4: Convocação e Nomeação */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-2xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <Hash className="w-3 h-3 text-slate-500" />
                  <span>Lote Convocado (Nº)</span>
                </label>
                <input
                  type="number"
                  min="1"
                  value={formData.numero_lote_convocado || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      numero_lote_convocado: e.target.value ? Number(e.target.value) : undefined,
                    })
                  }
                  placeholder="Ex: 1"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono text-slate-900 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-2xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-slate-500" />
                  <span>Data Convocação</span>
                </label>
                <input
                  type="text"
                  value={formData.data_convocacao || ''}
                  onChange={(e) => setFormData({ ...formData, data_convocacao: e.target.value })}
                  placeholder="DD/MM/AAAA"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono text-slate-900 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-2xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-slate-500" />
                  <span>Data Nomeação</span>
                </label>
                <input
                  type="text"
                  value={formData.data_nomeacao || ''}
                  onChange={(e) => setFormData({ ...formData, data_nomeacao: e.target.value })}
                  placeholder="DD/MM/AAAA"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono text-slate-900 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Linha 5: Lotação Definitiva (Lista Suspensa com Opções de Comarcas/Cidades) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-2xs font-bold text-slate-700 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-indigo-600" />
                  <span>{tipoLotacao} Definitiva (Lista Suspensa)</span>
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
                value={formData.comarca_definitiva || ''}
                onChange={(e) => setFormData({ ...formData, comarca_definitiva: e.target.value || undefined })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:outline-none cursor-pointer"
              >
                <option value="">-- Não Definida / Em Andamento --</option>
                {opcoes.lotacoes.map((lot) => (
                  <option key={lot} value={lot}>
                    {lot}
                  </option>
                ))}
                {formData.comarca_definitiva && !opcoes.lotacoes.includes(formData.comarca_definitiva) && (
                  <option value={formData.comarca_definitiva}>{formData.comarca_definitiva}</option>
                )}
              </select>
            </div>

            {/* Linha 6: Preferências de Lotação Informadas */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <label className="block text-2xs font-bold text-slate-700">
                Preferências de {tipoLotacao} (1ª, 2ª e 3ª opções informadas pelo candidato):
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <span className="text-[10px] text-slate-500 block mb-0.5 font-semibold">1ª Opção:</span>
                  <select
                    value={formData.escolhas_comarcas?.[0] || formData.comarca_desejada_1 || ''}
                    onChange={(e) => handleEscolhaPreferencia(0, e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-2xs focus:ring-1 focus:ring-teal-500 focus:outline-none cursor-pointer"
                  >
                    <option value="">-- Selecione --</option>
                    {opcoes.lotacoes.map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <span className="text-[10px] text-slate-500 block mb-0.5 font-semibold">2ª Opção:</span>
                  <select
                    value={formData.escolhas_comarcas?.[1] || ''}
                    onChange={(e) => handleEscolhaPreferencia(1, e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-2xs focus:ring-1 focus:ring-teal-500 focus:outline-none cursor-pointer"
                  >
                    <option value="">-- Selecione --</option>
                    {opcoes.lotacoes.map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <span className="text-[10px] text-slate-500 block mb-0.5 font-semibold">3ª Opção:</span>
                  <select
                    value={formData.escolhas_comarcas?.[2] || ''}
                    onChange={(e) => handleEscolhaPreferencia(2, e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-2xs focus:ring-1 focus:ring-teal-500 focus:outline-none cursor-pointer"
                  >
                    <option value="">-- Selecione --</option>
                    {opcoes.lotacoes.map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Linha 7: Contato do Candidato */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-2xs font-bold text-slate-700 mb-1">E-mail de Contato</label>
                <input
                  type="email"
                  value={formData.email || ''}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="candidato@email.com"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-2xs font-bold text-slate-700 mb-1">WhatsApp / Telefone</label>
                <input
                  type="text"
                  value={formData.whatsapp || ''}
                  onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                  placeholder="(00) 00000-0000"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Rodapé de Ações */}
            <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
              <span className="text-2xs text-slate-500 italic">
                * As alterações serão salvas e refletidas imediatamente nas listas e no cache
              </span>
              <div className="flex items-center gap-2">
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
                  <Save className="w-3.5 h-3.5" />
                  <span>Salvar Alterações</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* Submodal para gerenciar opções de listas suspensas */}
      <ModalGerenciarDropdowns
        aberto={modalGerenciarOpcoesAberto}
        onFechar={() => setModalGerenciarOpcoesAberto(false)}
        onSalvo={() => setOpcoes(dropdownOptionsStore.getOptions())}
      />
    </>
  );
};
