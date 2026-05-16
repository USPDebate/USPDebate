const STYLES = {
  success: 'bg-success/10 border-success/40 text-success',
  error:   'bg-danger/10 border-danger/40 text-danger',
  info:    'bg-bordo/10 border-bordo/40 text-bordo',
  warning: 'bg-gold/10 border-gold/40 text-gold',
};

// Mostra a mensagem; nada renderizado quando `msg` é vazio.
export default function Alert({ tipo = 'info', msg }) {
  if (!msg) return null;
  return (
    <div className={`flex items-start gap-2.5 px-4 py-3 mb-3.5 rounded-lg border text-[13px]
      animate-fade-up ${STYLES[tipo] || STYLES.info}`}>
      <span>{msg}</span>
    </div>
  );
}
