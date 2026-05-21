// Modelo aditivo  speak = nível_debatedor + viés_juiz + erro
// Estimado por backfitting com shrinkage de Bayes empírico.
//
// Refinamentos sobre a versão inicial:
//  1. K (força do shrinkage) é estimado dos dados como σ²_dentro / σ²_entre,
//     em vez de fixo em 3.
//  2. Erros padrão são calculados pra cada nível e cada viés.
//  3. Pesos temporais: notas mais recentes pesam mais (meia-vida configurável).
//  4. componentesConectados() avisa quando o grafo (debatedor × juiz) está
//     desconectado — comparações entre grupos diferentes não são confiáveis.

const HALF_LIFE_DIAS_PADRAO = 120; // null pra desativar ponderação temporal

function norm(s) {
  return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function variancia(arr) {
  if (arr.length < 2) return 0;
  const m = arr.reduce((s, v) => s + v, 0) / arr.length;
  return arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1);
}

function pesoData(dataISO, refMs, lambda) {
  if (!dataISO) return 1;
  const ms = new Date(dataISO + 'T00:00:00').getTime();
  if (isNaN(ms)) return 1;
  const dias = Math.max(0, (refMs - ms) / 86400000);
  return Math.exp(-lambda * dias);
}

// speaks: [{ pessoaId, nome, data, sala, posicao, speaks, juiz }]
export function calibrar(speaks, opts = {}) {
  const {
    K_inicial = 3,
    iteracoes = 15,
    halfLifeDias = HALF_LIFE_DIAS_PADRAO,
    refDate = null,
  } = opts;

  if (!speaks || !speaks.length) {
    return {
      nivel: {}, vies: {}, global: 0, ajustado: [], vazio: true,
      K: K_inicial, sigmaDentro: 0, seNivel: {}, seVies: {}, halfLifeDias,
    };
  }

  // 1) Pesos temporais (decaimento exponencial).
  let pesos;
  if (halfLifeDias && halfLifeDias > 0) {
    const lambda = Math.log(2) / halfLifeDias;
    const refMs = (refDate ? new Date(refDate + 'T00:00:00') : new Date()).getTime();
    pesos = speaks.map((x) => pesoData(x.data, refMs, lambda));
  } else {
    pesos = speaks.map(() => 1);
  }
  const wSum = pesos.reduce((s, p) => s + p, 0) || 1;
  const global = speaks.reduce((s, x, i) => s + x.speaks * pesos[i], 0) / wSum;
  const chaveJuiz = (x) => norm(x.juiz || 'sem juiz');

  // 2) Agrupa por debatedor e por juiz (guarda índices pra recuperar pesos).
  const porDeb = new Map();
  const porJuiz = new Map();
  speaks.forEach((x, i) => {
    if (!porDeb.has(x.pessoaId)) porDeb.set(x.pessoaId, []);
    porDeb.get(x.pessoaId).push(i);
    const j = chaveJuiz(x);
    if (!porJuiz.has(j)) porJuiz.set(j, []);
    porJuiz.get(j).push(i);
  });

  const nivel = {};
  porDeb.forEach((_, d) => { nivel[d] = global; });
  const vies = {};
  porJuiz.forEach((_, j) => { vies[j] = 0; });

  let K = K_inicial;
  let sigma2Dentro = 0;

  // 3) Loop externo: ajusta o modelo, estima K dos componentes de variância,
  //    re-ajusta. Em geral converge em 2-3 voltas.
  for (let outer = 0; outer < 4; outer++) {
    for (let it = 0; it < iteracoes; it++) {
      porDeb.forEach((idxs, d) => {
        let soma = 0, wTot = 0;
        idxs.forEach((i) => {
          const x = speaks[i];
          soma += pesos[i] * (x.speaks - (vies[chaveJuiz(x)] || 0));
          wTot += pesos[i];
        });
        nivel[d] = (soma + K * global) / (wTot + K);
      });
      porJuiz.forEach((idxs, j) => {
        let soma = 0, wTot = 0;
        idxs.forEach((i) => {
          const x = speaks[i];
          soma += pesos[i] * (x.speaks - nivel[x.pessoaId]);
          wTot += pesos[i];
        });
        vies[j] = soma / (wTot + K);
      });
    }

    // Componentes de variância
    let s2 = 0, wAcc = 0;
    speaks.forEach((x, i) => {
      const r = x.speaks - nivel[x.pessoaId] - (vies[chaveJuiz(x)] || 0);
      s2 += pesos[i] * r * r;
      wAcc += pesos[i];
    });
    sigma2Dentro = s2 / Math.max(1, wAcc);

    const sigma2EntreDeb = variancia(Object.values(nivel));
    if (sigma2EntreDeb < 0.01) break;

    const novoK = sigma2Dentro / sigma2EntreDeb;
    const clamp = Math.max(0.1, Math.min(20, novoK));
    if (Math.abs(clamp - K) < 0.05) { K = clamp; break; }
    K = clamp;
  }

  // 4) Erros padrão (escala dos speaks).
  const sigmaDentro = Math.sqrt(Math.max(0, sigma2Dentro));
  const seNivel = {};
  porDeb.forEach((idxs, d) => {
    const wTot = idxs.reduce((s, i) => s + pesos[i], 0);
    seNivel[d] = sigmaDentro / Math.sqrt(wTot + K);
  });
  const seVies = {};
  porJuiz.forEach((idxs, j) => {
    const wTot = idxs.reduce((s, i) => s + pesos[i], 0);
    seVies[j] = sigmaDentro / Math.sqrt(wTot + K);
  });

  const ajustado = speaks.map((x, i) => ({
    ...x,
    ajustado: x.speaks - (vies[chaveJuiz(x)] || 0),
    peso: pesos[i],
  }));

  return { nivel, vies, global, ajustado, K, sigmaDentro, seNivel, seVies, halfLifeDias, vazio: false };
}

// Ranking dos debatedores por nível ajustado.
export function ranking(cal) {
  const porDeb = new Map();
  cal.ajustado.forEach((x) => {
    if (!porDeb.has(x.pessoaId)) porDeb.set(x.pessoaId, { pessoaId: x.pessoaId, nome: x.nome, rows: [] });
    porDeb.get(x.pessoaId).rows.push(x);
  });
  const lista = [...porDeb.values()].map((d) => {
    const n = d.rows.length;
    return {
      pessoaId: d.pessoaId,
      nome: d.nome,
      rodadas: n,
      mediaCrua: d.rows.reduce((s, x) => s + x.speaks, 0) / n,
      nivel: cal.nivel[d.pessoaId],
      seNivel: cal.seNivel?.[d.pessoaId] || 0,
    };
  });
  lista.sort((a, b) => b.nivel - a.nivel);
  const total = lista.length || 1;
  lista.forEach((d, i) => { d.topPct = Math.max(1, Math.round((100 * (i + 1)) / total)); });
  return lista;
}

// Série temporal completa de um debatedor (gráfico + lista de todas as notas).
export function serieDebatedor(cal, pessoaId) {
  return cal.ajustado
    .filter((x) => x.pessoaId === pessoaId)
    .slice()
    .sort((a, b) => a.data.localeCompare(b.data))
    .map((x) => ({
      data: x.data,
      sala: x.sala,
      posicao: x.posicao,
      cru: x.speaks,
      ajustado: x.ajustado,
      juiz: x.juiz,
    }));
}

// Análise por juiz: nº de avaliações, média, desvio padrão e viés.
export function analiseJuizes(cal) {
  const porJuiz = new Map();
  cal.ajustado.forEach((x) => {
    const chave = norm(x.juiz || 'sem juiz');
    if (!porJuiz.has(chave)) {
      porJuiz.set(chave, { chave, nome: x.juiz || '(sem juiz)', notas: [] });
    }
    porJuiz.get(chave).notas.push(x.speaks);
  });
  const lista = [...porJuiz.values()].map((j) => {
    const n = j.notas.length;
    const media = j.notas.reduce((s, v) => s + v, 0) / n;
    const variancia2 = n > 1
      ? j.notas.reduce((s, v) => s + (v - media) ** 2, 0) / (n - 1)
      : 0;
    return {
      nome: j.nome,
      n,
      media,
      desvio: Math.sqrt(variancia2),
      vies: cal.vies[j.chave] || 0,
      seVies: cal.seVies?.[j.chave] || 0,
    };
  });
  lista.sort((a, b) => b.n - a.n);
  return lista;
}

// Evolução do clube: média ajustada por data.
export function evolucaoClube(cal) {
  const porData = new Map();
  cal.ajustado.forEach((x) => {
    if (!porData.has(x.data)) porData.set(x.data, []);
    porData.get(x.data).push(x.ajustado);
  });
  return [...porData.entries()]
    .map(([data, vals]) => ({ data, media: vals.reduce((s, v) => s + v, 0) / vals.length }))
    .sort((a, b) => a.data.localeCompare(b.data));
}

// Componentes conectados do grafo bipartite (debatedor × juiz).
// Se houver mais de 1, comparações entre grupos diferentes não são confiáveis —
// o algoritmo não tem como separar viés de juiz do nível de debatedor.
export function componentesConectados(speaks) {
  if (!speaks || !speaks.length) return [];
  const parent = new Map();
  const find = (x) => {
    if (!parent.has(x)) parent.set(x, x);
    let r = x;
    while (parent.get(r) !== r) r = parent.get(r);
    // path compression
    let cur = x;
    while (parent.get(cur) !== r) { const nx = parent.get(cur); parent.set(cur, r); cur = nx; }
    return r;
  };
  const union = (a, b) => {
    const ra = find(a), rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };

  const nomeDe = new Map(); // pessoaId -> nome (para exibir)
  speaks.forEach((x) => {
    const d = 'd:' + x.pessoaId;
    const j = 'j:' + norm(x.juiz || 'sem juiz');
    find(d); find(j); union(d, j);
    if (x.nome) nomeDe.set(x.pessoaId, x.nome);
  });

  const grupos = new Map();
  for (const node of parent.keys()) {
    const raiz = find(node);
    if (!grupos.has(raiz)) grupos.set(raiz, { debatedores: [], juizes: [] });
    if (node.startsWith('d:')) {
      const pid = Number(node.slice(2));
      grupos.get(raiz).debatedores.push({ pessoaId: pid, nome: nomeDe.get(pid) || '' });
    } else {
      grupos.get(raiz).juizes.push(node.slice(2));
    }
  }
  return [...grupos.values()].sort((a, b) =>
    (b.debatedores.length + b.juizes.length) - (a.debatedores.length + a.juizes.length)
  );
}
