'use client';
import { useState } from 'react';
import { norm } from '@/lib/data';

// Autocomplete com modo restrito: o valor só vale se escolhido da lista.
// onChange(valor, escolhidoDaLista)
export default function Autocomplete({ value, onChange, options, placeholder, invalid }) {
  const [open, setOpen] = useState(false);

  const sugestoes = value.trim()
    ? options.filter((o) => norm(o).includes(norm(value))).slice(0, 8)
    : [];

  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(e) => { onChange(e.target.value, false); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className={`w-full px-3.5 py-3 rounded-lg text-base outline-none transition
          focus:border-bordo ${invalid ? '!border-danger' : ''}`}
      />
      {open && sugestoes.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 bg-surface-2 border border-bordo
          rounded-lg max-h-52 overflow-y-auto shadow-2xl">
          {sugestoes.map((o) => (
            <div
              key={o}
              onMouseDown={(e) => { e.preventDefault(); onChange(o, true); setOpen(false); }}
              className="px-3.5 py-2.5 text-sm cursor-pointer hover:bg-bordo/15
                border-b border-border last:border-0"
            >
              {o}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
