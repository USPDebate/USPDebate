'use client';
import { useState, useEffect, useCallback } from 'react';
import Card, { SectionLabel } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Alert from '@/components/ui/Alert';
import Autocomplete from '@/components/ui/Autocomplete';
import { IconUsers, IconUser, IconEye, IconCheck } from '@/components/ui/Icons';
import { callAPI, callAPICached, invalidate } from '@/lib/api';
import { NOMES_PS, norm } from '@/lib/data';

const TIPOS = [
  { id: 'ps', label: 'Membro do PS', Icon: IconUsers },
  { id: 'visitante', label: 'Visitante', Icon: IconUser },
  { id: 'observador', label: 'Só vou assistir', Icon: IconEye },
];

function iniciais(nome) {
  return nome.split(' ').map((x) => x[0]).slice(0, 2).join('').toUpperCase();
}

export default function PresencaTab() {
  const [tipo, setTipo] = useState('ps');
  const [nome, setNome] = useState('');
  const [dupla, setDupla] = useState('');
  const [duplaOk, setDuplaOk] = useState(false);
  const [duplaInvalida, setDuplaInvalida] = useState(false);
  const [registrando, setRegistrando] = useState(false);
  const [alerta, setAlerta] = useState(null);

  const [presentes, setPresentes] = useState(null); // null = carregando
  const [editando, setEditando] = useState(null);   // { nome, dupla }
  const [editDupla, setEditDupla] = useState('');
  const [editAlerta, setEditAlerta] = useState(null);

  const nomesPresentes = (presentes || []).filter((p) => !p.naoDebate).map((p) => p.nome);
  const nomesDupla = (() => {
    const base = [...NOMES_PS];
    nomesPresentes.forEach((n) => { if (!base.some((b) => norm(b) === norm(n))) base.push(n); });
    return base.sort((a, b) => a.localeCompare(b, 'pt-BR'));
  })();

  const carregar = useCallback(() => {
    callAPICached('getPresentesHoje', null, 15000)
      .then((p) => setPresentes(p || []))
      .catch(() => setPresentes([]));
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  function registrar() {
    if (!nome.trim()) { setAlerta({ tipo: 'error', msg: 'Informe seu nome.' }); return; }
    if (tipo === 'ps' && !NOMES_PS.some((n) => norm(n) === norm(nome))) {
      setAlerta({ tipo: 'error', msg: 'Selecione seu nome da lista do PS.' }); return;
    }
    if (dupla.trim() && !duplaOk) {
      setDuplaInvalida(true);
      setAlerta({ tipo: 'error', msg: 'Selecione a dupla clicando num nome da lista.' }); return;
    }
    setRegistrando(true);
    callAPI('registrarPresenca', { nome: nome.trim(), dupla: dupla.trim(), tipo })
      .then((res) => {
        setRegistrando(false);
        if (res.ok) {
          setAlerta({ tipo: 'success', msg: res.mensagem });
          // Atualização otimista: já mostra na lista, sem esperar nova chamada.
          const entrada = {
            nome: nome.trim(),
            dupla: tipo === 'observador' ? '' : dupla.trim(),
            tipo,
            naoDebate: tipo === 'observador',
            hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          };
          setPresentes((prev) =>
            [...(prev || []), entrada].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')));
          setNome(''); setDupla(''); setDuplaOk(false); setDuplaInvalida(false);
          invalidate('getPresentesHoje');
        } else {
          setAlerta({ tipo: res.erro.includes('já registrou') ? 'info' : 'error', msg: res.erro });
        }
      })
      .catch(() => { setRegistrando(false); setAlerta({ tipo: 'error', msg: 'Erro de conexão.' }); });
  }

  function abrirEdicao(p) {
    setEditando(p); setEditDupla(p.dupla || ''); setEditAlerta(null);
  }
  function salvarEdicao(novaDupla) {
    callAPI('atualizarDupla', { nome: editando.nome, dupla: novaDupla })
      .then((res) => {
        if (res.ok) {
          // Atualização otimista da dupla na lista local.
          setPresentes((prev) => (prev || []).map((p) =>
            p.nome === editando.nome ? { ...p, dupla: novaDupla } : p));
          invalidate('getPresentesHoje');
          setEditAlerta({ tipo: 'success', msg: res.mensagem });
          setTimeout(() => setEditando(null), 700);
        } else setEditAlerta({ tipo: 'error', msg: res.erro });
      })
      .catch(() => setEditAlerta({ tipo: 'error', msg: 'Erro de conexão.' }));
  }

  return (
    <div className="space-y-3">
      {/* ─── Registrar presença ─── */}
      <Card style={{ animationDelay: '.05s' }}>
        <SectionLabel icon={IconUsers}>Registrar presença</SectionLabel>
        {alerta && <Alert tipo={alerta.tipo} msg={alerta.msg} />}

        <div className="mb-3">
          <label className="block text-[10px] uppercase tracking-[0.15em] text-muted mb-2">
            Você vai debater hoje?
          </label>
          <div className="flex gap-1.5 items-stretch">
            {TIPOS.map((t) => {
              const ativo = tipo === t.id;
              const Ico = t.Icon;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => { setTipo(t.id); setNome(''); }}
                  className={`flex-1 flex items-center justify-center gap-2 rounded-xl text-[11px]
                    font-semibold uppercase tracking-wide border transition-all duration-300 ease-out
                    ${ativo
                      ? 'bg-gradient-to-br from-bordo to-bordo-soft text-white border-bordo shadow-xl shadow-bordo/40 py-4 scale-[1.05] z-10'
                      : 'bg-surface-2 text-muted border-border py-2.5 opacity-60 hover:opacity-100'}`}
                >
                  <Ico className="w-4 h-4 shrink-0" />
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mb-3">
          <label className="block text-[10px] uppercase tracking-[0.15em] text-muted mb-2">
            Seu nome *
          </label>
          {tipo === 'visitante' ? (
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Digite seu nome completo..."
              className="w-full px-3.5 py-3 rounded-lg text-base outline-none focus:border-bordo"
            />
          ) : (
            <Autocomplete
              value={nome}
              options={NOMES_PS}
              placeholder={tipo === 'ps' ? 'Selecione seu nome na lista...' : 'Digite ou selecione...'}
              onChange={(v) => setNome(v)}
            />
          )}
          {tipo === 'ps' && (
            <p className="mt-1.5 text-[11px] text-muted">Apenas nomes cadastrados no PS são aceitos.</p>
          )}
        </div>

        {tipo !== 'observador' && (
          <div className="mb-3">
            <label className="block text-[10px] uppercase tracking-[0.15em] text-muted mb-2">
              Dupla (opcional)
            </label>
            <Autocomplete
              value={dupla}
              options={nomesDupla}
              placeholder="Selecione quem vai debater hoje..."
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
              Nova dupla (vazio para remover)
            </label>
            <Autocomplete
              value={editDupla}
              options={nomesDupla}
              placeholder="Nome da dupla..."
              onChange={(v) => setEditDupla(v)}
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={() => salvarEdicao(editDupla.trim())}>Salvar</Button>
            <Button variant="danger" onClick={() => salvarEdicao('')}>Remover dupla</Button>
          </div>
          <Button variant="ghost" className="mt-2" onClick={() => setEditando(null)}>Cancelar</Button>
        </Card>
      )}

      {/* ─── Presentes hoje ─── */}
      <Card style={{ animationDelay: '.16s' }}>
        <SectionLabel
          right={
            presentes && (
              <span className="bg-bordo text-white text-xs font-bold px-2.5 py-0.5 rounded-full">
                {presentes.length}
              </span>
            )
          }
          icon={IconUsers}
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
              const obs = p.naoDebate || p.tipo === 'observador';
              return (
                <div
                  key={p.nome + i}
                  className="flex items-center justify-between p-3 rounded-xl2 border border-border
                    bg-surface-2 transition hover:-translate-y-0.5 hover:border-bordo/50 animate-fade-up"
                  style={{ animationDelay: i * 0.04 + 's' }}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px]
                      font-semibold text-white shrink-0
                      ${obs ? 'bg-surface-2 !text-muted border border-border' : 'bg-bordo'}`}>
                      {iniciais(p.nome)}
                    </div>
                    <div>
                      <div className={`text-[13px] font-semibold ${obs ? 'text-muted' : 'text-text'}`}>
                        {p.nome}
                      </div>
                      <div className="text-[11px] mt-0.5">
                        {obs
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
                    {!obs && (
                      <button
                        onClick={() => abrirEdicao(p)}
                        className="text-[10px] uppercase tracking-wide text-muted border border-border
                          rounded px-2 py-1 hover:border-bordo hover:text-bordo transition"
                      >
                        editar
                      </button>
                    )}
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
