'use client';
import { useState } from 'react';
import Card, { SectionLabel } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Alert from '@/components/ui/Alert';
import Autocomplete from '@/components/ui/Autocomplete';
import AdminDrawEditor from '@/components/AdminDrawEditor';
import { IconLock, IconUsers, IconScale, IconLayers, IconPlus, IconTrash } from '@/components/ui/Icons';
import {
  verificarSenha, listarPresentesHoje, listarPessoas, getDrawHoje,
  gerarDraw as apiGerarDraw, salvarDraw, apagarPresenca, mesclarPessoas, norm,
} from '@/lib/supabase';

const chaveDuplas = () => 'duplasAdmin_' + new Date().toLocaleDateString('pt-BR');
const chaveJuizes = () => 'juizes_' + new Date().toLocaleDateString('pt-BR');

export default function AdminTab() {
  const [logado, setLogado] = useState(false);
  const [senha, setSenha] = useState('');
  const [alertaLogin, setAlertaLogin] = useState(null);

  const [presentes, setPresentes] = useState(null);
  const [pessoas, setPessoas] = useState([]);
  const [duplasAdmin, setDuplasAdmin] = useState([]);
  const [juizes, setJuizes] = useState([]);
  const [drawAtual, setDrawAtual] = useState(null);

  const [da1, setDa1] = useState('');
  const [da2, setDa2] = useState('');
  const [inpJuiz, setInpJuiz] = useState('');
  const [mergeKeep, setMergeKeep] = useState('');
  const [mergeRemove, setMergeRemove] = useState('');

  const [alertaAcao, setAlertaAcao] = useState(null);
  const [alertaDraw, setAlertaDraw] = useState(null);
  const [alertaMerge, setAlertaMerge] = useState(null);
  const [gerando, setGerando] = useState(false);

  const nomesPessoas = pessoas.map((p) => p.nome);
  const nomesPresentes = (presentes || []).filter((p) => !p.naoDebate).map((p) => p.nome);

  const total = (presentes || []).length;
  const debatedores = (presentes || []).filter((p) => !p.naoDebate).length;
  const numSalas = Math.floor(debatedores / 8);
  const resto = debatedores % 8;

  function carregarPresentes() {
    listarPresentesHoje().then((p) => setPresentes(p || [])).catch(() => setPresentes([]));
  }

  // ── Login ──
  async function login() {
    const ok = await verificarSenha(senha);
    if (!ok) { setAlertaLogin({ tipo: 'error', msg: 'Senha incorreta.' }); return; }
    setLogado(true);
    carregarPresentes();
    listarPessoas().then((p) => setPessoas(p || []));

    let juizesLocais = [];
    try {
      const sd = localStorage.getItem(chaveDuplas());
      if (sd) setDuplasAdmin(JSON.parse(sd));
      const sj = localStorage.getItem(chaveJuizes());
      if (sj) { juizesLocais = JSON.parse(sj); setJuizes(juizesLocais); }
    } catch (e) {}

    getDrawHoje().then((draw) => {
      if (draw) {
        setDrawAtual(draw);
        if (draw.juizes?.length && juizesLocais.length === 0) setJuizes([...draw.juizes]);
      }
    }).catch(() => {});
  }

  // ── Duplas manuais ──
  function persistirDuplas(lista) {
    setDuplasAdmin(lista);
    try { localStorage.setItem(chaveDuplas(), JSON.stringify(lista)); } catch (e) {}
  }
  function adicionarDupla() {
    const p1 = da1.trim(), p2 = da2.trim();
    if (!p1 || !p2) { setAlertaAcao({ tipo: 'error', msg: 'Preencha os dois nomes.' }); return; }
    if (norm(p1) === norm(p2)) { setAlertaAcao({ tipo: 'error', msg: 'Nomes precisam ser diferentes.' }); return; }
    if (duplasAdmin.some((d) => [d.p1, d.p2].some((x) => norm(x) === norm(p1) || norm(x) === norm(p2)))) {
      setAlertaAcao({ tipo: 'error', msg: 'Uma dessas pessoas já está em outro par manual.' }); return;
    }
    const avisos = [];
    const pr1 = (presentes || []).find((p) => norm(p.nome) === norm(p1));
    const pr2 = (presentes || []).find((p) => norm(p.nome) === norm(p2));
    if (pr1?.dupla) avisos.push(`${p1} já tem dupla: ${pr1.dupla}`);
    if (pr2?.dupla) avisos.push(`${p2} já tem dupla: ${pr2.dupla}`);
    if (avisos.length && !window.confirm('Conflito de dupla:\n\n• ' + avisos.join('\n• ') +
      '\n\nForçar este par mesmo assim?')) return;
    persistirDuplas([...duplasAdmin, { p1, p2 }]);
    setDa1(''); setDa2(''); setAlertaAcao(null);
  }
  function removerDupla(i) {
    persistirDuplas(duplasAdmin.filter((_, idx) => idx !== i));
  }

  // ── Juízes gerais ──
  function persistirJuizes(lista) {
    setJuizes(lista);
    try { localStorage.setItem(chaveJuizes(), JSON.stringify(lista)); } catch (e) {}
  }
  function adicionarJuiz() {
    const n = inpJuiz.trim();
    if (!n || juizes.includes(n)) { setInpJuiz(''); return; }
    const novo = [...juizes, n];
    persistirJuizes(novo);
    if (drawAtual) setDrawAtual({ ...drawAtual, juizes: novo });
    setInpJuiz('');
  }
  function removerJuiz(n) {
    const novo = juizes.filter((j) => j !== n);
    persistirJuizes(novo);
    if (drawAtual) setDrawAtual({ ...drawAtual, juizes: novo });
  }

  // ── Draw ──
  async function gerarDraw() {
    setGerando(true);
    setAlertaDraw({ tipo: 'info', msg: 'Gerando draw, aguarde...' });
    const res = await apiGerarDraw({ juizes, duplasAdmin, senha });
    setGerando(false);
    if (res.ok) {
      setDrawAtual({ salas: res.salas, juizes: res.juizes, publicado: false });
      setAlertaDraw({ tipo: 'success', msg: `Rascunho gerado: ${res.total} pessoas em ${res.salas.length} sala(s).` });
    } else setAlertaDraw({ tipo: 'error', msg: res.erro });
  }
  async function salvarEdicao() {
    const res = await salvarDraw({
      salas: drawAtual?.salas || [], juizes, publicado: drawAtual?.publicado || false, senha,
    });
    setAlertaDraw(res.ok
      ? { tipo: 'success', msg: drawAtual?.publicado ? 'Salvo e atualizado para os membros.' : 'Alterações salvas.' }
      : { tipo: 'error', msg: res.erro });
  }
  async function publicar() {
    if (!window.confirm('Publicar o draw? Todos os membros poderão ver.')) return;
    const res = await salvarDraw({ salas: drawAtual?.salas || [], juizes, publicado: true, senha });
    if (res.ok) {
      setDrawAtual({ ...drawAtual, publicado: true });
      setAlertaDraw({ tipo: 'success', msg: 'Draw publicado! Os membros já podem ver.' });
    } else setAlertaDraw({ tipo: 'error', msg: res.erro });
  }

  // ── Remover presença ──
  async function removerPresenca(p) {
    if (!window.confirm(`Remover presença de ${p.nome}?`)) return;
    const res = await apagarPresenca({ presencaId: p.presencaId, senha });
    if (res.ok) { carregarPresentes(); setAlertaAcao({ tipo: 'success', msg: res.mensagem }); }
    else setAlertaAcao({ tipo: 'error', msg: res.erro });
  }

  // ── Mesclar pessoas (dedup) ──
  async function mesclar() {
    const pKeep = pessoas.find((p) => norm(p.nome) === norm(mergeKeep));
    const pRem = pessoas.find((p) => norm(p.nome) === norm(mergeRemove));
    if (!pKeep || !pRem) { setAlertaMerge({ tipo: 'error', msg: 'Selecione as duas pessoas da lista.' }); return; }
    if (pKeep.id === pRem.id) { setAlertaMerge({ tipo: 'error', msg: 'Selecione pessoas diferentes.' }); return; }
    if (!window.confirm(`Mesclar cadastros:\n\nMANTER: ${pKeep.nome}\nREMOVER: ${pRem.nome}\n\n` +
      `Todo o histórico de "${pRem.nome}" passa para "${pKeep.nome}" e o duplicado é apagado. Confirmar?`)) return;
    const res = await mesclarPessoas({ manter: pKeep.id, remover: pRem.id, senha });
    if (res.ok) {
      setAlertaMerge({ tipo: 'success', msg: 'Cadastros mesclados.' });
      setMergeKeep(''); setMergeRemove('');
      listarPessoas().then((p) => setPessoas(p || []));
      carregarPresentes();
    } else setAlertaMerge({ tipo: 'error', msg: res.erro });
  }

  // ════════ Login ════════
  if (!logado) {
    return (
      <Card style={{ animationDelay: '.05s' }}>
        <SectionLabel icon={IconLock}>Área administrativa</SectionLabel>
        {alertaLogin && <Alert tipo={alertaLogin.tipo} msg={alertaLogin.msg} />}
        <input
          type="password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && login()}
          placeholder="Senha de administrador"
          className="w-full px-3.5 py-3 rounded-lg text-base outline-none focus:border-bordo mb-3"
        />
        <Button onClick={login}>Entrar</Button>
      </Card>
    );
  }

  // ════════ Painel ════════
  return (
    <div className="space-y-3">
      {/* Estatísticas */}
      <Card style={{ animationDelay: '.05s' }}>
        <SectionLabel icon={IconUsers}>Estatísticas de hoje</SectionLabel>
        <div className="grid grid-cols-3 gap-2">
          {[['Presentes', total], ['Salas de 8', numSalas], ['Sobram', resto]].map(([lbl, val], i) => (
            <div key={lbl}
              style={{ animationDelay: i * 0.06 + 's' }}
              className="bg-surface-2 border border-border rounded-xl p-3 text-center
                animate-rise transition-colors hover:border-bordo/40">
              <div className="font-display text-2xl text-bordo">{val}</div>
              <div className="text-[9px] uppercase tracking-widest text-muted mt-1">{lbl}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Duplas manuais */}
      <Card style={{ animationDelay: '.09s' }}>
        <SectionLabel icon={IconUsers}>Duplas manuais</SectionLabel>
        {alertaAcao && <Alert tipo={alertaAcao.tipo} msg={alertaAcao.msg} />}
        {duplasAdmin.length > 0 && (
          <div className="space-y-1.5 mb-3">
            {duplasAdmin.map((d, i) => (
              <div key={i}
                style={{ animationDelay: i * 0.04 + 's' }}
                className="flex items-center gap-2 bg-surface-2 border border-border rounded-lg
                  px-3 py-2 animate-fade-up">
                <span className="flex-1 text-[13px] font-semibold">{d.p1}</span>
                <span className="text-muted text-xs">↔</span>
                <span className="flex-1 text-[13px] font-semibold">{d.p2}</span>
                <button onClick={() => removerDupla(i)} className="text-danger p-1">
                  <IconTrash className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-end mb-2">
          <Autocomplete value={da1} options={nomesPresentes} placeholder="Pessoa 1" onChange={(v) => setDa1(v)} />
          <span className="pb-3 text-muted">↔</span>
          <Autocomplete value={da2} options={nomesPresentes} placeholder="Pessoa 2" onChange={(v) => setDa2(v)} />
        </div>
        <Button variant="ghost" onClick={adicionarDupla}>
          <span className="inline-flex items-center gap-2 justify-center"><IconPlus className="w-4 h-4" />Adicionar par</span>
        </Button>
      </Card>

      {/* Juízes gerais */}
      <Card style={{ animationDelay: '.13s' }}>
        <SectionLabel icon={IconScale}>Juízes gerais</SectionLabel>
        {juizes.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {juizes.map((j) => (
              <span key={j} className="inline-flex items-center gap-2 bg-gold/15 border border-gold/35
                text-gold rounded-full px-3 py-1 text-xs font-semibold">
                {j}
                <button onClick={() => removerJuiz(j)} className="leading-none">×</button>
              </span>
            ))}
          </div>
        )}
        <div className="mb-2">
          <Autocomplete value={inpJuiz} options={nomesPessoas} placeholder="Nome do juiz..." onChange={(v) => setInpJuiz(v)} />
        </div>
        <Button variant="ghost" onClick={adicionarJuiz}>
          <span className="inline-flex items-center gap-2 justify-center"><IconPlus className="w-4 h-4" />Adicionar juiz</span>
        </Button>
      </Card>

      {/* Draw */}
      <Card style={{ animationDelay: '.17s' }}>
        <SectionLabel icon={IconLayers}>Draw</SectionLabel>
        {alertaDraw && <Alert tipo={alertaDraw.tipo} msg={alertaDraw.msg} />}
        <Button onClick={gerarDraw} loading={gerando}>
          {drawAtual ? 'Regerar draw' : 'Gerar draw'}
        </Button>

        {drawAtual && (
          <div className="mt-4">
            <div className={`rounded-lg px-4 py-3 mb-3 border ${drawAtual.publicado
              ? 'bg-bordo/10 border-bordo/30' : 'bg-gold/10 border-gold/30'}`}>
              <div className="text-[12px] font-semibold text-text">
                {drawAtual.publicado ? 'Draw publicado — membros já podem ver.' : 'Rascunho — visível só para admins.'}
              </div>
              <div className="text-[11px] text-muted mt-0.5">
                Para trocar pessoas: toque num nome e depois noutro. Edite e salve para atualizar.
              </div>
            </div>

            <AdminDrawEditor draw={drawAtual} onChange={setDrawAtual} />

            <div className="flex gap-2 mt-3">
              <Button variant="ghost" onClick={salvarEdicao}>Salvar alterações</Button>
              <Button variant="success" onClick={publicar} disabled={drawAtual.publicado}>
                {drawAtual.publicado ? 'Publicado' : 'Publicar'}
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Lista de presentes */}
      <Card style={{ animationDelay: '.21s' }}>
        <SectionLabel icon={IconUsers}>Lista de presentes</SectionLabel>
        {presentes === null && <div className="skeleton h-20 rounded-xl2" />}
        {presentes && presentes.length === 0 && (
          <p className="text-sm text-muted py-2">Ninguém presente ainda.</p>
        )}
        {presentes && presentes.length > 0 && (
          <div className="space-y-2">
            {presentes.map((p, i) => {
              const obs = p.naoDebate;
              return (
                <div key={p.presencaId}
                  style={{ animationDelay: i * 0.04 + 's' }}
                  className="flex items-center justify-between p-3 rounded-xl border border-border
                    bg-surface-2 animate-fade-up transition hover:-translate-y-0.5 hover:border-bordo/50">
                  <div>
                    <div className={`text-[13px] font-semibold ${obs ? 'text-muted' : 'text-text'}`}>
                      {i + 1}. {p.nome}
                    </div>
                    <div className="text-[11px] mt-0.5">
                      {obs ? <span className="text-muted">só assistindo</span>
                        : p.dupla ? <span className="text-bordo">com {p.dupla}</span>
                        : <span className="text-muted">sem dupla</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-muted">{p.hora}</span>
                    <button onClick={() => removerPresenca(p)}
                      className="text-danger border border-danger/40 rounded p-1.5">
                      <IconTrash className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Mesclar cadastros duplicados */}
      <Card style={{ animationDelay: '.25s' }}>
        <SectionLabel icon={IconUsers}>Mesclar cadastros duplicados</SectionLabel>
        {alertaMerge && <Alert tipo={alertaMerge.tipo} msg={alertaMerge.msg} />}
        <p className="text-xs text-muted mb-3">
          Se a mesma pessoa foi cadastrada duas vezes, junte os registros aqui — o histórico
          do removido passa para o mantido.
        </p>
        <div className="grid sm:grid-cols-2 gap-2 mb-2">
          <div>
            <label className="block text-[10px] uppercase tracking-[0.15em] text-muted mb-1.5">Manter</label>
            <Autocomplete value={mergeKeep} options={nomesPessoas} placeholder="Cadastro a manter..."
              onChange={(v) => setMergeKeep(v)} />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-[0.15em] text-muted mb-1.5">Remover</label>
            <Autocomplete value={mergeRemove} options={nomesPessoas} placeholder="Cadastro duplicado..."
              onChange={(v) => setMergeRemove(v)} />
          </div>
        </div>
        <Button variant="danger" onClick={mesclar}>Mesclar e apagar duplicado</Button>
      </Card>
    </div>
  );
}
