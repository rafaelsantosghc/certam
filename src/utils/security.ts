/**
 * Utilitários de Segurança e Proteção de Dados - Portal CERTAM
 * Proteção contra ataques XSS, injeção de caracteres de controle e privacidade LGPD.
 */

/**
 * Remove caracteres de controle invisíveis, bytes nulos e caracteres de sobreposição
 * bidirecional (bidi override) usados em ataques de spoofing.
 */
export function sanitizeInput(text: unknown, maxLength: number = 2000): string {
  if (typeof text !== 'string') return '';
  
  // Limita tamanho para evitar ataques de DoS por payloads gigantes
  const truncated = text.slice(0, maxLength);

  // Remove caracteres nulos, controles ASCII (exceto quebras de linha e tabulações)
  // e caracteres de sobreposição bidirecional (U+202A a U+202E, U+2066 a U+2069)
  return truncated
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '')
    .replace(/[\u202A-\u202E\u2066-\u2069]/g, '')
    .trim();
}

/**
 * Validação rigorosa de e-mails para evitar injeções
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string' || email.length > 254) return false;
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  return emailRegex.test(email.trim());
}

/**
 * Ofusca CPF em conformidade com a Lei Geral de Proteção de Dados (LGPD)
 * Exemplo: '123.456.789-00' -> '***.456.789-**'
 */
export function maskCpf(cpf: string | undefined): string {
  if (!cpf) return '***.***.***-**';
  const clean = cpf.replace(/\D/g, '');
  if (clean.length === 11) {
    return `***.${clean.slice(3, 6)}.${clean.slice(6, 9)}-**`;
  }
  return cpf.includes('*') ? cpf : '***.***.***-**';
}

/**
 * Sanitiza nomes de arquivos para evitar ataques de Path Traversal
 */
export function sanitizeFileName(fileName: string): string {
  if (!fileName || typeof fileName !== 'string') return 'arquivo_seguro';
  return fileName
    .replace(/[\/\\]/g, '')
    .replace(/\.\.+/g, '.')
    .replace(/[^a-zA-Z0-9_.-]/g, '_')
    .slice(0, 100);
}
