// LICENCIA DEL SDK FACIAL — leyéndose desde `.env` (NO commiteado).
//
// Vite: cualquier variable `VITE_*` de .env queda inyectada al compilar
// (import.meta.env). Por eso aquí no hay KEYS quemadas en código: la key vive
// en .env y al código llega ya resuelta.
//
// Selección por plataforma igual que la demo del vendor (example/src/license.ts):
// Android usa la key firmada para la app Android, iOS la suya.
import { Capacitor } from '@capacitor/core';

export function licenciaDemo(): string {
  const env = import.meta.env;
  return Capacitor.getPlatform() === 'ios'
    ? (env.VITE_FACEPLUGIN_LICENSE_IOS as string | undefined)?.trim() ?? ''
    : (env.VITE_FACEPLUGIN_LICENSE_ANDROID as string | undefined)?.trim() ?? '';
}
