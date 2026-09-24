'use client';
import { useState, useEffect } from 'react';
import DrawView from '@/components/DrawView';
import Autocomplete from '@/components/ui/Autocomplete';
import { IconSearch } from '@/components/ui/Icons';
import { getDrawHojePublico } from '@/lib/supabase';
import { POCO } from '@/lib/estilos';
import { POS_LETRA, POS_NOME, semPar, panelSala, ondeEstou } from '@/lib/draw';

const CHAVE_EU = 'uspd_draw_eu';

// Onde fica cada lugar na maquete (public/draw/sala-bp.webp, render do Gemini), em %
// da imagem: Governo = par de bancadas da esquerda, Oposição = par da direita;
// abertura na bancada de dentro (junto ao corredor), fechamento na de fora.
const MARCA = { OG: [31.6, 41], CG: [21.4, 34], OO: [59, 58.7], CO: [70.5, 65], juiz: [65, 23] };

function Maquete({ lugar }) {
  const [x, y] = MARCA[lugar] || [];
  return (
    <div aria-hidden="true" className="relative w-full max-w-[380px] mx-auto sm:mx-0 sm:w-[340px] lg:w-[400px] shrink-0">
      <img src="draw/sala-bp.webp" alt="" width="720" height="512" className="w-full h-auto" decoding="async" />
      {x !== undefined && (
        <span className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: x + '%', top: y + '%' }}>
          <span className="absolute inset-0 rounded-full bg-text/50 motion-safe:animate-ping" />
          <span className="relative block w-4 h-4 rounded-full bg-text ring-4 ring-bg/70" />
          <span className="absolute left-1/2 bottom-full mb-2 -translate-x-1/2 whitespace-nowrap rounded-md bg-bg/85 px-1.5 py-0.5 text-[13px] text-text">
            você
          </span>
        </span>
      )}
    </div>
  );
}

// Todos os nomes do draw (debatedores e juízes), pra escolher "quem sou eu".
function nomesDe(draw) {
  const nomes = [];
  (draw.salas || []).forEach((s) => {
    s.posicoes.forEach((p) => { nomes.push(p.p1); if (!semPar(p.p2)) nomes.push(p.p2); });
    nomes.push(...panelSala(s));
  });
  nomes.push(...(draw.juizes || []));
  return [...new Set(nomes.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

// "Onde eu estou?" (ref.: cartão de viagem do Uber / passe do Wallet): a pessoa diz o
// nome uma vez (fica guardado neste aparelho) e vê a própria sala sem procurar.
function OndeEstou({ draw, eu, trocar }) {
  const [busca, setBusca] = useState('');

  if (!eu) {
    return (
      <section aria-labelledby="onde-titulo" className="rounded-xl2 bg-surface p-5 sm:p-7 animate-rise focus-within:relative focus-within:z-10">
        <h2 id="onde-titulo" className="font-display text-2xl font-semibold tracking-tight">Onde eu estou?</h2>
        <label htmlFor="draw-eu" className="block text-[15px] font-medium text-text mt-5 mb-2">Seu nome</label>
        <div className="sm:max-w-md">
          <Autocomplete id="draw-eu" value={busca} options={nomesDe(draw)} placeholder="Digite pra buscar…" icon={IconSearch}
            inputClassName={POCO}
            onChange={(v, escolhido) => { setBusca(v); if (escolhido) trocar(v); }} />
        </div>
        <p className="text-[13px] text-muted mt-2">Fica guardado só neste aparelho.</p>
      </section>
    );
  }

  const r = ondeEstou(draw, eu);
  const primeiroNome = eu.split(' ')[0];
  return (
    <section aria-labelledby="onde-titulo"
      className="rounded-xl2 bg-surface p-5 sm:p-7 animate-rise flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
      <p className="text-[15px] text-muted">
        <span id="onde-titulo">{primeiroNome}, hoje você</span>
        {!r && <span> não está no draw.</span>}
      </p>

      {r?.papel === 'debate' && (
        <>
          <p className="font-display text-5xl sm:text-6xl font-semibold tracking-tight leading-none mt-2">Sala {r.sala.numero}</p>
          <p className="text-[15px] text-text mt-3">
            <span className={`font-bold ${POS_LETRA[r.pos.posicao]}`}>{r.pos.posicao}</span> · {POS_NOME[r.pos.posicao]}
          </p>
          <p className="text-[15px] text-text mt-1">{r.dupla ? <>com {r.dupla}</> : <span className="text-muted">sem dupla</span>}</p>
          {panelSala(r.sala).length > 0 && (
            <p className="text-[13px] text-muted mt-1">Juízes: {panelSala(r.sala).join(', ')}</p>
          )}
        </>
      )}
      {r?.papel === 'juiz' && (
        <>
          <p className="font-display text-5xl sm:text-6xl font-semibold tracking-tight leading-none mt-2">Sala {r.sala.numero}</p>
          <p className="text-[15px] text-text mt-3">julga esta sala</p>
          {panelSala(r.sala).length > 1 && (
            <p className="text-[13px] text-muted mt-1">com {panelSala(r.sala).filter((j) => j !== eu).join(', ')}</p>
          )}
        </>
      )}
      {r?.papel === 'geral' && (
        <p className="font-display text-4xl font-semibold tracking-tight leading-tight mt-2">é juiz geral</p>
      )}

      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mt-5 text-[13px]">
        {r?.sala && (
          <a href={`#sala-${r.sala.numero}`} className="py-1 text-text underline decoration-bordo decoration-2 underline-offset-4 hover:decoration-text">
            Ver na planta da sala
          </a>
        )}
        <button type="button" onClick={() => trocar('')} className="py-1 text-muted hover:text-text underline-offset-4 hover:underline">
          Não é você? Trocar nome
        </button>
      </div>
      </div>
      {r && r.papel !== 'geral' && <Maquete lugar={r.papel === 'juiz' ? 'juiz' : r.pos.posicao} />}
    </section>
  );
}

export default function DrawTab() {
  // undefined = carregando | null = sem draw | objeto = draw
  const [draw, setDraw] = useState(undefined);
  const [hoje, setHoje] = useState('');
  const [eu, setEu] = useState('');

  useEffect(() => {
    // data no cliente: o HTML é gerado no build e a data de lá já passou
    setHoje(new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date()));
    try { setEu(localStorage.getItem(CHAVE_EU) || ''); } catch (e) {}
    getDrawHojePublico()
      .then((d) => setDraw(d || null))
      .catch(() => setDraw(null));
  }, []);

  function trocar(nome) {
    setEu(nome);
    try { nome ? localStorage.setItem(CHAVE_EU, nome) : localStorage.removeItem(CHAVE_EU); } catch (e) {}
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Cabeçalho igual ao da Presença: data pequena em cima, título grande */}
      <header className="px-1 animate-rise">
        <p className="text-[15px] text-muted first-letter:uppercase min-h-[1.5rem]">{hoje}</p>
        <h2 className="font-display text-[32px] sm:text-5xl font-semibold tracking-tight leading-[1.05]">Draw</h2>
      </header>

      {draw === undefined && (
        <div className="grid gap-4 sm:gap-5 lg:grid-cols-2" aria-hidden="true">
          {[0, 1].map((i) => <div key={i} className="skeleton h-72 rounded-xl2" />)}
        </div>
      )}

      {draw === null && (
        <div className="rounded-xl2 bg-surface p-5 sm:p-7">
          <p className="text-[15px] text-text">O draw de hoje ainda não saiu.</p>
          <p className="text-[13px] text-muted mt-1">Ele aparece aqui assim que a diretoria publicar.</p>
        </div>
      )}

      {draw && (
        <>
          <OndeEstou draw={draw} eu={eu} trocar={trocar} />
          <DrawView draw={draw} eu={eu} />
        </>
      )}
    </div>
  );
}
