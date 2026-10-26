import React, { useState } from 'react';
import { Concurso, DocumentoItem, TipoDocumento } from '../types';
import { FileText, Download, Search, Filter, ExternalLink, Calendar } from 'lucide-react';

interface DocumentosConcursoViewProps {
  concurso: Concurso;
}

export const DocumentosConcursoView: React.FC<DocumentosConcursoViewProps> = ({ concurso }) => {
  const docs: DocumentoItem[] = concurso.documentos || [];
  const [busca, setBusca] = useState('');
  const [tipoFiltro, setTipoFiltro] = useState<string>('todos');

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
      {/* Header & Filtros */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <h3 className="font-serif font-bold text-lg text-[#07192B] flex items-center gap-2">
            <FileText className="w-5 h-5 text-teal-600" />
            <span>Documentos Oficiais do Concurso</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Editais de abertura, retificações, termos de homologação e convocações para download
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
                  <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {doc.data_publicacao}
                  </span>
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

                <a
                  href={doc.url_ou_arquivo}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs font-bold text-slate-900 hover:text-teal-700 bg-white hover:bg-teal-50 px-3 py-1.5 rounded-lg border border-slate-200 transition-all cursor-pointer shadow-2xs"
                >
                  <Download className="w-3.5 h-3.5 text-teal-600" />
                  <span>Acessar / Download</span>
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
