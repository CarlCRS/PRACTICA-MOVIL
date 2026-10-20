// PIEZA 3: REGISTRO (el "dónde" se decide web vs nativo)
// ---------------------------------------------------------------------
// registerPlugin es EL punto del puente. Toda app que consuma este plugin
// importa SOLO este index.ts (nunca web.ts directo).
//
//   PLANES:
//   - Si la app corre en navegador -> usa la clase de `web` (fallback).
//   - Si corre en Android/iOS     -> usa el @CapacitorPlugin nativo
//     registrado con el MISMO nombre ("PlanSeguro") en Kotlin/Swift.
import { registerPlugin } from "@capacitor/core";
import type { PlanSeguroPlugin } from "./definitions";
import { PlanSeguroWeb } from "./web";

const PlanSeguro = registerPlugin<PlanSeguroPlugin>("PlanSeguro", {
  web: () => import("./web").then((m) => new m.PlanSeguroWeb()),
});

export * from "./definitions";
export { PlanSeguro };
