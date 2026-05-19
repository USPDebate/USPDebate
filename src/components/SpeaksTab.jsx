'use client';
import { useState } from 'react';
import SpeaksDoDraw from '@/components/SpeaksDoDraw';
import SpeaksManual from '@/components/SpeaksManual';

export default function SpeaksTab() {
  const [modo, setModo] = useState('draw');

  const botao = (id, label) => (
    <button
      type="button"
      onClick={() => setModo(id)}
      className={`flex-1 py-3 rounded-xl text-[11px] font-semibold uppercase tracking-wide
        border transition
        ${modo === id
          ? 'bg-gradient-to-br from-bordo to-bordo-soft text-white border-bordo'
          : 'bg-surface-2 text-muted border-border hover:border-bordo/60'}`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-3">
      <div className="flex gap-1.5">
        {botao('draw', 'Sala do draw')}
        {botao('manual', 'Sala manual')}
      </div>
      {modo === 'draw' ? <SpeaksDoDraw /> : <SpeaksManual />}
    </div>
  );
}
