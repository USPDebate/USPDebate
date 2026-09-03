const VARIANTS = {
  ghost:  'bg-surface border border-border text-muted hover:border-bordo hover:text-bordo',
  danger: 'bg-surface border border-[#e0625a80] text-danger hover:bg-[#e0625a1a]',
};

// Ícone isolado (ex.: remover imagem, apagar). O alvo visível fica pequeno de
// propósito, mas o ::before estende a área de toque real até 44px — o mínimo
// recomendado (WCAG/HIG) — sem empurrar o layout ao redor.
export default function IconButton({ children, variant = 'ghost', className = '', title, ...props }) {
  return (
    <button
      type="button"
      title={title}
      {...props}
      className={`relative inline-flex items-center justify-center w-6 h-6 rounded-full
        transition active:scale-90 shrink-0
        before:content-[''] before:absolute before:-inset-2.5
        ${VARIANTS[variant]} ${className}`}
    >
      {children}
    </button>
  );
}
