import { IconCheck } from '@/components/ui/Icons';

// Grupo de escolha única com rádios nativos (setas do teclado, leitor de tela),
// no mesmo desenho dos tiles da Presença: sem escolha = só contorno 3:1; escolhido =
// borda clara de 2px + check + fundo levemente mais claro. Nada de bordô aqui:
// bordô é só do botão de ação.
// opcoes: [{ valor, rotulo, detalhe? }]. compacto: números curtos (1 a 8) numa linha só
// no celular, sem o check (a borda de 2px + fundo já marcam a escolha).
export default function Escolha({ legenda, ajuda, name, opcoes, value, onChange, compacto = false }) {
  return (
    <fieldset>
      <legend className="block text-[15px] font-medium text-text">{legenda}</legend>
      {ajuda && <p className="text-[13px] text-muted mt-0.5">{ajuda}</p>}
      <div className={`mt-3 ${compacto ? 'grid grid-cols-8 gap-1.5 sm:flex sm:flex-wrap sm:gap-2' : 'flex flex-wrap gap-2'}`}>
        {opcoes.map((o) => {
          const ativo = value === o.valor;
          return (
            <label key={o.valor}
              className={`relative inline-flex items-center gap-2 min-h-[44px] py-2 rounded-xl cursor-pointer select-none ${compacto ? 'justify-center px-0 sm:w-11' : 'pl-3.5 pr-3'}
                text-[15px] text-text transition-colors
                has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-gold
                ${ativo ? 'bg-white/[0.07] ring-2 ring-inset ring-text' : 'ring-1 ring-inset ring-[#766669] hover:bg-white/[0.03]'}`}>
              <input type="radio" name={name} value={o.valor} checked={ativo}
                onChange={() => onChange(o.valor)} className="sr-only" />
              <span>
                {o.rotulo}
                {o.detalhe && <span className="block text-[13px] text-muted leading-tight">{o.detalhe}</span>}
              </span>
              {ativo && !compacto && <IconCheck className="w-4 h-4 shrink-0" />}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
