export default function Card({ children, className = '', style }) {
  return (
    <div
      style={style}
      className={`bg-surface border border-border rounded-xl2 p-5 sm:p-6 animate-rise ${className}`}
    >
      {children}
    </div>
  );
}

export function SectionLabel({ children, icon: Icon, right }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      {Icon && (
        <span className="grid place-items-center w-8 h-8 rounded-lg bg-bordo/15 text-bordo shrink-0">
          <Icon className="w-4 h-4" />
        </span>
      )}
      <span className="text-[12px] font-semibold uppercase tracking-[0.16em] text-text">{children}</span>
      <span className="flex-1 h-px bg-border" />
      {right}
    </div>
  );
}
