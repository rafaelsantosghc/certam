import React from 'react';
import { Concurso, CronogramaItem } from '../types';
import { Calendar, CheckCircle2, Clock, AlertCircle, ExternalLink, ChevronRight } from 'lucide-react';

interface LinhaDoTempoConcursoProps {
  concurso: Concurso;
}

export const LinhaDoTempoConcurso: React.FC<LinhaDoTempoConcursoProps> = ({ concurso }) => {
  const etapas: CronogramaItem[] = concurso.cronograma || [];

  const getStatusBadge = (status: CronogramaItem['status']) => {
    switch (status) {
      case 'concluido':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Concluída
          </span>
        );
      case 'em_andamento':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-md border border-amber-300 animate-pulse">
            <Clock className="w-3 h-3 text-amber-600" />
            Etapa Vigente
          </span>
        );
      case 'pendente':
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-md">
            <Clock className="w-3 h-3 text-slate-400" />
            Prevista
          </span>
        );
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-7 card-shadow space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <h3 className="font-serif font-bold text-lg text-[#07192B] flex items-center gap-2">
            <Calendar className="w-5 h-5 text-teal-600" />
            <span>Cronograma Oficial das Etapas do Certame</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Acompanhe a linha do tempo desde a publicação do edital até as convocações e audiências de posse
          </p>
        </div>

        <div className="flex items-center gap-2 text-2xs text-slate-600">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500" />
          <span>Realizado</span>
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-500 ml-2" />
          <span>Em Andamento</span>
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-slate-300 ml-2" />
          <span>Projeção Futura</span>
        </div>
      </div>

      {etapas.length === 0 ? (
        <div className="p-8 text-center text-xs text-slate-400">
          Nenhuma etapa cadastrada no cronograma deste concurso.
        </div>
      ) : (
        <div className="relative pl-6 sm:pl-8 before:absolute before:left-3 sm:before:left-4 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 space-y-6">
          {etapas.map((etapa, idx) => {
            const isConcluida = etapa.status === 'concluido';
            const isVigente = etapa.status === 'em_andamento';

            return (
              <div key={etapa.id || idx} className="relative group">
                {/* Marcador do Ponto na Linha */}
                <div
                  className={`absolute -left-6 sm:-left-8 top-1 w-6 h-6 rounded-full border-2 flex items-center justify-center text-2xs font-bold transition-all ${
                    isConcluida
                      ? 'bg-emerald-500 border-white text-white shadow-xs'
                      : isVigente
                      ? 'bg-amber-500 border-white text-white ring-4 ring-amber-100 shadow-sm'
                      : 'bg-white border-slate-300 text-slate-400'
                  }`}
                >
                  {isConcluida ? '✓' : idx + 1}
                </div>

                {/* Conteúdo da Etapa */}
                <div
                  className={`p-4 rounded-xl border transition-all ${
                    isVigente
                      ? 'bg-amber-50/40 border-amber-300 shadow-xs'
                      : 'bg-slate-50/70 hover:bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-sm text-slate-900 leading-tight">
                        {etapa.titulo}
                      </h4>
                      {getStatusBadge(etapa.status)}
                    </div>

                    <div className="text-xs font-mono font-bold text-teal-800 shrink-0">
                      {etapa.data_realizada ? (
                        <span>Realizada em: {etapa.data_realizada}</span>
                      ) : (
                        <span>Previsão: {etapa.data_prevista}</span>
                      )}
                    </div>
                  </div>

                  {etapa.descricao && (
                    <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                      {etapa.descricao}
                    </p>
                  )}

                  {etapa.link_edital && (
                    <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex items-center gap-1.5">
                      <a
                        href={etapa.link_edital}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] font-semibold text-teal-700 hover:text-teal-900 flex items-center gap-1 cursor-pointer"
                      >
                        <span>Acessar publicação oficial / edital no portal do órgão</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
