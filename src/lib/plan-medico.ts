// GENERADOR DE PLAN MÉDICO A PARTIR DE UNA TRANSCRIPCIÓN
// Flujo: audio (síntomas dichos por el paciente) -> transcripción -> plan.
// ESTE ARCHIVO ES "LÓGICA DE NEGOCIO" PURA: no toca la UI ni plugins.
// Por eso se puede testear aparte (vitest) y reutilizar desde otra pantalla.
//
// IMPORTANTE (alcance): esto es un SOPORTE DE ORGANIZACIÓN DE LA CONSULTA,
// no un diagnóstico. Todo lo que sale aquí son plantillas genéricas basadas en
// reglas (palabras clave). En producción, la generación del plan debe vivir
// en el BACKEND (C#/.NET según tu matriz de perfil base), nunca en el cliente:
// el modelo/reglas y las credenciales de la API NO deben ir dentro del APK.
//
// CAMBIO DE ARQUITECTURA PENDIENTE (ticket INGIF-1442):
//   Hoy:  generarPlanMedico() local en el dispositivo.
//   Meta: generarPlanMedico() -> POST a tu API .NET -> SDK FacePhi/LLM.
//   Para ese cambio solo se modifica ESTE archivo. La pantalla no cambia.

// ---------------------------------------------------------------- TIPOS

export type Prioridad = "alta" | "media" | "baja";

export interface SintomaDetectado {
  /** Nombre legible del síntoma. */
  nombre: string;
  /** Palabra(s) que dispararon la detección. */
  evidencia: string;
  /** Prioridad según el diccionario de reglas. */
  prioridad: Prioridad;
}

export interface Alerta {
  /** Frase de la transcripción que dispara la alerta. */
  evidencia: string;
  /** Qué hacer. */
  accion: string;
  /** Por qué es urgente. */
  motivo: string;
}

export interface PlanMedico {
  /** Fecha/hora de generación. */
  generadoEn: string;
  /** Resumen de una línea para la cabecera. */
  motivoConsulta: string;
  /** Síntomas detectados por reglas. */
  sintomas: SintomaDetectado[];
  /** Alertas: señales que exigen atención inmediata. */
  alertas: Alerta[];
  /** Recomendaciones genéricas del plan. */
  recomendaciones: string[];
  /** Qué debe traer el paciente a la consulta. */
  preparacionConsulta: string[];
  /** Siempre presente. */
  advertencia: string;
}

// ---------------------------------------------------------------- REGLAS

/**
 * Diccionario de síntomas. Cada entrada define:
 *  - sinonimos: palabras que delatan el síntoma (se buscan en minúsculas)
 *  - prioridad: qué tan urgente es dentro del plan
 *  - conducto: qué hacer ante la aparición de ese síntoma
 */
interface ReglaSintoma {
  nombre: string;
  sinonimos: string[];
  prioridad: Prioridad;
  conducto: string;
}

const REGLAS_SINTOMAS: ReglaSintoma[] = [
  {
    nombre: "Fiebre",
    sinonimos: ["fiebre", "fiebre alta", "tengo fiebre", "calentura", "38", "39", "40 grados", "calentando"],
    prioridad: "media",
    conducto: "Registrar la temperatura cada 4 horas y vigilar durante 48 h.",
  },
  {
    nombre: "Dolor de cabeza",
    sinonimos: ["dolor de cabeza", "cefalea", "me duele la cabeza", "cabeza me duele", "jaqueca", "migraña"],
    prioridad: "media",
    conducto: "Hidratación, reposo en ambiente oscuro y anotar intensidad del dolor.",
  },
  {
    nombre: "Tos",
    sinonimos: ["tos", "tosiendo", "tos seca", "tos con flema", "toser"],
    prioridad: "baja",
    conducto: "Registrar si es seca o con flema, y si hay fiebre asociada.",
  },
  {
    nombre: "Dolor de garganta",
    sinonimos: ["dolor de garganta", "garganta", "me duele al tragar", "tragar me duele"],
    prioridad: "baja",
    conducto: "Hidratación tibia y vigilar fiebre alta o dificultad para tragar.",
  },
  {
    nombre: "Congestión nasal",
    sinonimos: ["congestión", "nariz tapada", "congestionado", "mocos", "rinorrea"],
    prioridad: "baja",
    conducto: "Lavado nasal con solución salina y ventilación de la habitación.",
  },
  {
    nombre: "Dolor abdominal",
    sinonimos: ["dolor abdominal", "me duele el estómago", "dolor de estómago", "abdomen", "barriga"],
    prioridad: "media",
    conducto: "Anotar la localización del dolor y su relación con las comidas.",
  },
  {
    nombre: "Dolor muscular / articular",
    sinonimos: ["dolor muscular", "músculos", "articular", "articulaciones", "me duelen los músculos", "mialgia"],
    prioridad: "baja",
    conducto: "Estiramientos suaves, hidratación y reposo relativo.",
  },
  {
    nombre: "Náuseas o vómitos",
    sinonimos: ["náuseas", "nauseas", "vomito", "vómito", "vomitar", "mareo"],
    prioridad: "media",
    conducto: "Hidratación con sorbos pequeños y evitar alimentos sólidos hasta mejorar.",
  },
  {
    nombre: "Diarrea",
    sinonimos: ["diarrea", "heces líquidas", "soltó el estómago", "estreñimiento"],
    prioridad: "media",
    conducto: "Mantener hidratación con electrolitos y vigilar signos de deshidratación.",
  },
  {
    nombre: "Insomnio o sueñoalterado",
    sinonimos: ["insomnio", "no duermo", "no puedo dormir", "dormir poco", "cansancio", "estoy cansado"],
    prioridad: "baja",
    conducto: "Horario de sueño regular, pantallas apagadas 1 h antes y reducir cafeína.",
  },
  {
    nombre: "Ansiedad o estrés",
    sinonimos: ["ansiedad", "ansioso", "estrés", "estres", "nervioso", "preocupado", "pánico", "panico"],
    prioridad: "media",
    conducto: "Respiración diafragmática 4-6-8 y registro de episodios de ansiedad.",
  },
];

// ---------------------------------------------------------------- ALERTAS

/**
 * Señales de alarma. Si aparecen en la transcripción, van PRIMERO en el plan,
 * porque el resto del plan es relativo a ellas.
 */
interface ReglaAlerta {
  nombre: string;
  sinonimos: string[];
  accion: string;
  motivo: string;
}

const REGLAS_ALERTAS: ReglaAlerta[] = [
  {
    nombre: "Dolor torácico intenso",
    sinonimos: ["dolor en el pecho", "pecho me duele", "dolor torácico", "opresión en el pecho", "pecho oprimido"],
    accion: "Acudir a urgencias de inmediato.",
    motivo: "El dolor en el pecho puede indicar un evento cardíaco.",
  },
  {
    nombre: "Dificultad respiratoria",
    sinonimos: ["me falta aire", "no puedo respirar", "dificultad para respirar", "jadeo", "me ahogo", "falta de aire"],
    accion: "Ir a urgencias; no conducir.",
    motivo: "La disnea puede indicar compromiso respiratorio.",
  },
  {
    nombre: "Pérdida de conciencia o desmayo",
    sinonimos: ["me desmayé", "desmayo", "pérdida de conocimiento", "perdí el conocimiento", "me desmaye", "convulsión", "convulsion"],
    accion: "Urgencias de inmediato, o llamar al 911 si no hay mejoría.",
    motivo: "Posible evento neurológico o cardiovascular.",
  },
  {
    nombre: "Signos neurológicos focales",
    sinonimos: ["parálisis", "paralizado", "no siento el brazo", "no puedo mover", "hablo raro", "no veo bien", "visión doble", "vision doble"],
    accion: "Urgencias de inmediato.",
    motivo: "Puede indicar un evento cerebrovascular.",
  },
  {
    nombre: "Sangrado abundante",
    sinonimos: ["sangro mucho", "hemorragia", "no para de sangrar", "sangrado abundante", "vomitar sangre", "sangre en las heces"],
    accion: "Urgencias de inmediato.",
    motivo: "El sangrado abundante es una emergencia.",
  },
  {
    nombre: "Fiebre muy alta o persistente",
    sinonimos: ["fiebre altísima", "40 grados", "41", "fiebre de 40", "fiebre muy alta", "no me baja la fiebre", "fiebre persistente"],
    accion: "Consulta médica el mismo día.",
    motivo: "Fiebre muy alta o que persiste requiere valoración presencial.",
  },
  {
    nombre: "Síntomas en el embarazo",
    sinonimos: ["embarazada", "embarazo", "gestante", "lactancia", "amamantando"],
    accion: "Contactar con obstetricia antes de tomar cualquier medicamento.",
    motivo: "En embarazo y lactancia la medicación debe ser supervisada.",
  },
  {
    nombre: "Síntomas en el niño menor",
    sinonimos: ["mi niño", "mi hija", "bebe", "lactante", "menor de 2 años", "menor de dos años"],
    accion: "Pediatricría el mismo día.",
    motivo: "En menores la deshidratación y la fiebre evolucionan más rápido.",
  },
];

// ---------------------------------------------------------------- UTILIDADES

/** Normaliza texto: minúsculas, sin acentos, sin signos. Para comparar palabras. */
export function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Normaliza para buscar sin acentos pero devuelve el texto ORIGINAL como evidencia. */
function contiene(textoNormalizado: string, original: string, sinonimos: string[]): string | null {
  for (const s of sinonimos) {
    const sNorm = normalizar(s);
    if (!sNorm) continue;
    if (textoNormalizado.includes(sNorm)) {
      // Devuelve el fragmento original (con acentos) como evidencia legible.
      const idx = original.toLowerCase().indexOf(s);
      if (idx >= 0) return original.slice(idx, idx + s.length);
      return s;
    }
  }
  return null;
}

// ---------------------------------------------------------------- GENERADOR

/**
 * Genera un plan médico a partir del texto transcrito.
 * Reglas: detección por palabras clave + plantillas genéricas por prioridad.
 */
export function generarPlanMedico(transcripcion: string): PlanMedico {
  const original = transcripcion.trim();
  const norm = normalizar(original);

  // 1) Alertas primero (lo urgente manda).
  const alertas: Alerta[] = [];
  for (const regla of REGLAS_ALERTAS) {
    const evidencia = contiene(norm, original, regla.sinonimos);
    if (evidencia) {
      alertas.push({ evidencia, accion: regla.accion, motivo: regla.motivo });
    }
  }

  // 2) Síntomas por reglas, ordenados por prioridad.
  const sintomas: SintomaDetectado[] = [];
  for (const regla of REGLAS_SINTOMAS) {
    const evidencia = contiene(norm, original, regla.sinonimos);
    if (evidencia) {
      sintomas.push({
        nombre: regla.nombre,
        evidencia,
        prioridad: regla.prioridad,
      });
    }
  }
  const orden: Record<Prioridad, number> = { alta: 0, media: 1, baja: 2 };
  sintomas.sort((a, b) => orden[a.prioridad] - orden[b.prioridad]);

  // 3) Motivo de consulta: primera frase con contenido clínico.
  const motivoConsulta = construirMotivo(original, sintomas);

  // 4) Recomendaciones: reglas de cada síntoma + reglas generales.
  const recomendaciones: string[] = [];
  for (const s of sintomas) {
    const regla = REGLAS_SINTOMAS.find((r) => r.nombre === s.nombre);
    if (regla) recomendaciones.push(`${s.nombre}: ${regla.conducto}`);
  }
  recomendaciones.push(...RECOMENDACIONES_GENERALES);
  if (alertas.length === 0) {
    recomendaciones.push("Sin señales de alarma detectadas en la transcripción.");
  }

  // 5) Preparación para la consulta.
  const preparacionConsulta = [
    "Llevar el registro de temperatura (si hubo fiebre) con hora y valor.",
    "Anotar medicamentos o suplementos que está tomando.",
    "Traer los audios/transcripción de la conversación.",
    ...(sintomas.length > 0
      ? [`Preparar las preguntas sobre: ${sintomas.map((s) => s.nombre).join(", ")}.`]
      : ["Preparar las preguntas sobre la evolución de los síntomas."]),
  ];

  return {
    generadoEn: new Date().toLocaleString(),
    motivoConsulta,
    sintomas,
    alertas,
    recomendaciones: deduplicar(recomendaciones),
    preparacionConsulta,
    advertencia:
      "Este plan es un apoyo organizativo generado a partir de lo relatado por el paciente. NO es un diagnóstico ni una prescripción. La valoración corresponde siempre a un profesional de la salud.",
  };
}

const RECOMENDACIONES_GENERALES = [
  "Registrar temperatura, intensidad del síntoma y horas de aparición.",
  "Beber agua de forma progresiva (aprox. 2 L/día si no hay restricción).",
  "Reposo relativo y evitar esfuerzo físico intenso.",
  "Guardar los medicamentos de forma habitual; no suspenderlos sin consulta.",
];

function construirMotivo(original: string, sintomas: SintomaDetectado[]): string {
  if (sintomas.length === 0) {
    return original ? original.slice(0, 140) : "Sin síntomas identificados en la transcripción.";
  }
  const nombres = sintomas.slice(0, 3).map((s) => s.nombre.toLowerCase());
  const lista =
    nombres.length === 1
      ? nombres[0]
      : `${nombres.slice(0, -1).join(", ")} y ${nombres[nombres.length - 1]}`;
  return `Consulta por ${lista} reportado por el paciente.`;
}

function deduplicar(items: string[]): string[] {
  return Array.from(new Set(items));
}

// ---------------------------------------------------------------- EXPORT DE UTILIDADES PARA TEST

export const __internos = { REGLAS_SINTOMAS, REGLAS_ALERTAS, contiene, normalizar };
