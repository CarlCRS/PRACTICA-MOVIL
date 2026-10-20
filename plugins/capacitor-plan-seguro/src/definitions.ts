// PIEZA 1: EL CONTRATO (el "QUÉ" del plugin)
// ---------------------------------------------------------------------
// Este archivo define la API pública. La app Ionic solo conocerá estos
// métodos y sus tipos. Si mañana cambias la implementación nativa
// (Kotlin/Swift) o el backend, el contrato es lo que NO debe romperse.
//
// Reglas del CONTRATO:
//  - Los métodos devuelven Promise (toda llamada cruza el puente async).
//  - Los parámetros y resultados son datos serializables a JSON
//    (string, number, boolean, arrays, objetos planos). NUNCA clases,
//    funciones, Map/DOM nodes: eso no cruza el puente.
//  - Prefijo de espacio de nombres si hay colisión (dos plugins con el
//    mismo método no pueden existir con el mismo nombre registrado).

export interface PlanMedicoGuardado {
  id: string;
  /** Fecha ISO. */
  fecha: string;
  /** Motivo de consulta de una línea (del plan). */
  motivo: string;
  /** JSON del plan completo (tal cual lo devuelve elgenerador). */
  planJson: string;
}

export interface GuardarOpciones {
  plan: PlanMedicoGuardado;
}

export interface GuardarResultado {
  ok: boolean;
  /** Id con el que quedó guardado. */
  id: string;
}

export interface LeerOpciones {
  max: number;
}

export interface LeerResultado {
  planes: PlanMedicoGuardado[];
  /** true = se guardó con almacenamiento SEGURo real (Keystore/Keychain). */
  seguro: boolean;
}

export interface BorrarOpciones {
  id: string;
}

/**
 * CONTRATO PÚBLICO DEL PLUGIN
 *
 * La app queda así:
 *   import { PlanSeguro } from 'capacitor-plan-seguro';
 *   await PlanSeguro.guardar({ plan: {...} });
 */
export interface PlanSeguroPlugin {
  /** Guarda el plan con cifrado del sistema (Keystore/Keychain) o demo web. */
  guardar(opciones: GuardarOpciones): Promise<GuardarResultado>;
  /** Lee los últimos `max` planes. */
  leer(opciones: LeerOpciones): Promise<LeerResultado>;
  /** Borra un plan por id. */
  borrar(opciones: BorrarOpciones): Promise<void>;
  /**
   * DEMO DEL PATRÓN CALLBACKS → CORRUTINAS (lo que exige la matriz).
   * Simula un SDK tipo FacePhi que responde por CALLBACK; el plugin lo
   * envuelve con una corrutina y te devuelve una Promise. Ver README.
   */
  resumen(opciones: { texto: string; maxPalabras?: number }): Promise<{ resumen: string }>;
}
