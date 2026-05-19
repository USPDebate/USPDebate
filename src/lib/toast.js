// Toasts — avisos flutuantes, independentes de scroll.
// toast('success'|'error'|'info', mensagem)

let listeners = [];
let seq = 0;

export function toast(tipo, msg) {
  const t = { id: ++seq, tipo, msg };
  listeners.forEach((l) => l(t));
  // feedback háptico (Android; iOS ignora silenciosamente)
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(tipo === 'error' ? [12, 50, 12] : 18);
  }
}

export function onToast(fn) {
  listeners.push(fn);
  return () => { listeners = listeners.filter((l) => l !== fn); };
}
