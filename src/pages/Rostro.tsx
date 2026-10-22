// DEMO DE INTEGRACIÓN DE UN SDK BIOMÉTRICO CERRADO (FacePlugin)
//
// Al entrar se activa el motor automáticamente (setActivation + init) con la
// key de .env; un overlay con spinner cubre la espera. Sin licencia válida el
// paso de detección no funciona.
import { useEffect, useState } from "react";
import {
  IonBackButton,
  IonBadge,
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonLoading,
  IonPage,
  IonText,
  IonTitle,
  IonToolbar,
} from "@ionic/react";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { Capacitor } from "@capacitor/core";
import {
  cameraOutline,
  imagesOutline,
  refreshOutline,
  shieldCheckmarkOutline,
} from "ionicons/icons";
import {
  activar,
  codigoMaquina,
  compararRostros,
  detectarRostros,
  resumenRostro,
} from "../lib/rostro";
import { licenciaDemo } from "../lib/licencia-demo";
import type { FaceBox } from "face-recognition-capacitor";

// Debe coincidir con android/app/build.gradle (applicationId).
const APP_ID = "com.faceplugin.facerecognitionsdk";

// El motor vive en el proceso nativo: si ya arrancó en esta sesión, no hay
// que repetir setActivation/init al volver a la página.
let motorYaIniciado = false;

export default function Rostro() {
  const nativo = Capacitor.isNativePlatform();
  const [machine, setMachine] = useState("");
  const [listo, setListo] = useState(motorYaIniciado);
  const [cargando, setCargando] = useState(nativo && !motorYaIniciado);
  const [mensajeCarga, setMensajeCarga] = useState("Preparando motor…");
  const [error, setError] = useState<string | null>(null);
  const [foto, setFoto] = useState<string | null>(null);
  const [rostros, setRostros] = useState<FaceBox[]>([]);
  const [comparacion, setComparacion] = useState<number | null>(null);
  const [log, setLog] = useState("Preparando motor…");

  // Activación automática: machine code -> setActivation -> init.
  const activarAutomatico = async () => {
    setCargando(true);
    setError(null);
    setListo(false);
    setMensajeCarga("Leyendo el equipo…");
    setLog("Leyendo el equipo…");

    try {
      const mc = await codigoMaquina();
      setMachine(mc);

      const key = licenciaDemo();
      if (!key) {
        throw new Error(
          "No hay licencia configurada: agrega VITE_FACEPLUGIN_LICENSE_ANDROID en .env y recompila.",
        );
      }

      setMensajeCarga("Activando licencia y cargando modelos…");
      setLog("Activando licencia y cargando modelos (la primera vez tarda)…");

      const r = await activar(key);
      if (!r.ok) {
        setError(r.mensaje);
        setLog(r.mensaje);
        return;
      }

      motorYaIniciado = true;
      setListo(true);
      setLog("Motor listo.");
    } catch (e) {
      const texto = e instanceof Error ? e.message : String(e);
      setError(texto);
      setLog(`Error: ${texto}`);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    if (!nativo) {
      setCargando(false);
      setLog("Estás en el navegador. Abre la app instalada en el teléfono.");
      return;
    }
    if (motorYaIniciado) {
      setCargando(false);
      setListo(true);
      setLog("Motor ya iniciado en esta sesión.");
      return;
    }
    void activarAutomatico();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nativo]);

  // Toma una foto con la cámara o elige una de la galería.
  // El SDK recibe SIEMPRE una URI nativa, nunca un blob del navegador.
  const elegirFoto = async (origen: "camara" | "galeria") => {
    try {
      const photo = await Camera.getPhoto({
        quality: 90,
        source: origen === "camara" ? CameraSource.Camera : CameraSource.Photos,
        resultType: CameraResultType.Uri,
      });
      const uri = photo.path
        ? photo.path.startsWith("file://") || photo.path.startsWith("content:")
          ? photo.path
          : `file://${photo.path}`
        : photo.webPath;
      if (!uri) throw new Error("No se obtuvo la foto");

      setFoto(uri);
      setRostros([]);
      setComparacion(null);
      setLog("Analizando imagen en el motor nativo...");
      const r = await detectarRostros(uri);
      setRostros(r);
      setLog(
        r.length === 0
          ? "El motor no detectó rostros en la foto."
          : `Detectados ${r.length} rostro(s). Todo el análisis ocurrió en el dispositivo.`,
      );
    } catch (e) {
      setLog(`Error con la foto: ${String(e)}`);
    }
  };

  // 1:1: extrae plantilla de la foto actual y la compara con otra nueva.
  const compararConOtra = async () => {
    if (!foto) return;
    try {
      const photo = await Camera.getPhoto({
        quality: 90,
        source: CameraSource.Photos,
        resultType: CameraResultType.Uri,
      });
      const otra = photo.path ? `file://${photo.path}` : photo.webPath;
      if (!otra) throw new Error("No se obtuvo la segunda foto");
      const score = await compararRostros(foto, otra);
      setComparacion(score);
      setLog(
        `Similitud ${score.toFixed(3)} · ${score >= 0.67 ? "misma persona" : "personas distintas"} (umbral 0.67)`,
      );
    } catch (e) {
      setLog(`Error comparando: ${String(e)}`);
    }
  };

  const tarjetaMotor = (
    <IonCard>
      <IonCardHeader>
        <IonCardSubtitle>
          {listo
            ? "Motor activo — detección disponible"
            : cargando
              ? "Iniciando motor…"
              : "Motor no disponible"}
        </IonCardSubtitle>
        <IonCardTitle>
          <IonIcon icon={shieldCheckmarkOutline} /> Detección + liveness
        </IonCardTitle>
      </IonCardHeader>
      <IonCardContent>
        <p>
          La foto se envía como URI al nativo; vuelve un JSON con caja,
          landmarks, pose, liveness, edad y género.
        </p>
        <IonButton
          expand="block"
          onClick={() => elegirFoto("camara")}
          disabled={!listo}
        >
          <IonIcon slot="start" icon={cameraOutline} />
          Tomar foto
        </IonButton>
        <IonButton
          expand="block"
          fill="outline"
          onClick={() => elegirFoto("galeria")}
          disabled={!listo}
        >
          <IonIcon slot="start" icon={imagesOutline} />
          Elegir de galería
        </IonButton>

        {foto && (
          <img
            src={Capacitor.convertFileSrc(foto)}
            alt="Rostro analizado"
            style={{
              width: "100%",
              borderRadius: 12,
              marginTop: 12,
              display: "block",
            }}
          />
        )}

        {rostros.length > 0 && (
          <IonList inset>
            {rostros.map((box, i) => (
              <IonItem key={i}>
                <IonLabel>
                  <h3>Rostro {i + 1}</h3>
                  {resumenRostro(box).map((linea) => (
                    <p key={linea} style={{ margin: "2px 0" }}>
                      {linea}
                    </p>
                  ))}
                </IonLabel>
              </IonItem>
            ))}
          </IonList>
        )}

        {comparacion !== null && (
          <IonText color={comparacion >= 0.67 ? "success" : "medium"}>
            <p>Score 1:1: {comparacion.toFixed(3)}</p>
          </IonText>
        )}
      </IonCardContent>
    </IonCard>
  );

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="dark">
          <IonButtons slot="start">
            <IonBackButton defaultHref="/plugins" />
          </IonButtons>
          <IonTitle>
            Rostro{" "}
            <IonBadge
              color={listo ? "success" : cargando ? "medium" : "warning"}
            >
              {listo ? "motor listo" : cargando ? "iniciando" : "sin licencia"}
            </IonBadge>
          </IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        {!nativo && (
          <IonCard color="warning">
            <IonCardHeader>
              <IonCardTitle>Esto no corre en el navegador</IonCardTitle>
            </IonCardHeader>
            <IonCardContent>
              El motor es un binario Android/iOS. Compila e instala la app en un
              teléfono físico: <code>npx cap run android</code>.
            </IonCardContent>
          </IonCard>
        )}

        {tarjetaMotor}

        {error && (
          <IonCard color="danger">
            <IonCardHeader>
              <IonCardTitle>No se pudo iniciar el motor</IonCardTitle>
            </IonCardHeader>
            <IonCardContent>
              <IonText color="light">
                <p>{error}</p>
              </IonText>
              <IonText color="light">
                <p
                  style={{
                    fontFamily: "monospace",
                    fontSize: 12,
                    wordBreak: "break-all",
                  }}
                >
                  appId: {APP_ID}
                  {machine ? ` · equipo: ${machine}` : ""}
                </p>
              </IonText>
              <IonButton
                color="light"
                size="small"
                onClick={activarAutomatico}
                disabled={!nativo}
              >
                <IonIcon slot="start" icon={refreshOutline} />
                Reintentar
              </IonButton>
            </IonCardContent>
          </IonCard>
        )}

        <IonCard>
          <IonCardHeader>
            <IonCardTitle>Consola</IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            <IonText color="medium">{log}</IonText>
          </IonCardContent>
        </IonCard>

        <IonText color="medium">
          <p style={{ fontSize: 12 }}>
            {/* Recordatorio del flujo real de integración */}
            Integración: React → face-recognition-capacitor (TS) → módulo
            Capacitor → facerecognitionsdk.aar. El plugin solo transporta URIs y
            JSON; la IA corre on-device.
          </p>
        </IonText>
      </IonContent>

      <IonLoading
        isOpen={cargando}
        message={mensajeCarga}
        backdropDismiss={false}
        spinner="crescent"
      />
    </IonPage>
  );
}
