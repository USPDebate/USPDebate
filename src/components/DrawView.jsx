import { POS_STYLE, semPar } from '@/lib/draw';

// Render somente-leitura de um draw ({ salas, juizes }).
export default function DrawView({ draw }) {
  if (!draw || !draw.salas || draw.salas.length === 0) {
    return <p className="text-center text-muted py-8 text-sm">Nenhum dado encontrado.</p>;
  }

  return (
    <div className="space-y-3">
      {draw.salas.map((sala) => (
        <div key={sala.numero}
          className="border border-border rounded-xl2 overflow-hidden bg-surface-2 animate-fade-up">
          <div className="flex items-center justify-between gap-2 px-4 py-3 bg-[#120c0e]
            text-[11px] uppercase tracking-wider">
            <span className="font-semibold">
              Sala {sala.numero}
              {sala.incompleta && <span className="text-muted normal-case"> · incompleta</span>}
            </span>
            <div className="flex items-center gap-2">
              {sala.juiz && (
                <span className="text-gold text-[10px] border border-gold/40 rounded-full px-2 py-0.5">
                  Juiz: {sala.juiz}
                </span>
              )}
              <span className="text-bordo text-[10px] border border-bordo/40 rounded-full px-2 py-0.5
                whitespace-nowrap">
                {sala.posicoes.length * 2} pessoas
              </span>
            </div>
          </div>
          {sala.posicoes.map((pos, i) => {
            const p2 = semPar(pos.p2) ? null : pos.p2;
            return (
              <div key={i}
                className="grid grid-cols-[54px_1fr_1fr] gap-2 px-4 py-2.5 items-center
                  text-[13px] border-t border-border">
                <span className={`text-[10px] font-bold text-center py-1 rounded border
                  ${POS_STYLE[pos.posicao] || 'bg-surface text-muted border-border'}`}>
                  {pos.posicao}
                </span>
                <span className="font-semibold">{pos.p1}</span>
                <span className="text-muted">{p2 || '—'}</span>
              </div>
            );
          })}
        </div>
      ))}

      {draw.juizes && draw.juizes.length > 0 && (
        <div className="border border-gold/30 bg-gold/10 rounded-xl2 p-4 animate-fade-up">
          <h3 className="text-[10px] uppercase tracking-[0.15em] text-gold mb-2.5">Juízes gerais</h3>
          {draw.juizes.map((j, i) => (
            <div key={i} className="bg-surface rounded-lg px-3 py-2 mb-1.5 last:mb-0
              text-[13px] font-semibold">
              {j}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
