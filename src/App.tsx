import React, { useState, useEffect } from 'react';
import { AuthProvider } from './store/authContext';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { PortalHome } from './pages/PortalHome';
import { ConcursoGeralView } from './pages/ConcursoGeralView';
import { ConcursoCargoDashboard } from './pages/ConcursoCargoDashboard';
import { SimuladorLotes } from './pages/SimuladorLotes';
import { AdminPanel } from './pages/AdminPanel';
import { PrivacyPolicy } from './pages/PrivacyPolicy';
import { certamStore } from './store/certamStore';
import { useAuth } from './store/authContext';
import { PerfilCandidatoModal } from './components/PerfilCandidatoModal';
import { NotificationToast } from './components/NotificationToast';
import { AdminOverlay } from './components/AdminOverlay';
import { NotificationProvider } from './store/notificationContext';
import { OfflineIndicator } from './components/PWAInstallButton';
import { ThemeProvider } from './store/themeContext';
import { errorLogStore } from './store/errorLogStore';
import { userRegistryStore } from './store/userRegistryStore';
import { PersistentChatWidget } from './components/PersistentChatWidget';
import { ArrowUp } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  logId?: string;
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
    const msg = String(error?.message || '');
    const isStaleViteChunkError =
      msg.includes("reading 'use") ||
      msg.includes('Invalid hook call') ||
      msg.includes('Failed to fetch dynamically imported module') ||
      msg.includes('Importing a module script failed');

    if (isStaleViteChunkError) {
      try {
        const lastReload = Number(sessionStorage.getItem('certam_chunk_reload') || '0');
        if (Date.now() - lastReload > 10000) {
          sessionStorage.setItem('certam_chunk_reload', String(Date.now()));
          window.location.reload();
          return;
        }
      } catch {
        // ignore
      }
    }

    console.error('CERTAM ErrorBoundary:', error, errorInfo);
    void errorLogStore
      .logError({
        error,
        componentStack: errorInfo.componentStack,
        origem: 'ErrorBoundary',
      })
      .then((entry) => {
        this.setState({ logId: entry.id });
      });
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
              Foi identificado um erro inesperado na interface. O relatório técnico foi enviado automaticamente ao painel de monitoramento do administrador no Supabase.
            </p>
            {this.state.error?.message && (
              <div className="p-2.5 rounded-xl bg-slate-950/60 border border-rose-500/30 text-[11px] font-mono text-rose-300 text-left break-words">
                <div>Falha: {this.state.error.message}</div>
                {this.state.logId && (
                  <div className="text-[10px] text-teal-300 mt-1">
                    Protocolo de Log: {this.state.logId}
                  </div>
                )}
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                try {
                  sessionStorage.removeItem('certam_chunk_reload');
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
  const { usuario } = useAuth();

  // Navigation routing state
  const [currentView, setCurrentView] = useState<'portal' | 'concurso_geral' | 'concurso' | 'lote' | 'admin' | 'politica'>('portal');
  const [concursoId, setConcursoId] = useState<string>(() => certamStore.getConcursos()[0]?.id || '');
  const [cargoId, setCargoId] = useState<string>(() => certamStore.getConcursos()[0]?.cargos?.[0]?.id || '');
  const [initialTab, setInitialTab] = useState<string>('dashboard');
  const [loteId, setLoteId] = useState<string>('');
  const [sidebarMobileOpen, setSidebarMobileOpen] = useState(false);
  const [historyStack, setHistoryStack] = useState<{ view: string; params?: any }[]>([]);

  // Modal Obrigatório no Primeiro Login
  const [modalPerfilObrigatorioAberto, setModalPerfilObrigatorioAberto] = useState(false);

  useEffect(() => {
    try {
      sessionStorage.removeItem('certam_chunk_reload');
    } catch {
      // ignore
    }
    userRegistryStore.limparChavesOrfasEObsoletas();
    errorLogStore.initGlobalListeners();
    const handleAbrirObrigatorio = () => {
      setModalPerfilObrigatorioAberto(true);
    };
    window.addEventListener('certam_abrir_perfil_candidato_obrigatorio', handleAbrirObrigatorio);
    return () => window.removeEventListener('certam_abrir_perfil_candidato_obrigatorio', handleAbrirObrigatorio);
  }, []);

  // Se o usuário estiver autenticado e ainda não tiver definido Nome e CPF válido (11 dígitos), abre o modal obrigatório de 1º acesso
  useEffect(() => {
    if (
      usuario &&
      !usuario.is_admin &&
      (!usuario.cpf || usuario.cpf.replace(/\D/g, '').length < 11 || !usuario.nome || !usuario.nome.trim())
    ) {
      setModalPerfilObrigatorioAberto(true);
    } else {
      setModalPerfilObrigatorioAberto(false);
    }
  }, [usuario]);

  useEffect(() => {
    const handleConcursosSync = () => {
      const lista = certamStore.getConcursos();
      if (lista.length > 0) {
        setConcursoId((prev) => {
          if (prev && lista.some((c) => c.id === prev)) return prev;
          return lista[0].id;
        });
        setCargoId((prev) => {
          const conc = lista.find((c) => c.id === concursoId) || lista[0];
          if (prev && conc?.cargos?.some((cg) => cg.id === prev)) return prev;
          return conc?.cargos?.[0]?.id || '';
        });
      }
    };
    window.addEventListener('certam_concursos_updated', handleConcursosSync);
    window.addEventListener('storage', handleConcursosSync);
    return () => {
      window.removeEventListener('certam_concursos_updated', handleConcursosSync);
      window.removeEventListener('storage', handleConcursosSync);
    };
  }, [concursoId]);

  // Read URL query params and path on initial mount
  useEffect(() => {
    try {
      const pathname = window.location.pathname.toLowerCase();
      const params = new URLSearchParams(window.location.search);
      const urlId = params.get('id');
      const urlCargo = params.get('cargo');
      const urlTab = params.get('tab');
      const urlAdmin = params.get('admin');
      const urlLote = params.get('lote');

      const concursosDisponiveis = certamStore.getConcursos();
      const concursoValido = urlId ? concursosDisponiveis.find((c) => c.id === urlId) : null;
      const concursoIdFinal = concursoValido ? urlId : concursosDisponiveis[0]?.id || 'tjrs_2025';

      if (concursoIdFinal) {
        setConcursoId(concursoIdFinal);
      }

      if (urlAdmin === '1' || pathname.includes('admin')) {
        if (urlTab) setInitialTab(urlTab);
        setCurrentView('admin');
      } else if (urlTab === 'lote' || pathname.includes('lote')) {
        if (concursoIdFinal) setConcursoId(concursoIdFinal);
        if (urlCargo) setCargoId(urlCargo);
        if (urlLote) setLoteId(urlLote);
        setCurrentView('lote');
      } else if (urlTab === 'politica' || pathname.includes('politica')) {
        setCurrentView('politica');
      } else if (urlId || pathname.includes('concurso') || concursoValido) {
        const concRef = concursoValido || concursosDisponiveis[0];
        if (urlCargo || urlTab) {
          const resolvedCargo =
            (urlCargo && concRef?.cargos?.some((cg) => cg.id === urlCargo) ? urlCargo : null) ||
            concRef?.cargos?.[0]?.id ||
            cargoId;
          if (resolvedCargo) setCargoId(resolvedCargo);
          if (urlTab) setInitialTab(urlTab);
          setCurrentView('concurso');
        } else {
          setCurrentView('concurso_geral');
        }
      }
    } catch {
      // Fallback seguro caso ocorra qualquer exceção ao analisar a URL
      setCurrentView('portal');
    }
  }, []);

  const handleNavigate = (
    view: string,
    params?: { concursoId?: string; cargoId?: string; tab?: string; loteId?: string }
  ) => {
    // Salvar no histórico de navegação
    setHistoryStack((prev) => [
      ...prev,
      {
        view: currentView,
        params: { concursoId, cargoId, tab: initialTab, loteId },
      },
    ]);

    const cId = params?.concursoId || concursoId;
    const concAlvo = certamStore.getConcurso(cId) || certamStore.getConcursos()[0];
    let cgId = params?.cargoId || cargoId;
    if (concAlvo && (!cgId || !concAlvo.cargos?.some((c) => c.id === cgId))) {
      cgId = concAlvo.cargos?.[0]?.id || cgId;
    }

    const lId = params?.loteId !== undefined ? params.loteId : loteId;
    const t =
      params?.tab !== undefined
        ? params.tab
        : view === 'concurso'
        ? 'dashboard'
        : view === 'admin'
        ? 'concursos'
        : initialTab;

    if (params?.concursoId) setConcursoId(params.concursoId);
    if (cgId) setCargoId(cgId);
    if (params?.loteId !== undefined) setLoteId(params.loteId);
    setInitialTab(t);

    setCurrentView(view as 'portal' | 'concurso_geral' | 'concurso' | 'lote' | 'admin' | 'politica');

    // Sincronizar Permalinks na barra de navegação do browser
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('id');
      url.searchParams.delete('cargo');
      url.searchParams.delete('tab');
      url.searchParams.delete('admin');
      url.searchParams.delete('lote');

      if (view === 'concurso_geral') {
        url.searchParams.set('id', cId);
      } else if (view === 'concurso') {
        url.searchParams.set('id', cId);
        if (cgId) url.searchParams.set('cargo', cgId);
        if (t) url.searchParams.set('tab', t);
      } else if (view === 'lote') {
        url.searchParams.set('tab', 'lote');
        if (cId) url.searchParams.set('id', cId);
        if (cgId) url.searchParams.set('cargo', cgId);
        if (lId) url.searchParams.set('lote', lId);
      } else if (view === 'admin') {
        url.searchParams.set('admin', '1');
        if (t && t !== 'dashboard') url.searchParams.set('tab', t);
      } else if (view === 'politica') {
        url.searchParams.set('tab', 'politica');
      }
      window.history.pushState({}, '', url.toString());
    } catch {
      // ignore
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleVoltar = () => {
    if (historyStack.length > 0) {
      const previous = historyStack[historyStack.length - 1];
      setHistoryStack((prev) => prev.slice(0, prev.length - 1));
      if (previous.params?.concursoId) setConcursoId(previous.params.concursoId);
      if (previous.params?.cargoId) setCargoId(previous.params.cargoId);
      if (previous.params?.tab) setInitialTab(previous.params.tab);
      setCurrentView(previous.view as any);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // Navegação padrão inteligente de fallback
    if (currentView === 'concurso') {
      setCurrentView('concurso_geral');
    } else if (
      currentView === 'concurso_geral' ||
      currentView === 'lote' ||
      currentView === 'admin' ||
      currentView === 'politica'
    ) {
      setCurrentView('portal');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Breadcrumbs computation
  const breadcrumbs = React.useMemo(() => {
    const list: { label: string; onClick?: () => void }[] = [
      { label: 'Portal CERTAM', onClick: () => handleNavigate('portal') },
    ];

    if (currentView === 'concurso_geral') {
      const conc = certamStore.getConcurso(concursoId);
      if (conc) {
        list.push({ label: conc.orgao, onClick: () => handleNavigate('concurso_geral', { concursoId }) });
      }
      list.push({ label: 'Visão Geral do Concurso' });
    } else if (currentView === 'concurso') {
      const conc = certamStore.getConcurso(concursoId);
      const cg = certamStore.getCargo(concursoId, cargoId);
      if (conc) {
        list.push({ label: conc.orgao, onClick: () => handleNavigate('concurso_geral', { concursoId }) });
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

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mostrarVoltarAoTopo, setMostrarVoltarAoTopo] = useState(false);
  const [chatBounds, setChatBounds] = useState<{
    left: number;
    top: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
    isOpen: boolean;
  } | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      setMostrarVoltarAoTopo(window.scrollY > 300);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleChatBounds = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      if (detail && typeof detail === 'object') {
        setChatBounds(detail);
      }
    };
    window.addEventListener('certam_chat_bounds_changed', handleChatBounds);
    return () => window.removeEventListener('certam_chat_bounds_changed', handleChatBounds);
  }, []);

  // Calcula a posição do botão Voltar ao Topo garantindo que nunca fique escondido atrás do chat ou do balão flutuante
  const voltarAoTopoPos = React.useMemo(() => {
    // Por padrão (se não houver medição do chat ainda):
    const defaultPos = {
      bottom: '100px',
      right: '24px',
      left: 'auto',
      top: 'auto',
    };

    if (typeof window === 'undefined' || !chatBounds) {
      return defaultPos;
    }

    const btnWidth = 48;
    const btnHeight = 48;
    const margin = 20;
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    // Posições candidatas onde o botão pode ficar confortavelmente:
    // 1. Canto inferior direito acima do balão (padrão)
    // 2. Canto inferior esquerdo (caso o chat cubra o lado direito)
    // 3. À esquerda da janela do chat
    // 4. Acima da janela do chat
    // 5. Canto inferior central
    const candidatePositions = [
      // 1. Canto inferior direito tradicional (acima de um balão fechado no canto)
      {
        left: windowWidth - btnWidth - margin,
        top: windowHeight - btnHeight - 96,
        style: { right: `${margin}px`, bottom: '96px', left: 'auto', top: 'auto' },
      },
      // 2. Canto inferior esquerdo (ótimo quando o chat foi arrastado ou aberto na direita)
      {
        left: margin + (sidebarCollapsed ? 70 : 16),
        top: windowHeight - btnHeight - margin,
        style: {
          left: `${margin + (sidebarCollapsed ? 70 : 16)}px`,
          bottom: `${margin}px`,
          right: 'auto',
          top: 'auto',
        },
      },
      // 3. À esquerda do chat com margem de segurança
      {
        left: Math.max(margin, chatBounds.left - btnWidth - 16),
        top: Math.min(windowHeight - btnHeight - margin, Math.max(margin, chatBounds.bottom - btnHeight)),
        style: {
          left: `${Math.max(margin, chatBounds.left - btnWidth - 16)}px`,
          top: `${Math.min(windowHeight - btnHeight - margin, Math.max(margin, chatBounds.bottom - btnHeight))}px`,
          right: 'auto',
          bottom: 'auto',
        },
      },
      // 4. Acima do chat com margem de segurança
      {
        left: Math.min(windowWidth - btnWidth - margin, Math.max(margin, chatBounds.right - btnWidth)),
        top: Math.max(margin, chatBounds.top - btnHeight - 16),
        style: {
          left: `${Math.min(windowWidth - btnWidth - margin, Math.max(margin, chatBounds.right - btnWidth))}px`,
          top: `${Math.max(margin, chatBounds.top - btnHeight - 16)}px`,
          right: 'auto',
          bottom: 'auto',
        },
      },
      // 5. Canto inferior direito mais alto
      {
        left: windowWidth - btnWidth - margin,
        top: Math.max(margin, windowHeight - btnHeight - 180),
        style: { right: `${margin}px`, bottom: '180px', left: 'auto', top: 'auto' },
      },
    ];

    // Verifica sobreposição com a caixa do chat (com padding de proteção de 16px)
    const padding = 16;
    for (const cand of candidatePositions) {
      const candRight = cand.left + btnWidth;
      const candBottom = cand.top + btnHeight;

      const overlaps = !(
        candRight + padding <= chatBounds.left ||
        cand.left >= chatBounds.right + padding ||
        candBottom + padding <= chatBounds.top ||
        cand.top >= chatBounds.bottom + padding
      );

      if (!overlaps) {
        return cand.style;
      }
    }

    // Se todas sobrepuserem (tela muito pequena), força canto inferior esquerdo
    return {
      left: '20px',
      bottom: '20px',
      right: 'auto',
      top: 'auto',
    };
  }, [chatBounds, sidebarCollapsed]);

  return (
    <div className="min-h-screen flex flex-col bg-[var(--certam-light-bg)] text-[var(--certam-text-primary)] transition-colors duration-200">
      {/* Sidebar Lateral (#07192B) */}
      <Sidebar
        currentView={currentView}
        onNavigate={handleNavigate}
        isOpenMobile={sidebarMobileOpen}
        onCloseMobile={() => setSidebarMobileOpen(false)}
        concursoAtualId={concursoId}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* Conteúdo Principal com compensação de largura da sidebar dinâmica rigorosamente sincronizada */}
      <div className={`flex-1 flex flex-col min-w-0 transition-[padding] duration-300 ease-in-out ${sidebarCollapsed ? 'lg:pl-16' : 'lg:pl-64'}`}>
        <OfflineIndicator />
        {/* Top Header */}
        <Header
          onOpenMobileSidebar={() => setSidebarMobileOpen(true)}
          onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
          isSidebarCollapsed={sidebarCollapsed}
          breadcrumbs={breadcrumbs}
          onNavigateAdmin={() => handleNavigate('admin')}
          showAdminShortcut={currentView !== 'admin'}
          onNavigate={handleNavigate}
          concursoAtualId={concursoId}
        />

        {/* Área Central Renderizada */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          {currentView === 'portal' && <PortalHome onNavigate={handleNavigate} />}

          {currentView === 'concurso_geral' && (
            <ConcursoGeralView
              concursoId={concursoId}
              onNavigate={handleNavigate}
              onVoltar={handleVoltar}
            />
          )}

          {currentView === 'concurso' && (
            <ConcursoCargoDashboard
              concursoId={concursoId}
              cargoId={cargoId}
              initialTab={initialTab}
              onNavigate={handleNavigate}
              onVoltar={handleVoltar}
            />
          )}

          {currentView === 'lote' && (
            <SimuladorLotes
              concursoId={concursoId}
              cargoId={cargoId}
              loteId={loteId}
              onNavigate={handleNavigate}
              onVoltar={handleVoltar}
            />
          )}

          {currentView === 'admin' && (
            <AdminPanel
              initialTab={initialTab}
              onNavigate={handleNavigate}
              onVoltar={handleVoltar}
            />
          )}

          {currentView === 'politica' && (
            <PrivacyPolicy onBack={handleVoltar} />
          )}
        </main>

        {/* Modal de Cadastro Inicial Obrigatório (Primeiro Acesso com Google) */}
        {modalPerfilObrigatorioAberto && (
          <PerfilCandidatoModal
            aberto={modalPerfilObrigatorioAberto}
            onClose={() => setModalPerfilObrigatorioAberto(false)}
            obrigatorio={true}
          />
        )}

        {/* Rodapé Oficial CERTAM */}
        <footer className="bg-white border-t border-slate-200 py-6 px-4 sm:px-8 text-xs text-slate-500 mt-auto no-print">
          <div className="max-w-[1880px] mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="font-serif font-bold text-slate-800 tracking-wider uppercase text-sm">
                CERTAM
              </span>
              <span className="text-teal-600 text-xs font-semibold">Portal do Concurseiro</span>
              <span className="text-slate-300">·</span>
              <span className="italic text-slate-400">"Nunca é só uma prova."</span>
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

        {/* Resumo Flutuante de Novas Notificações (Toast 5s no Topo da Tela) */}
        <NotificationToast onNavigate={handleNavigate} concursoAtualId={concursoId} />

        {/* Overlay Flutuante do Administrador Exclusivo do Ambiente de Preview do AI Studio */}
        <AdminOverlay
          onNavigate={handleNavigate}
          concursoAtualId={concursoId}
          cargoAtualId={cargoId}
        />

        {/* Widget de Chat Persistente Flutuante com Abas por Concurso, Mute e Emojis */}
        <PersistentChatWidget />

        {/* Botão Voltar ao Topo que se reposiciona dinamicamente para não ficar atrás do chat */}
        {mostrarVoltarAoTopo && (
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            style={voltarAoTopoPos}
            className="fixed z-40 p-3 rounded-2xl bg-[#07192B] hover:bg-[#0C2640] text-teal-300 shadow-2xl border border-teal-500/30 transition-all duration-300 hover:scale-110 cursor-pointer flex items-center justify-center no-print group"
            title="Voltar ao topo da página"
            aria-label="Voltar ao topo"
          >
            <ArrowUp className="w-5 h-5 group-hover:-translate-y-0.5 transition-transform" />
          </button>
        )}
      </div>
    </div>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <NotificationProvider>
            <AppContent />
          </NotificationProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
