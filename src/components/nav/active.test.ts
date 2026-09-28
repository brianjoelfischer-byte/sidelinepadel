import { describe, expect, it } from 'vitest';

import { activeDestination } from './active';

describe('destino activo de la navegación', () => {
  it('cada pantalla marca su botón', () => {
    expect(activeDestination('/panel')).toBe('panel');
    expect(activeDestination('/sesiones')).toBe('sessions');
    expect(activeDestination('/perfil')).toBe('profile');
  });

  /** Empieza igual que /sesiones, pero es el botón central. */
  it('registrar no enciende también Partidos', () => {
    expect(activeDestination('/sesiones/nueva')).toBe('add');
  });

  it('el detalle de un partido sigue en Partidos', () => {
    expect(activeDestination('/sesiones/abc-123')).toBe('sessions');
  });

  /** "/panelx" no es "/panel": comparar por prefijo de texto fallaría acá. */
  it('no confunde rutas que solo comparten el comienzo', () => {
    expect(activeDestination('/panelx')).toBeNull();
    expect(activeDestination('/sesionesviejas')).toBeNull();
  });

  it('una pantalla fuera de la navegación no marca nada', () => {
    expect(activeDestination('/onboarding')).toBeNull();
  });
});
