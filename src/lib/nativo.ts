// MANEJO DE PLUGINS CON CAPACITOR
// Patrón recomendado: wrapper con 1) detección de plataforma 2) try/catch 3) fallback web.
// Así la misma app corre en navegador (dev) y en Android/iOS (producción).
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Preferences } from '@capacitor/preferences';

// 1. ¿Estoy en teléfono real o en navegador?
export const esNativo = () => Capacitor.isNativePlatform();
export const plataforma = () => Capacitor.getPlatform(); // 'web' | 'android' | 'ios'

// 2. VIBRACIÓN: Haptics en nativo, navigator.vibrate en web
export async function vibrar(): Promise<string> {
  try {
    if (esNativo()) {
      await Haptics.impact({ style: ImpactStyle.Medium });
      return 'Haptics nativo ejecutado (Android/iOS)';
    }
    // Fallback web
    if ('vibrate' in navigator && navigator.vibrate(200)) {
      return 'navigator.vibrate web ejecutado (solo Android/Chrome)';
    }
    return 'Este navegador no soporta vibración, pero en móvil sí funcionará';
  } catch (e) {
    return `Error vibrando: ${String(e)}`;
  }
}

// 3. STORAGE NATIVO: Preferences en móvil, localStorage en web
// Preferences = storage persistente que no borra el SO (mejor que localStorage en móvil)
export async function guardarContador(valor: number): Promise<void> {
  try {
    await Preferences.set({ key: 'contador-plugins', value: String(valor) });
  } catch {
    localStorage.setItem('contador-plugins', String(valor)); // fallback
  }
}

export async function leerContador(): Promise<number> {
  try {
    const r = await Preferences.get({ key: 'contador-plugins' });
    return r.value ? parseInt(r.value, 10) : 0;
  } catch {
    return parseInt(localStorage.getItem('contador-plugins') ?? '0', 10);
  }
}

// 4. CÓMO SERÍA CON CORDOVA (legado, solo referencia):
// Cordova usa window.cordova + plugins globales, ej:
//   document.addEventListener('deviceready', () => navigator.vibration.vibrate(200))
// Problemas: depende de deviceready, tipado pobre, config.xml manual.
// Capacitor lo reemplaza: imports ESM, promesas, mismo código web+nativo.
