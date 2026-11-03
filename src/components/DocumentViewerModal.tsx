import React from 'react';
import { DocumentoItem } from '../types';
import { X, FileText, Download, ExternalLink, Calendar, Printer } from 'lucide-react';

interface DocumentViewerModalProps {
  aberto: boolean;
  onClose: () => void;
  documento: DocumentoItem | null;
}

export const DocumentViewerModal: React.FC<DocumentViewerModalProps> = ({
  aberto,
  onClose,
  documento,
}) => {
  if (!aberto || !documento) return null;

  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-xs animate-in fade-in-50">
      <div className="bg-white w-full max-w-5xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-[#07192B] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-teal-500/20 text-[#2DD4AA] flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-teal-500/20 text-[#2DD4AA] uppercase font-mono">
                  {documento.tipo}
                </span>
                <span className="text-2xs text-slate-300 font-mono flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {documento.data_publicacao}
                </span>
              </div>
              <h3 className="font-serif font-bold text-sm sm:text-base text-white truncate mt-0.5">
                {documento.titulo}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <a
              href={documento.url_ou_arquivo}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              title="Abrir em nova aba"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Nova Aba</span>
            </a>
            <a
              href={documento.url_ou_arquivo}
              download
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#2DD4AA] hover:bg-[#25be98] text-slate-950 rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download PDF</span>
            </a>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Viewer Body */}
        <div className="flex-1 bg-slate-100 relative overflow-hidden flex flex-col">
          {documento.descricao && (
            <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-xs text-amber-900 flex items-center justify-between shrink-0">
              <p className="truncate"><strong>Descrição:</strong> {documento.descricao}</p>
              <span className="font-mono text-2xs text-amber-700 shrink-0 ml-2">{documento.tamanho || 'Documento Oficial PDF'}</span>
            </div>
          )}

          <div className="flex-1 w-full h-full relative">
            <iframe
              src={documento.url_ou_arquivo}
              title={documento.titulo}
              className="w-full h-full border-0 bg-white"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
