'use client';
import { useState, useEffect } from 'react';
import Card, { SectionLabel } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Alert from '@/components/ui/Alert';
import ConfirmModal from '@/components/ui/ConfirmModal';
import DataBR from '@/components/ui/DataBR';
import TextoComLinks from '@/components/ui/TextoComLinks';
import Visualizador from '@/components/ui/Visualizador';
import WhatsappLink from '@/components/ui/WhatsappLink';
import { IconPlus, IconCheck, IconImage, IconTrash, IconClock } from '@/components/ui/Icons';
import {
  getTraineeSemanas, getTrainees, getFormacoes, criarDemanda, editarDemanda,
  apagarDemanda, verificarFormacoes, apagarEnvio, limparImagensFormacao, urlDaImagem,
  getWhatsappTrainees,
} from '@/lib/supabase';
import { toast } from '@/lib/toast';
import { fmtBR, fmtCurto, isoDe } from '@/lib/datas';

function isoMenos(dias) {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return isoDe(d);
}

export default function FormacoesArea({ senha }) {
  const [semanas, setSemanas] = useState([]);
  const [trainees, setTrainees] = useState([]);
  const [demandas, setDemandas] = useState([]);
  const [envios, setEnvios] = useState([]);
  const [zaps, setZaps] = useState(new Map());   // pessoaId -> WhatsApp
  const [erroZap, setErroZap] = useState(null);
  const [carregando, setCarregando] = useState(true);

  const [nova, setNova] = useState({ semanaId: '', titulo: '', descricao: '', prazo: '' });
  const [editando, setEditando] = useState(null);   // { id, titulo, descricao, prazo }
  const [demandaSel, setDemandaSel] = useState(null);
  const [sel, setSel] = useState(new Set());
  const [visual, setVisual] = useState(null);   // { urls, indice }
  const [alerta, setAlerta] = useState(null);
  const [confirmar, setConfirmar] = useState(null); // { titulo, mensagem, acao }
  const [limpezaAntes, setLimpezaAntes] = useState(isoMenos(28));

  function recarregar() {
    setCarregando(true);
    Promise.all([getTraineeSemanas(), getTrainees(), getFormacoes(), getWhatsappTrainees(senha)])
      .then(([sem, tr, f, zp]) => {
        setSemanas(sem || []);
        setTrainees(tr || []);
        setZaps(zp.mapa);
        setErroZap(zp.erro);
        setDemandas(f.demandas || []);
        setEnvios(f.envios || []);
        setAlerta(f.erro
          ? { tipo: 'error', msg: 'Não consegui ler as formações: ' + f.erro
              + '. Se fala em coluna "paths", falta rodar o formacoes.sql no Supabase.' }
          : null);
        setCarregando(false);
      })
      .catch((e) => {
        setAlerta({ tipo: 'error', msg: String(e.message || e) });
        setCarregando(false);
      });
  }
  useEffect(() => { recarregar(); }, []);

  const numeroSemana = (id) => {
    const i = semanas.findIndex((s) => s.id === id);
    return i < 0 ? null : i + 1;
  };
  const rotuloSemana = (id) => {
    const s = semanas.find((x) => x.id === id);
    if (!s) return 'Semana';
    return `Semana ${numeroSemana(id)} · ${fmtCurto(s.data_inicio)} a ${fmtCurto(s.data_fim)}`;
  };

  async function salvarNova() {
    if (!nova.semanaId) { setAlerta({ tipo: 'error', msg: 'Escolha a semana.' }); return; }
    if (nova.titulo.trim().length < 2) {
      setAlerta({ tipo: 'error', msg: 'Dê um título para a formação.' }); return;
    }
    const sem = semanas.find((s) => String(s.id) === String(nova.semanaId));
    const prazo = nova.prazo || (sem ? sem.data_fim : null);
    if (!prazo) { setAlerta({ tipo: 'error', msg: 'Informe o prazo.' }); return; }
    const ordem = demandas.filter((d) => String(d.semana_id) === String(nova.semanaId)).length + 1;
    const res = await criarDemanda({
      senha, semanaId: Number(nova.semanaId), titulo: nova.titulo,
      descricao: nova.descricao, prazo, ordem,
    });
    if (!res.ok) { setAlerta({ tipo: 'error', msg: res.erro }); return; }
    setAlerta(null);
    setNova({ semanaId: nova.semanaId, titulo: '', descricao: '', prazo: '' });
    toast('success', 'Formação publicada.');
    recarregar();
  }

  async function salvarEdicao() {
    const res = await editarDemanda({
      senha, id: editando.id, titulo: editando.titulo,
      descricao: editando.descricao, prazo: editando.prazo,
    });
    if (!res.ok) { toast('error', res.erro); return; }
    setEditando(null);
    toast('success', 'Formação atualizada.');
    recarregar();
  }

  function pedirApagarDemanda(d) {
    const n = envios.filter((e) => e.demanda_id === d.id).length;
    setConfirmar({
      titulo: 'Apagar esta formação?',
      mensagem: `“${d.titulo}” e os ${n} envio(s) dela serão apagados. Não dá para desfazer.`,
      acao: async () => {
        const res = await apagarDemanda({ senha, id: d.id });
        if (!res.ok) { toast('error', res.erro); return; }
        if (demandaSel === d.id) setDemandaSel(null);
        toast('success', 'Formação apagada.');
        recarregar();
      },
    });
  }

  async function marcar(verificado) {
    const ids = [...sel];
    if (!ids.length) return;
    const res = await verificarFormacoes({ senha, ids, verificado });
    if (!res.ok) { toast('error', res.erro); return; }
    toast('success', verificado
      ? `${ids.length} formação(ões) verificada(s).`
      : `${ids.length} verificação(ões) desfeita(s).`);
    setSel(new Set());
    recarregar();
  }

  function pedirRecusar(envio, nome) {
    setConfirmar({
      titulo: 'Recusar este envio?',
      mensagem: `As imagens de ${nome} são apagadas e ele(a) pode enviar de novo.`,
      acao: async () => {
        const res = await apagarEnvio({ senha, id: envio.id });
        if (!res.ok) { toast('error', res.erro); return; }
        toast('success', 'Envio recusado.');
        recarregar();
      },
    });
  }

  function pedirLimpeza() {
    setConfirmar({
      titulo: 'Apagar imagens antigas?',
      mensagem: `As imagens de formações com prazo anterior a ${fmtBR(limpezaAntes)} serão apagadas do armazenamento. O registro de quem entregou e foi verificado continua. Só sai o que já tem mais de 7 dias.`,
      acao: async () => {
        const res = await limparImagensFormacao({ senha, antes: limpezaAntes });
        if (!res.ok) { toast('error', res.erro); return; }
        toast('success', `${res.n} imagem(ns) apagada(s).`);
        recarregar();
      },
    });
  }

  // ── Grid de verificação ──
  const demanda = demandas.find((d) => d.id === demandaSel) || null;
  const linhas = demanda
    ? trainees.map((t) => ({
      t,
      e: envios.find((x) => x.demanda_id === demanda.id && x.pessoa_id === t.pessoaId) || null,
    }))
    : [];
  const entregues = linhas.filter((l) => l.e);
  const verificadas = entregues.filter((l) => l.e.verificado_em);
  const atrasadas = entregues.filter((l) => l.e.atrasado);

  // Mensagem já pronta no WhatsApp: quem não entregou recebe a cobrança.
  const mensagemPara = (t, e) => {
    const primeiro = t.nome.split(' ')[0];
    if (e) return `Oi, ${primeiro}! Aqui é da diretoria da USP Debate.`;
    return `Oi, ${primeiro}! Aqui é da diretoria da USP Debate. Ainda não recebemos a sua `
      + `formação “${demanda.titulo}” (prazo ${fmtBR(demanda.prazo)}). `
      + 'Consegue enviar pela área do trainee do site?';
  };

  const urlsDe = (e) =>
    (e && !e.imagem_apagada && Array.isArray(e.paths) ? e.paths : []).map(urlDaImagem);

  function toggleSel(id) {
    setSel((cur) => {
      const novo = new Set(cur);
      if (novo.has(id)) novo.delete(id); else novo.add(id);
      return novo;
    });
  }

  return (
    <div className="space-y-3">
      {alerta && <Alert tipo={alerta.tipo} msg={alerta.msg} />}
      {erroZap && (
        <Alert tipo="error"
          msg={'Não consegui ler os WhatsApps dos trainees: ' + erroZap
            + '. Se fala em função não encontrada, falta rodar o whatsapp.sql no Supabase.'} />
      )}

      {/* Publicar formação */}
      <Card style={{ animationDelay: '.05s' }}>
        <SectionLabel icon={IconPlus}>Publicar formação da semana</SectionLabel>
        {semanas.length === 0 ? (
          <p className="text-sm text-muted py-2">
            Crie uma semana em Trainees antes de publicar uma formação.
          </p>
        ) : (
          <>
            <div className="grid sm:grid-cols-2 gap-2 mb-2">
              <select
                value={nova.semanaId}
                onChange={(e) => setNova({ ...nova, semanaId: e.target.value })}
                className="px-3 py-2.5 rounded-lg text-sm bg-surface-2 border border-border
                  text-text outline-none focus:border-bordo"
              >
                <option value="">Semana…</option>
                {semanas.map((s, i) => (
                  <option key={s.id} value={s.id}>
                    Semana {i + 1} · {fmtCurto(s.data_inicio)} a {fmtCurto(s.data_fim)}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={nova.titulo}
                onChange={(e) => setNova({ ...nova, titulo: e.target.value })}
                placeholder="Título (ex.: Ficha de argumentação)"
                className="px-3 py-2.5 rounded-lg text-sm bg-surface-2 border border-border
                  text-text outline-none focus:border-bordo"
              />
            </div>
            <textarea
              value={nova.descricao}
              onChange={(e) => setNova({ ...nova, descricao: e.target.value })}
              rows={3}
              placeholder="O que o trainee precisa entregar (opcional)"
              className="w-full px-3 py-2.5 rounded-lg text-sm bg-surface-2 border border-border
                text-text outline-none focus:border-bordo resize-y mb-2"
            />
            <div className="flex items-center gap-2 flex-wrap mb-3">
              <span className="text-[11px] text-muted">Prazo:</span>
              <DataBR value={nova.prazo} onCommit={(iso) => setNova({ ...nova, prazo: iso })} />
              <span className="text-[11px] text-muted">
                em branco = domingo da semana escolhida
              </span>
            </div>
            <Button onClick={salvarNova}>
              <span className="inline-flex items-center gap-2 justify-center">
                <IconPlus className="w-4 h-4" />Publicar formação
              </span>
            </Button>
            <p className="text-[11px] text-muted mt-2">
              Pode publicar mais de uma formação na mesma semana, e pode publicar para
              semanas passadas.
            </p>
          </>
        )}
      </Card>

      {/* Formações publicadas */}
      <Card style={{ animationDelay: '.09s' }}>
        <SectionLabel icon={IconClock}>Formações publicadas</SectionLabel>
        {carregando && <div className="skeleton h-20 rounded-xl2" />}
        {!carregando && demandas.length === 0 && (
          <p className="text-sm text-muted py-2">Nenhuma formação publicada ainda.</p>
        )}
        <div className="space-y-2">
          {demandas.map((d) => {
            const env = envios.filter((e) => e.demanda_id === d.id);
            const ver = env.filter((e) => e.verificado_em).length;
            const emEdicao = editando && editando.id === d.id;
            return (
              <div key={d.id}
                className={`rounded-xl border p-3 bg-surface-2 transition
                  ${demandaSel === d.id ? 'border-bordo/60' : 'border-border'}`}>
                {emEdicao ? (
                  <div className="space-y-2">
                    <input
                      type="text" value={editando.titulo}
                      onChange={(e) => setEditando({ ...editando, titulo: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg text-sm bg-surface border
                        border-border text-text outline-none focus:border-bordo"
                    />
                    <textarea
                      rows={2} value={editando.descricao || ''}
                      onChange={(e) => setEditando({ ...editando, descricao: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg text-sm bg-surface border
                        border-border text-text outline-none focus:border-bordo resize-y"
                    />
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] text-muted">Prazo:</span>
                      <DataBR value={editando.prazo}
                        onCommit={(iso) => setEditando({ ...editando, prazo: iso })} />
                      <button onClick={salvarEdicao}
                        className="text-[11px] text-success border border-[#4caf7d80] rounded-lg
                          px-3 py-1.5 hover:bg-[#4caf7d1a] transition">
                        Salvar
                      </button>
                      <button onClick={() => setEditando(null)}
                        className="text-[11px] text-muted border border-border rounded-lg
                          px-3 py-1.5 hover:border-bordo hover:text-bordo transition">
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="text-[10px] uppercase tracking-wider text-muted mb-1">
                      {rotuloSemana(d.semana_id)} · prazo {fmtBR(d.prazo)}
                    </div>
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div className="min-w-0">
                        <div className="text-[14px] font-semibold">{d.titulo}</div>
                        {d.descricao && (
                          <p className="text-[12px] text-muted whitespace-pre-wrap break-words mt-0.5">
                            <TextoComLinks texto={d.descricao} />
                          </p>
                        )}
                        <div className="text-[11px] text-muted mt-1">
                          {env.length} de {trainees.length} entregaram · {ver} verificada(s)
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => { setDemandaSel(demandaSel === d.id ? null : d.id); setSel(new Set()); }}
                          className="text-[11px] text-bordo border border-bordo rounded-lg px-3 py-1.5
                            hover:bg-[#c140591a] transition whitespace-nowrap">
                          {demandaSel === d.id ? 'Fechar' : 'Verificar'}
                        </button>
                        <button
                          onClick={() => setEditando({
                            id: d.id, titulo: d.titulo, descricao: d.descricao || '', prazo: d.prazo,
                          })}
                          className="text-[11px] text-muted border border-border rounded-lg px-3 py-1.5
                            hover:border-bordo hover:text-bordo transition">
                          Editar
                        </button>
                        <button onClick={() => pedirApagarDemanda(d)} aria-label={`Apagar demanda ${d.titulo}`} title="Apagar demanda" className="text-danger p-1.5">
                          <IconTrash className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Grid de verificação */}
      {demanda && (
        <Card style={{ animationDelay: '.13s' }}>
          <SectionLabel icon={IconImage}>Verificar — {demanda.titulo}</SectionLabel>
          <p className="text-[11px] text-muted mb-3">
            {entregues.length} de {trainees.length} entregaram · {verificadas.length} verificada(s)
            {atrasadas.length > 0 && <> · {atrasadas.length} atrasada(s)</>}
          </p>

          <div className="flex items-center gap-2 flex-wrap mb-3">
            <span className="text-[11px] text-muted">{sel.size} selecionada(s)</span>
            <button
              onClick={() => marcar(true)} disabled={sel.size === 0}
              className="text-[11px] text-success border border-[#4caf7d80] rounded-lg px-3 py-1.5
                transition hover:bg-[#4caf7d1a] disabled:opacity-40 disabled:cursor-not-allowed">
              Marcar verificadas
            </button>
            <button
              onClick={() => marcar(false)} disabled={sel.size === 0}
              className="text-[11px] text-muted border border-border rounded-lg px-3 py-1.5
                transition hover:border-bordo hover:text-bordo
                disabled:opacity-40 disabled:cursor-not-allowed">
              Desfazer verificação
            </button>
            <button
              onClick={() => setSel(new Set(entregues.filter((l) => !l.e.verificado_em).map((l) => l.e.id)))}
              className="text-[11px] text-muted border border-border rounded-lg px-3 py-1.5
                hover:border-bordo hover:text-bordo transition">
              Selecionar pendentes
            </button>
            {sel.size > 0 && (
              <button onClick={() => setSel(new Set())}
                className="text-[11px] text-muted border border-border rounded-lg px-3 py-1.5
                  hover:border-bordo hover:text-bordo transition">
                Limpar
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {linhas.map(({ t, e }) => {
              const marcada = e && sel.has(e.id);
              return (
                <div key={t.pessoaId}
                  className={`rounded-xl border overflow-hidden bg-surface-2 transition
                    ${marcada ? 'border-bordo' : 'border-border'}`}>
                  <div className="relative aspect-[4/3] bg-[#120c0e] grid place-items-center overflow-hidden">
                    {urlsDe(e).length > 0 ? (
                      <>
                        <img
                          src={urlsDe(e)[0]} alt={t.nome} loading="lazy"
                          onClick={() => setVisual({ urls: urlsDe(e), indice: 0 })}
                          className="w-full h-full object-cover cursor-zoom-in"
                        />
                        {urlsDe(e).length > 1 && (
                          <span className="absolute bottom-1.5 right-1.5 text-[10px] font-semibold
                            rounded-full px-2 py-0.5 bg-black/70 text-[#f6f2f3]">
                            {urlsDe(e).length} imagens
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-[10px] uppercase tracking-wider text-muted px-2 text-center">
                        {e ? 'imagem apagada' : 'não entregou'}
                      </span>
                    )}
                  </div>
                  <div className="p-2.5">
                    <div className="flex items-start justify-between gap-1">
                      <label className={`flex items-start gap-2 min-w-0 ${e ? 'cursor-pointer' : ''}`}>
                        {e && (
                          <input
                            type="checkbox" checked={marcada}
                            onChange={() => toggleSel(e.id)}
                            className="w-4 h-4 mt-0.5 shrink-0 accent-[#c14059]"
                          />
                        )}
                        <span className="text-[12px] font-semibold leading-tight break-words">
                          {t.nome}
                        </span>
                      </label>
                      <WhatsappLink numero={zaps.get(t.pessoaId)} nome={t.nome}
                        texto={mensagemPara(t, e)} className="-mt-1.5 -mr-1.5" />
                    </div>
                    <div className="flex items-center justify-between gap-1 mt-1.5">
                      <Etiqueta envio={e} prazo={demanda.prazo} />
                      {e && (
                        <button onClick={() => pedirRecusar(e, t.nome)}
                          className="text-[10px] text-danger hover:underline whitespace-nowrap">
                          recusar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {trainees.length === 0 && (
            <p className="text-sm text-muted py-2">Nenhum trainee cadastrado nesta temporada.</p>
          )}
        </Card>
      )}

      {/* Limpeza */}
      <Card style={{ animationDelay: '.17s' }}>
        <SectionLabel icon={IconTrash}>Limpar imagens antigas</SectionLabel>
        <p className="text-xs text-muted mb-3">
          As imagens só precisam existir até a verificação. Apagar as antigas mantém o
          armazenamento folgado — o registro de quem entregou e foi verificado continua.
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] text-muted">Com prazo anterior a</span>
          <DataBR value={limpezaAntes} onCommit={setLimpezaAntes} />
          <button onClick={pedirLimpeza}
            className="text-[11px] text-danger border border-[#e0625a66] rounded-lg px-3 py-1.5
              hover:bg-[#e0625a1a] transition">
            Apagar imagens
          </button>
        </div>
      </Card>

      {visual && (
        <Visualizador urls={visual.urls} indice={visual.indice}
          onFechar={() => setVisual(null)} />
      )}

      <ConfirmModal
        aberto={!!confirmar}
        titulo={confirmar ? confirmar.titulo : ''}
        mensagem={confirmar ? confirmar.mensagem : ''}
        textoConfirmar="Confirmar"
        variantConfirmar="danger"
        onConfirmar={() => { const a = confirmar.acao; setConfirmar(null); a(); }}
        onCancelar={() => setConfirmar(null)}
      />
    </div>
  );
}

function Etiqueta({ envio, prazo }) {
  const base = 'text-[9px] uppercase tracking-wider border rounded-full px-1.5 py-0.5 whitespace-nowrap';
  if (!envio) {
    return <span className={`${base} text-muted border-border`}>Pendente</span>;
  }
  if (envio.verificado_em) {
    return (
      <span className={`${base} text-success border-[#4caf7d80] inline-flex items-center gap-1`}>
        <IconCheck className="w-2.5 h-2.5" />Verificada
      </span>
    );
  }
  if (envio.atrasado) {
    return <span className={`${base} text-gold border-[#cda96380]`}>Atrasada</span>;
  }
  return <span className={`${base} text-bordo border-[#c1405980]`}>Enviada</span>;
}
