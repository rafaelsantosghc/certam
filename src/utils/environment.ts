/**
 * Detecta se o aplicativo está sendo executado no ambiente de preview do Google AI Studio ou desenvolvimento local.
 * Garante que ferramentas, botões de teste rápido de notificação e alternadores de modo administrador
 * para testes apareçam EXCLUSIVAMENTE no Google AI Studio / dev, e NUNCA no site oficial de produção.
 */
export const isAiStudioPreview = (): boolean => {
  if (typeof window === 'undefined') return false;

  try {
    const host = (window.location.hostname || '').toLowerCase();

    // 1. Bloqueio absoluto para domínios oficiais e de produção pública
    if (
      host.endsWith('certam.com.br') ||
      host.endsWith('portalcertam.com.br') ||
      host.includes('producao') ||
      host.includes('production')
    ) {
      return false;
    }

    // 2. Reconhecimento estrito dos domínios do preview do Google AI Studio e dev local
    const isGoogleAiStudioPreview =
      host.includes('ais-dev-') ||
      host.includes('ais-pre-') ||
      host.includes('localhost') ||
      host.includes('127.0.0.1') ||
      host.includes('webcontainer') ||
      (host.includes('run.app') && (host.includes('ais-dev') || host.includes('ais-pre')));

    return isGoogleAiStudioPreview;
  } catch {
    return false;
  }
};

export const isInternalPreview = isAiStudioPreview;
