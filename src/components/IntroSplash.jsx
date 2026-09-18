'use client';
import { useState, useEffect, useLayoutEffect } from 'react';

const CHAVE_VISTO = 'uspd_intro_visto';
// useLayoutEffect roda antes do primeiro paint — evita o flash de "mostra
// a abertura e some" em quem já viu hoje. No build estático (SSR), cai pra
// useEffect (useLayoutEffect não existe fora do browser).
const useEfeitoDeLayout = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

// Animação de abertura: o emblema surge, a marca "USP DEBATE" entra em
// destaque com um contador subindo, segura um instante e a tela sai (zoom +
// fade) revelando o app. Só toca uma vez por dia (guarda a data no
// localStorage) — quem reabre o app várias vezes durante um treino não vê
// de novo a cada troca de aba.
//
// IMPORTANTE: salve o logotipo oficial da USP Debate como  public/logo.png
// (a imagem da bolha de conversa). Enquanto o arquivo não existir, o
// emblema simplesmente não aparece — a marca em texto já carrega a tela.
export default function IntroSplash() {
  const [saindo, setSaindo] = useState(false);
  const [fim, setFim] = useState(false);
  const [semLogo, setSemLogo] = useState(false);
  const [contagem, setContagem] = useState(0);

  useEfeitoDeLayout(() => {
    const hoje = new Date().toDateString();
    let vistoHoje = false;
    try { vistoHoje = localStorage.getItem(CHAVE_VISTO) === hoje; } catch { /* sem storage, tudo bem */ }
    if (vistoHoje) { setFim(true); return; }

    // só marca como "vista" quando a abertura de fato termina — em dev, o
    // StrictMode monta o efeito 2x (monta → limpa → monta), e gravar aqui
    // faria a 2ª montagem já achar "visto hoje" e pular a abertura.
    const passo = setInterval(() => setContagem((c) => (c >= 100 ? c : c + 4)), 40);
    const t1 = setTimeout(() => setSaindo(true), 2400);
    const t2 = setTimeout(() => {
      try { localStorage.setItem(CHAVE_VISTO, hoje); } catch { /* sem storage, tudo bem */ }
      setFim(true);
    }, 3060);
    return () => { clearInterval(passo); clearTimeout(t1); clearTimeout(t2); };
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

      <div className="relative flex flex-col items-center px-6">
        {!semLogo && (
          <img
            src="logo.png"
            alt=""
            className="w-14 sm:w-16 mb-4"
            style={{ animation: 'swooshSettle .9s cubic-bezier(.2,.8,.2,1) both' }}
            onError={() => setSemLogo(true)}
          />
        )}

        <div
          className="font-brand text-brand-gradient text-center leading-[0.92] animate-brand-in"
          style={{ fontSize: 'clamp(2.75rem, 13vw, 7rem)' }}
        >
          USP DEBATE
        </div>

        <div
          className="text-[10px] uppercase tracking-[0.3em] text-gold/70 mt-5"
          style={{ animation: 'introIn .6s ease .9s both' }}
        >
          Sistema de Treinos BP
        </div>

        <div
          className="font-brand text-[13px] tabular-nums text-muted/70 mt-8"
          style={{ animation: 'introIn .4s ease .2s both' }}
        >
          {contagem}
        </div>
      </div>
    </div>
  );
}
