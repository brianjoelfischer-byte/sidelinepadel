import type { ReactNode } from 'react';

import './globals.css';

/**
 * Layout raíz. Deliberadamente mínimo: el <html> real con su `lang` lo
 * emite `[locale]/layout.tsx`, que es el único que conoce el idioma.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
