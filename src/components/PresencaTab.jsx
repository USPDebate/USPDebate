'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import Button from '@/components/ui/Button';
import Alert from '@/components/ui/Alert';
import Autocomplete from '@/components/ui/Autocomplete';
import LinkButton from '@/components/ui/LinkButton';
import { IconCheck, IconSearch } from '@/components/ui/Icons';
import { listarPessoas, listarPresentesHoje, registrarPresenca, atualizarPresenca } from '@/lib/supabase';
import { toast } from '@/lib/toast';
import { POCO } from '@/lib/estilos';

// img: objeto 3D de cada opção (public/presenca/obj-<img>.webp, fundo recortado). Rótulo curto
// de uma linha: a pergunta já está na legenda do grupo.
const TIPOS = [
  { id: 'ps', label: 'Debater', img: 'debater' },
  { id: 'juiz', label: 'Julgar', img: 'juiz' },
  { id: 'observador', label: 'Assistir', img: 'assistir' },
];

// Toda a aba usa um nível só de caixa: o painel. Dentro dele, o agrupamento é
// feito com espaço (apertado dentro do grupo, folgado entre grupos, ref.: Hims).
const PAINEL = 'rounded-xl2 bg-surface p-5 sm:p-7 animate-rise';
// Contorno de controles em repouso: #766669 dá 3:1 contra o painel (WCAG 1.4.11).
const BORDA = 'ring-[#766669]';


function iniciais(nome) {
  return nome.split(' ').map((x) => x[0]).slice(0, 2).join('').toUpperCase();
}

// Tiles com objeto 3D (consenso dos 3 revisores): objeto inteiro e centralizado,
// rótulo embaixo. Sem escolha = só contorno (3:1 contra o painel). Escolhido = borda
// de 2px clara + check + fundo um pouco mais claro, tudo neutro: o bordô fica só pro
// botão de confirmar e o dourado só pro foco. Por baixo são rádios nativos.
function SeletorTipo({ value, onChange, name, legenda }) {
  return (
    <fieldset>
      <legend className="block text-[15px] font-medium text-text mb-3">{legenda}</legend>
      <div className="grid grid-cols-3 gap-2">
        {TIPOS.map((t) => {
          const ativo = value === t.id;
          return (
            <label key={t.id}
              className={`group relative flex flex-col items-start justify-end h-[100px] sm:h-[112px] p-3 rounded-xl
                cursor-pointer select-none transition-colors duration-200
                has-[:focus-visible]:outline has-[:focus-visible]:outline-2
                has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-gold
                ${ativo ? 'bg-white/[0.07] ring-2 ring-inset ring-text' : `ring-1 ring-inset ${BORDA} hover:bg-white/[0.03]`}`}>
              <input type="radio" name={name} value={t.id} checked={ativo}
                onChange={() => onChange(t.id)} className="sr-only" />
              <img src={`presenca/obj-${t.img}.webp`} alt="" height="72" decoding="async"
                className="pointer-events-none absolute left-1/2 top-2.5 h-14 sm:h-16 w-auto max-w-[70%] object-contain -translate-x-1/2
                  transition-transform duration-300 ease-[cubic-bezier(.2,.7,.2,1)] motion-safe:group-hover:-translate-y-0.5" />
              <span className="relative text-[15px] font-semibold leading-none text-text">{t.label}</span>
              {ativo && <IconCheck className="absolute top-2 right-2 w-5 h-5 text-text" />}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

// Quantos faltam pra fechar a próxima sala (8 debatedores por sala, mesma conta do draw no Admin).
function fraseSala(lista) {
  if (lista.length === 0) return 'Ninguém chegou ainda.';
  const deb = lista.filter((p) => !p.naoDebate).length;
  const faltam = 8 - (deb % 8);
  return faltam === 8 ? `${deb / 8} ${deb === 8 ? 'sala fechada' : 'salas fechadas'}.`
    : `Falta${faltam > 1 ? 'm' : ''} ${faltam} pra ${deb < 8 ? 'abrir a 1ª sala' : 'mais uma sala'}.`;
}

const FAZ = { ps: 'vai debater', juiz: 'vai julgar', observador: 'vai assistir', visitante: 'vai assistir' };
// Onde cada cartão de chegada flutua em volta do microfone (desktop).
const POS_CARTAO = ['left-0 top-3', 'right-0 top-[38%]', 'left-8 bottom-2'];

// Topo da aba (ref.: hero escuro do Resend + cartões flutuantes do Flighty): o
// microfone girando (vídeo do Gemini, fundo já no tom da página) e as últimas
// chegadas flutuando em volta. É decorativo (a lista de verdade está abaixo), tem
// botão de pausar e, com "reduzir movimento", começa parado.
function TopoTreino({ presentes }) {
  const [hoje, setHoje] = useState('');
  const [parado, setParado] = useState(false);
  const refVideo = useRef(null);

  useEffect(() => {
    // data no cliente: o HTML é gerado no build e a data de lá já passou
    setHoje(new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date()));
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) setParado(true);
  }, []);
  useEffect(() => {
    const v = refVideo.current;
    if (!v) return;
    if (parado) v.pause(); else v.play().catch(() => {});
  }, [parado]);

  const lista = presentes || [];
  const ultimos = [...lista].sort((a, b) => b.hora.localeCompare(a.hora)).slice(0, 3);
  // Números grandes (ref.: stats do Squarespace): o que importa num relance.
  const numeros = [
    ['presentes', lista.length],
    ['debatendo', lista.filter((p) => !p.naoDebate).length],
    ['juízes', lista.filter((p) => p.tipo === 'juiz').length],
  ];

  // Larguras diferentes de propósito (ref.: Hims): o topo numa coluna mais estreita e
  // centralizada, formulário + lista mais largos embaixo.
  return (
    <section aria-labelledby="treino-titulo" className="glass relative overflow-hidden rounded-xl2 animate-rise lg:w-[78%] lg:mx-auto">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-5 py-4 sm:px-8 sm:py-6">
        <div className="min-w-0">
          {/* no celular a data já está no cabeçalho do site */}
          <p className="hidden sm:block text-sm text-muted first-letter:uppercase min-h-[1.25rem]">{hoje}</p>
          <h2 id="treino-titulo" className="font-display text-2xl sm:text-5xl font-semibold tracking-tight leading-[1.05] sm:mt-1">
            Treino de hoje
          </h2>
          <dl className="mt-3 sm:mt-6 grid grid-cols-3 gap-3 sm:gap-10 max-w-sm sm:max-w-md" aria-live="polite">
            {numeros.map(([rotulo, n]) => (
              // dt vem antes no HTML (semântica); o flex-col-reverse põe o número em cima
              <div key={rotulo} className="flex flex-col-reverse">
                <dt className="text-xs sm:text-sm text-muted mt-1">{rotulo}</dt>
                <dd className="font-display text-3xl sm:text-5xl font-semibold tracking-tight tabular-nums leading-none">
                  {presentes ? n : '·'}
                </dd>
              </div>
            ))}
          </dl>
          <p className="text-xs sm:text-sm text-muted mt-3 sm:mt-4 text-pretty min-h-[1rem]">
            {presentes ? fraseSala(lista) : ''}
          </p>
        </div>

        <div aria-hidden="true" className="relative w-[64px] h-[124px] sm:w-[440px] sm:h-[250px]">
          <video ref={refVideo} src="presenca/microfone.mp4" poster="presenca/microfone.webp"
            muted loop playsInline preload="metadata" width="360" height="640"
            className="absolute left-1/2 top-1/2 h-[118%] w-auto max-w-none -translate-x-1/2 -translate-y-1/2
              [mask-image:radial-gradient(closest-side,#000_62%,transparent_100%)]" />
          {ultimos.map((p, i) => (
            <div key={p.presencaId}
              className={`hidden sm:block absolute ${POS_CARTAO[i]} w-[178px] animate-fade-up`}
              style={{ animationDelay: `${0.25 + i * 0.12}s` }}>
              <div className={`animate-flutua flex items-center gap-2.5 rounded-xl px-3 py-2
                bg-surface/85 backdrop-blur-md ring-1 ring-white/10 shadow-[0_12px_30px_-12px_rgba(0,0,0,.7)]
                ${parado ? '[animation-play-state:paused]' : ''}`}
                style={{ animationDelay: `${i * -2}s` }}>
                <span className={`w-7 h-7 shrink-0 rounded-full grid place-items-center text-[10px] font-semibold
                  ${p.tipo === 'juiz' ? 'bg-gold/15 text-gold' : p.naoDebate ? 'bg-surface-2 text-muted' : 'bg-bordo/25 text-[#f3a3b3]'}`}>
                  {iniciais(p.nome)}
                </span>
                <span className="min-w-0 leading-tight">
                  <span className="block text-[13px] font-semibold text-text truncate">{p.nome.split(' ')[0]} chegou</span>
                  <span className="block text-[11px] text-muted truncate tabular-nums">{p.hora} · {FAZ[p.tipo] || 'presente'}</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <button type="button" onClick={() => setParado((v) => !v)} aria-pressed={parado}
        aria-label={parado ? 'Retomar animação do microfone' : 'Pausar animação do microfone'}
        className="absolute bottom-2.5 right-2.5 grid place-items-center w-8 h-8 rounded-full bg-black/30 ring-1 ring-white/10
          text-muted hover:text-text transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold">
        {parado
          ? <span aria-hidden="true" className="ml-0.5 border-y-[5px] border-y-transparent border-l-[8px] border-l-current" />
          : (
            <span aria-hidden="true" className="flex gap-[3px]">
              <span className="w-[3px] h-2.5 bg-current rounded-sm" /><span className="w-[3px] h-2.5 bg-current rounded-sm" />
            </span>
          )}
      </button>
    </section>
  );
}

// Grupos da lista de presentes: o papel vira título com a contagem.
const GRUPOS = [['ps', 'Debatendo'], ['juiz', 'Julgando'], ['assistir', 'Assistindo']];
const grupoDe = (p) => (p.tipo === 'ps' ? 'ps' : p.tipo === 'juiz' ? 'juiz' : 'assistir');

// Uma linha por dupla quando os dois já chegaram (antes cada um aparecia duas vezes).
function juntarDuplas(lista) {
  const usados = new Set();
  const out = [];
  for (const p of lista) {
    if (usados.has(p.presencaId)) continue;
    const par = p.tipo === 'ps' && p.dupla
      && lista.find((o) => o !== p && o.tipo === 'ps' && o.nome === p.dupla && !usados.has(o.presencaId));
    usados.add(p.presencaId);
    if (par) usados.add(par.presencaId);
    out.push(par ? [p, par] : [p]);
  }
  return out;
}

// Comemoração ao confirmar (ref.: confete do Yazio): uma rajada nas cores da
// casa, uma vez só; some com "reduzir movimento".
const CORES_CONFETE = ['#c14059', '#cda963', '#f1ebe8', '#8a2538'];
function Confete() {
  return (
    <span aria-hidden="true" className="pointer-events-none absolute inset-0 motion-reduce:hidden">
      {Array.from({ length: 18 }, (_, i) => {
        const ang = (i / 18) * Math.PI * 2;
        const dist = 64 + (i % 3) * 24;
        return (
          <span key={i} className="confete" style={{
            '--x': `${Math.round(Math.cos(ang) * dist)}px`, '--y': `${Math.round(Math.sin(ang) * dist)}px`,
            '--r': `${i * 47}deg`, background: CORES_CONFETE[i % 4], animationDelay: `${(i % 4) * 30}ms`,
          }} />
        );
      })}
    </span>
  );
}

export default function PresencaTab() {
  const [tipo, setTipo] = useState('ps');
  const [pessoas, setPessoas] = useState([]);       // [{id,nome,nome_norm}]
  const [modoNovo, setModoNovo] = useState(false);  // fluxo "primeira vez"
  const [nome, setNome] = useState('');
  const [nomeOk, setNomeOk] = useState(false);      // selecionou da lista
  const [dupla, setDupla] = useState('');
  const [duplaOk, setDuplaOk] = useState(false);
  const [duplaInvalida, setDuplaInvalida] = useState(false);
  const [registrando, setRegistrando] = useState(false);
  const [alerta, setAlerta] = useState(null);
  const [feito, setFeito] = useState(null);         // { nome, tipo, dupla } da última confirmação
  const refFeito = useRef(null);

  const [presentes, setPresentes] = useState(null);
  const [editando, setEditando] = useState(null);
  const [editDupla, setEditDupla] = useState('');
  const [editTipo, setEditTipo] = useState('ps');
  const [editAlerta, setEditAlerta] = useState(null);

  const nomesPessoas = pessoas.map((p) => p.nome);

  const carregar = useCallback(() => {
    listarPresentesHoje().then((p) => setPresentes(p || [])).catch(() => setPresentes([]));
  }, []);

  useEffect(() => {
    listarPessoas().then((p) => setPessoas(p || [])).catch(() => {});
    carregar();
  }, [carregar]);

  async function registrar() {
    const nomeFinal = nome.trim();
    if (!nomeFinal) { setAlerta({ tipo: 'error', msg: 'Informe seu nome.' }); return; }

    if (modoNovo) {
      const partes = nomeFinal.split(/\s+/).filter((x) => x.length >= 2);
      if (partes.length < 2) {
        setAlerta({ tipo: 'error', msg: 'Digite seu nome e sobrenome completos.' }); return;
      }
    } else if (!nomeOk) {
      setAlerta({ tipo: 'error', msg: 'Escolha seu nome na lista de sugestões. Se é sua primeira vez, use “Primeira vez aqui?”.' });
      return;
    }
    if (tipo === 'ps' && dupla.trim() && !duplaOk) {
      setDuplaInvalida(true);
      setAlerta({ tipo: 'error', msg: 'Selecione a dupla clicando num nome da lista.' }); return;
    }

    setRegistrando(true);
    const res = await registrarPresenca({ nome: nomeFinal, dupla: dupla.trim(), tipo });
    setRegistrando(false);

    if (res.ok) {
      setFeito({ nome: nomeFinal, tipo, dupla: tipo === 'ps' ? dupla.trim() : '' });
      setAlerta(null);
      setNome(''); setDupla(''); setNomeOk(false); setDuplaOk(false);
      setDuplaInvalida(false); setModoNovo(false);
      listarPessoas().then((p) => setPessoas(p || [])); // novo cadastro pode ter entrado
      carregar();
    } else {
      setAlerta({ tipo: res.erro.includes('já registrou') ? 'info' : 'error', msg: res.erro });
    }
  }

  // Foco vai pro título da confirmação: leitor de tela anuncia, teclado segue dali.
  useEffect(() => { if (feito) refFeito.current?.focus(); }, [feito]);

  function abrirEdicao(p) {
    setEditando(p); setEditDupla(p.dupla || ''); setEditTipo(p.tipo); setEditAlerta(null);
  }
  async function salvarEdicao(novaDupla = editDupla) {
    const res = await atualizarPresenca({
      pessoaId: editando.pessoaId, dupla: novaDupla.trim(), tipo: editTipo,
    });
    if (res.ok) {
      toast('success', res.mensagem);
      carregar();
      setEditando(null);
    } else setEditAlerta({ tipo: 'error', msg: res.erro });
  }

  // Linha de uma pessoa na lista. Função de render (não componente) pra não
  // remontar a cada digitação no formulário.
  function linhaPessoa(p, sub) {
    const cor = p.tipo === 'juiz' ? 'bg-gold/15 text-gold'
      : p.tipo === 'ps' ? 'bg-bordo/25 text-[#f3a3b3]' : 'bg-surface-2 text-muted';
    return (
      <div key={p.presencaId} className="flex items-center gap-3 min-h-[44px]">
        <span aria-hidden="true" className={`relative z-10 w-8 h-8 rounded-full grid place-items-center
          text-[11px] font-semibold shrink-0 ${cor}`}>{iniciais(p.nome)}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] text-text line-clamp-2 break-words">{p.nome}</span>
          {sub && <span className="block text-[13px] text-muted truncate">{sub}</span>}
        </span>
        <span className="text-[13px] text-muted tabular-nums shrink-0">{p.hora}</span>
        <LinkButton variant="plain" className="!text-[13px] !px-2.5 !py-2.5 -mr-2.5 shrink-0"
          aria-label={`Editar presença de ${p.nome}`} onClick={() => abrirEdicao(p)}>
          Editar
        </LinkButton>
      </div>
    );
  }

  const campo = 'block text-[15px] font-medium text-text mb-2';

  return (
    <div className="space-y-4 sm:space-y-5">
    <TopoTreino presentes={presentes} />
    {/* Formulário e lista coladinhos (8px): são o mesmo assunto */}
    <div className="space-y-2 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-2 lg:items-start xl:-mx-4">
      {/* Coluna do formulário: no desktop fica parada enquanto a lista rola */}
      <div className="space-y-2 lg:sticky lg:top-5">
      {/* ─── Registrar presença ─── */}
      {feito ? (
        <section className={PAINEL}>
          <div className="flex flex-col items-center text-center py-4">
            <span aria-hidden="true" className="relative grid place-items-center w-16 h-16 rounded-full bg-success/15 mb-5">
              <Confete />
              <IconCheck className="w-8 h-8 text-success motion-safe:animate-[checkPop_.45s_cubic-bezier(.34,1.56,.64,1)_both]" />
            </span>
            <h2 ref={refFeito} tabIndex={-1} className="font-display text-2xl font-semibold tracking-tight outline-none">
              Presença confirmada
            </h2>
            <p className="text-[15px] text-muted mt-2 max-w-[30ch] text-pretty">
              <span className="text-text">{feito.nome}</span>
              {feito.tipo === 'juiz' ? ' vai julgar hoje.'
                : feito.tipo === 'observador' ? ' vai assistir hoje.'
                : feito.dupla ? <> vai debater com <span className="text-text">{feito.dupla}</span>.</>
                : ' vai debater hoje. A dupla sai no sorteio.'}
            </p>
            <Button className="mt-8 h-[52px] !py-0 !shadow-none normal-case !tracking-normal !text-base" onClick={() => setFeito(null)}>Registrar outra pessoa</Button>
          </div>
        </section>
      ) : (
      // focus-within sobe o painel: a lista de sugestões não fica atrás do painel de baixo
      <section aria-labelledby="registrar-titulo" className={`${PAINEL} focus-within:relative focus-within:z-10`}>
        <h2 id="registrar-titulo" className="font-display text-2xl font-semibold tracking-tight text-text">Registrar presença</h2>
        <div className="mt-6">
          {alerta && <Alert tipo={alerta.tipo} msg={alerta.msg} />}
          <SeletorTipo name="tipo" legenda="O que você vai fazer hoje?" value={tipo} onChange={setTipo} />
        </div>

        <div className="mt-6">
          <label htmlFor="pres-nome" className={campo}>Seu nome</label>
          {modoNovo ? (
            <>
              <input
                id="pres-nome"
                type="text"
                autoComplete="name"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Nome e sobrenome…"
                className={`w-full px-3.5 text-base outline-none ${POCO}`}
              />
              <button
                type="button"
                onClick={() => { setModoNovo(false); setNome(''); }}
                className="mt-0.5 py-1 text-[13px] text-muted hover:text-text underline-offset-4 hover:underline transition-colors"
              >
                Voltar pra lista de nomes
              </button>
            </>
          ) : (
            <>
              <Autocomplete
                id="pres-nome"
                value={nome}
                options={nomesPessoas}
                placeholder="Digite pra buscar…"
                icon={IconSearch}
                inputClassName={POCO}
                onChange={(v, escolhido) => { setNome(v); setNomeOk(escolhido); }}
              />
              <button
                type="button"
                onClick={() => { setModoNovo(true); setNome(''); setNomeOk(false); }}
                className="mt-0.5 py-1 text-[13px] text-muted transition-colors group"
              >
                Primeira vez aqui? <span className="text-text underline decoration-bordo decoration-2 underline-offset-4 group-hover:decoration-text">Cadastrar meu nome</span>
              </button>
            </>
          )}
        </div>

        {tipo === 'ps' && (
          <div className="mt-5">
            <label htmlFor="pres-dupla" className={campo}>
              Dupla <span className="font-normal text-muted">(opcional)</span>
            </label>
            <Autocomplete
              id="pres-dupla"
              value={dupla}
              options={nomesPessoas}
              placeholder="Digite pra buscar…"
              icon={IconSearch}
              inputClassName={duplaInvalida ? POCO.replace('!border-[#766669] ', '') : POCO}
              invalid={duplaInvalida}
              onChange={(v, escolhido) => {
                setDupla(v); setDuplaOk(escolhido); setDuplaInvalida(false);
              }}
            />
            {duplaInvalida && (
              <p className="mt-1.5 text-[13px] text-danger">
                Escolha a dupla clicando num nome da lista.
              </p>
            )}
          </div>
        )}

        <Button onClick={registrar} loading={registrando} className="mt-8 h-[52px] !py-0 !shadow-none normal-case !tracking-normal !text-base">
          {registrando ? 'Registrando…' : 'Confirmar presença'}
        </Button>
      </section>
      )}

      {/* ─── Editar presença ─── */}
      {editando && (
        <section aria-labelledby="editar-titulo" className={`${PAINEL} ring-2 ring-inset ring-bordo/60 focus-within:relative focus-within:z-10`}>
          <h2 id="editar-titulo" className="font-display text-xl font-semibold tracking-tight text-text">Editar presença</h2>
          <p className="text-[13px] text-muted mt-1">
            Editando: <strong className="text-text font-medium">{editando.nome}</strong>
          </p>
          <div className="mt-5">
            {editAlerta && <Alert tipo={editAlerta.tipo} msg={editAlerta.msg} />}
            <SeletorTipo name="editTipo" legenda="O que vai fazer" value={editTipo} onChange={setEditTipo} />
          </div>
          {editTipo === 'ps' && (
            <div className="mt-5">
              <label htmlFor="edit-dupla" className={campo}>
                Dupla <span className="font-normal text-muted">(deixe vazio pra remover)</span>
              </label>
              <Autocomplete
                id="edit-dupla"
                value={editDupla}
                options={nomesPessoas}
                placeholder="Digite pra buscar…"
                icon={IconSearch}
                inputClassName={POCO}
                onChange={(v) => setEditDupla(v)}
              />
            </div>
          )}
          <div className="flex gap-2 mt-7">
            <Button onClick={() => salvarEdicao()}>Salvar</Button>
            <Button variant="ghost" onClick={() => setEditando(null)}>Cancelar</Button>
          </div>
        </section>
      )}

      </div>

      {/* ─── Quem já chegou ─── (painel mais apagado que o do formulário: é secundário) */}
      <section aria-labelledby="presentes-titulo" className={`${PAINEL} !bg-surface/50`} style={{ animationDelay: '.08s' }}>
        <h2 id="presentes-titulo" className="font-display text-2xl font-semibold tracking-tight text-text">Quem já chegou</h2>

        {presentes === null && (
          <div className="mt-5 space-y-4" aria-hidden="true">
            {[55, 45, 60].map((w, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="skeleton w-8 h-8 rounded-full shrink-0" />
                <div className="skeleton h-3 rounded" style={{ width: w + '%' }} />
              </div>
            ))}
          </div>
        )}

        {presentes && presentes.length === 0 && (
          <p className="mt-5 text-[15px] text-muted">Ninguém registrou presença ainda. Seja o primeiro a confirmar.</p>
        )}

        {presentes && presentes.length > 0 && GRUPOS.map(([g, titulo]) => {
          const doGrupo = presentes.filter((p) => grupoDe(p) === g);
          if (doGrupo.length === 0) return null;
          return (
            <div key={g} className="mt-6">
              <h3 className="text-[13px] font-medium text-muted">
                {titulo} <span className="text-text tabular-nums">{doGrupo.length}</span>
              </h3>
              <ul className="mt-1 divide-y divide-white/[0.06]">
                {juntarDuplas(doGrupo).map((linha) => (
                  <li key={linha[0].presencaId} className="relative py-1.5 animate-fade-up">
                    {linha.length === 2 ? (
                      <>
                        <span className="sr-only">Dupla: </span>
                        {/* fio ligando os dois avatares da dupla */}
                        <span aria-hidden="true" className="absolute left-4 top-[28px] bottom-[28px] w-px bg-bordo/50" />
                        {linha.map((p) => linhaPessoa(p))}
                      </>
                    ) : linhaPessoa(linha[0], g === 'ps' ? (linha[0].dupla ? `Dupla: ${linha[0].dupla}` : 'Sem dupla') : null)}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </section>
    </div>
    </div>
  );
}
