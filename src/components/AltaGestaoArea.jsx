'use client';
import { useState, useEffect } from 'react';
import Card, { SectionLabel } from '@/components/ui/Card';
import FormSenha from '@/components/ui/FormSenha';
import Alert from '@/components/ui/Alert';
import MembrosGestaoArea from '@/components/MembrosGestaoArea';
import { IconShield } from '@/components/ui/Icons';
import { verificarSenhaAltaGestao } from '@/lib/supabase';

const SESSAO = 'uspd_alta_gestao';

export default function AltaGestaoArea() {
  const [logado, setLogado] = useState(false);
  const [senha, setSenha] = useState('');
  const [alertaLogin, setAlertaLogin] = useState(null);
  const [entrando, setEntrando] = useState(false);

  // Sessão de 3h — mesmo esquema da área administrativa.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(SESSAO);
      if (raw) {
        const d = JSON.parse(raw);
        if (d.senha && Date.now() - d.ts < 3 * 60 * 60 * 1000) {
          setSenha(d.senha);
          setLogado(true);
        } else sessionStorage.removeItem(SESSAO);
      }
    } catch (e) {}
  }, []);

  async function entrar() {
    setEntrando(true);
    const ok = await verificarSenhaAltaGestao(senha);
    setEntrando(false);
    if (!ok) { setAlertaLogin({ tipo: 'error', msg: ok === null ? 'Sem conexão com o servidor. Confira a internet e tente de novo.' : 'Senha incorreta.' }); return; }
    try { sessionStorage.setItem(SESSAO, JSON.stringify({ senha, ts: Date.now() })); } catch (e) {}
    setLogado(true);
  }

  if (!logado) {
    return (
      <Card style={{ animationDelay: '.05s' }}>
        <SectionLabel icon={IconShield}>Área de alta gestão</SectionLabel>
        <p className="text-xs text-muted mb-3">
          Senha separada da administrativa — controla o cadastro de membros e gestão.
        </p>
        {alertaLogin && <Alert tipo={alertaLogin.tipo} msg={alertaLogin.msg} />}
        <FormSenha usuario="alta-gestao" rotulo="Senha de alta gestão"
          value={senha} onChange={setSenha} onEntrar={entrar} loading={entrando} />
      </Card>
    );
  }

  return <MembrosGestaoArea />;
}
