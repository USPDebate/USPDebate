const VARIANTS = {
  primary: 'bg-gradient-to-br from-bordo to-bordo-soft text-white hover:brightness-110 shadow-lg shadow-bordo/25',
  outline: 'bg-transparent border border-bordo text-bordo hover:bg-bordo/10',
  ghost:   'bg-surface-2 text-text border border-border hover:border-bordo/60',
  danger:  'bg-danger text-white hover:brightness-110',
  success: 'bg-gradient-to-br from-success to-[#245f3e] text-white hover:brightness-110 shadow-lg shadow-success/20',
};

export default function Button({ children, variant = 'primary', className = '', loading = false, ...props }) {
  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      className={`relative w-full rounded-xl px-4 py-3.5 text-[11px] font-semibold uppercase
        tracking-[0.13em] transition active:scale-[0.99]
        disabled:opacity-50 disabled:cursor-not-allowed ${VARIANTS[variant]} ${className}`}
    >
      {loading && (
        <span className="inline-block w-3.5 h-3.5 mr-2 align-middle rounded-full
          border-2 border-white/30 border-t-white animate-[spin_0.7s_linear_infinite]" />
      )}
      {children}
    </button>
  );
}
