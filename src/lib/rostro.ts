// INTEGRACIÓN DE UN SDK NATIVO CERRADO (FacePlugin Face Recognition)
//
// Capas:
//   React  ->  face-recognition-capacitor (TS)  ->  módulo Capacitor (Kotlin/Swift)  ->  facerecognitionsdk.aar
//
// El plugin NO procesa imágenes en JS. Solo cruza dos cosas por el puente:
//   1) una URI de imagen (file:// / content://)
//   2) un JSON de vuelta (cajas, landmarks, edad, liveness...)
// Toda la IA (ONNX + modelos frc.fpk) vive dentro del .aar.
//
// Requisito comercial: la licencia es OFFLINE y está firmada contra el
// applicationId de la app (y, en licencias de pago, el machine code). Por eso
// aquí se muestra el machine code: es lo que se le manda al proveedor para que
// devuelva un FP1... válido para tu applicationId. La key demo solo vale para
// com.faceplugin.facerecognitionsdk.
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import {
  getMachineCode,
  setActivation,
  init,
  lastLicenseError,
  getLicenseStatus,
  faceDetection,
  templateExtraction,
  similarity,
  SDK_SUCCESS,
  type FaceBox,
  type FaceDetectionParam,
} from 'face-recognition-capacitor';

const KEY_LICENCIA = 'rostro-licencia';

// Códigos que devuelve el SDK nativo (0 = todo bien)
export function describirCodigo(codigo: number): string {
  switch (codigo) {
    case SDK_SUCCESS:
      return 'OK';
    case 1:
      return 'Licencia inválida para este applicationId';
    case 2:
      return 'Licencia expirada';
    case 3:
      return 'App no activada';
    case 4:
      return 'init() falló: los modelos no cargaron';
    default:
      return `Código desconocido (${codigo})`;
  }
}

// En navegador el plugin lanza "not implemented", así que se corta antes.
export function soloNativo(): void {
  if (!Capacitor.isNativePlatform()) {
    throw new Error(
      'Este SDK es 100% nativo: ábrelo en el teléfono (no en localhost:5173).',
    );
  }
}

export async function codigoMaquina(): Promise<string> {
  soloNativo();
  return getMachineCode();
}

// Persistimos la licencia para no pedirla en cada arranque.
export async function leerLicenciaGuardada(): Promise<string> {
  try {
    const { value } = await Preferences.get({ key: KEY_LICENCIA });
    return value ?? '';
  } catch {
    return localStorage.getItem(KEY_LICENCIA) ?? '';
  }
}

export async function guardarLicencia(licencia: string): Promise<void> {
  const limpia = licencia.trim();
  try {
    await Preferences.set({ key: KEY_LICENCIA, value: limpia });
  } catch {
    localStorage.setItem(KEY_LICENCIA, limpia);
  }
}

export interface ResultadoActivacion {
  ok: boolean;
  codigo: number;
  mensaje: string;
}

// Flujo obligatorio del SDK: setActivation -> init
export async function activar(licencia: string): Promise<ResultadoActivacion> {
  soloNativo();
  const codigo = await setActivation(licencia.trim());

  if (codigo !== SDK_SUCCESS) {
    let detalle = '';
    try {
      detalle = await lastLicenseError();
    } catch {
      /* el error ya es suficientemente claro */
    }
    return {
      ok: false,
      codigo,
      mensaje: `${describirCodigo(codigo)}${detalle ? ` · ${detalle}` : ''}`,
    };
  }

  const initCode = await init();
  if (initCode !== SDK_SUCCESS) {
    // init() devuelve 4 (SDK_INIT_FAILED) por varias causas: la extracción del
    // pack (frc.fpk) falló o el motor nativo rechazó arrancar (p. ej. problema
    // de licencia validado EN el init). lastLicenseError() informa de cuál.
    let detalle = '';
    try {
      detalle = await lastLicenseError();
    } catch {
      /* no hay detalle disponible */
    }
    return {
      ok: false,
      codigo: initCode,
      mensaje: `${describirCodigo(initCode)}${detalle ? ` · ${detalle}` : ''}`,
    };
  }
  return { ok: true, codigo: initCode, mensaje: describirCodigo(initCode) };
}

export async function estadoLicencia(): Promise<string> {
  try {
    return await getLicenseStatus();
  } catch {
    return '';
  }
}

// Un solo await -> el nativo decodifica la imagen y corre el motor.
// check_liveness = anti-spoofing (foto impresa / pantalla).
const PARAM_DETECCION: FaceDetectionParam = {
  check_liveness: true,
  check_liveness_level: 0,
  check_landmarks: true,
  estimate_age_gender: true,
  check_quality: true,
  check_pose: true,
  check_emotion: true,
};

export async function detectarRostros(uri: string): Promise<FaceBox[]> {
  soloNativo();
  return faceDetection(uri, PARAM_DETECCION);
}

// 1:1 real: extrae la plantilla biométrica de cada foto y las compara.
// similarity() devuelve un score; ~0.67+ se considera la misma persona.
export async function compararRostros(
  uriA: string,
  uriB: string,
): Promise<number> {
  soloNativo();
  const [a] = await faceDetection(uriA);
  const [b] = await faceDetection(uriB);
  if (!a || !b) throw new Error('Cada foto debe tener exactamente un rostro');
  const ta = await templateExtraction(uriA, a);
  const tb = await templateExtraction(uriB, b);
  return similarity(ta, tb);
}

// Texto legible para pintar el resultado en la UI.
export function resumenRostro(box: FaceBox): string[] {
  const filas: string[] = [`Caja: ${Math.round(box.x2 - box.x1)}×${Math.round(box.y2 - box.y1)} px`];
  if (box.landmarkCount) filas.push(`Landmarks: ${box.landmarkCount}`);
  if (box.liveness !== undefined) {
    filas.push(`Liveness: ${(box.liveness * 100).toFixed(0)}%${box.livenessLabel ? ` (${box.livenessLabel})` : ''}`);
  }
  if (box.age !== undefined) filas.push(`Edad estimada: ${box.age}`);
  if (box.genderLabel) filas.push(`Género: ${box.genderLabel}`);
  if (box.emotionLabel) filas.push(`Emoción: ${box.emotionLabel}`);
  if (box.qualityLabel) filas.push(`Calidad: ${box.qualityLabel}`);
  if (box.yaw !== undefined || box.pitch !== undefined) {
    filas.push(
      `Pose: yaw ${Math.round(box.yaw ?? 0)}° · pitch ${Math.round(box.pitch ?? 0)}°`,
    );
  }
  return filas;
}
