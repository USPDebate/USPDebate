import { norm } from '@/lib/data';

// Estilos das posições BP (dark theme).
export const POS_STYLE = {
  OG: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  OO: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  CG: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  CO: 'bg-bordo/20 text-bordo border-bordo/40',
};

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
