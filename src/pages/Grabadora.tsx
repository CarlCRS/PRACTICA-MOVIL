// PÁGINA GRABADORA: grabar -> detener -> transcribir con ElevenLabs Scribe
import { useState } from "react";
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonContent,
  IonHeader,
  IonIcon,
  IonPage,
  IonText,
  IonTitle,
  IonToolbar,
} from "@ionic/react";
import {
  micOutline,
  stopOutline,
  playOutline,
  textOutline,
} from "ionicons/icons";
import {
  iniciarGrabacion,
  detenerGrabacion,
  diagnosticarPermiso,
} from "../lib/microfono";
import { transcribirConElevenLabs } from "../lib/transcribir-archivo";

export default function Grabadora() {
  const [grabando, setGrabando] = useState(false);
  const [log, setLog] = useState(
    "1) Graba 2) Detén 3) Transcribe la grabación.",
  );
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const [audioBase64, setAudioBase64] = useState<string | null>(null);
  const [audioMime, setAudioMime] = useState("audio/m4a");
  const [duracion, setDuracion] = useState(0);
  const [transcribiendo, setTranscribiendo] = useState(false);
  const [textoArchivo, setTextoArchivo] = useState("");

  const grabar = async () => {
    try {
      setAudioSrc(null);
      await iniciarGrabacion();
      setGrabando(true);
      setLog("Grabando... habla al micrófono.");
    } catch (e) {
      setLog(`Error: ${String(e)}`);
    }
  };

  const detener = async () => {
    try {
      const r = await detenerGrabacion();
      setGrabando(false);
      setDuracion(r.value.msDuration);
      // Guarda base64 crudo (para transcribir) + data URL (para reproducir)
      if (r.value.recordDataBase64) {
        setAudioBase64(r.value.recordDataBase64);
        setAudioMime(r.value.mimeType);
        setAudioSrc(
          `data:${r.value.mimeType};base64,${r.value.recordDataBase64}`,
        );
      }
      setTextoArchivo("");
      setLog(
        `Grabado ${(r.value.msDuration / 1000).toFixed(1)}s. Ahora pulsa "Transcribir esta grabación".`,
      );
    } catch (e) {
      setGrabando(false);
      setLog(`Error al detener: ${String(e)}`);
    }
  };

  // FLUJO: transcribe el ARCHIVO ya grabado con ElevenLabs Scribe
  const transcribirGrabacion = async () => {
    if (!audioBase64) {
      setLog("Primero graba y detén un audio.");
      return;
    }
    try {
      setTranscribiendo(true);
      setLog("Subiendo audio a ElevenLabs...");
      const texto = await transcribirConElevenLabs(
        audioBase64,
        audioMime,
      );
      setTextoArchivo(texto);
      setLog("Transcripción lista (ElevenLabs Scribe).");
    } catch (e) {
      setLog(`Transcripción: ${String(e)}`);
    } finally {
      setTranscribiendo(false);
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="success">
          <IonTitle>Grabadora</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <IonCard>
          <IonCardHeader>
            <IonCardTitle>
              {grabando ? "🔴 Grabando..." : "Micrófono listo"}
            </IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            {!grabando ? (
              <IonButton expand="block" color="danger" onClick={grabar}>
                <IonIcon icon={micOutline} slot="start" /> Grabar
              </IonButton>
            ) : (
              <IonButton expand="block" color="medium" onClick={detener}>
                <IonIcon icon={stopOutline} slot="start" /> Detener
              </IonButton>
            )}
            <IonButton
              expand="block"
              fill="clear"
              onClick={async () =>
                setLog((await diagnosticarPermiso()).mensaje)
              }
            >
              Pedir permiso / diagnosticar
            </IonButton>
          </IonCardContent>
        </IonCard>

        {audioSrc && (
          <IonCard>
            <IonCardHeader>
              <IonCardTitle>
                <IonIcon icon={playOutline} /> Última grabación (
                {(duracion / 1000).toFixed(1)}s)
              </IonCardTitle>
            </IonCardHeader>
            <IonCardContent>
              {/* Reproductor nativo del WebView: funciona en web y móvil */}
              <audio controls src={audioSrc} style={{ width: "100%" }} />
            </IonCardContent>
          </IonCard>
        )}

        <IonCard>
          <IonCardHeader>
            <IonCardTitle>
              <IonIcon icon={textOutline} /> Transcribir la grabación
            </IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            <p style={{ fontSize: 12 }}>
              El audio ya grabado se envía a ElevenLabs Scribe
              (modelId scribe_v2, español, con diarización).
            </p>
            <IonButton
              expand="block"
              color="tertiary"
              onClick={transcribirGrabacion}
              disabled={!audioBase64 || transcribiendo}
              style={{ marginTop: 12 }}
            >
              <IonIcon icon={textOutline} slot="start" />
              {transcribiendo
                ? "Transcribiendo..."
                : "Transcribir esta grabación"}
            </IonButton>
            {textoArchivo && (
              <p style={{ marginTop: 12, fontSize: 16 }}>
                <b>Transcripción:</b> {textoArchivo}
              </p>
            )}
          </IonCardContent>
        </IonCard>

        <IonCard>
          <IonCardHeader>
            <IonCardTitle>Log</IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            <IonText color="medium">{log}</IonText>
            <p style={{ marginTop: 8, fontSize: 12 }}>
              Web: usa el micrófono del navegador (permite solo en
              localhost/https). APK/iOS: pide RECORD_AUDIO + genera .m4a/.aac.
            </p>
          </IonCardContent>
        </IonCard>
      </IonContent>
    </IonPage>
  );
}
