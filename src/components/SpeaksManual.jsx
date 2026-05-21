'use client';
import { useState, useEffect } from 'react';
import Card, { SectionLabel } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Alert from '@/components/ui/Alert';
import Autocomplete from '@/components/ui/Autocomplete';
import { IconScale, IconCheck } from '@/components/ui/Icons';
import {
  listarPessoas, acharOuCriarPessoa, adicionarSalaManual, registrarSpeaks, getSpeaksDoDia,
} from '@/lib/supabase';
import { POS_STYLE } from '@/lib/draw';
import { toast } from '@/lib/toast';

const POSICOES = ['OG', 'OO', 'CG', 'CO'];
const KEYS = POSICOES.flatMap((p) => [p + '-1', p + '-2']);

function novoDados() {
  const o = {};
  KEYS.forEach((k) => { o[k] = { nome: '', novo: false, ok: false, speak: '' }; });
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
      jErr = 'Selecione um nome da lista — ou clique em "Não estou na lista".';

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
          novosErros[k] = 'Selecione um nome da lista — ou clique em "primeira vez".'; continue;
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
      setAlerta({ tipo: 'error', msg: 'Tem campo pra corrigir — destaquei em vermelho abaixo.' });
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
        const msg = `"${resolvido[k].nome}" aparece em duas posições — corrija para salvar.`;
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

  function linhaDebatedor(k, rotulo) {
    const d = dados[k];
    const erro = erros[k];
    const fora = d.speak !== '' &&
      (isNaN(Number(d.speak)) || Number(d.speak) < 50 || Number(d.speak) > 100);
    return (
      <div
        data-erro={erro ? 'true' : undefined}
        className={`rounded-lg p-2 transition border-2 scroll-mt-24 ${erro
          ? 'border-danger ring-2 ring-[#e0625a66] bg-[#e0625a1a]'
          : 'border-transparent'}`}
      >
        <div className="flex items-start gap-2">
          <div className="flex-1">
            {d.novo ? (
              <input
                type="text"
                value={d.nome}
                onChange={(e) => upd(k, { nome: e.target.value })}
                placeholder={`${rotulo} — nome e sobrenome`}
                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none focus:border-bordo"
              />
            ) : (
              <Autocomplete
                value={d.nome}
                options={nomesPessoas}
                placeholder={`${rotulo} — selecione o nome`}
                onChange={(v, esc) => upd(k, { nome: v, ok: esc })}
              />
            )}
            <button
              type="button"
              onClick={() => upd(k, { novo: !d.novo, nome: '', ok: false })}
              className={`mt-1.5 text-[10px] font-semibold rounded-full px-2.5 py-1 border transition
                ${d.novo
                  ? 'text-muted border-border hover:border-bordo/60 hover:text-bordo'
                  : 'text-bordo border-bordo/40 bg-bordo/5 hover:bg-bordo/15'}`}
            >
              {d.novo ? '← Escolher da lista' : '+ Primeira vez (cadastrar)'}
            </button>
          </div>
          <div className="flex flex-col items-end gap-0.5">
            <input
              type="number" inputMode="numeric" min={50} max={100}
              value={d.speak}
              onChange={(e) => upd(k, { speak: e.target.value })}
              placeholder="—"
              className={`w-16 px-1 py-2.5 rounded-lg text-center text-base font-bold outline-none
                bg-[#ece4df] text-[#1a1212] border focus:border-bordo
                ${fora ? 'border-danger ring-2 ring-[#e0625a66]' : 'border-border'}`}
            />
            {fora && <span className="text-[9px] text-danger font-semibold">50–100</span>}
          </div>
        </div>
        {erro && (
          <p className="text-[11px] text-danger font-semibold mt-1.5">{erro}</p>
        )}
      </div>
    );
  }

  function linhaIron(pos) {
    const k1 = pos + '-1', k2 = pos + '-2';
    const d = dados[k1];
    const erro1 = erros[k1], erro2 = erros[k2];
    const erro = erro1 || erro2;
    const foraDe = (v) => v !== '' && (isNaN(Number(v)) || Number(v) < 50 || Number(v) > 100);
    return (
      <div
        data-erro={erro ? 'true' : undefined}
        className={`rounded-lg p-2 transition border-2 scroll-mt-24 ${erro
          ? 'border-danger ring-2 ring-[#e0625a66] bg-[#e0625a1a]'
          : 'border-transparent'}`}
      >
        <div className="text-[10px] text-gold uppercase tracking-wider mb-1.5 font-semibold">
          IRON — mesmo debatedor faz as duas falas
        </div>
        <div className="space-y-2">
          {d.novo ? (
            <input type="text" value={d.nome}
              onChange={(e) => upd(k1, { nome: e.target.value })}
              placeholder="Nome e sobrenome do iron"
              className="w-full px-3 py-2.5 rounded-lg text-sm outline-none focus:border-bordo" />
          ) : (
            <Autocomplete value={d.nome} options={nomesPessoas}
              placeholder="Selecione o iron..."
              onChange={(v, esc) => upd(k1, { nome: v, ok: esc })} />
          )}
          <button type="button"
            onClick={() => upd(k1, { novo: !d.novo, nome: '', ok: false })}
            className={`text-[10px] font-semibold rounded-full px-2.5 py-1 border transition
              ${d.novo
                ? 'text-muted border-border hover:border-bordo/60 hover:text-bordo'
                : 'text-bordo border-bordo/40 bg-bordo/5 hover:bg-bordo/15'}`}>
            {d.novo ? '← Escolher da lista' : '+ Primeira vez (cadastrar)'}
          </button>
          <div className="grid grid-cols-2 gap-2 pt-1">
            {[k1, k2].map((kk, i) => {
              const v = dados[kk].speak;
              const fora = foraDe(v);
              return (
                <div key={kk} className="flex flex-col items-center gap-1">
                  <input type="number" inputMode="numeric" min={50} max={100}
                    value={v}
                    onChange={(e) => upd(kk, { speak: e.target.value })}
                    placeholder="—"
                    className={`w-full px-1 py-2.5 rounded-lg text-center text-base font-bold outline-none
                      bg-[#ece4df] text-[#1a1212] border focus:border-bordo
                      ${fora ? 'border-danger ring-2 ring-[#e0625a66]' : 'border-border'}`} />
                  <span className="text-[10px] text-muted">{i === 0 ? '1ª fala' : '2ª fala'}</span>
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-muted">Só a maior das duas notas vai para o registro.</p>
        </div>
        {erro && <p className="text-[11px] text-danger font-semibold mt-1.5">{erro}</p>}
      </div>
    );
  }

  return (
    <Card style={{ animationDelay: '.05s' }}>
      <SectionLabel icon={IconScale}>Sala manual (treino organizado)</SectionLabel>
      {alerta && <Alert tipo={alerta.tipo} msg={alerta.msg} />}
      <p className="text-[11px] text-muted mb-3">
        Para treinos com salas já montadas. Preencha cada posição; a sala entra no draw do dia.
      </p>

      {/* Juiz */}
      <div
        data-erro={juizErro ? 'true' : undefined}
        className={`mb-4 rounded-lg p-2 transition border-2 scroll-mt-24 ${juizErro
          ? 'border-danger ring-2 ring-[#e0625a66] bg-[#e0625a1a]'
          : 'border-transparent'}`}
      >
        <label className="block text-[10px] uppercase tracking-[0.15em] text-muted mb-2">
          Seu nome (juiz da sala) *
        </label>
        {modoNovoJuiz ? (
          <>
            <input
              type="text" value={juiz}
              onChange={(e) => { setJuiz(e.target.value); setJuizErro(null); }}
              placeholder="Digite seu nome e sobrenome completos..."
              className="w-full px-3.5 py-3 rounded-lg text-base outline-none focus:border-bordo"
            />
            <button type="button"
              onClick={() => { setModoNovoJuiz(false); setJuiz(''); setJuizErro(null); }}
              className="mt-1.5 text-[11px] font-semibold rounded-full px-2.5 py-1 border
                text-muted border-border hover:border-bordo/60 hover:text-bordo transition">
              ← Escolher da lista
            </button>
          </>
        ) : (
          <>
            <Autocomplete value={juiz} options={nomesPessoas}
              placeholder="Digite e selecione seu nome..."
              onChange={(v) => { setJuiz(v); setJuizErro(null); }} />
            <button type="button"
              onClick={() => { setModoNovoJuiz(true); setJuiz(''); setJuizErro(null); }}
              className="mt-1.5 text-[11px] font-semibold rounded-full px-2.5 py-1 border
                text-bordo border-bordo/40 bg-bordo/5 hover:bg-bordo/15 transition">
              + Não estou na lista (cadastrar)
            </button>
          </>
        )}
        {juizErro && (
          <p className="text-[11px] text-danger font-semibold mt-1.5">{juizErro}</p>
        )}
      </div>

      {/* Número da sala */}
      <div className="mb-4">
        <label className="block text-[10px] uppercase tracking-[0.15em] text-muted mb-2">
          Número da sala
        </label>
        <div className="flex flex-wrap gap-1.5">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
            <button key={n} type="button" onClick={() => setSalaNum(n)}
              className={`w-10 py-2 rounded-lg text-[13px] font-semibold border transition
                ${salaNum === n
                  ? 'bg-gradient-to-br from-bordo to-bordo-soft text-white border-bordo'
                  : 'bg-surface-2 text-muted border-border hover:border-bordo/60'}`}>
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* 4 equipes */}
      <div className="space-y-3 mb-4">
        {POSICOES.map((pos) => (
          <div key={pos} className="border border-border rounded-xl2 bg-surface-2">
            <div className="px-4 py-2 bg-[#120c0e] rounded-t-xl2 flex items-center gap-2 justify-between">
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-bold py-1 px-2 rounded border
                  ${POS_STYLE[pos]}`}>{pos}</span>
                <span className="text-[11px] uppercase tracking-wider text-muted">Equipe</span>
              </div>
              <label className={`flex items-center gap-1.5 text-[10px] font-semibold uppercase
                tracking-wider cursor-pointer transition ${iron[pos] ? 'text-gold' : 'text-muted hover:text-text'}`}>
                <input type="checkbox" checked={iron[pos]} onChange={() => toggleIron(pos)}
                  className="accent-gold w-3.5 h-3.5" />
                IRON
              </label>
            </div>
            <div className="p-3 space-y-3">
              {iron[pos] ? linhaIron(pos) : (
                <>
                  {linhaDebatedor(pos + '-1', '1º orador')}
                  {linhaDebatedor(pos + '-2', '2º orador')}
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      <Button onClick={salvar} loading={salvando}>
        <span className="inline-flex items-center justify-center gap-2">
          {!salvando && <IconCheck className="w-4 h-4" />}
          {salvando ? 'Salvando...' : `Salvar Sala ${salaNum}`}
        </span>
      </Button>
    </Card>
  );
}
