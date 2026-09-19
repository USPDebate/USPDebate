'use client';
import { useState, useEffect, useRef } from 'react';
import PresencaTab from '@/components/PresencaTab';
import DrawTab from '@/components/DrawTab';
import SpeaksTab from '@/components/SpeaksTab';
import DesempenhoTab from '@/components/DesempenhoTab';
import HistoricoTab from '@/components/HistoricoTab';
import TraineeTab from '@/components/TraineeTab';
import AdminTab from '@/components/AdminTab';
import Decor from '@/components/ui/Decor';
import IntroSplash from '@/components/IntroSplash';
import Toaster from '@/components/ui/Toaster';
import {
  IconCalendar, IconUsers, IconLayers, IconScale, IconChart, IconClock, IconLock, IconUpload,
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

export default function Page() {
  const [aba, setAba] = useState('presenca');
  const [dataHoje, setDataHoje] = useState('');
  const [indicador, setIndicador] = useState({ left: 0, width: 0 });
  const tabRefs = useRef({});

  useEffect(() => {
    setDataHoje(new Date().toLocaleDateString('pt-BR', {
      weekday: 'long', day: '2-digit', month: 'long',
    }));
  }, []);

  useEffect(() => {
    const el = tabRefs.current[aba];
    if (el) setIndicador({ left: el.offsetLeft, width: el.offsetWidth });
  }, [aba]);

  return (
    <div className="relative min-h-screen pb-24">
      <IntroSplash />
      <Toaster />
      <Decor />

      {/* Header */}
      <header className="relative z-10 bg-gradient-to-br from-[#120c0e]/90 to-bordo-soft/40
        px-5 py-6 flex items-end justify-between border-b border-border animate-drop">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight leading-none">
            USP Debate
          </h1>
          <p className="text-[10px] uppercase tracking-[0.22em] text-gold/80 mt-2">
            Sistema de Treinos BP
          </p>
        </div>
        <p className="flex items-center gap-1.5 text-[11px] text-muted text-right capitalize">
          <IconCalendar className="w-3.5 h-3.5" />
          {dataHoje}
        </p>
      </header>

      {/* Tabs (desktop) — hover levanta e amplia o ícone (dock-like), com uma
          pill dourada translúcida atrás do item; a barra ganha um leve vidro
          sobre o fundo novo. */}
      <nav className="relative z-10 hidden sm:flex bg-[#120c0e]/70 backdrop-blur-md px-5 border-b border-border">
        {ABAS.map((a) => {
          const Ic = a.icon;
          const ativo = aba === a.id;
          return (
            <button
              key={a.id}
              ref={(el) => { tabRefs.current[a.id] = el; }}
              onClick={() => setAba(a.id)}
              className={`group relative flex items-center gap-1.5 px-4 py-3 text-[10px] uppercase tracking-[0.13em]
                transition-transform duration-200 hover:-translate-y-0.5
                ${ativo ? 'text-gold' : 'text-muted hover:text-text'}`}
            >
              <span className="absolute inset-x-1.5 inset-y-1 -z-10 rounded-lg bg-gold/0 transition-colors duration-200 group-hover:bg-gold/10" />
              <Ic className="w-3.5 h-3.5 shrink-0 transition-transform duration-200 group-hover:scale-125 group-hover:-translate-y-0.5" />
              {a.label}
            </button>
          );
        })}
        <span
          className="absolute bottom-0 h-[2px] bg-gold transition-[left,width] duration-300 ease-out"
          style={{ left: indicador.left, width: indicador.width }}
        />
      </nav>

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
              onClick={() => setAba(a.id)}
              className="relative flex-1 min-w-0 flex justify-center py-2 transition-transform active:scale-90"
            >
              <span className="relative flex flex-col items-center gap-0.5">
                {ativo && (
                  <span className="animate-nav-pop absolute -inset-x-2.5 -inset-y-1.5 -z-10 rounded-2xl
                    bg-gradient-to-br from-bordo to-bordo-soft" />
                )}
                <Ic className={`w-5 h-5 shrink-0 transition-transform ${ativo ? 'scale-[1.15] text-white' : 'text-muted'}`} />
                <span className={`w-full px-0.5 text-[8px] font-semibold uppercase tracking-tight text-center truncate
                  ${ativo ? 'text-white' : 'text-muted'}`}>{a.label}</span>
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
