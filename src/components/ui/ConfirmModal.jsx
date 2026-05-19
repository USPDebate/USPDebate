import Button from '@/components/ui/Button';

export default function ConfirmModal({
  aberto, titulo, mensagem, textoConfirmar = 'Confirmar',
  variantConfirmar = 'success', onConfirmar, onCancelar,
}) {
  if (!aberto) return null;
  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center p-5 bg-black/60"
      onClick={onCancelar}
    >
      <div
        className="bg-surface border border-border rounded-xl2 p-6 max-w-sm w-full animate-rise"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-display text-lg font-semibold mb-2">{titulo}</h3>
        <p className="text-sm text-muted mb-5 leading-relaxed">{mensagem}</p>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onCancelar}>Cancelar</Button>
          <Button variant={variantConfirmar} onClick={onConfirmar}>{textoConfirmar}</Button>
        </div>
      </div>
    </div>
  );
}
