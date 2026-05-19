'use client';
import { useState, useEffect } from 'react';
import Card, { SectionLabel } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Alert from '@/components/ui/Alert';
import Autocomplete from '@/components/ui/Autocomplete';
import { IconScale, IconCheck } from '@/components/ui/Icons';
import {
  getDrawHojePublico, listarPessoas, getSpeaksDoDia,
  registrarSpeaks, acharOuCriarPessoa, norm,
} from '@/lib/supabase';
import { POS_STYLE, semPar, ordenarPosicoes, panelSala } from '@/lib/draw';
import { toast } from '@/lib/toast';

function debatedoresDe(sala) {
  const out = [];
  ordenarPosicoes(sala.posicoes).forEach((pos) => {
    out.push({ key: pos.posicao + '-p1', posicao: pos.posicao, nome: pos.p1 });
    if (!semPar(pos.p2)) out.push({ key: pos.posicao + '-p2', posicao: pos.posicao, nome: pos.p2 });
  });
  return out;
}

export default function SpeaksDoDraw() {
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
    getDrawHojePublico().then((d) => setDraw(d || null)).catch(() => setDraw(null));
    listarPessoas().then((p) => setPessoas(p || [])).catch(() => {});
    getSpeaksDoDia()
      .then((rows) => setFeitas(new Map((rows || []).map((r) => [r.sala, r.juiz]))))
      .catch(() => {});
  }, []);

  const nomesPessoas = pessoas.map((p) => p.nome);
  const panel = sala ? panelSala(sala) : [];

  function selecionarSala(s) {
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
      setAlerta({ tipo: 'error', msg: 'Informe quem está submetendo (Chair).' }); return;
    }
    const debs = debatedoresDe(sala);
    for (const d of debs) {
      const v = Number(notas[d.key]);
      if (notas[d.key] === undefined || notas[d.key] === '' || isNaN(v) || v < 50 || v > 100) {
        setAlerta({ tipo: 'error', msg: `Nota inválida para ${d.nome} — use um número de 50 a 100.` });
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
      toast('success', `Speaks da Sala ${sala.numero} registrados!`);
      setAlerta(null);
      setFeitas(new Map([...feitas, [sala.numero, chairNome]]));
      setSala(null);
      setNotas({});
    } else {
      setAlerta({ tipo: 'error', msg: res.erro });
    }
  }

  if (draw === undefined) {
    return (
      <Card style={{ animationDelay: '.05s' }}>
        <SectionLabel icon={IconScale}>Sala do draw</SectionLabel>
        <div className="skeleton h-24 rounded-xl2" />
      </Card>
    );
  }
  if (draw === null) {
    return (
      <Card style={{ animationDelay: '.05s' }}>
        <SectionLabel icon={IconScale}>Sala do draw</SectionLabel>
        <div className="text-center py-8 text-muted">
          <div className="text-sm font-semibold">O draw de hoje ainda não foi publicado.</div>
          <div className="text-xs mt-1">
            Para treinos com salas já organizadas, use o modo &quot;Sala manual&quot; acima.
          </div>
        </div>
      </Card>
    );
  }

  const debs = sala ? debatedoresDe(sala) : [];
  const tagCls = (ativo) =>
    `px-3 py-1.5 rounded-full text-[12px] font-semibold border transition ` +
    (ativo
      ? 'bg-gradient-to-br from-bordo to-bordo-soft text-white border-bordo'
      : 'bg-surface-2 text-muted border-border hover:border-bordo/60');

  return (
    <Card style={{ animationDelay: '.05s' }}>
      <SectionLabel icon={IconScale}>Sala do draw</SectionLabel>
      {alerta && <Alert tipo={alerta.tipo} msg={alerta.msg} />}

      {/* Seleção de sala */}
      <div className="mb-4">
        <label className="block text-[10px] uppercase tracking-[0.15em] text-muted mb-2">
          Qual sala você julgou?
        </label>
        <div className="flex flex-wrap gap-2">
          {draw.salas.map((s) => {
            const ativa = sala && sala.numero === s.numero;
            const feita = feitas.has(s.numero);
            return (
              <button key={s.numero} type="button" onClick={() => selecionarSala(s)}
                className={`px-4 py-2.5 rounded-xl text-[12px] font-semibold border transition
                  ${ativa
                    ? 'bg-gradient-to-br from-bordo to-bordo-soft text-white border-bordo'
                    : 'bg-surface-2 text-muted border-border hover:border-bordo/60'}`}>
                Sala {s.numero}
                {feita && <span className="ml-1.5 text-[10px] text-success">registrada</span>}
              </button>
            );
          })}
        </div>
      </div>

      {sala && (
        <div className="animate-fade-up">
          {/* Chair */}
          <label className="block text-[10px] uppercase tracking-[0.15em] text-muted mb-2">
            Quem está submetendo? (Chair) *
          </label>
          <div className="flex flex-wrap gap-1.5">
            {panel.map((j) => (
              <button
                key={j}
                type="button"
                onClick={() => { setChair(j); setOutroAtivo(false); }}
                className={tagCls(!outroAtivo && chair === j)}
              >
                {j}
              </button>
            ))}
            <button
              type="button"
              onClick={() => { setOutroAtivo(true); setChair(''); }}
              className={tagCls(outroAtivo)}
            >
              + Outro
            </button>
          </div>
          {panel.length === 0 && (
            <p className="text-[11px] text-muted mt-1.5">
              Nenhum juiz foi alocado a esta sala no draw — informe o Chair abaixo.
            </p>
          )}
          {outroAtivo && (
            <div className="mt-2">
              <Autocomplete
                value={chair}
                options={nomesPessoas}
                placeholder="Digite o nome do Chair..."
                onChange={(v) => setChair(v)}
              />
            </div>
          )}

          {/* Notas */}
          <div className="text-[11px] text-muted mb-2 mt-4">
            Notas de 50 a 100 para cada debatedor da Sala {sala.numero}:
          </div>
          <div className="space-y-2 mb-4">
            {debs.map((d) => {
              const val = notas[d.key];
              const fora = val !== undefined && val !== '' &&
                (isNaN(Number(val)) || Number(val) < 50 || Number(val) > 100);
              return (
                <div key={d.key}
                  className="flex items-center gap-3 p-2.5 rounded-xl border border-border bg-surface-2">
                  <span className={`text-[10px] font-bold text-center py-1 px-2 rounded border
                    ${POS_STYLE[d.posicao] || 'bg-surface text-muted border-border'}`}>
                    {d.posicao}
                  </span>
                  <span className="flex-1 text-[13px] font-semibold">{d.nome}</span>
                  <div className="flex flex-col items-end gap-0.5">
                    <input
                      type="number" inputMode="numeric" min={50} max={100}
                      value={val ?? ''}
                      onChange={(e) => setNotas({ ...notas, [d.key]: e.target.value })}
                      placeholder="—"
                      className={`w-20 px-2 py-2 rounded-lg text-center text-base font-bold outline-none
                        bg-[#ece4df] text-[#1a1212] border focus:border-bordo
                        ${fora ? 'border-danger ring-2 ring-danger/40' : 'border-border'}`}
                    />
                    {fora && <span className="text-[9px] text-danger font-semibold">use 50–100</span>}
                  </div>
                </div>
              );
            })}
          </div>
          <Button onClick={salvar} loading={salvando}>
            <span className="inline-flex items-center justify-center gap-2">
              {!salvando && <IconCheck className="w-4 h-4" />}
              {salvando ? 'Salvando...' : `Salvar speaks da Sala ${sala.numero}`}
            </span>
          </Button>
        </div>
      )}
    </Card>
  );
}
