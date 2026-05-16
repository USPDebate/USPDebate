'use client';
import { useState, useEffect } from 'react';
import PresencaTab from '@/components/PresencaTab';
import DrawTab from '@/components/DrawTab';
import HistoricoTab from '@/components/HistoricoTab';
import AdminTab from '@/components/AdminTab';
import Decor from '@/components/ui/Decor';
import IntroSplash from '@/components/IntroSplash';
import { IconCalendar } from '@/components/ui/Icons';

const ABAS = [
  { id: 'presenca',  label: 'Presença' },
  { id: 'draw',      label: 'Draw' },
  { id: 'historico', label: 'Histórico' },
  { id: 'admin',     label: 'Admin' },
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

      {/* Conteúdo */}
      <main className="relative z-10 max-w-[860px] mx-auto p-4 sm:p-5">
        {aba === 'presenca'  && <PresencaTab />}
        {aba === 'draw'      && <DrawTab />}
        {aba === 'historico' && <HistoricoTab />}
        {aba === 'admin'     && <AdminTab />}
      </main>

      {/* Nav inferior (mobile) */}
      <nav className="sm:hidden fixed bottom-0 inset-x-0 bg-surface border-t border-border flex z-50">
        {ABAS.map((a) => (
          <button
            key={a.id}
            onClick={() => setAba(a.id)}
            className={`flex-1 py-3 text-[10px] font-semibold uppercase tracking-wide transition
              ${aba === a.id ? 'text-bordo' : 'text-muted'}`}
          >
            {a.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
