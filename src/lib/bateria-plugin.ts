// CONSUMO EN REACT/IONIC del plugin personalizado 'Bateria'.
// En producción: npm i ../capacitor-bateria-plugin && npx cap sync
//   import { Bateria } from 'capacitor-bateria-plugin';
// Aquí demo local con la misma API para que compile y corra en web.
import { registerPlugin, WebPlugin } from '@capacitor/core';

export interface BateriaAPI {
  getNivel(): Promise<{ nivel: number }>;
  vibrar(o: { ms: number }): Promise<void>;
}

class BateriaWebDemo extends WebPlugin implements BateriaAPI {
  async getNivel() {
    try {
      const bat: any = await (navigator as any).getBattery?.();
      if (bat) return { nivel: Math.round(bat.level * 100) };
    } catch {}
    return { nivel: 73 }; // simulado para la demo web
  }
  async vibrar(o: { ms: number }) {
    navigator.vibrate?.(o.ms);
  }
}

export const Bateria = registerPlugin<BateriaAPI>('Bateria', {
  web: () => Promise.resolve(new BateriaWebDemo()),
});
