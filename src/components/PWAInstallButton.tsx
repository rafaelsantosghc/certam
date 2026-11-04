import React, { useState, useEffect, useCallback } from 'react';
import { Smartphone, Download, Share, X, WifiOff } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true) {
      setIsInstalled(true);
      return;
    }

    const ua = window.navigator.userAgent.toLowerCase();
    const ios = /iphone|ipad|ipod/.test(ua);
    setIsIOS(ios);

    const handleBeforeInstallPrompt = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setIsInstallable(false);
    return outcome === 'accepted';
  }, [deferredPrompt]);

  return { isInstallable, isInstalled, isIOS, promptInstall };
}

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, promptInstall } = usePWAInstall();
  const [modalGuiaAberto, setModalGuiaAberto] = useState(false);

  if (isInstalled) return null;

  const handleClick = async () => {
    if (isInstallable) {
      await promptInstall();
    } else {
      setModalGuiaAberto(true);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-teal-50 hover:bg-teal-100 border border-teal-200 text-teal-900 text-xs font-bold transition-colors cursor-pointer"
        title="Instalar aplicativo CERTAM na tela inicial do celular ou computador"
      >
        <Smartphone className="w-3.5 h-3.5 text-teal-600" />
        <span className="hidden xl:inline">Instalar App</span>
      </button>

      {modalGuiaAberto && (
        <div className="fixed inset-0 z-[220] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#07192B] text-[#2DD4AA] flex items-center justify-center">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-sm sm:text-base text-slate-900">
                    Instalar Aplicativo CERTAM
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Acesso rápido na tela inicial e consulta offline da classificação
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalGuiaAberto(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-700 leading-relaxed">
              {isIOS ? (
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <Share className="w-4 h-4 text-teal-600" />
                    <span>Como instalar no iPhone / iPad (Safari):</span>
                  </div>
                  <ol className="list-decimal list-inside space-y-1.5 text-slate-600">
                    <li>Toque no botão <strong>Compartilhar</strong> na barra inferior do Safari.</li>
                    <li>Role as opções e selecione <strong>&quot;Adicionar à Tela de Início&quot;</strong>.</li>
                    <li>Confirme tocando em <strong>Adicionar</strong> no canto superior direito.</li>
                  </ol>
                </div>
              ) : (
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <Download className="w-4 h-4 text-teal-600" />
                    <span>Como instalar no Android ou Computador:</span>
                  </div>
                  <ol className="list-decimal list-inside space-y-1.5 text-slate-600">
                    <li>Abra o menu do navegador (ícone <strong>⋮</strong> no Chrome/Edge) ou o ícone de instalação na barra de endereços.</li>
                    <li>Clique em <strong>&quot;Instalar aplicativo&quot;</strong> ou <strong>&quot;Adicionar à tela inicial&quot;</strong>.</li>
                    <li>O ícone oficial do <strong>CERTAM</strong> será criado para acesso direto em tela cheia.</li>
                  </ol>
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setModalGuiaAberto(false)}
                className="px-4 py-2 bg-[#07192B] hover:bg-[#0C2640] text-[#2DD4AA] font-bold text-xs rounded-xl cursor-pointer"
              >
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export const OfflineIndicator: React.FC = () => {
  const [isOffline, setIsOffline] = useState<boolean>(
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  );

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div className="bg-amber-500 text-slate-950 text-xs font-bold py-1.5 px-4 text-center flex items-center justify-center gap-2 z-50">
      <WifiOff className="w-3.5 h-3.5 shrink-0" />
      <span>
        Modo Offline Ativo: Você está visualizando a lista de classificação e dados salvos no cache local do dispositivo.
      </span>
    </div>
  );
};
