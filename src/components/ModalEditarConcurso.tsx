import React, { useState, useEffect } from 'react';
import { Concurso, ConcursoStatus } from '../types';
import { certamStore } from '../store/certamStore';
import { X, Building, Check, Sparkles, AlertCircle } from 'lucide-react';

interface ModalEditarConcursoProps {
  aberto: boolean;
  onClose: () => void;
  concurso?: Concurso | null;
  onSalvo?: (concurso: Concurso) => void;
}

export const ModalEditarConcurso: React.FC<ModalEditarConcursoProps> = ({
  aberto,
  onClose,
  concurso,
  onSalvo,
}) => {
  const isEdicao = !!concurso;

  const [id, setId] = useState('');
  const [nome, setNome] = useState('');
  const [orgao, setOrgao] = useState('');
  const [ano, setAno] = useState('2025');
  const [edital, setEdital] = useState('Edital 01/2025');
  const [status, setStatus] = useState<ConcursoStatus>('Homologado');
  const [homologado, setHomologado] = useState(true);
  const [dataHomologacao, setDataHomologacao] = useState('');
  const [regiao, setRegiao] = useState<Concurso['regiao']>('Sul');
  const [esfera, setEsfera] = useState<Concurso['esfera']>('Estadual');
  const [estado, setEstado] = useState('RS');
  const [descricao, setDescricao] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (concurso) {
      setId(concurso.id);
      setNome(concurso.nome || '');
      setOrgao(concurso.orgao || '');
      setAno(concurso.ano || '2025');
      setEdital(concurso.edital || 'Edital 01/2025');
      setStatus(concurso.status || 'Homologado');
      setHomologado(concurso.homologado ?? true);
      setDataHomologacao(concurso.data_homologacao || '');
      setRegiao(concurso.regiao || 'Sul');
      setEsfera(concurso.esfera || 'Estadual');
      setEstado(concurso.estado || 'RS');
      setDescricao(concurso.descricao || '');
    } else {
      setId('');
      setNome('');
      setOrgao('');
      setAno('2025');
      setEdital('Edital 01/2025');
      setStatus('Homologado');
      setHomologado(true);
      setDataHomologacao('');
      setRegiao('Sul');
      setEsfera('Estadual');
      setEstado('RS');
      setDescricao('');
    }
    setErro(null);
  }, [concurso, aberto]);

  if (!aberto) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !orgao.trim()) {
      setErro('Por favor, preencha o Nome e o Órgão do concurso.');
      return;
    }

    const finalId =
      concurso?.id ||
      id.trim().toLowerCase().replace(/[^a-z0-9]/g, '_') ||
      `${orgao.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${ano}`;

    const concursoAtualizado: Concurso = {
      ...(concurso || {
        cargos: [
          {
            id: 'geral',
            nome: 'Cargo Geral',
            nivel: 'Superior',
            vagas_imediatas: 0,
            tem_cr: true,
            ativo: true,
          },
        ],
      }),
      id: finalId,
      nome: nome.trim(),
      orgao: orgao.trim().toUpperCase(),
      ano: ano.trim(),
      edital: edital.trim(),
      status,
      homologado,
      data_homologacao: dataHomologacao.trim() || undefined,
      regiao,
      esfera,
      estado: estado.trim().toUpperCase(),
      descricao: descricao.trim(),
    };

    certamStore.salvarConcurso(concursoAtualizado);
    if (onSalvo) onSalvo(concursoAtualizado);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in-50">
      <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-7 shadow-2xl border border-slate-200 my-8 space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-500/10 text-teal-700 flex items-center justify-center shrink-0">
              <Building className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base font-serif">
                {isEdicao ? `Editar Concurso: ${concurso?.orgao}` : 'Cadastrar Novo Concurso'}
              </h3>
              <p className="text-2xs text-slate-500">
                Acesso exclusivo para administradores da plataforma
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
              Nome Completo do Concurso <span className="text-rose-500">*</span>:
            </label>
            <input
              type="text"
              placeholder="Ex: Tribunal de Justiça do Rio Grande do Sul (TJRS)"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-teal-600 outline-hidden transition-all text-slate-900"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Órgão / Sigla <span className="text-rose-500">*</span>:
              </label>
              <input
                type="text"
                placeholder="Ex: TJRS"
                value={orgao}
                onChange={(e) => setOrgao(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold uppercase focus:bg-white focus:border-teal-600 outline-hidden"
                required
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Ano:</label>
              <input
                type="text"
                placeholder="2025"
                value={ano}
                onChange={(e) => setAno(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono focus:bg-white focus:border-teal-600 outline-hidden"
                required
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Edital:</label>
              <input
                type="text"
                placeholder="Edital 01/2025"
                value={edital}
                onChange={(e) => setEdital(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-teal-600 outline-hidden"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Status:</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ConcursoStatus)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-semibold focus:bg-white focus:border-teal-600 outline-hidden"
              >
                <option value="Homologado">Homologado</option>
                <option value="Convocando">Convocando</option>
                <option value="ativo">Em Andamento</option>
                <option value="Inscrições Abertas">Inscrições Abertas</option>
                <option value="previsto">Previsto</option>
                <option value="encerrado">Encerrado</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Esfera:</label>
              <select
                value={esfera}
                onChange={(e) => setEsfera(e.target.value as Concurso['esfera'])}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-teal-600 outline-hidden"
              >
                <option value="Estadual">Estadual</option>
                <option value="Municipal">Municipal</option>
                <option value="Federal">Federal</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Região:</label>
              <select
                value={regiao}
                onChange={(e) => setRegiao(e.target.value as Concurso['regiao'])}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-teal-600 outline-hidden"
              >
                <option value="Sul">Sul</option>
                <option value="Sudeste">Sudeste</option>
                <option value="Nordeste">Nordeste</option>
                <option value="Centro-Oeste">Centro-Oeste</option>
                <option value="Norte">Norte</option>
                <option value="Nacional">Nacional</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Data de Homologação:</label>
              <input
                type="text"
                placeholder="Ex: 18/10/2025"
                value={dataHomologacao}
                onChange={(e) => setDataHomologacao(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono focus:bg-white focus:border-teal-600 outline-hidden"
              />
            </div>

            <div className="pt-5">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={homologado}
                  onChange={(e) => setHomologado(e.target.checked)}
                  className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 w-4 h-4 cursor-pointer"
                />
                <span className="font-bold text-slate-800 text-xs">
                  Certame Oficialmente Homologado
                </span>
              </label>
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Descrição / Objeto do Concurso:</label>
            <textarea
              rows={2}
              placeholder="Ex: Concurso Público para Provimento de Cargos de Servidores da Justiça Estadual..."
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-teal-600 outline-hidden leading-relaxed"
            />
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
              <span>{isEdicao ? 'Salvar Alterações' : 'Cadastrar Concurso'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
