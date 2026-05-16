'use client';
import { useState } from 'react';
import { POS_STYLE, semPar } from '@/lib/draw';

// Editor do draw: tocar num nome e depois noutro para trocar.
// (substitui drag & drop — funciona em celular e não trava o scroll)
export default function AdminDrawEditor({ draw, onChange }) {
  const [sel, setSel] = useState(null); // { si, pi, slot }

  const ehSel = (si, pi, slot) =>
    sel && sel.si === si && sel.pi === pi && sel.slot === slot;

  function tocar(si, pi, slot) {
    if (ehSel(si, pi, slot)) { setSel(null); return; }
    if (!sel) { setSel({ si, pi, slot }); return; }
    const novo = structuredClone(draw);
    const src = novo.salas[sel.si].posicoes[sel.pi];
    const dst = novo.salas[si].posicoes[pi];
    const vSrc = sel.slot === 'p1' ? src.p1 : src.p2;
    const vDst = slot === 'p1' ? dst.p1 : dst.p2;
    if (sel.slot === 'p1') src.p1 = vDst; else src.p2 = vDst;
    if (slot === 'p1') dst.p1 = vSrc; else dst.p2 = vSrc;
    setSel(null);
    onChange(novo);
  }

  function setJuiz(numero, valor) {
    const novo = structuredClone(draw);
    const s = novo.salas.find((x) => x.numero === numero);
    if (s) s.juiz = valor;
    onChange(novo);
  }

  const slotCls = (ativo) =>
    `cursor-pointer rounded-md px-2 py-1.5 transition select-none ` +
    (ativo ? 'bg-bordo/30 ring-2 ring-bordo' : 'hover:bg-bordo/10');

  return (
    <div className="space-y-3">
      {sel && (
        <p className="text-[11px] text-gold text-center">
          Toque noutro nome para trocar com o selecionado.
        </p>
      )}
      {draw.salas.map((sala, si) => (
        <div key={sala.numero}
          className="border border-border rounded-xl2 overflow-hidden bg-surface-2">
          <div className="flex justify-between px-4 py-3 bg-[#120c0e] text-[11px]
            uppercase tracking-wider font-semibold">
            <span>
              Sala {sala.numero}
              {sala.incompleta && <span className="text-muted normal-case"> · incompleta</span>}
            </span>
            <span className="text-bordo">{sala.posicoes.length * 2} pessoas</span>
          </div>

          {sala.posicoes.map((pos, pi) => {
            const p2 = semPar(pos.p2) ? null : pos.p2;
            return (
              <div key={pi}
                className="grid grid-cols-[54px_1fr_1fr] gap-2 px-3 py-2 items-center
                  text-[13px] border-t border-border">
                <span className={`text-[10px] font-bold text-center py-1 rounded border
                  ${POS_STYLE[pos.posicao] || 'bg-surface text-muted border-border'}`}>
                  {pos.posicao}
                </span>
                <span className={`font-semibold ${slotCls(ehSel(si, pi, 'p1'))}`}
                  onClick={() => tocar(si, pi, 'p1')}>
                  {pos.p1}
                </span>
                <span className={`text-muted ${slotCls(ehSel(si, pi, 'p2'))}`}
                  onClick={() => tocar(si, pi, 'p2')}>
                  {p2 || '—'}
                </span>
              </div>
            );
          })}

          <div className="flex items-center gap-2 px-4 py-3 bg-gold/10 border-t border-gold/20">
            <span className="text-[10px] uppercase tracking-wide text-gold whitespace-nowrap">
              Juiz
            </span>
            <input
              type="text"
              value={sala.juiz || ''}
              placeholder="Nome do juiz desta sala (opcional)"
              onChange={(e) => setJuiz(sala.numero, e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:border-gold"
            />
          </div>
        </div>
      ))}
    </div>
  );
}
