/**
 * Detecta se o aplicativo está sendo executado exclusivamente no visualizador (preview) do Google AI Studio
 * ou em servidor local de desenvolvimento do container.
 * Garante que ferramentas, botões de teste rápido de notificação e alternadores de modo administrador
 * de teste apareçam APENAS no visualizador do Google AI Studio e NUNCA no site oficial (Vercel / domínio próprio).
 */
export const isAiStudioPreview = (): boolean => {
  if (typeof window === 'undefined') return false;

  try {
    const host = (window.location.hostname || '').toLowerCase();

    // 1. Bloqueio absoluto para domínios oficiais e hospedagens de produção (Vercel, Netlify, domínios próprios)
    if (
      host.endsWith('.vercel.app') ||
      host.endsWith('.netlify.app') ||
      host.endsWith('certam.com.br') ||
      host.endsWith('portalcertam.com.br') ||
      host.includes('producao') ||
      host.includes('production')
    ) {
      return false;
    }

    // 2. Reconhecimento estrito dos domínios do visualizador do Google AI Studio
    const isGoogleAiStudioViewer =
      host.startsWith('ais-dev-') ||
      host.startsWith('ais-pre-') ||
      host.includes('.ais-dev-') ||
      host.includes('.ais-pre-') ||
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host.includes('webcontainer');

    return isGoogleAiStudioViewer;
  } catch {
    return false;
  }
};

export const isInternalPreview = isAiStudioPreview;

/**
 * Habilita os controles de teste do Modo Admin (botões "Admin Ativo", "Testar Notif", "Painel de Testes"
 * e o widget flutuante "Modo Admin - Controles de teste").
 * Restrito EXCLUSIVAMENTE ao visualizador do Google AI Studio para nunca aparecer no site oficial.
 */
export const isDebugMode = (): boolean => {
  return isAiStudioPreview();
};
