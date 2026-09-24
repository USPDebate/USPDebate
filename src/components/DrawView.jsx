import { norm } from '@/lib/data';
import { POS_LETRA, semPar, panelSala } from '@/lib/draw';

// Cada sala desenhada como a sala de verdade do BP, vista de cima: mesa dos juízes
// na cabeceira, Governo à esquerda e Oposição à direita, bancadas de abertura na
// frente e de fechamento atrás (ref.: planta da Câmara dos Comuns). O encosto da
// bancada fica do lado de fora; o corredor fica no meio.
// Encosto da bancada: do lado de fora (Governo à esquerda, Oposição à direita).
const BANCADA = {
  OG: 'border-l-[3px] border-emerald-300/40', OO: 'border-r-[3px] border-sky-300/40 text-right',
  CG: 'border-l-[3px] border-orange-300/40', CO: 'border-r-[3px] border-violet-300/40 text-right',
};

// eu: nome de quem está olhando (card "Onde eu estou?"), pra destacar a bancada/mesa.
export default function DrawView({ draw, eu = '' }) {
  if (!draw || !draw.salas || draw.salas.length === 0) {
    return <p className="text-muted py-8 text-[15px]">O draw de hoje ainda não saiu.</p>;
  }
  const meu = norm(eu);
  const souEu = (nome) => !!meu && !!nome && norm(nome) === meu;

  return (
    // Juízes gerais entram na mesma grade: com nº ímpar de salas ocupam a vaga ao
    // lado da última; com nº par, a linha inteira.
    <div className="grid gap-4 sm:gap-5 lg:grid-cols-2">
      {draw.salas.map((sala, idx) => {
        const juizes = panelSala(sala);
        const porPos = Object.fromEntries(sala.posicoes.map((p) => [p.posicao, p]));
        const pessoas = sala.posicoes.reduce((n, pos) => n + 1 + (semPar(pos.p2) ? 0 : 1), 0);
        const julgoAqui = juizes.some(souEu);
        return (
          <section key={sala.numero} id={`sala-${sala.numero}`} aria-labelledby={`sala-${sala.numero}-t`}
            style={{ animationDelay: idx * 0.05 + 's' }}
            className="rounded-xl2 bg-surface p-4 sm:p-6 animate-rise scroll-mt-6">
            <h3 id={`sala-${sala.numero}-t`} className="font-display text-2xl font-semibold tracking-tight">
              Sala {sala.numero}
              {sala.incompleta && (
                <span className="font-sans text-[13px] font-normal tracking-normal text-muted"> · incompleta, {pessoas} pessoas</span>
              )}
            </h3>

            {/* Mesa dos juízes, na cabeceira */}
            <div className={`mt-4 mx-auto sm:w-4/5 rounded-xl px-4 py-2.5 text-center bg-surface-2
              ${julgoAqui ? 'ring-2 ring-inset ring-text' : ''}`}>
              <p className="text-[13px] text-muted">
                {juizes.length > 1 ? 'Juízes' : juizes.length ? 'Juiz' : 'Sem juiz alocado'}
                {julgoAqui && <span className="text-text"> · você</span>}
              </p>
              {juizes.length > 0 && <p className="text-[15px] text-text text-pretty">{juizes.join(', ')}</p>}
            </div>

            {/* Bancadas numa grade 2x2 (é a planta da sala, até no celular): OG|OO na frente,
                CG|CO atrás, então as linhas se alinham. Nome longo quebra linha, não corta. */}
            <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 sm:gap-x-6">
              <p className="text-[13px] text-muted">Governo</p>
              <p className="text-[13px] text-muted text-right">Oposição</p>
              {['OG', 'OO', 'CG', 'CO'].map((sigla) => {
                const pos = porPos[sigla];
                const p2 = pos && !semPar(pos.p2) ? pos.p2 : null;
                const aqui = !!pos && (souEu(pos.p1) || souEu(p2));
                return (
                  <div key={sigla}
                    className={`rounded-xl px-3 py-2.5 ${BANCADA[sigla]}
                      ${aqui ? 'bg-white/[0.08] ring-2 ring-inset ring-text' : 'bg-white/[0.03]'}`}>
                    <p className={`text-[13px] font-bold tracking-wide ${POS_LETRA[sigla]}`}>
                      {sigla}{aqui && <span className="font-normal tracking-normal text-text"> · você</span>}
                    </p>
                    {pos ? (
                      <p className="mt-0.5 text-[13px] sm:text-[15px] leading-snug text-text break-words">
                        <span className="block">{pos.p1}</span>
                        {p2 ? <span className="block">{p2}</span> : <span className="block text-muted">sem dupla</span>}
                      </p>
                    ) : <p className="mt-0.5 text-[13px] text-muted">vazia</p>}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      {draw.juizes && draw.juizes.length > 0 && (
        <section aria-labelledby="juizes-gerais" className={`rounded-xl2 bg-surface p-5 sm:p-6 animate-fade-up ${draw.salas.length % 2 ? 'lg:self-start' : 'lg:col-span-2'}`}>
          <h3 id="juizes-gerais" className="text-[15px] font-medium text-text">
            Juízes gerais <span className="text-muted tabular-nums">{draw.juizes.length}</span>
          </h3>
          <ul className={`mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2 text-[15px] text-text ${draw.salas.length % 2 ? '' : 'lg:grid-cols-3'}`}>
            {draw.juizes.map((j) => (
              <li key={j}>{j}{souEu(j) && <span className="text-muted"> · você</span>}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
