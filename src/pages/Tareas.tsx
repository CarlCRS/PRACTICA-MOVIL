// CONCEPTO BASICO 2: Estado (useState) + Efectos (useEffect) + Listas
// Esta es la página principal: una lista de tareas (To-Do).
import { useEffect, useState } from 'react';
import {
  IonButton,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonList,
  IonPage,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonTitle,
  IonToolbar,
  IonText,
} from '@ionic/react';
import { addOutline } from 'ionicons/icons';
import { TaskItem, Task } from '../components/TaskItem';

type Filtro = 'todas' | 'pendientes' | 'hechas';

export default function Tareas() {
  // ESTADO: la memoria de la pantalla. Cuando cambia, la UI se redibuja sola.
  const [tareas, setTareas] = useState<Task[]>(() => {
    // Estado inicial: intenta leer lo guardado en el teléfono/navegador
    const guardado = localStorage.getItem('mis-tareas');
    return guardado ? JSON.parse(guardado) : [
      { id: 1, texto: 'Toca el check para completarme', hecha: false, fecha: new Date().toLocaleDateString() },
      { id: 2, texto: 'Desliza y aprende cómo funciona una app', hecha: false, fecha: new Date().toLocaleDateString() },
    ];
  });
  const [textoNuevo, setTextoNuevo] = useState(''); // lo que escribes en el input
  const [filtro, setFiltro] = useState<Filtro>('todas');

  // EFECTO: se ejecuta cada vez que [tareas] cambia. Aquí persistimos datos.
  // CONCEPTO BASICO 3: Almacenamiento local = la app recuerda aunque la cierres.
  useEffect(() => {
    localStorage.setItem('mis-tareas', JSON.stringify(tareas));
  }, [tareas]);

  // FUNCIONES: lógica de negocio. Siempre crean un array NUEVO (no mutan).
  const agregarTarea = () => {
    if (textoNuevo.trim() === '') return;
    const nueva: Task = {
      id: Date.now(),
      texto: textoNuevo.trim(),
      hecha: false,
      fecha: new Date().toLocaleDateString(),
    };
    setTareas([nueva, ...tareas]);
    setTextoNuevo(''); // limpia el input
  };

  const cambiarEstado = (id: number) => {
    setTareas(tareas.map((t) => (t.id === id ? { ...t, hecha: !t.hecha } : t)));
  };

  const eliminar = (id: number) => {
    setTareas(tareas.filter((t) => t.id !== id));
  };

  // DERIVADOS DEL ESTADO: no se guardan, se calculan al vuelo
  const filtradas = tareas.filter((t) => {
    if (filtro === 'pendientes') return !t.hecha;
    if (filtro === 'hechas') return t.hecha;
    return true;
  });
  const pendientes = tareas.filter((t) => !t.hecha).length;

  return (
    <IonPage>
      {/* Estructura móvil típica: Header fijo + Content con scroll */}
      <IonHeader>
        <IonToolbar color="primary">
          <IonTitle>Mi To-Do ({pendientes} pendientes)</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        {/* Entrada de datos */}
        <IonItem>
          <IonInput
            placeholder="Escribe una tarea y pulsa +"
            value={textoNuevo}
            onIonInput={(e) => setTextoNuevo(e.detail.value ?? '')}
            onKeyDown={(e) => e.key === 'Enter' && agregarTarea()}
          />
          <IonButton onClick={agregarTarea}>
            <IonIcon icon={addOutline} />
          </IonButton>
        </IonItem>

        {/* Filtro: ejemplo de estado que cambia lo visible sin recargar */}
        <IonSegment
          value={filtro}
          onIonChange={(e) => setFiltro(e.detail.value as Filtro)}
          style={{ margin: '12px 0' }}
        >
          <IonSegmentButton value="todas">
            <IonLabel>Todas</IonLabel>
          </IonSegmentButton>
          <IonSegmentButton value="pendientes">
            <IonLabel>Pendientes</IonLabel>
          </IonSegmentButton>
          <IonSegmentButton value="hechas">
            <IonLabel>Hechas</IonLabel>
          </IonSegmentButton>
        </IonSegment>

        {/* Lista: .map() convierte datos en componentes */}
        {filtradas.length === 0 ? (
          <IonText color="medium">
            <p style={{ textAlign: 'center', marginTop: 32 }}>
              No hay tareas aquí. ¡Agrega una arriba! 👆
            </p>
          </IonText>
        ) : (
          <IonList>
            {filtradas.map((t) => (
              <TaskItem
                key={t.id}
                tarea={t}
                alCambiarEstado={cambiarEstado}
                alEliminar={eliminar}
              />
            ))}
          </IonList>
        )}
      </IonContent>
    </IonPage>
  );
}
