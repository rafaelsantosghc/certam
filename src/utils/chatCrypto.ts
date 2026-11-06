/**
 * Módulo de Criptografia AES-GCM via Web Crypto API para o Chat (PersistentChatWidget)
 * Garante que o histórico armazenado no localStorage seja cifrado em repouso
 * e descriptografado em tempo real exclusivamente na interface do usuário.
 */

const KEY_STORAGE_PREFIX = 'certam_chat_aes_key_v1_';

async function obterOuCriarChaveChat(chatId: string): Promise<CryptoKey> {
  if (typeof window === 'undefined' || !window.crypto || !window.crypto.subtle) {
    throw new Error('Web Crypto API não suportada neste ambiente.');
  }

  const storageKey = `${KEY_STORAGE_PREFIX}${chatId}`;
  try {
    const rawKeyJson = localStorage.getItem(storageKey);
    if (rawKeyJson) {
      const keyData = JSON.parse(rawKeyJson);
      const importedKey = await window.crypto.subtle.importKey(
        'jwk',
        keyData,
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );
      return importedKey;
    }
  } catch {
    // se falhar ao importar, gera nova chave
  }

  const novaChave = await window.crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );

  try {
    const exportedJwk = await window.crypto.subtle.exportKey('jwk', novaChave);
    localStorage.setItem(storageKey, JSON.stringify(exportedJwk));
  } catch {
    // ignora se localStorage estiver cheio ou indisponível
  }

  return novaChave;
}

export async function cifrarObjetoChat<T>(chatId: string, dados: T): Promise<string> {
  try {
    const chave = await obterOuCriarChaveChat(chatId);
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encoder = new TextEncoder();
    const encodedData = encoder.encode(JSON.stringify(dados));

    const ciphertext = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      chave,
      encodedData
    );

    const ivArray = Array.from(iv);
    const cipherArray = Array.from(new Uint8Array(ciphertext));

    return JSON.stringify({
      __cifrado: true,
      iv: ivArray,
      data: cipherArray,
    });
  } catch {
    // fallback caso criptografia falhe: retorna JSON em texto plano
    return JSON.stringify(dados);
  }
}

export async function descriptografarObjetoChat<T>(chatId: string, rawString: string, fallback: T): Promise<T> {
  if (!rawString) return fallback;
  try {
    const parsed = JSON.parse(rawString);
    if (!parsed || !parsed.__cifrado || !Array.isArray(parsed.iv) || !Array.isArray(parsed.data)) {
      // Se não for cifrado (dados legados em texto plano), retorna o JSON parseado diretamente
      return parsed as T;
    }

    const chave = await obterOuCriarChaveChat(chatId);
    const iv = new Uint8Array(parsed.iv);
    const data = new Uint8Array(parsed.data);

    const decryptedBuffer = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      chave,
      data
    );

    const decoder = new TextDecoder();
    const decodedString = decoder.decode(decryptedBuffer);
    return JSON.parse(decodedString) as T;
  } catch {
    // Se falhar a descriptografia, tenta tratar como JSON plano
    try {
      return JSON.parse(rawString) as T;
    } catch {
      return fallback;
    }
  }
}
