// CONSUMIR UN PLUGIN CORDOVA DESDE UN PROYECTO CAPACITOR
// Capacitor es compatible con la mayoría de plugins Cordova.
// Instalación típica (ejemplo con vibration):
//   npm i cordova-plugin-vibration
//   npx cap sync   <- copia el plugin nativo a android/ios
//
// Si existe wrapper tipado, mejor:
//   npm i @awesome-cordova-plugins/vibration @awesome-cordova-plugins/core
import { Capacitor } from '@capacitor/core';

// 1. Declara lo que el plugin Cordova inyecta en window.
// Cada plugin documenta su global. Ej: vibration -> navigator.vibration
declare global {
  interface Navigator {
    vibration?: { vibrate(pattern: number | number[]): void };
  }
}

// 2. Mismo patrón que con Capacitor: aislar en función + fallback.
export async function vibrarCordova(): Promise<string> {
  // En web (npm run dev) el plugin no existe -> fallback directo
  if (!Capacitor.isNativePlatform()) {
    return 'En web el plugin Cordova no existe. Prueba en equipo con `npx cap run android`.';
  }

  try {
    // Opción A - wrapper awesome-cordova (recomendada si existe):
    // import { Vibration } from '@awesome-cordova-plugins/vibration/ngx';
    // Vibration.vibrate(200); return 'Vibración via wrapper Cordova';

    // Opción B - acceso directo al global (funciona con cualquier plugin sin wrapper):
    const plugin = navigator.vibration;
    if (!plugin) {
      return 'Plugin Cordova instalado pero no inyectado. ¿Ejecutaste `npx cap sync` y corres en nativo?';
    }
    plugin.vibrate(200);
    return 'Vibración via plugin Cordova ejecutada';
  } catch (e) {
    return `Error plugin Cordova: ${String(e)}`;
  }
}

// 3. Regla para esperar a que el nativo esté listo (solo si el plugin lo exige):
// Capacitor ya espera automáticamente. Con Cordova puro necesitabas:
//   document.addEventListener('deviceready', ...)
// En Capacitor+Ionic basta con usar el plugin dentro de un handler o useEffect,
// no en el top-level del módulo.
