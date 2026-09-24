'use client';
import { useState, useEffect } from 'react';
import Button from '@/components/ui/Button';
import Alert from '@/components/ui/Alert';
import Autocomplete from '@/components/ui/Autocomplete';
import Escolha from '@/components/ui/Escolha';
import NotaInput, { foraDaFaixa } from '@/components/ui/NotaInput';
import { IconSearch } from '@/components/ui/Icons';
import {
  getDrawHojePublico, listarPessoas, getSpeaksDoDia,
  registrarSpeaks, acharOuCriarPessoa, norm,
} from '@/lib/supabase';
import { POS_LETRA, POS_BANCADA, PLANTA, semPar, ordenarPosicoes, panelSala, ondeEstou } from '@/lib/draw';
import { POCO } from '@/lib/estilos';
import { toast } from '@/lib/toast';

const OUTRO = '__outro';

function debatedoresDe(sala) {
  const out = [];
  ordenarPosicoes(sala.posicoes).forEach((pos) => {
    out.push({ key: pos.posicao + '-p1', posicao: pos.posicao, nome: pos.p1 });
    if (!semPar(pos.p2)) out.push({ key: pos.posicao + '-p2', posicao: pos.posicao, nome: pos.p2 });
  });
  return out;
}

// Notas de uma sala do draw (consenso dos 3 revisores): perguntas em frase normal,
// sala e chair como rádios, uma lista plana por equipe com o campo de nota escuro à
// direita, e uma linha de progresso logo acima do botão (ref.: faixa de dados da App Store).
export default function SpeaksDoDraw({ onManual }) {
  const [draw, setDraw] = useState(undefined);
  const [pessoas, setPessoas] = useState([]);
  const [sala, setSala] = useState(null);
  const [chair, setChair] = useState('');       // juiz que submete
  const [outroAtivo, setOutroAtivo] = useState(false);
  const [notas, setNotas] = useState({});
  const [salvando, setSalvando] = useState(false);
  const [alerta, setAlerta] = useState(null);
  const [feitas, setFeitas] = useState(new Map()); // sala -> juiz

  useEffect(() => {
    getDrawHojePublico().then((d) => {
      setDraw(d || null);
      // Quem já disse o nome na aba Draw ("Onde eu estou?") e julga uma sala hoje
      // chega aqui com a sala e o chair escolhidos.
      let eu = '';
      try { eu = localStorage.getItem('uspd_draw_eu') || ''; } catch (e) {}
      const r = d && ondeEstou(d, eu);
      if (r?.papel === 'juiz') { setSala(r.sala); setChair(panelSala(r.sala).find((j) => norm(j) === norm(eu)) || eu); }
    }).catch(() => setDraw(null));
    listarPessoas().then((p) => setPessoas(p || [])).catch(() => {});
    getSpeaksDoDia()
      .then((rows) => setFeitas(new Map((rows || []).map((r) => [r.sala, r.juiz]))))
      .catch(() => {});
  }, []);

  const nomesPessoas = pessoas.map((p) => p.nome);
  const panel = sala ? panelSala(sala) : [];

  function selecionarSala(numero) {
    const s = draw.salas.find((x) => String(x.numero) === String(numero));
    setSala(s);
    setNotas({});
    setAlerta(null);
    const pnl = panelSala(s);
    if (pnl.length === 1) { setChair(pnl[0]); setOutroAtivo(false); }
    else { setChair(''); setOutroAtivo(pnl.length === 0); }
  }

  async function salvar() {
    const chairNome = chair.trim();
    if (!chairNome) {
      setAlerta({ tipo: 'error', msg: 'Diga quem está enviando as notas (o chair da sala).' }); return;
    }
    const debs = debatedoresDe(sala);
    for (const d of debs) {
      const v = Number(notas[d.key]);
      if (notas[d.key] === undefined || notas[d.key] === '' || isNaN(v) || v < 50 || v > 100) {
        setAlerta({ tipo: 'error', msg: `Falta a nota de ${d.nome}. Use um número de 50 a 100.` });
        return;
      }
    }
    const idDe = new Map(pessoas.map((p) => [norm(p.nome), p.id]));
    const lista = [];
    for (const d of debs) {
      const pid = idDe.get(norm(d.nome));
      if (!pid) {
        setAlerta({ tipo: 'error', msg: `Não encontrei o cadastro de ${d.nome}.` }); return;
      }
      lista.push({
        pessoa_id: pid, sala: sala.numero, posicao: d.posicao,
        speaks: Number(notas[d.key]), juiz: chairNome,
      });
    }
    if (feitas.has(sala.numero)) {
      const jAnterior = feitas.get(sala.numero);
      if (!window.confirm(
        `A Sala ${sala.numero} já foi avaliada${jAnterior ? ' por ' + jAnterior : ''}. ` +
        'Sobrescrever as notas?')) return;
    }
    setSalvando(true);
    await acharOuCriarPessoa(chairNome); // registra o Chair se for novo
    const res = await registrarSpeaks({ lista });
    setSalvando(false);
    if (res.ok) {
      toast('success', `Notas da Sala ${sala.numero} salvas.`);
      setAlerta(null);
      setFeitas(new Map([...feitas, [sala.numero, chairNome]]));
      setSala(null);
      setNotas({});
    } else {
      setAlerta({ tipo: 'error', msg: res.erro });
    }
  }

  const PAINEL = 'rounded-xl2 bg-surface p-5 sm:p-7 animate-rise';

  if (draw === undefined) {
    return <div className="skeleton h-48 rounded-xl2" aria-hidden="true" />;
  }
  if (draw === null) {
    return (
      <div className={PAINEL}>
        <p className="text-[15px] text-text">O draw de hoje ainda não saiu.</p>
        <p className="text-[13px] text-muted mt-1">
          Julgou uma sala mesmo assim?{' '}
          <button type="button" onClick={onManual}
            className="text-text underline decoration-bordo decoration-2 underline-offset-4 hover:decoration-text">
            Registrar sala manual
          </button>
        </p>
      </div>
    );
  }

  const debs = sala ? debatedoresDe(sala) : [];
  const preenchidas = debs.filter((d) => notas[d.key] !== undefined && notas[d.key] !== '' && !foraDaFaixa(notas[d.key])).length;

  return (
    <section aria-label="Notas de uma sala do draw" className={`${PAINEL} focus-within:relative focus-within:z-10`}>
      {alerta && <Alert tipo={alerta.tipo} msg={alerta.msg} />}

      <Escolha
        legenda="Qual sala você julgou?"
        name="speaks-sala"
        value={sala ? String(sala.numero) : ''}
        onChange={selecionarSala}
        opcoes={draw.salas.map((s) => ({
          valor: String(s.numero),
          rotulo: `Sala ${s.numero}`,
          detalhe: feitas.has(s.numero) ? 'já tem notas' : undefined,
        }))}
      />

      {sala && (
        <div className="animate-fade-up">
          <div className="mt-7">
            <Escolha
              legenda="Quem está enviando as notas?"
              ajuda="O chair da sala."
              name="speaks-chair"
              value={outroAtivo ? OUTRO : chair}
              onChange={(v) => {
                if (v === OUTRO) { setOutroAtivo(true); setChair(''); }
                else { setOutroAtivo(false); setChair(v); }
              }}
              opcoes={[...panel.map((j) => ({ valor: j, rotulo: j })), { valor: OUTRO, rotulo: 'Outra pessoa' }]}
            />
            {panel.length === 0 && (
              <p className="text-[13px] text-muted mt-2">Nenhum juiz foi alocado a esta sala no draw.</p>
            )}
            {outroAtivo && (
              <div className="mt-3 sm:max-w-md">
                <label htmlFor="speaks-outro" className="block text-[15px] font-medium text-text mb-2">Nome do chair</label>
                <Autocomplete id="speaks-outro" value={chair} options={nomesPessoas} placeholder="Digite pra buscar…"
                  icon={IconSearch} inputClassName={POCO} onChange={(v) => setChair(v)} />
              </div>
            )}
          </div>

          <div className="mt-7">
            <h3 className="text-[15px] font-medium text-text">Notas da Sala {sala.numero}</h3>
            <p className="text-[13px] text-muted mt-0.5">De 50 a 100 pra cada debatedor.</p>
            {/* Planta da sala, igual à aba Draw: Governo à esquerda, Oposição à direita,
                abertura na frente. O campo de nota fica do lado do corredor (espelhado). */}
            <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 sm:gap-x-6">
              <p className="text-[13px] text-muted">Governo</p>
              <p className="text-[13px] text-muted text-right">Oposição</p>
              {PLANTA.map((pos) => {
                const ds = debs.filter((d) => d.posicao === pos);
                const opo = pos === 'OO' || pos === 'CO';
                return (
                  <div key={pos} className={`rounded-xl px-3 py-2.5 bg-white/[0.03] ${POS_BANCADA[pos]}`}>
                    <p className={`text-[13px] font-bold tracking-wide ${POS_LETRA[pos]}`}>{pos}</p>
                    {ds.length === 0 && <p className="mt-0.5 text-[13px] text-muted">vazia</p>}
                    <div className="mt-1 space-y-3">
                      {ds.map((d) => (
                        <div key={d.key}>
                          <div className={`flex flex-col gap-1.5 sm:items-center sm:gap-3 ${opo ? 'sm:flex-row-reverse' : 'sm:flex-row'}`}>
                            <label htmlFor={`nota-${d.key}`} className="min-w-0 sm:flex-1 text-[13px] sm:text-[15px] leading-snug text-text break-words">
                              {d.nome}
                            </label>
                            <div className={opo ? 'self-start sm:self-auto' : 'self-end sm:self-auto'}>
                              <NotaInput id={`nota-${d.key}`} value={notas[d.key]} rotulo={`Nota de ${d.nome}`} erroId={`erro-${d.key}`}
                                onChange={(v) => setNotas({ ...notas, [d.key]: v })} />
                            </div>
                          </div>
                          {foraDaFaixa(notas[d.key]) && (
                            <p id={`erro-${d.key}`} className={`text-[13px] text-danger mt-1 ${opo ? 'text-left' : 'text-right'}`}>Use de 50 a 100.</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Progresso logo acima do botão: o juiz confere antes de salvar */}
          <p className="mt-6 text-[13px] text-muted" aria-live="polite">
            Chair: <span className="text-text">{chair.trim() || 'falta escolher'}</span> ·{' '}
            <span className={preenchidas === debs.length ? 'text-text' : ''}>{preenchidas} de {debs.length} notas</span>
          </p>
          <Button onClick={salvar} loading={salvando} className="mt-3 h-[52px] !py-0 !shadow-none normal-case !tracking-normal !text-base">
            {salvando ? 'Salvando…' : `Salvar notas da Sala ${sala.numero}`}
          </Button>
        </div>
      )}
    </section>
  );
}
