// Fundo decorativo — textura de faixas diagonais + brilho radial sutil.
// Deriva lenta dá movimento sutil; respeita prefers-reduced-motion.
export default function Decor() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {/* base texturizada — faixas diagonais escuras, dão profundidade sem competir com os cards */}
      <div className="decor-stripes absolute inset-0" />

      {/* brilho radial sutil — pulsa devagar */}
      <div
        className="decor-glow absolute -top-1/4 left-1/2 w-[1000px] h-[1000px] rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(193,64,89,0.10), transparent 62%)' }}
      />
    </div>
  );
}
