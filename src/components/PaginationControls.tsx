import React, { useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, ChevronsDown, Layers, List, Loader2 } from 'lucide-react';

export type PaginationMode = 'pagination' | 'infinite';

interface PaginationControlsProps {
  mode: PaginationMode;
  onModeChange?: (mode: PaginationMode) => void;
  currentPage: number;
  totalPages: number;
  pageSize: number;
  pageSizeOptions?: number[];
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  totalItems: number;
  displayedCount: number;
  itemLabel?: string;
  onLoadMore?: () => void;
  hasMoreLocal?: boolean;
  /** Suporte a carregamento sob demanda (lazy/progressivo) do Supabase */
  hasMoreRemote?: boolean;
  isLoadingRemote?: boolean;
  onLoadMoreRemote?: () => void;
  remoteStatusLabel?: string;
  /** Elemento scrollável pai (opcional) para o IntersectionObserver em tabelas com max-h */
  scrollRootRef?: React.RefObject<HTMLElement | null>;
  className?: string;
}

export const PaginationControls: React.FC<PaginationControlsProps> = ({
  mode,
  onModeChange,
  currentPage,
  totalPages,
  pageSize,
  pageSizeOptions = [6, 12, 24],
  onPageChange,
  onPageSizeChange,
  totalItems,
  displayedCount,
  itemLabel = 'registros',
  onLoadMore,
  hasMoreLocal = false,
  hasMoreRemote = false,
  isLoadingRemote = false,
  onLoadMoreRemote,
  remoteStatusLabel,
  scrollRootRef,
  className = '',
}) => {
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const canAutoLoad = mode === 'infinite' && (hasMoreLocal || hasMoreRemote);

  useEffect(() => {
    if (!canAutoLoad) return;
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry || !entry.isIntersecting) return;
        if (hasMoreLocal && onLoadMore) {
          onLoadMore();
        } else if (hasMoreRemote && !isLoadingRemote && onLoadMoreRemote) {
          onLoadMoreRemote();
        }
      },
      {
        root: scrollRootRef?.current || null,
        rootMargin: '160px 0px',
        threshold: 0.05,
      }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [canAutoLoad, hasMoreLocal, hasMoreRemote, isLoadingRemote, onLoadMore, onLoadMoreRemote, scrollRootRef]);

  const startIdx = totalItems === 0 ? 0 : mode === 'infinite' ? 1 : (currentPage - 1) * pageSize + 1;
  const endIdx =
    totalItems === 0
      ? 0
      : mode === 'infinite'
      ? Math.min(displayedCount, totalItems)
      : Math.min(currentPage * pageSize, totalItems);

  // Calcula janelas de números de página com reticências
  const pageNumbers: (number | 'ellipsis')[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pageNumbers.push(i);
  } else {
    pageNumbers.push(1);
    if (currentPage > 3) pageNumbers.push('ellipsis');
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);
    for (let i = start; i <= end; i++) pageNumbers.push(i);
    if (currentPage < totalPages - 2) pageNumbers.push('ellipsis');
    pageNumbers.push(totalPages);
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Sentinela invisível + Botão "Carregar mais" no modo Rolagem Infinita */}
      {mode === 'infinite' && (hasMoreLocal || hasMoreRemote) && (
        <div ref={sentinelRef} className="flex flex-col items-center justify-center py-3 gap-2">
          <button
            type="button"
            disabled={isLoadingRemote}
            onClick={() => {
              if (hasMoreLocal && onLoadMore) {
                onLoadMore();
              } else if (hasMoreRemote && onLoadMoreRemote) {
                onLoadMoreRemote();
              }
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-teal-50 text-teal-800 border border-teal-200 font-bold text-xs shadow-2xs transition-all cursor-pointer disabled:opacity-60"
          >
            {isLoadingRemote ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Carregando próximo lote do Supabase...</span>
              </>
            ) : (
              <>
                <ChevronsDown className="w-3.5 h-3.5" />
                <span>
                  {hasMoreLocal
                    ? `Carregar mais ${itemLabel} (${displayedCount} de ${totalItems})`
                    : `Carregar mais ${itemLabel} do servidor`}
                </span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Barra principal de paginação / status / troca de modo */}
      <div className="px-4 sm:px-6 py-3.5 bg-slate-50/90 border border-slate-200/80 rounded-2xl flex flex-col lg:flex-row items-center justify-between gap-3 text-xs text-slate-600">
        {/* Esquerda: Contador + Status Remoto */}
        <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2.5">
          <span>
            Mostrando <strong className="text-slate-900">{startIdx}</strong> a{' '}
            <strong className="text-slate-900">{endIdx}</strong> de{' '}
            <strong className="text-slate-900">{totalItems}</strong> {itemLabel}
          </span>

          {remoteStatusLabel && (
            <span className="px-2 py-0.5 rounded-md bg-teal-50 border border-teal-200 text-teal-800 font-mono text-[10px] font-semibold">
              {remoteStatusLabel}
            </span>
          )}

          {hasMoreRemote && onLoadMoreRemote && mode === 'pagination' && (
            <button
              type="button"
              disabled={isLoadingRemote}
              onClick={onLoadMoreRemote}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#07192B] hover:bg-[#0C2640] text-[#2DD4AA] font-bold text-[11px] transition-colors cursor-pointer disabled:opacity-60"
            >
              {isLoadingRemote ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Layers className="w-3 h-3" />
              )}
              <span>{isLoadingRemote ? 'Buscando...' : 'Carregar mais do Supabase'}</span>
            </button>
          )}
        </div>

        {/* Direita: Seletor de Modo + Itens por página + Navegação */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          {/* Alternador Paginação / Rolagem Infinita */}
          {onModeChange && (
            <div className="inline-flex items-center p-0.5 bg-slate-200/80 rounded-lg border border-slate-300/60">
              <button
                type="button"
                onClick={() => onModeChange('infinite')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                  mode === 'infinite'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Carregar automaticamente ao rolar a página"
              >
                <ChevronsDown className="w-3 h-3" />
                <span>Rolagem Infinita</span>
              </button>
              <button
                type="button"
                onClick={() => onModeChange('pagination')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                  mode === 'pagination'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Navegar por páginas numeradas"
              >
                <List className="w-3 h-3" />
                <span>Páginas</span>
              </button>
            </div>
          )}

          {/* Seletor de tamanho da página/lote */}
          {onPageSizeChange && pageSizeOptions.length > 0 && (
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              aria-label="Itens por página"
              className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-[11px] font-semibold text-slate-700 cursor-pointer focus:outline-hidden focus:border-teal-600"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt} / {mode === 'infinite' ? 'lote' : 'página'}
                </option>
              ))}
            </select>
          )}

          {/* Botões de páginas (somente no modo Paginação) */}
          {mode === 'pagination' && totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                disabled={currentPage <= 1}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-bold text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 cursor-pointer transition-colors"
                title="Página anterior"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Anterior</span>
              </button>

              <div className="hidden sm:flex items-center gap-1">
                {pageNumbers.map((pg, idx) =>
                  pg === 'ellipsis' ? (
                    <span key={`ell-${idx}`} className="px-1.5 text-slate-400 font-mono">
                      …
                    </span>
                  ) : (
                    <button
                      key={pg}
                      type="button"
                      onClick={() => onPageChange(pg)}
                      className={`min-w-[28px] h-7 px-2 rounded-lg font-mono text-[11px] font-bold transition-colors cursor-pointer ${
                        pg === currentPage
                          ? 'bg-[#07192B] text-[#2DD4AA] shadow-2xs'
                          : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {pg}
                    </button>
                  )
                )}
              </div>

              <span className="sm:hidden px-2 font-mono text-[11px] text-slate-700">
                {currentPage}/{totalPages}
              </span>

              <button
                type="button"
                onClick={() => {
                  const next = Math.min(totalPages, currentPage + 1);
                  onPageChange(next);
                  if (next === totalPages && hasMoreRemote && onLoadMoreRemote && !isLoadingRemote) {
                    onLoadMoreRemote();
                  }
                }}
                disabled={currentPage >= totalPages && !hasMoreRemote}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-bold text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 cursor-pointer transition-colors"
                title="Próxima página"
              >
                <span className="hidden sm:inline">Próxima</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
