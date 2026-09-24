import { norm } from '@/lib/data';

// Estilos das posições BP (dark theme).
export const POS_STYLE = {
  OG: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  OO: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  CG: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  CO: 'bg-bordo/20 text-bordo border-bordo/40',
};

// Posição como letra colorida (aba Draw): tom apagado por posição e CO fora do
// bordô, que é a cor de ação. A letra carrega a informação; a cor só ajuda a achar.
export const POS_LETRA = {
  OG: 'text-emerald-300/75',
  OO: 'text-sky-300/75',
  CG: 'text-orange-300/75', // laranja, não âmbar: dourado é a cor do foco
  CO: 'text-violet-300/75',
};

// Bancada na planta da sala (Draw e Speaks): o encosto fica do lado de fora
// (Governo à esquerda, Oposição à direita) e o texto espelha pro lado do corredor.
export const POS_BANCADA = {
  OG: 'border-l-[3px] border-emerald-300/40', OO: 'border-r-[3px] border-sky-300/40 text-right',
  CG: 'border-l-[3px] border-orange-300/40', CO: 'border-r-[3px] border-violet-300/40 text-right',
};
// Ordem da planta numa grade de 2 colunas: frente (abertura) em cima, fechamento embaixo.
export const PLANTA = ['OG', 'OO', 'CG', 'CO'];

// Converte as linhas cruas da planilha (getDrawData) em { salas, juizes }.
export function parsearDraw(dados) {
  const salas = [];
  let salaAtual = null;
  const juizes = [];
  for (let i = 2; i < dados.length; i++) {
    const row = dados[i];
    if (!row || !row[0]) continue;
    if (String(row[0]).startsWith('⚖️')) {
      String(row[1]).split(',').map((j) => j.trim()).filter(Boolean).forEach((j) => juizes.push(j));
      continue;
    }
    const num = parseInt(String(row[0]).replace(/\D/g, ''), 10);
    if (!num) continue;
    if (!salaAtual || salaAtual.numero !== num) {
      if (salaAtual) salas.push(salaAtual);
      salaAtual = {
        numero: num,
        posicoes: [],
        incompleta: String(row[0]).includes('★'),
        juiz: '',
      };
    }
    if (!salaAtual.juiz && row[5]) salaAtual.juiz = String(row[5]).trim();
    salaAtual.posicoes.push({
      posicao: row[1],
      p1: row[2],
      p2: row[3],
      confirmado: String(row[4]).includes('✅'),
    });
  }
  if (salaAtual) salas.push(salaAtual);
  return { salas, juizes };
}

// "—" e "— (sem par)" significam ausência de segundo debatedor.
export function semPar(v) {
  return v === '—' || v === '— (sem par)' || !v;
}

// Painel de juízes de uma sala (compatível com draws antigos de juiz único).
export function panelSala(sala) {
  if (Array.isArray(sala.juizes)) return sala.juizes;
  if (sala.juiz) return [sala.juiz];
  return [];
}

// Ordena as posições de uma sala na ordem do debate: OG → OO → CG → CO.
const ORDEM_BP = { OG: 0, OO: 1, CG: 2, CO: 3 };
export function ordenarPosicoes(posicoes) {
  return [...posicoes].sort(
    (a, b) => (ORDEM_BP[a.posicao] ?? 99) - (ORDEM_BP[b.posicao] ?? 99)
  );
}

// Todos os nomes que aparecem num draw ({ salas, juizes }), normalizados:
// debatedores das duplas, juízes de sala e juízes gerais. Serve para saber
// quem já está no draw e quem esteve no treino sem ter sido alocado.
export function nomesDoDraw(draw) {
  const set = new Set();
  if (!draw) return set;
  (draw.salas || []).forEach((sala) => {
    (sala.posicoes || []).forEach((pos) => {
      if (pos.p1) set.add(norm(pos.p1));
      if (!semPar(pos.p2)) set.add(norm(pos.p2));
    });
    panelSala(sala).forEach((j) => { if (j) set.add(norm(j)); });
  });
  (draw.juizes || []).forEach((j) => { if (j) set.add(norm(j)); });
  return set;
}

// Nome por extenso de cada posição (card "Onde eu estou?").
export const POS_NOME = {
  OG: 'Governo de Abertura',
  OO: 'Oposição de Abertura',
  CG: 'Governo de Fechamento',
  CO: 'Oposição de Fechamento',
};

// Onde uma pessoa está no draw: debatendo (sala, posição, dupla), julgando uma sala,
// juiz geral, ou null se o nome não aparece.
export function ondeEstou(draw, nome) {
  if (!draw || !nome) return null;
  const n = norm(nome);
  for (const sala of draw.salas || []) {
    for (const pos of sala.posicoes || []) {
      const p2 = semPar(pos.p2) ? '' : pos.p2;
      if (norm(pos.p1 || '') === n) return { papel: 'debate', sala, pos, dupla: p2 };
      if (p2 && norm(p2) === n) return { papel: 'debate', sala, pos, dupla: pos.p1 };
    }
    if (panelSala(sala).some((j) => norm(j) === n)) return { papel: 'juiz', sala };
  }
  if ((draw.juizes || []).some((j) => norm(j) === n)) return { papel: 'geral' };
  return null;
}
