'use client';
import { useState, useEffect } from 'react';
import Card, { SectionLabel } from '@/components/ui/Card';
import DrawView from '@/components/DrawView';
import { IconClock } from '@/components/ui/Icons';
import { callAPI, callAPICached } from '@/lib/api';
import { parsearDraw } from '@/lib/draw';

export default function HistoricoTab() {
  const [draws, setDraws] = useState(null);          // lista de nomes de aba
  const [detalhe, setDetalhe] = useState(null);      // { nome, draw|null }

  useEffect(() => {
    callAPICached('getDrawsAnteriores', null, 60000)
      .then((d) => setDraws(d || []))
      .catch(() => setDraws([]));
  }, []);

  function abrir(nome) {
    setDetalhe({ nome, draw: null });
    callAPI('getDrawData', { nomeAba: nome })
      .then((dados) => {
        setDetalhe({ nome, draw: dados ? parsearDraw(dados) : { salas: [], juizes: [] } });
      })
      .catch(() => setDetalhe({ nome, draw: { salas: [], juizes: [] } }));
  }

  return (
    <div className="space-y-3">
      <Card style={{ animationDelay: '.05s' }}>
        <SectionLabel icon={IconClock}>Draws anteriores</SectionLabel>

        {draws === null && (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => <div key={i} className="skeleton h-11 rounded-lg" />)}
          </div>
        )}

        {draws && draws.length === 0 && (
          <p className="text-sm text-muted py-4">Nenhum draw publicado ainda.</p>
        )}

        {draws && draws.length > 0 && (
          <div className="space-y-1.5">
            {draws.map((nome, i) => (
              <button
                key={nome}
                onClick={() => abrir(nome)}
                style={{ animationDelay: i * 0.04 + 's' }}
                className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl
                  bg-surface-2 border border-border text-left transition animate-fade-up
                  hover:border-bordo/60 hover:-translate-y-0.5"
              >
                <span className="text-[13px] font-semibold">{nome.replace('Draw ', '')}</span>
                <span className="text-muted text-sm">›</span>
              </button>
            ))}
          </div>
        )}
      </Card>

      {detalhe && (
        <Card style={{ animationDelay: '.1s' }}>
          <SectionLabel icon={IconClock}>{detalhe.nome.replace('Draw ', 'Draw de ')}</SectionLabel>
          {detalhe.draw === null
            ? <div className="skeleton h-28 rounded-xl2" />
            : <DrawView draw={detalhe.draw} />}
        </Card>
      )}
    </div>
  );
}
