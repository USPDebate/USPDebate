'use client';
import { useState, useEffect } from 'react';
import Card, { SectionLabel } from '@/components/ui/Card';
import DrawView from '@/components/DrawView';
import { IconClock, IconUsers } from '@/components/ui/Icons';
import {
  getDrawsAnteriores, getDrawPorData, getDatasPresenca, listarPresentes,
} from '@/lib/supabase';
import { nomesDoDraw } from '@/lib/draw';
import { norm } from '@/lib/data';
import { fmtBR } from '@/lib/datas';

const ROTULO = {
  juiz: 'Juiz', observador: 'Observador', ps: 'Debatedor', visitante: 'Visitante',
};
const TAG = {
  juiz: 'text-gold border-[#cda96366]',
  observador: 'text-muted border-border',
};

export default function HistoricoTab() {
  const [datas, setDatas] = useState(null);       // array de datas ISO
  const [publicadas, setPublicadas] = useState(new Set());
  const [detalhe, setDetalhe] = useState(null);   // { data, draw|null, presentes|null }

  useEffect(() => {
    Promise.all([getDrawsAnteriores(), getDatasPresenca()])
      .then(([dr, pres]) => {
        setPublicadas(new Set(dr || []));
        setDatas([...new Set([...(dr || []), ...(pres || [])])].sort().reverse());
      })
      .catch(() => setDatas([]));
  }, []);

  function abrir(dataISO) {
    setDetalhe({ data: dataISO, draw: null, presentes: null });
    // Só busca o draw se ele foi publicado — rascunho não vaza no histórico.
    const pedirDraw = publicadas.has(dataISO)
      ? getDrawPorData(dataISO)
      : Promise.resolve(null);
    Promise.all([pedirDraw, listarPresentes(dataISO)])
      .then(([draw, pres]) => setDetalhe({
        data: dataISO,
        draw: draw || { salas: [], juizes: [] },
        presentes: pres || [],
      }))
      .catch(() => setDetalhe({
        data: dataISO, draw: { salas: [], juizes: [] }, presentes: [],
      }));
  }

  // Quem registrou presença e não foi alocado no draw — juízes que não viraram
  // juiz geral, observadores, e quem chegou depois do sorteio.
  const foraDoDraw = (() => {
    if (!detalhe || !detalhe.presentes) return [];
    const noDraw = nomesDoDraw(detalhe.draw);
    return detalhe.presentes.filter((p) => p.nome && !noDraw.has(norm(p.nome)));
  })();

  return (
    <div className="space-y-3">
      <Card style={{ animationDelay: '.05s' }}>
        <SectionLabel icon={IconClock}>Treinos anteriores</SectionLabel>

        {datas === null && (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => <div key={i} className="skeleton h-11 rounded-lg" />)}
          </div>
        )}

        {datas && datas.length === 0 && (
          <p className="text-sm text-muted py-4">Nenhum treino registrado ainda.</p>
        )}

        {datas && datas.length > 0 && (
          <div className="space-y-1.5">
            {datas.map((dataISO, i) => (
              <button
                key={dataISO}
                onClick={() => abrir(dataISO)}
                style={{ animationDelay: i * 0.04 + 's' }}
                className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl
                  bg-surface-2 border border-border text-left transition animate-fade-up
                  hover:border-bordo/60 hover:-translate-y-0.5"
              >
                <span className="text-[13px] font-semibold">{fmtBR(dataISO)}</span>
                <span className="flex items-center gap-2">
                  {!publicadas.has(dataISO) && (
                    <span className="text-[10px] text-muted border border-border rounded-full px-2 py-0.5">
                      só presença
                    </span>
                  )}
                  <span className="text-muted text-sm">›</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </Card>

      {detalhe && (
        <Card style={{ animationDelay: '.1s' }}>
          <SectionLabel icon={IconClock}>Treino de {fmtBR(detalhe.data)}</SectionLabel>
          {detalhe.draw === null || detalhe.presentes === null
            ? <div className="skeleton h-28 rounded-xl2" />
            : detalhe.draw.salas.length > 0
              ? <DrawView draw={detalhe.draw} />
              : (
                <p className="text-sm text-muted py-2">
                  Sem draw publicado neste dia — só o registro de presença.
                </p>
              )}
        </Card>
      )}

      {detalhe && detalhe.presentes && foraDoDraw.length > 0 && (
        <Card style={{ animationDelay: '.14s' }}>
          <SectionLabel icon={IconUsers}>Presentes fora do draw</SectionLabel>
          <p className="text-xs text-muted mb-2.5">
            Registraram presença em {fmtBR(detalhe.data)} mas não foram alocados numa
            sala nem como juiz geral. Contam como treino no acompanhamento de trainees.
          </p>
          <div className="space-y-1.5">
            {foraDoDraw.map((p) => (
              <div key={p.presencaId}
                className="flex items-center justify-between gap-2 bg-surface-2 border
                  border-border rounded-lg px-3 py-2">
                <span className="text-[13px] font-semibold">{p.nome}</span>
                <span className={`text-[10px] uppercase tracking-wider border rounded-full
                  px-2 py-0.5 whitespace-nowrap ${TAG[p.tipo] || 'text-bordo border-[#c1405966]'}`}>
                  {ROTULO[p.tipo] || p.tipo}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
