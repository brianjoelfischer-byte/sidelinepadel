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
      className="inline-flex max-w-full items-center gap-1 text-xs text-fg-secondary underline decoration-border underline-offset-4 hover:text-fg hover:decoration-fg-secondary"
    >
      <PinIcon className="h-3.5 w-3.5 shrink-0 text-accent-2" />
      <span className="truncate">{text}</span>
    </a>
  );
}
