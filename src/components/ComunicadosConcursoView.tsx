import React, { useState } from 'react';
import { Concurso, ComunicadoItem } from '../types';
import { Megaphone, AlertTriangle, ShieldCheck, Tag, ExternalLink, Calendar, User } from 'lucide-react';

interface ComunicadosConcursoViewProps {
  concurso: Concurso;
}

export const ComunicadosConcursoView: React.FC<ComunicadosConcursoViewProps> = ({ concurso }) => {
  const comunicados: ComunicadoItem[] = concurso.comunicados || [];
  const [comunicadoAbertoId, setComunicadoAbertoId] = useState<string | null>(
    comunicados.length > 0 ? comunicados[0].id : null
  );

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-7 card-shadow space-y-6">
      {/* Header */}
      <div className="border-b border-slate-100 pb-4">
        <h3 className="font-serif font-bold text-lg text-[#07192B] flex items-center gap-2">
          <Megaphone className="w-5 h-5 text-teal-600" />
          <span>Área de Comunicados Oficiais & Mobilização dos Aprovados</span>
        </h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Acompanhamento de tramitações legislativas (PLs de cargos comissionados vs. efetivos), reuniões institucionais e ações das comissões
        </p>
      </div>

      {comunicados.length === 0 ? (
        <div className="p-8 text-center text-xs text-slate-400">
          Nenhum comunicado cadastrado para este certame até o momento.
        </div>
      ) : (
        <div className="space-y-4">
          {comunicados.map((item) => {
            const isAberto = comunicadoAbertoId === item.id;
            return (
              <div
                key={item.id}
                className={`rounded-2xl border transition-all ${
                  item.importante
                    ? 'border-amber-300 bg-amber-50/20 shadow-2xs'
                    : 'border-slate-200 bg-slate-50/50'
                }`}
              >
                <div
                  onClick={() => setComunicadoAbertoId(isAberto ? null : item.id)}
                  className="p-4 sm:p-5 cursor-pointer flex flex-col sm:flex-row sm:items-start justify-between gap-3"
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {item.importante && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-md border border-amber-300">
                          <AlertTriangle className="w-3 h-3 text-amber-600" />
                          Urgente / Destaque
                        </span>
                      )}
                      <span className="text-2xs text-slate-400 font-mono flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {item.data}
                      </span>
                      <span className="text-2xs text-slate-300">·</span>
                      <span className="text-2xs text-slate-500 flex items-center gap-1 font-semibold">
                        <User className="w-3 h-3" />
                        {item.autor}
                      </span>
                    </div>

                    <h4 className="font-serif font-bold text-sm sm:text-base text-slate-900 leading-snug">
                      {item.titulo}
                    </h4>

                    <p className="text-xs text-slate-600 leading-relaxed">
                      {item.resumo}
                    </p>

                    {item.tags && item.tags.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        {item.tags.map((t, i) => (
                          <span
                            key={i}
                            className="text-[10px] text-teal-800 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200 font-medium"
                          >
                            #{t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    className="self-end sm:self-center text-xs font-bold text-teal-700 hover:text-teal-900 shrink-0 cursor-pointer"
                  >
                    {isAberto ? 'Recolher texto' : 'Ler na íntegra'}
                  </button>
                </div>

                {isAberto && (
                  <div className="px-4 sm:px-5 pb-5 pt-2 border-t border-slate-200/60 bg-white rounded-b-2xl">
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 leading-relaxed space-y-2 whitespace-pre-line font-medium">
                      {item.texto_completo}
                    </div>

                    {item.link_externo && (
                      <div className="mt-3 flex justify-end">
                        <a
                          href={item.link_externo}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs font-semibold text-teal-700 hover:text-teal-900"
                        >
                          <span>Acompanhar tramitação oficial / Notícia na íntegra</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
