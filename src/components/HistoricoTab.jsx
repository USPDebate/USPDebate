'use client';
import { useState, useEffect } from 'react';
import Card, { SectionLabel } from '@/components/ui/Card';
import DrawView from '@/components/DrawView';
import { IconClock } from '@/components/ui/Icons';
import { getDrawsAnteriores, getDrawPorData } from '@/lib/supabase';

function fmtData(iso) {
  if (!iso) return '';
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

export default function HistoricoTab() {
  const [draws, setDraws] = useState(null);     // array de datas ISO
  const [detalhe, setDetalhe] = useState(null); // { data, draw|null }

  useEffect(() => {
    getDrawsAnteriores()
      .then((d) => setDraws(d || []))
      .catch(() => setDraws([]));
  }, []);

  function abrir(dataISO) {
    setDetalhe({ data: dataISO, draw: null });
    getDrawPorData(dataISO)
      .then((draw) => setDetalhe({ data: dataISO, draw: draw || { salas: [], juizes: [] } }))
      .catch(() => setDetalhe({ data: dataISO, draw: { salas: [], juizes: [] } }));
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
            {draws.map((dataISO, i) => (
              <button
                key={dataISO}
                onClick={() => abrir(dataISO)}
                style={{ animationDelay: i * 0.04 + 's' }}
                className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl
                  bg-surface-2 border border-border text-left transition animate-fade-up
                  hover:border-bordo/60 hover:-translate-y-0.5"
              >
                <span className="text-[13px] font-semibold">{fmtData(dataISO)}</span>
                <span className="text-muted text-sm">›</span>
              </button>
            ))}
          </div>
        )}
      </Card>

      {detalhe && (
        <Card style={{ animationDelay: '.1s' }}>
          <SectionLabel icon={IconClock}>Draw de {fmtData(detalhe.data)}</SectionLabel>
          {detalhe.draw === null
            ? <div className="skeleton h-28 rounded-xl2" />
            : <DrawView draw={detalhe.draw} />}
        </Card>
      )}
    </div>
  );
}
