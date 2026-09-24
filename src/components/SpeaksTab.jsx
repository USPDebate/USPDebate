'use client';
import { useState, useEffect } from 'react';
import SpeaksDoDraw from '@/components/SpeaksDoDraw';
import SpeaksManual from '@/components/SpeaksManual';

// A sala manual é o caminho raro: vira um link secundário em vez da barra
// "Sala do draw / Sala manual" de largura total (consenso dos 3 revisores).
export default function SpeaksTab() {
  const [modo, setModo] = useState('draw');
  const [hoje, setHoje] = useState('');

  useEffect(() => {
    setHoje(new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date()));
  }, []);

  const link = 'py-1 text-[13px] text-text underline decoration-bordo decoration-2 underline-offset-4 hover:decoration-text';

  return (
    <div className="space-y-4 sm:space-y-5 lg:max-w-3xl lg:mx-auto">
      <header className="px-1 animate-rise">
        <p className="text-[15px] text-muted first-letter:uppercase min-h-[1.5rem]">{hoje}</p>
        <h2 className="font-display text-[32px] sm:text-5xl font-semibold tracking-tight leading-[1.05]">
          {modo === 'draw' ? 'Speaks' : 'Sala manual'}
        </h2>
        <p className="mt-2 text-[13px] text-muted">
          {modo === 'draw' ? (
            <>Julgou uma sala fora do draw?{' '}
              <button type="button" onClick={() => setModo('manual')} className={link}>Registrar sala manual</button></>
          ) : (
            <button type="button" onClick={() => setModo('draw')} className={link}>Voltar pras salas do draw</button>
          )}
        </p>
      </header>
      {modo === 'draw' ? <SpeaksDoDraw onManual={() => setModo('manual')} /> : <SpeaksManual />}
    </div>
  );
}
