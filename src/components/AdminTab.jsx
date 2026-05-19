'use client';
import { useState, useEffect } from 'react';
import Card, { SectionLabel } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Alert from '@/components/ui/Alert';
import Autocomplete from '@/components/ui/Autocomplete';
import ConfirmModal from '@/components/ui/ConfirmModal';
import AdminDrawEditor from '@/components/AdminDrawEditor';
import TraineesArea from '@/components/TraineesArea';
import { IconLock, IconUsers, IconScale, IconLayers, IconPlus, IconTrash } from '@/components/ui/Icons';
import {
  verificarSenha, listarPresentesHoje, listarPessoas, getDrawHoje,
  gerarDraw as apiGerarDraw, salvarDraw, apagarPresenca, mesclarPessoas, apagarPessoa,
  getSpeaks, listarPresentes, getDatasPresenca, getDatasSpeaks, apagarSpeaksData, norm,
} from '@/lib/supabase';
import { calibrar, analiseJuizes } from '@/lib/speaks-stats';
import { toast } from '@/lib/toast';

const chaveDuplas = () => 'duplasAdmin_' + new Date().toLocaleDateString('pt-BR');
const chaveJuizes = () => 'juizes_' + new Date().toLocaleDateString('pt-BR');

function fmtData(iso) {
  if (!iso) return '';
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

export default function AdminTab() {
  const [logado, setLogado] = useState(false);
  const [senha, setSenha] = useState('');
  const [alertaLogin, setAlertaLogin] = useState(null);
  const [area, setArea] = useState('menu'); // 'menu' | 'draw' | 'registros'

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
  const [apagarNome, setApagarNome] = useState('');

  const [alertaAcao, setAlertaAcao] = useState(null);
  const [alertaDraw, setAlertaDraw] = useState(null);
  const [alertaMerge, setAlertaMerge] = useState(null);
  const [alertaApagar, setAlertaApagar] = useState(null);
  const [gerando, setGerando] = useState(false);
  const [analiseData, setAnaliseData] = useState(null);
  const [modalPublicar, setModalPublicar] = useState(false);
  const [datasPresenca, setDatasPresenca] = useState(null);
  const [listaData, setListaData] = useState(null);
  const [listaPresentes, setListaPresentes] = useState(null);
  const [datasSpeaks, setDatasSpeaks] = useState(null);

  const nomesPessoas = pessoas.map((p) => p.nome);
  const nomesPresentes = (presentes || []).filter((p) => !p.naoDebate).map((p) => p.nome);

  const total = (presentes || []).length;
  const debatedores = (presentes || []).filter((p) => !p.naoDebate).length;
  const numSalas = Math.floor(debatedores / 8);
  const resto = debatedores % 8;

  // Mantém o admin logado ao trocar de aba (sessão de 3h).
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('uspd_admin');
      if (raw) {
        const d = JSON.parse(raw);
        if (d.senha && Date.now() - d.ts < 3 * 60 * 60 * 1000) {
          setSenha(d.senha);
          setLogado(true);
          setArea('menu');
          carregarTudo();
        } else {
          sessionStorage.removeItem('uspd_admin');
        }
      }
    } catch (e) {}
  }, []);

  function carregarPresentes() {
    listarPresentesHoje().then((p) => setPresentes(p || [])).catch(() => setPresentes([]));
  }

  function carregarTudo() {
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

  // ── Login ──
  async function login() {
    const ok = await verificarSenha(senha);
    if (!ok) { setAlertaLogin({ tipo: 'error', msg: 'Senha incorreta.' }); return; }
    try {
      sessionStorage.setItem('uspd_admin', JSON.stringify({ senha, ts: Date.now() }));
    } catch (e) {}
    setLogado(true);
    setArea('menu');
    carregarTudo();
  }

  function abrirAnalise() {
    setArea('juizes');
    setAnaliseData(null);
    getSpeaks()
      .then((s) => setAnaliseData(analiseJuizes(calibrar(s || []))))
      .catch(() => setAnaliseData([]));
  }

  function abrirListas() {
    setArea('listas');
    setListaData(null);
    setListaPresentes(null);
    setDatasPresenca(null);
    getDatasPresenca().then((d) => setDatasPresenca(d || [])).catch(() => setDatasPresenca([]));
  }
  function selecionarData(d) {
    setListaData(d);
    setListaPresentes(null);
    listarPresentes(d).then((p) => setListaPresentes(p || [])).catch(() => setListaPresentes([]));
  }
  function copiarLista() {
    if (!listaPresentes) return;
    const linhas = listaPresentes.map((p, i) =>
      `${i + 1}. ${p.nome}${p.tipo !== 'ps' ? ` (${p.tipo})` : ''}`);
    const texto = `Presença — Treino ${fmtData(listaData)} (${listaPresentes.length} presentes)\n\n`
      + linhas.join('\n');
    navigator.clipboard.writeText(texto)
      .then(() => toast('success', 'Lista copiada! Cole onde quiser.'))
      .catch(() => toast('error', 'Não consegui copiar a lista.'));
  }

  function abrirRegistros() {
    setArea('registros');
    setDatasSpeaks(null);
    getDatasSpeaks().then((d) => setDatasSpeaks(d || [])).catch(() => setDatasSpeaks([]));
  }
  async function apagarSpeaksFn(data) {
    if (!window.confirm(
      `Apagar TODOS os speaker points do treino de ${fmtData(data)}? Não dá para desfazer.`)) return;
    const res = await apagarSpeaksData({ data, senha });
    if (res.ok) {
      toast('success', 'Speaker points do treino apagados.');
      getDatasSpeaks().then((d) => setDatasSpeaks(d || []));
    } else toast('error', res.erro);
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
  function publicar() {
    setModalPublicar(true);
  }
  async function confirmarPublicar() {
    setModalPublicar(false);
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

  // ── Mesclar pessoas ──
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

  // ── Apagar pessoa ──
  async function apagarPessoaFn() {
    const p = pessoas.find((x) => norm(x.nome) === norm(apagarNome));
    if (!p) { setAlertaApagar({ tipo: 'error', msg: 'Selecione a pessoa da lista.' }); return; }
    if (!window.confirm(`Apagar "${p.nome}"?\n\nIsso remove a pessoa e TODO o histórico dela ` +
      `(presenças e speaker points). Não dá para desfazer.`)) return;
    const res = await apagarPessoa({ pessoaId: p.id, senha });
    if (res.ok) {
      setAlertaApagar({ tipo: 'success', msg: `${p.nome} apagado(a).` });
      setApagarNome('');
      listarPessoas().then((pp) => setPessoas(pp || []));
      carregarPresentes();
    } else setAlertaApagar({ tipo: 'error', msg: res.erro });
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

  // ════════ Menu ════════
  if (area === 'menu') {
    return (
      <Card style={{ animationDelay: '.05s' }}>
        <SectionLabel icon={IconLock}>Painel administrativo</SectionLabel>
        <p className="text-xs text-muted mb-4">O que você quer fazer?</p>
        <div className="grid sm:grid-cols-2 gap-3">
          <button
            onClick={() => setArea('draw')}
            className="text-left p-5 rounded-xl2 border border-border bg-surface-2
              transition hover:border-bordo/60 hover:-translate-y-0.5"
          >
            <IconLayers className="w-6 h-6 text-bordo mb-2" />
            <div className="text-[13px] font-semibold">Draw de hoje</div>
            <div className="text-[11px] text-muted mt-1">
              Gerar, editar e publicar o draw; presença; duplas; juízes.
            </div>
          </button>
          <button
            onClick={abrirRegistros}
            className="text-left p-5 rounded-xl2 border border-border bg-surface-2
              transition hover:border-bordo/60 hover:-translate-y-0.5"
          >
            <IconUsers className="w-6 h-6 text-bordo mb-2" />
            <div className="text-[13px] font-semibold">Registros e cadastros</div>
            <div className="text-[11px] text-muted mt-1">
              Mesclar cadastros duplicados e apagar pessoas.
            </div>
          </button>
          <button
            onClick={abrirAnalise}
            className="text-left p-5 rounded-xl2 border border-border bg-surface-2
              transition hover:border-bordo/60 hover:-translate-y-0.5"
          >
            <IconScale className="w-6 h-6 text-bordo mb-2" />
            <div className="text-[13px] font-semibold">Análise de juízes</div>
            <div className="text-[11px] text-muted mt-1">
              Desvio padrão, média e viés de cada juiz.
            </div>
          </button>
          <button
            onClick={abrirListas}
            className="text-left p-5 rounded-xl2 border border-border bg-surface-2
              transition hover:border-bordo/60 hover:-translate-y-0.5"
          >
            <IconUsers className="w-6 h-6 text-bordo mb-2" />
            <div className="text-[13px] font-semibold">Listas de presença</div>
            <div className="text-[11px] text-muted mt-1">
              Ver e copiar a lista de presença de cada treino.
            </div>
          </button>
          <button
            onClick={() => setArea('trainees')}
            className="text-left p-5 rounded-xl2 border border-border bg-surface-2
              transition hover:border-bordo/60 hover:-translate-y-0.5"
          >
            <IconUsers className="w-6 h-6 text-bordo mb-2" />
            <div className="text-[13px] font-semibold">Trainees</div>
            <div className="text-[11px] text-muted mt-1">
              Importar trainees, semanas, presença, formações e desempenho.
            </div>
          </button>
        </div>
      </Card>
    );
  }

  const Voltar = () => (
    <button onClick={() => setArea('menu')}
      className="text-[11px] text-bordo hover:underline mb-1">
      ← Voltar ao painel
    </button>
  );

  // ════════ Área: Draw ════════
  if (area === 'draw') {
    return (
      <div className="space-y-3">
        <Voltar />

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

        <Card style={{ animationDelay: '.09s' }}>
          <SectionLabel icon={IconUsers}>Duplas manuais</SectionLabel>
          {alertaAcao && <Alert tipo={alertaAcao.tipo} msg={alertaAcao.msg} />}
          {duplasAdmin.length > 0 && (
            <div className="space-y-1.5 mb-3">
              {duplasAdmin.map((d, i) => (
                <div key={i}
                  className="flex items-center gap-2 bg-surface-2 border border-border rounded-lg px-3 py-2">
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
              <AdminDrawEditor draw={drawAtual} onChange={setDrawAtual} juizesPool={juizes} />
              <div className="flex gap-2 mt-3">
                <Button variant="ghost" onClick={salvarEdicao}>Salvar alterações</Button>
                <Button variant="success" onClick={publicar} disabled={drawAtual.publicado}>
                  {drawAtual.publicado ? 'Publicado' : 'Publicar'}
                </Button>
              </div>
            </div>
          )}
        </Card>

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

        <ConfirmModal
          aberto={modalPublicar}
          titulo="Publicar o draw?"
          mensagem="Todos os membros vão poder ver o draw na aba Draw. Você ainda pode editar e salvar o draw depois de publicar."
          textoConfirmar="Publicar para os membros"
          onConfirmar={confirmarPublicar}
          onCancelar={() => setModalPublicar(false)}
        />
      </div>
    );
  }

  // ════════ Área: Análise de juízes ════════
  if (area === 'juizes') {
    return (
      <div className="space-y-3">
        <Voltar />
        <Card style={{ animationDelay: '.05s' }}>
          <SectionLabel icon={IconScale}>Análise de juízes</SectionLabel>
          <p className="text-xs text-muted mb-3">
            Quantas avaliações cada juiz fez, sua média, o desvio padrão das notas
            (consistência) e o viés — <strong className="text-text">positivo = generoso</strong>,
            negativo = durão.
          </p>
          {analiseData === null && <div className="skeleton h-24 rounded-xl2" />}
          {analiseData && analiseData.length === 0 && (
            <p className="text-sm text-muted py-2">Nenhum speak registrado ainda.</p>
          )}
          {analiseData && analiseData.length > 0 && (
            <div className="space-y-1">
              <div className="flex items-center gap-2 px-3 text-[9px] uppercase tracking-widest text-muted">
                <span className="flex-1">Juiz</span>
                <span className="w-10 text-right">Aval.</span>
                <span className="w-12 text-right">Média</span>
                <span className="w-12 text-right">Desvio</span>
                <span className="w-12 text-right">Viés</span>
              </div>
              {analiseData.map((j) => (
                <div key={j.nome}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-surface-2 border border-border">
                  <span className="flex-1 text-[13px] font-semibold">{j.nome}</span>
                  <span className="w-10 text-right text-[12px] text-muted">{j.n}</span>
                  <span className="w-12 text-right text-[12px]">{j.media.toFixed(1)}</span>
                  <span className="w-12 text-right text-[12px]">{j.desvio.toFixed(1)}</span>
                  <span className={`w-12 text-right text-[12px] font-semibold
                    ${j.vies >= 0 ? 'text-gold' : 'text-bordo'}`}>
                    {(j.vies >= 0 ? '+' : '') + j.vies.toFixed(1)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    );
  }

  // ════════ Área: Trainees ════════
  if (area === 'trainees') {
    return (
      <div className="space-y-3">
        <Voltar />
        <TraineesArea />
      </div>
    );
  }

  // ════════ Área: Listas de presença ════════
  if (area === 'listas') {
    return (
      <div className="space-y-3">
        <Voltar />
        <Card style={{ animationDelay: '.05s' }}>
          <SectionLabel icon={IconUsers}>Listas de presença</SectionLabel>
          <p className="text-xs text-muted mb-3">Escolha um treino para ver e compartilhar a lista.</p>
          {datasPresenca === null && <div className="skeleton h-11 rounded-lg" />}
          {datasPresenca && datasPresenca.length === 0 && (
            <p className="text-sm text-muted py-2">Nenhuma presença registrada ainda.</p>
          )}
          {datasPresenca && datasPresenca.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {datasPresenca.map((d) => (
                <button
                  key={d}
                  onClick={() => selecionarData(d)}
                  className={`px-3.5 py-2.5 rounded-xl text-[12px] font-semibold border transition
                    ${listaData === d
                      ? 'bg-gradient-to-br from-bordo to-bordo-soft text-white border-bordo'
                      : 'bg-surface-2 text-muted border-border hover:border-bordo/60'}`}
                >
                  {fmtData(d)}
                </button>
              ))}
            </div>
          )}
        </Card>

        {listaData && (
          <Card style={{ animationDelay: '.1s' }}>
            <SectionLabel
              icon={IconUsers}
              right={listaPresentes && (
                <span className="bg-bordo text-white text-xs font-bold px-2.5 py-0.5 rounded-full">
                  {listaPresentes.length}
                </span>
              )}
            >
              Treino {fmtData(listaData)}
            </SectionLabel>
            {listaPresentes === null && <div className="skeleton h-20 rounded-xl2" />}
            {listaPresentes && listaPresentes.length === 0 && (
              <p className="text-sm text-muted py-2">Ninguém presente nesse treino.</p>
            )}
            {listaPresentes && listaPresentes.length > 0 && (
              <>
                <Button onClick={copiarLista} className="mb-3">Copiar lista para compartilhar</Button>
                <div className="space-y-1">
                  {listaPresentes.map((p, i) => (
                    <div key={p.presencaId}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-2
                        border border-border text-[13px]">
                      <span className="w-6 text-center text-muted">{i + 1}</span>
                      <span className="flex-1 font-semibold">{p.nome}</span>
                      {p.tipo !== 'ps' && (
                        <span className="text-[10px] text-muted">{p.tipo}</span>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </Card>
        )}
      </div>
    );
  }

  // ════════ Área: Registros e cadastros ════════
  return (
    <div className="space-y-3">
      <Voltar />

      <Card style={{ animationDelay: '.05s' }}>
        <SectionLabel icon={IconUsers}>Mesclar cadastros duplicados</SectionLabel>
        {alertaMerge && <Alert tipo={alertaMerge.tipo} msg={alertaMerge.msg} />}
        <p className="text-xs text-muted mb-3">
          Se a mesma pessoa foi cadastrada duas vezes, junte os registros — o histórico
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

      <Card style={{ animationDelay: '.1s' }}>
        <SectionLabel icon={IconTrash}>Apagar pessoa</SectionLabel>
        {alertaApagar && <Alert tipo={alertaApagar.tipo} msg={alertaApagar.msg} />}
        <p className="text-xs text-muted mb-3">
          Remove o cadastro e <strong className="text-text">todo o histórico</strong> da pessoa
          (presenças e speaker points). Use para limpar cadastros errados. Não dá para desfazer.
        </p>
        <div className="mb-2">
          <Autocomplete value={apagarNome} options={nomesPessoas} placeholder="Pessoa a apagar..."
            onChange={(v) => setApagarNome(v)} />
        </div>
        <Button variant="danger" onClick={apagarPessoaFn}>Apagar pessoa</Button>
      </Card>

      <Card style={{ animationDelay: '.15s' }}>
        <SectionLabel icon={IconScale}>Apagar speaker points de um treino</SectionLabel>
        <p className="text-xs text-muted mb-3">
          Apaga todas as notas de um treino — útil para limpar testes. As notas somem do dashboard.
        </p>
        {datasSpeaks === null && <div className="skeleton h-11 rounded-lg" />}
        {datasSpeaks && datasSpeaks.length === 0 && (
          <p className="text-sm text-muted py-1">Nenhum treino com speaker points registrados.</p>
        )}
        {datasSpeaks && datasSpeaks.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {datasSpeaks.map((d) => (
              <button key={d} onClick={() => apagarSpeaksFn(d)}
                className="text-[12px] text-danger border border-danger/40 rounded-lg px-3 py-2
                  hover:bg-danger/10 transition">
                Apagar {fmtData(d)}
              </button>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
