// Geração do draw BP — lógica portada do Apps Script para o front-end.
// Funções puras: recebem a lista de pessoas, devolvem as salas.

function norm(s) {
  return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function embaralhar(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const POSICOES_BP = ['OG', 'OO', 'CG', 'CO'];

// Resolve duplas: mútua, unilateral ou sem par.
function resolverDuplas(pessoas) {
  const nomeMap = new Map();
  pessoas.forEach((p) => nomeMap.set(norm(p.nome), p.nome));

  const querDupla = new Map();
  pessoas.forEach((p) => {
    if (p.dupla && p.dupla.length >= 2) {
      const nd = norm(p.dupla);
      if (nomeMap.has(nd)) querDupla.set(norm(p.nome), nd);
    }
  });

  const pareados = new Set();
  const pares = [];

  // duplas mútuas primeiro
  querDupla.forEach((dupNorm, pesNorm) => {
    if (pareados.has(pesNorm) || pareados.has(dupNorm)) return;
    if (querDupla.get(dupNorm) === pesNorm) {
      pares.push({ p1: nomeMap.get(pesNorm), p2: nomeMap.get(dupNorm), confirmado: true });
      pareados.add(pesNorm); pareados.add(dupNorm);
    }
  });
  // duplas unilaterais
  querDupla.forEach((dupNorm, pesNorm) => {
    if (pareados.has(pesNorm) || pareados.has(dupNorm)) return;
    pares.push({ p1: nomeMap.get(pesNorm), p2: nomeMap.get(dupNorm), confirmado: true });
    pareados.add(pesNorm); pareados.add(dupNorm);
  });
  // restantes sem par
  pessoas.forEach((p) => {
    if (!pareados.has(norm(p.nome))) {
      pares.push({ p1: p.nome, p2: null, confirmado: false });
      pareados.add(norm(p.nome));
    }
  });
  return pares;
}

function montarDraw(pares, numSalas) {
  const sozinhos = embaralhar(pares.filter((p) => !p.p2));
  const comDupla = embaralhar(pares.filter((p) => p.p2));

  let impar = null;
  const novos = [];
  for (let i = 0; i < sozinhos.length; i += 2) {
    if (i + 1 < sozinhos.length) {
      novos.push({ p1: sozinhos[i].p1, p2: sozinhos[i + 1].p1, confirmado: false });
    } else {
      impar = sozinhos[i].p1;
    }
  }

  const completos = embaralhar([...comDupla, ...novos]);
  const salas = [];
  let idx = 0;

  for (let s = 0; s < numSalas; s++) {
    const sala = { numero: s + 1, posicoes: [], incompleta: false, juizes: [] };
    const pos = embaralhar([...POSICOES_BP]);
    for (let p = 0; p < 4; p++) {
      if (idx < completos.length) {
        sala.posicoes.push({
          posicao: pos[p],
          p1: completos[idx].p1,
          p2: completos[idx].p2 || '—',
          confirmado: completos[idx].confirmado,
        });
        idx++;
      }
    }
    salas.push(sala);
  }

  if (idx < completos.length || impar) {
    const sala = { numero: numSalas + 1, posicoes: [], incompleta: true, juizes: [] };
    let p = 0;
    while (idx < completos.length) {
      sala.posicoes.push({
        posicao: POSICOES_BP[p] || 'Pos ' + (p + 1),
        p1: completos[idx].p1,
        p2: completos[idx].p2 || '—',
        confirmado: completos[idx].confirmado,
      });
      idx++; p++;
    }
    if (impar) {
      sala.posicoes.push({
        posicao: POSICOES_BP[p] || 'Pos ' + (p + 1),
        p1: impar, p2: '— (sem par)', confirmado: false,
      });
    }
    salas.push(sala);
  }
  // ordena as posições de cada sala: OG → OO → CG → CO
  const ordem = { OG: 0, OO: 1, CG: 2, CO: 3 };
  salas.forEach((s) =>
    s.posicoes.sort((a, b) => (ordem[a.posicao] ?? 99) - (ordem[b.posicao] ?? 99))
  );
  return salas;
}

// Entrada: pessoas = [{ nome, dupla }] (juízes já removidos).
// Saída: array de salas.
export function gerarSalas(pessoas) {
  const numSalas = Math.floor(pessoas.length / 8);
  return montarDraw(resolverDuplas(pessoas), numSalas);
}
