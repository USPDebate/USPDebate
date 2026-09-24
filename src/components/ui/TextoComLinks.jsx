// Texto livre (ex.: descrição da formação) com os endereços viráveis em link.
// Pega http(s):// e www.; a pontuação no fim ("veja https://x.com.") fica fora do link.
const URL_RE = /((?:https?:\/\/|www\.)[^\s<]+[^\s<.,;:!?)\]'"”’])/gi;

export default function TextoComLinks({ texto }) {
  return texto.split(URL_RE).map((parte, i) =>
    i % 2 === 1 ? (
      <a key={i} href={parte.startsWith('www.') ? `https://${parte}` : parte}
        target="_blank" rel="noopener noreferrer"
        className="text-bordo underline underline-offset-2 decoration-bordo/40 hover:decoration-bordo break-all">
        {parte}
      </a>
    ) : parte
  );
}
