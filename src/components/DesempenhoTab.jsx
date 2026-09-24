'use client';
import { useState, useEffect, useMemo, useRef } from 'react';
import Autocomplete from '@/components/ui/Autocomplete';
import LineChart from '@/components/ui/LineChart';
import { IconSearch } from '@/components/ui/Icons';
import { getSpeaks } from '@/lib/supabase';
import { calibrar, ranking, serieDebatedor, evolucaoClube, componentesConectados } from '@/lib/speaks-stats';
import { fmtCurto } from '@/lib/datas';
import { norm } from '@/lib/data';
import { POCO } from '@/lib/estilos';

// Mesma chave do "Onde eu estou?" do Draw: quem já disse o nome lá entra direto aqui.
const CHAVE_EU = 'uspd_draw_eu';
const TOPO = 10;

const PAINEL = 'rounded-xl2 bg-surface p-5 sm:p-7';
const LINK = 'py-1 text-muted hover:text-text underline-offset-4 hover:underline';

// Nível (ou média crua) com o ± em tamanho menor, pra não brigar com o número.
function Valor({ v, se, grande }) {
  return (
    <span className="tabular-nums whitespace-nowrap">
      {v.toFixed(1)}
      {se > 0 && (
        <span className={`text-muted font-normal ${grande ? 'text-2xl ml-2' : 'text-[13px] ml-1'}`}>±{se.toFixed(1)}</span>
      )}
    </span>
  );
}

function TodasAsNotas({ serie }) {
  return (
    <details className="group mt-6">
      <summary className="cursor-pointer text-[13px] text-text underline decoration-bordo decoration-2 underline-offset-4 hover:decoration-text w-fit py-1">
        Todas as notas ({serie.length})
      </summary>
      <div className="mt-3 -mx-1 overflow-x-auto">
        <table className="w-full text-[13px] tabular-nums">
          <thead>
            <tr className="text-muted text-left border-b border-border/60">
              <th scope="col" className="font-normal px-1 py-1.5">Data</th>
              <th scope="col" className="font-normal px-1 py-1.5">Posição</th>
              <th scope="col" className="font-normal px-1 py-1.5">Juiz</th>
              <th scope="col" className="font-normal px-1 py-1.5 text-right">Crua</th>
              <th scope="col" className="font-normal px-1 py-1.5 text-right">Ajustada</th>
            </tr>
          </thead>
          <tbody>
            {serie.slice().reverse().map((p, i) => (
              <tr key={i}>
                <td className="px-1 py-2 text-muted whitespace-nowrap">{fmtCurto(p.data)}</td>
                <td className="px-1 py-2 text-muted whitespace-nowrap">{p.posicao}<span className="hidden sm:inline"> · S{p.sala}</span></td>
                <td className="px-1 py-2 text-muted max-w-[6.5rem] sm:max-w-[9rem] truncate">{p.juiz || '—'}</td>
                <td className="px-1 py-2 text-right text-muted">{p.cru.toFixed(0)}</td>
                <td className="px-1 py-2 text-right text-text font-semibold">{p.ajustado.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

// Topo da aba: o nível de quem está vendo (ou de quem foi clicado no ranking).
function Destaque({ rank, cal, eu, deb, ehEu, trocar, voltar, secaoRef }) {
  const [busca, setBusca] = useState('');
  const serie = useMemo(() => (deb ? serieDebatedor(cal, deb.pessoaId) : []), [cal, deb]);

  if (!deb && !eu) {
    return (
      <section ref={secaoRef} aria-labelledby="meu-titulo" className={`${PAINEL} animate-rise focus-within:relative focus-within:z-10 scroll-mt-4`}>
        <h2 id="meu-titulo" className="font-display text-2xl font-semibold tracking-tight">Qual é o seu nível?</h2>
        <label htmlFor="desemp-eu" className="block text-[15px] font-medium text-text mt-5 mb-2">Seu nome</label>
        <div className="sm:max-w-md">
          <Autocomplete id="desemp-eu" value={busca} options={rank.map((d) => d.nome)} placeholder="Digite pra buscar…"
            icon={IconSearch} inputClassName={POCO}
            onChange={(v, escolhido) => { setBusca(v); if (escolhido) trocar(v); }} />
        </div>
        <p className="text-[13px] text-muted mt-2">Fica guardado só neste aparelho (o mesmo nome do Draw).</p>
      </section>
    );
  }

  if (!deb) {
    return (
      <section ref={secaoRef} aria-labelledby="meu-titulo" className={`${PAINEL} animate-rise scroll-mt-4`}>
        <h2 id="meu-titulo" className="text-[15px] font-normal text-text">
          {eu.split(' ')[0]}, você ainda não tem notas registradas.
        </h2>
        <p className="text-[13px] text-muted mt-1">Seu nível aparece aqui depois do primeiro treino em que você debater.</p>
        <button type="button" onClick={() => trocar('')} className={`${LINK} text-[13px] mt-4`}>Não é você? Trocar nome</button>
      </section>
    );
  }

  const posicao = rank.findIndex((d) => d.pessoaId === deb.pessoaId) + 1;
  return (
    <section ref={secaoRef} tabIndex={-1} aria-labelledby="meu-titulo" className={`${PAINEL} animate-rise scroll-mt-4 focus:outline-none`}>
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:gap-10">
        <div className="shrink-0">
          <h2 id="meu-titulo" className="text-[15px] font-normal text-muted">
            {ehEu ? <>{deb.nome.split(' ')[0]}, seu nível</> : <>Nível de {deb.nome}</>}
          </h2>
          <p className="font-display text-6xl sm:text-7xl font-semibold tracking-tight leading-none mt-2">
            <Valor v={deb.nivel} se={deb.seNivel} grande />
          </p>
          <p className="text-[15px] text-text mt-4 tabular-nums">
            {posicao}º de {rank.length} no Nível · {deb.rodadas} {deb.rodadas === 1 ? 'rodada' : 'rodadas'}
          </p>
          <p className="text-[13px] text-muted mt-1 tabular-nums">Média crua {deb.mediaCrua.toFixed(1)}</p>
          {serie.length < 2 && (
            <p className="text-[13px] text-muted mt-4">Com uma rodada só ainda não dá pra ver evolução.</p>
          )}
        </div>

        {serie.length > 1 && (
          <div className="flex-1 min-w-0">
            <LineChart altura={180} largura={360} series={[
              { nome: 'Nota crua', cor: 'var(--muted)', pontos: serie.map((p) => ({ x: fmtCurto(p.data), y: p.cru })) },
              { nome: 'Nota ajustada', cor: 'var(--gold)', pontos: serie.map((p) => ({ x: fmtCurto(p.data), y: p.ajustado })) },
            ]} />
            <div className="flex items-center gap-5 mt-1 text-[13px] text-muted">
              <span className="flex items-center gap-2"><span aria-hidden="true" className="w-4 h-0.5 rounded bg-gold" />ajustada</span>
              <span className="flex items-center gap-2"><span aria-hidden="true" className="w-4 h-0.5 rounded bg-muted" />crua</span>
            </div>
          </div>
        )}
      </div>

      <TodasAsNotas serie={serie} />

      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mt-4 text-[13px]">
        {ehEu
          ? <button type="button" onClick={() => trocar('')} className={LINK}>Não é você? Trocar nome</button>
          : <button type="button" onClick={voltar} className={LINK}>{eu ? 'Voltar pro meu nível' : 'Voltar'}</button>}
      </div>
    </section>
  );
}

function Ranking({ rank, modo, setModo, meuId, abertoId, abrir }) {
  const [todos, setTodos] = useState(false);
  const lista = useMemo(() => {
    const base = rank.slice();
    if (modo === 'sps') base.sort((a, b) => b.mediaCrua - a.mediaCrua);
    return base;
  }, [rank, modo]);

  const minhaPos = lista.findIndex((d) => d.pessoaId === meuId);
  const visiveis = todos ? lista : lista.slice(0, TOPO);
  const meFixado = !todos && minhaPos >= TOPO;

  function linha(d, i) {
    const minha = d.pessoaId === meuId;
    return (
      <li key={d.pessoaId}>
        <button type="button" onClick={() => abrir(d.pessoaId)} aria-current={d.pessoaId === abertoId ? 'true' : undefined}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors
            ${minha ? 'bg-bordo/15 hover:bg-bordo/25' : d.pessoaId === abertoId ? 'bg-surface-2' : 'hover:bg-surface-2'}`}>
          <span className="w-7 text-right text-[13px] text-muted tabular-nums">{i + 1}</span>
          <span className="flex-1 min-w-0 truncate text-[15px] text-text">
            {d.nome}{minha && <span className="text-muted"> (você)</span>}
          </span>
          <span className="hidden sm:inline text-[13px] text-muted tabular-nums whitespace-nowrap">
            {d.rodadas} {d.rodadas === 1 ? 'rodada' : 'rodadas'}
          </span>
          <span className="w-24 text-right text-[15px] font-semibold">
            <Valor v={modo === 'sps' ? d.mediaCrua : d.nivel} se={modo === 'nivel' ? d.seNivel : 0} />
          </span>
        </button>
      </li>
    );
  }

  return (
    // Sem painel: só o destaque do topo é caixa. O padding alinha o texto com o de dentro dele.
    <section aria-labelledby="rank-titulo" className="px-5 sm:px-7 pt-6 sm:pt-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="rank-titulo" className="font-display text-2xl font-semibold tracking-tight">Ranking da temporada</h2>
        <div role="group" aria-label="Ordenar por" className="inline-flex rounded-xl bg-bg p-1">
          {[['nivel', 'Nível'], ['sps', 'Média crua']].map(([id, label]) => (
            <button key={id} type="button" aria-pressed={modo === id} onClick={() => setModo(id)}
              className={`px-3.5 py-1.5 rounded-lg text-[13px] font-medium transition-colors
                ${modo === id ? 'bg-surface-2 text-text' : 'text-muted hover:text-text'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <ol className="mt-5 -mx-3 space-y-0.5">
        {visiveis.map((d) => linha(d, lista.indexOf(d)))}
      </ol>
      {meFixado && (
        <ol className="-mx-3 mt-0.5 pt-1.5 border-t border-border/60" aria-label="Sua posição">
          {linha(lista[minhaPos], minhaPos)}
        </ol>
      )}

      {lista.length > TOPO && (
        <button type="button" onClick={() => setTodos((x) => !x)} aria-expanded={todos}
          className="mt-4 text-[13px] text-text underline decoration-bordo decoration-2 underline-offset-4 hover:decoration-text py-1">
          {todos ? 'Mostrar só os 10 primeiros' : `Ver todos (${lista.length})`}
        </button>
      )}
    </section>
  );
}

export default function DesempenhoTab() {
  const [speaks, setSpeaks] = useState(null);
  const [eu, setEu] = useState('');
  const [outro, setOutro] = useState(null); // pessoaId clicado no ranking
  const [modo, setModo] = useState('nivel'); // 'nivel' | 'sps'
  const destaqueRef = useRef(null);

  useEffect(() => {
    try { setEu(localStorage.getItem(CHAVE_EU) || ''); } catch (e) {}
    getSpeaks().then((s) => setSpeaks(s || [])).catch(() => setSpeaks([]));
  }, []);

  const cal = useMemo(() => calibrar(speaks || []), [speaks]);
  const rank = useMemo(() => ranking(cal), [cal]);
  const clube = useMemo(() => evolucaoClube(cal), [cal]);
  const componentes = useMemo(() => componentesConectados(speaks || []), [speaks]);

  // O nome guardado vem do Draw, que pode ter acento/caixa diferente: compara normalizado.
  const meu = eu ? rank.find((d) => norm(d.nome) === norm(eu)) : null;
  const deb = outro ? rank.find((d) => d.pessoaId === outro) : meu;

  function trocar(nome) {
    setEu(nome);
    setOutro(null);
    try { nome ? localStorage.setItem(CHAVE_EU, nome) : localStorage.removeItem(CHAVE_EU); } catch (e) {}
  }

  function abrir(pessoaId) {
    setOutro(pessoaId === meu?.pessoaId ? null : pessoaId);
    const suave = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Depois do render: o painel pode ter trocado de elemento. O foco vai junto pro leitor de tela.
    requestAnimationFrame(() => {
      const el = destaqueRef.current;
      el?.scrollIntoView({ behavior: suave ? 'smooth' : 'auto', block: 'start' });
      el?.focus({ preventScroll: true });
    });
  }

  const cabecalho = (
    <header className="px-1 animate-rise">
      <p className="text-[15px] text-muted min-h-[1.5rem]">Speaker points da temporada</p>
      <h2 className="font-display text-[32px] sm:text-5xl font-semibold tracking-tight leading-[1.05]">Desempenho</h2>
    </header>
  );

  if (speaks === null) {
    return (
      <div className="space-y-4 sm:space-y-5">
        {cabecalho}
        <div aria-hidden="true" className="skeleton h-64 rounded-xl2" />
      </div>
    );
  }

  if (speaks.length === 0) {
    return (
      <div className="space-y-4 sm:space-y-5">
        {cabecalho}
        <div className={PAINEL}>
          <p className="text-[15px] text-text">Ainda não há speaker points registrados.</p>
          <p className="text-[13px] text-muted mt-1">Os dados aparecem aqui conforme os juízes registram as notas.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      {cabecalho}

      <div className="grid gap-4 sm:gap-5 lg:grid-cols-[3fr_2fr] lg:items-start">
        <div className="space-y-4 sm:space-y-5 min-w-0">
          <Destaque rank={rank} cal={cal} eu={eu} deb={deb} ehEu={!outro && !!meu}
            trocar={trocar} voltar={() => setOutro(null)} secaoRef={destaqueRef} />
          <Ranking rank={rank} modo={modo} setModo={setModo} meuId={meu?.pessoaId} abertoId={deb?.pessoaId} abrir={abrir} />
        </div>

        {/* Bloco secundário: sem painel, menor, fixo ao lado no desktop */}
        <aside aria-label="Clube e metodologia" className="px-5 sm:px-7 lg:px-2 lg:pt-7 lg:sticky lg:top-5 space-y-8 min-w-0">
          <section aria-labelledby="clube-titulo">
            <h2 id="clube-titulo" className="text-[15px] font-semibold text-text">Evolução do clube</h2>
            <p className="text-[13px] text-muted mt-0.5 mb-3">Média ajustada por treino, descontado o viés de cada juiz.</p>
            <LineChart altura={200} largura={380} series={[{
              nome: 'Clube', cor: 'var(--gold)',
              pontos: clube.map((c) => ({ x: fmtCurto(c.data), y: c.media })),
            }]} />
          </section>

          {componentes.length > 1 && (
            <details className="text-[13px] text-muted">
              <summary className="cursor-pointer text-text py-1">
                <span aria-hidden="true" className="inline-block w-1.5 h-1.5 rounded-full bg-gold mr-2 align-middle" />
                Há {componentes.length} grupos sem juízes em comum
              </summary>
              <p className="mt-2 leading-relaxed">
                Comparar o nível de pessoas de grupos diferentes não é confiável: sem juízes em comum, o modelo
                não separa o rigor do juiz do nível de quem debateu. Dentro do mesmo grupo, a comparação vale.
              </p>
              <ul className="mt-2 space-y-1">
                {componentes.slice(0, 4).map((g, i) => (
                  <li key={i}>
                    <span className="text-text">Grupo {i + 1}:</span> {g.debatedores.length} debatedor(es), {g.juizes.length} juiz(es)
                    {g.debatedores.length <= 5 && g.debatedores[0]?.nome && <> ({g.debatedores.map((d) => d.nome).join(', ')})</>}
                  </li>
                ))}
                {componentes.length > 4 && <li>e mais {componentes.length - 4} grupos.</li>}
              </ul>
            </details>
          )}

          <details className="text-[13px] text-muted">
            <summary className="cursor-pointer text-text py-1">Como o Nível é calculado</summary>
            <div className="mt-2 space-y-2 leading-relaxed">
              <p>
                <strong className="text-text font-semibold">Média crua</strong> é a média simples das notas que a pessoa recebeu.
              </p>
              <p>
                <strong className="text-text font-semibold">Nível</strong> é uma estimativa calibrada. Cada nota é tratada
                como <code>nível do debatedor + viés do juiz + erro</code>, e o modelo estima as duas coisas juntas. Assim,
                quem foi julgado por um juiz mais duro não sai prejudicado.
              </p>
              <p>
                Com poucas rodadas, o nível é puxado em direção à média do clube (força estimada dos dados: K ≈ {cal.K ? cal.K.toFixed(1) : '—'}).
                Notas recentes pesam mais (meia-vida de {cal.halfLifeDias ? `${cal.halfLifeDias} dias` : 'sem decaimento'}).
              </p>
              <p>
                O <strong className="text-text font-semibold">±</strong> é a incerteza. Dois níveis cujos intervalos se
                sobrepõem, como 76 ± 2 e 77 ± 2, não devem ser tratados como diferentes.
              </p>
            </div>
          </details>
        </aside>
      </div>
    </div>
  );
}
