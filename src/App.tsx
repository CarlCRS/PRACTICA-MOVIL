// CONCEPTO BASICO 0: Punto de entrada y Navegación
// IonApp = contenedor de toda la app móvil.
// IonReactRouter + IonTabs + IonRouterOutlet = sistema de pantallas.
// Cada <Route> asocia una URL (/tareas) con un componente (Tareas).
import { Route, Routes, Navigate } from 'react-router-dom';
import {
  IonApp,
  IonIcon,
  IonLabel,
  IonRouterOutlet,
  IonTabBar,
  IonTabButton,
  IonTabs,
  setupIonicReact,
} from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { bookOutline, cameraOutline, documentTextOutline, hardwareChipOutline, listOutline, micOutline } from 'ionicons/icons';
import Tareas from './pages/Tareas';
import Conceptos from './pages/Conceptos';
import Plugins from './pages/Plugins';
import Grabadora from './pages/Grabadora';
import Camara from './pages/Camara';
import PlanMedico from './pages/PlanMedico';
import Rostro from './pages/Rostro';

/* Core CSS required for Ionic components to work properly */
import '@ionic/react/css/core.css';
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';
import '@ionic/react/css/padding.css';
import '@ionic/react/css/float-elements.css';
import '@ionic/react/css/text-alignment.css';
import '@ionic/react/css/text-transformation.css';
import '@ionic/react/css/flex-utils.css';
import '@ionic/react/css/display.css';
import '@ionic/react/css/palettes/dark.system.css';
import './theme/variables.css';

setupIonicReact();

const App: React.FC = () => (
  <IonApp>
    <IonReactRouter>
      <IonTabs>
        <IonRouterOutlet>
          <Routes>
            {/* Cuando entras a /, te redirige a /tareas */}
            <Route path="/tareas" element={<Tareas />} />
            <Route path="/aprende" element={<Conceptos />} />
            <Route path="/plugins" element={<Plugins />} />
            <Route path="/grabadora" element={<Grabadora />} />
            <Route path="/camara" element={<Camara />} />
            <Route path="/plan-medico" element={<PlanMedico />} />
            {/* Sin pestaña propia: se entra desde la tarjeta de Plugins */}
            <Route path="/rostro" element={<Rostro />} />
            <Route path="/" element={<Navigate to="/tareas" />} />
          </Routes>
        </IonRouterOutlet>

        {/* Barra inferior típica de app móvil: 2 pestañas */}
        <IonTabBar slot="bottom">
          <IonTabButton tab="tareas" href="/tareas">
            <IonIcon icon={listOutline} />
            <IonLabel>Tareas</IonLabel>
          </IonTabButton>
          <IonTabButton tab="aprende" href="/aprende">
            <IonIcon icon={bookOutline} />
            <IonLabel>Aprende</IonLabel>
          </IonTabButton>
          <IonTabButton tab="plugins" href="/plugins">
            <IonIcon icon={hardwareChipOutline} />
            <IonLabel>Plugins</IonLabel>
          </IonTabButton>
          <IonTabButton tab="grabadora" href="/grabadora">
            <IonIcon icon={micOutline} />
            <IonLabel>Grabar</IonLabel>
          </IonTabButton>
          <IonTabButton tab="camara" href="/camara">
            <IonIcon icon={cameraOutline} />
            <IonLabel>Cámara</IonLabel>
          </IonTabButton>
          <IonTabButton tab="plan-medico" href="/plan-medico">
            <IonIcon icon={documentTextOutline} />
            <IonLabel>Plan</IonLabel>
          </IonTabButton>
        </IonTabBar>
      </IonTabs>
    </IonReactRouter>
  </IonApp>
);

export default App;
