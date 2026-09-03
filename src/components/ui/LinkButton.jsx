const VARIANTS = {
  outline: 'border border-border text-muted hover:border-bordo hover:text-bordo',
  plain:   'text-muted hover:text-bordo',
};

// Ação secundária de texto (ex.: sair, editar, não sou eu). Padding real
// (não só área de toque invisível) porque também ajuda a ler o texto
// pequeno com a tela mexendo na mão.
export default function LinkButton({ children, variant = 'outline', className = '', ...props }) {
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex items-center justify-center gap-1.5 text-[11px]
        rounded-lg px-3.5 py-3.5 transition whitespace-nowrap
        disabled:opacity-50 disabled:cursor-not-allowed
        ${VARIANTS[variant]} ${className}`}
    >
      {children}
    </button>
  );
}
