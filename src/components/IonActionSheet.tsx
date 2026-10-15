import { IonButton, useIonActionSheet } from "@ionic/react";

export function IonActionSheet() {
  const [present] = useIonActionSheet();
  return (
    <IonButton
      onClick={() =>
        present({
          header: "Mi hoja de acciones",
          subHeader: "Subtitulo importante",
          buttons: [
            {
              text: "Eliminar",
              role: "Destructive",
              data: {
                action: "delete",
              },
            },
            {
              text: "Cancelar",
              role: "Cancel",
              data: {
                action: "cancel",
              },
            },
          ],
        })
      }
    >
      <p>ABRIR OPCIONES</p>
    </IonButton>
  );
}
