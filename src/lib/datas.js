// Datas do app: 'aaaa-mm-dd' no banco, dd/mm(/aaaa) na tela. Formata cortando a
// string em vez de new Date(iso), que lê como UTC e no Brasil daria o dia anterior.

// Date local → 'aaaa-mm-dd' (o dia do aparelho, não o de Greenwich).
export function isoDe(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const hojeISO = () => isoDe(new Date());

export function fmtBR(iso) {
  if (!iso) return '';
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

// 'aaaa-mm-dd' → Date à meia-noite local (pra Intl: dia da semana, nome do mês).
export function dataLocal(iso) {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(a, m - 1, d);
}

export function fmtCurto(iso) {
  if (!iso) return '';
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}
