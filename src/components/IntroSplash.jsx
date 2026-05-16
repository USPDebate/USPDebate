'use client';
import { useState, useEffect } from 'react';

// Animação de abertura: a logo da USP Debate surge, segura um instante
// e a tela inteira sai (zoom + fade) revelando o app.
//
// IMPORTANTE: salve o logotipo oficial da USP Debate como  public/logo.png
// (a imagem da bolha de conversa + "USP DEBATE"). Enquanto o arquivo não
// existir, aparece um fallback em texto.
export default function IntroSplash() {
  const [saindo, setSaindo] = useState(false);
  const [fim, setFim] = useState(false);
  const [semLogo, setSemLogo] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setSaindo(true), 2400);
    const t2 = setTimeout(() => setFim(true), 3060);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  if (fim) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-bg overflow-hidden"
      style={saindo ? { animation: 'introOut .65s cubic-bezier(.6,0,.8,.4) forwards' } : undefined}
    >
      {/* brilho pulsante de fundo */}
      <div
        className="absolute w-[600px] h-[600px] rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(240,87,63,0.16), transparent 60%)',
          animation: 'glowPulse 2.4s ease-in-out infinite',
        }}
      />

      <div
        className="relative flex flex-col items-center"
        style={{ animation: 'swooshSettle .9s cubic-bezier(.2,.8,.2,1) both' }}
      >
        {!semLogo ? (
          <img
            src="logo.png"
            alt="USP Debate"
            className="w-56 sm:w-72"
            onError={() => setSemLogo(true)}
          />
        ) : (
          <div className="text-center">
            <div className="font-sans text-lg tracking-[0.42em] text-text/90">USP</div>
            <div className="font-display text-6xl font-semibold tracking-tight leading-none">
              DEBATE
            </div>
          </div>
        )}

        <div
          className="text-[10px] uppercase tracking-[0.3em] text-gold/70 mt-5"
          style={{ animation: 'introIn .6s ease .9s both' }}
        >
          Sistema de Treinos BP
        </div>
      </div>
    </div>
  );
}
