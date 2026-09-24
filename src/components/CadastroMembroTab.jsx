'use client';
import { useState, useEffect } from 'react';
import Card, { SectionLabel } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Alert from '@/components/ui/Alert';
import Autocomplete from '@/components/ui/Autocomplete';
import { IconShield, IconCheck } from '@/components/ui/Icons';
import { listarPessoas, getTrainees, registrarMembroGestao } from '@/lib/supabase';

const AVISO_TRAINEE = 'Você é trainee, ainda não pode se cadastrar como membro/gestão.';

const PAPEIS = [
  { id: 'membro', label: 'Membro' },
  { id: 'gestao', label: 'Gestão' },
];

export default function CadastroMembroTab() {
  const [pessoas, setPessoas] = useState([]);
  const [traineeIds, setTraineeIds] = useState(new Set());
  const [nome, setNome] = useState('');
  const [nomeOk, setNomeOk] = useState(false);
  const [modoNovo, setModoNovo] = useState(false);
  const [papel, setPapel] = useState('membro');
  const [enviando, setEnviando] = useState(false);
  const [alerta, setAlerta] = useState(null);
  const [feito, setFeito] = useState(null); // { nome, papel }

  function carregarListas() {
    listarPessoas().then((p) => setPessoas(p || [])).catch(() => {});
    getTrainees().then((t) => setTraineeIds(new Set(t.map((x) => x.pessoaId)))).catch(() => {});
  }

  useEffect(carregarListas, []);

  const nomesPessoas = pessoas.map((p) => p.nome);

  // Cruza o nome com quem já é trainee na temporada ativa, pra avisar antes
  // de tentar enviar (o gatilho no banco também bloqueia, isso só adianta o aviso).
  function pessoaEhTrainee(nomeStr) {
    const p = pessoas.find((pp) => pp.nome === nomeStr);
    return !!p && traineeIds.has(p.id);
  }

  async function enviar() {
    const nomeFinal = nome.trim();
    if (!nomeFinal) { setAlerta({ tipo: 'error', msg: 'Informe seu nome.' }); return; }
    if (modoNovo) {
      const partes = nomeFinal.split(/\s+/).filter((x) => x.length >= 2);
      if (partes.length < 2) {
        setAlerta({ tipo: 'error', msg: 'Digite seu nome e sobrenome completos.' }); return;
      }
    } else if (!nomeOk) {
      setAlerta({ tipo: 'error', msg: 'Selecione seu nome da lista — ou clique em "não estou na lista".' });
      return;
    }
    if (pessoaEhTrainee(nomeFinal)) {
      setAlerta({ tipo: 'error', msg: AVISO_TRAINEE });
      return;
    }

    setEnviando(true);
    const res = await registrarMembroGestao({ nome: nomeFinal, papel });
    setEnviando(false);

    if (res.ok) {
      setAlerta(null);
      setFeito({ nome: nomeFinal, papel });
    } else {
      setAlerta({ tipo: 'error', msg: res.erro });
    }
  }

  function registrarOutro() {
    setFeito(null);
    setNome(''); setNomeOk(false); setModoNovo(false); setPapel('membro'); setAlerta(null);
    carregarListas();
  }

  if (feito) {
    const rotulo = PAPEIS.find((p) => p.id === feito.papel)?.label || feito.papel;
    return (
      <Card style={{ animationDelay: '.05s' }}>
        <SectionLabel icon={IconCheck}>Cadastro salvo</SectionLabel>
        <p className="text-sm text-text mb-1">
          <strong>{feito.nome}</strong> cadastrado(a) como <strong className="text-gold">{rotulo}</strong>.
        </p>
        <p className="text-xs text-muted mb-4">
          Você já aparece na área de acompanhamento da diretoria.
        </p>
        <Button variant="ghost" onClick={registrarOutro}>Cadastrar outra pessoa</Button>
      </Card>
    );
  }

  return (
    <Card style={{ animationDelay: '.05s' }}>
      <SectionLabel icon={IconShield}>Cadastro de membro / gestão</SectionLabel>
      <p className="text-xs text-muted mb-4">
        Selecione o seu nome e diga se você é <strong className="text-text">Membro</strong> ou
        {' '}<strong className="text-text">Gestão</strong>. Isso alimenta o acompanhamento de
        presença nos treinos da diretoria.
      </p>
      {alerta && <Alert tipo={alerta.tipo} msg={alerta.msg} />}

      <div className="mb-4">
        <label className="block text-[10px] uppercase tracking-[0.15em] text-muted mb-2">
          Seu nome *
        </label>
        {modoNovo ? (
          <>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Digite seu nome e sobrenome completos…"
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
              placeholder="Comece a digitar e selecione seu nome…"
              onChange={(v, escolhido) => {
                setNome(v); setNomeOk(escolhido);
                setAlerta(escolhido && pessoaEhTrainee(v) ? { tipo: 'error', msg: AVISO_TRAINEE } : null);
              }}
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

      <div className="mb-4">
        <label className="block text-[10px] uppercase tracking-[0.15em] text-muted mb-2">
          Você é
        </label>
        <div className="flex gap-1.5">
          {PAPEIS.map((p) => {
            const ativo = papel === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setPapel(p.id)}
                className={`flex-1 rounded-xl text-[11px] font-semibold uppercase tracking-wide
                  border transition-all duration-300 ease-out
                  ${ativo
                    ? 'bg-gradient-to-br from-bordo to-bordo-soft text-white border-bordo shadow-xl shadow-bordo/40 py-4 scale-[1.03] z-10'
                    : 'bg-surface-2 text-muted border-border py-2.5 opacity-60 hover:opacity-100'}`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      <Button onClick={enviar} loading={enviando} className="py-4 text-xs mt-1">
        <span className="inline-flex items-center justify-center gap-2">
          {!enviando && <IconCheck className="w-4 h-4" />}
          {enviando ? 'Enviando…' : 'Confirmar cadastro'}
        </span>
      </Button>
    </Card>
  );
}
