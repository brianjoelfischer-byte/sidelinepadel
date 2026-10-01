import { PinIcon } from '@/components/nav/icons';
import type { VenueLabel } from '@/lib/sessions/venue-names';
import { mapsSearchUrl } from '@/lib/venues/maps';

/**
 * El lugar del partido, como enlace a Google Maps.
 *
 * Nombre y ciudad, no coordenadas: con coordenadas Google muestra un pin
 * suelto; con el nombre abre la ficha del club, que es "el lugar real".
 * Nueva pestaña para no sacarte de la app, y `noreferrer` para que Google no
 * reciba desde qué pantalla llegaste.
 */
export function VenueLink({ venue, label }: { venue: VenueLabel | null; label: string }) {
  if (!venue) return null;
  const text = venue.city ? `${venue.name}, ${venue.city}` : venue.name;
  const href = mapsSearchUrl(text);
  if (!href) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${text} · ${label}`}
      className="inline-flex max-w-full items-center gap-1 text-sm font-semibold text-fg underline decoration-white/25 underline-offset-4 hover:decoration-accent"
    >
      <PinIcon className="h-4 w-4 shrink-0 text-accent" />
      <span className="truncate">{text}</span>
    </a>
  );
}
