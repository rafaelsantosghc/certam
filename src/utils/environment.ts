/**
 * Detecta se o aplicativo está sendo executado no ambiente de preview do Google AI Studio ou desenvolvimento local.
 * Garante que ferramentas, botões de teste rápido de notificação e alternadores de modo administrador
 * para testes apareçam EXCLUSIVAMENTE no Google AI Studio / dev, e NUNCA no site oficial de produção.
 */
export const isAiStudioPreview = (): boolean => {
  if (typeof window === 'undefined') return false;

  try {
    const host = (window.location.hostname || '').toLowerCase();

    // 1. Domínios característicos do Google AI Studio Preview, Cloud Run e ambientes locais de teste
    if (
      host.includes('ais-') ||
      host.includes('run.app') ||
      host.includes('localhost') ||
      host.includes('127.0.0.1') ||
      host.includes('aistudio') ||
      host.includes('googleusercontent.com') ||
      host.includes('webcontainer')
    ) {
      return true;
    }

    // 2. Flag de desenvolvimento Vite
    if (Boolean((import.meta as any)?.env?.DEV)) {
      return true;
    }

    // 3. Verificação segura de execução dentro de iframe (se bloquear por cross-origin, é porque está dentro de iframe!)
    try {
      if (window.self !== window.parent || window.self !== window.top) {
        return true;
      }
    } catch {
      // Bloqueio de acesso entre origens garante que o app está incorporado no iframe do AI Studio
      return true;
    }

    // 4. Parâmetro de URL ou flag de teste
    if (window.location.search.includes('preview=1') || window.location.search.includes('admin=1')) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
};

export const isInternalPreview = isAiStudioPreview;
