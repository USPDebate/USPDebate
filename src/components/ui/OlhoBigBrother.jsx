'use client';
import { useEffect, useRef } from 'react';

// Som sintetizado no WebAudio — sem arquivo de áudio para baixar, e o clique
// do envio já conta como gesto do usuário, então o navegador deixa tocar.
// A receita é a de sting de terror: acorde dissonante (segunda menor + trítono)
// com filtro abrindo de supetão, um sub grave para o baque no peito, um sopro
// de ruído filtrado e um agudo trêmulo que fica ecoando. O reverb é uma cauda
// de ruído gerada na hora — sem ele soa como bipe de brinquedo.
function tocarSom() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const t0 = ctx.currentTime;

    // Compressor no fim faz as vezes de limitador: as camadas somadas
    // estourariam o clipping do navegador.
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -10;
    comp.knee.value = 6;
    comp.ratio.value = 12;
    comp.attack.value = 0.003;
    comp.release.value = 0.25;
    comp.connect(ctx.destination);

    const master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(comp);

    // Reverb: impulso de ruído decaindo, ~1,8 s de cauda.
    const conv = ctx.createConvolver();
    const n = Math.floor(ctx.sampleRate * 1.8);
    const imp = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c += 1) {
      const d = imp.getChannelData(c);
      for (let i = 0; i < n; i += 1) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.6);
      }
    }
    conv.buffer = imp;
    const wet = ctx.createGain();
    wet.gain.value = 0.5;
    conv.connect(wet);
    wet.connect(master);

    const env = (g, pico, ataque, fim) => {
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(pico, t0 + ataque);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + fim);
    };

    // 1) Stab dissonante — ré, ré# e sol#: segunda menor e trítono juntos.
    const filtro = ctx.createBiquadFilter();
    filtro.type = 'lowpass';
    filtro.Q.value = 8;
    filtro.frequency.setValueAtTime(300, t0);
    filtro.frequency.exponentialRampToValueAtTime(4200, t0 + 0.09);
    filtro.frequency.exponentialRampToValueAtTime(320, t0 + 1.5);
    const gStab = ctx.createGain();
    env(gStab, 0.5, 0.012, 1.7);
    filtro.connect(gStab);
    gStab.connect(master);
    gStab.connect(conv);
    [146.83, 155.56, 207.65].forEach((f) => {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(f, t0);
      o.frequency.exponentialRampToValueAtTime(f * 0.87, t0 + 1.7);
      o.connect(filtro);
      o.start(t0);
      o.stop(t0 + 1.8);
    });

    // 2) Sub grave — o baque.
    const sub = ctx.createOscillator();
    const gSub = ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(72, t0);
    sub.frequency.exponentialRampToValueAtTime(28, t0 + 0.5);
    env(gSub, 0.85, 0.015, 0.9);
    sub.connect(gSub);
    gSub.connect(master);
    sub.start(t0);
    sub.stop(t0 + 1);

    // 3) Sopro — ruído em passa-banda descendo, tipo alguém inspirando atrás.
    const ruidoLen = Math.floor(ctx.sampleRate * 1.2);
    const ruidoBuf = ctx.createBuffer(1, ruidoLen, ctx.sampleRate);
    const rd = ruidoBuf.getChannelData(0);
    for (let i = 0; i < ruidoLen; i += 1) rd[i] = Math.random() * 2 - 1;
    const ruido = ctx.createBufferSource();
    ruido.buffer = ruidoBuf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 1.4;
    bp.frequency.setValueAtTime(2600, t0);
    bp.frequency.exponentialRampToValueAtTime(420, t0 + 1.1);
    const gRuido = ctx.createGain();
    env(gRuido, 0.3, 0.06, 1.2);
    ruido.connect(bp);
    bp.connect(gRuido);
    gRuido.connect(master);
    gRuido.connect(conv);
    ruido.start(t0);
    ruido.stop(t0 + 1.2);

    // 4) Agudo trêmulo — entra depois e fica ecoando, o "alguém te olhando".
    const alto = ctx.createOscillator();
    alto.type = 'triangle';
    alto.frequency.setValueAtTime(1245, t0);
    const lfo = ctx.createOscillator();
    const lfoG = ctx.createGain();
    lfo.frequency.value = 6.5;
    lfoG.gain.value = 22;
    lfo.connect(lfoG);
    lfoG.connect(alto.frequency);
    const gAlto = ctx.createGain();
    gAlto.gain.setValueAtTime(0.0001, t0);
    gAlto.gain.exponentialRampToValueAtTime(0.09, t0 + 0.25);
    gAlto.gain.exponentialRampToValueAtTime(0.0001, t0 + 2);
    alto.connect(gAlto);
    gAlto.connect(master);
    gAlto.connect(conv);
    alto.start(t0);
    alto.stop(t0 + 2.1);
    lfo.start(t0);
    lfo.stop(t0 + 2.1);

    setTimeout(() => { try { ctx.close(); } catch (e) {} }, 3000);
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
