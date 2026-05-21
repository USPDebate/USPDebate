'use client';
import { useState, useEffect, useMemo } from 'react';
import Card, { SectionLabel } from '@/components/ui/Card';
import Autocomplete from '@/components/ui/Autocomplete';
import LineChart from '@/components/ui/LineChart';
import { IconScale, IconClock, IconUsers } from '@/components/ui/Icons';
import { getSpeaks } from '@/lib/supabase';
import { calibrar, ranking, serieDebatedor, evolucaoClube, componentesConectados } from '@/lib/speaks-stats';

function fmtData(iso) {
  if (!iso) return '';
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

export default function DesempenhoTab() {
  const [speaks, setSpeaks] = useState(null);
  const [nomeBusca, setNomeBusca] = useState('');
  const [selecionado, setSelecionado] = useState(null); // pessoaId
  const [modoRank, setModoRank] = useState('nivel');    // 'nivel' | 'sps'
  const [explicarNivel, setExplicarNivel] = useState(false);

  useEffect(() => {
    getSpeaks().then((s) => setSpeaks(s || [])).catch(() => setSpeaks([]));
  }, []);

  const cal = useMemo(() => calibrar(speaks || []), [speaks]);
  const componentes = useMemo(() => componentesConectados(speaks || []), [speaks]);
  const rank = useMemo(() => ranking(cal), [cal]);
  const rankExibido = useMemo(() => {
    const base = rank.slice();
    if (modoRank === 'sps') base.sort((a, b) => b.mediaCrua - a.mediaCrua);
    return base;
  }, [rank, modoRank]);
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

  const desconectados = componentes.length > 1;

  return (
    <div className="space-y-3">
      {desconectados && (
        <Card style={{ animationDelay: '.02s' }} className="border-l-2 border-l-gold">
          <SectionLabel icon={IconUsers}>Atenção: grupos desconectados</SectionLabel>
          <p className="text-[12px] text-muted leading-relaxed">
            O grafo de avaliações tem <strong className="text-gold">{componentes.length} grupos</strong>
            {' '}sem juízes em comum. Comparações de nível <em>entre</em> grupos diferentes não são
            confiáveis — o modelo não consegue separar viés de juiz de nível de debatedor sem
            sobreposição. Dentro do mesmo grupo, OK.
          </p>
          <div className="mt-2 space-y-1.5">
            {componentes.slice(0, 4).map((g, i) => (
              <div key={i} className="text-[11px] text-muted bg-surface-2 border border-border
                rounded-lg px-2.5 py-1.5">
                <strong className="text-text">Grupo {i + 1}:</strong>{' '}
                {g.debatedores.length} debatedor(es), {g.juizes.length} juiz(es)
                {g.debatedores.length <= 5 && g.debatedores[0]?.nome && (
                  <span className="text-muted/80"> — {g.debatedores.map((d) => d.nome).join(', ')}</span>
                )}
              </div>
            ))}
            {componentes.length > 4 && (
              <div className="text-[11px] text-muted">…e mais {componentes.length - 4} grupos.</div>
            )}
          </div>
        </Card>
      )}

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

        {/* Toggle Nível / SPs */}
        <div className="flex gap-1.5 mb-2">
          {[
            { id: 'nivel', label: 'Nível', sub: 'calibrado' },
            { id: 'sps', label: 'SPs', sub: 'média crua' },
          ].map((opt) => {
            const ativo = modoRank === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setModoRank(opt.id)}
                className={`flex-1 rounded-xl text-[12px] font-semibold border transition py-2
                  ${ativo
                    ? 'bg-gradient-to-br from-bordo to-bordo-soft text-white border-bordo'
                    : 'bg-surface-2 text-muted border-border hover:border-bordo/60'}`}
              >
                <div>{opt.label}</div>
                <div className={`text-[9px] uppercase tracking-wider mt-0.5
                  ${ativo ? 'text-white/80' : 'text-muted'}`}>{opt.sub}</div>
              </button>
            );
          })}
        </div>

        {/* Explicação do Nível */}
        <button
          type="button"
          onClick={() => setExplicarNivel((x) => !x)}
          className="text-[11px] text-bordo hover:underline mb-2"
        >
          {explicarNivel ? '▾ esconder explicação' : '▸ o que é Nível? como é calculado?'}
        </button>
        {explicarNivel && (
          <div className="text-[11px] text-muted bg-surface-2 border border-border rounded-lg
            p-3 mb-3 space-y-1.5 leading-relaxed">
            <p>
              <strong className="text-text">SPs</strong> é a média crua das notas que a pessoa
              recebeu — soma e divide pela quantidade. Simples e direto.
            </p>
            <p>
              <strong className="text-text">Nível</strong> é uma estimativa calibrada do skill
              "verdadeiro". O modelo trata cada nota como{' '}
              <code className="text-[10px]">nível_do_debatedor + viés_do_juiz + erro</code> e
              estima as duas coisas iterativamente — assim quem foi julgado por um juiz mais
              duro não é penalizado.
            </p>
            <p>
              <strong className="text-text">Shrinkage</strong>: com poucas rodadas, o nível é
              puxado em direção à média do clube (a confiança numa amostra pequena é baixa).
              A força do shrinkage (<code className="text-[10px]">K</code>) é estimada dos
              dados — hoje{' '}
              <strong className="text-text">K ≈ {cal.K ? cal.K.toFixed(1) : '—'}</strong>.
            </p>
            <p>
              <strong className="text-text">± erro padrão</strong> mostra a incerteza da
              estimativa. Quanto mais rodadas, menor o erro. Dois níveis cujos intervalos se
              sobrepõem (ex.: 76 ± 2 vs 77 ± 2) não devem ser tratados como diferentes.
            </p>
            <p>
              <strong className="text-text">Ponderação temporal</strong>: notas recentes pesam
              mais (meia-vida de {cal.halfLifeDias ?? 'sem decaimento'} dias) — captura
              evolução ao longo da temporada.
            </p>
            <p className="text-[10px] italic">
              Tecnicamente: modelo aditivo de dois fatores cruzados com shrinkage de Bayes
              empírico, K estimado dos componentes de variância, pesos por decaimento
              exponencial.
            </p>
          </div>
        )}

        <div className="space-y-1">
          {rankExibido.map((d, i) => {
            const valor = modoRank === 'sps' ? d.mediaCrua : d.nivel;
            const se = modoRank === 'nivel' ? d.seNivel : 0;
            const topPct = Math.max(1, Math.round((100 * (i + 1)) / rankExibido.length));
            return (
              <button
                key={d.pessoaId}
                onClick={() => escolher(d.nome)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-surface-2
                  border border-border text-left transition hover:border-bordo/60"
              >
                <span className="w-6 text-center font-display text-sm text-muted">{i + 1}</span>
                <span className="flex-1 text-[13px] font-semibold truncate">{d.nome}</span>
                <span className="text-[11px] text-muted whitespace-nowrap">{d.rodadas} rod.</span>
                <div className="w-14 text-right">
                  <div className="font-display text-base text-bordo leading-none">
                    {valor.toFixed(1)}
                  </div>
                  {modoRank === 'nivel' && se > 0 && (
                    <div className="text-[9px] text-muted mt-0.5">±{se.toFixed(1)}</div>
                  )}
                </div>
                <span className="text-[10px] text-gold w-14 text-right">Top {topPct}%</span>
              </button>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
