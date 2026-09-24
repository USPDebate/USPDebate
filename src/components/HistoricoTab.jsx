'use client';
import { useState, useEffect, useRef } from 'react';
import DrawView from '@/components/DrawView';
import {
  getDrawsAnteriores, getDrawPorData, getDatasPresenca, getDatasSpeaks, listarPresentes, getSpeaksDeData,
} from '@/lib/supabase';
import { nomesDoDraw } from '@/lib/draw';
import { norm } from '@/lib/data';
import { dataLocal } from '@/lib/datas';

// Mesma chave do "Onde eu estou?" do Draw, pra marcar "você" nas salas antigas também.
const CHAVE_EU = 'uspd_draw_eu';

const ROTULO = {
  juiz: 'juiz', observador: 'observador', ps: 'debatedor', visitante: 'visitante',
};

const fmtMes = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' });
const fmtSemana = new Intl.DateTimeFormat('pt-BR', { weekday: 'long' });
const fmtLonga = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

// Datas (mais nova primeiro) agrupadas por mês: [{ mes: 'setembro de 2026', datas: [...] }]
function porMes(datas) {
  const grupos = [];
  datas.forEach((iso) => {
    const mes = fmtMes.format(dataLocal(iso));
    if (grupos.at(-1)?.mes !== mes) grupos.push({ mes, datas: [] });
    grupos.at(-1).datas.push(iso);
  });
  return grupos;
}

// Notas cujas salas não estão no draw publicado (sala manual, ou dia sem draw).
function NotasAvulsas({ notas }) {
  const salas = [...new Set(notas.map((s) => Number(s.sala)))].sort((a, b) => a - b);
  return (
    <div className="grid gap-4 sm:gap-5 lg:grid-cols-2">
      {salas.map((n) => (
        <section key={n} aria-labelledby={`avulsa-${n}`} className="rounded-xl2 bg-surface p-4 sm:p-6">
          <h3 id={`avulsa-${n}`} className="font-display text-2xl font-semibold tracking-tight">Sala {n}</h3>
          <ul className="mt-3 space-y-1.5 text-[15px]">
            {notas.filter((s) => Number(s.sala) === n).map((s) => (
              <li key={s.id} className="flex items-baseline gap-3">
                <span className="w-8 text-[13px] text-muted">{s.posicao}</span>
                <span className="flex-1 min-w-0 break-words text-text">{s.nome}</span>
                <span className="font-semibold tabular-nums">{s.speaks}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function Treino({ detalhe, eu, anterior, proximo, abrir }) {
  const { data, draw, presentes, speaks } = detalhe;
  const carregando = draw === null;

  const salasDoDraw = new Set((draw?.salas || []).map((s) => Number(s.numero)));
  const avulsas = (speaks || []).filter((s) => !salasDoDraw.has(Number(s.sala)));
  const noDraw = nomesDoDraw(draw);
  const fora = (presentes || []).filter((p) => p.nome && !noDraw.has(norm(p.nome)));
  const nSalas = draw?.salas.length || 0;

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="px-1">
        <h2 id="treino-titulo" className="font-display text-2xl font-semibold tracking-tight first-letter:uppercase">
          {fmtLonga.format(dataLocal(data))}
        </h2>
        {!carregando && (
          <p className="text-[13px] text-muted mt-1">
            {nSalas ? `${nSalas} ${nSalas === 1 ? 'sala' : 'salas'}` : 'Sem draw publicado'}
            {' · '}{presentes.length} {presentes.length === 1 ? 'presente' : 'presentes'}
            {speaks.length > 0 ? ' · com notas' : ''}
          </p>
        )}
        {/* Trocar de treino sem descer até a lista (no celular ela fica embaixo) */}
        <div className="flex items-center gap-5 mt-2 text-[13px]">
          {anterior && (
            <button type="button" onClick={() => abrir(anterior)} className="py-1 text-muted hover:text-text underline-offset-4 hover:underline">
              ← Treino anterior
            </button>
          )}
          {proximo && (
            <button type="button" onClick={() => abrir(proximo)} className="py-1 text-muted hover:text-text underline-offset-4 hover:underline">
              Próximo treino →
            </button>
          )}
        </div>
      </div>

      {carregando && <div aria-hidden="true" className="skeleton h-72 rounded-xl2" />}

      {!carregando && nSalas > 0 && <DrawView draw={draw} eu={eu} speaks={speaks} />}
      {!carregando && avulsas.length > 0 && <NotasAvulsas notas={avulsas} />}
      {!carregando && nSalas === 0 && avulsas.length === 0 && fora.length === 0 && (
        <p className="px-1 text-[15px] text-muted">Neste dia só foi registrada a presença.</p>
      )}

      {!carregando && fora.length > 0 && (
        <section aria-labelledby="fora-titulo" className="px-1 pt-3">
          <h3 id="fora-titulo" className="text-[15px] font-semibold text-text">
            {nSalas ? 'Presentes fora do draw' : 'Presentes'} <span className="font-normal text-muted tabular-nums">{fora.length}</span>
          </h3>
          {nSalas > 0 && (
            <p className="text-[13px] text-muted mt-0.5 max-w-prose">
              Sem sala nem juiz geral, mas contam como treino pros trainees.
            </p>
          )}
          <ul className="mt-3 grid gap-x-6 gap-y-1.5 sm:grid-cols-2 text-[15px]">
            {fora.map((p) => (
              <li key={p.presencaId} className="flex items-baseline gap-2">
                <span className="text-text">{p.nome}</span>
                {/* Debatedor é o caso comum: só as exceções ganham rótulo */}
                {p.tipo !== 'ps' && <span className="text-[13px] text-muted">{ROTULO[p.tipo] || p.tipo}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export default function HistoricoTab() {
  const [datas, setDatas] = useState(null);         // array de datas ISO, mais nova primeiro
  const [publicadas, setPublicadas] = useState(new Set());
  const [comNotas, setComNotas] = useState(new Set());
  const [detalhe, setDetalhe] = useState(null);     // { data, draw|null, presentes|null, speaks|null }
  const [eu, setEu] = useState('');
  const treinoRef = useRef(null);

  // Só busca o draw se ele foi publicado — rascunho não vaza no histórico.
  function carregar(dataISO, pub) {
    setDetalhe({ data: dataISO, draw: null, presentes: null, speaks: null });
    const vazio = { salas: [], juizes: [] };
    Promise.all([
      pub.has(dataISO) ? getDrawPorData(dataISO) : Promise.resolve(null),
      listarPresentes(dataISO),
      getSpeaksDeData(dataISO),
    ])
      .then(([draw, pres, sp]) => setDetalhe((atual) => (atual?.data !== dataISO ? atual : {
        data: dataISO, draw: draw || vazio, presentes: pres || [], speaks: sp || [],
      })))
      .catch(() => setDetalhe((atual) => (atual?.data !== dataISO ? atual : {
        data: dataISO, draw: vazio, presentes: [], speaks: [],
      })));
  }

  useEffect(() => {
    try { setEu(localStorage.getItem(CHAVE_EU) || ''); } catch (e) {}
    Promise.all([getDrawsAnteriores(), getDatasPresenca(), getDatasSpeaks()])
      .then(([dr, pres, sp]) => {
        const pub = new Set(dr || []);
        const todas = [...new Set([...(dr || []), ...(pres || []), ...(sp || [])])].sort().reverse();
        setPublicadas(pub);
        setComNotas(new Set(sp || []));
        setDatas(todas);
        if (todas.length) carregar(todas[0], pub); // o treino mais recente já abre
      })
      .catch(() => setDatas([]));
  // Só na montagem: carregar recebe tudo por parâmetro, não lê estado.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function abrir(dataISO) {
    carregar(dataISO, publicadas);
    // No celular a lista fica embaixo do treino: sobe até ele. O foco vai junto.
    const suave = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    requestAnimationFrame(() => {
      const el = treinoRef.current;
      if (el && el.getBoundingClientRect().top < 0) el.scrollIntoView({ behavior: suave ? 'smooth' : 'auto', block: 'start' });
      el?.focus({ preventScroll: true });
    });
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      <header className="px-1 animate-rise">
        <p className="text-[15px] text-muted min-h-[1.5rem]">
          {datas ? `${datas.length} ${datas.length === 1 ? 'treino' : 'treinos'} na temporada` : ''}
        </p>
        <h2 className="font-display text-[32px] sm:text-5xl font-semibold tracking-tight leading-[1.05]">Histórico</h2>
      </header>

      {datas === null && <div aria-hidden="true" className="skeleton h-72 rounded-xl2" />}

      {datas && datas.length === 0 && (
        <div className="rounded-xl2 bg-surface p-5 sm:p-7">
          <p className="text-[15px] text-text">Nenhum treino registrado ainda.</p>
          <p className="text-[13px] text-muted mt-1">Os treinos aparecem aqui depois do primeiro registro de presença.</p>
        </div>
      )}

      {datas && datas.length > 0 && (
        <div className="grid gap-8 pt-4 lg:pt-0 lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-10 lg:items-start">
          {/* Treino aberto: primeiro no celular, à direita no desktop */}
          <section ref={treinoRef} tabIndex={-1} aria-labelledby="treino-titulo"
            className="min-w-0 scroll-mt-4 focus:outline-none animate-rise lg:col-start-2 lg:row-start-1">
            {detalhe && (
              <Treino detalhe={detalhe} eu={eu} abrir={abrir}
                anterior={datas[datas.indexOf(detalhe.data) + 1]}
                proximo={datas[datas.indexOf(detalhe.data) - 1]} />
            )}
          </section>

          <nav aria-label="Treinos anteriores"
            className="lg:col-start-1 lg:row-start-1 lg:sticky lg:top-5 lg:max-h-[calc(100vh-2.5rem)] lg:overflow-y-auto lg:pr-2">
            <h2 className="px-1 text-[15px] font-semibold text-text lg:sr-only">Outros treinos</h2>
            {porMes(datas).map((g) => (
              <div key={g.mes} className="mt-4 first:mt-3 lg:first:mt-0">
                <h3 className="px-3 text-[13px] text-muted first-letter:uppercase">{g.mes}</h3>
                <ul className="mt-1 space-y-0.5">
                  {g.datas.map((iso) => {
                    const ativo = detalhe?.data === iso;
                    return (
                      <li key={iso}>
                        <button type="button" onClick={() => abrir(iso)} aria-current={ativo ? 'true' : undefined}
                          className={`w-full flex items-baseline gap-3 px-3 py-2 rounded-lg text-left transition-colors
                            ${ativo ? 'bg-surface text-text' : 'text-text hover:bg-surface/60'}`}>
                          <span className="w-6 text-[15px] font-semibold tabular-nums">{iso.slice(8)}</span>
                          <span className="flex-1 text-[13px] text-muted">{fmtSemana.format(dataLocal(iso))}</span>
                          {/* Quase todo treino tem draw + notas: só as exceções ganham marca */}
                          {!publicadas.has(iso) && !comNotas.has(iso)
                            ? <span className="text-[13px] text-muted">só presença</span>
                            : !comNotas.has(iso) && <span className="text-[13px] text-muted">sem notas</span>}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>
        </div>
      )}
    </div>
  );
}
