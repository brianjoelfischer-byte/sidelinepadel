/**
 * Título de pantalla en dos pesos, como los rótulos de las transmisiones:
 * la primera palabra fina y el resto en negrita, uno debajo del otro.
 *
 *   MIS            HOLA,
 *   PARTIDOS       BRIAN
 *
 * Parte el texto en el primer espacio, así funciona con cualquier traducción
 * sin claves nuevas. Una sola palabra va entera en negrita. El espacio entre
 * los dos renglones queda en el texto, así el lector de pantalla lee
 * "Mis partidos" y no "Mispartidos".
 */
export function DisplayTitle({
  text,
  className = '',
}: {
  text: string;
  className?: string;
}) {
  const cut = text.indexOf(' ');
  const light = cut > 0 ? text.slice(0, cut) : null;
  const strong = cut > 0 ? text.slice(cut + 1) : text;

  return (
    <h1 className={`font-display uppercase leading-[0.95] ${className}`}>
      {light ? <span className="block font-light">{light}</span> : null}
      {light ? ' ' : null}
      <span className="block font-bold">{strong}</span>
    </h1>
  );
}
