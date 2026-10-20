// TRANSCRIPCIÓN EN VIVO: @capgo/capacitor-speech-recognition (nativo)
// Fork mantenido del community con la misma API, alineado a Capacitor 8
// (el community iba en v7 contra nuestro core v8), más fixes de crashes
// y evento 'error' para diagnóstico real.
// Nativo: Android SpeechRecognizer / iOS SFSpeechRecognizer.
// En web el plugin NO existe (lanza "not implemented"), así que primero
// se pregunta la plataforma y se usa Web Speech API como fallback.
import { Capacitor } from "@capacitor/core";
import { SpeechRecognition } from "@capgo/capacitor-speech-recognition";

declare global {
  interface Window {
    SpeechRecognition?: any;
    webkitSpeechRecognition?: any;
  }
}

// Escucha una frase y devuelve el texto. language: 'es-ES' | 'es-CO' | etc.
export async function transcribirUnaFrase(language = "es-ES"): Promise<string> {
  // 1. Web (npm run dev) primero: aquí el plugin nativo no existe.
  // (Antes el requestPermissions() nativo iba antes y en web reventaba
  // con "Method not implemented on web" sin llegar nunca al fallback.)
  if (!Capacitor.isNativePlatform()) {
    return transcribirWeb(language);
  }

  // 2. Nativo: ¿el servicio existe en este equipo?
  const disp = await SpeechRecognition.available();
  if (!disp.available) {
    throw new Error(
      "Reconocimiento de voz no disponible en este equipo (sin servicio de Google/Apple).",
    );
  }

  // 3. Permisos (Android = RECORD_AUDIO, iOS = micro + speech)
  const perm = await SpeechRecognition.requestPermissions();
  if (perm.speechRecognition !== "granted") {
    throw new Error("Permiso de reconocimiento denegado");
  }

  // 4. Escucha una frase. popup:false = sin diálogo del sistema.
  const r = await SpeechRecognition.start({
    language,
    maxResults: 1,
    popup: false,
    partialResults: false,
  });
  await SpeechRecognition.stop().catch(() => {});
  const texto = r.matches?.[0] ?? "";
  if (!texto) throw new Error("No se entendió, intenta de nuevo");
  return texto;
}

// Fallback navegador (Chrome + localhost/https + permiso de micro)
function transcribirWeb(language: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SR) {
      reject(
        new Error(
          "Este navegador no tiene Web Speech API. Usa Chrome o prueba en el celular.",
        ),
      );
      return;
    }
    const rec = new SR();
    rec.lang = language;
    rec.interimResults = false;
    rec.onresult = (e: any) => resolve(e.results[0][0].transcript as string);
    rec.onerror = (e: any) => reject(new Error(`Web Speech: ${e.error}`));
    rec.onend = () => reject(new Error("No se escuchó nada"));
    rec.start();
  });
}
