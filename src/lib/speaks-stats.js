// Modelo aditivo  speak = nível_debatedor + viés_juiz + erro
// Estima nível e viés iterativamente, com shrinkage para amostras pequenas.

function norm(s) {
  return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// speaks: [{ pessoaId, nome, data, sala, posicao, speaks, juiz }]
// K = pseudo-contagem do shrinkage (puxa estimativas com poucos dados pra média).
export function calibrar(speaks, { K = 3, iteracoes = 15 } = {}) {
  if (!speaks || !speaks.length) {
    return { nivel: {}, vies: {}, global: 0, ajustado: [], vazio: true };
  }
  const global = speaks.reduce((s, x) => s + x.speaks, 0) / speaks.length;
  const chaveJuiz = (x) => norm(x.juiz || 'sem juiz');

  const porDeb = new Map();
  const porJuiz = new Map();
  speaks.forEach((x) => {
    if (!porDeb.has(x.pessoaId)) porDeb.set(x.pessoaId, []);
    porDeb.get(x.pessoaId).push(x);
    const j = chaveJuiz(x);
    if (!porJuiz.has(j)) porJuiz.set(j, []);
    porJuiz.get(j).push(x);
  });

  const nivel = {};
  porDeb.forEach((_, d) => { nivel[d] = global; });
  const vies = {};
  porJuiz.forEach((_, j) => { vies[j] = 0; });

  for (let it = 0; it < iteracoes; it++) {
    porDeb.forEach((rows, d) => {
      let soma = 0;
      rows.forEach((x) => { soma += x.speaks - (vies[chaveJuiz(x)] || 0); });
      // shrinkage do nível em direção à média global
      nivel[d] = (soma + K * global) / (rows.length + K);
    });
    porJuiz.forEach((rows, j) => {
      let soma = 0;
      rows.forEach((x) => { soma += x.speaks - nivel[x.pessoaId]; });
      // shrinkage do viés em direção a zero
      vies[j] = soma / (rows.length + K);
    });
  }

  // cada speak vira um valor ajustado (descontado o viés do juiz)
  const ajustado = speaks.map((x) => ({
    ...x,
    ajustado: x.speaks - (vies[chaveJuiz(x)] || 0),
  }));

  return { nivel, vies, global, ajustado, vazio: false };
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
    const variancia = n > 1
      ? j.notas.reduce((s, v) => s + (v - media) ** 2, 0) / (n - 1)
      : 0;
    return {
      nome: j.nome,
      n,
      media,
      desvio: Math.sqrt(variancia),
      vies: cal.vies[j.chave] || 0,
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
