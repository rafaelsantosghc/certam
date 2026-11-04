export function fonetizar(texto: string): string {
  if (!texto || typeof texto !== 'string') return '';
  let s = texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[^a-z0-9\s]/g, ' ')    // remove pontuação
    .replace(/\s+/g, ' ')
    .trim();

  // Regras fonéticas em Português
  s = s
    .replace(/ph/g, 'f')
    .replace(/[kcq]/g, 'k')
    .replace(/[z]/g, 's')
    .replace(/ch/g, 's')
    .replace(/ge|gi/g, 'je')
    .replace(/j/g, 'g')
    .replace(/lh/g, 'l')
    .replace(/nh/g, 'n')
    .replace(/([b-df-hj-np-tv-z])\1+/g, '$1'); // remove consoantes dobradas

  return s;
}

export function matchFonético(textoAlvo: string, termoBusca: string): boolean {
  if (!textoAlvo || !termoBusca) return false;
  const alvoLower = textoAlvo.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const termoLower = termoBusca.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // 1. Prioridade absoluta para correspondência exata ou substring exata
  if (alvoLower.includes(termoLower)) return true;

  // 2. Fallback para similaridade fonética / Levenshtein
  const alvoFonetico = fonetizar(textoAlvo);
  const termoFonetico = fonetizar(termoBusca);

  if (alvoFonetico.includes(termoFonetico)) return true;

  const palavrasAlvo = alvoFonetico.split(' ');
  const palavrasBusca = termoFonetico.split(' ');

  return palavrasBusca.every((tb) =>
    palavrasAlvo.some((pa) => pa.includes(tb) || levenshteinDistancia(pa, tb) <= 1)
  );
}

export function levenshteinDistancia(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          Math.min(
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          )
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

/**
 * Calcula pontuação de similaridade (0 a 100) entre dois nomes de candidatos,
 * combinando correspondência exata, tokens compartilhados e fonética (Metaphone/Levenshtein).
 */
export function calcularSimilaridadeNome(nomeA: string, nomeB: string): number {
  if (!nomeA || !nomeB) return 0;

  const limpar = (s: string) =>
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\b(de|da|do|das|dos|e)\b/g, ' ')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const aNorm = limpar(nomeA);
  const bNorm = limpar(nomeB);

  if (!aNorm || !bNorm) return 0;
  if (aNorm === bNorm) return 100;

  if (aNorm.includes(bNorm) || bNorm.includes(aNorm)) {
    const minLen = Math.min(aNorm.length, bNorm.length);
    if (minLen >= 4) return 90;
  }

  const tokensA = aNorm.split(' ').filter((t) => t.length >= 2);
  const tokensB = bNorm.split(' ').filter((t) => t.length >= 2);
  if (tokensA.length === 0 || tokensB.length === 0) return 0;

  let exactTokenMatches = 0;
  let phoneticTokenMatches = 0;

  for (const ta of tokensA) {
    const fa = fonetizar(ta);
    if (tokensB.some((tb) => tb === ta)) {
      exactTokenMatches++;
    } else if (
      tokensB.some((tb) => {
        const fb = fonetizar(tb);
        return fb === fa || levenshteinDistancia(ta, tb) <= 1 || (ta.length >= 4 && tb.startsWith(ta));
      })
    ) {
      phoneticTokenMatches++;
    }
  }

  // Primeiro nome igual tem peso forte na sugestão de vínculo
  const primeiroNomeIgual =
    tokensA[0] === tokensB[0] ||
    fonetizar(tokensA[0]) === fonetizar(tokensB[0]) ||
    levenshteinDistancia(tokensA[0], tokensB[0]) <= 1;

  const maxTokens = Math.max(tokensA.length, tokensB.length);
  const minTokens = Math.min(tokensA.length, tokensB.length);

  const ratioMax = (exactTokenMatches + phoneticTokenMatches * 0.75) / maxTokens;
  const ratioMin = (exactTokenMatches + phoneticTokenMatches * 0.75) / minTokens;

  let score = Math.round((ratioMax * 0.55 + ratioMin * 0.45) * 85);
  if (primeiroNomeIgual) {
    score += 15;
  }

  return Math.min(99, Math.max(0, score));
}

