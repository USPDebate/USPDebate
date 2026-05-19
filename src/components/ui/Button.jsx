const VARIANTS = {
  primary: 'bg-gradient-to-br from-bordo to-bordo-soft text-white hover:brightness-110 shadow-lg shadow-bordo/25',
  outline: 'bg-transparent border border-bordo text-bordo hover:bg-bordo/10',
  ghost:   'bg-surface-2 text-text border border-border hover:border-bordo/60',
  danger:  'bg-danger text-white hover:brightness-110',
  success: 'bg-gradient-to-br from-success to-[#245f3e] text-white hover:brightness-110 shadow-lg shadow-success/20',
};

export default function Button({ children, variant = 'primary', className = '', loading = false, onClick, ...props }) {
  function handleClick(e) {
    // efeito ripple a partir do ponto do toque
    const btn = e.currentTarget;
    const d = Math.max(btn.clientWidth, btn.clientHeight);
    const rect = btn.getBoundingClientRect();
    const circle = document.createElement('span');
    circle.className = 'ripple';
    circle.style.width = circle.style.height = d + 'px';
    circle.style.left = (e.clientX - rect.left - d / 2) + 'px';
    circle.style.top = (e.clientY - rect.top - d / 2) + 'px';
    btn.appendChild(circle);
    setTimeout(() => circle.remove(), 600);
    if (onClick) onClick(e);
  }

  return (
    <button
      {...props}
      onClick={handleClick}
      disabled={props.disabled || loading}
      className={`relative overflow-hidden w-full rounded-xl px-4 py-3.5 text-[11px] font-semibold
        tracking-[0.13em] uppercase transition active:scale-[0.99]
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
