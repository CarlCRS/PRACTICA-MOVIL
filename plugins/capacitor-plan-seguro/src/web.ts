// PIEZA 2: IMPLEMENTACIÓN WEB (fallback del navegador)
// ---------------------------------------------------------------------
// El NAVEGADOR no tiene Keystore/Keychain. Este archivo da la MISMA API
// con herramientas web (localStorage + una función demo de resumen).
// Gracias a esta pieza tu app corre en `npm run dev` sin tocar Android.
//
// POR QUÉ NO SE USA localStorage EN MÓVIL: el SO puede borrarlo y
// cualquier XSS lo roba fácil. Por eso en nativo va a EncryptedPrefs.
import { WebPlugin, type PluginAPI } from "@capacitor/core";
import type {
  GuardarOpciones,
  GuardarResultado,
  LeerOpciones,
  LeerResultado,
  BorrarOpciones,
  PlanSeguroPlugin,
} from "./definitions";

const KEY = "plan-seguro:planes";

type Almacenado = { planes: PlanMedicoGuardado[] };

function leerAlmacenado(): Almacenado {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "") as Almacenado;
  } catch {
    return { planes: [] };
  }
}

function escribirAlmacenado(a: Almacenado): void {
  localStorage.setItem(KEY, JSON.stringify(a));
}

export class PlanSeguroWeb extends WebPlugin implements PlanSeguroPlugin {
  async guardar(opciones: GuardarOpciones): Promise<GuardarResultado> {
    const a = leerAlmacenado();
    a.planes.unshift(opciones.plan);
    a.planes = a.planes.slice(0, 50); // límite de demo
    escribirAlmacenado(a);
    return { ok: true, id: opciones.plan.id };
  }

  async leer(opciones: LeerOpciones): Promise<LeerResultado> {
    const a = leerAlmacenado();
    return { planes: a.planes.slice(0, opciones.max), seguro: false };
  }

  async borrar(opciones: BorrarOpciones): Promise<void> {
    const a = leerAlmacenado();
    a.planes = a.planes.filter((p) => p.id !== opciones.id);
    escribirAlmacenado(a);
  }

  /**
   * DEMO: aquí la corrutina se emula con setTimeout + callback.
   * El "SDK falso" existe SOLO para ilustrar el patrón que luego
   * aplicará el plugin Kotlin con el SDK real (FacePhi).
   */
  async resumen(opciones: {
    texto: string;
    maxPalabras?: number;
  }): Promise<{ resumen: string }> {
    const resumen = await new Promise<string>((resolve) => {
      // CALLBACK falso estilo "SDK legacy": setTimeout es un callback async.
      setTimeout(() => {
        const max = opciones.maxPalabras ?? 12;
        const palabras = opciones.texto.trim().split(/\s+/);
        resolve(
          palabras.length <= max
            ? opciones.texto.trim()
            : palabras.slice(0, max).join(" ") + "…",
        );
      }, 100);
    });
    return { resumen };
  }
}

// Re-export de tipos para el consumidor (evita imports encadenados).
export type {
  GuardarOpciones,
  GuardarResultado,
  LeerOpciones,
  LeerResultado,
  BorrarOpciones,
} from "./definitions";
