// PLUGIN MICRÓFONO: capacitor-voice-recorder
// En web usa MediaRecorder. OJO con 3 trampas del navegador:
//  1. El permiso es POR ORIGEN: localhost:5173 != 127.0.0.1:5173 != 192.168.x.x.
//     Si antes funcionaba y ahora no, casi seguro cambiaste de URL.
//  2. Si alguna vez bloqueaste el micrófono, Chrome YA NO re-pregunta.
//     Hay que reactivarlo a mano (candado de la barra > Micrófono > Permitir).
//  3. Fuera de localhost/https, navigator.mediaDevices no existe y nada graba.
import { VoiceRecorder } from "capacitor-voice-recorder";

export type EstadoPermiso = "granted" | "denied" | "prompt" | "unknown";

export async function estadoPermiso(): Promise<EstadoPermiso> {
  try {
    const q = await navigator.permissions?.query({
      name: "microphone" as PermissionName,
    });
    return (q?.state as EstadoPermiso) ?? "unknown";
  } catch {
    return "unknown";
  }
}

export async function tienePermiso(): Promise<boolean> {
  try {
    const r = await VoiceRecorder.hasAudioRecordingPermission();
    return r.value;
  } catch {
    return false;
  }
}

export async function pedirPermiso(): Promise<boolean> {
  try {
    const r = await VoiceRecorder.requestAudioRecordingPermission();
    return r.value;
  } catch {
    return false;
  }
}

export interface DiagnosticoPermiso {
  ok: boolean;
  mensaje: string;
}

// Versión explicativa para el botón "Pedir permiso": distingue los 3 casos
// en vez de devolver un simple true/false.
export async function diagnosticarPermiso(): Promise<DiagnosticoPermiso> {
  // Caso 1: contexto no seguro (http por IP de red) o sin micrófono.
  // Aquí el navegador ni siquiera tiene API de micrófono: niega al instante.
  if (
    typeof navigator === "undefined" ||
    !navigator.mediaDevices?.getUserMedia
  ) {
    return {
      ok: false,
      mensaje: `Sin API de micrófono (¿origen seguro? ${String(window.isSecureContext)}). Abre la app en localhost o https.`,
    };
  }

  const estado = await estadoPermiso();

  // Caso 2: bloqueado a nivel sitio. Chrome NO vuelve a mostrar el popup,
  // requestAudioRecordingPermission() falla al instante. Solo sirve desbloquear a mano.
  if (estado === "denied") {
    return {
      ok: false,
      mensaje: `Permiso bloqueado por el navegador (por eso no sale el popup). ${AYUDA_DESBLOQUEO}`,
    };
  }

  if (estado === "granted") {
    return { ok: true, mensaje: "Permiso concedido" };
  }

  // Caso 3: prompt/unknown. Aquí SÍ sale el popup del navegador.
  const ok = await pedirPermiso();
  if (ok) return { ok: true, mensaje: "Permiso concedido" };
  const deNuevo = await estadoPermiso();
  return {
    ok: false,
    mensaje:
      deNuevo === "denied"
        ? `Permiso denegado y quedó bloqueado. ${AYUDA_DESBLOQUEO}`
        : "Permiso denegado en el popup. Pulsa de nuevo para reintentar.",
  };
}

export async function puedeGrabar(): Promise<boolean> {
  try {
    const r = await VoiceRecorder.canDeviceVoiceRecord();
    return r.value;
  } catch {
    return false;
  }
}

const AYUDA_DESBLOQUEO =
  "Actívalo a mano: candado de la barra de dirección > Micrófono > Permitir, y recarga.";

export async function iniciarGrabacion(): Promise<void> {
  // 0. ¿Este navegador/contexto puede grabar? (https o localhost + MediaRecorder)
  if (!(await puedeGrabar())) {
    throw new Error(
      "Este navegador no puede grabar. Usa Chrome en localhost o https.",
    );
  }

  // 1. Si está bloqueado a nivel sitio, pedir es inútil: el navegador no re-pregunta
  const estado = await estadoPermiso();
  if (estado === "denied") {
    throw new Error(`Permiso de micrófono bloqueado. ${AYUDA_DESBLOQUEO}`);
  }

  // 2. Si no está concedido, pide (aquí sí sale el popup si estado = prompt)
  if (!(await tienePermiso())) {
    const ok = await pedirPermiso();
    if (!ok) {
      const deNuevo = await estadoPermiso();
      throw new Error(
        deNuevo === "denied"
          ? `Permiso de micrófono denegado. ${AYUDA_DESBLOQUEO}`
          : "Permiso de micrófono denegado.",
      );
    }
  }

  // 3. Graba. Si falla aquí, el permiso estaba bien: es captura
  // (micrófono ocupado por otra pestaña/app, o se desconectó el dispositivo).
  try {
    const r = await VoiceRecorder.startRecording();
    if (!r.value) throw new Error("rechazado por el plugin");
  } catch (e) {
    throw new Error(
      `No se pudo capturar audio (¿otro tab lo está usando?). ${String(e)}`,
    );
  }
}

// Devuelve base64 + duración ms + mimeType para reproducir/guardar
export async function detenerGrabacion() {
  return VoiceRecorder.stopRecording();
}
