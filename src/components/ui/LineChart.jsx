import { useId } from 'react';

// Gráfico de linha em SVG puro — sem biblioteca, leve, tema escuro.
// series: [{ nome, cor, pontos: [{ x: 'rótulo', y: número }] }]
export default function LineChart({ series = [], altura = 200 }) {
  const uid = useId();
  const todos = series.flatMap((s) => s.pontos);
  if (todos.length === 0) {
    return <p className="text-sm text-muted py-8 text-center">Sem dados para o gráfico.</p>;
  }

  const ys = todos.map((p) => p.y);
  let minY = Math.min(...ys);
  let maxY = Math.max(...ys);
  if (minY === maxY) { minY -= 1; maxY += 1; }
  const folga = (maxY - minY) * 0.18;
  minY -= folga;
  maxY += folga;

  const n = Math.max(...series.map((s) => s.pontos.length), 1);
  const W = 620, H = altura;
  const padL = 40, padR = 14, padT = 14, padB = 28;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const px = (i) => padL + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const py = (v) => padT + plotH - ((v - minY) / (maxY - minY)) * plotH;

  const linhasY = [maxY, (maxY + minY) / 2, minY];

  // rótulos do eixo X — primeiro da maior série; mostra até ~6
  const base = series.reduce((a, b) => (b.pontos.length > a.pontos.length ? b : a), series[0]);
  const passo = Math.ceil(base.pontos.length / 6) || 1;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 'auto' }}>
      {/* linhas-guia e rótulos Y */}
      {linhasY.map((v, i) => (
        <g key={i}>
          <line x1={padL} x2={W - padR} y1={py(v)} y2={py(v)}
            stroke="var(--border)" strokeWidth="1" strokeDasharray={i === 2 ? '0' : '3 3'} />
          <text x={padL - 6} y={py(v) + 3} textAnchor="end"
            fontSize="10" fill="var(--muted)">{v.toFixed(1)}</text>
        </g>
      ))}

      {/* rótulos X */}
      {base.pontos.map((p, i) =>
        i % passo === 0 || i === base.pontos.length - 1 ? (
          <text key={i} x={px(i)} y={H - 8} textAnchor="middle" fontSize="10" fill="var(--muted)">
            {p.x}
          </text>
        ) : null
      )}

      {/* séries */}
      {series.map((s, si) => {
        const pts = s.pontos.map((p, i) => `${px(i)},${py(p.y)}`).join(' ');
        const area = `${px(0)},${py(minY)} ${pts} ${px(s.pontos.length - 1)},${py(minY)}`;
        const gradId = `${uid}-grad-${si}`;
        return (
          <g key={si}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.cor} stopOpacity="0.32" />
                <stop offset="100%" stopColor={s.cor} stopOpacity="0" />
              </linearGradient>
            </defs>
            <polygon points={area} fill={`url(#${gradId})`} className="animate-fade-up" />
            <polyline points={pts} fill="none" stroke={s.cor} strokeWidth="2.5" pathLength="1"
              strokeLinejoin="round" strokeLinecap="round" className="chart-line" />
            {s.pontos.map((p, i) => (
              <circle key={i} cx={px(i)} cy={py(p.y)} r="3" fill={s.cor}
                className="chart-point" style={{ animationDelay: `${950 + i * 35}ms` }} />
            ))}
          </g>
        );
      })}
    </svg>
  );
}
