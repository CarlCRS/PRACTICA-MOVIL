// CONSUMIDOR DEL PLUGIN PLAN SEGURO (lado app)
// ---------------------------------------------------------------------
// PATRÓN: mientras el paquete npm del plugin NO está instalado, se usa un
// demo local con la MISMA API (como hace `bateria-plugin.ts`).
// Cuando instales el plugin de verdad, SOLO cambia este archivo:
//   import { PlanSeguro } from 'capacitor-plan-seguro';
// Las pantallas no se tocan.
import { registerPlugin, WebPlugin } from '@capacitor/core';
import type {
  PlanMedicoGuardado,
  GuardarOpciones,
  GuardarResultado,
  LeerOpciones,
  LeerResultado,
  BorrarOpciones,
} from '../../plugins/capacitor-plan-seguro/src/definitions';

// IMPLEMENTACIÓN WEB DEMO (localStorage)
class PlanSeguroWebDemo extends WebPlugin {
  private static KEY = 'plan-seguro-demo';

  private static leerAlmacen(): PlanMedicoGuardado[] {
    try {
      return JSON.parse(localStorage.getItem(PlanSeguroWebDemo.KEY) ?? '') as PlanMedicoGuardado[];
    } catch {
      return [];
    }
  }

  async guardar(opciones: GuardarOpciones): Promise<GuardarResultado> {
    const planes = PlanSeguroWebDemo.leerAlmacen();
    planes.unshift(opciones.plan);
    localStorage.setItem(
      PlanSeguroWebDemo.KEY,
      JSON.stringify(planes.slice(0, 50)),
    );
    return { ok: true, id: opciones.plan.id };
  }

  async leer(opciones: LeerOpciones): Promise<LeerResultado> {
    const planes = PlanSeguroWebDemo.leerAlmacen().slice(0, opciones.max);
    return { planes, seguro: false };
  }

  async borrar(opciones: BorrarOpciones): Promise<void> {
    const planes = PlanSeguroWebDemo.leerAlmacen().filter((p) => p.id !== opciones.id);
    localStorage.setItem(PlanSeguroWebDemo.KEY, JSON.stringify(planes));
  }

  async resumen(opciones: { texto: string; maxPalabras?: number }): Promise<{ resumen: string }> {
    const max = opciones.maxPalabras ?? 12;
    const palabras = opciones.texto.trim().split(/\s+/);
    return {
      resumen:
        palabras.length <= max
          ? opciones.texto.trim()
          : palabras.slice(0, max).join(' ') + '…',
    };
  }
}

// REGISTRO: mismo nombre que el nativo en Kotlin/Swift ("PlanSeguro").
export const PlanSeguro = registerPlugin<
  import('../../plugins/capacitor-plan-seguro/src/definitions').PlanSeguroPlugin
>('PlanSeguro', {
  web: () => Promise.resolve(new PlanSeguroWebDemo()),
});

// Helpers de alto nivel para la pantalla (plano的脸 use-case layer).
export async function guardarPlan(plan: PlanMedicoGuardado): Promise<void> {
  try {
    await PlanSeguro.guardar({ plan });
  } catch (e) {
    // El plugin no debe romper la pantalla: log y continuar.
    console.warn('[plan-seguro] no se pudo guardar:', e);
  }
}

export async function cargarHistorial(max = 5): Promise<PlanMedicoGuardado[]> {
  try {
    const r = await PlanSeguro.leer({ max });
    return r.planes;
  } catch {
    return [];
  }
}

export async function borrarPlan(id: string): Promise<void> {
  await PlanSeguro.borrar({ id } as BorrarOpciones);
}
