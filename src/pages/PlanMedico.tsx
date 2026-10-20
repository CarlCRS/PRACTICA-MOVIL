// PÁGINA PLAN MÉDICO: audio de síntomas -> transcripción -> plan médico
// FLUJO DE 3 PASOS (todo en la misma pantalla, sin navegar):
//   1) GRABAR   -> plugin capacitor-voice-recorder (src/lib/microfono.ts)
//   2) TRANSCRIBIR -> ElevenLabs Scribe (src/lib/transcribir-archivo.ts)
//   3) GENERAR PLAN -> reglas locales (src/lib/plan-medico.ts)
//
// POR QUÉ ESTA PÁGINA EXISTE (aprendizaje de plugins):
//   Demuestra el PATRÓN CAPACITOR completo:
//     UI (esta pantalla) -> wrapper en src/lib -> plugin nativo -> Promise
//   Y deja el "reemplazable" claro: si mañana la generación del plan vive en
//   tu API C#/.NET, solo se cambia src/lib/plan-medico.ts, no esta pantalla.
//
// ADVERTENCIA MÉDICA: la app organiza la consulta; no diagnostica.
import { useState } from "react";
import {
  IonBadge,
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonPage,
  IonText,
  IonTextarea,
  IonTitle,
  IonToolbar,
} from "@ionic/react";
import {
  alertCircleOutline,
  checkmarkCircleOutline,
  documentTextOutline,
  micOutline,
  stopOutline,
  textOutline,
} from "ionicons/icons";
import {
  iniciarGrabacion,
  detenerGrabacion,
  diagnosticarPermiso,
} from "../lib/microfono";
import { transcribirConElevenLabs } from "../lib/transcribir-archivo";
import { generarPlanMedico, type PlanMedico } from "../lib/plan-medico";
import {
  estadoIA,
  generarPlanConIA,
  ErrorIA,
} from "../lib/plan-medico-ia";
import { guardarPlan } from "../lib/plan-seguro";

type Paso = 1 | 2 | 3;

export default function PlanMedico() {
  // --- ESTADO DE LA PANTALLA (concepto: useState = memoria de la pantalla) ---
  const [paso, setPaso] = useState<Paso>(1);
  const [grabando, setGrabando] = useState(false);
  const [transcribiendo, setTranscribiendo] = useState(false);
  const [generando, setGenerando] = useState(false);

  const [audioBase64, setAudioBase64] = useState<string | null>(null);
  const [audioMime, setAudioMime] = useState("audio/m4a");
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const [duracion, setDuracion] = useState(0);

  const [transcripcion, setTranscripcion] = useState("");
  const [plan, setPlan] = useState<PlanMedico | null>(null);
  const [origen, setOrigen] = useState<"ia" | "reglas" | null>(null);
  const [log, setLog] = useState(
    "Paso 1: graba al paciente relatando sus síntomas.",
  );

  // Estado del LLM: si no hay API key, la pantalla avisa y usa el motor local.
  const [ia] = useState(() => estadoIA());

  // --- PASO 1: GRABAR ---
  const grabar = async () => {
    try {
      setPlan(null);
      setTranscripcion("");
      await iniciarGrabacion();
      setGrabando(true);
      setLog("Grabando... el paciente está relatando los síntomas.");
    } catch (e) {
      setLog(`Error al grabar: ${String(e)}`);
    }
  };

  const detener = async () => {
    try {
      const r = await detenerGrabacion();
      setGrabando(false);
      setDuracion(r.value.msDuration);
      if (r.value.recordDataBase64) {
        setAudioBase64(r.value.recordDataBase64);
        setAudioMime(r.value.mimeType);
        setAudioSrc(
          `data:${r.value.mimeType};base64,${r.value.recordDataBase64}`,
        );
      }
      setPaso(2);
      setLog(
        `Grabado ${(r.value.msDuration / 1000).toFixed(1)}s. Pulsa "Transcribir" para pasar la voz a texto.`,
      );
    } catch (e) {
      setGrabando(false);
      setLog(`Error al detener: ${String(e)}`);
    }
  };

  // --- PASO 2: TRANSCRIBIR ---
  const transcribir = async () => {
    if (!audioBase64) {
      setLog("Primero graba y detén un audio.");
      return;
    }
    try {
      setTranscribiendo(true);
      setLog("Subiendo audio a ElevenLabs Scribe...");
      const texto = await transcribirConElevenLabs(audioBase64, audioMime);
      setTranscripcion(texto);
      setPaso(3);
      setLog("Transcripción lista. Pulsa \"Generar plan\".");
    } catch (e) {
      setLog(`Transcripción: ${String(e)}`);
    } finally {
      setTranscribiendo(false);
    }
  };

  // --- PASO 3: GENERAR PLAN (IA con fallback a reglas locales) ---
  const generar = async () => {
    if (!transcripcion.trim()) {
      setLog("No hay transcripción: graba o transcribe primero.");
      return;
    }
    setGenerando(true);
    try {
      if (ia.configurada) {
        // 1) Intento con LLM (entiende lenguaje natural).
        try {
          const p = await generarPlanConIA(transcripcion);
          setPlan(p);
          setOrigen("ia");
          // PERSISTENCIA CON PLUGIN PROPIO: el histórico del plan queda en
          // almacenamiento seguro en nativo (o demo web). El contrato del
          // plugin es el mismo para web/Android/iOS - eso es "híbrido".
          guardarPlan({
            id: `plan-${Date.now()}`,
            fecha: new Date().toISOString(),
            motivo: p.motivoConsulta,
            planJson: JSON.stringify(p),
          });
          setLog(`Plan generado con IA (${ia.modelo}).`);
          return;
        } catch (e) {
          // 2) Si el LLM falla, NO se rompe la app: se usan las reglas locales.
          const motivo =
            e instanceof ErrorIA ? e.message : String(e);
          setLog(`IA no disponible (${motivo}). Usando generador local.`);
        }
      } else {
        setLog(ia.mensaje);
      }
      // 3) Fallback: reglas por palabras clave (offline, determinista).
      const pLocal = generarPlanMedico(transcripcion);
      setPlan(pLocal);
      setOrigen("reglas");
      guardarPlan({
        id: `plan-${Date.now()}`,
        fecha: new Date().toISOString(),
        motivo: pLocal.motivoConsulta,
        planJson: JSON.stringify(pLocal),
      });
    } finally {
      setGenerando(false);
    }
  };

  const reiniciar = () => {
    setPaso(1);
    setPlan(null);
    setOrigen(null);
    setTranscripcion("");
    setAudioBase64(null);
    setAudioSrc(null);
    setDuracion(0);
    setLog("Listo para una nueva grabación.");
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="primary">
          <IonTitle>Plan médico</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        {/* INDICADOR DE PASOS: explica el flujo de un vistazo */}
        <IonCard>
          <IonCardContent>
            <IonText color="medium">
              <p style={{ fontSize: 12, marginBottom: 8 }}>
                Flujo: <b>grabar síntomas</b> → <b>transcribir</b> →{" "}
                <b>generar plan</b>
              </p>
            </IonText>
            <IonBadge color={paso >= 1 ? "primary" : "medium"}>
              1. Audio
            </IonBadge>{" "}
            <IonBadge color={paso >= 2 ? "primary" : "medium"}>
              2. Texto
            </IonBadge>{" "}
            <IonBadge color={paso >= 3 ? "primary" : "medium"}>
              3. Plan
            </IonBadge>
          </IonCardContent>
        </IonCard>

        {/* ---------------- PASO 1: GRABAR ---------------- */}
        <IonCard>
          <IonCardHeader>
            <IonCardTitle>
              <IonIcon icon={micOutline} /> 1. Grabar síntomas
            </IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            <p style={{ fontSize: 12 }}>
              El paciente relata sus síntomas en audio (plugin{" "}
              <code>capacitor-voice-recorder</code>). En web usa MediaRecorder; en
              APK/iOS usa el micrófono nativo.
            </p>
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
            {audioSrc && (
              <>
                <audio
                  controls
                  src={audioSrc}
                  style={{ width: "100%", marginTop: 8 }}
                />
                <p style={{ fontSize: 12, color: "var(--ion-color-medium)" }}>
                  Duración: {(duracion / 1000).toFixed(1)}s
                </p>
              </>
            )}
          </IonCardContent>
        </IonCard>

        {/* ---------------- PASO 2: TRANSCRIBIR ---------------- */}
        <IonCard>
          <IonCardHeader>
            <IonCardTitle>
              <IonIcon icon={textOutline} /> 2. Transcripción
            </IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            <p style={{ fontSize: 12 }}>
              El audio se convierte a texto con ElevenLabs Scribe ({" "}
              <code>scribe_v2</code>, español, con diarización). Puedes editar el
              texto antes de generar el plan.
            </p>
            <IonButton
              expand="block"
              color="tertiary"
              onClick={transcribir}
              disabled={!audioBase64 || transcribiendo}
            >
              <IonIcon icon={textOutline} slot="start" />
              {transcribiendo ? "Transcribiendo..." : "Transcribir audio"}
            </IonButton>
            {transcripcion && (
              <IonTextarea
                value={transcripcion}
                onIonChange={(e) => setTranscripcion(e.detail.value ?? "")}
                placeholder="Texto transcrito (editable)"
                autoGrow
                style={{
                  marginTop: 12,
                  "--padding-top": "10px",
                  "--padding-bottom": "10px",
                } as React.CSSProperties}
              />
            )}
          </IonCardContent>
        </IonCard>

        {/* ---------------- PASO 3: GENERAR PLAN ---------------- */}
        <IonCard>
          <IonCardHeader>
            <IonCardTitle>
              <IonIcon icon={documentTextOutline} /> 3. Plan médico
            </IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            <p style={{ fontSize: 12 }}>
              {ia.configurada ? (
                <>
                  El texto se envía a un LLM (<code>{ia.modelo}</code>) que extrae
                  síntomas, alertas y recomendaciones. Si el LLM falla, se usa el
                  generador local por reglas.
                </>
              ) : (
                <>
                  <b>Sin IA configurada.</b> Se usan reglas locales por palabras
                  clave. Añade <code>VITE_LLM_API_KEY</code> en <code>.env</code>{" "}
                  para activar el LLM.
                </>
              )}
            </p>
            <IonButton
              expand="block"
              color="primary"
              onClick={generar}
              disabled={!transcripcion.trim() || generando}
            >
              <IonIcon icon={checkmarkCircleOutline} slot="start" />
              {generando ? "Generando..." : "Generar plan"}
            </IonButton>
            <IonButton
              expand="block"
              fill="clear"
              color="medium"
              onClick={reiniciar}
            >
              Nueva consulta
            </IonButton>
            <p style={{ fontSize: 11, color: "var(--ion-color-medium)" }}>
              {ia.mensaje}
            </p>
          </IonCardContent>
        </IonCard>

        {/* ---------------- RESULTADO ---------------- */}
        {plan && (
          <>
            <IonCard color="light">
              <IonCardHeader>
                <IonCardTitle>Motivo de consulta</IonCardTitle>
              </IonCardHeader>
              <IonCardContent>
                <p>{plan.motivoConsulta}</p>
                <p style={{ fontSize: 12, color: "var(--ion-color-medium)" }}>
                  Generado: {plan.generadoEn} · Motor:{" "}
                  <b>{origen === "ia" ? `IA (${ia.modelo})` : "reglas locales"}</b>
                </p>
              </IonCardContent>
            </IonCard>

            {plan.alertas.length > 0 && (
              <IonCard color="danger">
                <IonCardHeader>
                  <IonCardTitle>
                    <IonIcon icon={alertCircleOutline} /> Señales de alarma
                  </IonCardTitle>
                </IonCardHeader>
                <IonCardContent>
                  {plan.alertas.map((a, i) => (
                    <div key={i} style={{ marginBottom: 10 }}>
                      <b>{a.accion}</b>
                      <p style={{ fontSize: 13, margin: "2px 0" }}>
                        <i>"{a.evidencia}"</i> — {a.motivo}
                      </p>
                    </div>
                  ))}
                </IonCardContent>
              </IonCard>
            )}

            <IonCard>
              <IonCardHeader>
                <IonCardTitle>Síntomas detectados</IonCardTitle>
              </IonCardHeader>
              <IonCardContent>
                {plan.sintomas.length === 0 ? (
                  <IonText color="medium">
                    No se identificaron síntomas con el diccionario actual.
                  </IonText>
                ) : (
                  <IonList>
                    {plan.sintomas.map((s, i) => (
                      <IonItem key={i}>
                        <IonLabel>
                          <h3>{s.nombre}</h3>
                          <p>Detectado en: "{s.evidencia}"</p>
                        </IonLabel>
                        <IonBadge
                          slot="end"
                          color={
                            s.prioridad === "alta"
                              ? "danger"
                              : s.prioridad === "media"
                                ? "warning"
                                : "success"
                          }
                        >
                          {s.prioridad}
                        </IonBadge>
                      </IonItem>
                    ))}
                  </IonList>
                )}
              </IonCardContent>
            </IonCard>

            <IonCard>
              <IonCardHeader>
                <IonCardTitle>Recomendaciones</IonCardTitle>
              </IonCardHeader>
              <IonCardContent>
                {plan.recomendaciones.map((r, i) => (
                  <p key={i} style={{ fontSize: 13 }}>
                    • {r}
                  </p>
                ))}
              </IonCardContent>
            </IonCard>

            <IonCard>
              <IonCardHeader>
                <IonCardTitle>Preparación para la consulta</IonCardTitle>
              </IonCardHeader>
              <IonCardContent>
                {plan.preparacionConsulta.map((r, i) => (
                  <p key={i} style={{ fontSize: 13 }}>
                    • {r}
                  </p>
                ))}
              </IonCardContent>
            </IonCard>

            <IonCard color="warning">
              <IonCardContent>
                <IonNote style={{ fontSize: 12 }}>
                  <b>Aviso:</b> {plan.advertencia}
                </IonNote>
              </IonCardContent>
            </IonCard>
          </>
        )}

        {/* ---------------- LOG ---------------- */}
        <IonCard>
          <IonCardHeader>
            <IonCardTitle>Log</IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            <IonText color="medium">{log}</IonText>
          </IonCardContent>
        </IonCard>
      </IonContent>
    </IonPage>
  );
}
