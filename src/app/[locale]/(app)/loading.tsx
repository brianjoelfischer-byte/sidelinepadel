/**
 * Mientras carga una pantalla de la app: la forma de lo que viene (título,
 * tarjetas), no una rueda girando. La navegación ya está en pantalla, porque
 * vive en el layout; esto reemplaza solo el contenido.
 *
 * `motion-reduce`: sin pulso para quien pidió menos movimiento.
 */
export default function Loading() {
  return (
    <main aria-busy="true" className="mx-auto max-w-5xl px-5 py-8 lg:px-10 lg:py-12">
      <div className="animate-pulse space-y-8 motion-reduce:animate-none">
        <div className="space-y-3">
          <div className="h-4 w-40 rounded-pill bg-bg-elevated" />
          <div className="h-9 w-64 rounded-pill bg-bg-elevated" />
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-28 rounded-card bg-bg-surface" />
          ))}
        </div>
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 rounded-card bg-bg-surface" />
          ))}
        </div>
      </div>
    </main>
  );
}
