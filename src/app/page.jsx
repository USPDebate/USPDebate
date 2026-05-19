'use client';
import { useState, useEffect } from 'react';
import PresencaTab from '@/components/PresencaTab';
import DrawTab from '@/components/DrawTab';
import SpeaksTab from '@/components/SpeaksTab';
import DesempenhoTab from '@/components/DesempenhoTab';
import HistoricoTab from '@/components/HistoricoTab';
import AdminTab from '@/components/AdminTab';
import Decor from '@/components/ui/Decor';
import IntroSplash from '@/components/IntroSplash';
import Toaster from '@/components/ui/Toaster';
import {
  IconCalendar, IconUsers, IconLayers, IconScale, IconChart, IconClock, IconLock,
} from '@/components/ui/Icons';

const ABAS = [
  { id: 'presenca',   label: 'Presença',   icon: IconUsers },
  { id: 'draw',       label: 'Draw',       icon: IconLayers },
  { id: 'speaks',     label: 'Speaks',     icon: IconScale },
  { id: 'desempenho', label: 'Desempenho', icon: IconChart },
  { id: 'historico',  label: 'Histórico',  icon: IconClock },
  { id: 'admin',      label: 'Admin',      icon: IconLock },
];

export default function Page() {
  const [aba, setAba] = useState('presenca');
  const [dataHoje, setDataHoje] = useState('');

  useEffect(() => {
    setDataHoje(new Date().toLocaleDateString('pt-BR', {
      weekday: 'long', day: '2-digit', month: 'long',
    }));
  }, []);

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

      {/* Tabs (desktop) */}
      <nav className="relative z-10 hidden sm:flex bg-[#120c0e]/80 px-5 border-b border-border">
        {ABAS.map((a) => (
          <button
            key={a.id}
            onClick={() => setAba(a.id)}
            className={`px-4 py-3 text-[10px] uppercase tracking-[0.13em] transition border-b-2
              ${aba === a.id
                ? 'text-gold border-gold'
                : 'text-muted border-transparent hover:text-text'}`}
          >
            {a.label}
          </button>
        ))}
      </nav>

      {/* Conteúdo — largura ampla, mas não a tela inteira */}
      <main className="relative z-10 max-w-7xl mx-auto px-4 py-4 sm:px-8 sm:py-6">
        {aba === 'presenca'   && <PresencaTab />}
        {aba === 'draw'       && <DrawTab />}
        {aba === 'speaks'     && <SpeaksTab />}
        {aba === 'desempenho' && <DesempenhoTab />}
        {aba === 'historico'  && <HistoricoTab />}
        {aba === 'admin'      && <AdminTab />}
      </main>

      {/* Nav inferior (mobile) — ícone + rótulo */}
      <nav className="sm:hidden fixed bottom-0 inset-x-0 bg-surface border-t border-border flex z-50">
        {ABAS.map((a) => {
          const Ic = a.icon;
          const ativo = aba === a.id;
          return (
            <button
              key={a.id}
              onClick={() => setAba(a.id)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2 transition
                ${ativo ? 'text-bordo' : 'text-muted'}`}
            >
              <Ic className="w-5 h-5" />
              <span className="text-[8px] font-semibold uppercase tracking-wide">{a.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
