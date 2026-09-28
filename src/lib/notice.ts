/**
 * Avisos que llegan por la URL (`?aviso=guardado`). Aparte del componente,
 * que corre en el navegador, porque lo leen páginas del servidor.
 */
export type NoticeKind = 'guardado' | 'borrado';

/** Lee el parámetro sin confiar en él: cualquier otro valor no muestra nada. */
export function noticeFrom(value: string | string[] | undefined): NoticeKind | null {
  return value === 'guardado' || value === 'borrado' ? value : null;
}
