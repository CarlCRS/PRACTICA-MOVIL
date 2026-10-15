// TRANSCRIPCIÓN: @capacitor-community/speech-recognition (nativo)
// + fallback Web Speech API en navegador.
// Nativo: Android SpeechRecognizer / iOS SFSpeechRecognizer (gratis, tiempo real).
// Si necesitas transcribir un .m4a ya grabado con precisión total,
// la ruta es nube: enviar base64 a Whisper/Google STT (requiere API key).
import { Capacitor } from "@capacitor/core";
import { SpeechRecognition } from "@capacitor-community/speech-recognition";

declare global {
  interface Window {
    SpeechRecognition?: any;
    webkitSpeechRecognition?: any;
  }
}

// Escucha una frase y devuelve el texto. language: 'es-ES' | 'es-CO' | etc.
export async function transcribirUnaFrase(language = "es-ES"): Promise<string> {
  // 1. Permisos (en Android = RECORD_AUDIO, en iOS = micro + speech)
  const perm = await SpeechRecognition.requestPermissions();
  if (perm.speechRecognition !== "granted") {
    throw new Error("Permiso de reconocimiento denegado");
  }

  // 2. Web (npm run dev): el plugin no tiene micrófono real -> Web Speech API
  if (!Capacitor.isNativePlatform()) {
    return transcribirWeb(language);
  }

  // 3. Nativo: popup:false = sin diálogo del sistema, control desde tu UI
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
// paa que se pueda usar en el navegador
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
