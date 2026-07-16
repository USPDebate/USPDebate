'use client';
import { useState, useEffect } from 'react';
import VaporizeTextCycle, { VaporizeImage, Tag } from '@/components/ui/vapour-text-effect';

// Animação de abertura: a logo da USP Debate surge nítida, segura um
// instante e se dissolve em partículas (efeito vapor); a tela inteira
// então sai (zoom + fade) revelando o app.
//
// IMPORTANTE: salve o logotipo oficial da USP Debate como public/logo.png.
// Enquanto o arquivo não existir, o fallback é o texto "USP DEBATE"
// com o mesmo efeito. Com prefers-reduced-motion, tudo fica estático.
export default function IntroSplash() {
  const [saindo, setSaindo] = useState(false);
  const [fim, setFim] = useState(false);
  const [semLogo, setSemLogo] = useState(false);
  // null até o mount: fonte real do next/font + media queries só existem no cliente
  const [cfg, setCfg] = useState(null);

  useEffect(() => {
    const t1 = setTimeout(() => setSaindo(true), 2800);
    const t2 = setTimeout(() => setFim(true), 3460);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  useEffect(() => {
    // O canvas não resolve var(--font-display) — pega a família real
    // carregada pelo next/font (IBM Plex Serif) no elemento raiz.
    const fam = getComputedStyle(document.documentElement)
      .getPropertyValue('--font-display').trim();
    setCfg({
      fontFamily: fam || 'Georgia, serif',
      fontSize: window.innerWidth < 640 ? '46px' : '76px',
      reduzMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    });
  }, []);

  if (fim) return null;

  const conteudo = () => {
    // Sem animação: logo (ou texto) estático, como era antes.
    if (!cfg || cfg.reduzMotion) {
      return !semLogo ? (
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
      );
    }

    // Logo vaporizando (padrão). Se logo.png não existir, cai pro texto.
    if (!semLogo) {
      return (
        <div className="w-56 sm:w-72">
          <VaporizeImage
            src="logo.png"
            alt="USP Debate"
            spread={5}
            density={5}
            delay={0.9}
            vaporizeDuration={1.7}
            direction="left-to-right"
            onError={() => setSemLogo(true)}
          />
        </div>
      );
    }
    return (
      <div className="w-[min(88vw,640px)] h-24 sm:h-36">
        <VaporizeTextCycle
          texts={['USP DEBATE']}
          font={{
            fontFamily: cfg.fontFamily,
            fontSize: cfg.fontSize,
            fontWeight: 600,
          }}
          color="rgb(242, 239, 247)"
          spread={5}
          density={5}
          animation={{
            vaporizeDuration: 1.8,
            fadeInDuration: 0.7,
            waitDuration: 0.4,
          }}
          direction="left-to-right"
          alignment="center"
          tag={Tag.H1}
        />
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-bg overflow-hidden"
      style={saindo ? { animation: 'introOut .65s cubic-bezier(.6,0,.8,.4) forwards' } : undefined}
    >
      {/* brilho pulsante de fundo */}
      <div
        className="absolute w-[600px] h-[600px] rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(139,111,208,0.18), transparent 60%)',
          animation: 'glowPulse 2.4s ease-in-out infinite',
        }}
      />

      <div
        className="relative flex flex-col items-center"
        style={{ animation: 'swooshSettle .9s cubic-bezier(.2,.8,.2,1) both' }}
      >
        {conteudo()}

        <div
          className="font-mono text-[10px] uppercase tracking-[0.3em] text-gold/70 mt-5"
          style={{ animation: 'introIn .6s ease .9s both' }}
        >
          Sistema de Treinos BP
        </div>
      </div>
    </div>
  );
}
