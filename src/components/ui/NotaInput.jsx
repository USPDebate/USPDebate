// Campo de nota (speaker points, 50 a 100). Ref.: selo de nota do Metacritic: número
// grande num quadrado escuro, em vez da caixa creme com "—". Rótulo acessível com o
// nome do debatedor; o teclado numérico abre sozinho no celular.
export function foraDaFaixa(v) {
  return v !== undefined && v !== '' && (isNaN(Number(v)) || Number(v) < 50 || Number(v) > 100);
}

// erroId: id do texto de erro, ligado ao campo pelo aria-describedby.
export default function NotaInput({ id, value, onChange, rotulo, invalido, erroId }) {
  const erro = invalido || foraDaFaixa(value);
  return (
    <input
      id={id} type="number" inputMode="numeric" min={50} max={100}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      aria-label={rotulo}
      aria-invalid={erro || undefined}
      aria-describedby={erro && erroId ? erroId : undefined}
      className={`w-16 h-12 shrink-0 px-1 border rounded-xl text-center text-xl font-semibold tabular-nums outline-none
        !bg-bg focus:!border-gold focus:!outline-gold/40
        ${erro ? '!border-danger' : '!border-[#766669]'}`}
    />
  );
}
