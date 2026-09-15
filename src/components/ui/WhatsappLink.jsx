import { IconWhatsapp } from '@/components/ui/Icons';
import { linkWhatsapp } from '@/lib/whatsapp';

// Ícone ao lado do nome do trainee (admin). Com número: link que abre a
// conversa já com a mensagem pronta. Sem número: ícone apagado, só para
// mostrar que o trainee ainda não cadastrou.
export default function WhatsappLink({ numero, texto, nome, className = '' }) {
  const caixa = `inline-grid place-items-center w-8 h-8 shrink-0 rounded-lg transition ${className}`;
  if (!numero) {
    return (
      <span title={`${nome || 'Trainee'} ainda não cadastrou o WhatsApp`}
        className={`${caixa} text-muted/30`}>
        <IconWhatsapp className="w-4 h-4" />
      </span>
    );
  }
  return (
    <a
      href={linkWhatsapp(numero, texto)}
      target="_blank"
      rel="noopener noreferrer"
      title={`Abrir conversa com ${nome || 'o trainee'} no WhatsApp`}
      aria-label={`WhatsApp de ${nome || 'trainee'}`}
      className={`${caixa} text-[#25d366] hover:bg-[#25d3661a]`}
    >
      <IconWhatsapp className="w-4 h-4" />
    </a>
  );
}
