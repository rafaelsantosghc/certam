import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './store/authContext';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { PortalHome } from './pages/PortalHome';
import { ConcursoCargoDashboard } from './pages/ConcursoCargoDashboard';
import { SimuladorLotes } from './pages/SimuladorLotes';
import { AdminPanel } from './pages/AdminPanel';
import { PrivacyPolicy } from './pages/PrivacyPolicy';
import { certamStore } from './store/certamStore';

export const AppContent: React.FC = () => {

  // Navigation routing state
  const [currentView, setCurrentView] = useState<'portal' | 'concurso' | 'lote' | 'admin' | 'politica'>('portal');
  const [concursoId, setConcursoId] = useState<string>('tjrs_2024');
  const [cargoId, setCargoId] = useState<string>('analista_judiciario');
  const [initialTab, setInitialTab] = useState<string>('dashboard');
  const [sidebarMobileOpen, setSidebarMobileOpen] = useState(false);

  // Read URL query params on initial mount
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const urlId = params.get('id');
      const urlCargo = params.get('cargo');
      const urlTab = params.get('tab');
      const urlAdmin = params.get('admin');

      if (urlAdmin === '1') {
        setCurrentView('admin');
      } else if (urlId) {
        setConcursoId(urlId);
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
    if (params?.concursoId) setConcursoId(params.concursoId);
    if (params?.cargoId) setCargoId(params.cargoId);
    if (params?.tab) setInitialTab(params.tab);

    setCurrentView(view as 'portal' | 'concurso' | 'lote' | 'admin' | 'politica');
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
      list.push({ label: 'Simulador de Lotes TJRS' });
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
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
