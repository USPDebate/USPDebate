'use client';
import { useEffect, useRef } from 'react';

// Som sintetizado no WebAudio — sem arquivo de áudio para baixar, e o clique
// do envio já conta como gesto do usuário, então o navegador deixa tocar.
function tocarSom() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const g = ctx.createGain();
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.14, t + 0.06);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.85);
    g.connect(ctx.destination);
    // duas senoides levemente desafinadas = aquele batimento incômodo
    [440, 443.5].forEach((f) => {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(f, t);
      o.frequency.exponentialRampToValueAtTime(f * 0.4, t + 0.6);
      o.connect(g);
      o.start(t);
      o.stop(t + 0.9);
    });
    setTimeout(() => { try { ctx.close(); } catch (e) {} }, 1500);
  } catch (e) { /* som é enfeite: falhar aqui não pode quebrar o envio */ }
}

export default function OlhoBigBrother({ onFechar }) {
  const fechar = useRef(onFechar);
  fechar.current = onFechar;

  useEffect(() => {
    tocarSom();
    const t = setTimeout(() => fechar.current && fechar.current(), 5200);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      onClick={onFechar}
      className="fixed inset-0 z-[200] grid place-items-center px-6 bg-black/85 cursor-pointer"
    >
      <div className="text-center max-w-sm">
        <svg viewBox="0 0 120 120" className="w-40 h-40 mx-auto olho-abrir text-bordo"
          fill="none" stroke="currentColor" strokeWidth="2.4"
          strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 60s20-34 54-34 54 34 54 34-20 34-54 34S6 60 6 60Z" />
          <circle cx="60" cy="60" r="24" />
          <circle cx="60" cy="60" r="11" fill="currentColor" stroke="none" className="olho-pulso" />
          <circle cx="53" cy="53" r="3.5" fill="#f6f2f3" stroke="none" />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
            <line key={a} x1="60" y1="60" x2="60" y2="34"
              transform={`rotate(${a} 60 60)`} opacity="0.28" />
          ))}
        </svg>

        <p className="font-display text-xl sm:text-2xl font-semibold mt-5 leading-snug text-text">
          Tem certeza que não usou IA?
        </p>
        <p className="font-display text-xl sm:text-2xl font-semibold text-bordo">
          Estou de olho!
        </p>
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted mt-6">
          Toque para fechar
        </p>
      </div>
    </div>
  );
}
