'use client';
import { useState, useEffect, useCallback } from 'react';
import Card, { SectionLabel } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Alert from '@/components/ui/Alert';
import Autocomplete from '@/components/ui/Autocomplete';
import AdminDrawEditor from '@/components/AdminDrawEditor';
import { IconLock, IconUsers, IconScale, IconLayers, IconPlus, IconTrash } from '@/components/ui/Icons';
import { callAPI, callAPICached, invalidate } from '@/lib/api';
import { NOMES_PS, norm } from '@/lib/data';

const chaveDuplas = () => 'duplasAdmin_' + new Date().toLocaleDateString('pt-BR');
const chaveJuizes = () => 'juizes_' + new Date().toLocaleDateString('pt-BR');

export default function AdminTab() {
  const [logado, setLogado] = useState(false);
  const [senha, setSenha] = useState('');
  const [alertaLogin, setAlertaLogin] = useState(null);

  const [presentes, setPresentes] = useState(null);
  const [duplasAdmin, setDuplasAdmin] = useState([]);
  const [juizes, setJuizes] = useState([]);
  const [drawAtual, setDrawAtual] = useState(null);

  const [da1, setDa1] = useState('');
  const [da2, setDa2] = useState('');
  const [inpJuiz, setInpJuiz] = useState('');
  const [alertaAcao, setAlertaAcao] = useState(null);
  const [alertaDraw, setAlertaDraw] = useState(null);
  const [gerando, setGerando] = useState(false);

  // ── nomes para autocomplete (PS + presentes não-PS) ──
  const nomesPresentes = (presentes || []).filter((p) => !p.naoDebate).map((p) => p.nome);
  const nomesDupla = (() => {
    const base = [...NOMES_PS];
    nomesPresentes.forEach((n) => { if (!base.some((b) => norm(b) === norm(n))) base.push(n); });
    return base.sort((a, b) => a.localeCompare(b, 'pt-BR'));
  })();

  const total = (presentes || []).length;
  const numSalas = Math.floor(total / 8);
  const resto = total % 8;

  const carregarPresentes = useCallback(() => {
    callAPICached('getPresentesHoje', null, 15000)
      .then((p) => setPresentes(p || []))
      .catch(() => setPresentes([]));
  }, []);

  // ── Login ──
  function login() {
    callAPI('verificarSenha', { senha })
      .then((ok) => {
        if (!ok) { setAlertaLogin({ tipo: 'error', msg: 'Senha incorreta.' }); return; }
        setLogado(true);
        carregarPresentes();
        // restaura duplas manuais e juízes do dia (localStorage)
        let juizesLocais = [];
        try {
          const sd = localStorage.getItem(chaveDuplas());
          if (sd) setDuplasAdmin(JSON.parse(sd));
          const sj = localStorage.getItem(chaveJuizes());
          if (sj) { juizesLocais = JSON.parse(sj); setJuizes(juizesLocais); }
        } catch (e) {}
        // carrega draw existente; só usa os juízes do draw se não houver salvos localmente
        callAPI('getDrawHoje').then((draw) => {
          if (draw) {
            setDrawAtual(draw);
            if (draw.juizes?.length && juizesLocais.length === 0) setJuizes([...draw.juizes]);
          }
        }).catch(() => {});
      })
      .catch(() => setAlertaLogin({ tipo: 'error', msg: 'Erro de conexão.' }));
  }

  // ── Duplas manuais ──
  function persistirDuplas(lista) {
    setDuplasAdmin(lista);
    try { localStorage.setItem(chaveDuplas(), JSON.stringify(lista)); } catch (e) {}
  }
  function adicionarDupla() {
    const p1 = da1.trim(), p2 = da2.trim();
    if (!p1 || !p2) { setAlertaAcao({ tipo: 'error', msg: 'Preencha os dois nomes.' }); return; }
    if (norm(p1) === norm(p2)) { setAlertaAcao({ tipo: 'error', msg: 'Os nomes precisam ser diferentes.' }); return; }
    if (duplasAdmin.some((d) => [d.p1, d.p2].some((x) => norm(x) === norm(p1) || norm(x) === norm(p2)))) {
      setAlertaAcao({ tipo: 'error', msg: 'Uma dessas pessoas já está em outro par manual.' }); return;
    }
    const avisos = [];
    const pr1 = (presentes || []).find((p) => norm(p.nome) === norm(p1));
    const pr2 = (presentes || []).find((p) => norm(p.nome) === norm(p2));
    if (pr1?.dupla) avisos.push(`${p1} já tem dupla: ${pr1.dupla}`);
    if (pr2?.dupla) avisos.push(`${p2} já tem dupla: ${pr2.dupla}`);
    if (avisos.length && !window.confirm('Conflito de dupla:\n\n• ' + avisos.join('\n• ') +
      '\n\nForçar este par mesmo assim? Vai sobrescrever a dupla preenchida.')) return;
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

  // ── Gerar / salvar / publicar ──
  function gerarDraw() {
    setGerando(true);
    setAlertaDraw({ tipo: 'info', msg: 'Gerando draw, aguarde...' });
    callAPI('gerarDrawWeb', { juizes, duplasAdmin })
      .then((res) => {
        setGerando(false);
        if (res.ok) {
          setDrawAtual({ salas: res.salas, juizes: res.juizes, publicado: false });
          setAlertaDraw({ tipo: 'success', msg: `Rascunho gerado: ${res.total} pessoas em ${res.salas.length} sala(s).` });
        } else setAlertaDraw({ tipo: 'error', msg: res.erro });
      })
      .catch((e) => { setGerando(false); setAlertaDraw({ tipo: 'error', msg: 'Erro: ' + e.message }); });
  }
  function juizesPorSala() {
    const jps = {};
    (drawAtual?.salas || []).forEach((s) => { if (s.juiz?.trim()) jps[s.numero] = s.juiz.trim(); });
    return jps;
  }
  function salvarEdicao() {
    callAPI('salvarDrawEditado', { salas: drawAtual?.salas || [], juizesPorSala: juizesPorSala(), juizes })
      .then((res) => {
        setAlertaDraw(res.ok
          ? { tipo: 'success', msg: drawAtual?.publicado ? 'Alterações salvas e atualizadas para os membros.' : 'Alterações salvas.' }
          : { tipo: 'error', msg: res.erro });
      })
      .catch((e) => setAlertaDraw({ tipo: 'error', msg: 'Erro: ' + e.message }));
  }
  function publicar() {
    if (!window.confirm('Publicar o draw? Todos os membros poderão ver.')) return;
    callAPI('salvarDrawEditado', { salas: drawAtual?.salas || [], juizesPorSala: juizesPorSala(), juizes })
      .then((r1) => {
        if (!r1.ok) { setAlertaDraw({ tipo: 'error', msg: r1.erro }); return; }
        return callAPI('publicarDraw').then((r2) => {
          if (r2.ok) {
            setDrawAtual({ ...drawAtual, publicado: true });
            invalidate('getDrawHojePublico');
            setAlertaDraw({ tipo: 'success', msg: 'Draw publicado! Os membros já podem ver.' });
          } else setAlertaDraw({ tipo: 'error', msg: r2.erro });
        });
      })
      .catch((e) => setAlertaDraw({ tipo: 'error', msg: 'Erro: ' + e.message }));
  }

  // ── Remover presença ──
  function removerPresenca(nome) {
    if (!window.confirm(`Remover presença de ${nome}?`)) return;
    callAPI('apagarPresenca', { nome })
      .then((res) => {
        if (res.ok) {
          // Atualização otimista: remove da lista sem nova chamada.
          setPresentes((prev) => (prev || []).filter((p) => p.nome !== nome));
          invalidate('getPresentesHoje');
        }
        setAlertaAcao(res.ok ? { tipo: 'success', msg: res.mensagem } : { tipo: 'error', msg: res.erro });
      })
      .catch(() => setAlertaAcao({ tipo: 'error', msg: 'Erro de conexão.' }));
  }

  // ════════ Tela de login ════════
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
          <Autocomplete value={da1} options={nomesDupla} placeholder="Pessoa 1" onChange={(v) => setDa1(v)} />
          <span className="pb-3 text-muted">↔</span>
          <Autocomplete value={da2} options={nomesDupla} placeholder="Pessoa 2" onChange={(v) => setDa2(v)} />
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
          <Autocomplete value={inpJuiz} options={NOMES_PS} placeholder="Nome do juiz..." onChange={(v) => setInpJuiz(v)} />
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
              const obs = p.naoDebate || p.tipo === 'observador';
              return (
                <div key={p.nome + i}
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
                    <button onClick={() => removerPresenca(p.nome)}
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
    </div>
  );
}
