'use client';
import { useState, useEffect } from 'react';

export function fmtBR(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

// 'dd/mm/aaaa' → 'aaaa-mm-dd', ou null se inválida.
export function parseBR(str) {
  const m = (str || '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const d = +m[1], mo = +m[2], y = +m[3];
  const iso = `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const dt = new Date(iso + 'T00:00:00');
  if (dt.getMonth() + 1 !== mo || dt.getDate() !== d) return null;
  return iso;
}

// Campo de data em formato brasileiro. O <input type="date"> segue a locale do
// aparelho e aparecia como mm/dd/aaaa, por isso este aqui é texto. Confirma no
// blur: valor inválido volta para o anterior em vez de sumir.
export default function DataBR({ value, onCommit, className = '' }) {
  const [txt, setTxt] = useState(fmtBR(value));
  useEffect(() => { setTxt(fmtBR(value)); }, [value]);
  return (
    <input
      type="text" inputMode="numeric" placeholder="dd/mm/aaaa" maxLength={10}
      value={txt}
      onChange={(e) => setTxt(e.target.value)}
      onBlur={() => {
        const iso = parseBR(txt);
        if (iso) onCommit(iso); else setTxt(fmtBR(value));
      }}
      className={`bg-surface border border-border rounded px-2 py-1 text-[12px]
        text-text outline-none focus:border-bordo w-[92px] text-center ${className}`}
    />
  );
}
