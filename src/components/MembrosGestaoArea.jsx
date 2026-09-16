'use client';
import { useState, useEffect, useMemo } from 'react';
import Card, { SectionLabel } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Alert from '@/components/ui/Alert';
import Autocomplete from '@/components/ui/Autocomplete';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { IconUsers, IconClock, IconTrash, IconPlus } from '@/components/ui/Icons';
import {
  getMembrosGestao, registrarMembroGestao, removerMembrosGestao,
  getTraineeSemanas, getPresencasRaw, getDrawsDaTemporada, listarPessoas,
} from '@/lib/supabase';
import { nomesDoDraw } from '@/lib/draw';
import { norm } from '@/lib/data';
import { toast } from '@/lib/toast';

const PAPEIS = [
  { id: 'membro', label: 'Membro' },
  { id: 'gestao', label: 'Gestão' },
];

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

// Segunda a domingo da semana que contém a data ISO — mesma regra da área de trainees.
function semanaDe(iso) {
  const d = new Date(iso + 'T00:00:00');
  const dow = (d.getDay() + 6) % 7;
  const ini = new Date(d); ini.setDate(d.getDate() - dow);
  const fim = new Date(ini); fim.setDate(ini.getDate() + 6);
  return { inicio: isoDe(ini), fim: isoDe(fim) };
}

export default function MembrosGestaoArea() {
  const [membros, setMembros] = useState([]);
  const [pessoas, setPessoas] = useState([]);
  const [semanas, setSemanas] = useState([]);
  const [presencas, setPresencas] = useState([]);
  const [draws, setDraws] = useState([]);
  const [carregando, setCarregando] = useState(true);

  const [nomeNovo, setNomeNovo] = useState('');
  const [papelNovo, setPapelNovo] = useState('membro');
  const [alerta, setAlerta] = useState(null);
  const [selecionando, setSelecionando] = useState(false);
  const [selecionados, setSelecionados] = useState(new Set());
  const [modalRemover, setModalRemover] = useState(false);

  function recarregar() {
    setCarregando(true);
    Promise.all([
      getMembrosGestao(), listarPessoas(), getTraineeSemanas(),
      getPresencasRaw(), getDrawsDaTemporada(),
    ]).then(([mg, pess, sem, pres, drw]) => {
      setMembros(mg || []);
      setPessoas(pess || []);
      setSemanas(sem || []);
      setPresencas(pres || []);
      setDraws(drw || []);
      setCarregando(false);
    }).catch(() => setCarregando(false));
  }
  useEffect(() => { recarregar(); }, []);

  async function adicionar() {
    const nomeTxt = nomeNovo.trim();
    if (nomeTxt.length < 2) { setAlerta({ tipo: 'error', msg: 'Digite o nome completo.' }); return; }
    const res = await registrarMembroGestao({ nome: nomeTxt, papel: papelNovo });
    if (res.ok) {
      toast('success', 'Cadastro salvo.');
      setNomeNovo('');
      setAlerta(null);
      recarregar();
    } else setAlerta({ tipo: 'error', msg: res.erro });
  }

  async function trocarPapel(pessoaId, papel) {
    const res = await registrarMembroGestao({ pessoaId, papel });
    if (res.ok) recarregar();
    else toast('error', res.erro);
  }

  function toggleSel(pessoaId) {
    setSelecionados((cur) => {
      const novo = new Set(cur);
      if (novo.has(pessoaId)) novo.delete(pessoaId); else novo.add(pessoaId);
      return novo;
    });
  }
  function sairDaSelecao() {
    setSelecionando(false);
    setSelecionados(new Set());
  }
  async function confirmarRemover() {
    setModalRemover(false);
    const res = await removerMembrosGestao([...selecionados]);
    if (res.ok) {
      toast('success', `${res.n} pessoa(s) removida(s).`);
      sairDaSelecao();
      recarregar();
    } else toast('error', res.erro);
  }

  // Quem aparece em cada draw (debatedores + juízes), por data — mesma lógica da área de trainees.
  const nomesPorDraw = useMemo(() => {
    const m = new Map();
    draws.forEach((d) => m.set(d.data, nomesDoDraw(d.conteudo)));
    return m;
  }, [draws]);

  const datasPresenca = useMemo(
    () => [...new Set(presencas.map((p) => p.data))],
    [presencas]
  );
  const datasTreino = useMemo(
    () => [...new Set([...datasPresenca, ...draws.map((d) => d.data)])].sort().reverse(),
    [datasPresenca, draws]
  );

  const nomeNormDe = useMemo(
    () => new Map(membros.map((m) => [m.pessoaId, norm(m.nome)])),
    [membros]
  );

  function presencaNa(pessoaId, sem) {
    if (presencas.some((p) => p.pessoa_id === pessoaId
      && p.data >= sem.data_inicio && p.data <= sem.data_fim)) return 'registrada';
    const n = nomeNormDe.get(pessoaId);
    if (n) {
      for (const [data, nomes] of nomesPorDraw) {
        if (data >= sem.data_inicio && data <= sem.data_fim && nomes.has(n)) return 'draw';
      }
    }
    return null;
  }
  function presenteNa(pessoaId, sem) {
    return presencaNa(pessoaId, sem) !== null;
  }
  function treinosDe(pessoaId) {
    return semanas.filter((s) => presenteNa(pessoaId, s)).length;
  }

  const grupos = {
    membro: membros.filter((m) => m.papel === 'membro'),
    gestao: membros.filter((m) => m.papel === 'gestao'),
  };

  const linkCadastro = typeof window !== 'undefined'
    ? window.location.origin + window.location.pathname + '?aba=cadastro'
    : '';

  function copiarLink() {
    navigator.clipboard.writeText(linkCadastro)
      .then(() => toast('success', 'Link copiado! Envie no grupo de membros.'))
      .catch(() => toast('error', 'Não consegui copiar o link.'));
  }

  return (
    <div className="space-y-3">
      <Card style={{ animationDelay: '.05s' }}>
        <SectionLabel icon={IconUsers}>Link de auto-cadastro</SectionLabel>
        <p className="text-xs text-muted mb-3">
          Envie este link no grupo de membros. Cada um escolhe o próprio nome e se é
          <strong className="text-text"> Membro</strong> ou <strong className="text-text">Gestão</strong> —
          quem já é trainee é barrado automaticamente.
        </p>
        <Button onClick={copiarLink}>Copiar link de cadastro</Button>
      </Card>

      <Card style={{ animationDelay: '.09s' }}>
        <SectionLabel icon={IconPlus}>Adicionar manualmente</SectionLabel>
        {alerta && <Alert tipo={alerta.tipo} msg={alerta.msg} />}
        <div className="grid sm:grid-cols-[1fr_auto] gap-2 mb-2">
          <Autocomplete
            value={nomeNovo}
            options={pessoas.map((p) => p.nome)}
            placeholder="Nome completo..."
            onChange={(v) => setNomeNovo(v)}
          />
          <select
            value={papelNovo}
            onChange={(e) => setPapelNovo(e.target.value)}
            className="px-3 py-2.5 rounded-lg text-sm bg-surface-2 border border-border
              text-text outline-none focus:border-bordo"
          >
            {PAPEIS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </div>
        <Button variant="ghost" onClick={adicionar}>
          <span className="inline-flex items-center gap-2 justify-center">
            <IconPlus className="w-4 h-4" />Adicionar
          </span>
        </Button>
      </Card>

      <Card style={{ animationDelay: '.13s' }}>
        <SectionLabel icon={IconClock}>Presença nos treinos</SectionLabel>
        {carregando && <div className="skeleton h-24 rounded-xl2" />}
        {!carregando && membros.length === 0 && (
          <p className="text-sm text-muted py-2">Ninguém se cadastrou como membro ou gestão ainda.</p>
        )}
        {!carregando && membros.length > 0 && (
          <>
            <p className="text-[11px] text-muted mb-3">
              <strong className="text-success">P</strong> = presença no treino daquela semana
              (registrada ou vinda do draw) · toque no papel para trocar entre Membro e Gestão.
            </p>
            {semanas.length === 0 && (
              <p className="text-[11px] text-muted mb-3">
                Nenhuma semana criada ainda — crie semanas na área de Trainees
                (elas são compartilhadas entre as duas áreas).
              </p>
            )}
            <div className="flex items-center gap-2 flex-wrap mb-3">
              {!selecionando ? (
                <button onClick={() => setSelecionando(true)}
                  className="text-[11px] text-muted border border-border rounded-lg px-3 py-1.5
                    hover:border-bordo hover:text-bordo transition">
                  Selecionar para remover
                </button>
              ) : (
                <>
                  <span className="text-[11px] text-muted">{selecionados.size} selecionado(s)</span>
                  <button
                    onClick={() => setModalRemover(true)}
                    disabled={selecionados.size === 0}
                    className="text-[11px] text-danger border border-[#e0625a66] rounded-lg
                      px-3 py-1.5 transition hover:bg-[#e0625a1a]
                      disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent">
                    Remover selecionados
                  </button>
                  <button onClick={sairDaSelecao}
                    className="text-[11px] text-muted border border-border rounded-lg px-3 py-1.5
                      hover:border-bordo hover:text-bordo transition">
                    Cancelar
                  </button>
                </>
              )}
            </div>
            <div className="space-y-5">
              {[['membro', 'Membros'], ['gestao', 'Gestão']].map(([chave, titulo]) => {
                const lista = grupos[chave];
                if (!lista.length) return null;
                return (
                  <div key={chave}>
                    <div className="text-[11px] uppercase tracking-wider text-gold mb-2">
                      {titulo} ({lista.length})
                    </div>
                    <div className="overflow-x-auto">
                      <table className="text-[12px] border-separate" style={{ borderSpacing: '0 6px' }}>
                        <thead>
                          <tr className="text-[9px] uppercase tracking-wider text-muted">
                            <th className="text-left px-2 sticky left-0 bg-surface">Nome</th>
                            {semanas.map((s, i) => (
                              <th key={s.id} className="px-2 text-center">
                                <div>Sem {i + 1}</div>
                                <div className="text-muted/60 normal-case">{fmtCurto(s.data_inicio)}</div>
                              </th>
                            ))}
                            <th className="px-2 text-right whitespace-nowrap">Treinos</th>
                            <th className="px-2 text-center">Papel</th>
                          </tr>
                        </thead>
                        <tbody>
                          {lista.map((m) => (
                            <tr key={m.pessoaId}>
                              <td className="px-2 py-1 font-semibold sticky left-0 bg-surface
                                max-w-[110px] sm:max-w-none truncate" title={m.nome}>
                                {selecionando ? (
                                  <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={selecionados.has(m.pessoaId)}
                                      onChange={() => toggleSel(m.pessoaId)}
                                      className="w-4 h-4 shrink-0 accent-[#c14059]"
                                    />
                                    <span className="truncate">{m.nome}</span>
                                  </label>
                                ) : (
                                  <span className="truncate">{m.nome}</span>
                                )}
                              </td>
                              {semanas.map((s) => {
                                const pres = presencaNa(m.pessoaId, s);
                                return (
                                  <td key={s.id} className="px-2 py-1 text-center">
                                    <span
                                      title={pres === 'registrada' ? 'Presença registrada'
                                        : pres === 'draw' ? 'Estava no draw da semana'
                                        : 'Sem presença'}
                                      className={`inline-grid place-items-center w-8 h-8 rounded-lg text-[12px]
                                        font-bold border ${pres === 'registrada'
                                          ? 'bg-[#4caf7d40] text-success border-[#4caf7d80]'
                                          : pres === 'draw'
                                            ? 'bg-surface-2 text-[#4caf7dcc] border-dashed border-[#4caf7d80]'
                                            : 'bg-surface-2 text-muted/40 border-border'}`}>
                                      {pres ? 'P' : '—'}
                                    </span>
                                  </td>
                                );
                              })}
                              <td className="px-2 py-1 text-right text-[12px]">
                                {treinosDe(m.pessoaId)}<span className="text-muted">/{semanas.length}</span>
                              </td>
                              <td className="px-2 py-1">
                                <div className="flex gap-1 justify-center">
                                  {PAPEIS.map((p) => (
                                    <button
                                      key={p.id}
                                      onClick={() => trocarPapel(m.pessoaId, p.id)}
                                      className={`text-[10px] rounded-full px-2 py-1 border transition
                                        ${m.papel === p.id
                                          ? 'bg-gold/15 border-gold/40 text-gold'
                                          : 'border-border text-muted hover:border-bordo hover:text-bordo'}`}>
                                      {p.label}
                                    </button>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </Card>

      <ConfirmModal
        aberto={modalRemover}
        titulo={`Remover ${selecionados.size} pessoa(s)?`}
        mensagem="Elas saem da lista de membros/gestão. O cadastro, as presenças e o histórico continuam intactos — dá para recadastrar depois pelo link."
        textoConfirmar="Sim, remover"
        variantConfirmar="danger"
        onConfirmar={confirmarRemover}
        onCancelar={() => setModalRemover(false)}
      />
    </div>
  );
}
