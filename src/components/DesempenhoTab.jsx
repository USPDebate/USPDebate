'use client';
import { useState, useEffect, useMemo } from 'react';
import Card, { SectionLabel } from '@/components/ui/Card';
import Autocomplete from '@/components/ui/Autocomplete';
import LineChart from '@/components/ui/LineChart';
import { IconScale, IconClock, IconUsers } from '@/components/ui/Icons';
import { getSpeaks } from '@/lib/supabase';
import { calibrar, ranking, serieDebatedor, evolucaoClube } from '@/lib/speaks-stats';

function fmtData(iso) {
  if (!iso) return '';
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

export default function DesempenhoTab() {
  const [speaks, setSpeaks] = useState(null);
  const [nomeBusca, setNomeBusca] = useState('');
  const [selecionado, setSelecionado] = useState(null); // pessoaId

  useEffect(() => {
    getSpeaks().then((s) => setSpeaks(s || [])).catch(() => setSpeaks([]));
  }, []);

  const cal = useMemo(() => calibrar(speaks || []), [speaks]);
  const rank = useMemo(() => ranking(cal), [cal]);
  const clube = useMemo(() => evolucaoClube(cal), [cal]);

  const debSel = selecionado ? rank.find((d) => d.pessoaId === selecionado) : null;
  const serie = useMemo(
    () => (selecionado ? serieDebatedor(cal, selecionado) : []),
    [cal, selecionado]
  );

  function escolher(nome) {
    setNomeBusca(nome);
    const d = rank.find((r) => r.nome === nome);
    setSelecionado(d ? d.pessoaId : null);
  }

  if (speaks === null) {
    return (
      <Card style={{ animationDelay: '.05s' }}>
        <SectionLabel icon={IconScale}>Desempenho</SectionLabel>
        <div className="skeleton h-40 rounded-xl2" />
      </Card>
    );
  }

  if (speaks.length === 0) {
    return (
      <Card style={{ animationDelay: '.05s' }}>
        <SectionLabel icon={IconScale}>Desempenho</SectionLabel>
        <div className="text-center py-10 text-muted">
          <div className="text-sm font-semibold">Ainda não há speaker points registrados.</div>
          <div className="text-xs mt-1">Os dados aparecem aqui conforme os juízes registram as notas.</div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {/* Evolução do clube */}
      <Card style={{ animationDelay: '.05s' }}>
        <SectionLabel icon={IconClock}>Evolução do clube</SectionLabel>
        <p className="text-[11px] text-muted mb-3">
          Média ajustada (descontado o viés de cada juiz) por treino.
        </p>
        <LineChart
          series={[{
            nome: 'Clube',
            cor: 'var(--gold)',
            pontos: clube.map((c) => ({ x: fmtData(c.data), y: c.media })),
          }]}
        />
      </Card>

      {/* Debatedor individual */}
      <Card style={{ animationDelay: '.1s' }}>
        <SectionLabel icon={IconScale}>Evolução individual</SectionLabel>
        <div className="mb-3">
          <Autocomplete
            value={nomeBusca}
            options={rank.map((d) => d.nome)}
            placeholder="Escolha um debatedor..."
            onChange={escolher}
          />
        </div>

        {debSel && (
          <>
            <div className="grid grid-cols-4 gap-2 mb-4">
              {[
                ['Rodadas', debSel.rodadas],
                ['Média crua', debSel.mediaCrua.toFixed(1)],
                ['Nível', debSel.nivel.toFixed(1)],
                ['Ranking', 'Top ' + debSel.topPct + '%'],
              ].map(([lbl, val]) => (
                <div key={lbl} className="bg-surface-2 border border-border rounded-xl p-2.5 text-center">
                  <div className="font-display text-lg text-bordo">{val}</div>
                  <div className="text-[8px] uppercase tracking-widest text-muted mt-0.5">{lbl}</div>
                </div>
              ))}
            </div>
            <LineChart
              series={[
                {
                  nome: 'Nota crua',
                  cor: 'var(--muted)',
                  pontos: serie.map((p) => ({ x: fmtData(p.data), y: p.cru })),
                },
                {
                  nome: 'Nota ajustada',
                  cor: 'var(--bordo)',
                  pontos: serie.map((p) => ({ x: fmtData(p.data), y: p.ajustado })),
                },
              ]}
            />
            <div className="flex items-center justify-center gap-5 mt-2 text-[11px]">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 rounded" style={{ background: 'var(--muted)' }} />
                <span className="text-muted">nota crua</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 rounded" style={{ background: 'var(--bordo)' }} />
                <span className="text-bordo">nota ajustada</span>
              </span>
            </div>

            <div className="mt-4">
              <div className="text-[10px] uppercase tracking-widest text-muted mb-2">
                Todas as notas
              </div>
              <div className="flex items-center gap-2 px-3 text-[9px] uppercase tracking-widest text-muted mb-1">
                <span className="w-12">Data</span>
                <span className="w-16">Posição</span>
                <span className="flex-1">Juiz</span>
                <span className="w-10 text-right">Crua</span>
                <span className="w-12 text-right">Ajust.</span>
              </div>
              <div className="space-y-1">
                {serie.slice().reverse().map((p, i) => (
                  <div key={i}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-2
                      border border-border text-[12px]">
                    <span className="w-12 text-muted">{fmtData(p.data)}</span>
                    <span className="w-16 text-muted">{p.posicao} · S{p.sala}</span>
                    <span className="flex-1 text-muted truncate">{p.juiz || '—'}</span>
                    <span className="w-10 text-right text-muted">{p.cru.toFixed(0)}</span>
                    <span className="w-12 text-right font-semibold text-bordo">
                      {p.ajustado.toFixed(1)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {!debSel && (
          <p className="text-sm text-muted py-3 text-center">
            Selecione um debatedor para ver a evolução.
          </p>
        )}
      </Card>

      {/* Ranking */}
      <Card style={{ animationDelay: '.15s' }}>
        <SectionLabel icon={IconUsers}>Ranking da temporada</SectionLabel>
        <p className="text-[11px] text-muted mb-3">
          Por nível ajustado — limpo do viés dos juízes.
        </p>
        <div className="space-y-1">
          {rank.map((d, i) => (
            <button
              key={d.pessoaId}
              onClick={() => escolher(d.nome)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-surface-2
                border border-border text-left transition hover:border-bordo/60"
            >
              <span className="w-6 text-center font-display text-sm text-muted">{i + 1}</span>
              <span className="flex-1 text-[13px] font-semibold">{d.nome}</span>
              <span className="text-[11px] text-muted">{d.rodadas} rod.</span>
              <span className="font-display text-base text-bordo w-12 text-right">
                {d.nivel.toFixed(1)}
              </span>
              <span className="text-[10px] text-gold w-16 text-right">Top {d.topPct}%</span>
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}
