// Helpers do WhatsApp dos trainees. O banco guarda só dígitos, com o 55
// na frente (ex.: 5511912345678) — mesma regra do salvar_whatsapp_trainee.

function digitos(s) {
  return String(s || '').replace(/\D/g, '');
}

// Dígitos nacionais (DDD + número), no máximo 11. Tira o 55 se colaram com ele.
function nacional(s) {
  let d = digitos(s);
  if (d.length > 11 && d.startsWith('55')) d = d.slice(2);
  return d.slice(0, 11);
}

// Máscara enquanto digita: (11) 91234-5678
export function mascararWhatsapp(s) {
  const d = nacional(s);
  if (d.length === 0) return '';
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

// Celular brasileiro válido? Devolve '55' + 11 dígitos, ou null.
export function normalizarWhatsapp(s) {
  const d = nacional(s);
  return /^[1-9][0-9]9[0-9]{8}$/.test(d) ? '55' + d : null;
}

export function linkWhatsapp(numero, texto) {
  const base = `https://wa.me/${digitos(numero)}`;
  return texto ? `${base}?text=${encodeURIComponent(texto)}` : base;
}
