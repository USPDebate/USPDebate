'use client';
import { useState, useEffect } from 'react';
import Card, { SectionLabel } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Alert from '@/components/ui/Alert';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { IconUsers, IconClock, IconChart, IconTrash, IconPlus } from '@/components/ui/Icons';
import {
  getTrainees, getTraineeSemanas, getTraineeFormacoes, getPresencasRaw, getSpeaks,
  getDatasPresenca, importarTrainees, resetarTrainees, criarSemana, editarSemana, apagarSemana,
  toggleFormacao, marcarPresenca,
} from '@/lib/supabase';
import { calibrar, ranking } from '@/lib/speaks-stats';
import { toast } from '@/lib/toast';

// Cada linha vira um trainee. Coluna 2 (se houver) = mentor.
function parseCSV(texto) {
  const linhas = texto.split('\n').map((l) => l.trim()).filter(Boolean);
  const out = linhas.map((l) => {
    const p = l.split(/[,;\t]/).map((s) => s.trim());
    return { nome: p[0], mentor: p[1] || '' };
  }).filter((t) => t.nome && t.nome.length >= 2);
  if (out.length && out[0].nome.toLowerCase() === 'nome') out.shift();
  return out;
}

function fmtCurto(iso) {
  if (!iso) return '';
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

function isoDe(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

// Segunda a domingo da semana que contém a data ISO.
function semanaDe(iso) {
  const d = new Date(iso + 'T00:00:00');
  const dow = (d.getDay() + 6) % 7; // 0 = segunda
  const ini = new Date(d); ini.setDate(d.getDate() - dow);
  const fim = new Date(ini); fim.setDate(ini.getDate() + 6);
  return { inicio: isoDe(ini), fim: isoDe(fim) };
}

function fmtBR(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

// 'dd/mm/aaaa' → 'aaaa-mm-dd', ou null se inválida.
function parseBR(str) {
  const m = (str || '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const d = +m[1], mo = +m[2], y = +m[3];
  const iso = `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const dt = new Date(iso + 'T00:00:00');
  if (dt.getMonth() + 1 !== mo || dt.getDate() !== d) return null;
  return iso;
}

// Campo de data em formato brasileiro (dd/mm/aaaa). Confirma no blur.
function DataBR({ value, onCommit }) {
  const [txt, setTxt] = useState(fmtBR(value));
  useEffect(() => { setTxt(fmtBR(value)); }, [value]);
  return (
    <input
      type="text" inputMode="numeric" placeholder="dd/mm/aaaa" maxLength={10}
      value={txt}
      onChange={(e) => setTxt(e.target.value)}
      onBlur={() => {
        const iso = parseBR(txt);
        if (iso) onCommit(iso); else setTxt(fmtBR(value));
      }}
      className="bg-surface border border-border rounded px-2 py-1 text-[12px]
        text-text outline-none focus:border-bordo w-[92px] text-center"
    />
  );
}

export default function TraineesArea({ senha }) {
  const [trainees, setTrainees] = useState([]);
  const [semanas, setSemanas] = useState([]);
  const [formacoes, setFormacoes] = useState(new Set()); // 'pessoaId-semanaId'
  const [presencas, setPresencas] = useState([]);
  const [datasPresenca, setDatasPresenca] = useState([]);
  const [statsMap, setStatsMap] = useState(new Map());
  const [carregando, setCarregando] = useState(true);

  const [csv, setCsv] = useState('');
  const [alerta, setAlerta] = useState(null);
  const [modalReset, setModalReset] = useState(false);

  function recarregar() {
    Promise.all([
      getTrainees(), getTraineeSemanas(), getTraineeFormacoes(),
      getPresencasRaw(), getSpeaks(), getDatasPresenca(),
    ]).then(([tr, sem, form, pres, speaks, datas]) => {
      setTrainees(tr || []);
      setSemanas(sem || []);
      setFormacoes(new Set((form || []).map((f) => f.pessoa_id + '-' + f.semana_id)));
      setPresencas(pres || []);
      setDatasPresenca(datas || []);
      const rank = ranking(calibrar(speaks || []));
      setStatsMap(new Map(rank.map((r) => [r.pessoaId, r])));
      setCarregando(false);
    }).catch(() => setCarregando(false));
  }
  useEffect(() => { recarregar(); }, []);

  async function importar() {
    const lista = parseCSV(csv);
    if (!lista.length) { setAlerta({ tipo: 'error', msg: 'Cole pelo menos um nome.' }); return; }
    const res = await importarTrainees(lista);
    if (res.ok) { toast('success', `${res.n} trainee(s) importado(s).`); setCsv(''); setAlerta(null); recarregar(); }
    else setAlerta({ tipo: 'error', msg: res.erro });
  }
  async function confirmarReset() {
    setModalReset(false);
    const res = await resetarTrainees();
    if (res.ok) { toast('success', 'Trainees resetados.'); recarregar(); }
    else setAlerta({ tipo: 'error', msg: res.erro });
  }
  async function addSemana(w) {
    const res = await criarSemana({ inicio: w.inicio, fim: w.fim });
    if (res.ok) recarregar(); else setAlerta({ tipo: 'error', msg: res.erro });
  }
  async function editarData(sem, campo, valor) {
    if (!valor) return;
    const novo = { ...sem, [campo]: valor };
    if (novo.data_fim < novo.data_inicio) {
      toast('error', 'A data final deve ser igual ou posterior à inicial.');
      return;
    }
    setSemanas((cur) => cur.map((s) => (s.id === sem.id ? novo : s)));
    const res = await editarSemana({ id: sem.id, inicio: novo.data_inicio, fim: novo.data_fim });
    if (res.ok) recarregar();
    else {
      setSemanas((cur) => cur.map((s) => (s.id === sem.id ? sem : s)));
      toast('error', res.erro || 'Não foi possível salvar a semana.');
    }
  }
  async function removerSemana(id) {
    if (!window.confirm('Apagar esta semana? As formações marcadas nela serão perdidas.')) return;
    const res = await apagarSemana(id);
    if (res.ok) recarregar(); else setAlerta({ tipo: 'error', msg: res.erro });
  }
  async function toggle(pessoaId, semanaId) {
    const chave = pessoaId + '-' + semanaId;
    const feito = !formacoes.has(chave);
    const novo = new Set(formacoes);
    if (feito) novo.add(chave); else novo.delete(chave);
    setFormacoes(novo);
    await toggleFormacao({ pessoaId, semanaId, feito });
  }

  async function togglePresenca(pessoaId, sem) {
    const presente = !presenteNa(pessoaId, sem);
    const anterior = presencas;
    let data;
    if (presente) {
      data = datasPresenca.find((d) => d >= sem.data_inicio && d <= sem.data_fim)
        || sem.data_inicio;
      setPresencas((cur) => [...cur, { pessoa_id: pessoaId, data }]);
    } else {
      const reg = presencas.find((p) => p.pessoa_id === pessoaId
        && p.data >= sem.data_inicio && p.data <= sem.data_fim);
      data = reg ? reg.data : sem.data_inicio;
      setPresencas((cur) => cur.filter(
        (p) => !(p.pessoa_id === pessoaId && p.data === data)));
    }
    const res = await marcarPresenca({ pessoaId, data, presente, senha });
    if (!res.ok) {
      setPresencas(anterior);
      toast('error', res.erro || 'Não foi possível salvar a presença.');
    }
  }

  function presenteNa(pessoaId, sem) {
    return presencas.some((p) => p.pessoa_id === pessoaId
      && p.data >= sem.data_inicio && p.data <= sem.data_fim);
  }
  function metricasDe(pid) {
    const treinos = semanas.filter((s) => presenteNa(pid, s)).length;
    const forms = semanas.filter((s) => formacoes.has(pid + '-' + s.id)).length;
    const st = statsMap.get(pid) || { rodadas: 0, mediaCrua: 0, nivel: null };
    return { treinos, forms, rodadas: st.rodadas, media: st.mediaCrua, nivel: st.nivel };
  }

  // semanas (seg–dom) que já têm treino registrado e ainda não foram criadas
  const semanasCriadas = new Set(semanas.map((s) => s.data_inicio));
  const semanasDisponiveis = [];
  const vistas = new Set();
  datasPresenca.forEach((d) => {
    const w = semanaDe(d);
    if (vistas.has(w.inicio)) return;
    vistas.add(w.inicio);
    if (!semanasCriadas.has(w.inicio)) semanasDisponiveis.push(w);
  });

  // agrupa por mentor
  const grupos = {};
  trainees.forEach((t) => {
    const m = t.mentor && t.mentor.trim() ? t.mentor.trim() : 'Sem mentor';
    (grupos[m] = grupos[m] || []).push(t);
  });

  const thMetric = 'px-2 text-right whitespace-nowrap';
  const tdMetric = 'px-2 py-1 text-right whitespace-nowrap text-[12px]';

  return (
    <div className="space-y-3">
      {alerta && <Alert tipo={alerta.tipo} msg={alerta.msg} />}

      {/* Importar trainees */}
      <Card style={{ animationDelay: '.05s' }}>
        <SectionLabel icon={IconUsers}>Importar trainees</SectionLabel>
        <p className="text-xs text-muted mb-2">
          Cole a lista — um trainee por linha. Para incluir o mentor, use vírgula:
          <span className="text-text"> Nome Sobrenome, Mentor</span>.
        </p>
        <textarea
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          rows={5}
          placeholder={'João Pedro Silva, Ana Mentora\nMaria Souza, Ana Mentora\nCarlos Lima'}
          className="w-full px-3 py-2.5 rounded-lg text-sm bg-surface-2 border border-border
            text-text outline-none focus:border-bordo resize-y mb-2"
        />
        <Button onClick={importar}>
          <span className="inline-flex items-center gap-2 justify-center">
            <IconPlus className="w-4 h-4" />Importar trainees
          </span>
        </Button>

        <div className="mt-4 pt-3 border-t border-border flex items-center justify-between gap-3">
          <span className="text-[11px] text-muted">Ação destrutiva — apaga tudo da temporada.</span>
          <button
            onClick={() => setModalReset(true)}
            className="text-[11px] text-danger border border-danger/40 rounded-lg px-3 py-1.5
              hover:bg-danger/10 transition whitespace-nowrap"
          >
            Resetar trainees
          </button>
        </div>
      </Card>

      {/* Semanas */}
      <Card style={{ animationDelay: '.09s' }}>
        <SectionLabel icon={IconClock}>Semanas do acompanhamento</SectionLabel>
        <p className="text-xs text-muted mb-3">
          Uma <span className="text-text">semana</span> é um período de segunda a domingo —
          uma só por semana do calendário. Ela agrupa o treino e as tarefas daquele período:
          a presença em qualquer treino da semana entra na coluna correspondente. A numeração
          (Semana 1, 2, 3…) é automática pela ordem.
        </p>
        {semanas.length > 0 && (
          <div className="space-y-1.5 mb-3">
            {semanas.map((s, i) => (
              <div key={s.id}
                className="flex items-center gap-2 bg-surface-2 border border-border rounded-lg px-3 py-2">
                <span className="text-[13px] font-semibold whitespace-nowrap">Semana {i + 1}</span>
                <div className="flex-1 flex items-center gap-1.5 flex-wrap justify-end">
                  <DataBR value={s.data_inicio}
                    onCommit={(iso) => editarData(s, 'data_inicio', iso)} />
                  <span className="text-[11px] text-muted">a</span>
                  <DataBR value={s.data_fim}
                    onCommit={(iso) => editarData(s, 'data_fim', iso)} />
                </div>
                <button onClick={() => removerSemana(s.id)} className="text-danger p-1">
                  <IconTrash className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="text-[10px] uppercase tracking-[0.15em] text-muted mb-1.5">
          Adicionar semana — escolha uma semana com treino registrado
        </div>
        {semanasDisponiveis.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {semanasDisponiveis.map((w) => (
              <button key={w.inicio} onClick={() => addSemana(w)}
                className="text-[12px] border border-border rounded-lg px-3 py-2 text-muted
                  hover:border-bordo hover:text-bordo transition">
                + Semana de {fmtCurto(w.inicio)} a {fmtCurto(w.fim)}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-muted">
            {datasPresenca.length === 0
              ? 'Registre presença em treinos para poder criar semanas.'
              : 'Todas as semanas com treino já foram criadas.'}
          </p>
        )}
      </Card>

      {/* Grade de acompanhamento */}
      <Card style={{ animationDelay: '.13s' }}>
        <SectionLabel icon={IconChart}>Acompanhamento</SectionLabel>
        {carregando && <div className="skeleton h-24 rounded-xl2" />}
        {!carregando && trainees.length === 0 && (
          <p className="text-sm text-muted py-2">Nenhum trainee importado ainda.</p>
        )}
        {!carregando && trainees.length > 0 && (
          <>
            <p className="text-[11px] text-muted mb-3">
              <strong className="text-success">P</strong> = presença no treino — vem automática,
              toque para corrigir ·{' '}
              <strong className="text-gold">F</strong> = formação feita — toque para marcar.
            </p>
            <div className="space-y-5">
              {Object.entries(grupos).map(([mentor, lista]) => (
                <div key={mentor}>
                  <div className="text-[11px] uppercase tracking-wider text-gold mb-2">
                    Mentor: {mentor}
                  </div>
                  <div className="overflow-x-auto">
                    <table className="text-[12px] border-separate" style={{ borderSpacing: '0 6px' }}>
                      <thead>
                        <tr className="text-[9px] uppercase tracking-wider text-muted">
                          <th className="text-left px-2 sticky left-0 bg-surface">Trainee</th>
                          {semanas.map((s, i) => (
                            <th key={s.id} className="px-2 text-center">
                              <div>Sem {i + 1}</div>
                              <div className="text-muted/60 normal-case">{fmtCurto(s.data_inicio)}</div>
                            </th>
                          ))}
                          <th className={thMetric}>Treinos</th>
                          <th className={thMetric}>Formações</th>
                          <th className={thMetric}>Rodadas</th>
                          <th className={thMetric}>Média</th>
                          <th className={thMetric}>Nível</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lista.map((t) => {
                          const m = metricasDe(t.pessoaId);
                          return (
                            <tr key={t.pessoaId}>
                              <td className="px-2 py-1 font-semibold sticky left-0 bg-surface
                                max-w-[110px] sm:max-w-none truncate" title={t.nome}>{t.nome}</td>
                              {semanas.map((s) => {
                                const pres = presenteNa(t.pessoaId, s);
                                const feito = formacoes.has(t.pessoaId + '-' + s.id);
                                return (
                                  <td key={s.id} className="px-2 py-1">
                                    <div className="flex gap-2 justify-center">
                                      <button title="Presença no treino — toque para corrigir"
                                        onClick={() => togglePresenca(t.pessoaId, s)}
                                        className={`w-10 h-10 rounded-lg grid place-items-center text-[12px]
                                          font-bold border transition ${pres
                                            ? 'bg-success/25 text-success border-success/50'
                                            : 'bg-surface-2 text-muted/40 border-border hover:border-success hover:text-success'}`}>
                                        P
                                      </button>
                                      <button title="Formação feita — toque para marcar"
                                        onClick={() => toggle(t.pessoaId, s.id)}
                                        className={`w-10 h-10 rounded-lg grid place-items-center text-[12px]
                                          font-bold border transition ${feito
                                            ? 'bg-gold/30 text-gold border-gold/50'
                                            : 'bg-surface-2 text-muted/40 border-border hover:border-gold hover:text-gold'}`}>
                                        F
                                      </button>
                                    </div>
                                  </td>
                                );
                              })}
                              <td className={tdMetric}>
                                {m.treinos}<span className="text-muted">/{semanas.length}</span>
                              </td>
                              <td className={tdMetric}>
                                {m.forms}<span className="text-muted">/{semanas.length}</span>
                              </td>
                              <td className={tdMetric}>{m.rodadas}</td>
                              <td className={tdMetric}>
                                {m.rodadas ? m.media.toFixed(1) : '—'}
                              </td>
                              <td className={`${tdMetric} font-display text-bordo`}>
                                {m.nivel != null ? m.nivel.toFixed(1) : '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>

      <ConfirmModal
        aberto={modalReset}
        titulo="Resetar todos os trainees?"
        mensagem="Isso apaga TODOS os trainees e as formações marcadas da temporada. As semanas são mantidas. Não dá para desfazer."
        textoConfirmar="Sim, apagar trainees"
        variantConfirmar="danger"
        onConfirmar={confirmarReset}
        onCancelar={() => setModalReset(false)}
      />
    </div>
  );
}
