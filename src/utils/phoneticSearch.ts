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

function levenshteinDistancia(a: string, b: string): number {
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
