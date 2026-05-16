// Linhas de fundo decorativas — feixe de curvas em bordô cruzando a tela toda.
// Puramente estético, atrás de todo o conteúdo, sem interação.
export default function Decor() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {/* brilho radial sutil */}
      <div
        className="absolute -top-1/4 left-1/2 -translate-x-1/2 w-[1000px] h-[1000px] rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(193,64,89,0.10), transparent 62%)' }}
      />
      {/* feixe de linhas cobrindo toda a viewport */}
      <svg
        className="absolute inset-0 w-full h-full opacity-[0.17]"
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
      >
        {Array.from({ length: 18 }).map((_, i) => {
          const o = i * 64;
          return (
            <path
              key={i}
              d={`M -120 ${1080 - o}
                  C 360 ${940 - o}, 720 ${640 - o * 0.72}, 1000 ${380 - o * 0.55}
                  S 1480 ${60 - o * 0.42}, 1760 ${-140 - o}`}
              stroke="var(--bordo)"
              strokeWidth="1.5"
              fill="none"
            />
          );
        })}
      </svg>
    </div>
  );
}
