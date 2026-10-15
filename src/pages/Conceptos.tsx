// CONCEPTO BASICO 4: Segunda pantalla = Navegación
// Las apps móviles son varias "pages" conectadas por un Router + Tabs.
import {
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
} from "@ionic/react";

const conceptos = [
  {
    titulo: "1. Componentes",
    texto:
      "Toda la UI son piezas (IonButton, IonList, TaskItem). Se combinan como LEGOs. Props = datos que el padre pasa al hijo.",
  },
  {
    titulo: "2. Estado (useState)",
    texto:
      "Es la memoria de la pantalla. Ej: lista de tareas, texto del input, filtro activo. Cuando cambia con setX(), la pantalla se redibuja sola.",
  },
  {
    titulo: "3. Efectos (useEffect)",
    texto:
      "Código que corre cuando algo cambia. Ej: guardar en localStorage cada vez que cambian las tareas. Así la app recuerda aunque la cierres.",
  },
  {
    titulo: "4. Navegación (Tabs + Router)",
    texto:
      "IonReactRouter + IonTabs + IonRouterOutlet. Cada tab es una ruta (/tareas, /aprende). El router decide qué Page mostrar. Mira App.tsx.",
  },
  {
    titulo: "5. Eventos táctiles",
    texto:
      "onClick, onIonChange, onIonInput. El dedo del usuario dispara una función que actualiza el estado. Estado nuevo = UI nueva.",
  },
  {
    titulo: "6. Compilar a móvil",
    texto:
      'Esto corre en web con "npm run dev". Para teléfono real: se envuelve con Capacitor (npx cap add android/ios) y accedes a cámara, GPS, notificaciones.',
  },
  {
    titulo: "7. Pa mas miedo que tengo",
    texto:
      'Esto pasa por no estar preparado para una entrevista, cuando en realidad no se ni hablar con las personas :"V ',
  },
];

export default function Conceptos() {
  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="secondary">
          <IonTitle>¿Cómo funciona una app?</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        {conceptos.map((c) => (
          <IonCard key={c.titulo}>
            <IonCardHeader>
              <IonCardTitle>{c.titulo}</IonCardTitle>
            </IonCardHeader>
            <IonCardContent>{c.texto}</IonCardContent>
          </IonCard>
        ))}
      </IonContent>
    </IonPage>
  );
}
