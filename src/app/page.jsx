'use client';
import { useState, useEffect, useRef } from 'react';
import PresencaTab from '@/components/PresencaTab';
import DrawTab from '@/components/DrawTab';
import SpeaksTab from '@/components/SpeaksTab';
import DesempenhoTab from '@/components/DesempenhoTab';
import HistoricoTab from '@/components/HistoricoTab';
import TraineeTab from '@/components/TraineeTab';
import AdminTab from '@/components/AdminTab';
import CadastroMembroTab from '@/components/CadastroMembroTab';
import Decor from '@/components/ui/Decor';
import IntroSplash from '@/components/IntroSplash';
import Toaster from '@/components/ui/Toaster';
import {
  IconUsers, IconLayers, IconScale, IconChart, IconClock, IconLock, IconUpload,
} from '@/components/ui/Icons';

const ABAS = [
  { id: 'presenca',   label: 'Presença',   icon: IconUsers },
  { id: 'draw',       label: 'Draw',       icon: IconLayers },
  { id: 'speaks',     label: 'Speaks',     icon: IconScale },
  { id: 'desempenho', label: 'Desempenho', icon: IconChart },
  { id: 'historico',  label: 'Histórico',  icon: IconClock },
  { id: 'trainee',    label: 'Trainee',    icon: IconUpload },
  { id: 'admin',      label: 'Admin',      icon: IconLock },
];

// Marca do cabeçalho: o balão do logo (o mesmo da abertura) + o nome.
function Marca({ className = '' }) {
  return (
    <h1 className={`flex items-center justify-center gap-2.5 ${className}`}>
      <img src="logo.png" alt="" width="30" height="25" className="w-[30px] h-auto" />
      <span className="font-display text-xl font-semibold tracking-tight leading-none">USP Debate</span>
    </h1>
  );
}

export default function Page() {
  const [aba, setAba] = useState('presenca');
  const [indicador, setIndicador] = useState({ left: 0, top: 0, width: 0 });
  const tabRefs = useRef({});

  useEffect(() => {
    // ?aba=<id> abre direto na aba (recarregar não volta pra Presença e dá pra
    // mandar link do Draw). `cadastro` é o auto-cadastro: não fica no menu, só abre por link.
    try {
      const pedida = new URLSearchParams(window.location.search).get('aba');
      if (pedida === 'cadastro' || ABAS.some((a) => a.id === pedida)) setAba(pedida);
    } catch (e) {}
  }, []);

  function irPara(id) {
    setAba(id);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('aba', id);
      window.history.replaceState(null, '', url);
    } catch (e) {}
  }

  // Sublinhado da aba ativa: mede o botão. Remede no resize porque o layout das
  // abas muda (uma linha em volta da marca no xl, embaixo dela antes disso).
  useEffect(() => {
    function medir() {
      const el = tabRefs.current[aba];
      if (el) setIndicador({ left: el.offsetLeft + 12, top: el.offsetTop + el.offsetHeight - 2, width: el.offsetWidth - 24 });
    }
    medir();
    window.addEventListener('resize', medir);
    return () => window.removeEventListener('resize', medir);
  }, [aba]);

  // Função de render (não componente): componente declarado aqui dentro seria
  // recriado a cada render e o botão perderia o foco depois do clique.
  function renderAba(a) {
    const Ic = a.icon;
    const ativo = aba === a.id;
    return (
      <button
        key={a.id}
        ref={(el) => { tabRefs.current[a.id] = el; }}
        onClick={() => irPara(a.id)}
        aria-current={ativo ? 'page' : undefined}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold
          ${ativo ? 'text-text' : 'text-muted hover:text-text hover:bg-white/[0.04]'}`}
      >
        <Ic className={`w-4 h-4 shrink-0 ${ativo ? 'text-gold' : ''}`} />
        {a.label}
      </button>
    );
  }

  if (aba === 'cadastro') {
    return (
      <div className="relative min-h-screen pb-24">
        <Toaster />
        <Decor />
        <header className="relative z-10 px-4 pt-5 pb-1 animate-drop">
          <Marca />
        </header>
        <main className="relative z-10 max-w-7xl mx-auto px-4 py-4 sm:px-8 sm:py-6">
          <CadastroMembroTab />
        </main>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen pb-24">
      <IntroSplash />
      <Toaster />
      <Decor />

      {/* Cabeçalho transparente (ref.: nav do Superpower): sem faixa colorida, a marca
          no centro e as abas em volta. No xl as abas se dividem dos dois lados da marca
          (Admin na ponta, onde os sites põem o "Entrar"); do sm ao xl a marca fica em
          cima e as abas numa linha centralizada embaixo; no celular só a marca, porque
          as abas estão na barra de baixo. */}
      <header className="relative z-10 animate-drop">
        <nav aria-label="Abas" className="relative max-w-7xl mx-auto px-4 sm:px-8 pt-5 pb-1 sm:pb-2
          flex flex-wrap items-center justify-center gap-x-1 gap-y-3
          xl:grid xl:grid-cols-[1fr_auto_1fr] xl:gap-8">
          <Marca className="order-first basis-full xl:order-2 xl:basis-auto" />
          <div className="hidden sm:flex items-center gap-1 xl:order-1">
            {ABAS.slice(0, 4).map(renderAba)}
          </div>
          <div className="hidden sm:flex items-center gap-1 xl:order-3 xl:justify-end">
            {ABAS.slice(4).map(renderAba)}
          </div>
          <span aria-hidden="true"
            className="hidden sm:block absolute h-[2px] rounded-full bg-gold motion-safe:transition-[left,top,width] motion-safe:duration-300 ease-out"
            style={{ left: indicador.left, top: indicador.top, width: indicador.width }} />
        </nav>
      </header>

      {/* Conteúdo — largura ampla, mas não a tela inteira */}
      <main className="relative z-10 max-w-7xl mx-auto px-4 py-4 sm:px-8 sm:py-6">
        {aba === 'presenca'   && <PresencaTab />}
        {aba === 'draw'       && <DrawTab />}
        {aba === 'speaks'     && <SpeaksTab />}
        {aba === 'desempenho' && <DesempenhoTab />}
        {aba === 'historico'  && <HistoricoTab />}
        {aba === 'trainee'    && <TraineeTab />}
        {aba === 'admin'      && <AdminTab />}
      </main>

      {/* Nav inferior (mobile) — ícone + rótulo. Sem hover no toque, então o
          "dinamismo" aqui é uma pill bordô que estoura com uma mola atrás do
          item ativo, mais feedback de escala em qualquer toque. */}
      <nav className="sm:hidden fixed bottom-0 inset-x-0 bg-surface/90 backdrop-blur-md border-t border-border flex z-50">
        {ABAS.map((a) => {
          const Ic = a.icon;
          const ativo = aba === a.id;
          return (
            <button
              key={a.id}
              onClick={() => irPara(a.id)}
              aria-current={ativo ? 'page' : undefined}
              className="relative flex-1 min-w-0 flex justify-center py-2 transition-transform active:scale-90"
            >
              <span className="relative flex flex-col items-center gap-0.5">
                {ativo && (
                  <span className="animate-nav-pop absolute -inset-x-2.5 -inset-y-1.5 -z-10 rounded-2xl
                    bg-gradient-to-br from-bordo to-bordo-soft" />
                )}
                <Ic className={`w-5 h-5 shrink-0 transition-transform ${ativo ? 'scale-[1.15] text-white' : 'text-muted'}`} />
                <span className={`w-full px-0.5 text-[10px] font-semibold tracking-tight text-center truncate
                  ${ativo ? 'text-white' : 'text-muted'}`}>{a.label}</span>
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
