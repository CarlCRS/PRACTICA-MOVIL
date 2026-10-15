// CONCEPTO BASICO 1: Props
// Un componente hijo recibe datos y funciones del padre.
// Esto es la base de toda app móvil: dividir la UI en piezas reutilizables.
import {
  IonButton,
  IonCheckbox,
  IonIcon,
  IonItem,
  IonLabel,
  IonNote,
} from '@ionic/react';
import { trashOutline } from 'ionicons/icons';

// Definimos qué datos necesita este componente (su "contrato")
export interface Task {
  id: number;
  texto: string;
  hecha: boolean;
  fecha: string;
}

interface Props {
  tarea: Task;
  alCambiarEstado: (id: number) => void; // función que viene del padre
  alEliminar: (id: number) => void;
}

export function TaskItem({ tarea, alCambiarEstado, alEliminar }: Props) {
  return (
    <IonItem>
      {/* Evento onIonChange: cuando tocas el check, avisa al padre */}
      <IonCheckbox
        checked={tarea.hecha}
        onIonChange={() => alCambiarEstado(tarea.id)}
        style={{ marginRight: '12px' }}
      />
      <IonLabel
        style={{
          // Renderizado condicional de estilo: si está hecha, la tachamos
          textDecoration: tarea.hecha ? 'line-through' : 'none',
          opacity: tarea.hecha ? 0.5 : 1,
        }}
      >
        <h2>{tarea.texto}</h2>
        <IonNote>{tarea.fecha}</IonNote>
      </IonLabel>
      <IonButton
        fill="clear"
        color="danger"
        onClick={() => alEliminar(tarea.id)}
      >
        <IonIcon icon={trashOutline} />
      </IonButton>
    </IonItem>
  );
}
