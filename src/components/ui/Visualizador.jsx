'use client';
import { useState, useEffect } from 'react';

// Visualizador de imagem em tela cheia. O ponto todo é a rolagem: uma folha A4
// fotografada não cabe na tela, e antes o overlay não rolava — a página de trás
// é que rolava. Aqui o próprio overlay é o container de rolagem, o fundo fica
// travado, e dá para alternar entre "caber na largura" e tamanho real.
export default function Visualizador({ urls, indice = 0, onFechar }) {
  const [i, setI] = useState(indice);
  const [real, setReal] = useState(false);

  useEffect(() => {
    const antes = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onTecla = (e) => {
      if (e.key === 'Escape') onFechar();
      if (e.key === 'ArrowRight') setI((v) => Math.min(v + 1, urls.length - 1));
      if (e.key === 'ArrowLeft') setI((v) => Math.max(v - 1, 0));
    };
    window.addEventListener('keydown', onTecla);
    return () => {
      document.body.style.overflow = antes;
      window.removeEventListener('keydown', onTecla);
    };
  }, [onFechar, urls.length]);

  if (!urls || urls.length === 0) return null;
  const varias = urls.length > 1;
  const btn = `text-[11px] border border-[#ffffff33] text-[#f6f2f3] rounded-lg px-3 py-1.5
    transition hover:border-bordo hover:text-bordo whitespace-nowrap
    disabled:opacity-35 disabled:cursor-not-allowed`;

  return (
    <div className="fixed inset-0 z-[170] bg-black/92 overflow-auto overscroll-contain">
      <div className="sticky top-0 z-10 flex items-center justify-between gap-2 flex-wrap
        px-3 py-2 bg-black/80 backdrop-blur border-b border-[#ffffff1a]">
        <span className="text-[11px] text-[#a89a9d]">
          {varias ? `Imagem ${i + 1} de ${urls.length}` : 'Imagem'}
        </span>
        <div className="flex items-center gap-1.5 flex-wrap">
          {varias && (
            <>
              <button className={btn} disabled={i === 0}
                onClick={() => setI(i - 1)}>Anterior</button>
              <button className={btn} disabled={i === urls.length - 1}
                onClick={() => setI(i + 1)}>Próxima</button>
            </>
          )}
          <button className={btn} onClick={() => setReal(!real)}>
            {real ? 'Ajustar à tela' : 'Tamanho real'}
          </button>
          <a className={btn} href={urls[i]} target="_blank" rel="noreferrer">Abrir original</a>
          <button className={btn} onClick={onFechar}>Fechar</button>
        </div>
      </div>

      <div className="p-3">
        <img
          key={urls[i]}
          src={urls[i]}
          alt={varias ? `Imagem ${i + 1}` : 'Imagem'}
          className={real
            ? 'block max-w-none rounded-lg'
            : 'block w-full max-w-3xl mx-auto rounded-lg'}
        />
        {varias && (
          <div className="flex gap-2 justify-center flex-wrap mt-3 pb-6">
            {urls.map((u, k) => (
              <button key={u} onClick={() => setI(k)}
                className={`w-14 h-14 rounded-lg overflow-hidden border transition
                  ${k === i ? 'border-bordo' : 'border-[#ffffff26] opacity-60 hover:opacity-100'}`}>
                <img src={u} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
