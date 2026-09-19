'use client';
import { useState, useEffect, useCallback } from 'react';
import Card, { SectionLabel } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Alert from '@/components/ui/Alert';
import Autocomplete from '@/components/ui/Autocomplete';
import LinkButton from '@/components/ui/LinkButton';
import { IconUsers, IconUser, IconEye, IconCheck, IconScale } from '@/components/ui/Icons';
import { listarPessoas, listarPresentesHoje, registrarPresenca, atualizarPresenca } from '@/lib/supabase';
import { toast } from '@/lib/toast';

const TIPOS = [
  { id: 'ps', label: 'Vou debater', Icon: IconUsers },
  { id: 'juiz', label: 'Vou ser juiz', Icon: IconScale },
  { id: 'observador', label: 'Só vou assistir', Icon: IconEye },
];

function iniciais(nome) {
  return nome.split(' ').map((x) => x[0]).slice(0, 2).join('').toUpperCase();
}

function SeletorTipo({ value, onChange }) {
  return (
    <div className="flex flex-col gap-2">
      {TIPOS.map((t) => {
        const ativo = value === t.id;
        const Ico = t.Icon;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className={`relative flex min-h-[80px] items-center overflow-visible text-left
              transition-all duration-300 ease-out
              ${ativo
                ? 'rounded-[30px_10px_30px_10px] bg-gradient-to-br from-bordo to-bordo-soft'
                : 'rounded-[20px_8px_20px_8px] bg-surface-2 border border-border hover:border-bordo/40'}`}
          >
            {ativo && (
              <span className="absolute -top-[10px] left-[18px] z-[2] -rotate-[4deg] rounded-full
                bg-white px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-wide text-bordo shadow-lg">
                ✓ selecionado
              </span>
            )}
            <span
              className={`absolute right-[18px] top-1/2 z-[1] flex h-10 w-10 shrink-0 -translate-y-1/2
                items-center justify-center rounded-full
                ${ativo ? 'bg-white/[0.13]' : 'bg-surface'}`}
            >
              <Ico className={`h-[19px] w-[19px] ${ativo ? 'text-white' : 'text-gold'}`} />
            </span>
            <span
              className={`relative z-[1] pl-6 pr-[78px] text-xl font-bold tracking-tight
                ${ativo ? 'text-white' : 'text-text'}`}
            >
              {t.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default function PresencaTab() {
  const [tipo, setTipo] = useState('ps');
  const [pessoas, setPessoas] = useState([]);       // [{id,nome,nome_norm}]
  const [modoNovo, setModoNovo] = useState(false);  // fluxo "primeira vez"
  const [nome, setNome] = useState('');
  const [nomeOk, setNomeOk] = useState(false);      // selecionou da lista
  const [dupla, setDupla] = useState('');
  const [duplaOk, setDuplaOk] = useState(false);
  const [duplaInvalida, setDuplaInvalida] = useState(false);
  const [registrando, setRegistrando] = useState(false);
  const [alerta, setAlerta] = useState(null);

  const [presentes, setPresentes] = useState(null);
  const [editando, setEditando] = useState(null);
  const [editDupla, setEditDupla] = useState('');
  const [editTipo, setEditTipo] = useState('ps');
  const [editAlerta, setEditAlerta] = useState(null);

  const nomesPessoas = pessoas.map((p) => p.nome);

  const carregar = useCallback(() => {
    listarPresentesHoje().then((p) => setPresentes(p || [])).catch(() => setPresentes([]));
  }, []);

  useEffect(() => {
    listarPessoas().then((p) => setPessoas(p || [])).catch(() => {});
    carregar();
  }, [carregar]);

  async function registrar() {
    const nomeFinal = nome.trim();
    if (!nomeFinal) { setAlerta({ tipo: 'error', msg: 'Informe seu nome.' }); return; }

    if (modoNovo) {
      const partes = nomeFinal.split(/\s+/).filter((x) => x.length >= 2);
      if (partes.length < 2) {
        setAlerta({ tipo: 'error', msg: 'Digite seu nome e sobrenome completos.' }); return;
      }
    } else if (!nomeOk) {
      setAlerta({ tipo: 'error', msg: 'Selecione seu nome da lista — ou clique em "primeira vez".' });
      return;
    }
    if (tipo === 'ps' && dupla.trim() && !duplaOk) {
      setDuplaInvalida(true);
      setAlerta({ tipo: 'error', msg: 'Selecione a dupla clicando num nome da lista.' }); return;
    }

    setRegistrando(true);
    const res = await registrarPresenca({ nome: nomeFinal, dupla: dupla.trim(), tipo });
    setRegistrando(false);

    if (res.ok) {
      toast('success', res.mensagem);
      setAlerta(null);
      setNome(''); setDupla(''); setNomeOk(false); setDuplaOk(false);
      setDuplaInvalida(false); setModoNovo(false);
      listarPessoas().then((p) => setPessoas(p || [])); // novo cadastro pode ter entrado
      carregar();
    } else {
      setAlerta({ tipo: res.erro.includes('já registrou') ? 'info' : 'error', msg: res.erro });
    }
  }

  function abrirEdicao(p) {
    setEditando(p); setEditDupla(p.dupla || ''); setEditTipo(p.tipo); setEditAlerta(null);
  }
  async function salvarEdicao(novaDupla = editDupla) {
    const res = await atualizarPresenca({
      pessoaId: editando.pessoaId, dupla: novaDupla.trim(), tipo: editTipo,
    });
    if (res.ok) {
      toast('success', res.mensagem);
      carregar();
      setEditando(null);
    } else setEditAlerta({ tipo: 'error', msg: res.erro });
  }

  return (
    <div className="space-y-3">
      {/* ─── Registrar presença ─── */}
      <Card style={{ animationDelay: '.05s' }}>
        <SectionLabel icon={IconUsers}>Registrar presença</SectionLabel>
        {alerta && <Alert tipo={alerta.tipo} msg={alerta.msg} />}

        <div className="mb-3">
          <label className="block text-[10px] uppercase tracking-[0.15em] text-muted mb-2">
            O que você vai fazer hoje?
          </label>
          <SeletorTipo value={tipo} onChange={setTipo} />
        </div>

        <div className="mb-3">
          <label className="block text-[10px] uppercase tracking-[0.15em] text-muted mb-2">
            Seu nome *
          </label>
          {modoNovo ? (
            <>
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Digite seu nome e sobrenome completos..."
                className="w-full px-3.5 py-3 rounded-lg text-base outline-none focus:border-bordo"
              />
              <button
                type="button"
                onClick={() => { setModoNovo(false); setNome(''); }}
                className="mt-1.5 text-[11px] font-semibold rounded-full px-2.5 py-1 border
                  text-muted border-border hover:border-bordo/60 hover:text-bordo transition"
              >
                ← Escolher da lista
              </button>
            </>
          ) : (
            <>
              <Autocomplete
                value={nome}
                options={nomesPessoas}
                placeholder="Comece a digitar e selecione seu nome..."
                onChange={(v, escolhido) => { setNome(v); setNomeOk(escolhido); }}
              />
              <button
                type="button"
                onClick={() => { setModoNovo(true); setNome(''); setNomeOk(false); }}
                className="mt-1.5 text-[11px] font-semibold rounded-full px-2.5 py-1 border
                  text-bordo border-bordo/40 bg-bordo/5 hover:bg-bordo/15 transition"
              >
                + Não estou na lista (cadastrar)
              </button>
            </>
          )}
        </div>

        {tipo === 'ps' && (
          <div className="mb-3">
            <label className="block text-[10px] uppercase tracking-[0.15em] text-muted mb-2">
              Dupla (opcional)
            </label>
            <Autocomplete
              value={dupla}
              options={nomesPessoas}
              placeholder="Selecione quem é sua dupla..."
              invalid={duplaInvalida}
              onChange={(v, escolhido) => {
                setDupla(v); setDuplaOk(escolhido); setDuplaInvalida(false);
              }}
            />
            {duplaInvalida && (
              <p className="mt-1.5 text-[11px] text-danger">
                Selecione um nome da lista — clicar é obrigatório.
              </p>
            )}
          </div>
        )}

        <Button onClick={registrar} loading={registrando} className="py-4 text-xs mt-1">
          <span className="inline-flex items-center justify-center gap-2">
            {!registrando && <IconCheck className="w-4 h-4" />}
            {registrando ? 'Registrando...' : 'Confirmar presença'}
          </span>
        </Button>
      </Card>

      {/* ─── Editar presença ─── */}
      {editando && (
        <Card className="border-l-2 border-l-bordo">
          <SectionLabel icon={IconUser}>Editar presença</SectionLabel>
          {editAlerta && <Alert tipo={editAlerta.tipo} msg={editAlerta.msg} />}
          <p className="text-xs text-muted mb-3.5">
            Editando: <strong className="text-text">{editando.nome}</strong>
          </p>
          <div className="mb-4">
            <label className="block text-[10px] uppercase tracking-[0.15em] text-muted mb-2">
              O que vai fazer
            </label>
            <SeletorTipo value={editTipo} onChange={setEditTipo} />
          </div>
          {editTipo === 'ps' && (
            <div className="mb-4">
              <label className="block text-[10px] uppercase tracking-[0.15em] text-muted mb-2">
                Dupla (vazio para remover)
              </label>
              <Autocomplete
                value={editDupla}
                options={nomesPessoas}
                placeholder="Nome da dupla..."
                onChange={(v) => setEditDupla(v)}
              />
            </div>
          )}
          <div className="flex gap-2">
            <Button onClick={() => salvarEdicao()}>Salvar</Button>
            <Button variant="ghost" onClick={() => setEditando(null)}>Cancelar</Button>
          </div>
        </Card>
      )}

      {/* ─── Presentes hoje ─── */}
      <Card style={{ animationDelay: '.16s' }}>
        <SectionLabel
          icon={IconUsers}
          right={
            presentes && (
              <span className="bg-bordo text-white text-xs font-bold px-2.5 py-0.5 rounded-full">
                {presentes.length}
              </span>
            )
          }
        >
          Presentes hoje
        </SectionLabel>

        {presentes === null && (
          <div className="space-y-2">
            {[55, 45, 60].map((w, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl2 border border-border bg-surface-2">
                <div className="skeleton w-8 h-8 rounded-full shrink-0" />
                <div className="flex-1">
                  <div className="skeleton h-2.5 rounded" style={{ width: w + '%' }} />
                  <div className="skeleton h-2.5 rounded mt-1.5" style={{ width: w - 20 + '%' }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {presentes && presentes.length === 0 && (
          <div className="text-center py-7 text-muted">
            <div className="text-sm font-semibold">Ninguém registrou presença ainda.</div>
            <div className="text-xs mt-1">Seja o primeiro a confirmar.</div>
          </div>
        )}

        {presentes && presentes.length > 0 && (
          <div className="space-y-2">
            {presentes.map((p, i) => {
              const ehJuiz = p.tipo === 'juiz';
              const ehObs = p.tipo === 'observador' || p.tipo === 'visitante';
              const naoDebate = ehJuiz || ehObs;
              return (
                <div
                  key={p.presencaId}
                  className="flex items-center justify-between p-3 rounded-xl2 border border-border
                    bg-surface-2 transition hover:-translate-y-0.5 hover:border-bordo/50 animate-fade-up"
                  style={{ animationDelay: i * 0.04 + 's' }}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px]
                      font-semibold text-white shrink-0
                      ${ehJuiz ? 'bg-gold/30 !text-gold border border-gold/40'
                        : ehObs ? 'bg-surface-2 !text-muted border border-border'
                        : 'bg-bordo'}`}>
                      {iniciais(p.nome)}
                    </div>
                    <div>
                      <div className={`text-[13px] font-semibold ${naoDebate ? 'text-muted' : 'text-text'}`}>
                        {p.nome}
                      </div>
                      <div className="text-[11px] mt-0.5">
                        {ehJuiz
                          ? <span className="text-gold">juiz</span>
                          : ehObs
                            ? <span className="text-muted">só assistindo</span>
                            : p.dupla
                              ? <span className="text-bordo">com {p.dupla}</span>
                              : <span className="text-muted">sem dupla</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-muted bg-surface px-2 py-0.5 rounded-full">
                      {p.hora}
                    </span>
                    <LinkButton
                      className="text-[10px] uppercase tracking-wide px-2.5"
                      onClick={() => abrirEdicao(p)}
                    >
                      editar
                    </LinkButton>
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
