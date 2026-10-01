/**
 * Marca. La pista es un SVG inline: sin request extra y hereda `currentColor`,
 * así que sigue al tema sin duplicar assets por variante.
 */
export function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <svg
        viewBox="0 0 32 24"
        className="h-6 w-8 text-accent"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        aria-hidden="true"
      >
        <rect x="1" y="1" width="30" height="22" rx="1.5" />
        <line x1="16" y1="1" x2="16" y2="23" />
        <line x1="1" y1="12" x2="31" y2="12" strokeDasharray="2 2" />
      </svg>
      <span className="whitespace-nowrap font-display text-xl uppercase leading-none tracking-wide">
        <span className="font-bold">Sideline</span>
        {/* En pantallas muy angostas queda solo "Sideline": con idioma y
            "Entrar" al lado, no entra entero. */}
        <span className="font-light text-fg-secondary max-[420px]:hidden"> Padel</span>
      </span>
    </div>
  );
}
