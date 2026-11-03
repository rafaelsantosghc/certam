/**
 * Detecta se o aplicativo está sendo executado no ambiente de preview do Google AI Studio ou desenvolvimento local.
 * Garante que ferramentas, botões de teste rápido de notificação e alternadores de modo administrador
 * para testes apareçam EXCLUSIVAMENTE no Google AI Studio / dev, e NUNCA no site oficial de produção.
 */
export const isAiStudioPreview = (): boolean => {
  if (typeof window === 'undefined') return false;

  try {
    const host = window.location.hostname.toLowerCase();

    // Domínios característicos do Google AI Studio Preview e ambientes locais de teste
    const isPreviewHost =
      host.includes('ais-dev-') ||
      host.includes('ais-pre-') ||
      host.includes('run.app') ||
      host.includes('localhost') ||
      host.includes('127.0.0.1') ||
      host.includes('aistudio') ||
      host.includes('googleusercontent.com') ||
      host.includes('webcontainer');

    // Execução dentro de iframe no console do AI Studio
    const isInsideIframe = window.self !== window.top;

    // Flag de desenvolvimento do Vite
    const isViteDev = Boolean((import.meta as any)?.env?.DEV);

    return isPreviewHost || isInsideIframe || isViteDev;
  } catch {
    return false;
  }
};

export const isInternalPreview = isAiStudioPreview;
