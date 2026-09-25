'use client';
import { useState, useEffect } from 'react';
import Button from '@/components/ui/Button';
import Alert from '@/components/ui/Alert';
import Autocomplete from '@/components/ui/Autocomplete';
import Escolha from '@/components/ui/Escolha';
import NotaInput from '@/components/ui/NotaInput';
import { IconSearch } from '@/components/ui/Icons';
import {
  listarPessoas, acharOuCriarPessoa, adicionarSalaManual, registrarSpeaks, getSpeaksDoDia,
} from '@/lib/supabase';
import { POS_LETRA, POS_BANCADA } from '@/lib/draw';
import { POCO } from '@/lib/estilos';
import { toast } from '@/lib/toast';

const TODAS = ['OG', 'OO', 'CG', 'CO'];
const chaves = (posicoes) => posicoes.flatMap((p) => [p + '-1', p + '-2']);

function novoDados() {
  const o = {};
  chaves(TODAS).forEach((k) => { o[k] = { nome: '', novo: false, ok: false, speak: '' }; });
  return o;
}

export default function SpeaksManual() {
  const [pessoas, setPessoas] = useState([]);
  const [juiz, setJuiz] = useState('');
  const [modoNovoJuiz, setModoNovoJuiz] = useState(false);
  const [salaNum, setSalaNum] = useState(1);
  const [dados, setDados] = useState(novoDados);
  const [salvando, setSalvando] = useState(false);
  const [alerta, setAlerta] = useState(null);
  const [feitas, setFeitas] = useState(new Map()); // sala -> juiz
  const [erros, setErros] = useState({});            // { [key]: 'mensagem' }
  const [juizErro, setJuizErro] = useState(null);
  const [iron, setIron] = useState({ OG: false, OO: false, CG: false, CO: false });
  // Treino só de primeiras bancadas: a sala tem apenas OG e OO.
  const [soAbertura, setSoAbertura] = useState(false);
  const POSICOES = soAbertura ? ['OG', 'OO'] : TODAS;
  const KEYS = chaves(POSICOES);

  useEffect(() => {
    listarPessoas().then((p) => setPessoas(p || [])).catch(() => {});
    getSpeaksDoDia()
      .then((rows) => setFeitas(new Map((rows || []).map((r) => [r.sala, r.juiz]))))
      .catch(() => {});
  }, []);

  const nomesPessoas = pessoas.map((p) => p.nome);
  const upd = (k, patch) => {
    setDados((d) => ({ ...d, [k]: { ...d[k], ...patch } }));
    setErros((e) => { if (!e[k]) return e; const c = { ...e }; delete c[k]; return c; });
  };
  function toggleIron(pos) {
    setIron((cur) => ({ ...cur, [pos]: !cur[pos] }));
    // ao alternar, limpa o 2º slot (não é mais um debatedor independente, ou foi)
    setDados((d) => ({ ...d, [pos + '-2']: { nome: '', novo: false, ok: false, speak: d[pos + '-2'].speak } }));
    setErros((e) => {
      const c = { ...e }; delete c[pos + '-1']; delete c[pos + '-2']; return c;
    });
  }

  async function salvar() {
    const juizNome = juiz.trim();
    const novosErros = {};
    let jErr = null;
    if (!juizNome) jErr = 'Informe seu nome.';
    else if (modoNovoJuiz && juizNome.split(/\s+/).filter((x) => x.length >= 2).length < 2)
      jErr = 'Digite nome e sobrenome completos.';
    else if (!modoNovoJuiz && !pessoas.some((p) => p.nome === juizNome))
      jErr = 'Escolha seu nome na lista, ou use "Não está na lista? Cadastrar".';

    for (const k of KEYS) {
      const d = dados[k];
      const pos = k.split('-')[0];
      const isIronMirror = iron[pos] && k.endsWith('-2');
      // No iron, o 2º slot não tem nome próprio — só valida a nota.
      if (!isIronMirror) {
        if (!d.nome.trim()) { novosErros[k] = 'Preencha o nome.'; continue; }
        if (d.novo && d.nome.trim().split(/\s+/).filter((x) => x.length >= 2).length < 2) {
          novosErros[k] = 'Digite nome e sobrenome completos.'; continue;
        }
        if (!d.novo && !d.ok) {
          novosErros[k] = 'Escolha o nome na lista, ou use "Primeira vez? Cadastrar".'; continue;
        }
      }
      const v = Number(d.speak);
      if (d.speak === '' || isNaN(v) || v < 50 || v > 100) {
        novosErros[k] = 'Nota inválida (use 50 a 100).'; continue;
      }
    }

    setJuizErro(jErr);
    setErros(novosErros);

    if (jErr || Object.keys(novosErros).length) {
      setAlerta({ tipo: 'error', msg: 'Tem campo pra corrigir. Destaquei em vermelho abaixo.' });
      setTimeout(() => {
        const el = document.querySelector('[data-erro="true"]');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 60);
      return;
    }

    setSalvando(true);

    // 1) Resolve cada nome para um cadastro de pessoa.
    // No iron, o 2º slot espelha o 1º (mesma pessoa).
    const resolvido = {};
    for (const k of KEYS) {
      const pos = k.split('-')[0];
      if (iron[pos] && k.endsWith('-2')) {
        resolvido[k] = resolvido[pos + '-1'];
        continue;
      }
      const p = await acharOuCriarPessoa(dados[k].nome.trim());
      if (!p) { setSalvando(false); setAlerta({ tipo: 'error', msg: 'Erro ao resolver os nomes.' }); return; }
      resolvido[k] = p;
    }

    // 2) Detecta a mesma pessoa em duas posições — causa do erro "on conflict ... a second time".
    // O par interno de um iron é a mesma pessoa de propósito, então ignora.
    const visto = new Map(); // pessoa_id -> key
    for (const k of KEYS) {
      const pos = k.split('-')[0];
      if (iron[pos] && k.endsWith('-2')) continue;
      const pid = resolvido[k].id;
      if (visto.has(pid)) {
        const outra = visto.get(pid);
        const msg = `“${resolvido[k].nome}” aparece em duas posições. Corrija pra salvar.`;
        setErros((e) => ({ ...e, [k]: msg, [outra]: msg }));
        setAlerta({ tipo: 'error', msg });
        setSalvando(false);
        setTimeout(() => {
          const el = document.querySelector('[data-erro="true"]');
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 60);
        return;
      }
      visto.set(pid, k);
    }

    // 3) Refresca o estado "quem já registrou a sala" (fecha corrida com colegas).
    let feitasAtual = feitas;
    try {
      const rows = await getSpeaksDoDia();
      feitasAtual = new Map((rows || []).map((r) => [r.sala, r.juiz]));
      setFeitas(feitasAtual);
    } catch (e) {}
    if (feitasAtual.has(salaNum) && feitasAtual.get(salaNum) !== juizNome) {
      const jA = feitasAtual.get(salaNum);
      if (!window.confirm(
        `A Sala ${salaNum} já foi registrada${jA ? ' por ' + jA : ''}. Sobrescrever?`)) {
        setSalvando(false); return;
      }
    }

    if (modoNovoJuiz) await acharOuCriarPessoa(juizNome);

    const posicoes = POSICOES.map((pos) => ({
      posicao: pos,
      p1: resolvido[pos + '-1'].nome,
      p2: resolvido[pos + '-2'].nome,
      confirmado: true,
      ...(iron[pos] ? { iron: true } : {}),
    }));
    const salaObj = { numero: salaNum, incompleta: false, juizes: [juizNome], posicoes };
    // No iron, grava UMA linha por equipe com a maior das duas notas.
    const lista = [];
    for (const pos of POSICOES) {
      if (iron[pos]) {
        const s1 = Number(dados[pos + '-1'].speak);
        const s2 = Number(dados[pos + '-2'].speak);
        lista.push({
          pessoa_id: resolvido[pos + '-1'].id, sala: salaNum, posicao: pos,
          speaks: Math.max(s1, s2), juiz: juizNome,
        });
      } else {
        for (const slot of ['-1', '-2']) {
          const k = pos + slot;
          lista.push({
            pessoa_id: resolvido[k].id, sala: salaNum, posicao: pos,
            speaks: Number(dados[k].speak), juiz: juizNome,
          });
        }
      }
    }

    // 4) Grava notas PRIMEIRO. Se quebrar, o draw nem é mexido.
    const r2 = await registrarSpeaks({ lista });
    if (!r2.ok) {
      setSalvando(false);
      setAlerta({ tipo: 'error', msg: 'Erro ao registrar notas: ' + r2.erro });
      return;
    }
    const r1 = await adicionarSalaManual({ sala: salaObj });
    setSalvando(false);
    if (r1.ok) {
      toast('success', `Sala ${salaNum} registrada no draw e nos speaks!`);
      setAlerta(null);
      setFeitas(new Map([...feitasAtual, [salaNum, juizNome]]));
      setDados(novoDados());
      setIron({ OG: false, OO: false, CG: false, CO: false });
    } else {
      setAlerta({ tipo: 'error', msg: 'Notas salvas, mas erro ao publicar no draw: ' + r1.erro });
    }
  }

  // Link secundário (cadastrar / voltar pra lista): texto, não pílula.
  const linkSec = 'mt-1 py-1 text-[13px] text-muted hover:text-text underline-offset-4 hover:underline';

  // Campo de nome de um orador: da lista (autocomplete) ou digitado (primeira vez).
  function campoNome(k, rotulo) {
    const d = dados[k];
    return (
      <>
        {d.novo ? (
          <input id={`manual-${k}`} type="text" value={d.nome}
            onChange={(e) => upd(k, { nome: e.target.value })}
            placeholder="Nome e sobrenome…"
            className={`w-full px-3.5 text-base outline-none ${POCO}`} />
        ) : (
          <Autocomplete id={`manual-${k}`} value={d.nome} options={nomesPessoas}
            placeholder="Digite pra buscar…" icon={IconSearch} inputClassName={POCO}
            onChange={(v, esc) => upd(k, { nome: v, ok: esc })} />
        )}
        {(d.novo || (d.nome.trim() && !d.ok)) && (
          <button type="button" onClick={() => upd(k, { novo: !d.novo, nome: '', ok: false })} className={linkSec}>
            {d.novo ? 'Voltar pra lista de nomes' : 'Não está na lista? Cadastrar'}
          </button>
        )}
      </>
    );
  }

  function linhaDebatedor(k, rotulo) {
    const d = dados[k];
    const erro = erros[k];
    return (
      <div data-erro={erro ? 'true' : undefined} className="scroll-mt-24">
        <div className="flex justify-between gap-3 mb-1 text-[13px] text-muted">
          <label htmlFor={`manual-${k}`}>{rotulo}</label>
          <span aria-hidden="true" className="w-16 text-center">nota</span>
        </div>
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">{campoNome(k, rotulo)}</div>
          <NotaInput value={d.speak} rotulo={`Nota do ${rotulo.toLowerCase()}`} invalido={!!erro && d.speak === ''}
            erroId={`erro-${k}`} onChange={(v) => upd(k, { speak: v })} />
        </div>
        {erro && <p id={`erro-${k}`} className="text-[13px] text-danger mt-1">{erro}</p>}
      </div>
    );
  }

  function linhaIron(pos) {
    const k1 = pos + '-1', k2 = pos + '-2';
    const erro = erros[k1] || erros[k2];
    return (
      <div data-erro={erro ? 'true' : undefined} className="scroll-mt-24">
        <label htmlFor={`manual-${k1}`} className="block text-[13px] text-muted mb-1">Iron</label>
        {campoNome(k1, 'Iron')}
        <div className="mt-3 flex items-center gap-3">
          {[k1, k2].map((kk, i) => (
            <label key={kk} className="flex items-center gap-2 text-[13px] text-muted">
              <NotaInput value={dados[kk].speak} rotulo={`Nota da ${i === 0 ? '1ª' : '2ª'} fala do iron`} erroId={`erro-${k1}`}
                onChange={(v) => upd(kk, { speak: v })} />
              {i === 0 ? '1ª fala' : '2ª fala'}
            </label>
          ))}
        </div>
        <p className="text-[13px] text-muted mt-1.5">Só a maior das duas notas vai pro registro.</p>
        {erro && <p id={`erro-${k1}`} className="text-[13px] text-danger mt-1">{erro}</p>}
      </div>
    );
  }

  return (
    <section aria-label="Sala manual" className="rounded-xl2 bg-surface p-5 sm:p-7 animate-rise focus-within:relative focus-within:z-10">
      {alerta && <Alert tipo={alerta.tipo} msg={alerta.msg} />}
      <p className="text-[15px] text-muted">
        Pra treinos com salas já montadas. Preencha cada equipe; a sala entra no draw do dia.
        Marque &quot;Iron&quot; quando uma pessoa faz as duas falas da equipe.
      </p>

      <div className="mt-6">
        <Escolha legenda="Formato" name="manual-formato" value={soAbertura ? 'abertura' : 'completa'}
          onChange={(v) => setSoAbertura(v === 'abertura')}
          opcoes={[
            { valor: 'completa', rotulo: 'Sala completa', detalhe: 'OG, OO, CG e CO' },
            { valor: 'abertura', rotulo: 'Só primeiras bancadas', detalhe: 'OG e OO' },
          ]} />
      </div>

      {/* Juiz */}
      <div data-erro={juizErro ? 'true' : undefined} className="mt-6 scroll-mt-24 sm:max-w-md">
        <label htmlFor="manual-juiz" className="block text-[15px] font-medium text-text mb-2">Seu nome</label>
        {modoNovoJuiz ? (
          <>
            <input id="manual-juiz" type="text" value={juiz}
              onChange={(e) => { setJuiz(e.target.value); setJuizErro(null); }}
              placeholder="Nome e sobrenome…"
              className={`w-full px-3.5 text-base outline-none ${POCO}`} />
            <button type="button" onClick={() => { setModoNovoJuiz(false); setJuiz(''); setJuizErro(null); }} className={linkSec}>
              Voltar pra lista de nomes
            </button>
          </>
        ) : (
          <>
            <Autocomplete id="manual-juiz" value={juiz} options={nomesPessoas} placeholder="Digite pra buscar…"
              icon={IconSearch} inputClassName={POCO}
              onChange={(v) => { setJuiz(v); setJuizErro(null); }} />
            {juiz.trim() && !pessoas.some((p) => p.nome === juiz.trim()) && (
              <button type="button" onClick={() => { setModoNovoJuiz(true); setJuiz(''); setJuizErro(null); }} className={linkSec}>
                Não está na lista? Cadastrar
              </button>
            )}
          </>
        )}
        {juizErro && <p id="erro-juiz" className="text-[13px] text-danger mt-1">{juizErro}</p>}
      </div>

      <div className="mt-6">
        <Escolha legenda="Número da sala" name="manual-sala" value={String(salaNum)}
          onChange={(v) => setSalaNum(Number(v))} compacto
          opcoes={[1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({ valor: String(n), rotulo: String(n) }))} />
      </div>

      {/* Equipes na planta da sala (igual à aba Draw): Governo à esquerda, Oposição à
          direita, abertura na frente. No celular vira uma coluna na ordem OG, OO, CG, CO. */}
      <ul className="mt-6 grid gap-3 sm:grid-cols-2 sm:gap-x-6">
        <li aria-hidden="true" className="hidden sm:block text-[13px] text-muted -mb-1">Governo</li>
        <li aria-hidden="true" className="hidden sm:block text-[13px] text-muted text-right -mb-1">Oposição</li>
        {POSICOES.map((pos) => (
          <li key={pos} className={`rounded-xl px-3 py-3 bg-white/[0.03] ${POS_BANCADA[pos].replace(' text-right', '')}`}>
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-[15px] font-medium text-text">
                <span className={`font-bold ${POS_LETRA[pos]}`}>{pos}</span>
              </h3>
              <label className="flex items-center gap-2 text-[13px] text-muted cursor-pointer min-h-[44px]">
                <input type="checkbox" checked={iron[pos]} onChange={() => toggleIron(pos)} className="w-4 h-4 accent-[#f1ebe8]" />
                Iron
              </label>
            </div>
            <div className="mt-2 space-y-4">
              {iron[pos] ? linhaIron(pos) : (
                <>
                  {linhaDebatedor(pos + '-1', '1º orador')}
                  {linhaDebatedor(pos + '-2', '2º orador')}
                </>
              )}
            </div>
          </li>
        ))}
      </ul>

      <Button onClick={salvar} loading={salvando} className="mt-4 h-[52px] !py-0 !shadow-none normal-case !tracking-normal !text-base">
        {salvando ? 'Salvando…' : `Salvar Sala ${salaNum}`}
      </Button>
    </section>
  );
}
