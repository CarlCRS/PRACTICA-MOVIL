// GENERACIÓN DEL PLAN MÉDICO CON LLM (OpenAI-compatible chat completions)
// -----------------------------------------------------------------------
// POR QUÉ EXISTE ESTE ARCHIVO:
//   `plan-medico.ts` (reglas por palabras clave) funciona offline, pero NO
//   entiende lenguaje natural. Un LLM sí: lee "me duele el pecho y me falta
//   aire" y extrae síntomas, duración, intensidad y señales de alarma.
//
// ARQUITECTURA (misma que te exige la matriz: backend C#/.NET):
//
//   ┌──────────────┐   HTTP    ┌─────────────────┐   HTTP   ┌────────┐
//   │ App Ionic    │──────────▶│ TU API (C#/.NET)│─────────▶│  LLM   │
//   │ (esta app)   │◀──────────│ (guarda la key) │◀─────────│        │
//   └──────────────┘  Plan JSON └─────────────────┘          └────────┘
//
//   ⚠ IMPORTANTE — la API key NO debe ir dentro del APK/IPA.
//     En este proyecto de aprendizaje se llama DIRECTO al LLM desde la app
//     para que puedas ver el flujo completo, pero la key queda EMBEBIDA en el
//     bundle (cualquiera puede extraerla de un APK). En producción:
//       1) La app llama a TU backend:  POST /api/plan  { transcripcion }
//       2) El backend llama al LLM con la key en variables de entorno
//       3) El backend devuelve el plan (mismo JSON de este archivo)
//     Para ese cambio: NO se toca la pantalla, solo este archivo
//     (ya está preparado: `generarPlanConIA` es el único punto de entrada).
//
// CÓMO CONFIGURAR (archivo .env en la raíz del proyecto):
//   VITE_LLM_API_KEY=sk-...
//   VITE_LLM_BASE_URL=https://api.openai.com/v1
//   VITE_LLM_MODEL=gpt-4o-mini
//
//   Ejemplos de BASE_URL (todos con la misma API /chat/completions):
//     OpenAI:      https://api.openai.com/v1
//     OpenRouter:  https://openrouter.ai/api/v1
//     Groq:        https://api.groq.com/openai/v1
//     Ollama local:http://localhost:11434/v1
//     LM Studio:   http://localhost:1234/v1

import { generarPlanMedico, type PlanMedico } from "./plan-medico";

//  CONFIG

const API_KEY = import.meta.env.VITE_LLM_API_KEY ?? "";
const BASE_URL = (
  import.meta.env.VITE_LLM_BASE_URL ?? "https://api.openai.com/v1"
).replace(/\/+$/, "");
const MODEL = import.meta.env.VITE_LLM_MODEL ?? "gpt-4o-mini";

export interface ConfigIA {
  configurada: boolean;
  baseUrl: string;
  modelo: string;
  mensaje: string;
}

/** ¿Hay credenciales de LLM disponibles? La pantalla lo consulta para mostrar el estado. */
export function estadoIA(): ConfigIA {
  if (!API_KEY) {
    return {
      configurada: false,
      baseUrl: BASE_URL,
      modelo: MODEL,
      mensaje:
        "Sin VITE_LLM_API_KEY en .env: se usará el generador local por reglas (offline).",
    };
  }
  return {
    configurada: true,
    baseUrl: BASE_URL,
    modelo: MODEL,
    mensaje: `IA lista: ${MODEL} @ ${BASE_URL}`,
  };
}

//  PROMPT

/**
 * System prompt: define el ROL, el formato EXACTO de salida y los límites.
 * Regla de oro con LLM: pedir JSON estricto y validar después.
 */
const SYSTEM_PROMPT = `Eres un asistente que organiza consultas médicas a partir de la transcripción de una conversación entre un paciente y un profesional de la salud.

Tu salida DEBE ser un único objeto JSON válido, sin markdown, sin texto antes o después, con esta estructura exacta:

{
  "motivoConsulta": string,
  "sintomas": [{ "nombre": string, "evidencia": string, "prioridad": "alta" | "media" | "baja" }],
  "alertas": [{ "evidencia": string, "accion": string, "motivo": string }],
  "recomendaciones": string[],
  "preparacionConsulta": string[],
  "advertencia": string
}

Reglas:
1. "sintomas": extrae los síntomas que el paciente menciona. Usa SIEMPRE una cita textual breve de la transcripción en "evidencia" (máx. 10 palabras). Prioridad "alta" para síntomas potencialmente graves, "media" para los que requieren consulta, "baja" para los leves.
2. "alertas": solo si la transcripción contiene señales de alarma reales (dolor torácico, dificultad respiratoria, desmayo, sangrado abundante, signos neurológicos, fiebre muy alta, embarazo, menores). "accion" debe indicar si es "Urgencias de inmediato" o "Consulta el mismo día".
3. "recomendaciones": 4 a 7 acciones concretas de autocuidado y registro, en español, ordenadas.
4. "preparacionConsulta": qué debe llevar o preparar el paciente para la consulta (3 a 5 elementos).
5. "advertencia": SIEMPRE empieza por "Este plan es un apoyo organizativo" y aclara que NO es un diagnóstico ni una prescripción.
6. No inventes datos que no estén en la transcripción. No incluyas dosis de medicamentos.
7. Todo en español de España, registro profesional y claro.`;

const USER_TEMPLATE = (transcripcion: string) =>
  `Transcripción de la consulta:\n"""\n${transcripcion}\n"""\n\nGenera el plan médico en JSON con la estructura indicada.`;

//  TIPOS DE RESPUESTA

/** Lo que esperamos que el LLM devuelva (validado campo a campo). */
interface RespuestaLLM {
  motivoConsulta?: string;
  sintomas?: Array<{
    nombre?: string;
    evidencia?: string;
    prioridad?: string;
  }>;
  alertas?: Array<{
    evidencia?: string;
    accion?: string;
    motivo?: string;
  }>;
  recomendaciones?: string[];
  preparacionConsulta?: string[];
  advertencia?: string;
}

//  LLAMADA

export class ErrorIA extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ErrorIA";
  }
}

/**
 * Llama al endpoint /chat/completions y devuelve el JSON del plan.
 * Lanza ErrorIA si falla (la pantalla hace fallback a las reglas locales).
 */
export async function generarPlanConIA(
  transcripcion: string,
): Promise<PlanMedico> {
  if (!API_KEY) {
    throw new ErrorIA(
      "Falta VITE_LLM_API_KEY en .env (no se puede llamar al LLM).",
    );
  }
  if (!transcripcion.trim()) {
    throw new ErrorIA("La transcripción está vacía.");
  }

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.2, // baja = más determinista para datos clínicos
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: USER_TEMPLATE(transcripcion) },
        ],
      }),
    });
  } catch (e) {
    throw new ErrorIA(`No se pudo conectar con el LLM: ${String(e)}`);
  }

  if (!res.ok) {
    const cuerpo = await res.text().catch(() => "");
    throw new ErrorIA(
      `El LLM respondió ${res.status}. ${cuerpo.slice(0, 300)}`,
      res.status,
    );
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const contenido = json.choices?.[0]?.message?.content;
  if (!contenido) throw new ErrorIA("El LLM no devolvió contenido.");

  return parsearPlan(contenido, transcripcion);
}

//  PARSEO Y VALIDACIÓN

/**
 * El LLM puede devolver JSON con fences (```json), texto extra o campos rareados.
 * Aquí se limpia, se parsea y se VALIDA campo a campo.
 * Si algo falla, se cae al generador local por reglas.
 */
export function parsearPlan(
  contenido: string,
  transcripcion: string,
): PlanMedico {
  const limpio = extraerJson(contenido);
  let datos: RespuestaLLM;
  try {
    datos = JSON.parse(limpio) as RespuestaLLM;
  } catch {
    // JSON inválido -> fallback local (nunca rompemos la pantalla)
    return generarPlanMedico(transcripcion);
  }

  const prioridadValida = (p?: string): "alta" | "media" | "baja" =>
    p === "alta" || p === "baja" ? p : "media";

  const sintomas = (datos.sintomas ?? [])
    .filter((s) => typeof s?.nombre === "string" && s.nombre.trim() !== "")
    .map((s) => ({
      nombre: s.nombre!.trim(),
      evidencia: (s.evidencia ?? "").trim(),
      prioridad: prioridadValida(s.prioridad),
    }));

  const alertas = (datos.alertas ?? [])
    .filter((a) => typeof a?.accion === "string" && a.accion.trim() !== "")
    .map((a) => ({
      evidencia: (a.evidencia ?? "").trim(),
      accion: a.accion!.trim(),
      motivo: (a.motivo ?? "").trim(),
    }));

  const recomendaciones = (datos.recomendaciones ?? []).filter(
    (r) => typeof r === "string" && r.trim() !== "",
  );
  const preparacion = (datos.preparacionConsulta ?? []).filter(
    (r) => typeof r === "string" && r.trim() !== "",
  );

  // Si el LLM no dio nada usable, se usa el plan local completo.
  if (sintomas.length === 0 && alertas.length === 0) {
    return generarPlanMedico(transcripcion);
  }

  return {
    generadoEn: new Date().toLocaleString(),
    motivoConsulta:
      (datos.motivoConsulta ?? "").trim() ||
      "Consulta registrada a partir de la transcripción.",
    sintomas,
    alertas,
    recomendaciones:
      recomendaciones.length > 0
        ? recomendaciones
        : generarPlanMedico(transcripcion).recomendaciones,
    preparacionConsulta:
      preparacion.length > 0
        ? preparacion
        : generarPlanMedico(transcripcion).preparacionConsulta,
    advertencia:
      (datos.advertencia ?? "").trim() ||
      "Este plan es un apoyo organizativo generado a partir de lo relatado por el paciente. NO es un diagnóstico ni una prescripción. La valoración corresponde siempre a un profesional de la salud.",
  };
}

/** Saca el objeto JSON de un texto que puede venir con ```json ... ``` o texto alrededor. */
export function extraerJson(texto: string): string {
  const sinFences = texto.replace(/```(?:json)?/gi, "").trim();
  const inicio = sinFences.indexOf("{");
  const fin = sinFences.lastIndexOf("}");
  if (inicio >= 0 && fin > inicio) {
    return sinFences.slice(inicio, fin + 1);
  }
  return sinFences;
}
