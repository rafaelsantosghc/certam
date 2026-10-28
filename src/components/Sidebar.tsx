import React from 'react';
import { useAuth } from '../store/authContext';
import { certamStore } from '../store/certamStore';
import { Concurso } from '../types';
import {
  LayoutGrid,
  MapPin,
  Settings,
  ShieldCheck,
  LogOut,
  ChevronRight,
  ChevronDown,
  HelpCircle,
} from 'lucide-react';

interface SidebarProps {
  currentView: string;
  onNavigate: (view: string, params?: { concursoId?: string; cargoId?: string; tab?: string }) => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  concursoAtualId?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onNavigate,
  isOpenMobile,
  onCloseMobile,
  concursoAtualId,
}) => {
  const { usuario, logout } = useAuth();
  const [concursos, setConcursos] = React.useState<Concurso[]>(() => certamStore.getConcursos());
  const [secaoConcursosAberta, setSecaoConcursosAberta] = React.useState(true);
  const [concursosExpandidos, setConcursosExpandidos] = React.useState<Record<string, boolean>>({
    tjrs_2025: true,
    mprs_2025: true,
  });

  const toggleConcurso = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConcursosExpandidos((prev) => ({
      ...prev,
      [id]: prev[id] === undefined ? false : !prev[id],
    }));
  };

  React.useEffect(() => {
    const handleUpdate = () => {
      setConcursos(certamStore.getConcursos());
    };
    window.addEventListener('certam_concursos_updated', handleUpdate);
    return () => window.removeEventListener('certam_concursos_updated', handleUpdate);
  }, []);

  const handleLinkClick = (view: string, params?: { concursoId?: string; cargoId?: string; tab?: string }) => {
    onNavigate(view, params);
    onCloseMobile();
  };

  return (
    <>
      {/* Overlay Mobile */}
      {isOpenMobile && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-slate-950/60 z-40 lg:hidden backdrop-blur-xs transition-opacity"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-[#07192B] text-white flex flex-col transition-transform duration-300 shrink-0 border-r border-[#0F2942] ${
          isOpenMobile ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Logo e Marca CERTAM */}
        <button
          type="button"
          onClick={() => handleLinkClick('portal')}
          className="h-[76px] flex items-center px-6 border-b border-[#0F2942] gap-3 group text-left w-full cursor-pointer"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#135A7A] via-[#1D8A8A] to-[#2DD4AA] p-1.5 flex items-center justify-center shrink-0 shadow-sm group-hover:brightness-110 transition-all">
            <svg className="w-full h-full" viewBox="0 0 100 100" fill="none">
              <path
                d="M 68 18 C 38 10 12 30 12 56 C 12 80 34 94 58 92 C 76 90 90 76 90 58"
                stroke="#FFFFFF"
                strokeWidth="12"
                strokeLinecap="round"
                fill="none"
              />
              <path
                d="M 32 53 L 48 69 L 88 23"
                stroke="#FFFFFF"
                strokeWidth="12"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div>
            <span className="text-xl font-bold tracking-widest text-white font-serif uppercase">
              CERTAM
            </span>
            <span className="block text-[10px] text-teal-300/80 font-medium tracking-wide">
              Portal do Concurseiro
            </span>
          </div>
        </button>

        {/* Navegação Geral do Portal */}
        <nav className="flex-1 py-5 space-y-1 overflow-y-auto">
          {/* 1. Concursos Cadastrados */}
          <button
            type="button"
            onClick={() => handleLinkClick('portal')}
            className={`w-full flex items-center gap-3.5 px-6 py-3 text-sm font-medium transition-all cursor-pointer text-left ${
              currentView === 'portal'
                ? 'font-semibold text-[#2DD4AA] bg-[#0C2640] border-l-4 border-[#2DD4AA]'
                : 'text-[#94A3B8] hover:text-white hover:bg-[#0C2640]/50 border-l-4 border-transparent'
            }`}
          >
            <span className="w-5 h-5 flex items-center justify-center">
              <LayoutGrid className="w-5 h-5" />
            </span>
            <span>Concursos cadastrados</span>
          </button>

          {/* 2. Simulador de Lotes e Comarcas */}
          {concursos.length > 0 && (
            <button
              type="button"
              onClick={() =>
                handleLinkClick('lote', {
                  concursoId: concursos[0].id,
                  cargoId: concursos[0].cargos?.[0]?.id || '',
                })
              }
              className={`w-full flex items-center gap-3.5 px-6 py-3 text-sm font-medium transition-all cursor-pointer text-left ${
                currentView === 'lote'
                  ? 'font-semibold text-[#2DD4AA] bg-[#0C2640] border-l-4 border-[#2DD4AA]'
                  : 'text-[#94A3B8] hover:text-white hover:bg-[#0C2640]/50 border-l-4 border-transparent'
              }`}
            >
              <span className="w-5 h-5 flex items-center justify-center">
                <MapPin className="w-5 h-5" />
              </span>
              <span>Simulador de lotes</span>
            </button>
          )}

          {/* 3. Painel Administrativo (Apenas para o Administrador) */}
          {usuario?.is_admin && (
            <button
              type="button"
              onClick={() => handleLinkClick('admin')}
              className={`w-full flex items-center gap-3.5 px-6 py-3 text-sm font-medium transition-all cursor-pointer text-left ${
                currentView === 'admin'
                  ? 'font-semibold text-amber-300 bg-[#0C2640] border-l-4 border-amber-400'
                  : 'text-[#94A3B8] hover:text-amber-300 hover:bg-[#0C2640]/50 border-l-4 border-transparent'
              }`}
            >
              <span className="w-5 h-5 flex items-center justify-center">
                <Settings className="w-5 h-5" />
              </span>
              <span className="flex items-center gap-1.5">
                <span>Painel administrativo</span>
                <span className="px-1 py-0.5 rounded text-[9px] bg-amber-400/20 text-amber-300 font-mono font-bold">
                  GERÊNCIA
                </span>
              </span>
            </button>
          )}

          {/* 4. Política de Privacidade */}
          <button
            type="button"
            onClick={() => handleLinkClick('politica')}
            className={`w-full flex items-center gap-3.5 px-6 py-3 text-sm font-medium transition-all cursor-pointer text-left ${
              currentView === 'politica'
                ? 'font-semibold text-[#2DD4AA] bg-[#0C2640] border-l-4 border-[#2DD4AA]'
                : 'text-[#94A3B8] hover:text-white hover:bg-[#0C2640]/50 border-l-4 border-transparent'
            }`}
          >
            <span className="w-5 h-5 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </span>
            <span>Política de privacidade</span>
          </button>

          {/* MENU DINÂMICO: CONCURSOS CADASTRADOS */}
          <div className="pt-4 border-t border-[#0F2942] px-4 space-y-2">
            <div className="flex items-center justify-between text-[10px] uppercase tracking-wider font-mono font-bold text-teal-400 px-2">
              <button
                type="button"
                onClick={() => setSecaoConcursosAberta(!secaoConcursosAberta)}
                className="flex items-center gap-1.5 hover:text-white cursor-pointer transition-colors"
                title={secaoConcursosAberta ? 'Recolher concursos ativos' : 'Expandir concursos ativos'}
              >
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${
                    secaoConcursosAberta ? '' : '-rotate-90'
                  }`}
                />
                <span>Concursos ativos</span>
              </button>
              <span className="px-1.5 py-0.5 rounded bg-teal-500/20 text-[#2DD4AA] text-[10px] font-mono font-bold">
                {concursos.length}
              </span>
            </div>

            {secaoConcursosAberta && (
              <div className="space-y-1">
                {concursos.length === 0 ? (
                  <p className="text-[11px] text-slate-400/80 px-2.5 py-1.5 italic">
                    Nenhum concurso ativo
                  </p>
                ) : (
                  concursos.map((conc) => {
                  const isActive =
                    (currentView === 'concurso' || currentView === 'concurso_geral') &&
                    concursoAtualId === conc.id;
                  const isExpanded = concursosExpandidos[conc.id] !== false;

                  return (
                    <div key={conc.id} className="space-y-0.5">
                      <div
                        className={`w-full rounded-xl text-xs font-semibold flex items-center justify-between transition-colors ${
                          isActive
                            ? 'bg-[#0C2640] text-teal-300 border border-teal-500/30'
                            : 'text-slate-300 hover:text-white hover:bg-[#0C2640]/40'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            handleLinkClick('concurso_geral', {
                              concursoId: conc.id,
                            })
                          }
                          className="flex-1 text-left px-3 py-2 truncate cursor-pointer hover:text-white"
                          title={`Visão geral de ${conc.nome}`}
                        >
                          <span className="truncate pr-1">{conc.orgao} - {conc.ano}</span>
                        </button>

                        <button
                          type="button"
                          onClick={(e) => toggleConcurso(conc.id, e)}
                          className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white cursor-pointer transition-colors mr-1 shrink-0"
                          title={isExpanded ? `Recolher cargos de ${conc.orgao}` : `Expandir cargos de ${conc.orgao}`}
                        >
                          <ChevronDown
                            className={`w-3.5 h-3.5 transition-transform duration-200 ${
                              isExpanded ? '' : '-rotate-90'
                            }`}
                          />
                        </button>
                      </div>

                      {/* Cargos deste concurso */}
                      {isExpanded && (
                        <div className="pl-3 space-y-0.5">
                          {conc.cargos?.map((cg) => (
                            <button
                              key={cg.id}
                              type="button"
                              onClick={() =>
                                handleLinkClick('concurso', {
                                  concursoId: conc.id,
                                  cargoId: cg.id,
                                })
                              }
                              className="w-full text-left px-2.5 py-1 text-[11px] text-slate-400 hover:text-teal-200 truncate rounded-md hover:bg-white/5 transition-colors flex items-center gap-1.5 cursor-pointer"
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-teal-500/50"></span>
                              <span className="truncate">{cg.nome}</span>
                            </button>
                          ))}

                          <button
                            type="button"
                            onClick={() =>
                              handleLinkClick('concurso_geral', {
                                concursoId: conc.id,
                              })
                            }
                            className="w-full text-left px-2.5 py-1 text-[11px] text-teal-300 hover:text-white truncate rounded-md hover:bg-white/5 transition-colors flex items-center gap-1.5 font-medium cursor-pointer"
                          >
                            <HelpCircle className="w-3.5 h-3.5 text-[#2DD4AA] shrink-0" />
                            <span>Visão geral &amp; Quadro de vagas</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
              </div>
            )}
          </div>
        </nav>

        {/* Rodapé da Sidebar */}
        <div className="p-4 border-t border-[#0F2942] space-y-2.5">
          {usuario ? (
            <div className="px-3 py-2.5 rounded-xl bg-[#0C2640] border border-teal-500/20 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className={`font-bold block text-[11px] ${usuario.is_admin ? 'text-amber-300' : 'text-teal-400'}`}>
                  {usuario.is_admin ? 'Administrador' : 'Candidato'}
                </span>
                {usuario.is_admin && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] bg-amber-400/20 text-amber-300 font-mono font-bold">
                    ADMIN
                  </span>
                )}
              </div>
              <span className="text-white font-medium text-xs truncate block">
                {usuario.nome}
              </span>
              <span className="text-slate-400 font-mono text-[10px] truncate block">
                {usuario.email}
              </span>
            </div>
          ) : (
            <div className="px-3 py-2.5 rounded-xl bg-[#0C2640]/60 border border-slate-700/50 text-xs space-y-2">
              <span className="text-slate-400 text-[11px] block">Acesso ao portal</span>
              <button
                type="button"
                onClick={() => handleLinkClick('portal')}
                className="w-full py-1.5 px-2 bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/30 text-teal-300 rounded-lg text-xs font-semibold text-center cursor-pointer transition-colors block"
              >
                Identificar-se
              </button>
            </div>
          )}

          {usuario && (
            <button
              type="button"
              onClick={logout}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Desconectar conta</span>
            </button>
          )}
        </div>
      </aside>
    </>
  );
};
