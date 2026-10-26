import React, { useState, useEffect } from 'react';
import { AuthProvider } from './store/authContext';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { PortalHome } from './pages/PortalHome';
import { ConcursoCargoDashboard } from './pages/ConcursoCargoDashboard';
import { SimuladorLotes } from './pages/SimuladorLotes';
import { AdminPanel } from './pages/AdminPanel';
import { PrivacyPolicy } from './pages/PrivacyPolicy';
import { certamStore } from './store/certamStore';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('CERTAM ErrorBoundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#07192B] text-white flex items-center justify-center p-6 text-center">
          <div className="max-w-md bg-[#0C2640] p-8 rounded-2xl border border-teal-500/30 space-y-4 shadow-2xl">
            <div className="w-12 h-12 mx-auto rounded-xl bg-teal-500/20 text-[#2DD4AA] flex items-center justify-center font-bold text-xl">
              ✓
            </div>
            <h2 className="text-xl font-bold font-serif">CERTAM • Portal do Concurseiro</h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              Foi identificado um estado inconsistente no cache do navegador. Clique no botão abaixo para restaurar o portal com segurança.
            </p>
            <button
              type="button"
              onClick={() => {
                try {
                  localStorage.clear();
                } catch {
                  // ignore
                }
                window.location.href = '/';
              }}
              className="bg-[#2DD4AA] text-slate-950 font-bold px-5 py-2.5 rounded-xl text-xs hover:bg-[#20BE96] transition-all cursor-pointer shadow-md"
            >
              Restaurar Dados e Recarregar Portal
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export const AppContent: React.FC = () => {
  // Navigation routing state
  const [currentView, setCurrentView] = useState<'portal' | 'concurso' | 'lote' | 'admin' | 'politica'>('portal');
  const [concursoId, setConcursoId] = useState<string>('tjrs_2024');
  const [cargoId, setCargoId] = useState<string>('analista_judiciario');
  const [initialTab, setInitialTab] = useState<string>('dashboard');
  const [sidebarMobileOpen, setSidebarMobileOpen] = useState(false);

  // Read URL query params and path on initial mount
  useEffect(() => {
    try {
      const pathname = window.location.pathname.toLowerCase();
      const params = new URLSearchParams(window.location.search);
      const urlId = params.get('id');
      const urlCargo = params.get('cargo');
      const urlTab = params.get('tab');
      const urlAdmin = params.get('admin');

      if (urlAdmin === '1' || pathname.includes('admin')) {
        setCurrentView('admin');
      } else if (urlTab === 'lote' || pathname.includes('lote')) {
        setCurrentView('lote');
      } else if (urlTab === 'politica' || pathname.includes('politica')) {
        setCurrentView('politica');
      } else if (urlId || pathname.includes('concurso')) {
        if (urlId) setConcursoId(urlId);
        if (urlCargo) setCargoId(urlCargo);
        if (urlTab) setInitialTab(urlTab);
        setCurrentView('concurso');
      }
    } catch {
      // ignore
    }
  }, []);

  const handleNavigate = (
    view: string,
    params?: { concursoId?: string; cargoId?: string; tab?: string }
  ) => {
    const cId = params?.concursoId || concursoId;
    const cgId = params?.cargoId || cargoId;
    const t = params?.tab || initialTab;

    if (params?.concursoId) setConcursoId(params.concursoId);
    if (params?.cargoId) setCargoId(params.cargoId);
    if (params?.tab) setInitialTab(params.tab);

    setCurrentView(view as 'portal' | 'concurso' | 'lote' | 'admin' | 'politica');

    // Sincronizar Permalinks na barra de navegação do browser
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('id');
      url.searchParams.delete('cargo');
      url.searchParams.delete('tab');
      url.searchParams.delete('admin');

      if (view === 'concurso') {
        url.searchParams.set('id', cId);
        if (cgId) url.searchParams.set('cargo', cgId);
        if (t) url.searchParams.set('tab', t);
      } else if (view === 'lote') {
        url.searchParams.set('tab', 'lote');
        if (cId) url.searchParams.set('id', cId);
        if (cgId) url.searchParams.set('cargo', cgId);
      } else if (view === 'admin') {
        url.searchParams.set('admin', '1');
      } else if (view === 'politica') {
        url.searchParams.set('tab', 'politica');
      }
      window.history.pushState({}, '', url.toString());
    } catch {
      // ignore
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Breadcrumbs computation
  const breadcrumbs = React.useMemo(() => {
    const list: { label: string; onClick?: () => void }[] = [
      { label: 'Portal CERTAM', onClick: () => handleNavigate('portal') },
    ];

    if (currentView === 'concurso') {
      const conc = certamStore.getConcurso(concursoId);
      const cg = certamStore.getCargo(concursoId, cargoId);
      if (conc) {
        list.push({ label: conc.orgao, onClick: () => handleNavigate('portal') });
      }
      if (cg) {
        list.push({ label: cg.nome });
      }
    } else if (currentView === 'lote') {
      list.push({ label: 'Simulador de Lotes' });
    } else if (currentView === 'admin') {
      list.push({ label: 'Painel do Administrador' });
    } else if (currentView === 'politica') {
      list.push({ label: 'Política de Privacidade' });
    }

    return list;
  }, [currentView, concursoId, cargoId]);

  return (
    <div className="min-h-screen flex flex-col bg-[#F4F6F9] text-[#0F172A]">
      {/* Sidebar Lateral (#07192B) */}
      <Sidebar
        currentView={currentView}
        onNavigate={handleNavigate}
        isOpenMobile={sidebarMobileOpen}
        onCloseMobile={() => setSidebarMobileOpen(false)}
        concursoAtualId={concursoId}
      />

      {/* Conteúdo Principal com compensação de largura da sidebar (lg:pl-64) */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64">
        {/* Top Header */}
        <Header
          onOpenMobileSidebar={() => setSidebarMobileOpen(true)}
          breadcrumbs={breadcrumbs}
          onNavigateAdmin={() => handleNavigate('admin')}
          showAdminShortcut={currentView !== 'admin'}
          onNavigate={handleNavigate}
          concursoAtualId={concursoId}
        />

        {/* Área Central Renderizada */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          {currentView === 'portal' && <PortalHome onNavigate={handleNavigate} />}

          {currentView === 'concurso' && (
            <ConcursoCargoDashboard
              concursoId={concursoId}
              cargoId={cargoId}
              initialTab={initialTab}
              onNavigate={handleNavigate}
            />
          )}

          {currentView === 'lote' && (
            <SimuladorLotes
              concursoId={concursoId}
              cargoId={cargoId}
              onNavigate={handleNavigate}
            />
          )}

          {currentView === 'admin' && (
            <AdminPanel
              onNavigate={handleNavigate}
            />
          )}

          {currentView === 'politica' && (
            <PrivacyPolicy onBack={() => handleNavigate('portal')} />
          )}
        </main>

        {/* Rodapé Oficial CERTAM */}
        <footer className="bg-white border-t border-slate-200 py-6 px-4 sm:px-8 text-xs text-slate-500 mt-auto no-print">
          <div className="max-w-[1880px] mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="font-serif font-bold text-slate-800 tracking-wider uppercase text-sm">
                CERTAM
              </span>
              <span className="text-teal-600 text-xs font-semibold">Portal do Concurseiro</span>
              <span className="text-slate-300">·</span>
              <span className="italic text-slate-400">"Nunca é apenas uma prova."</span>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs">
              <button
                type="button"
                onClick={() => handleNavigate('portal')}
                className="text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                Início
              </button>
              <span className="text-slate-300">·</span>
              <button
                type="button"
                onClick={() => handleNavigate('lote')}
                className="text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                Simulador de Lotes TJRS
              </button>
              <span className="text-slate-300">·</span>
              <button
                type="button"
                onClick={() => handleNavigate('politica')}
                className="text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                Privacidade &amp; LGPD
              </button>
              <span className="text-slate-300">·</span>
              <button
                type="button"
                onClick={() => handleNavigate('admin')}
                className="text-amber-700 font-semibold hover:underline cursor-pointer"
              >
                Painel Admin
              </button>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ErrorBoundary>
  );
}
