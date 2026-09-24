'use client';
import { useState, useEffect, useRef } from 'react';
import Card, { SectionLabel } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import IconButton from '@/components/ui/IconButton';
import LinkButton from '@/components/ui/LinkButton';
import Alert from '@/components/ui/Alert';
import FormSenha from '@/components/ui/FormSenha';
import TextoComLinks from '@/components/ui/TextoComLinks';
import Autocomplete from '@/components/ui/Autocomplete';
import OlhoBigBrother from '@/components/ui/OlhoBigBrother';
import Visualizador from '@/components/ui/Visualizador';
import {
  IconLock, IconUser, IconUpload, IconCheck, IconClock, IconTrash, IconWhatsapp,
} from '@/components/ui/Icons';
import {
  verificarSenhaTrainee, getTrainees, getTraineeSemanas, getFormacoes,
  enviarFormacao, removerImagemFormacao, urlDaImagem,
  traineeTemWhatsapp, traineeWhatsappMascarado, salvarWhatsappTrainee,
} from '@/lib/supabase';
import { comprimirImagem } from '@/lib/imagem';
import { mascararWhatsapp, normalizarWhatsapp, ocultarWhatsapp } from '@/lib/whatsapp';
import { toast } from '@/lib/toast';
import { fmtBR, fmtCurto, hojeISO } from '@/lib/datas';

const SESSAO = 'uspd_trainee';
const MAX_IMAGENS = 4;
// Chance de o easter egg aparecer num envio bem-sucedido.
const CHANCE_OLHO = 0.1;
const DIAS = 30 * 24 * 60 * 60 * 1000;

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
  const [erroDados, setErroDados] = useState(null);

  const [nome, setNome] = useState('');
  const [nomeOk, setNomeOk] = useState(false);
  const [enviando, setEnviando] = useState(null);   // id da demanda em envio
  const [olho, setOlho] = useState(false);
  const [visual, setVisual] = useState(null);   // { urls, indice }
  const [zap, setZap] = useState(null);   // null = conferindo · true/false = tem WhatsApp
  const [trocandoZap, setTrocandoZap] = useState(false);
  const [zapAtual, setZapAtual] = useState(null);   // número mascarado, ex.: (11) •••••-5678
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
    Promise.all([getTrainees(), getTraineeSemanas(), getFormacoes()])
      .then(([tr, sem, f]) => {
        setTrainees(tr || []);
        setSemanas(sem || []);
        setDemandas(f.demandas || []);
        setEnvios(f.envios || []);
        setErroDados(f.erro || null);
        setCarregando(false);
      })
      .catch((e) => { setErroDados(String(e.message || e)); setCarregando(false); });
  }

  function recarregarEnvios() {
    getFormacoes().then((f) => {
      setDemandas(f.demandas || []);
      setEnvios(f.envios || []);
      setErroDados(f.erro || null);
    });
  }

  async function entrar() {
    setEntrando(true);
    const ok = await verificarSenhaTrainee(senha);
    setEntrando(false);
    if (!ok) { setAlertaLogin({ tipo: 'error', msg: ok === null ? 'Sem conexão com o servidor. Confira a internet e tente de novo.' : 'Senha incorreta.' }); return; }
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
    setLogado(false); setSenha(''); setNome(''); setNomeOk(false); setTrocandoZap(false);
  }

  function naoSouEu() {
    setNome(''); setNomeOk(false); setTrocandoZap(false); salvarSessao(senha, '');
  }

  function escolherNome(v, daLista) {
    setNome(v);
    setNomeOk(daLista);
    if (daLista) salvarSessao(senha, v);
  }

  const eu = trainees.find((t) => t.nome === nome) || null;
  const euId = eu ? eu.pessoaId : null;

  // Primeiro acesso = a pessoa ainda não tem WhatsApp no banco (vale para
  // qualquer aparelho, não só este).
  useEffect(() => {
    if (!logado || !euId) { setZap(null); return undefined; }
    let vivo = true;
    setZap(null);
    Promise.all([
      traineeTemWhatsapp({ senha, pessoaId: euId }),
      traineeWhatsappMascarado({ senha, pessoaId: euId }),
    ]).then(([r, m]) => {
      if (!vivo) return;
      // Se a checagem falhar (ex.: whatsapp.sql ainda não rodado), não trava o trainee.
      setZap(r.ok ? r.tem : true);
      setZapAtual(m.ok ? m.numero : null);
    });
    return () => { vivo = false; };
  }, [logado, euId, senha]);
  const semanaDe = (id) => semanas.find((s) => s.id === id) || null;
  const numeroSemana = (id) => {
    const i = semanas.findIndex((s) => s.id === id);
    return i < 0 ? null : i + 1;
  };
  const envioDe = (demandaId) =>
    envios.find((e) => e.demanda_id === demandaId && eu && e.pessoa_id === eu.pessoaId) || null;

  const hoje = hojeISO();
  const semanaAtual = semanas.find((s) => hoje >= s.data_inicio && hoje <= s.data_fim) || null;

  async function onArquivos(demandaId, files) {
    const lista = Array.from(files || []);
    if (!lista.length || !eu) return;
    const atual = envioDe(demandaId);
    const jaTem = atual && atual.paths ? atual.paths.length : 0;
    const cabem = MAX_IMAGENS - jaTem;
    if (cabem <= 0) {
      toast('error', `Já são ${MAX_IMAGENS} imagens nesta formação. Remova uma antes.`);
      return;
    }
    if (lista.length > cabem) {
      toast('info', `Cabem mais ${cabem} imagem(ns) nesta formação — o resto foi ignorado.`);
    }

    setEnviando(demandaId);
    let enviadas = 0;
    let erro = null;
    for (const f of lista.slice(0, cabem)) {
      const c = await comprimirImagem(f);
      if (c.erro) { erro = c.erro; continue; }
      const res = await enviarFormacao({
        senha, pessoaId: eu.pessoaId, demandaId, blob: c.blob, ext: c.ext,
      });
      if (res.ok) enviadas += 1; else erro = res.erro;
    }
    setEnviando(null);
    if (inputs.current[demandaId]) inputs.current[demandaId].value = '';

    if (enviadas > 0) {
      toast('success', enviadas === 1 ? 'Formação enviada!' : `${enviadas} imagens enviadas!`);
      if (Math.random() < CHANCE_OLHO) setOlho(true);
    }
    if (erro) toast('error', erro);
    recarregarEnvios();
  }

  async function removerImagem(demandaId, path) {
    const res = await removerImagemFormacao({
      senha, pessoaId: eu.pessoaId, demandaId, path,
    });
    if (!res.ok) { toast('error', res.erro); return; }
    toast('success', 'Imagem removida.');
    recarregarEnvios();
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
        <FormSenha usuario="trainee" rotulo="Senha de trainee"
          value={senha} onChange={setSenha} onEntrar={entrar} loading={entrando} />
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
          <LinkButton variant="plain" onClick={sair}>sair</LinkButton>
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

  // ════════ WhatsApp (primeiro acesso ou troca) ════════
  if (zap === null) {
    return (
      <Card style={{ animationDelay: '.05s' }}>
        <SectionLabel icon={IconUser}>Área do trainee</SectionLabel>
        <div className="skeleton h-20 rounded-xl2" />
      </Card>
    );
  }
  if (!zap || trocandoZap) {
    return (
      <CadastroWhatsapp
        senha={senha}
        eu={eu}
        primeiroAcesso={!zap}
        numeroAtual={zapAtual}
        onSalvo={(numero) => {
          setZap(true); setZapAtual(ocultarWhatsapp(numero)); setTrocandoZap(false);
        }}
        onCancelar={() => setTrocandoZap(false)}
        onNaoSouEu={naoSouEu}
      />
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
      onArquivos,
      onRemover: removerImagem,
      onAbrir: (urls, indice) => setVisual({ urls, indice }),
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
      {erroDados && (
        <Alert tipo="error"
          msg={'Não consegui ler as formações: ' + erroDados
            + '. Se fala em coluna "paths", falta rodar o formacoes.sql no Supabase.'} />
      )}
      {visual && (
        <Visualizador urls={visual.urls} indice={visual.indice}
          onFechar={() => setVisual(null)} />
      )}

      <Card style={{ animationDelay: '.05s' }}>
        <SectionLabel icon={IconUser} right={
          <LinkButton variant="plain" onClick={sair}>sair</LinkButton>
        }>
          Área do trainee
        </SectionLabel>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="text-[15px] font-semibold">{eu.nome}</div>
            {eu.mentor && <div className="text-[11px] text-muted">Mentor: {eu.mentor}</div>}
          </div>
          <LinkButton onClick={naoSouEu}>Não sou eu</LinkButton>
        </div>
        <div className="mt-3 pt-3 border-t border-border flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-[12px] min-w-0">
            <IconWhatsapp className="w-4 h-4 shrink-0 text-[#25d366]" />
            <span className="text-muted">WhatsApp:</span>
            <span className="text-text whitespace-nowrap">{zapAtual || 'cadastrado'}</span>
          </div>
          <LinkButton onClick={() => setTrocandoZap(true)}>Número errado? Trocar</LinkButton>
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

function CadastroWhatsapp({
  senha, eu, primeiroAcesso, numeroAtual, onSalvo, onCancelar, onNaoSouEu,
}) {
  const [valor, setValor] = useState('');
  const [erro, setErro] = useState(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    const numero = normalizarWhatsapp(valor);
    if (!numero) {
      setErro('Número inválido. Use DDD + celular, ex.: (11) 91234-5678.');
      return;
    }
    setSalvando(true);
    const res = await salvarWhatsappTrainee({ senha, pessoaId: eu.pessoaId, whatsapp: numero });
    setSalvando(false);
    if (!res.ok) { setErro(res.erro); return; }
    toast('success', 'WhatsApp salvo.');
    onSalvo(numero);
  }

  return (
    <Card style={{ animationDelay: '.05s' }}>
      <SectionLabel icon={IconWhatsapp} right={primeiroAcesso
        ? <LinkButton variant="plain" onClick={onNaoSouEu}>não sou eu</LinkButton>
        : <LinkButton variant="plain" onClick={onCancelar}>cancelar</LinkButton>
      }>
        {primeiroAcesso ? 'Primeiro acesso' : 'Trocar WhatsApp'}
      </SectionLabel>
      <p className="text-xs text-muted mb-3">
        {primeiroAcesso
          ? <>Olá, <span className="text-text">{eu.nome}</span>! Antes de continuar, informe o
            seu número de WhatsApp.</>
          : <>
            {numeroAtual && <>Número atual: <span className="text-text">{numeroAtual}</span>. </>}
            Informe o número certo de WhatsApp de <span className="text-text">{eu.nome}</span>.
          </>}
        {' '}A diretoria usa só para avisar sobre as formações — ele não aparece para os
        outros trainees.
      </p>
      {erro && <Alert tipo="error" msg={erro} />}
      <input
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        value={valor}
        onChange={(ev) => { setValor(mascararWhatsapp(ev.target.value)); setErro(null); }}
        onKeyDown={(ev) => ev.key === 'Enter' && salvar()}
        placeholder="(11) 91234-5678"
        className="w-full px-3.5 py-3 rounded-lg text-base outline-none focus:border-bordo mb-3"
      />
      <Button onClick={salvar} loading={salvando}>
        {primeiroAcesso ? 'Salvar e continuar' : 'Salvar'}
      </Button>
    </Card>
  );
}

function Cartao({ d, e, hoje, sem, numero, daSemanaAtual, ocupado,
  onArquivos, onRemover, onAbrir, refInput }) {
  const atrasadoAgora = !e && d.prazo < hoje;
  const paths = (e && e.paths) || [];
  const urls = paths.map(urlDaImagem);
  const verificada = !!(e && e.verificado_em);
  const cheio = paths.length >= MAX_IMAGENS;

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
        <p className="text-[13px] text-muted whitespace-pre-wrap break-words mb-2"><TextoComLinks texto={d.descricao} /></p>
      )}
      <div className="text-[11px] text-muted mb-3">Prazo: {fmtBR(d.prazo)}</div>

      {e && e.imagem_apagada && (
        <p className="text-[11px] text-muted mb-3">
          As imagens desta entrega já foram apagadas do armazenamento.
        </p>
      )}

      {paths.length > 0 && !e.imagem_apagada && (
        <div className="flex gap-2 flex-wrap mb-3">
          {paths.map((pth, k) => (
            <div key={pth} className="relative">
              <button onClick={() => onAbrir(urls, k)}
                className="block w-20 h-20 rounded-lg overflow-hidden border border-border
                  hover:border-bordo transition">
                <img src={urls[k]} alt={`Imagem ${k + 1}`} loading="lazy"
                  className="w-full h-full object-cover" />
              </button>
              {!verificada && (
                <IconButton
                  onClick={() => onRemover(d.id, pth)}
                  title="Remover esta imagem"
                  variant="danger"
                  className="absolute -top-1.5 -right-1.5">
                  <IconTrash className="w-3 h-3" />
                </IconButton>
              )}
            </div>
          ))}
        </div>
      )}

      {!verificada ? (
        <div className="flex items-center gap-3 flex-wrap">
          <input
            ref={refInput}
            id={`arq-${d.id}`}
            type="file"
            accept="image/*"
            multiple
            className="peer sr-only"
            disabled={ocupado || cheio}
            onChange={(ev) => onArquivos(d.id, ev.target.files)}
          />
          <label htmlFor={`arq-${d.id}`}
            className={`inline-flex items-center gap-2 text-[12px] rounded-lg px-3.5 py-2.5
              border transition peer-focus-visible:ring-2 peer-focus-visible:ring-bordo
              ${ocupado || cheio
                ? 'border-border text-muted cursor-not-allowed'
                : 'border-bordo text-bordo hover:bg-[#c140591a] cursor-pointer'}`}>
            <IconUpload className="w-4 h-4" />
            {ocupado
              ? 'Enviando…'
              : cheio
                ? `Limite de ${MAX_IMAGENS} imagens`
                : (paths.length ? 'Adicionar imagem' : 'Enviar imagem')}
          </label>
          <span className="text-[11px] text-muted">
            {paths.length} de {MAX_IMAGENS} imagens
            {!cheio && ' · dá para escolher várias de uma vez'}
          </span>
        </div>
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
