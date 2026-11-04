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

/**
 * Flag booleana que habilita os botões de controle de edição (classificação, vagas, documentos)
 * e o overlay administrativo. Baseada em variável de ambiente (VITE_DEBUG_MODE / DEV)
 * ou parâmetro de URL (ex: ?admin=1 ou ?debug=1).
 * Garante bloqueio absoluto para que esses botões de teste NÃO sejam renderizados em produção.
 */
export const isDebugMode = (): boolean => {
  if (typeof window === 'undefined') return false;

  try {
    const host = (window.location.hostname || '').toLowerCase();

    // 1. Bloqueio absoluto em domínios públicos oficiais de produção
    if (
      host.endsWith('certam.com.br') ||
      host.endsWith('portalcertam.com.br') ||
      host.includes('producao')
    ) {
      return false;
    }

    // 2. Parâmetro de URL (ex: ?admin=1 ou ?debug=1)
    const params = new URLSearchParams(window.location.search);
    const hasAdminParam = params.get('admin') === '1' || params.get('debug') === '1';

    // 3. Variável de ambiente (ex: VITE_DEBUG_MODE, VITE_IS_PREVIEW ou import.meta.env.DEV)
    const hasEnvDebug =
      (import.meta as any).env?.VITE_DEBUG_MODE === 'true' ||
      (import.meta as any).env?.VITE_IS_PREVIEW === 'true' ||
      Boolean((import.meta as any).env?.DEV);

    // 4. Reconhecimento estrito do ambiente de preview do Google AI Studio
    const isAiStudio = isAiStudioPreview();

    // 5. Se for build de produção padrão fora do preview e sem parâmetro explícito, bloqueia
    if ((import.meta as any).env?.PROD && !isAiStudio && !hasAdminParam) {
      return false;
    }

    return Boolean(hasAdminParam || hasEnvDebug || isAiStudio);
  } catch {
    return false;
  }
};
