// PÁGINA CÁMARA: preview en vivo + foto + flip.
// La cámara nativa va DETRÁS del WebView (toBack:true). Para verla hay que
// transparentar TODA la cadena (body > ion-app > ion-page > ion-content),
// no solo el IonContent. Los botones viven en un IonFooter sólido, que
// siempre queda visible y tocable por encima del preview.
import { useEffect, useState } from "react";
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonContent,
  IonFooter,
  IonHeader,
  IonPage,
  IonText,
  IonTitle,
  IonToolbar,
} from "@ionic/react";
import {
  detenerPreview,
  girarCamara,
  iniciarPreview,
  tomarFoto,
} from "../lib/camara-preview";

export default function Camara() {
  const [activa, setActiva] = useState(false);
  const [foto, setFoto] = useState<string | null>(null);
  const [log, setLog] = useState("Pulsa Iniciar cámara.");

  // Transparenta la cadena completa mientras el preview vive.
  // Sin esto, ion-app/ion-page tapan la cámara aunque el content sea transparente.
  // También oculta el tab-bar para que la cámara use toda la pantalla.
  useEffect(() => {
    document.body.classList.toggle("camera-preview-active", activa);
    return () => document.body.classList.remove("camera-preview-active");
  }, [activa]);

  // Al salir de la página, apaga la cámara y restaura el fondo
  useEffect(() => {
    return () => {
      document.body.classList.remove("camera-preview-active");
      detenerPreview();
    };
  }, []);

  const iniciar = async () => {
    try {
      setFoto(null);
      await iniciarPreview();
      setActiva(true);
      setLog("Preview activo. La cámara está detrás de esta UI.");
    } catch (e) {
      setLog(`Error: ${String(e)}`);
    }
  };

  const detener = async () => {
    await detenerPreview();
    setActiva(false);
    setLog("Cámara detenida.");
  };

  const capturar = async () => {
    try {
      setFoto(await tomarFoto());
      setLog("Foto capturada.");
    } catch (e) {
      setLog(`Error foto: ${String(e)}`);
    }
  };

  return (
    <IonPage>
      {!activa && (
        <IonHeader>
          <IonToolbar color="dark">
            <IonTitle>Cámara Preview</IonTitle>
          </IonToolbar>
        </IonHeader>
      )}
      <IonContent className={activa ? undefined : "ion-padding"}>
        {!activa && (
          <IonCard>
            <IonCardContent>
              <IonButton expand="block" onClick={iniciar}>
                Iniciar cámara
              </IonButton>
            </IonCardContent>
          </IonCard>
        )}

        {foto && (
          <img
            src={foto}
            alt="captura"
            style={{ width: "100%", borderRadius: 12 }}
          />
        )}

        {!activa && (
          <IonText color="medium">
            <p>{log}</p>
          </IonText>
        )}
        <style>{`
          body.camera-preview-active,
          body.camera-preview-active ion-app,
          body.camera-preview-active ion-page,
          body.camera-preview-active ion-content {
            --background: transparent !important;
            --ion-background-color: transparent !important;
            background: transparent !important;
          }
          body.camera-preview-active ion-tab-bar {
            display: none;
          }
        `}</style>
      </IonContent>

      {/* Controles con fondo sólido: siempre visibles y tocables sobre el preview */}
      {activa && (
        <IonFooter>
          <IonToolbar color="dark">
            <IonButton fill="clear" color="light" onClick={girarCamara}>
              Girar
            </IonButton>
            <IonButton color="success" onClick={capturar}>
              Tomar foto
            </IonButton>
            <IonButton fill="clear" color="medium" onClick={detener}>
              Cerrar
            </IonButton>
          </IonToolbar>
          <IonToolbar color="dark">
            <IonText color="medium">
              <p style={{ margin: 0, fontSize: 12 }}>{log}</p>
            </IonText>
          </IonToolbar>
        </IonFooter>
      )}
    </IonPage>
  );
}
