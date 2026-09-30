'use client';
import { useState, useEffect, useLayoutEffect, useRef } from 'react';

const CHAVE_VISTO = 'uspd_intro_visto';
// useLayoutEffect roda antes do primeiro paint — evita o flash de "mostra
// a abertura e some" em quem já viu hoje. No build estático (SSR), cai pra
// useEffect (useLayoutEffect não existe fora do browser).
const useEfeitoDeLayout = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

// Animação de abertura: um vídeo 16:9 (public/intro.mp4, Veo no Gemini, invertido no ffmpeg;
// fundo no tom da página) em que uma linha se desenha e vira o logo; ao terminar,
// a tela inteira sai (zoom + fade) revelando o app. Se o vídeo não carregar ou o navegador barrar o autoplay,
// cai na animação antiga: a logo surge e segura um instante. Só toca uma vez por
// dia (guarda a data no localStorage) — quem reabre o app várias vezes
// durante um treino não vê de novo a cada troca de aba.
//
// IMPORTANTE: salve o logotipo oficial da USP Debate como  public/logo.png
// (a imagem da bolha de conversa + "USP DEBATE"). Enquanto o arquivo não
// existir, aparece um fallback em texto.
export default function IntroSplash() {
  const [saindo, setSaindo] = useState(false);
  const [fim, setFim] = useState(false);
  const [semLogo, setSemLogo] = useState(false);
  const [semVideo, setSemVideo] = useState(false);
  const refVideo = useRef(null);

  useEfeitoDeLayout(() => {
    const hoje = new Date().toDateString();
    let vistoHoje = false;
    try { vistoHoje = localStorage.getItem(CHAVE_VISTO) === hoje; } catch { /* sem storage, tudo bem */ }
    // Quem pediu menos movimento no sistema pula a abertura (ela é só animação).
    if (vistoHoje || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setFim(true); return; }

    // só marca como "vista" quando a abertura de fato termina — em dev, o
    // StrictMode monta o efeito 2x (monta → limpa → monta), e gravar aqui
    // faria a 2ª montagem já achar "visto hoje" e pular a abertura.
    const v = refVideo.current;
    if (v) {
      // o erro de carregamento pode ter disparado antes da hidratação (HTML estático)
      if (v.error || v.networkState === 3) setSemVideo(true);
      // React não põe `muted` no HTML do build — sem isso o iOS barra o autoplay
      v.muted = true;
      v.play().catch(() => setSemVideo(true));
    }
    // vídeo sai no onEnded; o teto é pra rede lenta não prender ninguém na abertura
    const t = setTimeout(() => setSaindo(true), semVideo ? 5200 : 9000);
    return () => clearTimeout(t);
  }, [semVideo]);

  useEffect(() => {
    if (!saindo) return;
    const t = setTimeout(() => {
      try { localStorage.setItem(CHAVE_VISTO, new Date().toDateString()); } catch { /* sem storage, tudo bem */ }
      setFim(true);
    }, 650);
    return () => clearTimeout(t);
  }, [saindo]);

  if (fim) return null;

  // Toque/clique pula a abertura (5 s é bastante pra quem só quer registrar presença).
  function pular() {
    try { localStorage.setItem(CHAVE_VISTO, new Date().toDateString()); } catch { /* sem storage, tudo bem */ }
    setFim(true);
  }

  return (
    <div
      onClick={pular}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-bg overflow-hidden cursor-pointer"
      style={saindo ? { animation: 'introOut .65s cubic-bezier(.6,0,.8,.4) forwards' } : undefined}
    >
      {/* a máscara esconde a borda do quadro: o traço surge do escuro e o fundo do vídeo funde com o da página */}
      {!semVideo ? (
        <video ref={refVideo} src="intro.mp4" muted playsInline preload="auto"
          onEnded={() => setSaindo(true)} onError={() => setSemVideo(true)}
          className="h-[min(56vh,540px)] aspect-video max-w-none shrink-0 [mask-image:radial-gradient(ellipse_closest-side,#000_70%,transparent_100%)]" />
      ) : (<>
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
      </>)}
    </div>
  );
}
