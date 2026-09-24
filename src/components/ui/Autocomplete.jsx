'use client';
import { useState, useId } from 'react';
import { norm } from '@/lib/data';

// Autocomplete com modo restrito: o valor só vale se escolhido da lista.
// onChange(valor, escolhidoDaLista)
// Teclado: setas navegam, Enter escolhe, Esc fecha (padrão combobox do ARIA).
// icon: componente de ícone à esquerda (opcional); inputClassName: classes extras do campo.
export default function Autocomplete({ id: idInput, value, onChange, options, placeholder, invalid, icon: Icone, inputClassName = '' }) {
  const [open, setOpen] = useState(false);
  const [ativo, setAtivo] = useState(-1);
  const id = useId();

  const sugestoes = value.trim()
    ? options.filter((o) => norm(o).includes(norm(value))).slice(0, 8)
    : [];
  const aberto = open && sugestoes.length > 0;

  function escolher(o) { onChange(o, true); setOpen(false); setAtivo(-1); }

  function onKeyDown(e) {
    if (!aberto) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const passo = e.key === 'ArrowDown' ? 1 : -1;
      setAtivo((i) => (i + passo + sugestoes.length) % sugestoes.length);
    } else if (e.key === 'Enter' && ativo >= 0) {
      e.preventDefault();
      escolher(sugestoes[ativo]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      {Icone && <Icone className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-muted" />}
      <input
        type="text"
        id={idInput}
        role="combobox"
        aria-label={idInput ? undefined : placeholder}
        aria-expanded={aberto}
        aria-controls={id}
        aria-autocomplete="list"
        aria-activedescendant={aberto && ativo >= 0 ? `${id}-${ativo}` : undefined}
        aria-invalid={invalid || undefined}
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        onChange={(e) => { onChange(e.target.value, false); setOpen(true); setAtivo(-1); }}
        onKeyDown={onKeyDown}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className={`w-full px-3.5 py-3 rounded-lg text-base outline-none transition
          focus:border-bordo ${Icone ? 'pl-11' : ''} ${inputClassName} ${invalid ? '!border-danger' : ''}`}
      />
      {aberto && (
        <div id={id} role="listbox" className="absolute left-0 right-0 top-full z-50 mt-1 bg-surface-2 border border-bordo
          rounded-lg max-h-52 overflow-y-auto overscroll-contain shadow-2xl">
          {sugestoes.map((o, i) => (
            <div
              // chave pela posição: há homônimos no cadastro, e chave repetida
              // deixava linhas velhas na lista enquanto se digitava
              key={i}
              id={`${id}-${i}`}
              role="option"
              aria-selected={i === ativo}
              onMouseDown={(e) => { e.preventDefault(); escolher(o); }}
              className={`px-3.5 py-2.5 text-sm cursor-pointer hover:bg-bordo/15
                border-b border-border last:border-0 ${i === ativo ? 'bg-bordo/15' : ''}`}
            >
              {o}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
