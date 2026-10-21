// DEMO DE PLUGINS: página que prueba el wrapper nativo
import { useEffect, useState } from 'react';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
  IonText,
  IonBadge,
} from '@ionic/react';
import { esNativo, plataforma, vibrar, guardarContador, leerContador } from '../lib/nativo';
import { Bateria } from '../lib/bateria-plugin';

export default function Plugins() {
  const [log, setLog] = useState<string>('Pulsa un botón para probar un plugin.');
  const [contador, setContador] = useState(0);
  const [nivel, setNivel] = useState<number | null>(null);

  // Al entrar, lee el valor persistido (Preferences en móvil)
  useEffect(() => {
    leerContador().then(setContador);
  }, []);

  const probarVibracion = async () => {
    setLog('Vibrando...');
    setLog(await vibrar());
  };

  const sumar = async () => {
    const nuevo = contador + 1;
    setContador(nuevo);
    await guardarContador(nuevo);
    setLog(`Contador guardado con Preferences: ${nuevo}. Recarga y persiste.`);
  };

  // PLUGIN PERSONALIZADO: TS -> nativo con una sola línea
  const leerBateria = async () => {
    try {
      const r = await Bateria.getNivel(); // web: BateriaWeb, móvil: Java/Swift
      setNivel(r.nivel);
      setLog(`Batería: ${r.nivel}% (desde ${esNativo() ? 'Java/Swift nativo' : 'fallback web'})`);
    } catch (e) {
      setLog(`Error batería: ${String(e)}`);
    }
  };

  const vibrarNativo = async () => {
    await Bateria.vibrar({ ms: 300 });
    setLog('Vibración vía plugin personalizado (Vibrator / Taptic Engine)');
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="tertiary">
          <IonTitle>
            Plugins{' '}
            <IonBadge color={esNativo() ? 'success' : 'warning'}>
              {plataforma()} {esNativo() ? '(nativo)' : '(web)'}
            </IonBadge>
          </IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <IonCard>
          <IonCardHeader>
            <IonCardTitle>1. Haptics (vibración)</IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            <p>En Android/iOS vibra el motor háptico. En web usa fallback.</p>
            <IonButton expand="block" onClick={probarVibracion}>
              Vibrar
            </IonButton>
          </IonCardContent>
        </IonCard>

        <IonCard>
          <IonCardHeader>
            <IonCardTitle>2. Preferences (storage nativo)</IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            <p>Contador persistente: {contador}</p>
            <IonButton expand="block" onClick={sumar}>
              Sumar y guardar
            </IonButton>
          </IonCardContent>
        </IonCard>

        <IonCard>
          <IonCardHeader>
            <IonCardTitle>3. Plugin personalizado Bateria</IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            <p>Nivel: {nivel === null ? 'sin leer' : `${nivel}%`}</p>
            <IonButton expand="block" onClick={leerBateria}>
              Leer batería nativa
            </IonButton>
            <IonButton expand="block" fill="outline" onClick={vibrarNativo}>
              Vibrar nativo (ms)
            </IonButton>
          </IonCardContent>
        </IonCard>

        <IonCard>
          <IonCardHeader>
            <IonCardTitle>4. SDK biométrico (FacePlugin)</IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            <p>
              Integración de un SDK nativo cerrado: 455 MB de modelos ONNX y
              licencia offline atada al <code>applicationId</code>.
            </p>
            <IonButton expand="block" fill="outline" routerLink="/rostro">
              Abrir demo de rostro
            </IonButton>
          </IonCardContent>
        </IonCard>

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
