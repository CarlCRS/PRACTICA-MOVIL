// DEMO DE INTEGRACIÓN DE UN SDK BIOMÉTRICO CERRADO (FacePlugin)
//
// Esta pantalla muestra las 3 fases reales de una integración así:
//   1. Identificar el equipo   -> getMachineCode()
//   2. Activar la licencia     -> setActivation() + init()
//   3. Usar el motor           -> faceDetection() / templateExtraction()
//
// Ojo: sin licencia válida para com.ejemplo.myapp el paso 3 no funciona.
// La demo pública del SDK trae una key atada a com.faceplugin.facerecognitionsdk.
import { useEffect, useState } from 'react';
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
  IonNote,
  IonPage,
  IonText,
  IonTextarea,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import {
  cameraOutline,
  copyOutline,
  fingerPrintOutline,
  imagesOutline,
  keyOutline,
  shieldCheckmarkOutline,
} from 'ionicons/icons';
import {
  activar,
  codigoMaquina,
  compararRostros,
  detectarRostros,
  estadoLicencia,
  guardarLicencia,
  leerLicenciaGuardada,
  resumenRostro,
} from '../lib/rostro';
import type { FaceBox } from 'face-recognition-capacitor';

const APP_ID = 'com.ejemplo.myapp';

export default function Rostro() {
  const nativo = Capacitor.isNativePlatform();
  const [machine, setMachine] = useState('...');
  const [licencia, setLicencia] = useState('');
  const [listo, setListo] = useState(false);
  const [estado, setEstado] = useState('Sin activar');
  const [foto, setFoto] = useState<string | null>(null);
  const [rostros, setRostros] = useState<FaceBox[]>([]);
  const [comparacion, setComparacion] = useState<number | null>(null);
  const [log, setLog] = useState('Pulsa "Obtener código" para empezar.');

  // Al entrar: machine code + licencia guardada (si ya se activó antes).
  useEffect(() => {
    if (!nativo) {
      setLog('Estás en el navegador. Abre la app instalada en el teléfono.');
      return;
    }
    (async () => {
      try {
        setMachine(await codigoMaquina());
        const guardada = await leerLicenciaGuardada();
        if (guardada) {
          setLicencia(guardada);
          const r = await activar(guardada);
          setListo(r.ok);
          setEstado(r.mensaje);
          setLog(r.ok ? 'Licencia guardada válida. Motor cargado.' : r.mensaje);
        }
      } catch (e) {
        setLog(`Error: ${String(e)}`);
      }
    })();
  }, [nativo]);

  const obtenerCodigo = async () => {
    try {
      const c = await codigoMaquina();
      setMachine(c);
      setLog(`Código de máquina: ${c}`);
    } catch (e) {
      setLog(String(e));
    }
  };

  const copiarCodigo = async () => {
    try {
      await navigator.clipboard.writeText(machine);
      setLog('Código copiado. Envíalo al proveedor junto con el applicationId.');
    } catch {
      setLog(`Copia manual: ${machine}`);
    }
  };

  const activarLicencia = async () => {
    setLog('Activando...');
    try {
      await guardarLicencia(licencia);
      const r = await activar(licencia);
      setListo(r.ok);
      setEstado(r.mensaje);
      setLog(
        r.ok
          ? `Motor listo. ${await estadoLicencia()}`
          : `No se pudo activar: ${r.mensaje}`,
      );
    } catch (e) {
      setLog(`Error activando: ${String(e)}`);
    }
  };

  // Toma una foto con la cámara o elige una de la galería.
  // El SDK recibe SIEMPRE una URI nativa, nunca un blob del navegador.
  const elegirFoto = async (origen: 'camara' | 'galeria') => {
    try {
      const photo = await Camera.getPhoto({
        quality: 90,
        source: origen === 'camara' ? CameraSource.Camera : CameraSource.Photos,
        resultType: CameraResultType.Uri,
      });
      const uri = photo.path
        ? photo.path.startsWith('file://') || photo.path.startsWith('content:')
          ? photo.path
          : `file://${photo.path}`
        : photo.webPath;
      if (!uri) throw new Error('No se obtuvo la foto');

      setFoto(uri);
      setRostros([]);
      setComparacion(null);
      setLog('Analizando imagen en el motor nativo...');
      const r = await detectarRostros(uri);
      setRostros(r);
      setLog(
        r.length === 0
          ? 'El motor no detectó rostros en la foto.'
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
      if (!otra) throw new Error('No se obtuvo la segunda foto');
      const score = await compararRostros(foto, otra);
      setComparacion(score);
      setLog(
        `Similitud ${score.toFixed(3)} · ${score >= 0.67 ? 'misma persona' : 'personas distintas'} (umbral 0.67)`,
      );
    } catch (e) {
      setLog(`Error comparando: ${String(e)}`);
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="dark">
          <IonButtons slot="start">
            <IonBackButton defaultHref="/plugins" />
          </IonButtons>
          <IonTitle>
            Rostro{' '}
            <IonBadge color={listo ? 'success' : 'warning'}>
              {listo ? 'motor listo' : 'sin licencia'}
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

        <IonCard>
          <IonCardHeader>
            <IonCardSubtitle>Paso 1 · Identificar el equipo</IonCardSubtitle>
            <IonCardTitle>
              <IonIcon icon={fingerPrintOutline} /> Código de máquina
            </IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            <p>
              Es único por dispositivo y por <strong>applicationId</strong>.
              Este es el dato que se envía al proveedor para que firme la
              licencia.
            </p>
            <IonNote>
              appId actual: <code>{APP_ID}</code>
            </IonNote>
            <IonText color="medium">
              <p style={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
                {machine}
              </p>
            </IonText>
            <IonButton expand="block" onClick={obtenerCodigo} disabled={!nativo}>
              Obtener código
            </IonButton>
            <IonButton
              expand="block"
              fill="outline"
              onClick={copiarCodigo}
              disabled={!nativo || machine === '...'}
            >
              <IonIcon slot="start" icon={copyOutline} />
              Copiar
            </IonButton>
          </IonCardContent>
        </IonCard>

        <IonCard>
          <IonCardHeader>
            <IonCardSubtitle>Paso 2 · Activar</IonCardSubtitle>
            <IonCardTitle>
              <IonIcon icon={keyOutline} /> Licencia FP1…
            </IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            <p>
              La licencia es offline y va firmada contra el appId. Sin una key
              para <code>{APP_ID}</code> el motor nunca carga (código 1).
            </p>
            <IonTextarea
              label="Licencia"
              labelPlacement="stacked"
              autoGrow
              rows={3}
              value={licencia}
              onIonInput={(e) => setLicencia(e.detail.value ?? '')}
              placeholder="FP1...."
            />
            <IonButton
              expand="block"
              onClick={activarLicencia}
              disabled={!nativo || licencia.trim().length < 10}
            >
              Guardar y activar
            </IonButton>
            <IonText color={listo ? 'success' : 'danger'}>
              <p>{estado}</p>
            </IonText>
          </IonCardContent>
        </IonCard>

        <IonCard>
          <IonCardHeader>
            <IonCardSubtitle>Paso 3 · Usar el motor</IonCardSubtitle>
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
              onClick={() => elegirFoto('camara')}
              disabled={!listo}
            >
              <IonIcon slot="start" icon={cameraOutline} />
              Tomar foto
            </IonButton>
            <IonButton
              expand="block"
              fill="outline"
              onClick={() => elegirFoto('galeria')}
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
                  width: '100%',
                  borderRadius: 12,
                  marginTop: 12,
                  display: 'block',
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
                        <p key={linea} style={{ margin: '2px 0' }}>
                          {linea}
                        </p>
                      ))}
                    </IonLabel>
                  </IonItem>
                ))}
              </IonList>
            )}

            {rostros.length > 0 && (
              <IonButton
                expand="block"
                fill="clear"
                onClick={compararConOtra}
              >
                Comparar 1:1 con otra foto
              </IonButton>
            )}

            {comparacion !== null && (
              <IonText color={comparacion >= 0.67 ? 'success' : 'medium'}>
                <p>Score 1:1: {comparacion.toFixed(3)}</p>
              </IonText>
            )}
          </IonCardContent>
        </IonCard>

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
    </IonPage>
  );
}
