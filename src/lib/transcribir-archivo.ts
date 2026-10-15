// TRANSCRIPCIÓN DE ARCHIVO con ElevenLabs Scribe (SDK oficial).
// Flujo: grabar primero, transcribir después.
// El SDK es el mismo de tu ejemplo, adaptado a la app:
//  - new ElevenLabsClient({ apiKey }) con la key del campo de texto.
//  - file: File creado del base64 (en Node sería path "audio.mp3", en el
//    WebView/móvil tiene que ser un File/Blob).
// Responde { text, languageCode, words }.
// Demo: la key queda visible en la app. Producción: llama a Scribe desde tu backend.

function base64ToFile(base64: string, mimeType: string, nombre: string): File {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new File([bytes], nombre, { type: mimeType });
}

function extensionDeMime(mime: string): string {
  if (mime.includes("mp4") || mime.includes("aac") || mime.includes("m4a"))
    return "m4a";
  if (mime.includes("wav")) return "wav";
  if (mime.includes("ogg")) return "ogg";
  return "webm";
}

// KEY FIJA: el usuario no la ingresa. Pega tu key de ElevenLabs aquí
// o define VITE_ELEVENLABS_API_KEY en un archivo .env (tiene prioridad).
const ELEVENLABS_API_KEY =
  import.meta.env.VITE_ELEVENLABS_API_KEY ?? "PEGA-AQUI-TU-KEY-xi-...";

export async function transcribirConElevenLabs(
  base64: string,
  mimeType: string,
): Promise<string> {
  if (!ELEVENLABS_API_KEY || ELEVENLABS_API_KEY.includes("PEGA-AQUI-TU-KEY"))
    throw new Error("Falta configurar ELEVENLABS_API_KEY en el código");
  const { ElevenLabsClient } = await import("@elevenlabs/elevenlabs-js");
  const elevenlabs = new ElevenLabsClient({ apiKey: ELEVENLABS_API_KEY });

  const ext = extensionDeMime(mimeType);
  const file = base64ToFile(base64, mimeType, `audio.${ext}`);

  const transcription = await elevenlabs.speechToText.convert({
    file,
    modelId: "scribe_v2",
    tagAudioEvents: true,
    languageCode: "spa",
    diarize: true,
  } as never);
  const texto = (transcription as { text?: string }).text ?? "";
  if (!texto) throw new Error("ElevenLabs no devolvió texto");
  return texto;
}
