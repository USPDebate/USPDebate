'use client';
import { useState, useEffect, useRef } from 'react';
import Card, { SectionLabel } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Alert from '@/components/ui/Alert';
import Autocomplete from '@/components/ui/Autocomplete';
import OlhoBigBrother from '@/components/ui/OlhoBigBrother';
import { IconLock, IconUser, IconUpload, IconCheck, IconClock } from '@/components/ui/Icons';
import {
  verificarSenhaTrainee, getTrainees, getTraineeSemanas, getDemandas, getEnvios,
  enviarFormacao, urlDaImagem,
} from '@/lib/supabase';
import { comprimirImagem } from '@/lib/imagem';
import { toast } from '@/lib/toast';

const SESSAO = 'uspd_trainee';
const DIAS = 30 * 24 * 60 * 60 * 1000;

function fmtBR(iso) {
  if (!iso) return '';
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}
function fmtCurto(iso) {
  if (!iso) return '';
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}
function hojeISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function TraineeTab() {
  const [logado, setLogado] = useState(false);
  const [senha, setSenha] = useState('');
  const [alertaLogin, setAlertaLogin] = useState(null);
  const [entrando, setEntrando] = useState(false);

  const [trainees, setTrainees] = useState([]);
  const [semanas, setSemanas] = useState([]);
  const [demandas, setDemandas] = useState([]);
  const [envios, setEnvios] = useState([]);
  const [carregando, setCarregando] = useState(false);

  const [nome, setNome] = useState('');
  const [nomeOk, setNomeOk] = useState(false);
  const [enviando, setEnviando] = useState(null);   // id da demanda em envio
  const [olho, setOlho] = useState(false);
  const inputs = useRef({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SESSAO);
      if (raw) {
        const d = JSON.parse(raw);
        if (d.senha && Date.now() - d.ts < DIAS) {
          setSenha(d.senha);
          setLogado(true);
          if (d.nome) { setNome(d.nome); setNomeOk(true); }
          carregar();
        } else localStorage.removeItem(SESSAO);
      }
    } catch (e) {}
  }, []);

  function carregar() {
    setCarregando(true);
    Promise.all([getTrainees(), getTraineeSemanas(), getDemandas(), getEnvios()])
      .then(([tr, sem, dem, env]) => {
        setTrainees(tr || []);
        setSemanas(sem || []);
        setDemandas(dem || []);
        setEnvios(env || []);
        setCarregando(false);
      })
      .catch(() => setCarregando(false));
  }

  async function entrar() {
    setEntrando(true);
    const ok = await verificarSenhaTrainee(senha);
    setEntrando(false);
    if (!ok) { setAlertaLogin({ tipo: 'error', msg: 'Senha incorreta.' }); return; }
    setAlertaLogin(null);
    setLogado(true);
    salvarSessao(senha, nome);
    carregar();
  }

  function salvarSessao(s, n) {
    try {
      localStorage.setItem(SESSAO, JSON.stringify({ senha: s, nome: n || '', ts: Date.now() }));
    } catch (e) {}
  }

  function sair() {
    try { localStorage.removeItem(SESSAO); } catch (e) {}
    setLogado(false); setSenha(''); setNome(''); setNomeOk(false);
  }

  function escolherNome(v, daLista) {
    setNome(v);
    setNomeOk(daLista);
    if (daLista) salvarSessao(senha, v);
  }

  const eu = trainees.find((t) => t.nome === nome) || null;
  const semanaDe = (id) => semanas.find((s) => s.id === id) || null;
  const numeroSemana = (id) => {
    const i = semanas.findIndex((s) => s.id === id);
    return i < 0 ? null : i + 1;
  };
  const envioDe = (demandaId) =>
    envios.find((e) => e.demanda_id === demandaId && eu && e.pessoa_id === eu.pessoaId) || null;

  const hoje = hojeISO();
  const semanaAtual = semanas.find((s) => hoje >= s.data_inicio && hoje <= s.data_fim) || null;

  async function onArquivo(demandaId, file) {
    if (!file || !eu) return;
    setEnviando(demandaId);
    const c = await comprimirImagem(file);
    if (c.erro) { toast('error', c.erro); setEnviando(null); return; }
    const res = await enviarFormacao({
      senha, pessoaId: eu.pessoaId, demandaId, blob: c.blob, ext: c.ext,
    });
    setEnviando(null);
    if (inputs.current[demandaId]) inputs.current[demandaId].value = '';
    if (!res.ok) { toast('error', res.erro); return; }
    toast('success', 'Formação enviada!');
    if (Math.random() < 0.1) setOlho(true);
    getEnvios().then((e) => setEnvios(e || []));
  }

  // ════════ Login ════════
  if (!logado) {
    return (
      <Card style={{ animationDelay: '.05s' }}>
        <SectionLabel icon={IconLock}>Área do trainee</SectionLabel>
        <p className="text-xs text-muted mb-3">
          Entre com a senha de trainee para ver a formação da semana e enviar a sua.
        </p>
        {alertaLogin && <Alert tipo={alertaLogin.tipo} msg={alertaLogin.msg} />}
        <input
          type="password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && entrar()}
          placeholder="Senha de trainee"
          className="w-full px-3.5 py-3 rounded-lg text-base outline-none focus:border-bordo mb-3"
        />
        <Button onClick={entrar} loading={entrando}>Entrar</Button>
      </Card>
    );
  }

  // ════════ Carregando ════════
  if (carregando && trainees.length === 0) {
    return (
      <Card style={{ animationDelay: '.05s' }}>
        <SectionLabel icon={IconUser}>Área do trainee</SectionLabel>
        <div className="skeleton h-20 rounded-xl2" />
      </Card>
    );
  }

  // ════════ Quem é você ════════
  if (!eu) {
    return (
      <Card style={{ animationDelay: '.05s' }}>
        <SectionLabel icon={IconUser} right={
          <button onClick={sair} className="text-[11px] text-muted hover:text-bordo">sair</button>
        }>
          Quem é você?
        </SectionLabel>
        <p className="text-xs text-muted mb-3">
          Escolha o seu nome na lista de trainees. Ele fica salvo neste aparelho.
        </p>
        <Autocomplete
          value={nome}
          onChange={escolherNome}
          options={trainees.map((t) => t.nome)}
          placeholder="Digite o seu nome"
          invalid={!!nome && !nomeOk}
        />
        {!!nome && !nomeOk && (
          <p className="text-[11px] text-danger mt-2">
            Escolha um nome da lista. Se o seu não aparece, fale com a diretoria.
          </p>
        )}
        {!carregando && trainees.length === 0 && (
          <p className="text-[11px] text-muted mt-2">
            Nenhum trainee cadastrado nesta temporada ainda.
          </p>
        )}
      </Card>
    );
  }

  // ════════ Formações ════════
  const propsCartao = (d, e) => {
    const sem = semanaDe(d.semana_id);
    return {
      d, e, hoje, sem,
      numero: numeroSemana(d.semana_id),
      daSemanaAtual: !!(semanaAtual && sem && sem.id === semanaAtual.id),
      ocupado: enviando === d.id,
      onArquivo,
      refInput: (el) => { inputs.current[d.id] = el; },
    };
  };

  const comEnvio = demandas.map((d) => ({ d, e: envioDe(d.id) }));
  const abertas = comEnvio.filter((x) => !x.e || !x.e.verificado_em)
    .sort((a, b) => a.d.prazo.localeCompare(b.d.prazo));
  const concluidas = comEnvio.filter((x) => x.e && x.e.verificado_em)
    .sort((a, b) => b.d.prazo.localeCompare(a.d.prazo));

  return (
    <div className="space-y-3">
      {olho && <OlhoBigBrother onFechar={() => setOlho(false)} />}

      <Card style={{ animationDelay: '.05s' }}>
        <SectionLabel icon={IconUser} right={
          <button onClick={sair} className="text-[11px] text-muted hover:text-bordo">sair</button>
        }>
          Área do trainee
        </SectionLabel>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="text-[15px] font-semibold">{eu.nome}</div>
            {eu.mentor && <div className="text-[11px] text-muted">Mentor: {eu.mentor}</div>}
          </div>
          <button onClick={() => { setNome(''); setNomeOk(false); salvarSessao(senha, ''); }}
            className="text-[11px] text-muted border border-border rounded-lg px-3 py-1.5
              hover:border-bordo hover:text-bordo transition">
            Não sou eu
          </button>
        </div>
      </Card>

      <Card style={{ animationDelay: '.09s' }}>
        <SectionLabel icon={IconClock}>Formações em aberto</SectionLabel>
        {carregando && <div className="skeleton h-24 rounded-xl2" />}
        {!carregando && abertas.length === 0 && (
          <p className="text-sm text-muted py-2">
            Nada pendente. Quando a diretoria publicar a formação da semana, ela aparece aqui.
          </p>
        )}
        <div className="space-y-3">
          {abertas.map(({ d, e }) => <Cartao key={d.id} {...propsCartao(d, e)} />)}
        </div>
        <p className="text-[11px] text-muted mt-3">
          Entrega fora do prazo é aceita — fica só marcada como atrasada. Dá para reenviar
          enquanto a diretoria não verificar.
        </p>
      </Card>

      {concluidas.length > 0 && (
        <Card style={{ animationDelay: '.13s' }}>
          <SectionLabel icon={IconCheck}>Já verificadas</SectionLabel>
          <div className="space-y-3">
            {concluidas.map(({ d, e }) => <Cartao key={d.id} {...propsCartao(d, e)} />)}
          </div>
        </Card>
      )}
    </div>
  );
}

function Cartao({ d, e, hoje, sem, numero, daSemanaAtual, ocupado, onArquivo, refInput }) {
  const atrasadoAgora = !e && d.prazo < hoje;

  return (
    <div className={`rounded-xl2 border p-4 bg-surface-2 transition
      ${daSemanaAtual ? 'border-bordo/60' : 'border-border'}`}>
      <div className="flex items-start justify-between gap-3 mb-1.5 flex-wrap">
        <div className="text-[10px] uppercase tracking-wider text-muted">
          {numero ? `Semana ${numero}` : 'Semana'}
          {sem && <> · {fmtCurto(sem.data_inicio)} a {fmtCurto(sem.data_fim)}</>}
          {daSemanaAtual && <span className="text-gold"> · esta semana</span>}
        </div>
        <Etiqueta envio={e} atrasadoAgora={atrasadoAgora} />
      </div>

      <div className="text-[15px] font-semibold mb-1">{d.titulo}</div>
      {d.descricao && (
        <p className="text-[13px] text-muted whitespace-pre-wrap mb-2">{d.descricao}</p>
      )}
      <div className="text-[11px] text-muted mb-3">Prazo: {fmtBR(d.prazo)}</div>

      {e && !e.imagem_apagada && (
        <a href={urlDaImagem(e.path)} target="_blank" rel="noreferrer"
          className="block mb-3 rounded-lg overflow-hidden border border-border max-w-[220px]">
          <img src={urlDaImagem(e.path)} alt="Formação enviada"
            loading="lazy" className="w-full h-auto block" />
        </a>
      )}

      {!e || !e.verificado_em ? (
        <>
          <input
            ref={refInput}
            id={`arq-${d.id}`}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(ev) => onArquivo(d.id, ev.target.files && ev.target.files[0])}
          />
          <label htmlFor={`arq-${d.id}`}
            className={`inline-flex items-center gap-2 text-[12px] rounded-lg px-3.5 py-2.5
              border transition cursor-pointer
              ${ocupado
                ? 'border-border text-muted cursor-wait'
                : 'border-bordo text-bordo hover:bg-[#c140591a]'}`}>
            <IconUpload className="w-4 h-4" />
            {ocupado ? 'Enviando…' : (e ? 'Enviar outra imagem' : 'Enviar imagem')}
          </label>
        </>
      ) : (
        <div className="inline-flex items-center gap-2 text-[12px] text-success">
          <IconCheck className="w-4 h-4" />
          Verificada pela diretoria
        </div>
      )}
    </div>
  );
}

function Etiqueta({ envio, atrasadoAgora }) {
  const base = 'text-[10px] uppercase tracking-wider border rounded-full px-2 py-0.5 whitespace-nowrap';
  if (envio && envio.verificado_em) {
    return <span className={`${base} text-success border-[#4caf7d80]`}>Verificada</span>;
  }
  if (envio && envio.atrasado) {
    return <span className={`${base} text-gold border-[#cda96380]`}>Enviada · atrasada</span>;
  }
  if (envio) {
    return <span className={`${base} text-bordo border-[#c1405980]`}>Enviada</span>;
  }
  if (atrasadoAgora) {
    return <span className={`${base} text-danger border-[#e0625a80]`}>Atrasada</span>;
  }
  return <span className={`${base} text-muted border-border`}>Pendente</span>;
}
