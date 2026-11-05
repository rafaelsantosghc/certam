/**
 * Validador e formatador oficial de CPF conforme as regras da Receita Federal do Brasil.
 * Fornece validação dos dois dígitos verificadores, formatação canônica (000.000.000-00)
 * e métodos para conversão de chaves primárias de usuários.
 */

export function limparCpf(cpf: unknown): string {
  return String(cpf ?? '').replace(/\D/g, '').trim();
}

/**
 * Valida os 11 dígitos do CPF através do algoritmo oficial de verificação.
 * Rejeita CPFs com menos de 11 dígitos e sequências de dígitos repetidos (ex: 111.111.111-11).
 */
export function validarCpf(cpf: unknown): boolean {
  const digitos = limparCpf(cpf);
  if (digitos.length !== 11) return false;

  // Rejeita sequências repetidas (00000000000, 11111111111, etc.)
  if (/^(\d)\1{10}$/.test(digitos)) return false;

  // Validação do 1º dígito verificador
  let soma = 0;
  for (let i = 0; i < 9; i++) {
    soma += parseInt(digitos.charAt(i), 10) * (10 - i);
  }
  let resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(digitos.charAt(9), 10)) return false;

  // Validação do 2º dígito verificador
  soma = 0;
  for (let i = 0; i < 10; i++) {
    soma += parseInt(digitos.charAt(i), 10) * (11 - i);
  }
  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(digitos.charAt(10), 10)) return false;

  return true;
}

/**
 * Formata um CPF no padrão oficial 000.000.000-00.
 */
export function formatarCpf(cpf: unknown): string {
  const digitos = limparCpf(cpf);
  if (digitos.length === 11) {
    return `${digitos.slice(0, 3)}.${digitos.slice(3, 6)}.${digitos.slice(6, 9)}-${digitos.slice(9, 11)}`;
  }
  if (digitos.length === 0) return '';
  // Formatação parcial para inputs
  if (digitos.length <= 3) return digitos;
  if (digitos.length <= 6) return `${digitos.slice(0, 3)}.${digitos.slice(3)}`;
  if (digitos.length <= 9) return `${digitos.slice(0, 3)}.${digitos.slice(3, 6)}.${digitos.slice(6)}`;
  return `${digitos.slice(0, 3)}.${digitos.slice(3, 6)}.${digitos.slice(6, 9)}-${digitos.slice(9, 11)}`;
}

/**
 * Valida e formata o CPF retornando objeto com status de validade, string formatada e dígitos limpos.
 */
export function validarEFormatarCpf(cpf: unknown): {
  valido: boolean;
  formatado: string;
  digitos: string;
} {
  const digitos = limparCpf(cpf);
  const valido = validarCpf(digitos);
  const formatado = formatarCpf(digitos);
  return {
    valido,
    formatado: formatado || String(cpf ?? '').trim(),
    digitos,
  };
}

/**
 * Formata CPF para exibição segura respeitando a LGPD (ex: 123.***.***-01).
 */
export function mascararCpfSeguro(cpf: unknown): string {
  const digitos = limparCpf(cpf);
  if (digitos.length === 11) {
    return `${digitos.slice(0, 3)}.***.***-${digitos.slice(9, 11)}`;
  }
  const str = String(cpf ?? '');
  return str.length > 5 ? `${str.slice(0, 3)}***` : '***.***.***-**';
}
