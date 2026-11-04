import React, { useState } from 'react';
import { Concurso, DocumentoItem, TipoDocumento } from '../types';
import { FileText, Download, Search, Calendar, Eye, Plus, Pencil, Trash2, X, ShieldCheck } from 'lucide-react';
import { DocumentViewerModal } from './DocumentViewerModal';
import { useAuth } from '../store/authContext';
import { certamStore } from '../store/certamStore';
import { isDebugMode } from '../utils/environment';

interface DocumentosConcursoViewProps {
  concurso: Concurso;
}

export const DocumentosConcursoView: React.FC<DocumentosConcursoViewProps> = ({ concurso }) => {
  const { isAdmin } = useAuth();
  const [docs, setDocs] = useState<DocumentoItem[]>(() => concurso.documentos || []);
  const [busca, setBusca] = useState('');
  const [tipoFiltro, setTipoFiltro] = useState<string>('todos');
  const [docSelecionado, setDocSelecionado] = useState<DocumentoItem | null>(null);

  // Estados de Edição/Criação Administrativa
  const [modalFormAberto, setModalFormAberto] = useState(false);
  const [editandoDocId, setEditandoDocId] = useState<string | null>(null);
  const [formTitulo, setFormTitulo] = useState('');
  const [formTipo, setFormTipo] = useState<TipoDocumento>('Edital de Abertura');
  const [formUrl, setFormUrl] = useState('');
  const [formDescricao, setFormDescricao] = useState('');

  const syncDocs = (novosDocs: DocumentoItem[]) => {
    setDocs(novosDocs);
    const concAtualizado = { ...concurso, documentos: novosDocs };
    certamStore.salvarConcurso(concAtualizado, true);
  };

  const abrirNovoDocumento = () => {
    setEditandoDocId(null);
    setFormTitulo('');
    setFormTipo('Edital de Abertura');
    setFormUrl('');
    setFormDescricao('');
    setModalFormAberto(true);
  };

  const abrirEditarDocumento = (doc: DocumentoItem) => {
    setEditandoDocId(doc.id);
    setFormTitulo(doc.titulo);
    setFormTipo(doc.tipo);
    setFormUrl(doc.url_ou_arquivo);
    setFormDescricao(doc.descricao || '');
    setModalFormAberto(true);
  };

  const handleSalvarDocumento = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitulo.trim() || !formUrl.trim()) return;

    if (editandoDocId) {
      const atualizados = docs.map((d) =>
        d.id === editandoDocId
          ? { ...d, titulo: formTitulo, tipo: formTipo, url_ou_arquivo: formUrl, descricao: formDescricao }
          : d
      );
      syncDocs(atualizados);
    } else {
      const novo: DocumentoItem = {
        id: `doc-${Date.now().toString(36)}`,
        concurso_id: concurso.id,
        titulo: formTitulo,
        tipo: formTipo,
        url_ou_arquivo: formUrl,
        descricao: formDescricao,
        data_publicacao: new Date().toLocaleDateString('pt-BR'),
        tamanho: 'PDF Oficial',
      };
      syncDocs([novo, ...docs]);
    }

    setModalFormAberto(false);
  };

  const handleExcluirDocumento = (id: string, titulo: string) => {
    if (window.confirm(`Deseja remover o documento "${titulo}"?`)) {
      const atualizados = docs.filter((d) => d.id !== id);
      syncDocs(atualizados);
    }
  };

  const docsFiltrados = docs.filter((d) => {
    const matchBusca =
      d.titulo.toLowerCase().includes(busca.toLowerCase()) ||
      (d.descricao && d.descricao.toLowerCase().includes(busca.toLowerCase()));
    const matchTipo = tipoFiltro === 'todos' || d.tipo === tipoFiltro;
    return matchBusca && matchTipo;
  });

  const tiposDisponiveis = Array.from(new Set(docs.map((d) => d.tipo)));

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-7 card-shadow space-y-6">
      {/* Barra de Administração (Modo Admin Ativo) */}
      {isAdmin && (
        <div className="p-3.5 bg-gradient-to-r from-amber-50 to-amber-100/60 border border-amber-300 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-amber-500 text-slate-950 font-bold rounded-lg text-xs flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </span>
            <div>
              <span className="text-xs font-bold text-amber-950 block">Modo Administrador: Gestão de Documentos</span>
              <p className="text-[11px] text-amber-800">Você pode adicionar novos editais, alterar dados ou remover documentos existentes.</p>
            </div>
          </div>

          <button
            type="button"
            onClick={abrirNovoDocumento}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2 bg-[#07192B] hover:bg-[#0C2640] text-[#2DD4AA] font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>+ Adicionar Documento Oficial</span>
          </button>
        </div>
      )}

      {/* Header & Filtros */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <h3 className="font-serif font-bold text-lg text-[#07192B] flex items-center gap-2">
            <FileText className="w-5 h-5 text-teal-600" />
            <span>Documentos Oficiais do Concurso</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Visualização integrada de editais de abertura, retificações e termos de convocação em PDF
          </p>
        </div>

        {/* Barra de Filtros */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Buscar documento..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-teal-600 focus:outline-hidden"
            />
          </div>

          <select
            value={tipoFiltro}
            onChange={(e) => setTipoFiltro(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-teal-600 focus:outline-hidden font-medium"
          >
            <option value="todos">Todos os tipos</option>
            {tiposDisponiveis.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Grid de Documentos */}
      {docsFiltrados.length === 0 ? (
        <div className="p-8 text-center text-xs text-slate-400">
          Nenhum documento encontrado com os filtros selecionados.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {docsFiltrados.map((doc) => (
            <div
              key={doc.id}
              className="p-4 bg-slate-50/70 hover:bg-slate-50 border border-slate-200 rounded-xl transition-all flex flex-col justify-between space-y-3 group"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold text-teal-800 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200">
                    {doc.tipo}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {doc.data_publicacao}
                    </span>

                    {/* Botões de Ação do Admin na Listagem */}
                    {isAdmin && (
                      <div className="flex items-center gap-1 bg-amber-50 px-1 py-0.5 rounded-lg border border-amber-200">
                        <button
                          type="button"
                          onClick={() => abrirEditarDocumento(doc)}
                          className="p-1 text-amber-800 hover:text-amber-950 hover:bg-amber-100 rounded cursor-pointer"
                          title="Editar informações do documento"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleExcluirDocumento(doc.id, doc.titulo)}
                          className="p-1 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded cursor-pointer"
                          title="Remover documento"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <h4 className="font-bold text-xs text-slate-900 mt-2 leading-snug group-hover:text-teal-900 transition-colors">
                  {doc.titulo}
                </h4>

                {doc.descricao && (
                  <p className="text-2xs text-slate-600 mt-1 leading-relaxed line-clamp-2">
                    {doc.descricao}
                  </p>
                )}
              </div>

              <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs">
                <span className="text-[11px] font-mono text-slate-400">
                  {doc.tamanho || 'PDF Oficial'}
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setDocSelecionado(doc)}
                    className="flex items-center gap-1.5 text-xs font-bold text-teal-900 bg-teal-50 hover:bg-teal-100 px-3 py-1.5 rounded-lg border border-teal-200 transition-all cursor-pointer shadow-2xs"
                  >
                    <Eye className="w-3.5 h-3.5 text-teal-700" />
                    <span>Visualizar PDF</span>
                  </button>

                  <a
                    href={doc.url_ou_arquivo}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs font-bold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 px-2.5 py-1.5 rounded-lg border border-slate-200 transition-all cursor-pointer shadow-2xs"
                    title="Baixar arquivo"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-600" />
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Formulário do Admin (Adicionar / Editar Documento) */}
      {modalFormAberto && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in-50">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
            <div className="p-4 sm:p-5 bg-[#07192B] text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-teal-500/20 text-[#2DD4AA] flex items-center justify-center">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-base text-white">
                    {editandoDocId ? 'Editar Documento Oficial' : 'Adicionar Documento Oficial'}
                  </h3>
                  <p className="text-2xs text-teal-300">
                    {concurso.nome} ({concurso.orgao})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalFormAberto(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSalvarDocumento} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Título do Documento *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Edital de Abertura nº 01/2025"
                  value={formTitulo}
                  onChange={(e) => setFormTitulo(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Tipo de Documento *</label>
                <select
                  value={formTipo}
                  onChange={(e) => setFormTipo(e.target.value as TipoDocumento)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-semibold"
                >
                  <option value="Edital de Abertura">Edital de Abertura</option>
                  <option value="Retificação">Retificação</option>
                  <option value="Convocação">Convocação</option>
                  <option value="Resultado Final">Resultado Final</option>
                  <option value="Homologação">Homologação</option>
                  <option value="Decisão Judicial">Decisão Judicial</option>
                  <option value="Legislação / PL">Legislação / PL</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">URL / Link do Documento (PDF) *</label>
                <input
                  type="text"
                  required
                  placeholder="https://... ou caminho para arquivo PDF"
                  value={formUrl}
                  onChange={(e) => setFormUrl(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Descrição / Observações</label>
                <textarea
                  rows={3}
                  placeholder="Detalhes adicionais sobre o documento ou convocações..."
                  value={formDescricao}
                  onChange={(e) => setFormDescricao(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalFormAberto(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-600 hover:bg-slate-50 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#07192B] hover:bg-[#0C2640] text-[#2DD4AA] font-bold rounded-xl shadow-xs"
                >
                  {editandoDocId ? 'Salvar Alterações' : 'Salvar Documento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Visualizador de Documentos PDF */}
      <DocumentViewerModal
        aberto={Boolean(docSelecionado)}
        onClose={() => setDocSelecionado(null)}
        documento={docSelecionado}
      />
    </div>
  );
};
